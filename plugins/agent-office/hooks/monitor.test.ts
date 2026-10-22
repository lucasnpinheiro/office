import { test, expect } from 'claude-code/testing'
import { buildGraph, contentSize, inlineSize, MAX_INLINE_ROWS, renderMonitor, etaOf, overallProgress, maxDepthOf, STATE_COLOR, lineText, lineWidth, MAX_DEPTH, detailLines, progressBar, mixHex, breath, PULSE_FRAMES, WORKTREE_COLOR } from './monitor'
import type { AgentLike } from './office'

const T0 = 1_700_000_000_000
const D = '🛠️ Pleno · 🎼 Sonnet · 🟢 baixo'
const mk = (id: string, over: Partial<AgentLike> = {}): AgentLike => ({
  id, agentId: `g-${id}`, description: `${D}: tarefa ${id}`, status: 'working', startedAt: T0, ...over,
})
const view = (over = {}) => ({ width: 120, frame: 0, collapsed: new Set<string>(), project: 'meuapp', sessionId: 'abcdef123', ...over })
const text = (agents: AgentLike[], now = T0 + 5000, v = {}) => renderMonitor(agents, now, view(v)).lines.map(lineText).join('\n')

test('state mapping: running, done, failed, attention after 10 min idle', () => {
  const now = T0 + 11 * 60_000
  const g = buildGraph([mk('a'), mk('b', { status: 'done', endedAt: T0 + 1 }), mk('c', { status: 'error', endedAt: T0 + 1 }), mk('d', { seenAt: now - 1000 })], now)
  expect(['a', 'b', 'c', 'd'].map(i => g.nodes.get(i)!.state)).toEqual(['attention', 'done', 'failed', 'running'])
})

test('failure is red and carries an explicit cross; colors per state', () => {
  const f = renderMonitor([mk('c', { status: 'error', endedAt: T0 + 9 })], T0 + 10, view())
  const seg = f.body.flat().find(s => s.t.includes('✗'))!
  expect(seg.fg).toBe(STATE_COLOR.failed)
  expect(STATE_COLOR).toEqual({ done: '#22c55e', running: '#3b82f6', attention: '#eab308', pending: '#e5e7eb', inactive: '#6b7280', failed: '#ef4444' })
})

test('done card with a running descendant: dashed border pulsing blue/green, cascaded up the chain', () => {
  const agents = [mk('a', { status: 'done', endedAt: T0 + 1000 }), mk('b', { status: 'done', endedAt: T0 + 1000, parentAgentId: 'g-a' }), mk('c', { parentAgentId: 'g-b' })]
  const dashedTops = (frame: number) => renderMonitor(agents, T0 + 5000, view({ frame })).body.flat().filter(s => s.t.startsWith('╭') && s.t.includes('┄'))
  const f0 = dashedTops(0), f1 = dashedTops(PULSE_FRAMES / 2)
  expect(f0.length).toBe(2) // a and b: done, each with a running descendant; c runs with a plain border
  expect(f0[0]!.fg).not.toBe(f1[0]!.fg)
  expect(new Set([f0[0]!.fg, f1[0]!.fg])).toEqual(new Set([STATE_COLOR.done, STATE_COLOR.running]))
})

test('done card without running descendants keeps the plain green border', () => {
  const f = renderMonitor([mk('a', { status: 'done', endedAt: T0 + 1000 })], T0 + 5000, view({ frame: 1 }))
  expect(f.body.flat().some(s => s.t.includes('┄'))).toBe(false)
})

test('header: title, project, session, no invented progress or ETA', () => {
  const t = text([mk('a')])
  expect(t).toContain('Progresso Geral 0%') // one leaf agent, 0 of 1 done (as the Go reference)
  expect(text([])).toContain('Progresso Geral —')
  expect(t).toContain('Office Agent Monitor')
  expect(t).toContain('Claude Code · Projeto: meuapp · Sessão: #abcdef')
  expect(t).toContain('Decorrido 00:00:05')
  expect(t).toContain('ETA indisponível')
  expect(text([])).toContain('Decorrido —')
})

