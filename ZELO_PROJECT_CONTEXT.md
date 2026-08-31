# ZELO — CONTEXTO DO PROJETO

Consolidação do que está **estabelecido** sobre o Zelo. Cada item aqui veio
de uma decisão do proprietário nesta sessão ou de algo já construído e
testado no código — **nada foi inventado para preencher lacuna**. O que não
foi definido aparece explicitamente como pendente.

Companheiros deste documento:
- `ZELO_SYSTEM_ARCHITECTURE.md` — como o sistema é construído
- `ZELO_AUTONOMOUS_PLAN.md` — a fila de execução
- `PROJECT_STATUS.md` — o estado real, atualizado a cada fase

Em conflito entre documentos, **o código e o banco são a fonte da verdade**.

---

## 1. O que é a Zelo

SaaS de **cobrança recorrente automática via Pix Automático**.

O visitante precisa entender, sem estudar: existe um problema de cobrança
manual; a Zelo organiza isso; o cliente autoriza uma vez; a cobrança
acontece automaticamente; o dinheiro chega; a recorrência continua; o
prestador não precisa ficar cobrando.

**Mote da marca:** "Você trabalha. A Zelo cobra."

**Domínio:** zelopay.com.br

## 2. Público

**Foco principal:** pequenos empreendedores, autônomos e prestadores de
serviço que ainda cobram na mão.

**Mas a arquitetura não pode se limitar a eles.** O sistema deve suportar
pequenas empresas, empresas médias, operações maiores, múltiplos usuários e
múltiplos membros por empresa.

Mensagem central: **simples para começar, preparado para crescer.**

Perfis citados na página: academias, estúdios, clínicas, escolas e cursos,
profissionais autônomos, consultorias, agências, prestadores de serviço,
serviços de manutenção, clubes, associações, empresas de assinatura, SaaS,
negócios recorrentes.

## 3. Modelo comercial

| item | valor |
|---|---|
| preço | **R$ 29,90 por mês** |
| teste grátis | **14 dias** |
| modelo | SaaS por assinatura |
| pagamento da assinatura | **Asaas** (etapa futura) |

**Não existem outros planos, descontos ou cobrança anual autorizados.**

Fluxo comercial pretendido:
landing → cadastro → criação da conta → 14 dias grátis → dashboard →
cadastro de clientes → criação de cobranças → Asaas → cliente paga →
webhook → status atualizado → assinatura de R$ 29,90/mês após o teste.

## 4. Identidade visual

Preto/grafite profundo · branco · **violeta elétrico** · **verde
institucional**. Fintech premium, minimalista, tecnológica, sofisticada.

**Regra cromática, que vale também no sistema:**
- **violeta** = processo, tecnologia, automação, fluxo
- **verde** = resultado financeiro, pagamento, recebimento

O verde não domina a página. O violeta não domina todas as seções.

Evitar: neon excessivo, cyberpunk, gradiente genérico, glow demais,
dashboard decorativo, visual de template, excesso de cards.

Tokens em `app/globals.css`. Violeta: `#6C3BFF` `#8B5CFF` `#4520C9`
`#B59CFF`.

## 5. Áreas congeladas

Não alterar sem autorização explícita:

`Stage.tsx` · `Stage.module.css` · `lib/scene.ts` · BEAT · RITMO · câmera ·
coreografia · capítulos 1–5 · `JourneyProgress` · `SmoothScroll` · Lenis
global · Hero · CommercialProblem · HowItWorks · Automation.

A landing page está **congelada durante a construção do produto**. O
refinamento visual é uma etapa posterior e explícita.

## 6. Stack

Next.js 16 · React 19 · TypeScript · CSS Modules · Supabase (Postgres 17 +
Auth) · GSAP e Lenis **só na landing**.

Dependências instaladas e a razão de cada uma:
`gsap`, `lenis` (landing) · `@supabase/supabase-js`, `@supabase/ssr`
(sessão com cookie e refresh de token) · `puppeteer-core` (dev, sondas).

**Projeto Supabase:** `Zelo`, ref `krwzohklsqdysdrfkjcd`, região
`us-east-1`. **Nunca usar o banco do Akira nem de outro produto.**

