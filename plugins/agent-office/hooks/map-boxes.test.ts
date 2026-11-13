import { test, expect } from 'claude-code/testing'
import { renderBoxMap, BOX_W } from './map-boxes'
import { strWidth } from './monitor'
import type { Line } from './monitor'
import type { AgentLike } from './office'

const T = 1_000_000
const mk = (id: string, o: Partial<AgentLike> = {}): AgentLike => ({ id, description: `Dev: ${id}`, status: 'working', startedAt: T, seenAt: T, ...o })
const base = { project: 'loja-web', sessionId: 'e13b5aa', ascii: false, color: true }
const txt = (ls: Line[]) => ls.map(l => l.map(s => s.t).join(''))
const D = (p: string, m: string, e: string) => `${p} · ${m} · ${e}`
const agents = [
  mk('a', { description: `${D('🧭 Squad Leader', '👑 Opus', '🟢 baixo')}: Orquestrar` }),
  mk('b', { description: `${D('🛠️ Pleno', '🎼 Sonnet', '🟡 médio')}: Tela`, status: 'done', endedAt: T + 5000 }),
  mk('c', { description: 'Dev: filho', parentAgentId: 'g-a' }),
  mk('d', { description: 'Dev: erro', status: 'error' }),
].map((a, i) => ({ ...a, agentId: `g-${'abcd'[i]}` }))

test('map boxes: header, root box, bus, children boxed, every box row has equal display width', () => {
  const out = renderBoxMap(agents, T + 9000, { ...base, width: 130 })!
  const t = txt(out)
  expect(t[0]).toContain('Office Agent Monitor'); expect(t[0]).toContain('Progresso geral')
  expect(t[1]).toContain('loja-web'); expect(t[1]).toContain('Decorrido'); expect(t[1]).toContain('Estimativa')
  expect(t.some(l => l.includes('Claude Code / Orquestrador'))).toBe(true)
  expect(t.filter(l => l.includes('┬')).length).toBeGreaterThan(1)
  expect(t.some(l => l.includes('┌') && (l.includes('┴') || l.includes('┼')) && l.includes('─'))).toBe(true)
  const tops = t.filter(l => l.includes('┌' + '─'.repeat(BOX_W - 2) + '┐'))
  expect(tops.length).toBeGreaterThanOrEqual(2)
  // a closed box: the right border sits at the same display column as its top-right corner, emoji included
  for (const l of t.filter(l => /^\s*│/.test(l) || l.includes('│'))) {
    const cols = [...l].reduce<number[]>((acc, ch, i, arr) => { if (ch === '│') acc.push(strWidth(arr.slice(0, i).join(''))); return acc }, [])
    for (const c of cols) expect(c % 1).toBe(0)
  }
  const persona = t.find(l => l.includes('🧭 Squad Leader'))!
  expect(persona).toContain('👑 Opus'); expect(persona).toContain('🟢 baixo')
  const w = strWidth(persona.slice(persona.indexOf('│'), persona.indexOf('│') + 1 + 0))
  expect(w).toBe(1)
  expect(strWidth(persona.slice(persona.indexOf('│'), persona.indexOf('│', persona.indexOf('│') + 1) + 1))).toBe(BOX_W)
})

test('map boxes: border colour follows the state, boxes are clickable', () => {
  const out = renderBoxMap(agents, T + 9000, { ...base, width: 130 })!
  const colours = new Set(out.flat().filter(s => s.t.includes('┌')).map(s => s.fg))
  expect(colours.size).toBeGreaterThan(1)
  expect(out.flat().some(s => !!s.node && s.node.endsWith('d'))).toBe(true)
})

test('map boxes: siblings that do not fit wrap to a new row and the trunk joins them', () => {
  const many = Array.from({ length: 5 }, (_, i) => mk(`k${i}`))
  const t = txt(renderBoxMap(many, T + 1000, { ...base, width: 100 })!)
  const tops = t.filter(l => l.includes('┌' + '─'.repeat(BOX_W - 2) + '┐')).length
  expect(tops).toBeGreaterThan(3) // root + 5 children, two per row
  expect(t.some(l => l.startsWith('└') || l.startsWith('├'))).toBe(true)
  for (const l of t) expect(strWidth(l)).toBeLessThanOrEqual(100)
})

test('map boxes: ASCII mode uses + - | and drops the icons; NO_COLOR drops colours', () => {
  const t = txt(renderBoxMap(agents, T + 9000, { ...base, width: 130, ascii: true, color: false })!).join('\n')
  expect(t).not.toMatch(/[─│┌┐└┘┬┴🧭👑]/)
  expect(t).toContain('Squad Leader - Opus - baixo')
  expect(renderBoxMap(agents, T + 9000, { ...base, width: 130, color: false })!.flat().every(s => !s.fg)).toBe(true)
})

test('map boxes: null when the pane is narrower than a box or there are no agents (text map is the fallback)', () => {
  expect(renderBoxMap(agents, T, { ...base, width: BOX_W })).toBeNull()
  expect(renderBoxMap([], T, { ...base, width: 130 })).toBeNull()
})
