# ZELO — Bloco 1A: Domínio + Deploy

Execução do Bloco 1A de [ZELO_PRODUCTION_READINESS_RUNBOOK.md](ZELO_PRODUCTION_READINESS_RUNBOOK.md). Auditoria e documentação apenas — nenhum DNS, código, banco, CSS, provider ou credencial foi alterado para produzir este documento. Nenhum commit, nenhum deploy.

---

## 1. Domínio — `zelopay.com.br`

**Método**: consultado agora, ao vivo, contra **três resolvedores DNS independentes** (o resolvedor local da rede, Google `8.8.8.8`, Cloudflare `1.1.1.1`) — pra descartar que o problema fosse um resolvedor local com cache ruim, não o domínio em si.

| Consulta | Resolvedor | Resultado |
|---|---|---|
| `zelopay.com.br` (A) | local | `Non-existent domain` |
| `zelopay.com.br` (A) | `8.8.8.8` (Google) | `Non-existent domain` |
| `zelopay.com.br` (A) | `1.1.1.1` (Cloudflare) | `Non-existent domain` |
| `www.zelopay.com.br` | local | `Non-existent domain` |
| `zelopay.com.br` (NS) | local | `Non-existent domain` |
| `zelopay.com.br` (MX) | local | `Non-existent domain` |
| `zelopay.com.br` (TXT) | local | `Non-existent domain` |

**Confirma**:
- **Não resolve** — nenhum tipo de registro existe (nem A, nem NS, nem MX, nem TXT). `NXDOMAIN` em três resolvedores públicos diferentes descarta cache local como causa.
- **`www` também não resolve** — mesmo resultado.
- **Nenhum registro relevante existe hoje** (nenhum MX, nenhum TXT de verificação, nenhuma delegação de NS visível).
- **HTTPS**: impossível testar (`curl -I https://zelopay.com.br` não tem pra onde conectar sem DNS) — não é "HTTPS mal configurado", é "não há destino nenhum ainda".

**Inconsistência encontrada**: nenhuma além da ausência total — não há sinal de configuração parcial (ex.: NS delegado mas zona vazia). O padrão de resposta (`NXDOMAIN` em toda consulta, inclusive NS) é consistente com **um destes dois cenários**, que só o proprietário consegue distinguir checando o painel do registrador:
  (a) o domínio nunca foi registrado; ou
  (b) foi registrado mas nunca teve nameserver configurado no registrador.
Tentei uma checagem pública de WHOIS (registro.br) para diferenciar os dois cenários à distância — a ferramenta deles roda via formulário client-side e não devolveu conteúdo por fetch automatizado; não é possível confirmar qual dos dois cenários é o real sem acesso à conta do registrador.

### Ação necessária (proprietário)

| O quê | Onde | Como validar depois |
|---|---|---|
| Confirmar se `zelopay.com.br` está registrado, e com qual registrador | Painel do registrador (Registro.br, se `.com.br`) | Login na conta do registrador mostra o domínio na lista |
| Se não registrado: registrar o domínio | Registro.br (ou revendedor) | Aparece como "ativo" no painel |
| Depois de criar o projeto na Vercel (seção 2 abaixo) e adicionar o domínio lá: copiar o(s) registro(s) exato(s) que a Vercel exibe e cadastrar no DNS do registrador | Painel de DNS do registrador — normalmente registro `A` pro domínio raiz (apex) e `CNAME` pra `www`, mas o valor exato só a tela da Vercel mostra, não deve ser adivinhado agora | `nslookup zelopay.com.br` e `nslookup www.zelopay.com.br` devolvendo IP/CNAME, de uma rede diferente da que criou o registro (evita falso-positivo por cache) |
| Decidir a forma canônica (`zelopay.com.br` vs `www.zelopay.com.br`) | Configuração de domínio dentro do projeto Vercel, depois do DNS propagar | `curl -I` no não-canônico devolve `301`/`308` pro canônico |

**Não é possível avançar o registro de DNS nesta rodada** — depende de acesso à conta do registrador, que é externo a este ambiente.

---

## 2. Deploy — preparação (sem publicar)

**Repositório Git**: `https://github.com/usecubeai-dev/zelo.git`, branch atual `main` — confirmado via `git remote -v`.

**Framework**: Next.js, confirmado em `package.json` → `"next": "16.3.1"`. App Router (confirmado pela estrutura `app/`), Turbopack como bundler de dev/build.

**Build command**: `next build` (script `build` em `package.json`) — padrão, nenhuma customização. Confirmado rodando limpo nesta sessão (build anterior, exit 0, 36 rotas).

**Output**: nenhum `output` customizado em `next.config.ts` (sem `output: "export"`, sem `output: "standalone"`) — usa o adaptador padrão de servidor do Next, que é exatamente o que a Vercel espera pra rodar Server Actions e API Routes como funções, não como export estático. Se algum dia alguém setar `output: "export"` aqui, isso quebraria `app/api/webhooks/asaas` e todas as Server Actions — vale saber que essa é uma armadilha a evitar, não algo que existe hoje.

