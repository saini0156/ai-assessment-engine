from typing import Dict, Optional
from app.models.schemas import InternalQuizSession

class SessionStore:
    """
    Zero-Leak Server-Side Session Storage with Database Fallback.
    Holds active quiz data in memory for sub-millisecond retrieval.
    Automatically recovers sessions from PostgreSQL if the server restarts.
    """
    def __init__(self):
        self._sessions: Dict[str, InternalQuizSession] = {}

    def save_session(self, session: InternalQuizSession) -> None:
        self._sessions[session.quiz_session_id] = session

    def get_session(self, quiz_session_id: str) -> Optional[InternalQuizSession]:
        # 1. Fast path: in-memory lookup (~0.001ms)
        if quiz_session_id in self._sessions:
            return self._sessions[quiz_session_id]

        # 2. Resilient fallback: recover from PostgreSQL snapshot if server restarted
        try:
            from app.services.db_service import db_service
            db_session = db_service.get_internal_session(quiz_session_id)
            if db_session:
                # Re-cache in memory for subsequent operations
                self._sessions[quiz_session_id] = db_session
                return db_session
        except Exception:
            pass

        return None

    def delete_session(self, quiz_session_id: str) -> bool:
        if quiz_session_id in self._sessions:
            del self._sessions[quiz_session_id]
            return True
        return False

    def list_sessions(self) -> int:
        return len(self._sessions)

# Global singleton instance
session_store = SessionStore()
