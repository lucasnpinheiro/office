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
- agent-office masks these fields before they reach its in-memory state: the agent prompt (first line, 300 characters), the agent description, the step label, todo/task content (`TodoWrite` content, `TaskCreate`/`TaskUpdate` subject), error text of failed agents (cut to 200 characters after masking), and, only with `OFFICE_CAPTURE_IO=1`, tool input (the arguments, without the event envelope) and output (the result only), cut to 2000 characters per field after masking. Not stored at all: the full prompt, tool input/output without the opt-in. Not masked because not secret-bearing by design: tool names, durations, token counts, file paths of edited files, session cwd and git branch names.
- What the masker recognises: Authorization and Bearer headers; `key=value` and `key: value` for keys containing `token`, `secret`, `password`, `passwd`, `senha`, `credential`, `api_key`/`api-key`/`apikey`, `private_key`, `access_key` (whole value, including JSON strings, arrays and objects, and the rest of the line after `:`); `api key: x`; `--password x` style flags; `mysql -phunter2`; `curl -u user:pass`; the prefixes `sk-`, `sk_live_`, `ghp_`/`gho_`/`ghu_`/`ghs_`/`ghr_`, `github_pat_`, `xox?-`, `AKIA`, `AIza`, `npm_`; JWTs; Slack webhook URLs; `?key=`/`&key=` in URLs; passwords in URLs (`https://user:pw@host`, also `redis://:pw@host`, a `@` or `:` inside the password is covered up to the last `@`); private key blocks, also unterminated.
- Honest limits (masking is pattern based):
  - A secret with no recognisable key or prefix is not caught: a loose base64 string (`dGhpcyBpcyBhIHNlY3JldA==` on its own), a hex digest, or a password written in free text ("the password is hunter2 for the db") stays visible.
  - A password containing `/` inside a URL (`https://u:pa/ss@host`) is not masked.
  - Over-masking is modest but real: `max_tokens: 4096` and `--token-count 5` are masked too.
  - Text longer than 100000 characters is cut before masking (the rest is dropped, never stored). This keeps masking time bounded.
  - If masking throws, `[mascaramento falhou]` is stored instead of the text.
  - Leave `OFFICE_CAPTURE_IO` unset when in doubt.
- `OFFICE_CAPTURE_IO` is off unless it is exactly `1`; while off, tool input and output are not stored at all. Close the session to discard what is held in memory.
- `MODEL_ROUTER_LOG=off` stops the router writing `decisions.jsonl`; delete that folder at any time.
- `claude plugin disable personas@office` removes the hook entirely.
- Point `LAYA_API_URL` at a local service only; prompts are sent there unencrypted over plain HTTP by default.
- The installer never edits `settings.json` or `CLAUDE.md` by hand; it calls the `claude plugin` CLI.
- The router hook never blocks a prompt: every failure path prints nothing and exits 0.
- The observation log may contain notes about your work; keep it out of version control if it does.
