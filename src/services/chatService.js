// src/services/chatService.js - Safimatch
// Chat em tempo real via Supabase Realtime (WebSocket)

import { supabase } from '../config/supabase';

// ================================================================
// BUSCAR HISTÓRICO DE MENSAGENS
// ================================================================
export const obterMensagens = async (matchId, pagina = 0, porPagina = 50) => {
  try {
    const inicio = pagina * porPagina;

    const { data, error } = await supabase
      .from('mensagens')
      .select('id, match_id, de_user_id, conteudo, tipo, lida, criado_em')
      .eq('match_id', matchId)
      .order('criado_em', { ascending: false })
      .range(inicio, inicio + porPagina - 1);

    if (error) throw error;

    // Reverter para exibir mais antigas primeiro
    return { sucesso: true, mensagens: (data ?? []).reverse() };
  } catch (error) {
    return { sucesso: false, erro: error.message, mensagens: [] };
  }
};

// ================================================================
// ENVIAR MENSAGEM
// ================================================================
export const enviarMensagem = async (matchId, conteudo, tipo = 'texto') => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Não autenticada');

    const { data, error } = await supabase
      .from('mensagens')
      .insert({
        match_id: matchId,
        de_user_id: user.id,
        conteudo: conteudo.trim(),
        tipo,
      })
      .select()
      .single();

    if (error) throw error;
    return { sucesso: true, mensagem: data };
  } catch (error) {
    return { sucesso: false, erro: error.message };
  }
};

// ================================================================
// ENVIAR MENSAGEM DE FOTO NO CHAT
// ================================================================
export const enviarFotoMensagem = async (matchId, fotoUrl, viewOnce = false) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Não autenticada');

    const { data, error } = await supabase
      .from('mensagens')
      .insert({
        match_id: matchId,
        de_user_id: user.id,
        conteudo: null,
        tipo: viewOnce ? 'foto_unica' : 'foto',
        foto_url: fotoUrl,
        view_once: viewOnce,
      })
      .select()
      .single();

    if (error) throw error;
    return { sucesso: true, mensagem: data };
  } catch (error) {
    return { sucesso: false, erro: error.message };
  }
};

// ================================================================
// MARCAR FOTO Única COMO VISUALIZADA
// ================================================================
export const marcarFotoVisualizadaOnce = async (mensagemId) => {
  try {
    const { error } = await supabase
      .from('mensagens')
      .update({ view_once_visto: true })
      .eq('id', mensagemId);

    if (error) throw error;
    return { sucesso: true };
  } catch (error) {
    return { sucesso: false, erro: error.message };
  }
};

// ================================================================
// MARCAR MENSAGENS COMO LIDAS
// ================================================================
export const marcarComoLidas = async (matchId, deUserId) => {
  try {
    const { error } = await supabase
      .from('mensagens')
      .update({ lida: true })
      .eq('match_id', matchId)
      .eq('de_user_id', deUserId)  // mensagens da outra usuária
      .eq('lida', false);

    if (error) throw error;
    return { sucesso: true };
  } catch (error) {
    return { sucesso: false, erro: error.message };
  }
};

// ================================================================
// OUVIR MENSAGENS EM TEMPO REAL (WebSocket)
// Retorna função de unsubscribe — chame ao desmontar o componente
// ================================================================
export const ouvirMensagens = (matchId, onNovaMensagem) => {
  const channel = supabase
    .channel(`chat-${matchId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'mensagens',
        filter: `match_id=eq.${matchId}`,
      },
      async (payload) => {
        // Busca o perfil da remetente para exibir no chat
        const { data: perfil } = await supabase
          .from('perfis')
          .select('nome, foto_principal')
          .eq('user_id', payload.new.de_user_id)
          .single();

        onNovaMensagem({
          ...payload.new,
          perfis: perfil,
        });
      }
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
};

// ================================================================
// OUVIR INDICADOR DE "DIGITANDO"
// Usa o sistema de Presence do Supabase Realtime
// ================================================================
export const gerenciarPresence = (matchId, userId, onDigitando) => {
  const channel = supabase.channel(`presence-${matchId}`, {
    config: { presence: { key: userId } },
  });

  channel
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const outrasDigitando = Object.keys(state)
        .filter((uid) => uid !== userId && state[uid]?.[0]?.digitando);
      onDigitando(outrasDigitando.length > 0);
    })
    .subscribe();

  const indicarDigitando = async (digitando) => {
    await channel.track({ digitando });
  };

  const parar = () => supabase.removeChannel(channel);

  return { indicarDigitando, parar };
};

// ================================================================
// TOTAL DE MENSAGENS NÃO LIDAS (para badge na tab)
// ================================================================
export const totalMensagensNaoLidas = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { sucesso: true, total: 0 };

    const { count, error } = await supabase
      .from('mensagens')
      .select('id', { count: 'exact', head: true })
      .eq('lida', false)
      .neq('de_user_id', user.id)
      .in(
        'match_id',
        (await supabase
          .from('matches')
          .select('id')
          .or(`usuario_a_id.eq.${user.id},usuario_b_id.eq.${user.id}`)
          .eq('status', 'ativo')
        ).data?.map(m => m.id) ?? []
      );

    if (error) throw error;
    return { sucesso: true, total: count ?? 0 };
  } catch (error) {
    return { sucesso: false, erro: error.message, total: 0 };
  }
};
