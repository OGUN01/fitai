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
 * Migrate a profile object to fix inconsistencies between nested objects and root properties
 * This version works with a profile object directly and updates it in the database
 *
 * @param profile The profile object to migrate
 * @returns Result of the migration operation
 */
export async function migrateProfile(profile: UserProfile): Promise<{
  success: boolean;
  error?: any;
  message?: string;
}> {
  try {
    if (!profile || !profile.id) {
      return {
        success: false,
        message: 'Invalid profile object or missing profile ID'
      };
    }

    // Apply synchronizer to fix data consistency
    const syncedProfile = synchronizeProfileData(profile);

    // Add specific fixes for workout data
    if (!syncedProfile.workout_preferences) {
      syncedProfile.workout_preferences = {
        preferred_days: ['monday', 'wednesday', 'friday'],
        workout_duration: 30
      };
    }

    // Ensure workout days per week is consistent across all properties
    // Follow the same logic as the synchronizer
    if (syncedProfile.workout_days_per_week) {
      (syncedProfile.workout_preferences as any).days_per_week = syncedProfile.workout_days_per_week;
      // Remove old/duplicate fields as per synchronizer logic
      delete (syncedProfile.workout_preferences as any).workoutFrequency;
    } else if ((syncedProfile.workout_preferences as any).days_per_week) {
      syncedProfile.workout_days_per_week = (syncedProfile.workout_preferences as any).days_per_week;
    } else if ((syncedProfile.workout_preferences as any).workoutFrequency) {
      // Migrate old field to standard field
      syncedProfile.workout_days_per_week = (syncedProfile.workout_preferences as any).workoutFrequency;
      (syncedProfile.workout_preferences as any).days_per_week = (syncedProfile.workout_preferences as any).workoutFrequency;
      // Remove old field after migration
      delete (syncedProfile.workout_preferences as any).workoutFrequency;
    } else {
      // Set default if none exists
      syncedProfile.workout_days_per_week = 3;
      (syncedProfile.workout_preferences as any).days_per_week = 3;
      // Don't set workoutFrequency as it should be migrated to days_per_week
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
      .eq('id', profile.id);

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
 * Specifically fix workout preferences inconsistencies
 * This function targets the exact issue you're experiencing
 *
 * @param profile The profile object to fix
 * @returns Result of the fix operation
 */
export async function fixWorkoutPreferences(profile: UserProfile): Promise<{
  success: boolean;
  error?: any;
  message?: string;
}> {
  try {
    if (!profile || !profile.id) {
      return {
        success: false,
        message: 'Invalid profile object or missing profile ID'
      };
    }

    // Create a copy to avoid mutating the original
    const updatedProfile = { ...profile };

    // Ensure workout_preferences exists
    if (!updatedProfile.workout_preferences) {
      updatedProfile.workout_preferences = {};
    }

    let hasChanges = false;

    // Fix the specific workout frequency issue
    if (updatedProfile.workout_days_per_week) {
      // Set the correct field and remove the problematic one
      (updatedProfile.workout_preferences as any).days_per_week = updatedProfile.workout_days_per_week;

      // Remove the problematic workoutFrequency field that causes validation errors
      if ((updatedProfile.workout_preferences as any).workoutFrequency !== undefined) {
        delete (updatedProfile.workout_preferences as any).workoutFrequency;
        hasChanges = true;
      }

      console.log(`Fixed workout preferences: set days_per_week to ${updatedProfile.workout_days_per_week} and removed workoutFrequency`);
      hasChanges = true;
    }

    // Fix fitness level consistency
    if (updatedProfile.fitness_level &&
        updatedProfile.workout_preferences.fitness_level !== updatedProfile.fitness_level) {
      updatedProfile.workout_preferences.fitness_level = updatedProfile.fitness_level;
      hasChanges = true;
      console.log(`Synchronized fitness_level: ${updatedProfile.fitness_level}`);
    }

    // Fix focus areas consistency
    if (Array.isArray(updatedProfile.fitness_goals) && updatedProfile.fitness_goals.length > 0) {
      if (!Array.isArray(updatedProfile.workout_preferences.focus_areas) ||
          JSON.stringify(updatedProfile.workout_preferences.focus_areas) !== JSON.stringify(updatedProfile.fitness_goals)) {
        updatedProfile.workout_preferences.focus_areas = [...updatedProfile.fitness_goals];
        hasChanges = true;
        console.log(`Synchronized focus_areas with fitness_goals: ${updatedProfile.fitness_goals.join(', ')}`);
      }
    }

    // Fix workout duration consistency
    if (updatedProfile.workout_duration_minutes &&
        updatedProfile.workout_preferences.workout_duration !== updatedProfile.workout_duration_minutes) {
      updatedProfile.workout_preferences.workout_duration = updatedProfile.workout_duration_minutes;
      hasChanges = true;
      console.log(`Synchronized workout_duration: ${updatedProfile.workout_duration_minutes} minutes`);
    }

    // Only update database if there are actual changes
    if (hasChanges) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          workout_preferences: updatedProfile.workout_preferences
        })
        .eq('id', profile.id);

      if (updateError) {
        console.error('Error updating workout preferences:', updateError);
        return {
          success: false,
          error: updateError,
          message: `Failed to update workout preferences: ${updateError.message}`
        };
      }

      console.log('Successfully fixed workout preferences inconsistencies');
      return {
        success: true,
        message: 'Workout preferences fixed successfully - all inconsistencies resolved'
      };
    } else {
      return {
        success: true,
        message: 'No workout preferences inconsistencies found - profile is already consistent'
      };
    }
  } catch (error) {
    console.error('Error fixing workout preferences:', error);
    return {
      success: false,
      error,
      message: error instanceof Error ? error.message : 'Unknown error fixing workout preferences'
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

    // Only check workoutFrequency if it exists (it should be migrated to days_per_week)
    if ((profile.workout_preferences as any)?.workoutFrequency !== undefined &&
        (profile.workout_preferences as any)?.workoutFrequency !== profile.workout_days_per_week) {
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
  
  // Additional workout data checks (avoid duplicates from above)
  // Note: The main workout frequency checks are already done above
  
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