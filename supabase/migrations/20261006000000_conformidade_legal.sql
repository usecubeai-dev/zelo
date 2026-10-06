-- ZELO — Conformidade legal de lançamento.
--
--   1. aceite dos Termos/Política (prova de aceite, com versão, IP e user agent)
--   2. cancelamento da assinatura + arrependimento de 7 dias (+ pedido de reembolso)
--   3. exclusão lógica + anonimização, preservando registros fiscais
--   4. pedidos dos titulares de dados (LGPD)
--   5. termo de parceria assinado do influenciador
--
-- Aditiva, exceto o item 3, que ENDURECE duas chaves estrangeiras
-- (cobrancas e pagamentos deixam de apagar em cascata). Nenhum dado é
-- alterado ou removido por esta migration. RLS ligado em tudo que é novo;
-- sem grant para anon. Funções só executam para service_role.

-- ============================================================
-- 1. Aceite dos Termos e da Política de Privacidade
-- ============================================================
-- user_id/empresa_id `on delete set null`: a PROVA do aceite sobrevive a uma
-- eventual remoção da conta.
create table public.aceites_legais (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users(id) on delete set null,
  empresa_id        uuid references public.empresas(id) on delete set null,
  termos_versao     text not null check (length(termos_versao) between 1 and 60),
  privacidade_versao text not null check (length(privacidade_versao) between 1 and 60),
  origem            text not null check (origem in ('cadastro','reaceite')),
  aceito_em         timestamptz not null default now(),
  ip                text check (ip is null or length(ip) <= 64),
  user_agent        text check (user_agent is null or length(user_agent) <= 300)
);
create index aceites_legais_usuario on public.aceites_legais (user_id, aceito_em desc);
alter table public.aceites_legais enable row level security;
revoke all on public.aceites_legais from anon, authenticated;
grant select on public.aceites_legais to authenticated;
create policy "usuario le os proprios aceites" on public.aceites_legais
  for select to authenticated using (user_id = auth.uid());

-- ============================================================
-- 2. Cancelamento, arrependimento e reembolso
-- ============================================================
alter table public.empresas
  add column cancelamento_solicitado_em timestamptz,
  add column acesso_ate                 timestamptz,
  add column deleted_at                 timestamptz,
  add column anonimizada_em             timestamptz;
grant select (cancelamento_solicitado_em, acesso_ate) on public.empresas to authenticated;

create table public.cancelamentos_assinatura (
  id                    uuid primary key default gen_random_uuid(),
  empresa_id            uuid references public.empresas(id) on delete set null,
  user_id               uuid references auth.users(id) on delete set null,
  tipo                  text not null check (tipo in ('cancelamento','arrependimento')),
  plano                 text not null,
  motivo                text check (motivo is null or length(motivo) <= 500),
  acesso_ate            timestamptz,
  mensalidade_id        uuid references public.mensalidades(id) on delete set null,
  asaas_subscription_id text,
  criado_em             timestamptz not null default now()
);
create index cancelamentos_empresa on public.cancelamentos_assinatura (empresa_id, criado_em desc);
alter table public.cancelamentos_assinatura enable row level security;
revoke all on public.cancelamentos_assinatura from anon, authenticated;
grant select on public.cancelamentos_assinatura to authenticated;
create policy "membro le os cancelamentos" on public.cancelamentos_assinatura
  for select to authenticated using (public.eh_membro(empresa_id));

-- UNIQUE(mensalidade_id): um único pedido de reembolso por mensalidade.
create table public.pedidos_reembolso (
  id               uuid primary key default gen_random_uuid(),
  empresa_id       uuid references public.empresas(id) on delete set null,
  mensalidade_id   uuid unique references public.mensalidades(id) on delete set null,
  asaas_payment_id text not null,
  valor_centavos   integer not null check (valor_centavos > 0),
  motivo           text check (motivo is null or length(motivo) <= 500),
  status           text not null default 'pendente'
                   check (status in ('pendente','processando','processado','recusado','falhou')),
  solicitado_em    timestamptz not null default now(),
  processado_em    timestamptz,
  processado_por   uuid references auth.users(id) on delete set null,
  observacao       text check (observacao is null or length(observacao) <= 500)
);
create index pedidos_reembolso_status on public.pedidos_reembolso (status, solicitado_em);
alter table public.pedidos_reembolso enable row level security;
revoke all on public.pedidos_reembolso from anon, authenticated;
grant select on public.pedidos_reembolso to authenticated;
create policy "membro le os pedidos de reembolso" on public.pedidos_reembolso
  for select to authenticated using (public.eh_membro(empresa_id));

