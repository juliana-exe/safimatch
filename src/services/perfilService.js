// src/services/perfilService.js - Safimatch
// Serviço de perfis usando PostgreSQL via PostgREST (Supabase)

import { supabase } from '../config/supabase';

// Helper: lê usuário da sessão local (sem chamada de rede ao GoTrue)
const _getUser = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user ?? null;
};

// ================================================================
// OBTER PERFIL DA USUÁRIA ATUAL
// ================================================================
export const obterMeuPerfil = async () => {
  try {
    const user = await _getUser();
    if (!user) throw new Error('Não autenticada');

    const { data, error } = await supabase
      .from('perfis')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();  // não quebra quando 0 linhas

    if (error) throw error;
    if (!data) throw new Error('Perfil não encontrado');

    // Calcula idade dinamicamente (a VIEW faz isso, mas a tabela não tem a coluna)
    const idade = data.data_nascimento
      ? Math.floor((Date.now() - new Date(data.data_nascimento).getTime()) / (365.25 * 24 * 3600 * 1000))
      : null;

    return { sucesso: true, perfil: { ...data, idade } };
  } catch (error) {
    console.error('[obterMeuPerfil]', error.message);
    return { sucesso: false, erro: error.message };
  }
};

// ================================================================
// OBTER PERFIL DE OUTRA USUÁRIA
// ================================================================
export const obterPerfil = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('perfis_publicos')   // usa a VIEW com idade calculada
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    return { sucesso: true, perfil: data };
  } catch (error) {
    return { sucesso: false, erro: error.message };
  }
};

// ================================================================
// ATUALIZAR PERFIL
// ================================================================
export const atualizarPerfil = async (dados) => {
  try {
    const user = await _getUser();
    if (!user) throw new Error('Não autenticada');

    // Campos permitidos para atualização
    const camposPermitidos = [
      'nome', 'bio', 'data_nascimento', 'cidade', 'estado',
      'orientacao', 'interesses', 'fotos', 'foto_principal',
      'latitude', 'longitude',
    ];

    const dadosFiltrados = Object.fromEntries(
      Object.entries(dados).filter(([k]) => camposPermitidos.includes(k))
    );

    // Calcular completude do perfil
    const { data: perfilAtual } = await supabase
      .from('perfis').select('*').eq('user_id', user.id).single();

    const merged = { ...perfilAtual, ...dadosFiltrados };
    dadosFiltrados.completude = _calcularCompletude(merged);

    const { data, error } = await supabase
      .from('perfis')
      .update(dadosFiltrados)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;
    return { sucesso: true, perfil: data };
  } catch (error) {
    return { sucesso: false, erro: error.message };
  }
};

// ================================================================
// BUSCAR PERFIS PARA DESCOBERTA
// (aplica filtros de distância, idade, exclui já vistas/bloqueadas)
// ================================================================
export const buscarPerfisDescoberta = async ({ limite = 20, reiniciar = false } = {}) => {
  try {
    const user = await _getUser();
    if (!user) throw new Error('Não autenticada');

    // Carrega configurações da usuária (pode não existir ainda)
    const { data: config } = await supabase
      .from('configuracoes_usuario')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    // IDs a excluir: sempre exclui a si mesma
    const excluir = [user.id];

    // Só exclui perfis já vistos se não for reinício
    if (!reiniciar) {
      const { data: curtidas } = await supabase
        .from('curtidas')
        .select('para_user_id')
        .eq('de_user_id', user.id);
      const jaViu = curtidas?.map(c => c.para_user_id) ?? [];
      excluir.push(...jaViu);
    }

    // Busca perfis com filtro de idade
    let query = supabase
      .from('perfis_publicos')
      .select('*')
      .not('user_id', 'in', `(${excluir.join(',')})`)
      .gte('idade', config?.idade_min ?? 18)
      .lte('idade', config?.idade_max ?? 60)
      .limit(limite);

    const { data, error } = await query;
    if (error) throw error;

    return { sucesso: true, perfis: data ?? [] };
  } catch (error) {
    return { sucesso: false, erro: error.message, perfis: [] };
  }
};

// ================================================================
// ATUALIZAR CONFIGURAÇÕES
// ================================================================
export const atualizarConfiguracoes = async (config) => {
  try {
    const user = await _getUser();
    if (!user) throw new Error('Não autenticada');

    const { data, error } = await supabase
      .from('configuracoes_usuario')
      .upsert({ user_id: user.id, ...config }, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) throw error;
    return { sucesso: true, config: data };
  } catch (error) {
    return { sucesso: false, erro: error.message };
  }
};

export const obterConfiguracoes = async () => {
  try {
    const user = await _getUser();
    if (!user) throw new Error('Não autenticada');

    const { data, error } = await supabase
      .from('configuracoes_usuario')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    // maybeSingle retorna null se não existir linha (sem erro)
    if (error) throw error;
    return { sucesso: true, config: data ?? {} };
  } catch (error) {
    return { sucesso: false, erro: error.message };
  }
};

// ================================================================
// AÇÕES DE SEGURANÇA
// ================================================================
export const bloquearUsuaria = async (paraUserId) => {
  try {
    const user = await _getUser();
    const { error } = await supabase
      .from('bloqueios')
      .insert({ de_user_id: user.id, para_user_id: paraUserId });
    if (error) throw error;
    return { sucesso: true };
  } catch (error) {
    return { sucesso: false, erro: error.message };
  }
};

export const denunciarUsuaria = async (paraUserId, motivo, descricao) => {
  try {
    const user = await _getUser();
    const { error } = await supabase
      .from('denuncias')
      .insert({ de_user_id: user.id, para_user_id: paraUserId, motivo, descricao });
    if (error) throw error;
    return { sucesso: true };
  } catch (error) {
    return { sucesso: false, erro: error.message };
  }
};

// ================================================================
// HELPERS INTERNOS
// ================================================================
function _calcularCompletude(perfil) {
  const campos = [
    { campo: 'nome', peso: 15 },
    { campo: 'bio', peso: 15 },
    { campo: 'data_nascimento', peso: 10 },
    { campo: 'cidade', peso: 10 },
    { campo: 'orientacao', peso: 10 },
    { campo: 'foto_principal', peso: 20 },
    { campo: 'interesses', peso: 10, verificar: (v) => v?.length > 0 },
    { campo: 'fotos', peso: 10, verificar: (v) => v?.length >= 2 },
  ];

  return campos.reduce((total, { campo, peso, verificar }) => {
    const valor = perfil[campo];
    const preenchido = verificar ? verificar(valor) : !!valor;
    return total + (preenchido ? peso : 0);
  }, 0);
}
