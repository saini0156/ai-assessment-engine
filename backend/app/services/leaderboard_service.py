import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple, Any
from sqlalchemy import func

from app.database import SessionLocal
from app.models.quiz_session import QuizSession
from app.models.quiz_answer import QuizAnswer
from app.models.quiz_session_question import QuizSessionQuestion
from app.models.user import User
from app.models.subject import Subject
from app.models.topic import Topic
from app.models.schemas import (
    LeaderboardEntry,
    LeaderboardResponse,
    TopicLeaderboardEntry,
    TopicLeaderboardResponse,
)

logger = logging.getLogger(__name__)

DIFFICULTY_WEIGHTS = {
    "easy": 1,
    "medium": 2,
    "hard": 3,
}

DEMO_USER_ID = "demo-student-id"


def format_display_name(full_name: Optional[str]) -> str:
    """Format full name into privacy-preserving 'First L.' format (e.g. 'Priya Mishra' -> 'Priya M.')."""
    if not full_name:
        return "Student"
    parts = full_name.strip().split()
    if not parts:
        return "Student"
    if len(parts) == 1:
        return parts[0]
    first = parts[0]
    last_initial = parts[-1][0].upper()
    return f"{first} {last_initial}."


class LeaderboardService:
    def _get_cutoff_date(self, period: str) -> Optional[datetime]:
        period_clean = (period or "all").lower().strip()
        now = datetime.now(timezone.utc)
        if period_clean == "week":
            return now - timedelta(days=7)
        elif period_clean == "month":
            return now - timedelta(days=30)
        return None

    def get_global_leaderboard(
        self,
        period: str = "week",
        current_user: Optional[User] = None,
    ) -> LeaderboardResponse:
        """
        Global Leaderboard:
        - Points = correct_count * difficulty_weight (Easy: 1, Medium: 2, Hard: 3)
        - Anti-farming: Only the best attempt per student for each (subject, topic, difficulty) counts.
        - Only quizzes with at least 10 questions count.
        - Returns top 50 participants.
        - Includes 'me' object for current_user (even if outside top 50).
        """
        period_clean = (period or "week").lower().strip()
        if period_clean not in ["week", "month", "all"]:
            period_clean = "week"

        cutoff = self._get_cutoff_date(period_clean)
        db = SessionLocal()
        try:
            # Query all submitted sessions with at least 10 questions (excluding internal demo user)
            query = db.query(QuizSession).filter(
                QuizSession.status == "submitted",
                QuizSession.total_questions >= 10,
                QuizSession.user_id.isnot(None),
                QuizSession.user_id != DEMO_USER_ID,
            )

            if cutoff:
                query = query.filter(
                    func.coalesce(QuizSession.submitted_at, QuizSession.started_at) >= cutoff
                )

            sessions = query.all()

            # Pre-load users
            user_ids = {s.user_id for s in sessions if s.user_id}
            users_map = {u.id: u for u in db.query(User).filter(User.id.in_(user_ids)).all()} if user_ids else {}

            # Calculate correct count and points for each session
            # Anti-farming: student best attempt per (subject_id, topic_id, difficulty)
            student_attempts: Dict[str, Dict[Tuple[str, str, str], Dict[str, Any]]] = {}

            for s in sessions:
                uid = s.user_id
                if not uid:
                    continue

                diff = (s.difficulty or "medium").lower().strip()
                weight = DIFFICULTY_WEIGHTS.get(diff, 2)

                # Determine correct count
                correct_count = (
                    db.query(func.count(QuizAnswer.id))
                    .join(QuizSessionQuestion, QuizAnswer.session_question_id == QuizSessionQuestion.id)
                    .filter(QuizSessionQuestion.session_id == s.id, QuizAnswer.is_correct == True)
                    .scalar()
                ) or 0

                if correct_count == 0 and s.total_questions > 0 and s.score_percentage is not None:
                    correct_count = round((s.score_percentage / 100.0) * s.total_questions)

                points = int(correct_count * weight)
                score_pct = float(s.score_percentage or 0.0)

                key = (s.subject_id or "", s.topic_id or "", diff)
                student_dict = student_attempts.setdefault(uid, {})

                existing = student_dict.get(key)
                if not existing or points > existing["points"] or (points == existing["points"] and score_pct > existing["score_pct"]):
                    student_dict[key] = {
                        "points": points,
                        "score_pct": score_pct,
                        "session_id": s.id,
                        "submitted_at": s.submitted_at or s.started_at,
                    }

            # Now aggregate points, quizzes_taken, and avg_score per student
            leaderboard_rows: List[Dict[str, Any]] = []

            for uid, best_map in student_attempts.items():
                u = users_map.get(uid)
                disp_name = format_display_name(u.full_name if u else "Student")
                total_pts = sum(item["points"] for item in best_map.values())
                quizzes_count = len(best_map)
                avg_sc = round(sum(item["score_pct"] for item in best_map.values()) / max(1, quizzes_count), 1)

                leaderboard_rows.append({
                    "user_id": uid,
                    "display_name": disp_name,
                    "points": total_pts,
                    "quizzes_taken": quizzes_count,
                    "avg_score": avg_sc,
                })

            # Sort by total points (descending), then avg_score (descending)
            leaderboard_rows.sort(key=lambda x: (x["points"], x["avg_score"] or 0), reverse=True)

            # Assign ranks
            all_entries: List[LeaderboardEntry] = []
            me_entry: Optional[LeaderboardEntry] = None

            for rank_idx, row in enumerate(leaderboard_rows, start=1):
                entry = LeaderboardEntry(
                    rank=rank_idx,
                    user_id=row["user_id"],
                    display_name=row["display_name"],
                    points=row["points"],
                    quizzes_taken=row["quizzes_taken"],
                    avg_score=row["avg_score"],
                )
                all_entries.append(entry)
                if current_user and row["user_id"] == current_user.id:
                    me_entry = entry

            # If current_user has no qualifying attempts yet
            if current_user and not me_entry:
                disp_name = format_display_name(current_user.full_name)
                me_entry = LeaderboardEntry(
                    rank=len(all_entries) + 1,
                    user_id=current_user.id,
                    display_name=disp_name,
                    points=0,
                    quizzes_taken=0,
                    avg_score=0.0,
                )

            return LeaderboardResponse(
                period=period_clean,
                total_participants=len(all_entries),
                entries=all_entries[:50],
                me=me_entry if current_user else None,
            )
        except Exception as e:
            logger.exception("Failed to build global leaderboard: %s", e)
            return LeaderboardResponse(
                period=period_clean,
                total_participants=0,
                entries=[],
                me=None,
            )
        finally:
            db.close()

    def get_topic_leaderboard(
        self,
        subject_name: str,
        topic_name: str,
        period: str = "all",
        current_user: Optional[User] = None,
    ) -> TopicLeaderboardResponse:
        """
        Topic Leaderboard:
        - Shows each student's best attempt on that specific subject and topic.
        - Ranked by points (descending), then score_percentage (descending), then earlier time (ascending).
        - Minimum 10 questions required.
        - Privacy protected: Never returns email.
        """
        period_clean = (period or "all").lower().strip()
        if period_clean not in ["week", "month", "all"]:
            period_clean = "all"

        cutoff = self._get_cutoff_date(period_clean)
        db = SessionLocal()
        try:
            # Resolve subject and topic IDs
            subj = db.query(Subject).filter(func.lower(Subject.name) == subject_name.strip().lower()).first()
            if not subj:
                return TopicLeaderboardResponse(
                    subject=subject_name,
                    topic=topic_name,
                    period=period_clean,
                    total_participants=0,
                    entries=[],
                    me=None,
                )

            top = db.query(Topic).filter(
                Topic.subject_id == subj.id,
                func.lower(Topic.name) == topic_name.strip().lower()
            ).first()

            query = db.query(QuizSession).filter(
                QuizSession.subject_id == subj.id,
                QuizSession.status == "submitted",
                QuizSession.total_questions >= 10,
                QuizSession.user_id.isnot(None),
                QuizSession.user_id != DEMO_USER_ID,
            )

            if top:
                query = query.filter(QuizSession.topic_id == top.id)

            if cutoff:
                query = query.filter(
                    func.coalesce(QuizSession.submitted_at, QuizSession.started_at) >= cutoff
                )

            sessions = query.all()

            user_ids = {s.user_id for s in sessions if s.user_id}
            users_map = {u.id: u for u in db.query(User).filter(User.id.in_(user_ids)).all()} if user_ids else {}

            # Best attempt per student on this topic
            best_by_student: Dict[str, Dict[str, Any]] = {}

            for s in sessions:
                uid = s.user_id
                if not uid:
                    continue

                diff = (s.difficulty or "medium").lower().strip()
                weight = DIFFICULTY_WEIGHTS.get(diff, 2)

                correct_count = (
                    db.query(func.count(QuizAnswer.id))
                    .join(QuizSessionQuestion, QuizAnswer.session_question_id == QuizSessionQuestion.id)
                    .filter(QuizSessionQuestion.session_id == s.id, QuizAnswer.is_correct == True)
                    .scalar()
                ) or 0

                if correct_count == 0 and s.total_questions > 0 and s.score_percentage is not None:
                    correct_count = round((s.score_percentage / 100.0) * s.total_questions)

                points = int(correct_count * weight)
                score_pct = float(s.score_percentage or 0.0)
                achieved = s.submitted_at or s.started_at

                cand = {
                    "points": points,
                    "score_percentage": score_pct,
                    "difficulty": (s.difficulty or "Medium").capitalize(),
                    "correct_count": int(correct_count),
                    "total_questions": int(s.total_questions),
                    "achieved_at": achieved,
                    "session_id": s.id,
                }

                existing = best_by_student.get(uid)
                if not existing:
                    best_by_student[uid] = cand
                else:
                    # Compare points (higher better), then score_pct (higher better), then achieved (earlier better)
                    if points > existing["points"]:
                        best_by_student[uid] = cand
                    elif points == existing["points"]:
                        if score_pct > existing["score_percentage"]:
                            best_by_student[uid] = cand
                        elif score_pct == existing["score_percentage"] and achieved and existing["achieved_at"]:
                            if achieved < existing["achieved_at"]:
                                best_by_student[uid] = cand

            # Format and rank
            ranked_rows = []
            for uid, cand in best_by_student.items():
                u = users_map.get(uid)
                disp_name = format_display_name(u.full_name if u else "Student")
                ranked_rows.append({
                    "user_id": uid,
                    "display_name": disp_name,
                    "points": cand["points"],
                    "score_percentage": cand["score_percentage"],
                    "difficulty": cand["difficulty"],
                    "correct_count": cand["correct_count"],
                    "total_questions": cand["total_questions"],
                    "achieved_at": cand["achieved_at"].isoformat() if cand["achieved_at"] else None,
                    "raw_achieved": cand["achieved_at"],
                })

            # Sort by: points desc, score_percentage desc, raw_achieved asc
            def _sort_key(item):
                dt_val = item["raw_achieved"].timestamp() if item["raw_achieved"] else float("inf")
                return (-item["points"], -item["score_percentage"], dt_val)

            ranked_rows.sort(key=_sort_key)

            all_entries: List[TopicLeaderboardEntry] = []
            me_entry: Optional[TopicLeaderboardEntry] = None

            for rank_idx, row in enumerate(ranked_rows, start=1):
                entry = TopicLeaderboardEntry(
                    rank=rank_idx,
                    user_id=row["user_id"],
                    display_name=row["display_name"],
                    points=row["points"],
                    score_percentage=row["score_percentage"],
                    difficulty=row["difficulty"],
                    correct_count=row["correct_count"],
                    total_questions=row["total_questions"],
                    achieved_at=row["achieved_at"],
                )
                all_entries.append(entry)
                if current_user and row["user_id"] == current_user.id:
                    me_entry = entry

            return TopicLeaderboardResponse(
                subject=subject_name,
                topic=topic_name,
                period=period_clean,
                total_participants=len(all_entries),
                entries=all_entries[:50],
                me=me_entry if current_user else None,
            )
        except Exception as e:
            logger.exception("Failed to build topic leaderboard: %s", e)
            return TopicLeaderboardResponse(
                subject=subject_name,
                topic=topic_name,
                period=period_clean,
                total_participants=0,
                entries=[],
                me=None,
            )
        finally:
            db.close()

leaderboard_service = LeaderboardService()
