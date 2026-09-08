# Zelo — Plano de Execução do STAGING

Documento de **planejamento**, produzido na Etapa 3 (auditoria + plano,
sem execução). Nenhum comando deste plano foi executado ao escrevê-lo —
ver seção 12 para a ordem em que devem ser executados, quando autorizado.

## 1. Objetivo

Transformar o ambiente atual em um **STAGING** seguro, reproduzível e
isolado da futura produção, sem:
- criar um segundo projeto Supabase agora (isso é o próprio STAGING —
  produção é que virá depois, como projeto novo);
- alterar o banco, tabelas ou dados atuais;
- configurar Asaas, OpenPix, domínio ou fazer qualquer deploy.

Este documento é o **plano**. A execução é um passo futuro, separado,
autorizado explicitamente depois da revisão deste arquivo.

## 2. Arquitetura DEV / STAGING / PRODUCTION

```
┌─────────────┐      ┌──────────────────────────┐      ┌──────────────────┐
│    DEV      │      │        STAGING           │      │    PRODUCTION     │
│ (local)     │      │  (o ambiente de hoje)     │      │  (futuro, novo)   │
├─────────────┤      ├──────────────────────────┤      ├──────────────────┤
│ next dev    │      │ Vercel (branch de preview │      │ Vercel (produção) │
│ :3210       │      │  ou projeto dedicado)     │      │                   │
│             │      │                           │      │                   │
│ Supabase:   │      │ Supabase:                 │      │ Supabase:         │
│ krwzohkl... │─────▶│ krwzohklsqdysdrfkjcd      │      │ novo projeto      │
│ (mesmo      │      │ (o projeto atual, agora   │      │ (a criar quando   │
│  projeto)   │      │  com esse papel fixado)   │      │  este plano for   │
│             │      │                           │      │  aprovado p/ prod)│
│ Asaas: não  │      │ Asaas: sandbox            │      │ Asaas: production │
│ configurado │      │ (quando configurado)      │      │ (quando pronto)   │
└─────────────┘      └──────────────────────────┘      └──────────────────┘
```

**Decisão chave desta etapa**: o projeto Supabase que hoje serve dev/teste
(`krwzohklsqdysdrfkjcd`) **passa a ser oficialmente o STAGING** — não se
cria um projeto novo para isso. Um projeto Supabase novo só entra quando
produção for de fato criada (fora do escopo desta etapa). Isso significa
que, na prática, hoje "dev local" e "staging" **compartilham o mesmo
banco** — não há isolamento de dados entre eles ainda. Ver seção 15
(riscos) para o que isso implica.

## 3. Supabase atual → STAGING

Auditoria de como o projeto é referenciado hoje:

- **100% via variável de ambiente, zero hardcoded.** Confirmado por busca
  no código: nenhuma ocorrência do project ref `krwzohklsqdysdrfkjcd` em
  `.ts`/`.tsx`/`.json`/`.css`. Trocar de projeto Supabase é puramente
  configuração — nenhuma linha de código muda.
- Três pontos de acesso, cada um com seu cliente ([lib/supabase/server.ts](lib/supabase/server.ts),
  [lib/supabase/browser.ts](lib/supabase/browser.ts), [lib/supabase/admin.ts](lib/supabase/admin.ts)):
  o cliente do servidor e do navegador usam a chave publicável (RLS ativo);
  o admin usa a `service_role` (ignora RLS) e só pode ser importado por
  código de servidor sem usuário logado (lead, webhook).
- **O que fica fora do schema SQL** (não capturado em `supabase/schema/`,
  porque não é DDL de banco — é configuração do projeto Supabase em si):
  - Configuração do Auth (providers habilitados, Site URL, Redirect URLs
    permitidas, templates de e-mail, rate limit de SMTP);
  - Configuração de Storage (não usado hoje, mas se algum bucket existir
    no projeto, não está no snapshot);
  - Segredos de projeto (JWT secret, API keys) — nunca deveriam estar num
    dump de schema mesmo;
  - Configurações de rede/pooler (connection pooling, IP restrictions).

