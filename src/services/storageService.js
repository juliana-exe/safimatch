// src/services/storageService.js - Safimatch
// Upload de fotos via Supabase Storage
// As fotos ficam no servidor próprio Docker

import { Platform } from 'react-native';
import { supabase } from '../config/supabase';

const BUCKET = 'fotos-perfil';

// ── Utilitário interno: lê URI e retorna o dado correto por plataforma ─────────
// Web: expo-image-picker devolve blob:url → passamos Blob direto ao Supabase
// Mobile: passamos ArrayBuffer (mais confiável no React Native)
const uriParaDado = async (uri) => {
  const response = await fetch(uri);
  const blob = await response.blob();
  if (Platform.OS === 'web') {
    return { dado: blob, contentType: blob.type || 'image/jpeg' };
  }
  const arrayBuffer = await new Response(blob).arrayBuffer();
  const ext = uri.split('.').pop()?.toLowerCase() || 'jpg';
  return {
    dado: arrayBuffer,
    contentType: ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg',
  };
};

// ── Caminho fixo por slot (sem timestamp) → upsert sobrescreve o mesmo arquivo ─
const caminhoSlot = (userId, fotoIndex, contentType) => {
  const ext = contentType.split('/')[1] || 'jpg';
  return `${userId}/foto_${fotoIndex}.${ext}`;
};

// ================================================================
// UPLOAD DE UMA FOTO
// ================================================================
export const uploadFoto = async (userId, imageUri, fotoIndex = 0) => {
  try {
    const { dado, contentType } = await uriParaDado(imageUri);
    const caminho = caminhoSlot(userId, fotoIndex, contentType);

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .upload(caminho, dado, {
        contentType,
        upsert: true,   // sobrescreve o slot existente (UPDATE policy garante isso)
        cacheControl: '3600',
      });

    if (error) throw error;

    // Adiciona buster de cache para forçar recarregamento no app
    const { data: urlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(data.path);

    const urlComBuster = `${urlData.publicUrl}?t=${Date.now()}`;
    return { sucesso: true, url: urlComBuster, caminho: data.path };
  } catch (error) {
    console.error('[uploadFoto]', error);
    return { sucesso: false, erro: error.message };
  }
};

// ================================================================
// UPLOAD MÚLTIPLAS FOTOS
// ================================================================
export const uploadMultiplasFotos = async (userId, imageUris) => {
  const resultados = await Promise.allSettled(
    imageUris.map((uri, idx) => uploadFoto(userId, uri, idx))
  );

  const urls = resultados
    .filter(r => r.status === 'fulfilled' && r.value.sucesso)
    .map(r => r.value.url);

  const erros = resultados
    .filter(r => r.status === 'rejected' || !r.value?.sucesso)
    .length;

  return {
    sucesso: urls.length > 0,
    urls,
    totalEnviadas: urls.length,
    totalErros: erros,
  };
};

// ================================================================
// UPLOAD DE FOTO PARA O CHAT
//   Caminho: {userId}/chat/{matchId}/{timestamp}.{ext}
//   Usa o mesmo bucket fotos-perfil (policy já cobre path userId/*)
// ================================================================
export const uploadFotoChat = async (userId, matchId, imageUri) => {
  try {
    const { dado, contentType } = await uriParaDado(imageUri);
    const ext = contentType.split('/')[1] || 'jpg';
    const caminho = `${userId}/chat/${matchId}/${Date.now()}.${ext}`;

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .upload(caminho, dado, {
        contentType,
        upsert: false,
        cacheControl: '3600',
      });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(data.path);

    return { sucesso: true, url: urlData.publicUrl, caminho: data.path };
  } catch (error) {
    console.error('[uploadFotoChat]', error);
    return { sucesso: false, erro: error.message };
  }
};

// ================================================================
// DELETAR FOTO DE UM SLOT
//   Remove o arquivo do bucket e retorna sucesso/falha
// ================================================================
export const removerFotoSlot = async (caminhoOuUrl) => {
  try {
    // Aceita tanto o caminho relativo quanto a URL pública completa
    let caminho = caminhoOuUrl;
    if (caminhoOuUrl.startsWith('http')) {
      // Extrai o caminho a partir da URL pública
      // Ex: http://localhost:8000/storage/v1/object/public/fotos-perfil/uuid/foto_0.jpg
      const marker = `/object/public/${BUCKET}/`;
      const idx = caminhoOuUrl.indexOf(marker);
      if (idx === -1) throw new Error('URL inválida para o bucket');
      caminho = decodeURIComponent(caminhoOuUrl.slice(idx + marker.length).split('?')[0]);
    }

    const { error } = await supabase.storage.from(BUCKET).remove([caminho]);
    if (error) throw error;
    return { sucesso: true };
  } catch (error) {
    console.error('[removerFotoSlot]', error.message);
    return { sucesso: false, erro: error.message };
  }
};

// ================================================================
// DELETAR FOTO (alias para compatibilidade)
// ================================================================
export const deletarFoto = async (caminho) => removerFotoSlot(caminho);

// ================================================================
// LISTAR FOTOS DA USUÁRIA
// ================================================================
export const listarFotosUsuaria = async (userId) => {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(userId, {
        limit: 10,
        offset: 0,
        sortBy: { column: 'created_at', order: 'asc' },
      });

    if (error) throw error;

    const urls = (data ?? []).map(arquivo => ({
      caminho: `${userId}/${arquivo.name}`,
      url: supabase.storage.from(BUCKET).getPublicUrl(`${userId}/${arquivo.name}`).data.publicUrl,
      nome: arquivo.name,
      tamanho: arquivo.metadata?.size ?? 0,
    }));

    return { sucesso: true, fotos: urls };
  } catch (error) {
    return { sucesso: false, erro: error.message, fotos: [] };
  }
};

// ================================================================
// ATUALIZAR FOTOS DO PERFIL (upload + salva URLs no perfil)
// ================================================================
export const sincronizarFotosPerfil = async (userId, imageUris) => {
  try {
    // Faz upload de todas as fotos novas
    const { urls, sucesso } = await uploadMultiplasFotos(userId, imageUris);
    if (!sucesso) throw new Error('Falha no upload das fotos');

    // Atualiza o perfil com as novas URLs
    const { error } = await supabase
      .from('perfis')
      .update({
        fotos: urls,
        foto_principal: urls[0] ?? null,
      })
      .eq('user_id', userId);

    if (error) throw error;

    return { sucesso: true, urls, fotoPrincipal: urls[0] };
  } catch (error) {
    return { sucesso: false, erro: error.message };
  }
};

// ================================================================
// GERAR URL ASSINADA (para fotos privadas — futuro)
// ================================================================
export const gerarUrlAssinada = async (caminho, expiracaoSegundos = 3600) => {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(caminho, expiracaoSegundos);

    if (error) throw error;
    return { sucesso: true, url: data.signedUrl };
  } catch (error) {
    return { sucesso: false, erro: error.message };
  }
};
