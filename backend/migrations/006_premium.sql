-- ================================================================
-- 006_premium.sql — Safimatch Premium (ativação manual via admin)
-- ================================================================

-- Colunas de premium na tabela perfis
ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS premium           BOOLEAN   DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS premium_ate       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS curtidas_hoje     INT       DEFAULT 0,
  ADD COLUMN IF NOT EXISTS curtidas_reset_em DATE      DEFAULT CURRENT_DATE;

-- Índice para buscar quem tem premium ativo
CREATE INDEX IF NOT EXISTS idx_perfis_premium ON public.perfis (premium) WHERE premium = TRUE;

-- ================================================================
-- Função: desativa premium expirado automaticamente ao logar
-- ================================================================
CREATE OR REPLACE FUNCTION public.verificar_premium_expirado()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.premium = TRUE AND NEW.premium_ate IS NOT NULL AND NEW.premium_ate < NOW() THEN
    NEW.premium := FALSE;
    NEW.premium_ate := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_premium_expiry ON public.perfis;
CREATE TRIGGER check_premium_expiry
  BEFORE UPDATE ON public.perfis
  FOR EACH ROW EXECUTE FUNCTION public.verificar_premium_expirado();

-- ================================================================
-- Função: reseta curtidas diárias e bloqueia não-premium acima de 10
-- ================================================================
CREATE OR REPLACE FUNCTION public.check_curtida_limit()
RETURNS TRIGGER AS $$
DECLARE
  p RECORD;
BEGIN
  SELECT premium, curtidas_hoje, curtidas_reset_em, premium_ate
  INTO p FROM public.perfis WHERE user_id = NEW.de_user_id;

  -- Desativa premium expirado
  IF p.premium = TRUE AND p.premium_ate IS NOT NULL AND p.premium_ate < NOW() THEN
    UPDATE public.perfis SET premium = FALSE, premium_ate = NULL WHERE user_id = NEW.de_user_id;
    p.premium := FALSE;
  END IF;

  -- Reset diário de curtidas
  IF p.curtidas_reset_em IS NULL OR p.curtidas_reset_em < CURRENT_DATE THEN
    UPDATE public.perfis
      SET curtidas_hoje = 0, curtidas_reset_em = CURRENT_DATE
      WHERE user_id = NEW.de_user_id;
    p.curtidas_hoje := 0;
  END IF;

  -- Bloqueia nope sem custo (não conta limite)
  IF NEW.tipo = 'nope' THEN
    RETURN NEW;
  END IF;

  -- Bloqueia se não-premium e acima do limite
  IF NOT p.premium AND p.curtidas_hoje >= 10 THEN
    RAISE EXCEPTION 'limite_curtidas';
  END IF;

  -- Incrementa contador
  UPDATE public.perfis SET curtidas_hoje = curtidas_hoje + 1 WHERE user_id = NEW.de_user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS before_curtida_limit ON public.curtidas;
CREATE TRIGGER before_curtida_limit
  BEFORE INSERT ON public.curtidas
  FOR EACH ROW EXECUTE FUNCTION public.check_curtida_limit();

-- ================================================================
-- Permite que usuária autenticada leia seus próprios campos premium
-- ================================================================
-- (já coberto pela RLS existente de perfis, nenhuma policy nova necessária)

-- ================================================================
-- Como ativar premium para um usuário (rodar como admin):
--
--   UPDATE public.perfis
--     SET premium = TRUE,
--         premium_ate = NOW() + INTERVAL '30 days'
--     WHERE user_id = '<uuid-da-usuaria>';
--
-- ================================================================
