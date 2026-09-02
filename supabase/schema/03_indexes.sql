-- ZELO — snapshot de schema (ver README.md nesta pasta)
-- Índices adicionais — NÃO inclui os índices que o Postgres já cria
-- automaticamente para cada PRIMARY KEY / UNIQUE de 02_constraints.sql
-- (ex.: clientes_pkey, clientes_id_empresa_unico, leads_email_unico,
-- notificacoes_empresa_id_chave_idempotencia_key, cobrancas_id_empresa_unico,
-- recorrencias_id_empresa_unico) — recriá-los aqui causaria erro de
-- "already exists". Definições extraídas literalmente via pg_indexes.

-- asaas_credenciais
create unique index asaas_credenciais_empresa_provider_unico on public.asaas_credenciais using btree (empresa_id, provider);

-- autorizacoes_pix
create unique index autorizacoes_pix_asaas_id_unico on public.autorizacoes_pix using btree (asaas_authorization_id) where (asaas_authorization_id is not null);
create index autorizacoes_pix_empresa_status_idx on public.autorizacoes_pix using btree (empresa_id, status);
create unique index autorizacoes_pix_uma_viva_por_recorrencia on public.autorizacoes_pix using btree (recorrencia_id) where (status = any (array['CREATED'::text, 'ACTIVE'::text]));

-- clientes
create unique index clientes_asaas_customer_id_unico on public.clientes using btree (asaas_customer_id) where (asaas_customer_id is not null);
create index clientes_busca on public.clientes using gin (to_tsvector('portuguese'::regconfig, ((coalesce(nome, ''::text) || ' '::text) || coalesce(email, ''::text))));
create unique index clientes_email_unico_por_empresa on public.clientes using btree (empresa_id, email) where ((email is not null) and (email <> ''::text));
create index clientes_empresa_status_nome on public.clientes using btree (empresa_id, status, nome);

-- cobrancas
create unique index cobrancas_asaas_payment_unico on public.cobrancas using btree (asaas_payment_id) where (asaas_payment_id is not null);
create unique index cobrancas_ciclo_unico on public.cobrancas using btree (recorrencia_id, vence_em) where (recorrencia_id is not null);
create index cobrancas_empresa_cliente on public.cobrancas using btree (empresa_id, cliente_id);
create index cobrancas_empresa_status_vence on public.cobrancas using btree (empresa_id, status, vence_em);
create index cobrancas_recorrencia on public.cobrancas using btree (recorrencia_id) where (recorrencia_id is not null);

-- empresas
create unique index empresas_asaas_account_id_unico on public.empresas using btree (asaas_account_id) where (asaas_account_id is not null);
create unique index empresas_provider_conta_unico on public.empresas using btree (provider, provider_account_id) where (provider_account_id is not null);

-- eventos_asaas
create index eventos_asaas_empresa_id_idx on public.eventos_asaas using btree (empresa_id);
create unique index eventos_asaas_provider_evento_unico on public.eventos_asaas using btree (provider, asaas_event_id);
create index idx_eventos_asaas_recebido_em on public.eventos_asaas using btree (recebido_em desc);
create index idx_eventos_asaas_tipo on public.eventos_asaas using btree (tipo);

-- instrucoes_pagamento
create unique index instrucoes_pagamento_asaas_id_unico on public.instrucoes_pagamento using btree (asaas_payment_id) where (asaas_payment_id is not null);
create unique index instrucoes_pagamento_asaas_instruction_id_unico on public.instrucoes_pagamento using btree (asaas_instruction_id) where (asaas_instruction_id is not null);
create index instrucoes_pagamento_empresa_status_idx on public.instrucoes_pagamento using btree (empresa_id, status);
create unique index instrucoes_pagamento_uma_por_cobranca on public.instrucoes_pagamento using btree (cobranca_id) where (status = any (array['AWAITING_REQUEST'::text, 'SCHEDULED'::text]));

-- log_acoes_financeiras
create index log_acoes_financeiras_empresa_idx on public.log_acoes_financeiras using btree (empresa_id, criado_em desc);

-- membros
create index membros_user_empresa on public.membros using btree (user_id, empresa_id);

-- notificacoes
create index notificacoes_empresa_nao_lidas on public.notificacoes using btree (empresa_id, criado_em desc) where (not lida);
create index notificacoes_empresa_todas on public.notificacoes using btree (empresa_id, criado_em desc);

-- pagamentos
create unique index pagamentos_asaas_id_unico on public.pagamentos using btree (asaas_payment_id);
create index pagamentos_empresa_idx on public.pagamentos using btree (empresa_id);

-- recorrencias
create index recorrencias_autorizacao_atual_idx on public.recorrencias using btree (autorizacao_atual_id);
create index recorrencias_empresa_status on public.recorrencias using btree (empresa_id, status);
