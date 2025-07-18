import { MD3DarkTheme, MD3LightTheme } from 'react-native-paper';

// Define custom colors
const customColors = {
  primary: '#6200EE', // Main brand color
  secondary: '#03DAC6', // Secondary brand color
  tertiary: '#FF9800', // For accent elements
  background: '#FFFFFF', // App background
  surface: '#F5F5F5', // Card backgrounds
  error: '#B00020', // Error state color
  success: '#4CAF50', // Success state color
  warning: '#FFC107', // Warning state color
  info: '#2196F3', // Information state color
  
  // Custom colors specific to fitness app
  workoutPrimary: '#FF5722', // For workout-related elements
  nutritionPrimary: '#8BC34A', // For nutrition-related elements
  progressPrimary: '#3F51B5', // For progress-related elements
  waterTracker: '#03A9F4', // For water tracking elements
};

// Light theme
export const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    ...customColors,
  },
  roundness: 8,
};

// Dark theme
export const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    ...customColors,
    background: '#121212',
    surface: '#1E1E1E',
  },
  roundness: 8,
};

// Typography
export const typography = {
  fontFamily: {
    regular: 'System',
    medium: 'System',
    light: 'System',
    thin: 'System',
  },
  fontSize: {
    small: 12,
    medium: 14,
    large: 16,
    xlarge: 20,
    xxlarge: 24,
    xxxlarge: 32,
  },
};

// Spacing
export const spacing = {
  xs: 4,
  s: 8,
  m: 16,
  l: 24,
  xl: 32,
  xxl: 48,
};

// Default theme export (light theme)
export default lightTheme;
