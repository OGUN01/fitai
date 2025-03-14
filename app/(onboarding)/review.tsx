import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, Dimensions, TouchableOpacity } from 'react-native';
import { Button, Divider, useTheme, ActivityIndicator, Avatar, IconButton, ProgressBar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useProfile } from '../../contexts/ProfileContext';
import { UserProfile } from '../../types/profile';
import { getUserWeight, getTargetWeight } from '../../utils/profileHelpers';
import { LinearGradient } from 'expo-linear-gradient';
import StyledText from '../../components/ui/StyledText';
import { colors, spacing, borderRadius, shadows } from '../../theme/theme';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

// Get screen dimensions for responsive sizing
const { width, height } = Dimensions.get('window');

/**
 * Review Screen
 * Final step of the onboarding flow where users review their profile information
 * before completing setup and proceeding to the main app
 */
export default function ReviewScreen() {
  const theme = useTheme();
  const { profile, updateProfile } = useProfile();
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Get profile data
  const currentWeight = getUserWeight(profile);
  const targetWeight = getTargetWeight(profile);

  // Refresh the component when profile changes
  useEffect(() => {
    // Force a re-render to ensure latest profile data is displayed
    setRefreshTrigger(prev => prev + 1);
  }, [profile]);

  // Initial data loading
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 500));
        setLoading(false);
      } catch (error) {
        console.error('Error loading profile data:', error);
        setLoading(false);
      }
    };
    
    loadData();
  }, [profile, refreshTrigger, currentWeight]);

  // Handle completing the onboarding process
  const handleCompleteOnboarding = async () => {
    try {
      setCompleting(true);
      console.log("Starting onboarding completion...");
      
      // Update the user profile to mark onboarding as complete
      await updateProfile({
        has_completed_onboarding: true,
        current_onboarding_step: 'completed'
      });
      
      console.log("Profile updated successfully");
      
      // Mark onboarding as completed locally
      setOnboardingCompleted(true);
      
      // Show success message but don't wait for user interaction to navigate
      Alert.alert(
        "Setup Complete",
        "Your fitness profile has been successfully created! Redirecting to the main app..."
      );
      
      // Force immediate navigation without waiting for the alert
      console.log("Navigating to main app");
      
      // Use a combination of methods to ensure navigation works
      setTimeout(() => {
        try {
          console.log("Attempting primary navigation method");
          router.replace('/(tabs)');
          
          // As a backup, try a second approach after a small delay
          setTimeout(() => {
            console.log("Attempting secondary navigation method");
            if (typeof window !== 'undefined' && window.location) {
              window.location.href = '/';
            }
          }, 300);
        } catch (error) {
          console.error("Navigation error:", error);
          // Last resort - if all else fails, reload the page which should redirect to home
          if (typeof window !== 'undefined') {
            window.location.reload();
          }
        }
      }, 1000);
      
    } catch (error) {
      console.error("Error completing onboarding:", error);
      Alert.alert(
        "Error",
        "There was a problem completing your setup. Please try again.",
        [{ text: "OK" }]
      );
    } finally {
      setCompleting(false);
    }
  };

  // Handle going back to previous screen
  const handleBack = () => {
    router.back();
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={[colors.background.primary, colors.background.secondary]}
          style={styles.background}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        >
          <View style={styles.loadingContainer}>
            <ActivityIndicator 
              size="large" 
              color={colors.primary.main} 
            />
            <StyledText 
              variant="bodyLarge" 
              color={colors.text.primary}
              style={{ marginTop: spacing.md }}
            >
              Loading your profile...
            </StyledText>
          </View>
        </LinearGradient>
      </View>
    );
  }

  // Extract data for rendering
  const hasBodyHeight = profile?.height > 0;
  const hasBodyWeight = currentWeight > 0;
  const hasBodyFat = profile?.body_analysis?.body_fat_percentage;
  const bodyType = profile?.body_analysis?.bodyType;
  const fitnessGoal = profile?.fitness_goal;
  const dietPreferences = profile?.diet_preferences;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient
        colors={[colors.background.primary, colors.background.secondary]}
        style={styles.background}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        {/* Decorative elements */}
        <View style={[styles.decorativeCircle, styles.decorativeCircle1]} />
        <View style={[styles.decorativeCircle, styles.decorativeCircle2]} />
        <View style={[styles.decorativeCircle, styles.decorativeCircle3]} />
        
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={handleBack}
              accessibilityLabel="Go back"
            >
              <IconButton
                icon="arrow-left"
                size={24}
                iconColor={colors.text.primary}
                style={styles.backIcon}
              />
            </TouchableOpacity>
            <StyledText variant="headingLarge" style={styles.title}>
              Review Profile
            </StyledText>
            <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.subtitle}>
              Check your profile information before finalizing
            </StyledText>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Show a success banner when onboarding is completed */}
            {onboardingCompleted && (
              <View style={styles.completedBanner}>
                <StyledText variant="bodyLarge" color={colors.text.primary} style={styles.completedBannerText}>
                  Onboarding completed successfully!
                </StyledText>
                <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.completedBannerSubtext}>
                  Your profile has been saved and you'll be redirected to the main app.
                </StyledText>
              </View>
            )}
            
            {/* Profile Header */}
            <View style={styles.profileHeader}>
              <View style={styles.avatarContainer}>
                <Avatar.Text 
                  size={80} 
                  label={profile?.full_name?.split(' ').map(n => n[0]).join('') || 'U'} 
                  style={styles.avatar}
                  color={colors.text.primary}
                  labelStyle={{ fontWeight: 'bold' }}
                  theme={{ colors: { primary: colors.primary.light } }}
                />
                <View style={styles.setupCompleteIndicator}>
                  <MaterialCommunityIcons name="check-circle" size={24} color={colors.feedback.success} />
                </View>
              </View>
              <StyledText variant="headingMedium" style={styles.name}>
                {profile?.full_name || 'User'}
              </StyledText>
              <StyledText variant="bodyMedium" color={colors.text.muted} style={styles.setupText}>
                Profile Setup Complete
              </StyledText>
            </View>

            {/* Basic Info - Body & Goals Section */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <MaterialCommunityIcons name="account-details" size={24} color={colors.primary.main} />
                <StyledText variant="headingSmall" style={styles.sectionTitle}>
                  Body & Goals
                </StyledText>
              </View>
              <Divider style={styles.divider} />
              
              <View style={styles.sectionContent}>
                {hasBodyHeight && (
                  <View style={styles.infoRow}>
                    <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.infoLabel}>
                      Height
                    </StyledText>
                    <StyledText variant="bodyLarge" color={colors.text.primary} style={styles.infoValue}>
                      {profile.height} cm
                    </StyledText>
                  </View>
                )}
                
                {hasBodyWeight && (
                  <View style={styles.infoRow}>
                    <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.infoLabel}>
                      Current Weight
                    </StyledText>
                    <StyledText variant="bodyLarge" color={colors.text.primary} style={styles.infoValue}>
                      {currentWeight} kg
                    </StyledText>
                  </View>
                )}
                
                {targetWeight > 0 && (
                  <View style={styles.infoRow}>
                    <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.infoLabel}>
                      Target Weight
                    </StyledText>
                    <StyledText variant="bodyLarge" color={colors.text.primary} style={styles.infoValue}>
                      {targetWeight} kg
                    </StyledText>
                  </View>
                )}
                
                {hasBodyFat && (
                  <View style={styles.infoRow}>
                    <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.infoLabel}>
                      Body Fat
                    </StyledText>
                    <StyledText variant="bodyLarge" color={colors.text.primary} style={styles.infoValue}>
                      {profile.body_analysis.body_fat_percentage.toFixed(1)}%
                    </StyledText>
                  </View>
                )}
                
                {bodyType && (
                  <View style={styles.infoRow}>
                    <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.infoLabel}>
                      Body Type
                    </StyledText>
                    <StyledText variant="bodyLarge" color={colors.text.primary} style={styles.infoValue}>
                      {bodyType}
                    </StyledText>
                  </View>
                )}
                
                {fitnessGoal && (
                  <View style={styles.infoRow}>
                    <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.infoLabel}>
                      Fitness Goal
                    </StyledText>
                    <StyledText variant="bodyLarge" color={colors.text.primary} style={styles.infoValue}>
                      {fitnessGoal.replace('_', ' ').split(' ').map(word => 
                        word.charAt(0).toUpperCase() + word.slice(1)
                      ).join(' ')}
                    </StyledText>
                  </View>
                )}
              </View>
            </View>

            {/* Workout Preferences Section */}
            {profile?.workout_preferences && (
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <MaterialCommunityIcons name="arm-flex" size={24} color={colors.primary.main} />
                  <StyledText variant="headingSmall" style={styles.sectionTitle}>
                    Workout Preferences
                  </StyledText>
                </View>
                <Divider style={styles.divider} />
                
                <View style={styles.sectionContent}>
                  {profile.workout_preferences.fitness_level && (
                    <View style={styles.infoRow}>
                      <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.infoLabel}>
                        Experience
                      </StyledText>
                      <StyledText variant="bodyLarge" color={colors.text.primary} style={styles.infoValue}>
                        {profile.workout_preferences.fitness_level}
                      </StyledText>
                    </View>
                  )}
                  
                  {profile.workout_preferences.preferred_days && (
                    <View style={styles.infoRow}>
                      <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.infoLabel}>
                        Workouts/Week
                      </StyledText>
                      <StyledText variant="bodyLarge" color={colors.text.primary} style={styles.infoValue}>
                        {profile.workout_preferences.preferred_days.length}
                      </StyledText>
                    </View>
                  )}
                  
                  {profile.workout_preferences.focus_areas && (
                    <View style={styles.infoRow}>
                      <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.infoLabel}>
                        Focus Areas
                      </StyledText>
                      <StyledText variant="bodyLarge" color={colors.text.primary} style={styles.infoValue}>
                        {Array.isArray(profile.workout_preferences.focus_areas) 
                          ? profile.workout_preferences.focus_areas.join(', ')
                          : profile.workout_preferences.focus_areas}
                      </StyledText>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Diet Preferences Section */}
            {dietPreferences && (
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <MaterialCommunityIcons name="food-apple" size={24} color={colors.primary.main} />
                  <StyledText variant="headingSmall" style={styles.sectionTitle}>
                    Diet Preferences
                  </StyledText>
                </View>
                <Divider style={styles.divider} />
                
                <View style={styles.sectionContent}>
                  {dietPreferences.diet_type && (
                    <View style={styles.infoRow}>
                      <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.infoLabel}>
                        Diet Type
                      </StyledText>
                      <StyledText variant="bodyLarge" color={colors.text.primary} style={styles.infoValue}>
                        {dietPreferences.diet_type}
                      </StyledText>
                    </View>
                  )}
                  
                  {/* Macronutrient ratio if available */}
                  {dietPreferences.macronutrient_ratio && (
                    <View style={styles.infoRow}>
                      <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.infoLabel}>
                        Daily Macros
                      </StyledText>
                      <StyledText variant="bodyLarge" color={colors.text.primary} style={styles.infoValue}>
                        P:{dietPreferences.macronutrient_ratio.protein}% • C:{dietPreferences.macronutrient_ratio.carbs}% • F:{dietPreferences.macronutrient_ratio.fats}%
                      </StyledText>
                    </View>
                  )}
                  
                  {dietPreferences.meal_count && (
                    <View style={styles.infoRow}>
                      <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.infoLabel}>
                        Meals per Day
                      </StyledText>
                      <StyledText variant="bodyLarge" color={colors.text.primary} style={styles.infoValue}>
                        {dietPreferences.meal_count}
                      </StyledText>
                    </View>
                  )}
                  
                  {dietPreferences.allergies && dietPreferences.allergies.length > 0 && (
                    <View style={styles.infoRow}>
                      <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.infoLabel}>
                        Allergies
                      </StyledText>
                      <StyledText variant="bodyLarge" color={colors.text.primary} style={styles.infoValue}>
                        {dietPreferences.allergies.join(', ')}
                      </StyledText>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Recommendations Section */}
            {profile?.body_analysis?.recommendedFocusAreas && profile.body_analysis.recommendedFocusAreas.length > 0 && (
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <MaterialCommunityIcons name="star" size={24} color={colors.primary.main} />
                  <StyledText variant="headingSmall" style={styles.sectionTitle}>
                    Personalized Recommendations
                  </StyledText>
                </View>
                <Divider style={styles.divider} />
                
                <View style={styles.sectionContent}>
                  {profile.body_analysis.recommendedFocusAreas.map((recommendation, index) => (
                    <View key={index} style={styles.recommendationItem}>
                      <View style={styles.recommendationBullet} />
                      <StyledText variant="bodyMedium" color={colors.text.primary} style={styles.recommendationText}>
                        {recommendation}
                      </StyledText>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Actions */}
            <View style={styles.actionsContainer}>
              <LinearGradient
                colors={[colors.primary.main, colors.primary.dark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.completeButtonGradient}
              >
                <Button
                  mode="contained"
                  onPress={handleCompleteOnboarding}
                  loading={completing}
                  disabled={completing}
                  style={styles.completeButton}
                  buttonColor="transparent"
                  contentStyle={styles.buttonContent}
                  labelStyle={styles.buttonLabel}
                  icon="check-circle"
                >
                  {completing ? 'Completing...' : 'Complete Setup'}
                </Button>
              </LinearGradient>
              
              <Button
                mode="outlined"
                onPress={handleBack}
                style={styles.editButton}
                textColor={colors.text.secondary}
                buttonColor={colors.surface.dark}
                contentStyle={styles.buttonContent}
                labelStyle={styles.buttonLabel}
                icon="pencil"
              >
                Edit Information
              </Button>
            </View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
  },
  backButton: {
    marginBottom: spacing.md,
  },
  backIcon: {
    margin: 0,
    padding: 0,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: spacing.xs,
  },
  subtitle: {
    marginBottom: spacing.md,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  completedBanner: {
    backgroundColor: colors.feedback.success,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  completedBannerText: {
    color: colors.text.primary,
    fontWeight: 'bold',
    marginBottom: spacing.xs,
  },
  completedBannerSubtext: {
    color: colors.text.primary,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingVertical: spacing.lg,
    backgroundColor: colors.surface.dark,
    borderRadius: borderRadius.lg,
    ...shadows.medium,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: spacing.sm,
  },
  avatar: {
    marginBottom: spacing.sm,
    elevation: 4,
  },
  setupCompleteIndicator: {
    position: 'absolute',
    bottom: spacing.sm,
    right: -spacing.xs,
    backgroundColor: colors.surface.light,
    borderRadius: 12,
    padding: 2,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: spacing.xs,
  },
  setupText: {
    marginBottom: spacing.sm,
  },
  sectionCard: {
    backgroundColor: colors.surface.light,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.medium,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary.main,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginLeft: spacing.sm,
    marginBottom: spacing.sm,
  },
  divider: {
    backgroundColor: colors.border.light,
    marginBottom: spacing.md,
  },
  sectionContent: {
    gap: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  infoLabel: {
    flex: 1,
  },
  infoValue: {
    flex: 1,
    textAlign: 'right',
    fontWeight: '500',
  },
  recommendationItem: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
    alignItems: 'flex-start',
  },
  recommendationBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary.main,
    marginTop: 6,
    marginRight: spacing.sm,
  },
  recommendationText: {
    flex: 1,
    lineHeight: 20,
  },
  actionsContainer: {
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  completeButtonGradient: {
    borderRadius: borderRadius.md,
    ...shadows.medium,
  },
  completeButton: {
    borderRadius: borderRadius.md,
    backgroundColor: 'transparent',
    elevation: 0,
  },
  editButton: {
    borderRadius: borderRadius.md,
    borderColor: colors.border.medium,
    borderWidth: 2,
  },
  buttonContent: {
    paddingVertical: spacing.sm,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  decorativeCircle: {
    position: 'absolute',
    borderRadius: 150,
    opacity: 0.2,
  },
  decorativeCircle1: {
    top: -50,
    right: -50,
    width: 200,
    height: 200,
    backgroundColor: colors.primary.light,
  },
  decorativeCircle2: {
    bottom: 100,
    left: -100,
    width: 300,
    height: 300,
    backgroundColor: colors.secondary.light,
  },
  decorativeCircle3: {
    top: height / 2 - 100,
    right: -80,
    width: 160,
    height: 160,
    backgroundColor: colors.accent.lavender,
    opacity: 0.15,
  },
});