test('ETA: mean of finished durations x remaining; <2 samples unavailable', () => {
  const one = [mk('a', { status: 'done', endedAt: T0 + 60_000 }), mk('b')]
  expect(etaOf(buildGraph(one, T0 + 1))).toBeUndefined()
  const two = [mk('a', { status: 'done', endedAt: T0 + 60_000 }), mk('b', { status: 'done', endedAt: T0 + 120_000 }), mk('c'), mk('d')]
  expect(etaOf(buildGraph(two, T0 + 1))).toBe(90_000 * 2)
  expect(text(two, T0 + 130_000)).toContain('Estimativa 00:03:00')
})

test('progress is done leaves / leaves, from todos; none without evidence', () => {
  expect(overallProgress(buildGraph([], T0))).toBeUndefined()
  expect(overallProgress(buildGraph([mk('a'), mk('b', { status: 'done', endedAt: T0 + 1 })], T0))).toBe(0.5)
  const a = mk('a', { todos: [{ content: 'x', status: 'completed' }, { content: 'y', status: 'in_progress' }, { content: 'z', status: 'pending' }, { content: 'w', status: 'pending' }] })
  const g = buildGraph([a], T0)
  expect(overallProgress(g)).toBe(0.25)
  const t = text([a])
  expect(t).toContain('Progresso Geral 25%')
  expect(t).toContain('┄▶ depende de x') // todo order dependency
})

test('mind map: top-down tree, root above, siblings on one row, card shows task and persona', () => {
  const rows = text([mk('a'), mk('b')]).split('\n')
  const rRoot = rows.findIndex(l => l.includes('Claude Code') && !l.includes('Projeto'))
  const rA = rows.findIndex(l => l.includes('tarefa a'))
  const rB = rows.findIndex(l => l.includes('tarefa b'))
  expect(rRoot).toBeGreaterThan(-1)
  expect(rA).toBeGreaterThan(rRoot)
  expect(rB).toBe(rA)
  expect(rows[rA]!.indexOf('tarefa a')).toBeLessThan(rows[rA]!.indexOf('tarefa b'))
  const t = rows.join('\n')
  expect(t).toContain('Orquestrador')
  expect(t).toContain('Pleno · Sonnet')
  expect(t).toMatch(/╭━*┴━*╮/) // fan-out bus: trunk meets the bus, drops at each child
  const nested = text([mk('a'), mk('b', { parentAgentId: 'g-a' })]).split('\n')
  expect(nested.findIndex(l => l.includes('tarefa b'))).toBeGreaterThan(nested.findIndex(l => l.includes('tarefa a')))
})

test('completed agents hide 30s after they finish; running ones stay', () => {
  const done = mk('d', { status: 'done', endedAt: T0 + 1000 })
  expect(text([done, mk('r')], T0 + 20_000)).toContain('tarefa d')
  const late = text([done, mk('r')], T0 + 1000 + 30_001)
  expect(late).not.toContain('tarefa d')
  expect(late).toContain('tarefa r')
  expect(text([done], T0 + 40_000)).not.toContain('tarefa d')
  // a finished parent with a still-running child stays visible
  const p = mk('p', { status: 'done', endedAt: T0 + 1000 })
  expect(text([p, mk('c', { parentAgentId: 'g-p' })], T0 + 60_000)).toContain('tarefa p')
})

test('counters: finished leaf shows 100% and real duration; running leaf 0%', () => {
  const t = text([mk('a', { status: 'done', endedAt: T0 + 12_000 }), mk('b')], T0 + 20_000)
  expect(t).toContain('100% 00:12')
  expect(t).not.toContain('—')
  expect(t).toContain('0%  ')
})

