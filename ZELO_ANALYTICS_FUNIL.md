# Zelo — eventos de funil (Fase 23)

Documenta o que já existia (`lib/analytics.ts`, criado nas Fases 12/19) e
o que esta fase acrescentou. Nenhum evento foi duplicado — os dois novos
(`activation_completed`, `authorization_cta_click`) cobrem marcos que
nenhum evento existente representava.

## Eventos que disparam de verdade (client-side, GA4)

| Evento | Quando dispara | Onde |
|---|---|---|
| `cta_start` / `cta_demo` | clique nos CTAs da landing | `components/HeroPremium.tsx`, `ClosingCta.tsx`, `Pricing.tsx`, `SiteHeader.tsx` |
| `signup_start` | primeira interação com o formulário de `/comecar` | `app/comecar/ComecarForm.tsx` |
| `lead_captured` | lead gravado no Supabase | `app/comecar/ComecarForm.tsx` |
| `account_created` | conta + empresa nasceram (trigger de `auth.users`) | `app/(auth)/criar-conta/FormularioCadastro.tsx` |
| `trial_started` | os 30 dias começaram a contar | `app/(auth)/criar-conta/FormularioCadastro.tsx` |
| `signup_complete` | conta existe **e** a pessoa entrou (sessão ativa) | `app/(auth)/criar-conta/FormularioCadastro.tsx`, `app/(auth)/entrar/FormularioLogin.tsx` |
| `client_created` | POST bem-sucedido em `criarCliente` | `app/(app)/app/clientes/FormularioCliente.tsx` |
| `charge_created` | POST bem-sucedido em `criarCobranca` (avulsa) | `app/(app)/app/cobrancas/FormularioCobranca.tsx` |
| `recurring_charge_created` | POST bem-sucedido em `criarRecorrencia` | `app/(app)/app/recorrencias/FormularioRecorrencia.tsx` |
| `pix_authorization_started` | profissional gerou o QR/link de autorização | `app/(app)/app/recorrencias/AutorizacaoPix.tsx` |
| `pix_authorization_completed` | autorização chegou a `ACTIVE` (primeira vez que a tela mostra) | `app/(app)/app/recorrencias/AutorizacaoPix.tsx` |
| `onboarding_completed` | jornada completa de 9 passos chegou a 100% (uma vez por navegador) | `app/(app)/app/OnboardingCompletoTracker.tsx` |
| **`activation_completed`** ⟵ novo | os 3 passos de ativação rápida chegaram a 100% (uma vez por navegador) | `app/(app)/app/AtivacaoRapida.tsx` |
| **`authorization_cta_click`** ⟵ novo | clique no CTA "Conheça o Zelo" depois de uma autorização concluída | `app/autorizar/[id]/AutorizarCliente.tsx` |

## `primeiro` — parâmetro novo em `client_created`/`charge_created`

Os dois eventos já existiam e disparam em TODA criação, não só na
primeira. Para medir "primeiro cliente cadastrado"/"primeira cobrança
criada" sem duplicar o evento, `criarCliente`/`criarCobranca`
(`app/(app)/app/clientes/acoes.ts`, `.../cobrancas/acoes.ts`) agora
devolvem `primeiro: boolean` (conta a linha logo após inserir — `count <= 1`
é a primeira), e o componente passa isso como parâmetro do mesmo evento:
`track(EVENTOS.clientCreated, { primeiro: true })`. No GA4, filtrar por
`primeiro = true` dá exatamente o marco de funil, sem um evento a mais
para manter em sincronia com o existente.

## Qual evento representa "ativação"

`activation_completed` — dispara quando `lib/core/jornada-onboarding.ts`
(`ativacaoRapida`) confirma as 3 condições: existe cliente, existe
cobrança, e existe cobrança que já saiu do estado "pendente" (foi marcada
como enviada, paga, ou já sincronizada com o parceiro financeiro). É
deliberadamente mais estreito que `onboarding_completed` (9 passos,
inclui configuração financeira e Pix Automático) — mede "o profissional
viu o produto funcionar", não "o profissional terminou toda a
configuração".

## Eventos declarados, ainda não disparados (nascem de webhook, não de ação com resposta HTTP)

Já existiam antes desta fase, documentados em `lib/analytics.ts` para
fixar o nome definitivo sem fingir que já estão instrumentados:

- `first_charge_received` — confirmação de pagamento (webhook)
- `trial_expiring` / `trial_converted` / `trial_expired` — transições de
  estado do trial

Instrumentar estes exigiria GA4 Measurement Protocol (chamada
server-to-server, precisa de um API secret novo — fora do escopo desta
fase, que é só métricas + ativação + CTA).

## Como trial → pago e churn poderão ser calculados sem instrumentação nova

Não foi criado cálculo de LTV/CAC nem uma tabela de eventos de negócio
nova — o dado necessário **já existe e já é gravado de forma idempotente**
pelo webhook (`lib/asaas/webhook.ts`, `processarEventoAssinaturaPlataforma`,
que só age quando `assinatura_status` muda de verdade — reenvio do mesmo
estado é ignorado):

- `empresas.assinatura_status` (`trial` → `ativa` → `inadimplente`/`cancelada`) e `empresas.assinatura_atualizada_em` — o estado atual e quando mudou pela última vez.
- `log_acoes_financeiras` — toda transição real vira uma linha auditável (`assinatura_zelo_ativada`, `assinatura_zelo_inadimplente`, `assinatura_zelo_cancelada`), com `criado_em` — a granularidade de tempo que falta só em `empresas`.

**Trial convertido em pago** = primeira linha `assinatura_zelo_ativada`
de uma empresa cujo `assinatura_status` partiu de `trial` (não de
`inadimplente` — essa é reativação, não conversão). **Churn** = linha
`assinatura_zelo_cancelada` mais recente de cada empresa. **MRR** = soma
de `lib/plano.ts::PRECO_POR_PLANO_CENTAVOS[plano]` de toda empresa com
`assinatura_status = 'ativa'`, quando houver assinaturas suficientes para
o número fazer sentido.

Nenhuma dessas contas foi implementada agora (dado insuficiente para
validar — zero clientes pagantes reais até esta fase) — os eventos e
colunas necessários já existem e bastam para calcular isso depois, direto
em SQL contra `log_acoes_financeiras`/`empresas`, sem migration nova.
