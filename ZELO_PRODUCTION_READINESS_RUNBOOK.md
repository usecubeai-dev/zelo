# ZELO — Runbook de Prontidão para Produção

Documento operacional — transforma os 6 bloqueadores de [ZELO_GO_NO_GO_FINAL_AUDIT.md](ZELO_GO_NO_GO_FINAL_AUDIT.md) num plano de execução ordenado. Nenhum código, banco ou serviço foi alterado para produzir este documento — todo dado técnico vem de leitura direta do repositório e de checagens ao vivo (DNS, variáveis presentes, advisories do Supabase) feitas na auditoria anterior, referenciadas aqui, não repetidas às cegas.

**Como usar este documento**: cada seção é uma "receita" — estado atual → o que fazer → como confirmar que funcionou. As seções têm dependência entre si (ver "Ordem de Execução" no final) — não é uma lista pra fazer em qualquer ordem.

---

## 1. Domínio `zelopay.com.br`

**Estado atual**: não resolve. `nslookup zelopay.com.br` devolve `Non-existent domain` (confirmado ao vivo na auditoria anterior). Não é possível saber, de fora, se o domínio nunca foi registrado ou se foi registrado sem DNS configurado — isso só o proprietário sabe, checando o painel do registrador.

**O que precisa ser configurado**:
1. Confirmar que o domínio está de fato registrado (painel do registrador — Registro.br, se for `.com.br`).
2. Escolher a plataforma de deploy (seção 2) **antes** de configurar DNS — o valor do registro A/CNAME depende de qual plataforma vai hospedar.
3. Decidir a forma canônica: `zelopay.com.br` (apex) redirecionando de/para `www.zelopay.com.br`, ou o inverso. O código não tem preferência hardcoded — `NEXT_PUBLIC_SITE_URL` é a única fonte da URL canônica (`app/layout.tsx:28`), então a escolha é livre, mas precisa ser consistente entre DNS, a variável de ambiente, e a configuração de domínio da plataforma de deploy.

**DNS necessário** (varia por plataforma, mas o padrão é):
- Domínio apex (`zelopay.com.br`): registro `A` apontando para o IP da plataforma, ou `ALIAS`/`ANAME` se o provedor de DNS suportar (a maioria das plataformas modernas de deploy — Vercel inclusive — recomenda isso para apex).
- Subdomínio `www`: registro `CNAME` apontando para o domínio que a plataforma fornece (ex.: `cname.vercel-dns.com`).
- **Não inventar o valor exato aqui** — cada plataforma mostra o registro exato a criar assim que o domínio é adicionado ao projeto (seção 2). Copiar o valor exato da tela da plataforma, não de documentação genérica.

**Como validar propagação**:
```bash
nslookup zelopay.com.br
nslookup www.zelopay.com.br
```
Repetir de uma rede diferente (ex.: 4G do celular) — DNS local pode cachear resposta antiga. Propagação real pode levar de minutos a 48h dependendo do TTL anterior do registrador.

**Como validar HTTPS**:
```bash
curl -I https://zelopay.com.br
```
Esperado: `HTTP/2 200` (ou redirect 301/308 controlado, ver abaixo) e certificado válido — a maioria das plataformas modernas (Vercel, Netlify) emite certificado automático via Let's Encrypt assim que o DNS aponta corretamente; não precisa de ação manual normalmente, mas precisa ser **confirmado**, não presumido.

**Como validar www/non-www**:
Decidir qual é o canônico (recomendado: `zelopay.com.br` sem `www`, é o que a marca já usa em toda comunicação existente) e confirmar que o outro redireciona:
```bash
curl -I https://www.zelopay.com.br
```
Esperado: `301`/`308` para `https://zelopay.com.br` (ou vice-versa, se a escolha for o inverso) — configurado na plataforma de deploy, não no código.

**Como validar que o Next.js está respondendo corretamente**:
```bash
curl -s https://zelopay.com.br/ | grep -o "<title>[^<]*</title>"
curl -I https://zelopay.com.br/robots.txt
curl -I https://zelopay.com.br/sitemap.xml
```
Esperado: o `<title>` real da landing (não uma página de erro da plataforma), `robots.txt`/`sitemap.xml` com `200`. **Atenção especial** (achado da auditoria anterior): `robots.txt` só permite indexação se `NEXT_PUBLIC_PERMITIR_INDEXACAO=true` estiver setada no ambiente de produção — conferir o conteúdo real, não só o status `200`:
```bash
curl -s https://zelopay.com.br/robots.txt
```
Esperado em produção: `Allow: /` (não `Disallow: /`).

---

## 2. Deploy

