import os
import json
import pytest
from app.services.feedback_service import FeedbackService, BACKUP_FILE
from app.services.db_service import db_service
from app.models.feedback import Feedback


def test_feedback_service_save_and_retrieve(db):
    service = FeedbackService()
    quiz_session_id = "test-session-123"
    payload = {
        "question_id": "q_1",
        "review_text": "Option C translation has a typo",
        "user_id": "user-abc-456",
    }

    fb_id = service.save_feedback(quiz_session_id, payload)
    assert fb_id is not None
    assert len(fb_id) > 10

    # Retrieve via service
    results = service.list_feedback(quiz_session_id)
    assert len(results) >= 1
    found = any(r["id"] == fb_id and r["question_id"] == "q_1" for r in results)
    assert found is True

    # Check that disk backup was also created
    assert os.path.exists(BACKUP_FILE)
    with open(BACKUP_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
        assert any(r["id"] == fb_id for r in data)


def test_db_service_feedback_methods(db):
    quiz_session_id = "test-session-db-999"
    record = {
        "id": "custom-uuid-test",
        "quiz_session_id": quiz_session_id,
        "question_id": "q_5",
        "review_text": "Formula exponent formatting is wrong",
        "user_id": "admin-1",
    }

    # Insert into DB
    db_service.insert_feedback(record)

    # Fetch by quiz
    records = db_service.fetch_feedback_by_quiz(quiz_session_id)
    assert len(records) >= 1
    assert records[0]["question_id"] == "q_5"
    assert records[0]["review_text"] == "Formula exponent formatting is wrong"

    # Fetch all (Admin)
    all_fb = db_service.get_all_feedback(limit=50)
    assert len(all_fb) >= 1
    assert any(fb["id"] == "custom-uuid-test" for fb in all_fb)
