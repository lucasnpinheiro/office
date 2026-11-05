// Matriz de capacidades do engine. Fonte: ADR 0002 (.specs/architecture/adr/0002-capacidades-do-engine.md).
// Só `yes` habilita. `not-verified` conta como falso (AC-003). Qualquer mudança aqui exige mudar a ADR.
export type Surface = 'terminal' | 'app'
export type CapabilityKey =
  | 'pause' | 'stop' | 'retry' | 'allow' | 'decline' | 'openInChat'
  | 'toolTiming' | 'tokensPerAgent' | 'costPerAgent' | 'permissionEvent'
  | 'workflowEvent' | 'worktreeFromDefinition' | 'commitsAhead'
  | 'containerWidth' | 'appMotion' | 'reducedMotionSignal'
export type Verdict = 'yes' | 'no' | 'not-verified'
export type Capabilities = Record<CapabilityKey, Record<Surface, Verdict>>

export const canUse = (c: Capabilities, k: CapabilityKey, s: Surface): boolean => c[k][s] === 'yes'

const nv = { terminal: 'not-verified', app: 'not-verified' } as const
const no = { terminal: 'no', app: 'no' } as const

export const CAPABILITIES: Capabilities = {
  pause: no,
  stop: nv,
  retry: nv,
  allow: nv,
  decline: nv,
  openInChat: no,
  toolTiming: { terminal: 'yes', app: 'not-verified' },
  tokensPerAgent: { terminal: 'yes', app: 'not-verified' },
  costPerAgent: no,
  permissionEvent: { terminal: 'yes', app: 'not-verified' },
  workflowEvent: no,
  worktreeFromDefinition: nv,
  commitsAhead: { terminal: 'yes', app: 'no' },
  containerWidth: nv,
  appMotion: nv,
  reducedMotionSignal: nv,
}
