// src/screens/CadastroScreen.js - Safimatch
import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
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
  const [texto, setTexto]         = useState(defaultValue || '');
  const [sugestoes, setSugestoes] = useState([]);
  const [buscando, setBuscando]   = useState(false);
  const [modalVis, setModalVis]   = useState(false);
  const timerRef = useRef(null);

  const normalizar = (s) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const buscar = async (q) => {
    if (q.length < 2) { setSugestoes([]); setModalVis(false); return; }
    setBuscando(true);
    try {
      const resp = await fetch(
        `https://servicodados.ibge.gov.br/api/v1/localidades/municipios?nome=${encodeURIComponent(q)}&orderBy=nome`
      );
      const data = await resp.json();
      const q2 = normalizar(q);
      const começa = data.filter((m) => normalizar(m.nome).startsWith(q2));
      const contém = data.filter((m) => !normalizar(m.nome).startsWith(q2));
      const resultados = [...começa, ...contém].slice(0, 8).map((m) => ({
        nome: m.nome,
        uf: m.microrregiao?.mesorregiao?.UF?.sigla ?? '',
      }));
      setSugestoes(resultados);
      setModalVis(resultados.length > 0);
    } catch { /* silently fail */ }
    finally { setBuscando(false); }
  };

  const handleChange = (v) => {
    setTexto(v);
    onSelect(v);
    limparErro('cidade');
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => buscar(v), 400);
  };

  const selecionar = (cidade) => {
    setTexto(`${cidade.nome} — ${cidade.uf}`);
    setSugestoes([]);
    setModalVis(false);
    onSelect(cidade.nome);
    limparErro('cidade');
  };

  const limpar = () => {
    setTexto('');
    setSugestoes([]);
    setModalVis(false);
    onSelect('');
  };

  return (
    <View>
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
        />
        {buscando
          ? <ActivityIndicator size="small" color={COLORS.primary} style={{ marginLeft: 4 }} />
          : texto.length > 0
            ? <TouchableOpacity onPress={limpar}>
                <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            : null}
      </View>

      {/* Modal para sugestões — evita clipping do ScrollView no Android */}
      <Modal
        visible={modalVis}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVis(false)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.25)' }}
          activeOpacity={1}
          onPress={() => setModalVis(false)}
        >
          <View style={cadCidadeStyle.container}>
            <Text style={cadCidadeStyle.titulo}>Selecione a cidade</Text>
            <FlatList
              data={sugestoes}
              keyExtractor={(c) => `${c.nome}-${c.uf}`}
              keyboardShouldPersistTaps="always"
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  style={[cadCidadeStyle.item, index < sugestoes.length - 1 && cadCidadeStyle.div]}
                  onPress={() => selecionar(item)}
                >
                  <Ionicons name="location-outline" size={14} color={COLORS.primary} style={{ marginRight: 8 }} />
                  <Text style={cadCidadeStyle.nome}>{item.nome}</Text>
                  <Text style={cadCidadeStyle.uf}> — {item.uf}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const cadCidadeStyle = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 24, right: 24, bottom: 80,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    maxHeight: 320,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 12,
  },
  titulo: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.5,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 6,
    textTransform: 'uppercase',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  div:  { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  nome: { fontSize: 14, color: COLORS.textPrimary ?? '#111', fontWeight: '500', flex: 1 },
  uf:   { fontSize: 13, color: COLORS.textMuted },
});

