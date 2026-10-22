// Pure UI reducer for the pane's buttons and hotkeys, so every action is testable without a surface.
import { DEFAULT_MODE, NEXT_MODE } from './compact'
import type { Mode } from './compact'

export type Ui = {
  view: 'compact' | 'map'; mode: Mode; filter: 'all' | 'failed'; sort: 'time' | 'state' | 'name'
  searching: boolean; selected: string; attach: string; query: string; expanded: string[]
}
export const initialUi = (): Ui => ({ view: 'map', mode: DEFAULT_MODE, filter: 'all', sort: 'time', searching: false, selected: '', attach: '', query: '', expanded: [] })
// Session start: every persisted view/filter/search field goes back to the default (map view; cards inside compact), so a
// previous session's map view, filter or query never leaks into the new one.
export const startUi = (): Ui => ({ ...initialUi() })

export function applyAction(s: Ui, a: string): { state: Ui; close?: true } {
  if (a === 'close') return { state: s, close: true }
  if (a === 'group') return { state: { ...s, mode: NEXT_MODE[s.mode] } }
  if (a.startsWith('mode:')) return { state: { ...s, mode: a.slice(5) as Mode, filter: 'all' } }
  if (a === 'failed') return { state: { ...s, filter: s.filter === 'failed' ? 'all' : 'failed' } }
  if (a === 'sort') return { state: { ...s, sort: s.sort === 'time' ? 'state' : s.sort === 'state' ? 'name' : 'time' } }
  if (a === 'view') return { state: { ...s, view: s.view === 'map' ? 'compact' : 'map' } }
  if (a === 'search') return { state: { ...s, searching: !s.searching } }
  if (a === 'back') {
    if (s.searching) return { state: { ...s, searching: false } }
    if (s.attach) return { state: { ...s, attach: '' } }
    return { state: { ...s, selected: '' } }
  }
  if (a.startsWith('open:')) return { state: { ...s, selected: a.slice(5), attach: '' } }
  if (a.startsWith('grp:')) {
    const k = a.slice(4)
    return { state: { ...s, expanded: s.expanded.includes(k) ? s.expanded.filter(x => x !== k) : [...s.expanded, k] } }
  }
  return { state: s }
}

// Hotkeys shown in the footer of the current view. One letter each (the surface refuses '/', Esc never
// arrives), unique per view, none while the search Input holds the keys.
export type Hotkey = { key: string; label: string; act: string }
export function hotkeysFor(s: Ui, side: boolean): Hotkey[] {
  if (s.searching) return []
  const list: Hotkey[] = [
    { key: 'g', label: 'modo', act: 'group' }, { key: 'o', label: 'ordenar', act: 'sort' }, { key: 'f', label: 'só falhas', act: 'failed' },
    { key: 's', label: 'buscar', act: 'search' }, { key: 'v', label: 'visão', act: 'view' },
  ]
  const back: Hotkey = { key: 'b', label: s.attach ? 'fechar preview' : 'voltar', act: 'back' }
  const close: Hotkey = { key: 'q', label: 'fechar', act: 'close' }
  if (s.view === 'map') return s.selected ? [{ key: 'v', label: 'visão', act: 'view' }, back, close] : [{ key: 'v', label: 'visão', act: 'view' }, close]
  if (s.selected && !side) return [back, close]
  return s.selected ? [...list, back, close] : [...list, close]
}

// Footer text: hotkeys joined by " · ", tail hint set off by " · " (never glued like "visão q:").
export const FOOTER_SEP = ' · '
export function footerText(s: Ui, side: boolean): string {
  return hotkeysFor(s, side).map(h => `${h.key}: ${h.label}`).join(FOOTER_SEP)
}
export function footerTail(s: Ui): string {
  return `${FOOTER_SEP}${s.searching ? 'Enter aplica a busca (vazio limpa)' : 'Tab entre cards · Enter detalhe · ctrl+x tab foca o painel'}`
}