test('counters: overall is not 100% while an agent still runs', () => {
  const agents = [mk('a', { status: 'done', endedAt: T0 + 1000 }), mk('p'), mk('c', { parentAgentId: 'g-p', status: 'done', endedAt: T0 + 2000 })]
  const g = buildGraph(agents, T0 + 5000)
  expect(overallProgress(g)).toBeLessThan(1)
})

test('counters: orchestrator clock equals header Decorrido', () => {
  const t = text([mk('a', { status: 'done', endedAt: T0 + 33_000 }), mk('b', { startedAt: T0 + 1000 })], T0 + 46_000)
  expect(t).toContain('Decorrido 00:00:46')
  const row = t.split('\n').find(l => l.includes('00:46') && l.includes('%'))
  expect(row).toBeDefined()
})

test('counters: no Estimativa 00:00:00 when nothing is left to estimate', () => {
  const all = [mk('a', { status: 'done', endedAt: T0 + 60_000 }), mk('b', { status: 'done', endedAt: T0 + 120_000 })]
  expect(etaOf(buildGraph(all, T0 + 130_000))).toBeUndefined()
  expect(text(all, T0 + 130_000)).not.toContain('Estimativa 00:00:00')
})

test('legend wraps instead of truncating on narrow panes', () => {
  const t = text([mk('a')], T0 + 5000, { width: 50 })
  for (const w of ['Concluído', 'Executando', 'Atenção', 'Pendente', 'Inativo', 'Falha']) expect(t).toContain(w)
})

test('depth clamps at 10 and the footer shows N/10 and the legend', () => {
  const chain = Array.from({ length: 14 }, (_, i) => mk(`n${i}`, { parentAgentId: i ? `g-n${i - 1}` : undefined }))
  const g = buildGraph(chain, T0)
  expect(maxDepthOf(g)).toBe(MAX_DEPTH)
  const t = text(chain, T0, { width: 300 })
  expect(t).toContain('Níveis de profundidade: 10/10')
  expect(t).toContain('● Concluído  ┄ Concluído · aguarda filhos  ● Executando  ● Atenção  ● Pendente  ● Inativo  ✗ Falha')
  expect(text([mk('a')])).toContain('Níveis de profundidade: 1/10')
})

test('collapse hides the branch and shows +N', () => {
  const agents = [mk('a'), mk('b', { parentAgentId: 'g-a' }), mk('c', { parentAgentId: 'g-a' })]
  expect(text(agents)).toContain('tarefa b')
  const t = text(agents, T0 + 5000, { collapsed: new Set(['a']) })
  expect(t).not.toContain('tarefa b')
  expect(t).toContain('+2')
})

test('width clamp: no line exceeds the pane, narrow panes still render', () => {
  const agents = [mk('a'), mk('b', { parentAgentId: 'g-a' }), mk('c', { parentAgentId: 'g-b', todos: [{ content: 'uma tarefa muito longa que nao cabe', status: 'pending' }] })]
  for (const width of [30, 60, 80, 120]) {
    const f = renderMonitor(agents, T0 + 5000, view({ width }))
    for (const l of f.lines) expect(lineWidth(l)).toBeLessThanOrEqual(width)
  }
})

test('animation: moving glyph changes with the frame only when something runs', () => {
  const running = [mk('a'), mk('b', { parentAgentId: 'g-a' }), mk('c', { parentAgentId: 'g-a' })]
  const frames = new Set([0, 1, 2, 3].map(f => renderMonitor(running, T0 + 5000, view({ frame: f })).lines.map(lineText).join('\n')))
  expect(frames.size).toBeGreaterThan(1)
  const done = running.map(a => ({ ...a, status: 'done' as const, endedAt: T0 + 1000 }))
  const still = new Set([0, 1, 2, 3].map(f => renderMonitor(done, T0 + 5000, view({ frame: f })).lines.map(lineText).join('\n')))
  expect(still.size).toBe(1)
})

