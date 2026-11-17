## Why
Demo video (agent-office-demo.mp4) shows 8 view tabs, a map/cards split and state-grouped view that the terminal and desktop surfaces do not fully match. Bundle: .specs/features/office-video-parity/.

## What Changes
- Unified 8-tab bar on terminal and desktop (REQ-301)
- Terminal `map` mode separate from `cards` grid (REQ-302)
- Grouped view by state when there are no worktrees (REQ-303)
- Attention pill label (REQ-304), README and version 0.28.18 (REQ-305)

## Impact
plugins/agent-office/hooks/compact.ts, register.tsx, vocabulary.ts, README.md
