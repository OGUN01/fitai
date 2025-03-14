import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { gradients } from '../../theme/theme';

type GradientType = 'background' | 'primary' | 'secondary' | 'success' | 'progress' | 'card';

interface GradientProps {
  type?: GradientType;
  colors?: string[];
  style?: ViewStyle;
  children?: React.ReactNode;
}

/**
 * A reusable gradient component that can be used as a background or container
 * with predefined gradient types from the theme.
 */
export const Gradient = ({ 
  type = 'background', 
  colors, 
  style, 
  children 
}: GradientProps) => {
  // Use the provided colors or get from the predefined gradients
  const gradientColors = colors || gradients[type];

  return (
    <LinearGradient
      colors={gradientColors}
      style={[styles.gradient, style]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      {children}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
});

export default Gradient; 