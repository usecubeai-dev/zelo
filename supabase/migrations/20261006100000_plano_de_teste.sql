-- ZELO — plano de TESTE (R$ 1), só para o administrador validar o pagamento real.
--
-- Aditiva: apenas ACEITA o identificador 'teste' onde já existia a lista de
-- planos. Nenhum dado é alterado. Quem pode contratá-lo é decidido no servidor
-- (administrador do Zelo); o plano nunca aparece na página pública de preços.
-- O preço (R$ 1,00) vive só em lib/plano.ts, como o dos demais planos.

alter table public.empresas drop constraint if exists empresas_plano_valido;
alter table public.empresas
  add constraint empresas_plano_valido
  check (plano = any (array['gratis','essencial','negocio','escola','profissional','premium','teste']));

alter table public.empresas drop constraint if exists empresas_plano_escolhido_valido;
alter table public.empresas
  add constraint empresas_plano_escolhido_valido
  check (plano_escolhido is null or plano_escolhido = any (array['gratis','essencial','negocio','escola','profissional','premium','teste']));

alter table public.mensalidades drop constraint if exists mensalidades_plano_check;
alter table public.mensalidades
  add constraint mensalidades_plano_check
  check (plano = any (array['gratis','essencial','negocio','escola','profissional','premium','teste']));

-- limite de clientes: o teste tem o mesmo limite do Grátis (10)
create or replace function public.limite_de_clientes(p_plano text)
 returns integer
 language sql
 immutable
 set search_path to ''
as $function$
  select case p_plano
    when 'gratis'       then 10
    when 'teste'        then 10
    when 'essencial'    then 50
    when 'negocio'      then 200
    when 'profissional' then 200   -- identificador antigo = Negócio
    when 'escola'       then null  -- ilimitado
    when 'premium'      then null  -- identificador antigo = Escola
    else 10                        -- desconhecido cai no menor (Grátis)
  end
$function$;
