# Zelo — Lançamento comercial (mensalidade, taxa por recebimento, indicação)

Documento operacional. O que existe, como funciona, o que falta para o
primeiro cliente real pagar. Sem segredos.

## Estratégia (decisão do dono)

- **Sem mês grátis.** A conta nasce `pendente` e só vira `ativa` quando o
  primeiro pagamento é **confirmado pelo Asaas** (webhook). Escolher plano
  não torna ninguém pagante.
- **Planos** (fonte única: `lib/plano.ts`, valores em centavos):

  | Plano | Mensalidade | Clientes | Cobranças/mês |
  |---|---|---|---|
  | Essencial | 2490 | 30 | 50 |
  | Profissional ("Mais escolhido") | 4990 | 100 | 200 |
  | Zelo Pro (chave interna `premium`) | 9990 | 300 | 600 |

  Limites são impostos pelo **banco** (`limite_de_clientes`,
  `limite_de_cobrancas_mensal`, triggers) — o TS só traduz a mensagem.
- **R$ 1,99 por recebimento** (`TAXA_DE_RECEBIMENTO_CENTAVOS = 199`): lógica
  real, tabela `taxas_recebimento`.
- **Influenciador**: 100% da **primeira** mensalidade do cliente indicado vira
  comissão. Da segunda em diante a mensalidade é do Zelo. A taxa de R$ 1,99
  nunca se mistura com a comissão.

## Três fluxos, três tabelas (nunca somados)

| Fluxo | Tabela | Nasce quando |
|---|---|---|
| Receita de assinatura | `mensalidades` | evento `PAYMENT_*` da conta **plataforma** do Asaas |
| Taxa por recebimento | `taxas_recebimento` | `PAYMENT_RECEIVED/CONFIRMED` de uma cobrança de **subconta** marcada como paga pelo webhook |
| Comissão | `comissoes` | primeira mensalidade paga de empresa com indicação |

## Fluxo do primeiro cliente pagante

1. Pessoa chega (opcionalmente por `…/criar-conta?ref=CODIGO`; o `proxy.ts`
   grava o cookie httpOnly `zelo_ref` por 90 dias).
2. Cria conta. O código vai também em `user_metadata.ref` (sobrevive a abrir
   o e-mail em outro aparelho). Conta nasce `pendente`.
3. Confirma o e-mail → `/auth/callback` vincula a empresa ao influenciador
   (`indicacoes`, UNIQUE por empresa — vínculo permanente) e leva a
   `/app/assinatura`.
4. Escolhe o plano + CPF/CNPJ → server action `assinarPlano` →
   `lib/core/assinatura-zelo.ts`: cria customer + assinatura **mensal** na
   conta plataforma do Asaas (`billingType UNDEFINED`: o cliente escolhe
   Pix/boleto/cartão) e devolve o link de pagamento. O preço vem do servidor.
5. Cliente paga → Asaas envia `PAYMENT_CONFIRMED/RECEIVED` →
   `processarEventoWebhook` → `registrar_mensalidade` (SQL, atômica) →
   `assinatura_status = ativa`; se for a primeira e houver indicação, cria a
   comissão `pendente`.
6. Admin vê em `/app/admin/influenciadores`, **libera** e depois marca como
   **paga** (registro administrativo — o Zelo **não** movimenta dinheiro).

## Estados da assinatura (`empresas.assinatura_status`)

`pendente` (escolheu plano, não pagou) · `ativa` · `inadimplente` ·
`cancelada` · `suspensa` (definido; nada o produz ainda) · `trial` (**legado**:
contas antigas mantêm o prazo que já tinham; ninguém novo entra em `trial`).
Transições em `lib/core/assinatura.ts`; só o provedor (webhook) leva a
`ativa`/`inadimplente`/`cancelada`.

## Proteções (MVP)

- Idempotência: `eventos_asaas.asaas_event_id` único + `UNIQUE` em
  `mensalidades.asaas_payment_id`, `taxas_recebimento.cobranca_id`,
  `comissoes.indicacao_id` e `comissoes.mensalidade_id`; índice único parcial
  `mensalidades (empresa_id) where eh_primeira`.
- Concorrência: `registrar_mensalidade` trava a linha da empresa
  (`for update`) — três eventos simultâneos geram **uma** primeira
  mensalidade e **uma** comissão (testado).
- Auto-indicação bloqueada (e-mail/usuário do influenciador). Indicação só
  vale **antes** do primeiro pagamento. Influenciador inativo não recebe novas.
- Cancelou antes de pagar → sem comissão. Estorno antes de pagar o
  influenciador → comissão `cancelada`; depois → fica `paga` com
  `estorno_apos_pagamento = true` para o admin tratar.
- Tabelas novas: RLS ligado, **sem policy e sem grant** para anon/authenticated
  (exceção: o dono lê as próprias `mensalidades`). Funções SQL só executam
  para `service_role`.
- Teste (sandbox) nunca vira dinheiro: toda linha leva `ambiente`
  (`sandbox`/`production`); os totais do painel só somam `production`.

## Banco — migrations

