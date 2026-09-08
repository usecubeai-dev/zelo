-- ZELO — snapshot de schema (ver README.md nesta pasta)
-- Tabelas e colunas das 13 tabelas do schema `public`.
-- Chaves primárias vêm inline; CHECK/UNIQUE/FOREIGN KEY estão em 02_constraints.sql
-- (separados de propósito: várias tabelas têm referência cruzada — ex.:
-- recorrencias.autorizacao_atual_id -> autorizacoes_pix, e
-- autorizacoes_pix.recorrencia_id -> recorrencias — então nenhuma ordem
-- linear de CREATE TABLE resolveria todas as FKs inline).

create table public.leads (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  whatsapp      text not null,
  email         text not null,
  origem        text not null default 'comecar',
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.empresas (
  id                          uuid primary key default gen_random_uuid(),
  nome                        text not null,
  documento                   text,
  criada_em                   timestamptz not null default now(),
  trial_termina_em            timestamptz not null default (now() + interval '30 days'),
  assinatura_status           text not null default 'trial',
  asaas_customer_id           text,
  asaas_subscription_id       text,
  asaas_account_id            text,
  asaas_wallet_id             text,
  asaas_status                text not null default 'pendente',
  provider                    text not null default 'asaas',
  provider_account_id         text,
  provider_status             text not null default 'pendente',
  plano                       text not null default 'essencial',
  provider_aprovacao          text,
  provider_conectado_em       timestamptz,
  provider_sincronizado_em    timestamptz,
  assinatura_atualizada_em    timestamptz
);

create table public.membros (
  empresa_id uuid not null,
  user_id    uuid not null,
  papel      text not null default 'dono',
  criado_em  timestamptz not null default now(),
  primary key (empresa_id, user_id)
);

create table public.clientes (
  id                 uuid primary key default gen_random_uuid(),
  empresa_id         uuid not null,
  nome               text not null,
  email              text,
  whatsapp           text,
  documento          text,
  observacoes        text,
  status             text not null default 'ativo',
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now(),
  asaas_customer_id  text,
  asaas_sync_status  text not null default 'pendente'
);

create table public.recorrencias (
  id                          uuid primary key default gen_random_uuid(),
  empresa_id                  uuid not null,
  cliente_id                  uuid not null,
  descricao                   text not null,
  valor_centavos              integer not null,
  periodicidade               text not null default 'mensal',
  dia_vencimento              integer not null,
  inicia_em                   date not null,
  status                      text not null default 'ativa',
  asaas_subscription_id       text,
  criado_em                   timestamptz not null default now(),
  atualizado_em               timestamptz not null default now(),
  autorizacao_atual_id        uuid,
  autorizacao_solicitada_em   timestamptz
);

create table public.autorizacoes_pix (
  id                      uuid primary key default gen_random_uuid(),
  empresa_id              uuid not null,
  recorrencia_id          uuid not null,
  cliente_id              uuid not null,
  asaas_authorization_id  text,
  asaas_subscription_id   text,
  status                  text not null default 'CREATED',
  finish_date             date not null,
  retry_policy            text not null default 'ALLOW_THREE_IN_SEVEN_DAYS',
  cancellation_date       timestamptz,
  cancellation_reason     text,
  criado_em               timestamptz not null default now(),
  atualizado_em           timestamptz not null default now()
);

create table public.cobrancas (
  id                          uuid primary key default gen_random_uuid(),
  empresa_id                  uuid not null,
  cliente_id                  uuid not null,
  recorrencia_id               uuid,
  descricao                   text not null,
  valor_centavos              integer not null,
  vence_em                    date not null,
  status                      text not null default 'pendente',
  pago_em                     timestamptz,
  valor_pago_centavos         integer,
  asaas_payment_id            text,
  criado_em                   timestamptz not null default now(),
  atualizado_em               timestamptz not null default now(),
  asaas_sync_status           text not null default 'pendente',
  valor_estornado_centavos    integer,
  estornado_em                timestamptz,
  pago_via                    text
);

create table public.instrucoes_pagamento (
  id                       uuid primary key default gen_random_uuid(),
  empresa_id               uuid not null,
  cobranca_id              uuid not null,
  autorizacao_id           uuid not null,
  asaas_payment_id         text,
  status                   text not null default 'AWAITING_REQUEST',
  criado_em                timestamptz not null default now(),
  atualizado_em            timestamptz not null default now(),
  asaas_instruction_id     text,
  due_date                 date,
  refusal_reason           text,
  sincronizado_em          timestamptz
);

create table public.pagamentos (
  id                       uuid primary key default gen_random_uuid(),
  empresa_id               uuid not null,
  instrucao_id             uuid not null,
  asaas_payment_id         text not null,
  valor_liquido_centavos   integer not null,
  taxa_centavos            integer not null default 0,
  liquidado_em             timestamptz not null,
  criado_em                timestamptz not null default now()
);

create table public.asaas_credenciais (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        uuid not null,
  api_key_cifrada   text not null,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now(),
  provider          text not null default 'asaas'
);

create table public.eventos_asaas (
  id                 uuid primary key default gen_random_uuid(),
  asaas_event_id     text not null,
  tipo               text not null,
  payload            jsonb not null,
  recebido_em        timestamptz not null default now(),
  processado_em      timestamptz,
  erro               text,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now(),
  empresa_id         uuid,
  asaas_account_id   text,
  provider           text not null default 'asaas'
);

create table public.log_acoes_financeiras (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null,
  usuario_id   uuid,
  acao         text not null,
  entidade_id  text,
  criado_em    timestamptz not null default now()
);

create table public.notificacoes (
  id                    uuid primary key default gen_random_uuid(),
  empresa_id            uuid not null,
  tipo                  text not null,
  titulo                text not null,
  mensagem              text not null,
  prioridade            text not null,
  lida                  boolean not null default false,
  link                  text,
  chave_idempotencia    text not null,
  criado_em             timestamptz not null default now()
);
