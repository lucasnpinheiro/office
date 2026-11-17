// Pure UI reducer for the pane's buttons and hotkeys, so every action is testable without a surface.
import { DEFAULT_MODE, NEXT_MODE, TREE_FOLD } from './compact'
import type { Mode } from './compact'
import { keyOf, labelOf } from './vocabulary'

export type Ui = {
  view: 'compact' | 'map'; mode: Mode; filter: 'all' | 'failed'; sort: 'time' | 'state' | 'name'
  searching: boolean; selected: string; attach: string; query: string; expanded: string[]
  modeChosen: boolean // the user picked the mode (g, button, /office mode): v from the map keeps it
}
export const initialUi = (): Ui => ({ view: 'map', mode: DEFAULT_MODE, filter: 'all', sort: 'time', searching: false, selected: '', attach: '', query: '', expanded: [], modeChosen: false })
// Session start: every persisted view/filter/search field goes back to the default (map view, the agent org chart), so a
// previous session's map view, filter or query never leaks into the new one.
export const startUi = (): Ui => ({ ...initialUi() })

// `ctx.collapsed` (tree only): false when the tree shows no collapsed group, so g does not waste a press opening nothing.
// `ctx.workflow`: true only while a workflow run exists; otherwise g skips the Workflow stop (never an always-empty screen).
export const nextModeOf = (m: Mode, workflow: boolean): Mode => { const n = NEXT_MODE[m]; return n === 'workflow' && !workflow ? NEXT_MODE[n] : n }
export function applyAction(s: Ui, a: string, ctx: { collapsed?: boolean; workflow?: boolean; terminal?: boolean } = {}): { state: Ui; close?: true } {
  if (a === 'close') return { state: s, close: true }
  // g em árvore: primeiro recolhe irmãos iguais em grupos (opt-in; o padrão mostra todos), depois passa ao modo seguinte.
  if (a === 'group') {
    if (s.mode === 'tree' && ctx.collapsed !== false && !s.expanded.includes(TREE_FOLD)) return { state: { ...s, expanded: [...s.expanded, TREE_FOLD] } }
    const mode = nextModeOf(s.mode, ctx.workflow === true)
    // the app's Mapa tab is the map view: g landing on map goes there, any other mode leaves it (tab highlight = what is drawn)
    return { state: { ...s, mode, view: mode === 'map' ? 'map' : s.view, modeChosen: true, expanded: s.expanded.filter(k => k !== TREE_FOLD) } }
  }
  // tabs of the app pane: Mapa = map view; every other tab is the compact view in that mode
  if (a === 'tab:map') return { state: { ...s, view: 'map', selected: '', attach: '', filter: 'all' } }
  if (a.startsWith('tab:')) return { state: { ...s, view: 'compact', mode: a.slice(4) as Mode, modeChosen: true, selected: '', attach: '', filter: 'all' } }
  if (a.startsWith('mode:')) return { state: { ...s, mode: a.slice(5) as Mode, modeChosen: true, filter: 'all' } }
  if (a === 'failed') return { state: { ...s, filter: s.filter === 'failed' ? 'all' : 'failed' } }
  if (a === 'sort') return { state: { ...s, sort: s.sort === 'time' ? 'state' : s.sort === 'state' ? 'name' : 'time' } }
  // v cicla mapa (inicial) -> árvore -> cards -> mapa
  if (a === 'view') {
    // from the map, a mode the user chose stays; otherwise the tree is the first stop of the cycle (06-gaps, decision 3)
    if (s.view === 'map') return { state: { ...s, view: 'compact', mode: s.modeChosen ? s.mode : 'tree' } }
    if (s.mode === 'tree') return { state: { ...s, view: 'compact', mode: ctx.terminal ? 'map' : 'cards' } } // app: mapa > árvore > cards (grade) > mapa; terminal: map <> árvore
    // the terminal has one view (the org chart, mode map): v only alternates map and tree there
    return ctx.terminal ? { state: { ...s, view: 'compact', mode: 'tree' } } : { state: { ...s, view: 'map' } }
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
  // REQ-503: o mesmo rodapé em toda aba (modo, ordenar, falhas, buscar, visão), sem condicionar ao modo.
  const list: Hotkey[] = [hk('group'), hk('sort'), hk('failed'), hk('search'), hk('view')]
  const back: Hotkey = { ...hk('back'), label: s.attach ? 'fechar preview' : hk('back').label }
  const close = hk('close')
  const view = hk('view')
  // map footer (design Term5): v visão · f falhas · q fechar (the v cycle differs by surface, so no sequence is promised here)
  const mapView: Hotkey = view
  if (s.view === 'map' && s.selected) return [mapView, back, close]
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
  if (s.selected) return `${FOOTER_SEP}p/n irmão`
  if (s.view === 'map' && !s.selected) return `${FOOTER_SEP}Tab mover · Enter abrir · ctrl+x tab foca o painel`
  return `${FOOTER_SEP}Tab entre cards · Enter detalhe · ctrl+x tab foca o painel`
}

// Footer layout: items grouped (navegação | filtros | visão | sair), wrapped by width one whole item at a time (never an orphan "x:"),
// every row centred like the legend above it. Pure: the renderer turns each FooterSeg into Text/Button.
export type FooterSeg = { t: string; act?: string; hotkey?: string; dim?: boolean }
const GROUP_SEP = '  |  '
const groupOf = (act: string): number => (act === 'group' || act === 'sort' || act === 'failed' || act === 'search' ? 1 : act === 'view' ? 2 : act === 'back' || act === 'close' ? 3 : 0)
export function footerRows(s: Ui, side: boolean, cols0: number): FooterSeg[][] {
  const cols = Math.max(10, cols0 - 2) // REQ-601: the host pane is narrower than the reported cols; a full row would make the flex layout shrink every label
  const scroll = !s.searching && s.view === 'compact' && !s.selected // j/k scroll every list tab (REQ-603): shown, not hidden buttons
  const nav: FooterSeg[] = [
    ...(scroll ? [{ t: 'j: desce', act: 'scrollDown', hotkey: 'j' }, { t: 'k: sobe', act: 'scrollUp', hotkey: 'k' }] : []),
    ...footerTail(s).replace(/^ · /, '').split(' · ').map(t => ({ t, dim: true })),
  ]
  if (s.selected && !side && !s.searching) { // detail: b voltar · p/n irmão · j/k rolar · q fechar
    const items: FooterSeg[] = [
      ...hotkeysFor(s, side).filter(h => h.act === 'back').map(h => ({ t: `${h.key}: ${h.label}`, act: h.act, hotkey: h.key })),
      { t: 'p/n irmão', dim: true }, { t: 'j: desce', act: 'scrollDown', hotkey: 'j' }, { t: 'k: sobe', act: 'scrollUp', hotkey: 'k' },
      ...hotkeysFor(s, side).filter(h => h.act === 'close').map(h => ({ t: `${h.key}: ${h.label}`, act: h.act, hotkey: h.key })),
    ]
    const rows: FooterSeg[][] = []
    let cur: FooterSeg[] = [], w = 0
    for (const seg of items) {
      const len = [...seg.t].length + (cur.length ? 3 : 0)
      if (cur.length && w + len > cols) { rows.push(cur); cur = []; w = 0 }
      if (cur.length) { cur.push({ t: ' · ', dim: true }); w += 3 }
      cur.push(seg); w += [...seg.t].length
    }
    if (cur.length) rows.push(cur)
    return rows
  }
  const groups: FooterSeg[][] = [nav, [], [], []]
  for (const h of hotkeysFor(s, side)) groups[groupOf(h.act)]!.push({ t: `${h.key}: ${h.label}`, act: h.act, hotkey: h.key })
  // order: filtros, visão, sair first (the keys), navegação last (hints)
  const items: { seg: FooterSeg; g: number }[] = [1, 2, 3, 0].flatMap(g => groups[g]!.map(seg => ({ seg, g })))
  const rows: FooterSeg[][] = []
  let cur: FooterSeg[] = [], w = 0, last = -1
  for (const { seg, g } of items) {
    const sep = cur.length ? (g === last ? ' · ' : GROUP_SEP) : ''
    const len = [...seg.t].length + sep.length
    if (cur.length && w + len > cols) { rows.push(cur); cur = []; w = 0 }
    const sp = cur.length ? (g === last ? ' · ' : GROUP_SEP) : ''
    if (sp) cur.push({ t: sp, dim: true })
    cur.push(seg); w += [...seg.t].length + sp.length; last = g
  }
  if (cur.length) rows.push(cur)
  return rows
}
