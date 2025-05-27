import supabase from '../lib/supabase';
import { WorkoutCompletion, MealCompletion, WorkoutStats, MealStats, TrackingAnalytics } from '../types/tracking';
import { format, subDays, parseISO, differenceInDays, isSameDay, isAfter } from 'date-fns';
import AsyncStorage from '@react-native-async-storage/async-storage';
import persistenceAdapter from '../utils/persistenceAdapter';
import StorageKeys from '../utils/storageKeys';
import { recordMealCompletion } from '../utils/streakManager';
import { EventRegister } from 'react-native-event-listeners';

// Local storage keys for workout and meal completions
const LOCAL_WORKOUT_COMPLETIONS_KEY = StorageKeys.COMPLETED_WORKOUTS;
const LOCAL_MEAL_COMPLETIONS_KEY = 'local_meal_completions'; // Direct string rather than using StorageKeys.MEALS

const MAX_LOCAL_WORKOUT_COMPLETIONS = 90;

/**
 * Calculate the current streak based on an array of dates
 * @param dates Array of dates to check for consecutive days
 * @returns Number representing the current streak
 */
function calculateDayStreak(dates: Date[]): number {
  if (!dates || dates.length === 0) {
    return 0;
  }
  
  // Sort dates in descending order (newest first)
  const sortedDates = [...dates].sort((a, b) => b.getTime() - a.getTime());
  
  // Check if the most recent date is today or yesterday
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const mostRecent = sortedDates[0];
  const mostRecentDay = new Date(mostRecent.getFullYear(), mostRecent.getMonth(), mostRecent.getDate());
  
  // If the most recent workout is older than yesterday, streak is broken
  if (mostRecentDay.getTime() < yesterday.getTime()) {
    return 0;
  }
  
  // Start with streak of 1 for the most recent workout
  let streak = 1;
  let currentDate = mostRecentDay;
  
  // Look for consecutive days counting backwards
  for (let i = 1; i < sortedDates.length; i++) {
    const nextDate = sortedDates[i];
    const nextDay = new Date(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate());
    
    // Check if this date is exactly one day before the current date
    const expectedPrevDay = new Date(currentDate);
    expectedPrevDay.setDate(expectedPrevDay.getDate() - 1);
    
    if (nextDay.getTime() === expectedPrevDay.getTime()) {
      // It's a consecutive day, increment streak
      streak++;
      currentDate = nextDay;
    } else if (nextDay.getTime() === currentDate.getTime()) {
      // Same day, just continue (duplicate entries for same day)
      continue;
    } else {
      // Streak is broken
      break;
    }
  }
  
  return streak;
}

/**
 * Calculate estimated calories burned based on workout details and user profile
 */
function calculateCaloriesBurned(
  weight_kg: number,
  duration_minutes: number, 
  workoutType: string,
  age: number,
  gender: string
): number {
  // MET values (Metabolic Equivalent of Task) by workout type
  const metValues: Record<string, number> = {
    'strength_training': 5.0,
    'cardio': 7.0,
    'hiit': 8.5,
    'yoga': 3.0,
    'flexibility': 2.5,
    'functional': 6.0,
    'full_body': 6.5,
    'upper_body': 4.5,
    'lower_body': 5.5,
    'core': 4.0,
    'endurance': 6.8,
    'balance': 3.5
  };
  
  // Default to medium intensity if workout type not found
  const met = metValues[workoutType?.toLowerCase()] || 5.0;
  
  // Adjust for gender and age
  let adjustedMet = met;
  if (gender?.toLowerCase() === 'female') {
    adjustedMet *= 0.9; // Women typically burn ~10% fewer calories
  }
  
  // Age adjustment (older people burn fewer calories during exercise)
  if (age > 50) {
    adjustedMet *= 0.9;
  } else if (age < 30) {
    adjustedMet *= 1.1;
  }
  
  // Calories = MET × weight in kg × duration in hours
  const durationHours = duration_minutes / 60;
  const caloriesBurned = adjustedMet * weight_kg * durationHours;
  
  return Math.round(caloriesBurned);
}

/**
 * Mark a workout as complete
 */
