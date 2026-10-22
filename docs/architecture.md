# Architecture

One marketplace (`office`), four independent plugins. Only `agent-office` is needed for the monitor.

```
office (marketplace)
  agent-office  mod: hooks module (register.tsx) drawing the pane; reads tool/agent events only
  personas      agents/ (rapido, padrao, profundo) + hooks/hooks.json (UserPromptSubmit -> model-router.sh)
  learning      skills/task-observer + templates (log.md, CLAUDE.md.snippet)
  laya          .mcp.json (laya server) + skills/laya + docker/ compose reference
```

## agent-office (mod)

`hooks/hooks.json` declares `{"modules": ["./register.tsx"]}`. The module listens to agent and tool events, keeps a
state map (`monitor.ts`), computes stats (`stats.ts`) and draws a pane (`office.ts`, `preview.ts`). `persona.ts`
mirrors the persona table in `plugins/personas/docs/personas.md` so a subagent description with a persona prefix is
shown with the right icon and room. Without `personas` the mod still works; unknown descriptions get a neutral look.
Tests: `claude plugin test plugins/agent-office`.

## personas + router

Agents are addressed as `personas:rapido|padrao|profundo`. The hook runs per prompt and adds one context line
(`[model-router] level ... -> suggested subagent ...`). With Laya reachable it asks level and risk; otherwise a
keyword floor, default `padrao`. If the hook is absent or silent, the session chooses the tier itself. See
`plugins/personas/docs/model-routing.md`.

## learning

`task-observer` watches a session for skill-improvement opportunities and appends to
`~/.claude/skill-observations/log.md`. Activation is a CLAUDE.md block that you add yourself.

## laya

`.mcp.json` starts `uv run --script ${LAYA_HOME}/mcp/laya_mcp.py`. Without `LAYA_HOME` set the MCP server fails to
start (Claude Code shows it as failed) and nothing else is affected. Laya is cloned separately.
