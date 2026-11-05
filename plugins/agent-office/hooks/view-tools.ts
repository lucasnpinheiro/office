// Visão Ferramentas (T-010, AC-033). Pure: renders from the RunModel only.
// Per agent: each tool with its call count and last duration. Input/output only with captureIo (OFFICE_CAPTURE_IO=1),
// and re-masked here as a second guard (capture.ts already masks before storing).
import type { RunModel } from './run-model'
import type { Caps } from './compact'
import type { Line, Seg } from './monitor'
import { maskText } from './mask'

const DIM = '#9ca3af'
const seg = (t: string, fg?: string, extra: Partial<Seg> = {}): Seg => ({ t, ...(fg ? { fg } : {}), ...extra })
const fmtSecs = (ms: number): string => `${(ms / 1000).toFixed(1).replace('.', ',')} s`

export function toolLines(model: RunModel, _now: number, v: { width: number; caps: Caps }, captureIo: boolean): Line[] {
  void v
  const total = model.nodes.reduce((s, n) => s + n.steps.length, 0)
  const out: Line[] = [[seg(`Ferramentas · ${total} chamadas`, undefined, { bold: true })]]
  const withSteps = model.nodes.filter(n => n.steps.length > 0)
  if (!withSteps.length) return [...out, [seg('Sem ferramentas registradas', DIM)]]
  for (const n of withSteps) {
    out.push([seg(n.name, undefined, { bold: true })])
    const byTool = new Map<string, { count: number; last?: number }>()
    for (const s of n.steps) {
      const e = byTool.get(s.tool) ?? { count: 0 }
      e.count++
      e.last = s.durationMs ?? e.last
      byTool.set(s.tool, e)
    }
    for (const [tool, e] of byTool) out.push([seg(`  ${tool} ×${e.count} · última ${e.last === undefined ? '—' : fmtSecs(e.last)}`)])
    if (captureIo) {
      for (const s of n.steps) {
        if (!s.io) continue
        out.push([seg(`    entrada: ${maskText(s.io.input)}`, DIM)])
        if (s.io.output !== undefined) out.push([seg(`    saída: ${maskText(s.io.output)}`, DIM)])
      }
    }
  }
  return out
}
