-- ZELO — Fim do mês grátis. APLICAR JUNTO DO DEPLOY do código novo.
--
-- Por que separado de 20261004000000: esta migration muda o comportamento
-- de quem se cadastra DEPOIS dela. O app antigo, ainda publicado, mostraria
-- "30 dias grátis" para uma conta que já nasce bloqueada. Aplicar só quando
-- o código novo (que explica a mensalidade) estiver no ar.
--
-- O que muda: toda empresa nova nasce 'pendente' (não liberada) e o prazo de
-- teste deixa de ser concedido. Contas 'trial' que já existem NÃO são
-- alteradas — `empresa_liberada` continua honrando o prazo que elas já têm
-- (decisão deliberada: não bloquear contas existentes de surpresa). Nenhuma
-- conta nova entra em 'trial'.
--
-- `empresa_liberada` NÃO muda: 'pendente' já não é 'ativa' nem 'trial', logo
-- o RLS (que usa a função) bloqueia criar clientes/cobranças/recorrências
-- até o primeiro pagamento confirmado — leitura continua liberada.

alter table public.empresas alter column assinatura_status set default 'pendente';
alter table public.empresas alter column trial_termina_em set default now();
