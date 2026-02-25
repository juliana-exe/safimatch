// src/screens/ChatScreen.js - Safimatch
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS } from '../theme/colors';
import { obterMensagens, enviarMensagem, marcarComoLidas, ouvirMensagens, enviarFotoMensagem, marcarFotoVisualizadaOnce } from '../services/chatService';
import { uploadFotoChat } from '../services/storageService';
import { useAuth } from '../context/AuthContext';
import AvatarPessoa from '../components/AvatarPessoa';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function ChatScreen({ navigation, route }) {
  const { conversa } = route.params || {};
  const { usuario } = useAuth();
  const meuId = usuario?.id;
  const matchId = conversa?.id;
  // ID da outra usuária (para marcar mensagens dela como lidas)
  const outraUserId = conversa?.perfil_dela?.user_id;
  const [mensagens, setMensagens] = useState([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [modalFotoUrl, setModalFotoUrl] = useState(null);
  const [modalViewOnce, setModalViewOnce] = useState(false);
  const [modalCountdown, setModalCountdown] = useState(0);
  const listaRef = useRef(null);
  const countdownRef = useRef(null);

  const fecharModal = () => {
    setModalFotoUrl(null);
    setModalViewOnce(false);
    setModalCountdown(0);
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  };

  // Limpa countdown ao desmontar
  useEffect(() => () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  // Carrega mensagens iniciais
  useEffect(() => {
    if (!matchId) return;
    const carregar = async () => {
      const { mensagens: lista } = await obterMensagens(matchId);
      setMensagens(lista ?? []);
      if (outraUserId) await marcarComoLidas(matchId, outraUserId);
      // Garante scroll ao fim após render das mensagens
      setTimeout(() => listaRef.current?.scrollToEnd({ animated: false }), 150);
    };
    carregar();
  }, [matchId]);

  // Escuta mensagens em tempo real
  useEffect(() => {
    if (!matchId) return;
    const cancelar = ouvirMensagens(matchId, (nova) => {
      setMensagens(prev => {
        if (prev.find(m => m.id === nova.id)) return prev;
        return [...prev, nova];
      });
      // Marca como lida se a mensagem for da outra usuária
      if (nova.de_user_id !== meuId && outraUserId) {
        marcarComoLidas(matchId, outraUserId);
      }
      setTimeout(() => listaRef.current?.scrollToEnd({ animated: true }), 100);
    });
    return cancelar;
  }, [matchId]);

  // --- Funções de foto no chat -------------------------------------------

  const _pickFoto = async (useCamera = false, viewOnce = false) => {
    if (enviandoFoto) return;
    try {
      let perm;
      if (useCamera) {
        perm = await ImagePicker.requestCameraPermissionsAsync();
      } else {
        perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      }
      if (perm.status !== 'granted') {
        Alert.alert(
          'Permissão necessária',
          `Permita o acesso à ${useCamera ? 'câmera' : 'galeria'} nas configurações.`
        );
        return;
      }

      const launch = useCamera
        ? ImagePicker.launchCameraAsync
        : ImagePicker.launchImageLibraryAsync;

      const resultado = await launch({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.85,
        ...(useCamera && viewOnce ? { saveToLibrary: false } : {}),
      });
      if (resultado.canceled) return;

      setEnviandoFoto(true);
      const upload = await uploadFotoChat(usuario?.id, matchId, resultado.assets[0].uri);
      if (!upload.sucesso) {
        Alert.alert('Erro', upload.erro || 'Não foi possível enviar a foto.');
        return;
      }
      const res = await enviarFotoMensagem(matchId, upload.url, viewOnce);
      if (res.sucesso && res.mensagem) {
        setMensagens(prev => {
          if (prev.find(m => m.id === res.mensagem.id)) return prev;
          return [...prev, res.mensagem];
        });
        setTimeout(() => listaRef.current?.scrollToEnd({ animated: true }), 100);
      }
    } catch (e) {
      console.warn('Erro ao enviar foto:', e);
      Alert.alert('Erro', 'Falha ao enviar foto.');
    } finally {
      setEnviandoFoto(false);
    }
  };

  const escolherFotoParaEnviar = () => {
    Alert.alert(
      'Enviar foto',
      'Escolha uma opção',
      [
        { text: '🖼️  Da galeria',      onPress: () => _pickFoto(false, false) },
        { text: '📷  Tirar foto agora', onPress: () => _pickFoto(true,  false) },
        {
          text: '🔒  Foto única',
          onPress: () =>
            Alert.alert(
              'Foto de visualização única',
              'A destinatária só poderá ver uma vez.',
              [
                { text: '🖼️  Da galeria',      onPress: () => _pickFoto(false, true) },
                { text: '📷  Tirar foto agora', onPress: () => _pickFoto(true,  true) },
                { text: 'Cancelar', style: 'cancel' },
              ]
            ),
        },
        { text: 'Cancelar', style: 'cancel' },
      ]
    );
  };

  const verFotoUnica = async (item) => {
    await marcarFotoVisualizadaOnce(item.id);
    setMensagens(prev =>
      prev.map(m => m.id === item.id ? { ...m, view_once_visto: true } : m)
    );
    setModalFotoUrl(item.foto_url);
    setModalViewOnce(true);
    let secs = 10;
    setModalCountdown(secs);
    countdownRef.current = setInterval(() => {
      secs -= 1;
      setModalCountdown(secs);
      if (secs <= 0) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
        setModalFotoUrl(null);
        setModalViewOnce(false);
        setModalCountdown(0);
      }
    }, 1000);
  };

  // -------------------------------------------------------------------------

  const enviar = async () => {
    if (!texto.trim() || enviando) return;
    const conteudo = texto.trim();
    setTexto('');
    setEnviando(true);
    try {
      const res = await enviarMensagem(matchId, conteudo);
      if (res.sucesso && res.mensagem) {
        setMensagens(prev => {
          // Evita duplicidade caso o Realtime já tenha inserido
          if (prev.find(m => m.id === res.mensagem.id)) return prev;
          return [...prev, res.mensagem];
        });
      }
      setTimeout(() => listaRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      console.warn('Erro ao enviar:', e);
    } finally {
      setEnviando(false);
    }
  };

  const renderMensagem = ({ item }) => {
    const minha = item.de_user_id === meuId;
    const hora = item.criado_em
      ? new Date(item.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      : '';

    // ---- Foto normal -------------------------------------------------------
    if (item.tipo === 'foto' && item.foto_url) {
      return (
        <View style={[styles.msgRow, minha && styles.msgRowMinha]}>
          {!minha && (
            <AvatarPessoa uri={conversa?.foto} style={styles.msgAvatar} />
          )}
          <TouchableOpacity
            onPress={() => setModalFotoUrl(item.foto_url)}
            style={[styles.fotoContainer, minha ? styles.fotoContainerMinha : styles.fotoContainerDela]}
          >
            <Image source={{ uri: item.foto_url }} style={styles.fotoImgMensagem} resizeMode="cover" />
            <Text style={[styles.msgHora, styles.fotoHora, minha && styles.msgHoraMinha]}>
              {hora}{minha && ' ✓✓'}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    // ---- Foto única --------------------------------------------------------
    if (item.tipo === 'foto_unica') {
      // Fallback: foto_url ausente (SELECT antigo sem o campo) → exibe expirada
      if (!item.foto_url) {
        return (
          <View style={[styles.msgRow, minha && styles.msgRowMinha]}>
            {!minha && (
              <AvatarPessoa uri={conversa?.foto} style={styles.msgAvatar} />
            )}
            <View style={styles.fotoUnicaExpirada}>
              <Ionicons name="eye-off-outline" size={16} color={COLORS.textMuted} />
              <Text style={styles.fotoUnicaExpiradaText}>Foto única</Text>
            </View>
          </View>
        );
      }
    }
    if (item.tipo === 'foto_unica' && item.foto_url) {
      // Remetente: nunca mostra a imagem novamente — apenas confirmação de envio
      if (minha) {
        return (
          <View style={[styles.msgRow, styles.msgRowMinha]}>
            <View style={[styles.fotoUnicaPendente, styles.fotoUnicaEnviada]}>
              <Ionicons name="eye-off-outline" size={20} color="#fff" />
              <View>
                <Text style={styles.fotoUnicaPendenteText}>Foto única · Enviada</Text>
                <Text style={styles.fotoUnicaEnviadaHora}>{hora} ✓✓</Text>
              </View>
            </View>
          </View>
        );
      }
      // Destinatária: ainda não viu
      if (!item.view_once_visto) {
        return (
          <View style={[styles.msgRow]}>
            <AvatarPessoa uri={conversa?.foto} style={styles.msgAvatar} />
            <TouchableOpacity
              style={styles.fotoUnicaPendente}
              onPress={() => verFotoUnica(item)}
            >
              <Ionicons name="camera" size={20} color="#fff" />
              <Text style={styles.fotoUnicaPendenteText}>Toque para ver · Foto única</Text>
            </TouchableOpacity>
          </View>
        );
      }
      // Destinatária: já viu
      return (
        <View style={[styles.msgRow]}>
          <AvatarPessoa uri={conversa?.foto} style={styles.msgAvatar} />
          <View style={styles.fotoUnicaExpirada}>
            <Ionicons name="eye-off-outline" size={16} color={COLORS.textMuted} />
            <Text style={styles.fotoUnicaExpiradaText}>Foto expirada</Text>
          </View>
        </View>
      );
    }

    // ---- Texto normal ------------------------------------------------------
    return (
    <View style={[styles.msgRow, minha && styles.msgRowMinha]}>
      {!minha && (
        <AvatarPessoa uri={conversa?.foto} style={styles.msgAvatar} />
      )}
      <View style={[styles.bubble, minha ? styles.bubbleMinha : styles.bubbleDela]}>
        <Text style={[styles.bubbleText, minha && styles.bubbleTextMinha]}>
          {item.conteudo}
        </Text>
        <Text style={[styles.msgHora, minha && styles.msgHoraMinha]}>
          {hora}{minha && ' ✓✓'}
        </Text>
      </View>
    </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.headerPerfil}>
          <View style={styles.headerFotoWrapper}>
            <AvatarPessoa uri={conversa?.foto} style={styles.headerFoto} />
            {conversa?.perfil_dela?.online_agora && <View style={styles.onlineDot} />}
          </View>
          <View>
            <Text style={styles.headerNome}>{conversa?.nome || 'Ana Lima'}</Text>
            {conversa?.perfil_dela?.online_agora
              ? <Text style={styles.headerStatus}>Online agora</Text>
              : <Text style={styles.headerStatusOffline}>Offline</Text>
            }
          </View>
        </TouchableOpacity>

        <View style={styles.headerAcoes}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => Alert.alert('Videochamada', 'Chamadas de vídeo estarão disponíveis em breve! 💜')}
          >
            <Ionicons name="videocam-outline" size={22} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() =>
              Alert.alert('Opções', '', [
                { text: 'Bloquear usuária', style: 'destructive', onPress: () => Alert.alert('Em breve', 'Bloqueio disponível em breve.') },
                { text: 'Reportar', onPress: () => Alert.alert('Reportar', 'Envie um e-mail para suporte@safimatch.com') },
                { text: 'Cancelar', style: 'cancel' },
              ])
            }
          >
            <Ionicons name="ellipsis-vertical" size={22} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Match banner — aparece apenas antes da primeira mensagem */}
      {mensagens.length === 0 && (
        <View style={styles.matchBanner}>
          <Ionicons name="heart" size={14} color={COLORS.primary} />
          <Text style={styles.matchBannerText}>
            Vocês deram match! Comece a conversa 💜
          </Text>
        </View>
      )}

      {/* Mensagens */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={listaRef}
          data={mensagens}
          keyExtractor={(item) => item.id}
          renderItem={renderMensagem}
          contentContainerStyle={styles.lista}
          showsVerticalScrollIndicator={false}
        />

        {/* Sugestões de resposta rápida — só antes da primeira mensagem */}
        {mensagens.length === 0 && (
          <View style={styles.sugestoesRow}>
            {['Oi! 😊', 'Que legal!', 'Me conta mais...'].map((s) => (
              <TouchableOpacity
                key={s}
                style={styles.sugestao}
                onPress={() => setTexto(s)}
              >
                <Text style={styles.sugestaoText}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Input de mensagem */}
        <View style={styles.inputArea}>
          <TouchableOpacity
            style={styles.inputIconBtn}
            onPress={() => {
              const emojis = ['😊', '💜', '😂', '🥰', '😍', '🤩', '😘', '👏', '🎉', '❤️'];
              const rand = emojis[Math.floor(Math.random() * emojis.length)];
              setTexto(prev => prev + rand);
            }}
          >
            <Ionicons name="happy-outline" size={24} color={COLORS.textMuted} />
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            value={texto}
            onChangeText={setTexto}
            placeholder="Mensagem..."
            placeholderTextColor={COLORS.textMuted}
            multiline
            maxLength={500}
          />

          <TouchableOpacity
            style={styles.inputIconBtn}
            onPress={escolherFotoParaEnviar}
            disabled={enviandoFoto}
          >
            {enviandoFoto
              ? <ActivityIndicator size="small" color={COLORS.primary} />
              : <Ionicons name="camera-outline" size={24} color={enviandoFoto ? COLORS.border : COLORS.primary} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sendBtn, texto.trim() && styles.sendBtnAtivo]}
            onPress={enviar}
            disabled={!texto.trim()}
          >
            <Ionicons
              name="send"
              size={18}
              color={texto.trim() ? COLORS.white : COLORS.textMuted}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      {/* Modal foto em tela cheia */}
      <Modal
        visible={!!modalFotoUrl}
        transparent
        animationType="fade"
        onRequestClose={fecharModal}
      >
        <View style={styles.modalBg}>
          {modalViewOnce && (
            <View style={styles.modalCountdownBadge}>
              <Ionicons name="eye-off-outline" size={14} color="#fff" />
              <Text style={styles.modalCountdownText}>Fechando em {modalCountdown}s</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.modalCloseArea}
            onPress={fecharModal}
            onLongPress={() => {}}
            delayLongPress={100}
            activeOpacity={1}
          >
            <Image
              source={{ uri: modalFotoUrl }}
              style={styles.modalImg}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.modalCloseBtn} onPress={fecharModal}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 10,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    gap: 8,
  },
  backBtn: { padding: 4 },
  headerPerfil: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerFotoWrapper: { position: 'relative' },
  headerFoto: { width: 44, height: 44, borderRadius: 22 },
  onlineDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 11, height: 11, borderRadius: 6,
    backgroundColor: '#4CAF50', borderWidth: 2, borderColor: COLORS.white,
  },
  headerNome: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  headerStatus: { fontSize: 11, color: '#4CAF50', fontWeight: '600' },
  headerStatusOffline: { fontSize: 11, color: COLORS.textMuted, fontWeight: '500' },
  headerAcoes: { flexDirection: 'row', gap: 4 },
  headerIconBtn: { padding: 6 },

  matchBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FCE4EC',
    paddingHorizontal: SPACING.lg, paddingVertical: 8,
  },
  matchBannerText: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },

  lista: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, gap: 8 },

  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, maxWidth: '80%' },
  msgRowMinha: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  msgAvatar: { width: 30, height: 30, borderRadius: 15, marginBottom: 4 },

  bubble: {
    borderRadius: RADIUS.lg,
    paddingHorizontal: 14, paddingVertical: 9,
    maxWidth: '100%',
  },
  bubbleDela: {
    backgroundColor: COLORS.white,
    borderBottomLeftRadius: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3, elevation: 2,
  },
  bubbleMinha: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  bubbleText: { fontSize: 14, color: COLORS.textPrimary, lineHeight: 20 },
  bubbleTextMinha: { color: COLORS.white },
  msgHora: { fontSize: 10, color: COLORS.textMuted, marginTop: 3, textAlign: 'right' },
  msgHoraMinha: { color: 'rgba(255,255,255,0.7)' },

  sugestoesRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: SPACING.md,
    paddingVertical: 8,
  },
  sugestao: {
    borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: COLORS.white,
    borderWidth: 1.5, borderColor: COLORS.border,
  },
  sugestaoText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },

  inputArea: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 6,
    paddingHorizontal: SPACING.md, paddingVertical: 10,
    backgroundColor: COLORS.white,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  inputIconBtn: { padding: 6, marginBottom: 4 },
  input: {
    flex: 1, fontSize: 14, color: COLORS.textPrimary,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.xl, paddingHorizontal: 16, paddingVertical: 10,
    maxHeight: 100,
    borderWidth: 1, borderColor: COLORS.border,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.border, marginBottom: 2,
  },
  sendBtnAtivo: { backgroundColor: COLORS.primary },

  // ---- estilos de foto ---------------------------------------------------
  fotoContainer: {
    borderRadius: RADIUS.lg, overflow: 'hidden', maxWidth: 220,
  },
  fotoContainerMinha: { borderBottomRightRadius: 4 },
  fotoContainerDela: { borderBottomLeftRadius: 4 },
  fotoImgMensagem: { width: 200, height: 240, borderRadius: RADIUS.lg },
  fotoHora: {
    position: 'absolute', bottom: 6, right: 8,
    color: 'rgba(255,255,255,0.9)',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // Foto única – remetente (balão bloqueado, sem imagem)
  fotoUnicaSenderWrapper: { position: 'relative', maxWidth: 200 },
  fotoUnicaEnviada: {
    borderBottomLeftRadius: RADIUS.lg,
    borderBottomRightRadius: 4,
    opacity: 0.85,
  },
  fotoUnicaEnviadaHora: {
    fontSize: 10, color: 'rgba(255,255,255,0.65)', marginTop: 3,
  },
  fotoUnicaBadgeSender: {
    position: 'absolute', top: 8, left: 8,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3,
  },
  fotoUnicaBadgeText: { fontSize: 10, color: '#fff', fontWeight: '700' },

  // Foto única – pendente (destinatária)
  fotoUnicaPendente: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg, borderBottomLeftRadius: 4,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  fotoUnicaPendenteText: { fontSize: 13, color: '#fff', fontWeight: '700' },

  // Foto única – expirada
  fotoUnicaExpirada: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.border,
    borderRadius: RADIUS.lg, borderBottomLeftRadius: 4,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  fotoUnicaExpiradaText: { fontSize: 13, color: COLORS.textMuted },

  // Countdown de foto única no modal
  modalCountdownBadge: {
    position: 'absolute', top: 52, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 7,
    zIndex: 10,
  },
  modalCountdownText: { fontSize: 13, color: '#fff', fontWeight: '700' },

  // Modal tela cheia
  modalBg: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.95)',
    alignItems: 'center', justifyContent: 'center',
  },
  modalCloseArea: { width: SCREEN_W, height: SCREEN_H, alignItems: 'center', justifyContent: 'center' },
  modalImg: { width: SCREEN_W, height: SCREEN_H * 0.8 },
  modalCloseBtn: {
    position: 'absolute', top: 50, right: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 20, padding: 6,
  },
});
