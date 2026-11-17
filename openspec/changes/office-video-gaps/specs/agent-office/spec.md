## ADDED Requirements
### Requirement: Waterfall now marker
The waterfall view SHALL draw a vertical "agora" marker at the current time column.

#### Scenario: Now line
- **WHEN** the waterfall is drawn while agents run
- **THEN** every row shows the marker at the same column and the axis shows "agora"

### Requirement: Waterfall end holder
The waterfall view SHALL mark the agent with the latest end when two or more agents are shown.

#### Scenario: End holder marked
- **WHEN** three agents are shown and one ends last
- **THEN** only that row carries the "fim" marker

### Requirement: Waterfall pending row
The waterfall view SHALL show "aguarda 1ª ação…" instead of a bar for a pending agent.

#### Scenario: Pending agent
- **WHEN** an agent has made no tool call
- **THEN** its row shows "aguarda 1ª ação…" and no bar
