-- ZELO — Fase 21: elegibilidade da conta para Pix Automático.
--
-- ⚠ NÃO APLICADA — este arquivo foi escrito e revisado, mas NÃO foi
-- executado contra nenhum banco (Supabase de produção nem nenhum outro).
-- Aplicar está fora do escopo desta execução ("não altere produção").
-- Ver ZELO_LAUNCH_BLOCKERS.md, categoria "BLOQUEADO POR SUPABASE".
--
-- Para aplicar quando decidido: via MCP do Supabase (`apply_migration`)
-- ou colando no SQL Editor do Supabase Studio, no projeto de produção
-- (krwzohklsqdysdrfkjcd — ver supabase/schema/README.md). Depois de
-- aplicada, replicar em supabase/schema/01_tables.sql e 02_constraints.sql
-- para manter o snapshot consolidado em dia (ver README daquela pasta).
--
-- O QUE ISSO HABILITA
-- Sem esta migration, todo código novo desta fase que LÊ elegibilidade
-- (`lib/core/elegibilidade-pix.ts`, `obterElegibilidadePix`) já funciona
-- normalmente e devolve `UNKNOWN` (a leitura tolera a coluna ausente —
-- ver comentário no arquivo). O código que ESCREVE elegibilidade (o
-- webhook, quando o Asaas manda `PIX_AUTOMATIC_RECURRING_ELIGIBILITY_
-- UPDATED`) também já é defensivo — falha silenciosamente e fica só
-- auditado em `log_acoes_financeiras`, sem derrubar o processamento do
-- webhook. Ou seja: aplicar esta migration é o que liga o comportamento
-- novo (bloquear "Gerar autorização" quando INELIGIBLE, notificar o
-- profissional) — sem ela, o sistema continua exatamente como estava
-- antes da Fase 21, sem quebrar nada.

alter table public.empresas
  add column pix_automatico_status text not null default 'UNKNOWN';

alter table public.empresas
  add column pix_automatico_motivo text;

alter table public.empresas
  add column pix_automatico_atualizado_em timestamptz;

alter table public.empresas
  add constraint empresas_pix_automatico_status_valido
  check (pix_automatico_status = any (array['ELIGIBLE','INELIGIBLE','PENDING','UNKNOWN']));

comment on column public.empresas.pix_automatico_status is
  'Elegibilidade da conta para Pix Automático, segundo o Asaas (evento PIX_AUTOMATIC_RECURRING_ELIGIBILITY_UPDATED). UNKNOWN = nunca sincronizado; PENDING = reservado para verificação ativa futura, nenhum código grava ainda. Nunca decidido pelo Zelo — ver lib/core/elegibilidade-pix.ts.';
comment on column public.empresas.pix_automatico_motivo is
  'eligibility.ineligibleReasons do Asaas, concatenado — null quando o Asaas não informou motivo, ou nunca sincronizado.';
comment on column public.empresas.pix_automatico_atualizado_em is
  'Quando pix_automatico_status foi gravado pela última vez pelo webhook — null = nunca.';
