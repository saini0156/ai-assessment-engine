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


def test_question_and_option_flipping():
    from app.services.llm_service import shuffle_question_options
    from app.models.schemas import InternalQuestion

    q = InternalQuestion(
        id="q_1",
        question="What is the capital of France?",
        options={
            "A": "Paris",
            "B": "London",
            "C": "Berlin",
            "D": "Rome"
        },
        correct_option="A",
        explanation="Option A is correct because Paris is France's capital.",
    )

    # Run multiple times to observe shuffling
    flipped_positions = set()
    for _ in range(25):
        shuffled = shuffle_question_options(q)
        # Verify 4 options exist
        assert set(shuffled.options.keys()) == {"A", "B", "C", "D"}
        # The option marked as correct MUST match the original correct text ("Paris")
        assert shuffled.options[shuffled.correct_option] == "Paris"
        # The explanation must reference the new correct option
        assert f"Option {shuffled.correct_option}" in shuffled.explanation
        flipped_positions.add(shuffled.correct_option)

    # Across 25 runs, "Paris" should have appeared at more than 1 position (randomized)
    assert len(flipped_positions) > 1


def test_unicode_font_artifact_sanitization():
    from app.services.llm_service import clean_math_text
    from app.services.pdf_service import pdf_service

    raw_corrupted = r"भच\u{00E2}ड (Zodiac Belt) में कुल कितने नक्षत्र (Nakshatra) होते हैं?"
    cleaned_q = clean_math_text(raw_corrupted)
    assert r"\u{00E2}" not in cleaned_q
    assert "भचक्र" in cleaned_q

    # Test PDF text sanitizer
    pdf_text = r"भच\u{00E2}ड में 27 नक्षत्र हैं और पृथ्वी 1° घुमने में 4 मिनट लेती है।"
    cleaned_pdf = pdf_service.sanitize_text(pdf_text)
    assert r"\u{00E2}" not in cleaned_pdf
    assert "भचक्र" in cleaned_pdf

    # Test spelling cleanup
    spelling_sample = "पृथ्वी को 1° घुमने में कितना समय लगता है?"
    cleaned_spelling = clean_math_text(spelling_sample)
    assert "घूमने" in cleaned_spelling


def test_prompt_template_formatting():
    """Ensure no unescaped curly braces exist in prompts that could break str.format()."""
    from app.prompts.templates import QUIZ_GENERATION_PROMPT, TOPIC_EXTRACTION_PROMPT, TUTOR_EXPLAIN_PROMPT
    # Formatting must not raise any KeyError
    formatted_quiz = QUIZ_GENERATION_PROMPT.format(
        count=5,
        subject="Astrology",
        topic="Nakshatra",
        difficulty="Medium",
        language_directive="",
        mode_directive="",
        context_block="",
        difficulty_directive="",
    )
    assert "Astrology" in formatted_quiz
    assert "{00E2}" not in formatted_quiz

    formatted_topic = TOPIC_EXTRACTION_PROMPT.format(
        subject="Astrology",
        language_directive="",
        text="Sample syllabus text",
    )
    assert "Astrology" in formatted_topic

    formatted_tutor = TUTOR_EXPLAIN_PROMPT.format(
        question="What is 1+1?",
        selected_option="A",
        correct_option="B",
        explanation="1+1=2",
        language_directive="",
    )
    assert "What is 1+1?" in formatted_tutor


def test_unique_quiz_generation_and_adapters():
    """Ensure topic parsing, generated question parsing, and quiz randomization work flawlessly."""
    from app.services.llm_service import parse_topics_data, _parse_generated
    from app.services.mock_data import MockAIEngine

    # Test 1: parse_topics_data with list and dict
    raw_list = [{"topic_id": "top_1", "topic_name": "Calculus", "start_page": 1, "end_page": 5, "subtopics": ["Limits"], "summary": "Intro"}]
    parsed_from_list = parse_topics_data(raw_list)
    assert len(parsed_from_list) == 1
    assert parsed_from_list[0].topic_name == "Calculus"

    raw_dict = {"topics": raw_list}
    parsed_from_dict = parse_topics_data(raw_dict)
    assert len(parsed_from_dict) == 1
    assert parsed_from_dict[0].topic_name == "Calculus"

    # Test 2: _parse_generated with list and dict
    raw_q_list = [{
        "question": "What is the capital of France?",
        "options": ["Paris", "Rome", "Berlin", "Madrid"],
        "correct_option": "A",
        "explanation": "Paris is the capital of France."
    }]
    parsed_qs = _parse_generated(raw_q_list)
    assert len(parsed_qs) == 1
    assert "Paris" in str(parsed_qs[0].options)

    # Test 3: Quiz generation randomizes across sessions
    session_1 = MockAIEngine.generate_quiz("Mathematics", "Calculus", 5, "Medium")
    session_2 = MockAIEngine.generate_quiz("Mathematics", "Calculus", 5, "Medium")
    assert session_1.quiz_session_id != session_2.quiz_session_id
    assert len(session_1.questions) == 5


