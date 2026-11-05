// Pure UI reducer for the pane's buttons and hotkeys, so every action is testable without a surface.
import { DEFAULT_MODE, NEXT_MODE, TREE_ALL } from './compact'
import type { Mode } from './compact'
import { keyOf, labelOf } from './vocabulary'

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
  // g em árvore: primeiro abre todos os grupos colapsados (estado do mesmo ciclo), depois passa ao modo seguinte.
  if (a === 'group') {
    if (s.mode === 'tree' && !s.expanded.includes(TREE_ALL)) return { state: { ...s, expanded: [...s.expanded, TREE_ALL] } }
    return { state: { ...s, mode: NEXT_MODE[s.mode], expanded: s.expanded.filter(k => k !== TREE_ALL) } }
  }
  if (a.startsWith('mode:')) return { state: { ...s, mode: a.slice(5) as Mode, filter: 'all' } }
  if (a === 'failed') return { state: { ...s, filter: s.filter === 'failed' ? 'all' : 'failed' } }
  if (a === 'sort') return { state: { ...s, sort: s.sort === 'time' ? 'state' : s.sort === 'state' ? 'name' : 'time' } }
  // v cicla mapa (inicial) -> árvore -> cards -> mapa
  if (a === 'view') {
    if (s.view === 'map') return { state: { ...s, view: 'compact', mode: 'tree' } }
    if (s.mode === 'tree') return { state: { ...s, mode: 'cards' } }
    return { state: { ...s, view: 'map' } }
  }
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
  // Letras e rótulos vêm do KEY_MAP único (vocabulary.ts), não de literais por tela.
  const hk = (act: string): Hotkey => ({ key: keyOf(act) ?? '', label: labelOf(act) ?? act, act })
  const list: Hotkey[] = [hk('group'), hk('sort'), hk('failed'), hk('search'), hk('view')]
  const back: Hotkey = { ...hk('back'), label: s.attach ? 'fechar preview' : hk('back').label }
  const close = hk('close')
  const view = hk('view')
  if (s.view === 'map') return s.selected ? [view, back, close] : [view, close]
  if (s.selected && !side) return [back, close]
  return s.selected ? [...list, back, close] : [...list, close]
}

// Footer text: hotkeys joined by " · ", tail hint set off by " · " (never glued like "visão q:").
export const FOOTER_SEP = ' · '
export function footerText(s: Ui, side: boolean): string {
  return hotkeysFor(s, side).map(h => `${h.key}: ${h.label}`).join(FOOTER_SEP)
}
export function footerTail(s: Ui): string {
  if (s.searching) return 'Enter aplica a busca (vazio limpa)'
  return `${FOOTER_SEP}Tab entre cards · Enter detalhe · ctrl+x tab foca o painel`
}
