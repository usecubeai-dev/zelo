-- ZELO — snapshot de schema (ver README.md nesta pasta)
-- CHECK, UNIQUE e FOREIGN KEY de todas as tabelas — via ALTER TABLE, depois
-- que todas as tabelas já existem (evita problema de ordenação com as duas
-- referências cruzadas recorrencias <-> autorizacoes_pix).
-- Definições extraídas literalmente via pg_get_constraintdef() no banco de origem.

-- ===== asaas_credenciais =====
alter table public.asaas_credenciais
  add constraint asaas_credenciais_empresa_id_fkey foreign key (empresa_id) references public.empresas(id) on delete cascade;

-- ===== clientes =====
alter table public.clientes
  add constraint clientes_id_empresa_unico unique (id, empresa_id);
alter table public.clientes
  add constraint clientes_asaas_sync_status_check check (asaas_sync_status = any (array['pendente','sincronizando','sincronizado','erro']));
alter table public.clientes
  add constraint clientes_email_minusculo check (email is null or email = lower(email));
alter table public.clientes
  add constraint clientes_status_check check (status = any (array['ativo','arquivado']));
alter table public.clientes
  add constraint clientes_empresa_id_fkey foreign key (empresa_id) references public.empresas(id) on delete cascade;

-- ===== recorrencias =====
alter table public.recorrencias
  add constraint recorrencias_id_empresa_unico unique (id, empresa_id);
alter table public.recorrencias
  add constraint recorrencias_dia_vencimento_check check (dia_vencimento >= 1 and dia_vencimento <= 28);
alter table public.recorrencias
  add constraint recorrencias_periodicidade_check check (periodicidade = 'mensal');
alter table public.recorrencias
  add constraint recorrencias_status_check check (status = any (array['ativa','pausada','encerrada']));
alter table public.recorrencias
  add constraint recorrencias_valor_centavos_check check (valor_centavos > 0);
alter table public.recorrencias
  add constraint recorrencias_empresa_id_fkey foreign key (empresa_id) references public.empresas(id) on delete cascade;
alter table public.recorrencias
  add constraint recorrencias_cliente_da_empresa foreign key (cliente_id, empresa_id) references public.clientes(id, empresa_id) on delete restrict;

-- ===== autorizacoes_pix =====
alter table public.autorizacoes_pix
  add constraint autorizacoes_pix_status_check check (status = any (array['CREATED','ACTIVE','CANCELLED','REFUSED','EXPIRED']));
alter table public.autorizacoes_pix
  add constraint autorizacoes_pix_empresa_id_fkey foreign key (empresa_id) references public.empresas(id) on delete cascade;
alter table public.autorizacoes_pix
  add constraint autorizacoes_pix_recorrencia_id_fkey foreign key (recorrencia_id) references public.recorrencias(id) on delete restrict;
alter table public.autorizacoes_pix
  add constraint autorizacoes_pix_recorrencia_da_empresa foreign key (recorrencia_id, empresa_id) references public.recorrencias(id, empresa_id);
alter table public.autorizacoes_pix
  add constraint autorizacoes_pix_cliente_da_empresa foreign key (cliente_id, empresa_id) references public.clientes(id, empresa_id);

-- ===== recorrencias: FK adiada até autorizacoes_pix existir =====
alter table public.recorrencias
  add constraint recorrencias_autorizacao_atual_id_fkey foreign key (autorizacao_atual_id) references public.autorizacoes_pix(id) on delete set null;

-- ===== cobrancas =====
alter table public.cobrancas
  add constraint cobrancas_id_empresa_unico unique (id, empresa_id);
alter table public.cobrancas
  add constraint cobrancas_asaas_sync_status_check check (asaas_sync_status = any (array['pendente','sincronizando','sincronizado','erro']));
alter table public.cobrancas
  add constraint cobrancas_pagamento_coerente check (
    (status = any (array['paga','estornada']) and pago_em is not null and pago_via is not null)
    or (status <> all (array['paga','estornada']) and pago_em is null and pago_via is null)
  );
alter table public.cobrancas
  add constraint cobrancas_pago_via_check check (pago_via is null or pago_via = any (array['asaas','manual']));
alter table public.cobrancas
  add constraint cobrancas_status_check check (status = any (array['pendente','enviada','paga','cancelada','estornada']));
alter table public.cobrancas
  add constraint cobrancas_valor_centavos_check check (valor_centavos > 0);
alter table public.cobrancas
  add constraint cobrancas_valor_estornado_centavos_check check (valor_estornado_centavos is null or valor_estornado_centavos > 0);