## 4. Futuro Supabase → PRODUCTION

Não criado nesta etapa. Quando for, o processo é exatamente o descrito no
[README de `supabase/schema/`](supabase/schema/README.md): criar o
projeto, rodar os 7 arquivos `.sql` em ordem, configurar as env vars,
gerar um `ASAAS_CREDENTIALS_KEY` próprio (nunca reaproveitar o de
staging/dev). Produção **não herda dados** de staging — nasce vazia, como
qualquer banco novo.

## 5. Variáveis de ambiente por ambiente

Todas as 13 variáveis referenciadas no código, com o valor esperado por
ambiente. Nenhuma é obrigatória para o app rodar — cada integração
simplesmente não carrega se sua variável estiver vazia (comportamento já
existente, confirmado em `.env.example` e nos módulos que a usam).

| Variável | DEV (local) | STAGING | PRODUCTION (futuro) |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | projeto atual | projeto atual (mesmo) | projeto novo |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon do projeto atual | mesma | anon do projeto novo |
| `SUPABASE_URL` | projeto atual | projeto atual (mesmo) | projeto novo |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role do projeto atual | mesma | service_role do projeto novo |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3210` (ou vazio) | URL do deploy de staging na Vercel | `https://zelopay.com.br` (quando o domínio existir) |
| `NEXT_PUBLIC_PERMITIR_INDEXACAO` **(nova, Etapa 3A)** | vazio (bloqueado) | **vazio/ausente** — nunca setar em staging | `true` — única forma de liberar indexação |
| `ASAAS_ENV` | `sandbox` | `sandbox` | `production` |
| `ASAAS_API_KEY` | vazio (não configurado) | sandbox key (quando decidido configurar) | production key |
| `ASAAS_WEBHOOK_TOKEN` | vazio | próprio de staging | próprio de produção |
| `ASAAS_PLATFORM_ACCOUNT_ID` | vazio | conta sandbox | conta de produção |
| `ASAAS_CREDENTIALS_KEY` | própria (teste) | **própria, gerada só para staging** | **própria, gerada só para produção** |
| `NEXT_PUBLIC_GA_ID` | vazio | vazio (staging não deve gerar analytics real) | ID real |
| `NEXT_PUBLIC_CLARITY_ID` | vazio | vazio | ID real |
| `CHROME_PATH` | só uso local de `tools/marca.mjs` | não aplicável | não aplicável |

## 6. Segredos que devem ser diferentes por ambiente

Regra geral: **qualquer coisa que assina, cifra ou autentica precisa de
valor próprio por ambiente** — nunca copiar de um ambiente para outro.

- **`SUPABASE_SERVICE_ROLE_KEY`** — por definição, é por-projeto; staging
  e produção nunca podem compartilhar, porque serão projetos diferentes.
- **`ASAAS_CREDENTIALS_KEY`** — ver seção 7, é o caso mais crítico.
- **`ASAAS_WEBHOOK_TOKEN`** — se staging e produção compartilhassem o
  token, um evento de teste em sandbox poderia ser replayado contra o
  endpoint de produção (ou vice-versa) sem que o servidor tivesse como
  distinguir a origem.
- **`ASAAS_API_KEY`** — sandbox e production são, por design do próprio
  Asaas, chaves de contas diferentes; não há como reutilizar mesmo se
  quisesse.

O que **pode** ser igual entre staging e produção sem risco: `ASAAS_ENV`
(é só uma flag), `NEXT_PUBLIC_GA_ID`/`NEXT_PUBLIC_CLARITY_ID` (mas
recomendo deixar vazios em staging mesmo assim — ver seção 16).

## 7. `ASAAS_CREDENTIALS_KEY` — separação entre ambientes

- **Função**: chave AES-256 de 32 bytes que cifra em repouso a
  `api_key_cifrada` de cada linha da tabela `asaas_credenciais` (a
  credencial Asaas de cada subconta/profissional). Ver
  [lib/asaas/credenciais.ts](lib/asaas/credenciais.ts).
