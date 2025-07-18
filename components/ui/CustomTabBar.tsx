import React, { useState, useEffect, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Modal, Dimensions, Animated, Easing } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { router } from 'expo-router';
import { colors, borderRadius, spacing, shadows } from '../../theme/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ROUTES } from '../../constants/navigation';

// Define the icon type
type IconName = React.ComponentProps<typeof Ionicons>['name'];

// Define tab configuration
const tabConfig = {
  'home': { icon: 'home-outline' as IconName, activeIcon: 'home' as IconName, label: 'Home' },
  'workout': { icon: 'fitness-outline' as IconName, activeIcon: 'fitness' as IconName, label: 'Workout' },
  'nutrition': { icon: 'restaurant-outline' as IconName, activeIcon: 'restaurant' as IconName, label: 'Diet' },
  'progress': { icon: 'stats-chart-outline' as IconName, activeIcon: 'stats-chart' as IconName, label: 'Progress' },
  'profile': { icon: 'person-outline' as IconName, activeIcon: 'person' as IconName, label: 'Profile' },
};

// Define quick actions for the FAB
const fabActions = [
  { icon: 'stats-chart-outline' as IconName, label: 'Progress', action: () => router.push('/(tabs)/progress') },
  { icon: 'camera-outline' as IconName, label: 'Body Analysis', action: () => router.push('/(tabs)/progress/body-details') },
];

// Animation values
const ANIMATION_DURATION = 300;
const BUTTON_SIZE = 54;

