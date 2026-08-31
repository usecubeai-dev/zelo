# Zelo — arquitetura do sistema

Proposta técnica, 26/08/2026. **Nada aqui foi implementado.** Nenhuma tabela
criada, nenhuma rota escrita, nenhuma dependência instalada.

Documento vivo: quando a implementação começar, o que divergir daqui deve
ser corrigido aqui, não esquecido.

---

## 1. Auditoria do que existe

| item | estado |
|---|---|
| `app/` | 3 páginas (`/`, `/comecar`, API `/api/lead`) + `robots`/`sitemap`/`layout` |
| `lib/` | `analytics`, `asaas/config`, `cta`, `lead`, `lenis`, `scene`, `supabase`, `useReveal` |
| `components/` | 32 arquivos — praticamente tudo é da landing page |
| dependências | `gsap`, `lenis`, `next`, `react` — **nenhuma de backend** |
| middleware | **não existe** |
| Supabase | 1 tabela (`leads`), **0 usuários**, `pgcrypto` disponível, Postgres 17.6 |
| `Stage.tsx` + CSS | **4.900 linhas** — o peso da LP, e o que precisa ficar longe do app |

### O que se reaproveita

- **`lib/lead.ts`** — o padrão vale para todo o sistema: tipo + normalização
  + validação isomórfica, num módulo sem React. Clientes e cobranças devem
  ter o equivalente (`lib/cliente.ts`, `lib/cobranca.ts`).
- **`app/api/lead/route.ts`** — o formato da rota: revalidar no servidor,
  status HTTP honesto, erro genérico para fora e detalhe só no log.
- **`app/globals.css`** — tokens de cor e tipografia. O app deve herdar a
  identidade, não inventar outra.
- **`Commercial.module.css`** — vocabulário de botão, campo e grade.
- **`app/comecar/Comecar.module.css`** — o formulário já resolvido:
  `focus-visible`, erro, mobile, reduced motion.
- **`lib/analytics.ts`** — os três marcos do funil já separados.

### O que NÃO se reaproveita

`Stage.tsx`, `Stage.module.css`, `lib/scene.ts`, `useReveal`, `lenis`, GSAP.
São da peça cinematográfica. **Nada disso pode entrar no bundle do app** —
um painel de cobranças que carrega GSAP é um erro de arquitetura.

---

## 2. Onde o sistema mora

**Mesmo projeto Next, em route group separado.** Não um segundo app, não um
subdomínio (por enquanto).

```
app/
├── (site)/          ← landing page, congelada
├── (app)/           ← o sistema, atrás de login
└── api/
```

**Por que junto:** um deploy, uma sessão, sem CORS, sem duplicar tokens de
design. Para um time de uma pessoa, dois deploys é atrito diário.

**O risco de estar junto:** todo deploy do sistema republica a landing page
congelada. Mitigação: as sondas de `tools/` viram suíte de regressão
obrigatória antes de publicar.

**Por que o bundle não vaza:** no App Router cada rota carrega só o que
importa. GSAP entra em `/` porque `Stage.tsx` o importa; `(app)` não importa
nada disso. Precisa ser verificado por medição, não por confiança.

**Quando separar:** se o app ganhar área pública com SEO próprio, ou se o
time crescer a ponto de os deploys se atrapalharem. Não agora.

---

## 3. Banco de dados

### A decisão que define tudo: empresa como tenant

O produto atende "pequenos empreendedores **e** empresas maiores". Empresa
maior significa mais de uma pessoa na mesma conta.

Modelar `usuário → clientes` direto é o caminho curto hoje e uma migração
cara depois — com dados reais dentro. **Modelar `empresa` desde o primeiro
dia**, mesmo que toda empresa tenha exatamente um membro por enquanto, custa
uma tabela a mais agora e evita reescrever RLS, rotas e telas depois.

### Tabelas

```
auth.users            (Supabase, pronto)
   │
   ▼
membros ───────────► empresas ──────► clientes
(user_id, empresa_id)     │                │
                          ▼                ▼
                     cobrancas ◄───────────┘
                          │
                          ▼
                   cobranca_ciclos
```

