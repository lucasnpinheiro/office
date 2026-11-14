import { test, expect } from 'claude-code/testing'
import { DEFAULT_MODE, detectCaps, renderCompact, statusText, detailCompact, previewLines, isQuotaError, layoutLevel, quantize } from './compact'
import type { AgentLike } from './office'

const T = 1_000_000
const mk = (id: string, o: Partial<AgentLike> = {}): AgentLike => ({ id, description: `Dev: ${id}`, status: 'working', startedAt: T, seenAt: T, ...o })
const txt = (ls: { t: string }[][]) => ls.map(l => l.map(s => s.t).join('')).join('\n')

test('caps: ASCII auto for linux/dumb/non-UTF-8, forced by OFFICE_ASCII, UTF-8 otherwise', () => {
  expect(detectCaps({ TERM: 'linux' }).ascii).toBe(true)
  expect(detectCaps({ TERM: 'dumb' }).ascii).toBe(true)
  expect(detectCaps({ TERM: 'xterm', LANG: 'C' }).ascii).toBe(true)
  expect(detectCaps({ TERM: 'xterm', LANG: 'pt_BR.UTF-8' }).ascii).toBe(false)
  expect(detectCaps({ TERM: 'xterm', LANG: 'pt_BR.UTF-8', OFFICE_ASCII: '1' }).ascii).toBe(true)
  expect(detectCaps({ OS: 'Windows_NT' }).numbered).toBe(true)
  expect(detectCaps({ OS: 'Windows_NT', WT_SESSION: 'x' }).numbered).toBe(false)
})
test('caps: color truecolor > 256 > 16 > mono; reduced motion', () => {
  expect(detectCaps({ COLORTERM: 'truecolor' }).color).toBe('truecolor')
  expect(detectCaps({ TERM: 'xterm-256color' }).color).toBe('256')
  expect(detectCaps({ TERM: 'xterm' }).color).toBe('16')
  expect(detectCaps({ COLORTERM: 'truecolor', NO_COLOR: '1' }).color).toBe('mono')
  expect(detectCaps({ COLORTERM: 'truecolor' }, { isTTY: false }).color).toBe('mono')
  expect(detectCaps({ CI: 'true' }).reducedMotion).toBe(true)
  expect(detectCaps({ OFFICE_REDUCED_MOTION: '1' }).reducedMotion).toBe(true)
  expect(detectCaps({}).reducedMotion).toBe(false)
  expect(quantize('#ff0000', 'mono')).toBeUndefined()
  expect(quantize('#ff0000', 'truecolor')).toBe('#ff0000')
})
test('layout level by width', () => {
  expect(layoutLevel(120)).toBe('full'); expect(layoutLevel(70)).toBe('abbr'); expect(layoutLevel(40)).toBe('line')
})
const caps = detectCaps({ COLORTERM: 'truecolor', LANG: 'en_US.UTF-8' })
const v = { width: 110, caps, mode: 'tree' as const, query: '', expanded: new Set<string>(), maxCardRows: 3 }
test('tree: one line per agent, glyphs, unique names, ETA calculando, legend', () => {
  const ag = [mk('a', { agentId: 'A', status: 'done', endedAt: T + 5000 }), mk('b'), mk('c', { status: 'working' })]
  ag.push(mk('d', { status: 'error' }))
  const out = txt(renderCompact(ag, T + 9000, v))
  expect(out).toMatch(/✓ .*Dev|✓ a/); expect(out).toContain('✗'); expect(out).toContain('⠹')
  expect(out).toContain('ETA calculando'); expect(out).toContain('Office')
  expect(out).toMatch(/Níveis de profundidade: 1\/20/)
})
test('tree: ASCII fallback has no unicode box/glyphs', () => {
  const a = detectCaps({ OFFICE_ASCII: '1' })
  const out = txt(renderCompact([mk('x')], T + 1000, { ...v, caps: a }))
  expect(out).not.toMatch(/[╭╮╰╯│─●✓✗]/)
})
test('child shows task count instead of 0%', () => {
  const out = txt(renderCompact([mk('a', { todos: [{ content: 't1', status: 'completed' }, { content: 't2', status: 'pending' }] })], T + 1000, v))
  expect(out).toContain('1/2')
})
test('grouped: siblings collapse by state with xN and failures pinned on top', () => {
  const ag = [mk('a'), mk('b'), mk('c'), mk('d', { status: 'error', endedAt: T + 1 })]
  const out = txt(renderCompact(ag, T + 9000, { ...v, mode: 'grouped' }))
  expect(out).toContain('Rodando ×3'); expect(out).toContain('mediana')
  expect(out.indexOf('Dev: d')).toBeLessThan(out.indexOf('Rodando ×3'))
})
test('search filters by name', () => {
  const out = txt(renderCompact([mk('alpha'), mk('beta')], T + 1000, { ...v, query: 'alp' }))
  expect(out).not.toContain('beta')
})
test('ungrouped: rounded cards, all 30 drawn even when the pane is short (dense), never a +N hint', () => {
  const ag = Array.from({ length: 30 }, (_, i) => mk('ag' + i))
  const out = txt(renderCompact(ag, T + 1000, { ...v, mode: 'cards', width: 100, maxCardRows: 2 }))
  expect(out).toContain('╭'); expect(out).not.toMatch(/↓ \+\d+ cards/); expect((out.match(/Dev: ag\d+/g) ?? []).length).toBe(30)
})
test('status line and quota error', () => {
  expect(statusText([mk('a'), mk('b', { status: 'done', endedAt: T + 1 })], T + 10)).toMatch(/^⠹ 1 ativos · \d+%/)
  expect(isQuotaError('429 rate limit exceeded: quota')).toBe(true)
  expect(isQuotaError('syntax error')).toBe(false)
  const out = txt(renderCompact([mk('q', { status: 'error', endedAt: T + 1, error: 'usage limit reached' })], T + 5, v))
  expect(out).toContain('▲')
})
test('narrow width (< 60) shows only the list: no header, no footer (T-013, AC-042)', () => {
  const ls = renderCompact([mk('a')], T + 1, { ...v, width: 40 })
  expect(txt(ls)).toContain('Dev: a'); expect(txt(ls)).not.toContain('Office'); expect(txt(ls)).not.toContain('Concluído')
})
test('detail: deps navigable, siblings, attachments', () => {
  const ag = [mk('p', { agentId: 'P' }), mk('c1', { parentAgentId: 'P', files: ['/x/a.diff'] }), mk('c2', { parentAgentId: 'P' })]
  const d = detailCompact(ag, 'c1', T + 1000, caps)!
  const s = d.flat().filter(x => x.node).map(x => x.node)
  expect(s).toContain('p'); expect(s).toContain('c2')
  expect(txt(d)).toContain('/x/a.diff')
  expect(d.flat().some(x => x.attach === '/x/a.diff')).toBe(true)
})
test('preview: colored diff, text, image fallback', () => {
  const p = previewLines('@@ -1 +1 @@\n-a\n+b\n c', '/x/a.diff', 10)
  expect(p.map(l => l[0]!.fg)).toContain('#22c55e'); expect(p.map(l => l[0]!.fg)).toContain('#ef4444')
  expect(txt(previewLines('hello', '/x/a.log', 10))).toContain('hello')
  expect(txt(previewLines('', '/x/a.png', 10))).toContain('imagem')
})

