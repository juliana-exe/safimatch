// src/screens/ConfiguracaoScreen.js - Safimatch
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS } from '../theme/colors';
import { logout, excluirConta, alterarEmail, alterarSenha } from '../services/authService';
import {
  obterMeuPerfil, atualizarPerfil,
  obterConfiguracoes, atualizarConfiguracoes,
} from '../services/perfilService';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../config/supabase';

// ── Constantes ────────────────────────────────────────────────────────────────
const ORIENTACOES = ['Lésbica', 'Bissexual', 'Pansexual', 'Prefiro não dizer'];
const ORIENTACOES_VALS = ['lesbica', 'bissexual', 'pansexual', 'prefiro_nao_dizer'];
const INTERESSES_OPCOES = [
  'Arte', 'Música', 'Viagem', 'Esportes', 'Leitura',
  'Cinema', 'Culinária', 'Yoga', 'Natureza', 'Moda',
  'Tecnologia', 'Fotografia', 'Dança', 'Gaming',
];

// ── Componente: Seção ─────────────────────────────────────────────────────────
function Secao({ titulo, children }) {
  return (
    <View style={styles.secao}>
      {titulo ? <Text style={styles.secaoTitulo}>{titulo}</Text> : null}
      <View style={styles.secaoCard}>{children}</View>
    </View>
  );
}

// ── Componente: Linha ─────────────────────────────────────────────────────────
function Linha({ icone, corIcone = COLORS.primary, titulo, subtitulo, onPress, direita }) {
  return (
    <TouchableOpacity
      style={styles.linha}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress && direita === undefined}
    >
      <View style={[styles.linhaIcone, { backgroundColor: corIcone + '1A' }]}>
        <Ionicons name={icone} size={20} color={corIcone} />
      </View>
      <View style={styles.linhaInfo}>
        <Text style={styles.linhaTitulo}>{titulo}</Text>
        {subtitulo ? <Text style={styles.linhaSubtitulo} numberOfLines={1}>{subtitulo}</Text> : null}
      </View>
      {direita !== undefined ? direita : onPress ? (
        <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
      ) : null}
    </TouchableOpacity>
  );
}

const Sep = () => <View style={styles.separador} />;

