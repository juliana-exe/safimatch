// src/services/authService.js - Safimatch
// Serviço de autenticação usando Supabase GoTrue (open source)

import { supabase } from '../config/supabase';

const PREMIUM_API =
  process.env.EXPO_PUBLIC_PREMIUM_API_URL ?? 'https://safimatch-premium-api.fly.dev';

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
// Deleta permanentemente todos os dados do usuário (exigido pelo Google Play)
// ================================================================
export const excluirConta = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Sessão expirada. Faça login novamente.');

    const resp = await fetch(`${PREMIUM_API}/conta/excluir`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (!resp.ok) {
      const d = await resp.json().catch(() => ({}));
      throw new Error(d.erro ?? 'Erro ao excluir conta.');
    }

    await supabase.auth.signOut();
    return { sucesso: true };
  } catch (error) {
    return { sucesso: false, erro: error.message || 'Erro ao excluir conta.' };
  }
};

// ================================================================
// VERIFICAR OTP DE E-MAIL (após cadastro com confirmação desligada)
// ================================================================
export const verificarEmailOTP = async (email, token) => {
  try {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'signup',
    });
    if (error) throw error;
    return { sucesso: true, usuario: data.user, sessao: data.session };
  } catch (error) {
    return { sucesso: false, erro: _traduzirErro(error) };
  }
};

// ================================================================
// REENVIAR CÓDIGO DE VERIFICAÇÃO POR E-MAIL
// ================================================================
export const reenviarOTP = async (email) => {
  try {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    });
    if (error) throw error;
    return { sucesso: true };
  } catch (error) {
    return { sucesso: false, erro: _traduzirErro(error) };
  }
};

// ================================================================
// VERIFICAR OTP DE TELEFONE (requer provedor SMS configurado no Supabase)
// ================================================================
export const verificarTelefoneOTP = async (phone, token) => {
  try {
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: 'sms',
    });
    if (error) throw error;
    return { sucesso: true, usuario: data.user, sessao: data.session };
  } catch (error) {
    return { sucesso: false, erro: _traduzirErro(error) };
  }
};

// ================================================================
// SOLICITAR OTP DE TELEFONE VIA SMS (requer Twilio no Supabase)
// ================================================================
export const solicitarOTPTelefone = async (phone) => {
  try {
    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (error) throw error;
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
  // GoTrue pode retornar o texto em .message, .error_description ou .msg
  const msg = (
    error?.message ||
    error?.error_description ||
    error?.msg ||
    ''
  ).toLowerCase();

  if (msg.includes('invalid login credentials'))
    return 'E-mail ou senha incorretos.';
  if (msg.includes('email not confirmed'))
    return 'Confirme seu e-mail antes de entrar.';
  if (msg.includes('user already registered'))
    return 'Este e-mail já está cadastrado.';
  if (msg.includes('password should be at least'))
    return 'A senha deve ter no mínimo 6 caracteres.';
  if (msg.includes('unable to validate email address'))
    return 'E-mail inválido.';
  if (msg.includes('email rate limit exceeded'))
    return 'Muitas tentativas. Aguarde alguns minutos.';
  if (msg.includes('token has expired') || msg.includes('otp expired') || msg.includes('token is expired'))
    return 'Código expirado. Solicite um novo código.';
  if (msg.includes('invalid otp') || msg.includes('otp has already been used') || msg.includes('token not found'))
    return 'Código incorreto. Verifique e tente novamente.';
  if (msg.includes('phone provider') || msg.includes('phone_provider') || msg.includes('unsupported provider'))
    return 'Verificação por SMS não está configurada. Entre em contato com o suporte.';
  if (msg.includes('for security purposes') || msg.includes('you can only request this after') || msg.includes('security purposes'))
    return 'Aguarde alguns segundos antes de tentar novamente.';
  if (msg.includes('network') || msg.includes('fetch'))
    return 'Erro de conexão. Verifique sua internet.';

  return error?.message || error?.error_description || 'Ocorreu um erro inesperado.';
};
