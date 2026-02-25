// src/services/notificationService.js - Safimatch
// Gerencia push tokens e notificações locais/push para novas mensagens.

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from '../config/supabase';

// Como as notificações são apresentadas quando o app está em FOREGROUND
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ─── Registrar token de push ──────────────────────────────────────────────────
/**
 * Solicita permissão, obtém o Expo Push Token e salva no perfil da usuária.
 * Chame isso após o login.
 * @returns {Promise<string|null>} token ou null
 */
export async function registrarPushToken() {
  try {
    // Em emulador Android sem Play Services o token pode falhar — não trava o app
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

    if (statusFinal !== 'granted') {
      console.warn('[Notif] Permissão de notificação negada.');
      return null;
    }

    // Canal Android (obrigatório para Android 8+)
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('mensagens', {
        name: 'Mensagens',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#AD1457',
        sound: true,
      });
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: 'safimatch', // substitua pelo projectId do app.json se necessário
    });
    const token = tokenData.data;

    // Salva token no perfil da usuária para que o backend possa enviar push
    await supabase
      .from('perfis')
      .update({ push_token: token })
      .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

    console.info('[Notif] Push token registrado:', token);
    return token;
  } catch (err) {
    // Emuladores sem Play Services lançam erro — silencia em DEV
    console.warn('[Notif] Erro ao registrar push token:', err.message);
    return null;
  }
}

// ─── Notificação local de nova mensagem ───────────────────────────────────────
/**
 * Exibe uma notificação local imediata para uma nova mensagem recebida.
 * Usada quando o app está em foreground (Realtime) para alertar a usuária.
 * @param {string} remetente  - Nome de quem enviou
 * @param {string} conteudo   - Texto da mensagem (ou "📷 Foto")
 */
export async function notificarNovaMensagem(remetente, conteudo) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: remetente,
        body: conteudo,
        sound: true,
        data: { tipo: 'mensagem' },
        categoryIdentifier: 'mensagem',
      },
      trigger: null, // imediato
    });
  } catch (err) {
    console.warn('[Notif] Erro ao exibir notificação:', err.message);
  }
}

// ─── Escutar notificações recebidas ───────────────────────────────────────────
/**
 * Adiciona listener para quando a usuária TOCA em uma notificação.
 * Retorna a função de cleanup.
 * @param {(data: object) => void} onToque
 */
export function ouvirToqueNotificacao(onToque) {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;
    onToque(data);
  });
  return () => sub.remove();
}
