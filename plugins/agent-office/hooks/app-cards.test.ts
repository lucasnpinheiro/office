import { test, expect } from 'claude-code/testing'
import { isAppSurface, appCards } from './app-cards'
import type { AgentLike } from './office'

const T = 1_000_000
const mk = (id: string, o: Partial<AgentLike> = {}): AgentLike => ({ id, description: `Dev: ${id}`, status: 'working', startedAt: T, seenAt: T, ...o })

test('surface: only the terminal keeps the text cards; desktop, vscode and mobile get graphical cards', () => {
  expect(isAppSurface('terminal')).toBe(false)
  expect(isAppSurface(undefined)).toBe(false)
  for (const s of ['desktop', 'vscode', 'mobile']) expect(isAppSurface(s)).toBe(true)
})

test('app card: task as title, persona/model/effort chips with icons, state tone', () => {
  const [c] = appCards([mk('a', { description: '🛠️ Pleno · 🎼 Sonnet · 🟡 médio: Reading edit.php' })], T + 5000, {})
  expect(c!.title).toBe('Reading edit.php')
  expect(c!.chips).toEqual(['🛠️ Pleno', '🎼 Sonnet', '🟡 médio'])
  expect(c!.state).toBe('running')
  expect(c!.tone).toBe('suggestion')
})

test('app card: no format falls back to the 🤖 Agente chip and the whole description as title', () => {
  const [c] = appCards([mk('a', { description: 'Find files' })], T + 5000, {})
  expect(c!.title).toBe('Find files')
  expect(c!.chips).toEqual(['🤖 Agente'])
})

test('app card: failed and done carry their own tone and glyph, not color alone', () => {
  const cs = appCards([mk('f', { status: 'error' }), mk('d', { status: 'done', endedAt: T + 5000 })], T + 9000, {})
  const f = cs.find(c => c.id === 'f')!, d = cs.find(c => c.id === 'd')!
  expect([f.tone, f.glyph]).toEqual(['error', '✗'])
  expect([d.tone, d.glyph, d.pct]).toEqual(['success', '✓', 1])
})

test('app card: query filters cards', () => {
  const cs = appCards([mk('alfa'), mk('beta')], T + 1000, { query: 'beta' })
  expect(cs.map(c => c.id)).toEqual(['beta'])
})
