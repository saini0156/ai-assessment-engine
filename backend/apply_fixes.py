#!/usr/bin/env python3
"""
apply_fixes.py - Hindi quiz fixes ko aapke llm_service.py aur templates.py me auto-apply karta hai.

Kaise chalayein (backend folder ke andar):
    python apply_fixes.py

- Pehle backup banata hai (*.bak_before_fix)
- Har change ke baad syntax check karta hai; kuch bhi toota to purani file wapas laga deta hai
- Dobara chalane par safe hai (jo ho chuka wo skip ho jata hai)
"""
import py_compile
import re
import shutil
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
LLM = HERE / "app" / "services" / "llm_service.py"
TPL = HERE / "app" / "prompts" / "templates.py"

NEW_BLOCK = '\n# ===================== HINDI FIXES (auto-added by apply_fixes.py) =====================\nLETTERS = ["A", "B", "C", "D"]\nDEVANAGARI_RE = re.compile(r"[\\u0900-\\u097F]")\n\n# Hindi + English stop words (tokenizer ke liye)\n_STOP_WORDS = {\n    "what", "is", "the", "of", "in", "to", "a", "an", "and", "or", "for", "which",\n    "के", "की", "का", "को", "में", "से", "होता", "होती", "है", "हैं", "किन्हें",\n    "कहा", "जाता", "अनुसार", "होते", "कुल", "संख्या", "किन", "भावों", "समान", "किसे", "कौन",\n    "निम्नलिखित", "कथन", "सही", "क्या", "कौनसा", "कौन-सा", "एक", "तथा", "और", "पर", "यह", "वह",\n}\n\n\ndef _tokens(text: str) -> set:\n    """\n    Devanagari-safe tokenizer.\n    BUG FIX: python ka \\\\w Hindi ki matras (ि, ी, ु, ्, ं ...) ko word-character nahi maanta,\n    isliye purana code Hindi shabdon ko tukdon me tod deta tha (\'विद्युत\' -> \'व द य त\').\n    Yahan Devanagari range explicitly allow ki gayi hai.\n    """\n    words = re.findall(r"[\\u0900-\\u097F\\w]+", (text or "").lower())\n    return {w for w in words if w not in _STOP_WORDS and len(w) > 1}\n\n\ndef _answer_key(text: str) -> str:\n    """Answer compare karne ke liye: sirf punctuation/space hataata hai, matras nahi."""\n    return re.sub(r"[^\\u0900-\\u097F\\w]", "", (text or "").strip().lower())\n\n\ndef is_duplicate_question(new_q, existing_questions) -> bool:\n    if not new_q or not new_q.question:\n        return True\n\n    new_tokens = _tokens(new_q.question)\n    new_ans = _answer_key(str(new_q.options.get(new_q.correct_option, "")))\n\n    for ex in existing_questions:\n        if not ex or not ex.question:\n            continue\n        if new_q.question.strip().lower() == ex.question.strip().lower():\n            return True\n\n        ex_tokens = _tokens(ex.question)\n        ex_ans = _answer_key(str(ex.options.get(ex.correct_option, "")))\n\n        # Same answer + kaafi overlap => same concept\n        if new_ans and ex_ans and len(new_ans) >= 2 and new_ans == ex_ans:\n            if new_tokens and ex_tokens:\n                overlap = len(new_tokens & ex_tokens) / max(1, min(len(new_tokens), len(ex_tokens)))\n                if overlap >= 0.5:\n                    return True\n\n        # Bahut zyada word overlap (Jaccard)\n        if new_tokens and ex_tokens:\n            union = new_tokens | ex_tokens\n            if union and (len(new_tokens & ex_tokens) / len(union)) >= 0.6:\n                return True\n    return False\n\n\ndef parse_correct_letter(raw: Any) -> Optional[str]:\n    """\n    BUG FIX: purana code re.search(\'[A-Da-d]\') use karta tha, isliye\n    \'Answer: B\' -> \'A\' aur \'Correct: D\' -> \'C\' ban jata tha (galat answer key!).\n    Ab sirf clean format accept hota hai, warna None (question reject).\n    """\n    if isinstance(raw, bool):\n        return None\n    if isinstance(raw, int):\n        return LETTERS[raw] if 0 <= raw <= 3 else None\n    s = str(raw or "").strip()\n    m = re.match(\n        r"^(?:option|answer|ans|correct(?:\\s+(?:answer|option))?)?\\s*[:\\-]?\\s*\\(?\\s*([A-Da-d])\\s*[\\)\\.\\:]?\\s*(?:$|[\\s\\-])",\n        s, re.IGNORECASE,\n    )\n    return m.group(1).upper() if m else None\n\n\ndef remap_option_letters(text: str, mapping: Dict[str, str]) -> str:\n    """\n    Shuffle ke baad explanation me likhe letters (\'Option A\', \'विकल्प B\', \'(C)\') ek saath badalta hai.\n    BUG FIX: purana code ek-ek karke replace karta tha, isse baaki letters galat reh jate the.\n    """\n    if not text:\n        return text\n\n    def swap(m):\n        prefix, letter, suffix = m.group(1), m.group(2).upper(), m.group(3)\n        return f"{prefix}{mapping.get(letter, letter)}{suffix}"\n\n    return re.sub(r"(\\bOption\\s+|\\bविकल्प\\s+|\\()([A-D])(\\)?\\b)", swap, text)\n\n\ndef _shuffle_with_mapping(options: Dict[str, str], correct: str):\n    items = [(k, options[k]) for k in LETTERS if k in options]\n    random.shuffle(items)\n    new_opts, mapping, new_correct = {}, {}, "A"\n    for i, (old_key, text) in enumerate(items[:4]):\n        new_key = LETTERS[i]\n        new_opts[new_key] = text\n        mapping[old_key] = new_key\n        if old_key == correct:\n            new_correct = new_key\n    return new_opts, mapping, new_correct\n\n\ndef normalize_ai_question(item: Any, idx: int):\n    """\n    Strict normalizer: kharab question ko ROK deta hai (None return) instead of\n    \'Option Unavailable\' / \'(Alternative B)\' jaisa kachra students ko dikhane ke.\n    Generate-loop pehle se kam questions par retry/fill karta hai, isliye reject karna safe hai.\n    Isme aapka clean_math_text() use hota hai (wahi file me defined hai).\n    """\n    if not isinstance(item, dict):\n        return None\n\n    q_text = clean_math_text(str(item.get("question") or item.get("question_text") or "").strip())\n    if not q_text:\n        return None\n\n    # ---- options (list ya dict dono) ----\n    raw_opts = item.get("options")\n    opts: Dict[str, str] = {}\n    if isinstance(raw_opts, list):\n        for i, opt in enumerate(raw_opts[:4]):\n            key = LETTERS[i]\n            txt = str(opt).strip()\n            if len(txt) >= 3 and txt[0].upper() == key and txt[1] in ")" ".:-":\n                txt = txt[2:].strip()\n            opts[key] = clean_math_text(txt)\n    elif isinstance(raw_opts, dict):\n        for key in LETTERS:\n            val = raw_opts.get(key, raw_opts.get(key.lower()))\n            if val is not None:\n                opts[key] = clean_math_text(str(val).strip())\n\n    if len(opts) != 4 or any(not v for v in opts.values()):\n        return None                      # option missing/blank => reject\n    if len({v.strip().lower() for v in opts.values()}) != 4:\n        return None                      # duplicate options => reject\n\n    # ---- correct option ----\n    raw_corr = item.get("correct_option")\n    if raw_corr is None:\n        raw_corr = item.get("answer", item.get("correct_answer"))\n    correct = parse_correct_letter(raw_corr)\n    if correct is None and raw_corr is not None:\n        # model ne letter ki jagah answer ka text de diya ho\n        for k, v in opts.items():\n            if str(raw_corr).strip().lower() == v.strip().lower():\n                correct = k\n                break\n    if correct is None:\n        return None                      # answer key samajh nahi aaya => reject (galat key se behtar)\n\n    # ---- explanation ----\n    explanation = clean_math_text(str(item.get("explanation") or item.get("reasoning") or "").strip())\n    if not explanation:\n        ans = opts[correct]\n        explanation = f"सही उत्तर: {ans}" if DEVANAGARI_RE.search(q_text) else f"Correct answer: {ans}"\n\n    # Explanation clearly kisi aur option ko sahi bataye to align karo\n    m = re.search(\n        r"(?:correct answer is|correct option is|सही उत्तर|सही विकल्प)\\s*(?:है)?\\s*[:\\-]?\\s*(?:Option|विकल्प)?\\s*\\(?([A-D])\\)?\\b",\n        explanation, re.IGNORECASE,\n    )\n    if m and m.group(1).upper() in opts:\n        correct = m.group(1).upper()\n\n    # ---- shuffle + explanation letters sync ----\n    new_opts, mapping, new_correct = _shuffle_with_mapping(opts, correct)\n    explanation = remap_option_letters(explanation, mapping)\n\n    return InternalQuestion(\n        id=f"q_{idx}", question=q_text, options=new_opts,\n        correct_option=new_correct, explanation=explanation,\n    )\n\n\ndef shuffle_question_options(q):\n    if not q or not q.options or len(q.options) < 2:\n        return q\n    old_correct = (q.correct_option or "A").strip().upper()\n    new_opts, mapping, new_correct = _shuffle_with_mapping(q.options, old_correct)\n    return InternalQuestion(\n        id=q.id, question=q.question, options=new_opts, correct_option=new_correct,\n        explanation=remap_option_letters(q.explanation or "", mapping),\n        is_mock=getattr(q, "is_mock", False),\n    )\n\n# ======================================================================================\n'

