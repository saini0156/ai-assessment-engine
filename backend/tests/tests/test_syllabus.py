import io
import pytest


def test_upload_syllabus_success(client):
    """Test valid syllabus upload returns 200 with extracted topics."""
    file_content = b"Unit 1: Classical Mechanics\nNewton's Laws of Motion\nUnit 2: Thermodynamics\nHeat and Temperature"
    files = {
        "file": ("syllabus.txt", io.BytesIO(file_content), "text/plain")
    }
    data = {
        "subject": "Physics"
    }

    res = client.post("/api/v1/syllabus/upload-pdf", data=data, files=files)
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "success"
    assert body["subject"] == "Physics"
    assert len(body["extracted_topics"]) > 0


def test_upload_syllabus_file_too_large(client):
    """Test file larger than 10MB returns 413 Request Entity Too Large."""
    # 10MB + 1024 bytes
    oversized_content = b"0" * (10 * 1024 * 1024 + 1024)
    files = {
        "file": ("large_syllabus.txt", io.BytesIO(oversized_content), "text/plain")
    }
    data = {
        "subject": "Mathematics"
    }

    res = client.post("/api/v1/syllabus/upload-pdf", data=data, files=files)
    assert res.status_code == 413
    assert "File too large" in res.json()["detail"]


def test_upload_syllabus_invalid_extension(client):
    """Test uploading unsupported file format returns 400 Bad Request."""
    files = {
        "file": ("malicious.exe", io.BytesIO(b"binary"), "application/octet-stream")
    }
    data = {
        "subject": "Computer Science"
    }

    res = client.post("/api/v1/syllabus/upload-pdf", data=data, files=files)
    assert res.status_code == 400
    assert "Only PDF and text files are supported" in res.json()["detail"]


def test_get_subjects_endpoint(client):
    """Test Screen 2 endpoint GET /api/v1/syllabus/subjects returns list."""
    res = client.get("/api/v1/syllabus/subjects")
    assert res.status_code == 200
    assert isinstance(res.json(), list)
