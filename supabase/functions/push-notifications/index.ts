// supabase/functions/push-notifications/index.ts
// Edge Function: envia push notification via Expo quando chega nova mensagem ou match
// Gratuito: Expo Push API + Supabase Edge Functions (500k calls/mês grátis)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

Deno.serve(async (req) => {
  try {
    // Aceita apenas POST (webhook do Supabase)
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const payload = await req.json();
    const record = payload.record;

    if (!record) {
      return new Response(JSON.stringify({ erro: 'Payload inválido' }), { status: 400 });
    }

    // Cliente com service_role para leitura irrestrita
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ── Descobrir quem é o destinatário ──────────────────────────────────────
    const matchId   = record.match_id;
    const remetenteId = record.de_user_id;

    // Busca o match para saber quem são os dois participantes
    const { data: match, error: matchErr } = await supabase
      .from('matches')
      .select('usuario_a_id, usuario_b_id')
      .eq('id', matchId)
      .single();

    if (matchErr || !match) {
      return new Response(JSON.stringify({ erro: 'Match não encontrado' }), { status: 404 });
    }

    // O destinatário é quem NÃO enviou a mensagem
    const destinatarioId = match.usuario_a_id === remetenteId
      ? match.usuario_b_id
      : match.usuario_a_id;

    // ── Busca push_token + preferências do destinatário ───────────────────────
    const [{ data: destPerfil }, { data: destConfig }] = await Promise.all([
      supabase
        .from('perfis')
        .select('nome, push_token')
        .eq('user_id', destinatarioId)
        .single(),
      supabase
        .from('configuracoes_usuario')
        .select('notif_mensagem')
        .eq('user_id', destinatarioId)
        .maybeSingle(),
    ]);

    // Sem token ou notificações desativadas → sai silenciosamente
    if (!destPerfil?.push_token) {
      return new Response(JSON.stringify({ ok: true, motivo: 'sem push_token' }));
    }
    if (destConfig?.notif_mensagem === false) {
      return new Response(JSON.stringify({ ok: true, motivo: 'notif_mensagem desativado' }));
    }

    // ── Busca nome do remetente ───────────────────────────────────────────────
    const { data: remPerfil } = await supabase
      .from('perfis')
      .select('nome')
      .eq('user_id', remetenteId)
      .single();

    const nomeRemetente = remPerfil?.nome ?? 'Alguém';

    // ── Monta a notificação ───────────────────────────────────────────────────
    let titulo = nomeRemetente;
    let corpo  = 'Enviou uma mensagem 💬';

    if (record.tipo === 'texto' && record.conteudo) {
      corpo = record.conteudo.length > 80
        ? record.conteudo.slice(0, 77) + '...'
        : record.conteudo;
    } else if (record.tipo === 'foto' || record.tipo === 'imagem') {
      corpo = 'Enviou uma foto 📷';
    } else if (record.tipo === 'foto_unica') {
      corpo = 'Enviou uma foto especial 👀';
    }

    // ── Envia via Expo Push API ───────────────────────────────────────────────
    const pushPayload = {
      to:    destPerfil.push_token,
      title: titulo,
      body:  corpo,
      sound: 'default',
      data: {
        tipo:    'mensagem',
        matchId: matchId,
      },
      channelId: 'mensagens', // canal Android configurado no app
    };

    const resp = await fetch(EXPO_PUSH_URL, {
      method:  'POST',
      headers: {
        'Content-Type':   'application/json',
        'Accept':         'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(pushPayload),
    });

    const resultado = await resp.json();
    console.log('[push-notifications] Result:', JSON.stringify(resultado));

    return new Response(JSON.stringify({ ok: true, resultado }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[push-notifications] Erro:', err);
    return new Response(JSON.stringify({ erro: err.message }), { status: 500 });
  }
});
