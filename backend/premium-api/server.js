'use strict';

// ================================================================
// Safimatch — Premium API
// Gerencia cobranças Pix via Mercado Pago e ativa o Premium
// automaticamente após confirmação do pagamento.
// ================================================================

const express  = require('express');
const { createClient } = require('@supabase/supabase-js');
const { createRemoteJWKSet, jwtVerify } = require('jose');

const app = express();
app.use(express.json());

// CORS — permite chamadas do app React Native
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ── Variáveis de ambiente ─────────────────────────────────────────────────────
const {
  MERCADOPAGO_ACCESS_TOKEN,   // Token de produção do Mercado Pago (começa com APP_USR-)
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  PORT = '3001',
} = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[premium-api] ERRO: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios.');
  process.exit(1);
}

// JWKS — verifica tokens ECC P-256 emitidos pelo Supabase Auth
const JWKS = createRemoteJWKSet(
  new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`)
);

// Cliente com service role — ignora RLS (uso exclusivo do servidor)
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ── Planos ────────────────────────────────────────────────────────────────────
const PLANOS = {
  mensal:     { reais: 9.90,  dias: 30,  label: 'Safimatch Premium — Mensal',     centavos: 990  },
  trimestral: { reais: 24.90, dias: 90,  label: 'Safimatch Premium — Trimestral', centavos: 2490 },
  anual:      { reais: 79.90, dias: 365, label: 'Safimatch Premium — Anual',      centavos: 7990 },
};

const EXPIRA_MINUTOS = 30;

// ── Helper: valida JWT (ECC P-256 via JWKS) e retorna user_id ───────────────
async function autenticar(req, res) {
  const header = req.headers.authorization ?? '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ erro: 'Token não fornecido' });
    return null;
  }
  try {
    const { payload } = await jwtVerify(token, JWKS, { issuer: 'supabase' });
    return payload.sub; // UUID do usuário
  } catch (e) {
    console.warn('[autenticar] Token inválido:', e.message);
    res.status(401).json({ erro: 'Token inválido ou expirado' });
    return null;
  }
}

// ── POST /premium/criar-cobranca ──────────────────────────────────────────────
// Cria cobrança Pix no Mercado Pago e salva na tabela pagamentos
app.post('/premium/criar-cobranca', async (req, res) => {
  const userId = await autenticar(req, res);
  if (!userId) return;

  if (!MERCADOPAGO_ACCESS_TOKEN) {
    return res.status(503).json({
      erro: 'Pagamento Pix ainda não configurado. Defina MERCADOPAGO_ACCESS_TOKEN no servidor.',
    });
  }

  const { plano = 'mensal' } = req.body ?? {};
  const planoInfo = PLANOS[plano];
  if (!planoInfo) {
    return res.status(400).json({ erro: 'Plano inválido. Use: mensal, trimestral ou anual.' });
  }

  // Cancela cobranças pendentes anteriores do usuário
  await db.from('pagamentos').update({ status: 'CANCELADO' })
    .eq('user_id', userId).eq('status', 'PENDING');

  // Data de expiração (30 min)
  const expiracao = new Date(Date.now() + EXPIRA_MINUTOS * 60 * 1000).toISOString();

  try {
    const mpResp = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        Authorization:    `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`,
        'Content-Type':   'application/json',
        'X-Idempotency-Key': `safi-${userId.slice(0, 8)}-${Date.now()}`,
      },
      body: JSON.stringify({
        transaction_amount: planoInfo.reais,
        description:        planoInfo.label,
        payment_method_id:  'pix',
        date_of_expiration: expiracao,
        payer: { email: 'pix@safimatch.com' },
      }),
    });

    const dados = await mpResp.json();

    if (!mpResp.ok) {
      console.error('[criar-cobranca] Mercado Pago erro:', JSON.stringify(dados));
      return res.status(502).json({ erro: 'Falha ao gerar QR Code. Tente novamente.' });
    }

    const mpId        = String(dados.id);
    const correlationID = `safi-mp-${mpId}`;
    const txData      = dados.point_of_interaction?.transaction_data ?? {};
    const brCode      = txData.qr_code      ?? null;
    const qrB64       = txData.qr_code_base64 ?? null;
    const qrCodeImage = qrB64 ? `data:image/png;base64,${qrB64}` : null;

    // Salva no banco
    const { error } = await db.from('pagamentos').insert({
      user_id:        userId,
      correlation_id: correlationID,
      valor_centavos: planoInfo.centavos,
      status:         'PENDING',
    });
    if (error) console.warn('[criar-cobranca] DB insert:', error.message);

    return res.json({
      correlationID,
      brCode,
      qrCodeImage,
      expiraSecs: EXPIRA_MINUTOS * 60,
    });
  } catch (e) {
    console.error('[criar-cobranca] Erro:', e.message);
    return res.status(500).json({ erro: 'Erro interno. Tente novamente.' });
  }
});

// ── GET /premium/status/:correlationID ───────────────────────────────────────
// Polling a cada 5s — verifica pagamento no Mercado Pago
app.get('/premium/status/:correlationID', async (req, res) => {
  const { correlationID } = req.params;

  if (!MERCADOPAGO_ACCESS_TOKEN) return res.json({ status: 'NAO_CONFIGURADO' });

  // Extrai o ID numérico do MP a partir do correlationID
  const mpId = correlationID.replace('safi-mp-', '');
  if (!mpId || mpId === correlationID) {
    return res.json({ status: 'UNKNOWN' });
  }

  try {
    const mpResp = await fetch(`https://api.mercadopago.com/v1/payments/${mpId}`, {
      headers: { Authorization: `Bearer ${MERCADOPAGO_ACCESS_TOKEN}` },
    });

    const dados  = await mpResp.json();
    // MP status: pending | approved | rejected | cancelled
    const mpStatus = dados.status ?? 'unknown';

    let status = 'ACTIVE';
    if (mpStatus === 'approved') {
      status = 'COMPLETED';
      await _ativarPremium(correlationID);
    } else if (mpStatus === 'cancelled' || mpStatus === 'rejected') {
      status = 'EXPIRED';
    }

    return res.json({ status });
  } catch (e) {
    console.error('[status] Erro:', e.message);
    return res.status(500).json({ erro: 'Erro ao verificar pagamento' });
  }
});

