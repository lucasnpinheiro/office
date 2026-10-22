import { test, expect } from 'claude-code/testing'
import { detectCaps, renderCompact, statusText, detailCompact, previewLines, isQuotaError, layoutLevel, quantize } from './compact'
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
  const ag = [mk('a', { agentId: 'A', status: 'done', endedAt: T + 5000 }), mk('b'), mk('c', { status: 'running' })]
  ag.push(mk('d', { status: 'error' }))
  const out = txt(renderCompact(ag, T + 9000, v))
  expect(out).toMatch(/✓ .*Dev|✓ a/); expect(out).toContain('✗'); expect(out).toContain('●')
  expect(out).toContain('ETA calculando'); expect(out).toContain('Office Agent Monitor')
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
  const rows = out.split('\n').filter(l => /^[├╰]/.test(l)); expect(rows.length).toBe(1); expect(rows[0]).toContain('alpha')
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
const cardRowsAt = (out: string) => out.split('\n').filter(l => l.startsWith('╭'))
test('cards: per_row = floor((cols - x_parent - 5 + 2) / 36): 120 -> 3, 200 -> 5, 34-col cards, 6 rows each', () => {
  const o120 = txt(renderCompact(many(7), T + 1000, { ...v, mode: 'cards', width: 120, maxCardRows: 99 }))
  expect(cardRowsAt(o120)[0]!.match(/╭/g)!.length).toBe(3)
  expect(cardRowsAt(o120)[0]!.split('╮')[0]!.length).toBe(34 - 1)
  const o200 = txt(renderCompact(many(7), T + 1000, { ...v, mode: 'cards', width: 200, maxCardRows: 99 }))
  expect(cardRowsAt(o200)[0]!.match(/╭/g)!.length).toBe(5)
  const lines = o120.split('\n'); const top = lines.findIndex(l => l.startsWith('╭')); const bot = lines.findIndex(l => l.startsWith('╰'))
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
  expect(u).toMatch(/━━ ⎇ worktree: feat\/x · 1 agentes ━+/); expect(u).not.toContain('── worktree')
  const a = txt(renderCompact(ag, T + 1000, { ...v, mode: 'cards', caps: detectCaps({ OFFICE_ASCII: '1' }) }))
  expect(a).toMatch(/== worktree: feat\/x · 1 agentes =+/)
})
test('cards: waterfall row has span on session timeline, partial blocks; ASCII uses = and #', () => {
  const ag = [mk('a', { startedAt: T, status: 'done', endedAt: T + 4000 }), mk('b', { startedAt: T + 4000 })]
  const out = txt(renderCompact(ag, T + 8000, { ...v, mode: 'cards', width: 120 }))
  expect(out).toMatch(/▕[░ ]*[█▏▎▍▌▋▊▉]+[░ ]*▏/)
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
