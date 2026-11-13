import { test, expect } from 'claude-code/testing'
import { isAppSurface, appCards, appMap } from './app-cards'
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

test('app card: real description fixture and subagent_type fallback feed the chips', () => {
  const [a] = appCards([mk('a', { description: '🎨 UX/UI · 🎼 Sonnet · 🟢 baixo: Render HTML no app Claude Code' })], T + 5000, {})
  expect([a!.title, ...a!.chips]).toEqual(['Render HTML no app Claude Code', '🎨 UX/UI', '🎼 Sonnet', '🟢 baixo'])
  const [b] = appCards([mk('b', { description: 'Varrer docs', subagentType: 'padrao' })], T + 5000, {})
  expect(b!.chips).toEqual(['🤖 Agente', '🎼 Sonnet', '🟢 baixo'])
})

test('appMap: session root, agents under their parent, tones and pct never invented', () => {
  const m = appMap([mk('p', { description: 'Dev: pai', agentId: 'g-p' }), mk('c', { description: 'Dev: filho', parentAgentId: 'g-p' }), mk('x', { description: 'Dev: x', status: 'error' })], T + 5000, {})
  expect(m.card.title).toBe('Claude Code')
  const top = m.children.map(n => n.card.title)
  expect(top).toContain('Dev: pai'); expect(top).toContain('Dev: x')
  const pai = m.children.find(n => n.card.title === 'Dev: pai')!
  expect(pai.children.map(n => n.card.title)).toEqual(['Dev: filho'])
  expect(pai.children[0]!.card.pct).toBeUndefined()
  expect(pai.children[0]!.card.tone).toBe('suggestion')
  expect(m.children.find(n => n.card.title === 'Dev: x')!.card.tone).toBe('error')
})

test('appMap: query prunes branches', () => {
  const m = appMap([mk('alfa'), mk('beta')], T + 1000, { query: 'beta' })
  expect(m.card.id).toBe('beta') // one visible top-level agent: it is the root box (design), no session box above it
})

test('appMap: several top-level agents keep the Claude Code session box as their parent', () => {
  const m = appMap([mk('alfa'), mk('beta')], T + 1000, {})
  expect(m.card.title).toBe('Claude Code'); expect(m.children.map(n => n.card.id)).toEqual(['alfa', 'beta'])
})

test('app card: one segment per tool step when the timeline exists, else none', () => {
  const [c] = appCards([mk('a', { steps: [{ id: '1', tool: 'Bash', label: 'x', startedAt: T, durationMs: 4000 }, { id: '2', tool: 'Read', label: 'y', startedAt: T, durationMs: 1000, ok: false }] })], T + 9000, {})
  expect(c!.steps).toEqual([{ weight: 4000, tone: 'success' }, { weight: 1000, tone: 'error' }, { weight: 1000, tone: 'suggestion' }])
  expect(appCards([mk('b')], T, {})[0]!.steps).toBeUndefined()
})
