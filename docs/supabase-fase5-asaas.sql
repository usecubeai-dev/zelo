-- ============================================================
-- Zelo — Fase 5: Integração Asaas & Webhooks
--
-- Tabela de eventos para idempotência e auditoria de webhooks.
-- RLS ativado com zero policies (acesso exclusivo por service_role).
--
-- APLICADO em 26/08/2026 (migração `fase5_eventos_asaas`). Este arquivo e
-- o banco estão em sincronia; se um mudar, mude o outro.
-- ============================================================

create table if not exists public.eventos_asaas (
  id uuid primary key default gen_random_uuid(),
  asaas_event_id text not null unique,
  tipo text not null,
  payload jsonb not null,
  recebido_em timestamp with time zone not null default now(),
  processado_em timestamp with time zone,
  erro text,
  criado_em timestamp with time zone not null default now(),
  atualizado_em timestamp with time zone not null default now()
);

-- RLS ligado — nenhuma policy pública. Apenas o cliente admin (service_role) acessa.
alter table public.eventos_asaas enable row level security;

-- Índices de auditoria. NÃO há índice sobre asaas_event_id aqui de
-- propósito: o `unique` da coluna já cria um, e um segundo sobre a mesma
-- coluna só custaria escrita.
create index if not exists idx_eventos_asaas_tipo on public.eventos_asaas (tipo);
create index if not exists idx_eventos_asaas_recebido_em on public.eventos_asaas (recebido_em desc);

drop trigger if exists eventos_asaas_atualizado_em on public.eventos_asaas;
create trigger eventos_asaas_atualizado_em
  before update on public.eventos_asaas
  for each row execute function public.toca_atualizado_em();
