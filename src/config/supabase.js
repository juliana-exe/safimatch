// src/config/supabase.js - Safimatch
// Cliente Supabase para React Native e Web

import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

// ================================================================
// CONFIGURAÇÃO — Supabase Cloud
// ================================================================
const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  'https://nujzwirwcdlkytgldfsp.supabase.co';

const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  'sb_publishable_7kBrEPAMyipnh4jtqwHaKw_NZ-E7Gzd';

if (!SUPABASE_ANON_KEY) {
  throw new Error('[supabase.js] SUPABASE_ANON_KEY não definida.');
}

// Fetch com timeout de 15 segundos (evita spinner infinito)
const fetchComTimeout = (url, options = {}) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 15000);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(id));
};

// Storage adapter: localStorage no web, AsyncStorage no mobile
let storageAdapter;
if (Platform.OS === 'web') {
  storageAdapter = {
    getItem: (key) => Promise.resolve(window.localStorage.getItem(key)),
    setItem: (key, value) => Promise.resolve(window.localStorage.setItem(key, value)),
    removeItem: (key) => Promise.resolve(window.localStorage.removeItem(key)),
  };
} else {
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  storageAdapter = AsyncStorage;
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: storageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
  global: {
    fetch: fetchComTimeout,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Atalhos para os principais recursos
export const auth  = supabase.auth;
export const db    = supabase;           // supabase.from(...)
export const store = supabase.storage;   // bucket de fotos
