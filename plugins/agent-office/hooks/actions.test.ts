import { test, expect } from 'claude-code/testing'
import { applyAction, initialUi, hotkeysFor, startUi, footerText, footerTail, footerRows } from './actions'

const s0 = { ...initialUi(), view: 'map' as const } // map-view fixtures; the default view is the map (startUi)
const c0 = { ...s0, view: 'compact' as const }

test('defaults: map view, map as the mode behind v, not searching', async () => {
  expect(initialUi().mode).toBe('map')
  expect(initialUi().view).toBe('map')
  expect(s0.searching).toBe(false)
})

test('g cycles mode, f toggles failed, o cycles sort', async () => {
  expect(applyAction(s0, 'group').state.mode).toBe('tree')
  const f = applyAction(s0, 'failed').state
  expect(f.filter).toBe('failed')
  expect(applyAction(f, 'failed').state.filter).toBe('all')
  expect(applyAction(s0, 'sort').state.sort).toBe('state')
})

// T-006: v cycles map -> árvore -> cards -> map; the map stays the initial view and v never gets stuck.
test('v cycles map, árvore, cards and back to map', async () => {
  const t = applyAction(s0, 'view').state
  expect(t).toMatchObject({ view: 'compact', mode: 'tree' })
  const c = applyAction(t, 'view').state
  expect(c).toMatchObject({ view: 'compact', mode: 'cards' }) // app: the cards grid
  expect(applyAction(c, 'view').state.view).toBe('map')
})

// T-006 / AC-019: g in árvore first opens every collapsed group (tree:fold), then moves to the next mode.
test('g in árvore: opens all groups first, then the next mode', async () => {
  const t = { ...s0, view: 'compact' as const, mode: 'tree' as const }
  const a = applyAction(t, 'group').state
  expect(a).toMatchObject({ mode: 'tree' })
  expect(a.expanded).toContain('tree:fold')
  const b = applyAction(a, 'group').state
  expect(b.mode).toBe('grouped')
  expect(b.expanded).not.toContain('tree:fold')
})

test('s toggles search, back closes search, then attach, then detail', async () => {
  const s = applyAction(s0, 'search').state
  expect(s.searching).toBe(true)
  expect(applyAction(s, 'back').state.searching).toBe(false)
  const d = { ...s0, selected: 'a', attach: 'f.txt' }
  const d1 = applyAction(d, 'back').state
  expect(d1.attach).toBe('')
  expect(d1.selected).toBe('a')
  expect(applyAction(d1, 'back').state.selected).toBe('')
})

test('open selects an agent and clears attach; q asks close', async () => {
  const o = applyAction({ ...s0, attach: 'x' }, 'open:abc').state
  expect(o.selected).toBe('abc')
  expect(o.attach).toBe('')
  expect(applyAction(s0, 'close').close).toBe(true)
})

test('grp toggles expanded group; mode:map resets filter', async () => {
  const e = applyAction(s0, 'grp:k').state
  expect(e.expanded).toEqual(['k'])
  expect(applyAction(e, 'grp:k').state.expanded).toEqual([])
  expect(applyAction({ ...s0, filter: 'failed', mode: 'tree' }, 'mode:map').state).toMatchObject({ mode: 'map', filter: 'all' })
})

test('hotkeys are unique per view and off while searching', async () => {
  for (const st of [s0, { ...s0, selected: 'a' }, c0, { ...s0, view: 'compact' as const, selected: 'a' }]) {
    for (const side of [false, true]) {
      const keys = hotkeysFor(st, side).map(h => h.key)
      expect(new Set(keys).size).toBe(keys.length)
      expect(keys).toContain('q')
      for (const k of keys) expect(k).toMatch(/^[a-z0-9]$/)
    }
  }
  expect(hotkeysFor({ ...s0, searching: true }, false)).toEqual([])
  expect(hotkeysFor(c0, false).map(h => h.key)).toEqual(['g', 'o', 'f', 's', 'v', 'q'])
  expect(hotkeysFor({ ...c0, selected: 'a' }, false).map(h => h.key)).toEqual(['b', 'q'])
  expect(hotkeysFor({ ...c0, selected: 'a' }, true).map(h => h.key)).toEqual(['g', 'o', 'f', 's', 'v', 'b', 'q'])
  expect(hotkeysFor(s0, false).map(h => h.key)).toEqual(['g', 'o', 'f', 's', 'v', 'q']) // REQ-503: map footer = every tab's footer
  expect(hotkeysFor({ ...s0, selected: 'a' }, false).map(h => h.key)).toEqual(['v', 'b', 'q'])
})

