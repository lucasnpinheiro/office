import { test, expect } from 'claude-code/testing'
import { STATE_TABLE, TOKENS, vocabFromEnv, stateView, CONNECTORS, KEY_MAP, keyOf, bindable } from './vocabulary'
import { CAPABILITIES } from './capabilities'
import type { Capabilities } from './capabilities'

const STATES = ['queued', 'running', 'needs-you', 'stalled', 'paused', 'failed', 'done', 'stopped'] as const

// AC-014: each of the eight RunState values has a fixed label, glyph and color from the Padrão table.
test('AC-014 table has the eight states with label, glyph and dark/light colors', async () => {
  expect(Object.keys(STATE_TABLE).sort()).toEqual([...STATES].sort())
  expect(STATE_TABLE.queued).toMatchObject({ label: 'Na fila', glyph: '○', dark: '#A9ADB5', light: '#5A5F68' })
  expect(STATE_TABLE.running).toMatchObject({ label: 'Rodando', glyph: '⠹', dark: '#7FA9FF', light: '#2257C9' })
  expect(STATE_TABLE['needs-you']).toMatchObject({ label: 'Precisa de você', glyph: '◆', dark: '#F2B84B', light: '#8A5A00' })
  expect(STATE_TABLE.stalled).toMatchObject({ label: 'Parado sem sinal', glyph: '▲', dark: '#F2B84B', light: '#8A5A00' })
  expect(STATE_TABLE.paused).toMatchObject({ label: 'Pausado', glyph: '‖', dark: '#A9ADB5', light: '#5A5F68' })
  expect(STATE_TABLE.failed).toMatchObject({ label: 'Falhou', glyph: '✗', dark: '#FF8A80', light: '#B3261E' })
  expect(STATE_TABLE.done).toMatchObject({ label: 'Concluído', glyph: '✓', dark: '#6FD08C', light: '#1B7A3D' })
  expect(STATE_TABLE.stopped).toMatchObject({ label: 'Interrompido', glyph: '■', dark: '#A9ADB5', light: '#5A5F68' })
})

test('AC-014 every state shows a non-color glyph, distinct from the others', async () => {
  const glyphs = STATES.map(s => stateView(s, vocabFromEnv({}), 'dark').glyph)
  expect(new Set(glyphs).size).toBe(STATES.length)
  for (const s of STATES) expect(stateView(s, vocabFromEnv({}), 'dark')).toMatchObject({ label: STATE_TABLE[s].label, known: true })
})

test('AC-014 color comes from the table and palette tokens are defined for both themes', async () => {
  expect(stateView('failed', vocabFromEnv({}), 'light').color).toBe('#B3261E')
  expect(stateView('failed', vocabFromEnv({}), 'dark').color).toBe('#FF8A80')
  expect(TOKENS.dark).toMatchObject({ bg: '#141517', surface: '#1C1E21', line: '#303338', text: '#ECEEF1', muted: '#A9ADB5' })
  expect(TOKENS.light).toMatchObject({ bg: '#F6F7F8', surface: '#FFFFFF', line: '#DDE0E4', text: '#17191C', muted: '#5A5F68' })
})

// AC-015: OFFICE_ASCII or NO_COLOR switches to the ASCII column and ASCII connectors.
test('AC-015 OFFICE_ASCII uses the ASCII column', async () => {
  const v = vocabFromEnv({ OFFICE_ASCII: '1' })
  expect(v.ascii).toBe(true)
  expect(stateView('queued', v, 'dark').glyph).toBe('[ ]')
  expect(stateView('running', v, 'dark').glyph).toBe('..')
  expect(stateView('needs-you', v, 'dark').glyph).toBe('[??]')
  expect(stateView('stalled', v, 'dark').glyph).toBe('[!!]')
  expect(stateView('paused', v, 'dark').glyph).toBe('||')
  expect(stateView('failed', v, 'dark').glyph).toBe('[xx]')
  expect(stateView('done', v, 'dark').glyph).toBe('[ok]')
  expect(stateView('stopped', v, 'dark').glyph).toBe('[--]')
})

// no-color.org: NO_COLOR set and non-empty drops color only; the glyph column is not touched (ASCII is OFFICE_ASCII or the terminal).
test('AC-015 NO_COLOR set and non-empty drops color and keeps the Unicode column', async () => {
  const v = vocabFromEnv({ NO_COLOR: '1' })
  expect(v).toMatchObject({ ascii: false, color: false })
  expect(stateView('done', v, 'dark').color).toBeUndefined()
  expect(stateView('done', v, 'dark').glyph).toBe('✓')
  expect(CONNECTORS.unicode.branch).toBe('├')
})

test('AC-015 NO_COLOR empty counts as not set: color stays', async () => {
  expect(vocabFromEnv({ NO_COLOR: '' })).toMatchObject({ ascii: false, color: true })
})

test('AC-015 OFFICE_ASCII alone keeps color', async () => {
  expect(vocabFromEnv({ OFFICE_ASCII: '1' })).toMatchObject({ ascii: true, color: true })
  expect(vocabFromEnv({})).toMatchObject({ ascii: false, color: true })
})

// AC-016: unknown state renders muted with '?' and never throws.
test('AC-016 unknown state renders muted with ? and does not throw', async () => {
  const v = vocabFromEnv({})
  const out = stateView('teleporting', v, 'dark')
  expect(out).toMatchObject({ glyph: '?', color: TOKENS.dark.muted, known: false, label: 'teleporting' })
  expect(stateView('', vocabFromEnv({ OFFICE_ASCII: '1' }), 'light')).toMatchObject({ glyph: '?', known: false })
})

// AC-017: one KEY_MAP drives footer and buttons; same letter for the same action on both surfaces.
test('AC-017 every key is a single letter or digit, unique within its context', async () => {
  for (const e of KEY_MAP) expect(e.key).toMatch(/^[a-z0-9]$/)
  const seen = new Set<string>()
  for (const e of KEY_MAP) {
    const id = `${e.ctx ?? 'view'}:${e.key}`
    expect(seen.has(id)).toBe(false)
    seen.add(id)
  }
})

test('AC-017 shared actions use the same letter on terminal and app', async () => {
  expect(keyOf('view')).toBe('v')
  expect(keyOf('back')).toBe('b')
  expect(keyOf('close')).toBe('q')
  expect(keyOf('search')).toBe('s')
  expect(keyOf('failed')).toBe('f')
  expect(keyOf('nope')).toBeUndefined()
  const caps: Capabilities = { ...CAPABILITIES, stop: { terminal: 'yes', app: 'yes' } }
  const t = bindable(caps, 'terminal').map(e => [e.act, e.key])
  const a = bindable(caps, 'app').map(e => [e.act, e.key])
  expect(a).toEqual(t)
})

// Capability gate: a control whose capability is not 'yes' is not bound.
test('a control whose capability is not yes is not bound', async () => {
  const acts = (surface: 'terminal' | 'app') => bindable(CAPABILITIES, surface).map(e => e.act)
  expect(acts('terminal')).not.toContain('stop')
  expect(acts('terminal')).not.toContain('retry')
  expect(acts('terminal')).not.toContain('pause')
  expect(acts('terminal')).not.toContain('openInChat')
  expect(acts('terminal')).toContain('view')
  const yes: Capabilities = { ...CAPABILITIES, stop: { terminal: 'yes', app: 'no' } }
  expect(bindable(yes, 'terminal').map(e => e.act)).toContain('stop')
  expect(bindable(yes, 'app').map(e => e.act)).not.toContain('stop')
  expect(keyOf('stop')).toBe('x')
})
