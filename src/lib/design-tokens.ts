/**
 * Design Tokens - UI Style Guidelines
 * Based on the Dokifree App Design System
 */

export const COLORS = {
  // Primary Colors - Purple
  primary: {
    lightest: '#E7E4F9',
    main: '#7C5CDB',
    dark: '#5E44B8',
    darkest: '#463184',
  },

  // Secondary Colors - Orange
  secondary: {
    lightest: '#FFE8D4',
    main: '#FF8F2E',
    dark: '#ED6F0D',
    darkest: '#5B3013',
  },

  // Silver Colors (Accent/Status)
  accent: {
    blue: '#0D99FF',
    green: '#019E5B',
    yellow: '#FFD33F',
    red: '#FF5E65',
  },

  // Grayscale
  gray: {
    darkest: '#0F0F0F', // Darkgray
    medium: '#525050', // Mediumgray
    light: '#A0A0A0', // Lightgray
    lighter: '#F0F0F0', // Border-Mediumgray / Light background
    white: '#FFFFFF', // White / Border-White
  },
} as const;

export const TYPOGRAPHY = {
  fontFamily: {
    primary: 'SF Pro Display',
    fallback: '-apple-system, BlinkMacSystemFont, system-ui, Roboto, sans-serif',
  },

  fontSize: {
    '2xs': 8, // px
    xs: 10, // px
    sm: 12, // px
    base: 16, // px
    md: 18, // px
    lg: 20, // px
    xl: 24, // px
    '2xl': 28, // px
  },

  lineHeight: {
    '2xs': 12,
    xs: 14,
    sm: 18,
    base: 24,
    md: 27,
    lg: 30,
    xl: 36,
    '2xl': 42,
  },
} as const;