test('session start always opens the map view, clearing persisted filters and search', async () => {
  const st = startUi()
  expect(st.view).toBe('map')
  expect(st.mode).toBe('map')
  expect(st.searching).toBe(false)
  expect(st.query).toBe('')
  expect(st.filter).toBe('all')
  expect(st.selected).toBe('')
  expect(st.attach).toBe('')
  expect(st.expanded).toEqual([])
})

test('footer: hotkeys separated by " · " and tail hint set off, never glued', async () => {
  const line = footerText(c0, false)
  expect(line).toBe('g: modo · o: ordenar · f: só falhas · s: buscar · v: visão · q: fechar')
  expect(line).not.toMatch(/visão q:/)
  expect(footerTail(c0)).toMatch(/^ · Tab entre cards/)
  const searching = { ...c0, searching: true }
  expect(hotkeysFor(searching, false)).toEqual([])
  expect(footerTail(searching)).toBe('Enter aplica a busca (vazio limpa)')
})

// Judge findings 10 and 11
test('g em árvore sem grupos colapsados pula direto ao próximo modo', async () => {
  const t = { ...s0, view: 'compact' as const, mode: 'tree' as const }
  const r = applyAction(t, 'group', { collapsed: false }).state
  expect(r.mode).toBe('grouped')
  expect(r.expanded).not.toContain('tree:fold')
  expect(applyAction(t, 'group', { collapsed: true }).state.expanded).toContain('tree:fold')
})

test('g alcança Custo e Ferramentas; Workflow só entra no ciclo com uma execução em curso (T-008, T-010)', async () => {
  const cycle = (ctx: { workflow?: boolean }) => {
    const seen: string[] = []
    let s = { ...s0, mode: 'tree' as const }
    for (let i = 0; i < 8; i++) { s = applyAction(s, 'group', { collapsed: false, ...ctx }).state as typeof s; seen.push(s.mode) }
    return seen
  }
  expect(cycle({}).slice(0, 6)).toEqual(['grouped', 'cards', 'waterfall', 'cost', 'tools', 'map'])
  expect(cycle({ workflow: false }).slice(0, 6)).toEqual(['grouped', 'cards', 'waterfall', 'cost', 'tools', 'map'])
  expect(cycle({ workflow: true }).slice(0, 7)).toEqual(['grouped', 'cards', 'waterfall', 'cost', 'tools', 'workflow', 'map'])
  // v continua mapa > árvore > cards > mapa, mesmo depois de g ter passado por Custo
  const viaCost = applyAction(applyAction(applyAction(applyAction(applyAction(s0, 'group', { collapsed: false }).state, 'group', { collapsed: false }).state, 'group', { collapsed: false }).state, 'group', { collapsed: false }).state, 'group', { collapsed: false }).state // map > tree > grouped > cards > waterfall > cost
  expect(applyAction(viaCost, 'view').state).toMatchObject({ view: 'compact', mode: 'cost' })
})

test('v do mapa mantém o modo que o usuário escolheu; sem escolha entra na árvore', async () => {
  const chosen = applyAction(applyAction(s0, 'mode:grouped').state, 'view').state
  expect(chosen).toMatchObject({ view: 'compact', mode: 'grouped' })
  const viaG = applyAction(applyAction(applyAction(applyAction(s0, 'group', { collapsed: false }).state, 'group', { collapsed: false }).state, 'group', { collapsed: false }).state, 'group', { collapsed: false }).state // g escolhe waterfall
  expect(applyAction(viaG, 'view').state).toMatchObject({ view: 'compact', mode: 'waterfall' })
  expect(applyAction(s0, 'view').state).toMatchObject({ view: 'compact', mode: 'tree' })
  expect(startUi().modeChosen).toBe(false)
})

// Achado PR 19: Custo, Ferramentas e Workflow não filtram nem buscam; f e s não aparecem nem ligam nesses modos.
test('REQ-503 hotkeys: o mesmo rodapé em toda aba, e nenhuma linha começa ou termina com |', () => {
  const base = { ...initialUi(), view: 'compact' as const }
  for (const mode of ['tree', 'grouped', 'cards', 'waterfall', 'cost', 'tools', 'workflow', 'map'] as const) {
    expect(hotkeysFor({ ...base, mode }, false).map(h => h.key)).toEqual(['g', 'o', 'f', 's', 'v', 'q'])
    for (const cols of [40, 80, 160]) for (const row of footerRows({ ...base, mode }, false, cols)) {
      const t = row.map(x => x.t).join('').trim()
      expect(t.startsWith('|') || t.endsWith('|')).toBe(false)
    }
  }
})

