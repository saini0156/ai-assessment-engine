import concurrent.futures
import itertools
import json
import logging
import random
import re
import threading
import uuid
from typing import Any, Dict, List, Optional

import httpx
from pydantic import TypeAdapter

from app.config import settings
from app.models.schemas import (
    TopicItem,
    InternalQuestion,
    InternalQuizSession,
)
from app.prompts.templates import (
    TOPIC_EXTRACTION_PROMPT,
    QUIZ_GENERATION_PROMPT,
    TUTOR_EXPLAIN_PROMPT,
    DIFFICULTY_DIRECTIVES,
    MODE_DIRECTIVES,
)

logger = logging.getLogger(__name__)

TOPIC_LIST_ADAPTER = TypeAdapter(List[TopicItem])


def parse_topics_data(data: Any) -> List[TopicItem]:
    """
    Safely parses topics from LLM responses whether returned as:
      - Direct list: [{"topic_id": "top_1", ...}]
      - Dict wrapping list: {"topics": [...]}, {"topic_list": [...]}, etc.
    """
    if isinstance(data, dict):
        for val in data.values():
            if isinstance(val, list):
                data = val
                break
    if not isinstance(data, list):
        data = []
    return TOPIC_LIST_ADAPTER.validate_python(data)

def clean_math_text(s: str) -> str:
    """
    Standardizes LaTeX math formulas and fixes broken LLM notation:
      - Converts ^circ, ^{circ}, ^\\circ into standard ^{\\circ}
      - Normalizes degree notations (e.g. 15° -> 15^{\\circ})
      - Adds spacing between degree and minutes (e.g. 13^{\\circ} 20')
      - Wraps bare LaTeX math commands in $...$ if not already delimited
    """
    if not s:
        return s
    import re
    # 1. Standardize degree notation: ^circ, ^{circ}, ^\circ -> ^{\circ}
    s = re.sub(r'\^\{?\\?circ\}?', r'^{\\circ}', s)
    # 2. Add space after degree if followed by a number: ^{\circ}30' -> ^{\circ} 30'
    s = re.sub(r'(\^\{\\circ\})(\d+)', r'\1 \2', s)
    # 3. Handle unicode degree symbol: 360° -> 360^{\circ}
    s = re.sub(r'(\d+)\s*°(?!\w)', r'\1^{\\circ}', s)

    # 4. If string contains raw LaTeX commands and has no $, wrap it in $ so KaTeX renders it
    if "\\" in s and "$" not in s:
        math_keywords = ["\\frac", "\\sqrt", "\\times", "\\pm", "\\sum", "\\int", "\\alpha", "\\beta", "\\theta", "\\pi", "\\cdot", "\\le", "\\ge", "\\ne", "\\approx"]
        if any(kw in s for kw in math_keywords):
            s = f"${s}$"

    # 5. Decode literal unicode escapes like \u{00E2} or \u00e2 and fix Hindi font artifacts
    def _decode_hex_brace(match):
        try:
            return chr(int(match.group(1), 16))
        except Exception:
            return ""
    s = re.sub(r'\\u\{([0-9a-fA-F]+)\}', _decode_hex_brace, s)

    def _decode_hex4(match):
        try:
            return chr(int(match.group(1), 16))
        except Exception:
            return ""
    s = re.sub(r'\\u([0-9a-fA-F]{4})', _decode_hex4, s)

    # Fix common Hindi PDF ligature corruptions (e.g. 'भचâड' or 'भच\u{00E2}ड' -> 'भचक्र')
    s = re.sub(r'भच[â\u00e2\?]+ड?', 'भचक्र', s)
    s = s.replace('â€™', "'").replace('â€œ', '"').replace('â€', '"')

    # Common Hindi spelling normalization (e.g. 'घुमने' -> 'घूमने')
    s = s.replace('घुमने', 'घूमने')

    return s


def sanitize_and_parse_json(raw_text: str) -> Any:
    """
    Ultra-resilient JSON parser:
      - Strips markdown code blocks (```json ... ```)
      - Unescapes trailing commas (, } -> })
      - Extracts JSON array or object if surrounded by preamble/chatter
    """
    import re, json
    text = (raw_text or "").strip()
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"\s*```$", "", text, flags=re.MULTILINE)
    text = text.strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Locate outermost JSON structure [ ... ] or { ... }
        match = re.search(r"(\[.*\]|\{.*\})", text, re.DOTALL)
        if match:
            candidate = match.group(1).strip()
            # Clean trailing commas: ,] -> ] and ,} -> }
            candidate = re.sub(r",\s*([\]\}])", r"\1", candidate)
            return json.loads(candidate)
        raise


