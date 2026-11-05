// T-014 (AC-045..AC-047, spec/05-ui-design.md § Movimento). Funções puras de movimento.
import { test, expect } from 'claude-code/testing'
import { SPIN_FPS, SPIN_FRAME_MS, REDUCED_FRAME_MS, spinnerGlyph, frameIntervalMs, bellOnNewDecision, transitionFor } from './motion'

// AC-045: spinner a 6 quadros/s; quadros ciclam
test('spinner runs at 6 frames per second and cycles glyphs', () => {
  expect(SPIN_FPS).toBe(6)
  expect(SPIN_FRAME_MS).toBe(167)
  expect(spinnerGlyph(0, false)).not.toBe(spinnerGlyph(1, false))
  expect(spinnerGlyph(10, false)).toBe(spinnerGlyph(0, false))
})

// AC-046: reduzido = ponto fixo e 1 quadro/s
test('reduced motion: fixed glyph and one frame per second', () => {
  expect(REDUCED_FRAME_MS).toBe(1000)
  expect(spinnerGlyph(0, true)).toBe(spinnerGlyph(7, true))
  expect(frameIntervalMs({ running: true, reduced: true })).toBe(1000)
  expect(frameIntervalMs({ running: true, reduced: true, compact: true })).toBe(1000)
})

test('running frame interval is 6/s in app and compact; undefined when idle', () => {
  expect(frameIntervalMs({ running: true })).toBe(SPIN_FRAME_MS)
  expect(frameIntervalMs({ running: true, compact: true })).toBe(SPIN_FRAME_MS)
  expect(frameIntervalMs({ running: false })).toBeUndefined()
})

// AC-045: sino uma vez quando um ◆ surge
test('bell rings once when a new decision (◆) appears, not on each redraw', () => {
  expect(bellOnNewDecision(0, 1)).toBe(true)
  expect(bellOnNewDecision(1, 1)).toBe(false)
  expect(bellOnNewDecision(2, 1)).toBe(false)
})

// AC-047: superfície sem transição troca direto, sem erro
test('transition falls back to instant when the surface cannot animate', () => {
  expect(transitionFor(true)).toBe('crossfade')
  expect(transitionFor(false)).toBe('instant')
  expect(transitionFor(undefined)).toBe('instant')
})
