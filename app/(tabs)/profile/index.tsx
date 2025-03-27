import React from 'react';
import { View, StyleSheet, ScrollView, Alert, ToastAndroid, Platform, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { Text, Card, List, Switch, Avatar, Button, useTheme, Divider } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../../../contexts/AuthContext';
import { router } from 'expo-router';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import supabase from '../../../lib/supabase';
import { useProfile } from '../../../contexts/ProfileContext';
import { format } from 'date-fns';
import { colors, spacing, borderRadius, shadows, gradients } from '../../../theme/theme';
import StyledText from '../../../components/ui/StyledText';
import { FadeIn, ScaleIn, SlideIn } from '../../../components/animations';
import NotificationService, { ReminderType } from '../../../services/notifications';

export default function ProfileScreen() {
  const theme = useTheme();
  const { user, signOut } = useAuth();
  const { profile } = useProfile();
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(true);
  const [mealRemindersEnabled, setMealRemindersEnabled] = React.useState(true);
  const [waterRemindersEnabled, setWaterRemindersEnabled] = React.useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = React.useState(false);
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);
  const [isInitialized, setIsInitialized] = React.useState(false);

  // Load notification settings and initialize service with profile data
  React.useEffect(() => {
    async function loadSettings() {
      try {
        if (!profile) return;

        // Initialize notification service
        await NotificationService.setupNotifications();
        
        // Update notification settings from the full profile
        await NotificationService.updateAllNotificationSettings(profile);
        
        // Load current settings
        const settings = await NotificationService.loadNotificationSettings();
        
        // Update local state
        setNotificationsEnabled(settings.workoutRemindersEnabled);
        setMealRemindersEnabled(settings.mealRemindersEnabled);
        setWaterRemindersEnabled(settings.waterRemindersEnabled);
        
        setIsInitialized(true);
      } catch (error) {
        console.error('Error initializing notification settings:', error);
      }
    }
    
    if (profile) {
      loadSettings();
    }
  }, [profile]);

  // Handle toggle changes
  const handleWorkoutToggle = React.useCallback(async (value: boolean) => {
    if (!profile || !isInitialized) return;
    
    setNotificationsEnabled(value);
    await NotificationService.updateReminderSettings(ReminderType.WORKOUT, value, profile);
  }, [isInitialized, profile]);
  
  const handleMealToggle = React.useCallback(async (value: boolean) => {
    if (!profile || !isInitialized) return;
    
    setMealRemindersEnabled(value);
    await NotificationService.updateReminderSettings(ReminderType.MEAL, value, profile);
  }, [isInitialized, profile]);
  
  const handleWaterToggle = React.useCallback(async (value: boolean) => {
    if (!profile || !isInitialized) return;
    
    setWaterRemindersEnabled(value);
    await NotificationService.updateReminderSettings(ReminderType.WATER, value, profile);
  }, [isInitialized, profile]);

  const handleLogout = async () => {
    if (isLoggingOut) return; // Prevent multiple clicks
    
    setIsLoggingOut(true);
    try {
      console.log('Profile screen: Starting logout process');
      // Force navigation first
      router.replace('/(auth)/login');
      // Then sign out from Supabase
      await signOut();
      console.log('Profile screen: Logout completed');
    } catch (error) {
      console.error('Error logging out:', error);
      Alert.alert('Error', 'An error occurred while logging out. Please try again.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleDirectLogout = async () => {
    try {
      await supabase.auth.signOut();
      router.replace('/(auth)/login');
    } catch (error) {
      console.error('Error logging out:', error);
      Alert.alert('Error', 'An error occurred while logging out. Please try again.');
    }
  };

  // Get avatar label from name or email
  const getAvatarLabel = () => {
    if (profile?.full_name) {
      return profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return 'U';
  };

  // Format fitness goal text
  const formatFitnessGoal = (goal?: string) => {
    if (!goal) return 'Not set';
    return goal.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  return (
    <SafeAreaView style={styles.container} edges={['right', 'left']}>
      <StatusBar style="light" />
      
      {/* Gradient Background */}
      <LinearGradient
        colors={[colors.primary.dark, colors.background.primary]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.3 }}
      />
      
      {/* Header */}
      <View style={styles.header}>
        <StyledText variant="headingLarge" style={styles.title}>
          Profile
        </StyledText>
      </View>
      
      {/* Main Content */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Info */}
        <FadeIn from={0} duration={800}>
          <View style={styles.profileSection}>
            <View style={styles.profileAvatarContainer}>
              <LinearGradient
                colors={[colors.primary.main, colors.secondary.main]}
                style={styles.avatarGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Avatar.Text 
                  size={90} 
                  label={getAvatarLabel()} 
                  style={styles.profileAvatar}
                  labelStyle={styles.profileAvatarLabel}
                />
              </LinearGradient>
            </View>
            
            <StyledText variant="headingMedium" style={styles.userName}>
              {profile?.full_name || user?.email?.split('@')[0] || 'User'}
            </StyledText>
            
            <StyledText variant="bodyMedium" style={styles.userEmail}>
              {user?.email || 'No email provided'}
            </StyledText>
            
            <TouchableOpacity
              style={styles.editProfileButton}
              onPress={() => router.push('/(tabs)/profile/edit-profile')}
            >
              <LinearGradient
                colors={[colors.secondary.main, colors.secondary.dark]}
                style={styles.gradientButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <StyledText variant="bodyMedium" style={styles.buttonText}>
                  Edit Profile
                </StyledText>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </FadeIn>
        
        {/* Fitness Goals */}
        <ScaleIn duration={600} delay={200}>
          <LinearGradient
            colors={[colors.surface.light, colors.surface.main]}
            style={styles.sectionCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="target" size={24} color={colors.primary.main} />
              <StyledText variant="headingMedium" style={styles.sectionTitle}>
                Fitness Goals
              </StyledText>
            </View>
            
            <View style={styles.goalItem}>
              <View style={styles.goalIconContainer}>
                <Ionicons name="fitness" size={20} color={colors.primary.main} />
              </View>
              <View style={styles.goalTextContainer}>
                <StyledText variant="bodyMedium" style={styles.goalLabel}>
                  Primary Goal
                </StyledText>
                <StyledText variant="bodyLarge" style={styles.goalValue}>
                  {formatFitnessGoal(profile?.weight_goal)}
                </StyledText>
              </View>
            </View>
            
            <View style={styles.goalItem}>
              <View style={styles.goalIconContainer}>
                <Ionicons name="scale-outline" size={20} color={colors.secondary.main} />
              </View>
              <View style={styles.goalTextContainer}>
                <StyledText variant="bodyMedium" style={styles.goalLabel}>
                  Current Weight
                </StyledText>
                <StyledText variant="bodyLarge" style={styles.goalValue}>
                  {profile?.weight_kg || profile?.current_weight_kg || profile?.body_analysis?.weight_kg 
                    ? `${Math.round(profile?.weight_kg || profile?.current_weight_kg || profile?.body_analysis?.weight_kg)} kg`
                    : 'Not set'}
                </StyledText>
              </View>
            </View>
            
            <View style={styles.goalItem}>
              <View style={styles.goalIconContainer}>
                <Ionicons name="trending-down" size={20} color={colors.accent.green} />
              </View>
              <View style={styles.goalTextContainer}>
                <StyledText variant="bodyMedium" style={styles.goalLabel}>
                  Target Weight
                </StyledText>
                <StyledText variant="bodyLarge" style={styles.goalValue}>
                  {profile?.target_weight_kg || profile?.body_analysis?.target_weight_kg 
                    ? `${Math.round(profile?.target_weight_kg || profile?.body_analysis?.target_weight_kg)} kg`
                    : 'Not set'}
                </StyledText>
              </View>
            </View>
            
            <View style={styles.goalItem}>
              <View style={styles.goalIconContainer}>
                <Ionicons name="resize" size={20} color={colors.accent.purple} />
              </View>
              <View style={styles.goalTextContainer}>
                <StyledText variant="bodyMedium" style={styles.goalLabel}>
                  Height
                </StyledText>
                <StyledText variant="bodyLarge" style={styles.goalValue}>
                  {profile?.height_cm || profile?.body_analysis?.height_cm
                    ? `${Math.round(profile?.height_cm || profile?.body_analysis?.height_cm)} cm`
                    : 'Not set'}
                </StyledText>
              </View>
            </View>
          </LinearGradient>
        </ScaleIn>
        
        {/* Preferences */}
        <ScaleIn duration={600} delay={300}>
          <LinearGradient
            colors={[colors.surface.light, colors.surface.main]}
            style={styles.sectionCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="cog" size={24} color={colors.primary.main} />
              <StyledText variant="headingMedium" style={styles.sectionTitle}>
                Preferences
              </StyledText>
            </View>
            
            {/* Add Water Intake Settings button */}
            <TouchableOpacity 
              style={[styles.accountItem, styles.highlightedItem]}
              onPress={() => router.push('/(tabs)/profile/edit-profile')}
            >
              <MaterialCommunityIcons name="water" size={24} color="#36D1DC" />
              <View style={styles.itemTextContainer}>
                <StyledText variant="bodyLarge" style={styles.accountItemText}>
                  Water Goal Settings
                </StyledText>
                <StyledText variant="bodySmall" style={styles.itemDescription}>
                  Set your daily water intake target
                </StyledText>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color={colors.text.muted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.accountItem}
              onPress={() => handleWorkoutToggle(!notificationsEnabled)}
            >
              <MaterialCommunityIcons
                name={notificationsEnabled ? "bell" : "bell-off"}
                size={24}
                color={notificationsEnabled ? colors.primary.light : colors.text.muted}
              />
              <StyledText variant="bodyLarge" style={styles.accountItemText}>
                Workout Notifications
              </StyledText>
              <Switch
                value={notificationsEnabled}
                onValueChange={handleWorkoutToggle}
                color={colors.primary.main}
              />
            </TouchableOpacity>
            
            <View style={styles.preferenceItem}>
              <View style={styles.preferenceInfo}>
                <MaterialCommunityIcons name="food-fork-drink" size={24} color={colors.primary.light} />
                <StyledText variant="bodyLarge" style={styles.preferenceText}>
                  Meal Reminders
                </StyledText>
              </View>
              <Switch
                value={mealRemindersEnabled}
                onValueChange={handleMealToggle}
                color={colors.primary.main}
              />
            </View>
            
            <View style={styles.preferenceItem}>
              <View style={styles.preferenceInfo}>
                <MaterialCommunityIcons name="water" size={24} color="#36D1DC" />
                <StyledText variant="bodyLarge" style={styles.preferenceText}>
                  Water Reminders
                </StyledText>
              </View>
              <Switch
                value={waterRemindersEnabled}
                onValueChange={handleWaterToggle}
                color="#36D1DC"
              />
            </View>
          </LinearGradient>
        </ScaleIn>
        
        {/* Account Section */}
        <ScaleIn duration={600} delay={400}>
          <LinearGradient
            colors={[colors.surface.light, colors.surface.main]}
            style={styles.sectionCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="account" size={24} color={colors.primary.main} />
              <StyledText variant="headingMedium" style={styles.sectionTitle}>
                Account
              </StyledText>
            </View>
            
            <TouchableOpacity
              style={styles.accountItem}
              onPress={() => router.push('/(tabs)/settings')}
            >
              <MaterialCommunityIcons name="cog-outline" size={24} color={colors.primary.light} />
              <StyledText variant="bodyLarge" style={styles.accountItemText}>
                Settings
              </StyledText>
              <MaterialCommunityIcons name="chevron-right" size={24} color={colors.text.muted} />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.accountItem}
              onPress={() => Alert.alert('Help & Support', 'This feature is coming soon!')}
            >
              <MaterialCommunityIcons name="help-circle-outline" size={24} color={colors.primary.light} />
              <StyledText variant="bodyLarge" style={styles.accountItemText}>
                Help & Support
              </StyledText>
              <MaterialCommunityIcons name="chevron-right" size={24} color={colors.text.muted} />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.accountItem}
              onPress={() => Alert.alert('Privacy Policy', 'This feature is coming soon!')}
            >
              <MaterialCommunityIcons name="shield-account-outline" size={24} color={colors.primary.light} />
              <StyledText variant="bodyLarge" style={styles.accountItemText}>
                Privacy Policy
              </StyledText>
              <MaterialCommunityIcons name="chevron-right" size={24} color={colors.text.muted} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.accountItem, styles.logoutButton]}
              onPress={handleLogout}
              disabled={isLoggingOut}
            >
              <MaterialCommunityIcons name="logout" size={24} color={colors.feedback.error} />
              <StyledText variant="bodyLarge" style={styles.logoutText}>
                {isLoggingOut ? 'Logging out...' : 'Logout'}
              </StyledText>
              {isLoggingOut && (
                <ActivityIndicator size="small" color={colors.feedback.error} style={styles.logoutLoader} />
              )}
            </TouchableOpacity>
          </LinearGradient>
        </ScaleIn>
        
        <View style={styles.versionInfo}>
          <StyledText variant="bodySmall" style={styles.versionText}>
            Version 1.0.0
          </StyledText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    zIndex: 10,
  },
  title: {
    color: colors.text.primary,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  profileAvatarContainer: {
    marginBottom: spacing.md,
  },
  avatarGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.medium,
  },
  profileAvatar: {
    backgroundColor: 'transparent',
  },
  profileAvatarLabel: {
    fontSize: 36,
    fontWeight: 'bold',
  },
  userName: {
    color: colors.text.primary,
    fontWeight: 'bold',
    marginBottom: spacing.xs,
  },
  userEmail: {
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  editProfileButton: {
    borderRadius: borderRadius.round,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  gradientButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.round,
  },
  buttonText: {
    color: colors.text.primary,
    fontWeight: 'bold',
  },
  sectionCard: {
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
    padding: spacing.lg,
    ...shadows.medium,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    color: colors.text.primary,
    marginLeft: spacing.sm,
  },
  goalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  goalIconContainer: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: borderRadius.round,
    marginRight: spacing.sm,
  },
  goalTextContainer: {
    flex: 1,
  },
  goalLabel: {
    color: colors.text.muted,
  },
  goalValue: {
    color: colors.text.primary,
  },
  preferenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  preferenceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  preferenceText: {
    color: colors.text.primary,
    marginLeft: spacing.md,
  },
  accountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  accountItemText: {
    color: colors.text.primary,
    flex: 1,
    marginLeft: spacing.md,
  },
  logoutButton: {
    borderBottomWidth: 0,
    marginTop: spacing.sm,
  },
  logoutText: {
    color: colors.feedback.error,
    flex: 1,
    marginLeft: spacing.md,
  },
  logoutLoader: {
    marginLeft: spacing.sm,
  },
  versionInfo: {
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  versionText: {
    color: colors.text.muted,
  },
  highlightedItem: {
    backgroundColor: 'rgba(54, 209, 220, 0.08)',
    borderRadius: borderRadius.md,
    marginVertical: spacing.xs,
  },
  itemTextContainer: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  itemDescription: {
    color: colors.text.muted,
    fontSize: 12,
    marginTop: 2,
  },
});