alter table public.cobrancas
  add constraint cobrancas_valor_pago_centavos_check check (valor_pago_centavos is null or valor_pago_centavos > 0);
alter table public.cobrancas
  add constraint cobrancas_empresa_id_fkey foreign key (empresa_id) references public.empresas(id) on delete cascade;
alter table public.cobrancas
  add constraint cobrancas_cliente_da_empresa foreign key (cliente_id, empresa_id) references public.clientes(id, empresa_id) on delete restrict;
alter table public.cobrancas
  add constraint cobrancas_recorrencia_da_empresa foreign key (recorrencia_id, empresa_id) references public.recorrencias(id, empresa_id) on delete set null;

-- ===== instrucoes_pagamento =====
alter table public.instrucoes_pagamento
  add constraint instrucoes_pagamento_status_check check (status = any (array['AWAITING_REQUEST','SCHEDULED','DONE','CANCELLED','REFUSED']));
alter table public.instrucoes_pagamento
  add constraint instrucoes_pagamento_empresa_id_fkey foreign key (empresa_id) references public.empresas(id) on delete cascade;
alter table public.instrucoes_pagamento
  add constraint instrucoes_pagamento_autorizacao_id_fkey foreign key (autorizacao_id) references public.autorizacoes_pix(id) on delete restrict;
alter table public.instrucoes_pagamento
  add constraint instrucoes_pagamento_cobranca_da_empresa foreign key (cobranca_id, empresa_id) references public.cobrancas(id, empresa_id);

-- ===== pagamentos =====
alter table public.pagamentos
  add constraint pagamentos_taxa_centavos_check check (taxa_centavos >= 0);
alter table public.pagamentos
  add constraint pagamentos_valor_liquido_centavos_check check (valor_liquido_centavos > 0);
alter table public.pagamentos
  add constraint pagamentos_empresa_id_fkey foreign key (empresa_id) references public.empresas(id) on delete cascade;
alter table public.pagamentos
  add constraint pagamentos_instrucao_id_fkey foreign key (instrucao_id) references public.instrucoes_pagamento(id) on delete restrict;

-- ===== empresas =====
alter table public.empresas
  add constraint empresas_asaas_status_valido check (asaas_status = any (array['pendente','ativa','recusada']));
alter table public.empresas
  add constraint empresas_assinatura_status_check check (assinatura_status = any (array['trial','ativa','inadimplente','cancelada']));
alter table public.empresas
  add constraint empresas_plano_valido check (plano = any (array['essencial','profissional','premium']));
alter table public.empresas
  add constraint empresas_provider_aprovacao_valida check (provider_aprovacao is null or provider_aprovacao = any (array['PENDING','AWAITING_APPROVAL','APPROVED','REJECTED']));
alter table public.empresas
  add constraint empresas_provider_status_valido check (provider_status = any (array['pendente','criando','ativa','recusada','bloqueada']));
alter table public.empresas
  add constraint empresas_provider_valido check (provider = any (array['asaas','openpix']));

-- ===== eventos_asaas =====
alter table public.eventos_asaas
  add constraint eventos_asaas_empresa_id_fkey foreign key (empresa_id) references public.empresas(id) on delete set null;

-- ===== leads =====
alter table public.leads
  add constraint leads_email_unico unique (email);
alter table public.leads
  add constraint leads_email_minusculo check (email = lower(email));

-- ===== log_acoes_financeiras =====
alter table public.log_acoes_financeiras
  add constraint log_acoes_financeiras_empresa_id_fkey foreign key (empresa_id) references public.empresas(id) on delete cascade;
alter table public.log_acoes_financeiras
  add constraint log_acoes_financeiras_usuario_id_fkey foreign key (usuario_id) references auth.users(id) on delete set null;

-- ===== membros =====
alter table public.membros
  add constraint membros_papel_check check (papel = any (array['dono','membro']));
alter table public.membros
  add constraint membros_empresa_id_fkey foreign key (empresa_id) references public.empresas(id) on delete cascade;
alter table public.membros
  add constraint membros_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

-- ===== notificacoes =====
alter table public.notificacoes
  add constraint notificacoes_empresa_id_chave_idempotencia_key unique (empresa_id, chave_idempotencia);
alter table public.notificacoes
  add constraint notificacoes_prioridade_check check (prioridade = any (array['baixa','media','alta']));
alter table public.notificacoes
  add constraint notificacoes_empresa_id_fkey foreign key (empresa_id) references public.empresas(id) on delete cascade;
