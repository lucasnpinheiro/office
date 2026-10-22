# Model routing

The tier follows difficulty and risk, not size. `critical` thinks, `standard` builds, `basic` executes.

| Tier | Agent type | Model | Base effort | Work |
|---|---|---|---|---|
| basic | `rapido` | Haiku | low | lookups, search, listings, checklists, docs, 1-2 file mechanical edits with the full change in the brief |
| standard | `padrao` | Sonnet | low | multi-file implementation, SQL, tests, debugging, impact analysis, bounded review |
| critical | `profundo` | Opus | low | requirements, spec, architecture, security, money rules, schema, concurrency, final review |

Installed through the `personas` plugin, the agents are addressed as `personas:rapido`, `personas:padrao`
and `personas:profundo` (`<plugin>:<agent>`).

## Who picks the tier

- A `[model-router]` hint is present in the context: follow it (delegate with the suggested `subagent_type`).
- No hint (router hook absent, disabled, or it printed nothing): the current session decides whether to delegate at
  all and to which tier, using the table above and the keyword floor below as a guide. Nothing forces delegation.

## Effort ladder

Every spawn starts at `low`. On a re-invocation of the same persona in the same scope (a retry after a rejected
result) the effort goes up one level: `low` to `medium`. The cap for every tier is `medium`; `high`, `xhigh` and `max`
are never set automatically. The per-role ladders are in `data/effort-matrix.json` (`roles`).

## Prompt router (optional hook)

The plugin registers a `UserPromptSubmit` hook (`hooks/model-router.sh`). For each message it suggests one tier by
adding a line to the context; it never blocks and never decides for you. Installing the plugin is the opt-in;
disable the hook with `claude plugin disable personas`.

1. **With Laya** (`LAYA_API_URL`, default `http://localhost:8000`): one `/predict` call asks the difficulty level
   (simple, routine, hard) and a risk probability. A low-confidence or high-risk `simple` request is lifted one tier.
2. **Without Laya**: tier `padrao`, or higher when the keyword floor matches.
3. **Keyword floor**: security, auth, passwords, tokens, secrets, payments, billing, taxes, migrations,
   concurrency and destructive SQL in the user's own words force `profundo`. Quoted text, code fences and URLs are
   ignored; a keyword only in pasted text lifts to `padrao`.
4. **Quota** (only with Laya): the suggested mix drifts toward 50% `rapido` / 35% `padrao` / 15% `profundo` over
   the last 100 decisions. Never below the keyword floor. `MODEL_ROUTER_QUOTA=off` disables it.

Skipped: messages starting with `!` or `/`, and machine turns (subagent hand-backs).

Environment variables: `LAYA_API_URL`, `MODEL_ROUTER_DIR` (log folder, default `~/.claude/model-router`),
`MODEL_ROUTER_LOG=off`, `MODEL_ROUTER_QUOTA=off`.
Log: `decisions.jsonl` holds a 160-character excerpt of each message; see `docs/privacy.md` in the repository.
