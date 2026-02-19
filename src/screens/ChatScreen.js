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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS } from '../theme/colors';
import { obterMensagens, enviarMensagem, marcarComoLidas, ouvirMensagens } from '../services/chatService';
import { useAuth } from '../context/AuthContext';

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
  const listaRef = useRef(null);

  // Carrega mensagens iniciais
  useEffect(() => {
    if (!matchId) return;
    const carregar = async () => {
      const { mensagens: lista } = await obterMensagens(matchId);
      setMensagens(lista ?? []);
      if (outraUserId) await marcarComoLidas(matchId, outraUserId);
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
      setTimeout(() => listaRef.current?.scrollToEnd({ animated: true }), 100);
    });
    return cancelar;
  }, [matchId]);

  const enviar = async () => {
    if (!texto.trim() || enviando) return;
    const conteudo = texto.trim();
    setTexto('');
    setEnviando(true);
    try {
      await enviarMensagem(matchId, conteudo);
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
    return (
    <View style={[styles.msgRow, minha && styles.msgRowMinha]}>
      {!minha && (
        <Image
          source={{ uri: conversa?.foto || 'https://randomuser.me/api/portraits/women/68.jpg' }}
          style={styles.msgAvatar}
        />
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
            <Image
              source={{ uri: conversa?.foto || 'https://randomuser.me/api/portraits/women/68.jpg' }}
              style={styles.headerFoto}
            />
            <View style={styles.onlineDot} />
          </View>
          <View>
            <Text style={styles.headerNome}>{conversa?.nome || 'Ana Lima'}</Text>
            <Text style={styles.headerStatus}>Online agora</Text>
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

      {/* Match banner */}
      <View style={styles.matchBanner}>
        <Ionicons name="heart" size={14} color={COLORS.primary} />
        <Text style={styles.matchBannerText}>
          Vocês deram match! Comece a conversa 💜
        </Text>
      </View>

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
          onLayout={() => listaRef.current?.scrollToEnd({ animated: false })}
          showsVerticalScrollIndicator={false}
        />

        {/* Sugestões de resposta rápida */}
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
            onPress={() => Alert.alert('Foto', 'Envio de fotos estará disponível em breve! 📷')}
          >
            <Ionicons name="camera-outline" size={24} color={COLORS.textMuted} />
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
});
