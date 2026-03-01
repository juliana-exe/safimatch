// src/screens/NotificacoesScreen.js - Safimatch
// Tela de notificações: novos matches e mensagens não lidas
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, RADIUS } from '../theme/colors';
import { listarMatches } from '../services/matchService';
import AvatarPessoa from '../components/AvatarPessoa';

// Formata tempo relativo: "agora", "5min", "2h", "3d"
function _tempoRelativo(iso) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)  return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function ItemNotificacao({ item, onPress }) {
  const ehNovo   = !item.ultima_mensagem;
  const naoLidas = item.msgs_nao_lidas ?? 0;

  return (
    <TouchableOpacity style={styles.item} onPress={onPress} activeOpacity={0.75}>
      {/* Avatar */}
      <View style={styles.avatarWrap}>
        <AvatarPessoa
          uri={item.perfil_dela?.foto_principal}
          style={styles.avatar}
        />
        {ehNovo && <View style={styles.ponto} />}
      </View>

      {/* Texto */}
      <View style={styles.itemTexto}>
        <View style={styles.itemLinha}>
          <Text style={styles.nome} numberOfLines={1}>
            {item.perfil_dela?.nome ?? 'Usuária'}
          </Text>
          <Text style={styles.tempo}>
            {_tempoRelativo(ehNovo ? item.match_em : item.ultima_mensagem_hora)}
          </Text>
        </View>
        <Text style={[styles.preview, naoLidas > 0 && styles.previewNaoLida]} numberOfLines={1}>
          {ehNovo
            ? '💜 É um match! Diga olá!'
            : naoLidas > 0
              ? item.ultima_mensagem
              : item.ultima_mensagem ?? 'Sem mensagens ainda'}
        </Text>
      </View>

      {/* Badge de não lidas */}
      {naoLidas > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{naoLidas > 9 ? '9+' : naoLidas}</Text>
        </View>
      )}
      {naoLidas === 0 && <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />}
    </TouchableOpacity>
  );
}

export default function NotificacoesScreen({ navigation }) {
  const [items,      setItems]      = useState([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = async () => {
    setCarregando(true);
    const { matches } = await listarMatches();
    const lista = matches ?? [];

    // Ordena: não lidas > novos matches > resto por hora
    lista.sort((a, b) => {
      const nla = a.msgs_nao_lidas ?? 0;
      const nlb = b.msgs_nao_lidas ?? 0;
      if (nlb !== nla) return nlb - nla;                  // mais não lidas primeiro
      const aNovo = !a.ultima_mensagem ? 1 : 0;
      const bNovo = !b.ultima_mensagem ? 1 : 0;
      if (bNovo !== aNovo) return bNovo - aNovo;          // matches novos antes
      const ta = a.ultima_mensagem_hora ?? a.match_em ?? '';
      const tb = b.ultima_mensagem_hora ?? b.match_em ?? '';
      return tb.localeCompare(ta);                        // mais recente primeiro
    });

    setItems(lista);
    setCarregando(false);
  };

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [])
  );

  const abrirChat = (match) => {
    navigation.navigate('Chat', {
      matchId: match.match_id,
      nome: match.perfil_dela?.nome,
      foto: match.perfil_dela?.foto_principal,
      userId: match.perfil_dela?.user_id,
    });
  };

  const totalNaoLidas = items.reduce((s, m) => s + (m.msgs_nao_lidas ?? 0), 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <LinearGradient colors={[COLORS.primary, '#7B1FA2']} style={styles.header}>
        <Text style={styles.headerTitulo}>Notificações</Text>
        {totalNaoLidas > 0 && (
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{totalNaoLidas} não lida{totalNaoLidas > 1 ? 's' : ''}</Text>
          </View>
        )}
      </LinearGradient>

      {carregando ? (
        <View style={styles.loading}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.vazio}>
          <Ionicons name="notifications-off-outline" size={64} color={COLORS.textMuted} />
          <Text style={styles.vazioTitulo}>Sem notificações</Text>
          <Text style={styles.vazioSub}>Quando você tiver matches ou mensagens, elas aparecerão aqui.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={m => m.match_id}
          renderItem={({ item }) => (
            <ItemNotificacao item={item} onPress={() => abrirChat(item)} />
          )}
          ItemSeparatorComponent={() => <View style={styles.separador} />}
          contentContainerStyle={{ paddingBottom: 24 }}
          onRefresh={carregar}
          refreshing={carregando}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: COLORS.background ?? '#FFF8FA' },
  header:          { paddingHorizontal: SPACING.lg, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitulo:    { fontSize: 20, fontWeight: '700', color: '#fff' },
  headerBadge:     { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  headerBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  vazio:       { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  vazioTitulo: { fontSize: 18, fontWeight: '700', color: COLORS.textDark ?? '#222', marginTop: 16, marginBottom: 8 },
  vazioSub:    { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },

  item:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: 14, backgroundColor: '#fff' },
  avatarWrap:  { position: 'relative', marginRight: 14 },
  avatar:      { width: 52, height: 52, borderRadius: 26 },
  ponto:       { position: 'absolute', bottom: 1, right: 1, width: 13, height: 13, borderRadius: 7, backgroundColor: COLORS.primary, borderWidth: 2, borderColor: '#fff' },

  itemTexto:      { flex: 1, marginRight: 8 },
  itemLinha:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  nome:           { fontSize: 15, fontWeight: '700', color: COLORS.textDark ?? '#222', flex: 1, marginRight: 6 },
  tempo:          { fontSize: 12, color: COLORS.textMuted },
  preview:        { fontSize: 13, color: COLORS.textMuted },
  previewNaoLida: { color: COLORS.textDark ?? '#222', fontWeight: '600' },

  badge:     { backgroundColor: COLORS.primary, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  separador: { height: 1, backgroundColor: COLORS.border ?? '#F0E4EC', marginLeft: 80 },
});