test('flow: bus sits right under the trunk, no empty drop row before the child cards', () => {
  const rows = text([mk('a'), mk('b')]).split('\n')
  const bus = rows.findIndex(l => /╭━*┴━*╮|╭─*┴─*╮/.test(l))
  expect(bus).toBeGreaterThan(-1)
  expect(rows[bus + 1]).toContain('╭──') // child card top border directly below the bus
  expect(rows[bus - 1]!.trim()).toMatch(/^[┃│•]$/) // single trunk glyph above
})

test('contentSize: rows = rendered lines, columns = widest line, within bounds', () => {
  const agents = [mk('a'), mk('b')]
  const f = renderMonitor(agents, T0 + 5000, view({ width: 100 })) // contentSize lays out at <=100 cols
  const s = contentSize(agents, T0 + 5000, view({ width: 120 }))
  expect(s.rows).toBe(f.lines.length)
  expect(s.columns).toBeGreaterThanOrEqual(40)
  expect(s.columns).toBeLessThanOrEqual(120)
  const one = contentSize([mk('a')], T0 + 5000, view())
  expect(one.rows).toBeLessThan(s.rows + 1)
  expect(contentSize([], T0, view()).columns).toBeGreaterThanOrEqual(40)
})

test('inlineSize: rows capped at MAX_INLINE_ROWS, columns within bounds', () => {
  const many = Array.from({ length: 40 }, (_, i) => mk(`x${i}`))
  const big = inlineSize(many, T0 + 5000, view({ width: 120 }))
  expect(big.rows).toBe(MAX_INLINE_ROWS)
  expect(big.columns).toBeGreaterThanOrEqual(40)
  expect(big.columns).toBeLessThanOrEqual(120)
  const small = inlineSize([mk('a')], T0 + 5000, view())
  expect(small.rows).toBe(contentSize([mk('a')], T0 + 5000, view()).rows)
  expect(Number.isInteger(small.rows) && small.rows > 0).toBe(true)
})

test('card: persona line carries model and effort chips; label falls back to prompt', () => {
  const t = text([mk('a'), mk('b', { description: '🧭 Squad Leader · 🎼 Sonnet · 🟡 médio:', prompt: 'Executar SPEC-025' })])
  expect(t).toContain('Pleno · Sonnet · baixo')
  expect(t).toContain('Squad Leader')
  expect(t).toContain('Executar SPEC-025')
})

test('blue-box bug: a running background agent stays on the map past 30s', () => {
  const a = mk('a', { description: `${D}: Checking StoreContextCache` })
  expect(text([a], T0 + 120_000)).toContain('Checking StoreContext')
  expect(text([a], T0 + 120_000)).not.toContain('agentes ocultos')
})

test('git: card shows branch; worktree marker; other repo prefixed; long names truncated', () => {
  const main = { branch: 'main', repo: '/r/app' }
  const t = text([
    mk('a', { git: main }),
    mk('b', { git: { branch: 'feat/spec-025-close', worktree: 'wt-1', repo: '/r/app' } }),
    mk('c', { git: { branch: 'dev', repo: '/r/other' } }),
  ], T0 + 5000, { git: main })
  expect(t).toContain('⎇ main')
  expect(t).toContain('⧉ wt-1')
  expect(t).toContain('other:dev')
  const lines = t.split('\n')
  expect(lines.every(l => [...l].length <= 120)).toBe(true)
  const none = text([mk('a')])
  expect(none).not.toContain('⎇')
})

test('git: session card carries the session branch, worktree in the same repo is not a new project', () => {
  const g = buildGraph([mk('a', { git: { branch: 'feat/x', worktree: 'wt', repo: '/r/app' } })], T0, { branch: 'main', repo: '/r/app' })
  expect(g.root.git?.branch).toBe('main')
  expect(g.nodes.get('a')!.git?.repo).toBe('/r/app')
})

