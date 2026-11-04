"""
End-to-End Automated Test for Nitish's AI Assessment Backend.
Tests all 4 API contract endpoints using FastAPI TestClient.
"""
import io
import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_full_pipeline():
    print("=" * 60)
    print("RUNNING END-TO-END PIPELINE TESTS")
    print("=" * 60)

    # 1. Root & Health Check
    print("\n[Step 1] Checking Root & Health Endpoints...")
    res = client.get("/")
    assert res.status_code == 200, f"Root check failed: {res.text}"
    print(f"  -> SUCCESS: Status {res.json()['status']}, Provider: {res.json()['active_provider']}")

    # 2. Syllabus Upload Endpoint
    print("\n[Step 2] Testing Syllabus Upload (POST /api/v1/syllabus/upload-pdf)...")
    sample_syllabus_text = b"Course: Computer Science\nChapter 1: Object-Oriented Programming\nTopics: Encapsulation, Inheritance, Polymorphism."
    files = {
        "file": ("syllabus.txt", io.BytesIO(sample_syllabus_text), "text/plain")
    }
    data = {"subject": "Computer Science"}
    res = client.post("/api/v1/syllabus/upload-pdf", data=data, files=files)
    assert res.status_code == 200, f"Upload failed: {res.text}"
    syllabus_res = res.json()
    assert syllabus_res["status"] == "success"
    assert len(syllabus_res["extracted_topics"]) > 0
    print(f"  -> SUCCESS: Extracted {len(syllabus_res['extracted_topics'])} topics.")
    first_topic = syllabus_res["extracted_topics"][0]["topic_name"]
    print(f"  -> Sample Topic: {first_topic}")

    # 3. Quiz Generation Endpoint (Zero-Leak Test)
    print("\n[Step 3] Testing Quiz Generation (POST /api/v1/quiz/generate)...")
    gen_payload = {
        "subject": "Computer Science",
        "topic": first_topic,
        "count": 3,
        "difficulty": "Medium"
    }
    res = client.post("/api/v1/quiz/generate", json=gen_payload)
    assert res.status_code == 200, f"Quiz generation failed: {res.text}"
    quiz_data = res.json()
    session_id = quiz_data["quiz_session_id"]
    questions = quiz_data["questions"]
    assert len(questions) == 3
    print(f"  -> SUCCESS: Generated {len(questions)} questions. Session ID: {session_id}")

    # Zero-Leak Security Verification
    for q in questions:
        assert "correct_option" not in q, "SECURITY LEAK: 'correct_option' was exposed to student!"
        assert "explanation" not in q, "SECURITY LEAK: 'explanation' was exposed to student!"
        assert set(q["options"].keys()) == {"A", "B", "C", "D"}, "Question must have options A, B, C, D"
    print("  -> ZERO-LEAK SECURITY VERIFIED: No answers or explanations exposed to client!")

    # 4. Quiz Submission & Scoring Endpoint
    print("\n[Step 4] Testing Quiz Submission & Grading (POST /api/v1/quiz/submit)...")
    # Provide answers: let's pick "B" for q_1
    submit_payload = {
        "quiz_session_id": session_id,
        "answers": {
            questions[0]["id"]: "B",
            questions[1]["id"]: "A"
        }
    }
    res = client.post("/api/v1/quiz/submit", json=submit_payload)
    assert res.status_code == 200, f"Quiz submit failed: {res.text}"
    score_data = res.json()
    print(f"  -> SUCCESS: Graded! Score: {score_data['score_percentage']}% ({score_data['correct_count']}/{score_data['total_questions']} correct)")
    print(f"  -> AI Feedback: \"{score_data['ai_feedback']}\"")
    
    first_review = score_data["reviews"][0]
    print(f"  -> Review Released Explanation: {first_review['explanation']}")

    # 5. AI Tutor: Explain My Mistake Endpoint
    print("\n[Step 5] Testing AI Tutor (POST /api/v1/tutor/explain)...")
    tutor_payload = {
        "question": first_review["question"],
        "selected_option": "A",
        "correct_option": first_review["correct_option"],
        "explanation": first_review["explanation"]
    }
    res = client.post("/api/v1/tutor/explain", json=tutor_payload)
    assert res.status_code == 200, f"Tutor failed: {res.text}"
    tutor_data = res.json()
    assert "simplified_explanation" in tutor_data
    assert "memory_tip" in tutor_data
    assert "real_world_example" in tutor_data
    print(f"  -> SUCCESS: AI Tutor response generated:")
    print(f"     * Simplified: {tutor_data['simplified_explanation'][:70]}...")
    print(f"     * Memory Tip: {tutor_data['memory_tip']}")
    print(f"     * Analogy:    {tutor_data['real_world_example'][:70]}...")

    print("\n" + "=" * 60)
    print("ALL 4 API CONTRACT ENDPOINTS PASSED WITH 100% SUCCESS!")
    print("=" * 60)

if __name__ == "__main__":
    test_full_pipeline()
