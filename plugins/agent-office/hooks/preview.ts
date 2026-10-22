declare const process: { argv: string[] }
declare const console: { log(s: string): void }
// Dumps one demo frame as ANSI truecolor: bun hooks/preview.ts [cols] [plain] > file
import { renderMonitor } from './monitor'
import type { Line } from './monitor'
import type { AgentLike } from './office'

const T0 = Date.UTC(2026, 9, 20, 13, 0, 0)
const now = T0 + 754_000
const D = (p: string, m: string, e: string) => `${p} · ${m} · ${e}`
const ag = (id: string, desc: string, over: Partial<AgentLike> = {}): AgentLike => ({
  id, agentId: `g-${id}`, description: desc, status: 'working', startedAt: T0 + 5_000, seenAt: now - 1000, ...over,
})
const agents: AgentLike[] = [
  ag('po', `${D('🎯 Product Owner', '👑 Opus', '🟢 baixo')}: Especificar monitor`, { startedAt: T0, todos: [
    { content: 'Levantar requisitos', status: 'completed' }, { content: 'Definir layout', status: 'in_progress' }, { content: 'Validar com usuario', status: 'pending' }] }),
  ag('sr', `${D('🦉 Senior', '🎼 Sonnet', '🟢 baixo')}: Implementar grafo`, { parentAgentId: 'g-po', startedAt: T0 + 60_000, status: 'done', endedAt: T0 + 300_000 }),
  ag('pl', `${D('🛠️ Pleno', '🎼 Sonnet', '🟡 médio')}: Renderizar mapa mental`, { parentAgentId: 'g-po', startedAt: T0 + 60_000, todos: [
    { content: 'Cartoes', status: 'completed' }, { content: 'Conectores', status: 'in_progress' }] }),
  ag('qa', `${D('🧪 QA', '🎼 Sonnet', '🟢 baixo')}: Testar rendering`, { parentAgentId: 'g-pl', startedAt: T0 + 400_000, status: 'error', endedAt: T0 + 500_000 }),
  ag('jr', `${D('🌱 Junior', '🪶 Haiku', '🟢 baixo')}: Escrever docs`, { parentAgentId: 'g-pl', startedAt: T0 + 500_000, seenAt: T0 }),
]
const cols = Number(process.argv[2] ?? 120)
const plain = process.argv[3] === 'plain'
const rgb = (h: string) => `${parseInt(h.slice(1, 3), 16)};${parseInt(h.slice(3, 5), 16)};${parseInt(h.slice(5, 7), 16)}`
const f = renderMonitor(agents, now, { width: cols, frame: 1, collapsed: new Set(), project: 'meuapp', sessionId: 'a1b2c3d4' })
const paint = (l: Line) => l.map(s => (plain || !(s.fg || s.bold) ? s.t : `\x1b[${s.bold ? '1;' : ''}${s.fg ? `38;2;${rgb(s.fg)}` : '0'}m${s.t}\x1b[0m`)).join('')
console.log(f.lines.map(paint).join('\n'))
