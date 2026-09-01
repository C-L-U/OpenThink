"""HTTP-level integration tests for the OpenThink API.

Uses FastAPI's TestClient with the provider layer mocked out — no network,
no API keys. Run from backend/ with:

    python -m unittest discover tests -v
"""

import json
import unittest
from unittest import mock

from fastapi.testclient import TestClient

from app import main, prompts
from app.main import app
from app.providers import PROVIDERS


def answer(position):
    return f"Some reasoning.\nFINAL POSITION: {position}"


def make_fake(answers):
    """answers: {"provider:model": [answers by round]} — see test_debate.py."""

    round_counters = {}

    async def fake(provider_id, api_key, system_prompt, user_prompt, model=None, client=None):
        if system_prompt in (prompts.INITIAL_SYSTEM, prompts.DEBATE_SYSTEM):
            pid = f"{provider_id}:{model}"
            idx = round_counters.get(pid, 0)
            round_counters[pid] = idx + 1
            return answers[pid][idx]
        if system_prompt == prompts.JUDGE_SYSTEM:
            return "VERDICT: NO\nREASON: They differ."
        if system_prompt == prompts.SYNTHESIS_SYSTEM:
            return "UNIFIED ANSWER"
        if system_prompt == prompts.MODERATOR_SYSTEM:
            return "MODERATED ANSWER"
        raise AssertionError(f"unexpected system prompt: {system_prompt!r}")

    return fake


def stream_events(client: TestClient, payload: dict, headers: dict[str, str] | None = None):
    """POST /api/debate and collect the parsed SSE event dicts."""
    events = []
    with client.stream("POST", "/api/debate", json=payload, headers=headers or {}) as response:
        assert response.status_code == 200, response.text
        assert response.headers["content-type"].startswith("text/event-stream")
        for line in response.iter_lines():
            if line.startswith("data:"):
                events.append(json.loads(line[5:]))
    return events


class ApiTests(unittest.TestCase):
    def setUp(self):
        # The rate limiter keeps in-memory state across tests in this process.
        main._rate_hits.clear()
        self.client = TestClient(app)

    def test_health(self):
        r = self.client.get("/api/health")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json(), {"status": "ok"})

    def test_providers_registry(self):
        r = self.client.get("/api/providers")
        self.assertEqual(r.status_code, 200)
        providers = r.json()["providers"]
        self.assertEqual(len(providers), 10)
        for p in providers:
            self.assertEqual(p["default_model"], p["models"][0])
            self.assertIn(p["id"], PROVIDERS)

    def test_validate_without_key(self):
        r = self.client.post("/api/validate", json={"provider": "openai"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json(), {"ok": False, "error": "missing API key"})

    def test_validate_rejects_unknown_model(self):
        r = self.client.post(
            "/api/validate",
            json={"provider": "openai", "model": "gpt-4o"},  # retired, not in registry
            headers={"x-api-key-openai": "k"},
        )
        self.assertEqual(r.status_code, 422)

    def test_debate_full_flow_over_http(self):
        """Two participants converge in round 1 (identical positions -> fast path)."""
        same = answer("Monitor X is the best.")
        fake = make_fake({
            f"openai:{PROVIDERS['openai'].default_model}": [same],
            f"anthropic:{PROVIDERS['anthropic'].default_model}": [same],
        })
        with mock.patch.object(main, "run_debate", wraps=main.run_debate), \
             mock.patch("app.debate.call_model", new=fake):
            events = stream_events(
                self.client,
                {"query": "Best monitor?", "participants": [{"provider": "openai"}, {"provider": "anthropic"}]},
                {"x-api-key-openai": "k1", "x-api-key-anthropic": "k2"},
            )
        types = [e["type"] for e in events]
        self.assertEqual(
            types,
            ["round_start", "model_response", "model_response", "evaluation", "consensus", "done"],
        )
        self.assertTrue(events[-2]["converged"])
        self.assertEqual(events[-2]["content"], "UNIFIED ANSWER")

    def test_debate_two_models_same_provider(self):
        """grok-4.5 vs grok-4.6 over HTTP with ONE shared x-ai key header."""
        fake = make_fake({
            "xai:grok-4.5": [answer("A is best."), answer("A is best.")],
            "xai:grok-4.6": [answer("B is best."), answer("A is best.",)],
        })
        with mock.patch("app.debate.call_model", new=fake):
            events = stream_events(
                self.client,
                {
                    "query": "A or B?",
                    "participants": [
                        {"provider": "xai", "model": "grok-4.5"},
                        {"provider": "xai", "model": "grok-4.6"},
                    ],
                },
                {"x-api-key-xai": "shared-key"},
            )
        r1 = [e["model"] for e in events if e["type"] == "model_response" and e["round"] == 1]
        self.assertEqual(r1, ["xai:grok-4.5", "xai:grok-4.6"])
        self.assertTrue(events[-2]["converged"])
        self.assertEqual(events[-2]["rounds_used"], 2)

    def test_debate_missing_keys_reports_per_participant(self):
        fake = make_fake({f"openai:{PROVIDERS['openai'].default_model}": [answer("Only one.")]})
        with mock.patch("app.debate.call_model", new=fake):
            events = stream_events(
                self.client,
                {"query": "q", "participants": [{"provider": "openai"}, {"provider": "google"}]},
                {"x-api-key-openai": "k1"},  # no google key
            )
        errors = [e for e in events if e["type"] == "model_error"]
        self.assertEqual(len(errors), 1)
        self.assertEqual(errors[0]["model"], f"google:{PROVIDERS['google'].default_model}")
        self.assertEqual(errors[0]["error"], "missing API key")
        # Single survivor short-circuits to consensus.
        self.assertEqual(events[-2]["type"], "consensus")
        self.assertTrue(events[-2]["converged"])

    def test_debate_rejects_dead_model(self):
        r = self.client.post(
            "/api/debate",
            json={"query": "q", "participants": [{"provider": "xai", "model": "grok-3"}]},
        )
        self.assertEqual(r.status_code, 422)

    def test_zz_rate_limit(self):
        """11th debate within a minute is rejected with 429. (zz: runs last.)"""
        for i in range(10):
            r = self.client.post("/api/debate", json={"query": "q", "participants": [{"provider": "openai"}]})
            self.assertEqual(r.status_code, 200, f"request {i + 1} should pass")
        r = self.client.post("/api/debate", json={"query": "q", "participants": [{"provider": "openai"}]})
        self.assertEqual(r.status_code, 429)


if __name__ == "__main__":
    unittest.main()