**Plataforma recomendada para o stack atual**: **Vercel**. Justificativa técnica, não preferência genérica — o projeto é Next.js 16 (App Router, Server Actions, Turbopack), e a Vercel é quem mantém o Next.js; suporte a Server Actions, streaming SSR e edge/serverless functions sem configuração extra é nativo. Confirmado no código: `.env.example` já assume esse modelo implicitamente (variáveis `NEXT_PUBLIC_*` vs. server-only já seguem exatamente a separação que a Vercel espera), e não há nenhum artefato de outra plataforma (sem `Dockerfile`, sem config de Netlify/Railway/Render) — a Vercel é a escolha de menor atrito, não a única tecnicamente possível.

**Projeto necessário**:
1. Criar conta/organização na Vercel (se ainda não existir).
2. "Add New Project" → importar o repositório Git (`usecubeai-dev/zelo`, branch `main`, confirmado como o remote atual do projeto).
3. A Vercel detecta Next.js automaticamente — build command e output directory não precisam de configuração manual.

**Integração com Git**:
- Conectar o repositório GitHub à Vercel (OAuth ou GitHub App da Vercel).
- Definir a branch de produção (`main`).
- Cada push em `main` → deploy de produção automático.
- Cada push em outra branch, ou Pull Request → **Preview Deployment** automático (URL própria, efêmera) — é o comportamento nativo da Vercel, não precisa configurar nada extra.

**Variáveis de ambiente necessárias**: ver seção 9 (lista completa e separada por ambiente). Na Vercel, cada variável é cadastrada por ambiente (Production/Preview/Development) — **isso é o mecanismo real que separa staging de produção no nível de deploy**, não uma escolha de código.

**Diferença entre Preview/Staging/Production**:
- **Production**: o deploy que a branch `main` gera, servido no domínio real (`zelopay.com.br`). Usa as variáveis de ambiente marcadas "Production" na Vercel — incluindo `ASAAS_ENV=production` e a `ASAAS_API_KEY` de produção real, quando existirem.
- **Preview**: gerado automaticamente a cada branch/PR que não é `main`. Usa as variáveis marcadas "Preview". **Este é o candidato natural pra servir como "staging"** neste projeto — não precisa de um segundo projeto Vercel, só de um Supabase e um Asaas próprios apontados nas variáveis de ambiente de Preview (ver seção 6).
- **Development**: variáveis usadas só quando alguém roda `vercel dev` localmente — não relevante pra este projeto, que já roda local via `.env.local` sem depender da Vercel.

**Como evitar deploy acidental em produção**:
- **Proteção de branch no GitHub**: exigir Pull Request pra mergear em `main` (não permitir push direto) — configuração do GitHub, não da Vercel, mas é o controle mais forte.
- **Vercel Deployment Protection**: habilitar proteção por senha/SSO nos deploys de Preview, pra eles não ficarem publicamente acessíveis por engano (ainda mais importante depois que Preview passar a apontar pra dados reais de staging, seção 6).
- **Nunca** setar a `ASAAS_API_KEY` de produção real como variável "Preview" — só como "Production". Esse é o controle que impede um Preview Deployment de mexer em dinheiro real por engano.
- Revisar, antes do primeiro deploy de produção, que `NEXT_PUBLIC_SITE_URL` de Production aponta pro domínio real, e a de Preview (se setada) aponta pra URL de preview — evita o link de confirmação de e-mail de um ambiente vazar pro outro (mecanismo já existe no código via `window.location.origin`, não precisa de ajuste, só de a variável certa em cada ambiente).

---

## 3. Supabase

**Projeto atual**: `Zelo`, ref `krwzohklsqdysdrfkjcd`, região `us-east-1`. Confirmado (auditoria anterior): é o **único** projeto Supabase que este código já usou — todo teste automatizado desta e de sessões anteriores rodou contra ele.

**Necessidade de ambiente separado para staging**: **sim, obrigatório antes de produção real**. Motivo concreto, não teórico: hoje, "testar" e "produção" são literalmente o mesmo banco — qualquer teste automatizado ou manual contra esse projeto já está, tecnicamente, mexendo no banco que seria de produção. O plano de criação já está inteiramente escrito em [STAGING_EXECUTION_PLAN.md](STAGING_EXECUTION_PLAN.md) e o schema já está versionado e pronto pra reproduzir em `supabase/schema/` (7 arquivos, `00` a `06`, mais o `README.md` de instruções) — a decisão de arquitetura já foi tomada: **o projeto atual (`krwzohklsqdysdrfkjcd`) vira STAGING**, e um projeto **novo** é criado para produção.

**Variáveis necessárias** (por ambiente — detalhe completo na seção 9):
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — públicas, protegidas pelo RLS, não pelo sigilo.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — só servidor, nunca `NEXT_PUBLIC_*`, ignora RLS. Usado só em `lib/supabase/admin.ts` (lead e webhook).

