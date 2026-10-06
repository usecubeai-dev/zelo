-- ZELO — cobrança + pagamento + recuperação.
--
-- ADITIVA: só colunas novas (com padrão seguro), uma tabela nova e RLS. Nada
-- é alterado nem apagado; toda cobrança existente continua "só Pix", sem
-- encargos, exatamente como era.
--
-- O que o Asaas faz (sondagem do sandbox, 06/10/2026):
--   * valor mínimo de R$ 5,00 em QUALQUER cobrança;
--   * multa e juros só valem para BOLETO (juros: máximo 11% ao mês);
--   * por isso "encargos" só existem quando o cliente pode escolher a forma
--     de pagamento (billingType UNDEFINED = Pix, boleto ou cartão).

-- 1. preferências da empresa (padrão para cobranças novas) ----------------------
alter table public.empresas
  add column if not exists cobranca_forma_padrao   text    not null default 'pix',
  add column if not exists multa_padrao_pct         numeric(4,2),
  add column if not exists juros_padrao_pct_mes     numeric(4,2),
  add column if not exists lembrete_3d_antes        boolean not null default false,
  add column if not exists lembrete_no_dia          boolean not null default false,
  add column if not exists lembrete_1d_depois       boolean not null default false,
  add column if not exists lembrete_3d_depois       boolean not null default false,
  add column if not exists lembrete_7d_depois       boolean not null default false,
  add column if not exists canal_preferencial       text    not null default 'whatsapp';

alter table public.empresas drop constraint if exists empresas_forma_padrao_valida;
alter table public.empresas add constraint empresas_forma_padrao_valida
  check (cobranca_forma_padrao in ('pix','cliente_escolhe'));
alter table public.empresas drop constraint if exists empresas_multa_padrao_valida;
alter table public.empresas add constraint empresas_multa_padrao_valida
  check (multa_padrao_pct is null or (multa_padrao_pct >= 0 and multa_padrao_pct <= 10));
alter table public.empresas drop constraint if exists empresas_juros_padrao_valido;
alter table public.empresas add constraint empresas_juros_padrao_valido
  check (juros_padrao_pct_mes is null or (juros_padrao_pct_mes >= 0 and juros_padrao_pct_mes <= 11));
alter table public.empresas drop constraint if exists empresas_canal_valido;
alter table public.empresas add constraint empresas_canal_valido
  check (canal_preferencial in ('whatsapp','link'));

-- `empresas` usa grant por coluna e só o dono atualiza (policy já existente)
grant select (cobranca_forma_padrao, multa_padrao_pct, juros_padrao_pct_mes,
              lembrete_3d_antes, lembrete_no_dia, lembrete_1d_depois, lembrete_3d_depois, lembrete_7d_depois,
              canal_preferencial)
  on public.empresas to authenticated;
grant update (cobranca_forma_padrao, multa_padrao_pct, juros_padrao_pct_mes,
              lembrete_3d_antes, lembrete_no_dia, lembrete_1d_depois, lembrete_3d_depois, lembrete_7d_depois,
              canal_preferencial)
  on public.empresas to authenticated;

-- 2. como ESTA cobrança é paga e quais encargos valem --------------------------
alter table public.cobrancas
  add column if not exists forma_pagamento text not null default 'pix',
  add column if not exists multa_pct        numeric(4,2),
  add column if not exists juros_pct_mes    numeric(4,2),
  add column if not exists negociada_em     timestamptz;

alter table public.cobrancas drop constraint if exists cobrancas_forma_pagamento_valida;
alter table public.cobrancas add constraint cobrancas_forma_pagamento_valida
  check (forma_pagamento in ('pix','cliente_escolhe'));
alter table public.cobrancas drop constraint if exists cobrancas_multa_valida;
alter table public.cobrancas add constraint cobrancas_multa_valida
  check (multa_pct is null or (multa_pct >= 0 and multa_pct <= 10));
alter table public.cobrancas drop constraint if exists cobrancas_juros_valido;
alter table public.cobrancas add constraint cobrancas_juros_valido
  check (juros_pct_mes is null or (juros_pct_mes >= 0 and juros_pct_mes <= 11));
-- "cliente escolhe" exige o mínimo do Asaas; encargos só existem com essa forma
alter table public.cobrancas drop constraint if exists cobrancas_forma_valor_minimo;
alter table public.cobrancas add constraint cobrancas_forma_valor_minimo
  check (forma_pagamento = 'pix' or valor_centavos >= 500);
alter table public.cobrancas drop constraint if exists cobrancas_encargos_so_com_boleto;
alter table public.cobrancas add constraint cobrancas_encargos_so_com_boleto
  check (forma_pagamento = 'cliente_escolhe' or (multa_pct is null and juros_pct_mes is null));

-- 3. ações de recuperação (contato, link copiado, negociada) --------------------
-- Só registro: o Zelo não envia nada. Serve para "última ação", para saber que
-- um lembrete já foi feito e para tirar a cobrança da fila quando negociada.
create table if not exists public.acoes_cobranca (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null,
  cobranca_id uuid not null,
  tipo        text not null check (tipo in ('whatsapp','link_copiado','lembrete_whatsapp','negociada','reaberta')),
  regra       text check (regra is null or regra in ('3d_antes','no_dia','1d_depois','3d_depois','7d_depois')),
  usuario_id  uuid,
  criado_em   timestamptz not null default now(),
  -- a cobrança TEM de ser da mesma empresa: o isolamento vale até na chave estrangeira
  constraint acoes_cobranca_cobranca_fk
    foreign key (cobranca_id, empresa_id) references public.cobrancas (id, empresa_id) on delete cascade
);

create index if not exists acoes_cobranca_por_cobranca on public.acoes_cobranca (empresa_id, cobranca_id, criado_em desc);

alter table public.acoes_cobranca enable row level security;

drop policy if exists "membro le acoes de cobranca" on public.acoes_cobranca;
create policy "membro le acoes de cobranca" on public.acoes_cobranca
  for select to authenticated using (public.eh_membro(empresa_id));

drop policy if exists "membro registra acoes de cobranca" on public.acoes_cobranca;
create policy "membro registra acoes de cobranca" on public.acoes_cobranca
  for insert to authenticated with check (public.eh_membro(empresa_id) and usuario_id = auth.uid());

-- registro imutável: ninguém edita nem apaga pela API
revoke all on public.acoes_cobranca from anon, authenticated;
grant select, insert on public.acoes_cobranca to authenticated;
