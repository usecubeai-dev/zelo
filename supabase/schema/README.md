# Zelo — snapshot do schema Supabase

## O que é isto

Um **snapshot consolidado** (não uma sequência de migrations históricas) do
schema do banco Postgres do projeto Supabase de origem, capturado em um
único momento no tempo. Está aqui para tornar o schema atual reproduzível e
versionado — pré-requisito para criar um segundo ambiente (staging) sem
depender só do que existe no projeto de produção/dev atual.

**Por que snapshot, e não as 31 migrations reais?** Todas as 31 migrations
já aplicadas neste projeto foram executadas diretamente contra o banco
remoto via ferramenta MCP (`apply_migration`), ao longo de várias sessões,
e nunca foram salvas como arquivo `.sql` versionado — não existe pasta
`supabase/` neste repositório antes deste snapshot. Não há como reconstruir
o texto exato de cada uma das 31 migrations originais a partir do estado
atual do banco (o Postgres não guarda o SQL histórico de cada migration,
só o resultado final). Fabricar 31 arquivos fictícios simulando essa
história seria mentir sobre o que de fato aconteceu. Por isso, seguindo a
instrução explícita do projeto, isto é um **snapshot único e claramente
identificado como tal** — reproduz o estado final correto, sem fingir uma
história que não existe.

## Metadados do snapshot

| Campo | Valor |
|---|---|
| Data da captura | 2026-09-02 |
| Projeto Supabase de origem | `krwzohklsqdysdrfkjcd` (nome "Zelo", região `us-east-1`) |
| Método de extração | Introspecção SQL somente-leitura via `pg_catalog`/`information_schema` (ver "Método" abaixo) |
| Migrations remotas detectadas | 31 (timestamps `20260826114156` a `20260902124637`, sequenciais, sem gaps) |
| Arquivos `.sql` correspondentes a essas 31 migrations | 0 (nunca existiram neste repo) |
| Tabelas cobertas | 13 de 13 (100%) |
| Alterações feitas no banco de origem durante esta captura | Nenhuma — todas as queries foram `select` |

## Método usado (e por que)

Ambientes com `pg_dump`/`psql`/senha do Postgres disponíveis normalmente
rodariam `supabase db dump --project-ref ... --password ...`. Neste
ambiente:

- `pg_dump` e `psql` não estão instalados (confirmado via `which`).
- `npx supabase db dump` funciona, mas exige um de três parâmetros: `--linked`
  (precisa de `supabase link` prévio), `--db-url` (precisa da connection
  string completa com senha) ou `--project-ref` + `--password` (a senha do
  Postgres do projeto — uma credencial distinta da
  `SUPABASE_SERVICE_ROLE_KEY`, que não está em `.env.local` nem em nenhum
  outro lugar acessível neste ambiente).

Pedir essa senha ao usuário via chat seria inadequado (é uma credencial
sensível) e não era necessário: a ferramenta MCP de SQL do Supabase (acesso
já autorizado, somente leitura) permite reconstruir a DDL completa
consultando diretamente os catálogos do Postgres —
`information_schema.columns`, `pg_constraint` + `pg_get_constraintdef()`,
`pg_indexes`, `pg_trigger` + `pg_get_triggerdef()`, `pg_proc` +
`pg_get_functiondef()`, `pg_policies`, `pg_class.relrowsecurity`,
`pg_extension`. Essa foi a via mais segura disponível — nenhuma credencial
nova foi solicitada ou exposta, e nenhum comando alterou o banco.

## Estrutura dos arquivos

Dividido por tipo de objeto (não por ordem cronológica de criação) para
ficar legível. Execute nesta ordem para reconstruir o schema do zero:

1. `00_extensions.sql` — as 5 extensions do Postgres (todas padrão do
   Supabase, nenhuma custom): `uuid-ossp`, `pgcrypto`, `pg_stat_statements`
   (schema `extensions`), `supabase_vault` (schema `vault`), `plpgsql`
   (já vem por padrão em qualquer banco Postgres).
