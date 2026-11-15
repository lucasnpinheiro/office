import { test, expect } from 'claude-code/testing'
import { renderCompact, detectCaps } from './compact'
import { strWidth } from './monitor'
import type { AgentLike } from './office'

// T-004 card anatomy (REQ-006..008): chips wrap whole, the state pill is on every card, footer trail is cut per item.
const T = 1_000_000
const mk = (id: string, o: Partial<AgentLike> = {}): AgentLike => ({ id, agentId: `g-${id}`, description: `Dev: ${id}`, status: 'working', startedAt: T, seenAt: T, ...o } as AgentLike)
const caps = detectCaps({ COLORTERM: 'truecolor', LANG: 'en_US.UTF-8' })
const base = { width: 120, caps, mode: 'cards' as const, query: '', expanded: new Set<string>(), maxCardRows: 99 }
const rows = (ag: AgentLike[], o: object = {}) => renderCompact(ag, T + 5000, { ...base, ...o }).map(l => l.map(s => s.t).join(''))

test('U-016: chip "🟢 baixo" is never split across rows at 34 columns and the narrow card (60 cols)', () => {
  for (const width of [120, 60]) {
    const t = rows([mk('o', { description: '🧭 Squad Leader · 👑 Opus · 🟢 baixo: Orquestrar' } as any)], { width })
    expect(t.some(l => l.includes('🟢 baixo'))).toBe(true)
    // a line holding the glyph must hold its word: no orphan glyph, no orphan word
    expect(t.filter(l => l.includes('🟢') && !l.includes('🟢 baixo'))).toEqual([])
    expect(t.filter(l => l.includes('baixo') && !l.includes('🟢 baixo'))).toEqual([])
  }
})

test('U-017: long persona: the wrap only falls between chips, a chip is never cut inside', () => {
  const t = rows([mk('p', { description: '🧭 Squad Leader Sênior Principal · 👑 Opus · 🟢 baixo: Planejar' } as any)], { width: 60 })
  const y = t.findIndex(l => l.includes('Planejar') && l.includes('│'))
  const meta = t.slice(y + 1, y + 4).join('\n')
  expect(meta).toContain('👑 Opus')
  expect(meta).toContain('🟢 baixo')
  expect(t.some(l => l.includes('Leader') && !l.includes('Squad Leader'))).toBe(false)
})

test('U-018: state pill is on every card, a long title shortens with … to make room', () => {
  for (const [status, pill] of [['working', 'Rodando'], ['done', 'Concluído']] as const) {
    const t = rows([mk('x', { status, description: '🧪 QA · 🪶 Haiku · 🟢 baixo: Atualizar a documentação completa do plugin office inteiro' } as any)])
    const y = t.findIndex(l => l.includes('Atual') && l.includes('│'))
    expect(t[y]).toContain(pill)
    expect(t.join('\n')).toContain('…')
  }
})

test('U-019: long title keeps the pill on line 1 and wraps by word to a full-width line 2 (26 and 18 col cards)', () => {
  const long = 'Atualizar a documentação completa do plugin office inteiro'
  for (const [n, width] of [[3, 120], [19, 120]] as const) {
    const ag = Array.from({ length: n }, (_, i) => mk(`k${i}`, { description: `🧪 QA · 🪶 Haiku · 🟢 baixo: ${long}` } as any))
    const t = rows(ag, { width, maxLines: 200 })
    const y = t.findIndex(l => /Rod/.test(l) && !/Claude Code|Orquestrador/.test(l))
    expect(t.slice(y, y + 2).join('\n')).toContain('Atual')
    expect(t[y + 2]).toContain('🪶') // pill row + 1 title row at most beyond it, chips next
  }
  const short = rows([mk('x', { description: '🧪 QA · 🪶 Haiku · 🟢 baixo: Curto' } as any)])
  expect(short[short.findIndex(l => l.includes('Curto')) + 1]).toContain('🪶') // short title stays 1 row
})
test('U-020: 2nd title row is cut with … when it still does not fit', () => {
  const ag = Array.from({ length: 19 }, (_, i) => mk(`k${i}`, { description: '🧪 QA · 🪶 Haiku · 🟢 baixo: Atualizar a documentação completa do plugin office inteiro agora mesmo e depois mais' } as any))
  const t = rows(ag, { maxLines: 200 })
  const y = t.findIndex(l => /Rod/.test(l) && !/Claude Code|Orquestrador/.test(l))
  expect(t[y + 1]).toContain('…')
  expect(t[y + 2]).toContain('🪶')
})

test('U-021: a first word wider than the room beside the pill is never split: line 1 = glyph + pill, whole title on line 2', () => {
  const ag = Array.from({ length: 19 }, (_, i) => mk(`k${i}`, { description: '🧪 QA · 🪶 Haiku · 🟢 baixo: Atualizar documentação' } as any))
  const t = rows(ag, { maxLines: 200 })
  expect(t.some(l => /│⠋ +Rod/.test(l))).toBe(true)
  expect(t.some(l => /│Atualizar/.test(l))).toBe(true)
  expect(t.some(l => l.includes('Atuali') && !l.includes('Atualiz'))).toBe(false)
})
