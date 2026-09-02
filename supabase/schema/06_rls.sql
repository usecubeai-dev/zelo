-- ZELO — snapshot de schema (ver README.md nesta pasta)
-- RLS habilitado nas 13 tabelas + as 18 policies existentes, extraídas
-- literalmente via pg_policies no banco de origem.
--
-- IMPORTANTE — 3 tabelas têm RLS habilitado e ZERO policies:
-- asaas_credenciais, eventos_asaas, leads.
-- Isso NÃO é uma lacuna do snapshot: é o comportamento real do banco de
-- origem. RLS sem nenhuma policy = acesso NEGADO por padrão para as roles
-- `anon`/`authenticated` em todas as operações; só a `service_role`
-- (que ignora RLS) consegue ler/escrever nessas 3 tabelas. Faz sentido
-- para o que elas guardam: credenciais Asaas cifradas, payload bruto de
-- webhook, e captura de lead do formulário público — nenhuma delas deve
-- ser acessível diretamente pelo navegador do usuário final.

alter table public.leads                 enable row level security;
alter table public.empresas              enable row level security;
alter table public.membros               enable row level security;
alter table public.clientes              enable row level security;
alter table public.recorrencias          enable row level security;
alter table public.autorizacoes_pix      enable row level security;
alter table public.cobrancas             enable row level security;
alter table public.instrucoes_pagamento  enable row level security;
alter table public.pagamentos            enable row level security;
alter table public.asaas_credenciais     enable row level security;
alter table public.eventos_asaas         enable row level security;
alter table public.log_acoes_financeiras enable row level security;
alter table public.notificacoes          enable row level security;

-- ===== empresas =====
create policy "membro le a empresa" on public.empresas
  for select to authenticated
  using (eh_membro(id));

create policy "dono atualiza a empresa" on public.empresas
  for update to authenticated
  using (exists (select 1 from membros m where m.empresa_id = empresas.id and m.user_id = auth.uid() and m.papel = 'dono'))
  with check (exists (select 1 from membros m where m.empresa_id = empresas.id and m.user_id = auth.uid() and m.papel = 'dono'));

-- ===== membros =====
create policy "usuario le seus vinculos" on public.membros
  for select to authenticated
  using (user_id = auth.uid());

-- ===== clientes =====
create policy "membro le clientes" on public.clientes
  for select to authenticated
  using (eh_membro(empresa_id));

create policy "membro cria clientes" on public.clientes
  for insert to authenticated
  with check (eh_membro(empresa_id) and empresa_liberada(empresa_id));

create policy "membro edita clientes" on public.clientes
  for update to authenticated
  using (eh_membro(empresa_id))
  with check (eh_membro(empresa_id));

-- ===== recorrencias =====
create policy "membro le recorrencias" on public.recorrencias
  for select to authenticated
  using (eh_membro(empresa_id));

create policy "membro cria recorrencias" on public.recorrencias
  for insert to authenticated
  with check (eh_membro(empresa_id) and empresa_liberada(empresa_id));

create policy "membro edita recorrencias" on public.recorrencias
  for update to authenticated
  using (eh_membro(empresa_id))
  with check (eh_membro(empresa_id));

-- ===== autorizacoes_pix =====
create policy "membro le autorizacoes" on public.autorizacoes_pix
  for select to authenticated
  using (eh_membro(empresa_id));

-- ===== cobrancas =====
create policy "membro le cobrancas" on public.cobrancas
  for select to authenticated
  using (eh_membro(empresa_id));

create policy "membro cria cobrancas" on public.cobrancas
  for insert to authenticated
  with check (eh_membro(empresa_id) and empresa_liberada(empresa_id));

create policy "membro edita cobrancas" on public.cobrancas
  for update to authenticated
  using (eh_membro(empresa_id))
  with check (eh_membro(empresa_id));

-- ===== instrucoes_pagamento =====
create policy "membro le instrucoes" on public.instrucoes_pagamento
  for select to authenticated
  using (eh_membro(empresa_id));

-- ===== pagamentos =====
create policy "membro le pagamentos" on public.pagamentos
  for select to authenticated
  using (eh_membro(empresa_id));

-- ===== log_acoes_financeiras =====
create policy "membro le o proprio log" on public.log_acoes_financeiras
  for select to authenticated
  using (eh_membro(empresa_id));

-- ===== notificacoes =====
create policy "membro le notificacoes" on public.notificacoes
  for select to authenticated
  using (eh_membro(empresa_id));

create policy "membro marca notificacao como lida" on public.notificacoes
  for update to authenticated
  using (eh_membro(empresa_id))
  with check (eh_membro(empresa_id));

-- ===== asaas_credenciais, eventos_asaas, leads =====
-- Nenhuma policy — RLS habilitado + zero policies = deny-all para
-- anon/authenticated; acesso só via service_role. Ver nota no topo do arquivo.