- **Por que precisa ser própria por ambiente**: uma linha cifrada com a
  chave do ambiente A é **permanentemente indecifrável** com a chave do
  ambiente B — não é uma questão de compatibilidade, é criptografia
  funcionando como deveria. Se staging e produção compartilhassem a
  chave, um vazamento de uma comprometeria a outra também.
- **Situação hoje**: a tabela `asaas_credenciais` está vazia (confirmado
  na Fase 20 — nenhuma subconta real cadastrada ainda), então **não há
  dado real em risco agora**. Isso é uma janela de oportunidade: trocar a
  chave custa zero hoje; ficaria caro depois que houver linhas reais
  cifradas.
- **Confirmação**: staging **deverá ter chave própria**, gerada com
  `openssl rand -base64 32`, diferente da usada em dev local e da que
  produção usará no futuro. **Não alterada nesta etapa** — só planejada.

## 8. Auth/redirects

Fluxo atual (auditado em [app/auth/callback/route.ts](app/auth/callback/route.ts),
[FormularioCadastro.tsx](app/(auth)/criar-conta/FormularioCadastro.tsx),
[FormularioRecuperar.tsx](app/(auth)/recuperar-senha/FormularioRecuperar.tsx)):

1. Cadastro (`criar-conta`) e recuperação de senha chamam o Supabase Auth
   do **navegador**, passando `emailRedirectTo`/`redirectTo` construído
   com `window.location.origin` — **não** com `NEXT_PUBLIC_SITE_URL` e
   **não** hardcoded. Ou seja: **o código já é portável entre ambientes
   sem nenhuma alteração** — quem acessa `https://staging-x.vercel.app`
   recebe um link de e-mail apontando para `staging-x.vercel.app`, quem
   acessa localhost recebe link para localhost.
2. O link do e-mail chega em `/auth/callback?code=...&proximo=...`. Essa
   rota lê `origin` de `request.nextUrl` (a URL real da requisição, não
   uma env var) para montar o redirect final — de novo, portável por
   design.
3. Proteção de open-redirect já existe: `proximo` só é aceito se começar
   com `/` e não com `//`.
4. **Não existe `middleware.ts`** no projeto — a leitura de sessão
   acontece por chamada, dentro de cada Server Component/Action via
   `supabaseServer()` (que lê e regrava cookies por request). Não é um
   padrão que precise mudar para staging.

**O que precisa ser alterado para staging** — não no código, na
**configuração do projeto Supabase** (painel, ou API de management,
fora do escopo de execução desta etapa):
- Adicionar a URL de staging (ex.: `https://zelo-staging.vercel.app`) à
  lista de **Redirect URLs permitidas** no Supabase Auth. Sem isso, o
  Supabase recusa o `exchangeCodeForSession` mesmo com o código correto.
- Definir o **Site URL** do projeto Supabase (usado como fallback em
  alguns fluxos de e-mail) para a URL de staging.
- SMTP: o projeto já usa o provedor padrão do Supabase (rate-limited,
  bloqueio conhecido desde uma fase anterior). Em staging isso é
  aceitável (baixo volume de teste); **não é bloqueante para staging**,
  só para produção real.

**Pontos que dependem de URL absoluta** (mapeados, nenhum precisa de
código novo): `emailRedirectTo`, `redirectTo`, o `origin` do callback, e
`NEXT_PUBLIC_SITE_URL`/`SITE_URL` — usado **só** para metadata/OG/
canonical/sitemap/robots ([app/layout.tsx](app/layout.tsx:28),
[app/robots.ts](app/robots.ts)), nunca para lógica de autenticação.

## 9. Hosting

- **Nenhuma configuração de Vercel, Docker, Netlify, Render ou CI/CD
  existe no repositório hoje** — confirmado: sem `.vercel/`, sem
  `vercel.json`, sem `Dockerfile`, sem `.github/workflows/`. O deploy de
  staging será a **primeira** configuração de hosting deste projeto.
