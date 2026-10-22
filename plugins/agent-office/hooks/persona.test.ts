import { test, expect } from 'claude-code/testing'
import { parseDescription, PERSONAS, MODEL_DISPLAY, EFFORT_DISPLAY } from './persona'

test('parses persona prefix', () => {
  const p = parseDescription('🛠️ Pleno·padrao·sonnet·low: Reading edit.php')
  expect(p.persona.key).toBe('pl')
  expect(p.tier).toBe('padrao')
  expect(p.effort).toBe('low')
  expect(p.label).toBe('Reading edit.php')
})

test('falls back to generic', () => {
  expect(parseDescription('Find files').persona.key).toBe('gen')
})

test('parser: prefix gives persona, tier, model and effort; fallbacks', () => {
  const p = parseDescription('🛠️ Pleno·padrao·sonnet·medium: x')
  expect([p.persona.key, p.tier, p.model, p.effort]).toEqual(['pl', 'padrao', 'sonnet', 'medium'])
  const q = parseDescription('🧠 Especialista·profundo·opus·low: y')
  expect([q.persona.key, q.model, q.effort]).toEqual(['esp', 'opus', 'low'])
  const g = parseDescription('sem prefixo')
  expect([g.persona.key, g.model, g.effort]).toEqual(['gen', undefined, undefined])
})

test('parser: legacy versioned model token and tier-only prefix resolve the canonical model', () => {
  const a = parseDescription('🌱 Junior·rapido·haiku-5-5·low: x')
  expect([a.tier, a.model, a.effort]).toEqual(['rapido', 'haiku', 'low'])
  const b = parseDescription('🐣 Estagiário·rapido·claude-haiku-5-5·low: x')
  expect([b.tier, b.model]).toEqual(['rapido', 'haiku'])
  const c = parseDescription('🛠️ Pleno·padrao·low: x')
  expect([c.tier, c.model]).toEqual(['padrao', 'sonnet'])
})

test('PERSONAS catalog: unique keys/icons for every row', () => {
  const strip = (s: string) => s.replace('️', '')
  const icons = PERSONAS.map(p => strip(p.icon))
  expect(PERSONAS.length).toBe(17)
  expect(new Set(PERSONAS.map(p => p.key)).size).toBe(PERSONAS.length)
  expect(new Set(icons).size).toBe(PERSONAS.length)
  for (const a of icons) for (const b of icons) if (a !== b) expect(a.includes(b)).toBe(false)
  for (const p of PERSONAS) {
    expect(parseDescription(`${p.icon} ${p.name}·padrao·sonnet·low: x`).persona.key).toBe(p.key)
  }
})

test('parses the new humanized prefix to the same canonical fields', () => {
  const p = parseDescription('🛠️ Pleno · 🎼 Sonnet · 🟢 baixo: Reading edit.php')
  expect([p.persona.key, p.tier, p.model, p.effort, p.label]).toEqual(['pl', 'padrao', 'sonnet', 'low', 'Reading edit.php'])
  const q = parseDescription('🧠 Especialista · 👑 Opus · 🔴 alto: y')
  expect([q.persona.key, q.tier, q.model, q.effort]).toEqual(['esp', 'profundo', 'opus', 'high'])
  const r = parseDescription('🌱 Junior · 🪶 Haiku · 🟡 médio: z')
  expect([r.tier, r.model, r.effort]).toEqual(['rapido', 'haiku', 'medium'])
})

test('display tables', () => {
  expect(MODEL_DISPLAY.opus).toEqual({ icon: '👑', label: 'Opus' })
  expect(EFFORT_DISPLAY.medium).toEqual({ icon: '🟡', label: 'médio' })
})
