"""Async adapters for the supported LLM providers.

Data-driven registry: each provider declares its API style, base URL(s) and
selectable model variants; ``call_model`` dispatches on the config. The model
used for a call resolves as: explicit ``model`` argument >
``OPENTHINK_MODEL_<ID>`` env var > the provider's default.
"""

import os
from dataclasses import dataclass, field

import httpx

TIMEOUT_SECONDS = 120.0
_BODY_SNIPPET = 300


class ProviderError(Exception):
    """Raised when a provider call fails; message is short and user-readable."""


@dataclass(frozen=True)
class ProviderConfig:
    id: str
    display_name: str
    api_style: str  # "openai" | "anthropic" | "google"
    base_urls: list[str]  # tried in order; the next URL is used as fallback on HTTP 401
    default_model: str
    models: list[str]  # selectable variants; default_model must be models[0]
    extra_headers: dict[str, str] = field(default_factory=dict)


_CONFIGS = [
    ProviderConfig(
        id="openai", display_name="ChatGPT", api_style="openai",
        base_urls=["https://api.openai.com/v1/chat/completions"],
        default_model="gpt-5.6-luna",
        models=["gpt-5.6-luna", "gpt-5.6-terra", "gpt-5.6-sol", "gpt-5.4-mini"],
    ),
    ProviderConfig(
        id="anthropic", display_name="Claude", api_style="anthropic",
        base_urls=["https://api.anthropic.com/v1/messages"],
        default_model="claude-haiku-4-5",
        models=["claude-haiku-4-5", "claude-sonnet-5", "claude-opus-5", "claude-fable-5"],
    ),
    ProviderConfig(
        id="google", display_name="Gemini", api_style="google",
        base_urls=["https://generativelanguage.googleapis.com/v1beta/models"],
        default_model="gemini-3.5-flash-lite",
        models=["gemini-3.5-flash-lite", "gemini-3.6-flash", "gemini-3.7-flash", "gemini-3.1-pro-preview"],
    ),
    ProviderConfig(
        id="xai", display_name="Grok", api_style="openai",
        base_urls=["https://api.x.ai/v1/chat/completions"],
        default_model="grok-4.3",
        models=["grok-4.3", "grok-4.6", "grok-4.5", "grok-4.20-non-reasoning", "grok-build-0.1"],
    ),
    ProviderConfig(
        id="moonshot", display_name="Kimi", api_style="openai",
        # .cn is the mainland endpoint; fall back to the international .ai on 401.
        base_urls=[
            "https://api.moonshot.cn/v1/chat/completions",
            "https://api.moonshot.ai/v1/chat/completions",
        ],
        default_model="kimi-k2.6",
        models=["kimi-k2.6", "kimi-k3", "kimi-k2.7-code", "kimi-k2.7-code-highspeed"],
    ),
    ProviderConfig(
        id="zhipu", display_name="GLM", api_style="openai",
        base_urls=["https://open.bigmodel.cn/api/paas/v4/chat/completions"],
        default_model="glm-4.7-flash",
        models=["glm-4.7-flash", "glm-4.7", "glm-5.2", "glm-5.3-flash", "glm-5.3"],
    ),
    ProviderConfig(
        id="deepseek", display_name="DeepSeek", api_style="openai",
        base_urls=["https://api.deepseek.com/v1/chat/completions"],
        default_model="deepseek-v4-flash",
        models=["deepseek-v4-flash", "deepseek-v4-pro"],
    ),
    ProviderConfig(
        id="mistral", display_name="Mistral", api_style="openai",
        base_urls=["https://api.mistral.ai/v1/chat/completions"],
        default_model="mistral-small-latest",
        models=["mistral-small-latest", "mistral-medium-latest", "mistral-large-latest", "magistral-medium-latest"],
    ),
    ProviderConfig(
        id="groq", display_name="Groq", api_style="openai",
        base_urls=["https://api.groq.com/openai/v1/chat/completions"],
        default_model="openai/gpt-oss-20b",
        models=["openai/gpt-oss-20b", "openai/gpt-oss-120b", "qwen/qwen3.6-27b"],
    ),
    ProviderConfig(
        id="openrouter", display_name="OpenRouter", api_style="openai",
        base_urls=["https://openrouter.ai/api/v1/chat/completions"],
        default_model="openai/gpt-5-nano",
        models=[
            "openai/gpt-5-nano", "anthropic/claude-sonnet-5", "anthropic/claude-opus-5",
            "openai/gpt-5.6-terra", "google/gemini-3.1-pro-preview", "deepseek/deepseek-v4-pro",
        ],
        extra_headers={"HTTP-Referer": "https://github.com/openthink", "X-Title": "OpenThink"},
    ),
]

PROVIDERS: dict[str, ProviderConfig] = {c.id: c for c in _CONFIGS}
PROVIDER_IDS = list(PROVIDERS.keys())

# Human-facing names used in debate transcripts and prompts.
DISPLAY_NAMES: dict[str, str] = {pid: cfg.display_name for pid, cfg in PROVIDERS.items()}


