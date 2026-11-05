# language: pt
# status: TODO
# progress: 0/3
# updated: 2026-11-05
Funcionalidade: Entrega e documentação

  @T-015 @success @AC-048
  Cenário: S-048 a versão nova do plugin
    Dado a versão nova do plugin
    Quando o usuário lê o README
    Então encontra teclas, variáveis e limites reais

  @T-015 @deviation @AC-049
  Cenário: S-049 um teste falhando em uma PR
    Dado um teste falhando em uma PR
    Quando o CI roda com o CLI disponível
    Então o job fica vermelho

  @T-015 @error @AC-050
  Cenário: S-050 o CI sem o binário
    Dado o CI sem o binário
    Quando o passo de teste roda
    Então o log diz que os testes foram pulados
