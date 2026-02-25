// src/services/notificationService.js - Safimatch
// Gerencia push tokens e notificações locais/push para novas mensagens.
// Usa lazy require() para não crashar quando o native module não está compilado
// no APK (ex: debug build sem rebuild). Em produção funciona normalmente.

import { Platform } from 'react-native';
import { supabase } from '../config/supabase';

// Lazy: só carrega expo-notifications quando necessário e se disponível
let _Notifications = null;
const getNotif = () => {
  if (_Notifications) return _Notifications;
  try {
    _Notifications = require('expo-notifications');
    // Configura apresentação em foreground na primeira carga
    _Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  } catch {
    _Notifications = null;
  }
  return _Notifications;
};

let _Device = null;
const getDevice = () => {
  if (_Device) return _Device;
  try { _Device = require('expo-device'); } catch { _Device = null; }
  return _Device;
};

// ─── Registrar token de push ──────────────────────────────────────────────────
export async function registrarPushToken() {
  try {
    const Notifications = getNotif();
    const Device = getDevice();
    if (!Notifications || !Device) return null;

    if (!Device.isDevice) {
      console.info('[Notif] Push token ignorado: não é dispositivo físico.');
      return null;
    }

    const { status: statusExistente } = await Notifications.getPermissionsAsync();
    let statusFinal = statusExistente;
    if (statusExistente !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      statusFinal = status;
    }
    if (statusFinal !== 'granted') return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('mensagens', {
        name: 'Mensagens',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#AD1457',
        sound: true,
      });
    }

    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;

    await supabase
      .from('perfis')
      .update({ push_token: token })
      .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

    console.info('[Notif] Push token registrado:', token);
    return token;
  } catch (err) {
    console.warn('[Notif] Erro ao registrar push token:', err.message);
    return null;
  }
}

// ─── Notificação local de nova mensagem ───────────────────────────────────────
export async function notificarNovaMensagem(remetente, conteudo) {
  try {
    const Notifications = getNotif();
    if (!Notifications) return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: remetente,
        body: conteudo,
        sound: true,
        data: { tipo: 'mensagem' },
      },
      trigger: null,
    });
  } catch (err) {
    console.warn('[Notif] Erro ao exibir notificação:', err.message);
  }
}

// ─── Escutar toque em notificação ────────────────────────────────────────────
export function ouvirToqueNotificacao(onToque) {
  try {
    const Notifications = getNotif();
    if (!Notifications) return () => {};
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      onToque(data);
    });
    return () => sub.remove();
  } catch {
    return () => {};
  }
}
