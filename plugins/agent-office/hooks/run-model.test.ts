import { test, expect } from 'claude-code/testing'
import { buildRunModel, buildGraph } from './run-model'
import * as monitor from './monitor'
import type { AgentRecord } from './office'
import type { Capabilities } from './run-model'

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

test('run-model é puro: sem $, sem relógio, sem E/S', () => {
  const src = [buildRunModel, buildGraph].map(f => f.toString()).join('\n')
  expect(src).not.toMatch(/Date\.now|new Date\(|\$\.|process\./)
})

test('60 agentes montam abaixo de 16 ms', () => {
  const agents = Array.from({ length: 60 }, (_, i) => mk(`n${i}`, i ? { parentAgentId: `g-n${i - 1}` } : {}))
  const t = performance.now()
  buildRunModel(agents, T0 + 5000, caps)
  expect(performance.now() - t).toBeLessThan(16)
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
