import { test, expect } from 'claude-code/testing'
import { isolatedCall, applyTool } from './stats'
import type { AgentLike } from './office'

// Shapes from real transcripts (zenpilot 2c7e6e51, toolu_01FqZgp2bg9aaapUaKBTxPip): the Agent tool_use input
// carries isolation "worktree"; the Agent result is async_launched with no worktreePath (29 of 29 such calls).
const mk = (o: Partial<AgentLike> = {}): AgentLike => ({ id: 'toolu_x', description: 'Dev: x', status: 'working', startedAt: 1, seenAt: 1, ...o })

test('isolation: the Agent call input says worktree; the spawn input does not carry it', () => {
  expect(isolatedCall({ description: 'PR default Zen profile', prompt: 'p', subagent_type: 'rapido', effort: 'low', isolation: 'worktree' })).toBe(true)
  expect(isolatedCall({ description: 'rascunho', prompt: 'p', subagent_type: 'rapido' })).toBe(false)
  expect(isolatedCall({ isolation: 'remote' })).toBe(false)
  expect(isolatedCall(undefined)).toBe(false)
})

test('isolated agent takes its cwd from the first worktree file it touches, not the session cwd', () => {
  const a = applyTool(mk({ isolated: true }), 'Edit', { file_path: '/Users/x/PhpstormProjects/zenpilot/.claude/worktrees/agent-aa55/README.md' })
  expect(a.cwd).toBe('/Users/x/PhpstormProjects/zenpilot/.claude/worktrees/agent-aa55')
})
