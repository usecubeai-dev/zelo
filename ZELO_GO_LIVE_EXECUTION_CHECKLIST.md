# ZELO — CHECKLIST DE EXECUÇÃO PARA GO-LIVE DO CORE FINANCEIRO

Documento de **preparação controlada**, não de execução. Nenhuma
credencial real foi configurada, nenhuma operação financeira foi
realizada, nenhum código de produto foi alterado ao escrever este
documento — apenas leitura e revalidação do estado real do repositório.

Base: `ZELO_FINANCIAL_GO_LIVE_AUDIT.md` (commit `662a7a7`) revalidada
linha a linha nesta tarefa, cruzada com `STAGING_EXECUTION_PLAN.md` (de
outra sessão, em planejamento, ainda não executado) e com o estado atual
do working tree.

**Classificação:** FACT · IMPLEMENTED · READY · PARTIAL · MISSING ·
BLOCKED · EXTERNAL · NOT VALIDATED.

---

## 1. Estado atual

Nada mudou no core financeiro desde a auditoria (`662a7a7`): confirmado
por `git diff --stat` — zero diferença em `lib/asaas/`, `lib/core/`,
`app/api/webhooks/`. O `.env.local` continua com exatamente as mesmas 4
variáveis do Supabase e **zero** variáveis `ASAAS_*` — reconfirmado nesta
tarefa por inspeção direta (nomes de chave, nunca valores).

O que mudou no repositório, feito por **outra sessão**, em andamento:
`STAGING_EXECUTION_PLAN.md` (plano, não executado), `lib/ambiente.ts` +
`app/robots.ts` + `.env.example` (mecanismo de opt-in de indexação por
ambiente), `tools/teste-robots.ts`. Nenhum desses arquivos foi tocado
aqui. Esse plano é complementar a este documento — ele resolve a
separação DEV/STAGING/PRODUCTION; este documento resolve o que falta
especificamente para uma cobrança financeira real.

## 2. P0 reavaliados

| P0 | Classificação | Onde é consumido | Fallback perigoso? | Ambiente que deve fornecer |
|---|---|---|---|---|
| **P0-1 `ASAAS_API_KEY`** | **OPEN** | `credencialDaPlataforma()` e `getAsaasConfiguration().isConfigured` (`lib/asaas/config.ts:53-79`) | Não — ausência retorna `null`/`false`, `asaasRequisicao()` (`lib/asaas/cliente-api.ts`) devolve 503 antes de qualquer rede | STAGING: chave de **sandbox** (própria); PRODUCTION: chave de **production** (própria) — nunca a mesma, por design do próprio Asaas |
| **P0-2 `ASAAS_WEBHOOK_TOKEN`** | **OPEN** | `tokenDoWebhook()` (`lib/asaas/config.ts:105-108`) | Não — fallback pra `ASAAS_API_KEY` foi removido de propósito (comentário no código explica o motivo: evitar que segredo financeiro trafegue em header de webhook); sem token, endpoint responde 503 | STAGING e PRODUCTION precisam de tokens **diferentes** — token compartilhado permitiria replay de evento sandbox contra produção |
| **P0-3 `ASAAS_PLATFORM_ACCOUNT_ID`** | **OPEN** | `contaDaPlataforma()` (`lib/asaas/config.ts:88-90`) | Não — retorna `null` sem fallback | STAGING: id da conta sandbox; PRODUCTION: id da conta de produção |
| **P0-4 `ASAAS_CREDENTIALS_KEY`** | **OPEN** | `chaveMestra()` (`lib/asaas/credenciais.ts:38-50`) — exige exatamente 32 bytes (hex ou base64); `cifrar()`/`decifrar()` lançam erro sem ela; `cifraConfigurada()` é o portão antes de qualquer escrita/leitura | Não — sem chave válida, não há caminho que grave ou leia credencial em claro | STAGING e PRODUCTION precisam de chaves **próprias e distintas** — tabela `asaas_credenciais` está vazia hoje (reconfirmado), então trocar/gerar custa zero agora |
| **P0-5 domínio `zelopay.com.br`** | **PARTIAL / EXTERNAL** — ver detalhamento abaixo | — | — | — |