**Como verificar que staging e produção não compartilham banco**:
1. Depois de criar o projeto novo de produção, comparar os `project ref` (a parte antes de `.supabase.co` na URL) das duas variáveis `NEXT_PUBLIC_SUPABASE_URL` cadastradas na Vercel (uma em Production, outra em Preview) — precisam ser diferentes.
2. Teste funcional: criar uma empresa de teste em staging (Preview), depois checar no projeto de **produção** (via SQL Editor do Supabase Studio) que ela não existe lá. Nunca o inverso (não usar dado de produção pra testar staging).

**Como validar RLS em ambos**:
```sql
-- Rodar no SQL Editor de CADA projeto (staging e produção)
select relname, relrowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r';
```
Esperado: `relrowsecurity = true` nas 13 tabelas, nos dois projetos. Depois de criar o projeto de produção rodando `supabase/schema/06_rls.sql`, isso já vem certo — a validação é só confirmar que o passo não foi pulado. Complementar: rodar `mcp__supabase__get_advisors` (ou o linter equivalente no Studio) nos dois projetos e comparar contra os 6 itens já conhecidos em staging (documentados em `ZELO_GO_NO_GO_FINAL_AUDIT.md` item 3) — qualquer advisory **novo** em produção que não exista em staging merece investigação antes de ir ao ar.

---

## 4. Asaas

**Variáveis necessárias** (ver `lib/asaas/config.ts`, `lib/asaas/credenciais.ts`):
| Variável | Para quê |
|---|---|
| `ASAAS_API_KEY` | credencial da conta da própria Zelo (plataforma) — cria subcontas, cobra a mensalidade dos profissionais |
| `ASAAS_ENV` | `sandbox` ou `production` — decide a URL base (`sandbox.asaas.com` vs `api.asaas.com`) |
| `ASAAS_WEBHOOK_TOKEN` | token que o Asaas devolve no header `asaas-access-token` de cada webhook — sem ele, o endpoint responde 503 e não processa nada |
| `ASAAS_PLATFORM_ACCOUNT_ID` | id da conta raiz da Zelo no Asaas — usado pelo webhook pra distinguir "mensalidade da Zelo" de "cobrança de uma subconta" |
| `ASAAS_CREDENTIALS_KEY` | chave AES-256 (32 bytes) que cifra a credencial de cada subconta antes de gravar no banco — **gerar uma própria por ambiente**, nunca reaproveitar entre staging e produção (uma linha cifrada com a chave errada fica permanentemente ilegível) |

**Sandbox vs. produção**: é literalmente a variável `ASAAS_ENV` — `ambienteAsaas()` em `lib/asaas/config.ts:46` lê essa variável e resolve a URL base automaticamente. Staging deve sempre usar `sandbox`; produção, `production`. Não existe caminho de código que misture os dois — é puramente configuração.

**Credenciais necessárias**: criar conta no Asaas (sandbox primeiro: `sandbox.asaas.com`), gerar uma API Key na própria conta (não é a mesma chave de uma subconta) — essa é a `ASAAS_API_KEY` da plataforma.

**Webhook**:
- **URL que deverá ser configurada** no painel do Asaas (Configurações → Webhooks): `https://zelopay.com.br/api/webhooks/asaas` em produção; o domínio de staging equivalente em sandbox (ex.: a URL de Preview Deployment da Vercel, ou um domínio próprio de staging, se um for definido).
- **Token de autenticação**: o mesmo valor de `ASAAS_WEBHOOK_TOKEN` precisa ser cadastrado no campo de token do painel do Asaas — é esse token que o Asaas devolve no header `asaas-access-token` em cada requisição, e é o que `lib/asaas/webhook.ts:108` compara em tempo constante contra o valor configurado.
- **Eventos necessários** (confirmado por leitura de `lib/asaas/webhook.ts` — são os que o código de fato trata; habilitar exatamente estes no painel, não "todos"):
  - **Pagamento**: `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`, `PAYMENT_OVERDUE`, `PAYMENT_DELETED`, `PAYMENT_RESTORED`, `PAYMENT_REFUNDED`, `PAYMENT_PARTIALLY_REFUNDED`, `PAYMENT_REFUND_IN_PROGRESS`, `PAYMENT_REFUND_DENIED`, `PAYMENT_CHARGEBACK_REQUESTED`, `PAYMENT_CHARGEBACK_DISPUTE`, `PAYMENT_AWAITING_CHARGEBACK_REVERSAL`.
  - **Pix Automático — autorização**: eventos `PIX_AUTOMATIC_RECURRING_AUTHORIZATION_*` (criação/ativação/recusa/cancelamento/expiração).
  - **Pix Automático — instrução de pagamento**: eventos `PIX_AUTOMATIC_RECURRING_PAYMENT_INSTRUCTION_*`.
  - **Elegibilidade**: `PIX_AUTOMATIC_RECURRING_ELIGIBILITY_UPDATED`.
  - **Assinatura da plataforma**: `SUBSCRIPTION_DELETED`.
  - **Status da conta (subconta)**: eventos `ACCOUNT_STATUS_GENERAL_APPROVAL_*`, `ACCOUNT_STATUS_COMMERCIAL_INFO_*`, `ACCOUNT_STATUS_BANK_ACCOUNT_INFO_*`, `ACCOUNT_STATUS_DOCUMENT_APPROVED`.