**Node necessário**: `package.json` **não tem campo `engines`** — não há uma versão de Node pinada explicitamente pro build. O ambiente local roda Node `v24.18.0`. Sem `engines`, a Vercel usa a versão padrão dela pro projeto (configurável no painel do projeto, Settings → General → Node.js Version) — **isso precisa ser conferido/escolhido explicitamente no painel da Vercel ao criar o projeto**, não fica implícito no código.

**Variáveis de ambiente esperadas pelo build**: nenhuma é exigida só para o `next build` **completar** (o build já roda limpo localmente sem nenhuma variável de Asaas/Analytics — todas essas degradam graciosamente, confirmado em sessões anteriores). As variáveis do Supabase (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) não bloqueiam o build em si, mas são necessárias pra qualquer página autenticada **funcionar em runtime** — lista completa na seção 4.

**Compatibilidade com Server Actions**: total. Nenhum `output: "export"`, nenhuma rota usa `"use server"` de um jeito incompatível com o runtime de função da Vercel — confirmado por leitura de todas as Server Actions do projeto (`app/(app)/app/*/acoes.ts`, `app/auth/callback/route.ts`, `app/api/*/route.ts`) ao longo desta sessão. A Vercel é a mantenedora do Next.js — Server Actions rodam nativamente, sem configuração extra.

**Comportamento de Preview Deployments** (nativo da Vercel, nenhuma configuração de código necessária):
- Todo push numa branch que não é `main`, ou toda Pull Request, gera automaticamente um deploy próprio numa URL efêmera (`https://<projeto>-<hash>-<time>.vercel.app`).
- Cada Preview Deployment usa as variáveis de ambiente marcadas como "Preview" no painel da Vercel — **isso é o mecanismo real** que vai permitir o Preview apontar pro Supabase/Asaas de staging sem tocar nas variáveis de Production.
- Push em `main` → deploy de Production, no domínio real (quando o domínio existir), usando as variáveis marcadas "Production".

**O que falta pra isso existir de fato** (nenhuma dessas ações foi tomada nesta rodada — só preparadas/documentadas):
1. Criar conta/organização na Vercel.
2. Conectar o repositório GitHub (`usecubeai-dev/zelo`) via OAuth/GitHub App da Vercel.
3. Escolher a versão de Node no painel do projeto.
4. Cadastrar as variáveis de ambiente (seção 4) separadas por Production/Preview — **nenhuma credencial real deve ser cadastrada nesta rodada**, conforme instrução.
5. **Não clicar em nada que dispare um deploy de produção** até o Bloco seguinte do runbook.

---

## 3. Staging — como o primeiro ambiente deve funcionar

Sem criar nada agora — só a definição exata de quem faz o quê:

| Ação necessária | Quem executa | Como validar |
|---|---|---|
| Criar/confirmar o repositório conectado à Vercel | Proprietário | Projeto aparece no dashboard da Vercel, apontando pro repo certo |
| Decidir a branch/estratégia que vai gerar o Preview usado como staging (ex.: uma branch `staging` fixa, ou simplesmente qualquer PR aberto contra `main`) | Proprietário | Branch escolhida documentada e usada de forma consistente |
| Confirmar que o projeto Supabase atual (`krwzohklsqdysdrfkjcd`) é o que vai servir de staging (decisão já registrada em `STAGING_EXECUTION_PLAN.md`) | Proprietário (confirmação, não ação técnica nova) | Nenhuma — já é o único projeto existente |
| Cadastrar as variáveis de ambiente de **staging** no painel da Vercel, ambiente "Preview" (ver tabela da seção 4 — sem preencher valor de credencial real nesta rodada, só criar a variável quando o proprietário tiver o valor em mãos) | Proprietário | `vercel env ls` (CLI) ou a própria tela do painel lista as variáveis cadastradas em Preview |
| Gerar um `ASAAS_CREDENTIALS_KEY` **próprio** de staging (`openssl rand -base64 32`) — diferente do que produção usará no futuro | Proprietário | Comparar visualmente que os dois valores (staging vs. produção, quando produção existir) são diferentes |
| Confirmar que `NEXT_PUBLIC_PERMITIR_INDEXACAO` **não** é setada no ambiente Preview | Proprietário | `curl <url-de-preview>/robots.txt` devolve `Disallow: /` depois do primeiro deploy de preview |
| Primeiro deploy de Preview (só depois que as variáveis mínimas de Supabase estiverem cadastradas) | Proprietário (ou Claude, se autorizado num bloco futuro) | URL de preview carrega a landing sem erro 500 |

**Nada disso foi executado nesta rodada** — a tabela acima é a definição de "o que precisa acontecer e quem faz", não um registro de ações já tomadas.

---

## 4. Variáveis de ambiente

