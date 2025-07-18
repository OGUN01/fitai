import { UserProfile } from '../types/profile';

/**
 * Check the completion status of the onboarding process based on profile data
 * This examines the profile data to determine which sections have been completed
 * 
 * @param profile The user profile to check
 * @returns Object containing completion status and list of completed sections
 */
export function checkOnboardingCompletion(profile: UserProfile): { 
  isComplete: boolean; 
  completedSections: string[];
  nextStep: string;
} {
  if (!profile) {
    return { 
      isComplete: false, 
      completedSections: [],
      nextStep: 'user-details'
    };
  }
  
  if (profile.has_completed_onboarding === true) {
    console.log("Profile has has_completed_onboarding=true, respecting that flag");
    return {
      isComplete: true,
      completedSections: ['user-details', 'workout-preferences', 'diet-preferences', 'body-analysis'],
      nextStep: 'completed'
    };
  }
  
  const completedSections: string[] = [];
  
  // Check user details section
  const hasUserDetails = Boolean(
    profile.full_name && 
    profile.age && 
    (profile.height_cm || profile.body_analysis?.height_cm) && 
    (profile.weight_kg || profile.body_analysis?.weight_kg) &&
    (profile.target_weight_kg || profile.body_analysis?.target_weight_kg) &&
    profile.weight_goal
  );
  
  if (hasUserDetails) {
    completedSections.push('user-details');
  }
  
  // Check workout preferences section
  const hasWorkoutPreferences = Boolean(
    profile.fitness_level && 
    profile.workout_days_per_week && 
    (profile.fitness_goals?.length > 0 || profile.workout_preferences?.focus_areas?.length > 0)
  );
  
  if (hasWorkoutPreferences) {
    completedSections.push('workout-preferences');
  }
  
  // Check diet preferences section
  const hasDietPreferences = Boolean(
    profile.diet_type && 
    profile.meal_frequency &&
    (profile.diet_preferences?.diet_type || profile.diet_type)
  );
  
  if (hasDietPreferences) {
    completedSections.push('diet-preferences');
  }
  
  // Check body analysis section
  const hasBodyAnalysis = Boolean(
    profile.body_analysis?.body_fat_percentage || 
    profile.body_analysis?.body_type || 
    profile.body_analysis?.analysis_text
  );
  
  if (hasBodyAnalysis) {
    completedSections.push('body-analysis');
  }
  
  // Determine overall completion status
  const isComplete = completedSections.length === 4; // All 4 sections need to be complete
  
  // Determine next step based on what's missing
  let nextStep = 'review';
  
  if (!hasUserDetails) {
    nextStep = 'user-details';
  } else if (!hasWorkoutPreferences) {
    nextStep = 'workout-preferences';
  } else if (!hasDietPreferences) {
    nextStep = 'diet-preferences';
  } else if (!hasBodyAnalysis) {
    nextStep = 'body-analysis';
  }
  
  return { 
    isComplete, 
    completedSections,
    nextStep 
  };
}

/**
 * Get a human-readable status message for each onboarding section
 * 
 * @param profile The user profile to check
 * @returns Object with status messages for each section
 */
export function getOnboardingSectionStatus(profile: UserProfile): Record<string, string> {
  const { completedSections } = checkOnboardingCompletion(profile);
  
  return {
    'user-details': completedSections.includes('user-details') 
      ? 'Complete' 
      : 'Incomplete',
    'workout-preferences': completedSections.includes('workout-preferences') 
      ? 'Complete' 
      : 'Incomplete',
    'diet-preferences': completedSections.includes('diet-preferences') 
      ? 'Complete' 
      : 'Incomplete',
    'body-analysis': completedSections.includes('body-analysis') 
      ? 'Complete' 
      : 'Incomplete'
  };
}

/**
 * Update the onboarding step in a profile based on actual data completion
 * 
 * @param profile The user profile to update
 * @returns Updated profile with correct onboarding step
 */
export function updateOnboardingStep(profile: UserProfile): UserProfile {
  if (!profile) return profile;
  
  const { nextStep, isComplete } = checkOnboardingCompletion(profile);
  const updatedProfile = { ...profile };
  
  // Update the current onboarding step
  updatedProfile.current_onboarding_step = nextStep;
  
  // Update completion status if all sections are complete
  if (isComplete) {
    updatedProfile.has_completed_onboarding = true;
  }
  
  return updatedProfile;
} 