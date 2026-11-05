import { test, expect } from 'claude-code/testing'
import { renderCompact, detectCaps, treeHasCollapsed } from './compact'
import type { CView } from './compact'
import { applyAction, initialUi } from './actions'
import { CAPABILITIES } from './capabilities'
import type { AgentLike } from './office'

// T-006 (Visão Árvore). Rendered output is tested as text; ACs from tasks/T-006-tree-view-connectors.md.
const T = 1_000_000
const mk = (id: string, o: Partial<AgentLike> = {}): AgentLike => ({ id, agentId: `g-${id}`, description: `Dev: ${id}`, status: 'working', startedAt: T, seenAt: T, ...o })
const txt = (ls: { t: string }[][]) => ls.map(l => l.map(s => s.t).join('')).join('\n')
const view = (over: Partial<CView> = {}): CView => ({ width: 120, caps: detectCaps({ LANG: 'pt_BR.UTF-8' }), mode: 'tree', query: '', expanded: new Set<string>(), maxCardRows: 4, ...over })
const rows = (out: string) => out.split('\n').filter(l => /[├└]─/.test(l))

// AC-018: connectors, header with time, running and cost, and ◆ / ✗ pinned on top with the key of their action
const family = [
  mk('o'),
  mk('f1', { parentAgentId: 'g-o' }),
  mk('f2', { parentAgentId: 'g-o', status: 'done', endedAt: T + 1000 }),
  mk('f3', { parentAgentId: 'g-o', status: 'error', endedAt: T + 1000, error: 'boom' }),
  mk('f4', { parentAgentId: 'g-o', status: 'error', endedAt: T + 1000, error: '429 rate limit' }),
]

test('AC-018 árvore: conectores ├─ e └─ (sem ╰─)', () => {
  const out = txt(renderCompact(family, T + 5000, view()))
  expect(rows(out).join('\n')).toContain('├─')
  expect(rows(out).join('\n')).toContain('└─')
  expect(rows(out).join('\n')).not.toContain('╰─') // a moldura do cabeçalho usa ╰ e fica fora da árvore
})

test('AC-018 árvore: cabeçalho com tempo, rodando e tokens (sem custo inventado)', () => {
  const out = txt(renderCompact(family, T + 5000, view()))
  expect(out).toContain('00:00:05')
  expect(out).toContain('ativos')
  expect(out).toMatch(/tokens —/) // sem dado: traço, nunca zero
  expect(out).not.toMatch(/custo|~\$0,00/)
})

// ◆ (decisão) não existe no modelo até T-011: o fixado de hoje é ▲ (atenção) e ✗ (falha).
test('AC-018 árvore: ▲ e ✗ ficam acima das linhas da árvore', () => {
  const out = txt(renderCompact(family, T + 5000, view()))
  const firstRow = out.indexOf('├─')
  expect(out.indexOf('▲')).toBeGreaterThanOrEqual(0)
  expect(out.indexOf('▲')).toBeLessThan(firstRow)
  expect(out.indexOf('✗')).toBeLessThan(firstRow)
})

test('AC-018 árvore: sem capability yes a tecla da ação não aparece', () => {
  const out = txt(renderCompact(family, T + 5000, view()))
  expect(out).not.toContain('r repetir')
  expect(out).not.toContain('d decidir')
})

test('AC-018 árvore: com retry yes a tecla aparece na linha da falha, no topo', () => {
  const caps = { ...CAPABILITIES, retry: { terminal: 'yes' as const, app: 'no' as const } }
  const ls = renderCompact(family, T + 5000, view({ capabilities: caps })).map(l => l.map(s => s.t).join(''))
  const pinned = ls.find(l => l.includes('✗ ') && l.includes('r repetir'))
  expect(pinned).toBeDefined()
  expect(ls.indexOf(pinned!)).toBeLessThan(ls.findIndex(l => /[├└]─/.test(l)))
})

// AC-019: siblings with the same state above 8 rows collapse into `Rodando ×N`; g opens all
const siblings = (n: number, o: Partial<AgentLike> = {}) => [mk('o'), ...Array.from({ length: n }, (_, i) => mk('r' + i, { parentAgentId: 'g-o', ...o }))]

test('AC-019 árvore: 9 irmãos rodando colapsam em Rodando ×9', () => {
  const out = txt(renderCompact(siblings(9), T + 5000, view()))
  expect(out).toContain('Rodando ×9')
  expect(rows(out).length).toBe(2) // o pai + o grupo
})

test('AC-019 árvore: 8 irmãos rodando ficam abertos (limite é acima de 8)', () => {
  const out = txt(renderCompact(siblings(8), T + 5000, view()))
  expect(out).not.toContain('Rodando ×8')
  expect(rows(out).length).toBe(9) // o pai + 8 irmãos
})

test('AC-019 árvore: com tree:all em expanded os 21 irmãos aparecem, sem grupo', () => {
  const out = txt(renderCompact(siblings(21), T + 5000, view({ expanded: new Set(['tree:all']) })))
  expect(out).not.toContain('×21')
  expect(rows(out).length).toBe(22) // o pai + 21 irmãos
})

test('AC-019: g em árvore abre todos; a ordem é colapsado, todos, depois o modo seguinte', () => {
  const collapsed = initialUi()
  const a = applyAction({ ...collapsed, view: 'compact', mode: 'tree' }, 'group').state
  expect(a.mode).toBe('tree')
  expect(a.expanded).toContain('tree:all')
  expect(applyAction(a, 'group').state.mode).toBe('grouped')
})

// AC-020: no agent in the session: empty state, no progress bar
test('AC-020 árvore: sem agente mostra o vazio sem barra de progresso', () => {
  const out = txt(renderCompact([], T + 5000, view()))
  expect(out).toContain('Aguardando agentes')
  expect(out).not.toContain('Geral')
  expect(out).not.toMatch(/[█▒]/)
})

// Judge finding 9: cost at 60 columns, compact form
test('AC-018 árvore: tokens aparecem no cabeçalho a 60 colunas, em forma curta (— sem dado)', () => {
  const lines = txt(renderCompact([mk('o')], T + 5000, view({ width: 60, project: 'proj' }))).split('\n')
  const head = lines.slice(0, 3).join('\n')
  expect(head).toContain('Office')
  expect(lines[1]).toMatch(/\d\d:\d\d · —/)
  expect(lines[1]).not.toContain('tokens') // forma curta: sem a palavra
})

// Judge finding 10: stale hint, treeHasCollapsed
test('AC-019 árvore: dica do cabeçalho não diz "alterna agrupado"', () => {
  expect(txt(renderCompact(family, T + 5000, view()))).not.toContain('alterna agrupado')
})
test('AC-019 árvore: treeHasCollapsed só é true com mais de 8 irmãos do mesmo estado', () => {
  expect(treeHasCollapsed(siblings(9), T + 5000, view())).toBe(true)
  expect(treeHasCollapsed(siblings(8), T + 5000, view())).toBe(false)
  expect(treeHasCollapsed(family, T + 5000, view())).toBe(false)
})
