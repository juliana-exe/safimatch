-- ================================================================
-- Safimatch — Setup completo para Supabase Cloud
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em RUN
-- ================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- TABELA: perfis
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
    fotos           TEXT[]  DEFAULT '{}',
    foto_principal  TEXT,
    verificada      BOOLEAN NOT NULL DEFAULT FALSE,
    ativa           BOOLEAN NOT NULL DEFAULT TRUE,
    ultimo_acesso   TIMESTAMPTZ,
    telefone        TEXT,
    telefone_verificado BOOLEAN NOT NULL DEFAULT FALSE,
    premium         BOOLEAN DEFAULT FALSE,
    premium_ate     TIMESTAMPTZ,
    curtidas_hoje   INT DEFAULT 0,
    curtidas_reset_em DATE DEFAULT CURRENT_DATE,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT perfis_telefone_check CHECK (telefone IS NULL OR (telefone ~ '^[0-9]{10,11}$'))
);

-- TABELA: configuracoes_usuario
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

-- TABELA: curtidas
CREATE TABLE IF NOT EXISTS public.curtidas (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    de_user_id  UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    para_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    tipo        TEXT NOT NULL CHECK (tipo IN ('like', 'superlike', 'nope')),
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (de_user_id, para_user_id)
);

-- TABELA: matches
CREATE TABLE IF NOT EXISTS public.matches (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_a_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    usuario_b_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    status       TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'encerrado')),
    criado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (usuario_a_id, usuario_b_id)
);