const many = (n: number, parent?: string) => Array.from({ length: n }, (_, i) => mk('s' + i, parent ? { parentAgentId: parent } : {}))
const cardCount = (out: string) => out.split('\n').map(l => (l.match(/╭[─┴]{32}╮/g) ?? []).length).filter(k => k > 0)
test('cards: siblings per row follow the pane width: 120 -> 3, 200 -> 5, 34-col cards, 7 rows each', () => {
  const o120 = txt(renderCompact(many(7), T + 1000, { ...v, mode: 'cards', width: 120, maxCardRows: 99 }))
  expect(cardCount(o120)).toEqual([1, 3, 3, 1]) // the parent card (main session), then the wrapped sibling rows
  const o200 = txt(renderCompact(many(7), T + 1000, { ...v, mode: 'cards', width: 200, maxCardRows: 99 }))
  expect(cardCount(o200)).toEqual([1, 5, 2])
  const lines = o120.split('\n'); const top = lines.findIndex(l => /^ +╭─{32}╮/.test(l)); const bot = lines.findIndex((l, i) => i > top && /^ +╰/.test(l))
  expect(bot - top + 1).toBe(7)
})
test('cards: wrapped sibling rows hang off a dotted trunk on the left, each child under its own drop', () => {
  const ag = [mk('p', { agentId: 'P' }), ...many(4, 'P')]
  const lines = txt(renderCompact(ag, T + 1000, { ...v, mode: 'cards', width: 120, maxCardRows: 99 })).split('\n')
  const first = lines.find(l => /^ *╭┄/.test(l))!, last = lines.find(l => /^ *╰┄/.test(l))!
  expect(first).toBeDefined(); expect(last).toBeDefined()
  expect(first.match(/[┬┼╮]/g)!.length).toBe(3) // three children on the first row
  expect(last.match(/[┬╮]/g)!.length).toBe(1) // the fourth wraps
  expect(lines.some(l => /^ *┊ ╭/.test(l))).toBe(true) // the trunk runs beside the first row
  expect(lines.some(l => /^ +┊$/.test(l))).toBe(true) // single child (session -> P): a straight dotted drop
})
test('cards: branch siblings take one row each after leaves, subtree below', () => {
  const ag = [mk('p', { agentId: 'P' }), mk('leaf1', { parentAgentId: 'P' }), mk('br', { parentAgentId: 'P', agentId: 'B' }), mk('gk', { parentAgentId: 'B' })]
  const out = txt(renderCompact(ag, T + 1000, { ...v, mode: 'cards', width: 120, maxCardRows: 99 })).split('\n').filter(l => l.includes('│')).join('\n')
  expect(out.indexOf('leaf1')).toBeLessThan(out.indexOf('Dev: br')); expect(out.indexOf('Dev: br')).toBeLessThan(out.indexOf('Dev: gk'))
})
test('cards ASCII: ":" vertical, "." horizontal, "+" joints', () => {
  const ag = [mk('p', { agentId: 'P' }), ...many(4, 'P')]
  const out = txt(renderCompact(ag, T + 1000, { ...v, mode: 'cards', width: 120, maxCardRows: 99, caps: detectCaps({ OFFICE_ASCII: '1' }) }))
  expect(out).not.toMatch(/[┊├╰┄┬┴╭]/); expect(out).toMatch(/^ *\+\.+/m); expect(out).toMatch(/^ *: /m)
})
test('cards: the worktree rides on the bottom border of its card (unicode and ASCII), no full-width divider', () => {
  const ag = [mk('m'), mk('w', { git: { branch: 'feat/x', worktree: 'wt' } })]
  const u = txt(renderCompact(ag, T + 1000, { ...v, mode: 'cards' }))
  expect(u).toMatch(/╰─ agente ─+ ⧉ feat\/x ─╯/); expect(u).not.toContain('━━')
  const a = txt(renderCompact(ag, T + 1000, { ...v, mode: 'cards', caps: detectCaps({ OFFICE_ASCII: '1' }) }))
  expect(a).toMatch(/ wt feat\/x /)
})
test('cards: waterfall row has span on session timeline, partial blocks; ASCII uses = and #', () => {
  const ag = [mk('a', { startedAt: T, status: 'done', endedAt: T + 4000 }), mk('b', { startedAt: T + 4000 })]
  const w = txt(renderCompact(ag, T + 8000, { ...v, mode: 'waterfall', frame: 3 }))
  expect(w).toContain('0s'); expect(w).toMatch(/[▏▎▍▌▋▊▉█]/)
  const a = txt(renderCompact(ag, T + 8000, { ...v, mode: 'waterfall', frame: 3, caps: detectCaps({ OFFICE_ASCII: '1' }) }))
  expect(a).toMatch(/=+/); expect(a).not.toMatch(/[▏▎▍▌▋▊▉█░]/)
})
test('shimmer moves with frame; reduced motion is static', () => {
  const ag = [mk('b', { startedAt: T })]
  const f = (frame: number, caps = v.caps) => renderCompact(ag, T + 9000, { ...v, mode: 'waterfall', frame, caps })
  expect(JSON.stringify(f(0))).not.toBe(JSON.stringify(f(3)))
  const rm = detectCaps({ COLORTERM: 'truecolor', OFFICE_REDUCED_MOTION: '1' })
  expect(JSON.stringify(f(0, rm))).toBe(JSON.stringify(f(3, rm)))
})
test('staggered bar growth right after start, full later', () => {
  const ag = [mk('x', { startedAt: T, status: 'done', endedAt: T + 1000 })]
  const g = (now: number) => txt(renderCompact(ag, now, { ...v, mode: 'cards' }))
  expect((g(T + 100).match(/█/g) ?? []).length).toBeLessThan((g(T + 5000).match(/█/g) ?? []).length)
})

