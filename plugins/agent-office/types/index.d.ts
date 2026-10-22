export type Status = 'working' | 'done' | 'error'
export type OfficeAgent = {
  id: string
  agentId?: string
  parentAgentId?: string
  description: string
  subagentType: string
  status: Status
  startedAt: number
  endedAt?: number
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
  shot?: { host?: string; has?: boolean }
  recent?: string[]
  isolated?: boolean
  todos?: { id?: string; content: string; status: 'pending' | 'in_progress' | 'completed' }[]
}

declare module 'claude-code' {
  interface PluginState {
    'agent-office': { agents: OfficeAgent[]; open: boolean; collapsed: string[]; selected: string; sessionTool: { tool?: string; recent?: string[] } }
  }
}
