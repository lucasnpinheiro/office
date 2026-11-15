// Renders docs/images/*.svg from the REAL renderCompact/detailCompact output with sample agents.
// These are renders of the view code (monospace SVG), not screenshots of a live Claude Code terminal.
import { renderCompact, detailCompact, detectCaps } from '../plugins/agent-office/hooks/compact'
import type { Mode } from '../plugins/agent-office/hooks/compact'
import type { Line } from '../plugins/agent-office/hooks/monitor'
import { strWidth } from '../plugins/agent-office/hooks/monitor'
import { writeFileSync } from 'node:fs'

const now = Date.now()
const mk = (id: string, description: string, o: Record<string, unknown> = {}) => ({ id, description, status: 'working' as const, startedAt: now - 120000, seenAt: now, ...o })
const agents = [
  mk('a', '🦉 Senior · 👑 Opus · 🟢 baixo: Planejar migração', { agentId: 'A', status: 'done', endedAt: now - 60000, startedAt: now - 300000 }),
  mk('b', '🛠️ Pleno · 🎼 Sonnet · 🟢 baixo: Implementar API', { agentId: 'B', parentAgentId: 'A', todos: [{ content: 'rotas', status: 'completed' }, { content: 'testes', status: 'in_progress' }, { content: 'docs', status: 'pending' }], files: ['src/api/routes.ts', 'tests/api.test.ts'] }),
  mk('c', '🧪 QA · 🎼 Sonnet · 🟢 baixo: Rodar suíte', { agentId: 'C', parentAgentId: 'A' }),
  mk('d', '🌱 Junior · 🪶 Haiku · 🟢 baixo: Ajustar docs', { parentAgentId: 'A' }),
  mk('e', '🌱 Junior · 🪶 Haiku · 🟢 baixo: Ajustar docs', { parentAgentId: 'A' }),
  mk('f', '🛠️ Pleno · 🎼 Sonnet · 🟡 médio: Corrigir bug', { status: 'error', endedAt: now - 30000, error: 'falha' }),
  mk('h', '🌱 Junior · 🪶 Haiku · 🟢 baixo: Ajustar docs', { parentAgentId: 'A' }),
  mk('g', '🛠️ Pleno · 🎼 Sonnet · 🟢 baixo: Refatorar', { git: { branch: 'feat/x', worktree: 'wt-x' } }),
]
const BG = '#0f172a', FG = '#e5e7eb'
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
function svgBody(lines: Line[]) {
  const cw = 8.4, lh = 18, w = Math.ceil(Math.max(...lines.map(l => l.reduce((n, s) => n + strWidth(s.t), 0))) * cw) + 24
  const rows = lines.map((l, i) => {
    let x = 0
    const spans = l.map(s => { const t = `<tspan x="${(12 + x * cw).toFixed(1)}" fill="${s.fg ?? FG}"${s.bold ? ' font-weight="bold"' : ''} xml:space="preserve">${esc(s.t)}</tspan>`; x += strWidth(s.t); return t }).join('')
    return `<text y="${14 + i * lh + 8}">${spans}</text>`
  }).join('\n')
  return { w, h: lines.length * lh + 28, rows }
}
function svg(lines: Line[], file: string) {
  const { w, h, rows } = svgBody(lines)
  writeFileSync(file, `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" font-family="Menlo,Consolas,monospace" font-size="14"><rect width="100%" height="100%" rx="8" fill="${BG}"/>\n${rows}\n</svg>\n`)
}
// Animated SVG: N renders of the same view at successive frames/times, stepped with CSS (no JS).
function anim(file: string, mode: Mode, n: number, stepMs: number) {
  const frames = Array.from({ length: n }, (_, i) => svgBody(renderCompact(agents as any, now + i * 700, { ...base, mode, frame: i })))
  const w = Math.max(...frames.map(f => f.w)), h = Math.max(...frames.map(f => f.h)), total = n * stepMs
  const css = frames.map((_, i) => `.f${i}{opacity:0;animation:s${i} ${total}ms steps(1,end) infinite}@keyframes s${i}{${(i / n * 100).toFixed(2)}%{opacity:1}${((i + 1) / n * 100).toFixed(2)}%{opacity:0}}`).join('')
  const g = frames.map((f, i) => `<g class="f${i}">${f.rows}</g>`).join('\n')
  writeFileSync(file, `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" font-family="Menlo,Consolas,monospace" font-size="14"><style>${css}@media (prefers-reduced-motion:reduce){g{animation:none!important}.f0{opacity:1!important}}</style><rect width="100%" height="100%" rx="8" fill="${BG}"/>\n${g}\n</svg>\n`)
}
const caps = detectCaps({ COLORTERM: 'truecolor', LANG: 'en_US.UTF-8' })
const base = { width: 120, frame: 3, caps, query: '', expanded: new Set<string>(), maxCardRows: 14 }
for (const m of ['tree', 'grouped', 'cards', 'waterfall'] as Mode[]) svg(renderCompact(agents as any, now, { ...base, mode: m }), `docs/images/${m}.svg`)
svg(detailCompact(agents as any, 'b', now, caps)!, 'docs/images/detail.svg')
svg(renderCompact(agents as any, now, { ...base, mode: 'cards', caps: detectCaps({ OFFICE_ASCII: '1' }) }), 'docs/images/ascii.svg')
anim('docs/images/waterfall-anim.svg', 'waterfall', 10, 250)
anim('docs/images/cards-anim.svg', 'cards', 10, 250)

