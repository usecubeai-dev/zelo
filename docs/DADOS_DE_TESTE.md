# Dados de teste no banco de produção — como separar e como limpar com segurança

O banco do Supabase é **compartilhado** entre desenvolvimento, testes automatizados e produção. Por isso existem
contas e registros de teste ao lado dos reais. Nada é apagado automaticamente: este documento diz como **identificar**
o que é teste e como **limpar manualmente**, sem risco para dados reais.

## 1. Como saber o que é teste (somente leitura)

Toda suíte automatizada cria usuários com e-mail terminado em **`@zelo.test`** e empresas com prefixos próprios
(`E2E…`, `REC …`, `LC …`, `ZZ …`, `debug_…`, `Teste Limite`). Esses são os critérios de teste.

Rode o inventário (só imprime contagens, nenhum dado pessoal, não altera nada):

```bash
npx tsx tools/inventario-dados-de-teste.ts
```

Consultas equivalentes no editor SQL do Supabase (também somente leitura):

```sql
-- quantos usuários são de teste
select count(*) from auth.users where email ilike '%@zelo.test';

-- empresas de teste (pelo e-mail dos membros)
select e.id, e.nome, e.criada_em
from empresas e
join membros m on m.empresa_id = e.id
join auth.users u on u.id = m.user_id
where u.email ilike '%@zelo.test';

-- empresas que NÃO são de teste (conferir uma a uma antes de qualquer decisão)
select e.id, e.nome, e.criada_em
from empresas e
where e.deleted_at is null
  and not exists (
    select 1 from membros m join auth.users u on u.id = m.user_id
    where m.empresa_id = e.id and u.email ilike '%@zelo.test'
  );
```

Uma empresa só é "de teste" se **todos** os seus membros têm e-mail `@zelo.test`. Em caso de dúvida, trate como real.

## 2. Procedimento seguro de limpeza (manual, nunca automático)

1. **Backup antes de tudo.** No painel do Supabase, gere um backup (ou exporte as tabelas) e confirme que ele existe.
2. **Rode o inventário** e anote as contagens. Compare a lista de empresas "reais" com o que o proprietário conhece
   (contas de clientes de verdade, equipe, o próprio proprietário).
3. **Nunca limpe pelo nome da empresa sozinho.** Use o e-mail `@zelo.test` como critério principal.
4. **Primeiro um ensaio:** rode as consultas de contagem do item 1 para o lote que será removido e revise a lista.
5. **Remova por empresa, de dentro para fora.** As cobranças têm restrição (`RESTRICT`), então saem primeiro.
   A suíte de testes já faz isso corretamente em `limparContaE2E` (`tests/e2e/helpers.ts`) e na função `limpar()` de
   `tools/teste-conformidade-legal.ts`; use essa mesma ordem: comissões, taxas, mensalidades, pagamentos,
   cobranças, pedidos de reembolso, cancelamentos, aceites, clientes, serviços, notificações, log financeiro, e só
   no fim o usuário (`auth.users`).
6. **Faça em lotes pequenos** (por exemplo 5 empresas) e rode o inventário depois de cada lote.
7. **Não toque** em: empresas reais, `administradores_zelo`, influenciadores reais, `eventos_asaas` (histórico do
   webhook, útil para auditoria) e `aceites_legais` de contas reais.

## 3. O que NÃO fazer

- Não rodar `delete` sem `where`, nem sem conferir o lote antes.
- Não apagar `eventos_asaas` em massa: eles sustentam a idempotência do webhook.
- Não limpar enquanto uma suíte E2E estiver rodando (ela cria e apaga as próprias contas).
- Não usar o critério "tudo criado antes de uma data": há contas reais antigas.

## 4. Como evitar a mistura daqui para frente

Recomendação (decisão do proprietário, não implementada): usar um **projeto Supabase separado** para
desenvolvimento e testes, deixando o de produção só com dados reais. Enquanto isso não for feito, este
procedimento é o caminho seguro.
