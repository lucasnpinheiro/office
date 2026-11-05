import type { AgentRecord, Status } from '../hooks/office'
export type { Status }
export type OfficeAgent = AgentRecord & { subagentType: string } // AgentRecord é o tipo único (hooks/office.ts)

declare module 'claude-code' {
  interface PluginState {
    'agent-office': { agents: OfficeAgent[]; open: boolean; collapsed: string[]; selected: string; view: string; mode: string; searching: boolean; filter: string; sort: string; cols: number; sid: string; query: string; expanded: string[]; attach: string; sessionTool: { tool?: string; recent?: string[] } }
  }
}
