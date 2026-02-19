-- ================================================================
-- Safimatch — Schema do Banco de Dados
-- Banco: PostgreSQL 15 via Supabase
-- Migração: 001_schema_inicial
-- ================================================================

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";      -- busca por nome
CREATE EXTENSION IF NOT EXISTS "postgis";       -- coordenadas geográficas (opcional)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ================================================================
-- TABELA: perfis
-- ================================================================
CREATE TABLE IF NOT EXISTS public.perfis (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    nome            TEXT NOT NULL CHECK (char_length(nome) BETWEEN 2 AND 60),
    bio             TEXT CHECK (char_length(bio) <= 300),
    data_nascimento DATE CHECK (data_nascimento <= NOW() - INTERVAL '18 years'),
    cidade          TEXT,
    estado          TEXT,
    latitude        DOUBLE PRECISION,
    longitude       DOUBLE PRECISION,
    orientacao      TEXT CHECK (orientacao IN ('lesbica', 'bissexual', 'pansexual', 'outro', 'prefiro_nao_dizer')),
    interesses      TEXT[]  DEFAULT '{}',
    fotos           TEXT[]  DEFAULT '{}',    -- URLs do Supabase Storage
    foto_principal  TEXT,                    -- URL da foto principal
    verificada      BOOLEAN NOT NULL DEFAULT FALSE,
    ativa           BOOLEAN NOT NULL DEFAULT TRUE,
    ultimo_acesso   TIMESTAMPTZ,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================================================
-- TABELA: configuracoes_usuario
-- ================================================================
CREATE TABLE IF NOT EXISTS public.configuracoes_usuario (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    distancia_max_km    INTEGER NOT NULL DEFAULT 50 CHECK (distancia_max_km BETWEEN 5 AND 300),
    idade_min           INTEGER NOT NULL DEFAULT 18 CHECK (idade_min >= 18),
    idade_max           INTEGER NOT NULL DEFAULT 45 CHECK (idade_max <= 80),
    notif_match         BOOLEAN NOT NULL DEFAULT TRUE,
    notif_mensagem      BOOLEAN NOT NULL DEFAULT TRUE,
    notif_superlike     BOOLEAN NOT NULL DEFAULT TRUE,
    modo_invisivel      BOOLEAN NOT NULL DEFAULT FALSE,
    mostrar_distancia   BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT idade_valida CHECK (idade_min <= idade_max)
);

-- ================================================================
-- TABELA: curtidas
-- (guarda cada ação: like, superlike, nope)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.curtidas (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    de_user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    para_user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    tipo            TEXT NOT NULL CHECK (tipo IN ('like', 'superlike', 'nope')),
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (de_user_id, para_user_id)
);

-- ================================================================
-- TABELA: matches
-- (criado automaticamente cuando dois likes se cruzam)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.matches (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_a_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    usuario_b_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    status          TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'encerrado')),
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (usuario_a_id, usuario_b_id)
);

