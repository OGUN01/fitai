import React, { useEffect } from 'react';
import { StyleSheet, ViewProps, Platform } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  Easing,
  WithTimingConfig 
} from 'react-native-reanimated';

type Direction = 'up' | 'down' | 'left' | 'right';

interface SlideInProps extends ViewProps {
  duration?: number;
  delay?: number;
  distance?: number;
  direction?: Direction;
  style?: any;
  children: React.ReactNode;
}

/**
 * SlideIn component that animates children with a slide-in effect
 */
const SlideIn: React.FC<SlideInProps> = ({
  children,
  duration = 500,
  delay = 0,
  distance = 50,
  direction = 'up',
  style,
  ...props
}) => {
  const translateX = useSharedValue(direction === 'left' ? -distance : direction === 'right' ? distance : 0);
  const translateY = useSharedValue(direction === 'up' ? distance : direction === 'down' ? -distance : 0);
  const opacity = useSharedValue(0);

  const timingConfig: WithTimingConfig = {
    duration,
    easing: Easing.bezier(0.25, 0.1, 0.25, 1)
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      translateX.value = withTiming(0, timingConfig);
      translateY.value = withTiming(0, timingConfig);
      opacity.value = withTiming(1, timingConfig);
    }, delay);
    
    return () => clearTimeout(timeoutId);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value }
    ] as any,
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

export default SlideIn;