-- TABELA: mensagens
CREATE TABLE IF NOT EXISTS public.mensagens (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id        UUID REFERENCES public.matches(id) ON DELETE CASCADE NOT NULL,
    de_user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    conteudo        TEXT CHECK (conteudo IS NULL OR char_length(conteudo) <= 2000),
    tipo            TEXT NOT NULL DEFAULT 'texto' CHECK (tipo IN ('texto', 'imagem', 'emoji', 'foto', 'foto_unica')),
    lida            BOOLEAN NOT NULL DEFAULT FALSE,
    foto_url        TEXT,
    view_once       BOOLEAN NOT NULL DEFAULT FALSE,
    view_once_visto BOOLEAN NOT NULL DEFAULT FALSE,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- TABELA: bloqueios
CREATE TABLE IF NOT EXISTS public.bloqueios (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    de_user_id   UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    para_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    criado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (de_user_id, para_user_id)
);

-- TABELA: denuncias
CREATE TABLE IF NOT EXISTS public.denuncias (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    de_user_id   UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    para_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    motivo       TEXT NOT NULL CHECK (motivo IN ('perfil_falso','conteudo_inapropriado','assedio','spam','menor_de_idade','outro')),
    descricao    TEXT,
    revisada     BOOLEAN NOT NULL DEFAULT FALSE,
    criado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- TABELA: pagamentos
CREATE TABLE IF NOT EXISTS public.pagamentos (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    correlation_id TEXT UNIQUE NOT NULL,
    valor_centavos INTEGER NOT NULL CHECK (valor_centavos > 0),
    status         TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','COMPLETED','EXPIRED','CANCELADO')),
    criado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    pago_em        TIMESTAMPTZ
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_perfis_user_id      ON public.perfis(user_id);
CREATE INDEX IF NOT EXISTS idx_perfis_ativa         ON public.perfis(ativa);
CREATE INDEX IF NOT EXISTS idx_perfis_nome_trgm     ON public.perfis USING GIN (nome gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_perfis_premium       ON public.perfis(premium) WHERE premium = TRUE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_perfis_telefone ON public.perfis(telefone) WHERE telefone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_curtidas_de_user     ON public.curtidas(de_user_id);
CREATE INDEX IF NOT EXISTS idx_curtidas_para_user   ON public.curtidas(para_user_id);
CREATE INDEX IF NOT EXISTS idx_matches_usuario_a    ON public.matches(usuario_a_id);
CREATE INDEX IF NOT EXISTS idx_matches_usuario_b    ON public.matches(usuario_b_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_match_id   ON public.mensagens(match_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_criado_em  ON public.mensagens(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_bloqueios_de_user    ON public.bloqueios(de_user_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_user_id   ON public.pagamentos(user_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_status    ON public.pagamentos(status);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('fotos-perfil','fotos-perfil',TRUE,5242880,ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS storage_upload ON storage.objects;
CREATE POLICY storage_upload ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id='fotos-perfil' AND (storage.foldername(name))[1]=auth.uid()::text);

DROP POLICY IF EXISTS storage_select ON storage.objects;
CREATE POLICY storage_select ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id='fotos-perfil');

DROP POLICY IF EXISTS storage_delete ON storage.objects;
CREATE POLICY storage_delete ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id='fotos-perfil' AND (storage.foldername(name))[1]=auth.uid()::text);

DROP POLICY IF EXISTS storage_update ON storage.objects;
CREATE POLICY storage_update ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id='fotos-perfil' AND (storage.foldername(name))[1]=auth.uid()::text)
    WITH CHECK (bucket_id='fotos-perfil' AND (storage.foldername(name))[1]=auth.uid()::text);

-- Triggers
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.atualizado_em = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS perfis_updated_at ON public.perfis;
CREATE TRIGGER perfis_updated_at BEFORE UPDATE ON public.perfis FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS config_updated_at ON public.configuracoes_usuario;
CREATE TRIGGER config_updated_at BEFORE UPDATE ON public.configuracoes_usuario FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.perfis (user_id, nome) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)));
    INSERT INTO public.configuracoes_usuario (user_id) VALUES (NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.verificar_match_mutuo()
RETURNS TRIGGER AS $$
DECLARE curtida_oposta UUID;
BEGIN
    IF NEW.tipo = 'nope' THEN RETURN NEW; END IF;
    SELECT id INTO curtida_oposta FROM public.curtidas
    WHERE de_user_id=NEW.para_user_id AND para_user_id=NEW.de_user_id AND tipo IN ('like','superlike');
    IF curtida_oposta IS NOT NULL THEN
        INSERT INTO public.matches (usuario_a_id, usuario_b_id)
        VALUES (LEAST(NEW.de_user_id,NEW.para_user_id), GREATEST(NEW.de_user_id,NEW.para_user_id))
        ON CONFLICT (usuario_a_id, usuario_b_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_curtida_created ON public.curtidas;
CREATE TRIGGER on_curtida_created AFTER INSERT ON public.curtidas FOR EACH ROW EXECUTE FUNCTION public.verificar_match_mutuo();

CREATE OR REPLACE FUNCTION public.verificar_premium_expirado()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.premium=TRUE AND NEW.premium_ate IS NOT NULL AND NEW.premium_ate < NOW() THEN
    NEW.premium := FALSE; NEW.premium_ate := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_premium_expiry ON public.perfis;
CREATE TRIGGER check_premium_expiry BEFORE UPDATE ON public.perfis FOR EACH ROW EXECUTE FUNCTION public.verificar_premium_expirado();

CREATE OR REPLACE FUNCTION public.check_curtida_limit()
RETURNS TRIGGER AS $$
DECLARE p RECORD;
BEGIN
  SELECT premium, curtidas_hoje, curtidas_reset_em, premium_ate INTO p FROM public.perfis WHERE user_id=NEW.de_user_id;
  IF p.premium=TRUE AND p.premium_ate IS NOT NULL AND p.premium_ate < NOW() THEN
    UPDATE public.perfis SET premium=FALSE, premium_ate=NULL WHERE user_id=NEW.de_user_id;
    p.premium := FALSE;
  END IF;
  IF p.curtidas_reset_em IS NULL OR p.curtidas_reset_em < CURRENT_DATE THEN
    UPDATE public.perfis SET curtidas_hoje=0, curtidas_reset_em=CURRENT_DATE WHERE user_id=NEW.de_user_id;
    p.curtidas_hoje := 0;
  END IF;
  IF NEW.tipo = 'nope' THEN RETURN NEW; END IF;
  IF NOT p.premium AND p.curtidas_hoje >= 10 THEN RAISE EXCEPTION 'limite_curtidas'; END IF;
  UPDATE public.perfis SET curtidas_hoje=curtidas_hoje+1 WHERE user_id=NEW.de_user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS before_curtida_limit ON public.curtidas;
CREATE TRIGGER before_curtida_limit BEFORE INSERT ON public.curtidas FOR EACH ROW EXECUTE FUNCTION public.check_curtida_limit();

-- RLS
ALTER TABLE public.perfis                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curtidas              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensagens             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bloqueios             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.denuncias             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamentos            ENABLE ROW LEVEL SECURITY;

-- Policies perfis
DROP POLICY IF EXISTS perfis_select_autenticadas ON public.perfis;
CREATE POLICY perfis_select_autenticadas ON public.perfis FOR SELECT TO authenticated
    USING (ativa=TRUE AND NOT EXISTS (SELECT 1 FROM public.bloqueios b WHERE (b.de_user_id=auth.uid() AND b.para_user_id=user_id) OR (b.de_user_id=user_id AND b.para_user_id=auth.uid())));

DROP POLICY IF EXISTS perfis_select_proprio ON public.perfis;
CREATE POLICY perfis_select_proprio ON public.perfis FOR SELECT TO authenticated USING (user_id=auth.uid());

DROP POLICY IF EXISTS perfis_insert ON public.perfis;
CREATE POLICY perfis_insert ON public.perfis FOR INSERT TO authenticated WITH CHECK (user_id=auth.uid());

DROP POLICY IF EXISTS perfis_update ON public.perfis;
CREATE POLICY perfis_update ON public.perfis FOR UPDATE TO authenticated USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid());

-- Policies config
DROP POLICY IF EXISTS config_todas_operacoes ON public.configuracoes_usuario;
CREATE POLICY config_todas_operacoes ON public.configuracoes_usuario FOR ALL TO authenticated USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid());

-- Policies curtidas
DROP POLICY IF EXISTS curtidas_select ON public.curtidas;
CREATE POLICY curtidas_select ON public.curtidas FOR SELECT TO authenticated USING (de_user_id=auth.uid() OR para_user_id=auth.uid());
DROP POLICY IF EXISTS curtidas_insert ON public.curtidas;
CREATE POLICY curtidas_insert ON public.curtidas FOR INSERT TO authenticated WITH CHECK (de_user_id=auth.uid() AND de_user_id!=para_user_id);
DROP POLICY IF EXISTS curtidas_delete ON public.curtidas;
CREATE POLICY curtidas_delete ON public.curtidas FOR DELETE TO authenticated USING (de_user_id=auth.uid());

-- Policies matches
DROP POLICY IF EXISTS matches_select ON public.matches;
CREATE POLICY matches_select ON public.matches FOR SELECT TO authenticated USING (usuario_a_id=auth.uid() OR usuario_b_id=auth.uid());

-- Policies mensagens
DROP POLICY IF EXISTS mensagens_select ON public.mensagens;
CREATE POLICY mensagens_select ON public.mensagens FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id=match_id AND (m.usuario_a_id=auth.uid() OR m.usuario_b_id=auth.uid())));
DROP POLICY IF EXISTS mensagens_insert ON public.mensagens;
CREATE POLICY mensagens_insert ON public.mensagens FOR INSERT TO authenticated
    WITH CHECK (de_user_id=auth.uid() AND EXISTS (SELECT 1 FROM public.matches m WHERE m.id=match_id AND m.status='ativo' AND (m.usuario_a_id=auth.uid() OR m.usuario_b_id=auth.uid())));
DROP POLICY IF EXISTS mensagens_update ON public.mensagens;
CREATE POLICY mensagens_update ON public.mensagens FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id=match_id AND (m.usuario_a_id=auth.uid() OR m.usuario_b_id=auth.uid())));

