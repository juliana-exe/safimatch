// src/screens/PremiumScreen.js – Safimatch Premium
// Assinaturas via Google Play Billing (react-native-iap v14)
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import {
  SKUS,
  PLANOS_INFO,
  ALL_SKUS,
  iniciarConexaoBilling,
  encerrarConexaoBilling,
  buscarAssinaturas,
  realizarCompra,
  restaurarCompras,
  finalizarTransacao,
  ouvirCompras,
  ouvirErros,
  verificarCompraPlay,
} from '../services/billingService';

const BENEFICIOS = [
  { icon: 'heart-circle',     texto: 'Curtidas ilimitadas todo dia'       },
  { icon: 'star',             texto: 'Super Likes ilimitados'             },
  { icon: 'eye',              texto: 'Veja quem te curtiu primeiro'       },
  { icon: 'infinite',         texto: 'Desfazer último swipe (Undo)'       },
  { icon: 'shield-checkmark', texto: 'Perfil destacado nas descobertas'  },
  { icon: 'ribbon',           texto: 'Selo Premium visível no seu perfil' },
];

// ─── Tela de sucesso ──────────────────────────────────────────────────────────
function TelaPago({ onFechar }) {
  return (
    <SafeAreaView style={[st.safe, st.center]}>
      <Text style={{ fontSize: 80, textAlign: 'center' }}>🎉</Text>
      <Text style={st.pagoTitulo}>Pagamento confirmado!</Text>
      <Text style={st.pagoSub}>
        Seu plano Premium está ativo agora. Aproveite curtidas ilimitadas! 💜
      </Text>
      <TouchableOpacity style={st.btnWrap} onPress={onFechar}>
        <LinearGradient
          colors={['#FFD700', '#FF8C00']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={st.btnGrad}
        >
          <Ionicons name="heart" size={18} color="#fff" style={{ marginRight: 8 }} />
          <Text style={st.btnText}>Começar a curtir!</Text>
        </LinearGradient>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// ─── Componente principal ──────────────────────────────────────────────────────
export default function PremiumScreen({ navigation }) {
  const { recarregarAuth } = useAuth();

  const [plano,        setPlano]        = useState(SKUS.mensal);
  const [products,     setProducts]     = useState([]);
  const [loadingSetup, setLoadingSetup] = useState(true);
  const [purchasing,   setPurchasing]   = useState(false);
  const [purchased,    setPurchased]    = useState(false);
  const [billingOk,    setBillingOk]    = useState(false);
  const [erro,         setErro]         = useState('');

  const listenerCompra = useRef(null);
  const listenerErro   = useRef(null);

  // ── Setup de billing ao montar ──────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    (async () => {
      const ok = await iniciarConexaoBilling();
      if (!mounted) return;

      setBillingOk(ok);

      if (ok) {
        // Ouve compras aprovadas pelo Google Play
        listenerCompra.current = ouvirCompras(async (purchase) => {
          if (!purchase?.productId) return;
          try {
            const verificou = await verificarCompraPlay(purchase);
            await finalizarTransacao(purchase);
            if (verificou) {
              await recarregarAuth?.();
              if (mounted) setPurchased(true);
            } else {
              Alert.alert(
                'Erro ao ativar Premium',
                'Sua compra foi processada mas houve um erro na ativação. Entre em contato: suporte@safimatch.com.br',
              );
            }
          } catch (e) {
            console.warn('[premium] erro ao finalizar compra:', e?.message);
          } finally {
            if (mounted) setPurchasing(false);
          }
        });

        // Ouve erros do Google Play
        listenerErro.current = ouvirErros((err) => {
          if (!mounted) return;
          setPurchasing(false);
          if (err?.code !== 'E_USER_CANCELLED') {
            setErro('Erro na compra: ' + (err?.message ?? 'Tente novamente.'));
          }
        });

        // Busca assinaturas disponíveis na loja
        const subs = await buscarAssinaturas();
        if (mounted) setProducts(subs);
      }

      if (mounted) setLoadingSetup(false);
    })();

    return () => {
      mounted = false;
      listenerCompra.current?.remove();
      listenerErro.current?.remove();
      encerrarConexaoBilling();
    };
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────
  const getPreco = (sku) => {
    const p = products.find(x => x.productId === sku);
    return p?.localizedPrice ?? PLANOS_INFO[sku]?.precoFallback ?? '---';
  };

  // ── Ações ──────────────────────────────────────────────────────────────
  const handleComprar = async () => {
    if (purchasing || !billingOk) return;
    setPurchasing(true);
    setErro('');
    try {
      await realizarCompra(plano, products);
      // Resultado chega via ouvirCompras() — assíncrono
    } catch (e) {
      setPurchasing(false);
      if (e?.code !== 'E_USER_CANCELLED') {
        setErro('Não foi possível iniciar a compra. Tente novamente.');
      }
    }
  };

  const handleRestaurar = async () => {
    if (purchasing) return;
    setPurchasing(true);
    setErro('');
    try {
      const purchases = await restaurarCompras();
      const premiumP  = purchases.find(p => ALL_SKUS.includes(p.productId));
      if (premiumP) {
        const ok = await verificarCompraPlay(premiumP);
        if (ok) {
          await recarregarAuth?.();
          setPurchased(true);
          return;
        }
      }
      Alert.alert(
        'Nenhuma assinatura encontrada',
        'Não há assinatura ativa vinculada a esta conta Google Play.',
      );
    } catch {
      setErro('Erro ao restaurar compras. Tente novamente.');
    } finally {
      setPurchasing(false);
    }
  };

  // ── Renders ────────────────────────────────────────────────────────────
  if (purchased) {
    return <TelaPago onFechar={() => navigation.goBack()} />;
  }

  if (loadingSetup) {
    return (
      <SafeAreaView style={[st.safe, st.center]}>
        <ActivityIndicator size="large" color="#FF8C00" />
        <Text style={{ marginTop: 12, color: '#888', fontSize: 14 }}>Conectando à loja...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={st.safe}>
      <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Header dourado ── */}
        <LinearGradient colors={['#FFD700', '#FF8C00']} style={st.header}>
          <TouchableOpacity style={st.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={{ fontSize: 52 }}>👑</Text>
          <Text style={st.headerTitle}>Safimatch Premium</Text>
          <Text style={st.headerSub}>Conecte-se sem limites</Text>
        </LinearGradient>

        {/* ── Aviso em ambiente sem billing nativo ── */}
        {!billingOk && Platform.OS === 'android' && (
          <View style={st.aviso}>
            <Ionicons name="information-circle-outline" size={18} color="#1565C0" />
            <Text style={st.avisoText}>
              Loja indisponível neste ambiente. Instale o app via Google Play para assinar.
            </Text>
          </View>
        )}

        {/* ── Benefícios ── */}
        <View style={st.secao}>
          <Text style={st.secaoTitulo}>O que você ganha:</Text>
          {BENEFICIOS.map(b => (
            <View key={b.texto} style={st.beneficioRow}>
              <View style={st.beneficioIcon}>
                <Ionicons name={b.icon} size={20} color="#FF8C00" />
              </View>
              <Text style={st.beneficioText}>{b.texto}</Text>
            </View>
          ))}
        </View>

        {/* ── Seletor de planos ── */}
        <View style={st.secao}>
          <Text style={st.secaoTitulo}>Escolha seu plano:</Text>
          <View style={st.planosRow}>
            {Object.entries(SKUS).map(([, sku]) => {
              const info  = PLANOS_INFO[sku];
              const ativo = plano === sku;
              return (
                <TouchableOpacity
                  key={sku}
                  style={[st.planoCard, ativo && st.planoCardAtivo]}
                  onPress={() => { setPlano(sku); setErro(''); }}
                  activeOpacity={0.8}
                >
                  {info.badge && (
                    <View style={st.badge}>
                      <Text style={st.badgeText}>{info.badge}</Text>
                    </View>
                  )}
                  <Text style={[st.planoLabel, ativo && st.atv]}>{info.label}</Text>
                  <Text style={[st.planoPreco, ativo && st.atv]}>{getPreco(sku)}</Text>
                  <Text style={[st.planoPer,   ativo && st.atv]}>{info.periodo}</Text>
                  {info.sub && (
                    <Text style={[st.planoSub, ativo && st.atv]}>{info.sub}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Mensagem de erro ── */}
        {!!erro && (
          <View style={st.erroBox}>
            <Ionicons name="alert-circle-outline" size={16} color={COLORS.error} />
            <Text style={st.erroText}>{erro}</Text>
          </View>
        )}

        {/* ── Botão principal ── */}
        <TouchableOpacity
          style={[st.btnWrap, (!billingOk || purchasing) && { opacity: 0.6 }]}
          onPress={handleComprar}
          disabled={!billingOk || purchasing}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['#FFD700', '#FF8C00']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={st.btnGrad}
          >
            {purchasing
              ? <ActivityIndicator color="#fff" />
              : (
                <>
                  <Ionicons name="star" size={18} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={st.btnText}>Assinar · {getPreco(plano)}</Text>
                </>
              )}
          </LinearGradient>
        </TouchableOpacity>

        {/* ── Restaurar compra ── */}
        <TouchableOpacity
          onPress={handleRestaurar}
          disabled={purchasing}
          style={st.restaurarBtn}
        >
          <Text style={st.restaurarText}>Restaurar compra anterior</Text>
        </TouchableOpacity>

        {/* ── Texto legal obrigatório pela política do Google Play ── */}
        <Text style={st.legal}>
          A assinatura é cobrada pela Google LLC via Google Play. Renova automaticamente
          até ser cancelada. Cancele a qualquer momento nas configurações do Google Play.
          Ao assinar, você concorda com os Termos de Serviço do Google Play.
        </Text>

        {/* ── Como funciona ── */}
        <View style={[st.secao, { marginTop: 4 }]}>
          <Text style={st.secaoTitulo}>Como funciona:</Text>
          {[
            { n: '1', t: 'Escolha o plano',   d: 'Mensal, trimestral ou anual'     },
            { n: '2', t: 'Pague pelo Google', d: 'Cobrança segura via Google Play'  },
            { n: '3', t: 'Premium ativo',     d: 'Benefícios liberados na hora'     },
          ].map(p => (
            <View key={p.n} style={st.passoRow}>
              <View style={st.passoCirculo}>
                <Text style={st.passoNum}>{p.n}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.passoTitulo}>{p.t}</Text>
                <Text style={st.passoDesc}>{p.d}</Text>
              </View>
            </View>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#FFFDF5' },
  center: { justifyContent: 'center', alignItems: 'center', padding: 32 },
  scroll: { paddingBottom: 48 },

  backBtn:     { position: 'absolute', top: 16, left: 16, padding: 8 },
  header:      { paddingTop: 48, paddingBottom: 28, alignItems: 'center' },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#fff', marginTop: 8 },
  headerSub:   { fontSize: 14, color: '#fff', opacity: 0.9, marginTop: 4 },

  aviso:     { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#E3F2FD', margin: 16, padding: 12, borderRadius: 10 },
  avisoText: { flex: 1, fontSize: 13, color: '#1565C0' },

  secao:       { paddingHorizontal: 20, paddingTop: 20 },
  secaoTitulo: { fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 16 },

  beneficioRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  beneficioIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFF3E0', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  beneficioText: { fontSize: 15, color: '#333', flex: 1 },

  planosRow:      { flexDirection: 'row', gap: 8 },
  planoCard:      { flex: 1, borderRadius: 12, borderWidth: 2, borderColor: '#E0E0E0', padding: 12, alignItems: 'center', backgroundColor: '#fff', marginTop: 12, minHeight: 100 },
  planoCardAtivo: { borderColor: '#FF8C00', backgroundColor: '#FFF8F0' },
  planoLabel:     { fontSize: 13, fontWeight: '600', color: '#666', marginBottom: 4 },
  planoPreco:     { fontSize: 15, fontWeight: '800', color: '#333' },
  planoPer:       { fontSize: 11, color: '#999', marginTop: 2 },
  planoSub:       { fontSize: 10, color: '#999', marginTop: 2, textAlign: 'center' },
  atv:            { color: '#FF6F00' },

  badge:     { position: 'absolute', top: -12, left: 0, right: 0, alignItems: 'center' },
  badgeText: { backgroundColor: '#FF8C00', color: '#fff', fontSize: 10, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },

  btnWrap: { marginHorizontal: 20, marginTop: 20, borderRadius: 14, overflow: 'hidden' },
  btnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, paddingHorizontal: 24 },
  btnText: { fontSize: 16, fontWeight: '800', color: '#fff' },

  restaurarBtn:  { alignItems: 'center', paddingVertical: 14 },
  restaurarText: { fontSize: 14, color: '#999', textDecorationLine: 'underline' },

  legal: { fontSize: 11, color: '#bbb', textAlign: 'center', marginHorizontal: 20, lineHeight: 17, marginBottom: 8 },

  erroBox:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFEBEE', margin: 20, padding: 12, borderRadius: 8 },
  erroText: { fontSize: 13, color: COLORS.error, flex: 1 },

  passoRow:     { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16, gap: 12 },
  passoCirculo: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FF8C00', alignItems: 'center', justifyContent: 'center' },
  passoNum:     { color: '#fff', fontWeight: '800', fontSize: 15 },
  passoTitulo:  { fontSize: 14, fontWeight: '700', color: '#333' },
  passoDesc:    { fontSize: 13, color: '#666', marginTop: 2 },

  pagoTitulo: { fontSize: 26, fontWeight: '800', color: '#333', textAlign: 'center', marginTop: 24 },
  pagoSub:    { fontSize: 15, color: '#666', textAlign: 'center', marginTop: 12, lineHeight: 22, marginBottom: 32 },
});