| Arquivo | Situação |
|---|---|
| `20261004000000_assinatura_taxa_indicacao.sql` | **Aplicada** (aditiva; o app antigo a ignora) |
| `20261004000100_fim_do_trial.sql` | **Aplicada em 05/10/2026.** Default `pendente`; as contas `trial` existentes não foram alteradas. |
| `20261005000000_taxas_a_cobrar.sql` | **Aplicada.** Infraestrutura da cobrança posterior da taxa (`taxas_a_cobrar`, `marcar_taxas_faturadas`). |

## Administrador

`administradores_zelo` (só `service_role` lê). A conta do dono
(`usecube.ai@gmail.com`) foi inserida. Outras: `insert into
public.administradores_zelo (user_id) values ('<uuid do auth.users>')`.
Ser dono de uma empresa **não** dá acesso ao painel.

## Variáveis de ambiente (apenas PRESENTE/AUSENTE; valores nunca aqui)

| Variável | Para quê | Local | Produção (Vercel — último estado conhecido; a API não lista) |
|---|---|---|---|
| `ASAAS_API_KEY` | criar customer/assinatura | PRESENTE (sandbox) | PRESENTE (produção) — confirmado antes |
| `ASAAS_WEBHOOK_TOKEN` | autenticar o webhook | PRESENTE | PRESENTE |
| `ASAAS_PLATFORM_ACCOUNT_ID` | UUID da conta Zelo no Asaas | PRESENTE (sandbox) | **AUSENTE — ver abaixo** |
| `RESEND_API_KEY` + `EMAIL_FROM` | e-mails transacionais (obrigatórias as duas) | PRESENTE | **AUSENTE** |
| `EMAIL_REPLY_TO` | Reply-To (opcional) | PRESENTE | AUSENTE |
| `CRON_SECRET` | cron de cobranças | PRESENTE | PRESENTE |

**`ASAAS_PLATFORM_ACCOUNT_ID` em produção não é mais bloqueio.** Sem a
variável, o webhook resolve a mensalidade pela **posse** do `customer`/
`subscription` que o checkout gravou na empresa (mesmo critério dos eventos
de autorização Pix: linha que só o Zelo cria). Customer desconhecido continua
recusado. **Além da posse, o evento é provado na conta do Zelo:** o pagamento
(ou a assinatura) é consultado no Asaas com a chave da PLATAFORMA — que só
enxerga objetos da nossa conta — e o `customer` devolvido precisa bater com o
do evento. Evento de outra conta que cite um customer nosso não existe aqui e
é recusado (422); se o Asaas estiver fora do ar na verificação, responde 503
para o Asaas reenviar (nada é gravado). Quando o primeiro evento real chegar, o `account.id` aparece no log
(`evento da plataforma resolvido pela posse…`); cadastrar essa variável na
Vercel volta ao modo estrito.

## Dados de teste

`npx tsx tools/limpar-dados-de-teste.ts` (dry-run; `--executar` apaga). Só
toca contas `@zelo.test` (domínio reservado, usado por todos os testes) e
recusa-se se houver admin, mensalidade paga em produção ou comissão paga entre
elas. Estado na criação deste documento: 35 contas `@zelo.test`, 31 empresas,
485 clientes, 7 cobranças, 11 recorrências, 4 autorizações Pix. As 4 contas
restantes (gmail/zelo.dev) **não** são tocadas.

## Testes

- `npx tsx tools/teste-lancamento-comercial.ts` — preços/limites, checkout
  (validações + **Asaas sandbox real**), indicação, mensalidade, comissão,
  taxa de R$ 1,99, idempotência, concorrência, RLS/grants, isolamento.
- `npx tsx tools/teste-assinatura-fase15.ts` — transições e webhook da
  plataforma.
- `npx playwright test` — E2E (contas de teste saem `ativa`; o spec de
  assinatura cria `pendente`).

A **confirmação do pagamento** nesses testes é simulada (nenhum dinheiro real
se move); todo o resto (banco, RLS, funções, chamadas ao sandbox) é real.

## Limitações conhecidas

- Taxa de R$ 1,99: está **registrada** por recebimento (idempotente) e o painel
  admin mostra quanto cada profissional deve (só produção) e permite marcar o
  que já foi cobrado por fora. **Não há débito automático**: o caminho mais
  simples e automático seria o split do Asaas (`fixedValue` de R$ 1,99 a cada
  cobrança criada na subconta, para a carteira do Zelo), mas ele muda todas as
  cobranças dos profissionais, depende do wallet id do Zelo e de confirmação
  de que vale também para Pix Automático — não foi improvisado. Se uma gravação
  falhar de forma transitória, o evento não é reprocessado (mesma limitação do
  restante do webhook): vale uma reconciliação periódica de `cobrancas` pagas
  sem linha em `taxas_recebimento`.
- Troca de plano com assinatura **ativa** e cancelamento self-service não
  existem (não foram pedidos; a tela não os promete).
- O webhook do Asaas **sandbox** aponta para a URL pública de produção; não há
  ambiente de staging.