2. `01_tables.sql` — `CREATE TABLE` das 13 tabelas com colunas, tipos,
   defaults e `NOT NULL`, mais a `PRIMARY KEY` de cada uma. Sem
   `CHECK`/`UNIQUE`/`FOREIGN KEY` de propósito (ver nota abaixo).
3. `02_constraints.sql` — todo `CHECK`, `UNIQUE` e `FOREIGN KEY`, via
   `ALTER TABLE`, depois que as 13 tabelas já existem. Precisou ser
   separado do `CREATE TABLE` porque há referência cruzada real entre duas
   tabelas: `recorrencias.autorizacao_atual_id` referencia
   `autorizacoes_pix`, e `autorizacoes_pix.recorrencia_id` referencia
   `recorrencias` — nenhuma ordem linear de `CREATE TABLE` resolveria as
   duas ao mesmo tempo com FK inline.
4. `03_indexes.sql` — os 30 índices que não são criados automaticamente
   pelas constraints de `02_constraints.sql` (índices parciais, únicos
   compostos, full-text em `clientes`, etc.).
5. `04_functions.sql` — as 8 funções/RPCs do schema `public`.
6. `05_triggers.sql` — os 10 triggers em tabelas `public` + 1 trigger em
   `auth.users` (schema gerenciado pelo Supabase Auth — só pode ser criado
   dentro de um projeto Supabase real, não num Postgres genérico).
7. `06_rls.sql` — `ENABLE ROW LEVEL SECURITY` nas 13 tabelas + as 18
   policies existentes.

## Objetos incluídos

- **13 tabelas**, todas em `public`: `leads`, `empresas`, `membros`,
  `clientes`, `recorrencias`, `autorizacoes_pix`, `cobrancas`,
  `instrucoes_pagamento`, `pagamentos`, `asaas_credenciais`,
  `eventos_asaas`, `log_acoes_financeiras`, `notificacoes`. Confirmado via
  `information_schema.tables`: são as únicas 13 `BASE TABLE` do schema
  `public` — sem views, materialized views ou foreign tables.
- **Colunas**: 100% das colunas das 13 tabelas, com tipo, `NOT NULL` e
  `DEFAULT` exatos (incluindo defaults com expressão, como
  `trial_termina_em timestamptz default (now() + interval '30 days')`).
- **Constraints**: todos os `PRIMARY KEY`, `FOREIGN KEY` (incluindo as 5
  foreign keys compostas que reforçam "cliente/cobrança/recorrência
  pertence à mesma empresa" — um dos pilares do isolamento multi-tenant do
  projeto), `CHECK` (incluindo os que fazem o papel de enum — ver nota) e
  `UNIQUE`.
- **Índices**: os 30 índices adicionais (muitos parciais — ex.: só uma
  autorização Pix "viva" por recorrência — e um índice GIN de busca
  full-text em português sobre `clientes`).
- **Triggers**: os 10 em tabelas `public` (todos `BEFORE UPDATE` para
  `atualizado_em`, mais o de limite de clientes por plano e o de limpeza de
  empresa órfã) + o 1 em `auth.users` que cria empresa+membro no cadastro.
- **Funções/RPCs**: as 8 funções do schema `public`, incluindo as duas
  usadas dentro das RLS policies (`eh_membro`, `empresa_liberada`) — todas
  com `SET search_path TO ''` (proteção contra search_path hijacking) e
  referências com schema qualificado.
- **RLS**: confirmado `ENABLE ROW LEVEL SECURITY` nas 13 tabelas (nenhuma
  com `FORCE ROW LEVEL SECURITY`) + as 18 policies reais.
- **Extensions**: as 5 detalhadas acima.

### Nota — não existem ENUMs nativos do Postgres

Consultado `pg_type`/`pg_enum`: **zero** tipos `ENUM` customizados no
schema `public`. Todo valor "tipo enum" (`plano`, `assinatura_status`,
`status` de cobrança/recorrência/autorização, etc.) é implementado como
coluna `text` com `CHECK` — padrão consistente em todo o projeto. Isso já
está refletido corretamente em `01_tables.sql`/`02_constraints.sql`; não
falta nenhum `CREATE TYPE`.