export async function markWorkoutComplete(
  userId: string, 
  workoutDate: string,
  dayNumber: number,
  workoutPlanId: string,
  workoutDetails: any = null, // Original workoutDetails can be complex
  dayName: string
): Promise<WorkoutCompletion | null> {
  try {
    console.log(`markWorkoutComplete: User ${userId}, Date ${workoutDate}, DayNum ${dayNumber}, DayName ${dayName}`);
    
    const currentDate = new Date();
    const timestamp = currentDate.toISOString();
    let estimatedCaloriesBurned = 0;

    // Sanitize/simplify workoutDetails before using it or storing it
    const sanitizedWorkoutDetails: any = {};
    if (workoutDetails) {
      // Only pick necessary and simple properties
      sanitizedWorkoutDetails.duration_minutes = workoutDetails.duration_minutes;
      sanitizedWorkoutDetails.weight_kg = workoutDetails.weight_kg;
      sanitizedWorkoutDetails.workout_type = workoutDetails.workout_type;
      sanitizedWorkoutDetails.age = workoutDetails.age;
      sanitizedWorkoutDetails.gender = workoutDetails.gender;
      // Add any other simple, necessary fields from workoutDetails, avoid large objects/arrays
    }
    
    if (sanitizedWorkoutDetails.duration_minutes) {
      try {
        const weightKg = sanitizedWorkoutDetails.weight_kg || 70;
        const duration = sanitizedWorkoutDetails.duration_minutes || 30;
        const workoutType = sanitizedWorkoutDetails.workout_type || 'strength';
        const age = sanitizedWorkoutDetails.age || 30;
        const gender = sanitizedWorkoutDetails.gender || 'neutral';
        
        estimatedCaloriesBurned = calculateCaloriesBurned(
          weightKg,
          duration,
          workoutType,
          age,
          gender
        );
      } catch (calcError) {
        console.error('Error calculating calories burned:', calcError);
      }
    }
    
    const isLocalUser = userId === 'local_user' || !userId || userId.length < 10;
    
    const completionRecord: WorkoutCompletion = {
      id: isLocalUser ? `local_${Date.now()}` : undefined as any,
      user_id: userId,
      workout_date: workoutDate,
      day_number: dayNumber,
      workout_day_name: dayName,
      workout_plan_id: workoutPlanId,
      completed_at: timestamp,
      estimated_calories_burned: estimatedCaloriesBurned,
      // Potentially store a very minimal version of details if needed, e.g., sanitizedWorkoutDetails.workout_type
      // For now, we are not adding workoutDetails to the stored record to keep it small.
    };
    
    // Helper function to manage and prune local completions
    const updateAndPruneLocalCompletions = async (record: WorkoutCompletion): Promise<WorkoutCompletion[]> => {
      let completions: WorkoutCompletion[] = [];
      try {
        const existingData = await persistenceAdapter.getItem<WorkoutCompletion[]>(LOCAL_WORKOUT_COMPLETIONS_KEY, []);
        completions = Array.isArray(existingData) ? existingData : [];
      } catch (e) {
        console.error('Error reading local workout completions for pruning:', e);
        completions = [];
      }

      const existingIndex = completions.findIndex(
        c => c.user_id === record.user_id && c.workout_date === record.workout_date && c.workout_day_name === record.workout_day_name
      );

      if (existingIndex >= 0) {
        completions[existingIndex] = record;
      } else {
        completions.push(record);
      }

      completions.sort((a, b) => {
        const dateComparison = b.workout_date.localeCompare(a.workout_date);
        if (dateComparison !== 0) return dateComparison;
        return b.completed_at.localeCompare(a.completed_at);
      });
      
      const prunedCompletions = completions.slice(0, MAX_LOCAL_WORKOUT_COMPLETIONS);
      
      await persistenceAdapter.setItem(LOCAL_WORKOUT_COMPLETIONS_KEY, prunedCompletions);
      if (!isLocalUser) {
          try {
            await AsyncStorage.setItem(LOCAL_WORKOUT_COMPLETIONS_KEY, JSON.stringify(prunedCompletions));
          } catch (e) {
            console.error('Error saving pruned local backup to AsyncStorage for authenticated user:', e);
          }
      }
      return prunedCompletions;
    };

    if (isLocalUser) {
      await updateAndPruneLocalCompletions(completionRecord);
      return completionRecord;
    }
    
    try {
      await updateAndPruneLocalCompletions(completionRecord);

      const { data: existingSupabaseCompletions } = await supabase
        .from('workout_completions')
        .select('id')
        .eq('user_id', userId)
        .eq('workout_date', workoutDate)
        .eq('workout_day_name', dayName);

      if (existingSupabaseCompletions && existingSupabaseCompletions.length > 0) {
        const { data, error } = await supabase
          .from('workout_completions')
          .update({
            day_number: dayNumber,
            workout_plan_id: workoutPlanId,
            completed_at: timestamp,
            estimated_calories_burned: estimatedCaloriesBurned,
          })
          .eq('id', existingSupabaseCompletions[0].id)
          .select();
        if (error) throw error;
        console.log('Updated existing workout completion in Supabase');
        return data?.[0] || null;
      } else {
        const { id, ...recordWithoutId } = completionRecord;
        const { data, error } = await supabase
          .from('workout_completions')
          .insert(recordWithoutId as any)
          .select();
        if (error) throw error;
        console.log('Added new workout completion to Supabase');
        return data?.[0] || null;
      }
    } catch (dbError) {
      console.error('Error saving workout completion to Supabase (still saved locally):', dbError);
      return completionRecord;
    }
  } catch (error) {
    console.error('Error in markWorkoutComplete:', error);
    return null;
  }
}

/**
 * Check if a workout is completed for a specific date and day
 * @param userId User ID to check
 * @param workoutDate Date as string or Date object
 * @param dayName Optional day name to check (e.g., "Monday")
 */