def normalize_ai_question(item: Any, idx: int) -> Optional[InternalQuestion]:
    """
    Robust normalizer that adapts any LLM response structure:
      - options as list ["A", "B", "C", "D"] or dict {"A": "...", ...}
      - correct_option as integer (0 -> 'A') or string ("A", "Option A", "answer")
      - auto-detects and aligns answer key if explanation contradicts correct_option
      - ensures all 4 options are distinct
      - missing explanation auto-filled
    """
    if not isinstance(item, dict):
        return None

    import re, random
    q_text = clean_math_text(str(item.get("question") or item.get("question_text") or "").strip())
    if not q_text:
        return None

    # 1. Normalize Options (supports list or dict)
    raw_opts = item.get("options")
    clean_opts: Dict[str, str] = {}
    if isinstance(raw_opts, list):
        for o_idx, opt in enumerate(raw_opts[:4]):
            key = chr(ord("A") + o_idx)
            opt_str = clean_math_text(str(opt).strip())
            # Strip leading "A) ", "A. ", "A: "
            if len(opt_str) >= 3 and opt_str[0].upper() == key and opt_str[1] in [")", ".", ":", "-"]:
                opt_str = opt_str[2:].strip()
            clean_opts[key] = opt_str
    elif isinstance(raw_opts, dict):
        for key in ["A", "B", "C", "D"]:
            val = raw_opts.get(key) or raw_opts.get(key.lower()) or "Option Unavailable"
            clean_opts[key] = clean_math_text(str(val).strip())

    # Ensure all 4 options exist
    for key in ["A", "B", "C", "D"]:
        if key not in clean_opts or not clean_opts[key]:
            clean_opts[key] = f"Option {key}"

    # Deduplicate options if any two options are identical
    seen_texts = set()
    for key in ["A", "B", "C", "D"]:
        opt_val = clean_opts[key]
        if opt_val in seen_texts:
            clean_opts[key] = f"{opt_val} (Alternative {key})"
        seen_texts.add(clean_opts[key])

    # 2. Normalize Correct Option (handles integer 0, 1, 2, 3 or strings)
    raw_corr = item.get("correct_option") if item.get("correct_option") is not None else (
        item.get("answer") if item.get("answer") is not None else item.get("correct_answer")
    )
    if isinstance(raw_corr, int) and 0 <= raw_corr <= 3:
        clean_correct = chr(ord("A") + raw_corr)
    else:
        m = re.search(r"[A-Da-d]", str(raw_corr or "A"))
        clean_correct = m.group(0).upper() if m else "A"

    # 3. Normalize Explanation
    explanation = clean_math_text(str(item.get("explanation") or item.get("reasoning") or "").strip())
    if not explanation:
        explanation = f"Option {clean_correct} is the verified correct answer for this question."

    # Consistency Check: If explanation explicitly states another option as correct (e.g. "Option C is correct")
    # align clean_correct before shuffling so answer key is never wrong!
    explicit_key_match = re.search(
        r"(?:correct answer is|sahi uttar hai|sahi vikalp hai|correct option is)\s*[:\-]?\s*Option\s*([A-D])\b",
        explanation,
        re.IGNORECASE
    )
    if explicit_key_match:
        detected_key = explicit_key_match.group(1).upper()
        if detected_key in clean_opts and detected_key != clean_correct:
            clean_correct = detected_key

    # 4. Balanced Option Shuffling (Eliminates Option A Bias!)
    correct_text = clean_opts.get(clean_correct, clean_opts.get("A", "Option A"))
    opt_pairs = [(k == clean_correct, text) for k, text in clean_opts.items()]
    random.shuffle(opt_pairs)

    shuffled_opts: Dict[str, str] = {}
    new_correct = "A"
    for o_idx, (is_corr, opt_text) in enumerate(opt_pairs[:4]):
        key = chr(ord("A") + o_idx)
        shuffled_opts[key] = opt_text
        if is_corr:
            new_correct = key

    # In explanation, update any literal references to the old correct letter
    if clean_correct != new_correct:
        explanation = re.sub(rf"\bOption {clean_correct}\b", f"Option {new_correct}", explanation)
        explanation = re.sub(rf"\bविकल्प {clean_correct}\b", f"विकल्प {new_correct}", explanation)
        explanation = re.sub(rf"\({clean_correct}\)", f"({new_correct})", explanation)

    return InternalQuestion(
        id=f"q_{idx}",
        question=q_text,
        options=shuffled_opts,
        correct_option=new_correct,
        explanation=explanation,
    )


def _parse_generated(raw_data: Any) -> List[InternalQuestion]:
    """
    Parses LLM output (list or wrapped dict) into a list of normalized InternalQuestion objects.
    Accessible globally throughout LLMService.
    """
    if isinstance(raw_data, list):
        items = raw_data
    elif isinstance(raw_data, dict):
        items = next((v for v in raw_data.values() if isinstance(v, list)), [])
    else:
        items = []

    results = []
    for i, raw_item in enumerate(items, start=1):
        q = normalize_ai_question(raw_item, i)
        if q:
            results.append(q)
    return results


def shuffle_question_options(q: InternalQuestion) -> InternalQuestion:
    """
    Shuffles options (A, B, C, D) randomly for any question (Bank, AI, or Mock)
    and synchronizes correct_option and explanation accordingly.
    Guarantees every student receives randomized option ordering.
    """
    if not q or not q.options or len(q.options) < 2:
        return q

    old_correct = q.correct_option.strip().upper() if q.correct_option else "A"

    # Pair each option: (is_correct, text)
    pairs = []
    for k in ["A", "B", "C", "D"]:
        if k in q.options:
            is_corr = (k.strip().upper() == old_correct)
            pairs.append((is_corr, q.options[k]))

    for k, text in q.options.items():
        if k not in ["A", "B", "C", "D"]:
            is_corr = (k.strip().upper() == old_correct)
            pairs.append((is_corr, text))

    import random
    random.shuffle(pairs)

    new_options: Dict[str, str] = {}
    new_correct = "A"
    for idx, (is_corr, text) in enumerate(pairs[:4]):
        key = chr(ord("A") + idx)
        new_options[key] = text
        if is_corr:
            new_correct = key

    explanation = q.explanation or ""
    if old_correct != new_correct and explanation:
        import re
        explanation = re.sub(rf"\bOption {old_correct}\b", f"Option {new_correct}", explanation)
        explanation = re.sub(rf"\bविकल्प {old_correct}\b", f"विकल्प {new_correct}", explanation)
        explanation = re.sub(rf"\({old_correct}\)", f"({new_correct})", explanation)

    return InternalQuestion(
        id=q.id,
        question=q.question,
        options=new_options,
        correct_option=new_correct,
        explanation=explanation,
        is_mock=getattr(q, "is_mock", False),
    )


def is_duplicate_question(new_q: InternalQuestion, existing_questions: List[InternalQuestion]) -> bool:
    """
    Multi-factor smart deduplication:
      1. Exact question text comparison.
      2. Meaningful token Jaccard similarity (>= 0.45 threshold).
      3. Identical correct answer value collision on shared topics.
    """
    if not new_q or not new_q.question:
        return True

    def _tokenize(text: str) -> set:
        cleaned = re.sub(r'[^\w\s]', ' ', text.lower())
        words = set(cleaned.split())
        stop_words = {
            "what", "is", "the", "of", "in", "to", "a", "an", "and", "or", "for", "which",
            "के", "की", "का", "को", "में", "से", "होता", "होती", "है", "हैं", "किन्हें",
            "कहा", "जाता", "अनुसार", "होते", "कुल", "संख्या", "किन", "भावों", "समान", "किसे", "कौन"
        }
        return {w for w in words if w not in stop_words and len(w) > 1}

    new_tokens = _tokenize(new_q.question)
    new_ans = str(new_q.options.get(new_q.correct_option, "")).strip().lower()
    new_ans_clean = re.sub(r'[^\w]', '', new_ans)

    for ex in existing_questions:
        if not ex or not ex.question:
            continue

        # 1. Exact string match
        if new_q.question.strip().lower() == ex.question.strip().lower():
            return True

        ex_ans = str(ex.options.get(ex.correct_option, "")).strip().lower()
        ex_ans_clean = re.sub(r'[^\w]', '', ex_ans)

        # 2. Answer collision: Both questions have the same correct answer (e.g. "108" or "13° 20'")
        if new_ans_clean and ex_ans_clean and len(new_ans_clean) >= 2:
            if new_ans_clean == ex_ans_clean or (len(new_ans_clean) > 4 and new_ans_clean in ex_ans_clean):
                ex_tokens = _tokenize(ex.question)
                # If they share even 1 meaningful keyword and have the same answer, it's a duplicate concept
                if len(new_tokens & ex_tokens) >= 1:
                    return True

        # 3. High word token overlap (Jaccard similarity >= 0.45)
        ex_tokens = _tokenize(ex.question)
        if new_tokens and ex_tokens:
            union = new_tokens | ex_tokens
            if union and (len(new_tokens & ex_tokens) / len(union)) >= 0.45:
                return True

    return False