-- 2.1 Registra o pedido de cancelamento/arrependimento. Atômica e idempotente.
-- Só MARCA (não mexe no provedor): o TS chama o Asaas em seguida e, se falhar,
-- desfaz com `desfazer_cancelamento`.
-- Retorna jsonb: { ok, ja_solicitado, cancelamento_id, pedido_id, acesso_ate, erro }
create or replace function public.solicitar_cancelamento(
  p_empresa uuid, p_user uuid, p_tipo text, p_motivo text,
  p_acesso_ate timestamptz, p_mensalidade uuid
) returns jsonb
language plpgsql security definer set search_path to ''
as $$
declare
  v_e   public.empresas%rowtype;
  v_m   public.mensalidades%rowtype;
  v_can uuid;
  v_ped uuid;
begin
  if p_tipo not in ('cancelamento','arrependimento') then
    return jsonb_build_object('ok', false, 'erro', 'tipo_invalido');
  end if;

  select * into v_e from public.empresas where id = p_empresa for update;
  if not found or v_e.deleted_at is not null then
    return jsonb_build_object('ok', false, 'erro', 'empresa_inexistente');
  end if;

  -- só quem tem assinatura PAGA ativa pode cancelar
  if v_e.assinatura_status <> 'ativa' or v_e.plano in ('gratis') then
    return jsonb_build_object('ok', false, 'erro', 'sem_assinatura_paga');
  end if;

  if p_tipo = 'arrependimento' then
    select * into v_m from public.mensalidades where id = p_mensalidade;
    if not found or v_m.empresa_id is distinct from p_empresa
       or v_m.status <> 'paga' or not v_m.eh_primeira
       or v_m.pago_em < now() - interval '7 days' then
      return jsonb_build_object('ok', false, 'erro', 'fora_do_prazo');
    end if;
    if exists (select 1 from public.pedidos_reembolso where mensalidade_id = v_m.id) then
      return jsonb_build_object('ok', true, 'ja_solicitado', true, 'acesso_ate', v_e.acesso_ate);
    end if;
  elsif v_e.cancelamento_solicitado_em is not null then
    return jsonb_build_object('ok', true, 'ja_solicitado', true, 'acesso_ate', v_e.acesso_ate);
  end if;

  update public.empresas
     set cancelamento_solicitado_em = now(),
         acesso_ate = case when p_tipo = 'arrependimento' then now() else p_acesso_ate end
   where id = p_empresa;

  insert into public.cancelamentos_assinatura
    (empresa_id, user_id, tipo, plano, motivo, acesso_ate, mensalidade_id, asaas_subscription_id)
  values
    (p_empresa, p_user, p_tipo, v_e.plano, nullif(btrim(p_motivo), ''),
     case when p_tipo = 'arrependimento' then now() else p_acesso_ate end,
     case when p_tipo = 'arrependimento' then v_m.id else null end,
     v_e.asaas_subscription_id)
  returning id into v_can;

  if p_tipo = 'arrependimento' then
    insert into public.pedidos_reembolso
      (empresa_id, mensalidade_id, asaas_payment_id, valor_centavos, motivo)
    values
      (p_empresa, v_m.id, v_m.asaas_payment_id, coalesce(v_m.valor_pago_centavos, v_m.valor_centavos), nullif(btrim(p_motivo), ''))
    returning id into v_ped;
  end if;

  return jsonb_build_object('ok', true, 'ja_solicitado', false, 'cancelamento_id', v_can,
                            'pedido_id', v_ped, 'acesso_ate', case when p_tipo = 'arrependimento' then now() else p_acesso_ate end);
end $$;

-- 2.2 O provedor já parou de cobrar: desvincula a assinatura e, no
-- arrependimento, encerra o plano pago agora (vai para o Grátis).
create or replace function public.concluir_cancelamento(p_empresa uuid, p_tipo text)
returns boolean
language plpgsql security definer set search_path to ''
as $$
begin
  update public.empresas
     set asaas_subscription_id = null,
         plano = case when p_tipo = 'arrependimento' then 'gratis' else plano end,
         plano_escolhido = case when p_tipo = 'arrependimento' then null else plano_escolhido end,
         cancelamento_solicitado_em = case when p_tipo = 'arrependimento' then null else cancelamento_solicitado_em end,
         acesso_ate = case when p_tipo = 'arrependimento' then null else acesso_ate end,
         assinatura_atualizada_em = now()
   where id = p_empresa;
  return found;
end $$;

