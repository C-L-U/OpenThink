"""Pydantic request models for the OpenThink API."""

from typing import Literal, get_args

from pydantic import BaseModel, Field, ValidationInfo, field_validator

from .providers import PROVIDERS

# Provider ids the frontend may select. Keep in sync with providers.PROVIDER_IDS.
ModelId = Literal[
    "openai", "anthropic", "google", "xai", "moonshot", "zhipu",
    "deepseek", "mistral", "groq", "openrouter",
]
_VALID_IDS = set(get_args(ModelId))


class Participant(BaseModel):
    """One debate participant: a provider plus one of its model variants.

    Several participants may share the same provider with different models
    (e.g. grok-4.5 vs grok-4.6) — the API key is shared per provider.
    """

    provider: ModelId
    model: str | None = Field(
        default=None,
        max_length=200,
        description="Model variant id; null/absent means the provider's default model.",
    )

    @field_validator("model")
    @classmethod
    def _check_model(cls, v: str | None, info: ValidationInfo) -> str | None:
        # If "provider" itself failed validation it won't be in info.data;
        # skip the cross-check and let the provider error produce the 422.
        provider = info.data.get("provider")
        if v and provider is not None and v not in PROVIDERS[provider].models:
            raise ValueError(f"unknown model for {provider}: {v}")
        return v


class DebateRequest(BaseModel):
    """Body of POST /api/debate."""

    query: str = Field(min_length=1, max_length=32000, description="The subjective question to debate.")
    participants: list[Participant] = Field(
        min_length=1,
        max_length=16,
        description="Debate participants (provider + model). Identical pairs are deduplicated.",
    )


class ValidateRequest(BaseModel):
    """Body of POST /api/validate."""

    provider: ModelId = Field(description="The provider whose API key to validate.")
    model: str | None = Field(
        default=None,
        max_length=200,
        description="Optional model id to use for the test call.",
    )

    @field_validator("model")
    @classmethod
    def _check_model(cls, v: str | None, info: ValidationInfo) -> str | None:
        provider = info.data.get("provider")
        if v and provider is not None and v not in PROVIDERS[provider].models:
            raise ValueError(f"unknown model for {provider}: {v}")
        return v
