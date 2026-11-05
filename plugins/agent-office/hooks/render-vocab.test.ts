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
test('AC-014 render: legenda do mapa usa rótulo e glifo da tabela, cor do token', () => {
  const f = renderMonitor(agents, T + 5000, mview())
  const t = f.lines.map(lineText).join('\n')
  for (const s of ['done', 'running', 'stalled', 'queued', 'stopped', 'failed'] as const) expect(t).toContain(`${STATE_TABLE[s].glyph} ${STATE_TABLE[s].label}`)
  expect(STATE_COLOR.done).toBe(STATE_TABLE.done.dark)
  expect(STATE_COLOR.failed).toBe(STATE_TABLE.failed.dark)
  expect(f.lines.flat().some(s => s.fg === STATE_TABLE.done.dark)).toBe(true)
})

// AC-015: ASCII column and no color
test('AC-015 render: OFFICE_ASCII e NO_COLOR usam a coluna ASCII e tiram a cor (compacto)', () => {
  for (const env of [{ OFFICE_ASCII: '1', LANG: 'pt_BR.UTF-8' }, { NO_COLOR: '1', COLORTERM: 'truecolor', LANG: 'pt_BR.UTF-8' }]) {
    for (const mode of ['tree', 'cards'] as const) {
      const ls = renderCompact(agents, T + 5000, cview(env, mode))
      const out = txt(ls)
      expect(out).toContain(STATE_TABLE.done.ascii)
      expect(out).toContain(STATE_TABLE.failed.ascii)
      for (const g of ['✓', '✗', '●', '○', '▲', '⠹']) expect(out).not.toContain(g)
      if ('NO_COLOR' in env) expect(ls.flat().filter(s => s.fg !== undefined)).toEqual([])
    }
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
test('AC-015: NO_COLOR sozinho liga a coluna ASCII nos caps', () => {
  expect(detectCaps({ NO_COLOR: '1', LANG: 'pt_BR.UTF-8' }).ascii).toBe(true)
  expect(vocabFromEnv({ NO_COLOR: '1' })).toMatchObject({ ascii: true, color: false })
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
  const many = Array.from({ length: 30 }, (_, i) => mk('x' + i))
  const out = txt(renderCompact(many, T + 5000, { ...cview({}, 'cards'), maxCardRows: 2 }))
  expect(out).toContain(`${keyOf('search')} buscar`)
  expect(out).toContain(`${keyOf('sort')} ordenar`)
  const d = txt(detailCompact([mk('a'), mk('b')], 'a', T + 5000, detectCaps({})) ?? [])
  expect(d).toContain(`${keyOf('nextSibling')}: próximo`)
})
