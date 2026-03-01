// supabase/functions/premium-api/index.ts
// Safimatch — API de suporte ao app (Supabase Edge Function / Deno)
// Todas as compras são feitas via Google Play Billing.
// Endpoints:
//   POST   /premium/verificar-compra-play  — ativa Premium após compra Play
//   DELETE /conta/excluir                  — exclui conta (exigência Play Policy)
//   GET    /health

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// SKUs registrados no Google Play Console → Monetização → Assinaturas
const SKU_TO_PLANO: Record<string, { label: string; dias: number; centavos: number }> = {
  'premium_mensal':     { label: 'mensal',     dias: 30,  centavos: 990  },
  'premium_trimestral': { label: 'trimestral', dias: 90,  centavos: 2490 },
  'premium_anual':      { label: 'anual',      dias: 365, centavos: 7990 },
};

// ── Resposta JSON com CORS ────────────────────────────────────────────────────
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    },
  });
}

// ── Valida JWT via Supabase Auth e retorna user_id ────────────────────────────
async function autenticar(req: Request): Promise<string | null> {
  const header = req.headers.get('authorization') ?? '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;

  const { data: { user }, error } = await db.auth.getUser(token);
  if (error || !user) return null;
  return user.id;
}

// ── Handler principal ─────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      },
    });
  }

  // Extrai o path relativo (Supabase Edge Runtime passa /premium-api/<rota>)
  const url    = new URL(req.url);
  let   path   = url.pathname;
  const prefix = '/premium-api';
  if (path.startsWith(prefix)) path = path.slice(prefix.length);
  const method = req.method;

  // ── GET /health ─────────────────────────────────────────────────────────────
  if (method === 'GET' && (path === '/health' || path === '' || path === '/')) {
    return json({ ok: true });
  }

  // ── POST /premium/verificar-compra-play ─────────────────────────────────────
  if (method === 'POST' && path === '/premium/verificar-compra-play') {
    const userId = await autenticar(req);
    if (!userId) return json({ erro: 'Token inválido ou expirado' }, 401);

    const body = await req.json().catch(() => ({}));
    const { purchaseToken, productId, transactionId } = body;
    if (!purchaseToken || !productId) {
      return json({ erro: 'purchaseToken e productId são obrigatórios' }, 400);
    }

    const planoInfo = SKU_TO_PLANO[productId];
    if (!planoInfo) return json({ erro: `Produto desconhecido: ${productId}` }, 400);

    const premiumAte = new Date(Date.now() + planoInfo.dias * 86_400_000).toISOString();

    const { error: errPerfil } = await db
      .from('perfis')
      .update({ premium: true, premium_ate: premiumAte })
      .eq('user_id', userId);

    if (errPerfil) {
      console.error('[verificar-compra-play] Erro:', errPerfil.message);
      return json({ erro: 'Erro interno ao ativar Premium.' }, 500);
    }

    // Registra pagamento (ignora duplicatas)
    const corrId = `gplay-${transactionId ?? String(purchaseToken).slice(0, 40)}`;
    const { error: errPag } = await db.from('pagamentos').insert({
      user_id:        userId,
      correlation_id: corrId,
      valor_centavos: planoInfo.centavos,
      status:         'COMPLETED',
      pago_em:        new Date().toISOString(),
    });
    if (errPag && errPag.code !== '23505') {
      console.warn('[play-billing] insert pagamento:', errPag.message);
    }

    console.log(`✅ [play] Premium: user=${userId} plano=${planoInfo.label} até ${premiumAte}`);
    return json({ sucesso: true, premium_ate: premiumAte });
  }

  // ── DELETE /conta/excluir ─────────────────────────────────────────────────────────
  if (method === 'DELETE' && path === '/conta/excluir') {
    const userId = await autenticar(req);
    if (!userId) return json({ erro: 'Token inválido ou expirado' }, 401);

    try {
      // Deleta dados respeitando foreign keys
      await db.from('mensagens').delete().or(`de_user_id.eq.${userId},para_user_id.eq.${userId}`);
      await db.from('matches').delete().or(`user1_id.eq.${userId},user2_id.eq.${userId}`);
      await db.from('curtidas').delete().or(`de_user_id.eq.${userId},para_user_id.eq.${userId}`);
      await db.from('pagamentos').delete().eq('user_id', userId);
      await db.from('perfis').delete().eq('user_id', userId);

      // Exclui o usuário do Auth (irreversível)
      const { error } = await db.auth.admin.deleteUser(userId);
      if (error) throw new Error(error.message);

      console.log(`🗑️  Conta excluída: user_id=${userId}`);
      return json({ sucesso: true });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido';
      console.error('[conta/excluir] Erro:', msg);
      return json({ erro: 'Erro ao excluir conta. Contate suporte@safimatch.com.br' }, 500);
    }
  }

  return json({ erro: 'Rota não encontrada' }, 404);
});