test('tool line: running card shows current tool and trail; done card hides it; session card too', () => {
  const run = mk('a', { tool: 'docker', recent: ['Read x.ts', 'ls', 'docker'] })
  const t = text([run])
  expect(t).toContain('▸ docker')
  expect(t).toContain('ls')
  const done = text([mk('a', { status: 'done', endedAt: T0 + 1, tool: 'docker', recent: ['docker'] })])
  expect(done).not.toContain('▸ docker')
  expect(text([mk('b')])).not.toContain('▸')
  expect(text([mk('b')], T0 + 5000, { sessionTool: { tool: 'Read', recent: ['Read'] } })).toContain('▸ Read')
  expect(text([run], T0 + 5000).split('\n').every(l => [...l].length <= 120)).toBe(true)
})

test('thumbs OFF (default): no shot line, no thumbs, size unchanged', () => {
  const a = mk('a', { shot: { host: 'shop.example.com', has: true } })
  const f = renderMonitor([a], T0 + 5000, view())
  expect(f.lines.map(lineText).join('\n')).not.toContain('▣')
  expect(f.thumbs).toEqual([])
  expect(inlineSize([a], T0 + 5000, view()).rows).toBe(inlineSize([mk('a')], T0 + 5000, view()).rows)
})

test('thumbs ON: running browser card gets host line and a thumb slot; rows counted; done hides it', () => {
  const a = mk('a', { shot: { host: 'shop.example.com', has: true } })
  const on = view({ thumbs: true })
  const f = renderMonitor([a], T0 + 5000, on)
  expect(f.lines.map(lineText).join('\n')).toContain('▣ shop.example.com')
  expect(f.thumbs.length).toBe(1)
  expect(f.thumbs[0]!.columns).toBe(12)
  expect(f.thumbs[0]!.rows).toBe(5)
  expect(f.thumbs[0]!.alt).toBe('[tela: shop.example.com]')
  expect(inlineSize([a], T0 + 5000, on).rows).toBe(inlineSize([mk('a')], T0 + 5000, on).rows + 1 + 1 + 5)
  // host only (no bytes): text line, no thumb slot
  const t = renderMonitor([mk('a', { shot: { host: 'h.io' } })], T0 + 5000, on)
  expect(t.thumbs.length).toBe(0)
  expect(t.lines.map(lineText).join('\n')).toContain('▣ h.io')
  const d = renderMonitor([mk('a', { status: 'done', endedAt: T0 + 1, shot: { host: 'h.io', has: true } })], T0 + 5000, on)
  expect(d.thumbs.length).toBe(0)
  expect(d.lines.map(lineText).join('\n')).not.toContain('▣')
})

test('tree is centered in a wide pane: equal left/right margin around the card', () => {
  const f = renderMonitor([mk('a')], T0 + 5000, view({ width: 80 }))
  const top = f.body.map(lineText).find(t => t.includes('╭'))!
  const left = [...top].findIndex(ch => ch === '╭')
  const cardW = [...top.trimEnd()].length - left
  const right = 80 - left - cardW
  expect(Math.abs(left - right)).toBeLessThanOrEqual(1)
})

test('tree keeps left alignment when the pane is narrower than the content', () => {
  const f = renderMonitor([mk('a')], T0 + 5000, view({ width: 20 }))
  const top = f.body.map(lineText).find(t => t.includes('╭'))!
  expect([...top].findIndex(ch => ch === '╭')).toBe(0)
})

test('card name and persona segments carry the node id (clickable); branch toggle only with children', () => {
  const f = renderMonitor([mk('a'), mk('b', { parentAgentId: 'g-a' })], T0 + 5000, view())
  const segs = f.body.flat()
  expect(segs.some(s => s.node === 'a' && s.t.includes('tarefa a'))).toBe(true)
  expect(segs.some(s => s.node === 'b' && s.t.includes('Pleno'))).toBe(true)
  expect(segs.filter(s => s.toggle === 'a').length).toBe(1)
  expect(segs.filter(s => s.toggle === 'b').length).toBe(0)
})