// ── POST /premium/webhook ─────────────────────────────────────────────────────
// Notificação instantânea do Mercado Pago (IPN)
// Configure em: mercadopago.com.br → Suas integrações → Webhooks
app.post('/premium/webhook', async (req, res) => {
  const { type, data } = req.body ?? {};
  console.log('[webhook] Evento MP recebido:', type, data?.id);

  if (type === 'payment' && data?.id) {
    try {
      const mpResp = await fetch(`https://api.mercadopago.com/v1/payments/${data.id}`, {
        headers: { Authorization: `Bearer ${MERCADOPAGO_ACCESS_TOKEN}` },
      });
      const pag = await mpResp.json();
      if (pag.status === 'approved') {
        const correlationID = `safi-mp-${data.id}`;
        await _ativarPremium(correlationID);
        console.log('[webhook] Premium ativado via webhook para payment', data.id);
      }
    } catch (e) {
      console.error('[webhook] Erro ao processar:', e.message);
    }
  }
  return res.json({ ok: true });
});

// ── _ativarPremium: atualiza pagamentos + perfis ──────────────────────────────
async function _ativarPremium(correlationID) {
  const { data: pag, error } = await db
    .from('pagamentos')
    .update({ status: 'COMPLETED', pago_em: new Date().toISOString() })
    .eq('correlation_id', correlationID)
    .eq('status', 'PENDING')
    .select('user_id, valor_centavos')
    .single();

  if (error || !pag?.user_id) return; // já processado ou não encontrado

  const diasPorValor = { 990: 30, 2490: 90, 7990: 365 };
  const dias = diasPorValor[pag.valor_centavos] ?? 30;
  const premiumAte = new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString();

  const { error: errPerfil } = await db
    .from('perfis')
    .update({ premium: true, premium_ate: premiumAte })
    .eq('user_id', pag.user_id);

  if (errPerfil) {
    console.error('[_ativarPremium] Erro ao atualizar perfis:', errPerfil.message);
  } else {
    console.log(`✅ Premium ativado: user_id=${pag.user_id} até ${premiumAte}`);
  }
}

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({
  ok: true,
  pixConfigurado: !!MERCADOPAGO_ACCESS_TOKEN,
}));

app.listen(PORT, () =>
  console.log(`💰 Safimatch Premium API rodando na porta ${PORT} — Pix ${MERCADOPAGO_ACCESS_TOKEN ? '✅ configurado' : '⚠️ sem MERCADOPAGO_ACCESS_TOKEN'}`),
);
