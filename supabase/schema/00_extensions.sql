-- ZELO — snapshot de schema (ver README.md nesta pasta)
-- Extensões instaladas no projeto Supabase de origem (krwzohklsqdysdrfkjcd).
-- Todas padrão do Supabase; nenhuma custom.

create extension if not exists "uuid-ossp"        with schema extensions;
create extension if not exists "pgcrypto"          with schema extensions;
create extension if not exists "pg_stat_statements" with schema extensions;
create extension if not exists "supabase_vault"    with schema vault;
-- plpgsql já vem habilitada por padrão em qualquer banco Postgres novo.
