import AsyncStorage from '@react-native-async-storage/async-storage';
import supabase from '../lib/supabase';
import { UserProfile } from '../types/profile';
import { WorkoutCompletion, MealCompletion } from '../types/tracking';

// Enhance the UUID generation function to be more reliable
function generateUUID(): string {
  try {
    // Try using the native crypto.randomUUID if available
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch (e) {
    console.error("Error using crypto.randomUUID:", e);
  }

  // Fallback to a timestamp-based approach with randomness
  const timestamp = new Date().getTime();
  const randomPart = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
  return `gen_${timestamp}_${randomPart}`;
}

export interface SyncResult {
  success: boolean;
  syncedItems: {
    profile: boolean;
    workouts: number;
    meals: number;
    water: number;
  };
  error?: string;
  rollbackStatus?: {
    attempted: boolean;
    successful: boolean;
    reason?: string;
  };
  syncId?: string;
}

/**
 * Log sync operation with timestamp and context
 */
const logSync = (message: string, data?: any) => {
  const timestamp = new Date().toISOString();
  console.log(`[SYNC ${timestamp}] ${message}`, data ? data : '');
};

/**
 * Safely parse JSON with error handling
 */
const safeJsonParse = (json: string, defaultValue: any = null): any => {
  try {
    return JSON.parse(json);
  } catch (error) {
    console.error('Error parsing JSON:', error);
    return defaultValue;
  }
};

/**
 * Deep merge JSON objects with special handling for arrays
 */
const deepMergeJson = (target: any, source: any, prioritizeSource = true): any => {
  // Create a deep clone to avoid mutating inputs
  const output = JSON.parse(JSON.stringify(target));
  
  if (!source) return output;
  if (!target) return source;
  
  // For non-objects, prioritize source or target based on flag
  if (typeof source !== 'object' || source === null || Array.isArray(source)) {
    return prioritizeSource ? source : target;
  }
  
  // For objects, merge properties
  Object.keys(source).forEach(key => {
    // If property doesn't exist in target, use source
    if (!(key in target)) {
      output[key] = source[key];
    } 
    // If both are objects and not arrays, deep merge
    else if (
      typeof source[key] === 'object' && 
      source[key] !== null && 
      !Array.isArray(source[key]) &&
      typeof target[key] === 'object' && 
      target[key] !== null && 
      !Array.isArray(target[key])
    ) {
      output[key] = deepMergeJson(target[key], source[key], prioritizeSource);
    }
    // Otherwise use source or target based on priority
    else {
      output[key] = prioritizeSource ? source[key] : target[key];
    }
  });
  
  return output;
};

/**
 * Save sync status to AsyncStorage
 */
const saveSyncStatus = async (userId: string, status: SyncResult): Promise<void> => {
  try {
    await AsyncStorage.setItem(`sync_status:${userId}`, JSON.stringify({
      ...status,
      timestamp: new Date().toISOString()
    }));
  } catch (error) {
    console.error('Error saving sync status:', error);
  }
};

/**
 * Create a backup of local data before sync
 */
const backupLocalData = async (userId: string): Promise<boolean> => {
  try {
    logSync('Creating backup of local data before sync');
    
    // Items to backup
    const keys = [
      'local_profile',
      'local_workout_completions',
      'local_meal_completions',
      'local_water_tracking'
    ];
    
    // Read all data
    const dataMap: Record<string, string | null> = {};
    for (const key of keys) {
      dataMap[key] = await AsyncStorage.getItem(key);
    }
    
    // Save backup
    await AsyncStorage.setItem(`sync_backup:${userId}`, JSON.stringify({
      timestamp: new Date().toISOString(),
      data: dataMap
    }));
    
    logSync('Local data backup created successfully');
    return true;
  } catch (error) {
    console.error('Error creating local data backup:', error instanceof Error ? error.message : String(error));
    return false;
  }
};

/**
 * Restore local data from backup if sync fails
 */
const restoreFromBackup = async (userId: string): Promise<boolean> => {
  try {
    logSync('Attempting to restore data from backup');
    
    // Get backup
    const backupJson = await AsyncStorage.getItem(`sync_backup:${userId}`);
    if (!backupJson) {
      logSync('No backup found to restore');
      return false;
    }
    
    // Parse backup
    const backup = safeJsonParse(backupJson);
    if (!backup || !backup.data) {
      logSync('Invalid backup data format');
      return false;
    }
    
    // Restore each item
    for (const [key, value] of Object.entries(backup.data)) {
      if (value !== null) {
        await AsyncStorage.setItem(key, value as string);
      }
    }
    
    logSync('Data successfully restored from backup');
    return true;
  } catch (error) {
    console.error('Error restoring from backup:', error instanceof Error ? error.message : String(error));
    return false;
  }
};

/**
 * Synchronizes local data to the server when a user logs in
 * @param userId The authenticated user's ID
 * @returns A result object indicating success and counts of synced items
 */
export async function syncLocalDataToServer(userId: string): Promise<SyncResult> {
  const syncId = `sync_${Date.now()}`;
  logSync(`Starting data sync for user ${userId} (Sync ID: ${syncId})`);
  
  // Set sync in progress flag with timestamp
  const syncTimestamp = Date.now();
  await AsyncStorage.setItem('sync_in_progress', 'true');
  await AsyncStorage.setItem('sync_in_progress_since', JSON.stringify(syncTimestamp));
  
  const result: SyncResult = {
    success: false,
    syncedItems: {
      profile: false,
      workouts: 0,
      meals: 0,
      water: 0
    },
    syncId
  };
  
  try {
    // Step 0: Create backup of local data for rollback if needed
    const backupCreated = await backupLocalData(userId);
    if (!backupCreated) {
      logSync('Warning: Failed to create backup, proceeding with sync without rollback capability');
    }
    
    // Step 1: Sync profile data
    const localProfileData = await AsyncStorage.getItem('local_profile');
    if (localProfileData) {
      logSync('Local profile found, processing');
      
      // Parse local profile with error handling
      let localProfile: UserProfile;
      try {
        localProfile = JSON.parse(localProfileData);
        logSync('Local profile parsed successfully');
      } catch (parseError) {
        logSync('Error parsing local profile JSON', parseError);
        throw new Error(`Invalid local profile data: ${(parseError instanceof Error ? parseError.message : String(parseError))}`);
      }
      
      // Get server profile
      logSync('Fetching server profile');
      const { data: serverProfile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (profileError && profileError.code !== 'PGRST116') {
        logSync('Error fetching server profile', profileError);
        throw new Error(`Error fetching server profile: ${profileError.message}`);
      }
      
      logSync('Server profile fetch result', { 
        found: !!serverProfile, 
        onboardingComplete: serverProfile?.has_completed_onboarding || false,
        hasMealPlans: !!serverProfile?.meal_plans
      });
      
      // Merge profiles, giving preference to LOCAL data for conflicts
      logSync('Merging profiles with LOCAL data priority');
      
      // Special handling for complex nested objects
      let mergedProfile: Record<string, any> = {
        // Start with server profile data as the base (if available)
        ...(serverProfile || {}),
        // Override with local profile data (giving priority to local changes)
        ...localProfile,
        // Ensure the correct ID is set and remove any duplicate from localProfile spread
        id: userId,
        // Handle special fields
        has_completed_onboarding: true, // If we have local data, consider onboarding complete
        current_onboarding_step: 'completed'
      };
      
      // Special handling for meal_plans (deep merge if both exist)
      if (localProfile.meal_plans && serverProfile?.meal_plans) {
        logSync('Found meal plans in both local and server profiles, performing deep merge');
        try {
          mergedProfile.meal_plans = deepMergeJson(
            serverProfile.meal_plans,
            localProfile.meal_plans,
            true // Prioritize local meal plans
          );
        } catch (mergeError) {
          logSync('Error merging meal plans, using local version', mergeError);
          mergedProfile.meal_plans = localProfile.meal_plans;
        }
      } else {
        // Use whichever exists (prioritize local)
        mergedProfile.meal_plans = localProfile.meal_plans || serverProfile?.meal_plans;
      }
      
      // Special handling for workout_preferences (deep merge if both exist)
      if (localProfile.workout_preferences && serverProfile?.workout_preferences) {
        logSync('Merging workout preferences');
        try {
          mergedProfile.workout_preferences = deepMergeJson(
            serverProfile.workout_preferences,
            localProfile.workout_preferences,
            true // Prioritize local workout preferences
          );
        } catch (mergeError) {
          logSync('Error merging workout preferences, using local version', mergeError);
          mergedProfile.workout_preferences = localProfile.workout_preferences;
        }
      }
      
      // Special handling for diet_preferences (deep merge if both exist)
      if (localProfile.diet_preferences && serverProfile?.diet_preferences) {
        logSync('Merging diet preferences');
        try {
          mergedProfile.diet_preferences = deepMergeJson(
            serverProfile.diet_preferences,
            localProfile.diet_preferences,
            true // Prioritize local diet preferences
          );
        } catch (mergeError) {
          logSync('Error merging diet preferences, using local version', mergeError);
          mergedProfile.diet_preferences = localProfile.diet_preferences;
        }
      }
      
      // Clean up local-only fields
      delete mergedProfile.has_completed_local_onboarding;
      
      logSync("Merged profile with LOCAL data priority", {
        has_completed_onboarding: mergedProfile.has_completed_onboarding,
        current_onboarding_step: mergedProfile.current_onboarding_step,
        has_meal_plans: !!mergedProfile.meal_plans,
        has_workout_preferences: !!mergedProfile.workout_preferences,
        has_diet_preferences: !!mergedProfile.diet_preferences
      });
      
      // Update or insert profile to server
      if (serverProfile) {
        logSync('Updating existing profile in database');
        // Prepare the payload, excluding the ID field
        const { id: _, ...profileDataToUpdate } = mergedProfile;

        const { error: updateError } = await supabase
          .from('profiles')
          .update(profileDataToUpdate) // Use the payload without the ID
          .eq('id', userId);
          
        if (updateError) {
          logSync('Error updating profile', updateError);
          throw new Error(`Error updating profile: ${updateError.message}`);
        }
      } else {
        logSync('Creating new profile in database');
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            ...mergedProfile,
            id: userId
          });
          
        if (insertError) {
          logSync('Error inserting profile', insertError);
          throw new Error(`Error inserting profile: ${insertError.message}`);
        }
      }
      
      // Store the merged profile in the user's profile cache 
      // This ensures the profile context gets the merged data too
      try {
        await AsyncStorage.setItem(`profile:${userId}`, JSON.stringify(mergedProfile));
        logSync('Updated merged profile in cache storage for new user');
      } catch (cacheError) {
        logSync('Error caching merged profile', cacheError);
        // Continue despite this error
      }
      
      result.syncedItems.profile = true;
    }
    
    // Step 2: Sync workout completions
    const workoutCompletionsData = await AsyncStorage.getItem('local_workout_completions');
    if (workoutCompletionsData) {
      logSync('Found local workout completions data');
      
      // Parse with error handling
      let localWorkouts: WorkoutCompletion[];
      try {
        localWorkouts = JSON.parse(workoutCompletionsData);
        logSync(`Parsed ${localWorkouts.length} local workout completions`);
      } catch (parseError) {
        logSync('Error parsing workout completions', parseError);
        throw new Error(`Invalid workout completions data: ${(parseError instanceof Error ? parseError.message : String(parseError))}`);
      }
      
      // Map local workout completions to server format with GUARANTEED IDs
      const serverWorkouts = localWorkouts.map(workout => {
        // First check if the workout already has a valid ID
        const existingId = workout.id && typeof workout.id === 'string' && workout.id.length > 5 
          ? workout.id 
          : null;
          
        return {
          ...workout,
          id: existingId || generateUUID(), // Use existing ID if valid, otherwise generate
          user_id: userId // Ensure user ID is correct
        };
      });
      
      // Insert workout completions to server
      if (serverWorkouts.length > 0) {
        logSync(`Syncing ${serverWorkouts.length} workout completions to server`);
        
        const { error: workoutsError } = await supabase
          .from('workout_completions')
          .upsert(serverWorkouts, {
            onConflict: 'user_id,workout_date,workout_day_name'
          });
          
        if (workoutsError) {
          logSync('Error syncing workouts', workoutsError);
          // Continue with other syncs despite this error
        } else {
          result.syncedItems.workouts = serverWorkouts.length;
          logSync(`Successfully synced ${serverWorkouts.length} workout completions`);
          
          // If we have workout data, ensure onboarding is marked complete
          if (serverWorkouts.length > 0) {
            try {
              logSync('Updating onboarding status due to workout data');
              const { error: profileUpdateError } = await supabase
                .from('profiles')
                .update({ 
                  has_completed_onboarding: true,
                  current_onboarding_step: 'completed' 
                })
                .eq('id', userId);
                
              if (!profileUpdateError) {
                logSync("Updated onboarding status due to workout data");
              } else {
                logSync("Failed to update profile after workout sync", profileUpdateError);
              }
            } catch (error) {
              logSync("Failed to update profile after workout sync", error);
              // Continue despite this error
            }
          }
        }
      }
    }
    
    // Step 3: Sync meal completions
    const mealCompletionsData = await AsyncStorage.getItem('local_meal_completions');
    if (mealCompletionsData) {
      logSync('Found local meal completions data');
      
      // Parse with error handling
      let localMeals: MealCompletion[];
      try {
        localMeals = JSON.parse(mealCompletionsData);
        logSync(`Parsed ${localMeals.length} local meal completions`);
      } catch (parseError) {
        logSync('Error parsing meal completions', parseError);
        throw new Error(`Invalid meal completions data: ${(parseError instanceof Error ? parseError.message : String(parseError))}`);
      }
      
      // Map local meal completions to server format with GUARANTEED IDs
      const serverMeals = localMeals.map(meal => {
        // First check if the meal already has a valid ID
        const existingId = meal.id && typeof meal.id === 'string' && meal.id.length > 5 
          ? meal.id 
          : null;
          
        return {
          ...meal,
          id: existingId || generateUUID(), // Use existing ID if valid, otherwise generate
          user_id: userId // Ensure user ID is correct
        };
      });
      
      // Insert meal completions to server
      if (serverMeals.length > 0) {
        logSync(`Syncing ${serverMeals.length} meal completions to server`);
        
        const { error: mealsError } = await supabase
          .from('meal_completions')
          .upsert(serverMeals, {
            onConflict: 'user_id,meal_date,meal_type'
          });
          
        if (mealsError) {
          logSync('Error syncing meals', mealsError);
          // Continue with other syncs despite this error
        } else {
          result.syncedItems.meals = serverMeals.length;
          logSync(`Successfully synced ${serverMeals.length} meal completions`);
        }
      }
    }
    
    // Step 4: Sync water tracking data
    const waterTrackingData = await AsyncStorage.getItem('local_water_tracking');
    if (waterTrackingData) {
      logSync('Found local water tracking data');
      
      // Parse with error handling
      let localWaterEntries;
      try {
        localWaterEntries = JSON.parse(waterTrackingData);
        logSync(`Parsed ${localWaterEntries.length} local water tracking entries`);
      } catch (parseError) {
        logSync('Error parsing water tracking data', parseError);
        throw new Error(`Invalid water tracking data: ${(parseError instanceof Error ? parseError.message : String(parseError))}`);
      }
      
      // Map local water entries to server format
      const serverWaterEntries = localWaterEntries.map((entry: any) => ({
        ...entry,
        id: generateUUID(), // Generate UUID instead of undefined
        user_id: userId // Ensure user ID is correct
      }));
      
      // Insert water tracking entries to server
      if (serverWaterEntries.length > 0) {
        logSync(`Syncing ${serverWaterEntries.length} water tracking entries to server`);
        
        const { error: waterError } = await supabase
          .from('water_tracking')
          .upsert(serverWaterEntries, {
            onConflict: 'user_id,tracking_date'
          });
          
        if (waterError) {
          logSync('Error syncing water tracking', waterError);
          // Continue despite this error
        } else {
          result.syncedItems.water = serverWaterEntries.length;
          logSync(`Successfully synced ${serverWaterEntries.length} water tracking entries`);
        }
      }
    }
    
    // Step 5: Mark sync as complete
    logSync(`Sync completed successfully (Sync ID: ${syncId})`);
    result.success = true;
    
    // Finally, remove the sync in progress flag and update status
    await AsyncStorage.removeItem('sync_in_progress');
    await AsyncStorage.removeItem('sync_in_progress_since');
    
    // Store successful sync status for the user
    await AsyncStorage.setItem(`sync_status:${userId}`, JSON.stringify({
      timestamp: new Date().toISOString(),
      status: 'success',
      syncId: syncId,
      counts: result.syncedItems
    }));
    
    return result;
  } catch (error) {
    logSync(`Error in syncLocalDataToServer (Sync ID: ${syncId})`, error);
    
    // Attempt rollback if backup exists
    const rollbackResult: { attempted: boolean; successful: boolean; reason?: string } = { 
      attempted: false, 
      successful: false 
    };
    try {
      rollbackResult.attempted = true;
      const rollbackSuccess = await restoreFromBackup(userId);
      rollbackResult.successful = rollbackSuccess;
      
      if (rollbackSuccess) {
        logSync('Successfully rolled back to previous state after sync error');
      } else {
        logSync('Failed to roll back after sync error');
      }
    } catch (rollbackError) {
      const message = rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
      logSync('Error during rollback attempt', message);
      rollbackResult.successful = false;
      rollbackResult.reason = message || 'Unknown rollback error';
    }
    
    // Update result with error info
    result.error = (error instanceof Error ? error.message : String(error)) || 'Unknown error occurred during data synchronization';
    result.rollbackStatus = rollbackResult;
    
    // Save error status
    await saveSyncStatus(userId, result);
    
    return result;
  }
}

