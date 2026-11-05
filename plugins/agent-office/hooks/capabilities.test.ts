import { test, expect } from 'claude-code/testing'
import { CAPABILITIES, canUse } from './capabilities'
import type { CapabilityKey } from './capabilities'

const KEYS: CapabilityKey[] = [
  'pause', 'stop', 'retry', 'allow', 'decline', 'openInChat',
  'toolTiming', 'tokensPerAgent', 'costPerAgent', 'permissionEvent',
  'workflowEvent', 'worktreeFromDefinition', 'commitsAhead',
  'containerWidth', 'appMotion', 'reducedMotionSignal',
]

test('CAPABILITIES has one row per CapabilityKey, both surfaces, valid verdicts', () => {
  expect(Object.keys(CAPABILITIES).sort()).toEqual([...KEYS].sort())
  for (const k of KEYS) for (const s of ['terminal', 'app'] as const)
    expect(['yes', 'no', 'not-verified']).toContain(CAPABILITIES[k][s])
})

test('CAPABILITIES matches ADR 0002 exactly', () => {
  expect(CAPABILITIES).toEqual({
    pause: { terminal: 'no', app: 'no' },
    stop: { terminal: 'not-verified', app: 'not-verified' },
    retry: { terminal: 'not-verified', app: 'not-verified' },
    allow: { terminal: 'not-verified', app: 'not-verified' },
    decline: { terminal: 'not-verified', app: 'not-verified' },
    openInChat: { terminal: 'no', app: 'no' },
    toolTiming: { terminal: 'yes', app: 'not-verified' },
    tokensPerAgent: { terminal: 'yes', app: 'not-verified' },
    costPerAgent: { terminal: 'no', app: 'no' },
    permissionEvent: { terminal: 'yes', app: 'not-verified' },
    workflowEvent: { terminal: 'no', app: 'no' },
    worktreeFromDefinition: { terminal: 'not-verified', app: 'not-verified' },
    commitsAhead: { terminal: 'yes', app: 'no' },
    containerWidth: { terminal: 'not-verified', app: 'not-verified' },
    appMotion: { terminal: 'not-verified', app: 'not-verified' },
    reducedMotionSignal: { terminal: 'not-verified', app: 'not-verified' },
  })
})

test('canUse is true only for yes', () => {
  expect(canUse(CAPABILITIES, 'toolTiming', 'terminal')).toBe(true)
  expect(canUse(CAPABILITIES, 'toolTiming', 'app')).toBe(false)
  expect(canUse(CAPABILITIES, 'retry', 'terminal')).toBe(false)
  expect(canUse(CAPABILITIES, 'pause', 'terminal')).toBe(false)
})
