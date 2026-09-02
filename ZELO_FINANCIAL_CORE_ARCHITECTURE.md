# ZELO — Arquitetura do Core Financeiro

Documento de arquitetura, não de implementação. Nada aqui foi codificado.
Escrito em 31/08/2026, contra o estado real do repositório (auditado por
leitura direta de código, não por confiar na documentação anterior) e
contra a documentação oficial do Asaas, consultada nos pontos indicados.

**Convenção de sinalização usada neste documento:**
- 🟢 já existe e serve como está
- 🟡 existe, precisa adaptação
- 🔴 não existe, precisa ser criado
- ⚠️ **BLOQUEADO POR DOCUMENTAÇÃO** — depende de confirmação oficial do
  Asaas que não foi possível obter nesta pesquisa; a decisão abaixo é
  provisória e não deve ser implementada sem essa confirmação

---

## 1. Visão geral

Hoje a Zelo é dois sistemas que não se falam: um CRM de cobrança (sólido,
testado, multi-tenant) e uma biblioteca de integração com o Asaas
(também sólida, mas nunca chamada por nenhum botão). O core financeiro é
a camada que liga os dois — e ela precisa ser desenhada como um sistema
financeiro, não como uma chamada de API a mais.

Três decisões de fundo orientam tudo abaixo:

1. **O banco é a fonte da verdade do estado interno; o webhook é a fonte
   da verdade do estado externo.** Nenhuma Server Action marca uma
   cobrança como paga — só o webhook faz isso, e só depois de idempotência
   confirmada. Isso já é verdade hoje para pagamentos automáticos; falta
   estender a mesma disciplina para autorização e recorrência.
2. **Toda operação financeira tem um dono e um IDs externo rastreável.**
   Nenhum registro do lado Zelo fica "acreditando" no Asaas sem guardar o
   identificador que permite perguntar de novo.
3. **Falha parcial é o caso comum, não a exceção.** Toda etapa que grava
   dos dois lados (Zelo e Asaas) precisa sobreviver a "criou lá, não
   salvou aqui" sem duplicar nem perder a cobrança.

---

## 2. Arquitetura de camadas

Hoje: `app/(app)/app/*/acoes.ts` chama `supabaseServer()` direto. Não há
nenhum "Server Action de produto" chamando `lib/asaas/*` — são dois
mundos paralelos, o que coincidentemente já resolve a "regra" de não
espalhar chamadas Asaas pela UI, porque **hoje não há nenhuma**. O
problema é o oposto do enunciado: falta a camada, não sobra.

Proposta, 4 camadas, todas dentro do monólito Next.js (sem serviço novo):

```
UI (app/(app)/app/**/*.tsx, FormularioX.tsx)
  ↓ chama
Casos de uso (lib/core/*.ts)          [NOVO]
  orquestra: valida → grava estado local → chama gateway → trata falha
  ↓ chama
Domínio (lib/cobranca.ts, lib/recorrencia.ts, lib/autorizacao.ts)
  regras puras, sem I/O — já existe o padrão, só falta autorizacao.ts
  ↓ chama
Infraestrutura (lib/asaas/*.ts, lib/supabase/*.ts)
  fala com o mundo externo — já existe, quase pronto
```

**Regra de dependência:** Server Action nunca importa `lib/asaas/*`
diretamente. Ela importa um caso de uso de `lib/core/*`, que decide se e
quando fala com o Asaas. Isso é o que falta hoje — não existe
`lib/core/`.

**O que já está pronto e não muda:** `lib/asaas/cliente-api.ts`
(transporte HTTP), `lib/asaas/credenciais.ts` (cifra), `lib/supabase/*`
(3 clientes separados por privilégio). São a camada de infraestrutura,
e já seguem exatamente a separação que este documento propõe.

---

## 3. Modelo de domínio

| entidade | existe? | onde | completa? | relação com tenant | relação com Asaas |
|---|---|---|---|---|---|
| Empresa | 🟢 | `empresas` | sim, mas sem dados fiscais/bancários | é o tenant | `asaas_account_id`, `asaas_wallet_id`, `provider_*` |
| Membro | 🟢 | `membros` | sim | usuário↔empresa | — |
| Cliente | 🟢 | `clientes` | sim | `empresa_id` | 🔴 sem `asaas_customer_id` |
| Cobrança | 🟢 | `cobrancas` | 🟡 sem estados de autorização/Pix | `empresa_id` | tem `asaas_payment_id`, nunca preenchido |
| Recorrência | 🟢 | `recorrencias` | 🟡 sem vínculo a autorização | `empresa_id` | tem `asaas_subscription_id`, nunca preenchido |
| **Autorização Pix Automático** | 🔴 | — | não existe | precisa `empresa_id` | é o conceito central que falta modelar |
| Pagamento (evento) | 🟡 | embutido em `cobrancas.pago_em`/`valor_pago_centavos` | fusão indevida — ver §3.1 | via cobrança | `eventos_asaas.payload` guarda o bruto |
| Assinatura (da Zelo, não do tenant) | 🟢 | `empresas.assinatura_status` + `lib/core/assinatura.ts` (Fase 15) | domínio modelado (transições/origem), sem tabela própria (decisão mantida: 1:1 com a empresa) | é a própria empresa | `asaas_customer_id`/`asaas_subscription_id` já na tabela; billing provider ainda não configurado (`ASAAS_API_KEY` ausente) |
| Conta/subconta Asaas | 🟡 | campos em `empresas` + `asaas_credenciais` | schema pronto, **nunca escrito** | 1:1 com empresa | é o vínculo em si |
| Credenciais | 🟢 | `asaas_credenciais` | sim, cifrada, RLS sem policy | `empresa_id` único | guarda a apiKey da subconta |
| Eventos (webhook) | 🟢 | `eventos_asaas` | sim | `empresa_id` nullable (plataforma vs. tenant) | `asaas_event_id` único |
| Tentativa de sincronização | 🔴 | — | não existe | precisa `empresa_id` | necessário para retry (§11) |
| Falha | 🔴 | — | não existe | — | necessário para observabilidade (§17) |
| Auditoria | 🟡 | `eventos_asaas` cobre só webhook | não cobre ações do usuário nem chamadas de saída | — | — |

### 3.1 — Achado que muda o desenho: `Cobrança` está fazendo o papel de duas entidades

`cobrancas.status` hoje é `pendente | enviada | paga | cancelada` — é a
cobrança **como registro de intenção**, e ao mesmo tempo o único lugar
onde o pagamento aparece (`pago_em`, `valor_pago_centavos`). No mundo do
Pix Automático isso quebra, porque uma cobrança passa por estados que não
são sobre o dinheiro em si — são sobre a **autorização** (o cliente
consentiu?) e sobre a **instrução de pagamento** (o Asaas aceitou
processar aquele ciclo?). Misturar os três num campo `status` só produz
estado ambíguo — "pendente" hoje significa "ainda não venceu" e teria que
passar a significar também "aguardando o cliente autorizar", que são
coisas completamente diferentes para o usuário entender.

**Decisão:** separar em três objetos que se relacionam, não um só
inflado. Detalhado em §5.

---

## 4. Mapa de identificadores

Regra fixa: **nenhuma correspondência por nome/texto.** Toda entidade que
tem par no Asaas guarda o ID dele, nunca infere pelo nome do cliente ou
pela descrição da cobrança.

| entidade Zelo | campo do ID externo | status externo | último sync | metadata | origem |
|---|---|---|---|---|---|
| Empresa | `asaas_account_id` (🟢 já existe) | `asaas_status` (🟢) | 🔴 falta `asaas_sincronizado_em` | 🔴 falta | 🔴 falta `provider_origem` (manual vs. onboarding) |
| Cliente | 🔴 falta `asaas_customer_id` | 🔴 falta `asaas_sincronizado` (bool ou enum) | 🔴 falta `asaas_sincronizado_em` | não necessário | — |
| Cobrança | `asaas_payment_id` (🟢 já existe, nunca escrito) | 🔴 falta — hoje `status` mistura os dois mundos (ver §3.1) | 🔴 falta | 🔴 falta (ex.: motivo de recusa) | — |
| Autorização | 🔴 tabela nova — ver §5.2 | 🔴 | 🔴 | 🔴 | — |
| Recorrência | `asaas_subscription_id` (🟢 já existe, nunca escrito) | 🔴 falta | 🔴 falta | — | — |
| Pagamento | 🔴 — hoje é `cobrancas.asaas_payment_id`, precisa virar registro próprio (ver §5.3) | — | — | valor líquido, taxa, data de liquidação | webhook |

**Índice único obrigatório em cada `*_id` externo** (já existe o padrão
em `eventos_asaas.asaas_event_id` e em `empresas.provider_account_id`,
via `empresas_provider_conta_unico`) — é o que impede duas linhas Zelo
apontarem pro mesmo objeto Asaas por erro de corrida.

---

## 5. Máquina de estados

### 5.1 — Cobrança (revisada, sem o que pertence à autorização/pagamento)

```
RASCUNHO
   ↓ (usuário salva)
REGISTRADA          ← é o "pendente" de hoje, mas sem carregar o peso do Pix
   ↓ (enviada pro Asaas)
ENVIADA_ASAAS        ← asaas_payment_id gravado
   ↓ (aguarda o ciclo)
AGUARDANDO_PAGAMENTO
   ↓                              ↘
PAGA                           VENCIDA (derivado por data, como hoje)
   ↓                              ↓
(fim)                          CANCELADA / substituída por nova instrução
```

