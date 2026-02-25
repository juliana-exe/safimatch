// src/components/AvatarPessoa.js - Safimatch
// Avatar de usuária com fallback local (sem dependência de URLs externas).
// Quando não há foto, exibe um ícone placeholder estilizado.

import React from 'react';
import { View, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * @param {string|null|undefined} uri    — URL da foto da usuária
 * @param {object}                style  — estilos aplicados (width/height/borderRadius, etc.)
 * @param {string}                iconColor — cor do ícone de placeholder
 */
export default function AvatarPessoa({ uri, style, iconColor = 'rgba(173,20,87,0.35)' }) {
  const w = style?.width  ?? 50;
  const h = style?.height ?? 50;
  const iconSize = Math.max(w, h) * 0.92;

  if (uri) {
    return <Image source={{ uri }} style={style} />;
  }

  return (
    <View
      style={[
        style,
        { backgroundColor: '#F8BBD0', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
      ]}
    >
      <Ionicons name="person-circle" size={iconSize} color={iconColor} />
    </View>
  );
}
