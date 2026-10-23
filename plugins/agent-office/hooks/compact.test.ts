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
  expect(out).toMatch(/✓ .*Dev|✓ a/); expect(out).toContain('✗'); expect(out).toContain('●')
  expect(out).toContain('ETA calculando'); expect(out).toContain('Office')
  expect(out).toMatch(/Níveis de profundidade: 1\/10/)
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
  expect(out).toContain('Em execução ×3'); expect(out).toContain('mediana')
  expect(out.indexOf('Atenção')).toBeLessThan(out.indexOf('Em execução'))
})
test('search filters by name', () => {
  const out = txt(renderCompact([mk('alpha'), mk('beta')], T + 1000, { ...v, query: 'alp' }))
  expect(out).not.toContain('beta')
})
test('ungrouped: rounded cards with +N hint when overflowing', () => {
  const ag = Array.from({ length: 30 }, (_, i) => mk('ag' + i))
  const out = txt(renderCompact(ag, T + 1000, { ...v, mode: 'cards', width: 100, maxCardRows: 2 }))
  expect(out).toContain('╭'); expect(out).toMatch(/↓ \+\d+ cards/)
})
test('status line and quota error', () => {
  expect(statusText([mk('a'), mk('b', { status: 'done', endedAt: T + 1 })], T + 10)).toMatch(/^● 1 ativos · \d+%/)
  expect(isQuotaError('429 rate limit exceeded: quota')).toBe(true)
  expect(isQuotaError('syntax error')).toBe(false)
  const out = txt(renderCompact([mk('q', { status: 'error', endedAt: T + 1, error: 'usage limit reached' })], T + 5, v))
  expect(out).toContain('▲')
})
test('narrow width shows only status line', () => {
  const ls = renderCompact([mk('a')], T + 1, { ...v, width: 40 })
  expect(ls.length).toBe(1); expect(txt(ls)).toContain('ativos')
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
const cardRowsAt = (out: string, w = 120) => out.split('\n').filter(l => l.startsWith('╭') && [...l].length < w)
test('cards: per_row = floor((cols - x_parent - 5 + 2) / 36): 120 -> 3, 200 -> 5, 34-col cards, 6 rows each', () => {
  const o120 = txt(renderCompact(many(7), T + 1000, { ...v, mode: 'cards', width: 120, maxCardRows: 99 }))
  expect(cardRowsAt(o120)[0]!.match(/╭/g)!.length).toBe(3)
  expect(cardRowsAt(o120)[0]!.split('╮')[0]!.length).toBe(34 - 1)
  const o200 = txt(renderCompact(many(7), T + 1000, { ...v, mode: 'cards', width: 200, maxCardRows: 99 }))
  expect(cardRowsAt(o200, 200)[0]!.match(/╭/g)!.length).toBe(5)
  const lines = o120.split('\n'); const top = lines.findIndex(l => l.startsWith('╭') && [...l].length < 120); const bot = lines.findIndex((l, i) => i > top && l.startsWith('╰'))
  expect(bot - top + 1).toBe(6)
})
test('cards: leaf children side by side under a bus line with drops (no corner), indent 5', () => {
  const ag = [mk('p', { agentId: 'P' }), ...many(4, 'P')]
  const lines = txt(renderCompact(ag, T + 1000, { ...v, mode: 'cards', width: 120, maxCardRows: 99 })).split('\n')
  const bus = lines.filter(l => /^ [├╰]┄/.test(l))
  expect(bus.length).toBe(2)
  expect(bus[0]!.startsWith(' ├┄')).toBe(true); expect(bus[1]!.startsWith(' ╰┄')).toBe(true)
  expect(bus[0]!.match(/┬/g)!.length).toBe(3); expect(bus[0]).not.toContain('╮')
  expect(bus[0]!.indexOf('┬')).toBe(6)
  expect(lines.some(l => l.startsWith(' ┊'))).toBe(true)
  expect(lines.some(l => l.startsWith('     ╭'))).toBe(true)
})
test('cards: branch siblings take one row each after leaves, subtree below', () => {
  const ag = [mk('p', { agentId: 'P' }), mk('leaf1', { parentAgentId: 'P' }), mk('br', { parentAgentId: 'P', agentId: 'B' }), mk('gk', { parentAgentId: 'B' })]
  const out = txt(renderCompact(ag, T + 1000, { ...v, mode: 'cards', width: 120, maxCardRows: 99 })).split('\n').filter(l => l.includes('│')).join('\n')
  expect(out.indexOf('leaf1')).toBeLessThan(out.indexOf('Dev: br')); expect(out.indexOf('Dev: br')).toBeLessThan(out.indexOf('Dev: gk'))
})
test('cards ASCII: ":" vertical, "." horizontal, ":" drop', () => {
  const ag = [mk('p', { agentId: 'P' }), ...many(4, 'P')]
  const out = txt(renderCompact(ag, T + 1000, { ...v, mode: 'cards', width: 120, maxCardRows: 99, caps: detectCaps({ OFFICE_ASCII: '1' }) }))
  expect(out).not.toMatch(/[┊├╰┄┬╭]/); expect(out).toMatch(/^ [:'][.]+/m); expect(out).toMatch(/^ :/m)
})
test('cards: heavy worktree divider with branch and agent count (unicode and ASCII)', () => {
  const ag = [mk('m'), mk('w', { git: { branch: 'feat/x', worktree: 'wt' } })]
  const u = txt(renderCompact(ag, T + 1000, { ...v, mode: 'cards' }))
  expect(u).toMatch(/━━ ⎇ worktree: feat\/x · 1 agentes · 1 filho em linha/); expect(u).not.toContain('── worktree')
  const a = txt(renderCompact(ag, T + 1000, { ...v, mode: 'cards', caps: detectCaps({ OFFICE_ASCII: '1' }) }))
  expect(a).toMatch(/== worktree: feat\/x - 1 agentes - 1 filho em linha/)
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
  expect(t0).toMatch(/│Office · megabor · #c716af/); expect(t0).toMatch(/● 1 ativos ✓ 1 ✗ 1 · 00:00:09 · ETA/)
  expect(t0).not.toContain('⇄'); expect(statusText([mk('a')], T + 1)).not.toContain('⇄')
  const counts = ls[1]!.filter(s => /ativos|✓|✗/.test(s.t)).map(s => s.fg)
  expect(counts).toContain('#3b82f6'); expect(counts).toContain('#22c55e'); expect(counts).toContain('#ef4444')
})
test('Geral row: hatched segmented bar, percent, g toggles', () => {
  const t0 = txt(cardsOut([mk('a', { status: 'done', endedAt: T + 100 }), mk('b')]))
  expect(t0).toMatch(/Geral [█▒]+ \d+% · g alterna agrupado/)
})
test('no slanted parallelogram glyphs anywhere (render badly in terminals)', () => {
  expect(txt(cardsOut([mk('a'), mk('b', { status: 'done', endedAt: T + 100 })]))).not.toMatch(/[▰▱]/)
})
test('card anatomy: name, persona · model, tool/status row, bar + metric + time', () => {
  const ag = [mk('r', { description: '🛠️ Pleno · 🎼 Sonnet · 🟢 baixo: run', tool: 'git', recent: ['Read', 'git'] }),
    mk('d', { status: 'done', endedAt: T + 5000 }), mk('f', { status: 'error', endedAt: T + 2000, error: 'timeout 120s tests/Nfe' })]
  const o = txt(cardsOut(ag))
  expect(o).toMatch(/Pleno · Sonnet\s+│/); expect(o).not.toContain('baixo')
  expect(o).toMatch(/▸ git ‹ Read/); expect(o).toContain('concluído'); expect(o).toContain('✗ timeout 120s tests/Nfe')
  expect(o).toMatch(/exec\s+00:09/)
})
test('running leaf has no invented percent', () => {
  expect(txt(cardsOut([mk('r')]))).not.toMatch(/█▒* +\d+%.*exec|0% 00:09/)
})
test('card border colors by state (blue running, red failed, gray done/pending)', () => {
  const ag = [mk('r'), mk('d', { status: 'done', endedAt: T + 5000 }), mk('f', { status: 'error', endedAt: T + 1000 })]
  const fg = cardsOut(ag).flatMap(l => l.filter(s => /^╭─{32}╮$/.test(s.t))).map(s => s.fg)
  expect(fg).toContain('#3b82f6'); expect(fg).toContain('#ef4444'); expect(fg).toContain('#4b5563')
})
test('footer box with +N cards hint, / buscar, g modo; legend below', () => {
  const ag = Array.from({ length: 30 }, (_, i) => mk('x' + i))
  const o = txt(cardsOut(ag, { maxCardRows: 2 }))
  expect(o).toMatch(/│↓ \+\d+ cards ocultos.*s buscar · o ordenar│/)
  expect(o).toMatch(/✓ ok\s+● rodando\s+▲ atenção\s+○ pendente\s+✗ falha/)
})
test('ASCII header/footer use plain ascii only', () => {
  const o = txt(cardsOut([mk('a')], { caps: detectCaps({ OFFICE_ASCII: '1' }), project: 'p', sessionId: 'abc123' }))
  expect(o).not.toMatch(/[^\x00-\x7F·ç-úÀ-Úã-õ…]/)
})

test('maxLines caps card lines so footer always fits', () => {
  const ag = Array.from({ length: 12 }, (_, i) => mk('m' + i))
  const ls = renderCompact(ag, T + 1000, { ...v, mode: 'cards', width: 80, maxCardRows: 99, maxLines: 20 })
  expect(ls.length).toBeLessThanOrEqual(20 + 4 + 7)
  expect(txt(ls)).toMatch(/✓ ok\s+● rodando/)
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
  expect(o).toMatch(/● Dev: r/)
  expect(txt(cardsOut([mk('legacy')]))).not.toContain('aguarda')
})
test('worktree divider summary: structure and status', () => {
  const wt = { branch: 'feat/x', worktree: 'wt' }
  const ag = [mk('p', { agentId: 'P', git: wt }), mk('a', { parentAgentId: 'P', git: wt, status: 'done', endedAt: T + 10 }), mk('b', { parentAgentId: 'P', git: wt, status: 'error', endedAt: T + 10 }),
    mk('c', { parentAgentId: 'P', git: wt, agentId: 'C' }), mk('d', { parentAgentId: 'C', git: wt })]
  const o = txt(cardsOut(ag))
  expect(o).toMatch(/━━ ⎇ worktree: feat\/x · 5 agentes · 2 filhos em linha, 1 com neto · 1 falha, 1 concluído/)
  const a = txt(cardsOut(ag, { caps: detectCaps({ OFFICE_ASCII: '1' }) }))
  expect(a).toMatch(/== worktree: feat\/x - 5 agentes - 2 filhos em linha, 1 com neto/)
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

// ---- review round: hidden-cards hint counts cards (not rows) and nested rows are cut at their real line ----
test('cards hint counts hidden cards, not hidden rows', () => {
  const ag = Array.from({ length: 6 }, (_, i) => mk('h' + i))
  const o = txt(renderCompact(ag, T + 1000, { ...v, mode: 'cards', width: 120, maxCardRows: 99, maxLines: 7 }))
  expect(o).toContain('+3 cards ocultos')
})
test('cards cut: nested child rows use their absolute line, never a dangling bus or +0 hint', () => {
  const ag = [mk('p', { agentId: 'P' }), ...Array.from({ length: 4 }, (_, i) => mk('c' + i, { parentAgentId: 'P' }))]
  const o = txt(renderCompact(ag, T + 1000, { ...v, mode: 'cards', width: 120, maxCardRows: 99, maxLines: 14 }))
  expect(o).not.toContain('+0 cards')
  expect(o).toContain('+1 cards ocultos')
})
