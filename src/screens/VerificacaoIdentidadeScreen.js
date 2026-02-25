// src/screens/VerificacaoIdentidadeScreen.js - Safimatch
// Verificação de identidade por selfie com código aleatório.
// Fluxo: gera código → instruções → câmera → upload → aguarda moderação.

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Image, ScrollView, ActivityIndicator, Alert, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, SPACING, RADIUS } from '../theme/colors';
import { supabase } from '../config/supabase';
import { useAuth } from '../context/AuthContext';

// ─── Gera código único tipo "SAFI-4829" ──────────────────────────────────────
function gerarCodigo() {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `SAFI-${n}`;
}

// ─── Status Map ───────────────────────────────────────────────────────────────
const STATUS_INFO = {
  nao_enviada: {
    icone: 'shield-outline',
    cor: COLORS.textMuted,
    titulo: 'Não verificada',
    texto: 'Envie sua selfie para obter o selo de verificação.',
  },
  pendente: {
    icone: 'time-outline',
    cor: '#F59E0B',
    titulo: 'Em análise',
    texto: 'Sua selfie foi enviada e está sendo analisada. Isso leva até 24h.',
  },
  aprovada: {
    icone: 'shield-checkmark',
    cor: '#1976D2',
    titulo: 'Verificada ✓',
    texto: 'Sua identidade foi verificada. O selo azul aparece no seu perfil!',
  },
  rejeitada: {
    icone: 'close-circle-outline',
    cor: COLORS.dislike,
    titulo: 'Não aprovada',
    texto: 'Sua selfie não pôde ser verificada. Leia as dicas e tente novamente.',
  },
};