def resolve_model(provider_id: str, model: str | None = None) -> str:
    """Model id to use for a call: explicit arg > OPENTHINK_MODEL_<ID> env > default."""
    cfg = PROVIDERS[provider_id]
    return model or os.environ.get(f"OPENTHINK_MODEL_{provider_id.upper()}") or cfg.default_model


def _snippet(body: str) -> str:
    body = body.strip().replace("\n", " ")
    return body[:_BODY_SNIPPET]


def _http_error(provider_id: str, exc: httpx.HTTPStatusError) -> ProviderError:
    status = exc.response.status_code
    try:
        body = exc.response.text
    except Exception:
        body = "<unreadable body>"
    return ProviderError(f"{provider_id} HTTP {status}: {_snippet(body)}")


async def _call_openai_compatible(
    client: httpx.AsyncClient,
    cfg: ProviderConfig,
    api_key: str,
    model: str,
    system_prompt: str,
    user_prompt: str,
) -> str:
    """Shared implementation for OpenAI-style /chat/completions APIs."""
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        **cfg.extra_headers,
    }
    last_error: ProviderError | None = None
    for url in cfg.base_urls:
        try:
            resp = await client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            last_error = _http_error(cfg.id, exc)
            if exc.response.status_code != 401:
                raise last_error from exc
            continue  # 401: try the fallback base URL (e.g. moonshot .cn -> .ai)
        except httpx.HTTPError as exc:
            raise ProviderError(f"{cfg.id} request failed: {exc}") from exc
        try:
            return resp.json()["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError, ValueError) as exc:
            raise ProviderError(f"{cfg.id}: unexpected response shape") from exc
    raise last_error or ProviderError(f"{cfg.id}: no base URL configured")


async def _call_anthropic(
    client: httpx.AsyncClient,
    cfg: ProviderConfig,
    api_key: str,
    model: str,
    system_prompt: str,
    user_prompt: str,
) -> str:
    payload = {
        "model": model,
        "system": system_prompt,
        "messages": [{"role": "user", "content": user_prompt}],
        "max_tokens": 2048,
    }
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
        **cfg.extra_headers,
    }
    last_error: ProviderError | None = None
    for url in cfg.base_urls:
        try:
            resp = await client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            last_error = _http_error(cfg.id, exc)
            if exc.response.status_code != 401:
                raise last_error from exc
            continue
        except httpx.HTTPError as exc:
            raise ProviderError(f"{cfg.id} request failed: {exc}") from exc
        try:
            parts = resp.json()["content"]
            return "".join(p.get("text", "") for p in parts if p.get("type") == "text")
        except (KeyError, TypeError, ValueError) as exc:
            raise ProviderError(f"{cfg.id}: unexpected response shape") from exc
    raise last_error or ProviderError(f"{cfg.id}: no base URL configured")


async def _call_google(
    client: httpx.AsyncClient,
    cfg: ProviderConfig,
    api_key: str,
    model: str,
    system_prompt: str,
    user_prompt: str,
) -> str:
    payload = {
        "system_instruction": {"parts": [{"text": system_prompt}]},
        "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
    }
    headers = {
        "x-goog-api-key": api_key,
        "Content-Type": "application/json",
        **cfg.extra_headers,
    }
    last_error: ProviderError | None = None
    for base in cfg.base_urls:
        try:
            resp = await client.post(f"{base}/{model}:generateContent", headers=headers, json=payload)
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            last_error = _http_error(cfg.id, exc)
            if exc.response.status_code != 401:
                raise last_error from exc
            continue
        except httpx.HTTPError as exc:
            raise ProviderError(f"{cfg.id} request failed: {exc}") from exc
        try:
            parts = resp.json()["candidates"][0]["content"]["parts"]
            return "".join(p.get("text", "") for p in parts)
        except (KeyError, IndexError, TypeError, ValueError) as exc:
            raise ProviderError(f"{cfg.id}: unexpected response shape") from exc
    raise last_error or ProviderError(f"{cfg.id}: no base URL configured")


_DISPATCH = {
    "openai": _call_openai_compatible,
    "anthropic": _call_anthropic,
    "google": _call_google,
}


async def call_model(
    provider_id: str,
    api_key: str,
    system_prompt: str,
    user_prompt: str,
    model: str | None = None,
    client: httpx.AsyncClient | None = None,
) -> str:
    """Call one provider and return the model's text. Raises ProviderError on failure.

    ``client`` may be a shared AsyncClient (e.g. one per debate request); when
    omitted, a short-lived client is created for this single call.
    """
    cfg = PROVIDERS.get(provider_id)
    if cfg is None:
        raise ProviderError(f"unknown provider: {provider_id}")
    resolved = resolve_model(provider_id, model)
    if client is not None:
        return await _DISPATCH[cfg.api_style](client, cfg, api_key, resolved, system_prompt, user_prompt)
    async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as own_client:
        return await _DISPATCH[cfg.api_style](own_client, cfg, api_key, resolved, system_prompt, user_prompt)
