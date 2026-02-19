-- Cria roles necessários para PostgREST
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator NOINHERIT LOGIN;
  END IF;
END $$;

GRANT anon TO authenticator;
GRANT authenticated TO authenticator;
GRANT service_role TO authenticator;

-- Permissões de acesso ao schema
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- SELECT em todas as tabelas e views
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;

-- DML para usuárias autenticadas
GRANT INSERT, UPDATE, DELETE ON public.perfis TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.curtidas TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.matches TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.mensagens TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.configuracoes_usuario TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.bloqueios TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.denuncias TO authenticated;

-- Sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Verificar roles
SELECT rolname, rolcanlogin FROM pg_roles 
WHERE rolname IN ('anon','authenticated','authenticator','service_role')
ORDER BY rolname;
