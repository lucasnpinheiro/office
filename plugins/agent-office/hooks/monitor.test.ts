import { test, expect } from 'claude-code/testing'
import { buildGraph, contentSize, inlineSize, MAX_INLINE_ROWS, renderMonitor, etaOf, overallProgress, maxDepthOf, STATE_COLOR, lineText, lineWidth, MAX_DEPTH, progressBar, mixHex, breath, PULSE_FRAMES, WORKTREE_COLOR } from './monitor'
import { detailScreen } from './view-detail'
import type { AgentLike } from './office'
import { STATE_TABLE } from './vocabulary'

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
  expect(STATE_COLOR).toEqual({ done: '#6FD08C', running: '#7FA9FF', attention: '#F2B84B', pending: '#A9ADB5', inactive: '#A9ADB5', failed: '#FF8A80' })
})

test('done card without running descendants keeps the plain green border', () => {
  const f = renderMonitor([mk('a', { status: 'done', endedAt: T0 + 1000 })], T0 + 5000, view({ frame: 1 }))
  expect(f.body.flat().some(s => s.t.includes('┄'))).toBe(false)
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

test('counters: overall is not 100% while an agent still runs', () => {
  const agents = [mk('a', { status: 'done', endedAt: T0 + 1000 }), mk('p'), mk('c', { parentAgentId: 'g-p', status: 'done', endedAt: T0 + 2000 })]
  const g = buildGraph(agents, T0 + 5000)
  expect(overallProgress(g)).toBeLessThan(1)
})

test('counters: no Estimativa 00:00:00 when nothing is left to estimate', () => {
  const all = [mk('a', { status: 'done', endedAt: T0 + 60_000 }), mk('b', { status: 'done', endedAt: T0 + 120_000 })]
  expect(etaOf(buildGraph(all, T0 + 130_000))).toBeUndefined()
  expect(text(all, T0 + 130_000)).not.toContain('Estimativa 00:00:00')
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

test('blue-box bug: a running background agent stays on the map past 30s', () => {
  const a = mk('a', { description: `${D}: Checking StoreContextCache` })
  expect(text([a], T0 + 120_000)).toContain('Checking StoreContext')
  expect(text([a], T0 + 120_000)).not.toContain('agentes ocultos')
})

test('git: session card carries the session branch, worktree in the same repo is not a new project', () => {
  const g = buildGraph([mk('a', { git: { branch: 'feat/x', worktree: 'wt', repo: '/r/app' } })], T0, { branch: 'main', repo: '/r/app' })
  expect(g.root.git?.branch).toBe('main')
  expect(g.nodes.get('a')!.git?.repo).toBe('/r/app')
})

test('thumbs OFF (default): no shot line, no thumbs, size unchanged', () => {
  const a = mk('a', { shot: { host: 'shop.example.com', has: true } })
  const f = renderMonitor([a], T0 + 5000, view())
  expect(f.lines.map(lineText).join('\n')).not.toContain('▣')
  expect(f.thumbs).toEqual([])
  expect(inlineSize([a], T0 + 5000, view()).rows).toBe(inlineSize([mk('a')], T0 + 5000, view()).rows)
})

test('detalhe (view-detail): persona, estado, prompt, tarefas e arquivos de um agente; sem agente = volta à lista', () => {
  const a = mk('a', { prompt: 'faça X\ndepois Y', todos: [{ content: 'passo 1', status: 'completed' }], recent: ['Read', 'Edit'], files: ['a.ts'] })
  const d = detailScreen([a], 'a', T0 + 5000).lines.join('\n')
  expect(d).toContain('Pleno')
  expect(d).toContain('tarefa a')
  expect(d).toContain('faça X')
  expect(d).toContain('depois Y')
  expect(d).toContain('passo 1')
  expect(d).toContain('a.ts')
  expect(detailScreen([a], 'zzz', T0).back).toBe(true)
  expect(detailScreen([a], 'session', T0).back).toBe(true)
})

test('AC-011: detalhe mostra nota de captura desligada e como ligar', () => {
  const a = mk('a')
  expect(detailScreen([a], 'a', T0 + 5000).lines.join('\n')).toContain('OFFICE_CAPTURE_IO=1')
  expect(detailScreen([a], 'a', T0 + 5000, { captureIo: true }).lines.join('\n')).not.toContain('OFFICE_CAPTURE_IO=1')
})

test('task node inherits persona/model/effort from its agent', () => {
  const g = buildGraph([mk('a', { todos: [{ content: 't1', status: 'pending' }] })], T0 + 1000)
  const t = g.nodes.get('a#0')!
  expect(t.persona).toBe(g.nodes.get('a')!.persona)
  expect(t.model).toBe(g.nodes.get('a')!.model)
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

// ---- Rodada 5: árvore sem caixas, cabeçalho sem moldura, números honestos ----
test('header: Office · projeto · ⎇ branch · tempo · rodando · concluídos · ~$ — (sem moldura, sem %, sem ETA)', () => {
  const f = renderMonitor([mk('a'), mk('b', { status: 'done', endedAt: T0 + 1000 })], T0 + 5000, view({ git: { branch: 'main', repo: '/r' } }))
  expect(lineText(f.header[0]!)).toBe('Office · meuapp · ⎇ main · 00:05 · 1 rodando · 1 concluídos · ~$ —')
  expect(f.header.map(lineText).join('\n')).not.toMatch(/[╭╮╰╯│─%]|ETA|Progresso/)
})
test('barra segmentada: um ━━━━ por agente na cor do estado e X/Y agentes', () => {
  const f = renderMonitor([mk('a'), mk('b', { status: 'done', endedAt: T0 + 1000 })], T0 + 5000, view())
  const bar = lineText(f.header[1]!)
  expect(bar.startsWith('━━━━ ━━━━ ')).toBe(true)
  expect(bar.endsWith('1/2 agentes')).toBe(true)
  expect(f.header[1]![0]!.fg).toBe(STATE_TABLE.running.dark)
  expect(f.header[1]![1]!.fg).toBe(STATE_TABLE.done.dark)
})
test('alerta no topo: falha com ✗ e erro', () => {
  const f = renderMonitor([mk('a', { status: 'error', endedAt: T0 + 1, error: 'cupom não aplicado' }), mk('b')], T0 + 5000, view())
  expect(f.header.map(lineText)).toContain('✗ tarefa a falhou: cupom não aplicado')
})
test('árvore: conectores ├─ e └─, filho aninhado com │, uma linha por agente', () => {
  const rows = renderMonitor([mk('a'), mk('b'), mk('c', { parentAgentId: 'g-a' })], T0 + 5000, view()).body.map(lineText)
  expect(rows.length).toBe(3)
  expect(rows[0]!.startsWith('⠹ tarefa a')).toBe(true)
  expect(rows.some(r => r.startsWith('└─ ') && r.includes('tarefa c'))).toBe(true)
  expect(rows.some(r => r.includes('tarefa b') && !r.includes('├─') && !r.includes('└─'))).toBe(true)
})
test('linha do agente: persona · modelo, worktree, barra, custo honesto e tempo mm:ss', () => {
  const f = renderMonitor([mk('a', { git: { branch: 'x', worktree: 'wt-1', repo: '/r' }, tool: 'Bash' })], T0 + 12_000, view({ width: 120 }))
  const row = lineText(f.body[0]!)
  expect(row).toContain('Pleno · Sonnet')
  expect(row).toContain('⧉ wt-1')
  expect(row).toContain('▸ Bash')
  expect(row).toContain('~$ —')
  expect(row.endsWith('00:12')).toBe(true)
  expect(row).not.toMatch(/%|\$0/)
})
test('abaixo de 100 colunas: forma de 60 com cabeçalho curto, sem barra e rodapé curto', () => {
  const f = renderMonitor([mk('a'), mk('b', { status: 'done', endedAt: T0 + 1000 })], T0 + 5000, view({ width: 60 }))
  expect(f.header.length).toBe(1)
  expect(lineText(f.header[0]!)).toBe('Office · 00:05 · 1 rodando · 1/2 · ~$ —')
  expect(lineText(f.footer[0]!)).toBe('j k · ⏎ · v · f · d · r · x · q')
  for (const l of f.lines) expect(lineWidth(l)).toBeLessThanOrEqual(60)
})
test('ASCII (OFFICE_ASCII): glifos [xx] [ok] .. e conectores +- ', () => {
  const agents = [mk('a', { status: 'error', endedAt: T0 + 1, error: 'boom' }), mk('b', { status: 'done', endedAt: T0 + 1 }), mk('c', { parentAgentId: 'g-b' })]
  const f = renderMonitor(agents, T0 + 5000, view({ vocab: { ascii: true, color: true } }))
  const t = f.lines.map(lineText).join('\n')
  expect(t).toContain('[xx] tarefa a falhou: boom')
  expect(t).toContain('[ok]')
  expect(t).toContain('+- ..')
  expect(t).not.toMatch(/[├└│✗✓⠹]/)
})
test('rodapé de teclas: frase fixa da Rodada 5 na forma larga', () => {
  const f = renderMonitor([mk('a')], T0 + 5000, view())
  expect(lineText(f.footer[0]!)).toBe('j k mover · ⏎ abrir · v visão · f falhas · s buscar · d decidir · r repetir · x parar · q fechar')
})
test('sem frame de caixa em nenhuma linha (fonte proporcional do painel)', () => {
  const f = renderMonitor([mk('a'), mk('b', { parentAgentId: 'g-a' })], T0 + 5000, view())
  for (const l of f.lines) expect(lineText(l)).not.toMatch(/[╭╮╰╯┆]/)
})
test('ícone e nome do agente são clicáveis; alternar só com filhos', () => {
  const f = renderMonitor([mk('a'), mk('b', { parentAgentId: 'g-a' })], T0 + 5000, view())
  const segs = f.body.flat()
  expect(segs.some(s => s.node === 'a' && s.t === 'tarefa a')).toBe(true)
  expect(segs.some(s => s.node === 'b' && s.t === 'tarefa b')).toBe(true)
  expect(segs.filter(s => s.toggle === 'a').length).toBe(1)
})
test('ETA só com amostra suficiente (sem texto no cabeçalho)', () => {
  const three = [mk('a', { status: 'done', endedAt: T0 + 60_000 }), mk('b', { status: 'done', endedAt: T0 + 120_000 }), mk('c', { status: 'done', endedAt: T0 + 180_000 }), mk('d')]
  expect(etaOf(buildGraph(three, T0 + 1))).toBe(120_000)
  expect(etaOf(buildGraph([mk('a', { status: 'done', endedAt: T0 + 60_000 }), mk('b')], T0 + 1))).toBeUndefined()
})
test('worktree: nome do agente e tag ⧉ na cor do worktree; repo comum sem tag', () => {
  const f = renderMonitor([mk('a', { git: { branch: 'feat/x', worktree: 'wt-1', repo: '/r' } })], T0 + 5000, view())
  const segs = f.body.flat()
  expect(segs.some(s => s.t === 'tarefa a' && s.fg === WORKTREE_COLOR)).toBe(true)
  expect(segs.some(s => s.t.includes('⧉ wt-1') && s.fg === WORKTREE_COLOR)).toBe(true)
  expect(WORKTREE_COLOR).toBe('#BD9BFF')
  expect(renderMonitor([mk('b', { git: { branch: 'main', repo: '/r' } })], T0 + 5000, view()).body.flat().some(s => s.t.includes('⧉'))).toBe(false)
})
test('estado concluído usa ✓ e a cor da tabela', () => {
  const f = renderMonitor([mk('a', { status: 'done', endedAt: T0 + 1000 })], T0 + 5000, view())
  const icon = f.body[0]!.find(s => s.t.startsWith('✓'))!
  expect(icon.t).toBe('✓ ')
  expect(icon.fg).toBe(STATE_TABLE.done.dark)
})
