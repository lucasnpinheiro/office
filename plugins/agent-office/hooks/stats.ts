// Per-agent facts gathered from real hook payloads (tool.call, agent.spawn, SubagentStop).
// Pure (no engine APIs) so it is unit-testable. Nothing here is invented: every field
// comes from a tool call's name/arguments or from the Agent tool's own result.
import type { AgentLike } from './office'
import { parseDescription } from './persona'
import { worktreeFromPath } from './git'

export type Todo = { id?: string; content: string; status: 'pending' | 'in_progress' | 'completed' }
export type Counts = Record<string, number>

export type ToolKind = { kind: 'mcp'; name: string } | { kind: 'web'; name: string } | { kind: 'local'; name: string }

const NET_CMDS = new Set(['curl', 'wget', 'ssh', 'scp', 'rsync', 'sftp', 'ftp', 'nc', 'ping', 'dig', 'nslookup'])
const GIT_NET = new Set(['push', 'pull', 'fetch', 'clone', 'ls-remote'])

// Name of the external command in a shell line that reaches outside the machine, if any.
// Heuristic by leading command of each pipeline segment (curl/wget/ssh/gh/git push...).
export function bashExternal(command: string): string | undefined {
  for (const raw of (command || '').split(/&&|\|\||;|\||\n/)) {
    const words = raw.trim().split(/\s+/).filter(w => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(w) && w !== 'sudo' && w !== 'rtk' && w !== 'time')
    const w = words[0]
    if (!w) continue
    const cmd = w.split('/').pop() ?? w
    if (NET_CMDS.has(cmd)) return cmd
    if (cmd === 'gh') return 'gh'
    if (cmd === 'git' && words.some(x => GIT_NET.has(x))) return `git ${words.find(x => GIT_NET.has(x))}`
    if ((cmd === 'npm' || cmd === 'pnpm' || cmd === 'docker') && (words.includes('publish') || words.includes('push') || words.includes('pull')))
      return `${cmd} ${words.find(x => x === 'publish' || x === 'push' || x === 'pull')}`
  }
  return undefined
}

export function classifyTool(tool: string, input: Record<string, unknown> = {}): ToolKind {
  if (tool.startsWith('mcp__')) return { kind: 'mcp', name: tool.split('__')[1] || 'mcp' }
  if (tool === 'WebFetch' || tool === 'WebSearch') return { kind: 'web', name: tool }
  if (tool === 'Bash') {
    const ext = bashExternal(String(input.command ?? ''))
    if (ext) return { kind: 'web', name: ext }
  }
  return { kind: 'local', name: tool }
}

const WRAPPERS = new Set(['sudo', 'rtk', 'proxy', 'time', 'command', 'env', 'nohup'])

// First real program of a shell line: skips rtk/proxy/sudo/env assignments and leading `cd X &&`.
// Name only, never arguments (they can carry secrets).
export function programOf(command: string): string | undefined {
  let first: string | undefined
  for (const raw of (command || '').split(/&&|\|\||;|\||\n/)) {
    const words = raw.trim().split(/\s+/).filter(w => w && !/^[A-Za-z_][A-Za-z0-9_]*=/.test(w) && !WRAPPERS.has(w))
    const w = words[0]
    if (!w) continue
    const prog = w.split('/').pop() || w
    first ??= prog
    if (prog !== 'cd') return prog
  }
  return first
}