**Como validar assinatura/autenticidade do webhook**: o Asaas não usa assinatura HMAC neste modelo — usa um **token estático** enviado de volta no header a cada chamada, que o código compara em tempo constante (`comparaEmTempoConstante`, `lib/asaas/webhook.ts:95`) contra `ASAAS_WEBHOOK_TOKEN`. Validar:
```bash
# Sem token — deve responder 401 (rejeitado, não 200)
curl -X POST https://zelopay.com.br/api/webhooks/asaas -H "Content-Type: application/json" -d '{}'

# Com token errado — deve responder 401
curl -X POST https://zelopay.com.br/api/webhooks/asaas -H "asaas-access-token: token-errado" -H "Content-Type: application/json" -d '{}'
```
Sem `ASAAS_WEBHOOK_TOKEN` configurado no ambiente, o endpoint responde **503** (não 401) — é o sinal de "endpoint não configurado", distinto de "token errado" de propósito (`app/api/webhooks/asaas/route.ts:21`).

**Como executar o primeiro teste real em sandbox**:
1. Confirmar `ASAAS_ENV=sandbox` e `ASAAS_API_KEY` (sandbox) configuradas no ambiente de staging.
2. Em `/app/configuracoes`, usar uma conta de teste real para completar o fluxo "Configurar agora" (KYC) — no sandbox do Asaas, subcontas de teste costumam ser aprovadas automaticamente ou quase imediatamente (confirmar isso no próprio painel sandbox, não presumir).
3. Cadastrar um cliente, criar uma recorrência, gerar a autorização, abrir `/autorizar/[id]` (pode ser em outra aba/dispositivo, simulando o cliente) e completar o primeiro pagamento do QR combinado usando as credenciais de teste que o sandbox do Asaas fornece.
4. Confirmar que o webhook chegou: consultar a tabela `eventos_asaas` no Supabase de staging (`select * from eventos_asaas order by recebido_em desc limit 5`) e confirmar que `processado_em` não é nulo.
5. Confirmar que o estado local mudou de verdade: autorização virou `ACTIVE`, a cobrança do primeiro ciclo virou `paga`.

**Como executar o teste de produção posteriormente**: exatamente a mesma sequência, contra o projeto de produção, com `ASAAS_ENV=production`, credenciais reais, e (recomendado) um valor simbólico baixo na primeira cobrança real — nunca pular direto pra um valor alto sem antes ter visto o ciclo completo funcionar em produção pelo menos uma vez.

---

## 5. SMTP

**Qual fluxo depende de e-mail**: confirmação de conta em `/criar-conta` (Supabase Auth envia o link de confirmação) e recuperação de senha em `/recuperar-senha` (mesmo mecanismo). Sem confirmação de e-mail bem-sucedida, a pessoa nunca ganha sessão — o cadastro fica pendurado.

**Limitações atuais**: o projeto usa o provedor de e-mail **padrão** do Supabase, limitado a **2-3 e-mails por hora** — confirmado como bloqueador desde 26/08/2026 (Fase 35), nunca resolvido. Esse limite é do projeto Supabase inteiro, não por usuário — ou seja, 3 pessoas se cadastrando na mesma hora já é suficiente pra travar a quarta.

**Configuração necessária**: Supabase Studio → Authentication → Emails → SMTP Settings (ou o menu equivalente na versão atual do Studio) → configurar um provedor de SMTP transacional próprio (Resend, Postmark, SendGrid, Amazon SES, ou equivalente — a escolha específica é decisão do proprietário, não definida aqui). Precisa de: host SMTP, porta, usuário, senha/API key do provedor escolhido, e um remetente (`from`) verificado nesse provedor.

**Como validar envio**:
1. Depois de configurar, cadastrar uma conta de teste real em `/criar-conta`.
2. Confirmar que o e-mail chega em menos de 1 minuto (não só que "não deu erro" no Supabase).
3. Repetir 5 vezes seguidas em menos de uma hora — se todas chegarem, o limite antigo não se aplica mais.

**Como validar recuperação de senha**: fluxo `/recuperar-senha` → confirmar e-mail chega → clicar no link → confirmar que cai em `/nova-senha` com uma sessão temporária válida → trocar a senha → confirmar login com a senha nova funciona.

**Como validar confirmação/autenticação**: fluxo `/criar-conta` → confirmar e-mail chega → clicar no link → confirmar redirecionamento pra `/app` já autenticado (via `/auth/callback`, que troca o código por sessão) → confirmar que a empresa foi criada (o trigger `ao_criar_usuario` em `auth.users` já testado e funcionando — isso não muda com a troca de SMTP, só o envio do e-mail em si muda).

