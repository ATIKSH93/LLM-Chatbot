
from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app
from app.db.database import SessionLocal
from app.repositories.message_repository import MessageRepository


client = TestClient(app)


def test_session_history():

    session_id = f"test_{uuid4().hex}"

    db = SessionLocal()

    try:
        MessageRepository.create_message(
            db,
            session_id,
            "user",
            "Hello",
        )

        MessageRepository.create_message(
            db,
            session_id,
            "assistant",
            "Hi there!",
            {"resolution_source": "LIVE_INFERENCE"},
        )

    finally:
        db.close()

    response = client.get(
        f"/sessions/{session_id}/messages"
    )

    assert response.status_code == 200

    data = response.json()

    assert data["session_id"] == session_id
    assert len(data["messages"]) == 2
    assert data["messages"][0]["role"] == "user"
    assert data["messages"][1]["role"] == "assistant"

    assert (
        data["messages"][1]["metadata"]["resolution_source"]
        == "LIVE_INFERENCE"
    )


def test_unknown_session():

    session_id = f"unknown_{uuid4().hex}"

    response = client.get(
        f"/sessions/{session_id}/messages"
    )

    assert response.status_code == 404

    assert response.json() == {
        "detail": "session not found"
    }