// App surface Mapa (0.28.13): schematic SVG of the REAL appMap + appCardW/mapRows layout (cell grid), not a screenshot.
import { appMap, appCardW, mapRows } from '../plugins/agent-office/hooks/app-cards'
function appMapSvg(file: string, cols: number, n: number) {
  const ag = Array.from({ length: n }, (_, i) => mk(`m${i}`, `🛠️ Mid-level · 🪶 Haiku · 🟢 baixo: tarefa ${i + 1}`, i === 0 ? { status: 'done', endedAt: now - 5000 } : i === 1 ? { status: 'error', endedAt: now - 3000, error: 'falha' } : {}))
  const tree = appMap(ag as any, now, {}), w = appCardW(tree.children.length, cols), { rows } = mapRows(tree.children, cols, w)
  const cw = 8.4, lh = 18, ch = 7, tone: Record<string, string> = { running: '#7aa7ff', done: '#6fcf8a', failed: '#ff7b72', attention: '#f2c94c', pending: '#a8a7a1', inactive: '#a8a7a1' }
  const cut = (s: string, k: number) => [...s].slice(0, k).join('')
  const card = (c: any, cx: number, cy: number, cwid: number) => {
    const x = 12 + cx * cw, y = 12 + cy * lh, W = cwid * cw, t = tone[c.state] ?? FG, fail = c.state === 'failed', ink = fail ? '#1f1f1e' : FG, k = cwid - 2
    const tx = (r: number, s: string, f = ink, b = false) => `<text x="${x + cw}" y="${y + r * lh + 14}" fill="${f}"${b ? ' font-weight="bold"' : ''} xml:space="preserve">${esc(cut(s, k))}</text>`
    return `<rect x="${x}" y="${y}" width="${W}" height="${ch * lh}" rx="8" fill="${fail ? '#ff7b72' : '#2a2a28'}" stroke="${t}"/>` +
      tx(0.3, `${c.glyph} ${c.title}`, fail ? ink : t, true) + tx(1.3, c.chips.join(' · '), fail ? ink : '#a8a7a1') + tx(2.3, c.role ?? '', fail ? ink : '#a8a7a1') +
      `<rect x="${x + cw}" y="${y + 3.6 * lh}" width="${W - 2 * cw}" height="6" fill="${fail ? '#1f1f1e' : '#3d3d3a'}"/><rect x="${x + cw}" y="${y + 3.6 * lh}" width="${(W - 2 * cw) * (c.pct ?? 0.3)}" height="6" fill="${fail ? '#ffffff' : t}"/>` +
      tx(4.6, `${c.pctText}  ${c.time}`, fail ? ink : '#a8a7a1')
  }
  const rw = (r: unknown[]) => r.length * w + (r.length - 1) * 2
  const full = Math.max(...rows.map(rw), 26), out: string[] = [card(tree.card, Math.floor((full - 26) / 2), 0, 26)]
  rows.forEach((r, ri) => {
    const y0 = ch + 1 + ri * (ch + 2), x0 = Math.floor((full - rw(r)) / 2)
    out.push(`<line x1="${12 + (x0 + w / 2) * cw}" x2="${12 + (x0 + rw(r) - w / 2) * cw}" y1="${12 + (y0 - 0.5) * lh}" y2="${12 + (y0 - 0.5) * lh}" stroke="#6b6a65" stroke-width="2"${rows.length > 1 ? ' stroke-dasharray="6 4"' : ''}/>`)
    r.forEach((k, i) => out.push(card(k.card, x0 + i * (w + 2), y0, w)))
  })
  if (rows.length) out.splice(1, 0, `<line x1="${12 + (full / 2) * cw}" x2="${12 + (full / 2) * cw}" y1="${12 + ch * lh}" y2="${12 + (ch + 0.5) * lh}" stroke="#6b6a65" stroke-width="2"/>`)
  const W = full * cw + 24, H = (ch + 1 + rows.length * (ch + 2)) * lh + 12
  writeFileSync(file, `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="Menlo,Consolas,monospace" font-size="12"><rect width="100%" height="100%" rx="8" fill="#1f1f1e"/>\n${out.join('\n')}\n</svg>\n`)
}
appMapSvg('docs/images/app-map-6.svg', 120, 6)
appMapSvg('docs/images/app-map-9.svg', 120, 9)
