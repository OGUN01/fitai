import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Image, Dimensions, Switch, Alert, Modal } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Avatar, useTheme, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, SlideInRight, FadeInDown } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import * as ExpoNotifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import Constants from 'expo-constants';

// Import from correct locations
import { useProfile } from '../../../contexts/ProfileContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useNotifications } from '../../../contexts/NotificationContext';
import { useStreak } from '../../../contexts/StreakContext';
import StyledText from '../../../components/ui/StyledText';
import { patternOverlayBase64 } from '../../../assets/images/pattern-overlay';
import { getWorkoutStats } from '../../../services/trackingService';
import NotificationService, { ReminderType } from '../../../services/notifications';

// Define the notification preferences type
type NotificationPreferences = {
  workout_notifications: boolean;
  meal_reminders: boolean;
  water_reminders: boolean;
};

// Define fitness goal type
type FitnessGoal = 'weight-loss' | 'muscle-gain' | 'improved-fitness';

// Default notification preferences
const DEFAULT_PREFERENCES: NotificationPreferences = {
  workout_notifications: true,
  meal_reminders: true,
  water_reminders: true,
};

// Get screen dimensions
const { width, height } = Dimensions.get('window');

// Custom colors for premium feel
const customColors = {
  gradients: {
    primary: ['#FF4B81', '#FF6B4B'],
    secondary: ['#593EFF', '#8F6CFA'],
    accent: ['#32CCFF', '#5ECAFF'],
    dark: ['#1A1A2E', '#16213E'],
    card: ['rgba(30,30,50,0.85)', 'rgba(20,20,35,0.9)'],
  },
  text: {
    primary: '#FFFFFF',
    secondary: 'rgba(255, 255, 255, 0.7)'
  }
};

