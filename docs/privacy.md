# Privacy and security

Nothing leaves your machine except what the optional parts explicitly call.

| Part | Reads | Writes | Network |
|---|---|---|---|
| agent-office | tool and agent events of the session (names, descriptions, short command labels, durations, token counts and cost, the agent prompt with secrets masked) | nothing on disk | none |
| agent-office tool input/output (opt-in) | with `OFFICE_CAPTURE_IO=1` only: each tool call's input and output, secrets masked, cut to 2000 characters per field | nothing on disk, memory only | none |
| personas hook | each prompt you submit (stdin of the hook) | `~/.claude/model-router/decisions.jsonl`: timestamp, session id, first 160 characters of the prompt, chosen tier | one POST to `LAYA_API_URL` (default `http://localhost:8000`) with the first 600 characters of the prompt, only if Laya answers there |
| learning | observation log | `~/.claude/skill-observations/log.md` (created from an empty template, never overwritten) | none |
| laya | text you ask it to classify | Laya's own container logs | local container only |

Controls:
- agent-office masks secrets (Authorization and Bearer headers, token/secret/password/api_key pairs, `sk-`, `ghp_`, `gho_`, `github_pat_`, `xox`, `AKIA` prefixes, private key blocks, passwords in URLs) before anything reaches its state. If masking fails, it stores `[mascaramento falhou]` instead of the text. Masking is pattern based: an unrecognised secret shape is not caught, so leave `OFFICE_CAPTURE_IO` unset when in doubt.
- `OFFICE_CAPTURE_IO` is off unless it is exactly `1`; while off, tool input and output are not stored at all. Close the session to discard what is held in memory.
- `MODEL_ROUTER_LOG=off` stops the router writing `decisions.jsonl`; delete that folder at any time.
- `claude plugin disable personas@office` removes the hook entirely.
- Point `LAYA_API_URL` at a local service only; prompts are sent there unencrypted over plain HTTP by default.
- The installer never edits `settings.json` or `CLAUDE.md` by hand; it calls the `claude plugin` CLI.
- The router hook never blocks a prompt: every failure path prints nothing and exits 0.
- The observation log may contain notes about your work; keep it out of version control if it does.
