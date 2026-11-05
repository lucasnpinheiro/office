// Movimento (T-014, AC-045..AC-047; spec/05-ui-design.md § Movimento). Funções puras, sem relógio nem engine.
// ADR 0002: efeito do app (`appMotion`) e sinal de movimento reduzido do sistema estão `not-verified`; aqui só há a regra.
// Quem chama: office.ts (nextDelay, usado por register.tsx) para o intervalo de quadro.

export const SPIN_FPS = 6 // AC-045: agente rodando, 6 quadros/s (app e compacto, assunção da nota técnica)
export const SPIN_FRAME_MS = 167 // ~1000/6
export const REDUCED_FRAME_MS = 1000 // AC-046: movimento reduzido, 1 quadro/s

const SPIN_GLYPHS = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'] as const
const STATIC_GLYPH = '⠹' // ponto fixo do modo reduzido (mesmo glifo do estado `running`)

// Quadro do spinner: ciclo de glifos; reduzido = sempre o mesmo ponto.
export function spinnerGlyph(frame: number, reduced: boolean): string {
  if (reduced) return STATIC_GLYPH
  const n = SPIN_GLYPHS.length
  return SPIN_GLYPHS[((Math.floor(frame) % n) + n) % n]!
}

// Intervalo entre quadros; undefined = nada rodando, sem timer de movimento.
export function frameIntervalMs(o: { running: boolean; reduced?: boolean; compact?: boolean }): number | undefined {
  if (!o.running) return undefined
  return o.reduced ? REDUCED_FRAME_MS : SPIN_FRAME_MS
}

// AC-045: o sino toca uma vez por ◆ novo (contagem de decisões subiu), não a cada redesenho.
export const bellOnNewDecision = (prevNeedsYou: number, nextNeedsYou: number): boolean => nextNeedsYou > prevNeedsYou

// AC-047: superfície sem suporte a transição troca direto de estado, sem simular.
export const transitionFor = (appMotion: boolean | undefined): 'crossfade' | 'instant' => (appMotion === true ? 'crossfade' : 'instant')
