import { WorkoutCompletion, MealCompletion } from '../types/tracking';
import { UserProfile } from '../types/profile';
import persistenceAdapter from './persistenceAdapter';
import StorageKeys from './storageKeys';
import supabase from '../lib/supabase';
import { filterValidWorkoutCompletions, filterValidMealCompletions } from './dataValidation';

function isUserProfile(obj: any): obj is UserProfile {
  return obj && typeof obj === 'object' && 'id' in obj;
}

/**
 * Sync local completions and plans to Supabase on login.
 * - Merges by id, using completed_at/updated_at for recency
 * - Updates local cache to match Supabase after sync
 */
export async function syncLocalDataToSupabase(userId: string) {
  try {
    // 1. Fetch local completions
    const localWorkouts: WorkoutCompletion[] = await persistenceAdapter.getItem(StorageKeys.COMPLETED_WORKOUTS, []) || [];
    const localMeals: MealCompletion[] = await persistenceAdapter.getItem(StorageKeys.MEALS, []) || [];
    // 2. Fetch remote completions
    const { data: remoteWorkouts, error: workoutErr } = await supabase
      .from('workout_completions')
      .select('*')
      .eq('user_id', userId);
    const { data: remoteMeals, error: mealErr } = await supabase
      .from('meal_completions')
      .select('*')
      .eq('user_id', userId);
    if (workoutErr) throw workoutErr;
    if (mealErr) throw mealErr;
    // 3. Merge completions by id with date validation
    const workoutMap = new Map<string, WorkoutCompletion>();
    (remoteWorkouts || []).forEach(w => workoutMap.set(w.id, w));

    // Get current date for validation
    const today = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    localWorkouts.forEach(local => {
      // Validate workout date before processing
      if (local.workout_date) {
        const workoutDate = new Date(local.workout_date + 'T00:00:00');
        if (workoutDate > today) {
          console.warn(`Skipping future workout completion: ${local.workout_date}`);
          return;
        }
        if (workoutDate < oneYearAgo) {
          console.warn(`Skipping very old workout completion: ${local.workout_date}`);
          return;
        }
      }

      // Convert 'local_user' to authenticated user ID
      const processedLocal = { ...local };
      if (processedLocal.user_id === 'local_user' || !processedLocal.user_id) {
        processedLocal.user_id = userId;
        console.log(`Converting local_user workout to authenticated user: ${local.workout_date}`);
      } else {
        processedLocal.user_id = userId; // Ensure consistency
      }

      const remote = workoutMap.get(local.id);
      if (!remote || new Date(local.completed_at) > new Date(remote.completed_at)) {
        workoutMap.set(local.id, processedLocal);
      }
    });
    // 4. Upload new/updated local workouts with validation
    const toUploadWorkouts = Array.from(workoutMap.values()).filter(w =>
      !remoteWorkouts?.find(rw => rw.id === w.id && rw.completed_at === w.completed_at)
    );

    if (toUploadWorkouts.length > 0) {
      // Apply comprehensive validation before uploading
      const validWorkouts = filterValidWorkoutCompletions(toUploadWorkouts);
      console.log(`Uploading ${validWorkouts.length} valid workouts out of ${toUploadWorkouts.length} total`);

      if (validWorkouts.length > 0) {
        await supabase.from('workout_completions').upsert(validWorkouts);
      }
    }
    // 5. Download all workouts to local
    await persistenceAdapter.setItem(StorageKeys.COMPLETED_WORKOUTS, Array.from(workoutMap.values()));
    // Repeat for meals with date validation
    const mealMap = new Map<string, MealCompletion>();
    (remoteMeals || []).forEach(m => mealMap.set(m.id, m));

    localMeals.forEach(local => {
      // Validate meal date before processing
      if (local.meal_date) {
        const mealDate = new Date(local.meal_date + 'T00:00:00');
        if (mealDate > today) {
          console.warn(`Skipping future meal completion: ${local.meal_date}`);
          return;
        }
        if (mealDate < oneYearAgo) {
          console.warn(`Skipping very old meal completion: ${local.meal_date}`);
          return;
        }
      }

      // Convert 'local_user' to authenticated user ID
      const processedLocal = { ...local };
      if (processedLocal.user_id === 'local_user' || !processedLocal.user_id) {
        processedLocal.user_id = userId;
        console.log(`Converting local_user meal to authenticated user: ${local.meal_date} (${local.meal_type})`);
      } else {
        processedLocal.user_id = userId; // Ensure consistency
      }

      const remote = mealMap.get(local.id);
      if (!remote || new Date(local.completed_at) > new Date(remote.completed_at)) {
        mealMap.set(local.id, processedLocal);
      }
    });
    const toUploadMeals = Array.from(mealMap.values()).filter(m =>
      !remoteMeals?.find(rm => rm.id === m.id && rm.completed_at === m.completed_at)
    );

    if (toUploadMeals.length > 0) {
      // Apply comprehensive validation before uploading
      const validMeals = filterValidMealCompletions(toUploadMeals);
      console.log(`Uploading ${validMeals.length} valid meals out of ${toUploadMeals.length} total`);

      if (validMeals.length > 0) {
        await supabase.from('meal_completions').upsert(validMeals);
      }
    }
    await persistenceAdapter.setItem(StorageKeys.MEALS, Array.from(mealMap.values()));
    // 6. Sync Profile Data (including plans, streak, and other fields)
    const { data: remoteProfileData, error: profileErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId);

    // PGRST116 means no rows found, which is not an error if it's a first sync for a user.
    if (profileErr && profileErr.code !== 'PGRST116') {
        console.error('[syncLocalDataToSupabase] Error fetching remote profile:', profileErr);
        throw profileErr;
    }
    const remoteProfile = (remoteProfileData && remoteProfileData.length > 0 && isUserProfile(remoteProfileData[0])) ? remoteProfileData[0] : null;
    
    // Fetch local anonymous profile (used before first login)
    const localAnonymousProfile = await persistenceAdapter.getItem<UserProfile>(StorageKeys.LOCAL_PROFILE, null);
    // Fetch cached profile for this specific userId (if they logged in before, went offline)
    const cachedUserSpecificProfile = await persistenceAdapter.getItem<UserProfile>(`profile:${userId}`, null);

    let effectiveLocalProfile: UserProfile | null = null;
    let localProfileSourceIsAnonymous = false;

    if (localAnonymousProfile && cachedUserSpecificProfile) {
        const anonTimestamp = localAnonymousProfile.updated_at ? new Date(localAnonymousProfile.updated_at).getTime() : 0;
        const cachedTimestamp = cachedUserSpecificProfile.updated_at ? new Date(cachedUserSpecificProfile.updated_at).getTime() : 0;
        if (anonTimestamp > cachedTimestamp) {
            effectiveLocalProfile = localAnonymousProfile;
            localProfileSourceIsAnonymous = true;
        } else {
            effectiveLocalProfile = cachedUserSpecificProfile;
        }
        console.log('[syncLocalDataToSupabase] Both localAnonymousProfile and cachedUserSpecificProfile exist. Prioritizing profile with newer timestamp.');
    } else if (localAnonymousProfile) {
        effectiveLocalProfile = localAnonymousProfile;
        localProfileSourceIsAnonymous = true;
    } else if (cachedUserSpecificProfile) {
        effectiveLocalProfile = cachedUserSpecificProfile;
    }

    if (!isUserProfile(effectiveLocalProfile) && !remoteProfile) {
      console.log('[syncLocalDataToSupabase] No local or remote profile found. Cannot sync profile.');
      return;
    }

    let profileToSaveUnderUserKey: UserProfile | null = null;
    let profileUpdatesForSupabase: Partial<UserProfile> = {};

    if (effectiveLocalProfile && remoteProfile) {
        // Both local (from anonymous or previous cache) and remote exist. Merge.
        const localTimestamp = effectiveLocalProfile.updated_at ? new Date(effectiveLocalProfile.updated_at).getTime() : 0;
        const remoteTimestamp = remoteProfile.updated_at ? new Date(remoteProfile.updated_at).getTime() : 0;

        profileToSaveUnderUserKey = { ...remoteProfile }; // Base on remote

        // Determine master based on timestamp for general fields
        if (localTimestamp > remoteTimestamp) {
            const { id, created_at, ...restOfLocal } = effectiveLocalProfile; // Exclude id and created_at from local if they exist
            profileUpdatesForSupabase = { ...profileUpdatesForSupabase, ...restOfLocal };
            // Update fields in profileToSaveUnderUserKey from effectiveLocalProfile
            for (const key in restOfLocal) {
                if (Object.prototype.hasOwnProperty.call(restOfLocal, key)) {
                     (profileToSaveUnderUserKey as any)[key] = (restOfLocal as any)[key];
                }
            }
            if (effectiveLocalProfile.updated_at) { // Ensure local updated_at is used
                profileToSaveUnderUserKey.updated_at = effectiveLocalProfile.updated_at;
            }
        }
        // else remote is master for general fields, profileToSaveUnderUserKey is already based on remote.

        // Specific conflict resolution for critical fields
        // Workout Plan: Use plan's own updated_at if available, else profile's updated_at
        const localWPTimestamp = effectiveLocalProfile.workout_plan?.updated_at ? new Date(effectiveLocalProfile.workout_plan.updated_at).getTime() : localTimestamp;
        const remoteWPTimestamp = remoteProfile.workout_plan?.updated_at ? new Date(remoteProfile.workout_plan.updated_at).getTime() : remoteTimestamp;
        if (effectiveLocalProfile.workout_plan && (!remoteProfile.workout_plan || localWPTimestamp > remoteWPTimestamp)) {
            profileUpdatesForSupabase.workout_plan = effectiveLocalProfile.workout_plan;
            profileToSaveUnderUserKey.workout_plan = effectiveLocalProfile.workout_plan;
        }

        // Meal Plans: Use plan's own updated_at if available, else profile's updated_at
        const localMPTimestamp = effectiveLocalProfile.meal_plans?.updated_at ? new Date(effectiveLocalProfile.meal_plans.updated_at).getTime() : localTimestamp;
        const remoteMPTimestamp = remoteProfile.meal_plans?.updated_at ? new Date(remoteProfile.meal_plans.updated_at).getTime() : remoteTimestamp;
        if (effectiveLocalProfile.meal_plans && (!remoteProfile.meal_plans || localMPTimestamp > remoteMPTimestamp)) {
            profileUpdatesForSupabase.meal_plans = effectiveLocalProfile.meal_plans;
            profileToSaveUnderUserKey.meal_plans = effectiveLocalProfile.meal_plans;
        }
        
        // Streak Days
        const localStreak = effectiveLocalProfile.streak_days;
        const remoteStreak = remoteProfile.streak_days;
        if (localStreak !== undefined && localStreak !== null) { // Check if localStreak has a value
            if (remoteStreak === undefined || remoteStreak === null || localStreak > remoteStreak) {
                profileUpdatesForSupabase.streak_days = localStreak;
                profileToSaveUnderUserKey.streak_days = localStreak;
            }
            // else remote streak is better or equal, profileToSaveUnderUserKey already has it from remoteProfile base.
        }
        
    } else if (effectiveLocalProfile) {
        // Only local exists (first time sync from anonymous or cached)
        const { id, created_at, ...restOfLocal } = effectiveLocalProfile; // Exclude local id/created_at
        profileUpdatesForSupabase = { ...restOfLocal, id: userId }; // Assign the correct Supabase userId
        profileToSaveUnderUserKey = { ...effectiveLocalProfile, id: userId };
    } else if (remoteProfile) {
        // Only remote exists (no local data to sync, e.g. new device)
        profileToSaveUnderUserKey = remoteProfile;
    } else {
      // This case should ideally not be reached due to the earlier check.
      console.error("[syncLocalDataToSupabase] Both local and remote profiles are unexpectedly null/undefined at merge point.");
      return;
    }

    // Perform Supabase update if there are changes
    // Ensure `updated_at` is set for any update to Supabase
    if (Object.keys(profileUpdatesForSupabase).length > 0) {
        profileUpdatesForSupabase.updated_at = new Date().toISOString();
        
        const { error: upsertErr } = await supabase
            .from('profiles')
            .upsert({ ...profileUpdatesForSupabase, id: userId }) // Use upsert to handle creation if remoteProfile was null
            .eq('id', userId); // eq is not typically used with upsert like this, upsert uses conflict resolution on primary key or specified columns.
                               // For a simple upsert based on 'id', just providing the object with 'id' is enough.
        
        // Corrected upsert:
        // const { error: upsertErr } = await supabase
        //    .from('profiles')
        //    .upsert({ ...profileUpdatesForSupabase, id: userId }, { onConflict: 'id' });

        // Sticking to update as per original structure, assuming profile row is created by AuthContext/signup flow.
        // If remoteProfile was null and effectiveLocalProfile existed, this should be an insert.
        // The original code used .update(). If remoteProfile is null, .update() might fail or do nothing.
        // Let's use upsert for safety.
        const dataToUpsert = { ...profileUpdatesForSupabase, id: userId };
        const { error: dbError } = await supabase.from('profiles').upsert(dataToUpsert, { onConflict: 'id' });

        if (dbError) {
            console.error('[syncLocalDataToSupabase] Error upserting profile to Supabase:', dbError);
            throw dbError;
        }
        
        // Update the timestamp in profileToSaveUnderUserKey to match the one sent to Supabase
        if (profileToSaveUnderUserKey && profileUpdatesForSupabase.updated_at) {
            profileToSaveUnderUserKey.updated_at = profileUpdatesForSupabase.updated_at;
        }
    }
    
    // Save the determined profile state to the user-specific key
    if (profileToSaveUnderUserKey) {
        await persistenceAdapter.setItem(`profile:${userId}`, profileToSaveUnderUserKey);
    }

    // After successful sync, clear the localAnonymousProfile if it was the source
    if (localProfileSourceIsAnonymous && effectiveLocalProfile === localAnonymousProfile) {
        await persistenceAdapter.removeItem(StorageKeys.LOCAL_PROFILE);
        console.log('[syncLocalDataToSupabase] Cleared local anonymous profile after sync.');
    }

    console.log('[syncLocalDataToSupabase] Profile sync complete.');
  } catch (err) {
    console.error('[syncLocalDataToSupabase] Error during sync:', err);
    // Do not re-throw if it's a non-critical error, or handle specific errors
    // For now, re-throwing to indicate sync did not fully complete.
    throw err;
  }
}
