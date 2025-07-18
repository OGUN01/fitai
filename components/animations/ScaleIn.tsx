import React, { useEffect } from 'react';
import { StyleSheet, ViewProps, Platform } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withSpring,
  Easing,
  WithTimingConfig 
} from 'react-native-reanimated';

interface ScaleInProps extends ViewProps {
  duration?: number;
  delay?: number;
  from?: number;
  to?: number;
  overshoot?: boolean;
  style?: any;
  children: React.ReactNode;
}

/**
 * ScaleIn component that animates children with a scale-in effect
 */
const ScaleIn: React.FC<ScaleInProps> = ({
  children,
  duration = 500,
  delay = 0,
  from = 0.8,
  to = 1,
  overshoot = false,
  style,
  ...props
}) => {
  const scale = useSharedValue(from);
  const opacity = useSharedValue(0);

  const timingConfig: WithTimingConfig = {
    duration,
    easing: Easing.bezier(0.25, 0.1, 0.25, 1)
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      // Use spring animation with overshoot if specified
      if (overshoot) {
        scale.value = withSpring(to, {
          damping: 8,
          stiffness: 100,
          overshootClamping: false,
          mass: 1
        });
      } else {
        scale.value = withTiming(to, timingConfig);
      }
      opacity.value = withTiming(1, timingConfig);
    }, delay);
    
    return () => clearTimeout(timeoutId);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value
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

export default ScaleIn;
