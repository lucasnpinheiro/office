import { test, expect } from 'claude-code/testing'
import { applyTool, bashExternal, classifyTool, countsText, dependencies, endedAtFrom, isLaunchAck, launchedAgentId, worktreeOf, programOf, toolLabel, noteTool, shotFrom, pruneShots } from './stats'
import type { AgentLike } from './office'

const T0 = 1_000_000
const mk = (over: Partial<AgentLike> = {}): AgentLike => ({
  id: 'a', agentId: 'g1', description: '🛠️ Pleno·padrao·sonnet·low: corrigir bug', status: 'working', startedAt: T0, ...over,
})

test('0s bug: async_launched is a launch ack, not the end; real duration is kept', () => {
  expect(isLaunchAck({ status: 'async_launched', agentId: 'g1' })).toBe(true)
  expect(isLaunchAck({ status: 'completed', totalDurationMs: 5000 })).toBe(false)
  expect(endedAtFrom(mk(), { status: 'completed', totalDurationMs: 42_000 }, T0 + 99)).toBe(T0 + 42_000)
  expect(endedAtFrom(mk(), { status: 'completed' }, T0 + 99)).toBe(T0 + 99)
})

test('MCP calls group by server; web and local stay separate', () => {
  let a = mk()
  for (const t of ['mcp__laya__laya_predict', 'mcp__laya__laya_classify', 'mcp__laya__laya_health', 'mcp__claude-in-chrome__navigate', 'mcp__claude-in-chrome__computer']) a = applyTool(a, t, {})
  a = applyTool(a, 'WebFetch', { url: 'x' })
  a = applyTool(a, 'Read', { file_path: '/a/b.ts' })
  a = applyTool(a, 'Grep', {})
  expect(a.mcp).toEqual({ laya: 3, 'claude-in-chrome': 2 })
  expect(countsText(a.mcp)).toBe('laya ×3, claude-in-chrome ×2')
  expect(a.web).toEqual({ WebFetch: 1 })
  expect(a.local).toBe(2)
  expect(classifyTool('mcp__plugin_cloudflare_cloudflare__docs').kind).toBe('mcp')
})

test('external Bash detection: network commands yes, local no', () => {
  expect(bashExternal('curl -s https://x.io | jq .')).toBe('curl')
  expect(bashExternal('cd a && git push origin main')).toBe('git push')
  expect(bashExternal('rtk gh pr list')).toBe('gh')
  expect(bashExternal('ls -la && git status && grep curl file')).toBeUndefined()
  expect(bashExternal('bun test')).toBeUndefined()
  expect(classifyTool('Bash', { command: 'wget http://a' })).toEqual({ kind: 'web', name: 'wget' })
  expect(classifyTool('Bash', { command: 'ls' }).kind).toBe('local')
})

test('files touched come from Edit/Write paths, deduped', () => {
  let a = mk()
  a = applyTool(a, 'Edit', { file_path: '/p/x.php' })
  a = applyTool(a, 'Write', { file_path: '/p/y.php' })
  a = applyTool(a, 'Edit', { file_path: '/p/x.php' })
  a = applyTool(a, 'Read', { file_path: '/p/z.php' })
  expect(a.files).toEqual(['/p/x.php', '/p/y.php'])
  expect(a.local).toBe(4)
})

test('pendencias from TodoWrite and TaskCreate/TaskUpdate', () => {
  let a = applyTool(mk(), 'TodoWrite', { todos: [{ content: 'A', status: 'completed' }, { content: 'B', status: 'pending' }] })
  expect(a.todos?.map(t => t.status)).toEqual(['completed', 'pending'])
  a = applyTool(mk(), 'TaskCreate', { subject: 'T1' }, { task: { id: '7', subject: 'T1' } })
  expect(a.todos).toEqual([{ id: '7', content: 'T1', status: 'pending' }])
  a = applyTool(a, 'TaskUpdate', { taskId: '7', status: 'in_progress' })
  expect(a.todos?.[0]?.status).toBe('in_progress')
  a = applyTool(a, 'TaskUpdate', { taskId: '7', status: 'deleted' })
  expect(a.todos).toEqual([])
})

test('dependencias: parent and children it waits on', () => {
  const parent = mk({ id: 'p', agentId: 'g0', description: '🧠 Especialista·profundo·opus·low: plano' })
  const kid = mk({ id: 'k', agentId: 'g2', parentAgentId: 'g0' })
  const done = mk({ id: 'd', agentId: 'g3', parentAgentId: 'g0', status: 'done', endedAt: T0 + 1 })
  const all = [parent, kid, done]
  expect(dependencies(kid, all).parent).toBe('Especialista')
  expect(dependencies(parent, all).parent).toBe('VOCE')
  expect(dependencies(parent, all).waitingOn.map(x => x.id)).toEqual(['k'])
})

test('endedAtFrom ignores a zero/absent measured duration', () => {
  const a = { id: 'x', description: 'd', status: 'working' as const, startedAt: 1000 }
  expect(endedAtFrom(a, { totalDurationMs: 0 }, 9000)).toBe(9000)
  expect(endedAtFrom(a, { totalDurationMs: 500 }, 9000)).toBe(1500)
})

