import { test, expect } from 'claude-code/testing'
import { workflowView, workflowRuns, NO_WORKFLOW, PHASES_UNAVAILABLE } from './view-workflow'
import type { Line } from './monitor'

// Visão Workflow (Rodada 5, Term5 "Workflow"): nome · X/Y agentes; fases ligadas; contagem por fase; fase atual com agentes.
// O engine só dá runId e agentIndex (e phase, quando existir): sem rodada e sem fase inventadas.
const wf = (id: string, name: string, runId: string, agentIndex: number, state = 'running', phase?: string) =>
  ({ id, name, state, workflow: { runId, agentIndex, ...(phase ? { phase } : {}) } })
const text = (ls: Line[]) => ls.map(l => l.map(s => s.t).join('')).join('\n')
const COLOR = { ascii: false, color: true }
const ASCII = { ascii: true, color: false }

test('cabeçalho: nome da execução, X/Y agentes e sem rodada (dado inexistente)', () => {
  const out = text(workflowView([wf('a', 'Dev: alfa', 'wf_1', 1, 'done'), wf('b', 'Dev: beta', 'wf_1', 2)], COLOR))
  expect(out.split('\n')[0]).toBe('wf_1 · 1/2 agentes')
  expect(out).not.toMatch(/rodada/i)
})

test('sem fase no engine: linha de fases indisponível, nada inventado', () => {
  const out = text(workflowView([wf('a', 'Dev: alfa', 'wf_1', 1)], COLOR))
  expect(out).toContain(PHASES_UNAVAILABLE)
  expect(out).not.toContain('────')
  expect(out).toContain('⠹ Dev: alfa')
})

test('com fase: fases ligadas com glifo e cor do estado, contagens alinhadas sob cada fase', () => {
  const ls = workflowView([
    wf('a', 'Decomp', 'wf_1', 1, 'done', 'Decompor'),
    wf('b', 'Impl 1', 'wf_1', 2, 'running', 'Executar'),
    wf('c', 'Impl 2', 'wf_1', 3, 'done', 'Executar'),
    wf('d', 'Val', 'wf_1', 4, 'queued', 'Validar'),
  ], COLOR)
  const lines = ls.map(l => l.map(s => s.t).join(''))
  expect(lines[1]).toBe('✓ Decompor ──── ⠹ Executar ──── ○ Validar')
  expect(lines[2]!.indexOf('1/1')).toBe(lines[1]!.indexOf('✓'))
  expect(lines[2]!.indexOf('1/2')).toBe(lines[1]!.indexOf('⠹'))
  expect(lines[2]!.indexOf('0/1')).toBe(lines[1]!.indexOf('○'))
  const ok = ls[1]!.find(s => s.t.startsWith('✓'))
  expect(ok?.fg).toBe('#6FD08C')
  const run = ls[1]!.find(s => s.t.startsWith('⠹'))
  expect(run?.fg).toBe('#7FA9FF')
})

test('fase atual: nome seguido dos agentes com glifo', () => {
  const ls = workflowView([
    wf('a', 'Decomp', 'wf_1', 1, 'done', 'Decompor'),
    wf('b', 'API', 'wf_1', 2, 'running', 'Executar'),
    wf('c', 'Tester', 'wf_1', 3, 'failed', 'Executar'),
  ], COLOR)
  expect(text([ls[ls.length - 1]!])).toBe('Executar  ⠹ API  ✗ Tester')
})

test('ASCII: [ok] .. [ ] e ---- sem cor', () => {
  const ls = workflowView([wf('a', 'Decomp', 'wf_1', 1, 'done', 'Decompor'), wf('b', 'Val', 'wf_1', 2, 'queued', 'Validar')], ASCII)
  expect(text(ls.slice(1, 2))).toBe('[ok] Decompor ---- [ ] Validar')
  expect(ls.flat().every(s => s.fg === undefined)).toBe(true)
})

test('sem moldura de caixa', () => {
  expect(text(workflowView([wf('a', 'Dev: alfa', 'wf_1', 1)], COLOR))).not.toMatch(/[┌┐└┘│╭╮╰╯]/)
})

test('sem workflow: mensagem e nenhuma fase', () => {
  expect(text(workflowView([], COLOR))).toBe(NO_WORKFLOW)
  expect(text(workflowView([{ id: 'x', name: 'Dev: x', state: 'running' }], COLOR))).toBe(NO_WORKFLOW)
  expect(NO_WORKFLOW).toBe('Nenhum workflow nesta sessão')
})

test('dado malformado (runId vazio) não vira workflow nem derruba', () => {
  const bad = [wf('a', 'Dev: a', '', 1), wf('b', 'Dev: b', 'wf_1', Number.NaN)] as never
  expect(workflowRuns(bad)).toHaveLength(1)
  expect(text(workflowView(bad, COLOR))).not.toContain('Dev: a')
})
