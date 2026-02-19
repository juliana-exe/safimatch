// src/screens/ChatListScreen.js - Safimatch
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS } from '../theme/colors';
import { listarMatches } from '../services/matchService';

export default function ChatListScreen({ navigation }) {
  const [busca, setBusca] = useState('');
  const [matches, setMatches] = useState([]);

  useEffect(() => {
    const carregar = async () => {
      const { matches: lista } = await listarMatches();
      setMatches(lista ?? []);
    };
    carregar();
  }, []);

  // Separa matches sem mensagens (novos) dos que já conversaram
  const matchesNovos = matches.filter(m => !m.ultima_mensagem);
  const conversas = matches.filter(m => !!m.ultima_mensagem);

  const conversasFiltradas = conversas.filter((c) => {
    const nome = c.perfil_dela?.nome ?? '';
    return nome.toLowerCase().includes(busca.toLowerCase());
  });

  const renderConversa = ({ item }) => {
    const parceira = item.perfil_dela ?? {};
    const foto = (parceira.fotos ?? [])[0] ?? 'https://randomuser.me/api/portraits/lego/1.jpg';
    const hora = item.ultima_mensagem_hora
      ? new Date(item.ultima_mensagem_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      : '';
    return (
    <TouchableOpacity
      style={styles.conversaItem}
      onPress={() => navigation.navigate('Chat', { conversa: { ...item, nome: parceira.nome, foto } })}
      activeOpacity={0.75}
    >
      <View style={styles.fotoWrapper}>
        <Image source={{ uri: foto }} style={styles.foto} />
        {parceira.online_agora && <View style={styles.onlineDot} />}
      </View>

      <View style={styles.conversaInfo}>
        <View style={styles.conversaHeader}>
          <Text style={styles.conversaNome}>{parceira.nome}</Text>
          <Text style={[styles.conversaHora, item.msgs_nao_lidas > 0 && styles.conversaHoraAtiva]}>
            {hora}
          </Text>
        </View>
        <View style={styles.conversaRow}>
          <Text
            style={[styles.conversaMensagem, item.msgs_nao_lidas > 0 && styles.conversaMensagemAtiva]}
            numberOfLines={1}
          >
            {item.ultima_mensagem ?? 'Digam olá uma para a outra!'}
          </Text>
          {item.msgs_nao_lidas > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.msgs_nao_lidas}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Conversas</Text>
        <TouchableOpacity
          style={styles.headerIcon}
          onPress={() => Alert.alert('Nova conversa', 'Para iniciar uma conversa, dê match com alguem na tela de Descoberta! 💜')}
        >
          <Ionicons name="create-outline" size={24} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Novos matches */}
      <View style={styles.matchesSection}>
        <Text style={styles.sectionTitle}>
          Novos matches <Text style={styles.matchCount}>{matchesNovos.length}</Text>
        </Text>
        <FlatList
          data={matchesNovos}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: SPACING.lg, gap: 12 }}
          renderItem={({ item }) => {
            const parceira = item.perfil_dela ?? {};
            const foto = (parceira.fotos ?? [])[0] ?? 'https://randomuser.me/api/portraits/lego/1.jpg';
            return (
            <TouchableOpacity
              style={styles.matchItem}
              onPress={() => navigation.navigate('Chat', { conversa: { ...item, nome: parceira.nome, foto } })}
              activeOpacity={0.8}
            >
              <View style={styles.matchFotoWrapper}>
                <Image source={{ uri: foto }} style={styles.matchFoto} />
                <View style={styles.matchCoracao}>
                  <Ionicons name="heart" size={13} color={COLORS.white} />
                </View>
              </View>
              <Text style={styles.matchNome} numberOfLines={1}>{(parceira.nome ?? '').split(' ')[0]}</Text>
            </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Busca */}
      <View style={styles.buscaWrapper}>
        <Ionicons name="search-outline" size={18} color={COLORS.textMuted} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.buscaInput}
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar conversa..."
          placeholderTextColor={COLORS.textMuted}
        />
        {busca.length > 0 && (
          <TouchableOpacity onPress={() => setBusca('')}>
            <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Lista de conversas */}
      {conversasFiltradas.length === 0 ? (
        <View style={styles.vazio}>
          <Ionicons name="chatbubbles-outline" size={56} color={COLORS.border} />
          <Text style={styles.vazioText}>Nenhuma conversa encontrada</Text>
        </View>
      ) : (
        <FlatList
          data={conversasFiltradas}
          keyExtractor={(item) => item.id}
          renderItem={renderConversa}
          ItemSeparatorComponent={() => <View style={styles.separador} />}
          contentContainerStyle={{ paddingBottom: SPACING.xl }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
  },
  headerTitle: { fontSize: 26, fontWeight: '800', color: COLORS.textPrimary },
  headerIcon: { padding: 4 },

  matchesSection: { marginBottom: SPACING.md },
  sectionTitle: {
    fontSize: 14, fontWeight: '700', color: COLORS.textSecondary,
    paddingHorizontal: SPACING.lg, marginBottom: 12,
  },
  matchCount: {
    color: COLORS.white, backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full, paddingHorizontal: 6, paddingVertical: 1,
    fontSize: 12,
  },
  matchItem: { alignItems: 'center', gap: 6 },
  matchFotoWrapper: { position: 'relative' },
  matchFoto: {
    width: 66, height: 66, borderRadius: 33,
    borderWidth: 2.5, borderColor: COLORS.primary,
  },
  matchCoracao: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: COLORS.primary,
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: COLORS.white,
  },
  matchNome: { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary, maxWidth: 70, textAlign: 'center' },

  buscaWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.lg, marginBottom: SPACING.sm,
    borderRadius: RADIUS.md, paddingHorizontal: 14, height: 44,
    borderWidth: 1, borderColor: COLORS.border,
  },
  buscaInput: { flex: 1, fontSize: 14, color: COLORS.textPrimary },

  conversaItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: SPACING.lg, paddingVertical: 14,
    backgroundColor: COLORS.white,
  },
  fotoWrapper: { position: 'relative' },
  foto: { width: 56, height: 56, borderRadius: 28 },
  onlineDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 13, height: 13, borderRadius: 7,
    backgroundColor: '#4CAF50', borderWidth: 2, borderColor: COLORS.white,
  },
  conversaInfo: { flex: 1, gap: 4 },
  conversaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  conversaNome: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  conversaHora: { fontSize: 11, color: COLORS.textMuted },
  conversaHoraAtiva: { color: COLORS.primary, fontWeight: '700' },
  conversaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  conversaMensagem: { flex: 1, fontSize: 13, color: COLORS.textMuted, marginRight: 8 },
  conversaMensagemAtiva: { color: COLORS.textPrimary, fontWeight: '600' },
  badge: {
    backgroundColor: COLORS.primary, minWidth: 20, height: 20,
    borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: { fontSize: 11, fontWeight: '800', color: COLORS.white },

  separador: { height: 1, backgroundColor: COLORS.border, marginLeft: 88 },
  vazio: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  vazioText: { fontSize: 15, color: COLORS.textMuted },
});