- **`CANCELADA`** existe em qualquer ponto antes de `PAGA`.
- **`VENCIDA` continua derivado**, nunca gravado — decisão já tomada e
  correta no código atual (`situacaoDaCobranca()`), evita cron.
- Quem altera: `RASCUNHO→REGISTRADA` é o usuário. `REGISTRADA→ENVIADA_ASAAS`
  é o caso de uso (`lib/core/cobranca.ts`, novo). `ENVIADA_ASAAS→...→PAGA`
  é **exclusivamente o webhook**. Nenhum caminho onde o frontend grava
  `PAGA` diretamente — reforça a regra de segurança do §14.
- **Rollback:** só entre `RASCUNHO` e `REGISTRADA` (editar antes de
  enviar). Depois de `ENVIADA_ASAAS`, não há "desfazer" — só cancelar.
- **Idempotência:** transição pro Asaas guarda o retorno antes de marcar
  `ENVIADA_ASAAS`; se cair no meio, existe um estado intermediário
  `ENVIANDO_ASAAS` (ver §11) que permite saber se a chamada partiu sem
  saber se chegou.

### 5.2 — Autorização Pix Automático (entidade nova)

**Revisado em 31/08/2026 contra `POST/DELETE /v3/pix/automatic/authorizations`,
API Reference oficial** — a versão anterior deste documento inventava um
estado intermediário que a API não tem. Correção registrada aqui, não
escondida.

O enum real, confirmado na resposta da API, é exatamente 5 valores:
`CREATED | ACTIVE | CANCELLED | REFUSED | EXPIRED`. Não existe
"aguardando primeiro pagamento" como estado separado — `CREATED` já É
esse período (entre a criação e o pagamento do QR combinado).

```
CREATED   (resposta da criação; QR combinado ainda não foi pago)
   ↓                              ↘
ACTIVE                          REFUSED (o QR combinado expirou sem pagamento)
   ↓                    ↘
(gera instruções)     CANCELLED (DELETE explícito — payer ou o profissional)
                          ↓
                      EXPIRED (finishDate, campo que O PRÓPRIO ZELO define
                               na criação — não é um timeout imprevisível
                               do Asaas, é uma data de fim que escolhemos)
```

- **Quem altera:** `CREATED` é o caso de uso, ao chamar
  `POST /v3/pix/automatic/authorizations`. `ACTIVE`/`REFUSED` chegam por
  webhook, a partir do resultado do QR combinado. `CANCELLED` pode vir
  tanto de `DELETE /v3/pix/automatic/authorizations/{id}` (o Zelo
  chamando) quanto do payer revogando no banco dele (webhook). `EXPIRED`
  é consequência de uma data que o próprio Zelo escolheu ao criar — não
  precisa de pesquisa de prazo, porque não existe prazo padrão: é
  parâmetro (`finishDate`).
- **Campo de correlação:** a API **não tem `externalReference`** neste
  endpoint (diferente de `/payments`, que tem). A correlação com a
  entidade Zelo é via `contractId` — string livre que o Zelo envia na
  criação. Usar o UUID de `autorizacoes_pix.id` como `contractId`.
- **Achado colateral:** a resposta de criação inclui `subscriptionId`
  mesmo em modo `MANUAL` — a autorização cria implicitamente um objeto de
  assinatura no Asaas por baixo, independente do modo escolhido em
  `paymentCreationMode`. Vale gravar esse campo também
  (`asaas_subscription_id` em `autorizacoes_pix`, não confundir com o
  campo homônimo em `recorrencias`, que é da assinatura da própria Zelo).
- **`retryPolicy`:** campo aceito na criação, valor confirmado
  `ALLOW_THREE_IN_SEVEN_DAYS` — resolve o ponto que estava bloqueado no
  §13 sobre retentativa de pagamento recusado. **Não é comportamento
  automático do Asaas: é uma política que o Zelo escolhe ao criar a
  autorização.** Os demais valores possíveis do enum não foram
  confirmados nesta pesquisa.
- **Nova autorização após cancelamento/expiração:** não é "reabrir" a
  antiga — é criar uma autorização nova, vinculada à mesma recorrência.
  Por isso a recorrência (§5.4) tem `autorizacao_atual_id` nullable, não
  um vínculo fixo.
- **Impacto no usuário:** enquanto não `ACTIVE`, nenhuma cobrança daquela
  recorrência pode ser instruída — é a trava que evita cobrar sem
  consentimento.

### 5.3 — Instrução de pagamento (entidade nova, é o "pagamento individual")

```
CRIADA (PAYMENT_INSTRUCTION_CREATED, dentro da janela de 2–10 dias úteis antes do vencimento)
   ↓                       ↘
AGENDADA                 RECUSADA (PAYMENT_INSTRUCTION_REFUSED)
(INSTRUCTION_SCHEDULED)
   ↓                       ↘
CONFIRMADA               FALHOU (PAYMENT_INSTRUCTION_REFUSED, na liquidação)
(PAYMENT_CONFIRMED)
```

- É este objeto, não a `Cobrança`, que efetivamente "vira dinheiro". A
  `Cobrança` referencia a instrução; a instrução referencia a autorização.
- **Cancelamento incidental**, citado na doc: cobrança paga por outro
  meio, ou autorização cancelada no meio do caminho — a instrução some
  sem virar `FALHOU` "de verdade". Precisa de um estado
  `CANCELADA_EXTERNAMENTE` distinto de `FALHOU`, porque o tratamento pro
  usuário é diferente (um é "ok, resolvido"; o outro é "algo deu errado").

### 5.4 — Recorrência (ciclo revisado)

```
RASCUNHO
   ↓
AGUARDANDO_AUTORIZACAO   ← cria a Autorização (§5.2) associada
   ↓
ATIVA                    ← autorização virou ATIVA; motor pode instruir cobranças
   ↓           ↘              ↘
PAUSADA      ENCERRADA      SEM_AUTORIZACAO (autorização expirou/foi cancelada — recorrência existe mas não gera cobrança até nova autorização)
   ↓
ATIVA (retomada)
```

- **Mudança de valor/data:** o Asaas trata isso como reconfiguração da
  cobrança seguinte, não da autorização — a autorização continua valendo
  para o **método**, não para um valor fixo (a menos que o modo seja
  `SUBSCRIPTION`, que já fixa `value` na criação — ver §9 sobre o
  trade-off entre os dois modos).
- **Estado atual do banco** (`ativa | pausada | encerrada`) cobre 3 dos 5
  estados necessários — falta `AGUARDANDO_AUTORIZACAO` e `SEM_AUTORIZACAO`.

### 5.5 — Pagamento (evento, não editável — é o que o webhook registra)

Não é uma máquina de estados no sentido de transições controladas pelo
Zelo: é o **efeito observado**. `RECEIVED → CONFIRMED` (o Asaas distingue
os dois — recebido é a constatação, confirmado é a garantia contra
estorno) `→ possivelmente REFUNDED/CHARGEBACK` mais adiante. O Zelo só
grava o que chega, nunca infere.

---

## 6. Integração Asaas — o que existe, o que falta

### 6.1 Auditoria de `lib/asaas/`

| arquivo | função | status |
|---|---|---|
| `config.ts` | resolve credencial (plataforma vs. subconta), URLs sandbox/produção | 🟢 pronto |
| `cliente-api.ts` | transporte HTTP genérico, aceita credencial por parâmetro | 🟢 pronto, é a infraestrutura |
| `credenciais.ts` | cifra AES-256-GCM, grava/lê por empresa | 🟢 pronto, **nunca chamado por uma tela** |
| `subconta.ts` | `criarSubcontaParaEmpresa()` via `POST /accounts` | 🟢 pronto, **nunca chamado** |
| `cliente.ts` | CRUD de `customers` | 🟢 pronto, **nunca chamado pelo produto** |
| `cobranca.ts` | criar/consultar/cancelar `payments` | 🟢 pronto, **nunca chamado pelo produto** |
| `assinatura.ts` | CRUD de `subscriptions` | 🟢 pronto, usado só para a mensalidade da própria Zelo (ainda não ativado) |
| `webhook.ts` | idempotência + resolução de tenant + processamento | 🟢 pronto e testado; contexto plataforma (mensalidade da Zelo) trata `PAYMENT_RECEIVED`/`CONFIRMED`/`OVERDUE` e `SUBSCRIPTION_DELETED` via `processarEventoAssinaturaPlataforma()` (Fase 15), validando a transição contra `lib/core/assinatura.ts` antes de escrever |
| `tipos.ts` | contratos TS da API v3 | 🟡 cobre `customers`/`payments`/`subscriptions`, **não cobre Pix Automático** (autorização, instrução) |

### 6.2 Endpoints que faltam mapear em `tipos.ts`

**Atualizado 31/08/2026 — API Reference consultada diretamente, os dois
bloqueios anteriores foram resolvidos:**

- `POST /v3/pix/automatic/authorizations` — criar autorização. Corpo
  confirmado: `frequency` (`"MONTHLY"` confirmado; outros valores não
  vistos), `contractId` (string livre, é a correlação — ver §5.2),
  `startDate`, `finishDate` (opcional — define quando expira),
  `value`, `description`, `customerId` (obrigatórios: `frequency`,
  `contractId`, `startDate`, `customerId`, `immediateQrCode`),
  `minLimitValue` (valor mínimo, pra cobrança de valor variável),
  `paymentCreationMode` (`MANUAL` | `SUBSCRIPTION`), `retryPolicy`
  (`ALLOW_THREE_IN_SEVEN_DAYS` confirmado; outros valores não vistos),
  `immediateQrCode` (objeto obrigatório: `pixKey`, `expirationSeconds`,
  `originalValue`, `description` — é o QR do primeiro pagamento
  combinado com o consentimento). Resposta traz `id`, `status`,
  `endToEndIdentifier`, `cancellationDate`, `cancellationReason`,
  `originType`, e **`subscriptionId`** (ver achado em §5.2).
