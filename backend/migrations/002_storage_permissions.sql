-- ================================================================
-- Safimatch — Permissões do schema storage
-- Migração: 002_storage_permissions
-- 
-- O supabase/storage-api conecta como supabase_storage_admin e usa
-- SET ROLE para mudar para o role do usuário (anon, authenticated,
-- service_role). Sem USAGE no schema storage, a query "select from
-- buckets" falha com "relation does not exist".
-- ================================================================

-- Acesso ao schema storage para os roles da aplicação
GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;

-- service_role tem acesso total (bypassa RLS igualmente)
GRANT ALL ON ALL TABLES IN SCHEMA storage TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA storage TO service_role;

-- anon e authenticated só precisam de leitura em buckets
GRANT SELECT ON storage.buckets TO anon, authenticated;

-- anon e authenticated operam objetos via RLS (policies já definidas)
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA storage TO anon, authenticated;

-- search_path padrão para o role de login do storage
ALTER ROLE supabase_storage_admin SET search_path TO storage, public;

-- search_path padrão no banco (fallback para qualquer conexão)
ALTER DATABASE postgres SET search_path TO storage, public;