-- Policies bloqueios
DROP POLICY IF EXISTS bloqueios_select ON public.bloqueios;
CREATE POLICY bloqueios_select ON public.bloqueios FOR SELECT TO authenticated USING (de_user_id=auth.uid());
DROP POLICY IF EXISTS bloqueios_insert ON public.bloqueios;
CREATE POLICY bloqueios_insert ON public.bloqueios FOR INSERT TO authenticated WITH CHECK (de_user_id=auth.uid() AND de_user_id!=para_user_id);
DROP POLICY IF EXISTS bloqueios_delete ON public.bloqueios;
CREATE POLICY bloqueios_delete ON public.bloqueios FOR DELETE TO authenticated USING (de_user_id=auth.uid());

-- Policies denuncias
DROP POLICY IF EXISTS denuncias_insert ON public.denuncias;
CREATE POLICY denuncias_insert ON public.denuncias FOR INSERT TO authenticated WITH CHECK (de_user_id=auth.uid() AND de_user_id!=para_user_id);
DROP POLICY IF EXISTS denuncias_select_proprio ON public.denuncias;
CREATE POLICY denuncias_select_proprio ON public.denuncias FOR SELECT TO authenticated USING (de_user_id=auth.uid());

-- Policies pagamentos
DROP POLICY IF EXISTS pagamentos_select_proprio ON public.pagamentos;
CREATE POLICY pagamentos_select_proprio ON public.pagamentos FOR SELECT TO authenticated USING (user_id=auth.uid());
DROP POLICY IF EXISTS pagamentos_insert_proprio ON public.pagamentos;
CREATE POLICY pagamentos_insert_proprio ON public.pagamentos FOR INSERT TO authenticated WITH CHECK (user_id=auth.uid());

