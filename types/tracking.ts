// Types for workout and meal tracking

export interface WorkoutCompletion {
  id: string;
  user_id: string;
  workout_date: string; // ISO date string when workout was completed
  day_number: number;
  workout_plan_id: string;
  completed_at: string; // ISO datetime string
  estimated_calories_burned: number;
  workout_day_name?: string; // The actual day name (Monday, Wednesday, etc.)
}

export interface MealCompletion {
  id: string;
  user_id: string;
  meal_date: string; // ISO date string
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  meal_plan_id: string;
  completed_at: string; // ISO datetime string
}

// Workout analytics types
export interface WorkoutStats {
  totalWorkouts: number;
  completedWorkouts: number;
  completionRate: number;
  currentStreak: number;
  longestStreak: number;
  totalCaloriesBurned: number;
  lastWorkoutDate: string | null;
  workoutsPerDay?: Record<string, number>; // Add this field to track workouts per day
}

// Meal analytics types
export interface MealStats {
  totalMeals: number;
  completedMeals: number;
  completionRate: number;
  mealsPerDay: Record<string, number>;
  lastMealDate: string | null;
}

// Combined analytics for the Progress screen
export interface TrackingAnalytics {
  workout: WorkoutStats;
  meal: MealStats;
  period: 'week' | 'month' | 'all';
  
  // Added new analytics properties for the enhanced Progress screen
  workoutStats: {
    totalWorkouts: number;
    completionRate: number;
    currentStreak: number;
    bestStreak: number;
  };
}