const base = (p: unknown): string => (typeof p === 'string' ? p.split('/').pop() ?? '' : '')
const hostOf = (u: unknown): string => { const m = /^[a-z]+:\/\/([^/:?#]+)/i.exec(String(u ?? '')); return m?.[1] ?? '' }

// Short, secret-free label of one tool call: "Read Foo.php", "WebFetch host", "chrome:navigate", "docker".
export function toolLabel(tool: string, input: Record<string, unknown> = {}): string {
  if (tool.startsWith('mcp__')) {
    const [, server, ...rest] = tool.split('__')
    return `${(server ?? 'mcp').replace(/^claude-in-/, '')}:${rest.join('__') || 'call'}`
  }
  if (tool === 'Bash') return programOf(String(input.command ?? '')) ?? 'Bash'
  const hint = tool === 'WebFetch' ? hostOf(input.url)
    : ['Read', 'Write', 'Edit', 'MultiEdit', 'NotebookEdit'].includes(tool) ? base(input.file_path ?? input.notebook_path) : ''
  return hint ? `${tool} ${hint}` : tool
}

// Current tool + last 3 distinct actions of an agent (consecutive repeats collapse).
export function noteTool(a: AgentLike, tool: string, input: Record<string, unknown> = {}): AgentLike {
  const label = toolLabel(tool, input)
  const prev = a.recent ?? []
  const recent = prev[prev.length - 1] === label ? prev : [...prev, label].slice(-3)
  return { ...a, tool: label, recent }
}

const bump = (c: Counts | undefined, k: string): Counts => ({ ...(c ?? {}), [k]: ((c ?? {})[k] ?? 0) + 1 })

// Pure reducer: fold one tool call (and its result, when known) into the agent record.
export function applyTool(a: AgentLike, tool: string, input: Record<string, unknown>, result?: unknown): AgentLike {
  const k = classifyTool(tool, input)
  const out: AgentLike = noteTool(a, tool, input)
  if (k.kind === 'mcp') out.mcp = bump(a.mcp, k.name)
  else if (k.kind === 'web') out.web = bump(a.web, k.name)
  else out.local = (a.local ?? 0) + 1
  const path = typeof input.file_path === 'string' ? input.file_path : typeof input.notebook_path === 'string' ? input.notebook_path : undefined
  if (path && (tool === 'Edit' || tool === 'Write' || tool === 'NotebookEdit' || tool === 'MultiEdit') && !(a.files ?? []).includes(path))
    out.files = [...(a.files ?? []), path].slice(-50)
  if (!a.cwd && path) { const wt = worktreeFromPath(path); if (wt) out.cwd = wt }
  if (tool === 'TodoWrite' && Array.isArray(input.todos))
    out.todos = (input.todos as { content?: string; status?: Todo['status'] }[]).map(t => ({ content: String(t.content ?? ''), status: t.status ?? 'pending' }))
  if (tool === 'TaskCreate' && typeof input.subject === 'string') {
    const id = (result as { task?: { id?: string } } | undefined)?.task?.id
    out.todos = [...(a.todos ?? []), { id, content: input.subject, status: 'pending' }]
  }
  if (tool === 'TaskUpdate' && typeof input.taskId === 'string') {
    const list = a.todos ?? []
    out.todos = list
      .filter(t => !(t.id === input.taskId && input.status === 'deleted'))
      .map(t => (t.id === input.taskId ? { ...t, content: typeof input.subject === 'string' ? input.subject : t.content, status: (input.status as Todo['status'] | undefined) && input.status !== 'deleted' ? (input.status as Todo['status']) : t.status } : t))
  }
  return out
}

// `next(e)` of tool.call resolves to `{ ref, result, text }`: the Agent tool's own record sits under `result`.
// Accept the bare record too (tests, older engines).
export function agentRecord(res: unknown): { status?: string; isAsync?: boolean; agentId?: string; totalDurationMs?: number } {
  const r = res as { result?: unknown } | undefined
  const inner = r && typeof r === 'object' && r.result && typeof r.result === 'object' ? r.result : r
  return (inner && typeof inner === 'object' ? inner : {}) as ReturnType<typeof agentRecord>
}

// The Agent tool answers `async_launched` at once for a background subagent: that is a launch ack,
// not the end of the agent (SubagentStop is). Reading it off the wrapper (`res.status`) never matched, so every
// background agent was closed at launch and left the map 30s later while still running.
export function isLaunchAck(res: unknown): boolean {
  const r = agentRecord(res)
  return r.status === 'async_launched' || r.isAsync === true
}

// Worktree an Agent (isolation: "worktree") or EnterWorktree call reports in its result, when it has one.
export function worktreeOf(res: unknown): { path: string; branch?: string } | undefined {
  const r = agentRecord(res) as { worktreePath?: string; worktreeBranch?: string }
  return typeof r.worktreePath === 'string' && r.worktreePath ? { path: r.worktreePath, branch: r.worktreeBranch } : undefined
}

// Id of the background agent named by a launch ack, so SubagentStop can match it.
export const launchedAgentId = (res: unknown): string | undefined => {
  const id = agentRecord(res).agentId
  return typeof id === 'string' && id ? id : undefined
}

// End timestamp for an Agent tool result: the tool's own measured duration when it gives one.
export function endedAtFrom(a: AgentLike, res: unknown, now: number): number {
  const ms = agentRecord(res).totalDurationMs
  return typeof ms === 'number' && ms > 0 ? a.startedAt + ms : Math.max(now, a.startedAt)
}

export const firstLine = (s: string | undefined, max = 160): string => {
  const l = (s ?? '').split('\n').find(x => x.trim() !== '') ?? ''
  return l.trim().slice(0, max)
}

const sumCounts = (c: Counts | undefined) => Object.values(c ?? {}).reduce((n, v) => n + v, 0)
export const countsText = (c: Counts | undefined): string =>
  Object.entries(c ?? {}).sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])).map(([k, v]) => `${k} ×${v}`).join(', ')

