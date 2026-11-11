from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.schemas import (
    UserRegisterRequest,
    UserLoginRequest,
    AuthTokenResponse,
    UserProfileResponse,
    UserResponse,
    AuthLogoutResponse
)
from app.models.user import User
from app.services.auth_service import (
    get_user_by_email,
    create_user,
    authenticate_user,
    create_access_token,
    get_current_user
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/signup",
    response_model=AuthTokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new student or admin account"
)
async def signup(
    payload: UserRegisterRequest,
    db: Session = Depends(get_db)
):
    """
    Register a new user account with secure password hashing.
    Returns a signed JWT access token and user profile for immediate login.
    """
    existing_user = get_user_by_email(db, payload.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists. Please sign in instead."
        )

    user = create_user(db, payload)

    token_data = {
        "sub": user.id,
        "email": user.email,
        "role": user.role
    }
    access_token = create_access_token(token_data)

    return AuthTokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse(
            id=user.id,
            full_name=user.full_name,
            email=user.email,
            role=user.role,
            is_active=user.is_active,
            created_at=str(user.created_at) if user.created_at else None
        )
    )


@router.post(
    "/login",
    response_model=AuthTokenResponse,
    summary="Sign in with email and password"
)
async def login(
    payload: UserLoginRequest,
    db: Session = Depends(get_db)
):
    """
    Authenticate user with email and password.
    Returns a signed JWT token and user profile.
    """
    user = authenticate_user(db, payload.email, payload.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password. Please check your credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token_data = {
        "sub": user.id,
        "email": user.email,
        "role": user.role
    }
    access_token = create_access_token(token_data)

    return AuthTokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse(
            id=user.id,
            full_name=user.full_name,
            email=user.email,
            role=user.role,
            is_active=user.is_active,
            created_at=str(user.created_at) if user.created_at else None
        )
    )


@router.get(
    "/me",
    response_model=UserProfileResponse,
    summary="Hydrate current authenticated user session"
)
async def get_me(
    current_user: User = Depends(get_current_user)
):
    """
    Retrieve current authenticated user profile using Bearer JWT.
    Used by frontend on page refresh to verify active session.
    """
    return UserProfileResponse(
        status="success",
        user=UserResponse(
            id=current_user.id,
            full_name=current_user.full_name,
            email=current_user.email,
            role=current_user.role,
            is_active=current_user.is_active,
            created_at=str(current_user.created_at) if current_user.created_at else None
        )
    )


@router.post(
    "/logout",
    response_model=AuthLogoutResponse,
    summary="Sign out user session"
)
async def logout():
    """
    Sign out user. Instructs frontend client to clear token from localStorage or cookies.
    """
    return AuthLogoutResponse(
        status="success",
        message="Logged out successfully"
    )
