// src/screens/PremiumScreen.js – Safimatch Premium
// Fluxo: idle → criar cobrança → QR Code (polling 5s) → pago ✅
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  Clipboard,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../config/supabase';

// URL base da premium-api (Docker expõe na porta 3001)
const PREMIUM_API = process.env.EXPO_PUBLIC_PREMIUM_API_URL ?? 'http://192.168.100.59:3001';

const PLANOS = [
  { id: 'mensal',     label: 'Mensal',     preco: 'R$ 9,90',  periodo: '/mês',   sub: null,             badge: null,               centavos: 990  },
  { id: 'trimestral', label: 'Trimestral', preco: 'R$ 24,90', periodo: '/trim.',  sub: 'R$ 8,30/mês',   badge: 'Economize 17%',   centavos: 2490 },
  { id: 'anual',      label: 'Anual',      preco: 'R$ 79,90', periodo: '/ano',    sub: 'R$ 6,66/mês',   badge: '🔥 Melhor oferta', centavos: 7990 },
];

const BENEFICIOS = [
  { icon: 'heart-circle',     texto: 'Curtidas ilimitadas todo dia'        },
  { icon: 'star',             texto: 'Super Likes ilimitados'              },
  { icon: 'eye-off',          texto: 'Veja quem te curtiu primeiro'        },
  { icon: 'infinite',         texto: 'Desfazer último swipe (Undo)'        },
  { icon: 'shield-checkmark', texto: 'Perfil destacado nas descobertas'   },
  { icon: 'ribbon',           texto: 'Selo Premium visível no seu perfil' },
];

function formatarTempo(s) {
  const m  = Math.floor(s / 60).toString().padStart(2, '0');
  const ss = (s % 60).toString().padStart(2, '0');
  return `${m}:${ss}`;
}

