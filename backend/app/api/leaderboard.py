import logging
from typing import Optional
from fastapi import APIRouter, Depends, Query

from app.models.schemas import LeaderboardResponse, TopicLeaderboardResponse
from app.models.user import User
from app.services.auth_service import get_optional_current_user
from app.services.leaderboard_service import leaderboard_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/leaderboard", tags=["Leaderboard"])


@router.get("", response_model=LeaderboardResponse)
def get_leaderboard(
    period: str = Query("week", description="Leaderboard time window: 'week', 'month', or 'all'"),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """
    Returns global student leaderboard ranked by total points.
    - Points = correct_count * difficulty_weight (Easy: 1, Medium: 2, Hard: 3).
    - Anti-farming: only the best attempt per student for each subject, topic, and difficulty counts.
    - Only quizzes with at least 10 questions count.
    - Token is optional: 'me' object returned if logged in, null if guest.
    - Privacy: Never exposes emails, masks names to 'First L.' format.
    """
    return leaderboard_service.get_global_leaderboard(
        period=period,
        current_user=current_user,
    )


@router.get("/topic", response_model=TopicLeaderboardResponse)
def get_topic_leaderboard(
    subject: str = Query(..., description="Subject name"),
    topic: str = Query(..., description="Topic name"),
    period: str = Query("all", description="Time window: 'week', 'month', or 'all'"),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """
    Returns topic-specific leaderboard for one subject and topic.
    - Shows each student's best attempt on that topic.
    - Ranked by points (descending), then score_percentage (descending), then earlier timestamp.
    - Token is optional: 'me' object returned if logged in, null if guest.
    - Privacy: Never exposes emails.
    """
    return leaderboard_service.get_topic_leaderboard(
        subject_name=subject,
        topic_name=topic,
        period=period,
        current_user=current_user,
    )