- `package.json` só tem os scripts padrão do Next (`dev`, `build`,
  `start`, `typecheck`) — nenhum script de deploy customizado.
- Nesta etapa: **nenhum login, nenhuma conexão, nenhum deploy** foi feito
  ou será feito — só constatação de que a plataforma de hosting inteira
  ainda precisa ser decidida/conectada quando autorizado.

## 10. Provider financeiro (Asaas)

**Onde aparece na arquitetura** (mapeamento completo, sem configurar
nada):

- [lib/asaas/config.ts](lib/asaas/config.ts) — ponto único de config:
  distingue `sandbox`/`production` via `ASAAS_ENV`, resolve a URL base
  (`https://sandbox.asaas.com/api/v3` vs `https://api.asaas.com/api/v3`),
  e expõe a credencial da **plataforma** (`ASAAS_API_KEY`, a conta do
  próprio Zelo — cobra a mensalidade do profissional) separada da
  credencial de **subconta** (por empresa, cifrada em `asaas_credenciais`,
  resolvida via [lib/asaas/credenciais.ts](lib/asaas/credenciais.ts) —
  movimenta o dinheiro do profissional, nunca o do Zelo).
- [app/api/webhooks/asaas/route.ts](app/api/webhooks/asaas/route.ts) —
  endpoint único de entrada de eventos Asaas.
- [lib/asaas/webhook.ts](lib/asaas/webhook.ts) — processamento dos
  eventos, com idempotência por `eventos_asaas.asaas_event_id`.
- [lib/asaas/cliente-api.ts](lib/asaas/cliente-api.ts) — chamadas de
  saída para a API do Asaas.

**Sandbox vs produção**: já é uma flag de ambiente (`ASAAS_ENV`), não uma
diferença de código — trocar de sandbox para produção é só trocar duas
env vars (`ASAAS_ENV=production` + `ASAAS_API_KEY` de produção).

**Secrets que seriam necessários** (para quando Asaas for configurado —
**não configurado nesta etapa**): `ASAAS_API_KEY` (sandbox, para
staging), `ASAAS_WEBHOOK_TOKEN` (próprio de staging),
`ASAAS_PLATFORM_ACCOUNT_ID` (id da conta sandbox), `ASAAS_CREDENTIALS_KEY`
(própria — seção 7).

## 11. Webhooks

- **Endpoint**: `POST /api/webhooks/asaas` — caminho fixo, mesmo em
  qualquer ambiente (o Next.js roteia por path, não por domínio
  hardcoded). Em staging seria
  `https://<url-de-staging>/api/webhooks/asaas`.
- **Autenticação**: header `asaas-access-token` (ou `Authorization:
  Bearer`), validado contra `ASAAS_WEBHOOK_TOKEN`. **Sem fallback** para
  `ASAAS_API_KEY` — decisão de segurança já implementada, documentada no
  próprio código (evita que um segredo financeiro trafegue como token de
  webhook).
- **Comportamento sem configuração**: responde `503` (erro de servidor,
  não de quem chamou) — o endpoint já é seguro por padrão mesmo sem
  token configurado; não vaza nem processa nada.
- **Dependência de domínio**: o Asaas precisa de uma URL pública para
  enviar o webhook — ou seja, staging só pode receber webhooks reais
  depois de ter uma URL de deploy estável (Vercel gera uma
  automaticamente, não depende do domínio `zelopay.com.br`).
- **Nesta etapa**: nenhum webhook real foi ou será configurado no painel
  do Asaas — é preciso Asaas sandbox configurado primeiro (fora de
  escopo).

## 12. Reprodução do schema

Confirmado: **sim, `supabase/schema/` reproduz o banco** — 13/13 tabelas,
constraints, 30 índices, 8 funções, 11 triggers, RLS + 18 policies (ver
[supabase/schema/README.md](supabase/schema/README.md) para o passo a
passo completo de 5 passos).

