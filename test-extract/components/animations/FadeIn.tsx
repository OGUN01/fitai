import React, { useEffect } from 'react';
import { StyleSheet, ViewProps, Platform } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  Easing,
  WithTimingConfig 
} from 'react-native-reanimated';

interface FadeInProps extends ViewProps {
  duration?: number;
  delay?: number;
  from?: number;
  style?: any;
  children: React.ReactNode;
}

/**
 * FadeIn component that animates children with a fade-in effect
 */
const FadeIn: React.FC<FadeInProps> = ({
  children,
  duration = 500,
  delay = 0,
  from = 0,
  style,
  ...props
}) => {
  const opacity = useSharedValue(from);

  const timingConfig: WithTimingConfig = {
    duration,
    easing: Easing.bezier(0.25, 0.1, 0.25, 1)
  };

  useEffect(() => {
    // Add a small delay to prevent animation issues on web
    const timeoutId = setTimeout(() => {
      opacity.value = withTiming(1, timingConfig);
    }, delay);
    
    return () => clearTimeout(timeoutId);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value
  }));

  // For web compatibility, provide a fallback rendering without animations
  if (Platform.OS === 'web') {
    return (
      <Animated.View
        style={[{opacity: 1}, style]}
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

export default FadeIn;