// ---- Rodada 4 (design: variante sem agrupar) ----
const cardsOut = (ag: AgentLike[], o: Record<string, unknown> = {}) => renderCompact(ag, T + 9000, { ...v, mode: 'cards', width: 120, maxCardRows: 99, ...o })
test('cards is the default mode', () => { expect(DEFAULT_MODE).toBe('cards') })
test('header: rounded box, Office - project - #sid left, colored counts + elapsed + ETA right, no ambiguous arrows', () => {
  const ag = [mk('a', { status: 'done', endedAt: T + 100 }), mk('b'), mk('c', { status: 'error', endedAt: T + 100 })]
  const ls = cardsOut(ag, { project: 'megabor', sessionId: 'c716af99' })
  const t0 = txt(ls)
  expect(ls[0]![0]!.t).toMatch(/^╭─+╮$/)
  expect(t0).toMatch(/│Office Agent Monitor · megabor · #c716af/); expect(t0).toMatch(/⠹ 1 ativos ✓ 1 ✗ 1 · 00:00:09 · tokens — · ETA/)
  expect(t0).not.toContain('⇄'); expect(statusText([mk('a')], T + 1)).not.toContain('⇄')
  const counts = ls[1]!.filter(s => /ativos|✓|✗/.test(s.t)).map(s => s.fg)
  expect(counts).toContain('#7FA9FF'); expect(counts).toContain('#6FD08C'); expect(counts).toContain('#FF8A80')
})
test('Geral row: hatched segmented bar, percent, g toggles', () => {
  const t0 = txt(cardsOut([mk('a', { status: 'done', endedAt: T + 100 }), mk('b')]))
  expect(t0).toMatch(/Geral [█▒]+ \d+% · g alterna modo/)
})
test('no slanted parallelogram glyphs anywhere (render badly in terminals)', () => {
  expect(txt(cardsOut([mk('a'), mk('b', { status: 'done', endedAt: T + 100 })]))).not.toMatch(/[▰▱]/)
})
test('card anatomy: name, persona · model, tool/status row, bar + metric + time', () => {
  const ag = [mk('r', { description: '🧪 QA · 🎼 Sonnet · 🟢 baixo: run', tool: 'git', recent: ['Read', 'git'] }),
    mk('d', { status: 'done', endedAt: T + 5000 }), mk('f', { status: 'error', endedAt: T + 2000, error: 'timeout 120s tests/Nfe' })]
  const o = txt(cardsOut(ag))
  expect(o).toMatch(/🧪 QA · 🎼 Sonnet · 🟢 baixo\s+│/)
  expect(o).toMatch(/▸ git ‹ Read/); expect(o).toContain('concluído'); expect(o).toContain('✗ timeout 120s tests/Nfe')
  expect(o).toMatch(/exec\s+00:09/)
})
test('running leaf has no invented percent', () => {
  expect(txt(cardsOut([mk('r')])).split('\n').filter(l => l.includes('exec')).join('\n')).not.toMatch(/█▒* +\d+%.*exec|0% 00:09/)
})
test('card border colors by state (blue running, red failed, gray done/pending)', () => {
  const ag = [mk('r'), mk('d', { status: 'done', endedAt: T + 5000 }), mk('f', { status: 'error', endedAt: T + 1000 })]
  const fg = cardsOut(ag).flatMap(l => l.filter(s => /^╭─+$/.test(s.t))).map(s => s.fg)
  expect(fg).toContain('#7FA9FF'); expect(fg).toContain('#FF8A80'); expect(fg).toContain('#4b5563')
})
test('short pane: no hidden-cards box, every card drawn dense; legend below', () => {
  const ag = Array.from({ length: 30 }, (_, i) => mk('x' + i))
  const o = txt(cardsOut(ag, { maxCardRows: 2 }))
  expect(o).not.toContain('cards ocultos'); for (let i = 0; i < 30; i++) expect(o).toContain('Dev: x' + i)
  expect(o).toMatch(/✓ Concluído\s+⠹ Rodando\s+▲ Parado sem sinal\s+○ Na fila\s+✗ Falhou/)
})
test('ASCII header/footer use plain ascii only', () => {
  const o = txt(cardsOut([mk('a')], { caps: detectCaps({ OFFICE_ASCII: '1' }), project: 'p', sessionId: 'abc123' }))
  expect(o).not.toMatch(/[^\x00-\x7F·ç-úÀ-Úã-õ…]/)
})

test('maxLines: a short pane halves the card rows (dense) instead of cutting cards; the footer is still drawn', () => {
  const ag = Array.from({ length: 12 }, (_, i) => mk('m' + i))
  const ls = renderCompact(ag, T + 1000, { ...v, mode: 'cards', width: 80, maxCardRows: 99, maxLines: 20 })
  const tall = renderCompact(ag, T + 1000, { ...v, mode: 'cards', width: 80, maxCardRows: 99, maxLines: 999 })
  expect(ls.length).toBeLessThan(tall.length / 2 + 8)
  expect((txt(ls).match(/Dev: m\d+/g) ?? []).length).toBe(12)
  expect(txt(ls)).toMatch(/✓ Concluído\s+⠹ Rodando/)
})

// ---- gaps round: real %, pending, worktree summary, filter/sort, hotkeys ----
test('leaf with TodoWrite shows real percent and count; without todos no percent', () => {
  const ag = [mk('t', { todos: [{ content: 'a', status: 'completed' }, { content: 'b', status: 'in_progress' }, { content: 'c', status: 'pending' }, { content: 'd', status: 'pending' }] })]
  const o = txt(cardsOut(ag))
  expect(o).toMatch(/25% 00:09/); expect(o).toContain('1/4')
})
test('pending: spawned agent with no tool call yet (active=false) shows aguarda, hatched bar', () => {
  const o = txt(cardsOut([mk('q', { active: false }), mk('r', { active: true })]))
  expect(o).toContain('aguarda 1ª ação'); expect(o).toMatch(/○ Dev: q/)
  expect(o).toMatch(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏] Dev: r/) // spinner gira com o quadro (frame 0 = ⠋)
  expect(txt(cardsOut([mk('legacy')]))).not.toContain('aguarda')
})
test('worktree badge: every card of the worktree carries it, with its role', () => {
  const wt = { branch: 'feat/x', worktree: 'wt' }
  const ag = [mk('p', { agentId: 'P', git: wt }), mk('a', { parentAgentId: 'P', git: wt, status: 'done', endedAt: T + 10 }), mk('b', { parentAgentId: 'P', git: wt, status: 'error', endedAt: T + 10 }),
    mk('c', { parentAgentId: 'P', git: wt, agentId: 'C' }), mk('d', { parentAgentId: 'C', git: wt })]
  const o = txt(cardsOut(ag))
  expect((o.match(/⧉ feat\/x/g) ?? []).length).toBe(5)
  expect((o.match(/─ subagente ─/g) ?? []).length).toBe(4); expect((o.match(/─ agente ─/g) ?? []).length).toBe(1)
})
test('filter failed keeps only failures/attention; sort by state puts failures first', () => {
  const ag = [mk('ok', { status: 'done', endedAt: T + 5 }), mk('bad', { status: 'error', endedAt: T + 5 }), mk('run')]
  const f = txt(cardsOut(ag, { filter: 'failed' }))
  expect(f).toContain('Dev: bad'); expect(f).not.toContain('Dev: ok'); expect(f).not.toContain('Dev: run')
  const s = txt(cardsOut(ag, { sort: 'state' }))
  expect(s.indexOf('Dev: bad')).toBeLessThan(s.indexOf('Dev: run')); expect(s.indexOf('Dev: run')).toBeLessThan(s.indexOf('Dev: ok'))
})
test('filter bar only in grouped mode; cards mode has no hotkey segs (pane draws them per view)', () => {
  const ag = [mk('a'), mk('b', { status: 'error', endedAt: T + 5 })]
  expect(txt(renderCompact(ag, T + 9000, { ...v, mode: 'grouped' }))).toMatch(/Agrupado.*Todos os cards 2.*Falhas 1/)
  const ls = cardsOut(ag)
  expect(txt(ls)).not.toMatch(/Agrupado.*Todos os cards/)
  expect(ls.flat().filter(s => s.hotkey).length).toBe(0)
})
test('detail has hotkeys for back and sibling navigation', () => {
  const ag = [mk('p', { agentId: 'P' }), mk('c1', { parentAgentId: 'P' }), mk('c2', { parentAgentId: 'P' })]
  const hot = detailCompact(ag, 'c1', T + 1000, caps)!.flat().filter(s => s.hotkey).map(s => s.hotkey)
  expect(hot).toEqual(expect.arrayContaining(['n']))
})