**Como evitar depender do SMTP limitado atual**: não há contorno de código — é puramente uma configuração de infraestrutura pendente. A única forma de "evitar" é resolver antes de abrir cadastro para tráfego real; não existe um caminho no produto que funcione sem confirmação de e-mail (a confirmação por e-mail está ligada no projeto atual — desligá-la sem SMTP próprio contornaria o sintoma, não o problema, e reduziria a segurança do cadastro).

---

## 6. Staging

**Arquitetura mínima necessária** (decisão já tomada em `STAGING_EXECUTION_PLAN.md`, resumida aqui):

| Peça | Staging |
|---|---|
| **Domínio** | não precisa de domínio próprio — a URL de Preview Deployment da Vercel (`*.vercel.app`) já serve; opcional ter um subdomínio próprio (`staging.zelopay.com.br`) mais adiante, não bloqueia validação |
| **Deploy** | Preview Deployments da Vercel (branch diferente de `main`, ou qualquer PR) |
| **Supabase** | o projeto **atual** (`krwzohklsqdysdrfkjcd`) — vira staging oficialmente, não um projeto novo |
| **Asaas** | conta sandbox própria (`ASAAS_ENV=sandbox`) |
| **SMTP** | pode continuar no padrão do Supabase **só em staging**, contanto que o volume de teste fique abaixo do limite (2-3/hora) — não é o mesmo risco que em produção, mas vale configurar SMTP próprio aqui também se o volume de teste crescer |
| **Variáveis** | ver seção 9, coluna "Staging" |
| **Dados de teste** | contas com e-mail `@zelo.test` (padrão já usado por todos os scripts em `tools/teste-*.ts`), sempre limpas ao final de cada rodada de teste — nenhum resíduo confirmado no banco na auditoria anterior |

**Critérios para considerar staging aprovado**:
1. Deploy de Preview acessível publicamente numa URL estável.
2. `NEXT_PUBLIC_SUPABASE_URL` de staging **diferente** de produção (confirma bancos separados).
3. Fluxo completo da seção 7 executado uma vez de ponta a ponta em staging, com evidência de cada passo (não "deve funcionar" — testado de fato).
4. `robots.txt` de staging bloqueando indexação (`NEXT_PUBLIC_PERMITIR_INDEXACAO` **ausente** no ambiente de Preview — o padrão já é seguro, só não pode ser setada por engano).
5. `ASAAS_CREDENTIALS_KEY` de staging confirmada diferente da futura chave de produção.

---

## 7. Teste E2E de produção

Sequência objetiva, a ser executada manualmente (ou via Playwright, reaproveitando `tests/e2e/` já existente e adaptando o `baseURL`) contra o ambiente antes de declarar GO:

1. **Cadastro** — `/criar-conta`, conta nova com e-mail real (não `@zelo.test` neste teste específico, pra validar SMTP real também).
2. **Confirmação por e-mail** — clicar no link recebido, cair autenticado em `/app`.
3. **Login** — sair e entrar de novo em `/entrar` com a mesma conta, confirmar sessão persiste.
4. **Onboarding** — conferir checklist "Primeiros passos (1/8)" aparece; completar CPF/CNPJ da empresa.
5. **Conta financeira (KYC)** — completar "Configurar agora" em `/app/configuracoes`, confirmar que a subconta é criada e aprovada (sandbox) ou entra em análise (produção real).
6. **Cliente** — cadastrar um cliente em `/app/clientes/novo`.
7. **Cobrança avulsa** — criar uma cobrança avulsa, confirmar que aparece na lista e no dashboard.
8. **Recorrência** — criar uma recorrência para o mesmo cliente, confirmar que a primeira cobrança é gerada automaticamente.
9. **Autorização pública** — gerar a autorização, copiar o link de `/autorizar/[id]`, abrir em aba anônima/outro dispositivo (simulando o cliente, sem sessão), confirmar que carrega QR/código.
10. **Pix/Asaas** — completar o pagamento do QR combinado usando as credenciais de teste do Asaas (sandbox) ou um pagamento real de valor simbólico (produção).
11. **Webhook** — confirmar no banco (`eventos_asaas`) que o evento chegou e foi processado (`processado_em` preenchido).
12. **Atualização financeira** — confirmar que a autorização virou `ACTIVE`, a cobrança do primeiro ciclo virou `paga`, e uma linha nova apareceu em `pagamentos`.
13. **Dashboard** — voltar pro dashboard, confirmar que "Recebido no mês" e "4/8 → 8/8" no checklist refletem o que aconteceu, sem precisar recarregar manualmente mais de uma vez.

