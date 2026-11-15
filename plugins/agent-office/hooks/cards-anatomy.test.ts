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
    const y = t.findIndex(l => l.includes('Atualizar') && l.includes('│'))
    expect(t[y]).toContain(pill)
    expect(t[y]).toContain('…')
  }
})

test('U-019: no ✓ title prefix; the pill reads Concluído on a done card', () => {
  const t = rows([mk('d', { status: 'done', description: '🦉 Senior · 🎼 Sonnet · 🟢 baixo: API de cupom' } as any)])
  const y = t.findIndex(l => l.includes('API de cupom') && l.includes('│'))
  expect(t[y]).not.toContain('✓')
  expect(t[y]).toMatch(/│API de cupom +Concluído│/)
})

test('U-020: a long status trail is cut per item with …, items are separated, no stray quote mark', () => {
  const a = mk('t', { tool: 'Bash', recent: ['Read', 'Grep', 'Edit', 'Write', 'Glob', 'WebFetch'], description: '🧪 QA · 🪶 Haiku · 🟢 baixo: Rodar testes' } as any)
  const t = rows([a], { width: 60 })
  const y = t.findIndex(l => l.includes('Rodar testes') && l.includes('│'))
  const foot = t[y + 4]!
  expect(foot).toContain('…')
  expect(foot).not.toContain('"')
  expect(foot).toContain('‹')
  expect(strWidth(foot)).toBe(strWidth(t[y]!))
})
