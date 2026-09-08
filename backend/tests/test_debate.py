"""End-to-end tests for the debate engine with a mocked provider layer.

Run from the backend/ directory with the project venv:

    python -m unittest discover tests -v

No API keys or network access are needed: ``debate.call_model`` is replaced
with a scripted fake that dispatches on the system prompt it receives.
"""

import json
import unittest
from unittest import mock

from app import debate, prompts
from app.providers import PROVIDERS


def pid_of(provider: str, model: str | None = None) -> str:
    """Participant id for a provider + model (default model when omitted)."""
    return f"{provider}:{model or PROVIDERS[provider].default_model}"


def make_fake(answers, judge_reply="VERDICT: NO\nREASON: They recommend different options."):
    """Build a fake call_model.

    ``answers``: {participant_id: [round1_answer, round2_answer, ...]} — the Nth
    initial/debate call for a participant returns the Nth scripted answer.
    Returns (fake_call_model, calls) where ``calls`` records every invocation
    as (provider, model, system_prompt, user_prompt).
    """
    calls = []
    round_counters = {}

    async def fake_call_model(provider_id, api_key, system_prompt, user_prompt, model=None, client=None):
        calls.append((provider_id, model, system_prompt, user_prompt))
        if system_prompt in (prompts.INITIAL_SYSTEM, prompts.DEBATE_SYSTEM):
            pid = pid_of(provider_id, model)
            idx = round_counters.get(pid, 0)
            round_counters[pid] = idx + 1
            return answers[pid][idx]
        if system_prompt == prompts.JUDGE_SYSTEM:
            return judge_reply
        if system_prompt in (prompts.SYNTHESIS_SYSTEM, prompts.CHAD_SYNTHESIS_SYSTEM):
            return "SYNTHESIZED ANSWER"
        if system_prompt in (prompts.MODERATOR_SYSTEM, prompts.CHAD_MODERATOR_SYSTEM):
            return "MODERATED COMPROMISE"
        raise AssertionError(f"unexpected system prompt: {system_prompt!r}")

    return fake_call_model, calls


async def collect(query, participants, keys, chad=False):
    """Run a debate to completion and return the parsed event dicts."""
    events = []
    async for frame in debate.run_debate(query, participants, keys, chad=chad):
        events.append(json.loads(frame.removeprefix("data:")))
    return events


def answer(position, body="Some reasoning.", stance=None):
    """Build a model answer following the FINAL POSITION (+ STANCE) contract."""
    parts = []
    if stance:
        parts.append(f"STANCE: {stance}")
    parts.append(body)
    parts.append(f"FINAL POSITION: {position}")
    return "\n".join(parts)


def default_participants(*providers: str) -> list[tuple[str, str]]:
    return [(p, PROVIDERS[p].default_model) for p in providers]