Se qualquer passo falhar, o teste **para ali** — não pular pro próximo com uma etapa quebrada, porque os passos seguintes dependem do estado real dos anteriores.

---

## 8. Checklist final GO/NO-GO

| Item | Evidência exigida | Status | Responsável | Bloqueia lançamento? |
|---|---|---|---|---|
| Domínio resolve | `nslookup zelopay.com.br` devolve IP | ❌ pendente | Proprietário | **Sim** |
| HTTPS válido | `curl -I https://zelopay.com.br` → 200 + certificado válido | ❌ pendente (depende do domínio) | Proprietário/Vercel | **Sim** |
| www/non-www consistente | `curl -I` no não-canônico devolve redirect | ❌ pendente | Proprietário | Não (mas deveria ser feito junto) |
| Projeto Vercel criado e conectado ao Git | Deploy de produção acessível | ❌ pendente | Proprietário | **Sim** |
| Proteção de branch `main` | Configuração visível no GitHub | ❌ pendente | Proprietário | Não (recomendado) |
| Supabase de produção criado | Segundo `project ref`, diferente do de staging | ❌ pendente | Proprietário | **Sim** |
| Schema aplicado em produção | 13 tabelas, RLS ligado, 18 policies (rodar `supabase/schema/00`-`06`) | ❌ pendente | Proprietário/Claude | **Sim** |
| `ASAAS_API_KEY` de produção | `getAsaasConfiguration().isConfigured === true` em produção | ❌ pendente | Proprietário | **Sim** |
| Webhook do Asaas configurado e testado | Evento real chega e é processado (`eventos_asaas.processado_em` preenchido) | ❌ pendente | Proprietário | **Sim** |
| SMTP próprio configurado | 5 envios seguidos em <1h sem falha | ❌ pendente | Proprietário | **Sim** |
| CNPJ/razão social reais | `/termos` e `/privacidade` sem `A DEFINIR` | ❌ pendente (fora deste código) | Proprietário | **Sim** |
| Staging aprovado (seção 6) | Todos os 5 critérios da seção 6 atendidos | ❌ pendente | Proprietário/Claude | **Sim** |
| Teste E2E de produção (seção 7) | Os 13 passos executados com evidência | ❌ pendente | Proprietário/Claude | **Sim** |
| `NEXT_PUBLIC_PERMITIR_INDEXACAO=true` em produção | `curl` em `/robots.txt` mostra `Allow: /` | ❌ pendente | Proprietário | Não (SEO, não funcional) |
| Build/TypeScript limpos | `next build` exit 0, `tsc --noEmit` limpo | ✅ confirmado (auditoria anterior) | — | — |
| Testes automatizados passando | 700/704 (4 restantes são flakiness de teste conhecida) | ✅ confirmado (auditoria anterior) | — | — |
| RLS completo | 13/13 tabelas, advisories revisados | ✅ confirmado (auditoria anterior) | — | — |
| `auth_leaked_password_protection` ligada | Toggle no Supabase Auth settings | ❌ pendente | Proprietário | Não (recomendado, P2) |

---

## 9. Variáveis de ambiente

### Obrigatórias em produção
| Variável | Onde é usada |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `lib/supabase/server.ts`, `browser.ts` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | idem |
| `SUPABASE_URL` | `lib/supabase/admin.ts` |
| `SUPABASE_SERVICE_ROLE_KEY` | idem |
| `ASAAS_API_KEY` | `lib/asaas/config.ts` |
| `ASAAS_ENV=production` | idem |
| `ASAAS_WEBHOOK_TOKEN` | `app/api/webhooks/asaas/route.ts` |
| `ASAAS_PLATFORM_ACCOUNT_ID` | `lib/asaas/config.ts` |
| `ASAAS_CREDENTIALS_KEY` | `lib/asaas/credenciais.ts` — **própria de produção**, nunca igual à de staging |
| `NEXT_PUBLIC_SITE_URL` | `app/layout.tsx` — deve ser `https://zelopay.com.br` |
| `NEXT_PUBLIC_PERMITIR_INDEXACAO=true` | `app/robots.ts` / `lib/ambiente.ts` — **só** em produção |

### Obrigatórias em staging
Mesma lista acima, exceto:
- `ASAAS_ENV=sandbox` (não `production`)
- `ASAAS_API_KEY` → credencial de **sandbox**, não a real
- `ASAAS_CREDENTIALS_KEY` → **própria de staging**, gerada separada
- `NEXT_PUBLIC_SITE_URL` → URL do Preview Deployment (ou domínio de staging, se um existir)
- `NEXT_PUBLIC_PERMITIR_INDEXACAO` → **ausente** (nunca `true` em staging)
- `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` → apontando pro projeto atual (`krwzohklsqdysdrfkjcd`), que já é staging

