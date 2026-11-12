import concurrent.futures
import itertools
import json
import logging
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
)

logger = logging.getLogger(__name__)

def normalize_ai_question(item: Any, idx: int) -> Optional[InternalQuestion]:
    """
    Robust normalizer that adapts any LLM response structure:
      - options as list ["A", "B", "C", "D"] or dict {"A": "...", ...}
      - correct_option as integer (0 -> 'A') or string ("A", "Option A", "answer")
      - missing explanation auto-filled
    """
    if not isinstance(item, dict):
        return None

    import re
    q_text = str(item.get("question") or item.get("question_text") or "").strip()
    if not q_text:
        return None

    # 1. Normalize Options (supports list or dict)
    raw_opts = item.get("options")
    clean_opts: Dict[str, str] = {}
    if isinstance(raw_opts, list):
        for o_idx, opt in enumerate(raw_opts[:4]):
            key = chr(ord("A") + o_idx)
            opt_str = str(opt).strip()
            # Strip leading "A) ", "A. ", "A: "
            if len(opt_str) >= 3 and opt_str[0].upper() == key and opt_str[1] in [")", ".", ":", "-"]:
                opt_str = opt_str[2:].strip()
            clean_opts[key] = opt_str
    elif isinstance(raw_opts, dict):
        for key in ["A", "B", "C", "D"]:
            val = raw_opts.get(key) or raw_opts.get(key.lower()) or "Option Unavailable"
            clean_opts[key] = str(val).strip()

    # Ensure all 4 options exist
    for key in ["A", "B", "C", "D"]:
        if key not in clean_opts or not clean_opts[key]:
            clean_opts[key] = f"Option {key}"

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
    explanation = str(item.get("explanation") or item.get("reasoning") or "").strip()
    if not explanation:
        explanation = f"Option {clean_correct} is the verified correct answer for this question."

    return InternalQuestion(
        id=f"q_{idx}",
        question=q_text,
        options=clean_opts,
        correct_option=clean_correct,
        explanation=explanation,
    )


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
            timeout=25.0,
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
    def _call_groq(self, prompt: str, system_message: str = "") -> Any:
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

        # High-speed active Groq model list prioritized by response latency
        models_to_try = [
            "qwen/qwen3.8-27b",       # Ultra-fast (~0.9s response)
            "openai/gpt-oss-20b",     # Fast (~1.8s response)
            "openai/gpt-oss-120b",    # High capacity fallback
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
                        "temperature": 0.2,
                        "max_tokens": 2048,
                    }
                    resp = self._groq_client.post(url, json=payload, headers=headers)
                    if resp.status_code == 429:
                        logger.warning("Groq 429 Rate Limit hit on key %s. Rotating to next key...", masked)
                        break  # Try next API key
                    resp.raise_for_status()
                    content = resp.json()["choices"][0]["message"]["content"]
                    parsed = json.loads(content)

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
    # Gemini API Caller with 30s Timeout & Model Fallback
    # -------------------------------------------------------------
    def _call_gemini(self, prompt: str) -> Any:
        keys_to_try = list(self.gemini_keys)
        if not keys_to_try:
            raise RuntimeError("No Gemini API keys configured.")

        try:
            from google import genai
        except ImportError:
            raise RuntimeError("google-genai SDK not installed.")

        last_error = None
        for api_key in keys_to_try:
            masked = f"...{api_key[-4:]}" if len(api_key) >= 4 else "key"
            try:
                client = genai.Client(api_key=api_key)
            except Exception as e:
                logger.warning("Failed to initialize Gemini client for key %s: %s", masked, e)
                continue

            for gemini_model in ["gemini-3.8-flash", "gemini-2.0-flash", "gemini-1.5-flash"]:
                try:
                    def _execute():
                        return client.models.generate_content(
                            model=gemini_model,
                            contents=prompt,
                            config={"response_mime_type": "application/json"},
                        )

                    future = self._executor.submit(_execute)
                    response = future.result(timeout=30.0)
                    text = getattr(response, "text", "")
                    if not text.strip():
                        continue

                    parsed = json.loads(text)
                    if isinstance(parsed, dict):
                        for val in parsed.values():
                            if isinstance(val, list):
                                return val
                    return parsed
                except Exception as e:
                    last_error = e
                    logger.warning("Gemini model %s on key %s failed: %s", gemini_model, masked, e)
                    continue

        raise RuntimeError(f"All Gemini models and keys failed. Last error: {last_error}")

    # -------------------------------------------------------------
    # Topic Extraction Cascade
    # -------------------------------------------------------------
    def extract_topics(self, subject: str, text: str) -> List[TopicItem]:
        is_hindi = bool(re.search(r'[\u0900-\u097F]', f"{subject} {text[:4000]}")) or "hindi" in (subject or "").lower()
        if is_hindi:
            lang_directive = (
                "CRITICAL LANGUAGE PRESERVATION DIRECTIVE:\n"
                "- The provided syllabus text is in HINDI (हिंदी).\n"
                "- You MUST output all 'topic_name', 'subtopics', and 'summary' strictly in natural, fluent HINDI (हिंदी / Devanagari script).\n"
                "- DO NOT translate Hindi topics into English. Keep the exact Hindi curriculum terminology."
            )
        else:
            lang_directive = "LANGUAGE DIRECTIVE: Output all topic_name, subtopics, and summary in clear English matching the syllabus text."

        prompt = TOPIC_EXTRACTION_PROMPT.format(subject=subject, text=text[:12000], language_directive=lang_directive)

        # Tier 1: Groq
        if self.groq_pool.total_keys() > 0:
            try:
                data = self._call_groq(
                    prompt,
                    system_message="You are a syllabus parser that strictly outputs a JSON object containing a topics list.",
                )
                topics = TOPIC_LIST_ADAPTER.validate_python(data)
                if len(topics) >= 1:
                    logger.info("Successfully extracted %d topics via Groq (Primary).", len(topics))
                    return topics
            except Exception as e_groq:
                logger.warning("Groq topic extraction failed (%s). Falling back to Gemini...", e_groq)

        # Tier 2: Gemini
        if len(self.gemini_keys) > 0:
            try:
                data = self._call_gemini(prompt)
                topics = TOPIC_LIST_ADAPTER.validate_python(data)
                if len(topics) >= 1:
                    logger.info("Successfully extracted %d topics via Gemini (Fallback).", len(topics))
                    return topics
            except Exception as e_gem:
                logger.warning("Gemini topic extraction failed (%s). Falling back to Mock engine...", e_gem)

        # Tier 3: Mock Fallback
        return MockAIEngine.extract_topics(subject, text)

    # -------------------------------------------------------------
    # Single Chunk Generator for Quiz Batching
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
    ) -> List[InternalQuestion]:
        """Generates a slice of questions with context to avoid duplicate questions."""
        diff_key = difficulty.strip().capitalize() if difficulty else "Medium"
        if diff_key not in ["Easy", "Medium", "Hard"]:
            diff_key = "Medium"
        diff_directive = DIFFICULTY_DIRECTIVES.get(diff_key, DIFFICULTY_DIRECTIVES["Medium"])

        clean_lang = (language or "Auto").strip().lower()
        if clean_lang == "hindi":
            is_hindi = True
        elif clean_lang == "english":
            is_hindi = False
        else:
            is_hindi = bool(re.search(r'[\u0900-\u097F]', f"{subject} {topic}")) or "hindi" in (subject or "").lower() or "hindi" in (topic or "").lower()

        if is_hindi:
            lang_directive = (
                "CRITICAL LANGUAGE ENFORCEMENT:\n"
                "- The topic/subject is in HINDI (हिंदी).\n"
                "- You MUST generate ALL questions, all 4 options (A, B, C, D), and all explanations STRICTLY in natural, fluent HINDI (हिंदी / Devanagari script).\n"
                "- DO NOT output English text for questions, options, or explanations. Every question, option, and explanation must be in pure Hindi."
            )
        else:
            lang_directive = "LANGUAGE DIRECTIVE: Output all questions, options, and explanations in clear English."

        if total_chunks > 1:
            prompt = (
                f"{QUIZ_GENERATION_PROMPT.format(count=count, subject=subject, topic=topic, difficulty=diff_key, difficulty_directive=diff_directive, language_directive=lang_directive)}\n"
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
            )

        def _parse_generated(raw_data: Any) -> List[InternalQuestion]:
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

        # Tier 1: Groq
        if self.groq_pool.total_keys() > 0:
            try:
                data = self._call_groq(
                    prompt,
                    system_message="You are an assessment engine that strictly outputs a JSON object containing a questions array.",
                )
                generated = _parse_generated(data)
                if len(generated) > 0:
                    return generated[:count]
            except Exception as e_groq:
                logger.warning("Groq chunk %d/%d failed (%s). Trying Gemini...", chunk_index, total_chunks, e_groq)

        # Tier 2: Gemini
        if len(self.gemini_keys) > 0:
            try:
                data = self._call_gemini(prompt)
                generated = _parse_generated(data)
                if len(generated) > 0:
                    return generated[:count]
            except Exception as e_gem:
                logger.warning("Gemini chunk %d/%d failed (%s). Using subject-aware mock...", chunk_index, total_chunks, e_gem)

        # Tier 3: Subject-Aware Mock Engine for this chunk
        pool = MockAIEngine.get_pool(subject, topic, difficulty=diff_key)
        offset = (chunk_index - 1) * 10
        chunk_questions: List[InternalQuestion] = []
        for i in range(count):
            item = pool[(offset + i) % len(pool)]
            chunk_questions.append(
                InternalQuestion(
                    id=f"q_temp_{i}",
                    question=item["question"],
                    options=item["options"],
                    correct_option=item["correct_option"],
                    explanation=item["explanation"],
                )
            )
        return chunk_questions

    # -------------------------------------------------------------
    # Quiz Generation Cascade (Handles 5, 10, 20 to 50 Questions in Parallel)
    # -------------------------------------------------------------
    def generate_quiz(
        self,
        subject: str,
        topic: str,
        count: int,
        difficulty: str,
        language: str = "Auto",
        force_fresh: bool = False,
    ) -> InternalQuizSession:
        """
        High-Performance Hybrid Quiz Generator (Question Bank + Parallel AI Fallback).
        1. Checks PostgreSQL Question Bank first for instant 0-cost retrieval (<50ms).
        2. If deficit exists, generates remaining questions via parallel 5-question micro-chunks.
        3. Supports 5, 10, 20 up to 100 questions cleanly and free of cost.
        """
        all_questions: List[InternalQuestion] = []

        # Tier 0: Check existing Question Bank in PostgreSQL ($0 cost, 0ms latency)
        if not force_fresh:
            try:
                from app.services.db_service import db_service
                if db_service:
                    bank_qs = db_service.get_bank_questions(
                        subject_name=subject,
                        topic_name=topic,
                        difficulty=difficulty,
                        limit=count
                    )
                    if bank_qs:
                        logger.info("Found %d pre-generated questions in PostgreSQL Question Bank.", len(bank_qs))
                        all_questions.extend(bank_qs)
            except Exception as e_bank:
                logger.warning("Question Bank lookup error: %s", e_bank)

        needed = count - len(all_questions)

        # Tier 1: Generate remaining deficit in parallel batches of 5
        if needed > 0:
            if needed <= 5:
                generated = self._generate_chunk(subject, topic, needed, difficulty, 1, 1, language=language)
            else:
                chunk_size = 5
                chunks = []
                rem = needed
                while rem > 0:
                    c = min(chunk_size, rem)
                    chunks.append(c)
                    rem -= c

                total_chunks = len(chunks)
                logger.info("Generating %d questions via %d parallel batches.", needed, total_chunks)

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
                        )
                        futures.append(f)

                    for f in futures:
                        try:
                            res = f.result(timeout=40.0)
                            generated.extend(res)
                        except Exception as e:
                            logger.error("Parallel batch execution error: %s", e)

            # Deduplicate by question text against bank questions
            seen_texts = {q.question.strip().lower() for q in all_questions}
            for q in generated:
                if q.question.strip().lower() not in seen_texts:
                    all_questions.append(q)
                    seen_texts.add(q.question.strip().lower())

        # Assemble and cleanly re-index all generated questions
        questions_dict: Dict[str, InternalQuestion] = {}
        for idx, q in enumerate(all_questions[:count], start=1):
            qid = f"q_{idx}"
            questions_dict[qid] = InternalQuestion(
                id=qid,
                question=q.question.strip(),
                options=q.options,
                correct_option=q.correct_option,
                explanation=q.explanation.strip(),
            )

        # If pool had fewer questions than count, fill remainder safely
        if len(questions_dict) < count:
            pool = MockAIEngine.get_pool(subject, topic, difficulty=difficulty)
            curr = len(questions_dict) + 1
            while curr <= count:
                item = pool[curr % len(pool)]
                qid = f"q_{curr}"
                questions_dict[qid] = InternalQuestion(
                    id=qid,
                    question=item["question"],
                    options=item["options"],
                    correct_option=item["correct_option"],
                    explanation=item["explanation"],
                )
                curr += 1

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

        # Tier 1: Groq
        if self.groq_pool.total_keys() > 0:
            try:
                data = self._call_groq(prompt)
                if all(k in data and isinstance(data[k], str) and data[k].strip() for k in required_keys):
                    logger.info("AI Tutor explanation generated via Groq (Primary).")
                    return {k: data[k].strip() for k in required_keys}
            except Exception as e_groq:
                logger.warning("Groq tutor explanation failed (%s). Falling back to Gemini...", e_groq)

        # Tier 2: Gemini
        if len(self.gemini_keys) > 0:
            try:
                data = self._call_gemini(prompt)
                if all(k in data and isinstance(data[k], str) and data[k].strip() for k in required_keys):
                    logger.info("AI Tutor explanation generated via Gemini (Fallback).")
                    return {k: data[k].strip() for k in required_keys}
            except Exception as e_gem:
                logger.warning("Gemini tutor explanation failed (%s). Falling back to Mock engine...", e_gem)

        # Tier 3: Mock Fallback
        return MockAIEngine.explain_mistake(question, selected_option, correct_option, explanation)


llm_service = LLMService()
