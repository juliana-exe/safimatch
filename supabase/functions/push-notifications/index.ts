// supabase/functions/push-notifications/index.ts
// Edge Function: envia push notifications para mensagens, curtidas e matches
// Gratuito: Expo Push API + Supabase Edge Functions (500k calls/mês grátis)
// Roteamento automático pela tabela que disparou o webhook

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// ── Helper: envia 1 ou N notificações via Expo API ───────────────────────────
async function enviarPush(msgs: object | object[]) {
  const payload = Array.isArray(msgs) ? msgs : [msgs];
  const resp = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip, deflate',
    },
    body: JSON.stringify(payload),
  });
  return resp.json();
}

// ── Helper: busca nome + push_token de um usuário ────────────────────────────
async function buscarPerfil(supabase: any, userId: string) {
  const { data } = await supabase
    .from('perfis')
    .select('nome, push_token')
    .eq('user_id', userId)
    .single();
  return data as { nome: string; push_token: string | null } | null;
}

// ── Helper: lê preferência (padrão = true quando linha não existe) ────────────
async function preferencia(supabase: any, userId: string, campo: string): Promise<boolean> {
  const { data } = await supabase
    .from('configuracoes_usuario')
    .select(campo)
    .eq('user_id', userId)
    .maybeSingle();
  return data?.[campo] !== false;
}

// ── Helpers de resposta ───────────────────────────────────────────────────────
const respJson = (body: object) => new Response(JSON.stringify(body), {
  headers: { 'Content-Type': 'application/json' },
});
const respOk = (motivo: string) => respJson({ ok: true, motivo });

// ── Entry point ───────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const body = await req.json();
    const { table, record } = body;

    if (!record) {
      return new Response(JSON.stringify({ erro: 'Payload inválido' }), { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    if (table === 'mensagens')  return await handleMensagem(supabase, record);
    if (table === 'curtidas')   return await handleCurtida(supabase, record);
    if (table === 'matches')    return await handleMatch(supabase, record);

    return respOk('tabela ignorada');

  } catch (err) {
    console.error('[push-notifications] Erro:', err);
    return new Response(JSON.stringify({ erro: (err as Error).message }), { status: 500 });
  }
});

// ── Handler: nova mensagem ────────────────────────────────────────────────────
async function handleMensagem(supabase: any, record: any) {
  const matchId     = record.match_id;
  const remetenteId = record.de_user_id;

  const { data: match, error: matchErr } = await supabase
    .from('matches')
    .select('usuario_a_id, usuario_b_id')
    .eq('id', matchId)
    .single();

  if (matchErr || !match) {
    return new Response(JSON.stringify({ erro: 'Match não encontrado' }), { status: 404 });
  }

  const destinatarioId = match.usuario_a_id === remetenteId
    ? match.usuario_b_id
    : match.usuario_a_id;

  const [destPerfil, configDest, remPerfil] = await Promise.all([
    buscarPerfil(supabase, destinatarioId),
    supabase.from('configuracoes_usuario')
      .select('notif_mensagem').eq('user_id', destinatarioId).maybeSingle()
      .then((r: any) => r.data),
    buscarPerfil(supabase, remetenteId),
  ]);

  if (!destPerfil?.push_token)              return respOk('sem push_token');
  if (configDest?.notif_mensagem === false)  return respOk('notif_mensagem desativado');

  const nomeRemetente = remPerfil?.nome ?? 'Alguém';

  let corpo = 'Enviou uma mensagem 💬';
  if (record.tipo === 'texto' && record.conteudo) {
    corpo = record.conteudo.length > 80
      ? record.conteudo.slice(0, 77) + '...'
      : record.conteudo;
  } else if (record.tipo === 'foto' || record.tipo === 'imagem') {
    corpo = 'Enviou uma foto 📷';
  } else if (record.tipo === 'foto_unica') {
    corpo = 'Enviou uma foto especial 👀';
  }

  const resultado = await enviarPush({
    to:        destPerfil.push_token,
    title:     nomeRemetente,
    body:      corpo,
    sound:     'default',
    data:      { tipo: 'mensagem', matchId },
    channelId: 'mensagens',
  });

  console.log('[push] mensagem:', JSON.stringify(resultado));
  return respJson({ ok: true, resultado });
}

// ── Handler: curtida recebida ─────────────────────────────────────────────────
async function handleCurtida(supabase: any, record: any) {
  if (record.tipo === 'nope') return respOk('nope ignorado');

  const quemFoiCurtidaId = record.para_user_id;

  const [destPerfil, notifOk] = await Promise.all([
    buscarPerfil(supabase, quemFoiCurtidaId),
    preferencia(supabase, quemFoiCurtidaId, 'notif_curtidas'),
  ]);

  if (!destPerfil?.push_token) return respOk('sem push_token');
  if (!notifOk)                return respOk('notif_curtidas desativado');

  const corpo = record.tipo === 'super_like'
    ? 'Alguém deu super like em você! ⭐'
    : 'Alguém te curtiu! 💖';

  const resultado = await enviarPush({
    to:        destPerfil.push_token,
    title:     'Safimatch',
    body:      corpo,
    sound:     'default',
    data:      { tipo: 'curtida' },
    channelId: 'curtidas',
  });

  console.log('[push] curtida:', JSON.stringify(resultado));
  return respJson({ ok: true, resultado });
}

// ── Handler: novo match ───────────────────────────────────────────────────────
async function handleMatch(supabase: any, record: any) {
  const userAId = record.usuario_a_id;
  const userBId = record.usuario_b_id;
  const matchId = record.id;

  const [perfilA, perfilB, notifA, notifB] = await Promise.all([
    buscarPerfil(supabase, userAId),
    buscarPerfil(supabase, userBId),
    preferencia(supabase, userAId, 'notif_matches'),
    preferencia(supabase, userBId, 'notif_matches'),
  ]);

  const pushPayloads: object[] = [];

  if (perfilA?.push_token && notifA) {
    pushPayloads.push({
      to:        perfilA.push_token,
      title:     'Novo Match! 💜',
      body:      `Você e ${perfilB?.nome ?? 'alguém'} deram match!`,
      sound:     'default',
      data:      { tipo: 'match', matchId },
      channelId: 'matches',
    });
  }

  if (perfilB?.push_token && notifB) {
    pushPayloads.push({
      to:        perfilB.push_token,
      title:     'Novo Match! 💜',
      body:      `Você e ${perfilA?.nome ?? 'alguém'} deram match!`,
      sound:     'default',
      data:      { tipo: 'match', matchId },
      channelId: 'matches',
    });
  }

  if (pushPayloads.length === 0) return respOk('sem tokens válidos');

  const resultado = await enviarPush(pushPayloads);
  console.log('[push] match:', JSON.stringify(resultado));
  return respJson({ ok: true, resultado });
}