### Opcionais
| Variável | Efeito se ausente |
|---|---|
| `NEXT_PUBLIC_GA_ID` | nenhum script do GA carrega — degrada graciosamente |
| `NEXT_PUBLIC_CLARITY_ID` | idem, pro Clarity |
| `CHROME_PATH` | só afeta `tools/marca.mjs` (ferramenta de dev, gera assets de logo) — irrelevante em produção |

### Nunca devem ser expostas ao cliente (sem prefixo `NEXT_PUBLIC_`, sempre)
- `SUPABASE_SERVICE_ROLE_KEY` — ignora RLS, isolada em `lib/supabase/admin.ts` com guarda em runtime (`if (typeof window !== "undefined") throw`).
- `ASAAS_API_KEY` — credencial financeira da plataforma.
- `ASAAS_WEBHOOK_TOKEN` — segredo de autenticação de origem, nunca reaproveitar como se fosse a API key (decisão de segurança já registrada no próprio código).
- `ASAAS_CREDENTIALS_KEY` — perder ou vazar torna toda credencial de subconta cifrada comprometida/irrecuperável.
- `SUPABASE_URL` (a variável server-only, distinta de `NEXT_PUBLIC_SUPABASE_URL` — tecnicamente o valor é o mesmo URL público, mas mantida sem prefixo de propósito nos call sites server-only, por consistência com o padrão do projeto).

---

## 10. Segurança de lançamento