**O que NÃO está no snapshot e precisaria de configuração manual num
projeto novo** (relevante só para o dia em que produção for criada — hoje
staging = o projeto atual, então isso não se aplica agora):
- Configuração do Supabase Auth (seção 8): Redirect URLs, Site URL,
  provedores habilitados, templates de e-mail.
- Segredos do próprio projeto Supabase (JWT secret, etc.) — gerados pelo
  Supabase na criação do projeto, não fazem parte de um dump de schema.
- Buckets de Storage, se algum vier a existir.
- Grants customizados de role, se algum vier a existir fora do padrão
  automático do Supabase (nenhum indício disso hoje).

## 13. Ordem exata de execução

**Esta seção descreve a ordem para quando a execução for autorizada — nada
abaixo foi executado nesta etapa.**

Como a decisão desta etapa é "o projeto atual VIRA staging" (não criar um
projeto novo), a lista de execução é mais curta do que criar um ambiente
do zero:

1. Confirmar com o usuário a escolha de plataforma de hosting (Vercel é o
   candidato natural — já é referenciado no `.env.example` como
   arquitetura implícita, mas nunca foi conectado).
2. Criar/conectar o projeto na plataforma de hosting escolhida.
3. Configurar as env vars de staging na plataforma de hosting, seguindo a
   tabela da seção 5 — incluindo gerar o `ASAAS_CREDENTIALS_KEY` próprio
   de staging (seção 7) **antes** do primeiro deploy.
4. No painel do Supabase do projeto atual: adicionar a URL de staging às
   Redirect URLs permitidas do Auth (seção 8).
