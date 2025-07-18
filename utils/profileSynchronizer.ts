// COMPLETELY REWORKED PROFILE SYNCHRONIZER FILE

import { UserProfile } from '../types/profile';

/**
 * Synchronize profile data between nested objects and root properties
 * This ensures both locations contain the same data for consistent access
 * 
 * @param profile The user profile to synchronize
 * @returns A synchronized user profile with consistent data
 */
export function synchronizeProfileData(profile: UserProfile): UserProfile {
  if (!profile) return profile;
  
  try {
    const updatedProfile = { ...profile };
    
    // Create body_analysis if it doesn't exist
    if (!updatedProfile.body_analysis) {
      updatedProfile.body_analysis = {};
    }
    
    // Only create workout_preferences if it doesn't exist in the database
    if (!updatedProfile.workout_preferences) {
      updatedProfile.workout_preferences = {
        preferred_days: ['monday', 'wednesday', 'friday'],
        workout_duration: 30,
        focus_areas: [],
        intensity_level: 'beginner',
        equipment: [],
        equipment_available: []
      };
    }
    
    // Only create diet_preferences if it doesn't exist in the database
    if (!updatedProfile.diet_preferences) {
      updatedProfile.diet_preferences = {
        meal_frequency: 3,
        diet_type: 'balanced',
        allergies: [],
        excluded_foods: [],
        favorite_foods: [],
        country_region: ''
      };
    }
    
    // Ensure country_region exists in the diet_preferences (might be missing)
    if (!('country_region' in updatedProfile.diet_preferences)) {
      updatedProfile.diet_preferences.country_region = '';
    }
    
    // Ensure all text properties are explicitly defined as strings to avoid React Native text rendering issues
    // This prevents direct string access in components that might cause "Text strings must be rendered within a <Text> component" errors
    
    // Convert any potential string properties to ensure they are proper strings
    // Body analysis text properties
    if (updatedProfile.body_analysis) {
      // Handle analysis text in both formats
      if (updatedProfile.body_analysis.analysisText !== undefined) {
        updatedProfile.body_analysis.analysisText = String(updatedProfile.body_analysis.analysisText || '');
      }
      
      if (updatedProfile.body_analysis.analysis_text !== undefined) {
        updatedProfile.body_analysis.analysis_text = String(updatedProfile.body_analysis.analysis_text || '');
      }
      
      // Handle body type in both formats
      if (updatedProfile.body_analysis.bodyType !== undefined) {
        updatedProfile.body_analysis.bodyType = String(updatedProfile.body_analysis.bodyType || '');
      }
      
      if (updatedProfile.body_analysis.body_type !== undefined) {
        updatedProfile.body_analysis.body_type = String(updatedProfile.body_analysis.body_type || '');
      }
      
      // Ensure arrays are defined to prevent "x.map is not a function" errors
      if (!Array.isArray(updatedProfile.body_analysis.recommendedFocusAreas)) {
        updatedProfile.body_analysis.recommendedFocusAreas = [];
      }
      
      if (!Array.isArray(updatedProfile.body_analysis.recommended_focus_areas)) {
        updatedProfile.body_analysis.recommended_focus_areas = [];
      }
    }
    
    // Diet preferences
    if (updatedProfile.diet_preferences) {
      if (updatedProfile.diet_preferences.diet_type !== undefined) {
        updatedProfile.diet_preferences.diet_type = String(updatedProfile.diet_preferences.diet_type || '');
      }
      
      if (updatedProfile.diet_preferences.country_region !== undefined) {
        updatedProfile.diet_preferences.country_region = String(updatedProfile.diet_preferences.country_region || '');
      }
      
      if (!Array.isArray(updatedProfile.diet_preferences.allergies)) {
        updatedProfile.diet_preferences.allergies = [];
      }
    }
    
    // Workout preferences
    if (updatedProfile.workout_preferences) {
      if (updatedProfile.workout_preferences.fitness_level !== undefined) {
        updatedProfile.workout_preferences.fitness_level = String(updatedProfile.workout_preferences.fitness_level || '');
      }
      
      if (!Array.isArray(updatedProfile.workout_preferences.focus_areas)) {
        updatedProfile.workout_preferences.focus_areas = [];
      }
      
      // Ensure both equipment arrays exist and are arrays
      if (!Array.isArray(updatedProfile.workout_preferences.equipment)) {
        updatedProfile.workout_preferences.equipment = [];
      }
      
      if (!Array.isArray(updatedProfile.workout_preferences.equipment_available)) {
        updatedProfile.workout_preferences.equipment_available = [];
      }

      // Synchronize equipment between the two fields
      if (updatedProfile.workout_preferences.equipment.length > 0) {
        updatedProfile.workout_preferences.equipment_available = [...updatedProfile.workout_preferences.equipment];
      } else if (updatedProfile.workout_preferences.equipment_available.length > 0) {
        updatedProfile.workout_preferences.equipment = [...updatedProfile.workout_preferences.equipment_available];
      }
    }
    
    // Root properties
    if (updatedProfile.diet_type !== undefined) {
      updatedProfile.diet_type = String(updatedProfile.diet_type || '');
    }
    
    if (updatedProfile.fitness_level !== undefined) {
      updatedProfile.fitness_level = String(updatedProfile.fitness_level || '');
    }
    
    if (updatedProfile.weight_goal !== undefined) {
      updatedProfile.weight_goal = String(updatedProfile.weight_goal || '');
    }
    
    if (!Array.isArray(updatedProfile.fitness_goals)) {
      updatedProfile.fitness_goals = [];
    }
    
    if (!Array.isArray(updatedProfile.allergies)) {
      updatedProfile.allergies = [];
    }

    // Now perform the original synchronization logic
    
    // Height synchronization
    if (updatedProfile.height_cm) {
      updatedProfile.body_analysis.height_cm = updatedProfile.height_cm;
    } else if (updatedProfile.body_analysis.height_cm) {
      updatedProfile.height_cm = updatedProfile.body_analysis.height_cm;
    }
    
    // Weight synchronization
    if (updatedProfile.weight_kg) {
      updatedProfile.body_analysis.weight_kg = updatedProfile.weight_kg;
    } else if (updatedProfile.body_analysis.weight_kg) {
      updatedProfile.weight_kg = updatedProfile.body_analysis.weight_kg;
    }
    
    // Target weight synchronization
    if (updatedProfile.target_weight_kg) {
      updatedProfile.body_analysis.target_weight_kg = updatedProfile.target_weight_kg;
    } else if (updatedProfile.body_analysis.target_weight_kg) {
      updatedProfile.target_weight_kg = updatedProfile.body_analysis.target_weight_kg;
    }
    
    // Body fat percentage synchronization (safely)
    if (updatedProfile.body_analysis && typeof updatedProfile.body_analysis.body_fat_percentage === 'number') {
      // The main UserProfile doesn't have body_fat_percentage at root level in the interface
      // So we only synchronize from body_analysis
      (updatedProfile as any).body_fat_percentage = updatedProfile.body_analysis.body_fat_percentage;
    }
    
    // Workout preferences sync
    if (updatedProfile.workout_preferences) {
      // Fitness level - scalar field is the source of truth
      if (updatedProfile.fitness_level) {
        updatedProfile.workout_preferences.fitness_level = updatedProfile.fitness_level;
      } else if (updatedProfile.workout_preferences.fitness_level) {
        updatedProfile.fitness_level = updatedProfile.workout_preferences.fitness_level;
      }
      
      // Workout days per week - scalar field is the source of truth
      if (updatedProfile.workout_days_per_week) {
        // Store as a number in the workout_preferences object
        (updatedProfile.workout_preferences as any).days_per_week = updatedProfile.workout_days_per_week;
        // Remove old/duplicate fields
        delete (updatedProfile.workout_preferences as any).workoutFrequency;
      } else if ((updatedProfile.workout_preferences as any).days_per_week) {
        updatedProfile.workout_days_per_week = (updatedProfile.workout_preferences as any).days_per_week;
      } else if ((updatedProfile.workout_preferences as any).workoutFrequency) {
        // Migrate old field to standard field
        updatedProfile.workout_days_per_week = (updatedProfile.workout_preferences as any).workoutFrequency;
        (updatedProfile.workout_preferences as any).days_per_week = (updatedProfile.workout_preferences as any).workoutFrequency;
        // Remove old field after migration
        delete (updatedProfile.workout_preferences as any).workoutFrequency;
      }
      
      // Workout duration - scalar field is the source of truth
      if (updatedProfile.workout_duration_minutes) {
        updatedProfile.workout_preferences.workout_duration = updatedProfile.workout_duration_minutes;
      } else if (updatedProfile.workout_preferences.workout_duration) {
        updatedProfile.workout_duration_minutes = updatedProfile.workout_preferences.workout_duration;
      }
      
      // Focus areas - fitness_goals is the source of truth
      if (Array.isArray(updatedProfile.fitness_goals) && updatedProfile.fitness_goals.length > 0) {
        updatedProfile.workout_preferences.focus_areas = [...updatedProfile.fitness_goals];
        // Migrate any old preferred_workouts field
        if ('preferred_workouts' in updatedProfile) {
          delete (updatedProfile as any).preferred_workouts;
        }
      } else if (Array.isArray(updatedProfile.workout_preferences.focus_areas) && updatedProfile.workout_preferences.focus_areas.length > 0) {
        updatedProfile.fitness_goals = [...updatedProfile.workout_preferences.focus_areas];
      } else if (Array.isArray((updatedProfile as any).preferred_workouts) && (updatedProfile as any).preferred_workouts.length > 0) {
        // Migrate from old field
        updatedProfile.fitness_goals = [...(updatedProfile as any).preferred_workouts];
        updatedProfile.workout_preferences.focus_areas = [...(updatedProfile as any).preferred_workouts];
        // Remove old field after migration
        delete (updatedProfile as any).preferred_workouts;
      }
      
      // Equipment handling - for gym location, we don't need to specify equipment
      if (updatedProfile.workout_preferences.workout_location === 'gym') {
        // For gym locations, standard equipment is assumed
        updatedProfile.workout_preferences.equipment = ["standard gym equipment"];
        // Clean up any duplicate equipment fields
        delete (updatedProfile.workout_preferences as any).equipment_available;
      } else if (Array.isArray(updatedProfile.workout_preferences.equipment) && updatedProfile.workout_preferences.equipment.length > 0) {
        // If equipment exists, make sure it's the only equipment field
        if ((updatedProfile.workout_preferences as any).equipment_available) {
          delete (updatedProfile.workout_preferences as any).equipment_available;
        }
      } else if (Array.isArray((updatedProfile.workout_preferences as any).equipment_available) && 
                (updatedProfile.workout_preferences as any).equipment_available.length > 0) {
        // Migrate from alternate field name
        updatedProfile.workout_preferences.equipment = [...(updatedProfile.workout_preferences as any).equipment_available];
        delete (updatedProfile.workout_preferences as any).equipment_available;
      }
    }
    
    // Diet preferences sync
    if (updatedProfile.diet_preferences) {
      // Diet type
      if (updatedProfile.diet_type) {
        updatedProfile.diet_preferences.diet_type = updatedProfile.diet_type;
      } else if (updatedProfile.diet_preferences.diet_type) {
        updatedProfile.diet_type = updatedProfile.diet_preferences.diet_type;
      }
      
      // Allergies
      if (Array.isArray(updatedProfile.allergies) && updatedProfile.allergies.length > 0) {
        updatedProfile.diet_preferences.allergies = [...updatedProfile.allergies];
      } else if (Array.isArray(updatedProfile.diet_preferences.allergies) && updatedProfile.diet_preferences.allergies.length > 0) {
        updatedProfile.allergies = [...updatedProfile.diet_preferences.allergies];
      }
      
      // Meal frequency
      if (updatedProfile.meal_frequency) {
        updatedProfile.diet_preferences.meal_frequency = updatedProfile.meal_frequency;
      } else if (updatedProfile.diet_preferences.meal_frequency) {
        updatedProfile.meal_frequency = updatedProfile.diet_preferences.meal_frequency;
      }
      
      // Country region
      if (updatedProfile.country_region) {
        updatedProfile.diet_preferences.country_region = updatedProfile.country_region;
      } else if (updatedProfile.diet_preferences.country_region) {
        updatedProfile.country_region = updatedProfile.diet_preferences.country_region;
      }
      
      // Diet restrictions
      if (updatedProfile.diet_restrictions) {
        updatedProfile.diet_preferences.dietary_restrictions = updatedProfile.diet_restrictions;
      } else if (updatedProfile.diet_preferences.dietary_restrictions) {
        updatedProfile.diet_restrictions = updatedProfile.diet_preferences.dietary_restrictions;
      }
    }
    
    // Synchronize country region between root property and nested diet preferences
    // Prioritize the root country_region property
    if (updatedProfile.country_region) {
      // If root property exists, ensure it's copied to diet_preferences
      if (!updatedProfile.diet_preferences) {
        // Create a minimal diet_preferences object that satisfies the type requirements
        updatedProfile.diet_preferences = {
          country_region: updatedProfile.country_region,
          meal_frequency: 0,
          diet_type: '',
          allergies: [],
          excluded_foods: [],
          favorite_foods: []
        };
      } else {
        updatedProfile.diet_preferences.country_region = updatedProfile.country_region;
      }
      console.log(`Synchronized country_region from root (${updatedProfile.country_region}) to diet_preferences`);
    } 
    // If only exists in diet_preferences, copy to root
    else if (updatedProfile.diet_preferences?.country_region) {
      updatedProfile.country_region = updatedProfile.diet_preferences.country_region;
      console.log(`Synchronized country_region from diet_preferences (${updatedProfile.diet_preferences.country_region}) to root`);
    }
    
    return updatedProfile;
  } catch (error) {
    console.error('Error in synchronizeProfileData:', error);
    // Return the original profile if synchronization fails
    return profile;
  }
}