### Nota — 3 tabelas com RLS habilitado e zero policies

`asaas_credenciais`, `eventos_asaas` e `leads` têm RLS habilitado mas
**nenhuma policy**. Isso não é uma omissão do snapshot — é o comportamento
real do banco de origem: RLS ligado sem nenhuma policy nega acesso por
padrão para `anon`/`authenticated` em toda operação; só a `service_role`
(que ignora RLS) lê/escreve nessas 3 tabelas. Faz sentido para o que elas
guardam — credenciais Asaas cifradas, payload bruto de webhook e captura de
lead — nenhuma pensada para acesso direto do navegador. Documentado com
comentário no topo de `06_rls.sql`.

## O que NÃO está incluído / limitações conhecidas

- **Dados** (linhas das tabelas) — isto é só schema/DDL, propositalmente.
  Nenhum dado de cliente, cobrança ou credencial foi copiado.
- **`auth.users`, `auth.*` em geral** — schema totalmente gerenciado pelo
  Supabase Auth; não faz sentido nem é possível recriá-lo via SQL solto.
  Um segundo projeto Supabase já nasce com esse schema pronto.
- **Grants/permissions das roles `anon`/`authenticated`/`service_role`
  nas tabelas** — não foram auditados nesta rodada porque são o padrão
  automático que o Supabase já aplica a qualquer projeto novo (não há
  indício, em nenhuma fase anterior do projeto, de grant customizado fora
  do padrão). Se isso importar para o Etapa 3, vale confirmar explicitamente
  antes de assumir.
- **Configuração do Supabase Auth** (provedores habilitados, URL de
  redirect, templates de e-mail, rate limit de SMTP) — não é schema de
  banco, fica fora do escopo deste snapshot. Já era um bloqueio conhecido
  de fases anteriores (SMTP no limite do provedor padrão do Supabase).
  `NEXT_PUBLIC_SITE_URL` e as env vars de auth precisarão ser configuradas
  à parte no segundo projeto.
- **Buckets de Storage** — o projeto não usa Supabase Storage em nenhum
  ponto verificado do código; não foi auditado explicitamente, mas não há
  evidência de uso.
- **Extensions **não** confirmadas em uso real** — as 5 listadas estão
  instaladas, mas isto não afirma que todas são efetivamente usadas pelo
  código da aplicação hoje (ex.: `pg_stat_statements` é observability
  padrão do Supabase, não algo que o código chama diretamente).
- **Teste de execução real deste SQL** — os arquivos foram validados
  manualmente (sintaxe, parênteses balanceados, ordem de dependência
  entre tabelas/constraints, ausência de segredos) mas **não foram
  executados** contra nenhum banco, porque isso exigiria ou (a) rodar
  contra o projeto atual — proibido explicitamente nesta etapa — ou (b)
  criar um segundo projeto Supabase — também proibido explicitamente nesta
  etapa. A validação por execução real fica para a Etapa 3, no momento em
  que o segundo projeto for de fato criado.

## Como reproduzir este schema em um projeto Supabase novo

1. Criar o projeto novo (fora do escopo desta etapa).
2. Rodar os 7 arquivos `.sql` desta pasta em ordem, via SQL Editor do
   Supabase Studio ou `psql`/`supabase db push` apontando para o projeto
   novo: `00` → `01` → `02` → `03` → `04` → `05` → `06`.
3. Conferir que as 13 tabelas, 18 policies e o trigger de signup
   (`ao_criar_usuario` em `auth.users`) existem no projeto novo.
4. Gerar um novo `ASAAS_CREDENTIALS_KEY` para esse ambiente — **não
   reutilizar** o key do projeto atual (linhas cifradas com uma chave não
   abrem com outra; a tabela `asaas_credenciais` está vazia hoje, então
   isso é só um cuidado para o futuro, não uma migração de dado real).
5. Configurar as 13 env vars do projeto (`.env.example` documenta todas)
   apontando para o projeto novo.

Este passo a passo (criar o projeto, rodar os arquivos, configurar env vars)
é exatamente o que a Etapa 3 fará — não foi executado aqui.