-- ================================================================
-- TABELA: mensagens
-- ================================================================
CREATE TABLE IF NOT EXISTS public.mensagens (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id        UUID REFERENCES public.matches(id) ON DELETE CASCADE NOT NULL,
    de_user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    conteudo        TEXT NOT NULL CHECK (char_length(conteudo) BETWEEN 1 AND 2000),
    tipo            TEXT NOT NULL DEFAULT 'texto' CHECK (tipo IN ('texto', 'imagem', 'emoji')),
    lida            BOOLEAN NOT NULL DEFAULT FALSE,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================================================
-- TABELA: bloqueios
-- ================================================================
CREATE TABLE IF NOT EXISTS public.bloqueios (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    de_user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    para_user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (de_user_id, para_user_id)
);

-- ================================================================
-- TABELA: denuncias
-- ================================================================
CREATE TABLE IF NOT EXISTS public.denuncias (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    de_user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    para_user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    motivo          TEXT NOT NULL CHECK (motivo IN (
                        'perfil_falso', 'conteudo_inapropriado',
                        'assedio', 'spam', 'menor_de_idade', 'outro'
                    )),
    descricao       TEXT,
    revisada        BOOLEAN NOT NULL DEFAULT FALSE,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================================================
-- ÍNDICES para performance
-- ================================================================
CREATE INDEX IF NOT EXISTS idx_perfis_user_id         ON public.perfis(user_id);
CREATE INDEX IF NOT EXISTS idx_perfis_ativa            ON public.perfis(ativa);
CREATE INDEX IF NOT EXISTS idx_perfis_nome_trgm        ON public.perfis USING GIN (nome gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_curtidas_de_user        ON public.curtidas(de_user_id);
CREATE INDEX IF NOT EXISTS idx_curtidas_para_user      ON public.curtidas(para_user_id);
CREATE INDEX IF NOT EXISTS idx_matches_usuario_a       ON public.matches(usuario_a_id);
CREATE INDEX IF NOT EXISTS idx_matches_usuario_b       ON public.matches(usuario_b_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_match_id      ON public.mensagens(match_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_criado_em     ON public.mensagens(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_bloqueios_de_user       ON public.bloqueios(de_user_id);

-- ================================================================
-- TRIGGERS: atualizar "atualizado_em" automaticamente
-- ================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER perfis_updated_at
    BEFORE UPDATE ON public.perfis
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER config_updated_at
    BEFORE UPDATE ON public.configuracoes_usuario
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ================================================================
-- TRIGGER: criar perfil + config automaticamente ao registrar usuária
-- ================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Insere perfil vazio
    INSERT INTO public.perfis (user_id, nome)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1))
    );
    -- Insere configurações padrão
    INSERT INTO public.configuracoes_usuario (user_id)
    VALUES (NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ================================================================
-- TRIGGER: criar match quando há curtida mútua
-- ================================================================
CREATE OR REPLACE FUNCTION public.verificar_match_mutuo()
RETURNS TRIGGER AS $$
DECLARE
    curtida_oposta UUID;
BEGIN
    -- Só processa likes e superlikes (não nope)
    IF NEW.tipo = 'nope' THEN
        RETURN NEW;
    END IF;

    -- Verifica se a outra usuária também deu like
    SELECT id INTO curtida_oposta
    FROM public.curtidas
    WHERE de_user_id = NEW.para_user_id
      AND para_user_id = NEW.de_user_id
      AND tipo IN ('like', 'superlike');

    -- Se houver curtida, cria o match (evita duplicata com ON CONFLICT)
    IF curtida_oposta IS NOT NULL THEN
        INSERT INTO public.matches (usuario_a_id, usuario_b_id)
        VALUES (
            LEAST(NEW.de_user_id, NEW.para_user_id),
            GREATEST(NEW.de_user_id, NEW.para_user_id)
        )
        ON CONFLICT (usuario_a_id, usuario_b_id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_curtida_created
    AFTER INSERT ON public.curtidas
    FOR EACH ROW EXECUTE FUNCTION public.verificar_match_mutuo();

-- ================================================================
-- TRIGGER: atualizar último acesso
-- ================================================================
CREATE OR REPLACE FUNCTION public.handle_ultimo_acesso()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.perfis
    SET ultimo_acesso = NOW()
    WHERE user_id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================================
-- ROW LEVEL SECURITY (RLS) — Proteção a nível de linha
-- ================================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.perfis                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes_usuario   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curtidas                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensagens               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bloqueios               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.denuncias               ENABLE ROW LEVEL SECURITY;

----- PERFIS ----------------------------------------------------
-- Qualquer usuária autenticada pode ver perfis ativos
CREATE POLICY perfis_select_autenticadas ON public.perfis
    FOR SELECT TO authenticated
    USING (
        ativa = TRUE
        AND NOT EXISTS (
            SELECT 1 FROM public.bloqueios b
            WHERE (b.de_user_id = auth.uid() AND b.para_user_id = user_id)
               OR (b.de_user_id = user_id AND b.para_user_id = auth.uid())
        )
    );

-- Só vê o próprio perfil (mesmo inativo)
CREATE POLICY perfis_select_proprio ON public.perfis
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Só pode inserir o próprio perfil
CREATE POLICY perfis_insert ON public.perfis
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Só pode atualizar o próprio perfil
CREATE POLICY perfis_update ON public.perfis
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

----- CONFIGURAÇÕES --------------------------------------------
CREATE POLICY config_todas_operacoes ON public.configuracoes_usuario
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

----- CURTIDAS -------------------------------------------------
-- Pode ver curtidas que ela fez
CREATE POLICY curtidas_select ON public.curtidas
    FOR SELECT TO authenticated
    USING (de_user_id = auth.uid() OR para_user_id = auth.uid());

-- Pode dar curtida (exceto em si mesma)
CREATE POLICY curtidas_insert ON public.curtidas
    FOR INSERT TO authenticated
    WITH CHECK (de_user_id = auth.uid() AND de_user_id != para_user_id);

-- Pode desfazer curtida
CREATE POLICY curtidas_delete ON public.curtidas
    FOR DELETE TO authenticated
    USING (de_user_id = auth.uid());

----- MATCHES --------------------------------------------------
CREATE POLICY matches_select ON public.matches
    FOR SELECT TO authenticated
    USING (usuario_a_id = auth.uid() OR usuario_b_id = auth.uid());

----- MENSAGENS ------------------------------------------------
-- Só pode ler mensagens dos seus matches
CREATE POLICY mensagens_select ON public.mensagens
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.matches m
            WHERE m.id = match_id
              AND (m.usuario_a_id = auth.uid() OR m.usuario_b_id = auth.uid())
        )
    );

-- Só pode enviar se for participante do match
CREATE POLICY mensagens_insert ON public.mensagens
    FOR INSERT TO authenticated
    WITH CHECK (
        de_user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.matches m
            WHERE m.id = match_id
              AND m.status = 'ativo'
              AND (m.usuario_a_id = auth.uid() OR m.usuario_b_id = auth.uid())
        )
    );

-- Só pode atualizar suas próprias mensagens (ex: marcar como lida)
CREATE POLICY mensagens_update ON public.mensagens
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.matches m
            WHERE m.id = match_id
              AND (m.usuario_a_id = auth.uid() OR m.usuario_b_id = auth.uid())
        )
    );

