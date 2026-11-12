import uuid
import pytest
from app.models.user import User
from app.services.auth_service import hash_password, create_access_token


@pytest.fixture
def test_admin_user(db):
    user_id = str(uuid.uuid4())
    admin = User(
        id=user_id,
        full_name="Admin Rahul",
        email=f"admin_{uuid.uuid4().hex[:6]}@example.com",
        hashed_password=hash_password("adminpass123"),
        role="admin",
        is_active=True,
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return admin


@pytest.fixture
def test_normal_user(db):
    user_id = str(uuid.uuid4())
    student = User(
        id=user_id,
        full_name="Student Nitish",
        email=f"student_{uuid.uuid4().hex[:6]}@example.com",
        hashed_password=hash_password("studentpass123"),
        role="user",
        is_active=True,
    )
    db.add(student)
    db.commit()
    db.refresh(student)
    return student


def get_auth_header(user):
    token = create_access_token({"sub": user.id, "email": user.email, "role": user.role})
    return {"Authorization": f"Bearer {token}"}


def test_admin_users_unauthenticated(client):
    """GET /admin/users returns 401 for unauthenticated calls."""
    res = client.get("/api/v1/admin/users")
    assert res.status_code == 401


def test_admin_users_forbidden_for_normal_user(client, test_normal_user):
    """GET /admin/users returns 403 for non-admin users."""
    headers = get_auth_header(test_normal_user)
    res = client.get("/api/v1/admin/users", headers=headers)
    assert res.status_code == 403


def test_admin_users_success(client, test_admin_user, test_normal_user):
    """GET /admin/users returns user list with required stats for admin."""
    headers = get_auth_header(test_admin_user)
    res = client.get("/api/v1/admin/users", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 2

    # Check fields of user items
    first = data[0]
    for key in ["id", "name", "email", "role", "created_at", "quizzes_taken", "avg_score", "last_active"]:
        assert key in first


def test_user_history_not_found(client, test_admin_user):
    """GET /admin/users/{user_id}/history returns 404 for unknown user."""
    headers = get_auth_header(test_admin_user)
    res = client.get("/api/v1/admin/users/non-existent-id/history", headers=headers)
    assert res.status_code == 404


def test_user_history_forbidden_for_normal_user(client, test_normal_user):
    """GET /admin/users/{user_id}/history returns 403 for non-admin."""
    headers = get_auth_header(test_normal_user)
    res = client.get(f"/api/v1/admin/users/{test_normal_user.id}/history", headers=headers)
    assert res.status_code == 403


def test_change_role_invalid_value(client, test_admin_user, test_normal_user):
    """PATCH /admin/users/{user_id}/role returns 422 for invalid roles."""
    headers = get_auth_header(test_admin_user)
    res = client.patch(
        f"/api/v1/admin/users/{test_normal_user.id}/role",
        headers=headers,
        json={"role": "superadmin"},
    )
    assert res.status_code == 422


def test_change_role_self_demotion_blocked(client, test_admin_user):
    """Admin cannot remove their own admin role (returns 400)."""
    headers = get_auth_header(test_admin_user)
    res = client.patch(
        f"/api/v1/admin/users/{test_admin_user.id}/role",
        headers=headers,
        json={"role": "user"},
    )
    assert res.status_code == 400
    assert "cannot revoke" in res.json()["detail"].lower()


def test_change_role_last_admin_demotion_blocked(client, db):
    """Cannot demote the last remaining admin (returns 400)."""
    # Delete all other admins so only one remains
    db.query(User).filter(User.role == "admin").delete()
    sole_admin = User(
        id=str(uuid.uuid4()),
        full_name="Sole Admin",
        email="sole_admin@example.com",
        hashed_password=hash_password("adminpass123"),
        role="admin",
        is_active=True,
    )
    # Create another admin acting as caller so caller != target
    caller_admin = User(
        id=str(uuid.uuid4()),
        full_name="Caller Admin",
        email="caller_admin@example.com",
        hashed_password=hash_password("adminpass123"),
        role="admin",
        is_active=True,
    )
    db.add(sole_admin)
    db.add(caller_admin)
    db.commit()

    # Demote sole_admin while caller_admin exists -> 2 admins exist, demoting one leaves 1 admin
    headers = get_auth_header(caller_admin)
    res1 = client.patch(
        f"/api/v1/admin/users/{sole_admin.id}/role",
        headers=headers,
        json={"role": "user"},
    )
    assert res1.status_code == 200

    # Now caller_admin is the ONLY remaining admin in the system!
    # A third party admin (e.g. new admin) trying to demote caller_admin:
    other_admin = User(
        id=str(uuid.uuid4()),
        full_name="Other Admin",
        email="other@example.com",
        hashed_password=hash_password("adminpass123"),
        role="user",
        is_active=True,
    )
    db.add(other_admin)
    db.commit()


def test_change_role_success(client, test_admin_user, test_normal_user):
    """PATCH /admin/users/{user_id}/role promotes user to admin and updates role."""
    headers = get_auth_header(test_admin_user)
    res = client.patch(
        f"/api/v1/admin/users/{test_normal_user.id}/role",
        headers=headers,
        json={"role": "admin"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["role"] == "admin"
    assert data["id"] == test_normal_user.id


def test_auth_responses_include_role(client):
    """Ensure signup, login, and /auth/me all include role inside user object."""
    email = f"role_test_{uuid.uuid4().hex[:6]}@example.com"
    signup_res = client.post(
        "/api/v1/auth/signup",
        json={"full_name": "Role User", "email": email, "password": "password123!"},
    )
    assert signup_res.status_code == 201
    signup_data = signup_res.json()
    assert "role" in signup_data["user"]
    token = signup_data["access_token"]

    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "password123!"},
    )
    assert login_res.status_code == 200
    login_data = login_res.json()
    assert "role" in login_data["user"]

    me_res = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert "role" in me_data["user"]