Só variáveis **encontradas de fato no projeto** (`.env.example`, `lib/asaas/config.ts`, `lib/supabase/*`, `lib/asaas/credenciais.ts`, `app/layout.tsx`, `lib/ambiente.ts`) — nenhuma inventada.

| Variável | Staging | Produção | Pública? | Obrigatória? |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | projeto atual (`krwzohklsqdysdrfkjcd`) | projeto novo (a criar) | Sim (protegida por RLS, não por sigilo) | Sim |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | do projeto atual | do projeto novo | Sim | Sim |
| `SUPABASE_URL` | mesmo valor do `NEXT_PUBLIC_SUPABASE_URL` de staging | mesmo valor do de produção | **Não** | Sim |
| `SUPABASE_SERVICE_ROLE_KEY` | do projeto atual | do projeto novo | **Não — nunca** | Sim |
| `ASAAS_API_KEY` | credencial sandbox | credencial de produção real | **Não** | Sim (sem ela, `isConfigured=false`, sistema opera em modo de baixa manual) |
| `ASAAS_ENV` | `sandbox` | `production` | Sim (não é segredo, só uma flag) | Sim |
| `ASAAS_WEBHOOK_TOKEN` | próprio de staging | próprio de produção | **Não** | Sim (sem ela, webhook responde 503) |
| `ASAAS_PLATFORM_ACCOUNT_ID` | conta sandbox | conta de produção | **Não** (é um identificador, não um segredo, mas não tem motivo de expor) | Sim |
| `ASAAS_CREDENTIALS_KEY` | própria de staging, gerada agora | própria de produção, gerada separadamente | **Não** | Sim |
| `NEXT_PUBLIC_SITE_URL` | URL do Preview Deployment | `https://zelopay.com.br` | Sim | Não (cai num fallback hardcoded se ausente — mas o fallback aponta pro domínio de produção, então **deveria** ser setada em staging pra não anunciar a URL errada) |
| `NEXT_PUBLIC_PERMITIR_INDEXACAO` | **ausente** (nunca `true`) | `true` | Sim | Não (padrão seguro se ausente) |
| `NEXT_PUBLIC_GA_ID` | opcional, normalmente ausente em staging | opcional | Sim | Não |
| `NEXT_PUBLIC_CLARITY_ID` | opcional, normalmente ausente em staging | opcional | Sim | Não |
| `CHROME_PATH` | não usado em deploy (só ferramenta de dev local, `tools/marca.mjs`) | não usado em deploy | N/A | Não |

**Nenhuma dessas variáveis foi criada, alterada ou cadastrada em nenhum painel nesta rodada** — a tabela é só o levantamento do que existe no código.

---

## 5. Critério de conclusão

- **DOMÍNIO**: ❌ — não resolve em nenhum dos três resolvedores testados; nenhum registro DNS de nenhum tipo existe hoje. Ação externa obrigatória antes de qualquer avanço nesta frente.
- **DEPLOY**: ⚠️ — projeto totalmente compatível e pronto pra ser conectado (Next 16, sem `output` incompatível, sem bloqueio de Server Actions, build limpo confirmado), mas **nenhum projeto Vercel existe ainda** — falta a ação externa de criar a conta/projeto e conectar o Git.
- **STAGING**: ⚠️ — arquitetura e responsabilidades totalmente definidas (reaproveita o Supabase atual, usa Preview Deployment da Vercel), mas depende inteiramente do DEPLOY acontecer primeiro — nenhuma variável foi cadastrada, nenhum deploy de preview existe ainda.
- **VARIÁVEIS**: ✅ — levantamento completo e correto feito; nenhuma ação de cadastro foi tomada nesta rodada (fora do escopo deste bloco), mas o inventário em si está pronto pra ser usado no próximo passo.

### Ações externas que o proprietário precisa executar manualmente

1. **Confirmar no painel do registrador** se `zelopay.com.br` está registrado (e com quem) — sem isso, nada mais na frente de domínio avança.
2. **Registrar o domínio**, se ainda não estiver.
3. **Criar conta/organização na Vercel** e conectar o repositório `usecubeai-dev/zelo`.
4. **Escolher a versão de Node** no painel do projeto Vercel (não há valor pinado no código).
5. **Depois** de o projeto Vercel existir: copiar o(s) registro(s) DNS exato(s) que a Vercel exibe pra `zelopay.com.br`/`www` e cadastrar no DNS do registrador.
6. **Gerar um `ASAAS_CREDENTIALS_KEY` próprio de staging** (`openssl rand -base64 32`) e guardar em local seguro, pronto pra cadastrar como variável de ambiente quando o Bloco seguinte autorizar isso.
7. Validar propagação de DNS (`nslookup`, de uma rede diferente) e HTTPS (`curl -I`) só depois dos passos 1-5 concluídos.

Nenhuma outra tarefa foi realizada nesta rodada, conforme escopo solicitado.
