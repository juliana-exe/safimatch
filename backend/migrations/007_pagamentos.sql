-- ================================================================
-- Safimatch — Migração 007: Tabela de Pagamentos Premium
-- ================================================================

CREATE TABLE IF NOT EXISTS public.pagamentos (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    correlation_id   TEXT UNIQUE NOT NULL,            -- ID da cobrança no OpenPix
    valor_centavos   INT NOT NULL DEFAULT 1990,       -- R$ 19,90
    status           TEXT NOT NULL DEFAULT 'PENDING'
                       CHECK (status IN ('PENDING', 'COMPLETED', 'EXPIRED', 'CANCELADO')),
    criado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    pago_em          TIMESTAMPTZ
);

-- Índice para buscas por user_id + status
CREATE INDEX IF NOT EXISTS pagamentos_user_id_status_idx
    ON public.pagamentos (user_id, status);

-- Ativa RLS (usuária só vê seus próprios pagamentos se precisar consultar)
ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;

-- A premium-api usa service role (ignora RLS), então as policies são
-- apenas para acesso direto futuro pelo app via Supabase client.
CREATE POLICY "usuarios_ver_proprios_pagamentos"
    ON public.pagamentos FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);
