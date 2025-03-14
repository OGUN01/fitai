import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, ViewStyle, Platform } from 'react-native';
import LottieView from 'lottie-react-native';
import { Text } from 'react-native-paper';
import { colors } from '../../theme/theme';

// Define available animation types
type AnimationType = 'confetti' | 'success' | 'achievement' | 'streak';

interface CelebrationProps {
  visible: boolean;
  type?: AnimationType;
  message?: string;
  autoPlay?: boolean;
  loop?: boolean;
  duration?: number;
  onAnimationFinish?: () => void;
  style?: ViewStyle;
}

/**
 * Celebration component that shows animated celebration effects
 * using Lottie animations with optional text message
 */
const Celebration: React.FC<CelebrationProps> = ({
  visible,
  type = 'confetti',
  message,
  autoPlay = true,
  loop = false,
  duration = 2000,
  onAnimationFinish,
  style
}) => {
  const animationRef = useRef<LottieView>(null);

  // Map of animation types to their source files
  const animationSources = {
    confetti: require('../../assets/animations/confetti.json'),
    success: require('../../assets/animations/success.json'),
    achievement: require('../../assets/animations/achievement.json'),
    streak: require('../../assets/animations/streak.json')
  };

  useEffect(() => {
    if (visible && autoPlay && animationRef.current) {
      animationRef.current.play();
      
      if (!loop && onAnimationFinish) {
        const timer = setTimeout(() => {
          onAnimationFinish();
        }, duration);
        
        return () => clearTimeout(timer);
      }
    }
  }, [visible, autoPlay]);

  if (!visible || Platform.OS === 'web') return null;

  return (
    <View style={[styles.container, style]}>
      <LottieView
        ref={animationRef}
        source={animationSources[type]}
        style={styles.animation}
        autoPlay={autoPlay}
        loop={loop}
      />
      {message && (
        <Text variant="headlineSmall" style={styles.message}>
          {message}
        </Text>
      )}
    </View>
  );
};

// Use Platform.select to provide platform-specific styles
const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  animation: {
    width: 300,
    height: 300,
  },
  message: {
    textAlign: 'center',
    marginTop: 20,
    color: '#ffffff',
    fontWeight: 'bold',
    ...Platform.select({
      web: {
        textShadow: '1px 1px 3px rgba(0, 0, 0, 0.75)',
      },
      default: {
        // Native platforms use these properties
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
      },
    }),
  },
});

export default Celebration;
