# Personas

Seventeen job titles spread over three subagent types. The agent type is the home tier (`rapido`, `padrao`, `profundo`);
the persona is a role label used in the `Agent` description so a task list shows who is doing what.
The Office mod (`agent-office`) mirrors this table in `hooks/persona.ts`.

Description prefix: `<icon> Persona · <model icon> Model · <effort icon> effort: <label>`,
for example `🛠️ Pleno · 🎼 Sonnet · 🟢 low: reading template`.
Models: 🪶 Haiku (`rapido`) · 🎼 Sonnet (`padrao`) · 👑 Opus (`profundo`). Effort: 🟢 `low` · 🟡 `medium` · 🔴 `high`.

| Persona | Icon | Agent type | Served on | May spawn | Typical roles |
|---|---|---|---|---|---|
| Product Owner | 🎯 | `profundo` | Opus | `padrao`, `rapido` | requirements, spec, research |
| Squad Leader | 🧭 | `profundo` | Sonnet | `padrao`, `rapido` | final whole-branch review, orchestrator label |
| Especialista | 🧠 | `profundo` | Sonnet | `padrao`, `rapido` | domain panel, money/auth/schema/concurrency, critical validation |
| Arquiteto | 📐 | `profundo` | Sonnet | `padrao`, `rapido` | architecture, planning, UI design mode |
| Senior | 🦉 | `padrao` | Sonnet | `rapido` | complex build, debugging, impact analysis, escalation |
| Pleno | 🛠️ | `padrao` | Sonnet | `rapido` | implementer, backend/frontend engineer, tests |
| QA | 🧪 | `padrao` | Sonnet | `rapido` (raw runs only) | test runner, judge, verifier, code-quality review |
| DBA | 🗄️ | `padrao` | Sonnet | `rapido` | SQL, schema and index analysis |
| AppSec | 🛡️ | `padrao` | Haiku | `rapido` | OWASP and secrets review |
| DevOps | ⚙️ | `padrao` | Haiku | `rapido` | CI, hooks, scripts, environment upkeep |
| SRE | 🚨 | `padrao` | Haiku | `rapido` | incident investigation, runtime errors |
| Performance | ⚡ | `padrao` | Haiku | `rapido` | N+1, SQL tuning, load tests |
| UX/UI | 🎨 | `padrao` | Haiku | `rapido` | UI audit, accessibility, design-system consistency |
| Data/BI | 📊 | `padrao` | Haiku | `rapido` | reports, KPIs, read-only analytics |
| Junior | 🌱 | `rapido` | Haiku | `rapido` (leaves) | exact-diff edits, validators |
| Tech Writer | ✍️ | `rapido` | Haiku | `rapido` (leaves) | docs, summaries |
| Estagiario | 🐣 | `rapido` | Haiku | `rapido` (leaves) | explorer, lookups, checklists |

Rules:
- Spawns only go down a tier. The one sideways exception is `rapido` to `rapido`, once; those children are leaves.
- A persona served on Haiku but hosted by `padrao` is spawned as `rapido` with `model` omitted.
- Judge is never the implementer. Money, auth, schema and concurrency judgement stays with `profundo`.
- Machine copy: `data/effort-matrix.json` (icons, tiers, spawn rules, effort ladders). Informational only.