// Parent (who spawned it) and the children it still waits on.
export function dependencies(a: AgentLike, all: AgentLike[]): { parent: string; waitingOn: AgentLike[] } {
  const par = a.parentAgentId ? all.find(x => x.agentId === a.parentAgentId) : undefined
  const parent = par ? parseDescription(par.description).persona.name : 'VOCE'
  const waitingOn = a.agentId ? all.filter(x => x.parentAgentId === a.agentId && x.status === 'working') : []
  return { parent, waitingOn }
}

// ---------- browser thumbnail (opt-in) ----------
export const MAX_SHOT_B64 = 2_796_203 // 2 MiB decoded, the Image `png` source limit

export const isBrowserTool = (tool: string): boolean => /^mcp__[^_]*(chrome|playwright|browser|puppeteer)/i.test(tool)

const hostIn = (t: unknown): string => /https?:\/\/([^/\s:?#]+)/i.exec(String(t ?? ''))?.[1] ?? ''

// Facts a browser MCP result gives: a PNG image block (base64) and the page host. Never the page text/title
// (may hold PII); only a host name. JPEG or oversize images are dropped (text-only degrade).
export function shotFrom(tool: string, input: Record<string, unknown> = {}, res?: unknown): { png?: string; host?: string } | undefined {
  if (!isBrowserTool(tool)) return undefined
  const content = ((agentRecord(res) as { content?: unknown }).content ?? []) as { type?: string; text?: string; mimeType?: string; data?: string }[]
  const blocks = Array.isArray(content) ? content : []
  const img = blocks.find(b => b?.type === 'image' && b.mimeType === 'image/png' && typeof b.data === 'string' && b.data.length > 0 && b.data.length <= MAX_SHOT_B64)
  const host = hostIn(input.url) || hostIn(blocks.map(b => b?.text ?? '').join(' '))
  if (!img && !host) return undefined
  return { ...(img ? { png: img.data } : {}), ...(host ? { host } : {}) }
}

// Drop picture bytes of every agent that is not working any more (done, failed, gone).
export function pruneShots(m: Map<string, string>, agents: AgentLike[]): void {
  const live = new Set(agents.filter(a => a.status === 'working').map(a => a.id))
  for (const k of [...m.keys()]) if (!live.has(k)) m.delete(k)
}
