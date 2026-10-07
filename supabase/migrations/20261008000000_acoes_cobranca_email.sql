-- ZELO — "Enviar por e-mail": novo tipo de ação registrada na cobrança.
--
-- Aditiva: só ACEITA mais um valor em `acoes_cobranca.tipo`. O envio é sempre um
-- clique do profissional; o registro serve para a "última ação", para limitar
-- reenvios e para o histórico da cobrança.

alter table public.acoes_cobranca drop constraint if exists acoes_cobranca_tipo_check;
alter table public.acoes_cobranca
  add constraint acoes_cobranca_tipo_check
  check (tipo in ('whatsapp','link_copiado','lembrete_whatsapp','email','negociada','reaberta'));