report = []


def log(status, msg):
    report.append((status, msg))
    print(f"  [{status}] {msg}")
    
def read(path):
    raw = path.read_bytes().decode("utf-8")
    crlf = "\r\n" in raw
    return raw.replace("\r\n", "\n"), crlf


def write(path, text, crlf):
    if crlf:
        text = text.replace("\n", "\r\n")
    path.write_bytes(text.encode("utf-8"))


def remove_function(text, name):
    pat = re.compile(r"^def " + re.escape(name) + r"\(.*?(?=^(?![ \t)\n]))", re.M | re.S)
    new, n = pat.subn("", text, count=1)
    return new, n


def sub_once(text, pattern, repl, label, flags=0, count=1):
    new, n = re.subn(pattern, repl, text, count=count, flags=flags)
    log("OK" if n else "SKIP", f"{label}" + ("" if n else " (nahi mila ya pehle se ho chuka)"))
    return new


def patch_llm(text):
    # 1. Naye/fixed functions daalo, purane hatao
    if "def parse_correct_letter" in text:
        log("SKIP", "Naye functions pehle se maujood hain")
    else:
        removed = []
        for fn in ("is_duplicate_question", "normalize_ai_question", "shuffle_question_options"):
            text, n = remove_function(text, fn)
            if n:
                removed.append(fn)
        anchor = "TOPIC_LIST_ADAPTER = TypeAdapter(List[TopicItem])"
        if anchor in text:
            text = text.replace(anchor, anchor + "\n" + NEW_BLOCK, 1)
            log("OK", "Fixed functions add hue (replaced: " + (", ".join(removed) or "koi purana nahi mila") + ")")
        else:
            log("FAIL", "TOPIC_LIST_ADAPTER line nahi mili, functions add nahi hue")

    # 2. Hindi ke liye Gemini pehle
    text = sub_once(
        text, r'(?<!\w)tier_order = \["groq", "gemini"\]',
        'tier_order = ["gemini", "groq"] if is_hindi else ["groq", "gemini"]',
        "Provider order (Hindi -> Gemini pehle) [topics/quiz/tutor]", count=0)
    text = sub_once(
        text, r'fill_tier = \["groq", "gemini"\]',
        'fill_tier = ["gemini", "groq"] if is_hindi_lang else ["groq", "gemini"]',
        "Provider order deficit-fill me")

    # 3. Gemini model order (flash-lite sabse aakhir me)
    text = sub_once(
        text, r"gemini_models = \[.*?\]",
        'gemini_models = [\n            "gemini-3.8-flash",\n            "gemini-flash-lite-latest",\n            "gemini-flash-latest",\n            "gemini-3.5-flash",\n        ]',
        "Gemini model order", flags=re.S)

    # 4. Timeouts / token limits
    text = sub_once(text, r"timeout=12\.0", "timeout=30.0", "Gemini timeout 12s -> 30s", count=0)
    text = sub_once(text, r'"maxOutputTokens": 4096', '"maxOutputTokens": 8192', "Gemini maxOutputTokens 8192")
    text = sub_once(text, r'"max_tokens": 4096', '"max_tokens": 8192', "Groq max_tokens 8192")

    # 5. API key URL se hatao (Render logs me leak ho rahi thi)
    text = sub_once(text, r":generateContent\?key=\{api_key\}", ":generateContent",
                    "Gemini key URL se hata di (header me pehle se hai)")

    # 6. Groq 'reasoning' ko answer maanna band
    text = sub_once(
        text,
        r'[ \t]*# Fallback to reasoning field[^\n]*\n[ \t]*if not content\.strip\(\) and msg\.get\("reasoning"\):\n[ \t]*content = msg\.get\("reasoning"\) or ""\n',
        "", "Groq reasoning-field fallback hataya")

    # 7. Hindi me kam temperature (sirf _generate_chunk ke andar)
    m = re.search(r"    def _generate_chunk\(.*?(?=^    def |\Z)", text, re.M | re.S)
    if not m:
        log("SKIP", "_generate_chunk nahi mila (temperature unchanged)")
    else:
        body = m.group(0)
        if "gen_temp" in body:
            log("SKIP", "Temperature fix pehle se hai")
        else:
            anchor = "        # In pure AI mode, bypass notes context entirely"
            if anchor in body and "temperature=0.7" in body:
                body2 = body.replace(anchor, "        gen_temp = 0.35 if is_hindi else 0.7\n\n" + anchor, 1)
                body2 = body2.replace("temperature=0.7", "temperature=gen_temp")
                text = text.replace(body, body2, 1)
                log("OK", "Hindi temperature 0.35 (English 0.7)")
            else:
                log("SKIP", "Temperature anchor nahi mila")

    # 8. Tutor me FreeLLMAPI band (baaki jagah already band hai)
    text = sub_once(
        text, r"if settings\.FREELLMAPI_URL and settings\.FREELLMAPI_KEY:",
        "if False and settings.FREELLMAPI_URL and settings.FREELLMAPI_KEY:",
        "Tutor me FreeLLMAPI gateway band")

    # 9. Mock fallback me '[Concept Variant N]' hataya
    text = sub_once(
        text, r'suffix = f" \[Concept Variant \{variant_seed\}\]" if variant_seed > 1 else ""',
        'suffix = ""', "Mock '[Concept Variant]' text hataya")
    return text


