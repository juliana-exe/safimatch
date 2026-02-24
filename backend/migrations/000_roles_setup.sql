-- ================================================================
-- Safimatch — Configuração de roles e senhas Supabase
-- Migração: 000_roles_setup (deve rodar ANTES das demais)
-- Aplica: senhas dos roles internos do Supabase e permissões no banco
-- ================================================================

-- Atualiza senhas dos roles internos para corresponder a POSTGRES_PASSWORD
-- (usada pelos serviços auth, rest, storage)
DO $$
BEGIN
  ALTER ROLE supabase_auth_admin    LOGIN PASSWORD current_setting('app.POSTGRES_PASSWORD', true);
  ALTER ROLE authenticator          LOGIN PASSWORD current_setting('app.POSTGRES_PASSWORD', true);
  ALTER ROLE supabase_storage_admin LOGIN PASSWORD current_setting('app.POSTGRES_PASSWORD', true);
  ALTER ROLE pgbouncer              LOGIN PASSWORD current_setting('app.POSTGRES_PASSWORD', true);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Não foi possível alterar senhas via GUC, tente manualmente.';
END;
$$;

-- Permissões de banco para o storage
GRANT ALL ON DATABASE postgres TO supabase_storage_admin;
GRANT ALL ON SCHEMA storage TO supabase_storage_admin;
GRANT ALL ON SCHEMA public  TO supabase_storage_admin;
