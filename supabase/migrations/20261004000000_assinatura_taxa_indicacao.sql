-- ZELO — Lançamento comercial: mensalidade, taxa por recebimento e indicação.
--
-- Parte ADITIVA: só cria tabelas, funções e alarga um CHECK. Nada aqui muda
-- o comportamento de código já publicado (o app em produção ignora tudo
-- isto). O fim do mês grátis (default 'pendente') está em
-- 20261004000100_fim_do_trial.sql, que só deve ser aplicado junto do deploy.
--
-- TRÊS FLUXOS FINANCEIROS, TRÊS TABELAS — nunca somados numa coluna só:
--   mensalidades        → receita de assinatura do Zelo
--   taxas_recebimento   → R$ 1,99 por recebimento (cobrança do profissional paga)
--   comissoes           → primeira mensalidade creditada ao influenciador
--
-- Todas as tabelas novas: RLS ligado, sem policy, sem grant para anon/
-- authenticated (o Supabase concede ALL por padrão em tabelas novas do
-- schema public — por isso o REVOKE explícito). Só a service_role grava,
-- sempre pelas funções abaixo, que são atômicas e idempotentes.
-- Exceção deliberada: o próprio dono lê as suas `mensalidades`.

-- ============================================================
-- 1. Estados da assinatura
-- ============================================================
-- 'trial' fica no CHECK só para as contas que já o têm (legado); nenhum
-- código novo atribui 'trial'. 'pendente' = escolheu plano e ainda não
-- pagou. 'suspensa' = definido, ainda sem quem a produza.
alter table public.empresas drop constraint if exists empresas_assinatura_status_check;
alter table public.empresas
  add constraint empresas_assinatura_status_check
  check (assinatura_status = any (array['trial','pendente','ativa','inadimplente','cancelada','suspensa']));

-- ============================================================
-- 2. Administradores da plataforma
-- ============================================================
create table public.administradores_zelo (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now()
);
alter table public.administradores_zelo enable row level security;
revoke all on public.administradores_zelo from anon, authenticated;

