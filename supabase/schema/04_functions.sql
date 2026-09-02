-- ZELO — snapshot de schema (ver README.md nesta pasta)
-- Funções/RPCs do schema `public` — extraídas literalmente via
-- pg_get_functiondef() no banco de origem. Todas usam SET search_path TO ''
-- (boa prática de segurança contra search_path hijacking) e referenciam
-- objetos com schema qualificado (public.xxx).

create or replace function public.toca_atualizado_em()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
begin
  new.atualizado_em = now();
  return new;
end $function$;

create or replace function public.leads_toca_atualizado_em()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
begin
  new.atualizado_em = now();
  return new;
end $function$;

create or replace function public.limite_de_clientes(p_plano text)
 returns integer
 language sql
 immutable
 set search_path to ''
as $function$
  select case p_plano
    when 'essencial'    then 20
    when 'profissional' then 50
    when 'premium'      then 150
    else 20
  end
$function$;

create or replace function public.eh_membro(p_empresa uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select exists (
    select 1 from public.membros m
    where m.empresa_id = p_empresa and m.user_id = auth.uid()
  );
$function$;

create or replace function public.empresa_liberada(p_empresa uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select exists (
    select 1 from public.empresas e
    where e.id = p_empresa
      and (
        e.assinatura_status = 'ativa'
        or (e.assinatura_status = 'trial' and e.trial_termina_em > now())
      )
  );
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

create or replace function public.remove_empresa_sem_membros()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  delete from public.empresas e
  where e.id = old.empresa_id
    and not exists (
      select 1 from public.membros m where m.empresa_id = e.id
    );
  return old;
end $function$;

create or replace function public.cria_empresa_do_novo_usuario()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  nova_empresa uuid;
  nome_inicial text;
begin
  nome_inicial := coalesce(
    nullif(trim(new.raw_user_meta_data->>'nome'), ''),
    split_part(new.email, '@', 1)
  );

  insert into public.empresas (nome)
  values (nome_inicial)
  returning id into nova_empresa;

  insert into public.membros (empresa_id, user_id, papel)
  values (nova_empresa, new.id, 'dono');

  return new;
end $function$;
