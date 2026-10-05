-- ZELO — Infraestrutura para cobrar a taxa de R$ 1,99 DEPOIS.
--
-- A taxa já é REGISTRADA, uma vez por recebimento, em `taxas_recebimento`.
-- Cobrá-la automaticamente do profissional exige um mecanismo seguro que
-- ainda não existe (ver ZELO_LANCAMENTO_COMERCIAL.md, "Taxa de R$ 1,99").
-- Em vez de improvisar, esta migration deixa pronto o que NÃO depende dessa
-- decisão: saber exatamente quanto cada profissional deve e marcar, de forma
-- atômica e sem dupla contagem, o que já foi cobrado (por fora, por enquanto).
--
-- Aditiva. Só service_role executa (mesma regra das demais funções).

alter table public.taxas_recebimento
  add column faturada_em timestamptz,
  add column fatura_referencia text;

alter table public.taxas_recebimento
  add constraint taxas_faturada_coerente
  check ((faturada_em is null) = (fatura_referencia is null));

-- só entra na conta o que é recebimento REAL (produção), registrado e ainda não cobrado
create index taxas_a_cobrar_idx on public.taxas_recebimento (empresa_id)
  where status = 'registrada' and ambiente = 'production' and faturada_em is null;

create or replace function public.taxas_a_cobrar()
returns table (
  empresa_id uuid,
  empresa_nome text,
  quantidade bigint,
  total_centavos bigint,
  mais_antiga timestamptz
)
language sql stable security definer set search_path to ''
as $$
  select t.empresa_id,
         coalesce(e.nome, '(conta removida)') as empresa_nome,
         count(*)::bigint,
         sum(t.valor_centavos)::bigint,
         min(t.registrada_em)
    from public.taxas_recebimento t
    left join public.empresas e on e.id = t.empresa_id
   where t.status = 'registrada' and t.ambiente = 'production' and t.faturada_em is null
   group by t.empresa_id, e.nome
   order by min(t.registrada_em)
$$;

-- Marca como cobradas TODAS as taxas pendentes da empresa, numa única
-- instrução: duas chamadas simultâneas não contam a mesma taxa duas vezes
-- (a segunda não encontra mais linha pendente).
create or replace function public.marcar_taxas_faturadas(p_empresa uuid, p_referencia text)
returns table (quantidade integer, total_centavos integer)
language plpgsql security definer set search_path to ''
as $$
begin
  if p_referencia is null or length(btrim(p_referencia)) = 0 then
    raise exception 'referencia obrigatoria';
  end if;

  return query
  with marcadas as (
    update public.taxas_recebimento t
       set faturada_em = now(), fatura_referencia = btrim(p_referencia)
     where t.empresa_id = p_empresa
       and t.status = 'registrada' and t.ambiente = 'production' and t.faturada_em is null
    returning t.valor_centavos
  )
  select count(*)::integer, coalesce(sum(valor_centavos), 0)::integer from marcadas;
end $$;

revoke all on function public.taxas_a_cobrar() from public, anon, authenticated;
revoke all on function public.marcar_taxas_faturadas(uuid, text) from public, anon, authenticated;
grant execute on function public.taxas_a_cobrar() to service_role;
grant execute on function public.marcar_taxas_faturadas(uuid, text) to service_role;