export default function CadastroScreen({ navigation }) {
  const [etapa, setEtapa] = useState(1);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erros, setErros] = useState({});
  // Chips precisam de re-render, ficam em state
  const [orientacao, setOrientacao] = useState('');
  const [interesses, setInteresses] = useState([]);
  // Telefone: estado separado para exibir máscara corretamente
  const [telefoneDisplay, setTelefoneDisplay] = useState('');
  // Data de nascimento: estado separado para máscara DD/MM/AAAA
  const [dataNascDisplay, setDataNascDisplay] = useState('');
  // Erro global do cadastro (fora dos campos)
  const [erroGeral, setErroGeral] = useState('');

  // Formulário em ref → sem re-render por keystroke → sem perda de foco
  const form = useRef({
    nome: '', email: '', senha: '', confirmarSenha: '',
    dataNascimento: '', cidade: '', bio: '', telefone: '',
  });

  // Máscara de telefone brasileiro: (XX) XXXXX-XXXX
  const mascaraTelefone = (v) => {
    const nums = v.replace(/\D/g, '').slice(0, 11);
    if (!nums) return '';
    if (nums.length <= 2) return `(${nums}`;
    if (nums.length <= 6) return `(${nums.slice(0, 2)}) ${nums.slice(2)}`;
    if (nums.length <= 10) return `(${nums.slice(0, 2)}) ${nums.slice(2, 6)}-${nums.slice(6)}`;
    return `(${nums.slice(0, 2)}) ${nums.slice(2, 7)}-${nums.slice(7, 11)}`;
  };

  // Máscara de data: DD/MM/AAAA (só números, barras automáticas)
  const mascaraData = (v) => {
    const nums = v.replace(/\D/g, '').slice(0, 8);
    if (nums.length <= 2) return nums;
    if (nums.length <= 4) return `${nums.slice(0, 2)}/${nums.slice(2)}`;
    return `${nums.slice(0, 2)}/${nums.slice(2, 4)}/${nums.slice(4)}`;
  };

  const limparErro = useCallback((campo) => {
    setErros((e) => (e[campo] ? { ...e, [campo]: '' } : e));
  }, []);

  const validarEtapa1 = () => {
    const f = form.current;
    const e = {};
    if (!f.nome.trim()) e.nome = 'Nome é obrigatório';
    if (!f.email.trim()) e.email = 'E-mail é obrigatório';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = 'E-mail inválido';
    // Telefone: se preenchido, valida formato BR (10 ou 11 dígitos)
    if (f.telefone) {
      const nums = f.telefone.replace(/\D/g, '');
      if (nums.length < 10 || nums.length > 11) e.telefone = 'Telefone inválido. Ex: (11) 99999-9999';
    }
    if (!f.senha) e.senha = 'Senha é obrigatória';
    else if (f.senha.length < 6) e.senha = 'Mínimo 6 caracteres';
    if (f.senha !== f.confirmarSenha) e.confirmarSenha = 'As senhas não coincidem';
    setErros(e);
    return Object.keys(e).length === 0;
  };

  const validarEtapa2 = () => {
    const f = form.current;
    const e = {};
    if (!f.dataNascimento.trim()) {
      e.dataNascimento = 'Data de nascimento é obrigatória';
    } else {
      const [d, m, a] = f.dataNascimento.trim().split('/');
      const valida = d && m && a && a.length === 4 && !isNaN(new Date(`${a}-${m}-${d}`).getTime());
      if (!valida) e.dataNascimento = 'Use o formato DD/MM/AAAA (ex: 15/03/1998)';
      else {
        const nasc = new Date(`${a}-${m}-${d}`);
        const hoje = new Date();
        const idade = (hoje - nasc) / (365.25 * 24 * 3600 * 1000);
        if (idade < 18) e.dataNascimento = 'Você precisa ter pelo menos 18 anos';
        if (idade > 100) e.dataNascimento = 'Data de nascimento inválida';
      }
    }
    if (!f.cidade.trim()) e.cidade = 'Cidade é obrigatória';
    setErros(e);
    return Object.keys(e).length === 0;
  };

  const avancar = () => {
    if (etapa === 1 && !validarEtapa1()) return;
    if (etapa === 2 && !validarEtapa2()) return;
    setErroGeral('');
    if (etapa < 3) setEtapa((e) => e + 1);
    else finalizar();
  };

  const finalizar = async () => {
    const f = form.current;
    setCarregando(true);
    setErroGeral('');

    // Converte data de nascimento de DD/MM/AAAA para ISO YYYY-MM-DD
    const _brParaISO = (v = '') => {
      const [d, m, a] = v.trim().split('/');
      if (!d || !m || !a || a.length !== 4) return undefined;
      return `${a}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    };

    // Normaliza orientação para o valor aceito pelo DB (sem acento, minúsculo, underscores)
    const _normOrientacao = (o) => {
      const map = {
        'Lésbica':         'lesbica',
        'Bissexual':       'bissexual',
        'Pansexual':       'pansexual',
        'Outro':           'outro',
        'Prefiro não dizer': 'prefiro_nao_dizer',
      };
      return map[o] ?? undefined;
    };

    try {
      const auth = await cadastrar({ email: f.email.trim(), senha: f.senha, nome: f.nome.trim() });

      // Dados de perfil que serão aplicados após verificação (ou agora, se autoconfirm)
      const perfilDados = {
        nome: f.nome.trim(),
        data_nascimento: _brParaISO(f.dataNascimento),
        cidade: f.cidade.trim(),
        bio: f.bio.trim(),
        orientacao: _normOrientacao(orientacao),
        interesses,
        ativa: true,
        ...(f.telefone ? { telefone: f.telefone.replace(/\D/g, '') } : {}),
      };
      // Remove campos vazios/undefined para não sobrescrever dados válidos
      Object.keys(perfilDados).forEach(k => {
        if (perfilDados[k] === undefined || perfilDados[k] === '') delete perfilDados[k];
      });

      if (!auth.sucesso) {
        const msg = auth.erro || '';
        // Rate-limit ou e-mail já enviado anteriormente:
        // o e-mail de verificação já chegou, deixar a usuária digitar o código
        const jaEnviado =
          msg.includes('Aguarde') ||
          msg.includes('tentativas') ||
          msg.includes('já está cadastrado');
        if (jaEnviado) {
          navigation.navigate('Verificacao', {
            tipo: 'email',
            email: f.email.trim(),
            pendingPerfil: perfilDados,
          });
          return;
        }
        setErroGeral(msg);
        return;
      }

      if (auth.precisaConfirmarEmail) {
        // E-mail autoconfirm está OFF: redirecionar para tela de OTP
        navigation.navigate('Verificacao', {
          tipo: 'email',
          email: f.email.trim(),
          pendingPerfil: perfilDados,
        });
        return;
      }

      // Autoconfirm ON: sessão já existe, atualizar perfil imediatamente
      await atualizarPerfil(perfilDados);
    } catch (e) {
      setErroGeral('Problema de conexão. Tente novamente.');
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

      {/* Telefone */}
      <View>
        <Text style={styles.label}>Telefone <Text style={styles.labelHint}>(opcional)</Text></Text>
        <View style={[styles.inputWrapper, erros.telefone && styles.inputError]}>
          <Ionicons name="call-outline" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            value={telefoneDisplay}
            onChangeText={(v) => {
              const masked = mascaraTelefone(v);
              setTelefoneDisplay(masked);
              form.current.telefone = masked;
              limparErro('telefone');
            }}
            placeholder="(11) 99999-9999"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="phone-pad"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={16}
          />
          {telefoneDisplay.length > 0 && (
            <TouchableOpacity onPress={() => { setTelefoneDisplay(''); form.current.telefone = ''; limparErro('telefone'); }}>
              <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        {erros.telefone
          ? <Text style={styles.errorMsg}>{erros.telefone}</Text>
          : <Text style={styles.fieldHint}>
              <Ionicons name="shield-checkmark-outline" size={11} /> Usado para segurança e recuperação de conta
            </Text>}
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
            value={dataNascDisplay}
            onChangeText={(v) => {
              const masked = mascaraData(v);
              setDataNascDisplay(masked);
              form.current.dataNascimento = masked;
              limparErro('dataNascimento');
            }}
            placeholder="DD/MM/AAAA"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="numeric"
            maxLength={10}
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

          {/* Erro global do cadastro */}
          {!!erroGeral && (
            <View style={styles.erroGeralBox}>
              <Ionicons name="alert-circle-outline" size={18} color={COLORS.error} />
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={styles.erroGeralText}>{erroGeral}</Text>
                {/* Se já tentou antes / rate-limit → pode ir direto para verificação */}
                {(erroGeral.includes('já está cadastrado') ||
                  erroGeral.includes('Aguarde') ||
                  erroGeral.includes('tentativas')) && (
                  <TouchableOpacity
                    onPress={() => navigation.navigate('Verificacao', {
                      tipo: 'email',
                      email: form.current.email.trim(),
                    })}
                  >
                    <Text style={styles.erroGeralLink}>Já recebi o código → Verificar agora</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

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
  errorMsg:  { fontSize: 12, color: COLORS.error, marginTop: 5 },
  fieldHint: { fontSize: 11, color: COLORS.textMuted, marginTop: 5 },
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

  erroGeralBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#FFF0F0',
    borderRadius: RADIUS.md, padding: 14,
    borderWidth: 1.5, borderColor: COLORS.error,
    marginBottom: SPACING.md,
  },
  erroGeralText: { fontSize: 14, color: COLORS.error, lineHeight: 20 },
  erroGeralLink: { fontSize: 13, color: COLORS.primary, fontWeight: '700', textDecorationLine: 'underline' },
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
