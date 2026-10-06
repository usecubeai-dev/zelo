# Zelo — Conformidade legal de lançamento (código)

O que foi implementado para os bloqueios jurídicos apontados na revisão, o
que ainda é `[PREENCHER]` e o que depende de terceiros. **Nada aqui é texto
jurídico** e **nada foi declarado "em conformidade"**: são mecanismos que o
advogado e o proprietário vão usar. O aviso de rascunho e o `noindex` de
`/termos` e `/privacidade` continuam — só saem quando o advogado aprovar os
textos.

## 1. Aceite dos Termos e da Política (cadastro e re-aceite)

- Checkbox obrigatório, desmarcado, com links para `/termos` e `/privacidade`.
- **Servidor**: o cadastro passa por `criarConta` (Server Action,
  `app/(auth)/criar-conta/acoes.ts`). Sem `aceite === true` a conta **não é
  criada** — a checagem vem antes de qualquer chamada de autenticação.
- Prova em `aceites_legais`: usuário, empresa, `termos_versao`,
  `privacidade_versao`, data, IP e user agent **vistos pelo servidor**,
  origem (`cadastro` | `reaceite`). RLS: a pessoa lê só os próprios; ninguém
  escreve pela API.
- Versões vigentes: `lib/legal.ts` → `TERMS_VERSION`, `PRIVACY_VERSION`.
  Quando mudarem, o layout de `/app` leva a `/aceite` até a pessoa aceitar de
  novo. Contas criadas antes desta entrega não têm aceite e passam por
  `/aceite` uma vez.
- **Limitação**: o endpoint público de autenticação do Supabase continua
  aceitando `signUp` direto. Para fechar de vez seria preciso desligar o
  cadastro público no painel do Supabase e criar usuários só pelo servidor
  (decisão do proprietário). Hoje quem burla o formulário cria a conta, mas
  cai em `/aceite` no primeiro acesso e não usa o produto sem aceitar.

## 2. Cancelamento e arrependimento (7 dias)

- `lib/core/cancelamento.ts`. **Cancelar** remove a assinatura no Asaas
  (nenhuma mensalidade nova), mantém o acesso até o fim do período pago
  (vencimento da última mensalidade paga + 1 mês) e o cron diário leva a conta
  ao plano **Grátis** — nenhum dado é apagado. Idempotente.
- Ordem anti-corrida: marca no banco → remove no Asaas → desvincula. O webhook
  ignora o `SUBSCRIPTION_DELETED` de quem pediu cancelamento. Se o Asaas
  recusar, o pedido é desfeito e a pessoa tenta de novo.
- **Arrependimento**: primeira mensalidade paga há ≤ 7 dias
  (`ARREPENDIMENTO_DIAS`). O plano pago termina na hora (conta vai ao Grátis) e
  nasce um **pedido de reembolso integral** em `pedidos_reembolso`
  (`pendente`). **Nenhum dinheiro é devolvido automaticamente.**
- **Estorno = ação do admin** (`lib/core/reembolso.ts`,
  `POST /payments/{id}/refund` do Asaas): reserva o pedido (sem estorno
  duplo), estorna o valor integral e marca `processado`; se o Asaas recusar,
  `falhou` (pode tentar de novo); o admin também pode recusar com motivo.
  Quando o Asaas confirma, o webhook existente marca a mensalidade como
  estornada e cancela/sinaliza a comissão.
- Eventos em `cancelamentos_assinatura` (data, motivo opcional, plano, quem).
- Downgrade com clientes acima do limite do Grátis: nada é apagado; o banco só
  recusa **novos** cadastros acima do limite (já era assim) e a tela avisa.

## 3. Exclusão de conta sem apagar registro fiscal

- `lib/core/exclusao-conta.ts`: exclusão **lógica + anonimização** (função SQL
  `anonimizar_empresa`, atômica e idempotente). A pessoa digita `EXCLUIR`.
- **Sai**: nome/e-mail/telefone/observações dos clientes do profissional,
  clientes sem nenhum histórico, serviços, notificações, a chave da subconta,
  o payload bruto dos eventos do Asaas (nome/CPF/e-mail do pagador), e o login
  é anonimizado (`excluido+<id>@zelo.invalid`) e bloqueado.
