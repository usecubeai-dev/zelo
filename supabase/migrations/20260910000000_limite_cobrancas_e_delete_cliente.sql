-- ZELO — Execução autônoma pós-redesign.
--
-- ✅ APLICADA em produção em 11/09/2026 (MCP do Supabase, projeto Zelo
-- krwzohklsqdysdrfkjcd), em duas instruções: a policy abaixo, e depois
-- um `grant delete on public.clientes to authenticated` (ver por quê no
-- bloco "GRANT" mais abaixo — descoberto só ao testar ao vivo). Confirmado
-- com `tools/teste-delete-cliente-rls.ts`: 3/3 passou (antes: 2/3, com
-- "permission denied for table clientes").
--
-- HISTÓRICO DESTE ARQUIVO: a versão original (mesma data) continha DOIS
-- itens — um trigger de limite mensal de cobranças, e esta policy de
-- DELETE. Verificado ao vivo depois, com testes reais contra a produção
-- (tools/teste-limite-cobrancas-mensal.ts, 6/6 passou): o trigger de
-- limite de cobranças JÁ EXISTE e já funciona — o schema snapshot em
-- supabase/schema/ (capturado 02/09/2026) está desatualizado, não o
-- banco. Removido daqui para não tentar recriar algo que já existe.
--
-- O item abaixo foi confirmado como gap real, também ao vivo
-- (tools/teste-delete-cliente-rls.ts): um usuário autenticado normal,
-- tentando excluir o PRÓPRIO cliente sem histórico, recebe
-- "permission denied for table clientes" — RLS habilitado, sem
-- nenhuma policy de DELETE. Confirma a leitura do snapshot.

-- ============================================================
-- Policy de DELETE ausente em `clientes`
-- ============================================================
-- `excluirCliente()` (app/(app)/app/clientes/acoes.ts) usa o client de
-- SESSÃO (RLS ativo, não o admin) para `.delete()`. Sem policy de
-- delete, toda exclusão real afeta 0 linhas / recebe "permission
-- denied" — o botão "Excluir" na ficha do cliente não funciona para
-- nenhum usuário real hoje. "Arquivar" (UPDATE, tem policy, funciona)
-- é o caminho normal — mas "Excluir" existe na UI e deveria funcionar
-- quando não há histórico (a FK RESTRICT de `cobrancas.cliente_id` já
-- impede excluir cliente com cobrança, então esta policy não abre
-- brecha nenhuma além do que a própria UI já oferece).
--
-- Mesmo critério de autorização da policy de UPDATE já existente
-- (qualquer membro da empresa, não só o dono).
create policy "membro exclui clientes" on public.clientes
  for delete to authenticated
  using (eh_membro(empresa_id));

-- ============================================================
-- GRANT — necessário além da policy acima
-- ============================================================
-- `clientes` usa grants por COLUNA para INSERT/UPDATE (não por tabela
-- inteira) — padrão deliberado deste projeto para restringir quais
-- colunas cada operação pode tocar (ver migrations `restringe_*`).
-- DELETE não tem equivalente por coluna: exige grant de tabela inteira,
-- que nunca existiu para `authenticated` nesta tabela. Sem isto, a
-- policy acima sozinha não é suficiente — o Postgres nega no nível de
-- grant antes mesmo de avaliar a RLS, com o mesmo erro genérico
-- "permission denied for table clientes" que mascarava os dois
-- problemas como se fossem um só. Descoberto ao testar ao vivo
-- (`has_table_privilege('authenticated', 'public.clientes', 'DELETE')`
-- retornava `false` mesmo depois da policy existir).
grant delete on public.clientes to authenticated;
