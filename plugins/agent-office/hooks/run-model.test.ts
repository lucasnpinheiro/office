import { test, expect } from 'claude-code/testing'
import { buildRunModel, buildGraph, progressOf, overallProgress, durationOf, elapsedOf, etaOf, hiddenIds, maxDepthOf } from './run-model'
import * as monitor from './monitor'
import type { AgentRecord } from './office'
import type { Capabilities } from './capabilities'
import * as runModel from './run-model'

const T0 = 1_700_000_000_000
const D = '🛠️ Pleno · 🎼 Sonnet · 🟢 baixo'
const mk = (id: string, over: Partial<AgentRecord> = {}): AgentRecord => ({
  id, agentId: `g-${id}`, description: `${D}: tarefa ${id}`, status: 'working', startedAt: T0, ...over,
})
const caps = {} as Capabilities

// AC-004 / I-004 / U-001
test('buildRunModel é determinístico para a mesma entrada', () => {
  const agents = [mk('a'), mk('b', { parentAgentId: 'g-a' }), mk('c', { parentAgentId: 'g-a', status: 'done', endedAt: T0 + 3000 })]
  const a = buildRunModel(agents, T0 + 5000, caps)
  const b = buildRunModel(agents, T0 + 5000, caps)
  expect(a).toEqual(b)
  expect(a.roots).toEqual(['a'])
  expect(a.nodes.find(n => n.id === 'b')?.parentId).toBe('a')
  expect(a.nodes.find(n => n.id === 'c')?.state).toBe('done')
  expect(a.nodes.find(n => n.id === 'a')?.state).toBe('running')
  expect(a.totals).toMatchObject({ running: 2, done: 1, of: 3 })
})

test('monitor reexporta o mesmo grafo do run-model (uma fonte)', () => {
  expect(monitor.buildGraph).toBe(buildGraph)
})

test('run-model é puro: mesma entrada, mesma saída com Date.now diferente; entrada não é mutada', () => {
  const agents = [
    mk('a', { todos: [{ content: 't1', status: 'completed' }, { content: 't2', status: 'pending' }] } as Partial<AgentRecord>),
    mk('b', { parentAgentId: 'g-a', status: 'done', endedAt: T0 + 2000 }),
    mk('c', { parentAgentId: 'g-a', status: 'done', endedAt: T0 + 4000 }),
    mk('d', { parentAgentId: 'g-a' }),
  ]
  const frozen = structuredClone(agents)
  const RealDate = Date
  const fakeClock = (at: number) => {
    // Date.now is read-only in the sandbox: swap the whole global, restored in finally
    globalThis.Date = class extends RealDate {
      constructor(...a: unknown[]) { a.length ? super(...(a as [number])) : super(at) }
      static now() { return at }
    } as DateConstructor
  }
  const run = () => {
    const m = buildRunModel(agents, T0 + 9000, caps)
    const g = buildGraph(agents, T0 + 9000)
    return {
      m,
      progress: [...g.nodes.values()].map(n => [n.id, progressOf(n)]),
      overall: overallProgress(g),
      durations: [...g.nodes.values()].map(n => durationOf(n, T0 + 9000)),
      elapsed: elapsedOf(g, T0 + 9000), eta: etaOf(g), hidden: [...hiddenIds(g, T0 + 9000)], depth: maxDepthOf(g),
    }
  }
  try {
    fakeClock(1)
    expect(Date.now()).toBe(1)
    const first = run()
    fakeClock(9_999_999_999_999)
    expect(Date.now()).toBe(9_999_999_999_999)
    const second = run()
    expect(second).toEqual(first)
  } finally { globalThis.Date = RealDate }
  expect(agents).toEqual(frozen)
})

test('60 agentes encadeados montam 60 nós e uma raiz', () => {
  const agents = Array.from({ length: 60 }, (_, i) => mk(`n${i}`, i ? { parentAgentId: `g-n${i - 1}` } : {}))
  const m = buildRunModel(agents, T0 + 5000, caps)
  expect(m.nodes).toHaveLength(60)
  expect(m.roots).toEqual(['n0'])
})

test('attention lista needs-you, stalled e failed', () => {
  const stale = mk('s', { seenAt: T0, startedAt: T0 })
  const bad = mk('f', { status: 'error', error: 'boom', endedAt: T0 + 1 })
  const ok = mk('k', { seenAt: T0 + 20 * 60 * 1000 })
  const m = buildRunModel([stale, bad, ok], T0 + 20 * 60 * 1000, caps)
  expect(m.nodes.find(n => n.id === 's')?.state).toBe('stalled')
  expect(m.attention.sort()).toEqual(['f', 's'])
})

// AC-005 / I-005 / U-002
test('pai ausente da lista vira raiz sem perder o agente e seus filhos', () => {
  const m = buildRunModel([mk('x', { parentAgentId: 'g-gone' }), mk('y', { parentAgentId: 'g-x' })], T0 + 1000, caps)
  expect(m.roots).toEqual(['x'])
  expect(m.nodes.map(n => n.id).sort()).toEqual(['x', 'y'])
  expect(m.nodes.find(n => n.id === 'y')?.parentId).toBe('x')
})

// AC-006 / I-006 / U-003
test('horário inválido mantém o nó com tempo indefinido e não lança', () => {
  const m = buildRunModel([mk('z', { startedAt: Number.NaN })], T0, caps)
  const z = m.nodes.find(n => n.id === 'z')
  expect(z).toBeDefined()
  expect(z?.startedAt).toBeUndefined()
})

test('startedAt inválido não gera NaN no início da raiz do grafo legado', () => {
  const g = buildGraph([mk('z', { startedAt: Number.NaN }), mk('w', { startedAt: T0 + 10 })], T0 + 100)
  expect(Number.isNaN(g.root.start)).toBe(false)
  expect(g.root.start).toBe(T0 + 10)
  const only = buildGraph([mk('z', { startedAt: Number.NaN })], T0 + 100)
  expect(only.root.start).toBeUndefined()
})

// Comportamento atual do buildGraph (resolve o pai em ordem de spawn). Mudar para ordem livre altera o grafo
// das views existentes: decisão pendente do dono, ver relatório de T-002.
test('filho listado antes do pai: ninguém some; o filho vira raiz (ordem de spawn é o contrato atual)', () => {
  const m = buildRunModel([mk('child', { parentAgentId: 'g-parent' }), mk('parent')], T0 + 1000, caps)
  expect(m.nodes.map(n => n.id).sort()).toEqual(['child', 'parent'])
  expect(m.roots.sort()).toEqual(['child', 'parent'])
})

test('tipos de capacidade vêm de capabilities.ts (uma fonte)', () => {
  const c: runModel.Capabilities = {} as Capabilities
  expect(c).toBeDefined()
})
