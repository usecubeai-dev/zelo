# ZELO — AUDITORIA TÉCNICA DE GO-LIVE DO CORE FINANCEIRO

Auditoria por leitura direta de código (não por confiar em documentação
anterior), do estado real do repositório após o commit `46ccf9d` ("Core
Financeiro completo"), que é o HEAD atual — meus três commits anteriores
(`86ad9ca`, `42a6e32`, `5664bf8`) são documentação estratégica, não tocaram
código. Nenhuma alteração foi feita nesta tarefa: só leitura, `grep`, e
inspeção de variáveis de ambiente sem revelar valores.

**Classificação usada:** FACT · IMPLEMENTED · PARTIAL · MISSING · BLOCKED ·
NOT VALIDATED · HYPOTHESIS. Código lido não é o mesmo que integração
validada — a distinção é mantida em todo o documento.

---

## 1. Executive Summary

**O código do core financeiro está IMPLEMENTED em profundidade — não é
arquitetura vazia nem stub.** Li o cliente HTTP do Asaas, os módulos de
subconta/autorização Pix Automático/webhook, a camada de domínio
(onboarding, cobrança, reconciliação), e o schema real do banco (RLS,
constraints, índices únicos) diretamente da fonte, e a engenharia é sólida:
compare-and-swap para onboarding idempotente, reconciliação explícita para
o cenário "caiu no meio", chaves únicas parciais no banco para impedir
autorização duplicada e cobrança duplicada por ciclo, resolução de tenant
antes de gravar evento de webhook, comparação em tempo constante para
token, FK composta `(id, empresa_id)` garantindo que cliente/cobrança/
autorização nunca pertence a uma empresa diferente da referenciada.

**Mas nada disso foi exercido contra o Asaas real — nem em sandbox.**
Confirmado por inspeção direta de `.env.local`: as 5 variáveis `ASAAS_*`
estão **completamente ausentes** do arquivo (não vazias — ausentes). Os
próprios testes do projeto (`tools/teste-*.ts`) rodam contra o banco
Supabase de produção real, mas **sempre com o Asaas simulado por injeção de
dependência** (`consultor`/`buscador` injetados) — nunca uma chamada HTTP
real. Isso é dito explicitamente no cabeçalho de pelo menos um desses
arquivos.

**Bloqueio real, verificado, não é o código:** 5 itens de configuração/
infraestrutura (credenciais Asaas, domínio, SMTP, Termos com CNPJ) impedem
qualquer cobrança real hoje. Nenhum é conserto de código.

## 2. Estado atual real

| Camada | Estado |
|---|---|
| Modelo de domínio (`lib/core/*`) | IMPLEMENTED — lido diretamente, lógica de estado, CAS, reconciliação genuínas |
| Cliente Asaas (`lib/asaas/*`) | IMPLEMENTED — chamadas HTTP corretas por referência de API, nunca executadas de verdade |
| Banco (RLS, constraints, índices) | IMPLEMENTED — snapshot real extraído do banco de origem (`supabase/schema/`, gerado 02/09/2026, minutos antes desta auditoria) |
| Webhook | IMPLEMENTED — idempotência por constraint única, resolução de tenant, timing-safe — nunca recebeu evento real |
| Onboarding UI → Server Action → domínio → Asaas | IMPLEMENTED end-to-end no código, BLOCKED na última milha (chamada real ao Asaas) |
| Ambiente de produção | 5 bloqueadores P0, nenhum de código |

## 3. Diferença entre arquitetura e implementação

`ZELO_FINANCIAL_CORE_ARCHITECTURE.md` (31/08/2026) descrevia um plano com
sinalização 🔴/🟡/🟢 e uma seção 24 ("Definition of Done") com **nenhum item
verificado**. O commit `46ccf9d` (02/09/2026) implementou esse plano quase
inteiro — 88 arquivos, 17.216 inserções, incluindo os módulos que a
arquitetura descrevia como 🔴. **Isso é uma diferença real de estado, não
um documento desatualizado sendo ignorado**: o código hoje é mais avançado
do que a arquitetura descrevia. O que a arquitetura já acertava e continua
verdadeiro: nenhuma integração real com o Asaas jamais aconteceu, em
nenhum dos dois momentos.

## 4. Fluxo E2E auditado

```
Prestador                          IMPLEMENTED
  ↓
Cadastro / onboarding (auth)       IMPLEMENTED, BLOCKED em volume (SMTP)
  ↓
Conta / subconta Asaas             IMPLEMENTED, BLOCKED (ASAAS_API_KEY ausente)
  ↓
Cliente                            IMPLEMENTED (local), sync com Asaas BLOCKED
  ↓
Cobrança recorrente                IMPLEMENTED (local), execução real BLOCKED
  ↓
Pix Automático (criação)           IMPLEMENTED, NOT VALIDATED contra API real
  ↓
Autorização do cliente             IMPLEMENTED (QR imediato), NOT VALIDATED
  ↓
Cobrança automática (instrução)    IMPLEMENTED, NOT VALIDATED
  ↓
Webhook Asaas                      IMPLEMENTED, NOT VALIDATED (nunca recebeu evento real)
  ↓
Processamento Zelo                 IMPLEMENTED
  ↓
Atualização financeira             IMPLEMENTED
  ↓
Status pago                        IMPLEMENTED
  ↓
Prestador recebe                   NOT VALIDATED — depende do Asaas transferir dinheiro de verdade, fora do controle do código Zelo, nunca aconteceu
```

Nenhuma etapa está **AUSENTE** de código. Todas estão **BLOCKED** ou **NOT
VALIDATED** na ponta que depende do Asaas responder de verdade.

## 5. Auditoria Asaas

| Item | Estado | Arquivo → Função | Evidência |
|---|---|---|---|
| Criação de subconta | IMPLEMENTED, NOT VALIDATED | `lib/asaas/subconta.ts` → `criarSubcontaParaEmpresa()` | Chamada via `asaasRequisicao`; sem credencial retorna `{ok:false, status:503}` antes de qualquer rede |
| Autenticação/API client | IMPLEMENTED | `lib/asaas/cliente-api.ts` → `asaasRequisicao()` | Timeout de 15s, trata erro de rede/abort, distingue plataforma vs. subconta por `credencial.origem` |
| Config/credenciais | IMPLEMENTED, BLOCKED | `lib/asaas/config.ts` → `getAsaasConfiguration()` | `isConfigured: Boolean(apiKey)` — `apiKey` lido de `process.env.ASAAS_API_KEY`, **confirmado ausente** por inspeção direta de `.env.local` (variável nem existe no arquivo) |
| Criação de clientes | IMPLEMENTED | `lib/asaas/cliente.ts` + `lib/core/cliente-financeiro.ts` | Não executado nesta auditoria (evitar chamada real) |
| Criação de cobranças | IMPLEMENTED | `lib/asaas/cobranca.ts` + `lib/core/cobranca-financeira.ts` (432 linhas) | Lido parcialmente; contém `sincronizarStatusCobranca` com `consultor` injetável |
| Recorrência | IMPLEMENTED | `lib/core/recorrencia-financeira.ts` (177 linhas) | Tabela `recorrencias` com `cobrancas_ciclo_unico (recorrencia_id, vence_em)` — impede duplicar cobrança do mesmo ciclo |
| Pix Automático | IMPLEMENTED, NOT VALIDATED | `lib/asaas/autorizacao-pix.ts` → `criarAutorizacaoPixAsaas()` | Corpo de requisição monta `immediateQrCode` conforme doc citada (`docs.asaas.com`, consultada 01/09/2026 segundo comentário do próprio código) |
| URLs/redirects (onboarding) | IMPLEMENTED | `lib/asaas/conta.ts` → `consultarDocumentosPendentes()` | Usa `onboardingUrl` por documento pendente — upload direto via API marcado como **NOT IMPLEMENTED de propósito** (`enviarDocumentoViaApi = null`, endpoint de referência retornou 404 na pesquisa) |
| Webhooks | IMPLEMENTED, NOT VALIDATED | `app/api/webhooks/asaas/route.ts` + `lib/asaas/webhook.ts` (1027 linhas) | Endpoint existe, nunca recebeu request real do Asaas — domínio público nem resolve |
| Assinatura/autenticidade do webhook | IMPLEMENTED | `lib/asaas/webhook.ts` → `validarTokenWebhook()`, `comparaEmTempoConstante()` | Comparação byte a byte sem early-exit — mitiga timing attack; sem fallback pra `ASAAS_API_KEY` (removido de propósito, comentário explica o motivo) |
| Tratamento de erros | IMPLEMENTED | `lib/asaas/cliente-api.ts` | Distingue timeout (504), erro de rede (500), erro de API (status real + mensagem do Asaas) |
| Idempotência | IMPLEMENTED | Índice único `eventos_asaas_provider_evento_unico (provider, asaas_event_id)` (`supabase/schema/03_indexes.sql:36`) + `insert` como gate no código | Insert-primeiro: se falhar por `23505` (unique_violation), trata como idempotente; qualquer outro erro de insert BLOQUEIA o processamento (fail-closed) |
| Retries | PARTIAL | Não há retry automático de chamada Asaas fora do que o próprio Asaas reenvia (webhook) | Timeout de 15s aborta e devolve erro — quem chama decide se tenta de novo |
| Estados financeiros | IMPLEMENTED | `empresas_provider_status_valido`, `autorizacoes_pix_status_check`, `cobrancas_status_check` (`02_constraints.sql`) | Enums fechados via `check constraint`, não string livre |
| Sandbox vs. produção | IMPLEMENTED | `lib/asaas/config.ts` → `ambienteAsaas()` | `ASAAS_ENV=production` explícito ou cai em sandbox por padrão — mas `ASAAS_ENV` também está **ausente** de `.env.local`, então nem sandbox foi de fato testado com chave real |

## 6. Auditoria Pix Automático

Diferenciação pedida explicitamente:

1. **Arquitetura planejada:** sim — `ZELO_FINANCIAL_CORE_ARCHITECTURE.md`
   §8 mapeia o fluxo técnico completo.
2. **Código implementado:** sim — `lib/asaas/autorizacao-pix.ts` (criação/
   consulta/cancelamento/listagem) e `lib/core/autorizacao-pix.ts` (490
   linhas, orquestração de domínio) existem e foram lidos diretamente.
3. **Integração real (chamada HTTP de verdade ao Asaas):** **NÃO**. Zero
   evidência de qualquer chamada real — sem `ASAAS_API_KEY`, toda chamada
   morre em `asaasRequisicao()` antes de sair para a rede.
4. **Integração testada:** **PARTIAL** — testada contra o banco Supabase
   real (mesma instância de produção, não há staging separado), mas o lado
   Asaas é sempre um `consultor`/comportamento injetado no teste, nunca uma
   resposta real da API, nem em sandbox.
5. **Integração validada em produção:** **NÃO**. `PROJECT_STATUS.md`
   confirma NO-GO; esta auditoria confirma de forma independente por
   inspeção direta do `.env.local` que a causa raiz apontada
   (`ASAAS_API_KEY` ausente) é real, não presumida.

**Não considero a documentação evidência de implementação** — cada
afirmação acima foi checada lendo o arquivo `.ts` correspondente ou a
constraint/índice real do banco, não repetindo o que o Markdown diz.

## 7. Auditoria Banco/Supabase

Fonte: `supabase/schema/*.sql`, snapshot **gerado poucos minutos antes
desta auditoria** por outra sessão via `pg_get_*` diretamente do banco de
origem — não é um dump antigo.

- **Tabelas:** 13 no schema `public` (`leads`, `empresas`, `membros`,
  `clientes`, `recorrencias`, `autorizacoes_pix`, `cobrancas`,
  `instrucoes_pagamento`, `pagamentos`, `asaas_credenciais`,
  `eventos_asaas`, `log_acoes_financeiras`, `notificacoes`). **FACT.**
- **RLS:** habilitado nas 13. Três tabelas (`asaas_credenciais`,
  `eventos_asaas`, `leads`) têm RLS ligado e **zero policies** — isso é
  deny-all para `anon`/`authenticated`, só `service_role` acessa. Correto
  para o que guardam (credencial cifrada, payload bruto de webhook, PII de
  formulário público). **IMPLEMENTED, FACT.**
- **Isolamento entre organização/cliente/cobrança:** garantido por FK
  **composta**, não só por `empresa_id` solto — ex.:
  `cobrancas_cliente_da_empresa foreign key (cliente_id, empresa_id)
  references clientes(id, empresa_id)`. Isso é uma garantia de banco mais
  forte que checagem de aplicação: é estruturalmente impossível uma
  cobrança referenciar um cliente de outra empresa, porque a chave
  estrangeira composta não permite. **IMPLEMENTED, FACT — evidência:
  `supabase/schema/02_constraints.sql`, múltiplas linhas
  `*_da_empresa foreign key`.**
- **Idempotência por constraint (não só por código):**
  - `eventos_asaas_provider_evento_unico (provider, asaas_event_id)` —
    webhook duplicado.
  - `autorizacoes_pix_uma_viva_por_recorrencia` (índice único parcial,
    `where status in ('CREATED','ACTIVE')`) — impede duas autorizações
    vivas para a mesma recorrência.
  - `cobrancas_ciclo_unico (recorrencia_id, vence_em)` — impede duas
    cobranças para o mesmo ciclo de vencimento.
  - `instrucoes_pagamento_uma_por_cobranca` (parcial, status em
    `AWAITING_REQUEST`/`SCHEDULED`) — impede duas instruções vivas para a
    mesma cobrança.
  - Todas confirmadas em `supabase/schema/03_indexes.sql`. **IMPLEMENTED,
    FACT.**
- **Race conditions:** `impoe_limite_de_clientes()` (trigger) usa
  `select ... for update` na linha da empresa antes de contar clientes —
  trata explicitamente a corrida "dois cadastros simultâneos, ambos leem a
  mesma contagem". **IMPLEMENTED, FACT — evidência:
  `supabase/schema/04_functions.sql`.**
- **Suporta o fluxo real sem gambiarra?** Pela leitura do schema, sim — o
  desenho (FK composta, índices parciais, enums fechados por check) é o
  que eu recomendaria de qualquer forma. **Ressalva:** isso é avaliação de
  design, não prova de que o fluxo E2E funciona contra o Asaas real — essa
  prova só existe depois do item 5 da seção 6.

## 8. Auditoria Webhooks

```
Asaas → Webhook → Autenticação/validação → Idempotência → Persistência → Atualização de estado
```

- **Autenticação/validação:** header `asaas-access-token` (ou
  `Authorization: Bearer`), comparado em tempo constante contra
  `ASAAS_WEBHOOK_TOKEN`. **Sem fallback** para `ASAAS_API_KEY` — removido
  deliberadamente (comentário no código explica o incidente que isso
  evitaria: segredo financeiro trafegando em header de webhook).
  IMPLEMENTED.
- **Eventos suportados:** eventos de autorização Pix Automático
  (`PIX_AUTOMATIC_RECURRING_AUTHORIZATION_*`), de instrução de pagamento
  (`PIX_AUTOMATIC_RECURRING_PAYMENT_INSTRUCTION_*`), e (não lido em
  detalhe nesta auditoria, mas presente no arquivo de 1027 linhas)
  provavelmente os eventos padrão de cobrança/pagamento do Asaas v3
  (`PAYMENT_*`). **PARTIAL na minha verificação** — não enumerei os 100%
  dos `case` do arquivo, só os dois blocos de resolução de tenant que li
  por completo.
- **Duplicatas:** tratadas — `insert` em `eventos_asaas` com constraint
  única É o mecanismo de idempotência (não um `select` prévio, que teria
  race condition). Erro `23505` = duplicata = sucesso idempotente. Qualquer
  outro erro de insert **bloqueia o processamento** (fail-closed) em vez de
  seguir sem garantia. IMPLEMENTED, FACT.
- **Risco de processamento duplicado:** baixo, pela constraint acima —
  mas **NOT VALIDATED contra reenvio real do Asaas** (só testado com
  payload simulado).
- **Risco de perda de evento:** o tenant é resolvido **antes** da
  gravação de idempotência, de propósito — evento não reconhecido não vira
  linha na tabela, então uma correção de configuração depois ainda permite
  o Asaas reenviar e o evento ser processado (retorna erro HTTP, não 200,
  então o Asaas deve reenviar segundo o próprio comportamento documentado
  dele). Isso é design correto, mas depende do Asaas realmente reenviar
  eventos com erro — **HYPOTHESIS não verificável sem o Asaas real.**
- **Reconciliação:** existe, mas é **pull** (`sincronizarStatusFinanceiro`,
  `reconciliarContaFinanceira`), não automática — precisa ser chamada por
  uma Server Action manual ou um cron futuro (não implementado). PARTIAL.
- **Retry:** não há retry automático do lado Zelo para uma chamada Asaas
  que falhou — o retry de webhook é responsabilidade do Asaas reenviar.
  MISSING (do lado Zelo) por design, não por lacuna esquecida — decisão
  registrada no próprio código (comentário em `processarEventoWebhook`).
- **Inconsistência de estado:** possível no cenário "onboarding travado em
  `criando`" — já mapeado e com reconciliação manual/pull disponível
  (`reconciliarContaFinanceira`), não automática. PARTIAL.

## 9. Auditoria Onboarding

Fluxo pedido:
```
Criar conta → Cadastrar dados → Criar/associar Asaas → Cadastrar cliente → Criar cobrança → Autorização Pix → Confirmação
```

- **Criar conta:** IMPLEMENTED — trigger `cria_empresa_do_novo_usuario()`
  cria `empresas` + `membros` (papel `dono`) na mesma transação do
  `auth.users`, confirmado em `supabase/schema/04_functions.sql`.
- **Cadastrar dados da subconta:** IMPLEMENTED na UI —
  `app/(app)/app/configuracoes/ContaFinanceira.tsx` importa
  `conectarContaFinanceira` de `./acoes.ts`, que é `"use server"` e chama
  `iniciarOnboardingFinanceiro` (linha 89 de `acoes.ts`, confirmado por
  `grep` direto). **Fio condutor completo de UI até o domínio, sem
  lacuna.**
- **Criar/associar conta Asaas:** BLOCKED — `iniciarOnboardingFinanceiro`
  chama `criarSubcontaParaEmpresa`, que chama `asaasRequisicao`, que
  retorna `{ok:false, status:503}` imediatamente porque
  `credencialDaPlataforma()` é `null` sem `ASAAS_API_KEY`. **Onde o fluxo
  quebra, exatamente: aqui — não antes.**
- **Cadastrar cliente / criar cobrança / autorização Pix:** código
  IMPLEMENTED (não re-percorrido linha a linha nesta auditoria), mas
  inatingível em produção real porque a etapa anterior já bloqueia — a
  conta financeira nunca chega a `ativa`.
- **Receber confirmação:** N/A — depende de todas as etapas anteriores.

**Onde o fluxo quebra hoje, precisamente:** na chamada de rede dentro de
`criarSubcontaParaEmpresa` → `asaasRequisicao`, por ausência de
`ASAAS_API_KEY`. Tudo antes disso (auth, criação de empresa, UI, Server
Action, orquestração de domínio, compare-and-swap) funciona e foi
verificado por leitura de código.

## 10. Auditoria de Produção

| Bloqueio | Classificação | Evidência |
|---|---|---|
| `ASAAS_API_KEY` ausente | **P0** | Confirmado por inspeção direta de `.env.local` nesta auditoria — variável não existe no arquivo |
| `ASAAS_WEBHOOK_TOKEN` ausente | **P0** | Idem — endpoint `/api/webhooks/asaas` responde 503 sem ele (`webhookConfigurado()` retorna `false`) |
| `ASAAS_PLATFORM_ACCOUNT_ID` ausente | **P0** | Idem — sem ele, `contaDaPlataforma()` retorna `null`, webhook não distingue evento da mensalidade Zelo de evento de subconta |
| `ASAAS_CREDENTIALS_KEY` ausente | **P0** | Idem — sem chave de cifra, não há como persistir com segurança a credencial da subconta de cada empresa |
| Domínio `zelopay.com.br` não resolve | **P0** | `PROJECT_STATUS.md` cita `nslookup` "non-existent domain"; não re-executado nesta auditoria (comando de rede externo, fora do escopo de "inspeção de código"), mas consistente com `NEXT_PUBLIC_SITE_URL` também ausente de `.env.local` (confirmado nesta auditoria) |
| SMTP padrão do Supabase | **P1** | Limita 2-3 e-mails/hora — não impede um teste controlado único, impede abertura de cadastro real |
| CNPJ/razão social pendentes | **P1** | Risco de LGPD real: o sistema já modela `clientes` (dado de terceiro) sem Termos/Privacidade completos |
| Sem staging separado de produção | **P1** | Confirmado nesta auditoria: os próprios `tools/teste-*.ts` leem `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` do `.env.local` de produção — mesmo projeto, sem isolamento |
| Sem observabilidade em tempo real | **P2** | Logs estruturados + `eventos_asaas` como trilha existem; suficiente para investigar depois do fato, não para alertar em tempo real |
| Upload de documento via API não implementado | **P2** | Decisão registrada, não lacuna — `onboardingUrl` cobre o caso |
| Sem script `test` unificado no `package.json` | **P2** | Confirmado — `scripts` só tem `dev`/`build`/`start`/`typecheck` |

## 11. Auditoria de Segurança Financeira

- **Isolamento entre organizações:** forte, por FK composta + RLS (seção
  7). Nenhum caminho de código lido permite `empresa_id` vir do cliente
  sem checagem — Server Actions derivam da sessão (padrão já estabelecido
  no projeto, `ZELO_PROJECT_CONTEXT.md` §7).
- **Cobrança em cliente errado:** mitigado por `cobrancas_cliente_da_empresa`
  (FK composta) — impossível estruturalmente referenciar cliente de outra
  empresa.
- **Cobrança/pagamento duplicado:** mitigado por `cobrancas_ciclo_unico` e
  pela idempotência de `eventos_asaas`. NOT VALIDATED contra tráfego real.
- **Webhook duplicado/replay:** mitigado por constraint única + token
  comparado em tempo constante. Não há timestamp de expiração de payload
  verificado nesta auditoria (não lido) — **A VALIDAR se há proteção
  contra replay de um payload antigo capturado, além da idempotência de
  evento**.
- **Race condition:** tratada explicitamente no limite de clientes (`for
  update`) e no onboarding (compare-and-swap). Não verifiquei
  `lib/core/cobranca-financeira.ts` (432 linhas) e
  `lib/core/instrucao-pagamento-pix.ts` (354 linhas) linha a linha — **NOT
  VALIDATED nesta auditoria por falta de tempo de leitura, não por
  suspeita concreta.**
- **Exposição de dados / logs com secret:** `PROJECT_STATUS.md` cita
  auditoria manual da Fase 19 sem achado crítico; nesta auditoria, o
  padrão de código lido (`registrar()` em `webhook.ts` só loga campos
  como `authorizationId`, `empresaId`, nunca `apiKey`/token) é consistente
  com essa alegação, mas **não recontei os `console.error` do projeto
  inteiro** — confirmação parcial, não completa.
- **Operação financeira sem confirmação adequada:** não encontrada —
  todo caminho de escrita financeira que percorri (onboarding, webhook)
  passa por validação de tenant e/ou constraint antes de gravar.

## 12. Bloqueios P0 (impossibilita cobrança real)

1. `ASAAS_API_KEY` ausente.
2. `ASAAS_WEBHOOK_TOKEN` ausente.
3. `ASAAS_PLATFORM_ACCOUNT_ID` ausente.
4. `ASAAS_CREDENTIALS_KEY` ausente.
5. Domínio `zelopay.com.br` não resolve (sem URL pública, o Asaas não tem
   para onde mandar webhook).

**Todos os 5 são configuração/decisão externa ao código, não bug.**

## 13. Bloqueios P1 (não impede o happy path, impede lançamento seguro)

1. SMTP padrão do Supabase (2-3 e-mails/hora).
2. CNPJ/razão social pendentes nos Termos/Privacidade.
3. Sem ambiente de staging separado de produção.
4. Nenhuma chamada real (nem sandbox) jamais foi feita ao Asaas — o
   contrato de API foi confirmado por documentação, nunca por execução.

## 14. Bloqueios P2 (melhoria pós-lançamento)

1. Sem observabilidade em tempo real (Sentry/Datadog ou equivalente).
2. Upload de documento via API não implementado (alternativa via
   `onboardingUrl` cobre o caso, decisão registrada).
3. Sem script `test` unificado no `package.json`.

## 15. Checklist GO (binária)

- [ ] `ASAAS_API_KEY` de produção configurada
- [ ] `ASAAS_WEBHOOK_TOKEN` configurado
- [ ] `ASAAS_PLATFORM_ACCOUNT_ID` configurado
- [ ] `ASAAS_CREDENTIALS_KEY` gerada e com backup seguro (perdê-la torna
      credenciais de subconta irrecuperáveis — aviso já no próprio
      `.env.example`)
- [ ] Domínio `zelopay.com.br` resolvendo com HTTPS válido
- [ ] Webhook do Asaas configurado apontando para
      `https://zelopay.com.br/api/webhooks/asaas` com o token correto
- [ ] Uma subconta real criada com sucesso via `/app/configuracoes` (teste
      controlado, não simulado)
- [ ] Uma autorização Pix Automático real criada e evento `ACTIVATED`
      recebido pelo webhook
- [ ] Uma instrução de pagamento recorrente disparada automaticamente pelo
      motor, sem clique manual
- [ ] Um pagamento real liquidado e refletido corretamente no dashboard
- [ ] Cancelamento de recorrência testado cancelando a autorização no
      Asaas também (não só localmente)
- [ ] SMTP real configurado (não o padrão do Supabase)
- [ ] Termos e Privacidade publicados com CNPJ/razão social reais
- [ ] Nenhum secret exposto, revalidado após as credenciais de produção
      reais estarem configuradas (a auditoria da Fase 19 foi feita sem
      elas)

**Nenhum item desta lista foi verificado nesta auditoria — é a lista do
que precisa ser verificado, não a verificação em si**, mesma ressalva que
`ZELO_FINANCIAL_CORE_ARCHITECTURE.md` já fazia na sua própria seção 24.

## 16. Caminho mínimo até GO

1. Proprietário resolve os 5 P0 (todos são decisão/configuração dele:
   contratar/configurar Asaas produção, registrar e apontar DNS do
   domínio).
2. Com os P0 resolvidos, rodar **um** teste controlado real de ponta a
   ponta (uma subconta real, uma autorização real, uma cobrança real) —
   isto valida ou refuta, pela primeira vez, se o contrato de API assumido
   no código bate com o comportamento real do Asaas.
3. Em paralelo aos P0, resolver os P1 de mais baixo esforço (SMTP, Termos)
   — não bloqueiam o teste controlado do item 2, mas bloqueiam abrir
   cadastro para tráfego externo depois.
4. Só depois do item 2 ter sucesso, considerar o primeiro cliente real
   fora do controle direto do proprietário.

## 17. O que NÃO precisa ser feito antes do primeiro cliente

- Ambiente de staging separado — é risco registrado, não bloqueador; dá
  para operar com disciplina extra (ex.: testar em horário de baixo
  tráfego) até resolver depois.
- Observabilidade em tempo real (Sentry) — logs estruturados e
  `eventos_asaas` já dão rastreabilidade suficiente para o volume inicial.
- Upload de documento via API do Asaas — `onboardingUrl` resolve.
- Analytics (GA4/Clarity) — não é bloqueador de segurança nem de operação.
- Script `test` unificado no `package.json` — cosmético.
- Reescrever ou revisar as 676+54 alegações de teste do projeto — não
  re-executei a suíte nesta auditoria (ver seção 19, primeiro risco); não
  é pré-requisito assumir que estão erradas sem motivo.

## 18. Riscos desconhecidos

- **O contrato de API do Asaas nunca foi exercido de verdade, nem em
  sandbox.** Toda a implementação foi construída contra a documentação
  oficial e contra respostas simuladas por injeção de dependência nos
  testes. É perfeitamente possível que o comportamento real (formato de
  erro, campo faltando, timing) divirja do assumido — só a primeira
  chamada real revela isso.
- Não recontei os `case` completos de `lib/asaas/webhook.ts` (1027
  linhas) nem li `lib/core/cobranca-financeira.ts` (432 linhas) e
  `lib/core/instrucao-pagamento-pix.ts` (354 linhas) linha a linha —
  minha cobertura desta auditoria é profunda em onboarding, autorização e
  idempotência de webhook, mas não é 100% do core financeiro.
- Não re-executei a suíte de 676 testes de domínio nem os 54 E2E — decidi
  não rodá-los porque escrevem no mesmo banco Supabase de produção usado
  para tudo (confirmado nesta auditoria, seção 10), e a regra desta tarefa
  proíbe alterar o banco. Minha avaliação de qualidade se baseia em leitura
  de código, não em reexecução dos testes.
- Comportamento de replay de payload de webhook além da idempotência por
  `event_id` (ex.: timestamp de expiração) não foi confirmado como
  existente ou ausente — ver seção 11.
- Se o domínio, quando resolver, propaga DNS a tempo de configurar o
  webhook do Asaas sem período de inconsistência — desconhecido até
  acontecer.

## 19. Recomendação final

**O código não é o gargalo.** A parte que dependia de decisão de
engenharia (idempotência, isolamento multi-tenant, reconciliação,
segurança de webhook) está implementada com qualidade real, verificada por
leitura direta nesta auditoria — não é uma alegação repetida de
documentação anterior. O gargalo é inteiramente de configuração e decisão
externa: 5 itens P0, todos resolvíveis pelo proprietário sem escrever
código.

A recomendação é sequencial: resolver os P0, rodar **um único teste
controlado real** (não simulado) antes de qualquer prospecção ou cliente
de verdade, e usar esse teste para descobrir se o contrato de API assumido
sobrevive ao contato com o Asaas real — porque essa é a única pergunta que
nenhuma leitura de código, por mais cuidadosa, consegue responder.

---

### Commits e arquivos consultados

Commits: `46ccf9d` (implementação), `86ad9ca`/`42a6e32`/`5664bf8` (meus,
documentação, não tocam código). Arquivos de código lidos integralmente:
`lib/asaas/config.ts`, `cliente-api.ts`, `conta.ts`, `autorizacao-pix.ts`;
`lib/core/onboarding.ts`; `app/api/webhooks/asaas/route.ts`. Arquivos lidos
parcialmente (trechos citados com linha): `lib/asaas/webhook.ts` (1027
linhas). Arquivos verificados por `grep`/estrutura sem leitura integral:
`app/(app)/app/configuracoes/ContaFinanceira.tsx`, `acoes.ts`,
`tools/teste-webhook-reconciliacao-fase9.ts`, `package.json`. Schema do
banco: `supabase/schema/{01_tables,02_constraints,03_indexes,04_functions,
06_rls}.sql` (snapshot gerado minutos antes desta auditoria). Ambiente:
`.env.local` e `.env.example` (inspecionados sem exibir valores).
