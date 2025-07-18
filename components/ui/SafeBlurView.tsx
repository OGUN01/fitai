import React from 'react';
import { View, Platform, StyleSheet } from 'react-native';
import { BlurView as ExpoBlurView } from 'expo-blur';
import { NativeModules } from 'react-native';

// Define the props interface
interface SafeBlurViewProps {
  intensity?: number;
  tint?: 'light' | 'dark' | 'default';
  style?: any;
  children: React.ReactNode;
}

// Check if the native module is available
const isBlurViewAvailable = () => {
  // On web, the native module won't exist
  if (Platform.OS === 'web') return false;
  
  // Check if the native module exists
  try {
    if (!NativeModules.ExpoBlurView) {
      console.warn('ExpoBlurView native module not found, using fallback');
      return false;
    }
    return true;
  } catch (error) {
    console.warn('Error checking for ExpoBlurView module:', error);
    return false;
  }
};

// Check once at component definition time
const blurViewAvailable = isBlurViewAvailable();

/**
 * A safe BlurView component that uses expo-blur when available
 * and falls back to a semi-transparent View when not available
 */
export const SafeBlurView: React.FC<SafeBlurViewProps> = ({ 
  intensity = 10, 
  tint = 'default',
  style,
  children
}) => {
  // If BlurView is not available, use fallback immediately
  if (!blurViewAvailable) {
    // Determine background color based on tint
    let backgroundColor, borderColor;
    
    switch (tint) {
      case 'light':
        backgroundColor = `rgba(255, 255, 255, ${Math.min((intensity / 100) + 0.1, 0.9)})`;
        borderColor = `rgba(255, 255, 255, ${Math.min((intensity / 200) + 0.05, 0.2)})`;
        break;
      case 'dark':
        backgroundColor = `rgba(0, 0, 0, ${Math.min((intensity / 100) + 0.1, 0.9)})`;
        borderColor = `rgba(255, 255, 255, ${Math.min((intensity / 400), 0.1)})`;
        break;
      default:
        backgroundColor = `rgba(50, 50, 70, ${Math.min((intensity / 100) + 0.1, 0.9)})`;
        borderColor = `rgba(255, 255, 255, ${Math.min((intensity / 300), 0.15)})`;
    }
    
    // Use a regular View with semi-transparent background as fallback
    return (
      <View 
        style={[
          styles.fallbackBlur, 
          { 
            backgroundColor,
            borderColor,
            borderWidth: 0.5
          }, 
          style
        ]}
      >
        {children}
      </View>
    );
  }
  
  // If BlurView is available, use it
  return (
    <ExpoBlurView intensity={intensity} tint={tint} style={style}>
      {children}
    </ExpoBlurView>
  );
};

const styles = StyleSheet.create({
  fallbackBlur: {
    overflow: 'hidden',
    borderRadius: 8
  }
});

export default SafeBlurView; 