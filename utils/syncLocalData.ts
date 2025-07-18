import AsyncStorage from '@react-native-async-storage/async-storage';
import supabase from '../lib/supabase';
import { UserProfile } from '../types/profile';
import { WorkoutCompletion, MealCompletion } from '../types/tracking';
import { filterToDatabaseColumns } from './profileUtils';
import { validateAndCleanSyncData, filterValidWorkoutCompletions, filterValidMealCompletions } from './dataValidation';
import { validatePreSync } from './dataSyncIntegrityChecker';

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

  // Fallback to RFC 4122 version 4 UUID format
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Helper function to clear successfully synced local data from AsyncStorage.
 */
const clearSyncedLocalData = async (keysToClear: string[]): Promise<void> => {
  if (keysToClear.length === 0) {
    return;
  }
  logSync('Attempting to clear locally synced keys from AsyncStorage', keysToClear);
  try {
    await AsyncStorage.multiRemove(keysToClear);
    logSync('Successfully cleared specified keys from AsyncStorage', keysToClear);
  } catch (error) {
    logSync('Error clearing specified keys from AsyncStorage', { keys: keysToClear, error });
  }
};

export interface SyncResult {
  success: boolean;
  syncedItems: {
    profile: boolean;
    workouts: number;
    meals: number;
    water: number;
    nutrition: number;
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
 * Save sync status to AsyncStorage with enhanced debugging information
 */
const saveSyncStatus = async (userId: string, status: SyncResult): Promise<void> => {
  try {
    const enhancedStatus = {
      ...status,
      timestamp: new Date().toISOString(),
      userId: userId,
      debugInfo: {
        platform: 'react-native',
        version: '1.0.0',
        syncDuration: status.syncId ? Date.now() - parseInt(status.syncId.split('_')[1]) : 0
      }
    };

    await AsyncStorage.setItem(`sync_status:${userId}`, JSON.stringify(enhancedStatus));

    // Also maintain a general sync log for debugging
    try {
      const syncLogKey = 'sync_debug_log';
      const existingLogJson = await AsyncStorage.getItem(syncLogKey);
      let syncLog = existingLogJson ? JSON.parse(existingLogJson) : [];

      // Keep only last 10 sync attempts for debugging
      syncLog.push(enhancedStatus);
      if (syncLog.length > 10) {
        syncLog = syncLog.slice(-10);
      }

      await AsyncStorage.setItem(syncLogKey, JSON.stringify(syncLog));
      logSync('Enhanced sync status saved with debugging information');
    } catch (logError) {
      logSync('Error updating sync debug log', logError);
    }
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

  // Pre-sync validation to ensure data integrity
  logSync('Performing pre-sync data validation...');
  try {
    const preSyncValidation = await validatePreSync();

    if (!preSyncValidation.canSync) {
      logSync('❌ Pre-sync validation failed. Issues found:');
      preSyncValidation.issues.forEach(issue => logSync(`  - ${issue}`));

      return {
        success: false,
        error: `Data integrity issues prevent sync: ${preSyncValidation.issues.join(', ')}`,
        syncedCounts: { profiles: 0, workouts: 0, meals: 0 },
        syncId
      };
    }

    if (preSyncValidation.autoFixApplied) {
      logSync('✅ Auto-fix applied to resolve data integrity issues');
    }

    logSync('✅ Pre-sync validation passed, proceeding with sync...');
  } catch (validationError) {
    logSync(`❌ Pre-sync validation error: ${validationError}`);
    // Continue with sync but log the validation error
  }

  // ENHANCED LOGGING: Track sync progress for debugging
  logSync('=== SYNC DEBUG INFO ===');
  logSync(`User ID: ${userId}`);
  logSync(`Sync timestamp: ${new Date().toISOString()}`);
  logSync(`Sync ID: ${syncId}`);

  // Set sync in progress flag with timestamp
  const syncTimestamp = Date.now();
  await AsyncStorage.setItem('sync_in_progress', 'true');
  await AsyncStorage.setItem('sync_in_progress_since', JSON.stringify(syncTimestamp));
  
  let backupCreated = false; // Declare here

  const result: SyncResult = {
    success: false,
    syncedItems: {
      profile: false,
      workouts: 0,
      meals: 0,
      water: 0,
      nutrition: 0
    },
    syncId
  };
  
  try {
    // Step 0: Create backup of local data for rollback if needed
    backupCreated = await backupLocalData(userId); // Assign here
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
      const { data: serverProfileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId);

      if (profileError && profileError.code !== 'PGRST116') {
        logSync('Error fetching server profile', profileError);
        throw new Error(`Error fetching server profile: ${profileError.message}`);
      }

      // Handle array response properly
      const serverProfile = serverProfileData && serverProfileData.length > 0 ? serverProfileData[0] : null;
      
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

      // === START Sanitize streak fields (logic remains similar, but deletion deferred) ===
      if (mergedProfile.workout_tracking === undefined) {
        mergedProfile.workout_tracking = {};
      }

      let localTopLevelStreak: number | undefined = undefined;
      if (typeof mergedProfile.streak === 'number') {
        localTopLevelStreak = mergedProfile.streak;
        logSync('Identified top-level mergedProfile.streak for potential nesting', localTopLevelStreak);
      } else if (typeof mergedProfile.streak_days === 'number') {
        localTopLevelStreak = mergedProfile.streak_days;
        logSync('Identified top-level mergedProfile.streak_days for potential nesting', localTopLevelStreak);
      }

      if (localTopLevelStreak !== undefined) {
        if (mergedProfile.workout_tracking.streak === undefined || localTopLevelStreak > (mergedProfile.workout_tracking.streak || 0)) {
          logSync('Updating mergedProfile.workout_tracking.streak with identified top-level streak value', localTopLevelStreak);
          mergedProfile.workout_tracking.streak = localTopLevelStreak;
          if (localTopLevelStreak > (mergedProfile.workout_tracking.longestStreak || 0)) {
            mergedProfile.workout_tracking.longestStreak = localTopLevelStreak;
          }
        }
      }
      // Note: We are NOT deleting mergedProfile.streak or mergedProfile.streak_days yet.
      // This will be done AFTER successful DB operation, before caching to AsyncStorage.
      // The payload for Supabase will be constructed selectively.
      logSync('Top-level streak fields in mergedProfile (if any) are now processed for nesting in workout_tracking.', { 
        currentWorkoutTrackingStreak: mergedProfile.workout_tracking.streak,
        mergedProfileStreak: mergedProfile.streak, 
        mergedProfileStreakDays: mergedProfile.streak_days 
      });
      // === END Sanitize streak fields ===
      
      logSync("Merged profile object (pre-DB sanitization check)", {
        keys: Object.keys(mergedProfile),
        has_streak: mergedProfile.hasOwnProperty('streak'),
        has_streak_days: mergedProfile.hasOwnProperty('streak_days'),
        workout_tracking: mergedProfile.workout_tracking
      });
      
      // Update or insert profile to server
      if (serverProfile) {
        logSync('Preparing to update existing profile in database');
        
        let profileDataToUpdate: Record<string, any> = {};
        for (const key in mergedProfile) {
          if (mergedProfile.hasOwnProperty(key) && key !== 'id' && key !== 'streak' && key !== 'streak_days') {
            profileDataToUpdate[key] = mergedProfile[key];
          }
        }

        // Ensure workout_tracking is an object if it exists, otherwise it might be ignored by filter or cause issues
        if (profileDataToUpdate.workout_tracking && typeof profileDataToUpdate.workout_tracking !== 'object') {
            logSync('Warning: workout_tracking in profileDataToUpdate is not an object, attempting to clear/reset.', profileDataToUpdate.workout_tracking);
            profileDataToUpdate.workout_tracking = {}; // Or handle more gracefully if needed
        }
        if (profileDataToUpdate.meal_tracking && typeof profileDataToUpdate.meal_tracking !== 'object') {
          logSync('Warning: meal_tracking in profileDataToUpdate is not an object, attempting to clear/reset.', profileDataToUpdate.meal_tracking);
          profileDataToUpdate.meal_tracking = {}; 
        }

        const filteredProfileDataToUpdate = filterToDatabaseColumns(profileDataToUpdate);

        logSync('Sanitized and Filtered payload for Supabase UPDATE:', {
          originalKeys: Object.keys(profileDataToUpdate),
          filteredKeys: Object.keys(filteredProfileDataToUpdate),
          has_workout_tracking: filteredProfileDataToUpdate.hasOwnProperty('workout_tracking'),
          workout_tracking_content: filteredProfileDataToUpdate.workout_tracking
        });

        if (filteredProfileDataToUpdate.hasOwnProperty('streak') || filteredProfileDataToUpdate.hasOwnProperty('streak_days')) {
            logSync('CRITICAL POST-FILTER ALERT: filteredProfileDataToUpdate STILL CONTAINS top-level streak/streak_days!', Object.keys(filteredProfileDataToUpdate));
        }

        const { error: updateError } = await supabase
          .from('profiles')
          .update(filteredProfileDataToUpdate)
          .eq('id', userId);
          
        if (updateError) {
          logSync('Error updating profile', updateError);
          throw new Error(`Error updating profile: ${updateError.message}`);
        }
        logSync('Profile updated successfully in database.');
      } else {
        logSync('Preparing to create new profile in database');

        let profileDataToInsert: Record<string, any> = {};
        for (const key in mergedProfile) {
          if (mergedProfile.hasOwnProperty(key) && key !== 'streak' && key !== 'streak_days') {
            profileDataToInsert[key] = mergedProfile[key];
          }
        }
        profileDataToInsert.id = userId;

        // Ensure workout_tracking is an object if it exists
        if (profileDataToInsert.workout_tracking && typeof profileDataToInsert.workout_tracking !== 'object') {
            logSync('Warning: workout_tracking in profileDataToInsert is not an object, attempting to clear/reset.', profileDataToInsert.workout_tracking);
            profileDataToInsert.workout_tracking = {}; 
        }
        if (profileDataToInsert.meal_tracking && typeof profileDataToInsert.meal_tracking !== 'object') {
          logSync('Warning: meal_tracking in profileDataToInsert is not an object, attempting to clear/reset.', profileDataToInsert.meal_tracking);
          profileDataToInsert.meal_tracking = {}; 
        }

        const filteredProfileDataToInsert = filterToDatabaseColumns(profileDataToInsert);

        logSync('Sanitized and Filtered payload for Supabase INSERT:', {
          originalKeys: Object.keys(profileDataToInsert),
          filteredKeys: Object.keys(filteredProfileDataToInsert),
          has_id: filteredProfileDataToInsert.hasOwnProperty('id'),
          id_value: filteredProfileDataToInsert.id,
          has_workout_tracking: filteredProfileDataToInsert.hasOwnProperty('workout_tracking'),
          workout_tracking_content: filteredProfileDataToInsert.workout_tracking
        });
        if (filteredProfileDataToInsert.hasOwnProperty('streak') || filteredProfileDataToInsert.hasOwnProperty('streak_days')) {
            logSync('CRITICAL POST-FILTER ALERT: filteredProfileDataToInsert STILL CONTAINS top-level streak/streak_days!', Object.keys(filteredProfileDataToInsert));
        }
        
        const { error: insertError } = await supabase
          .from('profiles')
          .insert(filteredProfileDataToInsert)
          .select();
          
        if (insertError) {
          logSync('Error inserting profile', insertError);
          throw new Error(`Error inserting profile: ${insertError.message}`);
        }
        logSync('Profile inserted successfully in database.');
      }
      
      // After successful DB operation, now clean mergedProfile for caching.
      if (mergedProfile.hasOwnProperty('streak')) {
        delete mergedProfile.streak;
        logSync('Deleted top-level streak from mergedProfile before caching.');
      }
      if (mergedProfile.hasOwnProperty('streak_days')) {
        delete mergedProfile.streak_days;
        logSync('Deleted top-level streak_days from mergedProfile before caching.');
      }
      
      // Store the merged profile in the user's profile cache 
      try {
        await AsyncStorage.setItem(`profile:${userId}`, JSON.stringify(mergedProfile));
        logSync('Updated cleaned merged profile in AsyncStorage for user profile context');
      } catch (cacheError) {
        logSync('Error caching cleaned merged profile', cacheError);
        // Continue despite this error
      }
      
      result.syncedItems.profile = true;
    }
    
    // Helper function to prepare and collect activity items from multiple sources
    const collectActivityItems = async (
      primaryKey: string, 
      legacyKey: string, 
      idField: string = 'id' // field that might contain a pre-existing server_id or local uuid
    ): Promise<any[]> => {
      let allItems: any[] = [];
      const processedIds = new Set<string>(); // To track items already added from primary source by their unique content

      // 1. Process primary key (e.g., 'local_workout_completions')
      const primaryDataJson = await AsyncStorage.getItem(primaryKey);
      if (primaryDataJson) {
        try {
          const primaryItems = JSON.parse(primaryDataJson);
          if (Array.isArray(primaryItems)) {
            allItems.push(...primaryItems);
            // For robust deduplication, one might create a unique key from content
            // e.g., primaryItems.forEach(item => processedIds.add(generateItemContentKey(item)));
            logSync(`Collected ${primaryItems.length} items from primary key ${primaryKey}`);
          }
        } catch (e) {
          logSync(`Error parsing JSON from ${primaryKey}`, e);
        }
      }

      // 2. Process legacy key (e.g., 'completed_workouts')
      const legacyDataJson = await AsyncStorage.getItem(legacyKey);
      if (legacyDataJson) {
        try {
          const legacyItems = JSON.parse(legacyDataJson);
          if (Array.isArray(legacyItems)) {
            // Filter out items already processed if we had a robust content key.
            // For now, we'll rely on server-side upsert for deduplication.
            // We need to ensure items from legacyKey are compatible or transformed.
            // Items from legacyKey (e.g. 'completed_workouts') might have 'server_id'
            // if previously processed by dataSynchronizer.ts.
            // The upsert logic in syncLocalDataToServer expects an 'id' field for its UUID generation.
            // If legacy items have 'server_id', we should map it to 'id' or ensure `generateUUID` handles it.
            const transformedLegacyItems = legacyItems.map(item => {
              const newItem = { ...item };
              if (item.server_id && !item[idField]) {
                newItem[idField] = item.server_id; // Map server_id to the expected idField
              }
              // Remove server_id if it's not the primary idField to avoid confusion with Supabase column names
              // delete newItem.server_id; 
              return newItem;
            });
            allItems.push(...transformedLegacyItems);
            logSync(`Collected ${legacyItems.length} items from legacy key ${legacyKey}`);
          }
        } catch (e) {
          logSync(`Error parsing JSON from ${legacyKey}`, e);
        }
      }
      // Further deduplication can be done here if necessary based on content
      // For now, simple concatenation, relying on server upsert.
      logSync(`Total collected items for ${primaryKey}/${legacyKey}: ${allItems.length}`);
      return allItems;
    };

    // Step 2: Sync workout completions (from 'local_workout_completions' AND 'completed_workouts')
    let allLocalWorkouts = await collectActivityItems('local_workout_completions', 'completed_workouts');

    // === START DEDUPLICATION FOR WORKOUTS ===
    if (allLocalWorkouts.length > 0) {
      logSync(`Original collected workouts count: ${allLocalWorkouts.length}`);
      const uniqueWorkoutsMap = new Map<string, any>();
      allLocalWorkouts.forEach(workout => {
        // Ensure properties exist before creating the key
        const date = workout.workout_date || 'unknown_date';
        const dayName = workout.workout_day_name || 'unknown_day';
        const key = `${date}_${dayName}`;
        if (!uniqueWorkoutsMap.has(key)) {
          uniqueWorkoutsMap.set(key, workout);
        }
      });
      allLocalWorkouts = Array.from(uniqueWorkoutsMap.values());
      logSync(`Deduplicated workouts count: ${allLocalWorkouts.length}`);
    }
    // === END DEDUPLICATION FOR WORKOUTS ===

    if (allLocalWorkouts.length > 0) {
      logSync(`Processing ${allLocalWorkouts.length} total workout completions from combined sources`);

      // Prepare workouts with user ID - convert 'local_user' to actual user ID
      const preparedWorkouts = allLocalWorkouts.map(workout => {
        const preparedWorkout: any = { ...workout };

        // Replace 'local_user' with the actual authenticated user ID
        if (preparedWorkout.user_id === 'local_user' || !preparedWorkout.user_id) {
          preparedWorkout.user_id = userId;
          logSync(`Converting local_user workout to authenticated user: ${workout.workout_date}`);
        } else {
          preparedWorkout.user_id = userId; // Ensure consistency
        }

        delete preparedWorkout.id; // Always delete the ID to let database generate new one
        return preparedWorkout;
      });

      // Use comprehensive validation to filter out invalid records
      const serverWorkouts = filterValidWorkoutCompletions(preparedWorkouts);
      logSync(`After validation: ${serverWorkouts.length} valid workouts out of ${preparedWorkouts.length} total`);

      if (serverWorkouts.length > 0) {
        logSync(`Syncing ${serverWorkouts.length} validated workout completions to server`);
        const { error: workoutsError } = await supabase
          .from('workout_completions')
          .upsert(serverWorkouts, {
            onConflict: 'user_id,workout_date,workout_day_name',
            ignoreDuplicates: false // Explicitly set to false, which is default, to ensure updates happen
          });

        if (workoutsError) {
          logSync('Error syncing workouts', workoutsError);
          // Potentially throw or set result.error
        } else {
          result.syncedItems.workouts = serverWorkouts.length;
          logSync(`Successfully synced ${serverWorkouts.length} workout completions`);

          // CRITICAL FIX: Update local storage with new user IDs before clearing
          // This ensures immediate visibility of workout completions after login
          try {
            logSync('Updating local workout completions with new user IDs for immediate visibility');
            const updatedLocalWorkouts = serverWorkouts.map(workout => ({
              ...workout,
              id: workout.id || generateUUID(), // Ensure ID exists
              user_id: userId // Ensure correct user ID
            }));

            // Save updated workouts to local storage with new user IDs
            await persistenceAdapter.setItem('local_workout_completions', updatedLocalWorkouts);
            await AsyncStorage.setItem('local_workout_completions', JSON.stringify(updatedLocalWorkouts));

            logSync(`Updated ${updatedLocalWorkouts.length} local workout completions with authenticated user ID`);
          } catch (updateError) {
            logSync('Error updating local workout completions with new user IDs', updateError);
          }

          // Clear old local workout data after successful sync and update
          await clearSyncedLocalData(['completed_workouts']); // Only clear legacy key, keep updated local_workout_completions

          // Update onboarding status (existing logic)
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
            }
          }
        }
      } else {
        logSync('No valid workout completions to sync after filtering.');
      }
    }
    
    // Step 3: Sync meal completions (from 'local_meal_completions' AND 'meals')
    let allLocalMeals = await collectActivityItems('local_meal_completions', 'meals');

    // === START DEDUPLICATION FOR MEALS ===
    if (allLocalMeals.length > 0) {
      logSync(`Original collected meals count: ${allLocalMeals.length}`);
      const uniqueMealsMap = new Map<string, any>();
      allLocalMeals.forEach(meal => {
        // Ensure properties exist before creating the key
        const date = meal.meal_date || 'unknown_date';
        const type = meal.meal_type || 'unknown_type';
        const key = `${date}_${type}`;
        if (!uniqueMealsMap.has(key)) {
          uniqueMealsMap.set(key, meal);
        }
      });
      allLocalMeals = Array.from(uniqueMealsMap.values());
      logSync(`Deduplicated meals count: ${allLocalMeals.length}`);
    }
    // === END DEDUPLICATION FOR MEALS ===

    if (allLocalMeals.length > 0) {
      logSync(`Processing ${allLocalMeals.length} total meal completions from combined sources`);

      // Prepare meals with user ID - convert 'local_user' to actual user ID
      const preparedMeals = allLocalMeals.map(meal => {
        const preparedMeal: any = { ...meal };

        // Replace 'local_user' with the actual authenticated user ID
        if (preparedMeal.user_id === 'local_user' || !preparedMeal.user_id) {
          preparedMeal.user_id = userId;
          logSync(`Converting local_user meal to authenticated user: ${meal.meal_date} (${meal.meal_type})`);
        } else {
          preparedMeal.user_id = userId; // Ensure consistency
        }

        delete preparedMeal.id; // Always delete the ID to let database generate new one
        return preparedMeal;
      });

      // Use comprehensive validation to filter out invalid records
      const serverMeals = filterValidMealCompletions(preparedMeals);
      logSync(`After validation: ${serverMeals.length} valid meals out of ${preparedMeals.length} total`);

      if (serverMeals.length > 0) {
        logSync(`Syncing ${serverMeals.length} validated meal completions to server`);
        const { error: mealsError } = await supabase
          .from('meal_completions')
          .upsert(serverMeals, {
            onConflict: 'user_id,meal_date,meal_type',
            ignoreDuplicates: false
          });
          
        if (mealsError) {
          logSync('Error syncing meals', mealsError);
          // Potentially throw or set result.error
        } else {
          result.syncedItems.meals = serverMeals.length;
          logSync(`Successfully synced ${serverMeals.length} meal completions`);

          // CRITICAL FIX: Update local storage with new user IDs before clearing
          // This ensures immediate visibility of meal completions after login
          try {
            logSync('Updating local meal completions with new user IDs for immediate visibility');
            const updatedLocalMeals = serverMeals.map(meal => ({
              ...meal,
              id: meal.id || generateUUID(), // Ensure ID exists
              user_id: userId // Ensure correct user ID
            }));

            // Save updated meals to local storage with new user IDs
            await persistenceAdapter.setItem('local_meal_completions', updatedLocalMeals);
            await AsyncStorage.setItem('local_meal_completions', JSON.stringify(updatedLocalMeals));

            logSync(`Updated ${updatedLocalMeals.length} local meal completions with authenticated user ID`);
          } catch (updateError) {
            logSync('Error updating local meal completions with new user IDs', updateError);
          }

          // Clear old local meal data after successful sync and update
          await clearSyncedLocalData(['meals']); // Only clear legacy key, keep updated local_meal_completions
        }
      } else {
        logSync('No valid meal completions to sync after filtering.');
      }
    }
    
    // Step 4: Sync water tracking data (from 'local_water_tracking')
    // Commenting out as no dedicated 'water_tracking' table exists for daily entries.
    // Water goals are part of the 'profiles' table and handled by profile sync.
    /*
    const waterTrackingData = await AsyncStorage.getItem('local_water_tracking');
    if (waterTrackingData) {
      logSync('Found local water tracking data');
      let localWaterEntries: any[] = [];
      try {
        localWaterEntries = JSON.parse(waterTrackingData);
        logSync(`Parsed ${localWaterEntries.length} local water tracking entries`);
      } catch (parseError) {
        logSync('Error parsing water tracking', parseError);
      }
      
      if (Array.isArray(localWaterEntries) && localWaterEntries.length > 0) {
        const serverWaterEntries = localWaterEntries.map(entry => ({
        ...entry,
          id: entry.id || generateUUID(), 
          user_id: userId
        })).filter(entry => entry.date); 

        if (serverWaterEntries.length > 0) {
          logSync(`Syncing ${serverWaterEntries.length} water entries to server`);
          // const { error: waterError } = await supabase
          //         .from('water_tracking') // This table does not exist
          // .upsert(serverWaterEntries, {
          //           onConflict: 'user_id,date', 
          //           ignoreDuplicates: false 
          // });
          
          // if (waterError) {
          //         logSync('Error syncing water entries', waterError);
          // } else {
          //   result.syncedItems.water = serverWaterEntries.length;
          //         logSync(`Successfully synced ${serverWaterEntries.length} water entries`);
          //       }
        }
      }
    }
    */

    // Step 5: Sync Nutrition Tracking into profiles.meal_tracking (JSONB)
    // This replaces the conceptual sync to a 'nutrition_logs' table.
    const allLocalNutrition = await collectActivityItems('local_nutrition_tracking', 'nutrition_tracking', 'id'); // Assuming 'id' helps identify items

    if (allLocalNutrition.length > 0) {
      logSync(`Processing ${allLocalNutrition.length} total nutrition entries from combined sources for profiles.meal_tracking`);
      
      // Fetch current meal_tracking data from profiles
      const { data: userProfileDataArray, error: profileFetchError } = await supabase
        .from('profiles')
        .select('meal_tracking')
        .eq('id', userId);

      if (profileFetchError) {
        logSync('Error fetching profile for meal_tracking sync', profileFetchError);
        // Decide if this is a critical error to stop sync or just skip this part
      } else {
        // Handle array response properly
        const userProfileData = userProfileDataArray && userProfileDataArray.length > 0 ? userProfileDataArray[0] : null;
        let serverMealTracking = userProfileData?.meal_tracking || [];
        if (!Array.isArray(serverMealTracking)) {
            logSync('Server meal_tracking is not an array, initializing.', { serverMealTracking });
            serverMealTracking = [];
        }

        // Prepare local items: ensure they have user_id and a unique id
        const localNutritionItemsToSync = allLocalNutrition.map(item => ({
          ...item,
          id: item.id || generateUUID(), // Ensure unique ID for each entry
          user_id: userId // Ensure user_id is present, though it's for the parent profile record
        }));

        // Merge local items into serverMealTracking, avoiding duplicates
        // Simple duplicate check based on 'id'. More complex checks might be needed based on item structure.
        const existingIds = new Set(serverMealTracking.map((item: any) => item.id));
        const newItems = localNutritionItemsToSync.filter((item: any) => !existingIds.has(item.id));
        
        if (newItems.length > 0) {
          const updatedMealTracking = [...serverMealTracking, ...newItems];
          logSync(`Merging ${newItems.length} new nutrition entries into profiles.meal_tracking`);

          const { error: updateError } = await supabase
            .from('profiles')
            .update({ meal_tracking: updatedMealTracking })
            .eq('id', userId);

          if (updateError) {
            logSync('Error updating profiles.meal_tracking', updateError);
          } else {
            result.syncedItems.nutrition = newItems.length;
            logSync(`Successfully synced ${newItems.length} nutrition entries to profiles.meal_tracking`);
            // Clear local nutrition data after successful sync
            await clearSyncedLocalData(['local_nutrition_tracking', 'nutrition_tracking']);
          }
        } else {
          logSync('No new nutrition entries to add to profiles.meal_tracking.');
        }
      }
    }

    // Placeholder for Body Measurements (conceptual) - Commenting out as no dedicated table
    // Snapshot body measurements like weight_kg, height_cm are part of the main 'profiles' sync
    // if they are included in the 'local_profile' object.
    // If 'body_analysis' (jsonb) field in 'profiles' is to be used for time-series,
    // it would require a specific merge strategy similar to 'meal_tracking'.
    /*
    const allLocalBodyMeasurements = await collectActivityItems('local_body_measurements', 'body_measurements');
    if (allLocalBodyMeasurements.length > 0) {
      logSync(`Processing ${allLocalBodyMeasurements.length} total body measurements`);
    //   const serverBodyMeasurements = allLocalBodyMeasurements.map(m => ({...m, id: m.id || generateUUID(), user_id: userId }))
    //      .filter(m => m.date ); // and other required fields for conflict
    //   if (serverBodyMeasurements.length > 0) {
    //      const {error} = await supabase.from('body_measurements').upsert(serverBodyMeasurements, {onConflict: 'user_id,date,type'});
    //      if (!error) result.syncedItems.bodyMeasurements = serverBodyMeasurements.length; // Add to SyncResult
    //   }
    }
    */

    // Clear unused local_water_tracking key if it exists, as it's not synced
    const waterData = await AsyncStorage.getItem('local_water_tracking');
    if (waterData) {
        await clearSyncedLocalData(['local_water_tracking']);
    }

    result.success = true; // Mark as success if we reach here without throwing
    
  } catch (error) {
    logSync('Error during data sync process', error);
    result.success = false;
    result.error = error instanceof Error ? error.message : String(error);
    
    // Attempt rollback if backup was created
    if (backupCreated) {
      logSync('Sync failed, attempting to restore from backup');
      const restored = await restoreFromBackup(userId);
      result.rollbackStatus = { attempted: true, successful: restored };
      if (!restored) {
        logSync('Critical: Sync failed AND backup restoration failed.');
        result.error += "; Backup restoration also failed.";
      }
    }
  } finally {
    // Always clear the in-progress flag
    await AsyncStorage.removeItem('sync_in_progress');
    await AsyncStorage.removeItem('sync_in_progress_since');
    
    // Save final sync status
    await saveSyncStatus(userId, result);
    
    logSync(`Sync process finished for user ${userId} (Sync ID: ${syncId})`, result);
  }
  
