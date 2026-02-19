// src/screens/CadastroScreen.js - Safimatch
import React, { useState, useRef, useCallback } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS } from '../theme/colors';
import { cadastrar } from '../services/authService';
import { atualizarPerfil } from '../services/perfilService';

const ETAPAS = [
  { id: 1, titulo: 'Acesso', icone: 'lock-closed-outline' },
  { id: 2, titulo: 'Sobre você', icone: 'person-outline' },
  { id: 3, titulo: 'Preferências', icone: 'heart-outline' },
];

const ORIENTACOES = ['Lésbica', 'Bissexual', 'Pansexual', 'Prefiro não dizer'];
const INTERESSES_OPCOES = [
  'Arte', 'Música', 'Viagem', 'Esportes', 'Leitura',
  'Cinema', 'Culinária', 'Yoga', 'Natureza', 'Moda',
  'Tecnologia', 'Fotografia', 'Dança', 'Gaming',
];

// ─── Autocomplete de cidades (API IBGE — gratuita, sem chave) ───────────────
function CidadeAutocomplete({ defaultValue, onSelect, erro, limparErro }) {
  const [texto, setTexto] = useState(defaultValue || '');
  const [sugestoes, setSugestoes] = useState([]);
  const cidadesRef = useRef(null);
  const timerRef = useRef(null);

  const normalizar = (s) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const buscar = async (q) => {
    if (q.length < 2) { setSugestoes([]); return; }
    if (!cidadesRef.current) {
      try {
        const resp = await fetch(
          'https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome'
        );
        const data = await resp.json();
        cidadesRef.current = data.map((m) => ({
          nome: m.nome,
          uf: m.microrregiao.mesorregiao.UF.sigla,
        }));
      } catch { return; }
    }
    const q2 = normalizar(q);
    const começa = cidadesRef.current.filter((c) => normalizar(c.nome).startsWith(q2));
    const contém = cidadesRef.current.filter(
      (c) => !normalizar(c.nome).startsWith(q2) && normalizar(c.nome).includes(q2)
    );
    setSugestoes([...começa, ...contém].slice(0, 8));
  };

  const handleChange = (v) => {
    setTexto(v);
    onSelect(v);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => buscar(v), 300);
    limparErro('cidade');
  };

  const selecionar = (cidade) => {
    setTexto(`${cidade.nome} — ${cidade.uf}`);
    setSugestoes([]);
    onSelect(cidade.nome);
    limparErro('cidade');
  };

  return (
    <View style={{ zIndex: 100 }}>
      <View style={[styles.inputWrapper, erro && styles.inputError]}>
        <Ionicons name="location-outline" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          value={texto}
          onChangeText={handleChange}
          placeholder="Sua cidade"
          placeholderTextColor={COLORS.textMuted}
          autoCapitalize="words"
          autoCorrect={false}
          onBlur={() => { clearTimeout(timerRef.current); setTimeout(() => setSugestoes([]), 200); }}
        />
        {texto.length > 0 && (
          <TouchableOpacity onPress={() => { setTexto(''); setSugestoes([]); onSelect(''); }}>
            <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>
      {sugestoes.length > 0 && (
        <View style={styles.dropdownContainer}>
          {sugestoes.map((c, i) => (
            <TouchableOpacity
              key={`${c.nome}-${c.uf}-${i}`}
              style={[styles.dropdownItem, i < sugestoes.length - 1 && styles.dropdownDivider]}
              onPress={() => selecionar(c)}
            >
              <Ionicons name="location-outline" size={13} color={COLORS.primary} style={{ marginRight: 8 }} />
              <Text style={styles.dropdownNome}>{c.nome}</Text>
              <Text style={styles.dropdownUF}> — {c.uf}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

export default function CadastroScreen({ navigation }) {
  const [etapa, setEtapa] = useState(1);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erros, setErros] = useState({});
  // Chips precisam de re-render, ficam em state
  const [orientacao, setOrientacao] = useState('');
  const [interesses, setInteresses] = useState([]);

  // Formulário em ref → sem re-render por keystroke → sem perda de foco
  const form = useRef({
    nome: '', email: '', senha: '', confirmarSenha: '',
    dataNascimento: '', cidade: '', bio: '',
  });

  const limparErro = useCallback((campo) => {
    setErros((e) => (e[campo] ? { ...e, [campo]: '' } : e));
  }, []);

  const validarEtapa1 = () => {
    const f = form.current;
    const e = {};
    if (!f.nome.trim()) e.nome = 'Nome é obrigatório';
    if (!f.email.trim()) e.email = 'E-mail é obrigatório';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = 'E-mail inválido';
    if (!f.senha) e.senha = 'Senha é obrigatória';
    else if (f.senha.length < 6) e.senha = 'Mínimo 6 caracteres';
    if (f.senha !== f.confirmarSenha) e.confirmarSenha = 'As senhas não coincidem';
    setErros(e);
    return Object.keys(e).length === 0;
  };

  const validarEtapa2 = () => {
    const f = form.current;
    const e = {};
    if (!f.dataNascimento.trim()) e.dataNascimento = 'Data de nascimento é obrigatória';
    if (!f.cidade.trim()) e.cidade = 'Cidade é obrigatória';
    setErros(e);
    return Object.keys(e).length === 0;
  };

  const avancar = () => {
    if (etapa === 1 && !validarEtapa1()) return;
    if (etapa === 2 && !validarEtapa2()) return;
    if (etapa < 3) setEtapa((e) => e + 1);
    else finalizar();
  };

  const finalizar = async () => {
    const f = form.current;
    setCarregando(true);
    try {
      const auth = await cadastrar({ email: f.email.trim(), senha: f.senha, nome: f.nome.trim() });
      if (!auth.sucesso) {
        alert(auth.erro);
        setCarregando(false);
        return;
      }
      await atualizarPerfil({
        data_nascimento: f.dataNascimento,
        cidade: f.cidade.trim(),
        bio: f.bio.trim(),
        orientacao,
        interesses,
      });
    } catch (e) {
      alert('Problema de conexão. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  };

  const toggleInteresse = (item) => {
    setInteresses((prev) =>
      prev.includes(item)
        ? prev.filter((i) => i !== item)
        : prev.length < 5 ? [...prev, item] : prev
    );
  };

  // --- Sub-telas (sem helper components para manter árvore plana) ---

  const renderEtapa1 = () => (
    <View style={styles.etapaContent}>
      {/* Nome */}
      <View>
        <Text style={styles.label}>Nome completo</Text>
        <View style={[styles.inputWrapper, erros.nome && styles.inputError]}>
          <Ionicons name="person-outline" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            defaultValue={form.current.nome}
            onChangeText={(v) => { form.current.nome = v; limparErro('nome'); }}
            placeholder="Seu nome"
            placeholderTextColor={COLORS.textMuted}
            autoCapitalize="words"
            autoCorrect={false}
          />
        </View>
        {erros.nome ? <Text style={styles.errorMsg}>{erros.nome}</Text> : null}
      </View>

      {/* E-mail */}
      <View>
        <Text style={styles.label}>E-mail</Text>
        <View style={[styles.inputWrapper, erros.email && styles.inputError]}>
          <Ionicons name="mail-outline" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            defaultValue={form.current.email}
            onChangeText={(v) => { form.current.email = v; limparErro('email'); }}
            placeholder="seu@email.com"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        {erros.email ? <Text style={styles.errorMsg}>{erros.email}</Text> : null}
      </View>

      {/* Senha */}
      <View>
        <Text style={styles.label}>Senha</Text>
        <View style={[styles.inputWrapper, erros.senha && styles.inputError]}>
          <Ionicons name="lock-closed-outline" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            defaultValue={form.current.senha}
            onChangeText={(v) => { form.current.senha = v; limparErro('senha'); }}
            placeholder="Mínimo 6 caracteres"
            placeholderTextColor={COLORS.textMuted}
            secureTextEntry={!mostrarSenha}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity onPress={() => setMostrarSenha((s) => !s)} style={styles.eyeBtn}>
            <Ionicons name={mostrarSenha ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>
        {erros.senha ? <Text style={styles.errorMsg}>{erros.senha}</Text> : null}
      </View>

      {/* Confirmar senha */}
      <View>
        <Text style={styles.label}>Confirmar senha</Text>
        <View style={[styles.inputWrapper, erros.confirmarSenha && styles.inputError]}>
          <Ionicons name="lock-closed-outline" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            defaultValue={form.current.confirmarSenha}
            onChangeText={(v) => { form.current.confirmarSenha = v; limparErro('confirmarSenha'); }}
            placeholder="Repita a senha"
            placeholderTextColor={COLORS.textMuted}
            secureTextEntry={!mostrarSenha}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        {erros.confirmarSenha ? <Text style={styles.errorMsg}>{erros.confirmarSenha}</Text> : null}
      </View>
    </View>
  );

  const renderEtapa2 = () => (
    <View style={styles.etapaContent}>
      {/* Data de nascimento */}
      <View>
        <Text style={styles.label}>Data de nascimento</Text>
        <View style={[styles.inputWrapper, erros.dataNascimento && styles.inputError]}>
          <Ionicons name="calendar-outline" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            defaultValue={form.current.dataNascimento}
            onChangeText={(v) => { form.current.dataNascimento = v; limparErro('dataNascimento'); }}
            placeholder="DD/MM/AAAA"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="numeric"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        {erros.dataNascimento ? <Text style={styles.errorMsg}>{erros.dataNascimento}</Text> : null}
      </View>

      {/* Cidade */}
      <View>
        <Text style={styles.label}>Cidade</Text>
        <CidadeAutocomplete
          defaultValue={form.current.cidade}
          onSelect={(v) => { form.current.cidade = v; }}
          erro={erros.cidade}
          limparErro={limparErro}
        />
        {erros.cidade ? <Text style={styles.errorMsg}>{erros.cidade}</Text> : null}
      </View>

      {/* Bio */}
      <View>
        <Text style={styles.label}>Bio <Text style={styles.labelHint}>(opcional)</Text></Text>
        <View style={[styles.inputWrapper, { height: 90, alignItems: 'flex-start', paddingTop: 12 }]}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            defaultValue={form.current.bio}
            onChangeText={(v) => { form.current.bio = v; }}
            placeholder="Conte um pouco sobre você..."
            placeholderTextColor={COLORS.textMuted}
            multiline
            maxLength={200}
            autoCorrect={false}
          />
        </View>
      </View>
    </View>
  );

  const renderEtapa3 = () => (
    <View style={styles.etapaContent}>
      <View>
        <Text style={styles.label}>Orientação sexual</Text>
        <View style={styles.chipGroup}>
          {ORIENTACOES.map((o) => (
            <TouchableOpacity
              key={o}
              style={[styles.chip, orientacao === o && styles.chipAtivo]}
              onPress={() => setOrientacao(o)}
            >
              <Text style={[styles.chipText, orientacao === o && styles.chipTextoAtivo]}>{o}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View>
        <Text style={styles.label}>
          Interesses <Text style={styles.labelHint}>(escolha até 5)</Text>
        </Text>
        <View style={styles.chipGroup}>
          {INTERESSES_OPCOES.map((item) => {
            const ativo = interesses.includes(item);
            return (
              <TouchableOpacity
                key={item}
                style={[styles.chip, ativo && styles.chipAtivo]}
                onPress={() => toggleInteresse(item)}
              >
                <Text style={[styles.chipText, ativo && styles.chipTextoAtivo]}>{item}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.avisoBox}>
        <Ionicons name="shield-checkmark" size={18} color={COLORS.secondary} />
        <Text style={styles.avisoText}>
          <Text style={{ fontWeight: '700' }}>Safimatch Verificado: </Text>
          Suas informações são protegidas e nunca compartilhadas sem seu consentimento.
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Voltar */}
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => (etapa > 1 ? setEtapa((e) => e - 1) : navigation.goBack())}
          >
            <Ionicons name="arrow-back" size={22} color={COLORS.textSecondary} />
            <Text style={styles.backText}>Voltar</Text>
          </TouchableOpacity>

          {/* Logo */}
          <View style={styles.logoArea}>
            <LinearGradient colors={[COLORS.primary, COLORS.secondary]} style={styles.iconCircle}>
              <Ionicons name="heart" size={30} color={COLORS.white} />
            </LinearGradient>
            <Text style={styles.title}>Crie sua conta</Text>
            <Text style={styles.subtitle}>Comece sua história no Safimatch</Text>
          </View>

          {/* Progresso */}
          <View style={styles.progressArea}>
            {ETAPAS.map((e, idx) => (
              <View key={e.id} style={styles.progressItem}>
                <View style={[styles.progressDot, etapa >= e.id && styles.progressDotAtivo]}>
                  {etapa > e.id ? (
                    <Ionicons name="checkmark" size={14} color={COLORS.white} />
                  ) : (
                    <Text style={[styles.progressNum, etapa >= e.id && styles.progressNumAtivo]}>{e.id}</Text>
                  )}
                </View>
                <Text style={[styles.progressLabel, etapa >= e.id && styles.progressLabelAtivo]}>{e.titulo}</Text>
                {idx < ETAPAS.length - 1 && (
                  <View style={[styles.progressLine, etapa > e.id && styles.progressLineAtivo]} />
                )}
              </View>
            ))}
          </View>

          {/* Conteúdo */}
          {etapa === 1 && renderEtapa1()}
          {etapa === 2 && renderEtapa2()}
          {etapa === 3 && renderEtapa3()}

          {/* Botão */}
          <TouchableOpacity
            style={[styles.btnAvancar, carregando && styles.btnDisabled]}
            onPress={avancar}
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
                  <Text style={styles.btnText}>{etapa < 3 ? 'Continuar' : 'Criar minha conta'}</Text>
                  <Ionicons name={etapa < 3 ? 'arrow-forward' : 'heart'} size={20} color={COLORS.white} />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Rodapé */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Já tem conta? </Text>
            <TouchableOpacity onPress={() => navigation.replace('Login')}>
              <Text style={styles.linkText}>Faça login</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flexGrow: 1, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xl },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACING.md, marginBottom: SPACING.md },
  backText: { fontSize: 15, color: COLORS.textSecondary, fontWeight: '500' },

  logoArea: { alignItems: 'center', marginBottom: SPACING.lg },
  iconCircle: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 4 },
  subtitle: { fontSize: 14, color: COLORS.textSecondary },

  // Progresso
  progressArea: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.lg, gap: 0 },
  progressItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  progressDot: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  progressDotAtivo: { backgroundColor: COLORS.primary },
  progressNum: { fontSize: 13, fontWeight: '700', color: COLORS.textMuted },
  progressNumAtivo: { color: COLORS.white },
  progressLabel: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600', marginRight: 4 },
  progressLabelAtivo: { color: COLORS.primary },
  progressLine: { width: 24, height: 2, backgroundColor: COLORS.border, marginHorizontal: 2 },
  progressLineAtivo: { backgroundColor: COLORS.primary },

  etapaContent: { gap: 16, marginBottom: SPACING.lg },
  label: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 8 },
  labelHint: { fontWeight: '400', color: COLORS.textMuted },

  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.md, paddingHorizontal: 14, height: 52,
  },
  inputError: { borderColor: COLORS.error },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: COLORS.textPrimary },
  eyeBtn: { padding: 4 },
  errorMsg: { fontSize: 12, color: COLORS.error, marginTop: 5 },
  charCount: { fontSize: 11, color: COLORS.textMuted, textAlign: 'right', marginTop: 4 },

  // Chips
  chipGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.white,
    borderWidth: 1.5, borderColor: COLORS.border,
  },
  chipAtivo: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  chipTextoAtivo: { color: COLORS.white },

  // Aviso
  avisoBox: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: '#F3E5F5', borderRadius: RADIUS.md,
    padding: SPACING.md, borderWidth: 1, borderColor: '#CE93D8',
  },
  avisoText: { flex: 1, fontSize: 13, color: COLORS.secondary, lineHeight: 18 },

  btnAvancar: { borderRadius: RADIUS.lg, overflow: 'hidden', marginBottom: SPACING.md },
  btnDisabled: { opacity: 0.7 },
  btnGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 17,
  },
  btnText: { fontSize: 17, fontWeight: '700', color: COLORS.white },

  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  footerText: { fontSize: 14, color: COLORS.textSecondary },
  linkText: { fontSize: 14, color: COLORS.primary, fontWeight: '700' },

  // Autocomplete dropdown
  dropdownContainer: {
    position: 'absolute',
    top: 54,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    zIndex: 1000,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
  },
  dropdownDivider: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  dropdownNome: { fontSize: 14, color: COLORS.textPrimary, fontWeight: '500' },
  dropdownUF: { fontSize: 14, color: COLORS.textMuted },
});