export async function isWorkoutCompleted(
  userId: string, 
  workoutDate: any,
  dayName?: string
): Promise<boolean> {
  try {
    const formattedDate = typeof workoutDate === 'object' && workoutDate instanceof Date
      ? format(workoutDate, 'yyyy-MM-dd')
      : String(workoutDate);
    
    console.log(`Checking workout completion for user ${userId} on ${formattedDate}${dayName ? ` (${dayName})` : ''}`);
    
    const isLocalUser = userId === 'local_user' || !userId || userId.length < 10;
    
    // --- AUTHENTICATED USER: Check Supabase first --- 
    if (!isLocalUser) {
      try {
      let query = supabase
        .from('workout_completions')
          .select('*')
        .eq('user_id', userId)
          .eq('workout_date', formattedDate);
        
        if (dayName) {
          query = query.eq('workout_day_name', dayName);
        }
        
        const { data, error } = await query;
      
      if (error) {
          console.error('Supabase error checking workout completion:', error); 
          // Don't throw, fallback to local check
        } else if (data && data.length > 0) {
          console.log(`Workout completed for ${formattedDate}${dayName ? ` (${dayName})` : ''} (found in database)`);
          
          // Try to sync to local storage (fire and forget, don't block return)
            try {
            let localCompletions = await persistenceAdapter.getItem<WorkoutCompletion[]>(LOCAL_WORKOUT_COMPLETIONS_KEY, []) || [];
            if (!Array.isArray(localCompletions)) localCompletions = [];
            const existsLocally = localCompletions.some(c => c.user_id === userId && c.workout_date === formattedDate && (!dayName || c.workout_day_name === dayName));
            if (!existsLocally) {
              localCompletions.push(data[0] as WorkoutCompletion);
              await persistenceAdapter.setItem(LOCAL_WORKOUT_COMPLETIONS_KEY, localCompletions);
              console.log('Synced database workout completion to local storage');
            }
            } catch (syncError) {
              console.error('Error syncing workout completion to local storage:', syncError);
            }
          return true; // Found in DB, return true
        }
      } catch (dbError) {
        console.error('Error checking workout completion in database:', dbError);
        // Fallback to local check if DB query fails
      }
    }

    // --- LOCAL USER OR FALLBACK: Check local storage --- 
    let completions: WorkoutCompletion[] = [];
    try {
      completions = await persistenceAdapter.getItem<WorkoutCompletion[]>(LOCAL_WORKOUT_COMPLETIONS_KEY, []) || [];
      if (!Array.isArray(completions)) completions = []; // Ensure array
      console.log(`Found ${completions.length} workout completions in local storage`);
    } catch (adapterError) {
      console.error('Error reading workout completions from local storage:', adapterError);
    }

    const workoutCompletedLocally = completions.some(completion => {
      const dateMatches = completion.user_id === userId && completion.workout_date === formattedDate;
      if (dayName && dateMatches) {
        return completion.workout_day_name === dayName;
      }
      return dateMatches;
    });

    if (workoutCompletedLocally) {
      console.log(`Workout completed for ${formattedDate}${dayName ? ` (${dayName})` : ''} (found in local storage - fallback or local user)`);
      return true;
    }
    
    console.log(`Workout not completed for ${formattedDate}${dayName ? ` (${dayName})` : ''}`);
    return false;
  } catch (error) {
    console.error('Error in isWorkoutCompleted:', error);
    return false;
  }
}

/**
 * Mark a meal as complete
 */
export async function markMealComplete(
  userId: string,
  mealDate: string,
  mealType: string,
  mealPlanId: string
): Promise<MealCompletion | null> {
  try {
    const isLocalUser = userId === 'local_user' || !userId || userId.length < 10;
    const formattedMealType = mealType.toLowerCase() as 'breakfast' | 'lunch' | 'dinner' | 'snack';
    
    console.log(`Marking meal complete: ${formattedMealType} on ${mealDate} for user ${userId}`);
    
    // Check if already completed first (for both local and DB users)
    const alreadyCompleted = await isMealCompleted(userId, mealDate, formattedMealType);
    
    if (alreadyCompleted) {
      console.log(`Meal ${formattedMealType} already marked as complete for ${mealDate}`);
      
      // Find the existing completion record and return it
      let existingCompletion: MealCompletion | null = null;
    
      // Check local storage first
      try {
        const localCompletions = await persistenceAdapter.getItem<MealCompletion[]>(LOCAL_MEAL_COMPLETIONS_KEY, []) || [];
        existingCompletion = localCompletions.find(completion => 
          completion.user_id === userId && 
          completion.meal_date === mealDate && 
          completion.meal_type === formattedMealType
        ) || null;
      } catch (err) {
        console.error('Error fetching existing completion from local storage:', err);
      }
      
      if (existingCompletion) {
        return existingCompletion;
      }
      
      // If not found locally but reported as completed, create a new record
      const newCompletion: MealCompletion = {
        id: `local-${Date.now()}`,
      user_id: userId,
      meal_date: mealDate,
      meal_type: formattedMealType,
      meal_plan_id: mealPlanId,
      completed_at: new Date().toISOString()
      };
      
      return newCompletion;
    }
    
    // Create the meal completion object
    const completion: MealCompletion = {
      id: `local-${Date.now()}`,
      user_id: userId,
      meal_date: mealDate,
      meal_type: formattedMealType,
      meal_plan_id: mealPlanId,
      completed_at: new Date().toISOString()
    };
    
    // Handle networked user - save to Supabase
    if (!isLocalUser) {
      try {
        // First save to Supabase
        const { data, error } = await supabase
          .from('meal_completions')
          .insert([
            {
              user_id: userId,
              meal_date: mealDate,
              meal_type: formattedMealType,
              meal_plan_id: mealPlanId,
            }
          ])
          .select()
          .single();
        
        if (error) {
          console.error('Error saving meal completion to Supabase:', error);
          // Continue to save locally as fallback
        } else if (data) {
          console.log('Meal completion saved to Supabase successfully');
          // If successfully saved to Supabase, update the ID in our object
          completion.id = data.id;
        }
      } catch (dbError) {
        console.error('Unexpected error saving meal completion to Supabase:', dbError);
        // Continue to save locally as fallback
      }
    }
    
    // Save locally for both local users and as backup for networked users
    try {
      // Get existing completions from AsyncStorage first
      let localCompletions: MealCompletion[] = [];
      const asyncStorageData = await AsyncStorage.getItem(LOCAL_MEAL_COMPLETIONS_KEY);
      
      if (asyncStorageData) {
        try {
          localCompletions = JSON.parse(asyncStorageData);
        } catch (parseError) {
          console.error('Error parsing meal completions from AsyncStorage:', parseError);
          // Initialize with empty array if parsing fails
          localCompletions = [];
        }
        } else {
        // Try persistence adapter if AsyncStorage failed
        try {
          localCompletions = await persistenceAdapter.getItem<MealCompletion[]>(LOCAL_MEAL_COMPLETIONS_KEY, []) || [];
        } catch (persistenceError) {
          console.error('Error getting meal completions from persistence adapter:', persistenceError);
          localCompletions = [];
        }
      }
      
      // Ensure it's an array
      if (!Array.isArray(localCompletions)) localCompletions = [];
      
      // Check if we already have this completion (avoid duplicates)
      const existingIndex = localCompletions.findIndex(c => 
        c.user_id === userId && 
        c.meal_date === mealDate && 
        c.meal_type === formattedMealType
      );
      
      if (existingIndex >= 0) {
        // Update the existing record
        localCompletions[existingIndex] = completion;
      } else {
        // Add the new completion
        localCompletions.push(completion);
      }
      
      // Save to both AsyncStorage and persistence adapter for redundancy
      console.log(`Saving ${localCompletions.length} meal completions to local storage`);
      await AsyncStorage.setItem(LOCAL_MEAL_COMPLETIONS_KEY, JSON.stringify(localCompletions));
      await persistenceAdapter.setItem(LOCAL_MEAL_COMPLETIONS_KEY, localCompletions);
      
      console.log('Meal completion saved successfully to local storage');
      
      // Emit an event that the meal was completed
      EventRegister.emit('mealCompleted', {
        userId: userId,
        date: mealDate,
        mealType: formattedMealType
      });
      
      return completion;
    } catch (err) {
      console.error('Error saving meal completion to local storage:', err);
      throw new Error('Failed to save meal completion');
    }
  } catch (error) {
    console.error('Error in markMealComplete:', error);
    throw error;
  }
}

