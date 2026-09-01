"""Debate orchestration engine.

``run_debate`` is an async generator yielding SSE frames
(``data: <compact json>\\n\\n``). It drives the full flow:
initial parallel answers -> consensus check -> debate rounds -> moderator fallback.

A *participant* is a (provider, model) pair identified by the string
``"provider:model"`` — several participants may share one provider with
different models (they also share that provider's API key).

Consensus strategy per round (cheapest check first):
1. Fast path: if the normalized FINAL POSITION lines are identical, consensus
   is declared with zero extra API calls. Deliberately conservative — fuzzy
   matching is left to the judge, because one-sentence positions often differ
   only in the decisive entity ("Monitor X…" vs "Monitor Y…").
2. Rotating judge: a different surviving participant judges each round (none
   judges its own debate twice in a row), with failover to a backup judge.

Stall detection: if no participant changed its FINAL POSITION during a debate
round, further rounds would burn tokens without progress — the stream jumps
straight to the moderator compromise.
"""

import asyncio
import json
import logging
import re
import time
from collections.abc import AsyncGenerator

import httpx

from . import prompts
from .providers import DISPLAY_NAMES, TIMEOUT_SECONDS, call_model

MAX_ROUNDS = 3
# How many different participants may act as judge per round before giving up.
_MAX_JUDGE_ATTEMPTS = 2

logger = logging.getLogger(__name__)

_FINAL_POSITION_RE = re.compile(r"^final position:\s*(.+)$", re.IGNORECASE | re.MULTILINE)
_STANCE_RE = re.compile(r"^stance:\s*(.+)$", re.IGNORECASE | re.MULTILINE)
_VERDICT_RE = re.compile(r"^verdict:\s*(yes|no)\b", re.IGNORECASE | re.MULTILINE)
_REASON_RE = re.compile(r"^reason:\s*(.+)$", re.IGNORECASE | re.MULTILINE)
_WS_RE = re.compile(r"\s+")
# \w with re.UNICODE keeps CJK/accented letters; everything else becomes a space.
_NON_WORD_RE = re.compile(r"[^\w ]")


def _frame(payload: dict) -> str:
    """Serialize one event as an SSE frame."""
    return f"data: {json.dumps(payload, separators=(',', ':'))}\n\n"


def _extract_position(text: str) -> str:
    """Pull the ``FINAL POSITION:`` line from a model answer; fall back to full text."""
    matches = _FINAL_POSITION_RE.findall(text)
    if matches:
        return matches[-1].strip()
    return text.strip()


def _extract_stance(text: str) -> str | None:
    """Pull the ``STANCE:`` line (debate rounds only); None if absent."""
    match = _STANCE_RE.search(text)
    if not match:
        return None
    stance = _WS_RE.sub(" ", match.group(1)).strip().strip("*. ")
    return stance[:80] or None


def _normalize_position(text: str) -> str:
    """Case/punctuation-insensitive form of a position, for equality checks."""
    text = _NON_WORD_RE.sub(" ", text.lower())
    return _WS_RE.sub(" ", text).strip()


def _positions_similar(positions: list[str]) -> bool:
    """True when all positions are identical after normalization.

    Intentionally exact: fuzzy similarity is unsafe for one-sentence positions
    that differ only in the decisive entity, so anything non-identical goes to
    the judge instead.
    """
    norms = {_normalize_position(p) for p in positions}
    norms.discard("")
    return len(norms) == 1


def _public_error(detail: str) -> str:
    """Map an internal/provider error to a client-safe message.

    Provider HTTP error bodies (which ``ProviderError`` embeds) are never echoed
    to the browser: they can contain provider internals or key fragments. The
    full detail is logged server-side instead.
    """
    if "HTTP 401" in detail or "HTTP 403" in detail:
        return "invalid API key"
    if "HTTP 429" in detail:
        return "provider rate limit reached — try again later"
    if "unexpected response shape" in detail:
        return "provider returned an unexpected response"
    return "provider request failed"


async def _round_call(
    client: httpx.AsyncClient,
    provider: str,
    model: str,
    api_key: str,
    system: str,
    user: str,
) -> dict:
    """Call one participant's model, capturing latency; returns a result or error dict."""
    start = time.monotonic()
    try:
        content = await call_model(provider, api_key, system, user, model=model, client=client)
        return {"ok": True, "content": content, "duration_ms": int((time.monotonic() - start) * 1000)}
    except Exception as exc:  # ProviderError or anything else: never crash the round
        return {"ok": False, "error": str(exc)}