/**
 * Get the last sync status for a user
 */
export async function getSyncStatus(userId: string): Promise<any> {
  try {
    const statusJson = await AsyncStorage.getItem(`sync_status:${userId}`);
    return statusJson ? JSON.parse(statusJson) : null;
  } catch (error) {
    console.error('Error getting sync status:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * Calculate the total size of data stored in AsyncStorage
 * This is useful for debugging and monitoring storage usage
 */
export async function getLocalStorageSize(): Promise<number> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    let totalSize = 0;
    
    for (const key of keys) {
      const value = await AsyncStorage.getItem(key);
      if (value) {
        totalSize += value.length;
      }
    }
    
    console.log(`Total AsyncStorage usage: ${totalSize} bytes (${(totalSize / 1024).toFixed(2)} KB)`);
    return totalSize;
  } catch (error) {
    console.error('Error calculating AsyncStorage size:', error);
    return 0;
  }
}

/**
 * Check if synchronization is currently in progress
 */
export async function isSyncInProgress(): Promise<boolean> {
  try {
    const syncInProgress = await AsyncStorage.getItem('sync_in_progress');
    return syncInProgress === 'true';
  } catch (error) {
    console.error('Error checking sync status:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

/**
 * Get detailed information about sync errors and status
 */
export const getSyncDiagnostics = async (): Promise<any> => {
  try {
    const diagnostics: any = {
      storage: {},
      timestamps: {},
    };

    // Get all relevant keys from AsyncStorage for diagnostics
    const localKeys = [
      'local_profile', 
      'local_workout_completions', 
      'local_meal_completions',
      'last_sync_timestamp',
      'sync_in_progress'
    ];

    // Get all local data
    for (const key of localKeys) {
      try {
        const data = await AsyncStorage.getItem(key);
        diagnostics.storage[key] = data ? JSON.parse(data) : null;
      } catch (error) {
        diagnostics.storage[key] = { error: error instanceof Error ? error.message : String(error) || 'Error parsing data' };
      }
    }

    // Get all keys to see if there are any unexpected ones
    const allKeys = await AsyncStorage.getAllKeys();
    diagnostics.allStorageKeys = allKeys.filter(key => 
      key.includes('local_') || 
      key.includes('sync_') || 
      key.includes('profile_') ||
      key.includes('meal_') ||
      key.includes('workout_')
    );

    // Get sync timestamps
    try {
      const lastSyncRaw = await AsyncStorage.getItem('last_sync_timestamp');
      const lastSync = lastSyncRaw ? JSON.parse(lastSyncRaw) : null;
      
      if (lastSync) {
        const now = Date.now();
        diagnostics.timestamps = {
          lastSync,
          now,
          minutesSinceLastSync: Math.round((now - lastSync) / 60000),
          hoursSinceLastSync: Math.round((now - lastSync) / 3600000)
        };
      }
    } catch (error) {
      diagnostics.timestamps.error = error instanceof Error ? error.message : String(error) || 'Error getting timestamps';
    }

    // Add sync status
    try {
      const syncInProgressRaw = await AsyncStorage.getItem('sync_in_progress');
      diagnostics.syncStatus = {
        inProgress: syncInProgressRaw ? JSON.parse(syncInProgressRaw) : false,
      };
    } catch (error) {
      diagnostics.syncStatus = { error: error instanceof Error ? error.message : String(error) || 'Error getting sync status' };
    }

    return diagnostics;
  } catch (error) {
    console.error('Error getting sync diagnostics:', error instanceof Error ? error.message : String(error));
    return { error: error instanceof Error ? error.message : String(error) || 'Unknown error getting diagnostics' };
  }
};

// Add this export for the settings screen to use
export async function repairDatabaseSync(userId: string): Promise<{
  success: boolean;
  message: string;
  repairs: {
    workouts: number;
    meals: number;
  };
}> {
  try {
    console.log("Starting database repair process for user:", userId);
    const repairs = {
      workouts: 0,
      meals: 0
    };
    
    // Step 1: First attempt to get all existing server records for this user
    // This way we can avoid duplicating records with new IDs
    console.log("Fetching existing server workout completions");
    const { data: existingWorkouts, error: workoutsError } = await supabase
      .from('workout_completions')
      .select('*')
      .eq('user_id', userId);
      
    if (workoutsError) {
      console.error("Error fetching existing workouts:", workoutsError);
    }
    
    console.log("Fetching existing server meal completions");
    const { data: existingMeals, error: mealsError } = await supabase
      .from('meal_completions')
      .select('*')
      .eq('user_id', userId);
      
    if (mealsError) {
      console.error("Error fetching existing meals:", mealsError);
    }
    
    // Step 2: Get local workout completions
    const workoutData = await AsyncStorage.getItem('local_workout_completions');
    if (workoutData) {
      let localWorkouts = [];
      try {
        localWorkouts = JSON.parse(workoutData);
        console.log(`Found ${localWorkouts.length} local workouts to repair`);
      } catch (parseError) {
        console.error("Error parsing local workout data:", parseError);
      }
      
      if (localWorkouts.length > 0) {
        // Create a lookup map of existing server workouts to avoid duplication
        const existingWorkoutMap = new Map();
        if (existingWorkouts && Array.isArray(existingWorkouts)) {
          existingWorkouts.forEach(workout => {
            const key = `${workout.workout_date}|${workout.workout_day_name}`;
            existingWorkoutMap.set(key, workout);
          });
        }
        
        // Map local workouts to server format with guaranteed IDs
        const repairedWorkouts = [];
        
        for (const workout of localWorkouts) {
          const key = `${workout.workout_date}|${workout.workout_day_name}`;
          const existingWorkout = existingWorkoutMap.get(key);
          
          if (existingWorkout) {
            // This workout already exists on the server, no need to insert
            console.log(`Workout for ${key} already exists on server, skipping`);
            continue;
          }
          
          // Ensure the workout has a valid ID
          const repairedWorkout = {
            ...workout,
            id: generateUUID(),
            user_id: userId
          };
          
          repairedWorkouts.push(repairedWorkout);
        }
        
        // Insert the repaired workouts
        if (repairedWorkouts.length > 0) {
          console.log(`Inserting ${repairedWorkouts.length} repaired workouts`);
          
          // Break into batches of 50 to avoid server limits
          const batchSize = 50;
          for (let i = 0; i < repairedWorkouts.length; i += batchSize) {
            const batch = repairedWorkouts.slice(i, i + batchSize);
            const { error: batchError } = await supabase
              .from('workout_completions')
              .insert(batch);
              
            if (batchError) {
              console.error(`Error inserting workout batch ${i}:`, batchError);
            } else {
              repairs.workouts += batch.length;
              console.log(`Successfully inserted batch ${i} of workouts (${batch.length} items)`);
            }
          }
        }
      }
    }
    
    // Step 3: Get local meal completions
    const mealData = await AsyncStorage.getItem('local_meal_completions');
    if (mealData) {
      let localMeals = [];
      try {
        localMeals = JSON.parse(mealData);
        console.log(`Found ${localMeals.length} local meals to repair`);
      } catch (parseError) {
        console.error("Error parsing local meal data:", parseError);
      }
      
      if (localMeals.length > 0) {
        // Create a lookup map of existing server meals to avoid duplication
        const existingMealMap = new Map();
        if (existingMeals && Array.isArray(existingMeals)) {
          existingMeals.forEach(meal => {
            const key = `${meal.meal_date}|${meal.meal_type}`;
            existingMealMap.set(key, meal);
          });
        }
        
        // Map local meals to server format with guaranteed IDs
        const repairedMeals = [];
        
        for (const meal of localMeals) {
          const key = `${meal.meal_date}|${meal.meal_type}`;
          const existingMeal = existingMealMap.get(key);
          
          if (existingMeal) {
            // This meal already exists on the server, no need to insert
            console.log(`Meal for ${key} already exists on server, skipping`);
            continue;
          }
          
          // Ensure the meal has a valid ID
          const repairedMeal = {
            ...meal,
            id: generateUUID(),
            user_id: userId
          };
          
          repairedMeals.push(repairedMeal);
        }
        
        // Insert the repaired meals
        if (repairedMeals.length > 0) {
          console.log(`Inserting ${repairedMeals.length} repaired meals`);
          
          // Break into batches of 50 to avoid server limits
          const batchSize = 50;
          for (let i = 0; i < repairedMeals.length; i += batchSize) {
            const batch = repairedMeals.slice(i, i + batchSize);
            const { error: batchError } = await supabase
              .from('meal_completions')
              .insert(batch);
              
            if (batchError) {
              console.error(`Error inserting meal batch ${i}:`, batchError);
            } else {
              repairs.meals += batch.length;
              console.log(`Successfully inserted batch ${i} of meals (${batch.length} items)`);
            }
          }
        }
      }
    }
    
    return {
      success: true,
      message: `Successfully repaired database sync with ${repairs.workouts} workouts and ${repairs.meals} meals`,
      repairs
    };
  } catch (error) {
    console.error("Error repairing database sync:", error);
    return {
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || "Unknown error repairing database sync",
      repairs: { workouts: 0, meals: 0 }
    };
  }
} 