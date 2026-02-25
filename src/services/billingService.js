// src/services/billingService.js
// Gerencia assinaturas via Google Play Billing (react-native-iap v12)

import { Platform } from 'react-native';
import {
  initConnection,
  endConnection,
  getSubscriptions,
  requestSubscription,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
  getAvailablePurchases,
} from 'react-native-iap';
import { supabase } from '../config/supabase';

const PREMIUM_API =
  process.env.EXPO_PUBLIC_PREMIUM_API_URL ?? 'https://safimatch-premium-api.fly.dev';

// ─── SKUs registrados no Google Play Console → Monetização → Assinaturas ─────
// IMPORTANTE: crie esses produtos em Play Console antes de publicar
export const SKUS = {
  mensal:     'premium_mensal',
  trimestral: 'premium_trimestral',
  anual:      'premium_anual',
};

export const PLANOS_INFO = {
  [SKUS.mensal]: {
    label: 'Mensal', precoFallback: 'R$ 9,90',
    periodo: '/mês', sub: null, badge: null, dias: 30,
  },
  [SKUS.trimestral]: {
    label: 'Trimestral', precoFallback: 'R$ 24,90',
    periodo: '/trim.', sub: 'R$ 8,30/mês', badge: 'Economize 17%', dias: 90,
  },
  [SKUS.anual]: {
    label: 'Anual', precoFallback: 'R$ 79,90',
    periodo: '/ano', sub: 'R$ 6,66/mês', badge: '🔥 Melhor oferta', dias: 365,
  },
};

export const ALL_SKUS = Object.values(SKUS);

// ─── Inicialização / Encerramento ─────────────────────────────────────────────

export async function iniciarConexaoBilling() {
  if (Platform.OS !== 'android') return false;
  try {
    await initConnection();
    return true;
  } catch (e) {
    console.warn('[billing] initConnection:', e?.message);
    return false;
  }
}

export async function encerrarConexaoBilling() {
  try { await endConnection(); } catch { /* silencioso */ }
}

// ─── Produtos ─────────────────────────────────────────────────────────────────

export async function buscarAssinaturas() {
  try {
    const subs = await getSubscriptions({ skus: ALL_SKUS });
    return Array.isArray(subs) ? subs : [];
  } catch (e) {
    console.warn('[billing] getSubscriptions:', e?.message);
    return [];
  }
}

// ─── Compra ───────────────────────────────────────────────────────────────────

export async function realizarCompra(sku, products) {
  // Play Billing v5: precisa do offerToken da primeira oferta disponível
  const product    = products.find(p => p.productId === sku);
  const offerToken = product?.subscriptionOfferDetails?.[0]?.offerToken;

  await requestSubscription({
    sku,
    ...(Platform.OS === 'android' && offerToken
      ? { subscriptionOffers: [{ sku, offerToken }] }
      : {}),
  });
  // Resultado chega via purchaseUpdatedListener (assíncrono)
}

export async function finalizarTransacao(purchase) {
  try {
    await finishTransaction({ purchase, isConsumable: false });
  } catch (e) {
    console.warn('[billing] finishTransaction:', e?.message);
  }
}

// ─── Restaurar compras ────────────────────────────────────────────────────────

export async function restaurarCompras() {
  try {
    const purchases = await getAvailablePurchases();
    return Array.isArray(purchases) ? purchases : [];
  } catch (e) {
    console.warn('[billing] getAvailablePurchases:', e?.message);
    return [];
  }
}

// ─── Listeners ────────────────────────────────────────────────────────────────

export function ouvirCompras(callback) {
  return purchaseUpdatedListener(callback);
}

export function ouvirErros(callback) {
  return purchaseErrorListener(callback);
}

// ─── Verificação no servidor ──────────────────────────────────────────────────

export async function verificarCompraPlay(purchase) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return false;

    const resp = await fetch(`${PREMIUM_API}/premium/verificar-compra-play`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        purchaseToken: purchase.purchaseToken ?? purchase.transactionReceipt,
        productId:     purchase.productId,
        transactionId: purchase.transactionId,
      }),
    });

    if (!resp.ok) {
      const d = await resp.json().catch(() => ({}));
      console.warn('[billing] verificar-compra-play erro:', d?.erro);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('[billing] verificarCompraPlay:', e?.message);
    return false;
  }
}