### P0-5 — detalhamento (domínio)

Revalidado por grep: a única referência a `zelopay.com.br` no código é
`SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://zelopay.com.br"`
(`app/layout.tsx:27-28`), usada **só** para metadata/OG/canonical/sitemap/
robots — nunca para lógica de autenticação, redirect ou webhook. A outra
única ocorrência do domínio é um `mailto:suporte@zelopay.com.br` estático
em `ContaFinanceira.tsx:150`, irrelevante para o fluxo financeiro.

- **O que já está resolvido em código:** o app é 100% portável — roda sob
  qualquer URL (localhost, preview da Vercel, domínio próprio) sem
  alteração de código. Isso é `FACT`, confirmado por leitura, não
  suposição.
- **O que continua dependendo de externo:** (a) o domínio `zelopay.com.br`
  em si — registro + DNS — continua **EXTERNAL, BLOCKED**, necessário
  para uma marca própria em produção; (b) o endpoint de webhook
  (`/api/webhooks/asaas`, caminho fixo) só precisa de **qualquer URL
  pública estável com HTTPS** — uma URL de preview da Vercel já habilita
  um teste controlado real, o domínio próprio não é pré-requisito para
  isso.

**Correção sobre a auditoria anterior:** o P0-5 bloqueia produção com
marca própria, mas **não bloqueia um teste E2E controlado em staging**,
que pode rodar inteiramente sob uma URL de deploy da Vercel. Essa
distinção é nova nesta revalidação e muda o caminho mínimo até um
primeiro teste real (seção 8 e 16).

## 3. P1 reavaliados

| P1 | Estado | Evidência |
|---|---|---|
| SMTP padrão do Supabase | **BLOCKED, inalterado** | Nenhum arquivo relacionado a e-mail/Auth foi tocado por nenhuma sessão desde a Fase 35 (26/08/2026) — confirmado por `git diff`/`git log`; continua limitado a 2-3 e-mails/hora |
| CNPJ/razão social nos Termos | **BLOCKED, inalterado** | `app/(institucional)/termos` e `privacidade` não aparecem em nenhum diff recente |
| Ambiente de staging separado | **PARTIAL, EM PROGRESSO** — mas por outra sessão | `STAGING_EXECUTION_PLAN.md` já mapeia a solução (o projeto Supabase atual vira staging oficialmente); **plano escrito, nada executado ainda** (nenhum deploy, nenhuma env var de staging configurada) |
| Nenhuma chamada real (nem sandbox) ao Asaas | **NOT VALIDATED, inalterado** | Reconfirmado: `.env.local` sem nenhuma variável `ASAAS_*` |

## 4. Dependências externas

| Dependência | Quem resolve | Bloqueia o quê |
|---|---|---|
| Conta Asaas sandbox (para gerar `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`, `ASAAS_PLATFORM_ACCOUNT_ID` de teste) | Proprietário, no painel do Asaas | Teste E2E controlado (seção 8) |
| Decisão de plataforma de hosting (Vercel é a candidata natural, nunca conectada — confirmado: sem `.vercel/`, sem `vercel.json`) | Proprietário | Deploy de staging, e por consequência qualquer URL pública para webhook |
| Registro + DNS de `zelopay.com.br` | Proprietário | Produção com marca própria (não bloqueia teste E2E em staging) |
| SMTP de produção (fora do padrão do Supabase) | Proprietário | Cadastro real em volume |
| CNPJ/razão social | Proprietário | Termos/Privacidade completos, produção real |
| Conta Asaas de produção | Proprietário | Primeira cobrança real de cliente final |

## 5. O que já está pronto

