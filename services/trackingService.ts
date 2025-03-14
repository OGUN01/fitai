import supabase from '../lib/supabase';
import { WorkoutCompletion, MealCompletion, WorkoutStats, MealStats, TrackingAnalytics } from '../types/tracking';
import { format, subDays, parseISO, differenceInDays, isSameDay, isAfter } from 'date-fns';

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
  workoutDetails: any = null
): Promise<WorkoutCompletion | null> {
  try {
    // Get user profile for weight, age, gender
    const { data: profile } = await supabase
      .from('profiles')
      .select('weight_kg, age, gender')
      .eq('id', userId)
      .single();
      
    if (!profile) {
      console.error('User profile not found');
      return null;
    }
    
    // Determine workout duration and type
    let duration = 45; // Default duration in minutes
    let workoutType = 'strength_training'; // Default type
    let workoutDayName = '';
    
    if (workoutDetails) {
      duration = workoutDetails.estimated_duration_minutes || duration;
      workoutType = workoutDetails.focus_area || workoutType;
      workoutDayName = workoutDetails.workout_day_name || '';
    }

    // Ensure we have a valid workout day name
    if (!workoutDayName) {
      // Map day number to day name if not provided
      const dayMap: Record<number, string> = {
        1: 'Monday',
        2: 'Wednesday',
        3: 'Friday',
        4: 'Saturday',
        5: 'Sunday'
      };
      workoutDayName = dayMap[dayNumber] || `Day ${dayNumber}`;
    }
    
    // Calculate estimated calories burned
    const caloriesBurned = calculateCaloriesBurned(
      profile.weight_kg || 70,
      duration,
      workoutType,
      profile.age || 30,
      profile.gender || 'male'
    );
    
    // Create the record with the workout_day_name field
    const record = {
      user_id: userId,
      workout_date: workoutDate,
      day_number: dayNumber,
      workout_plan_id: workoutPlanId,
      completed_at: new Date().toISOString(),
      estimated_calories_burned: caloriesBurned,
      workout_day_name: workoutDayName // This is now required
    };

    console.log('Marking workout complete:', {
      date: workoutDate,
      dayNumber,
      dayName: workoutDayName
    });
    
    // Insert completion record with the new conflict handling
    const { data, error } = await supabase
      .from('workout_completions')
      .upsert(record, { 
        onConflict: 'workout_completions_user_id_workout_date_day_name_key'
      })
      .select();
      
    if (error) {
      console.error('Error marking workout complete:', error);
      return null;
    }
    
    return data[0] as WorkoutCompletion;
  } catch (err) {
    console.error('Error in markWorkoutComplete:', err);
    return null;
  }
}

/**
 * Check if a workout is completed for a specific date and day name
 */
export async function isWorkoutCompleted(
  userId: string, 
  workoutDate: Date,
  workoutDayName?: string
): Promise<boolean> {
  try {
    console.log('Checking workout completion for user:', userId, 
                'date:', format(workoutDate, 'yyyy-MM-dd'),
                'day name:', workoutDayName || 'any');
    
    const formattedDate = format(workoutDate, 'yyyy-MM-dd');
    
    // Build the query
    let query = supabase
      .from('workout_completions')
      .select('id, workout_day_name')
      .eq('user_id', userId)
      .eq('workout_date', formattedDate);
    
    // If a specific workout day name is provided, filter by it
    if (workoutDayName) {
      query = query.eq('workout_day_name', workoutDayName);
      console.log('Checking completion for specific day:', workoutDayName);
    }
      
    const { data, error } = await query;
      
    if (error) {
      console.error('Error checking workout completion:', error);
      return false;
    }
    
    // If we find completions, consider the workout completed
    const isCompleted = !!data && data.length > 0;
    console.log('Workout completion check result:', {
      isCompleted,
      data,
      dayName: workoutDayName
    });
    return isCompleted;
  } catch (err) {
    console.error('Error in isWorkoutCompleted:', err);
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
    // Standardize meal type format (first letter uppercase, rest lowercase)
    const formattedMealType = mealType.charAt(0).toUpperCase() + mealType.slice(1).toLowerCase();
    
    const { data, error } = await supabase
      .from('meal_completions')
      .upsert({
        user_id: userId,
        meal_date: mealDate,
        meal_type: formattedMealType,
        meal_plan_id: mealPlanId,
        completed_at: new Date().toISOString()
      }, { onConflict: 'user_id, meal_date, meal_type' })
      .select();
      
    if (error) {
      console.error('Error marking meal complete:', error);
      return null;
    }
    
    return data[0] as MealCompletion;
  } catch (err) {
    console.error('Error in markMealComplete:', err);
    return null;
  }
}

