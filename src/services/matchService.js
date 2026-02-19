// src/services/matchService.js - Safimatch
// Serviço de matches (curtidas + matches) via Supabase PostgreSQL

import { supabase } from '../config/supabase';

// Helper: lê usuário da sessão local (sem chamada de rede ao GoTrue)
const _getUser = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user ?? null;
};

// ================================================================
// DAR LIKE / NOPE / SUPER LIKE
// O trigger no banco cria o match automaticamente se for recíproco
// ================================================================
export const curtir = async (paraUserId, tipo = 'like') => {
  try {
    const user = await _getUser();
    if (!user) throw new Error('Não autenticada');

    // Registra a curtida (upsert para evitar duplicata)
    const { error } = await supabase
      .from('curtidas')
      .upsert(
        { de_user_id: user.id, para_user_id: paraUserId, tipo },
        { onConflict: 'de_user_id,para_user_id' }
      );

    if (error) throw error;

    // Verifica se houve match (consulta após o trigger rodar)
    const { data: match } = await supabase
      .from('matches')
      .select('id')
      .or(
        `and(usuario_a_id.eq.${user.id},usuario_b_id.eq.${paraUserId}),` +
        `and(usuario_a_id.eq.${paraUserId},usuario_b_id.eq.${user.id})`
      )
      .single();

    return {
      sucesso: true,
      houveMutch: !!match,
      matchId: match?.id ?? null,
    };
  } catch (error) {
    return { sucesso: false, erro: error.message, houveMutch: false };
  }
};

// ================================================================
// DESFAZER CURTIDA (voltar atrás)
// ================================================================
export const desfazerCurtida = async (paraUserId) => {
  try {
    const user = await _getUser();
    const { error } = await supabase
      .from('curtidas')
      .delete()
      .eq('de_user_id', user.id)
      .eq('para_user_id', paraUserId);

    if (error) throw error;
    return { sucesso: true };
  } catch (error) {
    return { sucesso: false, erro: error.message };
  }
};

// ================================================================
// LISTAR MATCHES (com info da outra usuária + última mensagem)
// ================================================================
export const listarMatches = async () => {
  try {
    const { data, error } = await supabase
      .from('matches_com_perfis')    // usa a VIEW criada no schema
      .select('*')
      .order('ultima_msg_em', { ascending: false, nullsFirst: false });

    if (error) throw error;

    // Mapeia colunas da VIEW para o formato esperado pela UI
    const matches = (data ?? []).map((m) => ({
      id: m.match_id,
      match_id: m.match_id,
      status: m.status,
      match_em: m.match_em,
      ultima_mensagem: m.ultima_msg ?? null,
      ultima_mensagem_hora: m.ultima_msg_em ?? null,
      msgs_nao_lidas: m.msgs_nao_lidas ?? 0,
      perfil_dela: {
        user_id: m.outra_user_id,
        nome: m.outra_nome,
        foto_principal: m.outra_foto,
        fotos: m.outra_foto ? [m.outra_foto] : [],
        verificada: m.outra_verificada,
        online_agora: m.outra_online,
      },
    }));

    return { sucesso: true, matches };
  } catch (error) {
    return { sucesso: false, erro: error.message, matches: [] };
  }
};

// ================================================================
// ENCERRAR MATCH (desfazer match)
// ================================================================
export const encerrarMatch = async (matchId) => {
  try {
    const { error } = await supabase
      .from('matches')
      .update({ status: 'encerrado' })
      .eq('id', matchId);

    if (error) throw error;
    return { sucesso: true };
  } catch (error) {
    return { sucesso: false, erro: error.message };
  }
};

// ================================================================
// QUEM ME CURTIU (requer Safimatch Premium em prod)
// ================================================================
export const quemMeCurtiu = async () => {
  try {
    const user = await _getUser();
    if (!user) throw new Error('Não autenticada');

    const { data, error } = await supabase
      .from('curtidas')
      .select(`
        id,
        tipo,
        criado_em,
        perfis!curtidas_de_user_id_fkey(
          user_id, nome, foto_principal, cidade, verificada
        )
      `)
      .eq('para_user_id', user.id)
      .in('tipo', ['like', 'superlike'])
      .order('criado_em', { ascending: false });

    if (error) throw error;
    return { sucesso: true, curtidas: data ?? [] };
  } catch (error) {
    return { sucesso: false, erro: error.message, curtidas: [] };
  }
};

// ================================================================
// OUVIR NOVOS MATCHES EM TEMPO REAL (Realtime)
// ================================================================
export const ouvirNovosMatches = (userId, onNovoMatch) => {
  const channel = supabase
    .channel('novos-matches')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'matches',
        filter: `usuario_a_id=eq.${userId}`,
      },
      (payload) => onNovoMatch(payload.new)
    )
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'matches',
        filter: `usuario_b_id=eq.${userId}`,
      },
      (payload) => onNovoMatch(payload.new)
    )
    .subscribe();

  // Retorna função para cancelar a inscrição
  return () => supabase.removeChannel(channel);
};
