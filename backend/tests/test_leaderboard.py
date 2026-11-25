import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.leaderboard_service import format_display_name, DIFFICULTY_WEIGHTS

client = TestClient(app)

def test_display_name_masking():
    # Privacy rule: Never expose emails, mask to 'First L.' format
    assert format_display_name("Priya Mishra") == "Priya M."
    assert format_display_name("Rahul Gupta") == "Rahul G."
    assert format_display_name("Aarav") == "Aarav"
    assert format_display_name(None) == "Student"
    assert format_display_name("") == "Student"

def test_difficulty_weights():
    # Easy 1, Medium 2, Hard 3
    assert DIFFICULTY_WEIGHTS["easy"] == 1
    assert DIFFICULTY_WEIGHTS["medium"] == 2
    assert DIFFICULTY_WEIGHTS["hard"] == 3

def test_global_leaderboard_endpoint_guest():
    # Unauthenticated GET /api/v1/leaderboard?period=week
    resp = client.get("/api/v1/leaderboard?period=week")
    assert resp.status_code == 200
    data = resp.json()
    assert "period" in data
    assert data["period"] == "week"
    assert "total_participants" in data
    assert "entries" in data
    assert isinstance(data["entries"], list)
    # Unauthenticated guest => me is null
    assert data["me"] is None

    # Check privacy: no email field in any entry
    for entry in data["entries"]:
        assert "email" not in entry
        assert "rank" in entry
        assert "user_id" in entry
        assert "display_name" in entry
        assert "points" in entry
        assert "quizzes_taken" in entry
        assert "avg_score" in entry

def test_global_leaderboard_periods():
    # Periods: week, month, all
    for p in ["week", "month", "all"]:
        resp = client.get(f"/api/v1/leaderboard?period={p}")
        assert resp.status_code == 200
        assert resp.json()["period"] == p

def test_topic_leaderboard_endpoint():
    # GET /api/v1/leaderboard/topic?subject=Test&topic=TestTopic&period=all
    resp = client.get("/api/v1/leaderboard/topic?subject=Computer+Science&topic=Data+Structures&period=all")
    assert resp.status_code == 200
    data = resp.json()
    assert data["subject"] == "Computer Science"
    assert data["topic"] == "Data Structures"
    assert data["period"] == "all"
    assert "entries" in data
    assert isinstance(data["entries"], list)
    assert data["me"] is None

    for entry in data["entries"]:
        assert "email" not in entry
        assert "rank" in entry
        assert "points" in entry
        assert "score_percentage" in entry
        assert "difficulty" in entry
        assert "correct_count" in entry
        assert "total_questions" in entry