export default function VerificacaoIdentidadeScreen({ navigation }) {
  const { usuario, atualizarPerfilLocal, perfil } = useAuth();
  const [status, setStatus]   = useState(perfil?.status_verificacao ?? 'nao_enviada');
  const [codigo, setCodigo]   = useState('');
  const [selfie, setSelfie]   = useState(null);   // uri local
  const [enviando, setEnviando] = useState(false);

  // Carrega status atualizado ao abrir a tela
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('perfis')
        .select('status_verificacao, codigo_verificacao')
        .eq('user_id', usuario.id)
        .single();
      if (data) {
        setStatus(data.status_verificacao ?? 'nao_enviada');
        // Reutiliza código pendente existente (evita pedir nova foto)
        if (data.status_verificacao === 'pendente' && data.codigo_verificacao) {
          setCodigo(data.codigo_verificacao);
        } else {
          setCodigo(gerarCodigo());
        }
      } else {
        setCodigo(gerarCodigo());
      }
    })();
  }, []);

  // ─── Câmera ────────────────────────────────────────────────────────────────
  const abrirCamera = async () => {
    const { status: perm } = await ImagePicker.requestCameraPermissionsAsync();
    if (perm !== 'granted') {
      Alert.alert('Permissão necessária', 'Permita o acesso à câmera para tirar a selfie.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.75,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setSelfie(result.assets[0].uri);
    }
  };

  // ─── Upload e envio ───────────────────────────────────────────────────────
  const enviarSelfie = async () => {
    if (!selfie) { Alert.alert('Selfie necessária', 'Tire a selfie antes de enviar.'); return; }
    setEnviando(true);
    try {
      // expo-file-system/legacy mantém readAsStringAsync no SDK 54
      const FileSystem = require('expo-file-system/legacy');
      const base64 = await FileSystem.readAsStringAsync(selfie, {
        encoding: 'base64',
      });
      // Converte base64 → Uint8Array
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

      const caminho = `${usuario.id}/selfie_${Date.now()}.jpg`;

      const { error: uploadErr } = await supabase.storage
        .from('verificacoes')
        .upload(caminho, bytes, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadErr) throw uploadErr;

      // Salva URL assinada de curta duração (admin acessa via service role de qualquer forma)
      const { data: urlData } = await supabase.storage
        .from('verificacoes')
        .createSignedUrl(caminho, 60 * 60 * 24 * 7); // 7 dias

      const selfieUrl = urlData?.signedUrl ?? caminho;

      // Atualiza perfil
      const { error: updateErr } = await supabase
        .from('perfis')
        .update({
          selfie_verificacao_url: selfieUrl,
          codigo_verificacao:     codigo,
          status_verificacao:     'pendente',
          verificacao_enviada_em: new Date().toISOString(),
        })
        .eq('user_id', usuario.id);

      if (updateErr) throw updateErr;

      atualizarPerfilLocal({ status_verificacao: 'pendente' });
      setStatus('pendente');
      setSelfie(null);
    } catch (err) {
      Alert.alert('Erro ao enviar', err.message ?? 'Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  const info = STATUS_INFO[status] ?? STATUS_INFO.nao_enviada;
  const podeEnviar = status === 'nao_enviada' || status === 'rejeitada';

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.btnVoltar}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitulo}>Verificação de identidade</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Card de status */}
        <View style={[styles.statusCard, { borderColor: info.cor }]}>
          <Ionicons name={info.icone} size={36} color={info.cor} />
          <Text style={[styles.statusTitulo, { color: info.cor }]}>{info.titulo}</Text>
          <Text style={styles.statusTexto}>{info.texto}</Text>
        </View>

        {/* Só mostra o fluxo de envio se puder enviar */}
        {podeEnviar && (
          <>
            {/* Código gerado */}
            <View style={styles.secao}>
              <Text style={styles.secaoTitulo}>Seu código</Text>
              <View style={styles.codigoBox}>
                <Text style={styles.codigoTexto}>{codigo}</Text>
              </View>
              <Text style={styles.secaoSub}>
                Escreva este código em um papel ou cartão e segure-o na sua selfie.
              </Text>
            </View>

            {/* Instruções */}
            <View style={styles.secao}>
              <Text style={styles.secaoTitulo}>Como fazer</Text>
              {[
                { n: '1', t: 'Escreva o código acima num papel' },
                { n: '2', t: 'Segure o papel próximo ao seu rosto' },
                { n: '3', t: 'Certifique-se que seu rosto e o código estejam visíveis' },
                { n: '4', t: 'Boa iluminação — evite contraluz' },
              ].map(item => (
                <View key={item.n} style={styles.instrucaoLinha}>
                  <View style={styles.instrucaoNum}>
                    <Text style={styles.instrucaoNumText}>{item.n}</Text>
                  </View>
                  <Text style={styles.instrucaoText}>{item.t}</Text>
                </View>
              ))}
            </View>

            {/* Preview da selfie */}
            <View style={styles.secao}>
              <Text style={styles.secaoTitulo}>Selfie</Text>
              {selfie ? (
                <View style={styles.previewWrapper}>
                  <Image source={{ uri: selfie }} style={styles.preview} />
                  <TouchableOpacity style={styles.btnRetomar} onPress={abrirCamera}>
                    <Ionicons name="camera" size={16} color={COLORS.white} />
                    <Text style={styles.btnRetomarText}>Tirar novamente</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.btnCamera} onPress={abrirCamera} activeOpacity={0.85}>
                  <Ionicons name="camera-outline" size={32} color={COLORS.primary} />
                  <Text style={styles.btnCameraText}>Abrir câmera</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Botão enviar */}
            <TouchableOpacity
              style={[styles.btnEnviar, (!selfie || enviando) && styles.btnEnviarDisabled]}
              onPress={enviarSelfie}
              disabled={!selfie || enviando}
              activeOpacity={0.85}
            >
              {enviando
                ? <ActivityIndicator color={COLORS.white} />
                : <>
                    <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.white} style={{ marginRight: 8 }} />
                    <Text style={styles.btnEnviarText}>Enviar para verificação</Text>
                  </>
              }
            </TouchableOpacity>

            {/* Aviso de privacidade */}
            <Text style={styles.privacidade}>
              🔒 Sua selfie é armazenada de forma segura e usada exclusivamente para verificação manual. Não é compartilhada nem processada por IA.{' '}
              <Text
                style={{ color: COLORS.primary, textDecorationLine: 'underline' }}
                onPress={() => Linking.openURL('https://juliana-exe.github.io/safimatch/privacy-policy.html')}
              >
                Ver política de privacidade
              </Text>
            </Text>
          </>
        )}

        {/* Status pendente: mostra código usado */}
        {status === 'pendente' && codigo ? (
          <View style={styles.secao}>
            <Text style={styles.secaoTitulo}>Código enviado</Text>
            <View style={[styles.codigoBox, { backgroundColor: '#FEF3C7' }]}>
              <Text style={[styles.codigoTexto, { color: '#92400E' }]}>{codigo}</Text>
            </View>
            <Text style={styles.secaoSub}>Análise em até 24 horas. Você será notificada quando concluída.</Text>
          </View>
        ) : null}

        {/* Status aprovado */}
        {status === 'aprovada' && (
          <View style={[styles.statusCard, { borderColor: '#1976D2', marginTop: 8 }]}>
            <Text style={styles.secaoSub}>
              O selo de verificação <Ionicons name="shield-checkmark" size={14} color="#1976D2" /> aparece no seu perfil para outras usuárias.
            </Text>
          </View>
        )}
      </ScrollView>
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

  scroll: { padding: SPACING.lg, gap: 20, paddingBottom: 40 },

  statusCard: {
    alignItems: 'center', gap: 10,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg, borderWidth: 2,
    padding: SPACING.lg,
  },
  statusTitulo: { fontSize: 18, fontWeight: '800' },
  statusTexto: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },

  secao: { gap: 12 },
  secaoTitulo: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, letterSpacing: 0.5, textTransform: 'uppercase' },
  secaoSub: { fontSize: 13, color: COLORS.textMuted, lineHeight: 18 },

  codigoBox: {
    backgroundColor: '#EDE7F6', borderRadius: RADIUS.md,
    padding: SPACING.md, alignItems: 'center',
  },
  codigoTexto: { fontSize: 28, fontWeight: '900', color: '#4527A0', letterSpacing: 4 },

  instrucaoLinha: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  instrucaoNum: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
  },
  instrucaoNumText: { color: COLORS.white, fontWeight: '800', fontSize: 13 },
  instrucaoText: { flex: 1, fontSize: 14, color: COLORS.textPrimary, lineHeight: 20 },

  btnCamera: {
    height: 160, borderRadius: RADIUS.lg,
    borderWidth: 2, borderColor: COLORS.primary, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary + '08',
  },
  btnCameraText: { fontSize: 15, fontWeight: '600', color: COLORS.primary },

  previewWrapper: { gap: 10 },
  preview: { width: '100%', height: 260, borderRadius: RADIUS.lg, resizeMode: 'cover' },
  btnRetomar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: COLORS.textSecondary, borderRadius: RADIUS.md, padding: 10,
  },
  btnRetomarText: { color: COLORS.white, fontWeight: '600', fontSize: 13 },

  btnEnviar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.primary, borderRadius: RADIUS.full,
    paddingVertical: 16, marginTop: 4,
  },
  btnEnviarDisabled: { opacity: 0.45 },
  btnEnviarText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },

  privacidade: {
    fontSize: 12, color: COLORS.textMuted, textAlign: 'center',
    lineHeight: 18, paddingHorizontal: SPACING.md,
  },
});