async def _run_round(
    client: httpx.AsyncClient,
    round_no: int,
    active: list[str],
    spec: dict[str, tuple[str, str]],
    keys: dict[str, str],
    system: str,
    build_user_prompt,
) -> tuple[list[dict], list[str], dict[str, str]]:
    """Run one round in parallel over active participants.

    ``spec`` maps participant id -> (provider, model). Returns (events,
    still_active, responses): SSE event payloads for the round, the ids of
    participants that answered (failures drop out of later rounds), and the
    latest answer text per participant.
    """
    async def call(pid: str) -> dict:
        provider, model = spec[pid]
        return await _round_call(client, provider, model, keys[provider], system, build_user_prompt(pid))

    results = await asyncio.gather(*(call(pid) for pid in active), return_exceptions=True)
    responses: dict[str, str] = {}
    events: list[dict] = []
    still_active: list[str] = []
    for pid, res in zip(active, results):
        if isinstance(res, Exception):
            res = {"ok": False, "error": str(res)}
        if res["ok"]:
            responses[pid] = res["content"]
            still_active.append(pid)
            event = {
                "type": "model_response", "round": round_no, "model": pid,
                "content": res["content"], "duration_ms": res["duration_ms"],
            }
            stance = _extract_stance(res["content"])
            if stance:
                event["stance"] = stance
            events.append(event)
        else:
            # Full detail stays in the server log; the client gets a safe message.
            logger.warning("participant %s failed in round %d: %s", pid, round_no, res["error"])
            events.append({
                "type": "model_error", "round": round_no, "model": pid,
                "error": _public_error(res["error"]),
            })
    return events, still_active, responses


async def _judge_once(
    client: httpx.AsyncClient,
    query: str,
    judge_pid: str,
    spec: dict[str, tuple[str, str]],
    keys: dict[str, str],
    positions: list[tuple[str, str]],
) -> tuple[bool, str]:
    """Ask one judge whether the positions agree. Raises on provider failure."""
    provider, model = spec[judge_pid]
    reply = await call_model(
        provider, keys[provider], prompts.JUDGE_SYSTEM,
        prompts.judge_user_prompt(query, positions),
        model=model, client=client,
    )
    verdict_m = _VERDICT_RE.search(reply)
    if verdict_m:
        agreed = verdict_m.group(1).lower() == "yes"
        reason_m = _REASON_RE.search(reply)
        reason = reason_m.group(1).strip() if reason_m else ""
    else:
        # Tolerate judges that ignore the VERDICT/REASON format.
        lines = [ln.strip() for ln in reply.strip().splitlines() if ln.strip()]
        verdict = lines[0].strip("*.# ").upper() if lines else ""
        agreed = verdict.startswith("YES")
        reason = lines[1] if len(lines) > 1 else reply.strip()
    if not reason:
        reason = "Positions converge on the same conclusion." if agreed else "Positions recommend different conclusions."
    return agreed, reason


async def _check_consensus(
    client: httpx.AsyncClient,
    query: str,
    round_no: int,
    active: list[str],
    spec: dict[str, tuple[str, str]],
    keys: dict[str, str],
    labels: dict[str, str],
    responses: dict[str, str],
) -> tuple[bool, str, str | None]:
    """Decide whether the round's responses agree.

    Returns (agreed, reason, judge_pid); ``judge_pid`` is None when the
    zero-cost fast path decided without an API call.
    """
    positions = [(labels[pid], _extract_position(t)) for pid, t in responses.items()]

    # Fast path: identical positions need no judge call at all.
    if _positions_similar([p for _, p in positions]):
        return True, "All final positions are identical.", None

    # Rotating judge: round N starts from active[N-1], so no participant judges
    # its own debate twice in a row. A backup judge takes over on failure.
    n = len(active)
    attempts = [active[(round_no - 1 + k) % n] for k in range(min(_MAX_JUDGE_ATTEMPTS, n))]
    for judge_pid in attempts:
        try:
            agreed, reason = await _judge_once(client, query, judge_pid, spec, keys, positions)
            return agreed, reason, judge_pid
        except Exception:
            logger.warning("judge %s failed in round %d", judge_pid, round_no, exc_info=True)
    return False, "Judge unavailable; treating as no consensus.", None