/**
 * Check if a meal is completed for a specific date and type
 */
export async function isMealCompleted(userId: string, mealDate: string, mealType: string): Promise<boolean> {
  try {
    const formattedMealType = mealType.toLowerCase() as 'breakfast' | 'lunch' | 'dinner' | 'snack';
    console.log(`Checking meal completion for user ${userId} on ${mealDate}, meal: ${formattedMealType}`);
    
    const isLocalUser = userId === 'local_user' || !userId || userId.length < 10;
    
    // --- LOCAL CACHE CHECK FIRST (for performance) ---
    // Always check local cache first for fast UI response
    let localMealCompletions: MealCompletion[] = [];
    try {
      // Try AsyncStorage first (most reliable source)
      const asyncStorageData = await AsyncStorage.getItem(LOCAL_MEAL_COMPLETIONS_KEY);
      if (asyncStorageData) {
        try {
          localMealCompletions = JSON.parse(asyncStorageData);
          console.log(`[isMealCompleted] Checking ${localMealCompletions.length} meal completions from local cache first`);
        } catch (parseError) {
          console.error('Error parsing meal completions from AsyncStorage:', parseError);
          localMealCompletions = [];
        }
      } else {
        // Fallback to persistence adapter
        localMealCompletions = await persistenceAdapter.getItem<MealCompletion[]>(LOCAL_MEAL_COMPLETIONS_KEY, []) || [];
        console.log(`[isMealCompleted] Read ${localMealCompletions.length} meal completions from persistence adapter`);
      }
      
      if (!Array.isArray(localMealCompletions)) {
        console.warn('localMealCompletions is not an array, resetting to empty array');
        localMealCompletions = [];
      }
      
      const mealCompletedLocally = localMealCompletions.some(completion => 
        completion.user_id === userId && 
        completion.meal_date === mealDate && 
        completion.meal_type === formattedMealType
      );
      
      if (mealCompletedLocally) {
        console.log(`[isMealCompleted] Found completed meal in local cache: ${formattedMealType} for ${mealDate}`);
        return true;
      }
    } catch (storageError) {
      console.error('Error reading meal completions from local storage:', storageError);
    }
    
    // --- AUTHENTICATED USER: Check Supabase if not found locally --- 
    if (!isLocalUser) {
      try {
      const { data, error } = await supabase
        .from('meal_completions')
          .select('*')
        .eq('user_id', userId)
        .eq('meal_date', mealDate)
          .eq('meal_type', formattedMealType);
        
      if (error) {
          console.error('Supabase error checking meal completion:', error);
          // Fall through to final local check
        } else if (data && data.length > 0) {
          console.log(`Meal ${formattedMealType} completed for ${mealDate} (found in database)`);
          
          // Try to sync to local storage (fire and forget)
          try {
            // Get from AsyncStorage directly for most reliable data
            let syncLocalCompletions: MealCompletion[] = [];
            const asyncStorageData = await AsyncStorage.getItem(LOCAL_MEAL_COMPLETIONS_KEY);
            
            if (asyncStorageData) {
              try {
                syncLocalCompletions = JSON.parse(asyncStorageData);
              } catch (parseError) {
                console.error('Error parsing meal completions from AsyncStorage:', parseError);
                syncLocalCompletions = [];
              }
            } else {
              // Fallback to persistence adapter
              syncLocalCompletions = await persistenceAdapter.getItem<MealCompletion[]>(LOCAL_MEAL_COMPLETIONS_KEY, []) || [];
            }
            
            if (!Array.isArray(syncLocalCompletions)) syncLocalCompletions = [];
            
            const existsLocally = syncLocalCompletions.some(c => 
              c.user_id === userId && c.meal_date === mealDate && c.meal_type === formattedMealType
            );
            
            if (!existsLocally) {
              syncLocalCompletions.push(data[0] as MealCompletion);
              
              // Save to AsyncStorage first
              await AsyncStorage.setItem(LOCAL_MEAL_COMPLETIONS_KEY, JSON.stringify(syncLocalCompletions));
              
              // Then to persistence adapter
              await persistenceAdapter.setItem(LOCAL_MEAL_COMPLETIONS_KEY, syncLocalCompletions);
              
              console.log('Synced database meal completion to local storage');
            }
            } catch (syncError) {
              console.error('Error syncing meal completion to local storage:', syncError);
            }
          return true; // Found in DB, return true
        }
      } catch (dbError) {
        console.error('Error checking meal completion in database:', dbError);
        // Fall through to final local check
      }
    }

    // Final check - in case we missed something in the initial local check
    try {
    const mealCompletedLocally = localMealCompletions.some(completion => 
      completion.user_id === userId && 
      completion.meal_date === mealDate && 
      completion.meal_type === formattedMealType
    );
    
    if (mealCompletedLocally) {
        console.log(`[FINAL CHECK] Meal ${formattedMealType} completed for ${mealDate} found in local cache`);
      return true;
      }
    } catch (finalCheckError) {
      console.error('Error in final local completion check:', finalCheckError);
    }
    
    console.log(`Meal ${formattedMealType} not completed for ${mealDate}`);
    return false;
  } catch (error) {
    console.error('Error in isMealCompleted:', error);
    return false;
  }
}

