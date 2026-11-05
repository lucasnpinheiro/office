import { test, expect } from 'claude-code/testing'
import { workflowLines, workflowRuns, NO_WORKFLOW } from './view-workflow'

// T-008 (Visão Workflow). O engine só dá `workflow.runId` e `agentIndex` no agent.spawn (probe 2026-11-05, ADR 0002):
// nenhum nome de fase, rodada ou total. A visão agrupa por runId e diz que as fases estão indisponíveis.
const wf = (id: string, name: string, runId: string, agentIndex: number, state = 'Rodando') => ({ id, name, state, workflow: { runId, agentIndex } })

test('AC-024 workflow: agrupa por runId, ordena por agentIndex, sem fases nem rodada inventadas', () => {
  const out = workflowLines([wf('b', 'Dev: beta', 'wf_1', 2), wf('a', 'Dev: alfa', 'wf_1', 1, 'Concluído'), wf('c', 'Dev: gama', 'wf_2', 1)]).join('\n')
  expect(out).toContain('wf_1')
  expect(out).toContain('wf_2')
  expect(out.indexOf('Dev: alfa')).toBeLessThan(out.indexOf('Dev: beta'))
  expect(out).toContain('Fases: indisponíveis')
  expect(out).toContain('2 agentes vistos')
  expect(out).toContain('1 concluído')
  expect(out).not.toMatch(/Rodada|\d+\/\d+ fases|Planejar|Codar|Validar/)
})

test('AC-024 workflow: nunca promete total de agentes da execução', () => {
  const out = workflowLines([wf('a', 'Dev: alfa', 'wf_1', 1)]).join('\n')
  expect(out).toContain('1 agente visto')
  expect(out).not.toMatch(/de \d+ agentes|\d+\/\d+/)
})

test('AC-025 sem workflow: mensagem e nenhuma fase', () => {
  expect(workflowLines([])).toEqual([NO_WORKFLOW])
  expect(workflowLines([{ id: 'x', name: 'Dev: x', state: 'Rodando' }])).toEqual([NO_WORKFLOW])
  expect(NO_WORKFLOW).toBe('Nenhum workflow nesta sessão')
})

test('AC-026 dado malformado (runId vazio, índice inválido) não vira workflow nem derruba', () => {
  const bad = [wf('a', 'Dev: a', '', 1), wf('b', 'Dev: b', 'wf_1', Number.NaN)] as never
  expect(workflowRuns(bad)).toHaveLength(1) // o NaN fica no run, sem índice; o runId vazio é descartado
  expect(workflowLines(bad).join('\n')).not.toContain('Dev: a')
})