`IMPLEMENTED`, confirmado por leitura de código nesta revalidação e na
auditoria anterior, sem alteração desde então:

- Onboarding financeiro completo (criação de subconta, compare-and-swap,
  reconciliação) — `lib/core/onboarding.ts`.
- Cliente Asaas com tratamento de erro e timeout — `lib/asaas/cliente-api.ts`.
- Autorização Pix Automático (criar/consultar/cancelar/listar) —
  `lib/asaas/autorizacao-pix.ts`.
- Webhook com autenticação timing-safe, idempotência por constraint única,
  resolução de tenant antes da gravação — `lib/asaas/webhook.ts` +
  `app/api/webhooks/asaas/route.ts`.
- Cifra AES-256-GCM da credencial de subconta, sem caminho de vazamento em
  claro — `lib/asaas/credenciais.ts`.
- Isolamento multi-tenant por FK composta + RLS — `supabase/schema/`.
- `SITE_URL` e todo o fluxo de auth/redirect já portáveis entre ambientes
  sem alteração de código (confirmado por esta revalidação e por
  `STAGING_EXECUTION_PLAN.md` §8).

## 6. O que pode ser preparado agora (sem credenciais reais)

| Item | Estado | Pode preparar agora? | Depende de externo? | Bloqueia GO? |
|---|---|---:|---:|---:|
| Variáveis de ambiente (nomes, formato, onde vivem) | READY | Sim — já documentadas em `.env.example` e `STAGING_EXECUTION_PLAN.md` §5 | Não para documentar; sim para preencher valor real | Não (documentar) / Sim (valor real) |
| Validação de ambiente centralizada | MISSING | Sim — hoje é `process.env.X` disperso em cada módulo (`config.ts`, `credenciais.ts`, `layout.tsx`, `ambiente.ts`); não há um único ponto que valide o conjunto de variáveis Asaas de forma consistente | Não | Não (é robustez, não requisito de GO) |
| Asaas client (`cliente-api.ts`) | IMPLEMENTED | — | — | Não, já pronto |
| Webhook (endpoint + processamento) | IMPLEMENTED | — | — | Não, já pronto |
| Callback/redirect de URL | IMPLEMENTED | — | — | Não, já pronto (portável) |
| Domínio | EXTERNAL | Não (registro é ação externa) | Sim | Sim, só para produção com marca própria |
| SMTP | BLOCKED | Não | Sim | Sim, só para produção com cadastro aberto |
| Termos/Legal | BLOCKED | Não (conteúdo depende de CNPJ real) | Sim | Sim, só para produção real |
| Onboarding (código) | IMPLEMENTED | — | — | Não |
| Criação de cliente (código) | IMPLEMENTED | — | — | Não |
| Criação de cobrança (código) | IMPLEMENTED | — | — | Não |
| Pix Automático (código) | IMPLEMENTED | — | — | Não |
| Idempotência (banco) | IMPLEMENTED | — | — | Não |
| `ASAAS_CREDENTIALS_KEY` de staging | READY | **Sim, agora** — `openssl rand -base64 32`, sem depender do Asaas; tabela vazia, custo zero | Não | Sim, para o teste E2E (seção 8) |
| Observabilidade em tempo real | MISSING | Sim, mas é melhoria pós-lançamento (P2 no relatório anterior) | Sim (escolher serviço) | Não |
| Testes (`tools/teste-*.ts`) | IMPLEMENTED, sem script unificado | Sim, criar script `npm run test:financeiro` é trivial | Não | Não |
| Documentação operacional (este documento + `STAGING_EXECUTION_PLAN.md`) | READY | Sim, em produção agora | Não | Não |

## 7. Pré-condições para STAGING

Autoridade sobre este assunto é `STAGING_EXECUTION_PLAN.md` §17 — não
duplico os critérios aqui para não haver duas fontes divergentes; resumo
apenas a interseção com o core financeiro:

