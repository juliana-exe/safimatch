// Script para criar conta de teste para revisores do Google Play
// Uso: node backend/create_test_user.js SUA_SERVICE_ROLE_KEY

const SERVICE_KEY = process.argv[2];

if (!SERVICE_KEY) {
  console.error('❌ Passe a service_role key como argumento:');
  console.error('   node backend/create_test_user.js eyJhbGci...');
  process.exit(1);
}

const SUPABASE_URL = 'https://nujzwirwcdlkytgldfsp.supabase.co';
const TEST_EMAIL   = 'revisorgoogleplay@safimatch.com';
const TEST_PASS    = 'Teste@2026!';

async function main() {
  console.log('🔧 Criando usuária de teste...');

  // 1. Criar usuária no Auth
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'X-Supabase-Api-Version': '2024-01-01',
    },
    body: JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASS,
      email_confirm: true,
      user_metadata: { nome: 'Revisora Teste' },
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    if (data.msg?.includes('already been registered') || data.message?.includes('already')) {
      console.log('ℹ️  Usuária já existe — atualizando perfil...');
      // Buscar o ID
      const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?email=${TEST_EMAIL}`, {
        headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
      });
      const listData = await listRes.json();
      const userId = listData.users?.[0]?.id;
      if (userId) await upsertPerfil(userId, SERVICE_KEY, SUPABASE_URL);
      return;
    }
    console.error('❌ Erro ao criar usuária:', JSON.stringify(data));
    process.exit(1);
  }

  const userId = data.id;
  console.log('✅ Usuária criada! ID:', userId);

  // 2. Criar perfil
  await upsertPerfil(userId, SERVICE_KEY, SUPABASE_URL);

  console.log('\n🎉 Conta de teste pronta!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📧 E-mail:', TEST_EMAIL);
  console.log('🔑 Senha: ', TEST_PASS);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

async function upsertPerfil(userId, key, url) {
  const perfilRes = await fetch(`${url}/rest/v1/perfis?on_conflict=user_id`, {
    method: 'POST',
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify({
      user_id: userId,
      nome: 'Revisora Teste',
      bio: 'Conta de teste para revisão do Google Play.',
      cidade: 'Porto Velho',
      estado: 'RO',
      orientacao: 'bissexual',
      fotos: [],
      verificada: true,
    }),
  });

  if (perfilRes.ok) {
    console.log('✅ Perfil criado/atualizado!');
  } else {
    const err = await perfilRes.text();
    console.warn('⚠️  Perfil não criado (pode já existir):', err);
  }
}

main().catch(console.error);
