## ADDED Requirements
### Requirement: Unified view tabs
The panel SHALL show the tabs map, tree, grouped, cards, waterfall, cost, tools and workflow on terminal and desktop surfaces.

#### Scenario: Tabs rendered
- **WHEN** the panel header is drawn
- **THEN** all eight tabs appear in that order

### Requirement: Map and cards are distinct modes
The terminal SHALL render `map` as the tree with bus and `cards` as a width-driven grid.

#### Scenario: Cycle modes
- **WHEN** the user presses g from workflow
- **THEN** the mode returns to map

### Requirement: Grouped by state without worktrees
The grouped view SHALL divide agents by state when no worktree exists.

#### Scenario: State dividers
- **WHEN** 3 running, 1 done, 1 failed and 1 queued agents share main
- **THEN** dividers Rodando ×3, Concluído ×1, Falhou ×1 and Na fila ×1 are shown
