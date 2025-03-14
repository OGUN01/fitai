import React from 'react';
import { Text as RNText, StyleSheet, TextStyle, TextProps as RNTextProps } from 'react-native';
import { customFonts, colors } from '../../theme/theme';

type TextVariant = 'headingLarge' | 'headingMedium' | 'headingSmall' | 'bodyLarge' | 'bodyMedium' | 'bodySmall';

interface TextProps extends RNTextProps {
  variant?: TextVariant;
  color?: string;
  align?: 'auto' | 'left' | 'right' | 'center' | 'justify';
  style?: TextStyle;
  children: React.ReactNode;
}

/**
 * Custom Text component that uses the app's typography system
 * It supports predefined variants and colors from the theme
 */
export const StyledText = ({ 
  variant = 'bodyMedium', 
  color = colors.text.primary, 
  align = 'left',
  style,
  children,
  ...props 
}: TextProps) => {
  return (
    <RNText
      style={[
        styles.base,
        customFonts[variant],
        { color, textAlign: align },
        style,
      ]}
      {...props}
    >
      {children}
    </RNText>
  );
};

const styles = StyleSheet.create({
  base: {
    // Any base styles for all text
  },
});

export default StyledText; 