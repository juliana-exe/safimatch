-- ================================================================
-- Safimatch — Suporte a fotos no chat
-- Migração: 003_mensagens_foto
-- ================================================================

-- Coluna para URL da foto enviada no chat
ALTER TABLE public.mensagens ADD COLUMN IF NOT EXISTS foto_url TEXT;

-- Suporte a "Foto de visualização única"
ALTER TABLE public.mensagens ADD COLUMN IF NOT EXISTS view_once       BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.mensagens ADD COLUMN IF NOT EXISTS view_once_visto BOOLEAN NOT NULL DEFAULT FALSE;

-- Permitir conteudo vazio para mensagens de foto pura (sem legenda)
ALTER TABLE public.mensagens ALTER COLUMN conteudo DROP NOT NULL;
ALTER TABLE public.mensagens DROP CONSTRAINT IF EXISTS mensagens_conteudo_check;
ALTER TABLE public.mensagens ADD CONSTRAINT mensagens_conteudo_check
    CHECK (conteudo IS NULL OR char_length(conteudo) <= 2000);

-- Ampliar o check de tipo para incluir foto e foto_unica
ALTER TABLE public.mensagens DROP CONSTRAINT IF EXISTS mensagens_tipo_check;
ALTER TABLE public.mensagens ADD CONSTRAINT mensagens_tipo_check
    CHECK (tipo IN ('texto', 'imagem', 'emoji', 'foto', 'foto_unica'));

-- Índice para buscas de fotos únicas não vizualizadas
CREATE INDEX IF NOT EXISTS idx_mensagens_view_once
    ON public.mensagens(match_id, view_once, view_once_visto)
    WHERE view_once = TRUE AND view_once_visto = FALSE;
