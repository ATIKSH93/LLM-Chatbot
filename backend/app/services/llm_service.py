"""Shared LiteLLM Router configuration."""
from litellm import Router

from app.core.config import settings

MODEL_GROUP = "lyftr-chat"


def build_model_list(only_key: str | None = None) -> list[dict]:
    return [
        {
            "model_name": MODEL_GROUP,
            "litellm_params": {
                "model": settings.LLM_MODEL,
                "api_key": api_key,
                "order": index + 1,
            },
            "model_info": {"id": f"key_{index + 1}"},
        }
        for index, api_key in enumerate(settings.api_keys)
        if only_key is None or only_key == f"key_{index + 1}"
    ]


def create_router(*, cache_responses: bool = True, num_retries: int = 1, only_key: str | None = None) -> Router:
    deployments = build_model_list(only_key)
    if not deployments:
        raise ValueError("No LLM API keys configured")
    return Router(
        model_list=deployments,
        num_retries=num_retries,
        cache_responses=cache_responses,
        routing_strategy="simple-shuffle",
        allowed_fails=1,
        cooldown_time=0,
    )


# One Router keeps LiteLLM's response cache and routing configuration shared.
router = create_router()
