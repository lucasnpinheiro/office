import { test, expect } from 'claude-code/testing'
import { estimateCostUsd } from './price'
test('estimateCostUsd: haiku/sonnet/opus blended, unknown stays undefined', () => {
  expect(Math.round(estimateCostUsd('Haiku', 1_000_000)! * 100) / 100).toBe(1.8)
  expect(Math.round(estimateCostUsd('sonnet', 1_000_000)! * 100) / 100).toBe(5.4)
  expect(Math.round(estimateCostUsd('🎼 Opus', 1_000_000)! * 100) / 100).toBe(9)
  expect(estimateCostUsd('haiku', undefined)).toBeUndefined()
  expect(estimateCostUsd('gpt', 1000)).toBeUndefined()
})