**`empresas`** — o tenant e o assinante.
`id`, `nome`, `documento` (CNPJ/CPF, opcional), `criada_em`,
`trial_termina_em`, `assinatura_status` (`trial`/`ativa`/`inadimplente`/
`cancelada`), `asaas_customer_id`, `asaas_subscription_id`.

**`membros`** — quem entra na empresa. PK composta `(empresa_id, user_id)`.
`papel` (`dono`/`membro`). Hoje só `dono`; o campo evita migração depois.

**`clientes`** — quem paga o usuário.
`id`, `empresa_id`, `nome`, `email`, `whatsapp`, `documento`, `criado_em`,
`arquivado_em`. **Arquivar, nunca apagar** — cobrança paga não pode perder o
pagador.

**`cobrancas`** — o *acordo* recorrente, não a cobrança do mês.
`id`, `empresa_id`, `cliente_id`, `descricao`, `valor_centavos`,
`periodicidade` (`mensal` por ora), `dia_vencimento`, `status`
(`ativa`/`pausada`/`encerrada`), `inicia_em`, `criada_em`, `encerrada_em`.

**`cobranca_ciclos`** — cada mês, individualmente.
`id`, `cobranca_id`, **`empresa_id`**, `competencia` (date, dia 1),
`vence_em`, `valor_centavos`, `status` (`pendente`/`paga`/`cancelada`),
`pago_em`, `asaas_payment_id`. Único em `(cobranca_id, competencia)`.

**`eventos_asaas`** — idempotência de webhook.
`id`, `asaas_event_id` **unique**, `tipo`, `payload jsonb`, `recebido_em`,
`processado_em`, `erro`.

**`leads`** — já existe. Fica como está, isolada, sem `empresa_id`.

### Três regras não negociáveis

1. **Dinheiro é `integer` em centavos.** Nunca `float`, nunca `numeric` sem
   necessidade. `R$ 29,90` = `2990`.
2. **`empresa_id` em toda tabela do tenant**, inclusive em
   `cobranca_ciclos`, onde é derivável. Sem isso, a policy de RLS precisa de
   `join` — fica lenta e fácil de errar. Redundância aqui é segurança.
3. **`vencida` não é status, é consulta.** Um ciclo está vencido quando
   `status='pendente' and vence_em < current_date`. Guardar como status
   exigiria um cron para virar a chave todo dia à meia-noite, e um cron
   parado vira dado errado silencioso. Fica numa `view`.

### Quem cria os ciclos

Duas opções, e é decisão sua:

- **(A) Geração antecipada** — ao criar a cobrança, gerar os próximos N
  ciclos. Simples de consultar, previsível. Precisa de rotina para estender.
- **(B) Sob demanda** — o ciclo nasce quando o Asaas cobra. Sempre fiel ao
  que aconteceu, mas o "próximos vencimentos" vira cálculo.

**Recomendo (A) com N = 12**, e uma função que estende quando faltarem 3.
O usuário precisa ver o futuro; é isso que a tela promete.

---

## 4. Autenticação

**Supabase Auth, e-mail + senha**, com confirmação de e-mail e recuperação.

Magic link foi considerado e descartado: quem usa a ferramenta toda semana
não quer abrir o e-mail toda vez. OAuth Google pode entrar depois, sem
mudar nada do modelo.

**Dependências necessárias — as duas únicas do plano:**
`@supabase/supabase-js` e `@supabase/ssr`.

Isto é uma exceção consciente à regra de não instalar dependência: sessão
com cookie, refresh de token e leitura no servidor são criptografia e
protocolo. Escrever isso à mão é onde bugs viram vazamento.

### Três clientes Supabase, separados de propósito

| cliente | chave | onde | RLS |
|---|---|---|---|
| `supabaseBrowser()` | anon | componentes cliente | **sim** |
| `supabaseServer()` | anon + sessão do cookie | Server Components, rotas | **sim** |
| `supabaseAdmin()` | service_role | **só** leads e webhooks | **não** |

