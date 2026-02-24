-- ================================================================
-- Safimatch — Suporte a telefone no perfil
-- Migração: 005_telefone
-- ================================================================

-- Coluna do número de telefone (armazenado só dígitos, ex: 11999999999)
ALTER TABLE public.perfis ADD COLUMN IF NOT EXISTS telefone TEXT;

-- Flag indicando se o telefone foi verificado via OTP
ALTER TABLE public.perfis ADD COLUMN IF NOT EXISTS telefone_verificado BOOLEAN NOT NULL DEFAULT FALSE;

-- Validação de formato: apenas dígitos, 10 ou 11 caracteres (DDD + número)
ALTER TABLE public.perfis DROP CONSTRAINT IF EXISTS perfis_telefone_check;
ALTER TABLE public.perfis ADD CONSTRAINT perfis_telefone_check
    CHECK (
        telefone IS NULL
        OR (telefone ~ '^[0-9]{10,11}$')
    );

-- Índice para busca por telefone (deduplicação, segurança)
CREATE UNIQUE INDEX IF NOT EXISTS idx_perfis_telefone
    ON public.perfis(telefone)
    WHERE telefone IS NOT NULL;
