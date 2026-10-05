-- ZELO — Tabela oficial de planos (substitui Essencial 24,90 / Profissional / Pro).
--
--   Grátis    R$ 0        até 10 clientes   (plano PERMANENTE, não é trial)
--   Essencial R$ 49,90    até 50 clientes
--   Negócio   R$ 99,90    até 200 clientes
--   Escola    R$ 199,90   clientes ilimitados
--   Taxa de R$ 1,99 por Pix recebido em todos.
--
-- COMPATIBILIDADE — nada de dado antigo é reescrito:
--   os identificadores antigos 'profissional' e 'premium' continuam VÁLIDOS
--   nos CHECKs e as funções os tratam como Negócio e Escola. Contas e
--   mensalidades já gravadas mantêm o que têm (histórico intacto); só
--   assinaturas NOVAS gravam 'gratis' | 'essencial' | 'negocio' | 'escola'.
--   Os preços NÃO vivem no banco (a fonte única é lib/plano.ts, no servidor);
--   o banco impõe os LIMITES.
--
-- Limite NULL = ilimitado (Escola). Não existe número artificial.
--
-- Limite mensal de COBRANÇAS: a tabela oficial não tem essa dimensão, então
-- ela deixa de existir (função devolve NULL = sem limite). O trigger e a
-- função ficam no lugar, prontos para uma regra futura.

-- 1. identificadores válidos --------------------------------------------------
alter table public.empresas drop constraint if exists empresas_plano_valido;
alter table public.empresas
  add constraint empresas_plano_valido
  check (plano = any (array['gratis','essencial','negocio','escola','profissional','premium']));

alter table public.mensalidades drop constraint if exists mensalidades_plano_check;
alter table public.mensalidades
  add constraint mensalidades_plano_check
  check (plano = any (array['gratis','essencial','negocio','escola','profissional','premium']));

-- Plano que o cliente ESCOLHEU no checkout e ainda não pagou. `plano` (o que
-- vale, e que define o limite) só muda quando o pagamento é confirmado.
alter table public.empresas add column plano_escolhido text;
alter table public.empresas
  add constraint empresas_plano_escolhido_valido
  check (plano_escolhido is null or plano_escolhido = any (array['gratis','essencial','negocio','escola','profissional','premium']));
grant select (plano_escolhido) on public.empresas to authenticated;

-- 2. limites impostos pelo banco ------------------------------------------------
create or replace function public.limite_de_clientes(p_plano text)
 returns integer
 language sql
 immutable
 set search_path to ''
as $function$
  select case p_plano
    when 'gratis'       then 10
    when 'essencial'    then 50
    when 'negocio'      then 200
    when 'profissional' then 200   -- identificador antigo = Negócio
    when 'escola'       then null  -- ilimitado
    when 'premium'      then null  -- identificador antigo = Escola
    else 10                        -- desconhecido cai no menor (Grátis)
  end
$function$;

create or replace function public.limite_de_cobrancas_mensal(p_plano text)
 returns integer
 language sql
 immutable
 set search_path to ''
as $function$
  select null::integer  -- a tabela oficial de planos não limita cobranças/mês
$function$;

create or replace function public.impoe_limite_de_clientes()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_plano  text;
  v_limite integer;
  v_atual  integer;
begin
  select plano into v_plano from public.empresas where id = new.empresa_id;
  if v_plano is null then
    raise exception 'Empresa não encontrada.' using errcode = 'P0002';
  end if;

  v_limite := public.limite_de_clientes(v_plano);
  if v_limite is null then
    return new;  -- ilimitado
  end if;

  /* Contagem sob o lock da própria linha da empresa: sem isto, dois
     cadastros simultâneos leem a mesma contagem e ambos passam,
     estourando o limite em um. */
  perform 1 from public.empresas where id = new.empresa_id for update;

  select count(*) into v_atual from public.clientes where empresa_id = new.empresa_id;

  if v_atual >= v_limite then
    raise exception 'LIMITE_DE_CLIENTES:%:%', v_plano, v_limite
      using errcode = 'P0001';
  end if;

  return new;
end $function$;

create or replace function public.impoe_limite_de_cobrancas()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_plano  text;
  v_limite integer;
  v_atual  integer;
begin
  select plano into v_plano from public.empresas where id = new.empresa_id;
  if v_plano is null then
    raise exception 'Empresa não encontrada.' using errcode = 'P0002';
  end if;

  v_limite := public.limite_de_cobrancas_mensal(v_plano);
  if v_limite is null then
    return new;  -- sem limite mensal de cobranças
  end if;

  perform 1 from public.empresas where id = new.empresa_id for update;

  select count(*) into v_atual
  from public.cobrancas
  where empresa_id = new.empresa_id
    and criado_em >= date_trunc('month', now());

  if v_atual >= v_limite then
    raise exception 'LIMITE_DE_COBRANCAS_MENSAL:%:%', v_plano, v_limite
      using errcode = 'P0001';
  end if;

  return new;
end $function$;

-- 3. mensalidade: a primeira cobrança paga PROMOVE o plano escolhido ----------
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
  v_escolhido text;
  v_m        public.mensalidades%rowtype;
  v_primeira boolean := false;
  v_ind      public.indicacoes%rowtype;
  v_com      uuid;
  v_ja       boolean := false;
begin
  if p_evento not in ('criada','paga','vencida','cancelada','estornada') then
    raise exception 'evento de mensalidade invalido: %', p_evento;
  end if;

  select plano, plano_escolhido into v_plano, v_escolhido
    from public.empresas where id = p_empresa for update;
  if v_plano is null then
    return jsonb_build_object('mensalidade_id', null, 'ja_processada', true, 'erro', 'empresa_inexistente');
  end if;

  select * into v_m from public.mensalidades where asaas_payment_id = p_payment_id;

  if not found then
    if p_evento in ('cancelada','estornada') then
      return jsonb_build_object('mensalidade_id', null, 'ja_processada', true);
    end if;
    -- a cobrança nasce com o plano que o cliente ESCOLHEU (ainda não vigente)
    insert into public.mensalidades
      (empresa_id, plano, valor_centavos, asaas_payment_id, asaas_subscription_id, vencimento, status, ambiente)
    values
      (p_empresa, coalesce(v_escolhido, v_plano), p_valor_centavos, p_payment_id, p_subscription_id, p_vencimento, 'pendente', p_ambiente)
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
      v_ja := true;
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

      -- pagamento confirmado da cobrança do plano ESCOLHIDO: agora ele vale.
      -- (uma cobrança antiga, de outro plano, nunca promove o plano novo)
      if v_escolhido is not null and v_m.plano = v_escolhido then
        update public.empresas set plano = v_escolhido, plano_escolhido = null where id = p_empresa;
      end if;

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

revoke all on function public.registrar_mensalidade(uuid, text, text, integer, date, text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.registrar_mensalidade(uuid, text, text, integer, date, text, timestamptz, text) to service_role;