/**
 * Get workout statistics for a user
 */
export async function getWorkoutStats(userId: string, period: 'week' | 'month' | 'all' = 'all'): Promise<WorkoutStats> {
  try {
    console.log(`Getting workout stats for user ${userId}, period: ${period}`);
    
    // Check if this is a local user
    const isLocalUser = userId === 'local_user' || !userId || userId.length < 10;
    
    // Initialize data array for stats
    let data: WorkoutCompletion[] = [];
    
    // For local users, get data from persistent storage
    if (isLocalUser) {
      console.log('Getting local workout stats from persistence');
      
      try {
        // Try to get from persistence adapter first
        const localCompletions = await persistenceAdapter.getItem<WorkoutCompletion[]>(LOCAL_WORKOUT_COMPLETIONS_KEY, []);
        if (localCompletions && Array.isArray(localCompletions)) {
          data = localCompletions.filter(completion => completion.user_id === userId);
          console.log(`Found ${data.length} local workout completions in persistence adapter`);
        }
      } catch (adapterError) {
        console.error('Error reading workout completions from persistence adapter:', adapterError);
        
        // Try AsyncStorage directly as fallback
        try {
          const asyncData = await AsyncStorage.getItem(LOCAL_WORKOUT_COMPLETIONS_KEY);
          if (asyncData) {
            const parsedData = JSON.parse(asyncData);
            if (Array.isArray(parsedData)) {
              data = parsedData.filter(completion => completion.user_id === userId);
              console.log(`Found ${data.length} local workout completions in AsyncStorage backup`);
            }
          }
        } catch (asyncError) {
          console.error('Error reading from AsyncStorage backup:', asyncError);
        }
      }
    } else {
      // For authenticated users, get from Supabase
      console.log('Getting workout stats from Supabase');
      
      try {
        // First try to get from local storage as a quick first view
        let localData: WorkoutCompletion[] = [];
        
        try {
          const localCompletions = await persistenceAdapter.getItem<WorkoutCompletion[]>(LOCAL_WORKOUT_COMPLETIONS_KEY, []);
          if (localCompletions && Array.isArray(localCompletions)) {
            localData = localCompletions.filter(completion => completion.user_id === userId);
            console.log(`Found ${localData.length} workout completions in local cache`);
          }
        } catch (cacheError) {
          console.error('Error reading workout completions from local cache:', cacheError);
          
          // Try AsyncStorage directly as fallback
          try {
            const asyncData = await AsyncStorage.getItem(LOCAL_WORKOUT_COMPLETIONS_KEY);
            if (asyncData) {
              const parsedData = JSON.parse(asyncData);
              if (Array.isArray(parsedData)) {
                localData = parsedData.filter(completion => completion.user_id === userId);
                console.log(`Found ${localData.length} local workout completions in AsyncStorage backup`);
              }
            }
          } catch (asyncError) {
            console.error('Error reading from AsyncStorage backup:', asyncError);
          }
        }
        
        // Set data to local cache initially for fast rendering
        if (localData.length > 0) {
          data = localData;
        }
        
        // Then fetch from Supabase for the latest data
    let query = supabase
      .from('workout_completions')
      .select('*')
          .eq('user_id', userId);
        
        // Apply date filter based on period
        const today = new Date();
        if (period === 'week') {
          const weekAgo = subDays(today, 7);
          query = query.gte('workout_date', format(weekAgo, 'yyyy-MM-dd'));
        } else if (period === 'month') {
          const monthAgo = subDays(today, 30);
          query = query.gte('workout_date', format(monthAgo, 'yyyy-MM-dd'));
        }
        
        const { data: dbData, error } = await query;
    
    if (error) {
          throw error;
        }
        
        if (dbData && dbData.length > 0) {
          data = dbData as WorkoutCompletion[];
          console.log(`Found ${data.length} workout completions in database`);
          
          // Update local cache with the latest data from server
          try {
            // Merge with any existing local completions not in the server response
            const newLocalData = [...localData];
            
            // Add any server records not in local cache
            for (const serverCompletion of data) {
              const existsLocally = localData.some(
                local => local.workout_date === serverCompletion.workout_date
              );
              
              if (!existsLocally) {
                newLocalData.push(serverCompletion);
              }
            }
            
            // Update persistence adapter
            await persistenceAdapter.setItem(LOCAL_WORKOUT_COMPLETIONS_KEY, newLocalData);
            
            // Also update AsyncStorage as a backup
            await AsyncStorage.setItem(LOCAL_WORKOUT_COMPLETIONS_KEY, JSON.stringify(newLocalData));
            
            console.log('Updated local workout completion cache with server data');
          } catch (syncError) {
            console.error('Error updating local workout completion cache:', syncError);
            // Continue with the server data for this request
          }
        } else if (data.length === 0) {
          console.log('No workout completions found in database, using local cache');
          data = localData;
        }
      } catch (dbError) {
        console.error('Error getting workout completions from database:', dbError);
        // If we failed to get from database, use whatever we got from local cache
      }
    }
    
    // Calculate total calories burned
    const totalCaloriesBurned = data.reduce(
      (total, workout) => total + (workout.estimated_calories_burned || 0), 
      0
    );
    
    console.log(`Total calories burned: ${totalCaloriesBurned}`);
    
    // Create a set of unique workout dates for accurate counting
    const uniqueWorkoutDates = new Set(data.map(workout => workout.workout_date));
    console.log(`Unique workout dates: ${Array.from(uniqueWorkoutDates)}`);
    
    // Calculate total workouts (this should be at least the number of completed workouts)
    // For now, we'll set total workouts equal to completed workouts to ensure completion rate works
    const totalWorkouts = Math.max(data.length, 1); // Ensure at least 1 to avoid division by zero
    
    // Calculate completion rate
    const completionRate = Math.round((data.length / totalWorkouts) * 100);
    
    // Initialize all possible workout days with 0 completions
    const allDayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const workoutsPerDay: Record<string, number> = {};
    allDayNames.forEach(day => {
      workoutsPerDay[day] = 0;
    });
    
    // Function to get the day name based on workout data
    const getDayNameFromWorkout = (workout: any): string => {
      // First try to use the stored workout_day_name if available
      if (workout.workout_day_name && allDayNames.includes(workout.workout_day_name)) {
        return workout.workout_day_name;
      }
      
      // Fallback: Use the date to determine day name
      const date = workout.workout_date;
      return new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
    };
    
    // Sort data by date (ascending) for streak calculation
    const sortedWorkouts = [...data].sort((a, b) => 
      new Date(a.workout_date).getTime() - new Date(b.workout_date).getTime()
    );
    
    // Process each workout to count completions per day
    sortedWorkouts.forEach(workout => {
      const dayName = getDayNameFromWorkout(workout);
      if (allDayNames.includes(dayName)) {
        workoutsPerDay[dayName] = 1; // Set to 1 to indicate completed
      }
    });
    
    // Calculate current streak
    let currentStreak = calculateDayStreak(sortedWorkouts.map(w => parseISO(w.workout_date)));
    
    // Calculate longest streak
    // This is a placeholder. To calculate the longest streak, we would need historical data
    // For now, we'll set it to the current streak
    const longestStreak = currentStreak;
    
    // Find the most recent workout date
    let lastWorkoutDate: string | null = null;
    if (sortedWorkouts.length > 0) {
      lastWorkoutDate = sortedWorkouts[sortedWorkouts.length - 1].workout_date;
    }
    
    return {
      totalWorkouts,
      completedWorkouts: data.length,
      completionRate,
      currentStreak,
      longestStreak,
      totalCaloriesBurned,
      lastWorkoutDate,
      workoutsPerDay
    };
  } catch (error) {
    console.error('Error in getWorkoutStats:', error);
    // Return default stats in case of error
    return {
      totalWorkouts: 0,
      completedWorkouts: 0,
      completionRate: 0,
      currentStreak: 0,
      longestStreak: 0,
      totalCaloriesBurned: 0,
      lastWorkoutDate: null,
      workoutsPerDay: {}
    };
  }
}