**Este é o ponto mais perigoso do projeto inteiro.** O `lib/supabase.ts` de
hoje usa service_role — chave que ignora RLS. Se o código do app começar a
importar esse módulo para ler dados de usuário, **todo o isolamento entre
empresas cai de uma vez, sem erro nenhum aparecer**.

Mitigação: renomear para `lib/supabase-admin.ts`, com o `throw` no cliente
que já existe, e uma regra escrita: *nenhuma tela importa admin*.

### Middleware

`middleware.ts` para renovar a sessão e proteger `(app)`. Precisa excluir
explicitamente `/api/webhooks/*` — webhook não tem sessão e não pode ser
redirecionado para login.

**Autorização nunca é só do middleware.** Ele é conveniência de UX; quem
garante é o RLS. Middleware furado com RLS certo = usuário vê tela vazia.
Middleware certo com RLS furado = usuário lê dados de outra empresa.

---

## 5. Rotas

**Públicas:** `/` · `/comecar` · `/entrar` · `/criar-conta` ·
`/recuperar-senha` · `/nova-senha` · `/termos` · `/privacidade`

**Autenticadas** (`(app)`, prefixo `/app`):
`/app` (dashboard) · `/app/clientes` · `/app/clientes/novo` ·
`/app/clientes/[id]` · `/app/cobrancas` · `/app/cobrancas/nova` ·
`/app/cobrancas/[id]` · `/app/configuracoes` · `/app/assinatura`

**API:** `/api/lead` (existe) · `/api/webhooks/asaas` (futuro)

Mutação de dados por **Server Actions**, não por rotas de API. Rota de API é
para quem vem de fora — hoje só o webhook.

### Conflito a resolver: o que é `/comecar`

Hoje `/comecar` captura lead. Quando o cadastro abrir, ela deveria criar
conta. São coisas diferentes e não podem ocupar a mesma URL.

Proposta: `/comecar` **vira a criação de conta**; a captura de lead se
aposenta no dia da virada. Todos os CTAs já apontam para lá — a troca é uma
página, não uma caçada por links.

---

## 6. Dashboard

Não é parede de gráfico. Quem abre isso é alguém que quer saber, em cinco
segundos, **o que está atrasado e quanto entra este mês**.

```
┌─────────────────────────────────────────────┐
│  A receber este mês    R$ 0,00              │  ← soma dos ciclos do mês
│  Recebido              R$ 0,00              │
│  Vencido               R$ 0,00   ⚠ 0        │  ← o número que puxa ação
├─────────────────────────────────────────────┤
│  VENCIDAS              [ver todas]          │  ← primeiro, sempre
│  PRÓXIMOS 7 DIAS                            │
│  ÚLTIMOS RECEBIMENTOS                       │
├─────────────────────────────────────────────┤
│  + Nova cobrança    + Novo cliente          │
└─────────────────────────────────────────────┘
```

**Estado vazio é tela de primeira sessão, não erro.** Todo usuário novo
começa nele; é a tela mais vista do produto e merece o mesmo cuidado do
hero: um caminho só, "cadastre seu primeiro cliente".

Cromática herdada: **verde = dinheiro que entrou**, **violeta = processo**,
vencido em âmbar (`--warn`), nunca vermelho de erro — atraso de cliente não
é falha do usuário.

---

## 7. Clientes

CRUD com arquivamento, nunca exclusão. Lista com busca por nome/e-mail.
Ficha mostra as cobranças e o histórico daquele cliente.

Sem duplicata boba: único em `(empresa_id, lower(email))` quando houver
e-mail. **A lição do `leads` vale aqui** — constraint em coluna, não índice
sobre expressão, senão upsert não funciona.

---

## 8. Cobranças

Criar = escolher cliente, valor, dia de vencimento, descrição. Uma tela, sem
assistente de várias etapas.