/**
 * Check if a meal is completed for a specific date and type
 */
export async function isMealCompleted(userId: string, mealDate: string, mealType: string): Promise<boolean> {
  try {
    // Add proper headers and handle lowercase meal types for consistency
    const formattedMealType = mealType.charAt(0).toUpperCase() + mealType.slice(1).toLowerCase();
    
    const { data, error } = await supabase
      .from('meal_completions')
      .select('id')
      .eq('user_id', userId)
      .eq('meal_date', mealDate)
      .eq('meal_type', formattedMealType)
      .maybeSingle();
      
    if (error) {
      console.error('Error checking meal completion:', error);
      return false;
    }
    
    return !!data;
  } catch (err) {
    console.error('Error in isMealCompleted:', err);
    return false;
  }
}

/**
 * Get workout analytics for a user
 */
export async function getWorkoutStats(userId: string, period: 'week' | 'month' | 'all' = 'all'): Promise<WorkoutStats> {
  try {
    // Default stats
    const defaultStats: WorkoutStats = {
      totalWorkouts: 0,
      completedWorkouts: 0,
      completionRate: 0,
      currentStreak: 0,
      longestStreak: 0,
      totalCaloriesBurned: 0,
      lastWorkoutDate: null,
      workoutsPerDay: {}
    };
    
    // Get date range based on period
    let startDate = null;
    const endDate = new Date();
    
    if (period === 'week') {
      startDate = subDays(endDate, 7);
    } else if (period === 'month') {
      startDate = subDays(endDate, 30);
    }
    
    // For testing - log period and date range
    console.log(`Getting workout stats for period: ${period}`);
    console.log(`Date range: ${startDate ? format(startDate, 'yyyy-MM-dd') : 'all'} to ${format(endDate, 'yyyy-MM-dd')}`);
    
    // Build query
    let query = supabase
      .from('workout_completions')
      .select('*')
      .eq('user_id', userId)
      .order('workout_date', { ascending: false });
      
    if (startDate) {
      query = query.gte('workout_date', format(startDate, 'yyyy-MM-dd'));
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error getting workout stats:', error);
      return defaultStats;
    }
    
    if (!data || data.length === 0) {
      console.log('No workout completion data found');
      return defaultStats;
    }
    
    console.log(`Found ${data.length} workout completion records`);
    
    // Process completed workouts
    const completedWorkouts = data.filter(workout => workout.completed_at !== null).length;
    const totalCaloriesBurned = data.reduce((sum, workout) => sum + (workout.estimated_calories_burned || 0), 0);
    const lastWorkoutDate = data[0].workout_date;
    
    console.log(`Raw workout completion count: ${completedWorkouts}`);
    console.log(`Total calories burned: ${totalCaloriesBurned}`);
    
    // Calculate how many unique workout days were completed
    // Analyze workout day data to see if it matches expectations
    console.log('Analyzing workout days completed');
    
    // Create a set of unique workout dates 
    const uniqueWorkoutDates = new Set(data.map(workout => workout.workout_date));
    console.log(`Unique workout dates: ${Array.from(uniqueWorkoutDates)}`);
    
    // Try to identify the intended workflow plan
    const dayNumbers = data.map(workout => workout.day_number).filter(Boolean);
    console.log(`Day numbers found: ${dayNumbers.join(', ')}`);
    
    // Check workout_day_name values
    const dayNames = data.map(workout => workout.workout_day_name).filter(Boolean);
    console.log(`Day names found: ${dayNames.join(', ')}`);
    
    // Testing a different counting approach 
    // Let's count completed workouts as the number of unique workouts completed by day number
    const uniqueDayNumbers = new Set(data.map(workout => workout.day_number));
    console.log(`Unique day numbers: ${Array.from(uniqueDayNumbers)}`);
    const completedWorkoutsByDayNumber = uniqueDayNumbers.size;
    console.log(`Completed workouts by unique day number: ${completedWorkoutsByDayNumber}`);
    
    // Override completedWorkouts to use the day number count if it's greater
    const finalCompletedWorkouts = completedWorkoutsByDayNumber > completedWorkouts ? 
        completedWorkoutsByDayNumber : completedWorkouts;
    console.log(`Final completed workouts count: ${finalCompletedWorkouts}`);
    
    // Calculate streak
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    
    // Sort data by date (ascending)
    const sortedWorkouts = [...data].sort((a, b) => 
      new Date(a.workout_date).getTime() - new Date(b.workout_date).getTime()
    );
    
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
      
      // Fallback 1: Try to use day_number to determine day name
      // This is a simplification - we should ideally use the user's workout preferences to map correctly
      if (workout.day_number) {
        // For different workout schedules
        const user_workout_preferences = workout.user_workout_preferences || {};
        const daysPerWeek = user_workout_preferences.workout_days_per_week || 3;
        
        // Default mapping for 3-day schedule
        if (daysPerWeek === 3) {
          if (workout.day_number === 1) return 'Monday';
          if (workout.day_number === 2) return 'Wednesday';
          if (workout.day_number === 3) return 'Friday';
        } 
        // 5-day schedule (weekdays)
        else if (daysPerWeek === 5) {
          if (workout.day_number === 1) return 'Monday';
          if (workout.day_number === 2) return 'Tuesday';
          if (workout.day_number === 3) return 'Wednesday';
          if (workout.day_number === 4) return 'Thursday';
          if (workout.day_number === 5) return 'Friday';
        }
        // 6-day schedule
        else if (daysPerWeek === 6) {
          if (workout.day_number === 1) return 'Monday';
          if (workout.day_number === 2) return 'Tuesday';
          if (workout.day_number === 3) return 'Wednesday';
          if (workout.day_number === 4) return 'Thursday';
          if (workout.day_number === 5) return 'Friday';
          if (workout.day_number === 6) return 'Saturday';
        }
        // 7-day schedule
        else if (daysPerWeek === 7) {
          if (workout.day_number === 1) return 'Monday';
          if (workout.day_number === 2) return 'Tuesday';
          if (workout.day_number === 3) return 'Wednesday';
          if (workout.day_number === 4) return 'Thursday';
          if (workout.day_number === 5) return 'Friday';
          if (workout.day_number === 6) return 'Saturday';
          if (workout.day_number === 7) return 'Sunday';
        }
        // 4-day schedule 
        else if (daysPerWeek === 4) {
          if (workout.day_number === 1) return 'Monday';
          if (workout.day_number === 2) return 'Tuesday';
          if (workout.day_number === 3) return 'Thursday';
          if (workout.day_number === 4) return 'Friday';
        }
      }
      
      // Fallback 2: Use the date to determine day name
      const date = workout.workout_date;
      return new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
    };
    
    // Process each workout - with detailed debug logs
    sortedWorkouts.forEach(workout => {
      // Log the raw workout data to debug day mapping
      console.log('Processing workout:', JSON.stringify(workout, null, 2));
      
      // Use the stored workout_day_name directly if available
      const dayName = workout.workout_day_name || getDayNameFromWorkout(workout);
      console.log(`Mapped workout to day: ${dayName}`);
      
      if (allDayNames.includes(dayName)) {
        workoutsPerDay[dayName] = (workoutsPerDay[dayName] || 0) + 1;
      }
    });
    
    // Count how many days have at least one workout completed
    const totalCompletedWorkoutDays = Object.values(workoutsPerDay).filter(count => count > 0).length;
    
    console.log('Workouts per day mapped dynamically:', workoutsPerDay);
    console.log('Total completed workout days:', totalCompletedWorkoutDays);
    
    // Return final stats
    return {
      totalWorkouts: 0, // Not used in UI
      completedWorkouts: finalCompletedWorkouts, // Use the day number count if it's greater
      completionRate: 0, // Not used in UI
      currentStreak: 0, // Not used in UI
      longestStreak: 0, // Not used in UI
      totalCaloriesBurned,
      lastWorkoutDate,
      workoutsPerDay
    };
  } catch (err) {
    console.error('Error in getWorkoutStats:', err);
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
 * Get meal analytics for a user
 */
export async function getMealStats(userId: string, period: 'week' | 'month' | 'all' = 'all'): Promise<MealStats> {
  try {
    // Default stats
    const defaultStats: MealStats = {
      totalMeals: 0,
      completedMeals: 0,
      completionRate: 0,
      mealsPerDay: {},
      lastMealDate: null
    };
    
    // Get date range based on period
    let startDate = null;
    const endDate = new Date();
    
    if (period === 'week') {
      startDate = subDays(endDate, 7);
    } else if (period === 'month') {
      startDate = subDays(endDate, 30);
    }
    
    // Build query
    let query = supabase
      .from('meal_completions')
      .select('*')
      .eq('user_id', userId)
      .order('meal_date', { ascending: false });
      
    if (startDate) {
      query = query.gte('meal_date', format(startDate, 'yyyy-MM-dd'));
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error getting meal stats:', error);
      return defaultStats;
    }
    
    if (!data || data.length === 0) {
      return defaultStats;
    }
    
    // Process completed meals
    const completedMeals = data.length;
    const lastMealDate = data[0].meal_date;
    
    // Calculate meals per day
    const mealsPerDay: Record<string, number> = {};
    
    data.forEach(meal => {
      if (mealsPerDay[meal.meal_date]) {
        mealsPerDay[meal.meal_date]++;
      } else {
        mealsPerDay[meal.meal_date] = 1;
      }
    });
    
    // Estimate total meals based on 3 meals per day in the period
    let totalDays = 0;
    if (period === 'week') {
      totalDays = 7;
    } else if (period === 'month') {
      totalDays = 30;
    } else {
      // For 'all', use days since first meal or 30 days, whichever is greater
      const oldestMeal = [...data].sort((a, b) => 
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
 * Get combined tracking analytics for the Progress screen
 */
export async function getTrackingAnalytics(
  userId: string, 
  period: '7days' | '30days' | '90days'
): Promise<TrackingAnalytics> {
  try {
    // Determine the time period for analytics
    let analyticsTimePeriod: 'week' | 'month' | 'all' = 'week';
    if (period === '30days') analyticsTimePeriod = 'month';
    if (period === '90days') analyticsTimePeriod = 'all';
    
    // Get workout and meal stats
    const workoutStats = await getWorkoutStats(userId, analyticsTimePeriod);
    const mealStats = await getMealStats(userId, analyticsTimePeriod);
    
    console.log('TRACKING SERVICE - Workout Stats:', JSON.stringify(workoutStats, null, 2));
    console.log('TRACKING SERVICE - Meal Stats:', JSON.stringify(mealStats, null, 2));
    
    return {
      workout: workoutStats,
      meal: mealStats,
      period: analyticsTimePeriod
    };
  } catch (err) {
    console.error('Error in getTrackingAnalytics:', err);
    
    // Default time period for fallback case
    const fallbackPeriod: 'week' | 'month' | 'all' = 'week';
    
    // Return default data on error
    return {
      workout: {
        totalWorkouts: 0,
        completedWorkouts: 0,
        completionRate: 0,
        currentStreak: 0,
        longestStreak: 0,
        totalCaloriesBurned: 0,
        lastWorkoutDate: null,
        workoutsPerDay: { 'Monday': 0, 'Tuesday': 0, 'Wednesday': 0, 'Thursday': 0, 'Friday': 0, 'Saturday': 0, 'Sunday': 0 }
      },
      meal: {
        totalMeals: 0,
        completedMeals: 0,
        completionRate: 0,
        mealsPerDay: {},
        lastMealDate: null
      },
      period: fallbackPeriod
    };
  }
}