const CustomTabBar = ({ state, descriptors, navigation }: BottomTabBarProps) => {
  const [fabOpen, setFabOpen] = useState(false);
  const insets = useSafeAreaInsets();
  
  // Create stable animation references
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const fabRotation = useRef(new Animated.Value(0)).current;
  const { height: screenHeight, width: screenWidth } = Dimensions.get('window');
  
  // Initialize animation values in a stable way
  const actionAnimations = useRef<Array<{
    translateY: Animated.Value;
    scale: Animated.Value;
    opacity: Animated.Value;
  }> | null>(null);
  
  // Initialize animation values only once
  useEffect(() => {
    if (!actionAnimations.current) {
      actionAnimations.current = fabActions.map(() => ({
        translateY: new Animated.Value(0),
        scale: new Animated.Value(0),
        opacity: new Animated.Value(0),
      }));
    }
  }, []);
  
  // Safe setValue function to avoid "undefined" errors
  const safeSetValue = (animValue: Animated.Value | undefined, value: number) => {
    if (animValue && typeof animValue.setValue === 'function') {
      animValue.setValue(value);
    }
  };

  // Reset animations when component unmounts
  useEffect(() => {
    return () => {
      // Only reset if values exist
      safeSetValue(backdropOpacity, 0);
      safeSetValue(fabRotation, 0);
      
      // Safely reset animation values
      if (actionAnimations.current) {
        actionAnimations.current.forEach(anim => {
          if (anim) {
            safeSetValue(anim.translateY, 0);
            safeSetValue(anim.scale, 0);
            safeSetValue(anim.opacity, 0);
          }
        });
      }
    };
  }, []);

  // Handle FAB press with refined animations
  const toggleFab = () => {
    if (!fabOpen) {
      // Open the menu with smooth animations
      openMenu();
    } else {
      // Close the menu with smooth animations
      closeMenu();
    }
    
    // Update state after animation starts
    setFabOpen(!fabOpen);
  };
  
  // Open menu with smooth animations - with safety checks
  const openMenu = () => {
    // Rotate the FAB plus icon to "X"
    Animated.timing(fabRotation, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
      easing: Easing.bezier(0.175, 0.885, 0.32, 1.275),
    }).start();
    
    // Fade in backdrop with subtle ease
    Animated.timing(backdropOpacity, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
      easing: Easing.out(Easing.cubic),
    }).start();
    
    // Make sure actionAnimations is initialized
    if (!actionAnimations.current) return;
    
    // Animate each action button with staggered timing
    actionAnimations.current.forEach((anim, index) => {
      if (!anim) return;
      
      // Reset values before animating - with safety checks
      safeSetValue(anim.translateY, 20);
      safeSetValue(anim.scale, 0.6);
      safeSetValue(anim.opacity, 0);
      
      // Staggered delay for each button
      const delay = 80 + (index * 50);
      
      // Translate Y animation - pop up from FAB
      Animated.timing(anim.translateY, {
        toValue: -90 - (index * 60),
        duration: 400,
        delay,
        useNativeDriver: true,
        easing: Easing.out(Easing.back(1.5)),
      }).start();
      
      // Scale animation - grow from small to full size with slight bounce
      Animated.timing(anim.scale, {
        toValue: 1,
        duration: 350,
        delay,
        useNativeDriver: true,
        easing: Easing.bezier(0.175, 0.885, 0.32, 1.175), // Custom elastic effect
      }).start();
      
      // Opacity animation - fade in smoothly
      Animated.timing(anim.opacity, {
        toValue: 1,
        duration: 300,
        delay,
        useNativeDriver: true,
        easing: Easing.in(Easing.cubic),
      }).start();
    });
  };
  
  // Close menu with smooth animations - with safety checks
  const closeMenu = () => {
    // Rotate FAB back to plus icon
    Animated.timing(fabRotation, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
      easing: Easing.bezier(0.35, 0.01, 0.7, 1),
    }).start();
    
    // Fade out backdrop
    Animated.timing(backdropOpacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
      easing: Easing.out(Easing.cubic),
    }).start();
    
    // Make sure actionAnimations is initialized
    if (!actionAnimations.current) return;
    
    // Animate action buttons in reverse order (last button first)
    [...actionAnimations.current].reverse().forEach((anim, index) => {
      if (!anim) return;
      
      const delay = index * 30; // Shorter staggered delays for closing
      
      // Fade out quickly
      Animated.timing(anim.opacity, {
        toValue: 0,
        duration: 200,
        delay,
        useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }).start();
      
      // Scale down with subtle timing
      Animated.timing(anim.scale, {
        toValue: 0.8,
        duration: 200,
        delay,
        useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }).start();
      
      // Move back to FAB position
      Animated.timing(anim.translateY, {
        toValue: 20,
        duration: 200,
        delay,
        useNativeDriver: true,
        easing: Easing.in(Easing.quad),
      }).start();
    });
  };
  
  // Calculate rotation interpolation for FAB icon
  const fabRotateInterpolation = fabRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  // Render action buttons with safety checks
  const renderActionButtons = () => {
    if (!actionAnimations.current) return null;
    
    return fabActions.map((action, index) => {
      const anim = actionAnimations.current?.[index];
      if (!anim) return null;
      
      return (
        <Animated.View 
          key={index}
          style={[
            styles.actionButtonWrapper,
            {
              transform: [
                { translateY: anim.translateY },
                { scale: anim.scale }
              ],
              opacity: anim.opacity,
            }
          ]}
        >
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => {
              closeMenu();
              setFabOpen(false);
              // Slight delay for smoother visual transition
              setTimeout(() => {
                action.action();
              }, 150);
            }}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={[colors.primary.main, colors.primary.dark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.actionIconContainer}
            >
              <Ionicons name={action.icon} size={22} color={colors.background.primary} />
            </LinearGradient>
            <Text style={styles.actionLabel}>{action.label}</Text>
          </TouchableOpacity>
        </Animated.View>
      );
    });
  };

  return (
    <>
      {/* Tab Bar Container */}
      <View style={[styles.container, { paddingBottom: insets.bottom }]}>
        <LinearGradient
          colors={[colors.background.secondary, colors.background.primary]}
          style={styles.background}
        >
          {/* TabBar Content */}
          <View style={styles.tabsContainer}>
            {/* Home Tab */}
            <TouchableOpacity 
              style={styles.tab}
              onPress={() => router.push('/(tabs)/home')}
            >
              <Ionicons 
                name={state.routes.some(r => r.name === 'home' && state.routes.indexOf(r) === state.index) ? 'home' : 'home-outline'} 
                size={24} 
                color={state.routes.some(r => r.name === 'home' && state.routes.indexOf(r) === state.index) ? colors.primary.main : colors.text.muted} 
              />
              <Text style={[styles.tabLabel, { 
                color: state.routes.some(r => r.name === 'home' && state.routes.indexOf(r) === state.index) ? colors.primary.main : colors.text.muted 
              }]}>Home</Text>
            </TouchableOpacity>

            {/* Workout Tab */}
            <TouchableOpacity 
              style={styles.tab}
              onPress={() => router.push('/(tabs)/workout')}
            >
              <Ionicons 
                name={state.routes.some(r => r.name === 'workout' && state.routes.indexOf(r) === state.index) ? 'fitness' : 'fitness-outline'} 
                size={24} 
                color={state.routes.some(r => r.name === 'workout' && state.routes.indexOf(r) === state.index) ? colors.primary.main : colors.text.muted} 
              />
              <Text style={[styles.tabLabel, { 
                color: state.routes.some(r => r.name === 'workout' && state.routes.indexOf(r) === state.index) ? colors.primary.main : colors.text.muted 
              }]}>Workout</Text>
            </TouchableOpacity>

            {/* FAB Button Spacer - Empty space for the FAB */}
            <View style={styles.fabSpacer} />

            {/* Diet Tab */}
            <TouchableOpacity 
              style={styles.tab}
              onPress={() => router.push('/(tabs)/nutrition')}
            >
              <Ionicons 
                name={state.routes.some(r => r.name === 'nutrition' && state.routes.indexOf(r) === state.index) ? 'restaurant' : 'restaurant-outline'} 
                size={24} 
                color={state.routes.some(r => r.name === 'nutrition' && state.routes.indexOf(r) === state.index) ? colors.primary.main : colors.text.muted} 
              />
              <Text style={[styles.tabLabel, { 
                color: state.routes.some(r => r.name === 'nutrition' && state.routes.indexOf(r) === state.index) ? colors.primary.main : colors.text.muted 
              }]}>Diet</Text>
            </TouchableOpacity>

            {/* Profile Tab */}
            <TouchableOpacity 
              style={styles.tab}
              onPress={() => router.push('/(tabs)/profile')}
            >
              <Ionicons 
                name={state.routes.some(r => r.name === 'profile' && state.routes.indexOf(r) === state.index) ? 'person' : 'person-outline'} 
                size={24} 
                color={state.routes.some(r => r.name === 'profile' && state.routes.indexOf(r) === state.index) ? colors.primary.main : colors.text.muted} 
              />
              <Text style={[styles.tabLabel, { 
                color: state.routes.some(r => r.name === 'profile' && state.routes.indexOf(r) === state.index) ? colors.primary.main : colors.text.muted 
              }]}>Profile</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>

      {/* FAB Button - Floating above tab bar */}
      <View style={styles.fabContainer}>
        <TouchableOpacity 
          style={styles.fab}
          onPress={toggleFab}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={[colors.primary.main, colors.primary.dark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.fabGradient}
          >
            <Animated.View style={{
              transform: [{ rotate: fabRotateInterpolation }]
            }}>
              <Ionicons name="add" size={32} color={colors.background.primary} />
            </Animated.View>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* FAB Menu Overlay */}
      <Modal
        visible={fabOpen}
        transparent={true}
        animationType="none"
        onRequestClose={() => {
          closeMenu();
          setFabOpen(false);
        }}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => {
            closeMenu();
            setFabOpen(false);
          }}
        >
          {/* Animated backdrop */}
          <Animated.View 
            style={[
              styles.backdrop, 
              { opacity: backdropOpacity }
            ]} 
          />
          
          {/* Action buttons - using the safe render function */}
          {renderActionButtons()}
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },
  background: {
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    ...shadows.medium,
  },
  tabsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.sm,
    height: 60,
    paddingBottom: spacing.xs,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
  tabLabel: {
    fontSize: 12,
    marginTop: 2,
    textAlign: 'center',
  },
  fabSpacer: {
    width: BUTTON_SIZE + spacing.md,
    height: 40,
  },
  fabContainer: {
    position: 'absolute',
    alignSelf: 'center',
    width: '100%',
    bottom: 30,
    alignItems: 'center',
    zIndex: 10,
  },
  fab: {
    height: BUTTON_SIZE,
    width: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    ...shadows.large,
  },
  fabGradient: {
    width: '100%',
    height: '100%',
    borderRadius: BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  actionButtonWrapper: {
    position: 'absolute',
    bottom: 30, // Same as FAB position
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: spacing.xl,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 30, 45, 0.9)',
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    width: '85%',
    ...shadows.medium,
  },
  actionIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  actionLabel: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  }
});

export default CustomTabBar;
