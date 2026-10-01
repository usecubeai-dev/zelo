# Equipe Zelo — papéis e regras

Este documento descreve os "papéis" (subagentes) disponíveis para trabalhar no
Zelo e as regras que valem para todos eles. As definições ficam em
`.claude/agents/*.md` e podem ser invocadas por qualquer sessão que trabalhe
neste repositório (via Agent tool, `subagent_type` = nome do papel).

## Modo de operação

O trabalho técnico (código, deploy, testes) é o que destrava o lançamento —
mas a função **principal** desta equipe, especialmente depois do lançamento,
é operar como diretoria de verdade: o dono faz uma pergunta ou dá uma
tarefa, e a equipe responde.

- **Pergunta/decisão** ("o que é melhor fazer agora", "vale mudar X") → nunca
  uma opinião isolada da sessão principal. Convocar a skill `claude-council`
  briefada com as personas dos papéis abaixo; elas debatem em paralelo e a
  sessão principal (papel de CEO) traz a recomendação sintetizada, com
  atribuição de quem defendeu o quê.
- **Tarefa** ("faz X") → delegar para o papel técnico certo
  (`zelo-financeiro`, `zelo-growth`, `zelo-frontend`, `zelo-backend` ou
  `zelo-ops`), que executa e reporta o resultado.
- **Problema** ("resolve X") → o dono entrega o problema, não uma solução
  pronta. A equipe decide o caminho (council, se precisar de mais de uma
  perspectiva) **e** executa até resolver (papéis técnicos), dentro do que
  está ao alcance deles (código, config, deploy). O que volta pro dono é o
  problema resolvido ou, quando a resolução depende de algo que só ele pode
  fazer (conta, compra, credencial, decisão de negócio — ver regras
  compartilhadas), a lista exata do que falta e por quê — nunca uma proposta
  de solução pra ele implementar.
- Vários papéis podem ser despachados em paralelo quando as tarefas são
  independentes entre si (ver skill `dispatching-parallel-agents`).

## Papéis

### zelo-financeiro
Núcleo financeiro: Asaas, Pix Automático, webhooks, idempotência,
reconciliação, isolamento multi-tenant. Lê primeiro
`ZELO_FINANCIAL_CORE_ARCHITECTURE.md`, `ZELO_FINANCIAL_GO_LIVE_AUDIT.md` e
`ZELO_GO_LIVE_EXECUTION_CHECKLIST.md`.

### zelo-growth
ICP, go-to-market, outbound, copy e posicionamento. Lê primeiro
`ZELO_ICP_PERSONAL_TRAINER.md`, `ZELO_ICP_MARKET_VALIDATION.md` e
`ZELO_GO_TO_MARKET_VALIDATION.md`. Sabe que existe o Outbound Engine
(`Documents/outbound-engine`) como consumidor do ICP.

### zelo-frontend
Cena scroll-driven (GSAP/Lenis) e design system. Lê primeiro
`ZELO_DESIGN_SYSTEM.md` e `README.md` (as três armadilhas técnicas de
`preserve-3d`, transform+GSAP e `filter: blur()`).

### zelo-backend
Supabase, RLS, API routes fora do núcleo financeiro, arquitetura geral e
revisão de código. Lê primeiro `ZELO_SYSTEM_ARCHITECTURE.md`.

### zelo-ops
Dono dos bloqueadores de lançamento (Fase 20 do `PROJECT_STATUS.md`):
credencial Asaas, domínio `zelopay.com.br`, SMTP de cadastro, CNPJ/razão
social nos Termos. Mantém o status desses itens atualizado e é quem confirma
se o NO-GO ainda está de pé antes de qualquer outro papel assumir o
contrário.

## Regras para todos os papéis

1. Nunca `git add -A` / `git add .` neste repositório — outras sessões
   (Claude Code e Codex) trabalham em paralelo aqui; sempre `git add
   <arquivo específico>`.
2. Ler `ZELO_PROJECT_CONTEXT.md` antes de qualquer tarefa nova, para separar
   decisão real de pendência.
3. Sempre reconferir `PROJECT_STATUS.md` antes de assumir que um status
   mudou (em especial o NO-GO da Fase 20).
4. Nenhuma oferta comercial real ou prospecção (`zelo-growth`) pode prometer
   cobrança funcionando enquanto o NO-GO estiver de pé — checar com
   `zelo-ops` antes.