// ---- no cut: a pane too short for the full cards draws them dense, never fewer ----
test('cards never cut: 6 siblings in a 7-line budget are all drawn', () => {
  const ag = Array.from({ length: 6 }, (_, i) => mk('h' + i))
  const o = txt(renderCompact(ag, T + 1000, { ...v, mode: 'cards', width: 120, maxCardRows: 99, maxLines: 7 }))
  expect(o).not.toContain('cards ocultos'); for (let i = 0; i < 6; i++) expect(o).toContain('Dev: h' + i)
})

test('detail: nota de captura desligada também no detalhe compacto', () => {
  const ag = [mk('p', { agentId: 'P' })]
  expect(txt(detailCompact(ag, 'p', T + 1000, caps)!)).toContain('OFFICE_CAPTURE_IO=1')
  expect(txt(detailCompact(ag, 'p', T + 1000, caps, true)!)).not.toContain('OFFICE_CAPTURE_IO=1')
})

// T-014 leftover (AC-045/AC-046): the spinner glyph cycles in the real render, fixed in reduced motion
const spinTxt = (frame: number, c: typeof caps, mode: 'tree' | 'cards' | 'waterfall') =>
  txt(renderCompact([mk('r', { status: 'working' })], T + 9000, { ...v, mode, caps: c, frame }))
