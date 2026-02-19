// src/screens/LoginScreen.js - Safimatch
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS } from '../theme/colors';
import { login, recuperarSenha } from '../services/authService';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erros, setErros] = useState({});

  const validar = () => {
    const novosErros = {};
    if (!email.trim()) novosErros.email = 'E-mail é obrigatório';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      novosErros.email = 'E-mail inválido';
    if (!senha) novosErros.senha = 'Senha é obrigatória';
    setErros(novosErros);
    return Object.keys(novosErros).length === 0;
  };

  const handleLogin = async () => {
    if (!validar()) return;
    setCarregando(true);
    try {
      const resultado = await login({ email: email.trim(), senha });
      if (!resultado.sucesso) {
        Alert.alert('Erro ao entrar', resultado.erro);
      }
      // Navegação gerenciada pelo AuthContext + guarda na Navigation
    } catch (e) {
      Alert.alert('Erro', 'Problema de conexão. Verifique sua internet.');
    } finally {
      setCarregando(false);
    }
  };

  const handleEsqueceuSenha = async () => {
    if (!email.trim()) {
      Alert.alert('Atenção', 'Preencha seu e-mail antes de recuperar a senha.');
      return;
    }
    const resultado = await recuperarSenha(email.trim());
    Alert.alert(
      resultado.sucesso ? 'E-mail enviado!' : 'Erro',
      resultado.sucesso
        ? 'Verifique sua caixa de entrada para redefinir a senha.'
        : resultado.erro,
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={22} color={COLORS.textSecondary} />
            <Text style={styles.backText}>Voltar</Text>
          </TouchableOpacity>

          {/* Logo mini */}
          <View style={styles.logoArea}>
            <LinearGradient
              colors={[COLORS.primary, COLORS.secondary]}
              style={styles.iconCircle}
            >
              <Ionicons name="heart" size={30} color={COLORS.white} />
            </LinearGradient>
            <Text style={styles.title}>Bem-vinda de volta!</Text>
            <Text style={styles.subtitle}>Entre no Safimatch e continue sua história</Text>
          </View>

          {/* Formulário */}
          <View style={styles.form}>
            {/* E-mail */}
            <View>
              <Text style={styles.label}>E-mail</Text>
              <View style={[styles.inputWrapper, erros.email && styles.inputError]}>
                <Ionicons name="mail-outline" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={(v) => { setEmail(v); setErros((e) => ({ ...e, email: '' })); }}
                  placeholder="seu@email.com"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              {erros.email && (
                <Text style={styles.errorMsg}>
                  <Ionicons name="alert-circle-outline" size={12} /> {erros.email}
                </Text>
              )}
            </View>

            {/* Senha */}
            <View>
              <Text style={styles.label}>Senha</Text>
              <View style={[styles.inputWrapper, erros.senha && styles.inputError]}>
                <Ionicons name="lock-closed-outline" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={senha}
                  onChangeText={(v) => { setSenha(v); setErros((e) => ({ ...e, senha: '' })); }}
                  placeholder="••••••••"
                  placeholderTextColor={COLORS.textMuted}
                  secureTextEntry={!mostrarSenha}
                />
                <TouchableOpacity onPress={() => setMostrarSenha(!mostrarSenha)} style={styles.eyeBtn}>
                  <Ionicons
                    name={mostrarSenha ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={COLORS.textMuted}
                  />
                </TouchableOpacity>
              </View>
              {erros.senha && (
                <Text style={styles.errorMsg}>
                  <Ionicons name="alert-circle-outline" size={12} /> {erros.senha}
                </Text>
              )}
            </View>

            <TouchableOpacity onPress={handleEsqueceuSenha} style={styles.forgotBtn}>
              <Text style={styles.forgotText}>Esqueceu a senha?</Text>
            </TouchableOpacity>

            {/* Botão entrar */}
            <TouchableOpacity
              style={[styles.btnEntrar, carregando && styles.btnDisabled]}
              onPress={handleLogin}
              disabled={carregando}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[COLORS.primaryLight, COLORS.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.btnGradient}
              >
                {carregando ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <>
                    <Ionicons name="log-in-outline" size={20} color={COLORS.white} />
                    <Text style={styles.btnText}>Entrar</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Rodapé */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Não tem conta? </Text>
            <TouchableOpacity onPress={() => navigation.replace('Cadastro')}>
              <Text style={styles.linkText}>Cadastre-se</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
  },
  backText: { fontSize: 15, color: COLORS.textSecondary, fontWeight: '500' },

  logoArea: { alignItems: 'center', marginBottom: SPACING.xl },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  title: { fontSize: 28, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 6 },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },

  form: { gap: 18 },
  label: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 8 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    height: 52,
  },
  inputError: { borderColor: COLORS.error },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: COLORS.textPrimary },
  eyeBtn: { padding: 4 },

  errorMsg: { fontSize: 12, color: COLORS.error, marginTop: 5 },

  forgotBtn: { alignSelf: 'flex-end', marginTop: -6 },
  forgotText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },

  btnEntrar: { borderRadius: RADIUS.lg, overflow: 'hidden', marginTop: 4 },
  btnDisabled: { opacity: 0.7 },
  btnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 17,
  },
  btnText: { fontSize: 17, fontWeight: '700', color: COLORS.white },

  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.xl,
  },
  footerText: { fontSize: 14, color: COLORS.textSecondary },
  linkText: { fontSize: 14, color: COLORS.primary, fontWeight: '700' },
});