----- BLOQUEIOS ------------------------------------------------
CREATE POLICY bloqueios_select ON public.bloqueios
    FOR SELECT TO authenticated
    USING (de_user_id = auth.uid());

CREATE POLICY bloqueios_insert ON public.bloqueios
    FOR INSERT TO authenticated
    WITH CHECK (de_user_id = auth.uid() AND de_user_id != para_user_id);

CREATE POLICY bloqueios_delete ON public.bloqueios
    FOR DELETE TO authenticated
    USING (de_user_id = auth.uid());

----- DENÚNCIAS ------------------------------------------------
CREATE POLICY denuncias_insert ON public.denuncias
    FOR INSERT TO authenticated
    WITH CHECK (de_user_id = auth.uid() AND de_user_id != para_user_id);

CREATE POLICY denuncias_select_proprio ON public.denuncias
    FOR SELECT TO authenticated
    USING (de_user_id = auth.uid());

-- ================================================================
-- VIEWS úteis
-- ================================================================

-- Perfis com idade calculada dinamicamente
CREATE OR REPLACE VIEW public.perfis_publicos AS
SELECT
    p.id,
    p.user_id,
    p.nome,
    p.bio,
    p.cidade,
    p.estado,
    p.orientacao,
    p.interesses,
    p.fotos,
    p.foto_principal,
    p.verificada,
    p.ultimo_acesso,
    EXTRACT(YEAR FROM AGE(NOW(), p.data_nascimento))::INTEGER AS idade,
    -- online se acessou nos últimos 5 minutos
    (p.ultimo_acesso > NOW() - INTERVAL '5 minutes') AS online_agora
FROM public.perfis p
WHERE p.ativa = TRUE;

-- Matches com dados dos dois perfis
CREATE OR REPLACE VIEW public.matches_com_perfis AS
SELECT
    m.id AS match_id,
    m.status,
    m.criado_em AS match_em,
    -- se eu sou usuario_a, mostro perfil de b (e vice-versa)
    CASE WHEN m.usuario_a_id = auth.uid() THEN pb.user_id ELSE pa.user_id END AS outra_user_id,
    CASE WHEN m.usuario_a_id = auth.uid() THEN pb.nome ELSE pa.nome END AS outra_nome,
    CASE WHEN m.usuario_a_id = auth.uid() THEN pb.foto_principal ELSE pa.foto_principal END AS outra_foto,
    CASE WHEN m.usuario_a_id = auth.uid() THEN pb.verificada ELSE pa.verificada END AS outra_verificada,
    CASE WHEN m.usuario_a_id = auth.uid() THEN (pb.ultimo_acesso > NOW() - INTERVAL '5 minutes') ELSE (pa.ultimo_acesso > NOW() - INTERVAL '5 minutes') END AS outra_online,
    -- última mensagem
    (SELECT conteudo FROM public.mensagens WHERE match_id = m.id ORDER BY criado_em DESC LIMIT 1) AS ultima_msg,
    (SELECT criado_em FROM public.mensagens WHERE match_id = m.id ORDER BY criado_em DESC LIMIT 1) AS ultima_msg_em,
    (SELECT COUNT(*) FROM public.mensagens WHERE match_id = m.id AND lida = FALSE AND de_user_id != auth.uid()) AS msgs_nao_lidas
FROM public.matches m
JOIN public.perfis pa ON pa.user_id = m.usuario_a_id
JOIN public.perfis pb ON pb.user_id = m.usuario_b_id
WHERE m.usuario_a_id = auth.uid() OR m.usuario_b_id = auth.uid();

-- ================================================================
-- BUCKET de storage para fotos
-- ================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'fotos-perfil',
    'fotos-perfil',
    TRUE,       -- público para leitura
    5242880,    -- 5MB por foto
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Política de storage: usuária só pode fazer upload na sua pasta
CREATE POLICY storage_upload ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'fotos-perfil'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY storage_select ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'fotos-perfil');

CREATE POLICY storage_delete ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'fotos-perfil'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY storage_update ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'fotos-perfil'
        AND (storage.foldername(name))[1] = auth.uid()::text
    )
    WITH CHECK (
        bucket_id = 'fotos-perfil'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );
