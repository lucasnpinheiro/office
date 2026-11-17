# Tasks (DAG)
| ID | REQ | Arquivos | depends_on |
|---|---|---|---|
| T-501 | REQ-501 | hooks/register.tsx (appChrome único), compact.ts (export header/tabs) | - |
| T-502 | REQ-502 | hooks/compact.ts (estado vazio por modo) | T-501 |
| T-503 | REQ-503 | hooks/register.tsx footerRows | T-501 |
| T-504 | REQ-504 | hooks/compact.ts / view detalhe (rótulo ferramenta) | - |
Junto: office-video-gaps T-401..T-404. Uma PR por task. DoD: teste RED→GREEN + captura real do desktop por aba (ou UNVERIFIED).
