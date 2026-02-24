// backend/seed_test.js
// Cria contas de teste para o Safimatch
// Uso: node backend/seed_test.js
// Requer: arquivo .env na raiz do projeto com SERVICE_ROLE_KEY
// ─────────────────────────────────────────────────────────────────

const fs   = require('fs');
const path = require('path');

// Carrega variáveis do .env (sem precisar de dotenv como dependência)
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) return;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (key && !(key in process.env)) process.env[key] = val;
  });
}

const SUPABASE_URL = process.env.API_EXTERNAL_URL || 'http://localhost:8000';
const SERVICE_KEY  = process.env.SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error('\u274c SERVICE_ROLE_KEY n\u00e3o encontrado.');
  console.error('Certifique-se de que o arquivo .env existe na raiz do projeto.');
  process.exit(1);
}

const headers = {
  'Content-Type':  'application/json',
  'apikey':        SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
};

// ─── Contas de teste ─────────────────────────────────────────────
// Senha de todas: Test@12345
const CONTAS = [
  {
    email: 'ana@safimatch.test',
    nome:  'Ana Lima',
    bio:   'Amo viajar, tomar café e descobrir lugares novos 🌎☕',
    data_nascimento: '1998-03-12',
    cidade: 'São Paulo',
    estado: 'SP',
    orientacao: 'lesbica',
    interesses: ['Viagem', 'Música', 'Fotografia'],
    latitude: -23.5505, longitude: -46.6333,
    foto_principal: 'https://randomuser.me/api/portraits/women/44.jpg',
    fotos: [
      'https://randomuser.me/api/portraits/women/44.jpg',
      'https://randomuser.me/api/portraits/women/45.jpg',
    ],
  },
  {
    email: 'beatriz@safimatch.test',
    nome:  'Beatriz Souza',
    bio:   'Artista visual, apaixonada por cinema e gastronomia 🎨🍿',
    data_nascimento: '1996-07-24',
    cidade: 'Rio de Janeiro',
    estado: 'RJ',
    orientacao: 'bissexual',
    interesses: ['Arte', 'Cinema', 'Culinária'],
    latitude: -22.9068, longitude: -43.1729,
    foto_principal: 'https://randomuser.me/api/portraits/women/68.jpg',
    fotos: [
      'https://randomuser.me/api/portraits/women/68.jpg',
      'https://randomuser.me/api/portraits/women/69.jpg',
    ],
  },
  {
    email: 'camila@safimatch.test',
    nome:  'Camila Torres',
    bio:   'Personal trainer & yoga nerd. Amo a vida saudável 🧘‍♀️💪',
    data_nascimento: '2000-11-05',
    cidade: 'Belo Horizonte',
    estado: 'MG',
    orientacao: 'pansexual',
    interesses: ['Yoga', 'Esportes', 'Natureza'],
    latitude: -19.9167, longitude: -43.9345,
    foto_principal: 'https://randomuser.me/api/portraits/women/32.jpg',
    fotos: [
      'https://randomuser.me/api/portraits/women/32.jpg',
      'https://randomuser.me/api/portraits/women/33.jpg',
    ],
  },
  {
    email: 'daniela@safimatch.test',
    nome:  'Daniela Martins',
    bio:   'Leitora voraz, ouvinte de jazz e amante de gatos 📚🐱',
    data_nascimento: '1994-05-18',
    cidade: 'Curitiba',
    estado: 'PR',
    orientacao: 'lesbica',
    interesses: ['Leitura', 'Música', 'Arte'],
    latitude: -25.4290, longitude: -49.2671,
    foto_principal: 'https://randomuser.me/api/portraits/women/55.jpg',
    fotos: [
      'https://randomuser.me/api/portraits/women/55.jpg',
      'https://randomuser.me/api/portraits/women/56.jpg',
    ],
  },
  {
    email: 'elisa@safimatch.test',
    nome:  'Elisa Ferreira',
    bio:   'Dev apaixonada por tecnologia e gaming 🎮💻',
    data_nascimento: '1999-09-30',
    cidade: 'Porto Alegre',
    estado: 'RS',
    orientacao: 'bissexual',
    interesses: ['Tecnologia', 'Gaming', 'Cinema'],
    latitude: -30.0346, longitude: -51.2177,
    foto_principal: 'https://randomuser.me/api/portraits/women/21.jpg',
    fotos: [
      'https://randomuser.me/api/portraits/women/21.jpg',
      'https://randomuser.me/api/portraits/women/22.jpg',
    ],
  },
];