- **Fica** (identificadores mínimos): cobranças, pagamentos, recorrências,
  assinaturas (mensalidades), taxas de R$ 1,99, comissões, log de auditoria,
  e — só dos pagadores que têm cobrança — o **documento** (CPF/CNPJ).
  *Decisão a confirmar com o advogado:*
  `RETER_DOCUMENTO_DO_PAGADOR_EM_REGISTRO_FISCAL` em `lib/legal.ts`.
- FKs: `cobrancas.empresa_id` e `pagamentos.empresa_id` passaram de CASCADE
  para **RESTRICT** (apagar a empresa ou o usuário no Auth não leva o registro
  fiscal junto). Mensalidades, taxas e comissões já eram `SET NULL`.
  *Efeito colateral:* qualquer script que apague um usuário precisa apagar as
  cobranças antes (ajustados `teste-fase4` e `teste-fase5`).
- **Retenção**: `RETENCAO_FISCAL_ANOS = null` (**[PREENCHER]**). O job
  `/api/cron/manutencao` (CRON_SECRET) só elimina definitivamente contas
  excluídas há mais que o prazo **e** só com `RETENCAO_JOB_ATIVO=true` **e** o
  prazo preenchido — hoje desligado.
- **Exportação** antes de excluir: `GET /app/exportar?tipo=clientes|cobrancas|recebimentos`
  (CSV UTF-8, `;`, anti-injeção de fórmula, via RLS — só os dados da própria
  empresa).
- *Pendência externa*: a **subconta no Asaas não é encerrada** por este fluxo
  (não há encerramento por API implementado). Saque do saldo e encerramento da
  subconta dependem do Asaas.

## 4. Taxa de R$ 1,99 visível

`TEXTO_TAXA` e `NOTA_TAXA` (`lib/plano.ts`) são exibidos em toda tela com
preço (landing, planos, escolha de plano, checkout, assinatura, cadastro),
inclusive no Grátis. Sem resto da tabela antiga (R$ 24,90, Profissional, Pro,
trial, 30 dias grátis).

## 5. Identificação da empresa e canais

`lib/company.ts` (razão social, CNPJ e endereço já informados pelo
proprietário; **e-mail de suporte, e-mail de privacidade, telefone/WhatsApp e
horário = `[PREENCHER]`**). Rodapé (`RodapeEmpresa`) nas páginas públicas e no
fluxo de contratação. `/privacidade/solicitacao`: formulário público de pedidos
de titular (acesso, correção, exclusão, portabilidade) → `solicitacoes_titular`
(status e data), listado em `/app/admin/solicitacoes`. E-mail à equipe só
quando o e-mail de privacidade for preenchido **e** o Resend estiver configurado.

## 6. Influenciadores

`termo_parceria_assinado_em` (data). Sem a data o influenciador é **inativo** e
o link/código não funciona — garantido **no banco**
(`influenciadores_ativo_exige_termo`).

## O que continua `[PREENCHER]`

| Item | Onde | Quem decide |
|---|---|---|
| Prazo de retenção fiscal | `lib/legal.ts` (`RETENCAO_FISCAL_ANOS`) | advogado/contador |
| E-mail de suporte, de privacidade, telefone/WhatsApp, horário | `lib/company.ts` | proprietário |
| Manter ou não o CPF/CNPJ do pagador no registro fiscal | `lib/legal.ts` | advogado |
| Ligar o job de eliminação definitiva | env `RETENCAO_JOB_ATIVO=true` | proprietário (depois do prazo) |
| Versões vigentes dos Termos/Política | `lib/legal.ts` | quando o advogado aprovar |

## Depende de confirmação do Asaas

- Saque do saldo da subconta de uma conta excluída/suspensa e tarifas próprias
  do Asaas (não alteradas por este código).
- Se `POST /payments/{id}/refund` aceita estorno na janela e meio de pagamento
  do cliente (cartão, boleto, Pix) — o admin vê `falhou` quando o Asaas recusa.

## Aguarda o advogado

Textos finais de Termos e Política; remover o aviso de rascunho e o `noindex`;
aprovação das mensagens de cancelamento/arrependimento/exclusão; prazos de
resposta aos titulares (nenhum prazo foi inventado); validade jurídica do
modelo de reembolso e do aceite eletrônico.