/**
 * Get meal statistics for a user
 */
export async function getMealStats(userId: string, period: 'week' | 'month' | 'all' = 'all'): Promise<MealStats> {
  try {
    console.log(`Getting meal stats for user ${userId}, period: ${period}`);
    
    // Check if this is a local user
    const isLocalUser = userId === 'local_user' || !userId || userId.length < 10;
    
    // Initialize data array for stats
    let data: MealCompletion[] = [];
    
    // For local users, get data from persistent storage
    if (isLocalUser) {
      console.log('Getting local meal stats from storage');
      
      try {
        // Try to get from AsyncStorage first (most reliable)
          const asyncData = await AsyncStorage.getItem(LOCAL_MEAL_COMPLETIONS_KEY);
          if (asyncData) {
          try {
            const parsedData = JSON.parse(asyncData);
            if (Array.isArray(parsedData)) {
              data = parsedData.filter(completion => completion.user_id === userId);
              console.log(`Found ${data.length} local meal completions in AsyncStorage`);
          }
          } catch (parseError) {
            console.error('Error parsing meal completions from AsyncStorage:', parseError);
          }
        }
        
        // If no data from AsyncStorage, try persistence adapter
        if (data.length === 0) {
          // Try to get from persistence adapter as fallback
          const localCompletions = await persistenceAdapter.getItem<MealCompletion[]>(LOCAL_MEAL_COMPLETIONS_KEY, []);
          if (localCompletions && Array.isArray(localCompletions)) {
            data = localCompletions.filter(completion => completion.user_id === userId);
            console.log(`Found ${data.length} local meal completions in persistence adapter`);
        }
        }
      } catch (storageError) {
        console.error('Error reading meal completions from storage:', storageError);
      }
    } else {
      // For authenticated users, get from Supabase
      console.log('Getting meal stats from local cache and Supabase');
      
      try {
        // First try to get from local storage as a quick first view
        let localData: MealCompletion[] = [];
        
        try {
          // Try AsyncStorage first for most reliable data
            const asyncData = await AsyncStorage.getItem(LOCAL_MEAL_COMPLETIONS_KEY);
            if (asyncData) {
            try {
              const parsedData = JSON.parse(asyncData);
              if (Array.isArray(parsedData)) {
                localData = parsedData.filter(completion => completion.user_id === userId);
                console.log(`Found ${localData.length} meal completions in AsyncStorage`);
            }
            } catch (parseError) {
              console.error('Error parsing meal completions from AsyncStorage:', parseError);
            }
          }
          
          // If no data from AsyncStorage, try persistence adapter
          if (localData.length === 0) {
            const localCompletions = await persistenceAdapter.getItem<MealCompletion[]>(LOCAL_MEAL_COMPLETIONS_KEY, []);
            if (localCompletions && Array.isArray(localCompletions)) {
              localData = localCompletions.filter(completion => completion.user_id === userId);
              console.log(`Found ${localData.length} meal completions in persistence adapter`);
          }
          }
        } catch (cacheError) {
          console.error('Error reading meal completions from local cache:', cacheError);
        }
        
        // Set data to local cache initially for fast rendering
        if (localData.length > 0) {
          data = localData;
        }
        
        // Then fetch from Supabase for the latest data
    let query = supabase
      .from('meal_completions')
      .select('*')
          .eq('user_id', userId);
        
        // Apply date filter based on period
        const today = new Date();
        if (period === 'week') {
          const weekAgo = subDays(today, 7);
          query = query.gte('meal_date', format(weekAgo, 'yyyy-MM-dd'));
        } else if (period === 'month') {
          const monthAgo = subDays(today, 30);
          query = query.gte('meal_date', format(monthAgo, 'yyyy-MM-dd'));
        }
        
        const { data: dbData, error } = await query;
    
    if (error) {
          throw error;
        }
        
        if (dbData && dbData.length > 0) {
          data = dbData as MealCompletion[];
          console.log(`Found ${data.length} meal completions in database`);
          
          // Update local cache with the latest data from server
          try {
            // Merge with any existing local completions not in the server response
            const newLocalData = [...localData];
            
            // Add any server records not in local cache
            for (const serverCompletion of data) {
              const existsLocally = localData.some(
                local => 
                  local.meal_date === serverCompletion.meal_date && 
                  local.meal_type === serverCompletion.meal_type
              );
              
              if (!existsLocally) {
                newLocalData.push(serverCompletion);
              }
            }
            
            // Update persistence adapter
            await persistenceAdapter.setItem(LOCAL_MEAL_COMPLETIONS_KEY, newLocalData);
            
            // Also update AsyncStorage as a backup
            await AsyncStorage.setItem(LOCAL_MEAL_COMPLETIONS_KEY, JSON.stringify(newLocalData));
            
            console.log('Updated local meal completion cache with server data');
          } catch (syncError) {
            console.error('Error updating local meal completion cache:', syncError);
            // Continue with the server data for this request
          }
        } else if (data.length === 0) {
          console.log('No meal completions found in database, using local cache');
          data = localData;
        }
      } catch (dbError) {
        console.error('Error getting meal completions from database:', dbError);
        // If we failed to get from database, use whatever we got from local cache
      }
    }
    
    // Rest of function remains unchanged to calculate stats from data
    // Filter data based on period if needed
    const today = new Date();
    let filteredData = [...data];
    
    if (period === 'week') {
      const weekAgo = subDays(today, 7);
      filteredData = data.filter(completion => {
        return isAfter(parseISO(completion.meal_date), weekAgo);
      });
    } else if (period === 'month') {
      const monthAgo = subDays(today, 30);
      filteredData = data.filter(completion => {
        return isAfter(parseISO(completion.meal_date), monthAgo);
      });
    }
    
    // Calculate completed meals
    const completedMeals = filteredData.length;
    
    // Group by day
    const mealsPerDay: Record<string, number> = {};
    
    // Process each meal to count by day
    filteredData.forEach(meal => {
      try {
        const date = parseISO(meal.meal_date);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
        
        if (!mealsPerDay[dayName]) {
          mealsPerDay[dayName] = 0;
        }
        
        mealsPerDay[dayName]++;
      } catch (err) {
        console.error(`Error processing meal date ${meal.meal_date}:`, err);
        // Continue with next meal if there's an error with this one
      }
    });
    
    // Find the most recent meal date
    let lastMealDate = null;
    if (filteredData.length > 0) {
      const sortedMeals = filteredData.sort((a, b) => 
        new Date(b.meal_date).getTime() - new Date(a.meal_date).getTime()
      );
      lastMealDate = sortedMeals[0].meal_date;
    }
    
    // Calculate total meals based on period
    let totalDays = 30; // Default to 30 days
    
    if (period === 'week') {
      totalDays = 7;
    } else if (period === 'month') {
      totalDays = 30;
    } else {
      // For 'all', use days since first meal or 30 days, whichever is greater
      const oldestMeal = [...filteredData].sort((a, b) => 
        new Date(a.meal_date).getTime() - new Date(b.meal_date).getTime()
      )[0];
      
      if (oldestMeal) {
        totalDays = Math.max(
          differenceInDays(new Date(), parseISO(oldestMeal.meal_date)), 
          30
        );
      } else {
        totalDays = 30;
      }
    }
    
    const totalMeals = totalDays * 3; // Assuming 3 meals per day
    const completionRate = totalMeals > 0 ? (completedMeals / totalMeals) * 100 : 0;
    
    return {
      totalMeals,
      completedMeals,
      completionRate,
      mealsPerDay,
      lastMealDate
    };
  } catch (err) {
    console.error('Error in getMealStats:', err);
    return {
      totalMeals: 0,
      completedMeals: 0,
      completionRate: 0,
      mealsPerDay: {},
      lastMealDate: null
    };
  }
}

