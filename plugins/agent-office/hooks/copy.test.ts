import { test, expect } from 'claude-code/testing'
import { applyAction, initialUi, hotkeysFor, footerRows } from './actions'
import type { Ui } from './actions'
import { detailText } from './view-detail'
import { copyNoteOn, COPY_NOTE_MS } from './copy'
import { maskText, MASK } from './mask'
import { bindable } from './vocabulary'
import { CAPABILITIES } from './capabilities'

const base = (over: Partial<Ui> = {}): Ui => ({ ...initialUi(), view: 'compact', ...over })
const detailKeys = (s: Ui) => hotkeysFor(s, false).map(h => h.key)

test('y copies only with a selected detail: hidden in lists, shown in detail', async () => {
  expect(detailKeys(base({ mode: 'tree' }))).not.toContain('y')
  expect(detailKeys(base({ selected: 'a1' }))).toContain('y')
  expect(footerRows(base({ selected: 'a1' }), false, 200).flat().map(x => x.t).join(' ')).toContain('y: copiar')
  expect(footerRows(base({ mode: 'tree' }), false, 200).flat().map(x => x.t).join(' ')).not.toContain('copiar')
})

test('detail text is plain (no ANSI) and masked before it can be copied', async () => {
  const lines = [[{ t: 'Prompt', bold: true, fg: '#fff' }], [{ t: 'token=abc123 ' }, { t: 'ok', fg: '#0f0' }]]
  const text = maskText(detailText(lines))
  expect(text).toBe(`Prompt\ntoken=${MASK} ok`)
  expect(text).not.toContain('\u001b')
  expect(text).not.toContain('abc123')
})

test('copiado note lasts COPY_NOTE_MS after the copy, with injected now', async () => {
  expect(copyNoteOn(0, 0)).toBe(false)
  expect(copyNoteOn(1000, 1000 + COPY_NOTE_MS - 1)).toBe(true)
  expect(copyNoteOn(1000, 1000 + COPY_NOTE_MS)).toBe(false)
})

test('footer shows copiado in place of y: copiar while the note is on', async () => {
  const off = footerRows(base({ selected: 'a1' }), false, 200).flat().map(x => x.t).join(' ')
  const on = footerRows(base({ selected: 'a1' }), false, 200, false, true).flat().map(x => x.t).join(' ')
  expect(off).toContain('y: copiar')
  expect(on).toContain('copiado')
  expect(on).not.toContain('y: copiar')
})

test('copy capability is not-verified (ADR 0002): not in bindable, but the footer still shows y', async () => {
  expect(CAPABILITIES.copy).toEqual({ terminal: 'not-verified', app: 'not-verified' })
  expect(bindable(CAPABILITIES, 'terminal').map(e => e.act)).not.toContain('copy')
  expect(footerRows(base({ selected: 'a1' }), false, 200).flat().map(x => x.t).join(' ')).toContain('y: copiar')
})
