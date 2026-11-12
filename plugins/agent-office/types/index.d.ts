// Contrato self-contained do mod (validador do Claude Code: sem import/export-from/require).
// Espelha hooks/office.ts (AgentRecord, Status) e hooks/run-model.ts (ToolStep, Usage).
// Ao mudar esses tipos na fonte, atualize este arquivo; hooks/types-contract.test.ts garante que não há import.
export type Status = 'working' | 'done' | 'error'
export type Usage = { tokens?: number; costUsd?: number }
export type ToolStep = { id: string; tool: string; label: string; startedAt: number; durationMs?: number; ok?: boolean; io?: { input: string; output?: string } }
export type AgentRecord = {
  id: string
  agentId?: string
  endUnknown?: boolean
  parentAgentId?: string
  description: string
  subagentType?: string
  status: Status
  startedAt: number
  endedAt?: number
  active?: boolean
  error?: string
  seenAt?: number
  prompt?: string
  model?: string
  effort?: string
  local?: number
  mcp?: Record<string, number>
  web?: Record<string, number>
  files?: string[]
  cwd?: string
  tool?: string
  recent?: string[]
  shot?: { host?: string; has?: boolean }
  isolated?: boolean
  git?: { branch?: string; worktree?: string; repo?: string }
  todos?: { id?: string; content: string; status: 'pending' | 'in_progress' | 'completed' }[]
  steps?: ToolStep[]
  droppedSteps?: number
  usage?: Usage
  workflow?: { runId: string; agentIndex: number }
}
export type OfficeAgent = AgentRecord & { subagentType: string }

declare module 'claude-code' {
  interface PluginState {
    'agent-office': { agents: OfficeAgent[]; open: boolean; collapsed: string[]; selected: string; view: string; mode: string; searching: boolean; filter: string; sort: string; cols: number; sid: string; modeChosen: boolean; query: string; expanded: string[]; attach: string; sessionTokens: number | null; sessionUsd: number | null; sessionTool: { tool?: string; recent?: string[] } }
  }
}
