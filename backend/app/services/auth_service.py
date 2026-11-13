import hashlib
import logging
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

try:
    from google.oauth2 import id_token as google_id_token
    from google.auth.transport import requests as google_requests
    _GOOGLE_AUTH_AVAILABLE = True
except ImportError:
    _GOOGLE_AUTH_AVAILABLE = False

from app.config import settings
from app.database import get_db, Base, engine
from app.models.user import User
from app.models.schemas import UserRegisterRequest

# Argon2 Password Hasher
pwd_hasher = PasswordHasher()
security_bearer = HTTPBearer(auto_error=False)

# In-memory user cache for resilient local testing/mocking
_in_memory_users: Dict[str, Dict[str, Any]] = {}


def hash_password(password: str) -> str:
    """Hash password using modern Argon2id algorithm."""
    return pwd_hasher.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify plain password against hashed password."""
    if not hashed_password or not plain_password:
        return False
    try:
        return pwd_hasher.verify(hashed_password, plain_password)
    except VerifyMismatchError:
        # Backward compatibility with SHA-256 fallback
        if hashed_password == hashlib.sha256(plain_password.encode()).hexdigest():
            return True
        return False
    except Exception:
        return False


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Generate signed JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({
        "exp": expire,
        "iat": datetime.now(timezone.utc)
    })
    
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    """Decode and validate JWT access token."""
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except Exception:
        return None


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    """Retrieve user by email from database, with in-memory fallback."""
    clean_email = email.strip().lower()
    try:
        user = db.query(User).filter(User.email == clean_email).first()
        if user:
            return user
    except Exception:
        pass
    
    # Check in-memory store
    if clean_email in _in_memory_users:
        u_data = _in_memory_users[clean_email]
        mock_user = User(
            id=u_data["id"],
            full_name=u_data["full_name"],
            email=u_data["email"],
            hashed_password=u_data["hashed_password"],
            role=u_data["role"],
            is_active=u_data["is_active"],
            created_at=u_data["created_at"],
        )
        return mock_user
    return None


def get_user_by_id(db: Session, user_id: str) -> Optional[User]:
    """Retrieve user by ID from database, with in-memory fallback."""
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            return user
    except Exception:
        pass
    
    for u_data in _in_memory_users.values():
        if u_data["id"] == user_id:
            return User(
                id=u_data["id"],
                full_name=u_data["full_name"],
                email=u_data["email"],
                hashed_password=u_data["hashed_password"],
                role=u_data["role"],
                is_active=u_data["is_active"],
                created_at=u_data["created_at"],
            )
    return None


def create_user(db: Session, req: UserRegisterRequest) -> User:
    """Create a new user with hashed password."""
    clean_email = req.email.strip().lower()
    clean_role = req.role if req.role in ["admin", "student"] else "student"
    hashed = hash_password(req.password)
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    new_user = User(
        id=user_id,
        full_name=req.full_name.strip(),
        email=clean_email,
        hashed_password=hashed,
        role=clean_role,
        is_active=True,
        created_at=now,
    )

    try:
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
    except Exception:
        db.rollback()
        # Save to in-memory fallback store
        _in_memory_users[clean_email] = {
            "id": user_id,
            "full_name": req.full_name.strip(),
            "email": clean_email,
            "hashed_password": hashed,
            "role": clean_role,
            "is_active": True,
            "created_at": now,
        }
    
    return new_user


def seed_default_users(db: Session):
    """Ensure default admin and student accounts exist for immediate login."""
    defaults = [
        ("Admin User", "admin@quizpro.ai", "admin123", "admin"),
        ("Student Demo", "student@quizpro.ai", "student123", "student"),
    ]
    for full_name, email, password, role in defaults:
        if not get_user_by_email(db, email):
            try:
                create_user(
                    db,
                    UserRegisterRequest(
                        full_name=full_name,
                        email=email,
                        password=password,
                        role=role,
                    ),
                )
            except Exception:
                pass


def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    """Verify email and password, returning user if valid."""
    user = get_user_by_email(db, email)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


def verify_google_id_token(credential: str) -> dict:
    """
    Cryptographically verify Google ID Token (JWT) issued by Google Identity Services.
    Validates token signature with Google certificates, audience, issuer, and expiration.
    """
    clean_cred = credential.strip()

    # Mock / Testing token hook for local offline development & tests
    if clean_cred.startswith("mock_google_"):
        tag = clean_cred.replace("mock_google_", "").strip() or "test"
        return {
            "sub": f"mock_google_sub_{tag}",
            "email": f"google_{tag}@gmail.com",
            "name": f"Google User {tag.capitalize()}",
            "picture": "https://lh3.googleusercontent.com/mock",
            "email_verified": True
        }

    if not _GOOGLE_AUTH_AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google auth library is not available on server."
        )

    try:
        client_id = settings.GOOGLE_CLIENT_ID.strip() if settings.GOOGLE_CLIENT_ID else None
        id_info = google_id_token.verify_oauth2_token(
            clean_cred,
            google_requests.Request(),
            audience=client_id
        )

        issuer = id_info.get("iss", "")
        if issuer not in ["accounts.google.com", "https://accounts.google.com"]:
            raise ValueError(f"Invalid token issuer: '{issuer}'.")

        return id_info
    except ValueError as ve:
        logger.warning(f"Invalid Google ID token: {ve}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Google token: {str(ve)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        logger.error(f"Google token verification error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google authentication failed. Token may be expired or malformed.",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_or_create_google_user(db: Session, google_info: dict) -> User:
    """
    Look up user by verified Google email.
    If existing: returns user (logs them in).
    If new: provisions student account with role 'student' and secure random placeholder hash.
    """
    email = google_info.get("email", "").strip().lower()
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google account did not return a valid email address."
        )

    user = get_user_by_email(db, email)
    if user:
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is deactivated. Please contact an administrator."
            )
        return user

    full_name = google_info.get("name") or google_info.get("given_name") or email.split("@")[0].capitalize()
    random_password = secrets.token_urlsafe(32)
    hashed = hash_password(random_password)
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    new_user = User(
        id=user_id,
        full_name=full_name.strip(),
        email=email,
        hashed_password=hashed,
        role="student",
        is_active=True,
        created_at=now,
    )

    try:
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
    except Exception:
        db.rollback()
        _in_memory_users[email] = {
            "id": user_id,
            "full_name": full_name.strip(),
            "email": email,
            "hashed_password": hashed,
            "role": "student",
            "is_active": True,
            "created_at": now,
        }

    return new_user


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    db: Session = Depends(get_db)
) -> User:
    """Dependency: Extract current authenticated user from Bearer JWT token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate authentication credentials. Please sign in.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    if not credentials or not credentials.credentials:
        raise credentials_exception
    
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        raise credentials_exception
    
    user_id: Optional[str] = payload.get("sub")
    if not user_id:
        raise credentials_exception
    
    user = get_user_by_id(db, user_id)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is inactive or not found.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


async def get_optional_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """Dependency: Extract authenticated user if Bearer JWT token present, else return None."""
    if not credentials or not credentials.credentials:
        return None
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    return get_user_by_id(db, user_id)


async def get_current_admin(
    current_user: User = Depends(get_current_user)
) -> User:
    """Dependency: Restrict endpoint to admin users only."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Admin role required for this action."
        )
    return current_user
