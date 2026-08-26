# DONG-GLE Bugbot review rules

## Architecture boundaries

- `ai/course_optimizer/` must NOT create DB sessions, run place-recommendation SQL, or reimplement `ai/semantic_vector` major/detail vector generation.
- `ai/course_optimizer/` must NOT import `data/pipeline` directly. Candidate places are assembled by the upper service layer.
- `data/pipeline/semantic_vector_sync.py` may depend on `ai/semantic_vector`; the reverse dependency direction is forbidden.
- API keys and secrets must stay in `.env` / environment injection. Never commit `.env`, credentials, or hard-coded API keys.

## course_optimizer algorithm invariants (do not "fix" these away)

- Activity/rest balance is score-only: never prune or reject routes because of balance streaks or category repetition.
- Backtracking + pruning is intentional. Do not suggest DP, beam search, or greedy rewrites unless a measured performance regression is shown.
- LLM evaluation runs once per optimization call and produces reusable per-place / per-pair scores. Do not add per-route LLM scoring loops.
- `majorScores` (7-dim) is the sole place tag representation. Do not introduce free-text tag systems.
- Minimum visit count is enforced (default 2). Partial routes below that are invalid.
- Travel efficiency score uses absolute normalization against total available trip time, not relative ranking among candidate routes only.

## Scoring formula checks

When reviewing `score_calculator.py` or related logic, verify:

- `BalanceScore = max(0, 100 - PenaltyActivity - PenaltyRest - CategoryRepeatPenalty)`
- Category repeat penalty is linear (`category_repeat_penalty` per adjacent repeat).
- Activity/rest streak penalty is quadratic: `k × max(0, streak_length - 2)²` with configurable k (default 5).
- Total score is weighted average of experience and travel scores using configured weights.

## Tests and evaluation code

- Production changes under `ai/course_optimizer/` (excluding `evaluation/`) should keep unit tests passing.
- Code under `ai/course_optimizer/evaluation/` is experimental only; do not treat missing tests there as production blockers.
- Mock external APIs (Places, Routes, LLM) in unit tests; do not require live keys in CI.

## Common false positives to avoid

- Do not flag intentional early pruning in `backtracking.py` (operating hours, stay time, destination deadline, lower-bound).
- Do not suggest moving config/env reads out of `config.py` into scattered modules.
- Do not recommend merging `evaluation/penalty_sensitivity` into production scoring without an explicit product decision.
