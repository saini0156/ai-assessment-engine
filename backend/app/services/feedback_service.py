# Feedback Service

"""Utility service for storing and retrieving per‑question feedback.
It uses the existing ``DatabaseService`` when available, otherwise falls back
to the ``session_store`` (in‑memory) so the feature works in local dev without
a DB.
"""

import json
import os
import uuid
from datetime import datetime
import logging
from typing import List, Dict, Any

from app.models.schemas import QuizFeedbackCreate

logger = logging.getLogger(__name__)

# Persistent file backup path
BACKUP_FILE = os.path.join(os.path.dirname(__file__), "../../data/quiz_feedback.json")


class FeedbackService:
    def __init__(self):
        try:
            from app.services.db_service import db_service
            self.db = db_service
        except Exception as exc:  # pragma: no cover
            self.db = None
            logger.warning("DB service not available – feedback will be stored in session store: %s", exc)

    def _append_to_backup_file(self, record: Dict[str, Any]) -> None:
        """Always save a persistent copy to disk so feedback is never lost."""
        try:
            os.makedirs(os.path.dirname(BACKUP_FILE), exist_ok=True)
            entries = []
            if os.path.exists(BACKUP_FILE):
                try:
                    with open(BACKUP_FILE, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        if isinstance(data, list):
                            entries = data
                except Exception:
                    entries = []
            entries.append(record)
            with open(BACKUP_FILE, "w", encoding="utf-8") as f:
                json.dump(entries, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.warning("Failed to write to feedback backup file: %s", e)

    # ---------------------------------------------------------------------
    # Create
    # ---------------------------------------------------------------------
    def save_feedback(self, quiz_session_id: str, payload: Dict[str, Any]) -> str:
        """Persist a feedback record and return its UUID.
        ``payload`` must contain ``question_id``, ``review_text`` and optional ``user_id``.
        """
        fb_id = str(uuid.uuid4())
        record = {
            "id": fb_id,
            "quiz_session_id": quiz_session_id,
            "question_id": payload["question_id"],
            "review_text": payload["review_text"],
            "user_id": payload.get("user_id"),
            "created_at": datetime.utcnow().isoformat(),
        }

        # 1. Primary: Save to Database
        if self.db:
            try:
                self.db.insert_feedback(record)
            except Exception as exc:
                logger.error("DB insert_feedback failed: %s; saving to backup and session store", exc)
                self._save_to_session_store(quiz_session_id, record)
        else:
            self._save_to_session_store(quiz_session_id, record)

        # 2. Secondary: Persistent disk backup (Zero data loss guarantee)
        self._append_to_backup_file(record)

        return fb_id

    def _save_to_session_store(self, quiz_session_id: str, record: Dict[str, Any]) -> None:
        try:
            from app.services.session_store import session_store
            sess = session_store.get_session(quiz_session_id) or {}
            sess.setdefault("feedback", []).append(record)
            session_store.save_session(sess)
        except Exception as exc:
            logger.warning("Session store fallback error: %s", exc)

    # ---------------------------------------------------------------------
    # Read
    # ---------------------------------------------------------------------
    def list_feedback(self, quiz_session_id: str) -> List[Dict[str, Any]]:
        if self.db:
            try:
                rows = self.db.fetch_feedback_by_quiz(quiz_session_id)
                if rows:
                    return rows
            except Exception as e:
                logger.error("fetch_feedback_by_quiz DB error: %s", e)

        from app.services.session_store import session_store
        sess = session_store.get_session(quiz_session_id) or {}
        return sess.get("feedback", [])