- **RLS**: 13/13 tabelas com RLS ligado, 18 policies, confirmado por advisory do Supabase (auditoria anterior). Repetir a mesma consulta de advisories no projeto de produção assim que criado (seção 3) — não presumir que replicar o schema replica automaticamente o resultado do advisory sem checar.
- **Multi-tenancy**: `empresa_id` nunca aceito do formulário, sempre da sessão; FKs compostas impedem mistura de tenant no nível do banco. Nenhuma mudança necessária — já testado extensivamente.
- **Secrets**: nenhum hardcoded no código (confirmado por grep em sessões anteriores) — 100% via variável de ambiente. O risco real de lançamento é **operacional**: gerar `ASAAS_CREDENTIALS_KEY` diferente por ambiente (seção 9) e nunca commitar `.env.local`/`.env.production` (já coberto por `.gitignore`, confirmar que continua assim antes do primeiro deploy).
- **Webhook**: token estático comparado em tempo constante, sem fallback pra API key, 503 explícito quando não configurado (não finge sucesso). Validar com os `curl` da seção 4 antes de considerar pronto.
- **Indexação**: `NEXT_PUBLIC_PERMITIR_INDEXACAO` é opt-in — o padrão seguro (ausente = não indexa) já protege staging por default; o risco é o oposto, **esquecer de ligar em produção**. Incluído no checklist (seção 8).
- **Robots**: `app/robots.ts` já reflete a flag acima corretamente — nenhuma ação de código pendente, só a variável de ambiente certa no lugar certo.
- **HTTPS**: automático via a plataforma de deploy recomendada (seção 2), assim que o DNS apontar corretamente — validar com `curl -I`, não presumir.
- **Cookies/sessão**: sessão via cookie HttpOnly gerenciado pelo `@supabase/ssr`, autorização decidida por `getUser()` (valida contra o servidor), nunca por `getSession()` sozinho. Nenhuma mudança necessária.
- **Logs**: disciplina de `console.error` com contexto estruturado em toda a base, confirmado nunca logar secret (auditado em fase anterior). Nenhum serviço de observabilidade externo (Sentry/Datadog) configurado — não é bloqueador de lançamento, mas significa que, sem alguém olhando os logs da Vercel ativamente, um erro de produção só é percebido se um usuário reclamar ou alguém checar manualmente.
- **Dados de teste**: nenhum resíduo confirmado no banco atual (auditoria anterior). Disciplina a manter: todo teste contra o projeto de staging deve continuar limpando ao final, e **nunca** rodar `tools/teste-*.ts` contra o projeto de produção depois que ele existir.
- **Separação staging/produção**: hoje inexistente (é o bloqueador #5 da auditoria) — passa a existir assim que as seções 2, 3 e 6 deste runbook forem executadas.

---

# ORDEM DE EXECUÇÃO

Numerada por dependência real, não por facilidade — uma etapa não pode começar antes da anterior estar de fato concluída onde há dependência marcada.

1. **Criar o projeto Vercel e conectar ao Git** (seção 2) — sem isso, nada mais tem onde ser testado publicamente. *Sem dependências.*
2. **Confirmar/registrar o domínio e apontar o DNS pra Vercel** (seção 1) — pode ser feito em paralelo ao passo 1, mas precisa do projeto Vercel criado primeiro pra saber qual valor de DNS usar. *Depende do passo 1.*
3. **Fixar o projeto Supabase atual como staging oficial** — decisão já tomada, só formalizar (nenhuma ação técnica nova além do que já existe). *Sem dependências novas.*
4. **Criar o projeto Supabase de produção e aplicar o schema versionado** (seção 3, `supabase/schema/`) — pode ser feito em paralelo aos passos 1-2. *Sem dependências.*
5. **Configurar as variáveis de ambiente na Vercel** (Production e Preview separadas, seção 9) — precisa dos passos 3 e 4 concluídos (para ter os dois `project ref` do Supabase) e do passo 1 (para existir onde configurar). *Depende de 1, 3, 4.*
6. **Configurar Asaas sandbox e rodar o primeiro teste real em staging** (seção 4) — precisa do passo 5 (variáveis de staging já configuradas) e do domínio de staging/preview existindo. *Depende de 5.*
7. **Configurar SMTP próprio** (seção 5) — pode ser feito em paralelo aos passos 4-6, mas precisa estar pronto **antes** do teste E2E completo (passo 9), porque esse teste depende de confirmação de e-mail real. *Sem dependência dos passos 1-6, mas bloqueia o passo 9.*
8. **Rodar o checklist de staging aprovado** (seção 6, critérios 1-5) — precisa dos passos 1, 3, 5, 6 concluídos. *Depende de 1, 3, 5, 6.*
9. **Rodar o teste E2E completo em staging** (seção 7, os 13 passos) — precisa do passo 8 (staging aprovado) e do passo 7 (SMTP, pra validar e-mail de verdade). *Depende de 7, 8.*
10. **Configurar Asaas produção (credenciais reais + webhook real)** (seção 4, "teste de produção") — só depois do passo 9 ter passado sem falha em staging. *Depende de 9.*
11. **Configurar `ASAAS_API_KEY`/`ASAAS_ENV=production`/`ASAAS_CREDENTIALS_KEY` de produção na Vercel** — precisa do passo 10. *Depende de 10.*
12. **Definir CNPJ/razão social reais e publicar `/termos`/`/privacidade` completos** — pode ser feito a qualquer momento em paralelo, mas é **obrigatório** antes do passo 14. *Sem dependência técnica, bloqueia 14.*
13. **Setar `NEXT_PUBLIC_PERMITIR_INDEXACAO=true`** só no ambiente de Production da Vercel — último passo de configuração, feito por último de propósito (evita indexação prematura de um ambiente ainda incompleto). *Depende de 2, 11.*
14. **Rodar o teste E2E completo (seção 7) uma última vez contra produção real**, com valor simbólico na primeira cobrança de teste. *Depende de 2, 11, 12, 13.*
15. **Preencher o checklist final da seção 8 por completo** e declarar GO.

---

# CRITÉRIO DE GO

**Zelo = GO PARA PRODUÇÃO** quando, e somente quando, **todas** as evidências abaixo existirem simultaneamente — nenhuma delas é "seria bom ter", todas são condição necessária:

1. `nslookup zelopay.com.br` devolve um IP válido, e `curl -I https://zelopay.com.br` devolve `200` com certificado válido.
2. O deploy de produção na Vercel serve esse domínio, com proteção de branch ativa no Git.
3. Existem **dois** projetos Supabase distintos (staging = `krwzohklsqdysdrfkjcd`, produção = novo), com `project ref` diferentes confirmados nas variáveis de ambiente da Vercel, e RLS confirmado ligado (13/13 tabelas) em **ambos** via advisory do Supabase.
4. `getAsaasConfiguration().isConfigured === true` em produção, com `ASAAS_ENV=production`, e o webhook registrado no painel do Asaas apontando pra `https://zelopay.com.br/api/webhooks/asaas` com o token correto — validado por pelo menos um evento real processado com sucesso (`eventos_asaas.processado_em` preenchido em produção).
5. SMTP próprio configurado e validado com 5 envios reais em menos de uma hora, sem falha, em produção.
6. CNPJ e razão social reais publicados em `/termos` e `/privacidade` — sem nenhum `A DEFINIR` restante.
7. O checklist de staging aprovado (seção 6) está 100% atendido, **e** o teste E2E completo (seção 7, os 13 passos) foi executado com sucesso **duas vezes**: uma em staging, uma em produção real com valor simbólico.
8. `NEXT_PUBLIC_PERMITIR_INDEXACAO=true` confirmado em produção via `curl` real no `robots.txt` publicado.
9. `next build` e `tsc --noEmit` limpos no commit que está de fato em produção (não um commit antigo) — re-executar como último passo, não confiar em resultado de dias atrás.

Se qualquer um dos 9 itens acima não tiver evidência concreta e recente (não "deve estar certo" ou "estava certo semana passada") — o status permanece **NO-GO**, mesmo que os outros 8 estejam prontos. Melhorias futuras (analytics, observabilidade externa, Strix/pentest automatizado, `role="tablist"` semântico, `auth_leaked_password_protection`) **não** entram neste critério — são qualidade contínua, não condição de lançamento.
