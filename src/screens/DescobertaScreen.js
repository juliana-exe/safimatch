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
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS } from '../theme/colors';
import { buscarPerfisDescoberta } from '../services/perfilService';
import { curtir, desfazerCurtida } from '../services/matchService';
import { obterBonusAtivo, rolarBonus, consumirBonus } from '../services/bonusService';
import { useAuth } from '../context/AuthContext';
import AvatarPessoa from '../components/AvatarPessoa';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const CARD_W = SCREEN_W - 32;
const CARD_H = SCREEN_H * 0.62;
const SWIPE_THRESHOLD = SCREEN_W * 0.28;

// Botão de ação circular (com badge opcional para bônus ativos)
function BotaoAcao({ icone, cor, onPress, tamanho = 56, badge }) {
  return (
    <TouchableOpacity
      style={[styles.botaoAcao, { width: tamanho, height: tamanho, borderRadius: tamanho / 2, borderColor: cor }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Ionicons name={icone} size={tamanho * 0.42} color={cor} />
      {badge != null && badge > 0 ? (
        <View style={styles.botaoBadge}>
          <Text style={styles.botaoBadgeText}>{badge}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

export default function DescobertaScreen({ navigation }) {
  const { perfil: meuPerfil } = useAuth();
  const [perfis, setPerfis] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [matchAtual, setMatchAtual] = useState(null);
  const [ultimaAcao, setUltimaAcao] = useState(null);
  const [fotoIdx, setFotoIdx] = useState(0);

  // Bônus aleatórios
  const [bonusSuperlike, setBonusSuperlike] = useState(0);
  const [bonusDesfazer, setBonusDesfazer] = useState(0);
  const [bannerBonus, setBannerBonus] = useState(null);
  const bannerAnim = useRef(new Animated.Value(-80)).current;

  const carregarPerfis = async (reiniciar = false) => {
    setCarregando(true);
    try {
      const { perfis: lista } = await buscarPerfisDescoberta({ reiniciar });
      // Garante que todo perfil tenha fotos válidas (sem URLs externas de terceiros)
      const normalizados = (lista ?? []).map(p => ({
        ...p,
        fotos: (p.fotos?.filter(Boolean).length > 0)
          ? p.fotos.filter(Boolean)
          : (p.foto_principal ? [p.foto_principal] : []),
        interesses: p.interesses ?? [],
      }));
      setPerfis(normalizados);
    } catch (e) {
      console.warn('Erro ao carregar perfis:', e);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregarPerfis(); _carregarBonus(); }, []);

  // ── Bônus ──────────────────────────────────────────────────────────────────
  // Só seta o label; a animação roda no useEffect DEPOIS do re-render
  const _mostrarBannerBonus = (label) => {
    bannerAnim.setValue(-80); // garante posição inicial antes de montar
    setBannerBonus(label);
  };

  // Dispara a animação assim que o Animated.View entrar na tela
  useEffect(() => {
    if (!bannerBonus) return;
    Animated.sequence([
      Animated.timing(bannerAnim, { toValue: 0,   duration: 400, useNativeDriver: true }),
      Animated.delay(3500),
      Animated.timing(bannerAnim, { toValue: -80, duration: 400, useNativeDriver: true }),
    ]).start(() => setBannerBonus(null));
  }, [bannerBonus]);

  const _carregarBonus = async () => {
    // Tenta rolar um bônus novo (10 % chance, cooldown 24 h)
    const novo = await rolarBonus();
    if (novo) {
      _mostrarBannerBonus(novo.label);
      if (novo.tipo === 'superlike') setBonusSuperlike(novo.qtd);
      else if (novo.tipo === 'desfazer') setBonusDesfazer(novo.qtd);
      return;
    }
    // Sem bônus novo — carrega eventual bônus já ativo (sessão anterior)
    const ativo = await obterBonusAtivo();
    if (!ativo) return;
    if (ativo.tipo === 'superlike') setBonusSuperlike(ativo.qtd);
    else if (ativo.tipo === 'desfazer') setBonusDesfazer(ativo.qtd);
  };

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
      setFotoIdx(0);
      callback && callback();
      setPerfis((prev) => prev.slice(1));
    });
  };

  // ── Ações de swipe ─────────────────────────────────────────────────────────
  // Curtidas normais são ILIMITADAS para todos os usuários.
  const swipeRight = async () => {
    const perfil = perfis[0];
    historicoRef.current.push(perfil);
    setUltimaAcao('like');
    swipe('right', async () => {
      const res = await curtir(perfil.user_id ?? perfil.id, 'like');
      if (res?.houveMatch) setMatchAtual(perfil);
    });
  };

  const swipeLeft = () => {
    const perfil = perfis[0];
    historicoRef.current.push(perfil);
    setUltimaAcao('nope');
    swipe('left', () => curtir(perfil.user_id ?? perfil.id, 'nope'));
  };

  // Superlike — Premium OU bônus ativo
  const superLike = async () => {
    if (bonusSuperlike > 0) {
      const consumido = await consumirBonus('superlike');
      if (consumido) setBonusSuperlike(prev => prev - 1);
    } else if (!meuPerfil?.premium) {
      navigation.navigate('Premium');
      return;
    }
    const perfil = perfis[0];
    historicoRef.current.push(perfil);
    setUltimaAcao('superlike');
    swipe('right', async () => {
      const res = await curtir(perfil.user_id ?? perfil.id, 'superlike');
      if (res?.houveMatch) setMatchAtual(perfil);
    });
  };

  // Desfazer — Premium OU bônus ativo
  const desfazer = async () => {
    if (bonusDesfazer > 0) {
      const consumido = await consumirBonus('desfazer');
      if (consumido) setBonusDesfazer(prev => prev - 1);
    } else if (!meuPerfil?.premium) {
      navigation.navigate('Premium');
      return;
    }
    const ultimo = historicoRef.current.pop();
    if (!ultimo) return;
    await desfazerCurtida(ultimo.user_id ?? ultimo.id);
    setPerfis((prev) => [ultimo, ...prev]);
    setUltimaAcao(null);
  };

  if (carregando) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.semPerfis}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={[styles.semPerfisSubtitle, { marginTop: 16 }]}>Buscando perfis...</Text>
        </View>
      </SafeAreaView>
    );
  }

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
      {/* Banner de bônus ganho */}
      {bannerBonus != null && (
        <Animated.View style={[styles.bannerBonus, { transform: [{ translateY: bannerAnim }] }]}>
          <Ionicons name="gift" size={18} color="#FFD700" style={{ marginRight: 8 }} />
          <Text style={styles.bannerBonusText}>🎁 {bannerBonus}</Text>
        </Animated.View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLogo}>
          <Ionicons name="heart" size={22} color={COLORS.primary} />
          <Text style={styles.headerTitle}>Safimatch</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity style={styles.headerIcon} onPress={() => navigation.navigate('Configuracoes')}>
            <Ionicons name="options-outline" size={24} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Stack de cards */}
      <View style={styles.stackArea}>
        {/* Card de fundo (próximo perfil) */}
        {perfis.length > 1 && (
          <View style={[styles.card, styles.cardFundo]}>
            {perfis[1].fotos[0]
              ? <Image source={{ uri: perfis[1].fotos[0] }} style={styles.cardImagem} />
              : <View style={[styles.cardImagem, styles.semFoto]}>
                  <Ionicons name="person-circle" size={100} color="rgba(173,20,87,0.25)" />
                </View>
            }
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
          {/* Toque nas metades esquerda/direita para trocar foto */}
          {(perfis[0].fotos.length > 0 && perfis[0].fotos[fotoIdx])
            ? <Image source={{ uri: perfis[0].fotos[fotoIdx] }} style={styles.cardImagem} />
            : <View style={[styles.cardImagem, styles.semFoto]}>
                <Ionicons name="person-circle" size={120} color="rgba(173,20,87,0.25)" />
              </View>
          }

          {/* Áreas de toque para navegar entre fotos (sem interferir no swipe) */}
          {perfis[0].fotos.length > 1 && (
            <View style={styles.fotoNavArea} pointerEvents="box-none">
              <TouchableOpacity
                style={styles.fotoNavLeft}
                activeOpacity={1}
                onPress={() => setFotoIdx(i => Math.max(0, i - 1))}
              />
              <TouchableOpacity
                style={styles.fotoNavRight}
                activeOpacity={1}
                onPress={() => setFotoIdx(i => Math.min(perfis[0].fotos.length - 1, i + 1))}
              />
            </View>
          )}

          {/* Dots de paginação de fotos */}
          {perfis[0].fotos.length > 1 && (
            <View style={styles.fotoDots}>
              {perfis[0].fotos.map((_, i) => (
                <View
                  key={i}
                  style={[styles.fotoDot, i === fotoIdx && styles.fotoDotAtivo]}
                />
              ))}
            </View>
          )}

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
        <BotaoAcao icone="refresh-outline" cor={COLORS.warning} onPress={desfazer} tamanho={48} badge={bonusDesfazer || null} />
        <BotaoAcao icone="close" cor={COLORS.dislike} onPress={swipeLeft} tamanho={64} />
        <BotaoAcao icone="star" cor={COLORS.superLike} onPress={superLike} tamanho={48} badge={bonusSuperlike || null} />
        <BotaoAcao icone="heart" cor={COLORS.like} onPress={swipeRight} tamanho={64} />
        <BotaoAcao icone="flash-outline" cor={COLORS.secondary} tamanho={48}
          onPress={() => {
            if (meuPerfil?.premium) {
              Alert.alert('Safimatch Premium ✨', 'Você já tem o plano Premium ativo! Aproveite curtidas ilimitadas e muito mais 💜');
            } else {
              navigation.navigate('Premium');
            }
          }}
        />
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
              <AvatarPessoa
                uri={(meuPerfil?.fotos ?? [])[0]}
                style={styles.matchFoto}
              />
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
  semFoto: { backgroundColor: '#F8BBD0', alignItems: 'center', justifyContent: 'center' },

  // Navegação de fotos dentro do card
  fotoNavArea: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    zIndex: 1,
  },
  fotoNavLeft: { flex: 1 },
  fotoNavRight: { flex: 1 },

  // Dots de paginação de fotos
  fotoDots: {
    position: 'absolute',
    top: 10,
    left: 0, right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
    zIndex: 2,
  },
  fotoDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  fotoDotAtivo: {
    backgroundColor: COLORS.white,
    width: 18,
  },
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

  // Badge de bônus nos botões de ação
  botaoBadge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: '#FFD700',
    borderRadius: 10, minWidth: 20, height: 20,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25, shadowRadius: 2, elevation: 5,
  },
  botaoBadgeText: { color: '#000', fontSize: 10, fontWeight: '800' },

  // Banner de bônus (slide-down do topo)
  bannerBonus: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 200,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#6A1B9A',
    paddingVertical: 13, paddingHorizontal: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 20,
  },
  bannerBonusText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