/**
 * Synchronizes diet preferences between the root profile object and the nested diet_preferences object
 * @param profile UserProfile object to synchronize diet preferences for
 * @returns UserProfile with synchronized diet preferences
 */
export const synchronizeDietPreferences = (profile: UserProfile): UserProfile => {
  if (!profile) return profile;
  
  // Create a deep copy to avoid mutating the original object
  const syncedProfile = { ...profile };
  
  // Initialize diet_preferences if it doesn't exist
  if (!syncedProfile.diet_preferences) {
    syncedProfile.diet_preferences = {
      meal_frequency: 3,
      diet_type: 'balanced',
      allergies: [],
      excluded_foods: [],
      favorite_foods: []
    };
  }
  
  // COUNTRY REGION SYNCHRONIZATION - critical for UI display
  // Ensure country_region is consistent between root and diet_preferences
  if (syncedProfile.country_region && !syncedProfile.diet_preferences.country_region) {
    console.log('Sync: copying country_region from root to diet_preferences:', syncedProfile.country_region);
    syncedProfile.diet_preferences.country_region = syncedProfile.country_region;
  } else if (!syncedProfile.country_region && syncedProfile.diet_preferences.country_region) {
    console.log('Sync: copying country_region from diet_preferences to root:', syncedProfile.diet_preferences.country_region);
    syncedProfile.country_region = syncedProfile.diet_preferences.country_region;
  }
  
  // Always ensure these values match (prioritize the root level)
  if (syncedProfile.country_region && syncedProfile.diet_preferences.country_region) {
    if (syncedProfile.country_region !== syncedProfile.diet_preferences.country_region) {
      console.log('Sync: country_region mismatch, setting both to root value:', syncedProfile.country_region);
      syncedProfile.diet_preferences.country_region = syncedProfile.country_region;
    }
  }
  
  // Log the final state of country_region
  console.log('Sync completed - Root country_region:', syncedProfile.country_region);
  console.log('Sync completed - diet_preferences.country_region:', syncedProfile.diet_preferences.country_region);
  
  return syncedProfile;
};