- Deploy acessível numa URL estável (Vercel) — pré-requisito também para
  o teste E2E financeiro desta seção 8, porque o webhook do Asaas precisa
  de uma URL pública.
- `ASAAS_CREDENTIALS_KEY` de staging gerada e **diferente** de dev/produção
  (seção 6, já pode ser feito agora).
- Env vars de staging conferidas uma a uma contra a tabela de
  `STAGING_EXECUTION_PLAN.md` §5 antes do primeiro deploy.
- **Nenhuma credencial real do Asaas de produção deve existir em staging**
  — só sandbox, quando o proprietário decidir configurá-lo lá.

## 8. Teste E2E planejado (documentado, NÃO executado)

```
Prestador de teste (conta @<dominio-de-teste-controlado>)
  ↓
Cadastro (em staging, URL de preview da Vercel)
  ↓
Onboarding → criação de subconta Asaas (sandbox)
  ↓
Cliente de teste (CPF de teste do próprio Asaas sandbox)
  ↓
Cobrança recorrente (valor simbólico, ex.: R$1,00)
  ↓
Autorização Pix Automático (QR/fluxo do Asaas sandbox)
  ↓
Autorização confirmada (evento de webhook real do Asaas)
  ↓
Cobrança automática disparada pelo motor (não manual)
  ↓
Webhook recebido e processado end-to-end
  ↓
Estado financeiro atualizado (cobranca → paga)
  ↓
Confirmação visível no dashboard do prestador de teste
```

**Pré-condições:**
- Deploy de staging acessível publicamente (Vercel).
- Conta Asaas **sandbox** com `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`,
  `ASAAS_PLATFORM_ACCOUNT_ID`, `ASAAS_CREDENTIALS_KEY` (próprios de
  staging) configurados na plataforma de hosting.
- Webhook do Asaas sandbox apontando para
  `https://<url-de-staging>/api/webhooks/asaas` com o token de staging.

**Ambiente:** staging (Supabase atual + Asaas sandbox + Vercel preview),
nunca produção.

**Dados necessários:** um usuário de teste com e-mail controlado, um CPF
de cliente de teste aceito pelo sandbox do Asaas (não CPF real de
terceiro), valor de cobrança simbólico.

**Sequência:** exatamente a do diagrama acima, sem pular etapas, sem
inserir dado direto no banco (o teste deve passar pela UI/Server Actions
reais, não por SQL manual — senão não valida o caminho real).

**Eventos esperados:** `PIX_AUTOMATIC_RECURRING_AUTHORIZATION_CREATED` →
`...ACTIVATED`, seguido do evento de instrução/pagamento correspondente
(nome exato a confirmar contra o payload real recebido, já que nunca foi
observado — ver riscos desconhecidos na auditoria original, seção 18).

**Estados esperados:** `autorizacoes_pix.status` migrando
`CREATED`→`ACTIVE`; `cobrancas.status` migrando até `paga`;
`empresas.provider_status` permanecendo `ativa` durante todo o teste.

**Evidências a coletar:** ver seção 9.

**Critérios de sucesso:** todas as transições de estado acima ocorrem sem
intervenção manual, e uma segunda tentativa de reenviar o mesmo evento de
webhook (reenvio manual pelo painel do Asaas, se disponível em sandbox)
**não** duplica o estado — prova de idempotência sob evento real, algo
que nenhum teste até hoje validou.

**Critérios de rollback:** se qualquer etapa travar, cancelar a
autorização Pix via `cancelarAutorizacaoPixAsaas()` (já implementada) e
usar `reconciliarContaFinanceira()` para não deixar a empresa de teste em
estado `criando` permanente; se necessário, apagar a empresa de teste via
`auth.admin.deleteUser` (mesmo padrão já usado na Fase 20 para limpar as
15 empresas órfãs).

**Como verificar idempotência:** reenviar (ou simular reenvio) do mesmo
`asaas_event_id` e confirmar que a constraint única de `eventos_asaas`
rejeita a segunda gravação e que o estado financeiro não muda na segunda
vez.

