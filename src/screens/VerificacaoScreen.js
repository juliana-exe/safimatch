// src/screens/VerificacaoScreen.js - Safimatch
// Tela de verificação por OTP — e-mail (pós-cadastro) ou telefone
// Params: { tipo: 'email'|'telefone', email?, telefone?, pendingPerfil? }

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS } from '../theme/colors';
import {
  verificarEmailOTP,
  reenviarOTP,
  verificarTelefoneOTP,
} from '../services/authService';
import { atualizarPerfil } from '../services/perfilService';
import { useAuth } from '../context/AuthContext';

const COD_LENGTH = 8;
const COUNTDOWN_INICIAL = 60;

export default function VerificacaoScreen({ navigation, route }) {
  const { recarregarAuth, setarSessaoImediata } = useAuth();
  const {
    tipo = 'email',
    email = '',
    telefone = '',
    pendingPerfil = null,
  } = route.params || {};

  const destino     = tipo === 'email' ? email : telefone;
  const destinoMask = tipo === 'email'
    ? destino // mostra e-mail completo
    : destino.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');

  const [codigo,       setCodigo]       = useState(Array(COD_LENGTH).fill(''));
  const [verificando,  setVerificando]  = useState(false);
  const [reenviando,   setReenviando]   = useState(false);
  const [countdown,    setCountdown]    = useState(COUNTDOWN_INICIAL);
  const [erro,         setErro]         = useState('');
  const [sucesso,      setSucesso]      = useState(false);
  const inputs = useRef([]);
  const countdownRef = useRef(null);

  // ── Countdown para reenvio ─────────────────────────────────────
  useEffect(() => {
    iniciarCountdown();
    return () => clearInterval(countdownRef.current);
  }, []);

  const iniciarCountdown = () => {
    clearInterval(countdownRef.current);
    setCountdown(COUNTDOWN_INICIAL);
    countdownRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(countdownRef.current); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  // ── Digitação nas caixas OTP ──────────────────────────────────
  const handleDigito = (val, idx) => {
    // Suporte a colar código completo na primeira caixa
    if (val.length > 1) {
      const digits = val.replace(/\D/g, '').slice(0, COD_LENGTH);
      const arr = Array(COD_LENGTH).fill('');
      digits.split('').forEach((d, i) => { arr[i] = d; });
      setCodigo(arr);
      setErro('');
      const next = Math.min(digits.length, COD_LENGTH - 1);
      inputs.current[next]?.focus();
      if (digits.length === COD_LENGTH) verificar(digits);
      return;
    }

    const digit = val.replace(/\D/g, '').slice(-1);
    const novo = [...codigo];
    novo[idx] = digit;
    setCodigo(novo);
    setErro('');

    if (digit && idx < COD_LENGTH - 1) {
      inputs.current[idx + 1]?.focus();
    }
    if (digit && novo.every(d => d)) {
      verificar(novo.join(''));
    }
  };

  const handleBackspace = (e, idx) => {
    if (e.nativeEvent.key === 'Backspace' && !codigo[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus();
    }
  };

  // ── Verificar OTP ─────────────────────────────────────────────
  const verificar = async (cod) => {
    const token = (cod ?? codigo.join('')).trim();
    if (token.length < COD_LENGTH) {
      setErro('Digite o código completo de 8 dígitos.');
      return;
    }
    if (verificando) return;
    setVerificando(true);
    setErro('');

    try {
      let res;
      if (tipo === 'email') {
        res = await verificarEmailOTP(email, token);
      } else {
        res = await verificarTelefoneOTP(telefone, token);
      }

      if (!res.sucesso) {
        setErro(res.erro || 'Código inválido ou expirado. Tente novamente.');
        setCodigo(Array(COD_LENGTH).fill(''));
        inputs.current[0]?.focus();
        return;
      }

      // Mostra tela de sucesso imediatamente
      setSucesso(true);

      // Se o verifyOtp já retornou a sessão, injeta diretamente no contexto
      // (zero chamadas de rede — navegação acontece em milissegundos)
      if (res.sessao) {
        setarSessaoImediata(res.sessao);
      } else {
        // Fallback: relê do AsyncStorage caso a sessão não venha no retorno
        recarregarAuth();
      }

      // Salva dados do perfil usando a sessão já disponível do verifyOtp
      // (não depende do AsyncStorage, evita race condition)
      if (pendingPerfil && Object.keys(pendingPerfil).length > 0) {
        atualizarPerfil(pendingPerfil, res.sessao ?? null).then(resAtualizar => {
          if (!resAtualizar.sucesso) {
            console.warn('[VerificacaoScreen] atualizarPerfil erro:', resAtualizar.erro);
          }
        });
      }
    } finally {
      setVerificando(false);
    }
  };

  // ── Reenviar código ───────────────────────────────────────────
  const reenviar = async () => {
    if (countdown > 0 || reenviando) return;
    setReenviando(true);
    setErro('');
    try {
      const res = await reenviarOTP(email);
      if (res.sucesso) {
        iniciarCountdown();
        Alert.alert(
          'Código reenviado! 📬',
          `Verifique a caixa de entrada de\n${email}`,
          [{ text: 'OK' }]
        );
      } else {
        setErro(res.erro || 'Não foi possível reenviar. Tente novamente.');
      }
    } finally {
      setReenviando(false);
    }
  };

  // ── Metadados por tipo ────────────────────────────────────────
  const meta = {
    email: {
      icone: 'mail',
      titulo: 'Verifique seu e-mail',
      desc: `Enviamos um código de 8 dígitos para`,
      dica: 'Verifique também a pasta de spam.',
    },
    telefone: {
      icone: 'phone-portrait',
      titulo: 'Verifique seu telefone',
      desc: `Enviamos um SMS com o código para`,
      dica: 'O SMS pode levar alguns segundos para chegar.',
    },
  }[tipo];

  // ── Tela de sucesso ───────────────────────────────────────────
  if (sucesso) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.sucessoContainer}>
          <LinearGradient colors={[COLORS.primary, COLORS.secondary]} style={s.sucessoCircle}>
            <Ionicons name="checkmark-circle" size={48} color="#fff" />
          </LinearGradient>
          <Text style={s.sucessoTitle}>Verificado! 🎉</Text>
          <Text style={s.sucessoDesc}>
            {tipo === 'email' ? 'E-mail confirmado com sucesso.' : 'Telefone verificado com sucesso.'}
            {'\n'}Você já pode usar o Safimatch!
          </Text>
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 24 }} />
          <Text style={s.redirecionando}>Entrando no app...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Voltar */}
          <TouchableOpacity style={s.back} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={COLORS.textSecondary} />
            <Text style={s.backText}>Voltar</Text>
          </TouchableOpacity>

          {/* Ícone */}
          <View style={s.iconArea}>
            <LinearGradient colors={[COLORS.primary, COLORS.secondary]} style={s.iconCircle}>
              <Ionicons name={meta.icone} size={36} color="#fff" />
            </LinearGradient>
          </View>

          {/* Cabeçalho */}
          <Text style={s.title}>{meta.titulo}</Text>
          <Text style={s.desc}>
            {meta.desc}{'\n'}
            <Text style={s.destino}>{destinoMask}</Text>
          </Text>

          {/* Caixas OTP */}
          <View style={s.otpRow}>
            {Array(COD_LENGTH).fill(0).map((_, i) => (
              <TextInput
                key={i}
                ref={r => { inputs.current[i] = r; }}
                style={[
                  s.otpBox,
                  codigo[i] ? s.otpBoxFilled : null,
                  erro         ? s.otpBoxError : null,
                ]}
                value={codigo[i]}
                onChangeText={v => handleDigito(v, i)}
                onKeyPress={e => handleBackspace(e, i)}
                keyboardType="number-pad"
                maxLength={COD_LENGTH} // permite colar
                selectTextOnFocus
                textAlign="center"
                editable={!verificando}
              />
            ))}
          </View>

          {/* Mensagem de erro */}
          {!!erro && (
            <View style={s.erroBox}>
              <Ionicons name="alert-circle-outline" size={16} color={COLORS.error} />
              <Text style={s.erroText}>{erro}</Text>
            </View>
          )}

          {/* Botão verificar */}
          <TouchableOpacity
            style={[s.btn, (verificando || codigo.some(d => !d)) && s.btnDisabled]}
            onPress={() => verificar()}
            disabled={verificando || codigo.some(d => !d)}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[COLORS.primaryLight, COLORS.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.btnGradient}
            >
              {verificando ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                  <Text style={s.btnText}>Verificar código</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Dica */}
          <View style={s.dicaBox}>
            <Ionicons name="information-circle-outline" size={16} color={COLORS.textMuted} />
            <Text style={s.dicaText}>{meta.dica}</Text>
          </View>

          {/* Reenviar */}
          <View style={s.reenviarArea}>
            <Text style={s.reenviarHint}>Não recebeu o código?</Text>
            {countdown > 0 ? (
              <View style={s.countdownRow}>
                <Ionicons name="time-outline" size={14} color={COLORS.textMuted} />
                <Text style={s.countdownText}>
                  Reenviar em <Text style={s.countdownNum}>{countdown}s</Text>
                </Text>
              </View>
            ) : reenviando ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <TouchableOpacity onPress={reenviar} style={s.reenviarBtn}>
                <Ionicons name="refresh-outline" size={16} color={COLORS.primary} />
                <Text style={s.reenviarBtnText}>Reenviar código</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Alterar e-mail/telefone */}
          <TouchableOpacity style={s.alterarBtn} onPress={() => navigation.goBack()}>
            <Text style={s.alterarText}>
              {tipo === 'email' ? 'Alterar e-mail' : 'Alterar telefone'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.background },
  scroll: { flexGrow: 1, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xl },

  back:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACING.md, marginBottom: SPACING.lg },
  backText: { fontSize: 15, color: COLORS.textSecondary, fontWeight: '500' },

  iconArea:   { alignItems: 'center', marginBottom: 20 },
  iconCircle: {
    width: 84, height: 84, borderRadius: 42,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 14, elevation: 10,
  },

  title:   { fontSize: 26, fontWeight: '800', color: COLORS.textPrimary, textAlign: 'center', marginBottom: 10 },
  desc:    { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  destino: { fontWeight: '700', color: COLORS.textPrimary },

  // ── OTP ──────────────────────────────────────────────────────
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 20,
  },
  otpBox: {
    width: 48, height: 60,
    borderRadius: 12,
    borderWidth: 2, borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    fontSize: 24, fontWeight: '800', color: COLORS.textPrimary,
    textAlignVertical: 'center',
  },
  otpBoxFilled: {
    borderColor: COLORS.primary,
    backgroundColor: '#FDF0F5',
  },
  otpBoxError: {
    borderColor: COLORS.error,
    backgroundColor: '#FFF5F5',
  },

  // ── Erro ─────────────────────────────────────────────────────
  erroBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFF0F0',
    borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 16, borderWidth: 1, borderColor: COLORS.error,
  },
  erroText: { fontSize: 13, color: COLORS.error, flex: 1, lineHeight: 18 },

  // ── Botão ─────────────────────────────────────────────────────
  btn:        { borderRadius: RADIUS.lg, overflow: 'hidden', marginBottom: 16 },
  btnDisabled:{ opacity: 0.5 },
  btnGradient:{
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 17,
  },
  btnText: { fontSize: 17, fontWeight: '700', color: '#fff' },

  // ── Dica ─────────────────────────────────────────────────────
  dicaBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F8F4FF', borderRadius: RADIUS.md,
    paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 28, borderWidth: 1, borderColor: COLORS.border,
  },
  dicaText: { fontSize: 12, color: COLORS.textMuted, flex: 1, lineHeight: 17 },

  // ── Reenviar ─────────────────────────────────────────────────
  reenviarArea: { alignItems: 'center', gap: 10, marginBottom: 16 },
  reenviarHint: { fontSize: 14, color: COLORS.textMuted },
  countdownRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  countdownText:{ fontSize: 14, color: COLORS.textMuted },
  countdownNum: { fontWeight: '700', color: COLORS.textPrimary },
  reenviarBtn:  { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 6 },
  reenviarBtnText: { fontSize: 15, color: COLORS.primary, fontWeight: '700' },

  // ── Alterar destino ───────────────────────────────────────────
  alterarBtn:  { alignItems: 'center', paddingVertical: 8 },
  alterarText: { fontSize: 13, color: COLORS.textMuted, textDecorationLine: 'underline' },

  // ── Tela de sucesso ───────────────────────────────────────────
  sucessoContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  sucessoCircle: {
    width: 100, height: 100, borderRadius: 50,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 12,
  },
  sucessoTitle: { fontSize: 28, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 12 },
  sucessoDesc:  { fontSize: 16, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 24 },
  redirecionando:{ fontSize: 14, color: COLORS.textMuted, marginTop: 8 },
});
