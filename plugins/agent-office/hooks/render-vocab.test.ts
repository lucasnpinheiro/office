import { test, expect } from 'claude-code/testing'
import { renderCompact, detailCompact, detectCaps, stateGlyph } from './compact'
import { renderMonitor, lineText, STATE_COLOR } from './monitor'
import { STATE_TABLE, KEY_MAP, keyOf, nodeView, vocabFromEnv } from './vocabulary'
import { hotkeysFor, initialUi } from './actions'
import type { AgentLike } from './office'

const T = 1_000_000
const mk = (id: string, o: Partial<AgentLike> = {}): AgentLike => ({ id, agentId: `g-${id}`, description: `Dev: ${id}`, status: 'working', startedAt: T, seenAt: T, ...o })
const txt = (ls: { t: string }[][]) => ls.map(l => l.map(s => s.t).join('')).join('\n')
const agents = [mk('a'), mk('b', { status: 'done', endedAt: T + 1000 }), mk('c', { status: 'error', endedAt: T + 1000, error: 'boom' }), mk('d', { active: false })]
const cview = (env: Record<string, string | undefined>, mode: 'tree' | 'grouped' | 'cards' | 'waterfall') =>
  ({ width: 120, caps: detectCaps(env), mode, query: '', expanded: new Set<string>(), maxCardRows: 4 })
const mview = (vocab?: { ascii: boolean; color: boolean }) => ({ width: 120, frame: 0, collapsed: new Set<string>(), project: 'p', sessionId: 's', vocab })

// AC-014: label, glyph and color of the table reach the compact legend and the map legend
test('AC-014 render: legenda compacta usa rótulo e glifo da tabela', () => {
  const out = txt(renderCompact(agents, T + 5000, cview({ LANG: 'pt_BR.UTF-8' }, 'tree')))
  for (const s of ['done', 'running', 'stalled', 'queued', 'failed'] as const) {
    expect(out).toContain(`${STATE_TABLE[s].glyph} ${STATE_TABLE[s].label}`)
  }
})
test('AC-014 render: mapa usa o glifo da tabela e a cor do token', () => {
  const f = renderMonitor(agents, T + 5000, mview())
  const t = f.lines.map(lineText).join('\n')
  for (const s of ['done', 'running', 'failed'] as const) expect(t).toContain(STATE_TABLE[s].glyph)
  expect(STATE_COLOR.done).toBe(STATE_TABLE.done.dark)
  expect(STATE_COLOR.failed).toBe(STATE_TABLE.failed.dark)
  expect(f.lines.flat().some(s => s.fg === STATE_TABLE.done.dark)).toBe(true)
})

// AC-015: ASCII column and no color
test('AC-015 render: OFFICE_ASCII usa a coluna ASCII (compacto)', () => {
  const env = { OFFICE_ASCII: '1', LANG: 'pt_BR.UTF-8' }
  for (const mode of ['tree', 'cards'] as const) {
    const out = txt(renderCompact(agents, T + 5000, cview(env, mode)))
    expect(out).toContain(STATE_TABLE.done.ascii)
    expect(out).toContain(STATE_TABLE.failed.ascii)
    for (const g of ['✓', '✗', '●', '○', '▲', '⠹']) expect(out).not.toContain(g)
  }
})
// Padrão: NO_COLOR tira só a cor; os glifos continuam Unicode (ASCII vem de OFFICE_ASCII ou do terminal).
test('AC-015 render: NO_COLOR tira a cor e mantém os glifos Unicode (compacto)', () => {
  const env = { NO_COLOR: '1', COLORTERM: 'truecolor', LANG: 'pt_BR.UTF-8' }
  for (const mode of ['tree', 'cards'] as const) {
    const ls = renderCompact(agents, T + 5000, cview(env, mode))
    const out = txt(ls)
    expect(out).toContain(STATE_TABLE.done.glyph)
    expect(out).toContain(STATE_TABLE.failed.glyph)
    expect(out).not.toContain(STATE_TABLE.done.ascii)
    expect(ls.flat().filter(s => s.fg !== undefined)).toEqual([])
  }
})
test('AC-015 render: mapa em ASCII e sem cor', () => {
  const asc = renderMonitor(agents, T + 5000, mview({ ascii: true, color: true })).lines.map(lineText).join('\n')
  expect(asc).toContain(STATE_TABLE.done.ascii)
  expect(asc).toContain(STATE_TABLE.failed.ascii)
  const nc = renderMonitor(agents, T + 5000, mview({ ascii: true, color: false }))
  expect(nc.lines.flat().filter(s => s.fg !== undefined)).toEqual([])
  expect(nc.body.flat().filter(s => s.fg !== undefined)).toEqual([])
})
test('AC-015: NO_COLOR sozinho tira a cor e não liga a coluna ASCII (caps e vocabulário)', () => {
  expect(detectCaps({ NO_COLOR: '1', LANG: 'pt_BR.UTF-8' })).toMatchObject({ ascii: false, color: 'mono' })
  expect(vocabFromEnv({ NO_COLOR: '1' })).toMatchObject({ ascii: false, color: false })
})
test('AC-015: NO_COLOR vazio não conta como definido (no-color.org), nos dois caminhos', () => {
  expect(detectCaps({ NO_COLOR: '', COLORTERM: 'truecolor', LANG: 'pt_BR.UTF-8' })).toMatchObject({ ascii: false, color: 'truecolor' })
  expect(vocabFromEnv({ NO_COLOR: '' })).toMatchObject({ ascii: false, color: true })
})

// AC-016: unknown state is drawn muted with ? and does not throw
test('AC-016 render: estado desconhecido vira ? em muted sem lançar', () => {
  expect(stateGlyph(detectCaps({ LANG: 'pt_BR.UTF-8' }), 'teleporting')).toBe('?')
  expect(stateGlyph(detectCaps({ OFFICE_ASCII: '1' }), 'teleporting')).toBe('?')
  expect(nodeView('teleporting', { ascii: false, color: true }, 'dark')).toMatchObject({ glyph: '?', known: false })
  expect(() => detailCompact(agents, 'a', T + 5000, detectCaps({}))).not.toThrow()
})

// AC-017: footer letters and labels come from KEY_MAP; g = modo, o = ordenar
test('AC-017: g e o estão no KEY_MAP com o rótulo do código', () => {
  expect(keyOf('group')).toBe('g')
  expect(keyOf('sort')).toBe('o')
  expect(KEY_MAP.find(e => e.act === 'group')?.label).toBe('modo')
  expect(KEY_MAP.find(e => e.act === 'sort')?.label).toBe('ordenar')
})
test('AC-017: rodapé deriva letra e rótulo do KEY_MAP', () => {
  const ui = { ...initialUi(), view: 'compact' as const }
  for (const h of hotkeysFor(ui, true)) {
    const e = KEY_MAP.find(k => k.act === h.act && (k.ctx ?? 'view') === 'view')
    expect(e).toBeDefined()
    expect(h.key).toBe(e!.key)
    expect(h.label).toBe(e!.label)
  }
  expect(hotkeysFor(ui, true).map(h => h.act)).toContain('sort')
})
test('AC-017: dicas desenhadas nas telas usam as letras do KEY_MAP', () => {
  // the cards view no longer draws a hidden-cards box (nothing is hidden); its search and sort keys live in the pane footer (hotkeysFor)
  const d = txt(detailCompact([mk('a'), mk('b')], 'a', T + 5000, detectCaps({})) ?? [])
  expect(d).toContain(`${keyOf('nextSibling')}: próximo`)
})