/**
 * Get water tracking analytics for a user
 */
export async function getWaterTrackingStats(userId: string, period: '7days' | '30days' | '90days' = '7days') {
  try {
    // Default stats
    const defaultStats = {
      dailyIntake: {},
      averageIntake: 0,
      goalCompletionRate: 0,
      streak: 0
    };
    
    // Get the user's profile to access workout_tracking data
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('workout_tracking, water_intake_goal')
      .eq('id', userId)
      .single();
      
    if (profileError || !profileData) {
      console.error('Error fetching user profile for water tracking:', profileError);
      return defaultStats;
    }
    
    // Get water goal from profile
    const waterGoal = profileData.water_intake_goal || 3.5; // Default to 3.5L if not set
    
    // Check if workout_tracking exists and contains water_tracking data
    if (!profileData.workout_tracking || 
        typeof profileData.workout_tracking !== 'object' || 
        !profileData.workout_tracking.water_tracking) {
      return defaultStats;
    }
    
    const waterTracking = profileData.workout_tracking.water_tracking;
    
    // If no logs are present, return default stats
    if (!waterTracking.logs || !Array.isArray(waterTracking.logs) || waterTracking.logs.length === 0) {
      return defaultStats;
    }
    
    // Get date range based on period
    let startDate: Date;
    const endDate = new Date();
    
    if (period === '7days') {
      startDate = subDays(endDate, 7);
    } else if (period === '30days') {
      startDate = subDays(endDate, 30);
    } else {
      startDate = subDays(endDate, 90);
    }
    
    // Process logs within the date range
    const dailyIntake: Record<string, number> = {};
    let totalIntake = 0;
    let daysWithLogs = 0;
    
    // Sort logs by date (oldest first to calculate streak)
    const sortedLogs = [...waterTracking.logs].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    // Group logs by date
    sortedLogs.forEach(log => {
      const logDate = new Date(log.timestamp);
      
      // Skip logs outside our date range
      if (logDate < startDate || logDate > endDate) {
        return;
      }
      
      const dateKey = format(logDate, 'yyyy-MM-dd');
      
      if (!dailyIntake[dateKey]) {
        dailyIntake[dateKey] = 0;
        daysWithLogs++;
      }
      
      dailyIntake[dateKey] += log.amount;
      totalIntake += log.amount;
    });
    
    // Calculate average intake (avoid division by zero)
    const averageIntake = daysWithLogs > 0 ? totalIntake / daysWithLogs : 0;
    
    // Calculate goal completion rate across the period
    const totalDaysInPeriod = getPeriodDays(period);
    const totalGoalAmount = waterGoal * totalDaysInPeriod;
    const goalCompletionRate = totalGoalAmount > 0 ? (totalIntake / totalGoalAmount) * 100 : 0;
    
    // Calculate water tracking streak
    // (Simplified - counts consecutive days where any water was logged)
    let currentStreak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Go back up to 90 days to check for streak
    const checkDays = Math.min(90, totalDaysInPeriod);
    
    for (let i = 0; i < checkDays; i++) {
      const checkDate = subDays(today, i);
      const dateKey = format(checkDate, 'yyyy-MM-dd');
      
      // If there's water logged for this day
      if (dailyIntake[dateKey] && dailyIntake[dateKey] >= (waterGoal * 0.5)) {
        // Count as meeting at least 50% of goal
        currentStreak++;
      } else {
        // Break the streak once we hit a day with no water or less than 50% of goal
        break;
      }
    }
    
    return {
      dailyIntake,
      averageIntake,
      goalCompletionRate,
      streak: currentStreak
    };
  } catch (err) {
    console.error('Error in getWaterTrackingStats:', err);
    return {
      dailyIntake: {},
      averageIntake: 0,
      goalCompletionRate: 0,
      streak: 0
    };
  }
}