`/app/cobrancas` lista os **ciclos**, com filtro pendente/paga/vencida —
porque é disso que o usuário fala. `/app/cobrancas/[id]` mostra o acordo e
seu histórico de ciclos.

Ações: pausar, encerrar, **marcar como paga manualmente**. Esta última é
essencial antes do Asaas — sem ela o produto não serve para nada nas
primeiras semanas.

---

## 9. Período de 14 dias

`empresas.trial_termina_em = criada_em + interval '14 days'`, gravado na
criação.

Acesso liberado quando:
```
assinatura_status = 'ativa'
OR (assinatura_status = 'trial' AND trial_termina_em > now())
```

Numa função SQL `public.empresa_liberada(uuid)`, usada **no RLS e na
aplicação**. Uma definição só.

**O trial expirado não apaga nem esconde nada.** Bloqueia *criar* cobrança
nova; ler continua liberado. Quem perde acesso aos próprios dados não volta.

Regra: a data de expiração é **sempre** do servidor. Nunca do cliente, nunca
comparada no navegador para decidir acesso.

---

## 10. Futura integração Asaas

Fronteira: **a Zelo nunca toca em dado de cartão nem em chave no navegador.**
Tudo passa pelo servidor.

Dois usos, não confundir:

1. **A Zelo cobrando o usuário** (R$ 29,90/mês) — assinatura no Asaas,
   `asaas_subscription_id` em `empresas`.
2. **O usuário cobrando os clientes dele** (Pix Automático) — é o produto.

`lib/asaas/config.ts` já existe e já lê as env vars. Crescerá para
`lib/asaas/cliente.ts` (chamadas), `lib/asaas/tipos.ts`, `lib/asaas/webhook.ts`.

### Webhook

`app/api/webhooks/asaas/route.ts`, e três regras:

1. **Autenticar** pelo token de webhook do Asaas. Endpoint aberto é convite.
2. **Idempotência obrigatória** — `eventos_asaas.asaas_event_id` único.
   Provedor reenvia. Sem isso, um pagamento vira dois.
3. **Responder 200 rápido**, processar depois. Timeout vira retempestade de
   reenvio.

**Nunca confiar em valor que chega no payload.** Confirmar contra a API do
Asaas antes de marcar ciclo como pago.

---

## 11. Segurança e RLS

**RLS ligado em todas as tabelas. Sem exceção.**

Policy padrão de tenant:
```sql
create policy "membro da empresa" on public.<tabela>
for all to authenticated
using (exists (
  select 1 from public.membros m
  where m.empresa_id = <tabela>.empresa_id and m.user_id = auth.uid()
))
with check (exists (
  select 1 from public.membros m
  where m.empresa_id = <tabela>.empresa_id and m.user_id = auth.uid()
));
```

`with check` não é detalhe: sem ele o usuário lê só o dele mas **grava com
`empresa_id` de outro**.

- `membros`: usuário lê as próprias linhas.
- `empresas`: legível por membro; escrita só pelo `dono`.
- `leads` e `eventos_asaas`: RLS ligado, **zero policy** — só service_role.
- Índice em `membros(user_id, empresa_id)`: a policy roda em toda consulta.
- Toda função SQL com `set search_path = ''` — a lição do trigger de `leads`.
- Rodar o linter de segurança do Supabase depois de cada migração.

**CSP**: hoje está fora por causa dos scripts inline da cena. O `(app)` não
tem esse problema e **deve** ter CSP própria por rota.

---

## 12. Estrutura de pastas

