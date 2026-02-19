// src/screens/DescobertaScreen.js - Safimatch
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  TouchableOpacity,
  Image,
  Platform,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS } from '../theme/colors';
import { buscarPerfisDescoberta } from '../services/perfilService';
import { curtir, desfazerCurtida } from '../services/matchService';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const CARD_W = SCREEN_W - 32;
const CARD_H = SCREEN_H * 0.62;
const SWIPE_THRESHOLD = SCREEN_W * 0.28;

// Botão de ação circular
function BotaoAcao({ icone, cor, onPress, tamanho = 56 }) {
  return (
    <TouchableOpacity
      style={[styles.botaoAcao, { width: tamanho, height: tamanho, borderRadius: tamanho / 2, borderColor: cor }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Ionicons name={icone} size={tamanho * 0.42} color={cor} />
    </TouchableOpacity>
  );
}

export default function DescobertaScreen({ navigation }) {
  const [perfis, setPerfis] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [matchAtual, setMatchAtual] = useState(null);
  const [ultimaAcao, setUltimaAcao] = useState(null);

  const FOTO_PLACEHOLDER = 'https://randomuser.me/api/portraits/women/90.jpg';

  const carregarPerfis = async (reiniciar = false) => {
    setCarregando(true);
    try {
      const { perfis: lista } = await buscarPerfisDescoberta({ reiniciar });
      // Garante que todo perfil tenha ao menos uma foto
      const normalizados = (lista ?? []).map(p => ({
        ...p,
        fotos: (p.fotos && p.fotos.length > 0) ? p.fotos : [p.foto_principal ?? FOTO_PLACEHOLDER],
        interesses: p.interesses ?? [],
      }));
      setPerfis(normalizados);
    } catch (e) {
      console.warn('Erro ao carregar perfis:', e);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregarPerfis(); }, []);

  const posicao = useRef(new Animated.ValueXY()).current;
  // Histórico de perfis já exibidos para desfazer ação
  const historicoRef = useRef([]);
  const rotacao = posicao.x.interpolate({
    inputRange: [-SCREEN_W / 2, 0, SCREEN_W / 2],
    outputRange: ['-10deg', '0deg', '10deg'],
    extrapolate: 'clamp',
  });
  const opacidadeLike = posicao.x.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const opacidadeNope = posicao.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: (_, gestureState) => {
      posicao.setValue({ x: gestureState.dx, y: gestureState.dy });
    },
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dx > SWIPE_THRESHOLD) swipeRight();
      else if (gestureState.dx < -SWIPE_THRESHOLD) swipeLeft();
      else Animated.spring(posicao, { toValue: { x: 0, y: 0 }, useNativeDriver: true }).start();
    },
  });

  const swipe = (direcao, callback) => {
    const destino = direcao === 'right' ? SCREEN_W * 1.4 : -SCREEN_W * 1.4;
    Animated.timing(posicao, {
      toValue: { x: destino, y: 0 },
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      posicao.setValue({ x: 0, y: 0 });
      callback && callback();
      setPerfis((prev) => prev.slice(1));
    });
  };

  const swipeRight = async () => {
    const perfil = perfis[0];
    historicoRef.current.push(perfil);
    setUltimaAcao('like');
    swipe('right', async () => {
      const res = await curtir(perfil.user_id ?? perfil.id, 'like');
      if (res.houveMutch) setMatchAtual(perfil);
    });
  };

  const swipeLeft = () => {
    const perfil = perfis[0];
    historicoRef.current.push(perfil);
    setUltimaAcao('nope');
    swipe('left', () => curtir(perfil.user_id ?? perfil.id, 'nope'));
  };

  const superLike = () => {
    const perfil = perfis[0];
    historicoRef.current.push(perfil);
    setUltimaAcao('superlike');
    swipe('right', () => curtir(perfil.user_id ?? perfil.id, 'superlike'));
  };

  const desfazer = async () => {
    const ultimo = historicoRef.current.pop();
    if (!ultimo) return;
    await desfazerCurtida(ultimo.user_id ?? ultimo.id);
    setPerfis((prev) => [ultimo, ...prev]);
    setUltimaAcao(null);
  };

  if (perfis.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.semPerfis}>
          <Ionicons name="heart-dislike-outline" size={72} color={COLORS.border} />
          <Text style={styles.semPerfisTitle}>Você viu todo mundo!</Text>
          <Text style={styles.semPerfisSubtitle}>
            Novos perfis chegam todos os dias. Volte mais tarde 💜
          </Text>
          <TouchableOpacity
            style={styles.btnRecarregar}
            onPress={() => carregarPerfis(true)}
          >
            <Text style={styles.btnRecarregarText}>Recomeçar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLogo}>
          <Ionicons name="heart" size={22} color={COLORS.primary} />
          <Text style={styles.headerTitle}>Safimatch</Text>
        </View>
        <TouchableOpacity style={styles.headerIcon} onPress={() => Alert.alert('Filtros', 'Ajuste seus filtros de descoberta em Ajustes → Filtros de Descoberta.')}>
          <Ionicons name="options-outline" size={24} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Stack de cards */}
      <View style={styles.stackArea}>
        {/* Card de fundo (próximo perfil) */}
        {perfis.length > 1 && (
          <View style={[styles.card, styles.cardFundo]}>
            <Image source={{ uri: perfis[1].fotos[0] }} style={styles.cardImagem} />
            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={styles.cardGradient}>
              <Text style={styles.cardNome}>{perfis[1].nome}, {perfis[1].idade}</Text>
            </LinearGradient>
          </View>
        )}

        {/* Card principal (swipável) */}
        <Animated.View
          style={[
            styles.card,
            {
              transform: [
                { translateX: posicao.x },
                { translateY: posicao.y },
                { rotate: rotacao },
              ],
            },
          ]}
          {...panResponder.panHandlers}
        >
          <Image source={{ uri: perfis[0].fotos[0] }} style={styles.cardImagem} />

          {/* Badge LIKE */}
          <Animated.View style={[styles.badgeLike, { opacity: opacidadeLike }]}>
            <Text style={styles.badgeLikeText}>LIKE 💜</Text>
          </Animated.View>

          {/* Badge NOPE */}
          <Animated.View style={[styles.badgeNope, { opacity: opacidadeNope }]}>
            <Text style={styles.badgeNopeText}>NOPE ✕</Text>
          </Animated.View>

          {/* Gradiente e info */}
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.88)']} style={styles.cardGradient}>
            {/* Verificada */}
            {perfis[0].verificada && (
              <View style={styles.verificadaBadge}>
                <Ionicons name="shield-checkmark" size={13} color="#1976D2" />
                <Text style={styles.verificadaText}>Verificada</Text>
              </View>
            )}

            <Text style={styles.cardNome}>
              {perfis[0].nome}, {perfis[0].idade}
            </Text>
            <View style={styles.cardCidade}>
              <Ionicons name="location-outline" size={13} color="rgba(255,255,255,0.8)" />
              <Text style={styles.cardCidadeText}>{perfis[0].cidade}</Text>
            </View>
            <Text style={styles.cardBio} numberOfLines={2}>{perfis[0].bio}</Text>

            {/* Tags */}
            <View style={styles.cardTags}>
              {perfis[0].interesses.map((tag) => (
                <View key={tag} style={styles.cardTag}>
                  <Text style={styles.cardTagText}>{tag}</Text>
                </View>
              ))}
            </View>
          </LinearGradient>
        </Animated.View>
      </View>

      {/* Botões de ação */}
      <View style={styles.acoes}>
        <BotaoAcao icone="refresh-outline" cor={COLORS.warning} onPress={desfazer} tamanho={48} />
        <BotaoAcao icone="close" cor={COLORS.dislike} onPress={swipeLeft} tamanho={64} />
        <BotaoAcao icone="star" cor={COLORS.superLike} onPress={superLike} tamanho={48} />
        <BotaoAcao icone="heart" cor={COLORS.like} onPress={swipeRight} tamanho={64} />
        <BotaoAcao icone="flash-outline" cor={COLORS.secondary} onPress={() => Alert.alert('Boost ⚡', 'Boost estará disponível no Safimatch Premium! 💜')} tamanho={48} />
      </View>

      {/* Modal de Match */}
      {matchAtual && (
        <View style={styles.matchOverlay}>
          <LinearGradient colors={['#AD1457', '#7B1FA2']} style={styles.matchCard}>
            <Ionicons name="heart" size={60} color={COLORS.white} />
            <Text style={styles.matchTitulo}>É um Match! 💜</Text>
            <Text style={styles.matchSubtitulo}>
              Você e <Text style={{ fontWeight: '800' }}>{matchAtual.nome}</Text> se curtiram!
            </Text>

            <View style={styles.matchFotos}>
              <Image source={{ uri: 'https://randomuser.me/api/portraits/women/90.jpg' }} style={styles.matchFoto} />
              <Ionicons name="heart" size={28} color={COLORS.white} style={{ marginHorizontal: -8, zIndex: 1 }} />
              <Image source={{ uri: matchAtual.fotos[0] }} style={styles.matchFoto} />
            </View>

            <TouchableOpacity
              style={styles.matchBtnChat}
              onPress={() => {
                setMatchAtual(null);
                navigation.navigate('Chats');
              }}
            >
              <Ionicons name="chatbubbles" size={18} color={COLORS.primary} />
              <Text style={styles.matchBtnChatText}>Enviar mensagem</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setMatchAtual(null)}>
              <Text style={styles.matchBtnContinuar}>Continuar descobrindo</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  headerLogo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary },
  headerIcon: { padding: 6 },

  // Cards
  stackArea: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 16,
  },
  card: {
    position: 'absolute',
    width: CARD_W,
    height: CARD_H,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    backgroundColor: COLORS.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  cardFundo: {
    transform: [{ scale: 0.95 }],
    top: 14,
    zIndex: 0,
  },
  cardImagem: { width: '100%', height: '100%', resizeMode: 'cover' },
  cardGradient: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: SPACING.md,
    paddingTop: 80,
    paddingBottom: SPACING.md,
    gap: 5,
  },

  // Badges swipe
  badgeLike: {
    position: 'absolute', top: 36, left: 20,
    borderWidth: 3, borderColor: '#E91E8C',
    borderRadius: RADIUS.sm, paddingHorizontal: 12, paddingVertical: 4,
    transform: [{ rotate: '-15deg' }],
  },
  badgeLikeText: { fontSize: 22, fontWeight: '900', color: '#E91E8C' },
  badgeNope: {
    position: 'absolute', top: 36, right: 20,
    borderWidth: 3, borderColor: COLORS.dislike,
    borderRadius: RADIUS.sm, paddingHorizontal: 12, paddingVertical: 4,
    transform: [{ rotate: '15deg' }],
  },
  badgeNopeText: { fontSize: 22, fontWeight: '900', color: COLORS.dislike },

  verificadaBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: RADIUS.full, alignSelf: 'flex-start',
    marginBottom: 4,
  },
  verificadaText: { fontSize: 11, color: '#1565C0', fontWeight: '700' },
  cardNome: { fontSize: 26, fontWeight: '800', color: COLORS.white },
  cardCidade: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  cardCidadeText: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  cardBio: { fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 18 },
  cardTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  cardTag: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  cardTagText: { fontSize: 11, color: COLORS.white, fontWeight: '600' },

  // Botões de ação
  acoes: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 14, paddingVertical: SPACING.md, paddingBottom: SPACING.lg,
  },
  botaoAcao: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12, shadowRadius: 6, elevation: 4,
  },

  // Sem perfis
  semPerfis: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: SPACING.xl },
  semPerfisTitle: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary },
  semPerfisSubtitle: { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 },
  btnRecarregar: {
    backgroundColor: COLORS.primary, paddingHorizontal: 32,
    paddingVertical: 14, borderRadius: RADIUS.full, marginTop: 8,
  },
  btnRecarregarText: { fontSize: 15, fontWeight: '700', color: COLORS.white },

  // Modal de Match
  matchOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 999,
  },
  matchCard: {
    width: SCREEN_W - 40, borderRadius: RADIUS.xl + 4,
    padding: SPACING.xl, alignItems: 'center', gap: 16,
  },
  matchTitulo: { fontSize: 34, fontWeight: '900', color: COLORS.white },
  matchSubtitulo: { fontSize: 16, color: 'rgba(255,255,255,0.9)', textAlign: 'center' },
  matchFotos: { flexDirection: 'row', alignItems: 'center', marginVertical: 8 },
  matchFoto: {
    width: 90, height: 90, borderRadius: 45,
    borderWidth: 3, borderColor: COLORS.white,
  },
  matchBtnChat: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.white,
    paddingHorizontal: 32, paddingVertical: 14,
    borderRadius: RADIUS.full, width: '100%', justifyContent: 'center',
  },
  matchBtnChatText: { fontSize: 16, fontWeight: '700', color: COLORS.primary },
  matchBtnContinuar: {
    fontSize: 14, color: 'rgba(255,255,255,0.75)',
    fontWeight: '600', textDecorationLine: 'underline',
  },
});
