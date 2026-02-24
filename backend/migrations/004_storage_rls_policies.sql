-- ================================================================
-- Safimatch — Bucket fotos-perfil + RLS Policies do Storage
-- Migração: 004_storage_rls_policies
--
-- Cria o bucket "fotos-perfil" (público, 5 MB, imagens)
-- e define as policies de RLS para que usuários autenticados
-- possam fazer upload apenas na sua própria pasta ({userId}/).
-- ================================================================

-- Criar bucket fotos-perfil (idempotente)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'fotos-perfil',
    'fotos-perfil',
    TRUE,
    5242880,
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = TRUE,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

-- ================================================================
-- GRANTS em storage.buckets (necessário para authenticated ler metadados)
-- ================================================================
GRANT SELECT ON storage.buckets TO anon, authenticated, service_role;

-- Policy em storage.buckets: qualquer role autenticado pode listar buckets
DROP POLICY IF EXISTS "buckets_public_select" ON storage.buckets;
CREATE POLICY "buckets_public_select" ON storage.buckets
    FOR SELECT TO anon, authenticated, service_role
    USING (true);

-- ================================================================
-- GRANTS em storage.objects
-- ================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated, service_role;
GRANT SELECT ON storage.objects TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA storage TO authenticated, service_role;

-- Garantir que RLS está ativo em storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Remover policies antigas se existirem (para re-aplicação segura)
DROP POLICY IF EXISTS "fotos_perfil_select"  ON storage.objects;
DROP POLICY IF EXISTS "fotos_perfil_insert"  ON storage.objects;
DROP POLICY IF EXISTS "fotos_perfil_update"  ON storage.objects;
DROP POLICY IF EXISTS "fotos_perfil_delete"  ON storage.objects;

-- Leitura pública (bucket público → qualquer um pode ler)
CREATE POLICY "fotos_perfil_select" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id = 'fotos-perfil');

-- Upload: usuário autenticado só pode criar arquivos na sua pasta
CREATE POLICY "fotos_perfil_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'fotos-perfil'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- Atualização (upsert): só os próprios arquivos
CREATE POLICY "fotos_perfil_update" ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'fotos-perfil'
        AND (storage.foldername(name))[1] = auth.uid()::text
    )
    WITH CHECK (
        bucket_id = 'fotos-perfil'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- Exclusão: só os próprios arquivos
CREATE POLICY "fotos_perfil_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'fotos-perfil'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );
