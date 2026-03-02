// src/navigation/index.js - Safimatch
import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../config/supabase';

// Screens
import SplashScreen from '../screens/SplashScreen';
import LoginScreen from '../screens/LoginScreen';
import CadastroScreen from '../screens/CadastroScreen';
import DescobertaScreen from '../screens/DescobertaScreen';
import ChatListScreen from '../screens/ChatListScreen';
import ChatScreen from '../screens/ChatScreen';
import PerfilScreen from '../screens/PerfilScreen';
import ConfiguracaoScreen from '../screens/ConfiguracaoScreen';
import VerificacaoScreen from '../screens/VerificacaoScreen';
import PremiumScreen from '../screens/PremiumScreen';
import VerificacaoIdentidadeScreen from '../screens/VerificacaoIdentidadeScreen';
import AdminVerificacoesScreen from '../screens/AdminVerificacoesScreen';
import NotificacoesScreen from '../screens/NotificacoesScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Navegação principal (tabs)
function MainTabNavigator() {
  const { usuario } = useAuth();
  const [naoLidas, setNaoLidas] = useState(0);
  const insets = useSafeAreaInsets();

  // Atualiza badge de notificações em tempo real
  useEffect(() => {
    if (!usuario?.id) return;

    const buscarNaoLidas = async () => {
      const { data } = await supabase
        .from('mensagens')
        .select('id', { count: 'exact', head: true })
        .eq('lida', false)
        .neq('de_user_id', usuario.id);
      setNaoLidas(data?.length ?? 0);
    };

    // Busca direto via count
    const buscarCount = async () => {
      const { count } = await supabase
        .from('mensagens')
        .select('*', { count: 'exact', head: true })
        .eq('lida', false)
        .neq('de_user_id', usuario.id);
      setNaoLidas(count ?? 0);
    };
    buscarCount();

    // Escuta novas mensagens em tempo real
    const canal = supabase
      .channel('badge-nao-lidas')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensagens' },
        (p) => { if (p.new.de_user_id !== usuario.id) setNaoLidas(n => n + 1); })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'mensagens' },
        () => { buscarCount(); })
      .subscribe();

    return () => { supabase.removeChannel(canal); };
  }, [usuario?.id]);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          paddingTop: 6,
          backgroundColor: COLORS.white,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          elevation: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
      })}
    >
      <Tab.Screen
        name="Descoberta"
        component={DescobertaScreen}
        options={{
          tabBarLabel: 'Descobrir',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'heart' : 'heart-outline'}
              size={26}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Chats"
        component={ChatListScreen}
        options={{
          tabBarLabel: 'Conversas',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'chatbubbles' : 'chatbubbles-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Notificacoes"
        component={NotificacoesScreen}
        options={{
          tabBarLabel: 'Avisos',
          tabBarBadge: naoLidas > 0 ? (naoLidas > 9 ? '9+' : naoLidas) : undefined,
          tabBarBadgeStyle: { backgroundColor: COLORS.primary, color: '#fff', fontSize: 10 },
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'notifications' : 'notifications-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Perfil"
        component={PerfilScreen}
        options={{
          tabBarLabel: 'Meu Perfil',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'person' : 'person-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Configuracoes"
        component={ConfiguracaoScreen}
        options={{
          tabBarLabel: 'Ajustes',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'settings' : 'settings-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// Navegador raiz com guarda de autenticação
export default function RootNavigator() {
  const { autenticada, carregando } = useAuth();

  // Enquanto verifica sessão salva, exibe spinner
  if (carregando) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#AD1457' }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{ headerShown: false }}
      >
        {autenticada ? (
          // USUÁRIA LOGADA → vai direto para o app
          <>
            <Stack.Screen
              name="Main"
              component={MainTabNavigator}
              options={{ animation: 'fade' }}
            />
            <Stack.Screen
              name="Chat"
              component={ChatScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="Premium"
              component={PremiumScreen}
              options={{ animation: 'slide_from_bottom' }}
            />
            <Stack.Screen
              name="VerificacaoIdentidade"
              component={VerificacaoIdentidadeScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="AdminVerificacoes"
              component={AdminVerificacoesScreen}
              options={{ animation: 'slide_from_right' }}
            />
          </>
        ) : (
          // SEM SESSÃO → fluxo de autenticação
          <>
            <Stack.Screen name="Splash" component={SplashScreen} />
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="Cadastro"
              component={CadastroScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="Verificacao"
              component={VerificacaoScreen}
              options={{ animation: 'slide_from_right' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