  return result;
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
 * Get comprehensive sync debug information for troubleshooting
 */
export async function getSyncDebugInfo(userId?: string): Promise<any> {
  try {
    const debugInfo: any = {
      timestamp: new Date().toISOString(),
      userId: userId || 'unknown',
      syncStatus: {},
      localStorage: {},
      syncLog: [],
      storageSize: 0
    };

    // Get sync status for specific user
    if (userId) {
      debugInfo.syncStatus = await getSyncStatus(userId);
    }

    // Get sync in progress status
    debugInfo.syncInProgress = await isSyncInProgress();

    // Get sync debug log
    try {
      const syncLogJson = await AsyncStorage.getItem('sync_debug_log');
      debugInfo.syncLog = syncLogJson ? JSON.parse(syncLogJson) : [];
    } catch (logError) {
      debugInfo.syncLog = { error: 'Failed to get sync log' };
    }

    // Get local storage data
    const storageKeys = [
      'local_profile',
      'local_workout_completions',
      'local_meal_completions',
      'completed_workouts',
      'meals',
      'sync_in_progress',
      'sync_in_progress_since'
    ];

    for (const key of storageKeys) {
      try {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          const parsed = JSON.parse(data);
          debugInfo.localStorage[key] = {
            exists: true,
            size: data.length,
            type: Array.isArray(parsed) ? 'array' : typeof parsed,
            itemCount: Array.isArray(parsed) ? parsed.length : 1,
            sample: Array.isArray(parsed) ? parsed.slice(0, 2) : parsed
          };
        } else {
          debugInfo.localStorage[key] = { exists: false };
        }
      } catch (parseError) {
        debugInfo.localStorage[key] = {
          exists: true,
          error: 'Failed to parse',
          rawData: data?.substring(0, 100) + '...'
        };
      }
    }

    // Get storage size
    debugInfo.storageSize = await getLocalStorageSize();

    // Get sync diagnostics
    debugInfo.diagnostics = await getSyncDiagnostics();

    return debugInfo;
  } catch (error) {
    console.error('Error getting sync debug info:', error);
    return {
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    };
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