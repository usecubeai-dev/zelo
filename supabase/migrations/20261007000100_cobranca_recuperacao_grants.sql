-- ZELO — permissões e trava dos campos de pagamento/recuperação da cobrança.
--
-- `cobrancas` usa grant de UPDATE por coluna. Os campos novos precisam ser
-- liberados para o membro (editar uma cobrança AINDA NÃO enviada e marcar como
-- negociada). A trava abaixo garante, no banco, que depois de a cobrança existir
-- no Asaas a forma de pagamento e os encargos NÃO mudam mais — nem por chamada
-- direta à API.

grant update (forma_pagamento, multa_pct, juros_pct_mes, negociada_em) on public.cobrancas to authenticated;

create or replace function public.trava_pagamento_da_cobranca()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
begin
  if old.asaas_payment_id is not null
     and (new.forma_pagamento is distinct from old.forma_pagamento
          or new.multa_pct is distinct from old.multa_pct
          or new.juros_pct_mes is distinct from old.juros_pct_mes) then
    raise exception 'PAGAMENTO_TRAVADO: a cobranca ja foi enviada ao provedor; forma de pagamento e encargos nao mudam mais'
      using errcode = '23514';
  end if;
  return new;
end
$function$;

drop trigger if exists cobrancas_trava_pagamento on public.cobrancas;
create trigger cobrancas_trava_pagamento
  before update on public.cobrancas
  for each row execute function public.trava_pagamento_da_cobranca();