// Helper function to get the number of days in a period
function getPeriodDays(period: '7days' | '30days' | '90days'): number {
  switch (period) {
    case '7days': return 7;
    case '30days': return 30;
    case '90days': return 90;
    default: return 7;
  }
}

/**
 * Get combined tracking analytics for the Progress screen
 */
export async function getTrackingAnalytics(
  userId: string, 
  period: '7days' | '30days' | '90days'
): Promise<TrackingAnalytics> {
  const analytics: TrackingAnalytics = {
    workout: {
      totalWorkouts: 0,
      completedWorkouts: 0,
      completionRate: 0,
      currentStreak: 0,
      longestStreak: 0,
      totalCaloriesBurned: 0,
      lastWorkoutDate: null,
      workoutsPerDay: {}
    },
    meal: {
      totalMeals: 0,
      completedMeals: 0,
      completionRate: 0,
      mealsPerDay: {},
      lastMealDate: null
    },
    workoutStats: {
      totalWorkouts: 0,
      completionRate: 0,
      currentStreak: 0,
      bestStreak: 0
    },
    period: 'week',
    water: {
      dailyIntake: {},
      averageIntake: 0,
      goalCompletionRate: 0,
      streak: 0
    }
  };
  
  // Convert period for backwards compatibility
  let periodType: 'week' | 'month' | 'all';
  switch (period) {
    case '7days':
      periodType = 'week';
      break;
    case '30days':
    case '90days':
      periodType = 'month';
      break;
    default:
      periodType = 'week';
  }
  
  analytics.period = periodType;
  
  try {
    // Get workout stats
    const workoutPeriod = period === '7days' ? 'week' : period === '30days' ? 'month' : 'all';
    const workoutStats = await getWorkoutStats(userId, workoutPeriod);
    analytics.workout = workoutStats;
    
    // Get meal stats
    const mealPeriod = period === '7days' ? 'week' : period === '30days' ? 'month' : 'all';
    const mealStats = await getMealStats(userId, mealPeriod);
    analytics.meal = mealStats;
    
    // Get water tracking stats
    const waterStats = await getWaterTrackingStats(userId, period);
    analytics.water = waterStats;
    
    // Update overall workout stats
    analytics.workoutStats = {
      totalWorkouts: workoutStats.totalWorkouts,
      completionRate: workoutStats.completionRate,
      currentStreak: workoutStats.currentStreak,
      bestStreak: workoutStats.longestStreak
    };
    
    return analytics;
  } catch (error) {
    console.error('Error getting tracking analytics:', error);
    return analytics;
  }
}
