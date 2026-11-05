# Validação — office-agent-monitor-v2

Data: 2026-11-05. Base: `claude plugin test .` em `plugins/agent-office`, 358 pass, 0 fail. Nada está DONE.

## ACs não cumpridos
- AC-001 (parcial): só toolTiming, tokensPerAgent, permissionEvent e commitsAhead têm trecho de log; as demais linhas da matriz seguem `not-verified`.
- AC-018 (parcial, T-006): ver a task.
- AC-024 (T-008): o engine não dá nome, fase nem rodada (gap 8); a visão diz "Fases: indisponíveis".
- AC-034 a AC-037 (T-011, BLOCKED): código de permissão adiado até as sondas manuais da ADR 0002.
- AC-038 a AC-041 (T-012, BLOCKED): idem; Allow, Decline, Stop, Retry, Pause e open-in-chat ocultos.
- AC-043 (parcial, T-013): sem `containerWidth` verificado o ramo de 900 px não roda num painel real; detalhe sobre a lista sem teste de render; 44 px não tratado.
- AC-044 (T-013): implementado e testado; caixa mantida aberta pela task até o juiz e as linhas de regressão.
- AC-045 (parcial, T-014): spinner cicla no render e é fixo em reduzido; o sino não existe (sem estado `◆`).
- AC-046 (parcial, T-014): sinal de movimento reduzido do sistema e do app não verificados.
- AC-047 (parcial, T-014): `transitionFor` sem superfície ligada; `appMotion` not-verified.
- AC-049 (T-015): o passo de teste do CI segue não bloqueante (binário e runtime no CI não verificados).
- AC-050 (T-015, parcial): `SKIPPED` explícito implementado, não observado no CI.

## Outras lacunas
- Meta de 93% de cobertura não mensurável (`coverage-report.md`).
- App Claude: nada verificado (gap 5); nenhuma paridade declarada.
- Custo por agente `—` (gap 4/9); julgamento por outro subagente e linhas de `tests/e2e-regression.md` pendentes em várias tasks.
