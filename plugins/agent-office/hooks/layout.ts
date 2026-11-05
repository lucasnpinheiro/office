// Regras de largura (T-013, AC-042..AC-044; spec/05-ui-design.md § Larguras). Funções puras; quem as chama é compact.ts
// (renderCompact) e register.tsx (detalhe ao lado ou sobre a lista).
// ADR 0002: `containerWidth` está `not-verified` no app. `containerPx` só chega se o engine o der; sem ele valem as colunas do terminal.
import { strWidth, takeWidth } from './monitor'

export type TermLevel = 'full' | 'compact' | 'list'

export const DEFAULT_COLS = 80
export const TERM_FULL = 100, TERM_COMPACT = 60
// min do container (px) -> colunas de cards
export const APP_STEPS: readonly [number, number][] = [[1040, 4], [780, 3], [520, 2], [0, 1]]
export const DETAIL_SIDE_PX = 900, ROW_BELOW_PX = 520

const known = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0

// largura desconhecida, zero, negativa ou NaN: 80 colunas, uma coluna (AC-044)
export const effectiveCols = (w: unknown): number => (known(w) ? Math.floor(w) : DEFAULT_COLS)
export const termLevel = (w: unknown): TermLevel => { const c = effectiveCols(w); return c >= TERM_FULL ? 'full' : c >= TERM_COMPACT ? 'compact' : 'list' }

export const appColumns = (px: unknown): number => (known(px) ? APP_STEPS.find(([min]) => px >= min)![1] : 1)
export const detailPlacement = (px: unknown): 'side' | 'overlay' => (known(px) && px >= DETAIL_SIDE_PX ? 'side' : 'overlay')
// abaixo de 520 px (ou container informado e inválido): linhas de estado, nome e tempo; px ausente = terminal, cards pelas colunas
export const rowStyle = (px: unknown): 'card' | 'row' => (known(px) && px >= ROW_BELOW_PX ? 'card' : 'row')

// Detalhe ao lado da lista? Container conhecido manda (900 px); senão a regra de colunas do terminal (110 no app desktop, 150 no terminal).
export function sideDetail(o: { cols: number; containerPx?: number; desktop: boolean }): boolean {
  if (o.containerPx !== undefined) return detailPlacement(o.containerPx) === 'side'
  return o.cols >= (o.desktop ? 110 : 150)
}

// O `agora` (ferramenta em curso) é o que encolhe primeiro: cabe inteiro, ou truncado com reticências, ou some. Custo, tempo, falha e decisão não passam por aqui.
export function fitAgora(text: string, room: number): string {
  if (!text || room < 4) return ''
  return strWidth(text) <= room ? text : takeWidth(text, room - 1) + '…'
}