export default function ProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { profile, updateProfile } = useProfile();
  const { currentStreak, syncStreakData } = useStreak();
  const insets = useSafeAreaInsets();
  
  // State for notification preferences
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>({
    workout_notifications: profile?.notification_preferences?.workout_notifications ?? DEFAULT_PREFERENCES.workout_notifications,
    meal_reminders: profile?.notification_preferences?.meal_reminders ?? DEFAULT_PREFERENCES.meal_reminders,
    water_reminders: profile?.notification_preferences?.water_reminders ?? DEFAULT_PREFERENCES.water_reminders
  });
  
  // Load notification preferences from profile when it changes
  useEffect(() => {
    if (profile?.notification_preferences) {
      setNotificationPreferences(profile.notification_preferences as NotificationPreferences);
    }
  }, [profile]);
  
  // New state variables for enhanced UI
  const [activityMetrics, setActivityMetrics] = useState({
    completionRate: 0,
    totalWorkouts: 0
  });
  const [statsLoading, setStatsLoading] = useState(false);
  const [showLoginAnimation, setShowLoginAnimation] = useState(false);
  
  // Use useFocusEffect to load stats when the tab comes into focus
  useFocusEffect(
    React.useCallback(() => {
      const loadProfileStats = async () => {
        setStatsLoading(true);
        try {
          // Sync and allow StreakContext to update its currentStreak
          await syncStreakData(); 

          // Fetch overall completionRate and totalWorkouts if profile.id exists (covers local and auth users)
          if (profile && profile.id) { 
            try {
              const overallStats = await getWorkoutStats(profile.id, 'all'); 
              setActivityMetrics({
                completionRate: overallStats.completionRate || 0,
                totalWorkouts: overallStats.completedWorkouts || 0,
              });
            } catch (statsError) {
              console.error(`Error fetching workout stats for user ${profile.id}:`, statsError);
              setActivityMetrics({ completionRate: 0, totalWorkouts: 0 }); // Default on error
            }
          } else {
            // No profile or no profile.id, default these stats
            setActivityMetrics({ completionRate: 0, totalWorkouts: 0 });
          }
        } catch (error) {
          // This catch block is for errors from syncStreakData or other general errors
          console.error("Error in loadProfileStats (outer try-catch):", error);
          setActivityMetrics({ completionRate: 0, totalWorkouts: 0 }); // Default on any outer error
        } finally {
          setStatsLoading(false);
        }
      };

      loadProfileStats();
    }, [profile, user, syncStreakData]) // Dependencies: profile (for profile.id), user (syncStreakData might use it), syncStreakData
  );
  
  // Add state for custom fitness goals modal
  const [showFitnessGoalsModal, setShowFitnessGoalsModal] = useState(false);
  const [savingGoal, setSavingGoal] = useState(false);
  
  // Haptic feedback for buttons - Added type for route
  const handlePress = (route: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      // Check if the route is valid
      if (!route) {
        console.error('Invalid route provided to handlePress');
        return;
      }
      
      // Add specific handling for edit-profile with fitness goals - platform-specific solution
      if (route === '/(tabs)/profile/edit-profile') {
        console.log('Navigating to fitness goals screen with platform-specific handling');
        
        // Use platform-specific navigation to avoid Android crashes
        if (Platform.OS === 'android') {
          // Show custom modal instead of Alert for Android
          setShowFitnessGoalsModal(true);
        } else {
          // For web and iOS, use normal navigation
          router.push(route);
        }
      } else {
        // Navigate to other routes normally
        router.push(route);
      }
    } catch (error) {
      console.error('Navigation error in handlePress:', error);
      // Fallback navigation for safety
      try {
        router.push('/(tabs)/profile');
      } catch (innerError) {
        console.error('Fallback navigation failed:', innerError);
      }
    }
  };
  
  // Update to handle edit profile button press
  const handleEditProfilePress = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      // Use the same personal-information route for all platforms for consistency
      // This addresses the "Unmatched Route" error on Android
      router.push('/(settings)/personal-information');
    } catch (error) {
      console.error('Navigation error:', error);
      // Show an error message to the user
      Alert.alert(
        "Navigation Error",
        "Could not open the profile editor. Please try again."
      );
    }
  };

  // Function to update fitness goal - Added type for goal
  const updateFitnessGoal = async (goal: FitnessGoal) => {
    try {
      setSavingGoal(true);
      
      // Provide haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Get displayable goal name
      let goalDisplayName = 'Weight Loss';
      if (goal === 'muscle-gain') goalDisplayName = 'Muscle Gain';
      if (goal === 'improved-fitness') goalDisplayName = 'Improved Fitness';
      
      // Update the profile directly
      // Note: Ideally, this should also update the ProfileContext state
      // and potentially sync with the server if the user is logged in.
      // For now, it only updates local storage.
      const localProfileData = await AsyncStorage.getItem('local_profile');
      if (localProfileData) {
        const profileData = JSON.parse(localProfileData);
        profileData.fitness_goal = goal; // Assuming fitness_goal is the correct field
        await AsyncStorage.setItem('local_profile', JSON.stringify(profileData));

        // If logged in, also update context and server
        if (user && profile && updateProfile) {
            await updateProfile({ fitness_goals: [goal] }); // Update context/server
        }
        
        // Close modal after successful update
        setTimeout(() => {
          setSavingGoal(false);
          setShowFitnessGoalsModal(false);
          // Show success message
          Alert.alert("Success", `Your fitness goal has been updated to ${goalDisplayName}`);
        }, 500);
      } else {
         // Handle case where there's no local profile (e.g., first time or error)
         console.warn("No local profile found to update fitness goal.");
         // Optionally, update context directly if logged in
         if (user && profile && updateProfile) {
            await updateProfile({ fitness_goals: [goal] });
            setTimeout(() => {
              setSavingGoal(false);
              setShowFitnessGoalsModal(false);
              Alert.alert("Success", `Your fitness goal has been updated to ${goalDisplayName}`);
            }, 500);
         } else {
            setSavingGoal(false); // Reset saving state even if update fails
         }
      }
    } catch (error) {
      console.error('Error updating fitness goal:', error);
      Alert.alert("Error", "Failed to update fitness goal. Please try again.");
      setSavingGoal(false);
    }
  };
  
  // Handle login button animation
  const startLoginAnimation = () => {
    setShowLoginAnimation(true);
    setTimeout(() => {
      router.push('/(auth)/signin');
    }, 600);
  };

  // Handle notification toggle
  const handleToggleNotification = async (type: keyof NotificationPreferences) => {
    try {
      // Add haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      // Check for notification permissions
      const { status } = await ExpoNotifications.getPermissionsAsync();
      
      if (status !== 'granted') {
        // Request permissions if not granted
        const { status: newStatus } = await ExpoNotifications.requestPermissionsAsync();
        if (newStatus !== 'granted') {
          Alert.alert(
            "Permission Required",
            "We need notification permissions to send you reminders.",
            [{ text: "OK" }]
          );
          return;
        }
      }
      
      // Toggle the specific notification preference
      const updatedPreferences = {
        ...notificationPreferences,
        [type]: !(notificationPreferences?.[type] ?? DEFAULT_PREFERENCES[type])
      };
      
      // Update state
      setNotificationPreferences(updatedPreferences);
      
      // Save to profile if authenticated
      if (user && profile) {
        await updateProfile({
          notification_preferences: updatedPreferences
        });
        console.log('Notification preferences updated in profile');
      } else {
        // Save to local storage for local users
        const localProfile = await AsyncStorage.getItem('local_profile');
        if (localProfile) {
          const parsedProfile = JSON.parse(localProfile);
          const updatedLocalProfile = {
            ...parsedProfile,
            notification_preferences: updatedPreferences
          };
          await AsyncStorage.setItem('local_profile', JSON.stringify(updatedLocalProfile));
          console.log('Notification preferences updated locally');
        }
      }

      // Update notification service settings based on the type
      const reminderType = type === 'workout_notifications' ? ReminderType.WORKOUT :
                          type === 'meal_reminders' ? ReminderType.MEAL :
                          ReminderType.WATER;

      await NotificationService.updateReminderSettings(
        reminderType,
        updatedPreferences[type],
        profile || undefined
      );

      console.log(`Updated ${type} to ${updatedPreferences[type]} and scheduled notifications`);

    } catch (error) {
      console.error('Error updating notification preferences:', error);
      Alert.alert(
        "Error",
        "Failed to update notification preferences. Please try again."
      );
    }
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]} edges={['left', 'right']}>
      <StatusBar style="light" />
      
      {/* Custom Fitness Goals Modal - WITH STYLES APPLIED */}
      <Modal
        visible={showFitnessGoalsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFitnessGoalsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View 
            entering={FadeInDown.duration(300)}
            style={styles.modalContainer}
          >
            <LinearGradient
              colors={['#1E1E3A', '#121232']}
              style={styles.modalGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            >
              <View style={styles.modalHeader}>
                <MaterialCommunityIcons name="run-fast" size={24} color="#FF9190" />
                <StyledText variant="headingMedium" style={styles.modalTitle}>
                  Fitness Goals
                </StyledText>
                <TouchableOpacity 
                  onPress={() => setShowFitnessGoalsModal(false)}
                  style={styles.closeButton}
                >
                  <MaterialCommunityIcons name="close" size={22} color="rgba(255, 255, 255, 0.7)" />
                </TouchableOpacity>
              </View>
              
              <StyledText variant="bodyMedium" style={styles.modalDescription}>
                Choose your primary fitness goal:
              </StyledText>
              
              {/* Weight Loss Option */}
                <TouchableOpacity
                style={styles.goalButton}
                  onPress={() => updateFitnessGoal('weight-loss')}
                  disabled={savingGoal}
                >
                  <LinearGradient
                    colors={['rgba(255,145,144,0.6)', 'rgba(255,145,144,0.3)']}
                  style={styles.goalButtonGradient}
                    start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  >
                  <View style={styles.goalIcon}>
                    <FontAwesome5 name="weight" size={20} color="#fff" />
                      </View>
                  <View style={styles.goalButtonTextContainer}>
                    <Text style={styles.goalButtonText}>Weight Loss</Text>
                    <Text style={styles.goalButtonSubtext}>Focus on calorie deficit & fat loss</Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
                
              {/* Muscle Gain Option */}
                <TouchableOpacity
                style={styles.goalButton}
                  onPress={() => updateFitnessGoal('muscle-gain')}
                  disabled={savingGoal}
                >
                  <LinearGradient
                    colors={['rgba(94,114,235,0.6)', 'rgba(94,114,235,0.3)']}
                  style={styles.goalButtonGradient}
                    start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  >
                  <View style={styles.goalIcon}>
                    <MaterialCommunityIcons name="arm-flex" size={20} color="#fff" />
                      </View>
                  <View style={styles.goalButtonTextContainer}>
                    <Text style={styles.goalButtonText}>Muscle Gain</Text>
                    <Text style={styles.goalButtonSubtext}>Build strength & muscle mass</Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
                
              {/* Improved Fitness Option */}
                <TouchableOpacity
                style={styles.goalButton}
                  onPress={() => updateFitnessGoal('improved-fitness')}
                  disabled={savingGoal}
                >
                  <LinearGradient
                    colors={['rgba(64,223,217,0.6)', 'rgba(64,223,217,0.3)']}
                  style={styles.goalButtonGradient}
                    start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  >
                  <View style={styles.goalIcon}>
                    <MaterialCommunityIcons name="run" size={20} color="#fff" />
                      </View>
                  <View style={styles.goalButtonTextContainer}>
                    <Text style={styles.goalButtonText}>Improved Fitness</Text>
                    <Text style={styles.goalButtonSubtext}>Enhance overall health & stamina</Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              
              {savingGoal && (
                <View style={styles.savingIndicator}>
                  <ActivityIndicator color="#FF9190" size="small" />
                  <StyledText variant="bodyMedium" style={styles.savingText}>
                    Updating...
                  </StyledText>
                </View>
              )}
              
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowFitnessGoalsModal(false)}
                disabled={savingGoal}
              >
                <StyledText variant="bodyMedium" style={styles.cancelButtonText}>
                  Cancel
                </StyledText>
              </TouchableOpacity>
            </LinearGradient>
          </Animated.View>
        </View>
      </Modal>
      
      {/* Premium gradient background with subtle pattern overlay */}
      <LinearGradient
        colors={['#121232', '#1A1A40']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />
      <Image 
        source={{ uri: patternOverlayBase64 }} 
        style={[
          StyleSheet.absoluteFillObject, 
          { opacity: 0.03, width, height }
        ]} 
        resizeMode="cover"
      />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Modern Header with Avatar */}
        <View style={styles.modernHeader}>
          <View style={styles.headerContent}>
            <Animated.View entering={FadeIn.duration(600)} style={styles.headerTitleContainer}>
              <StyledText variant="headingLarge" style={styles.modernTitle}>
                Profile
              </StyledText>
            </Animated.View>
            <TouchableOpacity
              style={styles.settingsButton}
              onPress={() => handlePress('/(settings)/notifications')}
            >
              <MaterialCommunityIcons name="cog-outline" size={24} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
          </View>
          
          {/* Profile Card with Gradient Background */}
          <Animated.View 
            entering={FadeIn.duration(700)}
            style={styles.modernProfileCard}
          >
            <LinearGradient
              colors={['rgba(50,60,120,0.6)', 'rgba(30,35,70,0.8)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.profileCardGradient}
            >
              <View style={styles.profileCardContent}>
                {/* Avatar Section */}
                <LinearGradient
                  colors={['#5E72EB', '#FF9190']}
                  style={styles.modernAvatarContainer}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Avatar.Text 
                    size={90} 
                    label={profile?.full_name ? profile.full_name.substring(0, 2).toUpperCase() : 'HS'} 
                    style={styles.modernAvatar}
                    labelStyle={styles.modernAvatarLabel}
                    color="#FFF"
                  />
                </LinearGradient>
                
                <View style={styles.profileDetailsContainer}>
                  <StyledText variant="headingMedium" style={styles.profileNameLarge}>
                    {profile?.full_name || 'Harsh Sharma'}
                  </StyledText>
                  
                  <View style={styles.modernBadge}>
                    <MaterialCommunityIcons 
                      name={user ? "check-decagram" : "account"} 
                      size={16} 
                      color={user ? "#5E72EB" : "#FF9190"} 
                    />
                    <StyledText variant="bodySmall" style={styles.modernBadgeText}>
                      {user ? 'Premium Member' : 'Local User'}
                    </StyledText>
                  </View>
                  
                  <TouchableOpacity
                    style={styles.editProfileButton}
                    onPress={handleEditProfilePress}
                  >
                    <LinearGradient
                      colors={['#5E72EB', '#FF9190']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.editProfileButtonGradient}
                    >
                      <StyledText variant="bodyMedium" style={styles.editProfileButtonText}>
                        Edit Profile
                      </StyledText>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
              
              {/* Stats Cards Row */}
              {(user || profile?.has_completed_onboarding) && (
                <View style={styles.statsCardsContainer}>
                  {/* Stat Card - Streak */}
                  <View style={styles.statCard}>
                    <LinearGradient
                      colors={['rgba(94,114,235,0.2)', 'rgba(94,114,235,0.05)']}
                      style={styles.statCardGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                    >
                      <View style={styles.statIconContainerNew}>
                        <MaterialCommunityIcons name="fire" size={18} color="#5E72EB" />
                      </View>
                      <StyledText variant="headingMedium" style={styles.statValueNew}>
                        {statsLoading ? 
                          <ActivityIndicator size={16} color="#5E72EB" /> : 
                          currentStreak}
                      </StyledText>
                      <StyledText variant="bodySmall" style={styles.statLabelNew}>
                        Day Streak
                      </StyledText>
                    </LinearGradient>
                  </View>
                  
                  {/* Stat Card - Completion */}
                  <View style={styles.statCard}>
                    <LinearGradient
                      colors={['rgba(255,145,144,0.2)', 'rgba(255,145,144,0.05)']}
                      style={styles.statCardGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                    >
                      <View style={styles.statIconContainerNew}>
                        <MaterialCommunityIcons name="percent" size={18} color="#FF9190" />
                      </View>
                      <StyledText variant="headingMedium" style={styles.statValueNew}>
                        {statsLoading ? 
                          <ActivityIndicator size={16} color="#FF9190" /> : 
                          `${activityMetrics.completionRate}%`}
                      </StyledText>
                      <StyledText variant="bodySmall" style={styles.statLabelNew}>
                        Completion
                      </StyledText>
                    </LinearGradient>
                  </View>
                  
                  {/* Stat Card - Total */}
                  <View style={styles.statCard}>
                    <LinearGradient
                      colors={['rgba(64,223,217,0.2)', 'rgba(64,223,217,0.05)']}
                      style={styles.statCardGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                    >
                      <View style={styles.statIconContainerNew}>
                        <MaterialCommunityIcons name="dumbbell" size={18} color="#40DFD9" />
                      </View>
                      <StyledText variant="headingMedium" style={styles.statValueNew}>
                        {statsLoading ? 
                          <ActivityIndicator size={16} color="#40DFD9" /> : 
                          activityMetrics.totalWorkouts}
                      </StyledText>
                      <StyledText variant="bodySmall" style={styles.statLabelNew}>
                        Workouts
                      </StyledText>
                    </LinearGradient>
                  </View>
                </View>
              )}
            </LinearGradient>
          </Animated.View>
        </View>
        
        {/* Login Banner - Redesigned (for non-authenticated users) */}
        {!user && (
          <Animated.View 
            entering={FadeIn.duration(500).delay(100)}
            style={styles.modernLoginBanner}
          >
            <LinearGradient
              colors={['rgba(94,114,235,0.15)', 'rgba(255,145,144,0.15)']}
              style={styles.loginBannerGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.loginBannerContent}>
                <View style={styles.loginBannerIcon}>
                  <MaterialCommunityIcons 
                    name="cloud-sync" 
                    size={30} 
                    color="#5E72EB" 
                  />
                </View>
                <View style={styles.loginBannerText}>
                  <StyledText variant="bodyLarge" style={styles.loginBannerTitle}>
                    Save Your Progress
                  </StyledText>
                  <StyledText variant="bodySmall" style={styles.loginBannerDescription}>
                    Create an account to sync your data across devices
                  </StyledText>
                </View>
              </View>
              <TouchableOpacity
                style={styles.loginBannerButton}
                onPress={startLoginAnimation}
              >
                <LinearGradient
                  colors={['#5E72EB', '#FF9190']}
                  style={styles.loginBannerButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <StyledText variant="bodyMedium" style={styles.loginBannerButtonText}>
                    Sign In
                  </StyledText>
                  <MaterialCommunityIcons name="arrow-right" size={18} color="white" />
                </LinearGradient>
              </TouchableOpacity>
            </LinearGradient>
          </Animated.View>
        )}
        
        {/* Main Content Sections */}
        <View style={styles.mainContent}>
          {/* Feature Sections with cards */}
          <Animated.View entering={FadeIn.duration(500).delay(200)}>
            <View style={styles.sectionLabelContainer}>
              <MaterialCommunityIcons name="account-circle-outline" size={22} color="#5E72EB" />
              <StyledText variant="headingSmall" style={styles.sectionLabelText}>
                Personal
              </StyledText>
            </View>
            
            <View style={styles.cardsContainer}>
              {/* Health & Fitness Card */}
              <TouchableOpacity
                style={styles.featureCard}
                onPress={() => handlePress('/(tabs)/progress/body-details')}
              >
                <LinearGradient
                  colors={['rgba(94,114,235,0.15)', 'rgba(94,114,235,0.05)']}
                  style={styles.featureCardGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                >
                  <View style={styles.featureCardIcon}>
                    <MaterialCommunityIcons name="scale-bathroom" size={24} color="#5E72EB" />
                  </View>
                  <StyledText variant="bodyMedium" style={styles.featureCardTitle}>
                    Body Metrics
                  </StyledText>
                  <StyledText variant="bodySmall" style={styles.featureCardDescription}>
                    Height, weight, measurements
                  </StyledText>
                </LinearGradient>
              </TouchableOpacity>
              
              {/* Fitness Goals Card */}
              <TouchableOpacity
                style={styles.featureCard}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowFitnessGoalsModal(true);
                }}
              >
                <LinearGradient
                  colors={['rgba(255,145,144,0.15)', 'rgba(255,145,144,0.05)']}
                  style={styles.featureCardGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                >
                  <View style={styles.featureCardIcon}>
                    <MaterialCommunityIcons name="run-fast" size={24} color="#FF9190" />
                  </View>
                  <StyledText variant="bodyMedium" style={styles.featureCardTitle}>
                    Fitness Goals
                  </StyledText>
                  <StyledText variant="bodySmall" style={styles.featureCardDescription}>
                    Weight, muscle, fitness targets
                  </StyledText>
                </LinearGradient>
              </TouchableOpacity>
              
              {/* Activity Level Card */}
              <TouchableOpacity
                style={styles.featureCard}
                onPress={() => handlePress('/(tabs)/progress')}
              >
                <LinearGradient
                  colors={['rgba(64,223,217,0.15)', 'rgba(64,223,217,0.05)']}
                  style={styles.featureCardGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                >
                  <View style={styles.featureCardIcon}>
                    <MaterialCommunityIcons name="heart-pulse" size={24} color="#40DFD9" />
                  </View>
                  <StyledText variant="bodyMedium" style={styles.featureCardTitle}>
                    Activity Level
                  </StyledText>
                  <StyledText variant="bodySmall" style={styles.featureCardDescription}>
                    Daily activity and intensity
                  </StyledText>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </Animated.View>
          
          {/* Notification Preferences Section */}
          <Animated.View entering={FadeIn.duration(500).delay(300)}>
            <View style={styles.sectionLabelContainer}>
              <MaterialCommunityIcons name="bell-outline" size={22} color="#FF9190" />
              <StyledText variant="headingSmall" style={styles.sectionLabelText}>
                Notifications
              </StyledText>
            </View>
            
            <View style={styles.notificationsCard}>
              <LinearGradient
                colors={['rgba(30,35,60,0.8)', 'rgba(25,30,55,0.8)']}
                style={styles.notificationsCardGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
              >
                {/* Workout Notification Toggle */}
                <View style={styles.notificationRow}>
                  <View style={styles.notificationIconContainer}>
                    <MaterialCommunityIcons name="dumbbell" size={22} color="#5E72EB" />
                  </View>
                  <View style={styles.notificationTextContainer}>
                    <StyledText variant="bodyMedium" style={styles.notificationTitle}>
                      Workout Reminders
                    </StyledText>
                    <StyledText variant="bodySmall" style={styles.notificationDescription}>
                      Get notified about scheduled workouts
                    </StyledText>
                  </View>
                  <Switch
                    value={notificationPreferences?.workout_notifications ?? DEFAULT_PREFERENCES.workout_notifications}
                    onValueChange={() => handleToggleNotification('workout_notifications')}
                    trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(94,114,235,0.3)' }}
                    thumbColor={notificationPreferences?.workout_notifications ? '#5E72EB' : '#f4f3f4'}
                    ios_backgroundColor="rgba(255,255,255,0.1)"
                  />
                </View>
                
                {/* Meal Notification Toggle */}
                <View style={styles.notificationRow}>
                  <View style={styles.notificationIconContainer}>
                    <MaterialCommunityIcons name="food-apple" size={22} color="#FF9190" />
                  </View>
                  <View style={styles.notificationTextContainer}>
                    <StyledText variant="bodyMedium" style={styles.notificationTitle}>
                      Meal Reminders
                    </StyledText>
                    <StyledText variant="bodySmall" style={styles.notificationDescription}>
                      Get reminded to log your meals
                    </StyledText>
                  </View>
                  <Switch
                    value={notificationPreferences?.meal_reminders ?? DEFAULT_PREFERENCES.meal_reminders}
                    onValueChange={() => handleToggleNotification('meal_reminders')}
                    trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(255,145,144,0.3)' }}
                    thumbColor={notificationPreferences?.meal_reminders ? '#FF9190' : '#f4f3f4'}
                    ios_backgroundColor="rgba(255,255,255,0.1)"
                  />
                </View>
                
                {/* Water Notification Toggle */}
                <View style={[styles.notificationRow, { borderBottomWidth: 0 }]}>
                  <View style={styles.notificationIconContainer}>
                    <MaterialCommunityIcons name="water" size={22} color="#40DFD9" />
                  </View>
                  <View style={styles.notificationTextContainer}>
                    <StyledText variant="bodyMedium" style={styles.notificationTitle}>
                      Water Reminders
                    </StyledText>
                    <StyledText variant="bodySmall" style={styles.notificationDescription}>
                      Get reminded to track water intake
                    </StyledText>
                  </View>
                  <Switch
                    value={notificationPreferences?.water_reminders ?? DEFAULT_PREFERENCES.water_reminders}
                    onValueChange={() => handleToggleNotification('water_reminders')}
                    trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(64,223,217,0.3)' }}
                    thumbColor={notificationPreferences?.water_reminders ? '#40DFD9' : '#f4f3f4'}
                    ios_backgroundColor="rgba(255,255,255,0.1)"
                  />
                </View>
              </LinearGradient>
            </View>
          </Animated.View>
          
          {/* Settings & Support Section */}
          <Animated.View entering={FadeIn.duration(500).delay(400)}>
            <View style={styles.sectionLabelContainer}>
              <MaterialCommunityIcons name="cog-outline" size={22} color="#40DFD9" />
              <StyledText variant="headingSmall" style={styles.sectionLabelText}>
                Settings & Support
              </StyledText>
            </View>
            
            <View style={styles.settingsCard}>
              <LinearGradient
                colors={['rgba(30,35,60,0.8)', 'rgba(25,30,55,0.8)']}
                style={styles.settingsCardGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
              >
                {/* App Settings Option */}
                <TouchableOpacity
                  style={styles.settingsRow}
                  onPress={() => handlePress('/(settings)/app-settings')}
                >
                  <View style={styles.settingsIconContainer}>
                    <MaterialCommunityIcons name="cellphone-cog" size={22} color="#5E72EB" />
                  </View>
                  <View style={styles.settingsTextContainer}>
                    <StyledText variant="bodyMedium" style={styles.settingsTitle}>
                      App Settings
                    </StyledText>
                    <StyledText variant="bodySmall" style={styles.settingsDescription}>
                      Customize your experience
                    </StyledText>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={22} color="rgba(255,255,255,0.5)" />
                </TouchableOpacity>
                
                {/* Personal Information Option */}
                <TouchableOpacity
                  style={styles.settingsRow}
                  onPress={() => handlePress('/(settings)/personal-information')}
                >
                  <View style={styles.settingsIconContainer}>
                    <MaterialCommunityIcons name="card-account-details-outline" size={22} color="#FF9190" />
                  </View>
                  <View style={styles.settingsTextContainer}>
                    <StyledText variant="bodyMedium" style={styles.settingsTitle}>
                      Personal Information
                    </StyledText>
                    <StyledText variant="bodySmall" style={styles.settingsDescription}>
                      Manage your profile details
                    </StyledText>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={22} color="rgba(255,255,255,0.5)" />
                </TouchableOpacity>
                
                {/* Debug Panel Option */}
                <TouchableOpacity
                  style={[styles.settingsRow, { borderBottomWidth: 0 }]}
                  onPress={() => handlePress('/(settings)/debug-panel')}
                >
                  <View style={styles.settingsIconContainer}>
                    <MaterialCommunityIcons name="code-tags" size={22} color="#40DFD9" />
                  </View>
                  <View style={styles.settingsTextContainer}>
                    <StyledText variant="bodyMedium" style={styles.settingsTitle}>
                      Debug Panel
                    </StyledText>
                    <StyledText variant="bodySmall" style={styles.settingsDescription}>
                      Technical options & diagnostics
                    </StyledText>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={22} color="rgba(255,255,255,0.5)" />
                </TouchableOpacity>
              </LinearGradient>
            </View>
          </Animated.View>
          
          {/* Version and Sign Out Section */}
          <Animated.View entering={FadeIn.duration(500).delay(500)} style={styles.footerContainer}>
            {user && (
              <TouchableOpacity
                style={styles.signOutButtonNew}
                onPress={signOut}
              >
                <LinearGradient
                  colors={['rgba(255,145,144,0.1)', 'rgba(255,145,144,0.05)']}
                  style={styles.signOutButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <MaterialCommunityIcons name="logout" size={18} color="#FF9190" />
                  <StyledText variant="bodyMedium" style={styles.signOutButtonText}>
                    Sign Out
                  </StyledText>
                </LinearGradient>
              </TouchableOpacity>
            )}
            
            <View style={styles.versionContainer}>
              <StyledText variant="bodySmall" style={styles.versionText}>
                Version {Constants.expoConfig?.version || '8'}
              </StyledText>
            </View>
          </Animated.View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121232',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  
  // Modern Header
  modernHeader: {
    paddingTop: 16,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modernTitle: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Modernized Profile Card
  modernProfileCard: {
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  profileCardGradient: {
    borderRadius: 24,
    padding: 24,
  },
  profileCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  modernAvatarContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  modernAvatar: {
    backgroundColor: 'transparent',
  },
  modernAvatarLabel: {
    fontSize: 34,
    fontWeight: 'bold',
  },
  profileDetailsContainer: {
    flex: 1,
  },
  profileNameLarge: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  modernBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  modernBadgeText: {
    color: 'rgba(255,255,255,0.9)',
    marginLeft: 6,
  },
  editProfileButton: {
    borderRadius: 8,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  editProfileButtonGradient: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  editProfileButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  
  // Stats Cards
  statsCardsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    marginHorizontal: 4,
  },
  statCardGradient: {
    padding: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  statIconContainerNew: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValueNew: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  statLabelNew: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  
  // Login Banner Redesigned
  modernLoginBanner: {
    marginTop: 4,
    marginBottom: 20,
    marginHorizontal: 20,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  loginBannerGradient: {
    borderRadius: 20,
    padding: 16,
  },
  loginBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  loginBannerIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(94,114,235,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  loginBannerText: {
    flex: 1,
  },
  loginBannerTitle: {
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  loginBannerDescription: {
    color: 'rgba(255,255,255,0.7)',
  },
  loginBannerButton: {
    borderRadius: 12,
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  loginBannerButtonGradient: {
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginBannerButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    marginRight: 8,
  },
  
  // Main Content
  mainContent: {
    paddingHorizontal: 20,
  },
  sectionLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 24,
  },
  sectionLabelText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  
  // Feature Cards Grid
  cardsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    marginBottom: 8,
  },
  featureCard: {
    width: '50%',
    paddingHorizontal: 6,
    marginBottom: 12,
  },
  featureCardGradient: {
    borderRadius: 16,
    padding: 16,
    height: 120,
    justifyContent: 'center',
  },
  featureCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  featureCardDescription: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  
  // Notifications Card
  notificationsCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  notificationsCardGradient: {
    borderRadius: 20,
    padding: 4,
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  notificationIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationTextContainer: {
    flex: 1,
    paddingRight: 8,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  notificationDescription: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  
  // Settings Card
  settingsCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  settingsCardGradient: {
    borderRadius: 20,
    padding: 4,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  settingsIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingsTextContainer: {
    flex: 1,
  },
  settingsTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  settingsDescription: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  
  // Footer and Sign Out
  footerContainer: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  signOutButtonNew: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    width: '50%',
  },
  signOutButtonGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,145,144,0.2)',
  },
  signOutButtonText: {
    color: '#FF9190',
    marginLeft: 8,
    fontWeight: '500',
  },
  versionContainer: {
    marginTop: 8,
  },
  versionText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
  },
  
  // --- Fitness Goals Modal Styles START ---
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '85%',
    maxWidth: 380,
    borderRadius: 20,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 24,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  modalGradient: {
    borderRadius: 20,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 12,
    flex: 1,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalDescription: {
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 20,
    fontSize: 16,
    textAlign: 'center',
  },
  goalButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  goalButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 16,
  },
  goalIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  goalButtonTextContainer: {
    flex: 1,
  },
  goalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  goalButtonSubtext: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
  },
  savingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 8,
  },
  savingText: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  cancelButton: {
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 12,
  },
  cancelButtonText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 16,
    fontWeight: '500',
  },
 // --- Fitness Goals Modal Styles END ---
});