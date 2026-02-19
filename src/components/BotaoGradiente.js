// src/components/BotaoGradiente.js - Safimatch
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, RADIUS } from '../theme/colors';

/**
 * Botão padrão do Safimatch com gradiente.
 * Props: titulo, onPress, carregando, variante ('primary'|'secondary'|'outline')
 */
export default function BotaoGradiente({
  titulo,
  onPress,
  carregando = false,
  variante = 'primary',
  disabled = false,
  style,
}) {
  if (variante === 'outline') {
    return (
      <TouchableOpacity
        style={[styles.outline, disabled && styles.disabled, style]}
        onPress={onPress}
        disabled={disabled || carregando}
        activeOpacity={0.8}
      >
        <Text style={styles.outlineText}>{titulo}</Text>
      </TouchableOpacity>
    );
  }

  const cores =
    variante === 'secondary'
      ? ['#7B1FA2', '#4527A0']
      : [COLORS.primaryLight, COLORS.secondary];

  return (
    <TouchableOpacity
      style={[styles.wrapper, disabled && styles.disabled, style]}
      onPress={onPress}
      disabled={disabled || carregando}
      activeOpacity={0.85}
    >
      <LinearGradient
        colors={cores}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradiente}
      >
        {carregando ? (
          <ActivityIndicator color={COLORS.white} />
        ) : (
          <Text style={styles.texto}>{titulo}</Text>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: { borderRadius: RADIUS.lg, overflow: 'hidden' },
  gradiente: {
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texto: { fontSize: 17, fontWeight: '700', color: COLORS.white },
  disabled: { opacity: 0.6 },
  outline: {
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    borderColor: COLORS.primary,
    paddingVertical: 15,
    alignItems: 'center',
  },
  outlineText: { fontSize: 16, fontWeight: '700', color: COLORS.primary },
});