**Como detectar inconsistência:** comparar o status da cobrança no banco
Zelo contra o status real da cobrança consultado diretamente na API do
Asaas (`ConsultadorDeCobrancaAsaas`, já injetável, usar em modo real desta
vez) — divergência entre os dois é o sinal de estado inconsistente.

## 9. Evidências obrigatórias

- Print/log do painel do Asaas sandbox mostrando a subconta criada.
- Print/log do evento de webhook recebido (payload sem dado sensível,
  cabeçalhos redigidos).
- Conteúdo da linha correspondente em `eventos_asaas` (campos não
  sensíveis: `provider`, `asaas_event_id`, `criado_em`, `processado_em`).
- Sequência de `status` de `autorizacoes_pix` e `cobrancas` para a
  empresa de teste, antes/depois de cada etapa.
- Confirmação de que a segunda tentativa de gravar o mesmo evento foi
  rejeitada (idempotência).
- Confirmação de limpeza da empresa/dados de teste ao final.

## 10. Critérios objetivos de GO

**GO para teste controlado em staging** (não é GO de produção):
- [ ] Deploy de staging acessível.
- [ ] `ASAAS_API_KEY`/`ASAAS_WEBHOOK_TOKEN`/`ASAAS_PLATFORM_ACCOUNT_ID`
      de **sandbox** configurados em staging.
- [ ] `ASAAS_CREDENTIALS_KEY` de staging gerada e distinta de dev/produção.
- [ ] Webhook do Asaas sandbox apontando para a URL de staging.
- [ ] Seção 8 executada com sucesso e evidências da seção 9 coletadas.

**GO para produção real** (primeiro cliente pagante de verdade) — exige
tudo acima **com credenciais de produção**, mais:
- [ ] Domínio `zelopay.com.br` resolvendo com HTTPS.
- [ ] SMTP de produção configurado (fora do padrão do Supabase).
- [ ] Termos/Privacidade com CNPJ e razão social reais.
- [ ] Teste controlado (seção 8) já realizado com sucesso em staging
      **antes** de repetir com credenciais de produção.

## 11. Critérios objetivos de NO-GO

Qualquer um destes, sozinho, é NO-GO:
- Alguma das 4 variáveis `ASAAS_*` de produção ausente ou reaproveitada
  de staging/sandbox.
- Domínio de produção não resolvendo ou sem HTTPS válido.
- SMTP ainda no padrão limitado do Supabase.
- Termos/Privacidade ainda com CNPJ/razão social `A DEFINIR`.
- Teste E2E controlado (seção 8) nunca executado com sucesso, nem em
  staging.
- `ASAAS_CREDENTIALS_KEY` de produção igual à de staging ou dev.

## 12. Checklist pré-produção

- [ ] Todos os itens da seção 10 ("GO para produção real") atendidos.
- [ ] Revisão de segredos: nenhuma variável `ASAAS_*`/`SUPABASE_SERVICE_ROLE_KEY`
      exposta em `NEXT_PUBLIC_*` (checklist já existente em
      `STAGING_EXECUTION_PLAN.md` §14, reaplicar para produção).
- [ ] `ASAAS_ENV=production` explícito (nunca depender do padrão
      `sandbox` por omissão).
- [ ] Confirmar que a tabela `asaas_credenciais` de produção está vazia
      antes do primeiro onboarding real (banco novo, não herdado de
      staging — `STAGING_EXECUTION_PLAN.md` §4).

## 13. Checklist pós-primeira cobrança

- [ ] Confirmar no dashboard do Asaas (fora do Zelo) que o valor
      realmente chegou à subconta do prestador — isso está fora do
      controle do código Zelo e nunca foi observado.
- [ ] Confirmar que `cobrancas.status` no banco Zelo bate com o status
      real no Asaas (reconciliação manual, seção 8).
