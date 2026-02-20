// src/screens/PerfilScreen.js - Safimatch
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, SPACING, RADIUS } from '../theme/colors';
import { obterMeuPerfil, atualizarPerfil } from '../services/perfilService';
import { uploadFoto, removerFotoSlot } from '../services/storageService';
import { useAuth } from '../context/AuthContext';

const { width: SCREEN_W } = Dimensions.get('window');
const FOTO_SIZE = (SCREEN_W - 48 - 8) / 3;

// ── Animação de upload sobre o slot da foto ────────────────────────────────────
function FotoUploadOverlay({ ativo, sucesso }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const checkScale = useRef(new Animated.Value(0)).current;
  const checkOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (ativo && !sucesso) {
      // Pulso infinito enquanto faz upload
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.5, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,   duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();
    } else if (sucesso) {
      // Para o pulse e anima o checkmark com spring
      pulseAnim.stopAnimation();
      Animated.parallel([
        Animated.spring(checkScale, { toValue: 1, friction: 4, tension: 180, useNativeDriver: true }),
        Animated.timing(checkOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();
    } else {
      pulseAnim.stopAnimation();
      Animated.parallel([
        Animated.timing(checkScale, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(checkOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [ativo, sucesso]);

  if (!ativo && !sucesso) return null;

  return (
    <View style={overlayStyles.container}>
      {sucesso ? (
        <Animated.View style={[overlayStyles.checkCircle, { transform: [{ scale: checkScale }], opacity: checkOpacity }]}>
          <Text style={overlayStyles.checkMark}>✓</Text>
        </Animated.View>
      ) : (
        <Animated.View style={{ opacity: pulseAnim }}>
          <ActivityIndicator size="large" color="#fff" />
        </Animated.View>
      )}
    </View>
  );
}

const overlayStyles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 8,
  },
  checkCircle: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#4CAF50',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35, shadowRadius: 6, elevation: 6,
  },
  checkMark: { color: '#fff', fontSize: 28, fontWeight: '900', lineHeight: 32 },
});

// ── Toast de sucesso deslizante ────────────────────────────────────────────────
function UploadToast({ visivel, mensagem }) {
  const slideY = useRef(new Animated.Value(80)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visivel) {
      Animated.parallel([
        Animated.spring(slideY, { toValue: 0, friction: 7, tension: 120, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideY, { toValue: 80, duration: 300, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [visivel]);

  return (
    <Animated.View style={[toastStyles.container, { transform: [{ translateY: slideY }], opacity }]} pointerEvents="none">
      <View style={toastStyles.pill}>
        <Text style={toastStyles.icon}>🎉</Text>
        <Text style={toastStyles.text}>{mensagem}</Text>
      </View>
    </Animated.View>
  );
}

const toastStyles = StyleSheet.create({
  container: {
    position: 'absolute', bottom: 28, left: 0, right: 0,
    alignItems: 'center', zIndex: 999,
  },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#2E7D32', paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 30,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },
  icon: { fontSize: 18 },
  text: { color: '#fff', fontWeight: '700', fontSize: 14 },
});

// Barra de progresso do perfil
function ProgressoBarra({ valor }) {
  return (
    <View>
      <View style={styles.progressoOuter}>
        <LinearGradient
          colors={[COLORS.primaryLight, COLORS.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.progressoInner, { width: `${valor ?? 0}%` }]}
        />
      </View>
    </View>
  );
}

export default function PerfilScreen({ navigation }) {
  const { perfil: perfilCtx, usuario, atualizarPerfilLocal } = useAuth();
  const [p, setP] = useState(perfilCtx ?? null);
  // uploadState: { indice: number|null, fase: 'idle'|'uploading'|'sucesso'|'erro' }
  const [uploadState, setUploadState] = useState({ indice: null, fase: 'idle' });
  const [toastVisivel, setToastVisivel] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const toastTimerRef = useRef(null);

  const [erroPerfil, setErroPerfil] = useState(false);

  // Recarrega sempre que a tela receber foco
  useFocusEffect(
    useCallback(() => {
      let timeout;
      const carregar = async () => {
        setErroPerfil(false);
        const res = await obterMeuPerfil();
        if (res.sucesso && res.perfil) {
          setP(res.perfil);
        } else if (!perfilCtx) {
          setErroPerfil(true);
        }
      };
      carregar();
      // Timeout de segurança: se após 15s não carregou, mostra erro
      timeout = setTimeout(() => setErroPerfil(true), 15000);
      return () => clearTimeout(timeout);
    }, [])
  );

  // Atualiza se o contexto mudar (ex: primeiro carregamento)
  useEffect(() => {
    if (perfilCtx && !p) setP(perfilCtx);
  }, [perfilCtx]);

  // --- Funções de foto --------------------------------------------------------

  const _mostrarToast = (msg) => {
    setToastMsg(msg);
    setToastVisivel(true);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastVisivel(false), 2800);
  };

  // Upload com a fonte escolhida (galeria ou câmera)
  const _uploadDaFonte = async (indice, launchFn) => {
    const resultado = await launchFn({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.85,
    });
    if (resultado.canceled) return;

    setUploadState({ indice, fase: 'uploading' });
    try {
      const upload = await uploadFoto(usuario?.id, resultado.assets[0].uri, indice);
      if (!upload.sucesso) {
        setUploadState({ indice: null, fase: 'idle' });
        Alert.alert('Erro no upload', upload.erro || 'Não foi possível enviar a foto.');
        return;
      }
      const fotosAtuais = [...(p?.fotos ?? [])];
      fotosAtuais[indice] = upload.url;
      const res = await atualizarPerfil({
        fotos: fotosAtuais,
        foto_principal: indice === 0 ? upload.url : p?.foto_principal,
      });
      if (res.sucesso) {
        setP(res.perfil);
        atualizarPerfilLocal(res.perfil);
        setUploadState({ indice, fase: 'sucesso' });
        _mostrarToast('Foto adicionada com sucesso!');
        setTimeout(() => setUploadState({ indice: null, fase: 'idle' }), 1500);
      } else {
        setUploadState({ indice: null, fase: 'idle' });
        Alert.alert('Erro', res.erro || 'Não foi possível salvar.');
      }
    } catch (e) {
      setUploadState({ indice: null, fase: 'idle' });
      Alert.alert('Erro', e.message || 'Falha inesperada no upload.');
    }
  };

  const _abrirGaleria = async (indice) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permissão necessária', 'Permita o acesso à galeria nas configurações.');
      return;
    }
    await _uploadDaFonte(indice, ImagePicker.launchImageLibraryAsync);
  };

  const _abrirCamera = async (indice) => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permissão necessária', 'Permita o acesso à câmera nas configurações.');
      return;
    }
    await _uploadDaFonte(indice, ImagePicker.launchCameraAsync);
  };

  // Mostra ActionSheet galeria vs câmera
  const _escolherFonte = (indice) => {
    Alert.alert(
      'Adicionar foto',
      'De onde você quer pegar a foto?',
      [
        { text: '🖼️  Da galeria',     onPress: () => _abrirGaleria(indice) },
        { text: '📷  Tirar foto agora', onPress: () => _abrirCamera(indice) },
        { text: 'Cancelar', style: 'cancel' },
      ]
    );
  };

  const removerFoto = async (indice) => {
    const urlAtual = (p?.fotos ?? [])[indice];
    setUploadState({ indice, fase: 'uploading' });
    try {
      if (urlAtual) await removerFotoSlot(urlAtual);
      const fotosAtuais = [...(p?.fotos ?? [])];
      fotosAtuais.splice(indice, 1);
      const res = await atualizarPerfil({
        fotos: fotosAtuais,
        foto_principal: indice === 0 ? (fotosAtuais[0] ?? null) : p?.foto_principal,
      });
      if (res.sucesso) {
        setP(res.perfil);
        atualizarPerfilLocal(res.perfil);
        _mostrarToast('Foto removida!');
      } else {
        Alert.alert('Erro', res.erro || 'Não foi possível remover.');
      }
    } finally {
      setUploadState({ indice: null, fase: 'idle' });
    }
  };

  const _confirmarRemocao = (indice) => {
    if (uploadState.fase !== 'idle') return;
    Alert.alert(
      'Remover foto?',
      'Esta ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Remover', style: 'destructive', onPress: () => removerFoto(indice) },
      ]
    );
  };

  const tocarFoto = (indice) => {
    if (uploadState.fase !== 'idle') return;
    const fotoExistente = (p?.fotos ?? [])[indice];
    if (fotoExistente) {
      Alert.alert(
        'Foto ' + (indice + 1),
        'O que deseja fazer?',
        [
          { text: '🖼️  Da galeria',      onPress: () => _abrirGaleria(indice) },
          { text: '📷  Tirar foto agora',  onPress: () => _abrirCamera(indice) },
          { text: '🗑️  Remover foto', style: 'destructive', onPress: () => _confirmarRemocao(indice) },
          { text: 'Cancelar', style: 'cancel' },
        ]
      );
    } else {
      _escolherFonte(indice);
    }
  };

  const tocarAvatar = () => {
    if (uploadState.fase !== 'idle') return;
    const temFoto = !!(p?.fotos ?? [])[0];
    if (temFoto) {
      Alert.alert(
        'Foto de perfil',
        'O que deseja fazer?',
        [
          { text: '🖼️  Da galeria',      onPress: () => _abrirGaleria(0) },
          { text: '📷  Tirar foto agora',  onPress: () => _abrirCamera(0) },
          { text: '🗑️  Remover foto', style: 'destructive', onPress: () => _confirmarRemocao(0) },
          { text: 'Cancelar', style: 'cancel' },
        ]
      );
    } else {
      _escolherFonte(0);
    }
  };

  if (!p) {
    return (
      <SafeAreaView style={[styles.safe, { justifyContent: 'center', alignItems: 'center' }]}>
        {erroPerfil ? (
          <>
            <Text style={{ color: COLORS.textSecondary, fontSize: 15, marginBottom: 16 }}>
              Não foi possível carregar o perfil.
            </Text>
            <TouchableOpacity
              style={{ backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 }}
              onPress={async () => {
                setErroPerfil(false);
                const res = await obterMeuPerfil();
                if (res.sucesso && res.perfil) setP(res.perfil);
                else setErroPerfil(true);
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>Tentar novamente</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={{ color: COLORS.textMuted, marginTop: 12, fontSize: 13 }}>Carregando perfil...</Text>
          </>
        )}
      </SafeAreaView>
    );
  }

  const stats = [
    { icone: 'heart', cor: COLORS.like, valor: p.curtidas ?? 0, label: 'Curtidas' },
    { icone: 'heart-circle', cor: COLORS.primary, valor: p.matches ?? 0, label: 'Matches' },
    { icone: 'star', cor: COLORS.superLike, valor: p.superLikes ?? 0, label: 'Super Likes' },
  ];

  const enviandoFoto = uploadState.fase !== 'idle';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Meu Perfil</Text>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => navigation.navigate('Configuracoes')}
          >
            <Ionicons name="create-outline" size={20} color={COLORS.primary} />
            <Text style={styles.editText}>Editar</Text>
          </TouchableOpacity>
        </View>

        {/* Foto principal + info */}
        <View style={styles.perfilCard}>
          <View style={styles.avatarArea}>
            <TouchableOpacity onPress={tocarAvatar} disabled={enviandoFoto} activeOpacity={0.85}>
              <Image
                source={{ uri: (p.fotos ?? [])[0] ?? 'https://randomuser.me/api/portraits/women/90.jpg' }}
                style={styles.avatarImg}
              />
              {/* Overlay escuro suave ao toque para indicar que é clicável */}
            </TouchableOpacity>

            {/* Botão câmera (alterar) */}
            <TouchableOpacity
              style={styles.avatarCameraBtn}
              onPress={tocarAvatar}
              disabled={enviandoFoto}
            >
              {uploadState.fase !== 'idle' && uploadState.indice === 0
                ? <ActivityIndicator size="small" color={COLORS.white} />
                : <Ionicons name="camera" size={18} color={COLORS.white} />}
            </TouchableOpacity>

            {/* Botão lixeira (remover) — só aparece se tiver foto */}
            {!!(p?.fotos ?? [])[0] && (
              <TouchableOpacity
                style={styles.avatarTrashBtn}
                onPress={() => _confirmarRemocao(0)}
                disabled={enviandoFoto}
              >
                <Ionicons name="trash" size={14} color={COLORS.white} />
              </TouchableOpacity>
            )}

            {p.verificada && (
              <View style={styles.verificadaBadge}>
                <Ionicons name="shield-checkmark" size={12} color="#1565C0" />
                <Text style={styles.verificadaText}>Verificada</Text>
              </View>
            )}
          </View>

          <Text style={styles.nome}>{p.nome}, {p.idade}</Text>
          <View style={styles.cidadeRow}>
            <Ionicons name="location-outline" size={14} color={COLORS.textMuted} />
            <Text style={styles.cidade}>{p.cidade}</Text>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            {stats.map((s) => (
              <View key={s.label} style={styles.statItem}>
                <Ionicons name={s.icone} size={20} color={s.cor} />
                <Text style={styles.statValor}>{s.valor}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Completude do perfil */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Completude do perfil</Text>
            <Text style={styles.completudePorc}>{p.completude}%</Text>
          </View>
          <ProgressoBarra valor={p.completude} />
          {p.completude < 100 && (
            <TouchableOpacity style={styles.completudeDica}>
              <Ionicons name="information-circle-outline" size={16} color={COLORS.secondary} />
              <Text style={styles.completudeDicaText}>
                Complete seu perfil para aparecer mais nos resultados
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Fotos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Minhas fotos</Text>
          <View style={styles.fotosGrid}>
            {(p.fotos ?? []).concat(Array(Math.max(0, 6 - (p.fotos ?? []).length)).fill(null)).slice(0, 6).map((foto, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.fotoSlot}
                onPress={() => tocarFoto(idx)}
                disabled={enviandoFoto}
                activeOpacity={0.85}
              >
                {foto ? (
                  <Image source={{ uri: foto }} style={styles.fotoImg} />
                ) : (
                  <View style={styles.fotoVazio}>
                    <Ionicons name="add" size={28} color={COLORS.textMuted} />
                    <Text style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 4 }}>Adicionar</Text>
                  </View>
                )}
                {/* Botão ✕ delete — visível sobre a foto quando não está em upload */}
                {foto && uploadState.indice !== idx && (
                  <TouchableOpacity
                    style={styles.fotoDeletBtn}
                    onPress={(e) => { e.stopPropagation?.(); _confirmarRemocao(idx); }}
                    hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
                  >
                    <Ionicons name="close" size={13} color={COLORS.white} />
                  </TouchableOpacity>
                )}
                {/* Ícone de câmera no canto inferior — slot com foto */}
                {foto && uploadState.indice !== idx && (
                  <View style={styles.fotoEditBadge}>
                    <Ionicons name="camera" size={11} color={COLORS.white} />
                  </View>
                )}
                {/* Overlay de upload animado — só no slot ativo */}
                <FotoUploadOverlay
                  ativo={uploadState.indice === idx && uploadState.fase === 'uploading'}
                  sucesso={uploadState.indice === idx && uploadState.fase === 'sucesso'}
                />
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.fotosDica}>Dica: perfis com 3+ fotos recebem 3x mais matches 💜</Text>
        </View>

        {/* Bio */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Bio</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Configuracoes')}>
              <Ionicons name="create-outline" size={18} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.bio}>{p.bio}</Text>
        </View>

        {/* Informações */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informações</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Ionicons name="heart-outline" size={16} color={COLORS.primary} />
              <Text style={styles.infoText}>{p.orientacao}</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="location-outline" size={16} color={COLORS.primary} />
              <Text style={styles.infoText}>{p.cidade}</Text>
            </View>
          </View>
        </View>

        {/* Interesses */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Interesses</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Configuracoes')}>
              <Ionicons name="create-outline" size={18} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
          <View style={styles.chips}>
            {(p.interesses ?? []).map((item) => (
              <View key={item} style={styles.chip}>
                <Text style={styles.chipText}>{item}</Text>
              </View>
            ))}
            <TouchableOpacity style={styles.chipAdd} onPress={() => navigation.navigate('Configuracoes')}>
              <Ionicons name="add" size={16} color={COLORS.primary} />
              <Text style={styles.chipAddText}>Adicionar</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Safimatch Premium */}
        <TouchableOpacity activeOpacity={0.9} style={{ marginHorizontal: SPACING.lg, marginBottom: SPACING.xl }}>
          <LinearGradient
            colors={['#F57F17', '#FF8F00']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.premiumCard}
          >
            <View>
              <Text style={styles.premiumTitle}>Safimatch Premium 👑</Text>
              <Text style={styles.premiumSub}>Super likes ilimitados, veja quem te curtiu e muito mais!</Text>
            </View>
            <Ionicons name="arrow-forward-circle" size={32} color={COLORS.white} />
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>

      {/* Toast de sucesso deslizante */}
      <UploadToast visivel={toastVisivel} mensagem={toastMsg} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingBottom: SPACING.xxl },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
  },
  headerTitle: { fontSize: 26, fontWeight: '800', color: COLORS.textPrimary },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  editText: { fontSize: 14, color: COLORS.primary, fontWeight: '700' },

  perfilCard: {
    alignItems: 'center', paddingVertical: SPACING.lg,
    backgroundColor: COLORS.white, marginHorizontal: SPACING.lg,
    borderRadius: RADIUS.xl, marginBottom: SPACING.md,
    shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1, shadowRadius: 12, elevation: 4,
  },
  avatarArea: { position: 'relative', marginBottom: 14 },
  avatarImg: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 3, borderColor: COLORS.primary,
  },
  avatarCameraBtn: {
    position: 'absolute', bottom: 2, right: 2,
    backgroundColor: COLORS.primary, width: 30, height: 30,
    borderRadius: 15, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: COLORS.white,
  },
  avatarTrashBtn: {
    position: 'absolute', bottom: 2, left: 2,
    backgroundColor: '#D32F2F', width: 26, height: 26,
    borderRadius: 13, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: COLORS.white,
  },
  verificadaBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#E3F2FD', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: RADIUS.full, position: 'absolute', top: -4, left: -30,
  },
  verificadaText: { fontSize: 10, color: '#1565C0', fontWeight: '700' },
  nome: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary },
  cidadeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  cidade: { fontSize: 13, color: COLORS.textMuted },
  statsRow: {
    flexDirection: 'row', gap: 0, marginTop: 18,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    width: '100%',
  },
  statItem: {
    flex: 1, alignItems: 'center', paddingTop: 14, gap: 3,
    borderRightWidth: 1, borderRightColor: COLORS.border,
  },
  statValor: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary },
  statLabel: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600' },

  section: {
    backgroundColor: COLORS.white, marginHorizontal: SPACING.lg,
    borderRadius: RADIUS.lg, padding: SPACING.md,
    marginBottom: SPACING.sm,
    shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5, shadowRadius: 4, elevation: 2,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },

  // Completude
  progressoOuter: { height: 8, backgroundColor: COLORS.border, borderRadius: 4, overflow: 'hidden' },
  progressoInner: { height: '100%', borderRadius: 4 },
  completudePorc: { fontSize: 15, fontWeight: '800', color: COLORS.primary },
  completudeDica: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F3E5F5', borderRadius: RADIUS.sm,
    padding: 10, marginTop: 10,
  },
  completudeDicaText: { flex: 1, fontSize: 12, color: COLORS.secondary, lineHeight: 17 },

  // Fotos
  fotosGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  fotoSlot: { width: FOTO_SIZE, height: FOTO_SIZE, borderRadius: RADIUS.sm, overflow: 'hidden', position: 'relative' },
  fotoImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  fotoVazio: {
    width: '100%', height: '100%',
    backgroundColor: COLORS.background,
    borderWidth: 1.5, borderColor: COLORS.border,
    borderStyle: 'dashed', borderRadius: RADIUS.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  fotoDeletBtn: {
    position: 'absolute', top: 4, right: 4,
    backgroundColor: 'rgba(211,47,47,0.85)',
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 10,
  },
  fotoEditBadge: {
    position: 'absolute', bottom: 4, right: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  fotosDica: { fontSize: 11, color: COLORS.textMuted, marginTop: 10, textAlign: 'center' },

  bio: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20 },

  // Info
  infoGrid: { gap: 8 },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { fontSize: 14, color: COLORS.textSecondary },

  // Chips interesse
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: '#FCE4EC', paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: RADIUS.full,
  },
  chipText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  chipAdd: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1.5, borderColor: COLORS.primary, borderStyle: 'dashed',
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.full,
  },
  chipAddText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },

  // Premium
  premiumCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: SPACING.md, borderRadius: RADIUS.xl,
    shadowColor: '#F57F17', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  premiumTitle: { fontSize: 16, fontWeight: '800', color: COLORS.white, marginBottom: 4 },
  premiumSub: { fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 17, maxWidth: '80%' },
});
