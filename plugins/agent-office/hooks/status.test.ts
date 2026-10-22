import { test, expect } from 'claude-code/testing'
import { statusLines } from './status'
import type { AgentLike } from './office'

const T0 = 1_700_000_000_000
const D = '🛠️ Pleno · 🎼 Sonnet · 🟢 baixo'
const mk = (id: string, over: Partial<AgentLike> = {}): AgentLike => ({
  id, agentId: `g-${id}`, description: `${D}: tarefa ${id}`, status: 'working', startedAt: T0, ...over,
})

test('statusLines: empty map says no agents and monitor state', () => {
  const out = statusLines([], T0, false).join('\n')
  expect(out).toContain('aberto: não')
  expect(out).toContain('sessões: 1')
  expect(out).toContain('agentes: 0')
})

test('statusLines: counts agents, running, done, failed, depth and progress', () => {
  const agents = [
    mk('a', { status: 'done', endedAt: T0 + 1000 }),
    mk('b', { status: 'error', endedAt: T0 + 1000 }),
    mk('c', { parentAgentId: 'g-a' }),
  ]
  const out = statusLines(agents, T0 + 5000, true).join('\n')
  expect(out).toContain('aberto: sim')
  expect(out).toContain('agentes: 3')
  expect(out).toContain('profundidade máx: 2')
  expect(out).toContain('falhas: 1')
  expect(out).toContain('concluídos: 1')
  expect(out).toContain('em execução: 1')
})
