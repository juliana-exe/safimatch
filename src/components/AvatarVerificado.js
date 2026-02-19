// src/components/AvatarVerificado.js - Safimatch
import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';

/**
 * Avatar circular com badge de verificação opcional.
 * Props: uri, tamanho, verificada, online
 */
export default function AvatarVerificado({
  uri,
  tamanho = 56,
  verificada = false,
  online = false,
  bordaColor = COLORS.primary,
}) {
  return (
    <View style={{ width: tamanho, height: tamanho }}>
      <Image
        source={{ uri }}
        style={{
          width: tamanho,
          height: tamanho,
          borderRadius: tamanho / 2,
          borderWidth: verificada ? 2.5 : 0,
          borderColor: bordaColor,
        }}
      />
      {verificada && (
        <View
          style={[
            styles.verificadaBadge,
            {
              width: tamanho * 0.3,
              height: tamanho * 0.3,
              borderRadius: (tamanho * 0.3) / 2,
              bottom: 0,
              right: 0,
            },
          ]}
        >
          <Ionicons name="shield-checkmark" size={tamanho * 0.15} color="#1565C0" />
        </View>
      )}
      {online && (
        <View
          style={[
            styles.onlineDot,
            {
              width: tamanho * 0.22,
              height: tamanho * 0.22,
              borderRadius: (tamanho * 0.22) / 2,
              bottom: verificada ? tamanho * 0.28 : 2,
              right: 2,
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  verificadaBadge: {
    position: 'absolute',
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.white,
  },
  onlineDot: {
    position: 'absolute',
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
});