async def _synthesize(
    client: httpx.AsyncClient,
    query: str,
    writer_pid: str,
    spec: dict[str, tuple[str, str]],
    keys: dict[str, str],
    labels: dict[str, str],
    responses: dict[str, str],
) -> str:
    """One extra call to write the unified answer after convergence."""
    labeled = "\n\n".join(
        f"--- {labels[pid]} ---\n{text}" for pid, text in responses.items()
    )
    user = f"Question: {query}\n\nAgreed answers:\n{labeled}\n\nWrite the final unified answer in clean markdown."
    provider, model = spec[writer_pid]
    try:
        return await call_model(provider, keys[provider], prompts.SYNTHESIS_SYSTEM, user, model=model, client=client)
    except Exception:
        # Degrade gracefully: fall back to the writer's own final answer.
        return responses.get(writer_pid) or next(iter(responses.values()))


async def _moderate(
    client: httpx.AsyncClient,
    query: str,
    judge_pid: str,
    spec: dict[str, tuple[str, str]],
    keys: dict[str, str],
    labels: dict[str, str],
    responses: dict[str, str],
    history: dict[str, list[str]],
    stalled: bool,
) -> str:
    """Moderator compromise after the round cap (or a stalled debate).

    The moderator sees the full per-round position trajectory, not just the
    final answers, so it can weight who conceded, who held firm, and why.
    Degrades to concatenated positions on failure.
    """
    trajectory = []
    for pid, answers in history.items():
        steps = " → ".join(f'R{i + 1}: "{_extract_position(a)}"' for i, a in enumerate(answers))
        trajectory.append(f"- {labels[pid]}: {steps}")
    note = (
        "Note: the participants' positions stopped changing between rounds — the debate stalled."
        if stalled
        else "Note: the participants kept disagreeing until the round limit."
    )
    labeled = "\n\n".join(
        f"--- {labels[pid]} ---\n{text}" for pid, text in responses.items()
    )
    user = (
        f"Question: {query}\n\nPosition trajectory:\n" + "\n".join(trajectory)
        + f"\n\n{note}\n\nFinal-round arguments:\n{labeled}"
    )
    provider, model = spec[judge_pid]
    try:
        return await call_model(provider, keys[provider], prompts.MODERATOR_SYSTEM, user, model=model, client=client)
    except Exception:
        parts = [
            "*Note: the moderator was unavailable, so the final positions "
            "are listed below without synthesis.*",
            "",
        ]
        parts += [f"**{labels[pid]}:** {_extract_position(t)}" for pid, t in responses.items()]
        return "\n\n".join(parts)


def _debate_user_prompt(query: str, history: dict[str, list[str]], labels: dict[str, str], round_no: int, self_pid: str) -> str:
    """Labeled transcript of every participant's previous-round response (own tagged)."""
    lines = [f"Original question: {query}", "", f"Round {round_no - 1} responses from all AIs:", ""]
    for pid, answers in history.items():
        tag = " (your previous answer)" if pid == self_pid else ""
        lines.append(f"--- {labels[pid]}{tag} ---")
        lines.append(answers[-1])
        lines.append("")
    lines.append(
        "Evaluate every argument above on its merits. If another AI's case is "
        "stronger, concede to it; if yours is still strongest, refute the best "
        "opposing point with facts. Remember to start with your STANCE line and "
        "end with your FINAL POSITION line."
    )
    return "\n".join(lines)


