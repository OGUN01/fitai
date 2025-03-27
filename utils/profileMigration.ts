import { UserProfile } from '../types/profile';
import { synchronizeProfileData } from './profileSynchronizer';
import { checkOnboardingCompletion, updateOnboardingStep } from './onboardingTracker';
import supabase from '../lib/supabase';

/**
 * Migrate profile data to fix inconsistencies between nested objects and root properties
 * This is a one-time operation to repair an existing profile
 * 
 * @param userId The user ID to migrate
 * @returns Result of the migration operation
 */
export async function migrateProfileData(userId: string): Promise<{ 
  success: boolean; 
  error?: any;
  message?: string;
}> {
  try {
    // Fetch current profile
    const { data: profileData, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
      
    if (error) {
      console.error('Error fetching profile for migration:', error);
      return { 
        success: false, 
        error,
        message: `Failed to fetch profile: ${error.message}`
      };
    }

    if (!profileData) {
      return { 
        success: false, 
        message: 'No profile found for this user ID'
      };
    }
    
    // Step 2: Apply synchronizer to fix data consistency
    const syncedProfile = synchronizeProfileData(profileData);
    
    // Step 3: Add specific fixes for workout data
    if (!syncedProfile.workout_preferences) {
      syncedProfile.workout_preferences = {
        preferred_days: ['monday', 'wednesday', 'friday'],
        workout_duration: 30
      };
    }
    
    // Ensure workout days per week is consistent across all properties
    if (syncedProfile.workout_days_per_week) {
      (syncedProfile.workout_preferences as any).days_per_week = syncedProfile.workout_days_per_week;
      (syncedProfile.workout_preferences as any).workoutFrequency = syncedProfile.workout_days_per_week;
    } else if ((syncedProfile.workout_preferences as any).days_per_week) {
      syncedProfile.workout_days_per_week = (syncedProfile.workout_preferences as any).days_per_week;
    } else if ((syncedProfile.workout_preferences as any).workoutFrequency) {
      syncedProfile.workout_days_per_week = (syncedProfile.workout_preferences as any).workoutFrequency;
      (syncedProfile.workout_preferences as any).days_per_week = (syncedProfile.workout_preferences as any).workoutFrequency;
    } else {
      // Set default if none exists
      syncedProfile.workout_days_per_week = 3;
      (syncedProfile.workout_preferences as any).days_per_week = 3;
      (syncedProfile.workout_preferences as any).workoutFrequency = 3;
    }
    
    // Ensure fitness goals are consistent
    if (Array.isArray(syncedProfile.fitness_goals) && syncedProfile.fitness_goals.length > 0) {
      syncedProfile.workout_preferences.focus_areas = [...syncedProfile.fitness_goals];
      (syncedProfile as any).preferred_workouts = [...syncedProfile.fitness_goals];
    } else if (Array.isArray(syncedProfile.workout_preferences.focus_areas) && syncedProfile.workout_preferences.focus_areas.length > 0) {
      syncedProfile.fitness_goals = [...syncedProfile.workout_preferences.focus_areas];
      (syncedProfile as any).preferred_workouts = [...syncedProfile.workout_preferences.focus_areas];
    } else if (Array.isArray((syncedProfile as any).preferred_workouts) && (syncedProfile as any).preferred_workouts.length > 0) {
      syncedProfile.fitness_goals = [...(syncedProfile as any).preferred_workouts];
      syncedProfile.workout_preferences.focus_areas = [...(syncedProfile as any).preferred_workouts];
    } else {
      // Set default if none exists
      syncedProfile.fitness_goals = ['full body'];
      syncedProfile.workout_preferences.focus_areas = ['full body'];
      (syncedProfile as any).preferred_workouts = ['full body'];
    }
    
    // Check completion status
    const { isComplete } = checkOnboardingCompletion(syncedProfile);
    
    // Update onboarding completion flag if needed
    syncedProfile.has_completed_onboarding = isComplete;
    
    // Update current onboarding step based on data
    const updatedProfile = updateOnboardingStep(syncedProfile);
    
    // Save the fixed profile back to the database
    const { error: updateError } = await supabase
      .from('profiles')
      .update(updatedProfile)
      .eq('id', userId);
      
    if (updateError) {
      console.error('Error updating profile during migration:', updateError);
      return { 
        success: false, 
        error: updateError,
        message: `Failed to update profile: ${updateError.message}`
      };
    }
    
    return { 
      success: true,
      message: 'Profile data successfully migrated and fixed'
    };
  } catch (error) {
    console.error('Error during profile migration:', error);
    return { 
      success: false, 
      error,
      message: error instanceof Error ? error.message : 'Unknown error during migration'
    };
  }
}

/**
 * Validate that a profile's data is consistent between nested objects and root properties
 * This can be used to check if migration is needed
 * 
 * @param profile The profile to validate
 * @returns Result of the validation with discrepancies if found
 */
export function validateProfileConsistency(profile: UserProfile): {
  isConsistent: boolean;
  discrepancies: string[];
} {
  if (!profile) {
    return { 
      isConsistent: false,
      discrepancies: ['Profile is null or undefined']
    };
  }
  
  const discrepancies: string[] = [];
  
  // Check height consistency
  if (profile.height_cm !== profile.body_analysis?.height_cm && 
      profile.height_cm !== undefined && 
      profile.body_analysis?.height_cm !== undefined) {
    discrepancies.push(`Height inconsistency: root ${profile.height_cm} vs body_analysis ${profile.body_analysis?.height_cm}`);
  }
  
  // Check weight consistency
  if (profile.weight_kg !== profile.body_analysis?.weight_kg && 
      profile.weight_kg !== undefined && 
      profile.body_analysis?.weight_kg !== undefined) {
    discrepancies.push(`Weight inconsistency: root ${profile.weight_kg} vs body_analysis ${profile.body_analysis?.weight_kg}`);
  }
  
  // Check target weight consistency
  if (profile.target_weight_kg !== profile.body_analysis?.target_weight_kg && 
      profile.target_weight_kg !== undefined && 
      profile.body_analysis?.target_weight_kg !== undefined) {
    discrepancies.push(`Target weight inconsistency: root ${profile.target_weight_kg} vs body_analysis ${profile.body_analysis?.target_weight_kg}`);
  }
  
  // Check workout frequency consistency
  if (profile.workout_days_per_week) {
    if ((profile.workout_preferences as any)?.days_per_week !== profile.workout_days_per_week) {
      discrepancies.push(`Workout days per week mismatch: ${profile.workout_days_per_week} vs ${(profile.workout_preferences as any)?.days_per_week} in workout_preferences`);
    }
    
    if ((profile.workout_preferences as any)?.workoutFrequency !== profile.workout_days_per_week) {
      discrepancies.push(`Workout frequency mismatch: ${profile.workout_days_per_week} vs ${(profile.workout_preferences as any)?.workoutFrequency} in workout_preferences`);
    }
  }
  
  // Check diet type consistency
  if (profile.diet_type !== profile.diet_preferences?.diet_type && 
      profile.diet_type !== undefined && 
      profile.diet_preferences?.diet_type !== undefined) {
    discrepancies.push(`Diet type inconsistency: root ${profile.diet_type} vs diet_preferences ${profile.diet_preferences?.diet_type}`);
  }
  
  // Check allergies consistency
  const allergiesRoot = profile.allergies ? JSON.stringify(profile.allergies) : 'undefined';
  const allergiesNested = profile.diet_preferences?.allergies ? JSON.stringify(profile.diet_preferences.allergies) : 'undefined';
  
  if (allergiesRoot !== allergiesNested && allergiesRoot !== 'undefined' && allergiesNested !== 'undefined') {
    discrepancies.push(`Allergies inconsistency between root and nested objects`);
  }
  
  // Add checks for workout data
  if (profile.workout_days_per_week) {
    if ((profile.workout_preferences as any)?.days_per_week !== profile.workout_days_per_week) {
      discrepancies.push(`Workout days per week mismatch: ${profile.workout_days_per_week} vs ${(profile.workout_preferences as any)?.days_per_week} in workout_preferences`);
    }
    
    if ((profile.workout_preferences as any)?.workoutFrequency !== profile.workout_days_per_week) {
      discrepancies.push(`Workout frequency mismatch: ${profile.workout_days_per_week} vs ${(profile.workout_preferences as any)?.workoutFrequency} in workout_preferences`);
    }
  }
  
  // Check fitness goals consistency
  if (Array.isArray(profile.fitness_goals) && profile.fitness_goals.length > 0) {
    // Check if focus_areas exists and matches
    if (Array.isArray(profile.workout_preferences?.focus_areas) && 
        profile.fitness_goals.join(',') !== profile.workout_preferences.focus_areas.join(',')) {
      discrepancies.push(`Fitness goals mismatch: ${profile.fitness_goals.join(',')} vs ${profile.workout_preferences.focus_areas?.join(',')} in workout_preferences.focus_areas`);
    }
    
    // Check if preferred_workouts exists and matches
    if (Array.isArray((profile as any).preferred_workouts) && 
        profile.fitness_goals.join(',') !== (profile as any).preferred_workouts.join(',')) {
      discrepancies.push(`Fitness goals mismatch: ${profile.fitness_goals.join(',')} vs ${(profile as any).preferred_workouts?.join(',')} in preferred_workouts`);
    }
  }
  
  return {
    isConsistent: discrepancies.length === 0,
    discrepancies
  };
}

/**
 * Verify and fix onboarding completion status
 * This function specifically checks and fixes the onboarding completion status
 * It's designed to be called during login to prevent onboarding from repeating on new devices
 * 
 * @param userId The user ID to verify
 * @returns Result of the operation
 */
export async function verifyOnboardingCompletion(userId: string): Promise<{ 
  success: boolean; 
  error?: any;
  message?: string;
  wasFixed?: boolean;
}> {
  try {
    // Fetch current profile
    const { data: profileData, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
      
    if (error) {
      console.error('Error fetching profile for onboarding verification:', error);
      return { 
        success: false, 
        error,
        message: `Failed to fetch profile: ${error.message}`
      };
    }

    if (!profileData) {
      return { 
        success: false, 
        message: 'No profile found for this user ID'
      };
    }
    
    // Check if the profile has completed sections but has_completed_onboarding is not set
    const { completedSections, isComplete } = checkOnboardingCompletion(profileData);
    
    let wasFixed = false;
    
    // If the completion status in the database doesn't match the calculated status
    if (isComplete && !profileData.has_completed_onboarding) {
      console.log('Found profile with completed sections but has_completed_onboarding=false, fixing...');
      
      // Fix the onboarding status by setting has_completed_onboarding to true
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          has_completed_onboarding: true,
          current_onboarding_step: 'completed'
        })
        .eq('id', userId);
      
      if (updateError) {
        console.error('Error fixing onboarding completion status:', updateError);
        return {
          success: false,
          error: updateError,
          message: `Failed to fix onboarding status: ${updateError.message}`
        };
      }
      
      wasFixed = true;
      console.log('Fixed onboarding completion status to true');
    }
    
    return {
      success: true,
      message: wasFixed 
        ? 'Onboarding status fixed successfully' 
        : 'Onboarding status is already correct',
      wasFixed
    };
    
  } catch (error) {
    console.error('Error in verifyOnboardingCompletion:', error);
    return { 
      success: false, 
      error,
      message: `Unexpected error: ${error.message || error}`
    };
  }
} 