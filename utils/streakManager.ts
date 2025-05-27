import AsyncStorage from '@react-native-async-storage/async-storage';
import { format, isYesterday, isToday, differenceInDays, parseISO } from 'date-fns';
import supabase from '../lib/supabase';

// Cache keys
const STREAK_CACHE_KEY = 'streak_data';

// Interface for local streak data
interface StreakData {
  currentStreak: number;
  lastCompletionDate: string | null;
  activityHistory: {
    [date: string]: {
      workouts: boolean;
      meals: boolean;
      water: boolean;
    }
  };
  lastUpdated: string;
}

/**
 * Get current streak data from local storage
 */
export async function getStreakData(): Promise<StreakData> {
  try {
    const dataString = await AsyncStorage.getItem(STREAK_CACHE_KEY);
    if (dataString) {
      const parsedData = JSON.parse(dataString);
      // Ensure activityHistory is always an object, even if it was saved as a minimal version
      return {
        currentStreak: parsedData.currentStreak || 0,
        lastCompletionDate: parsedData.lastCompletionDate || null,
        activityHistory: parsedData.activityHistory || {},
        lastUpdated: parsedData.lastUpdated || new Date().toISOString(),
      };
    }
    // Default if no data found
    return {
      currentStreak: 0,
      lastCompletionDate: null,
      activityHistory: {},
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error getting streak data:', error);
    // Default on error
    return {
      currentStreak: 0,
      lastCompletionDate: null,
      activityHistory: {},
      lastUpdated: new Date().toISOString(),
    };
  }
}

/**
 * Save streak data to local storage
 */
async function saveStreakData(streakData: StreakData): Promise<void> {
  try {
    // Save the complete streak data to ensure we don't lose any history
    await AsyncStorage.setItem(STREAK_CACHE_KEY, JSON.stringify(streakData));
    
    console.log(`Streak data saved - Current streak: ${streakData.currentStreak}, Last completion: ${streakData.lastCompletionDate}`);
  } catch (error) {
    console.error('Error saving streak data:', error);
  }
}

/**
 * Check if all daily activities are completed for a given date
 * @param history Activity history from streak data
 * @param dateString Date string in format 'yyyy-MM-dd'
 * @param isRestDay Whether the day is a rest day with no scheduled workout
 */
function areDailyActivitiesCompleted(
  history: StreakData['activityHistory'], 
  dateString: string,
  isRestDay: boolean = false
): boolean {
  const dayData = history[dateString];
  if (!dayData) return false;
  
  // For rest days, we only consider meals
  if (isRestDay) {
    // On rest days, consider the day complete if meals are completed
    return dayData.meals;
  }
  
  // For workout days, consider a day complete if either:
  // 1. The workout is completed (for workout days)
  // 2. At least one meal is completed (for all days including rest days)
  return dayData.workouts || dayData.meals;
}

/**
 * Process activity completion and update streak
 * @param userId User ID (if authenticated)
 * @param activityType Type of activity completed
 * @param completed Whether the activity was completed
 * @param isRestDay Whether the current day is a rest day (no workout scheduled)
 * @returns The updated streak count
 */
export async function processActivityCompletion(
  userId: string | null,
  activityType: 'workouts' | 'meals' | 'water',
  completed: boolean,
  isRestDay: boolean = false
): Promise<number> {
  const today = format(new Date(), 'yyyy-MM-dd');
  
  // Get current streak data
  const streakData = await getStreakData();
  
  // Initialize today's record if it doesn't exist
  if (!streakData.activityHistory[today]) {
    streakData.activityHistory[today] = {
      workouts: false,
      meals: false,
      water: false
    };
  }
  
  // Update the activity completion
  streakData.activityHistory[today][activityType] = completed;
  
  // Check if all required activities for today are now completed
  const todayCompleted = areDailyActivitiesCompleted(streakData.activityHistory, today, isRestDay);
  
  if (todayCompleted) {
    // If today is completed, update last completion date
    const previousDate = streakData.lastCompletionDate;
    
    // Only update last completion date if it's different
    if (previousDate !== today) {
      // Check if the previous completion was yesterday or earlier
      if (previousDate) {
      const prevDate = parseISO(previousDate);
      const dayDifference = differenceInDays(new Date(), prevDate);
      
        if (dayDifference <= 1) {
          // Today or yesterday - increment streak
        streakData.currentStreak += 1;
        } else {
        // Streak broken - reset to 1
          streakData.currentStreak = 1;
        }
      } else {
        // First ever completion
        streakData.currentStreak = 1;
      }
      
      // Update the completion date after checking
      streakData.lastCompletionDate = today;
    }
  }
  
  // Update the last updated timestamp
  streakData.lastUpdated = new Date().toISOString();
  
  // Save the updated streak data
  await saveStreakData(streakData);
  
  // If user is authenticated, sync with server
  if (userId) {
    await syncStreakWithServer(userId, streakData);
  }
  
  return streakData.currentStreak;
}

/**
 * Sync streak data with the server
 */
async function syncStreakWithServer(userId: string, streakData: StreakData): Promise<void> {
  try {
    // First, get the current profile data
    const { data: profileData, error: fetchError } = await supabase
      .from('profiles')
      .select('workout_tracking')
      .eq('id', userId)
      .single();
      
    if (fetchError) {
      console.error('Error fetching profile for streak sync:', fetchError);
      return;
    }
    
    // Get existing tracking data or initialize
    const workoutTracking = profileData?.workout_tracking || {};
    
    // Update with latest streak information
    const updatedTracking = {
      ...workoutTracking,
      streak: streakData.currentStreak,
      lastCompletionDate: streakData.lastCompletionDate,
      // Store longest streak by taking max of current and previous
      longestStreak: Math.max(
        streakData.currentStreak, 
        workoutTracking.longestStreak || 0
      ),
      lastUpdated: new Date().toISOString()
    };
    
    // Update the profile with new tracking data
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        workout_tracking: updatedTracking
      })
      .eq('id', userId);
      
    if (updateError) {
      console.error('Error updating streak on server:', updateError);
    }
  } catch (error) {
    console.error('Error syncing streak with server:', error);
  }
}

