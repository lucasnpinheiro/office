import { test, expect } from 'claude-code/testing'
import { renderBoxMap, BOX_W } from './map-boxes'
import { strWidth } from './monitor'
import type { Line } from './monitor'
import type { AgentLike } from './office'

const T = 1_000_000
const mk = (id: string, o: Partial<AgentLike> = {}): AgentLike => ({ id, description: `Dev: ${id}`, status: 'working', startedAt: T, seenAt: T, ...o })
const base = { project: 'loja-web', sessionId: 'e13b5aa', ascii: false, color: true }
const txt = (ls: Line[]) => ls.map(l => l.map(s => s.t).join(''))
const topsOf = (t: string[]) => t.flatMap(l => [...l.matchAll(/┌[─┴]{36}┐/g)])
const D = (p: string, m: string, e: string) => `${p} · ${m} · ${e}`
const agents = [
  mk('a', { description: `${D('🧭 Squad Leader', '👑 Opus', '🟢 baixo')}: Orquestrar` }),
  mk('b', { description: `${D('🛠️ Pleno', '🎼 Sonnet', '🟡 médio')}: Tela`, status: 'done', endedAt: T + 5000 }),
  mk('c', { description: 'Dev: filho', parentAgentId: 'g-a' }),
  mk('d', { description: 'Dev: erro', status: 'error' }),
].map((a, i) => ({ ...a, agentId: `g-${'abcd'[i]}` }))

test('map boxes: header, root box, bus, children boxed, every box row has equal display width', () => {
  const out = renderBoxMap(agents, T + 9000, { ...base, width: 130 })!
  const t = txt(out)
  expect(t[0]).toContain('Office Agent Monitor'); expect(t[0]).toContain('Progresso geral')
  expect(t[1]).toContain('loja-web'); expect(t[1]).toContain('Decorrido'); expect(t[1]).toContain('Estimativa')
  expect(t.some(l => l.includes('Claude Code'))).toBe(true)
  expect(t.filter(l => l.includes('┬')).length).toBeGreaterThan(1)
  expect(t.some(l => l.includes('┌') && (l.includes('┴') || l.includes('┼')) && l.includes('─'))).toBe(true)
  expect(topsOf(t).length).toBeGreaterThanOrEqual(4)
  // a closed box: the right border sits at the same display column as its top-right corner, emoji included
  for (const l of t.filter(l => /^\s*│/.test(l) || l.includes('│'))) {
    const cols = [...l].reduce<number[]>((acc, ch, i, arr) => { if (ch === '│') acc.push(strWidth(arr.slice(0, i).join(''))); return acc }, [])
    for (const c of cols) expect(c % 1).toBe(0)
  }
  const persona = t.find(l => l.includes('🧭 Squad Leader'))!
  expect(persona).toContain('🧭 Squad Leader 👑 Opus 🟢 baixo')
  const w = strWidth(persona.slice(persona.indexOf('│'), persona.indexOf('│') + 1 + 0))
  expect(w).toBe(1)
  expect(strWidth(persona.slice(persona.indexOf('│'), persona.indexOf('│', persona.indexOf('│') + 1) + 1))).toBe(BOX_W)
})

test('map boxes: border colour follows the state, boxes are clickable', () => {
  const out = renderBoxMap(agents, T + 9000, { ...base, width: 130 })!
  const colours = new Set(out.flat().filter(s => s.t.includes('┌')).map(s => s.fg))
  expect(colours.size).toBeGreaterThan(1)
  expect(out.flat().some(s => !!s.node && s.node.endsWith('d'))).toBe(true)
})

test('map boxes: siblings that do not fit wrap to a new row and the trunk joins them', () => {
  const many = Array.from({ length: 5 }, (_, i) => mk(`k${i}`))
  const t = txt(renderBoxMap(many, T + 1000, { ...base, width: 100 })!)
  expect(topsOf(t).length).toBe(6) // root + 5 children, wrapped
  expect(t.some(l => l.startsWith('└') || l.startsWith('├'))).toBe(true)
  for (const l of t) expect(strWidth(l)).toBeLessThanOrEqual(100)
})

test('map boxes: ASCII mode uses + - | and drops the icons; NO_COLOR drops colours', () => {
  const t = txt(renderBoxMap(agents, T + 9000, { ...base, width: 130, ascii: true, color: false })!).join('\n')
  expect(t).not.toMatch(/[─│┌┐└┘┬┴🧭👑]/)
  expect(t).toContain('Squad Leader - Opus - baixo')
  expect(renderBoxMap(agents, T + 9000, { ...base, width: 130, color: false })!.flat().every(s => !s.fg)).toBe(true)
})

test('map boxes: null when the pane is narrower than a box or there are no agents (text map is the fallback)', () => {
  expect(renderBoxMap(agents, T, { ...base, width: BOX_W })).toBeNull()
  expect(renderBoxMap([], T, { ...base, width: 130 })).toBeNull()
})

// structure: every connector touches what it joins, in the same display column
const emo = [
  mk('a', { description: `${D('🧭 Squad Leader', '👑 Opus', '🟢 baixo')}: Orquestrar`, agentId: 'g-a' } as any),
  mk('b', { description: `${D('🛠️ Pleno', '🎼 Sonnet', '🟡 médio')}: Tela`, status: 'done', endedAt: T + 5000, agentId: 'g-b' } as any),
  mk('c', { description: `${D('✍️ Tech Writer', '🪶 Haiku', '🔴 alto')}: Docs`, parentAgentId: 'g-a', agentId: 'g-c' } as any),
  mk('d', { description: `${D('🧪 QA', '🎼 Sonnet', '🟢 baixo')}: Testar`, parentAgentId: 'g-c', agentId: 'g-d' } as any),
  mk('e', { description: 'Dev: erro', status: 'error', agentId: 'g-e' } as any),
]
const gs = (l: string): string[] => [...new (Intl as any).Segmenter(undefined, { granularity: 'grapheme' }).segment(l)].map((x: any) => x.segment)
const colOf = (l: string, i: number) => strWidth([...l].slice(0, i).join(''))
const charsAt = (l: string | undefined, col: number): string => { if (!l) return ' '; let w = 0; for (const ch of gs(l)) { if (w === col) return ch; w += strWidth(ch) } return ' ' }
for (const width of [120, 70]) test(`map boxes @${width}: connectors meet boxes in the same column`, () => {
  const t = txt(renderBoxMap(emo, T + 9000, { ...base, width })!)
  t.forEach((l, y) => {
    const cells = [...l]
    cells.forEach((ch, i) => {
      const col = colOf(l, i)
      if (ch === '┬') { const below = charsAt(t[y + 1], col); expect(['┴', '│', '┬', '┼']).toContain(below) } // bus or box bottom: touches below
      if (ch === '┴' && y > 0) { const above = charsAt(t[y - 1], col); expect(['│', '┬', '┼', '─', '┌', '┐', '├', '┤', '┴']).toContain(above) }
      if (ch === '┐' && /^\s*[┌│]|^[┌│]/.test(l) === false) { /* bus corner */ }
    })
  })
  for (const [y, l] of t.entries()) {
    for (const m of l.matchAll(/┌[─┴]{36}┐/g)) {
      const lc = colOf(l, m.index!)
      for (let r = 1; r <= 4; r++) { expect(charsAt(t[y + r], lc)).toBe('│'); expect(charsAt(t[y + r], lc + BOX_W - 1)).toBe('│') }
      expect(charsAt(t[y + 5], lc + BOX_W - 1)).toBe('┘')
    }
  }
})
