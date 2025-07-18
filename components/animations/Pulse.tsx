import React, { useEffect } from 'react';
import { StyleSheet, ViewProps, Platform } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withRepeat,
  Easing,
  cancelAnimation,
  WithTimingConfig 
} from 'react-native-reanimated';

interface PulseProps extends ViewProps {
  duration?: number;
  delay?: number;
  minScale?: number;
  maxScale?: number;
  pulseCount?: number;
  style?: any;
  children: React.ReactNode;
}

/**
 * Pulse component that animates children with a pulsing effect
 */
const Pulse: React.FC<PulseProps> = ({
  children,
  duration = 1000,
  delay = 0,
  minScale = 0.95,
  maxScale = 1.05,
  pulseCount = -1, // -1 for infinite
  style,
  ...props
}) => {
  const scale = useSharedValue(1);
  
  const timingConfig: WithTimingConfig = {
    duration: duration / 2,
    easing: Easing.inOut(Easing.ease)
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      // Only perform animation on non-web platforms or when pulseCount is finite
      if (Platform.OS !== 'web' || pulseCount > 0) {
        scale.value = withRepeat(
          withTiming(maxScale, timingConfig), 
          pulseCount * 2, 
          true
        );
      }
    }, delay);
    
    return () => {
      clearTimeout(timeoutId);
      cancelAnimation(scale);
    };
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }] as any,
  }));

  // For web compatibility, provide a fallback rendering without animations
  if (Platform.OS === 'web') {
    return (
      <Animated.View
        style={[style]}
        {...props}
      >
        {children}
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[animatedStyle, style]}
      {...props}
    >
      {children}
    </Animated.View>
  );
};

export default Pulse;