// ── Autocomplete de cidades (API IBGE) ────────────────────────────────────────
function CidadeAutocomplete({ value, onChange }) {
  const [texto, setTexto] = useState(value || '');
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
        cidadesRef.current = (await resp.json()).map((m) => ({
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
    setSugestoes([...começa, ...contém].slice(0, 7));
  };

  const handleChange = (v) => {
    setTexto(v);
    onChange(v);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => buscar(v), 300);
  };

  const selecionar = (c) => {
    const label = `${c.nome} — ${c.uf}`;
    setTexto(label);
    setSugestoes([]);
    onChange(c.nome);
  };

  return (
    <View>
      <View style={styles.modalInputBox}>
        <Ionicons name="location-outline" size={18} color={COLORS.textMuted} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.modalInput}
          value={texto}
          onChangeText={handleChange}
          placeholder="Sua cidade"
          placeholderTextColor={COLORS.textMuted}
          autoCapitalize="words"
          autoCorrect={false}
          onBlur={() => { clearTimeout(timerRef.current); setTimeout(() => setSugestoes([]), 250); }}
        />
        {texto.length > 0 && (
          <TouchableOpacity onPress={() => { setTexto(''); setSugestoes([]); onChange(''); }}>
            <Ionicons name="close-circle" size={17} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>
      {/* Dropdown inline — funciona dentro de ScrollView em web e mobile */}
      {sugestoes.length > 0 && (
        <View style={styles.dropdownInline}>
          {sugestoes.map((c, i) => (
            <TouchableOpacity
              key={`${c.nome}-${c.uf}`}
              style={[styles.dropItem, i < sugestoes.length - 1 && styles.dropDiv]}
              onPress={() => selecionar(c)}
            >
              <Ionicons name="location-outline" size={13} color={COLORS.primary} style={{ marginRight: 6 }} />
              <Text style={styles.dropNome}>{c.nome}</Text>
              <Text style={styles.dropUF}> — {c.uf}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MODAL: EDITAR PERFIL
// ══════════════════════════════════════════════════════════════════════════════
function ModalEditarPerfil({ visivel, perfil, onFechar, onSalvar }) {
  const form = useRef({});
  const [orientacao, setOrientacao] = useState('');
  const [interesses, setInteresses] = useState([]);
  const [erros, setErros] = useState({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (visivel && perfil) {
      form.current = {
        nome: perfil.nome || '',
        bio: perfil.bio || '',
        data_nascimento: perfil.data_nascimento?.split('T')[0] || '',
        cidade: perfil.cidade || '',
      };
      setOrientacao(perfil.orientacao || '');
      setInteresses(perfil.interesses || []);
      setErros({});
    }
  }, [visivel, perfil]);

  const toggleInteresse = (item) =>
    setInteresses((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : prev.length < 5 ? [...prev, item] : prev
    );

  const salvar = async () => {
    const f = form.current;
    const e = {};
    if (!f.nome?.trim()) e.nome = 'Nome obrigatório';
    if (f.bio && f.bio.length > 300) e.bio = 'Máximo 300 caracteres';
    if (Object.keys(e).length) { setErros(e); return; }

    setSalvando(true);
    const res = await atualizarPerfil({
      nome: f.nome.trim(),
      bio: f.bio?.trim() || '',
      data_nascimento: f.data_nascimento || undefined,
      cidade: f.cidade?.trim() || '',
      orientacao: orientacao || undefined,
      interesses,
    });
    setSalvando(false);

    if (res.sucesso) onSalvar(res.perfil);
    else Alert.alert('Erro', res.erro || 'Não foi possível salvar.');
  };

  return (
    <Modal visible={visivel} animationType="slide" presentationStyle="pageSheet" onRequestClose={onFechar}>
      <SafeAreaView style={styles.modalSafe}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onFechar} style={styles.modalBtnClose}>
            <Ionicons name="close" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.modalTitulo}>Editar Perfil</Text>
          <TouchableOpacity onPress={salvar} disabled={salvando} style={styles.modalBtnSave}>
            {salvando
              ? <ActivityIndicator size="small" color={COLORS.primary} />
              : <Text style={styles.modalBtnSaveText}>Salvar</Text>}
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">

            {/* Nome */}
            <Text style={styles.modalLabel}>Nome</Text>
            <View style={[styles.modalInputBox, erros.nome && styles.inputErro]}>
              <Ionicons name="person-outline" size={18} color={COLORS.textMuted} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.modalInput}
                defaultValue={form.current.nome}
                onChangeText={(v) => { form.current.nome = v; setErros((e) => ({ ...e, nome: '' })); }}
                placeholder="Seu nome"
                placeholderTextColor={COLORS.textMuted}
                autoCorrect={false}
                maxLength={60}
              />
            </View>
            {erros.nome ? <Text style={styles.erroMsg}>{erros.nome}</Text> : null}

            {/* Data de nascimento */}
            <Text style={styles.modalLabel}>Data de nascimento</Text>
            <View style={styles.modalInputBox}>
              <Ionicons name="calendar-outline" size={18} color={COLORS.textMuted} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.modalInput}
                defaultValue={form.current.data_nascimento}
                onChangeText={(v) => { form.current.data_nascimento = v; }}
                placeholder="AAAA-MM-DD"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="numeric"
                autoCorrect={false}
                maxLength={10}
              />
            </View>

            {/* Cidade */}
            <Text style={styles.modalLabel}>Cidade</Text>
            <CidadeAutocomplete
              value={form.current.cidade}
              onChange={(v) => { form.current.cidade = v; }}
            />

            {/* Bio */}
            <Text style={styles.modalLabel}>
              Bio <Text style={{ color: COLORS.textMuted, fontWeight: '400' }}>(opcional)</Text>
            </Text>
            <View style={[styles.modalInputBox, { height: 90, alignItems: 'flex-start', paddingTop: 12 }, erros.bio && styles.inputErro]}>
              <TextInput
                style={[styles.modalInput, { flex: 1 }]}
                defaultValue={form.current.bio}
                onChangeText={(v) => { form.current.bio = v; setErros((e) => ({ ...e, bio: '' })); }}
                placeholder="Conte um pouco sobre você..."
                placeholderTextColor={COLORS.textMuted}
                multiline
                maxLength={300}
              />
            </View>
            {erros.bio ? <Text style={styles.erroMsg}>{erros.bio}</Text> : null}

            {/* Orientação */}
            <Text style={styles.modalLabel}>Orientação sexual</Text>
            <View style={styles.chipRow}>
              {ORIENTACOES.map((o, i) => (
                <TouchableOpacity
                  key={o}
                  style={[styles.chip, orientacao === ORIENTACOES_VALS[i] && styles.chipAtivo]}
                  onPress={() => setOrientacao(ORIENTACOES_VALS[i])}
                >
                  <Text style={[styles.chipTexto, orientacao === ORIENTACOES_VALS[i] && styles.chipTextoAtivo]}>
                    {o}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Interesses */}
            <Text style={styles.modalLabel}>
              Interesses <Text style={{ color: COLORS.textMuted, fontWeight: '400' }}>(até 5)</Text>
            </Text>
            <View style={styles.chipRow}>
              {INTERESSES_OPCOES.map((item) => (
                <TouchableOpacity
                  key={item}
                  style={[styles.chip, interesses.includes(item) && styles.chipAtivo]}
                  onPress={() => toggleInteresse(item)}
                >
                  <Text style={[styles.chipTexto, interesses.includes(item) && styles.chipTextoAtivo]}>
                    {item}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MODAL: ALTERAR EMAIL
// ══════════════════════════════════════════════════════════════════════════════
function ModalAlterarEmail({ visivel, emailAtual, onFechar }) {
  const [novoEmail, setNovoEmail] = useState('');
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    if (!novoEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(novoEmail)) {
      Alert.alert('E-mail inválido', 'Digite um endereço de e-mail válido.'); return;
    }
    setSalvando(true);
    const res = await alterarEmail(novoEmail.trim().toLowerCase());
    setSalvando(false);
    if (res.sucesso) {
      Alert.alert(
        'Confirmação enviada',
        'Verifique a caixa de entrada do novo e-mail para confirmar a alteração.',
        [{ text: 'OK', onPress: onFechar }]
      );
    } else Alert.alert('Erro', res.erro || 'Não foi possível alterar o e-mail.');
  };

  return (
    <Modal visible={visivel} animationType="slide" presentationStyle="pageSheet" onRequestClose={onFechar}>
      <SafeAreaView style={styles.modalSafe}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onFechar} style={styles.modalBtnClose}>
            <Ionicons name="close" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.modalTitulo}>Alterar E-mail</Text>
          <TouchableOpacity onPress={salvar} disabled={salvando} style={styles.modalBtnSave}>
            {salvando ? <ActivityIndicator size="small" color={COLORS.primary} />
              : <Text style={styles.modalBtnSaveText}>Salvar</Text>}
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.modalScroll}>
          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={18} color="#1565C0" />
            <Text style={styles.infoText}>
              Você receberá um link de confirmação no novo e-mail. A alteração só será aplicada após confirmação.
            </Text>
          </View>
          <Text style={styles.modalLabel}>E-mail atual</Text>
          <View style={[styles.modalInputBox, { backgroundColor: '#F5F5F5' }]}>
            <Ionicons name="mail-outline" size={18} color={COLORS.textMuted} style={{ marginRight: 8 }} />
            <Text style={[styles.modalInput, { color: COLORS.textMuted }]}>{emailAtual}</Text>
          </View>
          <Text style={styles.modalLabel}>Novo e-mail</Text>
          <View style={styles.modalInputBox}>
            <Ionicons name="mail-outline" size={18} color={COLORS.textMuted} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.modalInput}
              value={novoEmail}
              onChangeText={setNovoEmail}
              placeholder="novo@email.com"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MODAL: ALTERAR SENHA
// ══════════════════════════════════════════════════════════════════════════════
function ModalAlterarSenha({ visivel, onFechar }) {
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [mostrar, setMostrar] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const forca = novaSenha.length === 0 ? 0 : novaSenha.length < 6 ? 1 : novaSenha.length < 8 ? 2 : novaSenha.length < 10 ? 3 : 4;
  const forcaLabel = ['', 'Muito fraca', 'Fraca', 'Média', 'Forte'][forca];
  const forcaCor = ['', COLORS.error, '#F57F17', '#FDD835', '#43A047'][forca];

  const salvar = async () => {
    if (novaSenha.length < 6) { Alert.alert('Senha fraca', 'Mínimo 6 caracteres.'); return; }
    if (novaSenha !== confirmar) { Alert.alert('Senhas diferentes', 'As senhas não coincidem.'); return; }
    setSalvando(true);
    const res = await alterarSenha(novaSenha);
    setSalvando(false);
    if (res.sucesso) {
      Alert.alert('Senha alterada!', 'Sua senha foi atualizada com sucesso.', [{ text: 'OK', onPress: onFechar }]);
      setNovaSenha(''); setConfirmar('');
    } else Alert.alert('Erro', res.erro || 'Não foi possível alterar a senha.');
  };

  return (
    <Modal visible={visivel} animationType="slide" presentationStyle="pageSheet" onRequestClose={onFechar}>
      <SafeAreaView style={styles.modalSafe}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onFechar} style={styles.modalBtnClose}>
            <Ionicons name="close" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.modalTitulo}>Alterar Senha</Text>
          <TouchableOpacity onPress={salvar} disabled={salvando} style={styles.modalBtnSave}>
            {salvando ? <ActivityIndicator size="small" color={COLORS.primary} />
              : <Text style={styles.modalBtnSaveText}>Salvar</Text>}
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.modalScroll}>
          <Text style={styles.modalLabel}>Nova senha</Text>
          <View style={styles.modalInputBox}>
            <Ionicons name="lock-closed-outline" size={18} color={COLORS.textMuted} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.modalInput}
              value={novaSenha}
              onChangeText={setNovaSenha}
              placeholder="Mínimo 6 caracteres"
              placeholderTextColor={COLORS.textMuted}
              secureTextEntry={!mostrar}
              autoFocus
            />
            <TouchableOpacity onPress={() => setMostrar(!mostrar)}>
              <Ionicons name={mostrar ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Barra de força */}
          {novaSenha.length > 0 && (
            <View style={{ marginTop: 8, marginBottom: 4 }}>
              <View style={styles.forcaBarras}>
                {[1, 2, 3, 4].map((n) => (
                  <View key={n} style={[styles.forcaBarra, forca >= n && { backgroundColor: forcaCor }]} />
                ))}
              </View>
              <Text style={[styles.forcaLabel, { color: forcaCor }]}>{forcaLabel}</Text>
            </View>
          )}

          <Text style={styles.modalLabel}>Confirmar nova senha</Text>
          <View style={[styles.modalInputBox, confirmar && novaSenha !== confirmar && styles.inputErro]}>
            <Ionicons name="lock-closed-outline" size={18} color={COLORS.textMuted} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.modalInput}
              value={confirmar}
              onChangeText={setConfirmar}
              placeholder="Repita a senha"
              placeholderTextColor={COLORS.textMuted}
              secureTextEntry={!mostrar}
            />
          </View>
          {confirmar.length > 0 && novaSenha !== confirmar && (
            <Text style={styles.erroMsg}>As senhas não coincidem</Text>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TELA PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════
export default function ConfiguracaoScreen({ navigation }) {
  const { atualizarPerfilLocal } = useAuth();

  const [perfil, setPerfil] = useState(null);
  const [email, setEmail] = useState('');
  const [config, setConfig] = useState({
    distancia_max_km: 50,
    idade_min: 18,
    idade_max: 45,
    notif_match: true,
    notif_mensagem: true,
    notif_superlike: true,
    modo_invisivel: false,
    mostrar_distancia: true,
  });
  const [carregando, setCarregando] = useState(true);

  const [modalPerfil, setModalPerfil] = useState(false);
  const [modalEmail, setModalEmail] = useState(false);
  const [modalSenha, setModalSenha] = useState(false);

  // ── Carregar dados reais (recarrega ao focar a aba) ─────────────────────
  useFocusEffect(
    useCallback(() => {
      const carregar = async () => {
        setCarregando(true);
        try {
          const [resPerfil, resConfig, sessaoResp] = await Promise.all([
            obterMeuPerfil(),
            obterConfiguracoes(),
            supabase.auth.getSession(),   // sem rede — lê localStorage
          ]);
          if (resPerfil.sucesso) setPerfil(resPerfil.perfil);
          if (resConfig.sucesso && resConfig.config) {
            setConfig((prev) => ({ ...prev, ...resConfig.config }));
          }
          const user = sessaoResp.data?.session?.user;
          if (user) setEmail(user.email || '');
        } catch (e) {
          console.warn('ConfiguracaoScreen: erro ao carregar', e);
        } finally {
          setCarregando(false);
        }
      };
      carregar();
    }, [])
  );

  // ── Auto-salvar configurações ────────────────────────────────────────────
  const salvarConfig = useCallback(async (novosValores) => {
    setConfig((prev) => ({ ...prev, ...novosValores }));
    await atualizarConfiguracoes(novosValores);
  }, []);

  // ── Sair / Excluir ───────────────────────────────────────────────────────
  const confirmarSair = () =>
    Alert.alert('Sair da conta', 'Tem certeza que deseja sair?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => logout() },
    ]);

  const confirmarExcluir = () =>
    Alert.alert(
      'Excluir conta',
      'Todos os seus dados serão apagados permanentemente. Esta ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            const res = await excluirConta();
            if (!res.sucesso) Alert.alert('Erro', res.erro);
          },
        },
      ]
    );

  if (carregando) {
    return (
      <SafeAreaView style={[styles.safe, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Ajustes</Text>
        </View>

        {/* Avatar + resumo */}
        <TouchableOpacity style={styles.avatarArea} onPress={() => setModalPerfil(true)} activeOpacity={0.85}>
          <View style={styles.avatarCircle}>
            <LinearGradient colors={[COLORS.gradientStart, COLORS.gradientEnd]} style={styles.avatarGrad}>
              <Text style={styles.avatarLetra}>{(perfil?.nome || 'U')[0].toUpperCase()}</Text>
            </LinearGradient>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.avatarNome}>{perfil?.nome || 'Meu Perfil'}</Text>
            <Text style={styles.avatarEmail} numberOfLines={1}>{email}</Text>
          </View>
          <View style={styles.avatarEditBtn}>
            <Ionicons name="create-outline" size={18} color={COLORS.primary} />
            <Text style={styles.avatarEditText}>Editar</Text>
          </View>
        </TouchableOpacity>

        {/* ── CONTA ── */}
        <Secao titulo="CONTA">
          <Linha
            icone="person-circle-outline" titulo="Editar perfil"
            subtitulo={perfil?.bio ? `"${perfil.bio.slice(0, 50)}${perfil.bio.length > 50 ? '…' : ''}"` : 'Nome, bio, interesses e mais'}
            onPress={() => setModalPerfil(true)}
          />
          <Sep />
          <Linha
            icone="mail-outline" titulo="Alterar e-mail"
            subtitulo={email}
            onPress={() => setModalEmail(true)}
          />
          <Sep />
          <Linha
            icone="lock-closed-outline" titulo="Alterar senha"
            subtitulo="Troque sua senha de acesso"
            onPress={() => setModalSenha(true)}
          />
          <Sep />
          <Linha
            icone="shield-checkmark-outline" titulo="Verificação de identidade"
            subtitulo="Mostre que você é real ✓"
            corIcone="#1565C0"
            onPress={() => Alert.alert('Em breve', 'Verificação disponível em breve.')}
          />
        </Secao>

        {/* ── FILTROS DE DESCOBERTA ── */}
        <Secao titulo="FILTROS DE DESCOBERTA">
          {/* Distância */}
          <View style={styles.prefGroup}>
            <View style={styles.linha}>
              <View style={[styles.linhaIcone, { backgroundColor: COLORS.primary + '1A' }]}>
                <Ionicons name="navigate-outline" size={20} color={COLORS.primary} />
              </View>
              <View style={styles.linhaInfo}>
                <Text style={styles.linhaTitulo}>Distância máxima</Text>
              </View>
              <Text style={styles.prefValor}>{config.distancia_max_km} km</Text>
            </View>
            <View style={styles.opcoesBtns}>
              {[10, 25, 50, 100, 200].map((v) => (
                <TouchableOpacity
                  key={v}
                  style={[styles.opcaoBtn, config.distancia_max_km === v && styles.opcaoBtnAtivo]}
                  onPress={() => salvarConfig({ distancia_max_km: v })}
                >
                  <Text style={[styles.opcaoBtnText, config.distancia_max_km === v && styles.opcaoBtnTextoAtivo]}>
                    {v}km
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Sep />

          {/* Idade mínima */}
          <View style={styles.prefGroup}>
            <View style={styles.linha}>
              <View style={[styles.linhaIcone, { backgroundColor: COLORS.primary + '1A' }]}>
                <Ionicons name="people-outline" size={20} color={COLORS.primary} />
              </View>
              <View style={styles.linhaInfo}>
                <Text style={styles.linhaTitulo}>Idade mínima</Text>
              </View>
              <Text style={styles.prefValor}>{config.idade_min} anos</Text>
            </View>
            <View style={styles.opcoesBtns}>
              {[18, 21, 25, 28, 30].map((v) => (
                <TouchableOpacity
                  key={v}
                  style={[styles.opcaoBtn, config.idade_min === v && styles.opcaoBtnAtivo]}
                  onPress={() => salvarConfig({ idade_min: v })}
                >
                  <Text style={[styles.opcaoBtnText, config.idade_min === v && styles.opcaoBtnTextoAtivo]}>
                    {v}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Idade máxima */}
            <View style={styles.linha}>
              <View style={[styles.linhaIcone, { backgroundColor: 'transparent' }]} />
              <View style={styles.linhaInfo}>
                <Text style={styles.linhaTitulo}>Idade máxima</Text>
              </View>
              <Text style={styles.prefValor}>{config.idade_max} anos</Text>
            </View>
            <View style={styles.opcoesBtns}>
              {[30, 35, 40, 50, 60].map((v) => (
                <TouchableOpacity
                  key={v}
                  style={[styles.opcaoBtn, config.idade_max === v && styles.opcaoBtnAtivo]}
                  onPress={() => salvarConfig({ idade_max: v })}
                >
                  <Text style={[styles.opcaoBtnText, config.idade_max === v && styles.opcaoBtnTextoAtivo]}>
                    {v}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Sep />
          <Linha
            icone="eye-off-outline" titulo="Modo invisível"
            subtitulo="Você vê outras, mas não aparece em descobertas"
            direita={
              <Switch
                value={config.modo_invisivel}
                onValueChange={(v) => salvarConfig({ modo_invisivel: v })}
                trackColor={{ false: COLORS.border, true: COLORS.primaryLight }}
                thumbColor={config.modo_invisivel ? COLORS.primary : COLORS.white}
              />
            }
          />
          <Sep />
          <Linha
            icone="location-outline" titulo="Mostrar distância"
            subtitulo="Exibir sua distância no perfil"
            direita={
              <Switch
                value={config.mostrar_distancia}
                onValueChange={(v) => salvarConfig({ mostrar_distancia: v })}
                trackColor={{ false: COLORS.border, true: COLORS.primaryLight }}
                thumbColor={config.mostrar_distancia ? COLORS.primary : COLORS.white}
              />
            }
          />
        </Secao>

        {/* ── NOTIFICAÇÕES ── */}
        <Secao titulo="NOTIFICAÇÕES">
          <Linha
            icone="heart-outline" titulo="Novos matches"
            subtitulo="Receba avisos quando der match"
            direita={
              <Switch
                value={config.notif_match}
                onValueChange={(v) => salvarConfig({ notif_match: v })}
                trackColor={{ false: COLORS.border, true: COLORS.primaryLight }}
                thumbColor={config.notif_match ? COLORS.primary : COLORS.white}
              />
            }
          />
          <Sep />
          <Linha
            icone="chatbubble-outline" titulo="Novas mensagens"
            subtitulo="Receba avisos de mensagens"
            direita={
              <Switch
                value={config.notif_mensagem}
                onValueChange={(v) => salvarConfig({ notif_mensagem: v })}
                trackColor={{ false: COLORS.border, true: COLORS.primaryLight }}
                thumbColor={config.notif_mensagem ? COLORS.primary : COLORS.white}
              />
            }
          />
          <Sep />
          <Linha
            icone="star-outline" titulo="Super likes"
            subtitulo="Receba avisos de super likes recebidos"
            direita={
              <Switch
                value={config.notif_superlike}
                onValueChange={(v) => salvarConfig({ notif_superlike: v })}
                trackColor={{ false: COLORS.border, true: COLORS.primaryLight }}
                thumbColor={config.notif_superlike ? COLORS.primary : COLORS.white}
              />
            }
          />
        </Secao>

        {/* ── SEGURANÇA ── */}
        <Secao titulo="SEGURANÇA E PRIVACIDADE">
          <Linha
            icone="ban-outline" titulo="Usuárias bloqueadas"
            subtitulo="Gerencie usuárias bloqueadas"
            corIcone={COLORS.error}
            onPress={() => Alert.alert('Em breve', 'Visualização de bloqueios disponível em breve.')}
          />
          <Sep />
          <Linha
            icone="warning-outline" titulo="Reportar problema"
            corIcone="#F57F17"
            onPress={() => Alert.alert('Reportar', 'Para reportar problemas, envie um e-mail para suporte@safimatch.com')}
          />
          <Sep />
          <Linha
            icone="document-text-outline" titulo="Termos e Privacidade"
            onPress={() => Alert.alert('Termos', 'Disponível em safimatch.com/termos')}
          />
        </Secao>

        {/* ── PREMIUM ── */}
        <TouchableOpacity activeOpacity={0.9} style={styles.premiumArea}>
          <LinearGradient
            colors={['#F57F17', '#FF8F00']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.premiumCard}
          >
            <Ionicons name="star" size={24} color={COLORS.white} />
            <View style={{ flex: 1 }}>
              <Text style={styles.premiumTitle}>Safimatch Premium 👑</Text>
              <Text style={styles.premiumSub}>Super likes ilimitados · Voltar perfis · Boost</Text>
            </View>
            <Ionicons name="arrow-forward-circle" size={28} color={COLORS.white} />
          </LinearGradient>
        </TouchableOpacity>

        {/* ── AÇÕES CRÍTICAS ── */}
        <Secao titulo="">
          <TouchableOpacity style={styles.btnAcao} onPress={confirmarSair}>
            <Ionicons name="log-out-outline" size={20} color={COLORS.error} />
            <Text style={styles.btnAcaoText}>Sair da conta</Text>
          </TouchableOpacity>
          <Sep />
          <TouchableOpacity style={styles.btnAcao} onPress={confirmarExcluir}>
            <Ionicons name="trash-outline" size={20} color={COLORS.error} />
            <Text style={[styles.btnAcaoText, { color: COLORS.error }]}>Excluir conta permanentemente</Text>
          </TouchableOpacity>
        </Secao>

        <View style={styles.versao}>
          <Text style={styles.versaoText}>Safimatch v1.0.0 • Feito com 💜</Text>
        </View>
      </ScrollView>

      {/* Modais */}
      <ModalEditarPerfil
        visivel={modalPerfil}
        perfil={perfil}
        onFechar={() => setModalPerfil(false)}
        onSalvar={(novoPerfil) => {
          setPerfil(novoPerfil);
          atualizarPerfilLocal(novoPerfil);
          setModalPerfil(false);
        }}
      />
      <ModalAlterarEmail
        visivel={modalEmail}
        emailAtual={email}
        onFechar={() => setModalEmail(false)}
      />
      <ModalAlterarSenha
        visivel={modalSenha}
        onFechar={() => setModalSenha(false)}
      />
    </SafeAreaView>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ESTILOS
// ══════════════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingBottom: 48 },

  header: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: 4 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: COLORS.textPrimary },

  // Avatar
  avatarArea: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginHorizontal: SPACING.lg, marginBottom: SPACING.md,
    backgroundColor: COLORS.white, borderRadius: RADIUS.xl, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 6, elevation: 3,
  },
  avatarCircle: { width: 56, height: 56, borderRadius: 28, overflow: 'hidden' },
  avatarGrad: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatarLetra: { fontSize: 24, fontWeight: '800', color: COLORS.white },
  avatarNome: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  avatarEmail: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  avatarEditBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  avatarEditText: { fontSize: 13, fontWeight: '600', color: COLORS.primary },

  // Seção
  secao: { marginHorizontal: SPACING.lg, marginBottom: SPACING.md },
  secaoTitulo: {
    fontSize: 11, fontWeight: '700', color: COLORS.textMuted,
    letterSpacing: 0.8, marginBottom: 8, paddingLeft: 4,
  },
  secaoCard: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.lg, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },

  // Linha
  linha: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 13, gap: 12 },
  linhaIcone: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
  linhaInfo: { flex: 1, gap: 2 },
  linhaTitulo: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  linhaSubtitulo: { fontSize: 12, color: COLORS.textMuted },
  separador: { height: 1, backgroundColor: COLORS.border, marginLeft: 64 },

  // Preferências
  prefGroup: { paddingBottom: 4 },
  prefValor: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  opcoesBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: SPACING.md, paddingBottom: 12 },
  opcaoBtn: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: RADIUS.full, borderWidth: 1.5,
    borderColor: COLORS.border, backgroundColor: COLORS.background,
  },
  opcaoBtnAtivo: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  opcaoBtnText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  opcaoBtnTextoAtivo: { color: COLORS.white },

  // Premium
  premiumArea: { marginHorizontal: SPACING.lg, marginBottom: SPACING.md },
  premiumCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: SPACING.md, borderRadius: RADIUS.xl,
    shadowColor: '#F57F17', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  premiumTitle: { fontSize: 15, fontWeight: '800', color: COLORS.white },
  premiumSub: { fontSize: 11, color: 'rgba(255,255,255,0.85)' },

  // Botões críticos
  btnAcao: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: SPACING.md, paddingVertical: 14 },
  btnAcaoText: { fontSize: 14, fontWeight: '600', color: COLORS.error },

  versao: { alignItems: 'center', paddingVertical: SPACING.md },
  versaoText: { fontSize: 12, color: COLORS.textMuted },

  // ── Modal ──
  modalSafe: { flex: 1, backgroundColor: COLORS.background },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  modalBtnClose: { padding: 4, width: 60 },
  modalTitulo: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },
  modalBtnSave: { width: 60, alignItems: 'flex-end' },
  modalBtnSaveText: { fontSize: 16, fontWeight: '700', color: COLORS.primary },
  modalScroll: { padding: SPACING.lg, gap: 4, paddingBottom: 40 },
  modalLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 8, marginTop: 16 },
  modalInputBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.md, paddingHorizontal: 14, height: 50,
  },
  modalInput: { flex: 1, fontSize: 15, color: COLORS.textPrimary },
  inputErro: { borderColor: COLORS.error },
  erroMsg: { fontSize: 12, color: COLORS.error, marginTop: 4 },

  // Info box
  infoBox: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: '#E3F2FD', borderRadius: RADIUS.md,
    padding: SPACING.md, borderWidth: 1, borderColor: '#90CAF9', marginTop: 8,
  },
  infoText: { flex: 1, fontSize: 13, color: '#1565C0', lineHeight: 18 },

  // Chips
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full,
    backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border,
  },
  chipAtivo: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipTexto: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  chipTextoAtivo: { color: COLORS.white },

  // Força de senha
  forcaBarras: { flexDirection: 'row', gap: 4 },
  forcaBarra: { flex: 1, height: 4, borderRadius: 2, backgroundColor: COLORS.border },
  forcaLabel: { fontSize: 11, marginTop: 4, fontWeight: '600' },

  // Autocomplete dropdown (inline — compatível com ScrollView no web)
  dropdownInline: {
    backgroundColor: COLORS.white,
    borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    marginTop: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 8, overflow: 'hidden',
  },
  dropItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11 },
  dropDiv: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  dropNome: { fontSize: 14, color: COLORS.textPrimary, fontWeight: '500' },
  dropUF: { fontSize: 14, color: COLORS.textMuted },
});