```
app/
├── (site)/                     landing — congelada
│   ├── page.tsx
│   └── comecar/
├── (auth)/                     entrar, criar-conta, recuperar-senha
├── (app)/                      o sistema
│   ├── layout.tsx              exige sessão + navegação
│   └── app/
│       ├── page.tsx            dashboard
│       ├── clientes/
│       ├── cobrancas/
│       ├── configuracoes/
│       └── assinatura/
├── api/
│   ├── lead/route.ts
│   └── webhooks/asaas/route.ts
└── layout.tsx

lib/
├── supabase/
│   ├── browser.ts    anon, cliente
│   ├── server.ts     anon + sessão
│   └── admin.ts      service_role — leads e webhook, e mais nada
├── cliente.ts        contrato: tipo + normalizar + validar
├── cobranca.ts       idem, com dinheiro em centavos
├── empresa.ts        trial e assinatura
├── dinheiro.ts       centavos ↔ exibição, num lugar só
└── (lead, analytics, cta, asaas/ — já existem)

components/
├── (32 arquivos da landing — não mexer)
└── app/              componentes do sistema, isolados

middleware.ts
supabase/migrations/  SQL versionado, como docs/supabase-leads.sql
```

---

## 13. Ordem de implementação

Cada etapa termina funcionando e testada. Nenhuma depende de Asaas.

| # | etapa | entrega |
|---|---|---|
| 1 | Fundação | deps, 3 clientes Supabase, middleware, route groups |
| 2 | Banco + RLS | tabelas, policies, `empresa_liberada()`, linter limpo |
| 3 | Auth | criar conta (cria empresa + membro + trial), entrar, sair, recuperar senha |
| 4 | Casca do app | layout autenticado, navegação, estado vazio |
| 5 | Clientes | CRUD completo com arquivamento |
| 6 | Cobranças | criar acordo, gerar ciclos, listar, marcar paga manualmente |
| 7 | Dashboard | os números e as três listas |
| 8 | Trial | bloqueio de criação após 14 dias, aviso antes |
| 9 | `/comecar` | vira criação de conta |
| 10 | **Asaas** | etapa separada, só depois de tudo acima |

**A etapa 2 é a que não pode sair errada.** Migração de esquema com dados
reais dentro é o trabalho mais caro que existe.

---

## 14. Riscos e decisões

### Riscos técnicos

| risco | gravidade | mitigação |
|---|---|---|
| service_role vazar para o código do app | **crítico** | três clientes separados, `admin.ts` com nome explícito e `throw` no cliente |
| RLS sem `with check` | **crítico** | template de policy, teste com dois usuários antes de cada release |
| multi-tenant sem `empresa_id` | **alto** | modelar empresa agora |
| dinheiro em float | **alto** | `integer` centavos, `lib/dinheiro.ts` |
| trial validado no cliente | **alto** | função SQL, RLS |
| webhook sem idempotência | **alto** | `asaas_event_id` único |
| deploy do app quebrar a LP congelada | médio | sondas de `tools/` antes de publicar |
| GSAP vazar para o bundle do app | médio | medir o bundle, não confiar |
| e-mail de auth no SMTP padrão do Supabase | médio | SMTP próprio antes de abrir cadastro |

### Riscos de produto

**LGPD.** O sistema vai guardar dados dos clientes *dos seus clientes*. Isso
é tratamento de dado pessoal de terceiro, e hoje não existe política de
privacidade nem termos. **É bloqueio de lançamento, não de construção.**

**Sem Asaas, o produto não cobra.** Nas primeiras semanas ele é um
organizador de cobranças com baixa manual. Isso precisa estar claro para
quem entrar no trial, senão o teste de 14 dias queima a primeira leva de
usuários.

### Decisões que dependem de você

1. **Empresa como tenant desde já?** Recomendo sim.
2. **Geração dos ciclos: antecipada (12 meses) ou sob demanda?**
   Recomendo antecipada.
3. **`/comecar` vira criação de conta?** Recomendo sim.
4. **E-mail + senha, ou magic link?** Recomendo e-mail + senha.
5. **Instalar `@supabase/supabase-js` e `@supabase/ssr`?** Sem elas não há
   sessão segura.
6. **Nome da empresa no cadastro:** pedir no cadastro ou usar o nome da
   pessoa e deixar editar depois? Recomendo o segundo — menos atrito.
7. **Confirmação de e-mail obrigatória antes de entrar?** Segura o trial de
   e-mail falso, mas adiciona atrito. Recomendo obrigatória.
