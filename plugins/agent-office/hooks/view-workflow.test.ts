import { test, expect } from 'claude-code/testing'
import { workflowLines } from './view-workflow'

// T-008 (Visão Workflow). Rendered output is tested as text; ACs from tasks/T-008-workflow-view.md.
const agents = [
  { id: 'a1', name: 'Dev: alfa' },
  { id: 'a2', name: 'Dev: beta' },
  { id: 'a3', name: 'Dev: gama' },
]
const run = {
  name: 'Deploy',
  round: 2,
  phases: [
    { name: 'Planejar', done: 1, total: 1, agentIds: ['a1'] },
    { name: 'Codar', done: 1, total: 2, agentIds: ['a2', 'a3'] },
    { name: 'Validar', done: 0, total: 3, agentIds: [] },
  ],
}

test('AC-024 workflow: nome, rodada, fases na ordem com feitos/total e agentes da fase atual', () => {
  const out = workflowLines(run, agents).join('\n')
  expect(out).toContain('Deploy')
  expect(out).toContain('Rodada 2')
  const iPlan = out.indexOf('Planejar 1/1')
  const iCode = out.indexOf('Codar 1/2')
  const iVal = out.indexOf('Validar 0/3')
  expect(iPlan).toBeGreaterThanOrEqual(0)
  expect(iCode).toBeGreaterThan(iPlan)
  expect(iVal).toBeGreaterThan(iCode)
  // fase atual = primeira com feitos < total (Codar): mostra os agentes dela
  expect(out).toContain('Dev: beta')
  expect(out).toContain('Dev: gama')
})

test('AC-025 sem workflow: mostra a mensagem e nenhuma fase', () => {
  const lines = workflowLines(undefined, agents)
  expect(lines).toEqual(['Nenhum workflow nesta sessão'])
  expect(lines.join('\n')).not.toContain('/')
})

test('AC-026 formato não reconhecido: lista agentes sem fases, sem inventar nome nem total', () => {
  const out = workflowLines({ phases: 'x' }, agents).join('\n')
  expect(out).toContain('Dev: alfa')
  expect(out).toContain('Dev: gama')
  expect(out).not.toContain('Nenhum workflow')
  expect(out).not.toContain('Rodada')
  expect(out).not.toMatch(/\d+\/\d+/)
})

test('AC-026 fase sem nome: lista agentes sem fases e sem nome inventado', () => {
  const broken = { ...run, phases: [{ done: 0, total: 2, agentIds: ['a1'] }] }
  const out = workflowLines(broken, agents).join('\n')
  expect(out).toContain('Dev: alfa')
  expect(out).not.toMatch(/\d+\/\d+/)
  expect(out).not.toContain('Deploy')
})
