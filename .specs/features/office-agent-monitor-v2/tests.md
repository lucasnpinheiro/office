---
status: TODO
progress: 0/9
updated: 2026-11-05
---
# Testes — índice

Executor: 🛠️ Pleno · 🎼 Sonnet · 🟢 baixo

Base medida: `claude plugin test .` em `plugins/agent-office`, 147 pass, 0 fail, 12 arquivos. Banco: not applicable.

| Arquivo | Tipo | Ferramenta | status |
|---|---|---|---|
| `tests/unit.md` | unidade | `claude plugin test` | TODO |
| `tests/integration.md` | integração, 50 linhas, uma por AC | kit `claude-code/testing` | TODO |
| `tests/e2e-flow.md` | fluxos | sessão real | TODO |
| `tests/validation.md` | entradas | `claude plugin test` | TODO |
| `tests/business-rules.md` | regras e transições | `claude plugin test` | TODO |
| `tests/ui-design.md` | telas x superfícies | sessão real; app não verificado até rodar | TODO |
| `tests/load-k6.md` | carga | N/A | TODO |
| `tests/security.md` | segurança | `claude plugin test` | TODO |
| `tests/e2e-regression.md` | fluxos existentes | `claude plugin test` e smoke | TODO |

## Plano de cobertura
A meta de 93% **não é mensurável hoje**: `claude plugin test --help` só tem `-h`, não há `package.json` nem `bun` no PATH. Até haver ferramenta, a prova é: 100% dos ACs com linha de integração e cenário, e uma função pura por regra em `tests/unit.md`. Nenhum percentual será declarado sem medição (Unresolved 6). Não coberto por automação: app Claude, sino e quadros reais.

## Passos do runner
```yaml
runner_steps:
  - claude plugin validate --strict plugins/agent-office
  - claude plugin test plugins/agent-office
  - smoke manual em sessão real, conforme tests/ui-design.md
```
Playwright e k6: not applicable — a superfície é pane da mod. `claude-in-chrome` serve apenas para ver o canvas.
