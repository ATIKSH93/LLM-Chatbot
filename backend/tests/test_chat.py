from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.api import health
from app.db.database import SessionLocal
from app.main import app
from app.repositories.message_repository import MessageRepository
from app.services import chat_service

client = TestClient(app)


def fake_response(text="answer", key="key_1", cache_hit=False):
    return SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content=text))],
        model="openai/gpt-oss-120b",
        usage=SimpleNamespace(prompt_tokens=12, completion_tokens=3),
        _hidden_params={"model_id": key, "cache_hit": cache_hit},
    )


def test_chat_persists_complete_turn_and_metadata(monkeypatch):
    monkeypatch.setattr(chat_service.router, "completion", lambda **kwargs: fake_response())
    session = f"test-{uuid4().hex}"
    response = client.post("/chat", json={"session_id": session, "message": "hello"})
    assert response.status_code == 200
    assert response.json()["metadata"]["input_tokens"] == 12
    history = client.get(f"/sessions/{session}/messages").json()["messages"]
    assert [item["role"] for item in history] == ["user", "assistant"]


@pytest.mark.parametrize("header", ["key_1=429", "key_1=500"])
def test_simulation_fails_over_to_second_key(monkeypatch, header):
    monkeypatch.setattr(chat_service, "create_router", lambda **kwargs: SimpleNamespace(completion=lambda **call: fake_response(key="key_2")))
    response = client.post("/chat", json={"session_id": f"test-{uuid4().hex}", "message": "hello"}, headers={"X-Simulate-Failure": header})
    assert response.status_code == 200
    assert response.json()["metadata"]["key_id"] == "key_2"
    assert response.json()["metadata"]["fallback_attempts"] == 1


@pytest.mark.parametrize("header", ["*=429", "key_1=429,key_2=500"])
def test_all_simulated_keys_failing_are_not_persisted(header):
    session = f"test-{uuid4().hex}"
    response = client.post("/chat", json={"session_id": session, "message": "hello"}, headers={"X-Simulate-Failure": header})
    assert response.status_code == 503
    assert client.get(f"/sessions/{session}/messages").status_code == 404


def test_bad_simulation_header_is_rejected():
    response = client.post("/chat", json={"session_id": "x", "message": "hello"}, headers={"X-Simulate-Failure": "key_1=418"})
    assert response.status_code == 400
    assert "detail" in response.json()


def test_simulation_header_is_rejected_when_feature_disabled(monkeypatch):
    monkeypatch.setattr(chat_service.settings, "ENABLE_FAILURE_SIMULATION", False)
    response = client.post("/chat", json={"session_id": "disabled", "message": "hello"}, headers={"X-Simulate-Failure": "key_1=429"})
    assert response.status_code == 400
    assert response.json()["detail"] == "failure simulation is disabled"


@pytest.mark.parametrize("payload", [
    {"session_id": "  ", "message": "hello"},
    {"session_id": "valid", "message": "  "},
    {"session_id": "valid", "message": "x" * 4001},
])
def test_invalid_chat_input_is_not_persisted(payload):
    response = client.post("/chat", json=payload)
    assert response.status_code == 422
    assert "detail" in response.json()


def test_cache_hit_metadata_and_prompt_context(monkeypatch):
    observed = {}
    def completion(**kwargs):
        observed["messages"] = kwargs["messages"]
        return fake_response(cache_hit=True)
    monkeypatch.setattr(chat_service.router, "completion", completion)
    session = f"test-{uuid4().hex}"
    db = SessionLocal()
    try:
        MessageRepository.create_turn(db, session, "prior", "reply", {"model": "x"})
    finally:
        db.close()
    response = client.post("/chat", json={"session_id": session, "message": "next"})
    metadata = response.json()["metadata"]
    assert observed["messages"][-2]["content"] == "reply"
    assert metadata["resolution_source"] == "LLM_CACHE"
    assert metadata["key_id"] is None
    assert metadata["fallback_attempts"] == 0


def test_health_advertises_litellm_cache():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["cache_enabled"] is True