def patch_templates(text):
    text = sub_once(
        text, r"^9\. STRICT ANSWER-EXPLANATION CONSISTENCY:[^\n]*$",
        "9. STRICT ANSWER-EXPLANATION CONSISTENCY: Do NOT mention option letters (A/B/C/D) inside the explanation; refer to the correct answer by its content instead.",
        "Prompt rule 9", flags=re.M)
    text = sub_once(
        text, r"^11\. CLEAN UNICODE:[^\n]*$",
        "11. CLEAN UNICODE: Output clean UTF-8 text in the requested language (Devanagari for Hindi). NEVER output raw Unicode escape sequences. Fix corrupted OCR/PDF characters into normal words.",
        "Prompt rule 11 (English quiz ko Devanagari bolna band)", flags=re.M)
    return text


def process(path, patcher, label):
    print(f"\n== {label}: {path}")
    if not path.exists():
        log("FAIL", "File nahi mili. Script ko backend/ folder me rakh ke chalao.")
        return False
    original_bytes = path.read_bytes()
    text, crlf = read(path)
    new_text = patcher(text)
    if new_text == text:
        print("  Koi change nahi hua.")
        return True
    # syntax check temp file par
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td) / "check.py"
        tmp.write_text(new_text, encoding="utf-8")
        try:
            py_compile.compile(str(tmp), doraise=True)
        except py_compile.PyCompileError as e:
            print(f"  [FAIL] Syntax error aaya, file ko TOUCH nahi kiya: {e}")
            return False
    backup = path.with_suffix(path.suffix + ".bak_before_fix")
    if not backup.exists():
        backup.write_bytes(original_bytes)
    write(path, new_text, crlf)
    print(f"  Saved. Backup: {backup.name}")
    return True


if __name__ == "__main__":
    ok1 = process(LLM, patch_llm, "llm_service.py")
    ok2 = process(TPL, patch_templates, "templates.py")
    fails = [m for s, m in report if s == "FAIL"]
    print("\n" + "=" * 60)
    if ok1 and ok2 and not fails:
        print("DONE. Ab: git add . && git commit -m 'Hindi quiz fixes' && git push")
    else:
        print("Kuch step fail hue. Upar [FAIL] lines dekho aur mujhe bhej do.")
        sys.exit(1)
