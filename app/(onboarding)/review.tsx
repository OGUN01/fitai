import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Dimensions, ActivityIndicator, TouchableOpacity, ImageBackground, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useProfile } from '../../contexts/ProfileContext';
import { useAuth } from '../../contexts/AuthContext'; 
import { colors, spacing, borderRadius, shadows } from '../../theme/theme';
import { useTheme } from 'react-native-paper';
import StyledText from '../../components/ui/StyledText';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import supabase from '../../lib/supabase';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Divider, Avatar } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { getUserWeight, getTargetWeight } from '../../utils'; 

// Get screen dimensions for responsive sizing
const { width, height } = Dimensions.get('window');

/**
 * Review Screen
 * Final step of the onboarding flow where users review their profile information
 * before completing setup and proceeding to the main app
 */
export default function ReviewScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { profile, updateProfile, refreshProfile, completeOnboarding } = useProfile();
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);

  // Get profile data
  const currentWeight = getUserWeight(profile);
  const targetWeight = getTargetWeight(profile);

  // Helper function to extract diet information
  const extractDietInfo = () => {
    // Make sure we're using the most up-to-date values
    const dietType = profile?.diet_type || profile?.diet_preferences?.diet_type || '';
    const dietRestrictions = profile?.diet_restrictions || profile?.diet_preferences?.dietary_restrictions || [];
    const dietAllergies = profile?.allergies || profile?.diet_preferences?.allergies || [];
    
    // Get the country region with fallback options
    const dietCountryRegion = profile?.country_region || 
                             profile?.diet_preferences?.country_region || 
                             '';
    
    console.log('Extracted diet info:', {
      dietType,
      dietRestrictions,
      dietAllergies,
      dietCountryRegion
    });
    
    return {
      dietType,
      dietRestrictions,
      dietAllergies,
      dietCountryRegion
    };
  };

  // Extract diet information
  const { dietType, dietRestrictions, dietAllergies, dietCountryRegion } = extractDietInfo();

  // Explicitly handle country_region with proper fallbacks and logging
  // const dietCountryRegion = profile?.country_region || profile?.diet_preferences?.country_region || '';
  
  // Debug logging for country_region
  useEffect(() => {
    console.log('REVIEW SCREEN - country_region values:');
    console.log('Root profile.country_region:', profile?.country_region);
    console.log('Nested profile.diet_preferences.country_region:', profile?.diet_preferences?.country_region);
    console.log('Final dietCountryRegion value used for display:', dietCountryRegion);
  }, [profile, dietCountryRegion]);

  // Handle refreshing the profile data
  const handleRefreshProfile = async () => {
    try {
      console.log("🔄 Manually refreshing profile data...");
      setLoading(true);
      
      // Call the refreshProfile function with forceRefresh = true
      await refreshProfile(true);
      
      // After refresh, get the updated values for logging
      console.log("🔄 REFRESH COMPLETE - Updated country_region values:");
      console.log("🔄 Root profile.country_region:", profile?.country_region);
      console.log("🔄 Nested profile.diet_preferences.country_region:", profile?.diet_preferences?.country_region);
      console.log("🔄 Final dietCountryRegion value used for display:", profile?.country_region || profile?.diet_preferences?.country_region || '');
      
      setLoading(false);
    } catch (error) {
      console.error("Error refreshing profile:", error);
      setLoading(false);
    }
  };

  // Refresh the component when profile changes
  useEffect(() => {
    // Log the exact profile structure to debug the country_region issue
    console.log('FULL PROFILE OBJECT:', JSON.stringify(profile, null, 2));
    console.log('Diet Country Region (extracted):', dietCountryRegion);
    console.log('Diet Country Region Type:', typeof dietCountryRegion);
    console.log('Country Region from profile:', profile?.country_region, 'Type:', typeof profile?.country_region);
    console.log('Country Region from diet_preferences:', profile?.diet_preferences?.country_region, 'Type:', typeof profile?.diet_preferences?.country_region);
  }, [profile, dietCountryRegion]);

  // Initial data loading
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        // Force a fresh profile load
        if (profile) {
          await handleRefreshProfile();
        }
        setLoading(false);
      } catch (error) {
        console.error('Error loading profile data:', error);
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  // Handle completing the onboarding process
  const handleCompleteOnboarding = async () => {
    try {
      setCompleting(true);
      console.log("Starting onboarding completion...");
      
      // First show a success banner in the review screen
      setOnboardingCompleted(true);
      
      // Set step to completed so navigation guard knows to allow the completed screen
      await updateProfile({
        current_onboarding_step: 'completed'
      });
      
      // Wait briefly to show the success message before navigating
      setTimeout(async () => {
        try {
          console.log("Navigating to completed screen to show summary");
          // First navigate to the completion screen to show the summary
          router.replace('/(onboarding)/completed');
          
          // Then perform the actual onboarding completion tasks asynchronously
          await completeOnboarding();
          console.log("Profile updated successfully, onboarding complete");
          
          // Force refresh profile to verify completion status
          const refreshedProfile = await refreshProfile(true);
          
          // Double-check that onboarding is now marked as complete
          if (user && refreshedProfile && !refreshedProfile.has_completed_onboarding) {
            console.error("Warning: Onboarding still not marked as complete after refresh");
            // Try one more direct update as a fallback
            await updateProfile({
              has_completed_onboarding: true,
              current_onboarding_step: 'completed'
            });
          } else if (!user && refreshedProfile && !refreshedProfile.has_completed_local_onboarding) {
            console.error("Warning: Local onboarding still not marked as complete after refresh");
            // Try one more direct update as a fallback
            await updateProfile({
              has_completed_local_onboarding: true,
              current_onboarding_step: 'completed'
            });
          }
        } catch (asyncError) {
          console.error("Error in async onboarding completion:", asyncError);
        } finally {
          setCompleting(false);
        }
      }, 1000);
    } catch (error) {
      console.error("Error completing onboarding:", error);
      Alert.alert(
        "Error",
        "There was a problem completing your setup. Please try again.",
        [{ text: "OK" }]
      );
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

  // Extract data for rendering - check both root and nested properties for values
  const hasBodyHeight = Boolean(profile?.height_cm || profile?.body_analysis?.height_cm);
  const hasBodyWeight = Boolean(profile?.weight_kg || profile?.body_analysis?.weight_kg);
  const hasBodyFat = Boolean(profile?.body_analysis?.body_fat_percentage);
  const bodyType = profile?.body_analysis?.body_type || profile?.body_analysis?.bodyType;
  
  // Get values with fallbacks from nested objects
  const heightCm = profile?.height_cm || profile?.body_analysis?.height_cm;
  const weightKg = profile?.weight_kg || profile?.body_analysis?.weight_kg;
  const targetWeightKg = profile?.target_weight_kg || profile?.body_analysis?.target_weight_kg;
  const bodyFatPercentage = profile?.body_analysis?.body_fat_percentage;
  
  // Get values from workout_preferences
  const workoutFitnessLevel = profile?.fitness_level || profile?.workout_preferences?.fitness_level;
  const workoutDaysPerWeek = profile?.workout_days_per_week || (profile?.workout_preferences?.preferred_days?.length || 0);
  const workoutFocusAreas = profile?.fitness_goals?.length > 0 
    ? profile?.fitness_goals 
    : profile?.workout_preferences?.focus_areas;

  // Main fitness goal
  const fitnessGoal = profile?.weight_goal || 
    (profile?.fitness_goals && profile?.fitness_goals[0]) ||
    '';

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
        
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={handleBack}
              accessibilityLabel="Go back"
            >
              <MaterialCommunityIcons
                name="arrow-left"
                size={24}
                color={colors.text.primary}
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
                <MaterialCommunityIcons
                  name="check-circle-outline"
                  size={24}
                  color={colors.text.primary}
                  style={styles.completedIcon}
                />
                <View style={styles.completedTextContainer}>
                  <StyledText variant="bodyLarge" color={colors.text.primary} style={styles.completedBannerText}>
                    Onboarding completed successfully!
                  </StyledText>
                  <StyledText variant="bodyMedium" color={colors.text.primary} style={styles.completedBannerSubtext}>
                    Your profile has been saved and you'll be redirected to the main app.
                  </StyledText>
                </View>
              </View>
            )}
            
            {/* Profile Header */}
            <View style={styles.profileHeader}>
              <View style={styles.avatarContainer}>
                <LinearGradient
                  colors={[colors.primary.main, colors.secondary.main]}
                  style={styles.avatarGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Avatar.Text 
                    size={80} 
                    label={profile?.full_name?.split(' ').map(n => n[0]).join('') || 'U'} 
                    style={styles.avatar}
                    color={colors.text.primary}
                    labelStyle={{ fontWeight: 'bold' }}
                    theme={{ colors: { primary: 'transparent' } }}
                  />
                </LinearGradient>
                <View style={styles.setupCompleteIndicator}>
                  <MaterialCommunityIcons name="check-circle" size={24} color={colors.feedback.success} />
                </View>
              </View>
              <StyledText variant="headingMedium" style={styles.name}>
                {profile?.full_name || 'User'}
              </StyledText>
              <View style={styles.profileStatusContainer}>
                <MaterialCommunityIcons name="check-circle" size={16} color={colors.feedback.success} />
                <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.setupText}>
                  Profile Setup Complete
                </StyledText>
              </View>
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
                      {profile?.height_cm || (profile.body_analysis as any)?.height_cm || (profile.body_analysis as any)?.original_height || 175} cm
                    </StyledText>
                  </View>
                )}
                
                {hasBodyWeight && (
                  <View style={styles.infoRow}>
                    <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.infoLabel}>
                      Current Weight
                    </StyledText>
                    <StyledText variant="bodyLarge" color={colors.text.primary} style={styles.infoValue}>
                      {(profile.body_analysis as any)?.weight_unit === 'lbs' 
                        ? `${((profile.body_analysis as any)?.original_weight || weightKg * 2.20462).toFixed(1)} lbs` 
                        : `${weightKg} kg`}
                    </StyledText>
                  </View>
                )}
                
                {targetWeightKg > 0 && (
                  <View style={styles.infoRow}>
                    <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.infoLabel}>
                      Target Weight
                    </StyledText>
                    <StyledText variant="bodyLarge" color={colors.text.primary} style={styles.infoValue}>
                      {(profile.body_analysis as any)?.weight_unit === 'lbs' 
                        ? `${((profile.body_analysis as any)?.original_target_weight || targetWeightKg * 2.20462).toFixed(1)} lbs` 
                        : `${targetWeightKg} kg`}
                    </StyledText>
                  </View>
                )}
                
                {bodyFatPercentage && (
                  <View style={styles.infoRow}>
                    <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.infoLabel}>
                      Body Fat
                    </StyledText>
                    <StyledText variant="bodyLarge" color={colors.text.primary} style={styles.infoValue}>
                      {parseFloat(bodyFatPercentage.toString()).toFixed(1)}%
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
                      {fitnessGoal && fitnessGoal.replace ? 
                        fitnessGoal.replace('_', ' ').split(' ').map(word => 
                          word.charAt(0).toUpperCase() + word.slice(1)
                        ).join(' ')
                        : fitnessGoal}
                    </StyledText>
                  </View>
                )}
              </View>
              
              {/* Show appropriate button based on whether body data is complete */}
              {(!heightCm || !weightKg || !targetWeightKg || !fitnessGoal) ? (
                <TouchableOpacity 
                  style={styles.editSectionButton}
                  onPress={() => router.push({
                    pathname: '/user-details',
                    params: { returnToReview: 'true' }
                  })}
                >
                  <StyledText variant="bodyMedium" color={colors.primary.main}>
                    Complete Body & Goals
                  </StyledText>
                  <MaterialCommunityIcons name="arrow-right" size={18} color={colors.primary.main} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  style={styles.editSectionButton}
                  onPress={() => router.push({
                    pathname: '/user-details',
                    params: { returnToReview: 'true' }
                  })}
                >
                  <StyledText variant="bodyMedium" color={colors.primary.main}>
                    Edit Body & Goals
                  </StyledText>
                  <MaterialCommunityIcons name="arrow-right" size={18} color={colors.primary.main} />
                </TouchableOpacity>
              )}
            </View>

            {/* Workout Preferences Section */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <MaterialCommunityIcons name="dumbbell" size={24} color={colors.primary.main} />
                <StyledText variant="headingSmall" style={styles.sectionTitle}>
                  Workout Preferences
                </StyledText>
              </View>
              <Divider style={styles.divider} />
              
              {(workoutFitnessLevel || workoutDaysPerWeek || (workoutFocusAreas && workoutFocusAreas.length > 0)) ? (
                <View style={styles.sectionContent}>
                  {workoutFitnessLevel && (
                    <View style={styles.infoRow}>
                      <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.infoLabel}>
                        Experience
                      </StyledText>
                      <StyledText variant="bodyLarge" color={colors.text.primary} style={styles.infoValue}>
                        {workoutFitnessLevel}
                      </StyledText>
                    </View>
                  )}
                  
                  {workoutDaysPerWeek && (
                    <View style={styles.infoRow}>
                      <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.infoLabel}>
                        Workouts/Week
                      </StyledText>
                      <StyledText variant="bodyLarge" color={colors.text.primary} style={styles.infoValue}>
                        {workoutDaysPerWeek}
                      </StyledText>
                    </View>
                  )}
                  
                  {workoutFocusAreas && workoutFocusAreas.length > 0 && (
                    <View style={styles.infoRow}>
                      <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.infoLabel}>
                        Focus Areas
                      </StyledText>
                      <StyledText variant="bodyLarge" color={colors.text.primary} style={styles.infoValue}>
                        {Array.isArray(workoutFocusAreas) && workoutFocusAreas.length > 0
                          ? workoutFocusAreas.join(', ')
                          : (typeof workoutFocusAreas === 'string' ? workoutFocusAreas : '')}
                      </StyledText>
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.emptySectionContent}>
                  <MaterialCommunityIcons name="information-outline" size={24} color={colors.text.secondary} />
                  <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.emptySectionText}>
                    No workout preferences set
                  </StyledText>
                </View>
              )}
              
              {!workoutFitnessLevel && !workoutDaysPerWeek && (!workoutFocusAreas || workoutFocusAreas.length === 0) ? (
                <TouchableOpacity
                  style={styles.editSectionButton}
                  onPress={() => router.push({
                    pathname: '/(onboarding)/workout-preferences',
                    params: { returnToReview: 'true' }
                  })}
                >
                  <StyledText variant="bodyMedium" color={colors.primary.main}>
                    Complete Workout Preferences
                  </StyledText>
                  <MaterialCommunityIcons name="arrow-right" size={18} color={colors.primary.main} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.editSectionButton}
                  onPress={() => router.push({
                    pathname: '/(onboarding)/workout-preferences',
                    params: { returnToReview: 'true' }
                  })}
                >
                  <StyledText variant="bodyMedium" color={colors.primary.main}>
                    Edit Workout Preferences
                  </StyledText>
                  <MaterialCommunityIcons name="arrow-right" size={18} color={colors.primary.main} />
                </TouchableOpacity>
              )}
            </View>

            {/* Diet Preferences Section */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <MaterialCommunityIcons name="food-apple" size={24} color={colors.primary.main} />
                <StyledText variant="headingSmall" style={styles.sectionTitle}>
                  Diet Preferences
                </StyledText>
              </View>
              <Divider style={styles.divider} />
              
              {/* Always show this section, handle empty values appropriately */}
              <View style={styles.sectionContent}>
                <View style={styles.infoRow}>
                  <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.infoLabel}>
                    Diet Type
                  </StyledText>
                  <StyledText variant="bodyLarge" color={colors.text.primary} style={styles.infoValue}>
                    {dietType && typeof dietType === 'string' && dietType.length > 0 ? 
                      (dietType.charAt(0).toUpperCase() + dietType.slice(1)) : 
                      'Not specified'}
                  </StyledText>
                </View>
                
                <View style={styles.infoRow}>
                  <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.infoLabel}>
                    Meal Frequency
                  </StyledText>
                  <StyledText variant="bodyLarge" color={colors.text.primary} style={styles.infoValue}>
                    {profile?.meal_frequency || profile?.diet_preferences?.meal_frequency ? 
                      `${profile?.meal_frequency || profile?.diet_preferences?.meal_frequency} meals per day` : 
                      'Not specified'}
                  </StyledText>
                </View>
                
                <View style={styles.infoRow}>
                  <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.infoLabel}>
                    Allergies
                  </StyledText>
                  <StyledText variant="bodyLarge" color={colors.text.primary} style={styles.infoValue}>
                    {Array.isArray(dietAllergies) && dietAllergies.length > 0 ? 
                      dietAllergies.join(', ') : 
                      'None'}
                  </StyledText>
                </View>
                
                <View style={styles.infoRow}>
                  <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.infoLabel}>
                    Country Region
                  </StyledText>
                  <StyledText variant="bodyLarge" color={colors.text.primary} style={styles.infoValue}>
                    {dietCountryRegion && dietCountryRegion.length > 0 ? 
                      dietCountryRegion.toUpperCase() : 
                      'Not specified'}
                  </StyledText>
                </View>
              </View>
              
              <TouchableOpacity
                style={styles.editSectionButton}
                onPress={() => router.push({
                  pathname: '/(onboarding)/diet-preferences',
                  params: { returnToReview: 'true' }
                })}
              >
                <StyledText variant="bodyMedium" color={colors.primary.main}>
                  {dietType ? 'Edit Diet Preferences' : 'Complete Diet Preferences'}
                </StyledText>
                <MaterialCommunityIcons name="arrow-right" size={18} color={colors.primary.main} />
              </TouchableOpacity>
            </View>

            {/* Body Analysis Section */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <MaterialCommunityIcons name="human-male-height" size={24} color={colors.primary.main} />
                <StyledText variant="headingSmall" style={styles.sectionTitle}>
                  Body Analysis
                </StyledText>
              </View>
              <Divider style={styles.divider} />
              
              {(profile?.body_analysis?.recommended_focus_areas?.length > 0 || 
                profile?.body_analysis?.recommendedFocusAreas?.length > 0 ||
                profile?.body_analysis?.analysis_text || 
                profile?.body_analysis?.analysisText) ? (
                <View style={styles.sectionContent}>
                  <StyledText variant="bodyMedium" color={colors.text.primary} style={styles.analysisSubtitle}>
                    Recommended Focus Areas
                  </StyledText>
                  {(profile.body_analysis?.recommended_focus_areas || 
                    profile.body_analysis?.recommendedFocusAreas || []).map((recommendation, index) => (
                    <View key={index} style={styles.recommendationItem}>
                      <View style={styles.recommendationBullet} />
                      <StyledText variant="bodyMedium" color={colors.text.primary} style={styles.recommendationText}>
                        {recommendation || ''}
                      </StyledText>
                    </View>
                  ))}
                  
                  {(profile.body_analysis.analysis_text || profile.body_analysis.analysisText) && (
                    <>
                      <StyledText 
                        variant="bodyMedium" 
                        color={colors.text.primary} 
                        style={{...styles.analysisSubtitle, marginTop: spacing.md}}
                      >
                        Analysis Summary
                      </StyledText>
                      <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.analysisText}>
                        {profile.body_analysis?.analysis_text || profile.body_analysis?.analysisText || ''}
                      </StyledText>
                    </>
                  )}
                </View>
              ) : (
                <View style={styles.emptySectionContent}>
                  <MaterialCommunityIcons name="information-outline" size={24} color={colors.text.secondary} />
                  <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.emptySectionText}>
                    No body analysis completed
                  </StyledText>
                </View>
              )}
              
              {(!profile?.body_analysis || 
                (!profile.body_analysis.recommended_focus_areas?.length && 
                 !profile.body_analysis.recommendedFocusAreas?.length)) && (
                <TouchableOpacity 
                  style={styles.editSectionButton}
                  onPress={() => router.push({
                    pathname: '/body-analysis',
                    params: { returnToReview: 'true' }
                  })}
                >
                  <StyledText variant="bodyMedium" color={colors.primary.main}>
                    Complete Body Analysis
                  </StyledText>
                  <MaterialCommunityIcons name="arrow-right" size={18} color={colors.primary.main} />
                </TouchableOpacity>
              )}
            </View>

            {/* Action buttons */}
            <View style={styles.actionButtonContainer}>
              <TouchableOpacity 
                style={styles.secondaryButton} 
                onPress={handleRefreshProfile}
              >
                <MaterialCommunityIcons name="refresh" size={16} color={colors.primary.main} />
                <StyledText variant="bodyMedium" color={colors.primary.main} style={styles.buttonText}>
                  Refresh Profile
                </StyledText>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.completeButton, completing && styles.buttonDisabled]} 
                onPress={handleCompleteOnboarding}
                disabled={completing}
              >
                <LinearGradient
                  colors={[colors.primary.light, colors.primary.main]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.buttonGradient}
                >
                  {completing ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <>
                      <StyledText variant="bodyLarge" color={colors.text.primary} style={styles.buttonText}>
                        {onboardingCompleted ? 'Complete! Redirecting...' : 'Complete Onboarding'}
                      </StyledText>
                      <MaterialCommunityIcons
                        name="check-circle"
                        size={20}
                        color={colors.text.primary}
                        style={styles.buttonIcon}
                      />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Hidden Debug Information (Only in Development) */}
            {__DEV__ && (
              <View style={styles.debugSection}>
                <StyledText variant="headingSmall" style={styles.debugTitle}>Debug Info</StyledText>
                <Divider style={styles.divider} />
                
                <View style={styles.debugItem}>
                  <StyledText variant="bodyMedium" style={styles.debugLabel}>Onboarding Step:</StyledText>
                  <StyledText variant="bodyMedium" style={styles.debugValue}>{profile?.current_onboarding_step}</StyledText>
                </View>
                
                <View style={styles.debugItem}>
                  <StyledText variant="bodyMedium" style={styles.debugLabel}>Onboarding Complete:</StyledText>
                  <StyledText variant="bodyMedium" style={styles.debugValue}>{profile?.has_completed_onboarding ? 'Yes' : 'No'}</StyledText>
                </View>
                
                <View style={styles.debugItem}>
                  <StyledText variant="bodyMedium" style={styles.debugLabel}>Height (cm):</StyledText>
                  <StyledText variant="bodyMedium" style={styles.debugValue}>{(profile as any)?.height_cm || 'Not Set'}</StyledText>
                </View>
                
                <View style={styles.debugItem}>
                  <StyledText variant="bodyMedium" style={styles.debugLabel}>Weight (kg):</StyledText>
                  <StyledText variant="bodyMedium" style={styles.debugValue}>{(profile as any)?.weight_kg || 'Not Set'}</StyledText>
                </View>
                
                <View style={styles.debugItem}>
                  <StyledText variant="bodyMedium" style={styles.debugLabel}>Fitness Level:</StyledText>
                  <StyledText variant="bodyMedium" style={styles.debugValue}>{(profile as any)?.fitness_level || 'Not Set'}</StyledText>
                </View>
                
                <View style={styles.debugItem}>
                  <StyledText variant="bodyMedium" style={styles.debugLabel}>Workout Days/Week:</StyledText>
                  <StyledText variant="bodyMedium" style={styles.debugValue}>{(profile as any)?.workout_days_per_week || 'Not Set'}</StyledText>
                </View>
                
                <View style={styles.debugItem}>
                  <StyledText variant="bodyMedium" style={styles.debugLabel}>Workout Duration (min):</StyledText>
                  <StyledText variant="bodyMedium" style={styles.debugValue}>{(profile as any)?.workout_duration_minutes || 'Not Set'}</StyledText>
                </View>
                
                <View style={styles.debugItem}>
                  <StyledText variant="bodyMedium" style={styles.debugLabel}>Diet Type:</StyledText>
                  <StyledText variant="bodyMedium" style={styles.debugValue}>{(profile as any)?.diet_type || 'Not Set'}</StyledText>
                </View>
                
                <View style={styles.debugItem}>
                  <StyledText variant="bodyMedium" style={styles.debugLabel}>Country Region:</StyledText>
                  <StyledText variant="bodyMedium" style={styles.debugValue}>{(profile as any)?.country_region || 'Not Set'}</StyledText>
                </View>
                
                <TouchableOpacity 
                  style={styles.debugButton}
                  onPress={handleRefreshProfile}
                >
                  <StyledText variant="bodyMedium" style={styles.debugButtonText}>Refresh Profile Data</StyledText>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.debugButton}
                  onPress={() => console.log(JSON.stringify(profile, null, 2))}
                >
                  <StyledText variant="bodyMedium" style={styles.debugButtonText}>Log Full Profile to Console</StyledText>
                </TouchableOpacity>
              </View>
            )}
            
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
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
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderRadius: borderRadius.round,
    backgroundColor: colors.surface.dark,
  },
  backIcon: {
    marginLeft: -2,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  subtitle: {
    marginBottom: spacing.md,
    opacity: 0.7,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl * 2,
  },
  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(74, 222, 128, 0.3)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.feedback.success,
  },
  completedIcon: {
    marginRight: spacing.sm,
  },
  completedTextContainer: {
    flex: 1,
  },
  completedBannerText: {
    fontWeight: 'bold',
    marginBottom: spacing.xs,
  },
  completedBannerSubtext: {
    opacity: 0.9,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingVertical: spacing.lg,
    backgroundColor: colors.surface.main,
    borderRadius: borderRadius.lg,
    ...shadows.medium,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: spacing.sm,
  },
  avatarGradient: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    backgroundColor: 'transparent',
  },
  setupCompleteIndicator: {
    position: 'absolute',
    bottom: 0,
    right: -4,
    backgroundColor: colors.surface.light,
    borderRadius: 12,
    padding: 2,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: spacing.xs,
  },
  profileStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  setupText: {
    marginLeft: spacing.xs,
  },
  sectionCard: {
    backgroundColor: colors.surface.main,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.medium,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginLeft: spacing.sm,
  },
  divider: {
    backgroundColor: colors.border.light,
    marginBottom: spacing.md,
    height: 1,
  },
  sectionContent: {
    gap: spacing.md,
  },
  emptySectionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    backgroundColor: colors.surface.dark,
    borderRadius: borderRadius.md,
  },
  emptySectionText: {
    marginLeft: spacing.sm,
  },
  editSectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: 'rgba(255, 46, 147, 0.1)',
    borderRadius: borderRadius.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.light,
  },
  infoLabel: {
    flex: 1,
  },
  infoValue: {
    flex: 1,
    textAlign: 'right',
    fontWeight: '500',
  },
  analysisSubtitle: {
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  analysisText: {
    lineHeight: 20,
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
  actionButtonContainer: {
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  completeButton: {
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary.main,
    elevation: 0,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginLeft: spacing.xs,
  },
  buttonIcon: {
    marginLeft: spacing.sm,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary.main,
    backgroundColor: 'transparent',
    marginVertical: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  debugSection: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
  },
  debugTitle: {
    color: '#ff0',
    marginBottom: spacing.sm,
  },
  debugItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  debugLabel: {
    color: '#aaa',
  },
  debugValue: {
    color: '#fff',
  },
  debugButton: {
    backgroundColor: '#333',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginTop: spacing.md,
    alignItems: 'center',
  },
  debugButtonText: {
    color: '#fff',
  },
  decorativeCircle: {
    position: 'absolute',
    borderRadius: 500,
    opacity: 0.2,
    backgroundColor: colors.primary.light,
  },
  decorativeCircle1: {
    width: 300,
    height: 300,
    top: -50,
    right: -100,
  },
  decorativeCircle2: {
    width: 250,
    height: 250,
    bottom: -50,
    left: -100,
  },
});