// ─── Tela de sucesso ──────────────────────────────────────────────────────────
function TelaPago({ onFechar }) {
  return (
    <SafeAreaView style={[styles.safe, { justifyContent: 'center', alignItems: 'center', padding: 32 }]}>
      <Text style={{ fontSize: 80, textAlign: 'center' }}>🎉</Text>
      <Text style={styles.pagoTitulo}>Pagamento confirmado!</Text>
      <Text style={styles.pagoSub}>
        Seu plano Premium está ativo agora. Aproveite curtidas ilimitadas! 💜
      </Text>
      <TouchableOpacity style={styles.btnGerar} onPress={onFechar}>
        <LinearGradient
          colors={['#FFD700', '#FF8C00']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={styles.btnGerarGradient}
        >
          <Ionicons name="heart" size={18} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.btnGerarText}>Começar a curtir!</Text>
        </LinearGradient>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// ─── Tela do QR Code (aguardando pagamento) ───────────────────────────────────
function TelaQRCode({ brCode, qrCodeImage, segundos, copiando, onCopiar, onCancelar }) {
  const urgente = segundos < 120;
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={['#FFD700', '#FF8C00']} style={styles.headerPequeno}>
          <Text style={{ fontSize: 34 }}>👑</Text>
          <Text style={styles.headerTitleSm}>Aguardando Pix</Text>
          <Text style={styles.headerSubSm}>Escaneie ou copie o código abaixo</Text>
        </LinearGradient>

        <View style={[styles.timerBox, urgente && styles.timerBoxUrgente]}>
          <Ionicons name="time-outline" size={16} color={urgente ? COLORS.error : '#555'} />
          <Text style={[styles.timerText, urgente && { color: COLORS.error }]}>
            {urgente ? '⚠️ Expira em ' : 'Expira em '}{formatarTempo(segundos)}
          </Text>
        </View>

        <View style={styles.qrBox}>
          {qrCodeImage ? (
            <Image source={{ uri: qrCodeImage }} style={styles.qrImage} resizeMode="contain" />
          ) : (
            <View style={styles.qrPlaceholder}>
              <ActivityIndicator color={COLORS.primary} size="large" />
              <Text style={{ marginTop: 12, color: COLORS.textMuted, fontSize: 13 }}>
                Gerando QR Code...
              </Text>
            </View>
          )}
        </View>

        <View style={styles.pixColaBox}>
          <Text style={styles.pixColaLabel}>Pix Copia e Cola</Text>
          <View style={styles.pixColaRow}>
            <Text style={styles.pixColaCodigo} numberOfLines={3} ellipsizeMode="middle">
              {brCode ?? 'Carregando...'}
            </Text>
            <TouchableOpacity
              style={[styles.pixColaBotao, copiando && styles.pixColaBotaoCopied]}
              onPress={onCopiar}
              disabled={!brCode}
            >
              <Ionicons name={copiando ? 'checkmark' : 'copy-outline'} size={20} color="#fff" />
            </TouchableOpacity>
          </View>
          {copiando && <Text style={styles.copiadoText}>✓ Código copiado!</Text>}
        </View>

        <Text style={styles.instrucao}>
          Abra o app do seu banco → Pix → Pagar → Cole o código ou escaneie o QR Code
        </Text>

        <View style={styles.pollingRow}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={styles.pollingText}>Verificando pagamento automaticamente...</Text>
        </View>

        <TouchableOpacity style={styles.btnCancelar} onPress={onCancelar}>
          <Text style={styles.btnCancelarText}>Cancelar</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Componente principal ──────────────────────────────────────────────────────
export default function PremiumScreen({ navigation }) {
  const { perfil, recarregarAuth } = useAuth();

  const [planoSelecionado, setPlano] = useState('mensal');
  const [estado, setEstado]     = useState('idle');   // idle|criando|aguardando|pago|expirado|erro
  const [brCode, setBrCode]     = useState(null);
  const [qrImage, setQrImage]   = useState(null);
  const [correlationID, setCID] = useState(null);
  const [segundos, setSegundos] = useState(0);
  const [copiando, setCopiando] = useState(false);
  const [erroMsg, setErroMsg]   = useState('');

  const pollingRef   = useRef(null);
  const countdownRef = useRef(null);

  useEffect(() => () => {
    clearInterval(pollingRef.current);
    clearInterval(countdownRef.current);
  }, []);

  const _pararTimers = useCallback(() => {
    clearInterval(pollingRef.current);
    clearInterval(countdownRef.current);
  }, []);

  const _getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  };

  const gerarCobranca = async () => {
    setEstado('criando');
    setErroMsg('');
    setBrCode(null);
    setQrImage(null);
    try {
      const token = await _getToken();
      if (!token) {
        const msg = 'Sessão expirada. Faça login novamente.';
        setErroMsg(msg);
        setEstado('erro');
        Alert.alert('Erro de autenticação', msg);
        return;
      }

      const resp = await fetch(`${PREMIUM_API}/premium/criar-cobranca`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plano: planoSelecionado }),
      });
      const dados = await resp.json();

      if (!resp.ok) {
        const msg = dados.erro ?? 'Não foi possível gerar o QR Code.';
        setErroMsg(msg);
        setEstado('erro');
        Alert.alert('Erro ao gerar cobrança', msg);
        return;
      }

      setBrCode(dados.brCode);
      setQrImage(dados.qrCodeImage);
      setCID(dados.correlationID);
      setEstado('aguardando');
      _iniciarPolling(dados.correlationID);
      _iniciarCountdown(dados.expiraSecs ?? 1800);
    } catch (e) {
      const msg = `Sem conexão com o servidor de pagamentos. Tente novamente.\n\nDetalhe: ${e?.message ?? e}`;
      setErroMsg(msg);
      setEstado('erro');
      Alert.alert('Erro de conexão', msg);
    }
  };

  const _iniciarPolling = (cid) => {
    clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const resp = await fetch(`${PREMIUM_API}/premium/status/${cid}`);
        const { status } = await resp.json();
        if (status === 'COMPLETED') {
          _pararTimers();
          setEstado('pago');
          recarregarAuth().catch(() => {});
        } else if (status === 'EXPIRED') {
          _pararTimers();
          setEstado('expirado');
        }
      } catch { /* ignora erros de rede no polling */ }
    }, 5000);
  };

  const _iniciarCountdown = (secs) => {
    setSegundos(secs);
    clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setSegundos(prev => {
        if (prev <= 1) { _pararTimers(); setEstado('expirado'); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const copiarCodigo = async () => {
    if (!brCode) return;
    setCopiando(true);
    await Clipboard.setString(brCode);
    setTimeout(() => setCopiando(false), 2000);
  };

  const cancelar = () => {
    _pararTimers();
    setEstado('idle');
    setBrCode(null);
    setQrImage(null);
    setCID(null);
  };

  const selPlano  = PLANOS.find(p => p.id === planoSelecionado) ?? PLANOS[0];
  const jaPremium = perfil?.premium === true;

  if (estado === 'pago') return <TelaPago onFechar={() => navigation.goBack()} />;

  if (estado === 'aguardando') {
    return (
      <TelaQRCode
        brCode={brCode}
        qrCodeImage={qrImage}
        segundos={segundos}
        copiando={copiando}
        onCopiar={copiarCodigo}
        onCancelar={cancelar}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={['#FFD700', '#FF8C00', '#C2185B']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <TouchableOpacity style={styles.voltarBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={{ fontSize: 52, marginBottom: 8 }}>👑</Text>
          <Text style={styles.headerTitle}>Safimatch Premium</Text>
          <Text style={styles.headerSub}>Conecte-se sem limites</Text>
          <Text style={styles.preco}>{selPlano.preco}{selPlano.periodo}</Text>
        </LinearGradient>

        {jaPremium && (
          <View style={styles.jaPremiumBox}>
            <Ionicons name="checkmark-circle" size={22} color={COLORS.success} />
            <Text style={styles.jaPremiumText}>
              Você já é Premium
              {perfil?.premium_ate
                ? ` – válido até ${new Date(perfil.premium_ate).toLocaleDateString('pt-BR')}`
                : '!'}
            </Text>
          </View>
        )}

        {estado === 'expirado' && (
          <View style={styles.avisoBox}>
            <Ionicons name="warning-outline" size={20} color={COLORS.warning} />
            <Text style={styles.avisoText}>QR Code expirado. Gere um novo para tentar novamente.</Text>
          </View>
        )}

        {estado === 'erro' && erroMsg ? (
          <View style={[styles.avisoBox, { borderLeftColor: COLORS.error }]}>
            <Ionicons name="alert-circle-outline" size={20} color={COLORS.error} />
            <Text style={[styles.avisoText, { color: COLORS.error }]}>{erroMsg}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>O que você ganha:</Text>
          {BENEFICIOS.map((b, i) => (
            <View key={i} style={styles.beneficio}>
              <LinearGradient colors={['#FFD700', '#FF8C00']} style={styles.beneficioIconBg}>
                <Ionicons name={b.icon} size={18} color="#fff" />
              </LinearGradient>
              <Text style={styles.beneficioText}>{b.texto}</Text>
            </View>
          ))}
        </View>

        {!jaPremium && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Escolha seu plano:</Text>
            <View style={styles.planosRow}>
              {PLANOS.map(p => {
                const sel = planoSelecionado === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.planoCard, sel && styles.planoCardSel]}
                    onPress={() => setPlano(p.id)}
                    activeOpacity={0.8}
                  >
                    {p.badge && (
                      <View style={styles.planoBadgeWrap}>
                        <Text style={styles.planoBadgeText}>{p.badge}</Text>
                      </View>
                    )}
                    <Text style={[styles.planoLabel, sel && styles.planoLabelSel]}>{p.label}</Text>
                    <Text style={[styles.planoPreco, sel && styles.planoPrecoSel]}>{p.preco}</Text>
                    {p.sub && <Text style={[styles.planoSub, sel && styles.planoSubSel]}>{p.sub}</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {!jaPremium && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Como funciona:</Text>
            <View style={styles.passo}>
              <View style={styles.passoBola}><Text style={styles.passoNum}>1</Text></View>
              <Text style={styles.passoText}>
                Toque em <Text style={styles.bold}>Pagar com Pix</Text> – um QR Code será gerado
              </Text>
            </View>
            <View style={styles.passo}>
              <View style={styles.passoBola}><Text style={styles.passoNum}>2</Text></View>
              <Text style={styles.passoText}>
                Pague no app do seu banco – <Text style={styles.bold}>qualquer banco</Text>
              </Text>
            </View>
            <View style={styles.passo}>
              <View style={styles.passoBola}><Text style={styles.passoNum}>3</Text></View>
              <Text style={styles.passoText}>
                Confirmação <Text style={styles.bold}>instantânea</Text> – Premium ativa automaticamente ⚡
              </Text>
            </View>
          </View>
        )}

        {!jaPremium && (
          <View style={styles.botoesArea}>
            <TouchableOpacity
              style={[styles.btnGerar, estado === 'criando' && { opacity: 0.7 }]}
              onPress={gerarCobranca}
              disabled={estado === 'criando'}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#FFD700', '#FF8C00']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.btnGerarGradient}
              >
                {estado === 'criando'
                  ? <ActivityIndicator color="#fff" />
                  : <>
                      <Ionicons name="qr-code" size={20} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={styles.btnGerarText}>
                        {estado === 'expirado' ? 'Gerar novo QR Code' : 'Pagar com Pix'}
                      </Text>
                    </>
                }
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnVoltar} onPress={() => navigation.goBack()}>
              <Text style={styles.btnVoltarText}>Voltar</Text>
            </TouchableOpacity>
          </View>
        )}

        {jaPremium && (
          <View style={{ marginHorizontal: 20, marginTop: 20 }}>
            <TouchableOpacity style={styles.btnVoltar} onPress={() => navigation.goBack()}>
              <Text style={styles.btnVoltarText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.rodape}>
          Pagamento seguro via Pix. Ativação instantânea após confirmação bancária.{'\n'}
          Renovação manual – cancele quando quiser.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Estilos ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#fff' },
  scroll: { paddingBottom: 48 },

  header: {
    paddingTop: 20, paddingBottom: 32, paddingHorizontal: 24,
    alignItems: 'center', borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
  },
  voltarBtn:   { position: 'absolute', top: 16, left: 16, padding: 6 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  headerSub:   { fontSize: 14, color: 'rgba(255,255,255,0.85)', marginTop: 4 },
  preco: {
    marginTop: 12, fontSize: 22, fontWeight: '700', color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.18)',
    paddingHorizontal: 20, paddingVertical: 6, borderRadius: 20, overflow: 'hidden',
  },

  headerPequeno: {
    paddingTop: 16, paddingBottom: 20, paddingHorizontal: 24,
    alignItems: 'center', gap: 4,
    borderBottomLeftRadius: 20, borderBottomRightRadius: 20,
  },
  headerTitleSm: { fontSize: 20, fontWeight: '800', color: '#fff' },
  headerSubSm:   { fontSize: 13, color: 'rgba(255,255,255,0.88)' },

  jaPremiumBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#E8F5E9', marginHorizontal: 20, marginTop: 20,
    padding: 14, borderRadius: 12, borderLeftWidth: 4, borderLeftColor: COLORS.success,
  },
  jaPremiumText: { flex: 1, fontSize: 14, color: '#1B5E20', fontWeight: '600' },

  avisoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#FFF8E1', marginHorizontal: 20, marginTop: 20,
    padding: 12, borderRadius: 12, borderLeftWidth: 4, borderLeftColor: COLORS.warning,
  },
  avisoText: { flex: 1, fontSize: 13, color: '#5D4037', lineHeight: 18 },

  section:      { marginHorizontal: 20, marginTop: 28 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: COLORS.primaryDark, marginBottom: 14 },
  beneficio:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  beneficioIconBg: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  beneficioText: { flex: 1, fontSize: 15, color: '#333' },

  passo:    { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  passoBola: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  passoNum:  { color: '#fff', fontWeight: '700', fontSize: 14 },
  passoText: { flex: 1, fontSize: 14, color: '#444', lineHeight: 20 },
  bold:      { fontWeight: '700', color: '#222' },

  botoesArea:       { marginHorizontal: 20, marginTop: 28, gap: 12 },
  btnGerar:         { borderRadius: 14, overflow: 'hidden' },
  btnGerarGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16,
  },
  btnGerarText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  btnVoltar: {
    borderRadius: 14, paddingVertical: 14, alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.primary,
  },
  btnVoltarText:   { color: COLORS.primary, fontSize: 15, fontWeight: '600' },
  btnCancelar:     { marginHorizontal: 20, marginTop: 16, paddingVertical: 12, alignItems: 'center' },
  btnCancelarText: { color: COLORS.textMuted, fontSize: 14 },

  timerBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: 14, marginBottom: 4,
    backgroundColor: '#F5F5F5', marginHorizontal: 20,
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20,
  },
  timerBoxUrgente: { backgroundColor: '#FFEBEE' },
  timerText: { fontSize: 14, fontWeight: '600', color: '#555' },

  qrBox: { alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  qrImage: { width: 220, height: 220, borderRadius: 12, borderWidth: 1, borderColor: '#EEE' },
  qrPlaceholder: {
    width: 220, height: 220, borderRadius: 12, borderWidth: 1, borderColor: '#EEE',
    backgroundColor: '#FAFAFA', alignItems: 'center', justifyContent: 'center',
  },

  pixColaBox: {
    marginHorizontal: 20, marginTop: 16,
    backgroundColor: '#F3E5F5', borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: '#CE93D8',
  },
  pixColaLabel: {
    fontSize: 11, fontWeight: '700', color: COLORS.secondaryDark,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
  },
  pixColaRow:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pixColaCodigo: {
    flex: 1, fontSize: 11, color: '#333', fontFamily: 'monospace', lineHeight: 16,
  },
  pixColaBotao:       { backgroundColor: COLORS.primary, padding: 10, borderRadius: 10 },
  pixColaBotaoCopied: { backgroundColor: COLORS.success },
  copiadoText: { marginTop: 6, fontSize: 12, color: COLORS.success, fontWeight: '600' },

  instrucao: {
    marginHorizontal: 20, marginTop: 14,
    fontSize: 13, color: '#555', textAlign: 'center', lineHeight: 19,
  },
  pollingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 20,
  },
  pollingText: { fontSize: 12, color: COLORS.textMuted },

  pagoTitulo: { fontSize: 26, fontWeight: '800', color: COLORS.primaryDark, textAlign: 'center', marginTop: 16 },
  pagoSub:    { fontSize: 16, color: '#555', textAlign: 'center', marginTop: 10, lineHeight: 24, marginBottom: 32 },

  rodape: {
    marginHorizontal: 20, marginTop: 28,
    fontSize: 12, color: '#AAA', textAlign: 'center', lineHeight: 18,
  },

  planosRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  planoCard: {
    flex: 1, borderRadius: 14, borderWidth: 1.5, borderColor: '#DDD',
    paddingVertical: 14, paddingHorizontal: 4,
    alignItems: 'center', backgroundColor: '#FAFAFA',
    position: 'relative', marginTop: 10,
  },
  planoCardSel: { borderColor: COLORS.primary, backgroundColor: '#FCE4EC' },
  planoBadgeWrap: {
    position: 'absolute', top: -10, left: 0, right: 0, alignItems: 'center',
  },
  planoBadgeText: {
    backgroundColor: COLORS.primary, color: '#fff',
    fontSize: 9, fontWeight: '700',
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 8, overflow: 'hidden', textAlign: 'center',
  },
  planoLabel:    { fontSize: 11, fontWeight: '600', color: '#888', marginBottom: 4 },
  planoLabelSel: { color: COLORS.primaryDark },
  planoPreco:    { fontSize: 15, fontWeight: '800', color: '#333' },
  planoPrecoSel: { color: COLORS.primary },
  planoSub:      { fontSize: 10, color: '#999', marginTop: 3, textAlign: 'center' },
  planoSubSel:   { color: COLORS.secondary },
});