class DebateEngineTests(unittest.IsolatedAsyncioTestCase):
    async def run_with(self, answers, models=("openai", "anthropic"), judge_reply="VERDICT: NO\nREASON: They differ."):
        fake, calls = make_fake(answers, judge_reply)
        keys = {m: "fake-key" for m in models}
        with mock.patch.object(debate, "call_model", new=fake):
            events = await collect("Best monitor?", default_participants(*models), keys)
        return events, calls

    def types(self, events):
        return [e["type"] for e in events]

    async def test_fast_path_consensus_needs_no_judge(self):
        """Identical FINAL POSITIONs converge without any judge call."""
        same = answer("The Dell U3425WE is the best 34-inch curved monitor.")
        events, calls = await self.run_with({pid_of("openai"): [same], pid_of("anthropic"): [same]})

        self.assertEqual(
            self.types(events),
            ["round_start", "model_response", "model_response", "evaluation", "consensus", "done"],
        )
        evaluation = events[3]
        self.assertTrue(evaluation["consensus"])
        self.assertNotIn("judge", evaluation)  # fast path: no judge involved
        consensus = events[4]
        self.assertTrue(consensus["converged"])
        self.assertEqual(consensus["rounds_used"], 1)
        self.assertEqual(consensus["content"], "SYNTHESIZED ANSWER")
        # 2 answers + 1 synthesis; crucially, no judge call was made.
        self.assertEqual(len(calls), 3)
        self.assertNotIn(prompts.JUDGE_SYSTEM, [s for _, _, s, _u in calls])

    async def test_debate_round_converges_with_stance(self):
        """Round 1 disagrees (judge NO); round 2 converges via fast path, with STANCE lines."""
        answers = {
            pid_of("openai"): [
                answer("Monitor X is the best choice."),
                answer("Monitor X is the best choice.", stance="MAINTAINED"),
            ],
            pid_of("anthropic"): [
                answer("Monitor Y is the best choice."),
                answer("Monitor X is the best choice.", stance="CONCEDED to ChatGPT"),
            ],
        }
        events, calls = await self.run_with(answers)

        self.assertEqual(
            self.types(events),
            [
                "round_start", "model_response", "model_response", "evaluation",
                "round_start", "model_response", "model_response", "evaluation",
                "consensus", "done",
            ],
        )
        r1_eval, r2_eval = events[3], events[7]
        self.assertFalse(r1_eval["consensus"])
        self.assertEqual(r1_eval["judge"], pid_of("openai"))  # round 1 judge = active[0]
        self.assertTrue(r2_eval["consensus"])
        self.assertNotIn("judge", r2_eval)  # round 2 decided by the fast path
        stances = [e.get("stance") for e in events if e["type"] == "model_response" and e["round"] == 2]
        self.assertEqual(stances, ["MAINTAINED", "CONCEDED to ChatGPT"])
        self.assertEqual(events[8]["rounds_used"], 2)

    async def test_same_provider_two_models_both_debate(self):
        """grok-4.5 vs grok-4.6: two participants, one provider, one shared key."""
        participants = [("xai", "grok-4.5"), ("xai", "grok-4.6")]
        answers = {
            "xai:grok-4.5": [answer("Option A is best."), answer("Option A is best.", stance="MAINTAINED")],
            "xai:grok-4.6": [answer("Option B is best."), answer("Option A is best.", stance="CONCEDED to xAI (grok-4.5)")],
        }
        fake, calls = make_fake(answers)
        with mock.patch.object(debate, "call_model", new=fake):
            events = await collect("Q?", participants, {"xai": "one-shared-key"})

        responders = [e["model"] for e in events if e["type"] == "model_response" and e["round"] == 1]
        self.assertEqual(responders, ["xai:grok-4.5", "xai:grok-4.6"])
        # Each participant was called with its own model variant.
        round_calls = [(p, m) for p, m, s, _u in calls if s == prompts.INITIAL_SYSTEM]
        self.assertEqual(round_calls, [("xai", "grok-4.5"), ("xai", "grok-4.6")])
        # Converged in round 2 after the concession.
        consensus = events[-2]
        self.assertTrue(consensus["converged"])
        self.assertEqual(consensus["rounds_used"], 2)

    async def test_duplicate_pair_is_deduplicated(self):
        """Selecting the exact same (provider, model) twice collapses to one participant."""
        same = answer("The only sane answer.")
        fake, calls = make_fake({pid_of("openai"): [same]})
        participants = [("openai", PROVIDERS["openai"].default_model)] * 2
        with mock.patch.object(debate, "call_model", new=fake):
            events = await collect("Q?", participants, {"openai": "k"})
        responders = [e for e in events if e["type"] == "model_response"]
        self.assertEqual(len(responders), 1)  # single survivor -> immediate consensus
        self.assertEqual(events[-2]["type"], "consensus")

    async def test_stall_detection_jumps_to_moderator(self):
        """Unchanged disagreeing positions skip round 3 and go to the moderator."""
        answers = {
            pid_of("openai"): [answer("Option A is best.")] * 3,
            pid_of("anthropic"): [answer("Option B is best.")] * 3,
        }
        events, calls = await self.run_with(answers)

        self.assertEqual(
            self.types(events),
            [
                "round_start", "model_response", "model_response", "evaluation",
                "round_start", "model_response", "model_response", "evaluation",
                "moderator_start", "consensus", "done",
            ],
        )
        self.assertIn("stopped changing", events[7]["reason"])
        consensus = events[9]
        self.assertFalse(consensus["converged"])
        self.assertEqual(consensus["rounds_used"], 2)  # stalled in round 2, round 3 skipped
        self.assertEqual(consensus["content"], "MODERATED COMPROMISE")
        # Judge was only consulted in round 1; the stall made round 2's check free.
        judge_calls = [c for c in calls if c[2] == prompts.JUDGE_SYSTEM]
        self.assertEqual(len(judge_calls), 1)

    async def test_judge_rotates_each_round(self):
        """With changing-but-disagreeing positions, a different participant judges each round."""
        answers = {
            pid_of("openai"): [answer(f"Option A{i} is best.") for i in range(1, 4)],
            pid_of("anthropic"): [answer(f"Option B{i} is best.") for i in range(1, 4)],
            pid_of("google"): [answer(f"Option C{i} is best.") for i in range(1, 4)],
        }
        events, calls = await self.run_with(answers, models=("openai", "anthropic", "google"))

        judge_calls = [pid_of(p, m) for p, m, s, _u in calls if s == prompts.JUDGE_SYSTEM]
        self.assertEqual(judge_calls, [pid_of("openai"), pid_of("anthropic"), pid_of("google")])
        consensus = events[-2]
        self.assertFalse(consensus["converged"])
        self.assertEqual(consensus["rounds_used"], 3)

    async def test_chad_mode_uses_chad_synthesis_prompt(self):
        """chad=True switches the post-consensus synthesis to the chad prompt."""
        same = answer("The Dell U3425WE is the best 34-inch curved monitor.")
        fake, calls = make_fake({pid_of("openai"): [same], pid_of("anthropic"): [same]})
        with mock.patch.object(debate, "call_model", new=fake):
            events = await collect(
                "Best monitor?", default_participants("openai", "anthropic"),
                {"openai": "k", "anthropic": "k"}, chad=True,
            )
        self.assertEqual(events[-2]["type"], "consensus")
        self.assertTrue(events[-2]["converged"])
        self.assertIn(prompts.CHAD_SYNTHESIS_SYSTEM, [s for _, _, s, _u in calls])
        self.assertNotIn(prompts.SYNTHESIS_SYSTEM, [s for _, _, s, _u in calls])

    async def test_chad_mode_uses_chad_moderator_prompt(self):
        """chad=True switches the no-consensus moderator to the chad prompt."""
        answers = {
            pid_of("openai"): [answer("Option A is best.")] * 3,
            pid_of("anthropic"): [answer("Option B is best.")] * 3,
        }
        fake, calls = make_fake(answers)
        with mock.patch.object(debate, "call_model", new=fake):
            events = await collect(
                "A or B?", default_participants("openai", "anthropic"),
                {"openai": "k", "anthropic": "k"}, chad=True,
            )
        self.assertEqual(events[-2]["type"], "consensus")
        self.assertFalse(events[-2]["converged"])
        self.assertIn(prompts.CHAD_MODERATOR_SYSTEM, [s for _, _, s, _u in calls])
        self.assertNotIn(prompts.MODERATOR_SYSTEM, [s for _, _, s, _u in calls])

    async def test_no_keys_errors_cleanly(self):
        events = await collect("Best monitor?", default_participants("openai"), {})
        self.assertEqual(self.types(events), ["error", "done"])
        self.assertIn("missing API keys", events[0]["message"])

    async def test_single_survivor_short_circuits(self):
        """If only one participant answers, its answer becomes the consensus."""
        async def fake(provider_id, api_key, system_prompt, user_prompt, model=None, client=None):
            if provider_id == "anthropic":
                raise RuntimeError("HTTP 401: bad key")
            return answer("The only answer.")

        with mock.patch.object(debate, "call_model", new=fake):
            events = await collect(
                "Q?", default_participants("openai", "anthropic"), {"openai": "k", "anthropic": "k"}
            )
        self.assertEqual(
            self.types(events),
            ["round_start", "model_response", "model_error", "consensus", "done"],
        )
        self.assertEqual(events[2]["error"], "invalid API key")  # sanitized, not the raw body
        self.assertTrue(events[3]["converged"])
        self.assertIn("The only answer.", events[3]["content"])

    def test_debate_prompt_has_anti_conformity_guardrail(self):
        """DEBATE_SYSTEM must counter majority-pressure conformity (cf. MAD literature)."""
        self.assertIn("do not concede just to end the debate", prompts.DEBATE_SYSTEM)
        self.assertIn("majority pressure is not evidence", prompts.DEBATE_SYSTEM)

    def test_judge_prompt_is_conservative(self):
        """JUDGE_SYSTEM must prefer a false NO over a false consensus."""
        self.assertIn("If in doubt, rule NO", prompts.JUDGE_SYSTEM)

    async def test_entrenched_holdout_skips_to_moderator(self):
        """Round 2: two converge on A, the lone holdout keeps B unchanged -> moderator,
        without burning a judge call or a third round."""
        answers = {
            pid_of("openai"): [
                answer("Option A is best."),
                answer("Option A is best.", stance="MAINTAINED"),
            ],
            pid_of("anthropic"): [
                answer("Option B is best."),
                answer("Option A is best.", stance="CONCEDED to ChatGPT"),
            ],
            pid_of("google"): [
                answer("Option C is best."),
                answer("Option C is best.", stance="MAINTAINED"),
            ],
        }
        events, calls = await self.run_with(answers, models=("openai", "anthropic", "google"))

        self.assertEqual(
            self.types(events),
            [
                "round_start", "model_response", "model_response", "model_response", "evaluation",
                "round_start", "model_response", "model_response", "model_response", "evaluation",
                "moderator_start", "consensus", "done",
            ],
        )
        self.assertFalse(events[4]["consensus"])  # round 1: judge said NO
        self.assertIn("holdout", events[9]["reason"])
        consensus = events[11]
        self.assertFalse(consensus["converged"])
        self.assertEqual(consensus["rounds_used"], 2)  # round 3 skipped
        self.assertEqual(consensus["content"], "MODERATED COMPROMISE")
        # The judge was consulted only in round 1; round 2 exited for free.
        judge_calls = [c for c in calls if c[2] == prompts.JUDGE_SYSTEM]
        self.assertEqual(len(judge_calls), 1)

    async def test_moderator_receives_voting_landscape(self):
        """The moderator's user prompt carries per-position support and stability."""
        answers = {
            pid_of("openai"): [answer("Option A is best.")] * 3,
            pid_of("anthropic"): [answer("Option B is best.")] * 3,
        }
        _events, calls = await self.run_with(answers)

        mod_calls = [
            u for _p, _m, s, u in calls
            if s in (prompts.MODERATOR_SYSTEM, prompts.CHAD_MODERATOR_SYSTEM)
        ]
        self.assertEqual(len(mod_calls), 1)
        user_prompt = mod_calls[0]
        self.assertIn("Position support (final round):", user_prompt)
        self.assertIn("held by 1 model", user_prompt)
        self.assertIn("stable for 2 rounds", user_prompt)


if __name__ == "__main__":
    unittest.main()