-- ============================================================
-- 3. Influenciadores e indicações
-- ============================================================
create table public.influenciadores (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null check (length(btrim(nome)) > 0),
  codigo        text not null unique check (codigo ~ '^[A-Z0-9]{4,20}$'),
  email         text,
  user_id       uuid references auth.users(id) on delete set null,
  status        text not null default 'ativo' check (status in ('ativo','inativo')),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index influenciadores_email_unico on public.influenciadores (lower(email)) where email is not null;
alter table public.influenciadores enable row level security;
revoke all on public.influenciadores from anon, authenticated;

create trigger influenciadores_atualizado_em before update on public.influenciadores
  for each row execute function public.toca_atualizado_em();

-- Uma empresa só pode ter UM influenciador, para sempre (UNIQUE em empresa_id).
create table public.indicacoes (
  id               uuid primary key default gen_random_uuid(),
  influenciador_id uuid not null references public.influenciadores(id) on delete restrict,
  empresa_id       uuid not null unique references public.empresas(id) on delete cascade,
  codigo           text not null,
  criada_em        timestamptz not null default now(),
  convertida_em    timestamptz
);
create index indicacoes_influenciador on public.indicacoes (influenciador_id);
alter table public.indicacoes enable row level security;
revoke all on public.indicacoes from anon, authenticated;

-- ============================================================
-- 4. Mensalidades do Zelo (receita de assinatura)
-- ============================================================
-- `empresa_id ... on delete set null`: o registro financeiro sobrevive à
-- exclusão da conta do cliente (a trigger ao_remover_membro apaga a empresa).
create table public.mensalidades (
  id                    uuid primary key default gen_random_uuid(),
  empresa_id            uuid references public.empresas(id) on delete set null,
  plano                 text not null check (plano in ('essencial','profissional','premium')),
  valor_centavos        integer not null check (valor_centavos > 0),
  asaas_payment_id      text not null unique,
  asaas_subscription_id text,
  vencimento            date,
  status                text not null default 'pendente'
                        check (status in ('pendente','paga','vencida','cancelada','estornada')),
  pago_em               timestamptz,
  valor_pago_centavos   integer,
  eh_primeira           boolean not null default false,
  ambiente              text not null check (ambiente in ('sandbox','production')),
  criada_em             timestamptz not null default now(),
  atualizado_em         timestamptz not null default now(),
  constraint mensalidades_paga_tem_data check (status <> 'paga' or pago_em is not null)
);
-- Garante, no banco, UMA primeira mensalidade por empresa.
create unique index mensalidades_uma_primeira on public.mensalidades (empresa_id) where eh_primeira;
create index mensalidades_empresa on public.mensalidades (empresa_id, criada_em desc);
alter table public.mensalidades enable row level security;
revoke all on public.mensalidades from anon, authenticated;
grant select on public.mensalidades to authenticated;
create policy "membro le as mensalidades" on public.mensalidades
  for select to authenticated using (public.eh_membro(empresa_id));

create trigger mensalidades_atualizado_em before update on public.mensalidades
  for each row execute function public.toca_atualizado_em();

-- ============================================================
-- 5. Taxa de R$ 1,99 por recebimento
-- ============================================================
-- UNIQUE(cobranca_id): uma cobrança paga gera no máximo uma taxa, por mais
-- que PAYMENT_CONFIRMED + PAYMENT_RECEIVED + reenvios cheguem.
-- `ambiente`: teste (sandbox) nunca entra na soma devida.
create table public.taxas_recebimento (
  id               uuid primary key default gen_random_uuid(),
  empresa_id       uuid references public.empresas(id) on delete set null,
  cobranca_id      uuid unique references public.cobrancas(id) on delete set null,
  asaas_payment_id text not null,
  valor_centavos   integer not null check (valor_centavos > 0),
  status           text not null default 'registrada' check (status in ('registrada','cancelada')),
  ambiente         text not null check (ambiente in ('sandbox','production')),
  registrada_em    timestamptz not null default now(),
  cancelada_em     timestamptz
);
create unique index taxas_recebimento_payment on public.taxas_recebimento (asaas_payment_id);
create index taxas_recebimento_empresa on public.taxas_recebimento (empresa_id, registrada_em desc);
alter table public.taxas_recebimento enable row level security;
revoke all on public.taxas_recebimento from anon, authenticated;

-- ============================================================
-- 6. Comissões de influenciador (primeira mensalidade)
-- ============================================================
-- UNIQUE(indicacao_id) e UNIQUE(mensalidade_id): uma comissão por cliente
-- indicado, para sempre — a segunda mensalidade e qualquer reenvio de
-- webhook batem na constraint.
create table public.comissoes (
  id                    uuid primary key default gen_random_uuid(),
  influenciador_id      uuid not null references public.influenciadores(id) on delete restrict,
  indicacao_id          uuid unique references public.indicacoes(id) on delete set null,
  empresa_id            uuid references public.empresas(id) on delete set null,
  mensalidade_id        uuid unique references public.mensalidades(id) on delete set null,
  plano                 text not null,
  valor_centavos        integer not null check (valor_centavos > 0),
  status                text not null default 'pendente'
                        check (status in ('pendente','disponivel','paga','cancelada')),
  ambiente              text not null check (ambiente in ('sandbox','production')),
  criada_em             timestamptz not null default now(),
  disponivel_em         timestamptz,
  paga_em               timestamptz,
  paga_por              uuid references auth.users(id) on delete set null,
  cancelada_em          timestamptz,
  estorno_apos_pagamento boolean not null default false,
  observacao            text,
  constraint comissoes_paga_tem_data check (status <> 'paga' or paga_em is not null)
);
create index comissoes_influenciador on public.comissoes (influenciador_id, criada_em desc);
alter table public.comissoes enable row level security;
revoke all on public.comissoes from anon, authenticated;

-- ============================================================
-- 7. Funções (SECURITY DEFINER, só service_role executa)
-- ============================================================

-- 7.1 Vincula a empresa ao influenciador do código. Idempotente.
-- Retorna: vinculada | ja_vinculada | codigo_invalido | autoindicacao | empresa_ja_paga
create or replace function public.vincular_indicacao(
  p_empresa uuid, p_codigo text, p_user uuid, p_email text
) returns text
language plpgsql security definer set search_path to ''
as $$
declare
  v_inf public.influenciadores%rowtype;
begin
  perform 1 from public.empresas where id = p_empresa for update;
  if not found then return 'codigo_invalido'; end if;

  if exists (select 1 from public.indicacoes where empresa_id = p_empresa) then
    return 'ja_vinculada';
  end if;

  select * into v_inf from public.influenciadores
   where codigo = upper(btrim(coalesce(p_codigo, ''))) and status = 'ativo';
  if not found then return 'codigo_invalido'; end if;

  -- o influenciador não indica a própria conta
  if (v_inf.user_id is not null and v_inf.user_id = p_user)
     or (v_inf.email is not null and p_email is not null and lower(v_inf.email) = lower(p_email)) then
    return 'autoindicacao';
  end if;

  -- indicação só vale ANTES do primeiro pagamento
  if exists (select 1 from public.mensalidades
              where empresa_id = p_empresa and status in ('paga','estornada')) then
    return 'empresa_ja_paga';
  end if;

  insert into public.indicacoes (influenciador_id, empresa_id, codigo)
  values (v_inf.id, p_empresa, v_inf.codigo)
  on conflict (empresa_id) do nothing;

  return 'vinculada';
end $$;

-- 7.2 Registra um evento de mensalidade. Atômica e idempotente.
-- p_evento: criada | paga | vencida | cancelada | estornada
-- Retorna jsonb { mensalidade_id, primeira, comissao_id, ja_processada }
create or replace function public.registrar_mensalidade(
  p_empresa uuid,
  p_payment_id text,
  p_subscription_id text,
  p_valor_centavos integer,
  p_vencimento date,
  p_evento text,
  p_pago_em timestamptz,
  p_ambiente text
) returns jsonb
language plpgsql security definer set search_path to ''
as $$
declare
  v_plano    text;
  v_m        public.mensalidades%rowtype;
  v_primeira boolean := false;
  v_ind      public.indicacoes%rowtype;
  v_com      uuid;
  v_ja       boolean := false;
begin
  if p_evento not in ('criada','paga','vencida','cancelada','estornada') then
    raise exception 'evento de mensalidade invalido: %', p_evento;
  end if;

  -- serializa tudo o que toca esta empresa (pagamento duplicado, evento concorrente)
  select plano into v_plano from public.empresas where id = p_empresa for update;
  if v_plano is null then
    return jsonb_build_object('mensalidade_id', null, 'ja_processada', true, 'erro', 'empresa_inexistente');
  end if;

  select * into v_m from public.mensalidades where asaas_payment_id = p_payment_id;

  if not found then
    -- Só 'paga'/'criada'/'vencida' criam a linha. 'cancelada'/'estornada'
    -- de algo que nunca vimos não têm o que alterar.
    if p_evento in ('cancelada','estornada') then
      return jsonb_build_object('mensalidade_id', null, 'ja_processada', true);
    end if;
    insert into public.mensalidades
      (empresa_id, plano, valor_centavos, asaas_payment_id, asaas_subscription_id, vencimento, status, ambiente)
    values
      (p_empresa, v_plano, p_valor_centavos, p_payment_id, p_subscription_id, p_vencimento, 'pendente', p_ambiente)
    returning * into v_m;
  end if;

  if p_evento = 'vencida' then
    if v_m.status = 'pendente' then
      update public.mensalidades set status = 'vencida' where id = v_m.id;
    else
      v_ja := true;
    end if;

  elsif p_evento = 'cancelada' then
    if v_m.status in ('pendente','vencida') then
      update public.mensalidades set status = 'cancelada' where id = v_m.id;
    else
      v_ja := true;
    end if;

  elsif p_evento = 'paga' then
    if v_m.status = 'paga' or v_m.status = 'estornada' then
      v_ja := true;   -- reenvio / PAYMENT_CONFIRMED depois de PAYMENT_RECEIVED
    else
      v_primeira := not exists (
        select 1 from public.mensalidades
         where empresa_id = p_empresa and id <> v_m.id and status in ('paga','estornada')
      );
      update public.mensalidades
         set status = 'paga',
             pago_em = coalesce(p_pago_em, now()),
             valor_pago_centavos = p_valor_centavos,
             eh_primeira = v_primeira
       where id = v_m.id
       returning * into v_m;

      if v_primeira then
        select * into v_ind from public.indicacoes where empresa_id = p_empresa;
        if found then
          update public.indicacoes set convertida_em = coalesce(convertida_em, now()) where id = v_ind.id;
          insert into public.comissoes
            (influenciador_id, indicacao_id, empresa_id, mensalidade_id, plano, valor_centavos, ambiente)
          values
            (v_ind.influenciador_id, v_ind.id, p_empresa, v_m.id, v_m.plano, p_valor_centavos, p_ambiente)
          on conflict do nothing
          returning id into v_com;
        end if;
      end if;
    end if;

  elsif p_evento = 'estornada' then
    if v_m.status = 'paga' then
      update public.mensalidades set status = 'estornada' where id = v_m.id;
      -- comissão ainda não paga ao influenciador: cancela. Já paga: só sinaliza.
      update public.comissoes set status = 'cancelada', cancelada_em = now()
       where mensalidade_id = v_m.id and status in ('pendente','disponivel');
      update public.comissoes set estorno_apos_pagamento = true
       where mensalidade_id = v_m.id and status = 'paga';
    else
      v_ja := true;
    end if;
  end if;

  return jsonb_build_object(
    'mensalidade_id', v_m.id,
    'primeira', v_primeira,
    'comissao_id', v_com,
    'ja_processada', v_ja
  );
end $$;

-- 7.3 Taxa por recebimento. Idempotente por cobranca_id.
-- Retorna true quando criou (ou reativou) a taxa.
create or replace function public.registrar_taxa_recebimento(
  p_empresa uuid, p_cobranca uuid, p_payment_id text, p_valor_centavos integer, p_ambiente text
) returns boolean
language plpgsql security definer set search_path to ''
as $$
declare
  v_id uuid;
begin
  insert into public.taxas_recebimento (empresa_id, cobranca_id, asaas_payment_id, valor_centavos, ambiente)
  values (p_empresa, p_cobranca, p_payment_id, p_valor_centavos, p_ambiente)
  on conflict (cobranca_id) do update
     set status = 'registrada', cancelada_em = null
   where public.taxas_recebimento.status = 'cancelada'
  returning id into v_id;
  return v_id is not null;
end $$;

-- 7.4 Cancela a taxa (pagamento removido / estornado por completo).
create or replace function public.cancelar_taxa_recebimento(p_cobranca uuid)
returns boolean
language plpgsql security definer set search_path to ''
as $$
declare
  v_n integer;
begin
  update public.taxas_recebimento set status = 'cancelada', cancelada_em = now()
   where cobranca_id = p_cobranca and status = 'registrada';
  get diagnostics v_n = row_count;
  return v_n > 0;
end $$;

-- 7.5 Movimenta a comissão (ação administrativa). Transições válidas:
--   pendente → disponivel → paga ;  pendente|disponivel → cancelada
-- Nunca apaga: o histórico fica.
create or replace function public.mover_comissao(
  p_comissao uuid, p_acao text, p_admin uuid, p_observacao text
) returns text
language plpgsql security definer set search_path to ''
as $$
declare
  v_n integer;
begin
  if p_acao = 'liberar' then
    update public.comissoes set status = 'disponivel', disponivel_em = now()
     where id = p_comissao and status = 'pendente';
  elsif p_acao = 'pagar' then
    update public.comissoes set status = 'paga', paga_em = now(), paga_por = p_admin,
           observacao = coalesce(nullif(btrim(p_observacao), ''), observacao)
     where id = p_comissao and status = 'disponivel';
  elsif p_acao = 'cancelar' then
    update public.comissoes set status = 'cancelada', cancelada_em = now(),
           observacao = coalesce(nullif(btrim(p_observacao), ''), observacao)
     where id = p_comissao and status in ('pendente','disponivel');
  else
    return 'acao_invalida';
  end if;
  get diagnostics v_n = row_count;
  return case when v_n > 0 then 'ok' else 'transicao_invalida' end;
end $$;

revoke all on function public.vincular_indicacao(uuid, text, uuid, text) from public, anon, authenticated;
revoke all on function public.registrar_mensalidade(uuid, text, text, integer, date, text, timestamptz, text) from public, anon, authenticated;
revoke all on function public.registrar_taxa_recebimento(uuid, uuid, text, integer, text) from public, anon, authenticated;
revoke all on function public.cancelar_taxa_recebimento(uuid) from public, anon, authenticated;
revoke all on function public.mover_comissao(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.vincular_indicacao(uuid, text, uuid, text) to service_role;
grant execute on function public.registrar_mensalidade(uuid, text, text, integer, date, text, timestamptz, text) to service_role;
grant execute on function public.registrar_taxa_recebimento(uuid, uuid, text, integer, text) to service_role;
grant execute on function public.cancelar_taxa_recebimento(uuid) to service_role;
grant execute on function public.mover_comissao(uuid, text, uuid, text) to service_role;

-- 7.6 Resolve o user_id de um e-mail (auth.users não é exposto via PostgREST).
-- Usado ao cadastrar o influenciador, para barrar a auto-indicação.
create or replace function public.zelo_user_id_por_email(p_email text)
returns uuid
language sql stable security definer set search_path to ''
as $$
  select id from auth.users where lower(email) = lower(btrim(p_email)) limit 1
$$;
revoke all on function public.zelo_user_id_por_email(text) from public, anon, authenticated;
grant execute on function public.zelo_user_id_por_email(text) to service_role;
