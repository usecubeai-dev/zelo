-- ============================================================
-- Zelo — tabela de leads do pré-cadastro (/comecar)
--
-- Rode isto no SQL Editor do projeto Supabase ANTES de preencher
-- SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.
--
-- APLICADO E EM PRODUCAO desde 26/08/2026 no projeto Supabase "Zelo"
-- (ref krwzohklsqdysdrfkjcd, us-east-1). Este arquivo e o banco estao
-- em sincronia; se um mudar, mude o outro.
-- ============================================================

create table if not exists public.leads (
  id          uuid primary key default gen_random_uuid(),
  nome        text        not null,
  -- só dígitos: quem normaliza é lib/lead.ts, dos dois lados
  whatsapp    text        not null,
  email       text        not null,
  -- de onde veio o cadastro. Hoje sempre 'comecar'; serve para quando
  -- houver mais de um ponto de captura.
  origem      text        not null default 'comecar',
  criado_em   timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- CONSTRAINT unique, e nao indice sobre lower(email): o PostgREST so
-- infere o ON CONFLICT do `resolution=merge-duplicates` a partir de uma
-- CONSTRAINT em coluna(s). Com indice de expressao o reenvio virava 23505.
-- Medido: com constraint + ?on_conflict=email, 200; sem, 409.
--
-- O CHECK e o que mantem a unicidade insensivel a caixa: a aplicacao ja
-- grava o e-mail em minusculas (normalizarLead, dos dois lados), e o CHECK
-- transforma essa garantia da aplicacao em garantia do banco.
alter table public.leads
  add constraint leads_email_minusculo check (email = lower(email));

alter table public.leads
  add constraint leads_email_unico unique (email);

-- Mantém `atualizado_em` correto nos reenvios.
-- `set search_path = ''` nao e detalhe: sem isso o linter do Supabase
-- acusa `function_search_path_mutable`, porque uma funcao com search_path
-- mutavel pode ser sequestrada por quem consiga criar objetos num schema
-- que venha antes na busca. `now()` vive em pg_catalog, que e sempre
-- consultado, entao a funcao continua funcionando.
create or replace function public.leads_toca_atualizado_em()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

drop trigger if exists leads_atualizado_em on public.leads;
create trigger leads_atualizado_em
  before update on public.leads
  for each row execute function public.leads_toca_atualizado_em();

-- ------------------------------------------------------------
-- SEGURANÇA
-- ------------------------------------------------------------
-- RLS LIGADO e NENHUMA policy: com isso, a chave `anon` — a que poderia
-- vazar para o navegador — não lê nem escreve nada nesta tabela.
--
-- Quem grava é a rota /api/lead, no servidor, com a chave `service_role`,
-- que ignora RLS por definição. É por isso que essa chave nunca pode ter
-- o prefixo NEXT_PUBLIC_ nem sair do servidor.
alter table public.leads enable row level security;

-- Confira depois de rodar: deve devolver rowsecurity = true e zero policies.
--   select relrowsecurity from pg_class where relname = 'leads';
--   select count(*) from pg_policies where tablename = 'leads';
