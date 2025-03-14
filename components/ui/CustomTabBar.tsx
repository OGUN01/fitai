import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, Modal, Dimensions, Animated } from 'react-native';
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
  { icon: 'stats-chart-outline' as IconName, label: 'Progress', action: () => router.push('/progress') },
  { icon: 'barbell-outline' as IconName, label: 'Log Workout', action: () => router.push('/workout') },
  { icon: 'restaurant-outline' as IconName, label: 'Log Meal', action: () => router.push('/nutrition') },
  { icon: 'body-outline' as IconName, label: 'Log Weight', action: () => router.push('/progress/body-details') },
];

// Animation values
const ANIMATION_DURATION = 300;
const BUTTON_SIZE = 54;

const CustomTabBar = ({ state, descriptors, navigation }: BottomTabBarProps) => {
  const [fabOpen, setFabOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const scaleAnim = React.useRef(new Animated.Value(0)).current;
  const opacityAnim = React.useRef(new Animated.Value(0)).current;

  // Debug: log all route information
  console.log("All routes in state:", JSON.stringify(state.routes, null, 2));
  console.log("State index:", state.index);
  
  // Add a timeout to log route details after component mounts
  useEffect(() => {
    setTimeout(() => {
      console.log("Routes after timeout:", JSON.stringify(state.routes, null, 2));
      console.log("Descriptors keys:", Object.keys(descriptors));
    }, 1000);
  }, []);

  // Handle FAB press
  const toggleFab = () => {
    // Open the action menu instead of direct navigation
    setFabOpen(!fabOpen);
    
    if (!fabOpen) {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
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
              onPress={() => router.push('/home')}
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
              onPress={() => router.push('/workout')}
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
              onPress={() => router.push('/nutrition')}
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
              onPress={() => router.push('/profile')}
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
            <Ionicons name="add" size={32} color={colors.background.primary} />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Modal for quick actions */}
      <Modal
        visible={fabOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setFabOpen(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setFabOpen(false)}
        >
          <Animated.View style={[styles.actionContainer, { transform: [{ scale: scaleAnim }] }]}>
            {fabActions.map((action, index) => (
              <Animated.View 
                key={index}
                style={[
                  styles.actionButton,
                  { 
                    opacity: opacityAnim,
                    transform: [{ translateY: opacityAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [20 * (fabActions.length - index), 0]
                    }) }] 
                  }
                ]}
              >
                <TouchableOpacity 
                  style={styles.actionTouchable}
                  onPress={() => {
                    setFabOpen(false);
                    action.action();
                  }}
                >
                  <LinearGradient
                    colors={[colors.primary.main, colors.primary.dark]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.actionGradient}
                  >
                    <Ionicons name={action.icon} size={24} color={colors.background.primary} />
                  </LinearGradient>
                  <Text style={styles.actionLabel}>{action.label}</Text>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </Animated.View>
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
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
    padding: spacing.lg,
    paddingBottom: 100,
  },
  actionContainer: {
    marginBottom: spacing.xxl,
  },
  actionButton: {
    marginBottom: spacing.md,
  },
  actionTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionGradient: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.medium,
  },
  actionLabel: {
    marginLeft: spacing.md,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
});

export default CustomTabBar;
