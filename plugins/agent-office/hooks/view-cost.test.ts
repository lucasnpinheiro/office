import { test, expect } from 'claude-code/testing'
import { costLines } from './view-cost'
import { buildRunModel } from './run-model'
import { detectCaps } from './compact'
import { CAPABILITIES } from './capabilities'
import type { AgentLike } from './office'

// T-010 (Visão Custo). Rendered output is tested as text; ACs from tasks/T-010-cost-tools-views.md.
// Cost is never invented: per-agent cost stays `—` (no price table); tokens come from turn.step usage.
const T = 1_000_000
const mk = (id: string, o: Partial<AgentLike> = {}): AgentLike => ({ id, agentId: `g-${id}`, description: `Dev: ${id}`, status: 'working', startedAt: T, seenAt: T, ...o })
const txt = (ls: { t: string }[][]) => ls.map(l => l.map(s => s.t).join('')).join('\n')
const caps = detectCaps({ LANG: 'pt_BR.UTF-8' })
const model = (agents: AgentLike[], sessionTokens?: number) => buildRunModel(agents, T + 5000, CAPABILITIES, sessionTokens)
const view = () => ({ width: 100, caps })

const known = [
  mk('a', { usage: { tokens: 12_300 }, status: 'done', endedAt: T + 3000 }),
  mk('b', { usage: { tokens: 4_000 }, status: 'done', endedAt: T + 1000 }),
]

// AC-031: each agent shows bar, tokens, `~$` (—, no price) and time; the top shows total tokens
test('AC-031 custo: linha por agente com tokens e tempo, e total no topo', () => {
  const out = txt(costLines(model(known), T + 5000, view()))
  expect(out).toContain('12,3 mil')
  expect(out).toContain('4 mil')
  expect(out).toContain('00:03')
  expect(out.split('\n')[0]).toMatch(/total.*16,3 mil/) // 12 300 + 4 000
})

// AC-032: unknown agent shows `—`, total sums only the known ones and is marked `parcial`
test('AC-032 custo: agente sem dado mostra —, total marcado parcial', () => {
  const out = txt(costLines(model([...known, mk('c', { status: 'done', endedAt: T + 2000 })]), T + 5000, view()))
  expect(out).toMatch(/c .*—/)
  expect(out.split('\n')[0]).toMatch(/16,3 mil parcial/)
})

// AC-033: nothing known -> total `—`, never `~$0,00`
test('AC-033 custo: sem nenhum dado, total em traço e nunca ~$0,00', () => {
  const out = txt(costLines(model([mk('x', { status: 'done', endedAt: T + 1000 })]), T + 5000, view()))
  expect(out.split('\n')[0]).toMatch(/total —/)
  expect(out).not.toContain('~$0')
})

test('AC-031 custo: tokens da sessão principal entram no total', () => {
  const out = txt(costLines(model(known, 500), T + 5000, view()))
  expect(out.split('\n')[0]).toMatch(/16,8 mil/)
})
