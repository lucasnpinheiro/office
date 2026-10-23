# learning

Learning loop for Claude Code: the `task-observer` skill, which watches a working session for skill-improvement
opportunities and records them in an observation log, plus an empty log template and a CLAUDE.md activation snippet.
Part of the [`office`](https://github.com/lucasnpinheiro/office) marketplace.

## What it adds

- Skill `skills/task-observer/` (with its own README, user guide and references).
- `templates/log.md`: empty observation log, meant for `~/.claude/skill-observations/log.md`.
- `templates/CLAUDE.md.snippet`: the block that turns the skill on at session start. Paste it into your CLAUDE.md
  yourself; nothing edits it for you.

## Install, update, uninstall

```bash
claude plugin marketplace add lucasnpinheiro/office
claude plugin install learning@office
mkdir -p ~/.claude/skill-observations && cp plugins/learning/templates/log.md ~/.claude/skill-observations/log.md  # from a clone, if missing
claude plugin marketplace update office && claude plugin update learning@office   # update, then restart
claude plugin uninstall learning@office    # your log under ~/.claude/skill-observations is kept
```

The installer does the log step for you: `npx github:lucasnpinheiro/office --with-learning`.

## Local development

```bash
claude --plugin-dir ./plugins/learning
claude plugin validate --strict plugins/learning
```

## Requirements

None beyond Claude Code.

## License

The plugin's own files (manifest, templates, this README) are MIT, see [LICENSE](LICENSE).

## NOTICE

The bundled `task-observer` skill (`skills/task-observer/`) is **not** MIT. It is
**"task-observer" ("One Skill to Rule Them All") by Eoghan Henn / [rebelytics.com](https://rebelytics.com)**,
licensed under [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/).
Original: https://github.com/rebelytics/one-skill-to-rule-them-all. The full license text is in
[`skills/task-observer/LICENSE.txt`](skills/task-observer/LICENSE.txt) and must stay with the skill. If you redistribute
or adapt it, credit the author and link the original repository.