-- 2.3 O provedor recusou: volta tudo ao que era, para o usuário tentar de novo.
create or replace function public.desfazer_cancelamento(p_cancelamento uuid, p_pedido uuid)
returns boolean
language plpgsql security definer set search_path to ''
as $$
declare
  v_c public.cancelamentos_assinatura%rowtype;
begin
  select * into v_c from public.cancelamentos_assinatura where id = p_cancelamento;
  if not found then return false; end if;
  if p_pedido is not null then
    delete from public.pedidos_reembolso where id = p_pedido and status = 'pendente';
  end if;
  update public.empresas set cancelamento_solicitado_em = null, acesso_ate = null where id = v_c.empresa_id;
  delete from public.cancelamentos_assinatura where id = p_cancelamento;
  return true;
end $$;

-- 2.4 Fim do período pago: a conta vai para o plano Grátis, SEM apagar dados.
-- Rodada pelo cron diário. Idempotente (só atua em quem ainda está no pago).
create or replace function public.encerrar_assinaturas_vencidas()
returns integer
language plpgsql security definer set search_path to ''
as $$
declare
  v_n integer;
begin
  update public.empresas
     set plano = 'gratis', plano_escolhido = null, asaas_subscription_id = null,
         cancelamento_solicitado_em = null, acesso_ate = null,
         assinatura_atualizada_em = now()
   where cancelamento_solicitado_em is not null
     and acesso_ate is not null and acesso_ate <= now()
     and deleted_at is null and plano <> 'gratis';
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- ============================================================
-- 3. Exclusão lógica + anonimização, preservando registros fiscais
-- ============================================================
-- A exclusão de conta deixa de apagar em cascata o que a lei manda guardar:
-- cobranças e pagamentos (recebimentos) passam a ser RESTRICT. As mensalidades
-- (assinaturas), taxas e comissões já eram SET NULL.
alter table public.cobrancas drop constraint cobrancas_empresa_id_fkey;
alter table public.cobrancas
  add constraint cobrancas_empresa_id_fkey foreign key (empresa_id)
  references public.empresas(id) on delete restrict;

alter table public.pagamentos drop constraint pagamentos_empresa_id_fkey;
alter table public.pagamentos
  add constraint pagamentos_empresa_id_fkey foreign key (empresa_id)
  references public.empresas(id) on delete restrict;

