// Vocabulário único do monitor: estados (Padrão, spec/05-ui-design.md), tokens de cor, glifos ASCII e o mapa de teclas.
// Pure: sem engine, sem relógio, sem env global (o caller passa o objeto de ambiente).
import type { RunState } from './run-model'
import { canUse } from './capabilities'
import type { Capabilities, CapabilityKey, Surface } from './capabilities'

export type Palette = 'dark' | 'light'
export type StateSpec = { label: string; glyph: string; ascii: string; dark: string; light: string }

// Uma linha por RunState. Cor clara dos estados neutros vem de `muted` (mesmo valor do token).
export const STATE_TABLE: Record<RunState, StateSpec> = {
  queued: { label: 'Na fila', glyph: '○', ascii: '[ ]', dark: '#A9ADB5', light: '#5A5F68' },
  running: { label: 'Rodando', glyph: '⠹', ascii: '..', dark: '#7FA9FF', light: '#2257C9' },
  'needs-you': { label: 'Precisa de você', glyph: '◆', ascii: '[??]', dark: '#F2B84B', light: '#8A5A00' },
  stalled: { label: 'Parado sem sinal', glyph: '▲', ascii: '[!!]', dark: '#F2B84B', light: '#8A5A00' },
  paused: { label: 'Pausado', glyph: '‖', ascii: '||', dark: '#A9ADB5', light: '#5A5F68' },
  failed: { label: 'Falhou', glyph: '✗', ascii: '[xx]', dark: '#FF8A80', light: '#B3261E' },
  done: { label: 'Concluído', glyph: '✓', ascii: '[ok]', dark: '#6FD08C', light: '#1B7A3D' },
  stopped: { label: 'Interrompido', glyph: '■', ascii: '[--]', dark: '#A9ADB5', light: '#5A5F68' },
}

export const TOKENS = {
  dark: { bg: '#141517', surface: '#1C1E21', line: '#303338', text: '#ECEEF1', muted: '#A9ADB5' },
  light: { bg: '#F6F7F8', surface: '#FFFFFF', line: '#DDE0E4', text: '#17191C', muted: '#5A5F68' },
} as const

export const CONNECTORS = {
  unicode: { branch: '├', rule: '─', pair: '│' },
  ascii: { branch: '+', rule: '-', pair: ':' },
} as const

export type Vocab = { ascii: boolean; color: boolean }
// OFFICE_ASCII ou NO_COLOR definida (qualquer valor): coluna ASCII. Só NO_COLOR tira a cor.
export function vocabFromEnv(env: Record<string, string | undefined>): Vocab {
  const noColor = env.NO_COLOR !== undefined
  return { ascii: env.OFFICE_ASCII !== undefined || noColor, color: !noColor }
}

export type StateView = { label: string; glyph: string; color?: string; known: boolean }
// Estado desconhecido não lança: rótulo é o próprio texto, glifo `?`, cor `muted`.
export function stateView(state: string, v: Vocab, palette: Palette): StateView {
  const spec = (STATE_TABLE as Record<string, StateSpec | undefined>)[state]
  if (!spec) return { label: state, glyph: '?', color: v.color ? TOKENS[palette].muted : undefined, known: false }
  return { label: spec.label, glyph: v.ascii ? spec.ascii : spec.glyph, color: v.color ? spec[palette] : undefined, known: true }
}

// Mapa de teclas único: uma letra (ou dígito) por ação, por contexto. Enter e Esc não entram (Esc nunca chega).
// `cap` = capability que precisa ser `yes` na superfície; sem ela o controle não é desenhado nem ligado.
export type KeyEntry = { key: string; act: string; label: string; ctx?: 'view' | 'confirm' | 'decision'; cap?: CapabilityKey }
export const KEY_MAP: KeyEntry[] = [
  { key: 'j', act: 'move', label: 'mover' },
  { key: 'k', act: 'move', label: 'mover' },
  { key: 'd', act: 'decide', label: 'decidir', cap: 'allow' },
  { key: 'r', act: 'retry', label: 'repetir', cap: 'retry' },
  { key: 'b', act: 'back', label: 'voltar' },
  { key: 'x', act: 'stop', label: 'parar', cap: 'stop' },
  { key: 'p', act: 'prevSibling', label: 'irmão anterior' },
  { key: 'n', act: 'nextSibling', label: 'irmão seguinte' },
  { key: 'u', act: 'pauseResume', label: 'pausar e retomar', cap: 'pause' },
  { key: 'a', act: 'openInChat', label: 'abrir no chat', cap: 'openInChat' },
  { key: 'y', act: 'copy', label: 'copiar' },
  { key: 'v', act: 'view', label: 'visão' },
  { key: 'f', act: 'failed', label: 'só falhas' },
  { key: 's', act: 'search', label: 'buscar' },
  { key: 'g', act: 'group', label: 'colapsados ou todos' },
  { key: 'q', act: 'close', label: 'fechar' },
  { key: 'y', act: 'confirm', label: 'sim', ctx: 'confirm' },
  { key: 'n', act: 'cancel', label: 'não', ctx: 'confirm' },
  { key: '1', act: 'option1', label: 'opção 1', ctx: 'decision' },
  { key: '2', act: 'option2', label: 'opção 2', ctx: 'decision' },
  { key: '3', act: 'option3', label: 'opção 3', ctx: 'decision' },
]

// Letra de uma ação no contexto de visão (a mesma nas duas superfícies).
export function keyOf(act: string, ctx: KeyEntry['ctx'] = 'view'): string | undefined {
  return KEY_MAP.find(e => e.act === act && (e.ctx ?? 'view') === ctx)?.key
}

// Entradas que a superfície pode ligar: capability ausente ou não `yes` remove o controle.
export function bindable(caps: Capabilities, surface: Surface, ctx: KeyEntry['ctx'] = 'view'): KeyEntry[] {
  return KEY_MAP.filter(e => (e.ctx ?? 'view') === ctx && (!e.cap || canUse(caps, e.cap as CapabilityKey, surface)))
}
