# Feedback Service

"""Utility service for storing and retrieving per‑question feedback.
It uses the existing ``DatabaseService`` when available, otherwise falls back
to the ``session_store`` (in‑memory) so the feature works in local dev without
a DB.
"""

import uuid
from datetime import datetime
import logging
from typing import List, Dict, Any

from app.models.schemas import QuizFeedbackCreate

logger = logging.getLogger(__name__)

class FeedbackService:
    def __init__(self):
        try:
            from app.services.db_service import db_service
            self.db = db_service
        except Exception as exc:  # pragma: no cover
            self.db = None
            logger.warning("DB service not available – feedback will be stored in session store: %s", exc)

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
        if self.db:
            self.db.insert_feedback(record)
        else:
            # fallback to session store
            from app.services.session_store import session_store
            sess = session_store.get_session(quiz_session_id) or {}
            sess.setdefault("feedback", []).append(record)
            session_store.save_session(sess)
        return fb_id

    # ---------------------------------------------------------------------
    # Read
    # ---------------------------------------------------------------------
    def list_feedback(self, quiz_session_id: str) -> List[Dict[str, Any]]:
        if self.db:
            rows = self.db.fetch_feedback_by_quiz(quiz_session_id)
            return rows
        from app.services.session_store import session_store
        sess = session_store.get_session(quiz_session_id) or {}
        return sess.get("feedback", [])