test('tab:map and tab:<mode> switch the app pane tabs', async () => {
  const m = applyAction({ ...initialUi(), view: 'compact', mode: 'cost', selected: 'a' }, 'tab:map').state
  expect(m).toMatchObject({ view: 'map', selected: '' })
  expect(applyAction(m, 'tab:tools').state).toMatchObject({ view: 'compact', mode: 'tools', modeChosen: true })
})

test('terminal (one view only): v alternates cards and árvore, never the map', () => {
  const cards = { ...initialUi(), view: 'compact' as const, mode: 'map' as const }
  const t = applyAction(cards, 'view', { terminal: true }).state
  expect(t).toMatchObject({ view: 'compact', mode: 'tree' })
  expect(applyAction(t, 'view', { terminal: true }).state).toMatchObject({ view: 'compact', mode: 'map' })
})

test('footer: no orphan "x:" rows, every row fits the width, j/k are visible items (not empty hidden buttons)', () => {
  const ui = { ...initialUi(), view: 'compact' as const, mode: 'map' as const }
  for (const cols of [60, 80, 160]) {
    const rows = footerRows(ui, false, cols)
    const texts = rows.map(r => r.map(x => x.t).join(''))
    for (const t of texts) {
      expect(t.trim()).not.toMatch(/^[a-z]:$/i)
      expect([...t].length).toBeLessThanOrEqual(cols)
    }
    const all = texts.join('\n')
    expect(all).toContain('j: desce'); expect(all).toContain('k: sobe')
    for (const k of ['g: ', 'o: ', 'f: ', 's: ', 'v: ', 'q: ']) expect(all).toContain(k)
    // groups keep order: filtros before visão before sair
    expect(all.indexOf('g: ')).toBeLessThan(all.indexOf('v: ')); expect(all.indexOf('v: ')).toBeLessThan(all.indexOf('q: '))
  }
  expect(footerRows(ui, false, 160)).toHaveLength(1)
  expect(footerRows(ui, false, 60).length).toBeGreaterThan(1)
})

// T-005 U-021/U-022 (REQ-009): legenda por item inteiro, rótulos "j: desce" / "k: sobe" na lista e no detalhe
test('T-005 U-021 legenda 60 colunas: itens inteiros, nenhuma palavra cortada, sem j:/k: órfão', () => {
  for (const ui of [{ ...initialUi(), view: 'compact' as const, mode: 'map' as const }, { ...initialUi(), view: 'compact' as const, mode: 'map' as const, selected: 'a1' }]) {
    const texts = footerRows(ui, false, 60).map(r => r.map(x => x.t).join(''))
    for (const t of texts) expect(t.trim()).not.toMatch(/(^|\s)[a-z]:$/i)
    const all = texts.join('\n')
    expect(all).toContain('j: desce'); expect(all).toContain('k: sobe')
    expect(all).not.toMatch(/j: rolar|k: rolar|descer|subir|subi(?!r)/)
  }
})

test('detail footer: b voltar, p/n irmão, j/k rolar, q fechar, in that order, no orphan rows', () => {
  const ui = { ...initialUi(), view: 'compact' as const, mode: 'map' as const, selected: 'a1' }
  for (const cols of [60, 80, 160]) {
    const texts = footerRows(ui, false, cols).map(r => r.map(x => x.t).join(''))
    for (const t of texts) { expect(t.trim()).not.toMatch(/^[a-z]:$/i); expect([...t].length).toBeLessThanOrEqual(cols) }
    const all = texts.join('\n')
    const pos = ['b: ', 'p/n', 'j: desce', 'k: sobe', 'q: '].map(k => all.indexOf(k))
    expect(pos.every(p => p >= 0)).toBe(true); expect([...pos].sort((x, y) => x - y)).toEqual(pos)
  }
})

test('T-601 footer rows keep a 2-column margin (the host pane is narrower than cols: items must never shrink)', () => {
  const tabs = ['map', 'tree', 'grouped', 'cards', 'waterfall', 'cost', 'tools', 'workflow'] as const
  const sig = (mode: typeof tabs[number], cols: number) => footerRows({ ...c0, mode }, false, cols).flat().filter(x => x.hotkey && x.hotkey !== 'j' && x.hotkey !== 'k').map(x => x.t).join('|')
  for (const cols of [40, 60, 80, 95, 120]) {
    for (const mode of tabs) {
      for (const row of footerRows({ ...c0, mode }, false, cols)) expect([...row.map(x => x.t).join('')].length).toBeLessThanOrEqual(Math.max(10, cols - 2))
      expect(sig(mode, cols)).toBe(sig('tree', cols)) // same keys and full labels in every tab
    }
  }
  expect(sig('tree', 95)).toContain('g: modo'); expect(sig('tree', 95)).toContain('o: ordenar'); expect(sig('tree', 95)).toContain('q: fechar')
})
