// backend/grant_permissions.js
// Concede permissões de acesso ao role authenticated/anon nas tabelas e views
// Uso: node backend/grant_permissions.js
// (Usa docker exec com psql — não requer credenciais externas)
const { execSync } = require('child_process');

const commands = [
  // Acesso ao schema
  'GRANT USAGE ON SCHEMA public TO anon, authenticated;',
  // SELECT em todas as tabelas e views
  'GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;',
  // SELECT explícito nas views
  'GRANT SELECT ON public.matches_com_perfis TO anon, authenticated;',
  'GRANT SELECT ON public.perfis_publicos TO anon, authenticated;',
  'GRANT SELECT ON public.configuracoes_usuario TO anon, authenticated;',
  // DML nas tabelas principais
  'GRANT INSERT, UPDATE, DELETE ON public.perfis TO authenticated;',
  'GRANT INSERT, UPDATE, DELETE ON public.curtidas TO authenticated;',
  'GRANT INSERT, UPDATE, DELETE ON public.matches TO authenticated;',
  'GRANT INSERT, UPDATE, DELETE ON public.mensagens TO authenticated;',
  'GRANT INSERT, UPDATE, DELETE ON public.configuracoes_usuario TO authenticated;',
  'GRANT INSERT, UPDATE, DELETE ON public.bloqueios TO authenticated;',
  'GRANT INSERT, UPDATE, DELETE ON public.denuncias TO authenticated;',
  // Sequences
  'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;',
].join('\n');

const sql = commands;

try {
  const result = execSync(
    `docker exec supabase-db psql -U postgres -d postgres -c "${sql.replace(/"/g, '\\"')}"`,
    { encoding: 'utf8', timeout: 15000 }
  );
  console.log('✅ GRANTs aplicados com sucesso!');
  console.log(result);
} catch (e) {
  console.error('❌ Erro ao aplicar GRANTs via docker exec.');
  console.error(e.message);
  
  // Tenta descobrir o nome do container do postgres
  try {
    const containers = execSync('docker ps --format "{{.Names}}" 2>&1', { encoding: 'utf8' });
    console.log('Containers disponíveis:', containers);
  } catch {}
}
