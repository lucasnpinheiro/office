---
name: laya
description: Classify, triage, route, score or guardrail short content with the Laya decision model through the laya MCP server (laya_predict / laya_classify). Use when the task is to judge text (spam, sentiment, intent, ticket triage, commit type, review verdict, prompt-injection gates) especially in bulk, or when asked about Laya itself. Requires the Laya service running locally. Manual-load only.
---

# Laya: typed decisions over content

Laya is a non-autoregressive decision model, run locally in Docker behind the `laya` MCP server. Input: a state
(text, email, ticket, JSON) plus typed questions. Output: typed answers with calibrated probabilities in one forward
pass, in 100+ languages. It never generates text.

Boundary: it answers "what label, score or yes-probability does this short text get?". Diagnosis, ambiguity and
consequences stay with the LLM.

## Setup (not bundled)

Laya is an external project: https://github.com/lucasnpinheiro/laya

1. `git clone https://github.com/lucasnpinheiro/laya "$HOME/laya"` and `export LAYA_HOME="$HOME/laya"`.
2. `cd "$LAYA_HOME" && docker compose up -d` (first start downloads weights and can take minutes).
3. Install `uv` (the MCP server is a `uv run --script` file) and restart Claude Code.
4. Check `curl http://localhost:8000/health`.

## Tools

| Tool | Use |
|---|---|
| `laya_question_bank` | First. Measured questions with the language, confidence gate and cut that made them safe. |
| `laya_predict` | Main entry: many typed questions about one state in one pass. `laya_classify` is the one-question shortcut. |
| `laya_start` / `laya_health` | Warm the container before a batch; diagnose a slow or failing call. |
| `laya_checkpoints` | The available checkpoints and their budgets. |

## Flow

1. Bank first: call `laya_question_bank`; if a measured question exists, copy it as is.
2. Otherwise write the question yourself and treat the result as unmeasured (a ranking signal only).
3. Batch coming: call `laya_start` first, then ask all questions for one state in a single `laya_predict`.
4. Gate every answer: accept a `choice` only at or above its confidence gate; act on a `noul` flag at or above its cut.
   Below the gate, escalate the item to the LLM or a human; never guess.
5. Report the answer and its confidence.

## Rules that bite

- Write criteria text in English even when the state is in another language.
- For non-English state, pass `model="multilingual"` unless the bank says otherwise.
- Keep `choice` questions under about 20 options; split coarse to fine beyond that.
- `noul` flags are never clearances: below the cut nothing is waived.
- State budget is about 320 tokens (`english`) or 768 (others): send the decisive part only.
- Never put real secrets or personal data into a question or a bank; anonymise first.
