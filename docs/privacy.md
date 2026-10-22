# Privacy and security

Nothing leaves your machine except what the optional parts explicitly call.

| Part | Reads | Writes | Network |
|---|---|---|---|
| agent-office | tool and agent events of the session (names, descriptions, short command labels, durations) | nothing on disk | none |
| personas hook | each prompt you submit (stdin of the hook) | `~/.claude/model-router/decisions.jsonl`: timestamp, session id, first 160 characters of the prompt, chosen tier | one POST to `LAYA_API_URL` (default `http://localhost:8000`) with the first 600 characters of the prompt, only if Laya answers there |
| learning | observation log | `~/.claude/skill-observations/log.md` (created from an empty template, never overwritten) | none |
| laya | text you ask it to classify | Laya's own container logs | local container only |

Controls:
- `MODEL_ROUTER_LOG=off` stops the router writing `decisions.jsonl`; delete that folder at any time.
- `claude plugin disable personas@office` removes the hook entirely.
- Point `LAYA_API_URL` at a local service only; prompts are sent there unencrypted over plain HTTP by default.
- The installer never edits `settings.json` or `CLAUDE.md` by hand; it calls the `claude plugin` CLI.
- The router hook never blocks a prompt: every failure path prints nothing and exits 0.
- The observation log may contain notes about your work; keep it out of version control if it does.
