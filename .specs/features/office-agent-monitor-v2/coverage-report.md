# Relatório de cobertura — office-agent-monitor-v2

Data: 2026-11-05

A meta de 93% de cobertura **não é mensurável** com o runner atual:

- `claude plugin test --help` só aceita `[dir]`; não há opção de cobertura.
- Não há `package.json` no plugin e `bun` não está no PATH, então nenhuma ferramenta externa mede linhas.

Nenhum número de cobertura é afirmado. O que existe é rastreio AC para teste: 358 testes passam, 0 falham
(`claude plugin test .` em `plugins/agent-office`, 2026-11-05), vinculados por `Covers` em `tests/`. Isso prova que os ACs
cumpridos têm teste, não que 93% das linhas executam. Gap 6 em `spec/06-gaps.md`.
