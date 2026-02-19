// src/screens/PerfilScreen.js - Safimatch
import React, { useState, useEffect } from 'react';
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
  const [enviandoFoto, setEnviandoFoto] = useState(false);

  const [erroPerfil, setErroPerfil] = useState(false);

  useEffect(() => {
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
    const timeout = setTimeout(() => setErroPerfil(true), 15000);
    return () => clearTimeout(timeout);
  }, []);

  // Atualiza se o contexto mudar (ex: primeiro carregamento)
  useEffect(() => {
    if (perfilCtx && !p) setP(perfilCtx);
  }, [perfilCtx]);

  // --- Funções de foto --------------------------------------------------------

  const _abrirGaleria = async (indice) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permissão necessária', 'Permita o acesso à galeria nas configurações.');
      return;
    }
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.85,
    });
    if (resultado.canceled) return;

    setEnviandoFoto(true);
    try {
      const upload = await uploadFoto(usuario?.id, resultado.assets[0].uri, indice);
      if (!upload.sucesso) {
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
      } else {
        Alert.alert('Erro', res.erro || 'Não foi possível salvar.');
      }
    } finally {
      setEnviandoFoto(false);
    }
  };

  const removerFoto = async (indice) => {
    const urlAtual = (p?.fotos ?? [])[indice];
    setEnviandoFoto(true);
    try {
      // Remove do storage (melhor-esforço — não bloqueia se falhar)
      if (urlAtual) await removerFotoSlot(urlAtual);
      const fotosAtuais = [...(p?.fotos ?? [])];
      fotosAtuais.splice(indice, 1);   // remove e recompacta o array
      const res = await atualizarPerfil({
        fotos: fotosAtuais,
        foto_principal: indice === 0 ? (fotosAtuais[0] ?? null) : p?.foto_principal,
      });
      if (res.sucesso) {
        setP(res.perfil);
        atualizarPerfilLocal(res.perfil);
      } else {
        Alert.alert('Erro', res.erro || 'Não foi possível remover.');
      }
    } finally {
      setEnviandoFoto(false);
    }
  };

  const tocarFoto = (indice) => {
    const fotoExistente = (p?.fotos ?? [])[indice];
    if (fotoExistente) {
      Alert.alert(
        'Foto ' + (indice + 1),
        'O que deseja fazer?',
        [
          { text: '📷  Trocar foto',  onPress: () => _abrirGaleria(indice) },
          { text: '🗑️  Remover foto', style: 'destructive', onPress: () =>
              Alert.alert('Remover foto?', 'Esta ação não pode ser desfeita.', [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Remover', style: 'destructive', onPress: () => removerFoto(indice) },
              ])
          },
          { text: 'Cancelar', style: 'cancel' },
        ]
      );
    } else {
      _abrirGaleria(indice);
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
            <Image source={{ uri: (p.fotos ?? [])[0] ?? 'https://randomuser.me/api/portraits/women/90.jpg' }} style={styles.avatarImg} />
            <TouchableOpacity
              style={styles.avatarCameraBtn}
              onPress={() => tocarFoto(0)}
              disabled={enviandoFoto}
            >
              {enviandoFoto
                ? <ActivityIndicator size="small" color={COLORS.white} />
                : <Ionicons name="camera" size={18} color={COLORS.white} />}
            </TouchableOpacity>
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
              >
                {enviandoFoto && idx === 0 ? (
                  <View style={[styles.fotoVazio, { alignItems: 'center', justifyContent: 'center' }]}>
                    <ActivityIndicator color={COLORS.primary} />
                  </View>
                ) : foto ? (
                  <Image source={{ uri: foto }} style={styles.fotoImg} />
                ) : (
                  <View style={styles.fotoVazio}>
                    <Ionicons name="add" size={28} color={COLORS.textMuted} />
                    <Text style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 4 }}>Adicionar</Text>
                  </View>
                )}
                {foto && (
                  <View style={styles.fotoEditBadge}>
                    <Ionicons name="pencil" size={11} color={COLORS.white} />
                  </View>
                )}
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
