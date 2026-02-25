// src/screens/AdminVerificacoesScreen.js - Safimatch
// Painel de moderação: aprova ou rejeita selfies de verificação.
// Acesso: apenas usuárias com role admin (chame com service_role ou perfil.admin = true).

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, ActivityIndicator, Alert, TextInput, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, RADIUS } from '../theme/colors';
import { supabase } from '../config/supabase';
import { useAuth } from '../context/AuthContext';
import AvatarPessoa from '../components/AvatarPessoa';

export default function AdminVerificacoesScreen({ navigation }) {
  const { perfil } = useAuth();
  const [lista, setLista]           = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro]         = useState('pendente'); // pendente | aprovada | rejeitada
  const [modalItem, setModalItem]   = useState(null);       // item em análise
  const [obsRejeicao, setObsRejeicao] = useState('');
  const [processando, setProcessando] = useState(false);

  // Guarda de acesso
  if (!perfil?.admin) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Ionicons name="lock-closed" size={48} color={COLORS.border} />
          <Text style={{ color: COLORS.textMuted, fontSize: 16 }}>Acesso restrito</Text>
        </View>
      </SafeAreaView>
    );
  }

  const carregar = async () => {
    setCarregando(true);
    const { data, error } = await supabase
      .from('perfis')
      .select('user_id, nome, foto_principal, selfie_verificacao_url, codigo_verificacao, status_verificacao, verificacao_enviada_em, verificacao_obs')
      .eq('status_verificacao', filtro)
      .order('verificacao_enviada_em', { ascending: true });

    if (!error) setLista(data ?? []);
    setCarregando(false);
  };

  useFocusEffect(useCallback(() => { carregar(); }, [filtro]));

  // ─── Ações ────────────────────────────────────────────────────────────────
  const aprovar = async (userId) => {
    setProcessando(true);
    const { error } = await supabase.rpc('admin_aprovar_verificacao', { p_user_id: userId });
    setProcessando(false);
    if (error) { Alert.alert('Erro', error.message); return; }
    setModalItem(null);
    carregar();
  };

  const rejeitar = async (userId) => {
    if (!obsRejeicao.trim()) {
      Alert.alert('Motivo obrigatório', 'Informe o motivo da rejeição para a usuária.');
      return;
    }
    setProcessando(true);
    const { error } = await supabase.rpc('admin_rejeitar_verificacao', {
      p_user_id: userId,
      p_obs: obsRejeicao.trim(),
    });
    setProcessando(false);
    if (error) { Alert.alert('Erro', error.message); return; }
    setModalItem(null);
    setObsRejeicao('');
    carregar();
  };

  // ─── Render item ──────────────────────────────────────────────────────────
  const renderItem = ({ item }) => {
    const foto = item.foto_principal ?? null;
    const enviada = item.verificacao_enviada_em
      ? new Date(item.verificacao_enviada_em).toLocaleString('pt-BR')
      : '—';
    return (
      <TouchableOpacity style={styles.card} onPress={() => { setModalItem(item); setObsRejeicao(''); }} activeOpacity={0.85}>
        <AvatarPessoa uri={foto} style={styles.avatarFoto} />
        <View style={styles.cardInfo}>
          <Text style={styles.cardNome}>{item.nome}</Text>
          <Text style={styles.cardSub}>Enviado em: {enviada}</Text>
          {item.verificacao_obs ? <Text style={styles.cardObs}>Obs: {item.verificacao_obs}</Text> : null}
        </View>
        <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.btnVoltar}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitulo}>Moderação de verificações</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Filtros de status */}
      <View style={styles.filtros}>
        {['pendente', 'aprovada', 'rejeitada'].map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filtroBt, filtro === f && styles.filtroBtAtivo]}
            onPress={() => setFiltro(f)}
          >
            <Text style={[styles.filtroText, filtro === f && styles.filtroTextAtivo]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {carregando
        ? <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} size="large" />
        : lista.length === 0
          ? <View style={styles.vazio}>
              <Ionicons name="checkmark-done-circle-outline" size={56} color={COLORS.border} />
              <Text style={styles.vazioText}>Nenhuma verificação {filtro}</Text>
            </View>
          : <FlatList
              data={lista}
              keyExtractor={i => i.user_id}
              renderItem={renderItem}
              contentContainerStyle={{ padding: SPACING.md, gap: 10 }}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            />
      }

      {/* Modal de análise */}
      <Modal visible={!!modalItem} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitulo}>Analisar verificação</Text>
            <Text style={styles.modalNome}>{modalItem?.nome}</Text>
            <Text style={styles.modalCodigo}>Código: {modalItem?.codigo_verificacao}</Text>

            {/* Selfie */}
            {modalItem?.selfie_verificacao_url ? (
              <Image
                source={{ uri: modalItem.selfie_verificacao_url }}
                style={styles.selfieImg}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.selfieImg, styles.semSelfie]}>
                <Ionicons name="image-outline" size={48} color={COLORS.border} />
                <Text style={{ color: COLORS.textMuted, fontSize: 13 }}>Sem imagem</Text>
              </View>
            )}

            {/* Instruções para o moderador */}
            <Text style={styles.instrucao}>
              ✅ Verifique se o rosto está visível e o código <Text style={{ fontWeight: '800' }}>{modalItem?.codigo_verificacao}</Text> aparece claramente.
            </Text>

            {/* Campo de observação (rejeição) */}
            <TextInput
              style={styles.obsInput}
              placeholder="Motivo da rejeição (obrigatório para rejeitar)"
              placeholderTextColor={COLORS.textMuted}
              value={obsRejeicao}
              onChangeText={setObsRejeicao}
              multiline
            />

            <View style={styles.modalBotoes}>
              <TouchableOpacity
                style={styles.btnRejeitar}
                onPress={() => rejeitar(modalItem?.user_id)}
                disabled={processando}
              >
                {processando
                  ? <ActivityIndicator color={COLORS.white} />
                  : <Text style={styles.btnRejeitarText}>✕ Rejeitar</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnAprovar}
                onPress={() => aprovar(modalItem?.user_id)}
                disabled={processando}
              >
                {processando
                  ? <ActivityIndicator color={COLORS.white} />
                  : <Text style={styles.btnAprovarText}>✓ Aprovar</Text>
                }
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={() => setModalItem(null)} style={styles.btnFecharModal}>
              <Text style={{ color: COLORS.textMuted, fontSize: 14 }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  btnVoltar: { padding: 8 },
  headerTitulo: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },

  filtros: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  filtroBt: {
    flex: 1, paddingVertical: 8, borderRadius: RADIUS.full,
    borderWidth: 1.5, borderColor: COLORS.border, alignItems: 'center',
  },
  filtroBtAtivo: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filtroText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  filtroTextAtivo: { color: COLORS.white },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.white, borderRadius: RADIUS.lg,
    padding: SPACING.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  avatarFoto: { width: 50, height: 50, borderRadius: 25 },
  cardInfo: { flex: 1, gap: 3 },
  cardNome: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  cardSub: { fontSize: 12, color: COLORS.textMuted },
  cardObs: { fontSize: 12, color: COLORS.dislike },

  vazio: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  vazioText: { fontSize: 15, color: COLORS.textMuted },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.xl + 4, borderTopRightRadius: RADIUS.xl + 4,
    padding: SPACING.lg, gap: 12, paddingBottom: 36,
  },
  modalTitulo: { fontSize: 17, fontWeight: '800', color: COLORS.textPrimary, textAlign: 'center' },
  modalNome: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  modalCodigo: { fontSize: 14, color: COLORS.textSecondary },
  selfieImg: {
    width: '100%', height: 280, borderRadius: RADIUS.lg,
    backgroundColor: COLORS.border,
  },
  semSelfie: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  instrucao: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },
  obsInput: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md,
    padding: 12, fontSize: 14, color: COLORS.textPrimary, minHeight: 60,
    textAlignVertical: 'top',
  },
  modalBotoes: { flexDirection: 'row', gap: 12 },
  btnRejeitar: {
    flex: 1, paddingVertical: 14, borderRadius: RADIUS.full,
    backgroundColor: COLORS.dislike, alignItems: 'center', justifyContent: 'center',
  },
  btnRejeitarText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },
  btnAprovar: {
    flex: 1, paddingVertical: 14, borderRadius: RADIUS.full,
    backgroundColor: '#1976D2', alignItems: 'center', justifyContent: 'center',
  },
  btnAprovarText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },
  btnFecharModal: { alignItems: 'center', paddingVertical: 4 },
});
