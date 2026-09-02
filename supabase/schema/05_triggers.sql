-- ZELO — snapshot de schema (ver README.md nesta pasta)
-- Triggers — extraídas literalmente via pg_get_triggerdef() no banco de
-- origem. IMPORTANTE: o último trigger é em auth.users (schema gerenciado
-- pelo Supabase, não public) — é o que cria a empresa+membro automaticamente
-- no signup. Precisa de permissão para criar trigger em auth.users, que só
-- existe no ambiente do próprio Supabase (não roda num Postgres genérico).

create trigger clientes_atualizado_em before update on public.clientes for each row execute function toca_atualizado_em();
create trigger clientes_impoe_limite_do_plano before insert on public.clientes for each row execute function impoe_limite_de_clientes();

create trigger recorrencias_atualizado_em before update on public.recorrencias for each row execute function toca_atualizado_em();

create trigger autorizacoes_pix_toca_atualizado_em before update on public.autorizacoes_pix for each row execute function toca_atualizado_em();

create trigger cobrancas_atualizado_em before update on public.cobrancas for each row execute function toca_atualizado_em();

create trigger instrucoes_pagamento_toca_atualizado_em before update on public.instrucoes_pagamento for each row execute function toca_atualizado_em();

create trigger asaas_credenciais_toca_atualizado_em before update on public.asaas_credenciais for each row execute function toca_atualizado_em();

create trigger eventos_asaas_atualizado_em before update on public.eventos_asaas for each row execute function toca_atualizado_em();

create trigger leads_atualizado_em before update on public.leads for each row execute function leads_toca_atualizado_em();

create trigger ao_remover_membro after delete on public.membros for each row execute function remove_empresa_sem_membros();

-- Trigger em auth.users (schema do Supabase Auth):
create trigger ao_criar_usuario after insert on auth.users for each row execute function public.cria_empresa_do_novo_usuario();