-- Views
CREATE OR REPLACE VIEW public.perfis_publicos AS
SELECT p.id, p.user_id, p.nome, p.bio, p.cidade, p.estado, p.orientacao, p.interesses,
       p.fotos, p.foto_principal, p.verificada, p.ultimo_acesso,
       EXTRACT(YEAR FROM AGE(NOW(), p.data_nascimento))::INTEGER AS idade,
       (p.ultimo_acesso > NOW() - INTERVAL '5 minutes') AS online_agora
FROM public.perfis p WHERE p.ativa = TRUE;

CREATE OR REPLACE VIEW public.matches_com_perfis AS
SELECT m.id AS match_id, m.status, m.criado_em AS match_em,
    CASE WHEN m.usuario_a_id=auth.uid() THEN pb.user_id ELSE pa.user_id END AS outra_user_id,
    CASE WHEN m.usuario_a_id=auth.uid() THEN pb.nome ELSE pa.nome END AS outra_nome,
    CASE WHEN m.usuario_a_id=auth.uid() THEN pb.foto_principal ELSE pa.foto_principal END AS outra_foto,
    CASE WHEN m.usuario_a_id=auth.uid() THEN pb.verificada ELSE pa.verificada END AS outra_verificada,
    CASE WHEN m.usuario_a_id=auth.uid() THEN (pb.ultimo_acesso > NOW()-INTERVAL '5 minutes') ELSE (pa.ultimo_acesso > NOW()-INTERVAL '5 minutes') END AS outra_online,
    (SELECT conteudo FROM public.mensagens WHERE match_id=m.id ORDER BY criado_em DESC LIMIT 1) AS ultima_msg,
    (SELECT criado_em FROM public.mensagens WHERE match_id=m.id ORDER BY criado_em DESC LIMIT 1) AS ultima_msg_em,
    (SELECT COUNT(*) FROM public.mensagens WHERE match_id=m.id AND lida=FALSE AND de_user_id!=auth.uid()) AS msgs_nao_lidas
FROM public.matches m
JOIN public.perfis pa ON pa.user_id=m.usuario_a_id
JOIN public.perfis pb ON pb.user_id=m.usuario_b_id
WHERE m.usuario_a_id=auth.uid() OR m.usuario_b_id=auth.uid();

-- ================================================================
-- FIM — Setup completo do Safimatch aplicado!
-- ================================================================

