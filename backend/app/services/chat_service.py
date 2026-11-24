import logging
import time

from fastapi import HTTPException
from litellm.exceptions import APIError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.repositories.message_repository import MessageRepository
from app.schemas.session import ChatRequest
from app.services.llm_service import MODEL_GROUP, create_router, router

logger = logging.getLogger(__name__)
DEFAULT_SYSTEM_PROMPT = "You are a helpful AI assistant. Answer clearly, accurately, and concisely."
ALLOWED_FAILURE_STATUSES = {429, 500, 502, 503}


def parse_simulated_failures(value: str | None) -> dict[str, int]:
    if not value:
        return {}
    if not settings.ENABLE_FAILURE_SIMULATION:
        raise HTTPException(status_code=400, detail="failure simulation is disabled")
    failures: dict[str, int] = {}
    try:
        for item in value.split(","):
            key, code = (part.strip() for part in item.split("=", 1))
            status = int(code)
            if key != "*" and not key.startswith("key_"):
                raise ValueError
            if key != "*" and (not key[4:].isdigit() or int(key[4:]) < 1 or int(key[4:]) > len(settings.api_keys)):
                raise ValueError
            if status not in ALLOWED_FAILURE_STATUSES or key in failures:
                raise ValueError
            failures[key] = status
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="invalid X-Simulate-Failure header") from None
    return failures


def _eligible_provider_error(exc: Exception) -> bool:
    status = getattr(exc, "status_code", None)
    if status in ALLOWED_FAILURE_STATUSES:
        return True
    return type(exc).__name__ in {"RateLimitError", "ServiceUnavailableError", "InternalServerError", "QuotaExceededError"}


def _call_with_simulation(messages: list[dict], failures: dict[str, int]):
    """Run request-scoped deployment attempts; simulated failures are real LiteLLM errors."""
    from litellm.exceptions import RateLimitError, InternalServerError, ServiceUnavailableError

    responses = []
    attempts = 0
    for index in range(len(settings.api_keys)):
        key_id = f"key_{index + 1}"
        status = failures.get("*", failures.get(key_id))
        if status:
            attempts += 1
            error_type = RateLimitError if status == 429 else (ServiceUnavailableError if status == 503 else InternalServerError)
            # A raised provider exception enters exactly the same retry/failover loop.
            try:
                raise error_type(message=f"simulated provider HTTP {status}", llm_provider="groq", model=settings.LLM_MODEL)
            except Exception as exc:
                if not _eligible_provider_error(exc):
                    raise
            continue
        isolated = create_router(cache_responses=False, num_retries=0, only_key=key_id)
        try:
            response = isolated.completion(model=MODEL_GROUP, messages=messages, max_tokens=1024, cache={"no-cache": True, "no-store": True})
            # Isolated router maps this request's only enabled deployment to its ID.
            response._hidden_params["model_id"] = key_id
            return response, attempts
        except Exception as exc:
            if not _eligible_provider_error(exc):
                raise
            attempts += 1
    return None, attempts


def process_chat(db: Session, request: ChatRequest, simulate_failure: str | None = None) -> dict:
    history = MessageRepository.get_session_messages(db, request.session_id)
    messages = [{"role": "system", "content": request.system_prompt or DEFAULT_SYSTEM_PROMPT}]
    messages.extend({"role": item.role, "content": item.content} for item in history)
    messages.append({"role": "user", "content": request.message})
    failures = parse_simulated_failures(simulate_failure)
    started = time.perf_counter()
    try:
        if failures:
            response, fallback_attempts = _call_with_simulation(messages, failures)
            if response is None:
                raise HTTPException(status_code=503, detail="all providers unavailable")
            cache_hit = False
        else:
            response = router.completion(model=MODEL_GROUP, messages=messages, max_tokens=1024, cache={})
            hidden = getattr(response, "_hidden_params", {}) or {}
            cache_hit = hidden.get("cache_hit") is True
            headers = hidden.get("additional_headers", {}) or {}
            try:
                fallback_attempts = int(headers.get("x-litellm-attempted-fallbacks", 0))
            except (TypeError, ValueError):
                fallback_attempts = 0
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("LLM request failed")
        if _eligible_provider_error(exc):
            raise HTTPException(status_code=503, detail="all providers unavailable") from None
        raise HTTPException(status_code=500, detail="internal server error") from None

    latency_ms = int((time.perf_counter() - started) * 1000)
    reply = response.choices[0].message.content
    if not reply or not reply.strip():
        raise HTTPException(status_code=503, detail="all providers unavailable")
    hidden = getattr(response, "_hidden_params", {}) or {}
    usage = response.usage
    metadata = {
        "resolution_source": "LLM_CACHE" if cache_hit else "LIVE_INFERENCE",
        "model": response.model,
        "latency_ms": latency_ms,
        "input_tokens": int(usage.prompt_tokens or 0) if usage else 0,
        "output_tokens": int(usage.completion_tokens or 0) if usage else 0,
        "key_id": None if cache_hit else hidden.get("model_id"),
        "fallback_attempts": 0 if cache_hit else fallback_attempts,
    }
    MessageRepository.create_turn(db, request.session_id, request.message, reply, metadata)
    return {"session_id": request.session_id, "reply": reply, "metadata": metadata}
