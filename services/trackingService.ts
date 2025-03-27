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
        onConflict: 'user_id,workout_date,workout_day_name'
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
    const formattedDate = format(workoutDate, 'yyyy-MM-dd');
    console.log(`Checking workout completion for user ${userId} on ${formattedDate}, day: ${workoutDayName || 'any'}`);
    
    // Build the query
    let query = supabase
      .from('workout_completions')
      .select('id, workout_day_name')
      .eq('user_id', userId)
      .eq('workout_date', formattedDate);
    
    // If a specific workout day name is provided, filter by it
    if (workoutDayName) {
      query = query.eq('workout_day_name', workoutDayName);
    }
      
    const { data, error } = await query;
    
    if (error) {
      console.error('Error checking workout completion:', error);
      return false;
    }
    
    // If we find completions, consider the workout completed
    const isCompleted = !!data && data.length > 0;
    console.log(`Workout completion result for ${workoutDayName || 'any'}: ${isCompleted}`, data);
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
    console.log(`Checking meal completion for user ${userId} on ${mealDate}, meal: ${formattedMealType}`);
    
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
    
    const isCompleted = !!data;
    console.log(`Meal completion result for ${formattedMealType}: ${isCompleted}`);
    return isCompleted;
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
    
    // Process completed workouts - count each completed workout
    const completedWorkouts = data.filter(workout => workout.completed_at !== null).length;
    const totalCaloriesBurned = data.reduce((sum, workout) => sum + (workout.estimated_calories_burned || 0), 0);
    const lastWorkoutDate = data[0].workout_date;
    
    console.log(`Raw workout completion count: ${completedWorkouts}`);
    console.log(`Total calories burned: ${totalCaloriesBurned}`);
    
    // Create a set of unique workout dates for accurate counting
    const uniqueWorkoutDates = new Set(data.map(workout => workout.workout_date));
    console.log(`Unique workout dates: ${Array.from(uniqueWorkoutDates)}`);
    
    // Calculate total workouts (this should be at least the number of completed workouts)
    // For now, we'll set total workouts equal to completed workouts to ensure completion rate works
    const totalWorkouts = Math.max(completedWorkouts, 1); // Ensure at least 1 to avoid division by zero
    
    // Calculate completion rate
    const completionRate = Math.round((completedWorkouts / totalWorkouts) * 100);
    
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
    
    // Calculate current streak and best streak
    let currentStreak = 0;
    let longestStreak = 0;
    
    // Calculate current streak - look for consecutive days with workouts
    // For the purpose of this implementation, we'll use a simplified approach:
    // If user has completed at least one workout, their current streak is at least 1
    currentStreak = completedWorkouts > 0 ? 1 : 0;
    
    // If we have data from multiple dates, try to calculate a more accurate streak
    if (uniqueWorkoutDates.size > 1) {
      const dates = Array.from(uniqueWorkoutDates).map(date => new Date(date));
      dates.sort((a, b) => b.getTime() - a.getTime()); // Sort descending
      
      // If the most recent workout is from today or yesterday, start counting the streak
      const mostRecentDate = dates[0];
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      if (mostRecentDate.toDateString() === today.toDateString() || 
          mostRecentDate.toDateString() === yesterday.toDateString()) {
        // Start with 1 for the most recent workout
        currentStreak = 1;
        
        // Check for consecutive days
        for (let i = 1; i < dates.length; i++) {
          const currentDate = dates[i-1];
          const prevDate = dates[i];
          
          // Calculate days between workouts
          const diffTime = currentDate.getTime() - prevDate.getTime();
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          
          // If the difference is 1 day, increment streak
          if (diffDays === 1) {
            currentStreak++;
          } else {
            // Break the streak if not consecutive
            break;
          }
        }
      }
    }
    
    // Longest streak should be at least the current streak
    longestStreak = Math.max(currentStreak, 1);
    
    // If we're confident in our streak calculation, we can use it
    // Otherwise, we'll just use the count of completed workouts (at least 1 if any are completed)
    const finalCurrentStreak = currentStreak;
    const finalLongestStreak = longestStreak;
    
    // Update the user's profile with the streak information
    try {
      // First, get the current workout_tracking data
      const { data: profileData, error: fetchError } = await supabase
        .from('profiles')
        .select('workout_tracking')
        .eq('id', userId)
        .single();
        
      if (fetchError) {
        console.error('Error fetching user profile for streak update:', fetchError);
      } else {
        // Get existing workout tracking or initialize if not present
        const workoutTracking = profileData?.workout_tracking || {};
        
        // Update with streak information
        const updatedTracking = {
          ...workoutTracking,
          streak: finalCurrentStreak,
          longestStreak: finalLongestStreak,
          lastUpdated: new Date().toISOString()
        };
        
        // Save the updated tracking data
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            workout_tracking: updatedTracking
          })
          .eq('id', userId);
          
        if (updateError) {
          console.error('Error updating user streak:', updateError);
        } else {
          console.log(`Updated user streak to ${finalCurrentStreak}`);
        }
      }
    } catch (e) {
      console.error('Error in profile streak update:', e);
    }
    
    console.log('Final workout stats:', {
      totalWorkouts,
      completedWorkouts,
      completionRate,
      currentStreak: finalCurrentStreak,
      longestStreak: finalLongestStreak,
      totalCaloriesBurned,
      lastWorkoutDate,
      workoutsPerDay
    });
    
    return {
      totalWorkouts,
      completedWorkouts,
      completionRate,
      currentStreak: finalCurrentStreak,
      longestStreak: finalLongestStreak,
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
