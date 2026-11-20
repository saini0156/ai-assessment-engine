import os
import hashlib
import json
import logging
from typing import List, Tuple

import httpx
from fastapi import APIRouter, UploadFile, File, HTTPException

router = APIRouter()

# Simple in‑process cache: hash+provider -> topics list
_cache: dict[Tuple[str, str], List[str]] = {}

# Primary and fallback keys
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
FREE_LLM_UNIFIED_KEY = os.getenv("FREE_LLM_UNIFIED_KEY")
FREE_LLM_ENDPOINT = os.getenv("FREE_LLM_ENDPOINT", "https://api.free-llm.com/v1/generate")
# Optional flag to prioritize the unified free‑LLM key as the primary provider
USE_UNIFIED_FIRST = os.getenv("USE_UNIFIED_FIRST", "false").lower() == "true"

DISABLE_FREE_FALLBACK = os.getenv("DISABLE_FREE_FALLBACK", "false").lower() == "true"

if not GEMINI_API_KEY and not FREE_LLM_UNIFIED_KEY:
    raise RuntimeError("At least one of GEMINI_API_KEY or FREE_LLM_UNIFIED_KEY must be set in environment")

# Load additional key pools for multi‑key rotation (Gemini & Groq)
from app.config import settings
from app.services.llm_service import GroqKeyPool
_gemini_key_pool = GroqKeyPool(settings.GEMINI_API_KEYS)
_groq_key_pool = GroqKeyPool(settings.GROQ_API_KEYS)

# Logging – include provider and request id for easier debugging
logger = logging.getLogger(__name__)

GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent"

def _hash_content(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()

def _normalise_topics(raw: List[str]) -> List[str]:
    """Deduplicate, strip whitespace, and sort topics for deterministic output.
    Guarantees the return type is a list of unique non‑empty strings.
    """
    cleaned = {t.strip() for t in raw if isinstance(t, str) and t.strip()}
    return sorted(cleaned)

def _call_gemini(prompt: str) -> List[str]:
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.1, "stopSequences": ["\n\n"]}
    }
    # Round‑robin key selection – fallback to static key if pool empty
    key = _gemini_key_pool.get_key() or GEMINI_API_KEY
    url = f"{GEMINI_ENDPOINT}?key={key}"
    try:
        response = httpx.post(url, json=payload, timeout=30.0)
        response.raise_for_status()
        data = response.json()
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        topics = json.loads(text)
        if not isinstance(topics, list):
            raise ValueError("Gemini response is not a list")
        logger.info("Gemini call succeeded", extra={"provider": "gemini", "key": key})
        return _normalise_topics(topics)
    except Exception as e:
        logger.warning("Gemini call failed", extra={"provider": "gemini", "error": str(e)})
        # If fallback is allowed, try free LLM
        if FREE_LLM_UNIFIED_KEY and not DISABLE_FREE_FALLBACK:
            return _call_free_llm(prompt)
        raise HTTPException(status_code=502, detail=f"Gemini API error: {e}")

def _call_unified(prompt: str) -> List[str]:
    """Unified free‑LLM call – same implementation as _call_free_llm but isolated for ordering logic."""
    return _call_free_llm(prompt)

    payload = {
        "model": "unified",
        "prompt": prompt,
        "temperature": 0.1,
        "max_tokens": 500,
        "stop": ["\n\n"]
    }
    headers = {"Authorization": f"Bearer {FREE_LLM_UNIFIED_KEY}"}
    try:
        response = httpx.post(FREE_LLM_ENDPOINT, json=payload, headers=headers, timeout=30.0)
        response.raise_for_status()
        data = response.json()
        text = data.get("text") or data.get("response")
        if not text:
            raise ValueError("No text field in free LLM response")
        topics = json.loads(text)
        if not isinstance(topics, list):
            raise ValueError("Free LLM response is not a list")
        logger.info("Free LLM fallback succeeded", extra={"provider": "free_llm"})
        return _normalise_topics(topics)
    except Exception as e:
        logger.error("Free LLM fallback failed", extra={"provider": "free_llm", "error": str(e)})
        raise HTTPException(status_code=502, detail=f"Free LLM API error: {e}")

@router.post("/extract-topics", summary="Extract all topics from uploaded notes")
async def extract_topics(file: UploadFile = File(...)):
    content = (await file.read()).decode("utf-8")
    if not content.strip():
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    content_hash = _hash_content(content)
    # Use provider flag in cache key to avoid cross‑provider contamination
    cache_key = (content_hash, "gemini" if GEMINI_API_KEY else "free_llm")
    if cache_key in _cache:
        return {"topics": _cache[cache_key], "cached": True}
    prompt = (
        "Extract *all* distinct topics covered in the following notes. "
        "Return a JSON array of strings, nothing else. "
        "Temperature=0.1, stop at double newline.\n\n" + content
    )
    topics = _call_gemini(prompt)
    _cache[cache_key] = topics
    return {"topics": topics, "cached": False}