/**
 * Repair streak data if it's inconsistent
 * This checks both local and server data (if authenticated) and resolves conflicts
 */
export async function repairStreakData(userId: string | null): Promise<void> {
  try {
    // Get local streak data
    const localData = await getStreakData();
    
    // If authenticated, get server data too
    if (userId) {
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('workout_tracking')
        .eq('id', userId)
        .single();
        
      if (!error && profileData?.workout_tracking) {
        const serverData = profileData.workout_tracking;
        
        // Take the highest streak between local and server
        const repairedStreak = Math.max(
          localData.currentStreak,
          serverData.streak || 0
        );
        
        // Use most recent last completion date
        let repairedLastCompletion = localData.lastCompletionDate;
        if (serverData.lastCompletionDate) {
          if (!repairedLastCompletion || 
              new Date(serverData.lastCompletionDate) > new Date(repairedLastCompletion)) {
            repairedLastCompletion = serverData.lastCompletionDate;
          }
        }
        
        // Update local data
        localData.currentStreak = repairedStreak;
        localData.lastCompletionDate = repairedLastCompletion;
        
        // Save repaired data locally
        await saveStreakData(localData);
        
        // Sync back to server
        await syncStreakWithServer(userId, localData);
      }
    }
  } catch (error) {
    console.error('Error repairing streak data:', error);
  }
}

/**
 * Get the current streak count
 * This is a convenience method that returns just the current streak number
 * @param isRestDay Whether the current day is a rest day (no workout scheduled)
 */
export async function getCurrentStreak(isRestDay: boolean = false): Promise<number> {
  const streakData = await getStreakData();
  
  // Check if today's activities are completed but not yet counted in the streak
  const today = format(new Date(), 'yyyy-MM-dd');
  const todayCompleted = areDailyActivitiesCompleted(streakData.activityHistory, today, isRestDay);
  
  // If activities are completed today but today's date is not yet the lastCompletionDate
  // This can happen if the streak wasn't updated via processActivityCompletion
  if (todayCompleted && streakData.lastCompletionDate !== today) {
    // Check if we need to increment the streak (if yesterday was the last completion)
    if (streakData.lastCompletionDate) {
      const lastDate = parseISO(streakData.lastCompletionDate);
      const dayDifference = differenceInDays(new Date(), lastDate);
      
      if (dayDifference <= 1) {
        // If the last completion was yesterday or today, increment streak
        streakData.currentStreak += 1;
      } else {
        // If the streak was broken, reset to 1 for today
        streakData.currentStreak = 1;
      }
    } else {
      // First ever completion
      streakData.currentStreak = 1;
    }
    
    // Update the completion date
    streakData.lastCompletionDate = today;
    
    // Save the updated streak data
    streakData.lastUpdated = new Date().toISOString();
    await saveStreakData(streakData);
    
    console.log(`Streak updated during getCurrentStreak: ${streakData.currentStreak} days (rest day: ${isRestDay})`);
  }
  
  return streakData.currentStreak;
}

/**
 * Check if user has completed today's activities
 */
export async function hasCompletedToday(): Promise<boolean> {
  const streakData = await getStreakData();
  const today = format(new Date(), 'yyyy-MM-dd');
  
  const todayHistory = streakData.activityHistory[today];
  const result = areDailyActivitiesCompleted(streakData.activityHistory, today);
  
  console.log(`[Streak] Checking today's activities: 
    Date: ${today}
    Activity data exists: ${Boolean(todayHistory)}
    Workouts completed: ${todayHistory?.workouts || false}
    Meals completed: ${todayHistory?.meals || false}
    Daily activities completed: ${result}
    Current streak: ${streakData.currentStreak}
    Last completion date: ${streakData.lastCompletionDate || 'none'}`);
  
  return result;
}

/**
 * Record a workout completion
 * This is a convenience method for recording workout completions specifically
 * @param userId User ID or null for local user
 * @param isRestDay Whether today is a rest day (no workout scheduled)
 */
export async function recordWorkoutCompletion(userId: string | null, isRestDay: boolean = false): Promise<number> {
  return processActivityCompletion(userId, 'workouts', true, isRestDay);
}

/**
 * Record a meal completion
 * This is a convenience method for recording meal completions specifically
 * @param userId User ID or null for local user
 * @param isRestDay Whether today is a rest day (no workout scheduled)
 */
export async function recordMealCompletion(userId: string | null, isRestDay: boolean = false): Promise<number> {
  return processActivityCompletion(userId, 'meals', true, isRestDay);
}