// ─── Utilitários ──────────────────────────────────────────────────
async function req(method, path, body) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try { return { status: res.status, data: JSON.parse(text) }; }
  catch { return { status: res.status, data: text }; }
}

function log(emoji, msg) {
  console.log(`${emoji}  ${msg}`);
}

// ─── Criar usuária via GoTrue Admin ─────────────────────────────
async function criarUsuaria(conta) {
  const { status, data } = await req('POST', '/auth/v1/admin/users', {
    email:          conta.email,
    password:       'Test@12345',
    email_confirm:  true,
    user_metadata:  { nome: conta.nome },
  });

  if (status === 200 || status === 201) {
    return data.id;
  }
  // Já existe — buscar pelo email
  if (status === 422 && JSON.stringify(data).includes('already been registered')) {
    log('⚠️', `${conta.email} já existe — buscando ID...`);
    const { data: lista } = await req('GET', '/auth/v1/admin/users?page=1&per_page=50');
    const users = lista.users || lista;
    const user = users.find(u => u.email === conta.email);
    return user?.id;
  }
  throw new Error(`Erro ao criar ${conta.email}: ${JSON.stringify(data)}`);
}

// ─── Atualizar perfil via PostgREST ──────────────────────────────
async function atualizarPerfil(userId, conta) {
  const { status, data } = await req('PATCH', `/rest/v1/perfis?user_id=eq.${userId}`, {
    bio:              conta.bio,
    data_nascimento:  conta.data_nascimento,
    cidade:           conta.cidade,
    estado:           conta.estado,
    orientacao:       conta.orientacao,
    interesses:       conta.interesses,
    latitude:         conta.latitude,
    longitude:        conta.longitude,
    foto_principal:   conta.foto_principal,
    fotos:            conta.fotos,
    atualizado_em:    new Date().toISOString(),
  });
  if (status >= 400) throw new Error(`Perfil ${conta.email}: ${JSON.stringify(data)}`);
}

// ─── Criar curtida ────────────────────────────────────────────────
async function criarCurtida(deId, paraId, tipo = 'like') {
  await req('POST', '/rest/v1/curtidas', {
    de_user_id:   deId,
    para_user_id: paraId,
    tipo,
  });
}

// ─── Criar mensagem ───────────────────────────────────────────────
async function criarMensagem(matchId, deId, conteudo) {
  await req('POST', '/rest/v1/mensagens', {
    match_id:   matchId,
    de_user_id: deId,
    conteudo,
    tipo:       'texto',
    lida:       true,
  });
}

