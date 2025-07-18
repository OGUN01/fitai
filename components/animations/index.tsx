import React, { useEffect, useRef, ReactNode } from 'react';
import { Animated, ViewStyle } from 'react-native';

interface AnimationProps {
  children: ReactNode;
  style?: ViewStyle;
  duration?: number;
  delay?: number;
}

interface DirectionalAnimationProps extends AnimationProps {
  distance?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
}

interface FadeAnimationProps extends AnimationProps {
  from?: number;
}

/**
 * FadeIn animation component
 * Fades in its children from a specified opacity to 1
 */
export const FadeIn: React.FC<FadeAnimationProps> = ({ 
  children, 
  style = {}, 
  duration = 500, 
  delay = 0,
  from = 0.3
}) => {
  const opacity = useRef(new Animated.Value(from)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration,
      delay,
      useNativeDriver: true,
    }).start();
  }, [opacity, duration, delay]);

  return (
    <Animated.View style={[style, { opacity }]}>
      {children}
    </Animated.View>
  );
};

/**
 * SlideIn animation component
 * Slides in its children from a specified direction
 */
export const SlideIn: React.FC<DirectionalAnimationProps> = ({ 
  children, 
  style = {}, 
  duration = 500, 
  delay = 0,
  distance = 50,
  direction = 'up'
}) => {
  const translateX = useRef(new Animated.Value(
    direction === 'left' ? -distance : (direction === 'right' ? distance : 0)
  )).current;
  
  const translateY = useRef(new Animated.Value(
    direction === 'up' ? -distance : (direction === 'down' ? distance : 0)
  )).current;

  useEffect(() => {
    Animated.timing(translateX, {
      toValue: 0,
      duration,
      delay,
      useNativeDriver: true,
    }).start();
    
    Animated.timing(translateY, {
      toValue: 0,
      duration,
      delay,
      useNativeDriver: true,
    }).start();
  }, [translateX, translateY, duration, delay]);

  return (
    <Animated.View 
      style={[
        style, 
        { 
          transform: [
            { translateX },
            { translateY }
          ]
        }
      ]}
    >
      {children}
    </Animated.View>
  );
};

/**
 * ScaleIn animation component
 * Scales in its children from a specified scale to 1
 */
export const ScaleIn: React.FC<FadeAnimationProps> = ({ 
  children, 
  style = {}, 
  duration = 500, 
  delay = 0,
  from = 0.8
}) => {
  const scale = useRef(new Animated.Value(from)).current;

  useEffect(() => {
    Animated.timing(scale, {
      toValue: 1,
      duration,
      delay,
      useNativeDriver: true,
    }).start();
  }, [scale, duration, delay]);

  return (
    <Animated.View style={[style, { transform: [{ scale }] }]}>
      {children}
    </Animated.View>
  );
};

/**
 * Pulse animation component
 * Creates a pulsing effect on its children
 */
export const Pulse: React.FC<AnimationProps> = ({ 
  children, 
  style = {}, 
  duration = 1500, 
  delay = 0
}) => {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulseAnimation = Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.05,
        duration: duration / 2,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: duration / 2,
        useNativeDriver: true,
      })
    ]);

    Animated.loop(pulseAnimation).start();

    return () => {
      scale.stopAnimation();
    };
  }, [scale, duration, delay]);

  return (
    <Animated.View style={[style, { transform: [{ scale }] }]}>
      {children}
    </Animated.View>
  );
};
