import uuid
from datetime import timedelta
import pytest
from app.services.auth_service import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
)


def test_password_hash_and_verify():
    """Verify password hashing with Argon2id and verification logic."""
    raw_password = "SecurePassword123!"
    hashed = hash_password(raw_password)

    assert hashed != raw_password
    assert verify_password(raw_password, hashed) is True
    assert verify_password("WrongPassword!", hashed) is False
    assert verify_password("", hashed) is False


def test_jwt_token_generation_and_decoding():
    """Verify JWT access token generation and claims decoding."""
    payload = {"sub": "user_12345", "email": "tester@quizpro.ai", "role": "student"}
    token = create_access_token(payload, expires_delta=timedelta(minutes=15))

    decoded = decode_access_token(token)
    assert decoded is not None
    assert decoded["sub"] == "user_12345"
    assert decoded["email"] == "tester@quizpro.ai"
    assert decoded["role"] == "student"
    assert "exp" in decoded


def test_jwt_token_expiry():
    """Verify expired JWT tokens are rejected by the decoder."""
    expired_payload = {"sub": "user_expired", "email": "expired@quizpro.ai"}
    expired_token = create_access_token(expired_payload, expires_delta=timedelta(seconds=-10))

    decoded = decode_access_token(expired_token)
    assert decoded is None, "Expired JWT token should not decode successfully."


def test_user_signup_success(client):
    """Test successful user registration (201 Created)."""
    unique_email = f"student_{uuid.uuid4().hex[:8]}@example.com"
    payload = {
        "full_name": "Arjun Sharma",
        "email": unique_email,
        "password": "StrongPassword2026!",
        "role": "student"
    }

    response = client.post("/api/v1/auth/signup", json=payload)
    assert response.status_code == 201

    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == unique_email
    assert data["user"]["full_name"] == "Arjun Sharma"
    assert data["user"]["name"] == "Arjun Sharma"
    assert data["user"]["role"] == "student"


def test_user_signup_with_frontend_name_field(client):
    """Test Rahul's frontend signup format using 'name' instead of 'full_name'."""
    unique_email = f"rahul_client_{uuid.uuid4().hex[:8]}@example.com"
    payload = {
        "name": "Rahul Verma",
        "email": unique_email,
        "password": "FrontendPassword123!",
        "role": "student"
    }

    response = client.post("/api/v1/auth/signup", json=payload)
    assert response.status_code == 201

    data = response.json()
    assert data["user"]["email"] == unique_email
    assert data["user"]["name"] == "Rahul Verma"
    assert data["user"]["full_name"] == "Rahul Verma"


def test_user_signup_duplicate_email(client):
    """Test that registering an existing email returns 400 Bad Request."""
    email = f"duplicate_{uuid.uuid4().hex[:8]}@example.com"
    payload = {
        "full_name": "Test User",
        "email": email,
        "password": "Password123!",
        "role": "student"
    }

    # First registration
    res1 = client.post("/api/v1/auth/signup", json=payload)
    assert res1.status_code == 201

    # Second registration with same email
    res2 = client.post("/api/v1/auth/signup", json=payload)
    assert res2.status_code == 400
    assert "already exists" in res2.json()["detail"]


def test_user_login_success(client):
    """Test authentication with valid credentials returns 200 and access token."""
    email = f"login_{uuid.uuid4().hex[:8]}@example.com"
    password = "ValidPassword123!"

    # Create account first
    client.post(
        "/api/v1/auth/signup",
        json={"full_name": "Login Tester", "email": email, "password": password, "role": "student"}
    )

    # Attempt login
    res = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password}
    )
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["user"]["email"] == email


def test_user_login_invalid_password(client):
    """Test login with wrong password returns 401 Unauthorized."""
    email = f"wrongpass_{uuid.uuid4().hex[:8]}@example.com"
    client.post(
        "/api/v1/auth/signup",
        json={"full_name": "Wrong Pass", "email": email, "password": "CorrectPassword123!", "role": "student"}
    )

    res = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "WrongPassword999!"}
    )
    assert res.status_code == 401
    assert "Invalid email or password" in res.json()["detail"]


def test_user_login_nonexistent_email(client):
    """Test login with non-existent email returns 401 Unauthorized."""
    res = client.post(
        "/api/v1/auth/login",
        json={"email": "nobody_exists_12345@example.com", "password": "AnyPassword123!"}
    )
    assert res.status_code == 401


def test_get_me_authenticated(client):
    """Test /api/v1/auth/me returns current user profile when authenticated."""
    email = f"profile_{uuid.uuid4().hex[:8]}@example.com"
    signup_res = client.post(
        "/api/v1/auth/signup",
        json={"full_name": "Profile User", "email": email, "password": "Password123!", "role": "student"}
    )
    token = signup_res.json()["access_token"]

    res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["user"]["email"] == email
    assert data["user"]["full_name"] == "Profile User"


def test_get_me_unauthorized_missing_token(client):
    """Test /api/v1/auth/me returns 401 when token header is omitted."""
    res = client.get("/api/v1/auth/me")
    assert res.status_code == 401


def test_get_me_unauthorized_expired_token(client):
    """Test /api/v1/auth/me returns 401 when using an expired JWT."""
    expired_token = create_access_token({"sub": "random_id"}, expires_delta=timedelta(seconds=-60))
    res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {expired_token}"})
    assert res.status_code == 401


def test_logout(client):
    """Test /api/v1/auth/logout endpoint returns success."""
    res = client.post("/api/v1/auth/logout")
    assert res.status_code == 200
    assert res.json()["status"] == "success"
