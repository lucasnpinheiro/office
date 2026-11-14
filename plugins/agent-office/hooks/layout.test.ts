import { test, expect } from 'claude-code/testing'
import { renderCompact, detectCaps, layoutLevel } from './compact'
import type { CView } from './compact'
import type { AgentLike } from './office'
import { termLevel, appColumns, detailPlacement, rowStyle, sideDetail, effectiveCols, fitAgora } from './layout'

// T-013 (AC-042..AC-044). Rendered output is tested as text through renderCompact; the pure rules at their boundaries.
const T = 1_000_000
const mk = (id: string, o: Partial<AgentLike> = {}): AgentLike => ({ id, agentId: `g-${id}`, description: `Dev: ${id}`, status: 'working', startedAt: T, seenAt: T, ...o })
const txt = (ls: { t: string }[][]) => ls.map(l => l.map(s => s.t).join('')).join('\n')
const view = (over: Partial<CView> = {}): CView => ({ width: 100, caps: detectCaps({ LANG: 'pt_BR.UTF-8' }), mode: 'tree', query: '', expanded: new Set<string>(), maxCardRows: 4, ...over })
const agents: AgentLike[] = [
  mk('ok', { status: 'done', endedAt: T + 64_000 }),
  mk('run', { tool: 'Bash' }),
  mk('bad', { status: 'error', endedAt: T + 64_000, error: 'boom' }),
]
const NOW = T + 65_000
const widest = (ls: { t: string }[][]) => Math.max(...ls.map(l => l.map(s => s.t).join('').length))

test('U-019 terminal: 59/60/99/100 colunas', () => {
  expect([termLevel(59), termLevel(60), termLevel(99), termLevel(100)]).toEqual(['list', 'compact', 'compact', 'full'])
  expect([layoutLevel(59), layoutLevel(60), layoutLevel(99), layoutLevel(100)]).toEqual(['line', 'abbr', 'abbr', 'full'])
})
test('U-019 app: colunas em 519/520/779/780/1039/1040 px', () => {
  expect([0, 519, 520, 779, 780, 1039, 1040].map(appColumns)).toEqual([1, 1, 2, 2, 3, 3, 4])
})
test('U-020 detalhe: 899 sobre a lista, 900 ao lado; linhas abaixo de 520', () => {
  expect([detailPlacement(899), detailPlacement(900)]).toEqual(['overlay', 'side'])
  expect([rowStyle(519), rowStyle(520)]).toEqual(['row', 'card'])
})
test('V-003 largura 0, negativa, NaN, undefined: uma coluna, 80 colunas', () => {
  for (const w of [0, -5, NaN, undefined]) { expect(effectiveCols(w)).toBe(80); expect(appColumns(w)).toBe(1); expect(detailPlacement(w)).toBe('overlay') }
  expect(effectiveCols(120)).toBe(120)
})
test('fitAgora: encolhe o agora primeiro; sem espaço some', () => {
  expect(fitAgora('Bash npm test', 40)).toBe('Bash npm test')
  expect(fitAgora('Bash npm test', 6).length).toBeLessThanOrEqual(6)
  expect(fitAgora('Bash npm test', 2)).toBe('')
})
test('sideDetail: container conhecido manda; senão a regra de colunas do terminal', () => {
  expect(sideDetail({ cols: 80, containerPx: 900, desktop: true })).toBe(true)
  expect(sideDetail({ cols: 200, containerPx: 899, desktop: false })).toBe(false)
  expect(sideDetail({ cols: 150, desktop: false })).toBe(true)
  expect(sideDetail({ cols: 149, desktop: false })).toBe(false)
  expect(sideDetail({ cols: 110, desktop: true })).toBe(true)
})

test('I-042 renderCompact 100 colunas é completo; 60 é compacto sem perder estado; nada passa da largura', () => {
  const full = renderCompact(agents, NOW, view({ width: 100 })), comp = renderCompact(agents, NOW, view({ width: 60 }))
  expect(txt(full)).toContain('ETA'); expect(txt(comp)).not.toContain('ETA') // the compact header drops the ETA, keeps the counts
  for (const out of [txt(full), txt(comp)]) { expect(out).toContain('boom'); expect(out).toContain('01:05'); expect(out).toContain('run') }
  expect(widest(full)).toBeLessThanOrEqual(100); expect(widest(comp)).toBeLessThanOrEqual(60)
  expect(txt(full)).toContain('Bash') // agora visível com espaço
})
test('I-042 abaixo de 60 só lista: sem cabeçalho, rodapé nem legenda; falha primeiro e tempo mantidos', () => {
  const out = renderCompact(agents, NOW, view({ width: 59 })), t = txt(out)
  expect(t).not.toContain('Office'); expect(t).not.toContain('Geral')
  expect(t).toContain('boom'); expect(t).toContain('01:05'); expect(widest(out)).toBeLessThanOrEqual(59)
  expect(t.indexOf('boom')).toBeLessThan(t.indexOf('run'))
  expect(txt(renderCompact([], NOW, view({ width: 40 })))).toContain('Aguardando')
})
test('I-044 largura 0/NaN: uma coluna a 80, falha primeiro, tempo visível', () => {
  for (const w of [0, NaN]) {
    const out = renderCompact(agents, NOW, view({ width: w })), t = txt(out)
    expect(t).toContain('Office'); expect(widest(out)).toBeLessThanOrEqual(80)
    expect(t).toContain('boom'); expect(t).toContain('01:05')
    expect(t.indexOf('boom')).toBeLessThan(t.indexOf('run'))
  }
})
test('I-044 agora cai antes de tempo e falha em largura apertada', () => {
  const t = txt(renderCompact([mk('run', { tool: 'Bash' })], NOW, view({ width: 30, mode: 'tree' })))
  expect(t).toContain('01:05')
  const roomy = txt(renderCompact([mk('run', { tool: 'Bash' })], NOW, view({ width: 100 })))
  expect(roomy).toContain('Bash')
})
test('I-044 custo segue visível com largura 0 (modo cost, 80 colunas)', () => {
  expect(txt(renderCompact(agents, NOW, view({ width: 0, mode: 'cost' })))).toMatch(/Custo|custo|tokens/)
})
test('I-043 container 390 px: cards viram linhas de estado, nome e tempo; 1040 px mantém cards', () => {
  const cards = view({ width: 120, mode: 'cards', maxCardRows: 6 })
  const rows = txt(renderCompact(agents, NOW, { ...cards, containerPx: 390 })), wide = txt(renderCompact(agents, NOW, { ...cards, containerPx: 1040 }))
  expect(rows).not.toContain('filho de'); expect(rows).toMatch(/[├└]─/); expect(wide).toContain('filho de') // legenda da árvore só existe com cards
  expect(rows).toContain('01:05'); expect(rows).toContain('boom')
})
test('I-042 app: cards are one indented column whatever the container: every card drawn at 520 and 1040 px', () => {
  const many = Array.from({ length: 6 }, (_, i) => mk(`n${i}`))
  const cards = view({ width: 200, mode: 'cards', maxCardRows: 20 })
  const tops = (px: number) => renderCompact(many, NOW, { ...cards, containerPx: px }).filter(l => { const t = l.map(s => s.t).join(''); return /╭─{30,}╮/.test(t) }).length
  // the tree lists one card per block (session + 6), so the container width changes card width, never the card count
  expect(tops(520)).toBe(7)
  expect(tops(1040)).toBe(7)
})