5. **[Feito na Etapa 3A]** Setar `NEXT_PUBLIC_PERMITIR_INDEXACAO=true` nas
   env vars do ambiente de **produção** apenas. Não setar em staging — o
   padrão (variável ausente) já bloqueia indexação. Importante: essa
   variável é lida em `app/robots.ts` (via `lib/ambiente.ts`), uma rota
   que o Next **pré-renderiza como estática no build** — confirmado
   empiricamente (`.next/server/app/robots.txt` não muda em runtime).
   Ou seja: a variável precisa estar presente **no momento do build**,
   não só no runtime do servidor — configurar na Vercel como env var de
   *build* (que também é a de runtime lá, mas o ponto crítico é que
   trocar essa variável depois de um deploy exige **novo build**, não
   basta reiniciar o processo.
6. Primeiro deploy de staging.
7. Rodar o checklist de validação (seção 14).
8. Só depois disso: decidir se/quando configurar Asaas sandbox e OpenPix
   em staging — isso é uma decisão separada, não uma dependência técnica
   do deploy em si.

## 14. Checklist de validação (pós-deploy)

- [ ] Build de produção (`next build`) passa sem erro no ambiente de
      hosting.
- [ ] `/entrar` carrega e faz login com uma conta de teste existente.
- [ ] Cadastro novo (`/criar-conta`) envia e-mail de confirmação com link
      apontando para a URL de staging (não para localhost nem para
      `zelopay.com.br`).
- [ ] `/auth/callback` troca o código por sessão e redireciona
      corretamente.
- [ ] `/app` carrega dados reais do Supabase (RLS funcionando — usuário só
      vê a própria empresa).
- [ ] `GET /api/webhooks/asaas` sem token configurado responde `503`
      (endpoint desabilitado com segurança, não com erro genérico).
- [ ] `robots.txt` de staging **não** permite indexação — `curl
      <url-de-staging>/robots.txt` deve devolver exatamente
      `User-Agent: *\nDisallow: /`. **[Mecanismo implementado na Etapa
      3A]**: garantido automaticamente contanto que
      `NEXT_PUBLIC_PERMITIR_INDEXACAO` **não** seja setada no build de
      staging — não requer nenhuma ação extra além de "não configurar
      essa variável lá".
- [ ] Nenhuma variável `NEXT_PUBLIC_*` expõe segredo (checar bundle do
      navegador — só devem aparecer `NEXT_PUBLIC_SUPABASE_URL`,
      `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`,
      `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_CLARITY_ID`,
      `NEXT_PUBLIC_PERMITIR_INDEXACAO` — nunca
      `SUPABASE_SERVICE_ROLE_KEY`, `ASAAS_API_KEY`,
      `ASAAS_CREDENTIALS_KEY` ou `ASAAS_WEBHOOK_TOKEN`).
- [ ] Testes E2E (`tests/e2e/`) rodando contra a URL de staging, não só
      contra `localhost:3210`.

## 15. Rollback

- **Deploy de staging com problema**: reverter para o deploy anterior na
  própria plataforma de hosting (Vercel e equivalentes mantêm histórico
  de deploys — rollback é nativo da plataforma, não precisa de ação no
  banco).
- **Banco**: como staging usa o mesmo projeto Supabase de hoje, **não há
  "rollback de banco" isolado de staging** — qualquer problema de dado
  afeta o único ambiente compartilhado. Esse é o principal argumento para
  considerar, no futuro, separar staging do banco de dev/teste manual
  (ver riscos, seção 15).
- **Env var errada**: reverter na própria plataforma de hosting (não
  requer novo deploy de código).
- **`ASAAS_CREDENTIALS_KEY` de staging perdida/trocada por engano**: as
  linhas cifradas com a chave antiga ficam permanentemente ilegíveis.
  Como a tabela está vazia hoje, o rollback é simplesmente gerar a chave
  de novo — sem dado a perder. Depois que houver subcontas reais em
  staging, isso deixa de ser trivial.

## 16. O que NÃO fazer enquanto OpenPix estiver em avaliação

- Não escrever nenhum código de integração com OpenPix ainda — o projeto
  hoje só tem Asaas implementado (`provider` na tabela `empresas` já
  suporta os dois valores via `CHECK`, mas só `asaas` tem código real).
- Não decidir a arquitetura de multi-provider (como alternar entre Asaas
  e OpenPix por empresa) antes da resposta do OpenPix — decidir isso cedo
  demais arrisca desenhar em torno de um contrato que pode não se
  confirmar.
- Não configurar staging para "esperar" por OpenPix de nenhuma forma
  especial — o deploy de staging não depende dessa decisão.
- Não expor a existência de dois providers na UI/copy do produto até que
  a integração de fato exista.

## 17. Critérios de GO para staging

Staging está pronto para uso quando **todos** os itens abaixo forem
verdadeiros (evidência, não suposição — mesmo padrão usado no GO/NO-GO de
produção da Fase 20):

1. Deploy acessível publicamente numa URL estável.
2. Todo o checklist da seção 14 marcado com evidência (não "deve
   funcionar" — testado de fato).
3. `robots.txt` de staging bloqueando indexação (`Disallow: /`,
   confirmado por `curl`, não só por leitura de código) — staging nunca
   deve aparecer no Google. Mecanismo: `NEXT_PUBLIC_PERMITIR_INDEXACAO`
   ausente no build de staging (ver seção 13, item 5).
4. Env vars de staging conferidas uma a uma contra a tabela da seção 5 —
   nenhuma apontando para produção (que ainda nem existe) nem vazando
   para o navegador.
5. `ASAAS_CREDENTIALS_KEY` de staging confirmada como **diferente** da
   usada em dev local (mesmo que ambas sejam "de teste" hoje — o hábito
   de nunca reaproveitar precisa começar agora, antes de haver dado real
   cifrado).
6. Time (o usuário) validou manualmente o fluxo de cadastro → confirmação
   de e-mail → login → `/app` na URL real de staging, não só em
   localhost.

**Não é critério de GO**: Asaas configurado, OpenPix decidido, domínio
próprio, SMTP customizado — nenhum desses bloqueia staging. Staging pode
(e deve) existir e ser útil antes de qualquer um deles estar resolvido.