## 7. Regras invioláveis

**Segurança**
- `SUPABASE_SERVICE_ROLE_KEY` **nunca** no navegador, nunca com prefixo
  `NEXT_PUBLIC_`. Só em `lib/supabase/admin.ts`, usado apenas por lead e
  webhook.
- Toda tabela do tenant tem `empresa_id` e RLS ligado.
- `empresa_id` **nunca** vem do formulário — sempre da sessão.
- Toda escrita tem `with check`, senão o usuário lê só o dele mas grava no
  dos outros.
- Toda entrada é validada **de novo no servidor**. A do navegador é
  conveniência.
- Um usuário jamais acessa dados de outra empresa. **Requisito crítico.**

**Dinheiro**
- Sempre `integer` em centavos. Nunca `float`.
- Operações financeiras idempotentes.
- Pagamento só é confirmado pelo backend/webhook, nunca pelo frontend.

**Dados**
- Não inventar: preço, CNPJ, razão social, endereço, e-mail empresarial,
  parceiros, bancos, certificações, compliance, métricas, depoimentos,
  clientes, credenciais, endpoints ou conteúdo jurídico.
- Faltando informação real: criar a estrutura e marcar como **BLOCKED**.

**Analytics** — os marcos são distintos e não se substituem:

| evento | significa |
|---|---|
| `signup_start` | começou a preencher |
| `lead_captured` | lead gravado no banco |
| `account_created` | conta e empresa existem |
| `trial_started` | os 14 dias começaram |
| `signup_complete` | conta criada **e** pessoa entrou |

Capturar lead **não é** concluir cadastro. Contar um pelo outro infla a
conversão e faz a decisão de tráfego sair de número falso.

## 8. Decisões de arquitetura já tomadas

| decisão | escolha | por quê |
|---|---|---|
| tenant | **empresa desde o dia 1** | atender empresas maiores exige mais de um usuário por conta |
| criação da empresa | **trigger em `auth.users`** | mesma transação do usuário; o cliente não pula a etapa |
| autenticação | **e-mail + senha** | quem usa toda semana não quer abrir o e-mail toda vez |
| onde o app mora | mesmo Next, route groups | um deploy, uma sessão, sem CORS |
| dinheiro | integer em centavos | float acumula erro e o total para de bater |
| `vencida` | **derivada**, não status | status exigiria cron; cron parado vira dado errado silencioso |
| trial | função SQL no RLS | expirado não cria; **ler continua liberado** |

## 9. Estado do produto

**Pronto e testado:** landing page · captura de lead · autenticação
completa · multiempresa com RLS · isolamento entre empresas verificado por
chamada direta à API · trial de 14 dias · dashboard · módulo de clientes.

**Em construção:** cobranças.

**Depois:** recorrência · Asaas · webhooks · assinatura · configurações ·
membros e permissões · auditoria de segurança · QA · refinamento visual.

## 10. Pendências do proprietário

| pendência | efeito |
|---|---|
| **SMTP dos e-mails de auth** | **bloqueia o lançamento**: o SMTP padrão do Supabase limita 2–3 e-mails/hora e o cadastro real falha |
| credenciais do Asaas | bloqueia pagamento e assinatura |
| CNPJ, razão social, e-mail empresarial | bloqueia rodapé, JSON-LD e documentos |
| arquivos da logo | `public/` não existe; trava header, rodapé e imagem de Open Graph |
| conteúdo de /termos e /privacidade | **LGPD**: o sistema guarda dados de terceiros e não há política publicada |

## 11. Como trabalhar neste projeto

1. Ler `PROJECT_STATUS.md` antes de qualquer alteração.
2. Inspecionar o código real — não confiar em relatório anterior.
3. Não reimplementar o que funciona.
4. Testar de verdade: compilar não é funcionar.
5. Testar isolamento **por chamada direta à API**, não pela interface.
6. Registrar o checkpoint em `PROJECT_STATUS.md`, sempre por acréscimo.
7. Bloqueio real: registrar e seguir para o que for independente.

**Claude Code e Codex trabalham no mesmo repositório.** Conferir data de
modificação antes de editar e não escrever em arquivo que a outra sessão
tocou há pouco.
