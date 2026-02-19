// src/screens/SplashScreen.js - Safimatch
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS } from '../theme/colors';

const { width, height } = Dimensions.get('window');

export default function SplashScreen({ navigation }) {
  const logoScale = useRef(new Animated.Value(0)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const buttonsOpacity = useRef(new Animated.Value(0)).current;
  const buttonsTranslate = useRef(new Animated.Value(40)).current;
  const heartBeat = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Animação de entrada do logo
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          tension: 60,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
      // Batimento do coração
      Animated.loop(
        Animated.sequence([
          Animated.timing(heartBeat, { toValue: 1.12, duration: 400, useNativeDriver: true }),
          Animated.timing(heartBeat, { toValue: 1, duration: 400, useNativeDriver: true }),
        ]),
        { iterations: 3 }
      ),
      // Entrada dos botões
      Animated.parallel([
        Animated.timing(buttonsOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.spring(buttonsTranslate, {
          toValue: 0,
          tension: 60,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  return (
    <LinearGradient
      colors={['#AD1457', '#7B1FA2', '#4527A0']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <SafeAreaView style={styles.safe}>
        {/* Círculos decorativos */}
        <View style={styles.circleTopRight} />
        <View style={styles.circleBottomLeft} />

        {/* Logo */}
        <Animated.View
          style={[
            styles.logoContainer,
            {
              opacity: logoOpacity,
              transform: [{ scale: logoScale }],
            },
          ]}
        >
          <Animated.View
            style={[styles.iconCircle, { transform: [{ scale: heartBeat }] }]}
          >
            <Ionicons name="heart" size={52} color={COLORS.primary} />
          </Animated.View>

          <Text style={styles.appName}>Safimatch</Text>
          <Text style={styles.tagline}>Conexões reais, para mulheres reais</Text>

          {/* Badges */}
          <View style={styles.badgesRow}>
            <View style={styles.badge}>
              <Ionicons name="shield-checkmark" size={13} color={COLORS.white} />
              <Text style={styles.badgeText}>100% Seguro</Text>
            </View>
            <View style={styles.badge}>
              <Ionicons name="people" size={13} color={COLORS.white} />
              <Text style={styles.badgeText}>Só Mulheres</Text>
            </View>
            <View style={styles.badge}>
              <Ionicons name="sparkles" size={13} color={COLORS.white} />
              <Text style={styles.badgeText}>Verificado</Text>
            </View>
          </View>
        </Animated.View>

        {/* Botões */}
        <Animated.View
          style={[
            styles.buttonsArea,
            {
              opacity: buttonsOpacity,
              transform: [{ translateY: buttonsTranslate }],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={() => navigation.navigate('Cadastro')}
            activeOpacity={0.85}
          >
            <Ionicons name="heart" size={20} color={COLORS.primary} />
            <Text style={styles.btnPrimaryText}>Criar minha conta</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnSecondary}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.8}
          >
            <Text style={styles.btnSecondaryText}>Já tenho conta</Text>
          </TouchableOpacity>

          <Text style={styles.footerText}>
            Espaço seguro e exclusivo para mulheres 💜
          </Text>
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: height * 0.08,
    paddingBottom: SPACING.xl,
  },

  // Decoração
  circleTopRight: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  circleBottomLeft: {
    position: 'absolute',
    bottom: -80,
    left: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },

  // Logo
  logoContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  iconCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
    marginBottom: 8,
  },
  appName: {
    fontSize: 46,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 22,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  badgeText: {
    fontSize: 11,
    color: COLORS.white,
    fontWeight: '600',
  },

  // Botões
  buttonsArea: {
    width: '100%',
    gap: 12,
    alignItems: 'center',
  },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    backgroundColor: COLORS.white,
    paddingVertical: 17,
    borderRadius: RADIUS.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  btnPrimaryText: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.primary,
  },
  btnSecondary: {
    width: '100%',
    paddingVertical: 17,
    borderRadius: RADIUS.xl,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  btnSecondaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
  },
  footerText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 6,
    textAlign: 'center',
  },
});
