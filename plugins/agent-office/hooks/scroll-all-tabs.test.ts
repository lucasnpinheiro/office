import { test, expect } from 'claude-code/testing'
import { renderCompact, detectCaps } from './compact'
import type { AgentLike } from './office'

// click scroll in every tab: `↑ mais` / `↓ mais` notes and a scrollbar track on the last column (above thumb = up, below = down, thumb inert)
const T = 1_000_000
const mk = (id: string): AgentLike => ({ id, agentId: `g-${id}`, description: `Dev: ${id}`, status: 'working', startedAt: T, seenAt: T } as AgentLike)
const caps = detectCaps({ COLORTERM: 'truecolor', LANG: 'en_US.UTF-8' })
const asciiCaps = detectCaps({ COLORTERM: 'truecolor', LANG: 'en_US.UTF-8' }, { ascii: true })
// git and workflow fields so the grouped (worktrees) and workflow tabs have one block per agent
const many = Array.from({ length: 30 }, (_, i) => ({ ...mk(`n${i}`), git: { worktree: `/wt/n${i}`, branch: `b${i}` }, workflow: { runId: `r${i}`, agentIndex: 0 } }) as AgentLike)
// tools tab reads the run model: one finished tool call per agent
const toolModel = { roots: [], attention: [], totals: { running: 30, done: 0, of: 30, partial: false }, nodes: many.map(a => ({ id: a.id, name: a.description, kind: 'agent', state: 'done', steps: [{ id: `s-${a.id}`, tool: 'Bash', label: 'ls', startedAt: T, durationMs: 5, ok: true }], droppedSteps: 0 })) } as never
const TABS = ['map', 'tree', 'grouped', 'cards', 'waterfall', 'cost', 'tools', 'workflow'] as const
const view = (mode: string, scroll: number, c = caps, maxLines = 30, width = 120, rows = many) =>
  renderCompact(rows, T + 5000, { width, caps: c, mode, query: '', expanded: new Set<string>(), maxCardRows: 99, maxLines, scroll, ...(mode === 'tools' ? { model: toolModel } : {}) } as Parameters<typeof renderCompact>[2])
const segs = (out: ReturnType<typeof renderCompact>) => out.flat()
const acts = (out: ReturnType<typeof renderCompact>) => segs(out).filter(s => s.act).map(s => s.act)
const track = (out: ReturnType<typeof renderCompact>) => out.map(l => l[l.length - 1]!).filter(s => ['░', '█', '|', '#'].includes(s?.t ?? ''))

for (const mode of TABS) {
  test(`${mode}: a scrolled tab offers the click-up note and the track segments above the thumb`, () => {
    const mid = view(mode, 3)
    expect(acts(mid)).toContain('scrollUp')
    expect(acts(mid)).toContain('scrollDown')
    expect(track(mid).some(s => s.act === 'scrollUp')).toBe(true)
    expect(track(mid).some(s => s.act === 'scrollDown')).toBe(true)
  })

  test(`${mode}: at the top there is no up target; at the end there is no down target`, () => {
    expect(acts(view(mode, 0))).not.toContain('scrollUp')
    expect(track(view(mode, 0)).some(s => s.act === 'scrollUp')).toBe(false)
    expect(acts(view(mode, 99999))).not.toContain('scrollDown')
    expect(track(view(mode, 99999)).some(s => s.act === 'scrollDown')).toBe(false)
  })

  test(`${mode}: the thumb is inert`, () => {
    for (const s of [0, 3, 99999]) {
      const thumb = track(view(mode, s)).filter(x => x.t === '█' || x.t === '#')
      expect(thumb.length).toBeGreaterThan(0)
      expect(thumb.every(x => !x.act)).toBe(true)
    }
  })
}

test('ascii: notes read ^ mais / v mais and the track is | with # thumb', () => {
  const mid = view('tree', 3, asciiCaps)
  const texts = segs(mid).map(s => s.t)
  expect(texts.some(t => /\^ (\d+ )?mais/.test(t))).toBe(true)
  expect(texts.some(t => /v (\d+ )?mais/.test(t))).toBe(true)
  expect(track(mid).some(s => s.t === '|' && s.act === 'scrollUp')).toBe(true)
  expect(track(mid).some(s => s.t === '#')).toBe(true)
})

test('short pane (80x24 body): no notes, only the track', () => {
  const short = view('tree', 3, caps, 6, 80)
  expect(segs(short).some(s => s.act && s.t.includes('mais'))).toBe(false)
  expect(track(short).length).toBeGreaterThan(0)
})

// every row fits the pane width; a row carrying the track ends exactly on the last column (no row wider than w)
import { lineWidth } from './monitor'
for (const mode of TABS) for (const width of [80, 200]) {
  test(`${mode} ${width} cols: no row wider than the pane, track in the last column`, () => {
    for (const scroll of [0, 3, 99999]) {
      for (const l of view(mode, scroll, caps, 30, width)) {
        expect(lineWidth(l)).toBeLessThanOrEqual(width)
        const last = l[l.length - 1]
        if (last && ['░', '█', '|', '#'].includes(last.t)) expect(lineWidth(l)).toBe(width)
      }
    }
  })
}