// ─── Buscar match entre duas usuárias ────────────────────────────
async function buscarMatch(idA, idB) {
  // Tenta as duas combinações de ordem (LEAST/GREATEST no trigger)
  const menor = idA < idB ? idA : idB;
  const maior = idA < idB ? idB : idA;
  const { data } = await req(
    'GET',
    `/rest/v1/matches?usuario_a_id=eq.${menor}&usuario_b_id=eq.${maior}&limit=1`
  );
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

// ═══════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════
(async () => {
  console.log('\n🌸  Safimatch — Seed de Contas de Teste\n');

  // 1. Criar usuárias
  const ids = [];
  for (const conta of CONTAS) {
    try {
      const id = await criarUsuaria(conta);
      ids.push(id);
      log('✅', `${conta.nome} (${conta.email}) — ID: ${id}`);
    } catch (e) {
      log('❌', e.message);
      ids.push(null);
    }
  }

  // 2. Atualizar perfis
  console.log('\n📝  Atualizando perfis...');
  for (let i = 0; i < CONTAS.length; i++) {
    if (!ids[i]) continue;
    try {
      await atualizarPerfil(ids[i], CONTAS[i]);
      log('✅', `Perfil de ${CONTAS[i].nome} atualizado`);
    } catch (e) {
      log('❌', e.message);
    }
  }

  // 3. Criar curtidas mútuas (para gerar matches automaticamente via trigger)
  // Ana ↔ Beatriz (match)
  // Ana ↔ Camila (match)
  // Beatriz ↔ Daniela (match)
  // Elisa ↔ Camila (match)
  // Ana → Elisa (like sem retorno — para testar descoberta)

  console.log('\n💕  Criando curtidas e matches...');
  const pares = [
    [0, 1, 'like',      'like'],      // Ana ↔ Beatriz
    [0, 2, 'superlike', 'like'],      // Ana ↔ Camila
    [1, 3, 'like',      'like'],      // Beatriz ↔ Daniela
    [4, 2, 'like',      'like'],      // Elisa ↔ Camila
    [3, 4, 'like',      'superlike'], // Daniela ↔ Elisa
    [0, 4, 'like',      null],        // Ana → Elisa (sem retorno)
  ];

  for (const [a, b, tipoA, tipoB] of pares) {
    if (!ids[a] || !ids[b]) continue;
    try {
      await criarCurtida(ids[a], ids[b], tipoA);
      if (tipoB) await criarCurtida(ids[b], ids[a], tipoB);
      const match = tipoB ? '💕 Match!' : '→ Like (sem retorno)';
      log('✅', `${CONTAS[a].nome} ${tipoB ? '↔' : '→'} ${CONTAS[b].nome} ${match}`);
    } catch (e) {
      // Curtida duplicada — ignora
    }
  }

  // 4. Buscar matches gerados e criar mensagens
  console.log('\n💬  Adicionando conversas de exemplo...');
  await new Promise(r => setTimeout(r, 1000)); // aguarda trigger

  const conversas = [
    {
      a: 0, b: 1,
      msgs: [
        [0, 'Oi Beatriz! Vi sua arte no perfil, que incrível! 😍'],
        [1, 'Oi Ana! Obrigada 🥰 você fotografa muito bem também!'],
        [0, 'Que tal a gente tomar um café e trocar ideias? ☕'],
        [1, 'Adorei a ideia! Bora marcar essa semana?'],
      ]
    },
    {
      a: 0, b: 2,
      msgs: [
        [0, 'Oi Camila! Você é personal trainer? Legal demais!'],
        [2, 'Sim! E vi que você ama viajar 😍 me faz inveja!'],
        [0, 'Haha precisava de uma companhia de yoga pra viajar juntas 🧘‍♀️'],
        [2, 'Rsrs combinamos! Qual foi seu lugar favorito até hoje?'],
      ]
    },
    {
      a: 1, b: 3,
      msgs: [
        [1, 'Oi Daniela! Leitora voraz né? Qual livro você indicaria?'],
        [3, 'Oi! Depende do gênero. Você curte ficção científica?'],
        [1, 'Adoro! Só li coisas populares ainda...'],
        [3, 'Te mando uma lista 📚 temos muito a conversar!'],
      ]
    },
  ];

  for (const { a, b, msgs } of conversas) {
    if (!ids[a] || !ids[b]) continue;
    try {
      const match = await buscarMatch(ids[a], ids[b]);
      if (!match) { log('⚠️', `Match ${CONTAS[a].nome} ↔ ${CONTAS[b].nome} não encontrado`); continue; }
      for (const [idx, texto] of msgs) {
        await criarMensagem(match.id, ids[[a,b][idx]], texto);
      }
      log('✅', `Conversa ${CONTAS[a].nome} ↔ ${CONTAS[b].nome} criada`);
    } catch (e) {
      log('❌', `Conversa ${CONTAS[a].nome} ↔ ${CONTAS[b].nome}: ${e.message}`);
    }
  }

  // ─── Resumo ──────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(55));
  console.log('🎉  Seed concluído! Contas de teste:');
  console.log('═'.repeat(55));
  for (const c of CONTAS) {
    console.log(`  📧  ${c.email}`);
    console.log(`  🔑  Senha: Test@12345`);
    console.log(`  👤  ${c.nome} | ${c.cidade}/${c.estado}`);
    console.log('');
  }
  console.log('─'.repeat(55));
  console.log('💡  Sua conta principal (julianacore2@gmail.com)');
  console.log('    já existe. As contas de teste aparecem na descoberta.');
  console.log('═'.repeat(55) + '\n');
})();
