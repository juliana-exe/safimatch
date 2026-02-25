-- ================================================================
-- Safimatch — Migração 008: Verificação de Identidade
-- ================================================================
-- Adiciona campos de verificação manual por selfie na tabela perfis.
-- Fluxo: usuária envia selfie com código aleatório → moderadora aprova/rejeita.

-- ── 1. Novos campos em perfis ─────────────────────────────────────────────────
ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS admin                    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS codigo_verificacao       TEXT,
  ADD COLUMN IF NOT EXISTS selfie_verificacao_url   TEXT,
  ADD COLUMN IF NOT EXISTS status_verificacao       TEXT NOT NULL DEFAULT 'nao_enviada'
    CHECK (status_verificacao IN ('nao_enviada', 'pendente', 'aprovada', 'rejeitada')),
  ADD COLUMN IF NOT EXISTS verificacao_enviada_em   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verificacao_analisada_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verificacao_obs          TEXT;    -- nota interna do moderador

-- ── 2. Índice para o painel admin (busca por pendentes) ──────────────────────
CREATE INDEX IF NOT EXISTS perfis_status_verificacao_idx
  ON public.perfis (status_verificacao)
  WHERE status_verificacao = 'pendente';

-- ── 3. Policies adicionais em perfis ────────────────────────────────────────
-- Usuária pode atualizar seus próprios campos de verificação
DROP POLICY IF EXISTS "usuarios_atualizar_verificacao" ON public.perfis;
CREATE POLICY "usuarios_atualizar_verificacao"
  ON public.perfis FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 4. Storage bucket "verificacoes" (privado) ──────────────────────────────
-- Execute no painel do Supabase → Storage → New Bucket:
--   Nome: verificacoes
--   Public: FALSE  (privado — apenas service_role e admin leem)
--
-- Ou via SQL (requer extensão storage habilitada):
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'verificacoes',
  'verificacoes',
  FALSE,                          -- bucket privado
  5242880,                        -- 5 MB máximo por arquivo
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Usuária pode fazer upload apenas para a pasta com seu próprio user_id
DROP POLICY IF EXISTS "verificacoes_upload_propria" ON storage.objects;
CREATE POLICY "verificacoes_upload_propria"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'verificacoes'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

-- Usuária pode ler/atualizar apenas o próprio arquivo
DROP POLICY IF EXISTS "verificacoes_leitura_propria" ON storage.objects;
CREATE POLICY "verificacoes_leitura_propria"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'verificacoes'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

-- Service role (admin / backend) tem acesso total — RLS não se aplica ao service_role.

-- ── 5. Função admin para aprovar verificação ────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_aprovar_verificacao(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER   -- roda com permissões do owner (postgres)
AS $$
BEGIN
  UPDATE public.perfis
  SET
    verificada                = TRUE,
    status_verificacao        = 'aprovada',
    verificacao_analisada_em  = NOW()
  WHERE user_id = p_user_id;
END;
$$;

-- ── 6. Função admin para rejeitar verificação ───────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_rejeitar_verificacao(p_user_id UUID, p_obs TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.perfis
  SET
    verificada                = FALSE,
    status_verificacao        = 'rejeitada',
    verificacao_analisada_em  = NOW(),
    verificacao_obs           = p_obs
  WHERE user_id = p_user_id;
END;
$$;