async def run_debate(
    query: str,
    participants: list[tuple[str, str]],
    keys: dict[str, str],
) -> AsyncGenerator[str, None]:
    """Drive the consensus flow, yielding SSE frames as plain strings.

    ``participants`` is a list of (provider, model) pairs — already resolved
    and deduplicated by the caller. Several may share the same provider with
    different models; they share that provider's API key.
    """
    # Participant identity: "provider:model" (model ids never contain ':').
    spec: dict[str, tuple[str, str]] = {}
    labels: dict[str, str] = {}
    for provider, model in participants:
        pid = f"{provider}:{model}"
        if pid in spec:  # identical pair selected twice: skip the duplicate
            continue
        spec[pid] = (provider, model)
        labels[pid] = f"{DISPLAY_NAMES[provider]} ({model})"

    # One shared HTTP client for every provider call in this debate request.
    async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
        try:
            # Split participants into those with and without an API key.
            active: list[str] = [pid for pid, (p, _m) in spec.items() if keys.get(p)]
            missing: list[str] = [pid for pid, (p, _m) in spec.items() if not keys.get(p)]

            if not active:
                yield _frame({"type": "error", "message": "No usable participants: all selected models are missing API keys."})
                yield _frame({"type": "done"})
                return

            # history[pid] = chronological list of that participant's responses
            history: dict[str, list[str]] = {}
            last_responses: dict[str, str] = {}
            prev_positions: dict[str, str] = {}
            rounds_used = 0
            stalled = False

            for round_no in range(1, MAX_ROUNDS + 1):
                kind = "initial" if round_no == 1 else "debate"
                yield _frame({"type": "round_start", "round": round_no, "kind": kind, "max_rounds": MAX_ROUNDS})

                # Missing-key errors are emitted after round_start so the event
                # order matches the documented flow (round_start -> model_*).
                if round_no == 1:
                    for pid in missing:
                        yield _frame({
                            "type": "model_error", "round": 1, "model": pid,
                            "error": "missing API key",
                        })
                    system = prompts.INITIAL_SYSTEM
                    build_user = lambda _pid: query  # noqa: E731
                else:
                    system = prompts.DEBATE_SYSTEM

                    def build_user(pid, _h=history, _l=labels, _r=round_no):
                        return _debate_user_prompt(query, _h, _l, _r, pid)

                events, active, last_responses = await _run_round(
                    client, round_no, active, spec, keys, system, build_user
                )
                for ev in events:
                    yield _frame(ev)
                for pid, text in last_responses.items():
                    history.setdefault(pid, []).append(text)
                rounds_used = round_no

                # Survivors bookkeeping: failed participants drop out of future rounds.
                if len(last_responses) < 2:
                    if len(last_responses) == 1:
                        only = next(iter(last_responses.values()))
                        yield _frame({"type": "consensus", "content": only, "converged": True, "rounds_used": rounds_used})
                    else:
                        yield _frame({"type": "error", "message": "All models failed."})
                    yield _frame({"type": "done"})
                    return

                # Stall detection: did any participant move its position this round?
                curr_positions = {
                    pid: _normalize_position(_extract_position(t)) for pid, t in last_responses.items()
                }
                stalled = (
                    round_no > 1
                    and bool(prev_positions)
                    and all(prev_positions.get(pid) == pos for pid, pos in curr_positions.items())
                )
                prev_positions = curr_positions

                if stalled and not _positions_similar(list(curr_positions.values())):
                    # Frozen disagreement: more rounds would only repeat arguments.
                    yield _frame({
                        "type": "evaluation", "round": round_no, "consensus": False,
                        "reason": "Positions stopped changing — moving to the moderator.",
                    })
                    break

                agreed, reason, judge_pid = await _check_consensus(
                    client, query, round_no, active, spec, keys, labels, last_responses
                )
                evaluation = {"type": "evaluation", "round": round_no, "consensus": agreed, "reason": reason}
                if judge_pid:
                    evaluation["judge"] = judge_pid
                yield _frame(evaluation)

                if agreed:
                    writer = judge_pid or active[0]
                    content = await _synthesize(client, query, writer, spec, keys, labels, last_responses)
                    yield _frame({"type": "consensus", "content": content, "converged": True, "rounds_used": rounds_used})
                    yield _frame({"type": "done"})
                    return

            # Round cap reached (or debate stalled) without consensus -> moderator.
            yield _frame({"type": "moderator_start"})
            judge_pid = active[0] if active else next(iter(last_responses))
            content = await _moderate(client, query, judge_pid, spec, keys, labels, last_responses, history, stalled)
            yield _frame({"type": "consensus", "content": content, "converged": False, "rounds_used": rounds_used})
            yield _frame({"type": "done"})
        except Exception:  # last-resort guard: the stream must always terminate cleanly
            logger.exception("run_debate failed")
            yield _frame({"type": "error", "message": "internal error"})
            yield _frame({"type": "done"})
