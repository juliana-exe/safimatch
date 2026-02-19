// src/services/authService.js - Safimatch
// Serviço de autenticação usando Supabase GoTrue (open source)

import { supabase } from '../config/supabase';

// ================================================================
// CADASTRO
// ================================================================
export const cadastrar = async ({ nome, email, senha }) => {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: {
        data: { nome },                    // salvo em raw_user_meta_data
        emailRedirectTo: undefined,        // app mobile não usa redirect
      },
    });

    if (error) throw error;

    return {
      sucesso: true,
      usuario: data.user,
      sessao: data.session,
      precisaConfirmarEmail: !data.session, // true se autoconfirm estiver OFF
    };
  } catch (error) {
    return { sucesso: false, erro: _traduzirErro(error) };
  }
};

// ================================================================
// LOGIN
// ================================================================
export const login = async ({ email, senha }) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    if (error) throw error;

    // Atualiza último acesso no perfil
    await supabase
      .from('perfis')
      .update({ ultimo_acesso: new Date().toISOString() })
      .eq('user_id', data.user.id);

    return { sucesso: true, usuario: data.user, sessao: data.session };
  } catch (error) {
    return { sucesso: false, erro: _traduzirErro(error) };
  }
};

// ================================================================
// LOGOUT
// ================================================================
export const logout = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { sucesso: true };
  } catch (error) {
    return { sucesso: false, erro: _traduzirErro(error) };
  }
};

// ================================================================
// RECUPERAR SENHA
// ================================================================
export const recuperarSenha = async (email) => {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
    return { sucesso: true };
  } catch (error) {
    return { sucesso: false, erro: _traduzirErro(error) };
  }
};

// ================================================================
// ALTERAR SENHA (usuária já autenticada)
// ================================================================
export const alterarSenha = async (novaSenha) => {
  try {
    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    if (error) throw error;
    return { sucesso: true };
  } catch (error) {
    return { sucesso: false, erro: _traduzirErro(error) };
  }
};

// ================================================================
// ALTERAR EMAIL
// ================================================================
export const alterarEmail = async (novoEmail) => {
  try {
    const { error } = await supabase.auth.updateUser({ email: novoEmail });
    if (error) throw error;
    return { sucesso: true };
  } catch (error) {
    return { sucesso: false, erro: _traduzirErro(error) };
  }
};

// ================================================================
// EXCLUIR CONTA
// ================================================================
export const excluirConta = async () => {
  try {
    // Desativa o perfil antes de excluir
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) throw new Error('Usuária não autenticada');

    await supabase
      .from('perfis')
      .update({ ativa: false })
      .eq('user_id', user.id);

    // Nota: exclusão real do auth.users requer service_role key (backend)
    // Implemente uma Edge Function para isso em produção
    await supabase.auth.signOut();

    return { sucesso: true };
  } catch (error) {
    return { sucesso: false, erro: _traduzirErro(error) };
  }
};

// ================================================================
// OBTER SESSÃO E USUÁRIA ATUAL
// ================================================================
export const obterSessao = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  return { sessao: session, erro: error };
};

export const obterUsuarioAtual = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  return { usuario: session?.user ?? null, erro: error };
};

// ================================================================
// OUVIR MUDANÇAS DE AUTH (para o AuthProvider)
// ================================================================
export const ouvirMudancasAuth = (callback) => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => callback(event, session)
  );
  // Retorna função de cleanup (compatível com useEffect)
  return () => subscription.unsubscribe();
};

// ================================================================
// TRADUÇÃO DE ERROS do Supabase para português
// ================================================================
const _traduzirErro = (error) => {
  const msg = error?.message || '';

  if (msg.includes('Invalid login credentials'))
    return 'E-mail ou senha incorretos.';
  if (msg.includes('Email not confirmed'))
    return 'Confirme seu e-mail antes de entrar.';
  if (msg.includes('User already registered'))
    return 'Este e-mail já está cadastrado.';
  if (msg.includes('Password should be at least'))
    return 'A senha deve ter no mínimo 6 caracteres.';
  if (msg.includes('Unable to validate email address'))
    return 'E-mail inválido.';
  if (msg.includes('Email rate limit exceeded'))
    return 'Muitas tentativas. Aguarde alguns minutos.';
  if (msg.includes('network'))
    return 'Erro de conexão. Verifique sua internet.';

  return error?.message || 'Ocorreu um erro inesperado.';
};
