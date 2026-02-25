// src/context/AuthContext.js - Safimatch
// Contexto global de autenticação — disponível em todas as telas

import React, { createContext, useContext, useEffect, useState } from 'react';
import { ouvirMudancasAuth, obterSessao, obterUsuarioAtual } from '../services/authService';
import { obterMeuPerfil } from '../services/perfilService';
import { supabase } from '../config/supabase';
import { registrarPushToken } from '../services/notificationService';

// ----------------------------------------------------------------
const AuthContext = createContext(null);

// Decodifica payload do JWT sem biblioteca externa
const _decodeJwtRole = (token) => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.role ?? '';
  } catch {
    return '';
  }
};

// ================================================================
// PROVIDER — envolve o App inteiro
// ================================================================
export const AuthProvider = ({ children }) => {
  const [sessao, setSessao]     = useState(null);
  const [usuario, setUsuario]   = useState(null);
  const [perfil, setPerfil]     = useState(null);
  const [carregando, setCarregando] = useState(true);

  // Carrega sessão inicial ao abrir o app
  useEffect(() => {
    const inicializar = async () => {
      // Timeout de segurança: nunca trava o app por mais de 6s
      const timeout = setTimeout(() => {
        console.warn('AuthContext: timeout atingido, liberando carregando');
        setCarregando(false);
      }, 6000);

      try {
        const { sessao: s } = await obterSessao();

        // Valida se o JWT tem role correto (sessões antigas podem ter role: "")
        if (s?.access_token) {
          const role = _decodeJwtRole(s.access_token);
          if (!role || role === '') {
            console.warn('JWT com role inválido — limpando sessão');
            await supabase.auth.signOut();
            clearTimeout(timeout);
            setCarregando(false);
            return;
          }
        }

        setSessao(s);
        setUsuario(s?.user ?? null);

        if (s?.user) {
          const { perfil: p } = await obterMeuPerfil();
          setPerfil(p);
        }
      } catch (e) {
        console.warn('Erro ao inicializar auth:', e);
      } finally {
        clearTimeout(timeout);
        setCarregando(false);
      }
    };

    inicializar();
  }, []);

  // Escuta mudanças de auth (login / logout / refresh)
  useEffect(() => {
    const cancelar = ouvirMudancasAuth(async (evento, novaSessao) => {
      setSessao(novaSessao);
      setUsuario(novaSessao?.user ?? null);

      if (novaSessao?.user) {
        const { perfil: p } = await obterMeuPerfil();
        setPerfil(p);
        // Registra push token em background (falha silenciosa em emulador)
        registrarPushToken().catch(() => {});
      } else {
        setPerfil(null);
      }
    });

    return cancelar; // unsubscribe ao desmontar
  }, []);

  // Permite que qualquer tela atualize o perfil localmente
  // (ex: depois de editar o perfil)
  const atualizarPerfilLocal = (novosDados) => {
    setPerfil(prev => ({ ...prev, ...novosDados }));
  };

  // Injeta uma sessão já conhecida (ex: retorno do verifyOtp) diretamente no
  // contexto sem nenhuma chamada de rede. Navegação acontece instantaneamente.
  const setarSessaoImediata = (s) => {
    setSessao(s);
    setUsuario(s?.user ?? null);
    // Perfil carrega em background sem bloquear
    if (s?.user) {
      obterMeuPerfil().then(({ perfil: p }) => { if (p) setPerfil(p); });
    }
  };

  // Relê a sessão manualmente — útil após verifyOtp, que às vezes não
  // dispara onAuthStateChange no React Native com AsyncStorage.
  // Só  adb -s emulator-5554 shell ping -c 4 192.168.100.59 espera obterSessao() para setar autenticada=true rápido;
  // o perfil é carregado em background sem bloquear a navegação.
  const recarregarAuth = async () => {
    try {
      const { sessao: s } = await obterSessao();
      setSessao(s);
      setUsuario(s?.user ?? null);
      if (s?.user) {
        // Não aguarda: perfil carrega em background enquanto o app navega
        obterMeuPerfil().then(({ perfil: p }) => { if (p) setPerfil(p); });
      } else {
        setPerfil(null);
      }
    } catch (e) {
      console.warn('recarregarAuth erro:', e);
    }
  };

  const value = {
    sessao,
    usuario,
    perfil,
    carregando,
    autenticada: !!sessao,
    atualizarPerfilLocal,
    recarregarAuth,
    setarSessaoImediata,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// ================================================================
// HOOK — use em qualquer tela
// ================================================================
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
};