test('detailLines: persona, state, prompt, todos of one agent; undefined for unknown id and session', () => {
  const a = mk('a', { prompt: 'faça X\ndepois Y', todos: [{ content: 'passo 1', status: 'completed' }], recent: ['Read', 'Edit'], files: ['a.ts'] })
  const d = detailLines([a], 'a', T0 + 5000)!.map(lineText).join('\n')
  expect(d).toContain('Pleno')
  expect(d).toContain('tarefa a')
  expect(d).toContain('faça X')
  expect(d).toContain('depois Y')
  expect(d).toContain('passo 1')
  expect(d).toContain('a.ts')
  expect(detailLines([a], 'zzz', T0)).toBeUndefined()
  expect(detailLines([a], 'session', T0)).toBeUndefined()
})

test('task node inherits persona/model/effort from its agent', () => {
  const g = buildGraph([mk('a', { todos: [{ content: 't1', status: 'pending' }] })], T0 + 1000)
  const t = g.nodes.get('a#0')!
  expect(t.persona).toBe(g.nodes.get('a')!.persona)
  expect(t.model).toBe(g.nodes.get('a')!.model)
})

test('border pulse is a smooth gradient, not on/off', () => {
  const cols = new Set(Array.from({ length: PULSE_FRAMES }, (_, f) => mixHex(STATE_COLOR.done, STATE_COLOR.running, breath(f))))
  expect(cols.size).toBeGreaterThan(4)
  expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080')
  const a = [mk('a', { status: 'done', endedAt: T0 + 1 }), mk('b', { parentAgentId: 'g-a' })]
  const tops = (frame: number) => renderMonitor(a, T0 + 5000, view({ frame })).body.flat().find(s => s.t.startsWith('╭') && s.t.includes('┄'))!.fg
  expect(tops(1)).not.toBe(tops(0))
  expect(tops(1)).not.toBe(STATE_COLOR.running)
})

test('worktree card: purple tag, purple worktree line, legend item; plain repo card has none', () => {
  const wt = mk('a', { git: { branch: 'feat/x', worktree: 'wt-1', repo: '/r' } })
  const f = renderMonitor([wt], T0 + 5000, view())
  const segs = f.body.flat()
  expect(segs.some(s => s.t.includes('⧉ worktree') && s.fg === WORKTREE_COLOR)).toBe(true)
  expect(segs.some(s => s.t.includes('⧉ wt-1') && s.fg === WORKTREE_COLOR)).toBe(true)
  expect(f.footer.map(lineText).join('\n')).toContain('⧉ Worktree')
  const plain = renderMonitor([mk('b', { git: { branch: 'main', repo: '/r' } })], T0 + 5000, view())
  expect(plain.body.flat().some(s => s.t.includes('⧉'))).toBe(false)
  expect(Object.values(STATE_COLOR)).not.toContain(WORKTREE_COLOR)
})

test('progressBar: ▰ filled / ▱ empty, fixed width, whole-cell steps', () => {
  expect(progressBar(0, 10)).toBe('▱'.repeat(10))
  expect(progressBar(1, 10)).toBe('▰'.repeat(10))
  expect(progressBar(0.55, 10)).toBe('▰▰▰▰▰▰▱▱▱▱')
  expect(progressBar(2, 10)).toBe('▰'.repeat(10))
  expect(progressBar(-1, 10)).toBe('▱'.repeat(10))
  expect(progressBar(0.5, 10)).toBe('▰▰▰▰▰▱▱▱▱▱')
  const bars = Array.from({ length: 11 }, (_, i) => progressBar(i / 10, 10))
  expect(new Set(bars).size).toBe(11)
  expect(bars.every(b => [...b].length === 10)).toBe(true)
})