- `DELETE /v3/pix/automatic/authorizations/{id}` — cancelar autorização.
  Sem corpo. Resposta traz a autorização com `status: "CANCELLED"` e
  `cancellationDate` preenchido.
- `POST /v3/payments` com `pixAutomaticAuthorizationId` no corpo — criar
  instrução de pagamento em modo `MANUAL`
- ⚠️ **AINDA BLOQUEADO** — consulta de status de autorização
  (`GET /v3/pix/automatic/authorizations/{id}`, padrão REST provável
  pela simetria com o `DELETE`, mas não testado nem documentado
  explicitamente nesta pesquisa — não assumir sem confirmar)

### 6.3 Zelo → Asaas / Asaas → Zelo

```
Zelo → Asaas (síncrono, via API):
  criar subconta · criar cliente · criar autorização Pix Automático ·
  criar instrução de pagamento (modo MANUAL) · cancelar cobrança

Asaas → Zelo (assíncrono, via webhook):
  status da autorização (criada/ativa/recusada/expirada/cancelada) ·
  status da instrução (criada/agendada/recusada) ·
  status do pagamento (recebido/confirmado/deletado/restaurado)
```

Nenhuma operação de status é síncrona depois da criação — **é
estrutural**, não escolha do Zelo: o Asaas não devolve "pago" na resposta
de criar uma cobrança, porque o pagamento ainda não aconteceu. Isso já
está corretamente refletido no código de webhook existente; falta refletir
na UI (§16).

---

## 7. Onboarding financeiro

```
Conta criada (🟢 já existe)
   ↓
Empresa criada (🟢 trigger)
   ↓
[NOVO] Tela "Conectar recebimento" — /app/configuracoes/asaas
   ↓
[NOVO] Formulário de dados da subconta (nome, CPF/CNPJ, endereço, renda) →
       criarSubcontaParaEmpresa() (🟢 backend pronto, 🔴 tela não existe)
   ↓
empresas.provider_status = 'pendente' → 'ativa' | 'recusada'
   ↓
[NOVO] Se 'ativa': liberado pra cobrar. Se 'recusada': tela explica o
       motivo (⚠️ **BLOQUEADO** — o Asaas devolve motivo de recusa de
       subconta? não confirmado nesta pesquisa) e oferece corrigir/reenviar.
```

Estados de erro que a tela precisa cobrir, hoje **nenhum coberto**:

| situação | o que a Zelo sabe hoje | o que precisa mostrar |
|---|---|---|
| Conta não aprovada | nada — `provider_status='recusada'` já existe no schema, nunca é lido em tela | "Sua conta está em análise pelo Asaas" com prazo esperado |
| Credenciais inválidas | 503 genérico de `asaasRequisicao` | distinguir "chave revogada" de "Asaas fora do ar" |
| Documentação incompleta | 🔴 não modelado | listar o que falta, se o Asaas devolver isso estruturado (⚠️ bloqueado) |
| Conta bloqueada | 🔴 não modelado | estado `provider_status` precisa de um 4º valor, `bloqueada`, distinto de `recusada` |

**Atualizado na Fase 3 (31/08/2026)** — pesquisa concluída, itens acima
resolvidos:

- **Documentação incompleta**: `GET /v3/myAccount/documents` confirmado
  (`lib/asaas/conta.ts`, `consultarDocumentosPendentes`). Cada documento
  pendente tem seu **próprio** `onboardingUrl` — não existe um único link
  de onboarding por conta, suposição inicial que este documento chegou a
  fazer implicitamente e que a pesquisa desta fase corrigiu.
- **Conta bloqueada**: o 4º valor de `provider_status` foi implementado
  como `'bloqueada'` — não é qualquer falha genérica, é especificamente
  "a subconta existe no Asaas mas o Zelo perdeu a `apiKey` dela" (a chave
  só é devolvida uma vez, na criação). Ver §12 para a reconciliação que
  detecta esse estado.
- **Situação cadastral geral**: `GET /v3/myAccount/status/` confirmado —
  4 campos (`commercialInfo`, `bankAccountInfo`, `documentation`,
  `general`), não 1. "Conta 100% aprovada quando `general` for APPROVED"
  é citação literal da doc oficial.
- **Motivo de recusa de subconta** (item 6 da lista de pendências, abaixo)
  segue **não confirmado** — `myAccount/status` devolve os 4 status, mas
  não um motivo textual estruturado. Ainda bloqueado.
- **Upload de documento via API** (`POST /myAccount/documents/{id}`)
  continua **não implementado** — a página de referência retornou 404
  durante esta pesquisa. `lib/asaas/conta.ts` tem `enviarDocumentoViaApi
  = null` com o motivo documentado inline. O caminho suportado nesta fase
  é exclusivamente o `onboardingUrl` por documento.

**Atualizado na Fase 14 (01/09/2026)** — o onboarding descrito acima
cobre só "conectar a conta financeira". A jornada completa até o
primeiro dinheiro recebido (`lib/core/jornada-onboarding.ts`) estende
esse conceito: 8 passos (conta → negócio configurado → conta
financeira pronta → primeiro cliente → primeira recorrência →
autorização Pix → primeira cobrança → primeiro recebimento
confirmado via Asaas), nenhum deles um flag persistido — todos
derivados do estado real do banco a cada leitura, e computados
independentemente (não em cadeia), porque o uso real nem sempre segue
a ordem idealizada (ex.: cobrança avulsa sem recorrência). Ver §59 do
`PROJECT_STATUS.md` para o detalhamento completo.

---

## 8. Pix Automático — mapeamento técnico

```
Profissional cria recorrência
   ↓
[NOVO] Zelo chama POST /v3/pix/automatic/authorizations
       corpo: frequency, contractId=<uuid da autorização>, startDate,
       finishDate?, customerId, retryPolicy, immediateQrCode{pixKey,
       expirationSeconds, originalValue, description}
   ↓
Resposta: status=CREATED, encodedImage/payload do QR combinado
          (pagamento inicial + consentimento futuro), subscriptionId
   ↓
[NOVO] Zelo mostra esse QR pro profissional repassar ao cliente
   ↓                                          (⚠️ BLOQUEADO — não confirmado
   ↓                                           se existe link direto, ou só QR/copia-e-cola)
Cliente escaneia/paga no banco dele
   ↓
QR pago → status ACTIVE   |   QR expira sem pagar → status REFUSED
webhook confirma a mudança (nomes exatos do payload — ver §10)
   ↓
Recorrência: SEM_AUTORIZACAO → ATIVA
   ↓
Motor de recorrência (🟢 já existe, testado) instrui cada ciclo:
   POST /v3/payments com pixAutomaticAuthorizationId, 2–10 dias antes do vencimento
   ↓
webhook: INSTRUCTION_CREATED → INSTRUCTION_SCHEDULED → PAYMENT_CONFIRMED
```

**O que o profissional vê:** o QR/link de autorização (uma vez, na
criação da 1ª cobrança da recorrência), depois só o estado
("aguardando autorização" / "ativa" / "expirada — reenviar").

**O que o cliente vê:** ⚠️ **BLOQUEADO por documentação.** A pesquisa
confirmou que existe "convite para automatizar" reapresentado em
cobranças futuras se a 1ª não for autorizada (achado de sessão anterior),
mas não confirmou a experiência exata do lado do pagador (é uma tela do
banco dele, fora do controle do Zelo — mas o texto/contexto que acompanha
pode ou não ser customizável). **Não decidir copy dessa etapa sem
confirmar.**

**Expiração:** resolvido — não é um prazo fixo do Asaas. `finishDate` é
um campo que **o Zelo escolhe** ao criar a autorização; `EXPIRED` só
acontece quando essa data chega. Se `finishDate` não for enviado
(campo opcional), a autorização não teria data de expiração natural —
decisão de produto: sempre enviar `finishDate`, para nenhuma autorização
ficar ativa indefinidamente sem revisão.

**Revogação pelo cliente:** o cliente pode revogar a autorização
diretamente no banco dele, a qualquer momento — isso chega como
`AUTHORIZATION_CANCELLED`. O Zelo não tem como impedir nem prever; só
reagir (recorrência cai pra `SEM_AUTORIZACAO`).

**Nova autorização:** pedir de novo é criar uma nova autorização (§5.2),
não reabrir a cancelada.

**🟢 CONCLUÍDA (01/09/2026) — Fase 6 de execução.** Confirmações e
correções da pesquisa fresca desta fase (docs.asaas.com, não reaproveitou
pesquisa antiga):

- `immediateQrCode` no request usa `originalValue`/`expirationSeconds`
  (obrigatórios) + `pixKey`/`description` (opcionais) — confirmado.
