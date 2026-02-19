// src/theme/colors.js
// Paleta oficial do Safimatch 💜

export const COLORS = {
  // Primária - Rosa profundo
  primary: '#C2185B',
  primaryLight: '#E91E8C',
  primaryDark: '#880E4F',

  // Secundária - Roxo
  secondary: '#7B1FA2',
  secondaryLight: '#9C27B0',
  secondaryDark: '#4A148C',

  // Gradiente principal
  gradientStart: '#C2185B',
  gradientEnd: '#7B1FA2',

  // Gradiente alternativo (splash)
  gradientAltStart: '#AD1457',
  gradientAltMid: '#7B1FA2',
  gradientAltEnd: '#4527A0',

  // Status
  success: '#2E7D32',
  successLight: '#E8F5E9',
  error: '#C62828',
  errorLight: '#FFEBEE',
  warning: '#F57F17',
  info: '#1565C0',

  // Match / Curtida
  like: '#E91E8C',
  dislike: '#9E9E9E',
  superLike: '#FFC107',

  // Neutros
  white: '#FFFFFF',
  background: '#FAF0F4',
  backgroundAlt: '#F3E5F5',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  border: '#F0D6E8',

  // Texto
  textPrimary: '#1A0A12',
  textSecondary: '#6D4C5E',
  textMuted: '#A37990',
  textOnPrimary: '#FFFFFF',

  // Sombra
  shadow: 'rgba(194, 24, 91, 0.15)',

  // Verificação
  verified: '#1976D2',
  premium: '#F57F17',
};

export const GRADIENTS = {
  primary: ['#C2185B', '#7B1FA2'],
  splash: ['#AD1457', '#7B1FA2', '#4527A0'],
  card: ['transparent', 'rgba(0,0,0,0.85)'],
  like: ['#E91E8C', '#C2185B'],
  superLike: ['#FFC107', '#FF8F00'],
};

export const FONTS = {
  regular: 'System',
  semiBold: 'System',
  bold: 'System',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 20,
  xl: 28,
  full: 999,
};