const SPIN = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
for (const mode of ['tree', 'cards', 'waterfall'] as const) {
  test(`spinner glyph cycles with the frame in ${mode} render`, () => {
    for (let f = 0; f < 10; f++) expect(spinTxt(f, caps, mode)).toContain(SPIN[f]!)
  })
  test(`spinner glyph stays fixed in reduced motion and ASCII (${mode})`, () => {
    const red = detectCaps({ COLORTERM: 'truecolor', LANG: 'en_US.UTF-8', OFFICE_REDUCED_MOTION: '1' })
    for (const f of [0, 5, 7]) {
      const o = spinTxt(f, red, mode)
      expect(o).toContain('⠹')
      for (const g of SPIN.filter(x => x !== '⠹')) expect(o).not.toContain(g)
    }
    const asc = detectCaps({ COLORTERM: 'truecolor', LANG: 'en_US.UTF-8', OFFICE_ASCII: '1' })
    for (const f of [3, 4]) for (const g of SPIN) expect(spinTxt(f, asc, mode)).not.toContain(g)
  })
}

test('card chips: persona, model and effort chips on ONE line when they fit; task as title', () => {
  const ag = [mk('t', { description: '🎨 UX/UI · 🎼 Sonnet · 🟢 baixo: Render HTML no app Claude Code' })]
  const o = txt(cardsOut(ag))
  expect(o).toContain('Render HTML no app Claude Code')
  expect(o).toMatch(/│🎨 UX\/UI · 🎼 Sonnet · 🟢 baixo\s+│/)
})
test('card chips: too wide for one line falls back to persona line + model · effort line', () => {
  const ag = [mk('t', { description: '🧠 Specialist · 🎼 Sonnet · 🟡 médio: Validar regra' })]
  const o = txt(cardsOut(ag))
  expect(o).toMatch(/│🧠 Specialist\s+│/)
  expect(o).toMatch(/│🎼 Sonnet · 🟡 médio\s+│/)
})
test('card title: long task overflows to a second line instead of being cut', () => {
  const o = txt(cardsOut([mk('t', { description: '🧪 QA · 🪶 Haiku · 🟢 baixo: Atualizar a documentação completa do plugin office' })]))
  expect(o).toContain('Atualizar a documentação'); expect(o).toContain('plugin office')
})
test('card chips: no prefix in the description, subagent_type rapido gives Haiku low', () => {
  const o = txt(cardsOut([mk('t', { description: 'Varrer docs', subagentType: 'rapido' })]))
  expect(o).toMatch(/│🤖 Agente · 🪶 Haiku · 🟢 baixo\s+│/)
})
test('card chips: description without the format falls back to generic persona, no model/effort line noise', () => {
  const o = txt(cardsOut([mk('g', { description: 'sem formato' })]))
  expect(o).toContain('sem formato')
  expect(o).toMatch(/│🤖 Agente\s+│/)
})