-- Conta excluída não é "liberada" (RLS de escrita usa esta função).
create or replace function public.empresa_liberada(p_empresa uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select exists (
    select 1 from public.empresas e
    where e.id = p_empresa
      and e.deleted_at is null
      and (
        e.assinatura_status = 'ativa'
        or (e.assinatura_status = 'trial' and e.trial_termina_em > now())
      )
  );
$function$;

-- 3.1 Anonimiza a empresa e os dados pessoais que a lei NÃO manda guardar.
-- Mantém: cobranças, pagamentos, recorrências, mensalidades, taxas, comissões,
-- log de auditoria, e — só dos pagadores que têm cobrança — o documento
-- (identificador fiscal mínimo). Idempotente.
create or replace function public.anonimizar_empresa(p_empresa uuid)
returns jsonb
language plpgsql security definer set search_path to ''
as $$
declare
  v_e public.empresas%rowtype;
  v_clientes_anon integer := 0;
  v_clientes_removidos integer := 0;
begin
  select * into v_e from public.empresas where id = p_empresa for update;
  if not found then return jsonb_build_object('ok', false, 'erro', 'empresa_inexistente'); end if;
  if v_e.deleted_at is not null then
    return jsonb_build_object('ok', true, 'ja_excluida', true);
  end if;

  -- clientes do profissional: nome, e-mail, telefone e observações saem
  update public.clientes c
     set nome = 'Cliente removido',
         email = null, whatsapp = null, observacoes = null,
         documento = case when exists (select 1 from public.cobrancas b where b.cliente_id = c.id) then c.documento else null end,
         status = 'arquivado'
   where c.empresa_id = p_empresa;
  get diagnostics v_clientes_anon = row_count;

  -- quem nunca teve cobrança/recorrência/autorização não tem valor fiscal: remove a linha
  delete from public.clientes c
   where c.empresa_id = p_empresa
     and not exists (select 1 from public.cobrancas b where b.cliente_id = c.id)
     and not exists (select 1 from public.recorrencias r where r.cliente_id = c.id)
     and not exists (select 1 from public.autorizacoes_pix a where a.cliente_id = c.id);
  get diagnostics v_clientes_removidos = row_count;

  delete from public.servicos where empresa_id = p_empresa;
  delete from public.notificacoes where empresa_id = p_empresa;
  delete from public.asaas_credenciais where empresa_id = p_empresa;  -- a chave da subconta não fica guardada

  -- o payload bruto dos eventos carrega nome/e-mail/CPF do pagador: sai, o resto fica
  update public.eventos_asaas
     set payload = jsonb_build_object('anonimizado', true, 'event', tipo)
   where empresa_id = p_empresa;

  update public.empresas
     set deleted_at = now(), anonimizada_em = now(),
         nome = 'Conta excluída',
         plano_escolhido = null, cancelamento_solicitado_em = null, acesso_ate = null,
         assinatura_status = 'cancelada', assinatura_atualizada_em = now()
   where id = p_empresa;

  return jsonb_build_object('ok', true, 'ja_excluida', false,
                            'clientes_anonimizados', v_clientes_anon, 'clientes_removidos', v_clientes_removidos);
end $$;

-- 3.2 Eliminação DEFINITIVA, só depois do prazo de retenção (quem chama —
-- o job — confere o prazo). Apaga na ordem certa o que as FKs RESTRICT guardam.
create or replace function public.eliminar_empresa_definitivamente(p_empresa uuid)
returns jsonb
language plpgsql security definer set search_path to ''
as $$
declare
  v_e public.empresas%rowtype;
begin
  select * into v_e from public.empresas where id = p_empresa for update;
  if not found then return jsonb_build_object('ok', false, 'erro', 'empresa_inexistente'); end if;
  if v_e.deleted_at is null then
    raise exception 'empresa nao foi excluida logicamente';
  end if;

  delete from public.comissoes where empresa_id = p_empresa;
  delete from public.taxas_recebimento where empresa_id = p_empresa;
  delete from public.mensalidades where empresa_id = p_empresa;
  delete from public.pagamentos where empresa_id = p_empresa;
  delete from public.instrucoes_pagamento where empresa_id = p_empresa;
  delete from public.cobrancas where empresa_id = p_empresa;
  delete from public.empresas where id = p_empresa;  -- o resto sai em cascata
  return jsonb_build_object('ok', true);
end $$;

-- ============================================================
-- 4. Pedidos dos titulares de dados (LGPD)
-- ============================================================
create table public.solicitacoes_titular (
  id            uuid primary key default gen_random_uuid(),
  tipo          text not null check (tipo in ('acesso','correcao','exclusao','portabilidade','outro')),
  email         text not null check (length(email) between 5 and 200),
  nome          text check (nome is null or length(nome) <= 120),
  mensagem      text check (mensagem is null or length(mensagem) <= 2000),
  status        text not null default 'recebida'
                check (status in ('recebida','em_andamento','concluida','recusada')),
  criada_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index solicitacoes_titular_status on public.solicitacoes_titular (status, criada_em desc);
alter table public.solicitacoes_titular enable row level security;
revoke all on public.solicitacoes_titular from anon, authenticated;
create trigger solicitacoes_titular_atualizado before update on public.solicitacoes_titular
  for each row execute function public.toca_atualizado_em();

-- ============================================================
-- 5. Influenciador: só ativo com o termo de parceria assinado
-- ============================================================
alter table public.influenciadores add column termo_parceria_assinado_em date;
alter table public.influenciadores
  add constraint influenciadores_ativo_exige_termo
  check (status <> 'ativo' or termo_parceria_assinado_em is not null);

-- ============================================================
-- grants das funções (só service_role)
-- ============================================================
revoke all on function public.solicitar_cancelamento(uuid, uuid, text, text, timestamptz, uuid) from public, anon, authenticated;
revoke all on function public.concluir_cancelamento(uuid, text) from public, anon, authenticated;
revoke all on function public.desfazer_cancelamento(uuid, uuid) from public, anon, authenticated;
revoke all on function public.encerrar_assinaturas_vencidas() from public, anon, authenticated;
revoke all on function public.anonimizar_empresa(uuid) from public, anon, authenticated;
revoke all on function public.eliminar_empresa_definitivamente(uuid) from public, anon, authenticated;
grant execute on function public.solicitar_cancelamento(uuid, uuid, text, text, timestamptz, uuid) to service_role;
grant execute on function public.concluir_cancelamento(uuid, text) to service_role;
grant execute on function public.desfazer_cancelamento(uuid, uuid) to service_role;
grant execute on function public.encerrar_assinaturas_vencidas() to service_role;
grant execute on function public.anonimizar_empresa(uuid) to service_role;
grant execute on function public.eliminar_empresa_definitivamente(uuid) to service_role;

-- a sessão precisa saber se a conta foi excluída (tela "Conta excluída" no lugar do app)
grant select (deleted_at) on public.empresas to authenticated;
