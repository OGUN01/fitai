import { MD3DarkTheme, MD3Theme } from 'react-native-paper';
import { Platform } from 'react-native';

/**
 * FitAI Theme System - Bold Minimalism
 * 
 * A comprehensive theme for the FitAI application following the "Bold Minimalism" design philosophy
 */

// Color System
export const colors = {
  // Background gradient colors
  background: {
    primary: '#171429',
    secondary: '#2A2550',
  },
  
  // Primary brand colors
  primary: {
    main: '#FF2E93',
    light: '#FF6EB5',
    dark: '#D30069',
  },
  
  // Secondary colors
  secondary: {
    main: '#36BFFA',
    light: '#7DD3FB',
    dark: '#0E9AD7',
  },
  
  // Accent colors for specific purposes
  accent: {
    gold: '#FFBF3C',     // Achievements
    green: '#4ADE80',    // Progress
    lavender: '#A78BFA', // Rest days
    purple: '#9932CC',   // Body analysis
  },
  
  // Text colors
  text: {
    primary: '#FFFFFF',
    secondary: '#F3F4F6',
    muted: '#9CA3AF',
    disabled: '#6B7280',
  },
  
  // Feedback colors
  feedback: {
    success: '#4ADE80',
    error: '#F87171',
    warning: '#FBBF24',
    info: '#60A5FA',
  },
  
  // Surface colors for cards, etc.
  surface: {
    main: 'rgba(40, 40, 70, 0.8)',
    light: 'rgba(60, 60, 90, 0.6)',
    dark: 'rgba(30, 30, 50, 0.95)',
  },
  
  // Border colors
  border: {
    light: 'rgba(255, 255, 255, 0.1)',
    medium: 'rgba(255, 255, 255, 0.15)',
    focused: 'rgba(255, 255, 255, 0.25)',
  },
};

// Additional custom colors not in MD3Theme
export const customColors = {
  success: colors.feedback.success,
  info: colors.feedback.info,
  warning: colors.feedback.warning,
};

// Typography
const baseFont = Platform.select({
  ios: 'System',
  android: 'Roboto',
  default: 'Roboto, "Helvetica Neue", Helvetica, Arial, sans-serif',
});

// Spacing system (for margins, paddings)
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

// Border radii
export const borderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  round: 9999, // For circular elements and pills
};

// Shadows for elevation
export const shadows = {
  small: {
    elevation: 2,
    // For web compatibility, use boxShadow instead of the individual shadow properties
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
  },
  medium: {
    elevation: 4,
    // For web compatibility, use boxShadow instead of the individual shadow properties
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.15)',
  },
  large: {
    elevation: 8,
    // For web compatibility, use boxShadow instead of the individual shadow properties
    boxShadow: '0px 8px 16px rgba(0, 0, 0, 0.2)',
  }
};

// Animation durations
export const animation = {
  fast: 200,
  normal: 300,
  slow: 500,
};

// Create the theme object by extending React Native Paper's dark theme
export const theme: MD3Theme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: colors.primary.main,
    onPrimary: colors.text.primary,
    primaryContainer: colors.primary.dark,
    onPrimaryContainer: colors.text.primary,
    secondary: colors.secondary.main,
    onSecondary: colors.text.primary,
    secondaryContainer: colors.secondary.dark,
    onSecondaryContainer: colors.text.primary,
    tertiary: colors.accent.lavender,
    onTertiary: colors.text.primary,
    tertiaryContainer: '#4F378B', // A deeper purple
    onTertiaryContainer: colors.text.primary,
    background: colors.background.primary,
    onBackground: colors.text.primary,
    surface: colors.surface.main,
    onSurface: colors.text.primary,
    surfaceVariant: colors.surface.light,
    onSurfaceVariant: colors.text.secondary,
    outline: colors.border.medium,
    outlineVariant: colors.border.light,
    error: colors.feedback.error,
    onError: colors.text.primary,
    errorContainer: '#B3261E3D', // Semi-transparent error
    onErrorContainer: colors.text.primary,
  },
  // Use the default font scaling
};

// Set up custom fonts for components
export const customFonts = {
  headingLarge: {
    fontFamily: baseFont,
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: 0,
    lineHeight: 40,
  },
  headingMedium: {
    fontFamily: baseFont,
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 0,
    lineHeight: 32,
  },
  headingSmall: {
    fontFamily: baseFont,
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 0,
    lineHeight: 28,
  },
  bodyLarge: {
    fontFamily: baseFont,
    fontSize: 16,
    fontWeight: 'normal',
    letterSpacing: 0.15,
    lineHeight: 24,
  },
  bodyMedium: {
    fontFamily: baseFont,
    fontSize: 14,
    fontWeight: 'normal',
    letterSpacing: 0.25,
    lineHeight: 20,
  },
  bodySmall: {
    fontFamily: baseFont,
    fontSize: 12,
    fontWeight: 'normal',
    letterSpacing: 0.4,
    lineHeight: 16,
  },
};

// Gradient presets for backgrounds and buttons
export const gradients = {
  background: [colors.background.primary, colors.background.secondary],
  primary: [colors.primary.light, colors.primary.main, colors.primary.dark],
  secondary: [colors.secondary.light, colors.secondary.main, colors.secondary.dark],
  success: [colors.feedback.success, colors.accent.green],
  progress: ['#A78BFA', '#8B5CF6'], // Purple gradient for charts
  card: ['rgba(40, 40, 70, 0.8)', 'rgba(30, 30, 50, 0.95)'],
};

export default { colors, customColors, customFonts, spacing, borderRadius, shadows, animation, theme, gradients }; 