# =========================================================================
# Multi-Key Rotation Manager for High Concurrency & Zero Rate Limit Errors
# =========================================================================
class GroqKeyPool:
    """Thread-safe round-robin API key pool for Groq Cloud."""

    def __init__(self, keys: List[str]):
        self.keys = [k.strip() for k in keys if k and k.strip()]
        self._lock = threading.Lock()
        self._cycler = itertools.cycle(self.keys) if self.keys else None

    def get_key(self) -> Optional[str]:
        if not self.keys:
            return None
        with self._lock:
            return next(self._cycler)

    def total_keys(self) -> int:
        return len(self.keys)


# =========================================================================
# Enterprise High-Throughput LLM Service
# =========================================================================
from app.services.mock_data import MockAIEngine


class LLMService:
    """
    Two-Tier Fast Multi-Provider AI Service:
      - Primary (Tier 1): Groq Cloud LPU (~1.2 seconds, Multi-Key Rotation)
      - Secondary (Tier 2): Google Gemini Flash (~3.5 seconds, Auto-Timeout Protected)
      - Safety Net (Tier 3): Subject-Aware Offline Mock Engine (0.001s, 100% uptime)
    
    Includes Parallel Batch Generation for high-volume quizzes (20 to 50 questions).
    """

    def __init__(self):
        self.groq_pool = GroqKeyPool(settings.GROQ_API_KEYS)
        self.gemini_keys = settings.GEMINI_API_KEYS
        self._executor = concurrent.futures.ThreadPoolExecutor(max_workers=5)
        self._groq_client = httpx.Client(
            timeout=45.0,
            limits=httpx.Limits(max_keepalive_connections=20, max_connections=50)
        )
        logger.info(
            "LLMService initialized with %d Groq keys and %d Gemini keys.",
            self.groq_pool.total_keys(),
            len(self.gemini_keys),
        )

    # -------------------------------------------------------------
    # Groq API Caller with Multi-Key Rotation & 429 Failover
    # -------------------------------------------------------------
    def _call_groq(self, prompt: str, system_message: str = "", temperature: float = 0.7) -> Any:
        keys_to_try = list(self.groq_pool.keys)
        if not keys_to_try:
            raise RuntimeError("No Groq API keys configured.")

        # Start from next rotated key in pool
        start_key = self.groq_pool.get_key()
        if start_key in keys_to_try:
            idx = keys_to_try.index(start_key)
            keys_to_try = keys_to_try[idx:] + keys_to_try[:idx]

        url = "https://api.groq.com/openai/v1/chat/completions"
        messages = []
        if system_message:
            messages.append({"role": "system", "content": system_message})
        user_prompt = prompt
        if "json" not in user_prompt.lower():
            user_prompt += "\nOutput strictly as a JSON object."
        messages.append({"role": "user", "content": user_prompt})

        # High-speed active Groq model list prioritized by response latency and account availability
        models_to_try = [
            "llama-3.3-70b-versatile",
            "llama-3.1-8b-instant",
            "deepseek-r1-distill-llama-70b",
            "gemma2-9b-it",
            "mixtral-8x7b-32768",
        ]

        last_error = None
        for api_key in keys_to_try:
            masked = f"...{api_key[-4:]}" if len(api_key) >= 4 else "key"
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            }
            for model_candidate in models_to_try:
                try:
                    payload = {
                        "model": model_candidate,
                        "messages": messages,
                        "response_format": {"type": "json_object"},
                        "temperature": temperature,
                        "max_tokens": 2048,
                    }
                    resp = self._groq_client.post(url, json=payload, headers=headers)
                    if resp.status_code == 400 and "response_format" in payload:
                        # Some models (e.g. gemma2, mixtral) do not support response_format="json_object"
                        # Retry without response_format since prompt already enforces JSON format
                        del payload["response_format"]
                        resp = self._groq_client.post(url, json=payload, headers=headers)

                    if resp.status_code == 429:
                        logger.warning("Groq 429 Rate Limit hit on key %s. Rotating to next key...", masked)
                        break  # Try next API key
                    resp.raise_for_status()
                    content = resp.json()["choices"][0]["message"]["content"]
                    parsed = sanitize_and_parse_json(content)

                    # Unpack wrapped lists if nested under keys like {'questions': [...]} or {'topics': [...]}
                    if isinstance(parsed, dict):
                        for val in parsed.values():
                            if isinstance(val, list):
                                return val
                    return parsed
                except Exception as e:
                    last_error = e
                    logger.warning("Groq candidate %s with key %s failed: %s", model_candidate, masked, e)
                    continue

        raise RuntimeError(f"All Groq keys and models failed. Last error: {last_error}")

    # -------------------------------------------------------------
    # High-Performance Gemini API Caller (Direct REST + SDK Fallback)
    # -------------------------------------------------------------
    def _call_gemini(self, prompt: str, temperature: float = 0.7) -> Any:
        keys_to_try = list(self.gemini_keys)
        if not keys_to_try:
            raise RuntimeError("No Gemini API keys configured.")

        last_error = None
        gemini_models = ["gemini-flash-latest", "gemini-2.0-flash", "gemini-1.5-flash"]

        for api_key in keys_to_try:
            masked = f"...{api_key[-4:]}" if len(api_key) >= 4 else "key"
            for gemini_model in gemini_models:
                # 1. Primary: Direct Fast REST API via httpx using official x-goog-api-key header
                try:
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/{gemini_model}:generateContent?key={api_key}"
                    headers = {
                        "Content-Type": "application/json",
                        "x-goog-api-key": api_key,
                    }
                    payload = {
                        "contents": [{"parts": [{"text": prompt}]}],
                        "generationConfig": {
                            "responseMimeType": "application/json",
                            "temperature": temperature,
                        }
                    }
                    resp = self._groq_client.post(url, json=payload, headers=headers, timeout=45.0)
                    if resp.status_code == 429:
                        logger.warning("Gemini 429 rate limit hit on key %s. Rotating to next key...", masked)
                        break
                    resp.raise_for_status()
                    data = resp.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts:
                            raw_text = parts[0].get("text", "").strip()
                            parsed = sanitize_and_parse_json(raw_text)
                            if isinstance(parsed, dict):
                                for val in parsed.values():
                                    if isinstance(val, list):
                                        return val
                            return parsed
                except Exception as e_rest:
                    last_error = e_rest
                    logger.warning("Gemini REST model %s on key %s failed: %s", gemini_model, masked, e_rest)

                # 2. Secondary: google-genai SDK with v1beta forced
                try:
                    from google import genai
                    client = genai.Client(api_key=api_key, http_options={"api_version": "v1beta"})
                    def _execute():
                        return client.models.generate_content(
                            model=gemini_model,
                            contents=prompt,
                            config={"response_mime_type": "application/json"},
                        )
                    future = self._executor.submit(_execute)
                    response = future.result(timeout=25.0)
                    text = getattr(response, "text", "").strip()
                    if text:
                        parsed = sanitize_and_parse_json(text)
                        if isinstance(parsed, dict):
                            for val in parsed.values():
                                if isinstance(val, list):
                                    return val
                        return parsed
                except Exception as e_sdk:
                    last_error = e_sdk

        raise RuntimeError(f"All Gemini models and keys failed. Last error: {last_error}")

    # -------------------------------------------------------------
    # FreeLLMAPI Unified Gateway Caller (14-Key Pool with Failover)
    # -------------------------------------------------------------
    def _call_freellmapi(self, prompt: str, model: str = "auto", system_message: str = "", temperature: float = 0.7) -> Any:
        if not settings.FREELLMAPI_URL or not settings.FREELLMAPI_KEY:
            raise RuntimeError("FreeLLMAPI is not configured.")

        url = f"{settings.FREELLMAPI_URL.rstrip('/')}/chat/completions"
        headers = {
            "Authorization": f"Bearer {settings.FREELLMAPI_KEY}",
            "Content-Type": "application/json",
        }

        messages = []
        if system_message:
            messages.append({"role": "system", "content": system_message})
        user_prompt = prompt
        if "json" not in user_prompt.lower():
            user_prompt += "\nOutput strictly as a JSON object."
        messages.append({"role": "user", "content": user_prompt})

        payload = {
            "model": model,
            "messages": messages,
            "response_format": {"type": "json_object"},
            "temperature": temperature,
        }

        resp = self._groq_client.post(url, json=payload, headers=headers, timeout=25.0)
        resp.raise_for_status()

        routed_via = resp.headers.get("x-routed-via", "freellmapi")
        logger.info("FreeLLMAPI fulfilled request via: %s", routed_via)

        content = resp.json()["choices"][0]["message"]["content"]
        parsed = sanitize_and_parse_json(content)

        if isinstance(parsed, dict):
            for val in parsed.values():
                if isinstance(val, list):
                    return val
        return parsed

    # -------------------------------------------------------------
    # Topic Extraction Cascade
    # -------------------------------------------------------------
    def extract_topics(self, subject: str, text: str) -> List[TopicItem]:
        is_hindi = bool(re.search(r'[\u0900-\u097F]', f"{subject} {text[:4000]}")) or "hindi" in (subject or "").lower()
        if is_hindi:
            lang_directive = (
                "CRITICAL HINDI LANGUAGE ENFORCEMENT:\n"
                "- The provided syllabus text is in HINDI (हिंदी).\n"
                "- You MUST output all 'topic_name', 'subtopics', and 'summary' strictly in natural, fluent NCERT standard HINDI (हिंदी / Devanagari script).\n"
                "- Use authentic educational terminology. Keep standard English terms in parentheses for clarity: e.g. 'विद्युत धारा (Electric Current)'."
            )
        else:
            lang_directive = "LANGUAGE DIRECTIVE: Output all topic_name, subtopics, and summary in clear English matching the syllabus text."

        prompt = TOPIC_EXTRACTION_PROMPT.format(subject=subject, text=text[:12000], language_directive=lang_directive)

        # Tier 0: FreeLLMAPI Unified Gateway (14-Key Pool)
        if settings.FREELLMAPI_URL and settings.FREELLMAPI_KEY:
            try:
                target_model = "gemini-flash" if is_hindi else "qwen3.8-27b"
                data = self._call_freellmapi(
                    prompt,
                    model=target_model,
                    system_message="You are a syllabus parser that strictly outputs a JSON object containing a topics list.",
                    temperature=0.2,
                )
                topics = parse_topics_data(data)
                if len(topics) >= 1:
                    logger.info("Successfully extracted %d topics via FreeLLMAPI (%s).", len(topics), target_model)
                    return topics
            except Exception as e_free:
                logger.warning("FreeLLMAPI topic extraction failed (%s). Continuing direct fallback...", e_free)

        tier_order = ["gemini", "groq"] if is_hindi else ["groq", "gemini"]
        for provider in tier_order:
            if provider == "groq" and self.groq_pool.total_keys() > 0:
                try:
                    data = self._call_groq(
                        prompt,
                        system_message="You are a syllabus parser that strictly outputs a JSON object containing a topics list.",
                        temperature=0.2,
                    )
                    topics = parse_topics_data(data)
                    if len(topics) >= 1:
                        logger.info("Successfully extracted %d topics via Groq (%s).", len(topics), "Fallback" if is_hindi else "Primary")
                        return topics
                except Exception as e_groq:
                    logger.warning("Groq topic extraction failed (%s). Continuing fallback...", e_groq)

            elif provider == "gemini" and len(self.gemini_keys) > 0:
                try:
                    data = self._call_gemini(prompt, temperature=0.2)
                    topics = parse_topics_data(data)
                    if len(topics) >= 1:
                        logger.info("Successfully extracted %d topics via Gemini (%s).", len(topics), "Primary" if is_hindi else "Fallback")
                        return topics
                except Exception as e_gem:
                    logger.warning("Gemini topic extraction failed (%s). Continuing fallback...", e_gem)

        # Tier 3: Mock Fallback
        return MockAIEngine.extract_topics(subject, text)

    # -------------------------------------------------------------
    # Single Chunk Generator for Quiz Batching (Notes Grounded & Math Protected)
    # -------------------------------------------------------------
    def _generate_chunk(
        self,
        subject: str,
        topic: str,
        count: int,
        difficulty: str,
        chunk_index: int = 1,
        total_chunks: int = 1,
        language: str = "Auto",
        context: Optional[str] = None,
        mode: str = "hybrid",
        avoid_questions: Optional[List[str]] = None,
    ) -> List[InternalQuestion]:
        """Generates a slice of questions with context to avoid duplicate questions."""
        diff_key = difficulty.strip().capitalize() if difficulty else "Medium"
        if diff_key not in ["Easy", "Medium", "Hard"]:
            diff_key = "Medium"
        diff_directive = DIFFICULTY_DIRECTIVES.get(diff_key, DIFFICULTY_DIRECTIVES["Medium"])

        # Determine mode directive
        mode_clean = (mode or "hybrid").strip().lower()
        if mode_clean in ["notes", "strict_notes", "strict"]:
            mode_key = "notes"
        elif mode_clean in ["ai", "open_ai", "open", "llm"]:
            mode_key = "ai"
        else:
            mode_key = "hybrid"

        mode_directive = MODE_DIRECTIVES.get(mode_key, MODE_DIRECTIVES["hybrid"])

        clean_lang = (language or "Auto").strip().lower()
        if clean_lang == "hindi":
            is_hindi = True
        elif clean_lang == "english":
            is_hindi = False
        else:
            is_hindi = bool(re.search(r'[\u0900-\u097F]', f"{subject} {topic}")) or "hindi" in (subject or "").lower() or "hindi" in (topic or "").lower()

        if is_hindi:
            lang_directive = (
                "CRITICAL HINDI LANGUAGE GUIDELINES (NCERT / CBSE STANDARD):\n"
                "- The topic/subject is in HINDI (हिंदी).\n"
                "- You MUST generate ALL questions, all 4 options (A, B, C, D), and all explanations strictly in natural, fluent NCERT standard educational Hindi (मानक शैक्षणिक हिंदी).\n"
                "- Use authentic board-exam academic terminology:\n"
                "  * Use 'अभिक्रिया' for Chemical Reaction (NOT 'प्रतिक्रिया')\n"
                "  * Use 'विद्युत धारा' for Electric Current (NEVER 'वर्तमान')\n"
                "  * Use 'विलयन' for Solution (NOT 'समाधान')\n"
                "  * Use 'लेंस की क्षमता' for Power of Lens (NOT 'शक्ति')\n"
                "  * Use 'मूल / शून्यक' for Roots/Zeroes of equations (NEVER 'जड़')\n"
                "  * Use 'समकोण त्रिभुज' for Right-angled triangle (NOT 'सही कोण')\n"
                "  * Use 'प्रतिरोध' for Resistance, 'विभवांतर' for Potential Difference\n"
                "- For technical, biological, or modern terms, provide the English term in parentheses: e.g. 'अपवर्तन (Refraction)', 'माइटोकॉन्ड्रिया (Mitochondria)', 'ओम का नियम (Ohm\'s Law)'.\n"
                "- Keep question phrasing standard and respectful: 'निम्नलिखित में से कौन सा कथन सही है?' or '...का मान ज्ञात कीजिए।'\n"
                "- STRICT UNICODE & FONT CLEANLINESS: Never output raw Unicode escape codes (like \\u{00E2} or \\uXXXX) or font artifacts. If reference notes contain corrupted OCR/PDF characters (e.g. 'भच\\u{00E2}ड'), fix them into standard Hindi (e.g. 'भचक्र (Zodiac Belt)'). Always use standard Hindi spelling (e.g. 'घूमने' NOT 'घुमने')."
            )
        else:
            lang_directive = "LANGUAGE DIRECTIVE: Output all questions, options, and explanations in clear English."

        # In pure AI mode, bypass notes context entirely
        if mode_key != "ai" and context and context.strip():
            context_block = (
                "===================================================================\n"
                "REFERENCE STUDY MATERIAL / NOTES (GROUNDING SOURCE):\n"
                '"""\n'
                f"{context.strip()[:16000]}\n"
                '"""\n'
                "===================================================================\n"
                "STRICT GROUNDING DIRECTIVE:\n"
                f"- You must generate all {count} questions aligned with the REFERENCE STUDY MATERIAL above.\n"
            )
        else:
            context_block = ""

        if total_chunks > 1:
            prompt = (
                f"{QUIZ_GENERATION_PROMPT.format(count=count, subject=subject, topic=topic, difficulty=diff_key, difficulty_directive=diff_directive, language_directive=lang_directive, mode_directive=mode_directive, context_block=context_block)}\n"
                f"BATCH CONTEXT: This is Batch {chunk_index} of {total_chunks}. "
                f"Generate unique, distinct questions covering different sub-concepts for {diff_key} difficulty. Avoid repeating standard intro questions."
            )
        else:
            prompt = QUIZ_GENERATION_PROMPT.format(
                count=count,
                subject=subject,
                topic=topic,
                difficulty=diff_key,
                difficulty_directive=diff_directive,
                language_directive=lang_directive,
                mode_directive=mode_directive,
                context_block=context_block,
            )

        session_seed = uuid.uuid4().hex[:8]
        prompt += (
            f"\n\nDYNAMIC VARIATION DIRECTIVE [Session Seed: {session_seed}]:\n"
            f"- Generate a brand new, unique set of questions testing diverse subtopics and angles for '{topic}'.\n"
            f"- Avoid repeating standard introductory questions; craft fresh scenarios, applied problems, and calculations."
        )

        if avoid_questions:
            clean_avoid = "\n".join(f"- {q}" for q in avoid_questions[:10])
            prompt += (
                f"\n\nCRITICAL ANTI-REPETITION CONSTRAINT:\n"
                f"The following questions/concepts were ALREADY asked in recent tests for other students:\n"
                f"{clean_avoid}\n"
                f"You MUST NOT generate questions testing these exact items. Test completely DIFFERENT paragraphs, facts, calculations, or subtopics."
            )

        # Tier 0: FreeLLMAPI Unified Gateway (14-Key Pool)
        if settings.FREELLMAPI_URL and settings.FREELLMAPI_KEY:
            try:
                target_model = "gemini-flash" if is_hindi else "qwen3.8-27b"
                data = self._call_freellmapi(
                    prompt,
                    model=target_model,
                    system_message="You are an assessment engine that strictly outputs a JSON object containing a questions array.",
                    temperature=0.7,
                )
                generated = _parse_generated(data)
                if len(generated) > 0:
                    logger.info("Chunk %d/%d generated via FreeLLMAPI (%s).", chunk_index, total_chunks, target_model)
                    return generated[:count]
            except Exception as e_free:
                logger.warning("FreeLLMAPI chunk %d/%d failed (%s). Continuing direct fallback...", chunk_index, total_chunks, e_free)

        # Smart Language-Based Routing:
        # Hindi -> Gemini 1st (Flawless NCERT Hindi), Groq 2nd fallback
        # English -> Groq 1st (0.9s ultra-speed), Gemini 2nd fallback
        tier_order = ["gemini", "groq"] if is_hindi else ["groq", "gemini"]

        for provider in tier_order:
            if provider == "groq" and self.groq_pool.total_keys() > 0:
                try:
                    data = self._call_groq(
                        prompt,
                        system_message="You are an assessment engine that strictly outputs a JSON object containing a questions array.",
                        temperature=0.7,
                    )
                    generated = _parse_generated(data)
                    if len(generated) > 0:
                        logger.info("Chunk %d/%d generated via Groq (%s).", chunk_index, total_chunks, "Fallback" if is_hindi else "Primary")
                        return generated[:count]
                except Exception as e_groq:
                    logger.warning("Groq chunk %d/%d failed (%s). Continuing fallback...", chunk_index, total_chunks, e_groq)

            elif provider == "gemini" and len(self.gemini_keys) > 0:
                try:
                    data = self._call_gemini(prompt, temperature=0.7)
                    generated = _parse_generated(data)
                    if len(generated) > 0:
                        logger.info("Chunk %d/%d generated via Gemini (%s).", chunk_index, total_chunks, "Primary" if is_hindi else "Fallback")
                        return generated[:count]
                except Exception as e_gem:
                    logger.warning("Gemini chunk %d/%d failed (%s). Continuing fallback...", chunk_index, total_chunks, e_gem)

        # Tier 3: Subject-Aware Mock Engine for this chunk (randomized for every student)
        raw_pool = list(MockAIEngine.get_pool(subject, topic, difficulty=diff_key))
        random.shuffle(raw_pool)
        chunk_questions: List[InternalQuestion] = []
        for i in range(count):
            item = raw_pool[i % len(raw_pool)]
            q_cand = InternalQuestion(
                id=f"q_temp_{chunk_index}_{i}_{uuid.uuid4().hex[:4]}",
                question=item["question"],
                options=item["options"],
                correct_option=item["correct_option"],
                explanation=item["explanation"],
                is_mock=True,
            )
            q_cand = shuffle_question_options(q_cand)
            chunk_questions.append(q_cand)
        return chunk_questions

    # -------------------------------------------------------------
    # Quiz Generation Cascade (Handles 5, 10, 20 to 50 Questions in Parallel & Notes Grounding)
    # -------------------------------------------------------------
    def generate_quiz(
        self,
        subject: str,
        topic: str,
        count: int,
        difficulty: str,
        language: str = "Auto",
        force_fresh: bool = False,
        context: Optional[str] = None,
        is_full_syllabus: bool = False,
        mode: str = "hybrid",
    ) -> InternalQuizSession:
        """
        High-Performance Hybrid Quiz Generator (Question Bank + Parallel AI Fallback + Notes Grounding).
        1. Supports 3 Generation Modes: 'notes' (strict notes), 'hybrid' (notes + AI), and 'ai' (pure AI).
        2. Supports Full Syllabus 50-Question Sharding across all course units.
        3. Supports Notes Grounding: Questions strictly anchored to uploaded notes text.
        4. Checks PostgreSQL Question Bank first for instant 0-cost retrieval (<50ms).
        5. If deficit exists, generates remaining questions via parallel micro-chunks.
        """
        try:
            from app.services.db_service import db_service
        except ImportError:
            db_service = None

        mode_clean = (mode or "hybrid").strip().lower()

        # ---------------------------------------------------------
        # Case A: Full Syllabus Sharded Mode (e.g. 50-Question Exam)
        # ---------------------------------------------------------
        is_full = is_full_syllabus or (topic or "").strip().lower() in ["all topics", "full syllabus", "all", "entire syllabus"]
        if is_full and db_service:
            all_topics = db_service.get_all_topics_for_subject(subject)
            if len(all_topics) >= 2:
                logger.info("Generating Full Syllabus test across %d topics for '%s' (mode: %s).", len(all_topics), subject, mode_clean)
                num_topics = len(all_topics)
                base_per_topic = count // num_topics
                extra = count % num_topics

                topic_allocations = []
                for idx, t_info in enumerate(all_topics):
                    alloc = base_per_topic + (1 if idx < extra else 0)
                    if alloc > 0:
                        topic_allocations.append((t_info["name"], alloc))

                all_generated_questions: List[InternalQuestion] = []
                with concurrent.futures.ThreadPoolExecutor(max_workers=min(3, len(topic_allocations))) as executor:
                    futures = []
                    for t_name, t_count in topic_allocations:
                        t_context = db_service.get_notes_for_topic(subject, t_name) if mode_clean != "ai" else None
                        f = executor.submit(
                            self._generate_chunk,
                            subject=subject,
                            topic=t_name,
                            count=t_count,
                            difficulty=difficulty,
                            chunk_index=1,
                            total_chunks=1,
                            language=language,
                            context=t_context or (context if mode_clean != "ai" else None),
                            mode=mode_clean,
                        )
                        futures.append(f)

                    for f in futures:
                        try:
                            res = f.result(timeout=45.0)
                            all_generated_questions.extend(res)
                        except Exception as e_sharded:
                            logger.error("Full syllabus sharded worker error: %s", e_sharded)

                import random
                deduped: List[InternalQuestion] = []
                for q in all_generated_questions:
                    if not is_duplicate_question(q, deduped):
                        deduped.append(q)
                random.shuffle(deduped)

                questions_dict: Dict[str, InternalQuestion] = {}
                for idx, q in enumerate(deduped[:count], start=1):
                    qid = f"q_{idx}"
                    sq = shuffle_question_options(q)
                    questions_dict[qid] = InternalQuestion(
                        id=qid,
                        question=sq.question.strip(),
                        options=sq.options,
                        correct_option=sq.correct_option,
                        explanation=sq.explanation.strip(),
                    )

                if len(questions_dict) >= count:
                    return InternalQuizSession(
                        quiz_session_id=f"quiz_{uuid.uuid4().hex[:10]}",
                        subject=subject,
                        topic="Full Syllabus",
                        difficulty=difficulty,
                        questions=questions_dict,
                    )

        # ---------------------------------------------------------
        # Case B: Single Topic / Standard Quiz Mode
        # ---------------------------------------------------------
        notes_context = context if mode_clean != "ai" else None
        if not notes_context and mode_clean != "ai" and db_service:
            try:
                notes_context = db_service.get_notes_for_topic(subject, topic)
                if notes_context:
                    logger.info("Retrieved %d characters of notes context for '%s' -> '%s'.", len(notes_context), subject, topic)
            except Exception as e_notes:
                logger.warning("Could not fetch notes from DB: %s", e_notes)

        all_questions: List[InternalQuestion] = []

        # Tier 0: Check existing Question Bank in PostgreSQL ($0 cost, 0ms latency)
        if not force_fresh and db_service:
            try:
                # Fetch up to 3x count from bank so we can randomly sample unique questions
                bank_qs = db_service.get_bank_questions(
                    subject_name=subject,
                    topic_name=topic,
                    difficulty=difficulty,
                    limit=count * 3
                )
                if bank_qs:
                    sample_size = min(count, len(bank_qs))
                    sampled = random.sample(bank_qs, sample_size)
                    logger.info("Randomly sampled %d questions from %d bank candidates.", sample_size, len(bank_qs))
                    all_questions.extend(sampled)
            except Exception as e_bank:
                logger.warning("Question Bank lookup error: %s", e_bank)

        # Fetch recent questions from DB to enforce anti-repetition across different user sessions
        recent_questions: List[str] = []
        if db_service:
            try:
                recent_questions = db_service.get_recent_question_texts(subject, topic, limit=12)
            except Exception as e_rec:
                logger.warning("Could not fetch recent questions: %s", e_rec)

        needed = count - len(all_questions)

        # Tier 1: Generate remaining deficit in parallel batches of 5 with notes grounding
        if needed > 0:
            if needed <= 5:
                generated = self._generate_chunk(
                    subject,
                    topic,
                    needed,
                    difficulty,
                    1,
                    1,
                    language=language,
                    context=notes_context,
                    mode=mode_clean,
                    avoid_questions=recent_questions,
                )
            else:
                chunk_size = 5
                chunks = []
                rem = needed
                while rem > 0:
                    c = min(chunk_size, rem)
                    chunks.append(c)
                    rem -= c

                total_chunks = len(chunks)
                logger.info("Generating %d questions via %d parallel batches (mode: %s).", needed, total_chunks, mode_clean)

                generated: List[InternalQuestion] = []
                futures = []
                with concurrent.futures.ThreadPoolExecutor(max_workers=min(3, total_chunks)) as executor:
                    for idx, c_count in enumerate(chunks, start=1):
                        f = executor.submit(
                            self._generate_chunk,
                            subject=subject,
                            topic=topic,
                            count=c_count,
                            difficulty=difficulty,
                            chunk_index=idx,
                            total_chunks=total_chunks,
                            language=language,
                            context=notes_context,
                            mode=mode_clean,
                            avoid_questions=recent_questions,
                        )
                        futures.append(f)

                    for f in futures:
                        try:
                            res = f.result(timeout=40.0)
                            generated.extend(res)
                        except Exception as e:
                            logger.error("Parallel batch execution error: %s", e)

            # Deduplicate by multi-factor similarity and answer collision against existing questions
            for q in generated:
                if not is_duplicate_question(q, all_questions):
                    all_questions.append(q)

        # Double-shuffle all questions so students never receive identical question sequences
        import random
        random.shuffle(all_questions)

        # Assemble and cleanly re-index all generated questions with randomized option shuffling
        questions_dict: Dict[str, InternalQuestion] = {}
        for idx, q in enumerate(all_questions[:count], start=1):
            qid = f"q_{idx}"
            sq = shuffle_question_options(q)
            questions_dict[qid] = InternalQuestion(
                id=qid,
                question=sq.question.strip(),
                options=sq.options,
                correct_option=sq.correct_option,
                explanation=sq.explanation.strip(),
            )

        # If pool had fewer questions than count, fill remainder safely
        if len(questions_dict) < count:
            deficit = count - len(questions_dict)
            is_hindi_lang = (language or "").strip().lower() == "hindi" or bool(re.search(r'[\u0900-\u097F]', f"{subject} {topic}"))
            fill_lang_directive = (
                "CRITICAL HINDI LANGUAGE GUIDELINES (NCERT / CBSE STANDARD):\n"
                "- Generate ALL questions, options, and explanations strictly in fluent NCERT standard Hindi with parenthetical English terms."
            ) if is_hindi_lang else "LANGUAGE DIRECTIVE: Output all questions, options, and explanations in clear English."

            fill_tier = ["gemini", "groq"] if is_hindi_lang else ["groq", "gemini"]
            fill_prompt = QUIZ_GENERATION_PROMPT.format(
                count=deficit,
                subject=subject,
                topic=topic,
                difficulty=difficulty,
                difficulty_directive=DIFFICULTY_DIRECTIVES.get(difficulty, DIFFICULTY_DIRECTIVES["Medium"]),
                language_directive=fill_lang_directive,
                mode_directive=MODE_DIRECTIVES.get(mode_clean, MODE_DIRECTIVES["hybrid"]),
                context_block=f"REFERENCE NOTES:\n{notes_context[:8000]}" if notes_context else "",
            )

            # Tier 0: FreeLLMAPI Unified Gateway
            if settings.FREELLMAPI_URL and settings.FREELLMAPI_KEY and len(questions_dict) < count:
                try:
                    target_model = "gemini-flash" if is_hindi_lang else "qwen3.8-27b"
                    data = self._call_freellmapi(fill_prompt, model=target_model)
                    if data:
                        extra_qs = _parse_generated(data)
                        for eq in extra_qs:
                            if len(questions_dict) >= count:
                                break
                            if not is_duplicate_question(eq, list(questions_dict.values())):
                                qid = f"q_{len(questions_dict) + 1}"
                                sq = shuffle_question_options(eq)
                                questions_dict[qid] = InternalQuestion(
                                    id=qid,
                                    question=sq.question.strip(),
                                    options=sq.options,
                                    correct_option=sq.correct_option,
                                    explanation=sq.explanation.strip(),
                                    is_mock=False,
                                )
                except Exception as e_fill_free:
                    logger.warning("FreeLLMAPI deficit fill failed (%s). Continuing direct fallback...", e_fill_free)

            for fill_prov in fill_tier:
                if len(questions_dict) >= count:
                    break
                try:
                    data = None
                    if fill_prov == "gemini" and len(self.gemini_keys) > 0:
                        data = self._call_gemini(fill_prompt)
                    elif fill_prov == "groq" and self.groq_pool.total_keys() > 0:
                        data = self._call_groq(fill_prompt)

                    if data:
                        extra_qs = _parse_generated(data)
                        for eq in extra_qs:
                            if len(questions_dict) >= count:
                                break
                            if not is_duplicate_question(eq, list(questions_dict.values())):
                                qid = f"q_{len(questions_dict) + 1}"
                                sq = shuffle_question_options(eq)
                                questions_dict[qid] = InternalQuestion(
                                    id=qid,
                                    question=sq.question.strip(),
                                    options=sq.options,
                                    correct_option=sq.correct_option,
                                    explanation=sq.explanation.strip(),
                                    is_mock=False,
                                )
                except Exception as e_fill:
                    logger.warning("Failed to AI-fill question deficit via %s: %s", fill_prov, e_fill)

            # If still short, fallback safely with is_mock=True, strictly enforcing zero duplicates
            if len(questions_dict) < count:
                pool = MockAIEngine.get_pool(subject, topic, difficulty=difficulty)
                for item in pool:
                    if len(questions_dict) >= count:
                        break
                    candidate = InternalQuestion(
                        id=f"q_{len(questions_dict) + 1}",
                        question=item["question"],
                        options=item["options"],
                        correct_option=item["correct_option"],
                        explanation=item["explanation"],
                        is_mock=True,
                    )
                    candidate = shuffle_question_options(candidate)
                    if not is_duplicate_question(candidate, list(questions_dict.values())):
                        questions_dict[candidate.id] = candidate

        logger.info(
            "Successfully delivered %d questions for '%s' -> '%s'.",
            len(questions_dict),
            subject,
            topic,
        )

        return InternalQuizSession(
            quiz_session_id=f"quiz_{uuid.uuid4().hex[:10]}",
            subject=subject,
            topic=topic,
            difficulty=difficulty,
            questions=questions_dict,
        )

    # -------------------------------------------------------------
    # AI Tutor Explanation Cascade
    # -------------------------------------------------------------
    def explain_mistake(
        self,
        question: str,
        selected_option: Optional[str],
        correct_option: str,
        explanation: str,
    ) -> Dict[str, str]:
        is_hindi = bool(re.search(r'[\u0900-\u097F]', f"{question} {explanation}"))
        if is_hindi:
            lang_directive = (
                "CRITICAL LANGUAGE DIRECTIVE: The student's question and explanation are in HINDI (हिंदी).\n"
                "You MUST write 'simplified_explanation', 'memory_tip', and 'real_world_example' strictly in warm, friendly, natural HINDI (हिंदी / Devanagari script)."
            )
        else:
            lang_directive = "LANGUAGE DIRECTIVE: Explain in plain, friendly English."

        prompt = TUTOR_EXPLAIN_PROMPT.format(
            question=question,
            selected_option=selected_option or "None",
            correct_option=correct_option,
            explanation=explanation,
            language_directive=lang_directive,
        )

        required_keys = ["simplified_explanation", "memory_tip", "real_world_example"]

        # Tier 0: FreeLLMAPI Unified Gateway
        if settings.FREELLMAPI_URL and settings.FREELLMAPI_KEY:
            try:
                target_model = "gemini-flash" if is_hindi else "qwen3.8-27b"
                data = self._call_freellmapi(prompt, model=target_model)
                if all(k in data and isinstance(data[k], str) and data[k].strip() for k in required_keys):
                    logger.info("AI Tutor explanation generated via FreeLLMAPI (%s).", target_model)
                    return {k: data[k].strip() for k in required_keys}
            except Exception as e_free:
                logger.warning("FreeLLMAPI tutor explanation failed (%s). Continuing direct fallback...", e_free)

        # Smart Language Routing for AI Tutor:
        # Hindi -> Gemini 1st (Empathetic, authentic Hindi tutoring), Groq 2nd fallback
        # English -> Groq 1st, Gemini 2nd fallback
        tier_order = ["gemini", "groq"] if is_hindi else ["groq", "gemini"]

        for provider in tier_order:
            if provider == "groq" and self.groq_pool.total_keys() > 0:
                try:
                    data = self._call_groq(prompt)
                    if all(k in data and isinstance(data[k], str) and data[k].strip() for k in required_keys):
                        logger.info("AI Tutor explanation generated via Groq (%s).", "Fallback" if is_hindi else "Primary")
                        return {k: data[k].strip() for k in required_keys}
                except Exception as e_groq:
                    logger.warning("Groq tutor explanation failed (%s). Continuing fallback...", e_groq)

            elif provider == "gemini" and len(self.gemini_keys) > 0:
                try:
                    data = self._call_gemini(prompt)
                    if all(k in data and isinstance(data[k], str) and data[k].strip() for k in required_keys):
                        logger.info("AI Tutor explanation generated via Gemini (%s).", "Primary" if is_hindi else "Fallback")
                        return {k: data[k].strip() for k in required_keys}
                except Exception as e_gem:
                    logger.warning("Gemini tutor explanation failed (%s). Continuing fallback...", e_gem)

        # Tier 3: Mock Fallback
        return MockAIEngine.explain_mistake(question, selected_option, correct_option, explanation)


llm_service = LLMService()
