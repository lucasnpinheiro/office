---
status: TODO
progress: 0/1
updated: 2026-11-05
---
# Contratos em TypeScript

OpenAPI, JSON Schema e `.sql`: not applicable — sem HTTP e sem banco. Formato e enumerações vivem aqui, não nos cenários. Campos que dependem do engine podem mudar em T-001, com registro na ADR 0002.

```ts
export type RunState = 'queued' | 'running' | 'needs-you' | 'stalled' | 'paused' | 'failed' | 'done' | 'stopped'
export type Surface = 'terminal' | 'app'

export type CapabilityKey =
  | 'pause' | 'stop' | 'retry' | 'allow' | 'decline' | 'openInChat'
  | 'toolTiming' | 'tokensPerAgent' | 'costPerAgent' | 'permissionEvent'
  | 'workflowEvent' | 'worktreeFromDefinition' | 'commitsAhead'
  | 'containerWidth' | 'appMotion' | 'reducedMotionSignal'
export type Verdict = 'yes' | 'no' | 'not-verified'
export type Capabilities = Record<CapabilityKey, Record<Surface, Verdict>>
export const canUse = (c: Capabilities, k: CapabilityKey, s: Surface) => c[k][s] === 'yes'

export type ToolStep = {
  id: string            // tool_use_id
  tool: string
  label: string         // sempre mascarado
  startedAt: number
  durationMs?: number   // undefined enquanto roda
  ok?: boolean
  io?: { input: string; output?: string } // só com OFFICE_CAPTURE_IO=1, mascarado, até 2000 caracteres
}

export type Usage = { tokens?: number; costUsd?: number } // undefined é desconhecido, nunca 0

export type PendingDecision = {
  toolUseId: string
  agentId?: string
  tool: string
  label: string         // mascarado
  reason?: string
  phase: 'pending' | 'sending' | 'rejected'
  message?: string
}

export type RunNode = {
  id: string; parentId?: string; name: string; persona?: string; model?: string; effort?: string
  state: RunState
  worktree?: { path: string; branch?: string; ahead?: number; files?: number }
  startedAt?: number; endedAt?: number
  steps: ToolStep[]; droppedSteps: number
  usage: Usage
  promptMasked?: string; error?: string
  total?: { done: number; of: number } // só com total conhecido; não existe percentual
  pending?: PendingDecision
}

// O engine só dá `workflow.runId` e `agentIndex` no agent.spawn (probe 2026-11-05, ADR 0002): sem nome, rodada, fases ou total.
export type WorkflowRun = { runId: string; agentIds: string[] } // agentIds na ordem de agentIndex

export type RunModel = {
  nodes: RunNode[]; roots: string[]
  attention: string[]           // needs-you antes, failed depois
  workflows?: WorkflowRun[]     // por runId; ausente sem workflow
  totals: { running: number; done: number; of: number; tokens?: number; costUsd?: number; partial: boolean }
  etaMs?: number                // só com 3 ou mais concluídos do mesmo modelo conhecido; restante = só esse modelo; paralelismo só o observado
  caps: Capabilities
}

export type ActionKey = 'pause' | 'resume' | 'stop' | 'retry' | 'allow' | 'decline' | 'openInChat'
export type ActionResult = { ok: true } | { ok: false; message: string }
export type ActionState = { key: ActionKey; nodeId: string; phase: 'confirm' | 'sending' | 'error'; message?: string }

export const buildRunModel: (agents: readonly AgentRecord[], now: number, caps: Capabilities) => RunModel
```

`AgentRecord` é o tipo único que substitui `OfficeAgent` e `AgentLike`.

## Formatos de exibição
| Dado | Formato | Sem dado |
|---|---|---|
| Custo | `~$0,14` | `—` |
| Tokens | `3,6k` | `—` |
| Tempo | `00:07` | `—` |
| Total parcial | `~$0,84 parcial` | `—` |

## Variáveis de ambiente
| Variável | Valor válido | Efeito |
|---|---|---|
| `OFFICE_CAPTURE_IO` | exatamente `1` | liga entrada e saída mascaradas |
| `OFFICE_ASCII`, `NO_COLOR` | definida | glifos ASCII ou sem cor |
| `OFFICE_REDUCED_MOTION`, `CI` | definida | 1 quadro/s |
| `OFFICE_MODE`, `OFFICE_VIEW`, `OFFICE_WIDTH` | já existentes (`register.tsx:242-246`) | mantidos |

## Padrões mínimos de máscara
Cabeçalho `Authorization`; `Bearer ...`; pares `token`, `secret`, `password`, `passwd`, `api_key`, `apikey` com `=` ou `:`; prefixos `sk-`, `ghp_`, `gho_`, `github_pat_`, `xox`, `AKIA`; blocos `-----BEGIN ... PRIVATE KEY-----`; senha em URL `://user:pass@`.
