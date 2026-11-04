from typing import Dict, Optional
from app.models.schemas import InternalQuizSession

class SessionStore:
    """
    Zero-Leak Server-Side Session Storage.
    Holds the full quiz data (including correct answers and explanations) in server memory.
    The client/student never receives the answer keys until submission.
    """
    def __init__(self):
        self._sessions: Dict[str, InternalQuizSession] = {}

    def save_session(self, session: InternalQuizSession) -> None:
        self._sessions[session.quiz_session_id] = session

    def get_session(self, quiz_session_id: str) -> Optional[InternalQuizSession]:
        return self._sessions.get(quiz_session_id)

    def delete_session(self, quiz_session_id: str) -> bool:
        if quiz_session_id in self._sessions:
            del self._sessions[quiz_session_id]
            return True
        return False

    def list_sessions(self) -> int:
        return len(self._sessions)

# Global singleton instance
session_store = SessionStore()