- [ ] Revisar `eventos_asaas` das últimas 24h em busca de qualquer evento
      não processado ou com erro.
- [ ] Confirmar que nenhuma cobrança duplicada foi criada para o mesmo
      ciclo (`cobrancas_ciclo_unico` deveria impedir, mas checar de
      qualquer forma na primeira vez real).
- [ ] Rodar `sincronizarStatusFinanceiro()` uma vez manualmente para
      confirmar que o caminho pull de reconciliação também bate com o
      estado real.

## 14. Rollback/recovery

- **Autorização Pix criada por engano em produção:** `cancelarAutorizacaoPixAsaas()`
  (`lib/asaas/autorizacao-pix.ts`) já implementada — cancela no Asaas e
  local.
- **Onboarding travado em `criando`:** `reconciliarContaFinanceira()`
  (`lib/core/onboarding.ts`) já cobre os dois casos documentados (Classe
  A: accountId conhecido, apenas resincroniza; Classe B: subconta órfã,
  transiciona para `bloqueada`).
- **`ASAAS_CREDENTIALS_KEY` de staging perdida/trocada:** sem custo hoje
  (tabela vazia); em produção, depois da primeira credencial real gravada,
  deixa de ser trivial — gerar a chave certa **antes** do primeiro
  onboarding real de produção é o que evita esse cenário.
- **Deploy com problema:** rollback nativo da plataforma de hosting
  (Vercel), sem ação no banco — mesmo mecanismo de
  `STAGING_EXECUTION_PLAN.md` §15.
- **Banco em estado inconsistente após teste:** limpar via
  `auth.admin.deleteUser` (cascade), mesmo padrão já usado para as 15
  empresas órfãs da Fase 20.

## 15. Itens explicitamente proibidos antes do GO

- Configurar credenciais reais de produção antes do teste controlado em
  staging (seção 8) ter sucesso.
- Cobrar cliente final real antes do checklist da seção 10 completo.
- Abrir cadastro público antes do SMTP de produção estar resolvido.
- Publicar Termos/Privacidade com CNPJ/razão social fictícios só para
  "destravar" o checklist.
- Compartilhar `ASAAS_CREDENTIALS_KEY` entre staging e produção, mesmo
  temporariamente.
- Iniciar aquisição, outbound, ou qualquer experimento comercial (Fase 9
  do Outbound Engine ou qualquer GTM da Zelo) antes do GO de produção
  real (seção 10).

## 16. Próxima ação única recomendada

**Gerar e configurar as 4 variáveis `ASAAS_*` de ambiente sandbox
(`ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`, `ASAAS_PLATFORM_ACCOUNT_ID`,
`ASAAS_CREDENTIALS_KEY` própria) assim que o proprietário decidir a
plataforma de hosting e concluir o deploy de staging descrito em
`STAGING_EXECUTION_PLAN.md`** — essa é a única ação que desbloqueia o
teste E2E controlado da seção 8, e não depende do domínio próprio, do
SMTP de produção, nem dos Termos/CNPJ.

---

### Arquivos consultados nesta tarefa

Lidos: `PROJECT_STATUS.md` (seção 65, íntegra), `ZELO_PROJECT_CONTEXT.md`
(íntegro), `ZELO_AUTONOMOUS_PLAN.md` (íntegro), `STAGING_EXECUTION_PLAN.md`
(íntegro, de outra sessão), `lib/asaas/config.ts`, `lib/asaas/credenciais.ts`,
`lib/ambiente.ts`, trecho de `app/layout.tsx` e `ContaFinanceira.tsx`.
Revalidados sem reler por completo (confirmado sem diff desde o commit
`662a7a7`): `lib/core/onboarding.ts`, `lib/asaas/webhook.ts`,
`lib/asaas/cliente-api.ts`, `lib/asaas/autorizacao-pix.ts`,
`supabase/schema/*`. `.env.local` inspecionado por nome de variável, sem
exibir valores.
