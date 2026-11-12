import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.schemas import (
    AdminUserListItem,
    AdminUserHistoryItem,
    UserRoleUpdateRequest,
    UserResponse,
)
from app.models.user import User
from app.services.auth_service import get_current_admin
from app.services.db_service import db_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get(
    "/users",
    response_model=List[AdminUserListItem],
    summary="List all users with aggregated quiz performance stats (Admin Only)",
)
def list_admin_users(
    current_admin: User = Depends(get_current_admin),
):
    """
    Returns all registered users with:
    - quizzes_taken: Total completed quizzes
    - avg_score: Average percentage score across completed quizzes
    - last_active: Timestamp of most recent completed attempt
    Guarded: Admin only (returns 403 for non-admin users, 401 if unauthenticated).
    """
    if not db_service:
        return []
    return db_service.get_admin_users()


@router.get(
    "/users/{user_id}/history",
    response_model=List[AdminUserHistoryItem],
    summary="Retrieve complete quiz attempt history for a specific user (Admin Only)",
)
def get_user_history(
    user_id: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """
    Returns one user's quiz attempt history ordered newest first.
    Returns 404 if the user does not exist.
    Guarded: Admin only (returns 403 for non-admin users).
    """
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID '{user_id}' not found.",
        )

    if not db_service:
        return []

    return db_service.get_user_quiz_history(user_id=user_id)


@router.patch(
    "/users/{user_id}/role",
    response_model=UserResponse,
    summary="Promote or demote a user role (Admin Only)",
)
def update_user_role(
    user_id: str,
    payload: UserRoleUpdateRequest,
    current_admin: User = Depends(get_current_admin),
):
    """
    Changes a user's role to 'admin' or 'student'.
    Guards:
    - Only 'admin' or 'student' allowed (422 Unprocessable Entity otherwise).
    - An admin cannot demote their own account (400 Bad Request).
    - The last remaining admin cannot be demoted (400 Bad Request).
    """
    if not db_service:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service unavailable.",
        )

    updated_user = db_service.update_user_role(
        target_user_id=user_id,
        new_role=payload.role,
        current_admin_id=current_admin.id,
    )

    return UserResponse(
        id=updated_user.id,
        full_name=updated_user.full_name,
        name=updated_user.full_name,
        email=updated_user.email,
        role=updated_user.role,
        is_active=updated_user.is_active,
        created_at=str(updated_user.created_at) if updated_user.created_at else None,
    )