- Resposta: `payload` e `encodedImage` (o QR em si) são campos de
  **primeiro nível**, não aninhados dentro de `immediateQrCode` — a
  suposição original deste documento (linha 408, "encodedImage/payload
  do QR combinado") estava certa por acaso, mas sem essa confirmação
  explícita. `immediateQrCode` na RESPOSTA só tem
  `conciliationIdentifier`/`expirationDate` (metadados, não a imagem).
- **`account` ausente no payload de webhook**: achado não previsto por
  este documento. O exemplo oficial de
  `PIX_AUTOMATIC_RECURRING_AUTHORIZATION_ACTIVATED` não traz `account`
  como os demais eventos v3 trazem. `lib/asaas/webhook.ts` resolve o
  tenant desses eventos por `authorization.id` → `autorizacoes_pix`, com
  `account.id` (quando presente) como conferência extra, não fonte
  primária. Ver comentário em `resolverContexto`.
- **`contractId` tem limite de 35 caracteres** — um UUID com hífens tem
  36. `lib/asaas/autorizacao-pix.ts` usa o UUID da recorrência SEM
  hífens (32 chars) como `contractId`.
- Elegibilidade da conta (`PIX_AUTOMATIC_RECURRING_ELIGIBILITY_UPDATED`):
  confirmado que quando fica `INELIGIBLE`, o próprio Asaas cancela as
  autorizações ativas — chegam como `AUTHORIZATION_CANCELLED` normais,
  já tratados. O evento de elegibilidade em si só é reconhecido/auditado,
  sem efeito próprio (não haveria o que fazer além do que o cancelamento
  individual já faz).
- "Conta elegível" (pré-condição desta fase) foi implementada como
  `prontaParaCobrar()` (aprovação geral completa, Fase 3) — a doc também
  cita "prova de vida" como requisito, mas não há hoje nenhum sinal
  próprio pra isso no Zelo; a chamada real ao Asaas continua sendo a
  autoridade final (se a conta não estiver elegível por qualquer motivo,
  o `POST` simplesmente falha, tratado como qualquer outra falha
  `integracao_externa`).
- Ver `PROJECT_STATUS.md` §51 para o relatório completo.

---

## 9. Recorrência ↔ Subscription

O motor de recorrência da Zelo (`lib/recorrencia.ts` + o gerador de
cobranças, testado em `teste-fase4.ts`, 29/29) já resolve **quando** gerar
a próxima cobrança. O que falta é decidir **qual dos dois modos** do
Asaas usar:

| | `MANUAL` | `SUBSCRIPTION` |
|---|---|---|
| Quem decide quando cobrar | Zelo (motor já existe) | Asaas |
| Reaproveita o motor atual | sim, direto | não — o motor viraria redundante |
| Controle sobre mudança de valor pontual | total (o Zelo decide por ciclo) | limitado ao que a API de subscription permitir (⚠️ não pesquisado) |
| Risco de duplicar lógica | baixo | médio — dois motores de recorrência (Zelo + Asaas) tendem a divergir |

**Recomendação:** `MANUAL`. Reaproveita o motor já testado, mantém o
Zelo como única fonte de verdade de "quando", e evita ter dois sistemas
de agenda que podem desalinhar. É decisão de arquitetura, não bloqueio de
documentação — mas fica registrado que `SUBSCRIPTION` não foi
pesquisado a fundo por não ser o caminho escolhido.

**Pausar/retomar/encerrar:** hoje só existe no lado Zelo
(`status: pausada`). Pausar uma recorrência não pausa a autorização no
Asaas — só para o motor de gerar novas instruções. **Encerrar**, por
outro lado, deveria também **cancelar a autorização** (⚠️ endpoint de
cancelamento não confirmado, §6.2) — senão a autorização fica órfã, ativa
do lado do Asaas sem nenhuma recorrência Zelo usando ela.

**🟢 DECISÃO CONFIRMADA (01/09/2026) — Fase 6 de execução: `MANUAL`.**
A recomendação acima (feita só por análise arquitetural, sem pesquisa
de doc) foi confirmada com a doc real
(docs.asaas.com/docs/pix-automatico-implementacao): em `MANUAL`, "sua
aplicação cria cada cobrança recorrente pela API"; em `SUBSCRIPTION`,
"as cobranças são geradas automaticamente por uma assinatura" e a Zelo
não deveria criar cobrança nenhuma. `MANUAL` é exatamente o que as
Fases 4–5 já implementaram (`sincronizarCobrancaFinanceira`) — esta
fase só liga a autorização a esse fluxo, não cria um segundo motor.
`paymentCreationMode: "MANUAL"` é fixo em `lib/core/autorizacao-pix.ts`,
nunca escolhido dinamicamente.

**🟢 RESOLVIDO (01/09/2026) — Fase 8 de execução.** `encerrarRecorrencia()`
agora delega pra `encerrarRecorrenciaFinanceira()`
(`lib/core/recorrencia-financeira.ts`): antes de marcar `encerrada`,
cancela toda cobrança em aberto e, se houver autorização Pix Automático
viva (`estaViva`), cancela ela também via `cancelarAutorizacaoPix`
(§6.2 confirmado: `DELETE /v3/pix/automatic/authorizations/{id}`, que
cancela automaticamente instruções já agendadas). Se qualquer
cancelamento falhar no Asaas, a recorrência NÃO é marcada encerrada —
não finge que revogou um consentimento que ainda pode estar ativo lá.
Ver PROJECT_STATUS.md §53. Confirmado nesta mesma fase: o valor de uma
autorização criada com `value` fixo (sempre o caso na Zelo) é travado
pelo Asaas — mudar `recorrencias.valor_centavos` com autorização ativa
é bloqueado no domínio (`valorBloqueadoPelaAutorizacao`) em vez de
deixar o Asaas rejeitar silenciosamente no próximo ciclo.

---

## 10. Webhooks — ciclo completo

**O que já está resolvido corretamente** (não mexer): validação de token
sem fallback, comparação em tempo constante, resolução de tenant por
`account.id` com rejeição de conta desconhecida, idempotência por
`(provider, asaas_event_id)` único, log sem segredo/PII.

**O que falta:**

| item | hoje | proposta |
|---|---|---|
| Eventos aceitos | 🟢 `PAYMENT_*` (recebimento, cancelamento/restauração, estorno total/parcial, chargeback — Fase 9), `SUBSCRIPTION_DELETED`, `AUTHORIZATION_*` (Fase 6), `PAYMENT_INSTRUCTION_*` (Fase 7), `ACCOUNT_STATUS_*` (Fase 3) | eventos de billing type fora do escopo da Zelo (cartão, boleto, análise de risco, dunning) deliberadamente não tratados — nenhum caminho de código os gera |
| Ordenação | não tratada | ver abaixo |
| Processamento assíncrono | síncrono, dentro da requisição | manter síncrono — volume atual não justifica fila; reavaliar se `eventos_asaas` crescer rápido |
| Retry do lado Asaas | implícito (Asaas reenvia se não receber 200) | já correto — qualquer falha de gravação retorna 503, não 200, então o Asaas reenvia |

**Eventos fora de ordem — o caso real:** `AUTHORIZATION_ACTIVATED` chega
depois de `PAYMENT_RECEIVED` do primeiro pagamento, mas nada garante que
a rede entregue nessa ordem. Solução: cada handler só *avança* o estado
se a transição fizer sentido a partir do estado atual gravado — nunca
sobrescreve cegamente. Ex.: se `AUTHORIZATION_ACTIVATED` chegar numa
autorização que já está `CANCELADA` (evento antigo, atrasado), ignora e
loga, não reabre.

**Webhook antes da resposta da API:** cenário real do §11 — tratado lá.

---

## 11. Consistência e concorrência

| cenário | estratégia |
|---|---|
| Dois cliques no mesmo botão | `idempotency key` por ação, não só por request HTTP — ex.: `criar_autorizacao:{recorrencia_id}`, gravada antes da chamada sair, com unique constraint |
| Retry do usuário após timeout | mesma idempotency key faz o backend checar se já existe autorização/cobrança para aquele par antes de criar outra |
| **API criou objeto no Asaas, resposta perdeu (o caso mais perigoso)** | estado intermediário `ENVIANDO_ASAAS` gravado ANTES da chamada sair. Se a resposta nunca voltar, a cobrança fica `ENVIANDO_ASAAS` — um job/rotina de reconciliação (§12) confere no Asaas pelo `externalReference` que o Zelo enviou na criação, encontra o objeto e completa a gravação. Nunca cria de novo sem antes checar. |
| Webhook duplicado | já resolvido — unique constraint |
| Webhook antes da resposta da API | possível se o Asaas processar mais rápido que a latência de rede da resposta pro Zelo. Handler do webhook, ao não achar a cobrança pelo `asaas_payment_id` (porque a Server Action ainda não gravou), grava o evento (idempotência preserva) mas falha em aplicar o efeito — precisa reprocessar quando a Server Action terminar. **Fila de reprocessamento simples**: uma tabela `eventos_pendentes_de_vinculo` (🔴 nova) ou reaproveitar `eventos_asaas.processado_em IS NULL` como fila — o segundo é mais simples e já existe o campo. |
| Usuário cancela enquanto processando | cancelamento só é aceito se o estado atual permitir (`podeCancelar()` já existe e é o padrão certo) — se está `ENVIANDO_ASAAS`, cancelamento fica pendente até a reconciliação resolver o estado real |
| Atualização simultânea / corrida | os `.eq("empresa_id",...)` + `.in("status",[...])` já usados em `marcarComoPaga()` são exatamente o padrão certo (compare-and-swap via WHERE) — replicar em toda transição nova |

**🟢 RESOLVIDO (01/09/2026) — Fase 10 de execução, com stress real de
concorrência (8 chamadas simultâneas, não só revisão de código).** O
"estado intermediário gravado ANTES da chamada sair" da linha de
"resposta perdida" acima é, na prática construída, o
`asaas_sync_status='sincronizando'` (Fases 2–4) — funcionalmente o mesmo
papel do `ENVIANDO_ASAAS` proposto aqui, sob outro nome. O que faltava
de verdade, achado nesta fase: essa trava não tinha TTL de recuperação
— só a autorização Pix (`autorizacao_solicitada_em`, Fase 6) tinha.
Corrigido: cliente/cobrança agora reaproveitam `atualizado_em` com o
mesmo TTL de 2min. Dois bugs de concorrência real também achados e
corrigidos: `prepararCicloPixAutomatico` (checagem de pendente e
cálculo de próximo vencimento eram consultas separadas, permitindo uma
chamada concorrente avançar pro mês errado) e `cancelarAutorizacaoPix`
(UPDATE final sem `count`, duplicando auditoria sob concorrência). Ver
PROJECT_STATUS.md §55. **Ainda não implementado**: fila de
reprocessamento pra "webhook antes da resposta da API" — nenhum caso
real desse cenário foi observado ou testado ainda; fica registrado como
risco residual, não como bug confirmado.

**Correlação — dois campos diferentes, não um só:** `externalReference`
existe em `/payments` (já usado hoje no webhook, confirmado) mas **não
existe** em `/pix/automatic/authorizations` (confirmado por leitura
direta da API Reference, §6.2). Lá, a correlação é via `contractId`.
Regra: `cobrancas.id`/`instrucoes_pagamento.id` → `externalReference`;
`autorizacoes_pix.id` → `contractId`. Os dois recebem o mesmo tratamento
conceitual (UUID da entidade Zelo, nunca nome/texto) — só o nome do campo
muda por endpoint.

---

## 12. Reconciliação

**O que detectar:** cobrança `ENVIANDO_ASAAS` há mais de N minutos;
autorização sem evento há mais de X dias; pagamento com `asaas_payment_id`
gravado mas sem nenhum evento de webhook recebido para ele.

**Periodicidade:** proposta — rotina agendada (Vercel Cron, sem
dependência nova) a cada 15–30 minutos, só sobre registros em estado
transitório (não escaneia a base inteira).

**Estratégia:** para cada divergência, consulta `GET /v3/payments/{id}`
ou o equivalente de autorização (⚠️ endpoint não confirmado, §6.2) e
alinha o lado Zelo ao que o Asaas diz — o Asaas é sempre a fonte de
verdade do dinheiro.

**Logs:** cada reconciliação grava o que encontrou, mesmo quando não há
divergência — é o que permite responder "quando foi a última vez que
conferimos essa cobrança".

**Ações automáticas vs. manuais:** alinhar status é automático.
**Nunca** automatizar reembolso ou qualquer ação que mova dinheiro — isso
fica sempre como alerta pro humano decidir.

**Implementado na Fase 3 (31/08/2026) — reconciliação da CONTA (subconta
de onboarding), não ainda de pagamento/autorização/instrução** (essa
parte mais ampla continua para a Fase 9 do roadmap de execução):
`reconciliarContaFinanceira()` em `lib/core/onboarding.ts` cobre
especificamente o caso de uma empresa presa em `provider_status =
'criando'` (processo caiu entre o compare-and-swap e a conclusão da
chamada ao Asaas). Duas classes de divergência:

- **Local-only**: `asaas_account_id` já está salvo — o Asaas nunca
  precisa ser consultado, é só espelhar o campo local que faltou gravar.
- **Órfã**: não há `asaas_account_id` local — consulta `GET
  /accounts?cpfCnpj=` (credencial da plataforma) para descobrir se a
  criação, apesar de ter parecido falhar pro Zelo, se completou do lado
  do Asaas. Não encontrada → destrava para `recusada` (seguro tentar de
  novo). Encontrada → transiciona para `bloqueada`, porque a `apiKey`
  daquela subconta é **irrecuperável** (só é devolvida uma vez, na
  criação) — não existe reparo automático possível, só suporte manual.

Disparo: botão manual na tela (`reconciliarContaFinanceiraAcao`) e,
separadamente, `sincronizarStatusFinanceiro()` reage a webhooks de
`BANK_ACCOUNT_INFO_*`/`COMMERCIAL_INFO_*`/`DOCUMENT_APPROVED` puxando o
estado real em vez de tentar inferir um valor do nome do evento. Sem
cron ainda — fica para quando a Fase 9 tratar reconciliação periódica
de forma mais ampla (pagamento, autorização, instrução, não só conta).

**🟢 RESOLVIDO (01/09/2026) — Fase 9 de execução, o "pagamento" que
faltava neste parágrafo.** Autorização e instrução já tinham
reconciliação por consulta ativa desde as Fases 6–7
(`sincronizarStatusAutorizacaoPix`/`sincronizarStatusInstrucao`); a
Fase 9 fechou o conjunto com `sincronizarStatusCobranca()`
(`lib/core/cobranca-financeira.ts`), mesmo padrão conservador: só
aplica as transições que o webhook já aplicaria, gated pelo status
local — uma divergência fora dessas transições conhecidas (ex.: Asaas
diz `PENDING` mas local está `paga`) não é revertida às cegas, fica
sinalizada para investigação humana (exatamente o "Ações automáticas
vs. manuais" deste parágrafo). **Ainda sem cron** — todas as três
reconciliações (autorização/instrução/cobrança) continuam disparadas
manualmente por botão na tela, não por rotina periódica; ver
PROJECT_STATUS.md §54.

**🟢 RESOLVIDO (01/09/2026) — Fase 9: estorno e chargeback de
pagamento.** Não estava mapeado neste documento — achado ao pesquisar
a doc oficial pra fechar a reconciliação de cobrança. `cobrancas.status`
ganhou `estornada` (distinto de `cancelada`, que só significa "nunca
foi paga" — estorno é dinheiro que entrou e voltou, `pago_em` é
preservado). Chargeback (`CHARGEBACK_REQUESTED`/`DISPUTE`/
`AWAITING_CHARGEBACK_REVERSAL`) e as etapas de estorno em andamento
(`REFUND_IN_PROGRESS`/`REFUND_DENIED`) são só auditadas, nunca viram
status novo — nenhuma delas é terminal, e "inventar etapa" que a
interface ainda não sabe mostrar é exatamente o que este documento já
proíbe noutros pontos (§instrução, Fase 7).

---

## 13. Falhas — mapa

| falha | estado interno | mensagem ao usuário | retry automático | retry manual | impacto financeiro |
|---|---|---|---|---|---|
| Asaas fora do ar | cobrança fica `REGISTRADA` (não avança) | "Não conseguimos enviar agora, vamos tentar de novo" | sim, com backoff | sim, botão "tentar de novo" | nenhum — nada foi cobrado |
| Timeout na criação | `ENVIANDO_ASAAS` até reconciliação | "Verificando..." | reconciliação (§12) | não — evita duplicar | risco de duplicar se reenviado sem idempotency key |
| Credencial inválida | `provider_status` não muda sozinho | "Problema na conexão com o Asaas, verifique em Configurações" | não | sim, reconectar | bloqueia toda a empresa, não só uma cobrança |
| Conta não aprovada | `provider_status='pendente'` | "Sua conta ainda está em análise" | não | não — depende do Asaas | bloqueia onboarding |
| Webhook atrasado | evento chega, aplica quando chegar | nenhuma — invisível ao usuário até o evento chegar | é o próprio Asaas quem reenvia | — | atraso na atualização do dashboard, não perda |
| Webhook duplicado | idempotência absorve | nenhuma | — | — | nenhum |
| Webhook perdido de vez | reconciliação detecta (§12) | nenhuma até detectar | sim, via reconciliação | — | risco de dashboard desatualizado até a rotina rodar |
| Autorização expirada | `AUTHORIZATION_EXPIRED` | "O cliente não autorizou a tempo — reenviar?" | não | sim | nenhum — nunca chegou a cobrar |
| Pagamento recusado | instrução `RECUSADA` | "O pagamento de {cliente} falhou neste ciclo" | ⚠️ política de retentativa do Asaas não confirmada nesta pesquisa | depende | perda do ciclo, não da recorrência |
| Pagamento estornado | evento `PAYMENT_REFUNDED` (não tratado hoje) | "Um pagamento foi estornado" | não | — | precisa reverter `PAGA→ESTORNADA`, estado que falta |
| Cliente inexistente (deletado no Zelo com cobrança pendente) | FK já impede (`ON DELETE RESTRICT`) | erro amigável na tentativa de deletar | — | — | proteção já existe no schema |
| Cobrança cancelada com autorização ativa | recorrência segue ativa, só aquela instrução cai | nenhuma — normal | — | — | nenhum |
| Recorrência encerrada com autorização ainda ativa no Asaas | ver §9 — cancelamento de autorização pendente de confirmação de endpoint | — | — | — | risco: Asaas continua achando que pode cobrar |

---

## 14. Segurança financeira

**Já implementado e correto** (auditado, não redesenhar): credenciais
cifradas fora do alcance do tenant via RLS sem policy; `service_role`
só em 6 módulos servidor-apenas; grants de coluna em `empresas`
restritos a `nome`/`documento`; webhook nunca aceita `API key` como
token; comparação de segredos em tempo constante.

**O que falta, específico do core financeiro:**

- **Nenhuma Server Action nova pode ter `UPDATE` livre em `status` de
  cobrança/autorização.** Hoje `marcarComoPaga()` é a única exceção
  deliberada e documentada — "baixa manual", claramente rotulada como não
  sendo confirmação de pagamento. Quando o Asaas estiver ligado, essa
  função **deve deixar de existir** ou ficar atrás de uma flag "conta sem
  Asaas conectado" — senão vira uma porta para fingir recebimento.
- **Auditoria de ação humana:** hoje só o webhook é auditado
  (`eventos_asaas`). Toda ação financeira do usuário (criar autorização,
  cancelar recorrência) precisa de log próprio — quem, quando, o quê
  (tabela nova, §18).
- **Quem pode executar ações financeiras:** hoje `membros.papel` distingue
  `dono`/`membro`, mas nenhuma policy nem Server Action usa essa
  distinção. Antes do core financeiro, decidir se `membro` pode criar
  cobrança ou só visualizar — é decisão de produto, não travada aqui.

---

## 15. Dashboard financeiro

| pergunta | hoje | precisa |
|---|---|---|
| Quanto recebi | 🟢 soma de `cobrancas.status='paga'` no mês | manter, mas separar visualmente "confirmado pelo Asaas" de "baixa manual" |
| Quanto está pendente | 🟢 | — |
| Quanto está previsto | 🔴 | soma de recorrências ativas × ciclos futuros |
| Cobranças ativas/falharam | 🟡 parcial (`vencida` existe) | contar falhas de instrução, hoje inexistente |
| Clientes ativos | 🟢 | — |
| Próximas cobranças | 🟢 (`/app` já lista) | — |
| Recorrências | 🟢 lista existe | mostrar estado da autorização junto |
| Problemas que exigem ação | 🔴 | painel novo: autorizações expiradas, credencial inválida, reconciliação com divergência |

**Separação obrigatória, citada no pedido:** todo número no dashboard
precisa indicar a origem — um selo discreto "confirmado pelo Asaas" vs.
"registrado manualmente". Hoje os dois somam juntos sem distinção visual.

**🟢 RESOLVIDO (01/09/2026) — Fase 11 de execução.** Coluna nova
`cobrancas.pago_via` ('asaas' | 'manual' | NULL) fecha a separação
obrigatória — gravada pelo webhook, pela reconciliação (`sincronizarStatusCobranca`,
Fase 9) e por `marcarComoPaga()`, nunca inferida depois do fato. O
painel (`/app`) mostra "Recebido no mês" (só `pago_via='asaas'`, o
número em que se pode confiar) com uma linha secundária discreta "+ RS
X registrados manualmente" só quando existe algo assim — nunca somado
sem indicação. Demais linhas da tabela: "pendente"/"clientes
ativos"/"próximas cobranças"/"recorrências" — 🟢 mantidos. "Cobranças
ativas/falharam" — 🟢 resolvido como bloco "Problemas" (cobrança
vencida, falha ao enviar ao Asaas, débito automático recusado — contado
via `instrucoes_pagamento.status='REFUSED'`). "Problemas que exigem
ação" — 🟢 mesmo bloco; autorização expirada/recusada especificamente
NÃO virou item deste painel (decisão de escopo: já é sinalizada na
própria tela da recorrência desde a Fase 8, e um heurístico de "perdeu
autorização" no dashboard exigiria uma junção mais cara sem evidência
de que o profissional olha o painel pra isso). "Quanto está previsto"
— 🔴 **não implementado como pedido aqui** (projeção de recorrências
ativas × ciclos futuros): decisão de escopo, por exigir simular
calendário de cada recorrência sem estado real por trás — o painel
tem "Processando" no lugar (soma de cobranças já enviadas ao Asaas,
aguardando confirmação — dado real, não projetado). Ver
PROJECT_STATUS.md §56 pro detalhe completo.

---

## 16. UX — estados que a tela precisa cobrir

| estado | tela hoje | proposta |
|---|---|---|
| Integração não configurada | inexistente | banner persistente em `/app`, com CTA pra `/app/configuracoes/asaas` |
| Integração em análise | inexistente | selo "Em análise" + prazo estimado se o Asaas informar |
| Integração pronta | inexistente | selo verde "Pronto para cobrar" |
| Cobrança aguardando autorização | inexistente | selo laranja + botão "reenviar QR" |
| Cobrança autorizada | inexistente | selo, sem ação necessária |
| Cobrança em processamento | inexistente (a instrução é interna, invisível) | selo neutro "processando" entre `ENVIADA_ASAAS` e `PAGA` |
| Cobrança paga | 🟢 existe | manter, com selo de origem (§15) |
| Cobrança falhou | inexistente | selo vermelho + motivo, se disponível |
| Cobrança cancelada | 🟢 existe | manter |
| Recorrência pausada | 🟢 existe | manter |
| Cliente sem autorização | inexistente | selo no cadastro do cliente, não só na cobrança |

Nenhum desses é decorativo — cada um responde "e agora?" sem o usuário
precisar me perguntar, que era o critério pedido.

**🟢 RESOLVIDO (01/09/2026) — Fase 11.** "Integração não configurada":
banner persistente em `/app` com CTA pra `/app/configuracoes`, usando
`prontaParaCobrar()` — a mesma função de domínio da Fase 2, não uma
regra nova inventada na UI. "Cobrança em processamento": resolvido como
o card "Processando" do painel (cobrança com `asaas_payment_id` mas
ainda `pendente`/`enviada`). Os estados de autorização/instrução por
cobrança individual (aguardando/autorizada/recusada) já foram
resolvidos nas Fases 6–7, na tela da própria recorrência — este painel
não duplica isso, só agrega o que precisa de atenção imediata.
"Cliente sem autorização": não virou selo na ficha do cliente — decisão
de escopo, autorização é por RECORRÊNCIA, não por cliente (um cliente
pode ter zero, uma ou várias recorrências, cada uma com sua própria
autorização) — um selo único no cliente inventaria uma relação que não
existe no domínio.

---

## 17. Observabilidade

**Correlation ID:** hoje não existe um ID que atravesse "usuário clicou
→ Server Action → chamada Asaas → webhook de volta". Proposta: gerar um
`correlation_id` (UUID) no caso de uso, no momento em que a ação começa,
propagar como `externalReference` (que já serve pra reconciliação, §11)
e gravar em log estruturado nos dois pontos (saída e entrada do webhook).

**O que logar, sempre:** `tenant_id`, `correlation_id`, `external_id`
(quando existir), resultado (sucesso/erro/código), nunca segredo — mesma
disciplina já aplicada em `webhook.ts`.

**Métricas mínimas:** autorizações criadas vs. ativadas (taxa de
conversão do consentimento — é o número que mostra se o Pix Automático
está funcionando de verdade), cobranças enviadas vs. pagas, tempo médio
entre `ENVIANDO_ASAAS` e resolução.

**A pergunta "por que o cliente X não recebeu/pagamento não processou"**
precisa ser respondível puxando: `correlation_id` → todas as linhas de
log daquela cadeia → estado final em `eventos_asaas` filtrado por
`empresa_id` e período. Hoje é possível só parcialmente (o webhook grava
bem; o lado de saída não grava nada, porque não existe).

---

## 18. Banco de dados — proposta conceitual (sem migration)

### Tabelas novas

```
autorizacoes_pix
  id                          uuid pk           -- vira o `contractId` enviado ao Asaas
  empresa_id                  uuid fk → empresas (RLS por empresa)
  recorrencia_id               uuid fk → recorrencias
  asaas_authorization_id       text unique       -- o `id` que a API devolve
  asaas_subscription_id        text              -- achado: a API devolve isto mesmo em modo MANUAL (§5.2)
  status                       text check (CREATED|ACTIVE|CANCELLED|REFUSED|EXPIRED)  -- enum real da API, confirmado
  finish_date                  date              -- define o EXPIRED; sempre preenchido, nunca nulo
  retry_policy                 text default 'ALLOW_THREE_IN_SEVEN_DAYS'
  cancellation_date             timestamptz nullable
  cancellation_reason           text nullable
  criado_em, atualizado_em     timestamptz

instrucoes_pagamento
  id                          uuid pk
  empresa_id                  uuid fk → empresas
  cobranca_id                  uuid fk → cobrancas
  autorizacao_id                uuid fk → autorizacoes_pix
  asaas_payment_id              text  (mesmo ID que a cobrança referencia — ver nota)
  status                       text check (CRIADA|AGENDADA|CONFIRMADA|RECUSADA|CANCELADA_EXTERNAMENTE)
  criado_em, atualizado_em     timestamptz

pagamentos
  id                          uuid pk
  empresa_id                  uuid fk → empresas
  instrucao_id                  uuid fk → instrucoes_pagamento
  valor_liquido_centavos        integer
  taxa_centavos                 integer
  liquidado_em                  timestamptz
  criado_em                    timestamptz

log_acoes_financeiras           -- auditoria de ação humana, §14
  id                          uuid pk
  empresa_id                  uuid fk
  usuario_id                    uuid fk → auth.users
  acao                         text  (ex.: 'criar_autorizacao', 'cancelar_recorrencia')
  entidade_id                   uuid
  criado_em                    timestamptz
```

### Tabelas existentes — colunas a considerar (não migration, só o desenho)

```
clientes
  + asaas_customer_id          text, nullable, unique quando não nulo

cobrancas
  + external_reference_enviada  bool ou usar o próprio id como externalReference (preferível — nada novo)
  status: revisar o enum para separar do que vira `autorizacoes_pix`/`instrucoes_pagamento` (ver §3.1)

recorrencias
  + autorizacao_atual_id        uuid fk → autorizacoes_pix, nullable
```

**RLS:** todas as tabelas novas seguem exatamente o padrão já
estabelecido — `empresa_id` obrigatório, policy `eh_membro(empresa_id)`
para leitura/escrita do tenant, nenhuma policy pra `anon`. Nenhuma delas
precisa de policy especial além do padrão existente.

**Índices:** unique em todo `asaas_*_id`; índice composto
`(empresa_id, status)` em `autorizacoes_pix` e `instrucoes_pagamento` —
mesmo padrão de `cobrancas`.

---

## 19. API / Server Actions necessárias

| operação | entrada | valida | efeito | idempotência | erros tratados |
|---|---|---|---|---|---|
| Conectar integração | dados da subconta | CPF/CNPJ, campos obrigatórios do Asaas | `criarSubcontaParaEmpresa()` (já existe) | por `empresa_id` (uma subconta por empresa) | 503 Asaas fora do ar, dados inválidos |
| Sincronizar cliente | `cliente_id` | cliente pertence à empresa | cria/atualiza `customers` no Asaas, grava `asaas_customer_id` | por `cliente_id` (não recria se já tem ID) | duplicidade (Asaas pode já ter o CPF cadastrado — checar antes de criar) |
| Criar autorização | `recorrencia_id` | recorrência pertence à empresa, sem autorização ativa | `POST /pix/automatic/authorizations` | `correlation_id` por recorrência | credencial ausente, subconta não aprovada |
| Instruir cobrança | `cobranca_id` | dentro da janela de 2–10 dias | `POST /payments` com `pixAutomaticAuthorizationId` | `correlation_id` por cobrança | autorização não ativa, fora da janela |
| Cancelar cobrança | `cobranca_id` | estado permite (`podeCancelar`, já existe) | cancela local; se já enviada, cancela no Asaas também | idempotente por natureza (cancelar já cancelada é no-op) | Asaas já processou (não cancela mais) |
| Pausar recorrência | `recorrencia_id` | já existe a validação | só local — não mexe na autorização (§9) | trivial | — |
| Retomar recorrência | `recorrencia_id` | autorização ainda `ATIVA`? senão, bloqueia e pede reautorizar | local | trivial | autorização expirada nesse meio tempo |
| Cancelar recorrência | `recorrencia_id` | — | local + cancela autorização no Asaas (⚠️ endpoint não confirmado) | trivial | endpoint indisponível — fica pendente até confirmar |
| Sincronizar status (reconciliação) | nenhuma do usuário — rotina | — | consulta Asaas, alinha estado | por si mesma (consulta, não muta duas vezes) | Asaas fora do ar — tenta na próxima rodada |

Todas vivem em `lib/core/`, chamadas pelas Server Actions existentes
(que passam a delegar em vez de gravar direto).

---

## 20. Arquitetura de camadas — resumo executivo

Já detalhado em §2. O ponto central: **não existe reescrita** — as
Server Actions atuais continuam sendo o ponto de entrada da UI; elas
passam a chamar `lib/core/*` (novo) em vez de gravar `supabase`
diretamente para as operações que tocam o Asaas. As operações que são
puramente locais (editar nome do cliente, por exemplo) continuam como
estão — não é toda Server Action que precisa da camada nova, só as que
cruzam a fronteira financeira.

---

## 21. Testes

**Unitários** (Vitest ou o padrão de scripts atual, `tools/teste-*.ts` —
já é um padrão funcional, sem framework, e pode continuar):
- transições de estado válidas/inválidas para cada máquina (§5)
- `situacaoDaCobranca()`, `podeCancelar()`, `podeMarcarPaga()` — já
  existem, mesmo padrão pra `autorizacoes_pix`/`instrucoes_pagamento`

**Integração:**
- Supabase real, como já é feito (`tools/teste-fase*.ts`)
- Asaas: sandbox real para os testes que puderem (já é a prática
  documentada — nunca mock construído à mão, que diverge da API real)
- Webhook: reaproveitar exatamente o padrão de `tools/teste-fase6.ts`
  (empresa A/B, conta desconhecida, duplicidade) estendido pros novos
  eventos

**E2E:** onboarding completo (criar conta → conectar Asaas sandbox →
cadastrar cliente → criar recorrência → autorizar no sandbox → primeira
cobrança) — só viável depois que o sandbox e as credenciais existirem.

**Failure testing:**
- timeout: simular via mock de rede só nesta camada (não no Asaas real)
- duplicidade: já é o padrão testado em `teste-fase6.ts` — replicar
- webhook fora de ordem: enviar `AUTHORIZATION_ACTIVATED` antes de
  `PAYMENT_RECEIVED` propositalmente, confirmar que o handler não quebra
- API indisponível: já testado hoje (`asaasRequisicao` sem API key → 503)

---

## 22. Migração da implementação atual

**Reaproveitar sem tocar:**
`lib/asaas/config.ts`, `cliente-api.ts`, `credenciais.ts`,
`subconta.ts`, `webhook.ts` (a base de idempotência/tenant), todo o
motor de recorrência, toda a estrutura RLS/multi-tenant, `Analytics`,
`lib/dinheiro.ts`.

**Adaptar:**
`lib/asaas/cliente.ts`, `cobranca.ts`, `assinatura.ts` — já têm a forma
certa, só precisam ser **chamados** de `lib/core/*` novo.
`lib/asaas/webhook.ts` — adicionar os handlers dos eventos de
autorização/instrução, sem mexer no núcleo de idempotência/tenant, que
está correto.
`lib/cobranca.ts` — `StatusCobranca` precisa dos novos estados de §5.1
(é mudança de tipo, não de arquitetura).

**Substituir:**
`marcarComoPaga()` — ver §14, vira exceção controlada por flag, não
comportamento padrão, assim que o Asaas estiver ligado para uma empresa.

**Nada precisa ser reescrito do zero.** É a conclusão honesta da
auditoria: a base é sólida o bastante para ligar em cima, não por baixo.

---

## 23. Roadmap de implementação

### FASE 1 — Fundação de domínio
**Objetivo:** ter o modelo de dados e os tipos certos antes de qualquer
chamada real ao Asaas.
**Arquivos prováveis:** `lib/autorizacao.ts` (novo, no padrão de
`lib/cobranca.ts`), `lib/instrucao-pagamento.ts` (novo), extensão de
`lib/asaas/tipos.ts` com os tipos de Pix Automático.
**Banco:** migrations de `autorizacoes_pix`, `instrucoes_pagamento`,
`pagamentos`, `log_acoes_financeiras` + colunas novas em `clientes`.
**API/Frontend:** nenhum ainda.
**Testes:** unitários das máquinas de estado.
**Dependências:** nenhuma — pode começar imediatamente.
**Critério de conclusão:** tipos compilam, migrations aplicadas, testes
unitários de transição passam, **nada foi ligado ao Asaas ainda**.

### FASE 2 — Onboarding financeiro
**Objetivo:** empresa consegue conectar subconta de verdade.
**Arquivos:** `lib/core/onboarding.ts` (novo), tela
`/app/configuracoes/asaas` (nova), reaproveitando
`criarSubcontaParaEmpresa()`.
**Banco:** nenhuma migration nova (usa colunas já existentes em
`empresas`).
**API:** Server Action `conectarAsaas()`.
**Frontend:** formulário + estados de erro do §7.
**Testes:** integração com Asaas sandbox real.
**Dependências:** Fase 1 (para o log de auditoria da ação).
**Critério de conclusão:** uma empresa de teste consegue ficar com
`provider_status='ativa'` de ponta a ponta, testado contra sandbox.

**🟢 CONCLUÍDA (31/08/2026) — junto com a "Fase 3" de execução**
(onboarding completo + reconciliação + estados de conta), que absorveu
este item e foi além dele. Ver `PROJECT_STATUS.md` §§47–48. A numeração
deste roadmap e a numeração usada nos prompts de execução divergiram a
partir daqui — este documento preserva a numeração original de
planejamento; `PROJECT_STATUS.md` é a fonte de verdade de ordem real de
execução.

### FASE 3 — Cliente → Asaas
**Objetivo:** clientes cadastrados no Zelo existem no Asaas.
**Arquivos:** `lib/core/cliente-asaas.ts` (novo).
**Banco:** coluna `asaas_customer_id` em `clientes`.
**API:** sincronização disparada ao criar/editar cliente.
**Testes:** duplicidade (CPF já existente no Asaas), retry.
**Dependências:** Fase 2 (precisa de subconta ativa).
**Critério de conclusão:** criar cliente no Zelo cria (ou vincula) o
cliente correspondente no Asaas, id gravado, idempotente a reenvio.

**🟢 CONCLUÍDA (31/08/2026) — como "Fase 4" de execução.** Arquivo real
ficou `lib/core/cliente-financeiro.ts` (não `cliente-asaas.ts` — nome
ajustado para não colidir com `lib/asaas/cliente.ts`, que já existia).
Coluna `asaas_customer_id` já existia em `clientes` desde a Fase 1
(fundação); esta fase adicionou `asaas_sync_status` (bookkeeping de
compare-and-swap, mesmo padrão de `empresas.provider_status`) e tentou
revogar grants de INSERT/UPDATE de `authenticated`/`anon` nas duas
colunas. **Correção retroativa (Fase 5, 31/08/2026): esse REVOKE por
coluna não tinha efeito nenhum** — `clientes` (como `cobrancas`) tinha
GRANT de tabela inteira, que em Postgres é aditivo ao de coluna; o teste
de segurança da Fase 4 "passou" só porque usava a chave `anon` sem
sessão, que RLS já bloqueava de qualquer forma, não porque o grant
funcionasse. Corrigido de verdade só na Fase 5 (migration
`fase11_corrige_grants_tabela_ampla_clientes_cobrancas`), aplicada às
duas tabelas de uma vez. Dedup contra duplicidade usa `externalReference
= cliente.id` (o Asaas não impõe unicidade de `cpfCnpj` em `/customers`).
Ver `PROJECT_STATUS.md` §49 (relatório original) e §50 (correção) para
os detalhes.

### FASE 4 — Cobrança → Asaas (sem Pix Automático ainda)
**Objetivo:** cobrança avulsa realmente processa no Asaas, sem
recorrência automática — valida o caminho síncrono antes de complicar
com autorização.
**Arquivos:** `lib/core/cobranca.ts` (novo).
**Banco:** ajuste de enum em `cobrancas.status`.
**Testes:** timeout, duplicidade, webhook — reaproveitando
`teste-fase6.ts` como base.
**Dependências:** Fase 3.
**Critério de conclusão:** criar cobrança avulsa no Zelo gera cobrança
real no Asaas sandbox, webhook de pagamento atualiza o status
corretamente, testado com pagamento real em sandbox.

**🟢 CONCLUÍDA (31/08/2026) — como "Fase 5" de execução.** Achado
importante: `lib/asaas/webhook.ts` já tratava `PAYMENT_RECEIVED`/
`PAYMENT_CONFIRMED`/`PAYMENT_DELETED`/`PAYMENT_RESTORED` para
`cobrancas` desde uma fase anterior à criação do Core Financeiro —
faltava só o lado da CRIAÇÃO (chamar `POST /payments` e persistir o
id), que é o que esta fase entregou. O webhook já esperava
`externalReference = cobranca.id`, então a estratégia de dedup desta
fase (mesma da Fase 4) já nasceu compatível com o que existia, sem
precisar mexer no webhook. Arquivo real:
`lib/core/cobranca-financeira.ts` (não `lib/core/cobranca.ts` como este
roadmap previa — nome ajustado para não colidir com `lib/cobranca.ts`,
que já existia). Coluna nova: `cobrancas.asaas_sync_status` (eixo
TÉCNICO — existe no Asaas? — deliberadamente separado do eixo COMERCIAL
`cobrancas.status`, que este arquivo nunca toca: criar o payment no
Asaas não é o mesmo que o cliente ter pago). `status='enviada'` já
existia com outro significado (profissional avisou o cliente por fora,
manual) — não foi reaproveitado para "existe no Asaas" exatamente por
isso. Cancelamento implementado: local só marca `cancelada` depois que o
Asaas confirma (ou já não tinha mais nada pra cancelar), nunca antes.
Ver `PROJECT_STATUS.md` §50.

### FASE 5 — Autorização Pix Automático
**Objetivo:** o núcleo do produto — consentimento do cliente final.
**Arquivos:** `lib/core/autorizacao.ts` (novo).
**Banco:** já criado na Fase 1.
**Frontend:** tela de status da autorização por recorrência.
**Testes:** todos os fluxos do §5.2, incluindo os de falha.
**Dependências:** Fase 4, e **resolução dos pontos ⚠️ bloqueados em
§6.2/§8** — não dá pra codificar sem o schema exato do endpoint.
**Critério de conclusão:** recorrência de teste passa por
CRIADA→ATIVA em sandbox com um pagador real (mesmo que de teste).

### FASE 6 — Instrução de pagamento recorrente
**Objetivo:** ciclos automáticos, ligando ao motor de recorrência já
existente.
**Arquivos:** adaptação do gerador de cobranças existente para, ao criar
a cobrança do ciclo, instruir o pagamento via Fase 5.
**Testes:** E2E completo de uma recorrência de vários ciclos em sandbox.
**Dependências:** Fase 5.
**Critério de conclusão:** uma recorrência de teste gera e cobra
automaticamente por 2+ ciclos sem intervenção manual.

**🟢 CONCLUÍDA (01/09/2026) — como "Fase 7" de execução.** Confirmado:
não existe endpoint de criação de instrução — nasce do `payment` com
`pixAutomaticAuthorizationId`. Enum de status da Fase 1
(`lib/core/instrucao-pagamento.ts`) estava errado (inventado antes de
pesquisa de doc, mesmo problema que `autorizacoes_pix` teve antes da
Fase 6) — corrigido pro real:
`AWAITING_REQUEST|SCHEDULED|DONE|CANCELLED|REFUSED`. Bug de retry
encontrado e corrigido: sem tratamento especial, uma segunda tentativa
sequencial depois de uma falha recalculava o PRÓXIMO ciclo em vez de
retomar o que falhou — corrigido em `prepararCicloPixAutomatico`
(`lib/core/instrucao-pagamento-pix.ts`). Novo índice único
`cobrancas_ciclo_unico (recorrencia_id, vence_em)` é a chave lógica de
ciclo pedida pela arquitetura. Ver `PROJECT_STATUS.md` §52.

### FASE 7 — Reconciliação e observabilidade
**Objetivo:** a rede de segurança antes de produção real.
**Arquivos:** rotina agendada (`app/api/cron/reconciliar/route.ts`, novo),
correlation ID propagado.
**Dependências:** Fase 6.
**Critério de conclusão:** reconciliação detecta e corrige uma
divergência forçada manualmente em ambiente de teste.

### FASE 8 — Dashboard e UX financeira
**Objetivo:** interface reflete a realidade com honestidade (§15, §16).
**Dependências:** Fase 6 (precisa de dados reais fluindo).
**Critério de conclusão:** todos os estados do §16 têm tela; nenhum
número do dashboard mistura confirmado com manual sem indicar.

**🟢 CONCLUÍDA (01/09/2026) — como "Fase 11" de execução.** Ver §15/§16
acima e PROJECT_STATUS.md §56. Critério de conclusão atendido: `pago_via`
garante a separação confirmado/manual no banco, não só na tela.

### FASE 9 — Desligar a baixa manual, ligar produção
**Objetivo:** `marcarComoPaga()` deixa de ser o caminho normal;
credenciais de produção substituem sandbox.
**Dependências:** todas as anteriores, e as 5 credenciais de produção já
levantadas em auditorias anteriores (`ASAAS_API_KEY` etc.).
**Critério de conclusão:** ver §24.

---

## 24. Definition of Done — "pronta para cobrar dinheiro real"

Não é "a função retorna 200". É todo o seguinte, junto:

- [ ] **Banco:** todas as tabelas do §18 criadas, com RLS testado por
      chamada direta à API (mesmo padrão já usado no projeto)
- [ ] **Asaas:** subconta real conectada, credencial cifrada, tarifa
      confirmada em produção (não só sandbox)
- [ ] **Autorização:** um cliente real (ou de teste controlado) autoriza
      via Pix Automático em produção, evento `ACTIVATED` recebido
- [ ] **Cobrança:** cobrança recorrente instruída automaticamente pelo
      motor, sem clique manual por ciclo
- [ ] **Pagamento:** pagamento real liquidado e refletido corretamente
- [ ] **Webhook:** todos os eventos do §10 mapeados, idempotência
      validada com reenvio forçado, tenant nunca cruzado (testado por
      API direta, como já é praxe no projeto)
- [ ] **Dashboard:** reflete só o que está confirmado, com selo de
      origem quando houver baixa manual residual
- [ ] **Cancelamento:** cancelar recorrência cancela a autorização no
      Asaas também — testado, não presumido
- [ ] **Falhas:** cada linha do §13 tem tratamento verificado, não só
      desenhado
- [ ] **Idempotência:** duplo clique, retry e webhook duplicado testados
      e comprovadamente não duplicam cobrança nem dinheiro
- [ ] **Segurança:** `marcarComoPaga()` não é mais alcançável para
      empresa com Asaas conectado; auditoria de ação financeira grava
- [ ] **Observabilidade:** uma investigação real ("por que não pagou")
      é respondível só com os logs, sem acessar o banco manualmente
- [ ] **Testes:** as quatro camadas do §21 com cobertura real, não só
      "existe um arquivo de teste"
- [ ] **Produção:** as 5 credenciais Asaas de produção configuradas,
      SMTP configurado, domínio público — nada disso é código, mas tudo
      é pré-requisito

Nenhum item aqui foi verificado nesta etapa — é o documento que descreve
o que verificar, não a verificação em si.

---

## Pendências de documentação — resumo consolidado

**Atualizado 31/08/2026** — 3 dos 8 pontos originais foram resolvidos
por consulta direta à API Reference; riscados abaixo, não apagados, para
manter o histórico da revisão.

1. ~~Schema completo do corpo de `POST /v3/pix/automatic/authorizations`~~
   — **RESOLVIDO**, ver §6.2
2. Endpoint de consulta de status de autorização — **ainda bloqueado**
   (`GET .../authorizations/{id}` é provável por simetria com o `DELETE`
   confirmado, mas não testado)
3. ~~Endpoint de cancelamento de autorização~~ — **RESOLVIDO**:
   `DELETE /v3/pix/automatic/authorizations/{id}`, ver §6.2
4. Se `externalReference` é aceito/retornado nos eventos de Pix
   Automático (não só nos de `payment`) — **ainda bloqueado**; o que se
   confirmou é que a *criação* usa `contractId`, não `externalReference`
   (§5.2) — mas o webhook pode ecoar `contractId` de volta, não testado
5. ~~Prazo de expiração de uma autorização pendente~~ — **RESOLVIDO**:
   não é prazo do Asaas, é `finishDate` escolhido pelo Zelo na criação
6. Motivo de recusa de subconta — é estruturado na resposta da API?
7. Política de retentativa automática do Asaas para pagamento recusado
8. Experiência exata do pagador ao autorizar (fora do controle do Zelo,
   mas relevante para o texto de instrução que o profissional recebe)

Nenhuma dessas foi respondida com confiança suficiente para virar código
nesta pesquisa.