test('blue-box bug: launch ack arrives wrapped as { ref, result, text }, not bare', () => {
  const wrapped = { ref: 'r', text: 'Async agent launched', result: { status: 'async_launched', isAsync: true, agentId: 'ab12', outputFile: '/x' } }
  expect(isLaunchAck(wrapped)).toBe(true)
  expect(launchedAgentId(wrapped)).toBe('ab12')
  expect(isLaunchAck({ ref: 'r', text: 't', result: { status: 'completed', totalDurationMs: 5000 } })).toBe(false)
  expect(endedAtFrom(mk(), { ref: 'r', text: 't', result: { status: 'completed', totalDurationMs: 42_000 } }, T0 + 99)).toBe(T0 + 42_000)
  expect(isLaunchAck(undefined)).toBe(false)
})

test('worktree: Agent result path/branch, file path inside .claude/worktrees, EnterWorktree', () => {
  expect(worktreeOf({ ref: 'r', result: { status: 'completed', worktreePath: '/r/app/.claude/worktrees/a', worktreeBranch: 'wt-a' } })).toEqual({ path: '/r/app/.claude/worktrees/a', branch: 'wt-a' })
  expect(worktreeOf({ result: { status: 'async_launched' } })).toBeUndefined()
  const a = applyTool(mk(), 'Edit', { file_path: '/r/app/.claude/worktrees/wt-9/src/x.php' })
  expect(a.cwd).toBe('/r/app/.claude/worktrees/wt-9')
  expect(applyTool(mk({ cwd: '/keep' }), 'Read', { file_path: '/r/app/src/x.php' }).cwd).toBe('/keep')
})

test('programOf: first real program, no rtk/env/sudo/cd noise, no args', () => {
  expect(programOf('rtk docker compose ps')).toBe('docker')
  expect(programOf('rtk proxy ls -la /x')).toBe('ls')
  expect(programOf('FOO=1 BAR=2 sudo find . -name "*.php"')).toBe('find')
  expect(programOf('cd /a/b && rtk git status | head')).toBe('git')
  expect(programOf('cat x | grep y')).toBe('cat')
  expect(programOf('/usr/bin/curl -H "Authorization: Bearer s3cret" https://a.b')).toBe('curl')
  expect(programOf('')).toBeUndefined()
  expect(programOf('cd /only')).toBe('cd')
})

test('toolLabel: Claude tools by name with a short hint, MCP shortened, Bash = program only', () => {
  expect(toolLabel('Read', { file_path: '/a/b/Foo.php' })).toBe('Read Foo.php')
  expect(toolLabel('Write', { file_path: '/a/b/x.ts' })).toBe('Write x.ts')
  expect(toolLabel('WebFetch', { url: 'https://example.com/p?token=abc' })).toBe('WebFetch example.com')
  expect(toolLabel('mcp__claude-in-chrome__navigate', {})).toBe('chrome:navigate')
  expect(toolLabel('mcp__laya__laya_predict', {})).toBe('laya:laya_predict')
  expect(toolLabel('Bash', { command: 'rtk docker compose ps --secret=zzz' })).toBe('docker')
  expect(toolLabel('Grep', { pattern: 'secret' })).toBe('Grep')
})

test('noteTool: current tool + last 3 distinct actions, consecutive repeats collapse', () => {
  let a = mk()
  for (const [t, i] of [['Read', { file_path: '/a/1.ts' }], ['Read', { file_path: '/a/1.ts' }], ['Bash', { command: 'ls' }], ['Grep', {}], ['Write', { file_path: '/a/2.ts' }]] as [string, Record<string, unknown>][]) a = noteTool(a, t, i)
  expect(a.tool).toBe('Write 2.ts')
  expect(a.recent).toEqual(['ls', 'Grep', 'Write 2.ts'])
  expect(applyTool(mk(), 'Bash', { command: 'docker ps' }).tool).toBe('docker')
})

test('shotFrom: image block of a browser MCP tool -> png + host; other tools/blocks -> nothing', () => {
  const res = { ref: 'r', result: { isError: false, content: [{ type: 'text', text: 'Screenshot of https://shop.example.com/cart?token=zz' }, { type: 'image', mimeType: 'image/png', data: 'AAAA' }] } }
  expect(shotFrom('mcp__claude-in-chrome__computer', {}, res)).toEqual({ png: 'AAAA', host: 'shop.example.com' })
  expect(shotFrom('mcp__claude-in-chrome__navigate', { url: 'https://a.io/x' }, { result: { content: [{ type: 'text', text: 'ok' }] } })).toEqual({ host: 'a.io' })
  expect(shotFrom('Bash', { command: 'ls' }, res)).toBeUndefined()
  expect(shotFrom('mcp__laya__laya_predict', {}, res)).toBeUndefined()
  // jpeg cannot go in an Image (png only): text-only degrade, bytes dropped
  expect(shotFrom('mcp__claude-in-chrome__computer', {}, { result: { content: [{ type: 'image', mimeType: 'image/jpeg', data: 'BBBB' }] } })).toBeUndefined()
  // over the 2 MiB decoded cap: dropped
  expect(shotFrom('mcp__claude-in-chrome__computer', {}, { result: { content: [{ type: 'image', mimeType: 'image/png', data: 'A'.repeat(3_000_000) }] } })).toBeUndefined()
})

test('pruneShots: keeps bytes only for working agents', () => {
  const m = new Map([['a', 'x'], ['b', 'y'], ['gone', 'z']])
  pruneShots(m, [mk({ id: 'a' }), mk({ id: 'b', status: 'done', endedAt: 1 })])
  expect([...m.keys()]).toEqual(['a'])
})
