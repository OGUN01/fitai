import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { UserProfile } from '../types/profile';

export interface ProgressAnalytics {
  workout: {
    totalWorkouts: number;
    completionRate: number;
    totalCaloriesBurned: number;
    weeklyData: Array<{ day: string; completed: number }>;
    currentStreak: number;
    longestStreak: number;
  };
  meal: {
    totalMeals: number;
    completionRate: number;
    weeklyData: Array<{ day: string; completed: number }>;
  };
  water: {
    dailyAverage: number;
    weeklyData: Array<{ day: string; amount: number }>;
    goalCompletion: number;
  };
}

export interface WaterEntry {
  id: string;
  user_id: string;
  amount: number;
  timestamp: string;
  created_at: string;
}

export interface WorkoutEntry {
  id: string;
  user_id: string;
  workout_id: string;
  completed: boolean;
  completion_date: string;
  created_at: string;
}

export interface MealEntry {
  id: string;
  user_id: string;
  meal_id: string;
  completed: boolean;
  completion_date: string;
  created_at: string;
}

/**
 * Service for managing progress data and analytics
 */
export class ProgressService {
  private static instance: ProgressService;
  
  public static getInstance(): ProgressService {
    if (!ProgressService.instance) {
      ProgressService.instance = new ProgressService();
    }
    return ProgressService.instance;
  }

  /**
   * Get comprehensive progress analytics for a user
   */
  async getProgressAnalytics(userId: string, timeRange: '7d' | '30d' | '90d' = '7d'): Promise<ProgressAnalytics> {
    try {
      console.log(`[ProgressService] Getting analytics for user ${userId}, range: ${timeRange}`);
      
      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      // Get all data in parallel
      const [workoutData, mealData, waterData] = await Promise.all([
        this.getWorkoutAnalytics(userId, startDate),
        this.getMealAnalytics(userId, startDate),
        this.getWaterAnalytics(userId, startDate)
      ]);

      return {
        workout: workoutData,
        meal: mealData,
        water: waterData
      };
    } catch (error) {
      console.error('[ProgressService] Error getting progress analytics:', error);
      return this.getDefaultAnalytics();
    }
  }

  /**
   * Get workout analytics
   */
  private async getWorkoutAnalytics(userId: string, startDate: Date) {
    try {
      const { data: workouts, error } = await supabase
        .from('workout_completions')
        .select('*')
        .eq('user_id', userId)
        .gte('completion_date', startDate.toISOString())
        .order('completion_date', { ascending: true });

      if (error) {
        console.error('[ProgressService] Error fetching workout data:', error);
        return this.getDefaultWorkoutAnalytics();
      }

      const totalWorkouts = workouts?.length || 0;
      const completedWorkouts = workouts?.filter(w => w.completed).length || 0;
      const completionRate = totalWorkouts > 0 ? (completedWorkouts / totalWorkouts) * 100 : 0;

      // Calculate weekly data
      const weeklyData = this.generateWeeklyData(workouts || [], 'completed');
      
      // Calculate streaks
      const { currentStreak, longestStreak } = this.calculateWorkoutStreaks(workouts || []);

      // Estimate calories burned (rough calculation)
      const totalCaloriesBurned = completedWorkouts * 300; // Assume 300 calories per workout

      return {
        totalWorkouts,
        completionRate,
        totalCaloriesBurned,
        weeklyData,
        currentStreak,
        longestStreak
      };
    } catch (error) {
      console.error('[ProgressService] Error in getWorkoutAnalytics:', error);
      return this.getDefaultWorkoutAnalytics();
    }
  }

  /**
   * Get meal analytics
   */
  private async getMealAnalytics(userId: string, startDate: Date) {
    try {
      const { data: meals, error } = await supabase
        .from('meal_completions')
        .select('*')
        .eq('user_id', userId)
        .gte('completion_date', startDate.toISOString())
        .order('completion_date', { ascending: true });

      if (error) {
        console.error('[ProgressService] Error fetching meal data:', error);
        return this.getDefaultMealAnalytics();
      }

      const totalMeals = meals?.length || 0;
      const completedMeals = meals?.filter(m => m.completed).length || 0;
      const completionRate = totalMeals > 0 ? (completedMeals / totalMeals) * 100 : 0;

      // Calculate weekly data
      const weeklyData = this.generateWeeklyData(meals || [], 'completed');

      return {
        totalMeals,
        completionRate,
        weeklyData
      };
    } catch (error) {
      console.error('[ProgressService] Error in getMealAnalytics:', error);
      return this.getDefaultMealAnalytics();
    }
  }

  /**
   * Get water analytics
   */
  private async getWaterAnalytics(userId: string, startDate: Date) {
    try {
      const { data: waterEntries, error } = await supabase
        .from('water_tracking')
        .select('*')
        .eq('user_id', userId)
        .gte('timestamp', startDate.toISOString())
        .order('timestamp', { ascending: true });

      if (error) {
        console.error('[ProgressService] Error fetching water data:', error);
        return this.getDefaultWaterAnalytics();
      }

      // Group by day and sum amounts
      const dailyWater = this.groupWaterByDay(waterEntries || []);
      const totalAmount = Object.values(dailyWater).reduce((sum, amount) => sum + amount, 0);
      const days = Object.keys(dailyWater).length;
      const dailyAverage = days > 0 ? totalAmount / days : 0;

      // Generate weekly data
      const weeklyData = this.generateWaterWeeklyData(dailyWater);

      // Calculate goal completion (assuming 3.5L daily goal)
      const dailyGoal = 3.5;
      const goalCompletion = dailyAverage > 0 ? Math.min((dailyAverage / dailyGoal) * 100, 100) : 0;

      return {
        dailyAverage,
        weeklyData,
        goalCompletion
      };
    } catch (error) {
      console.error('[ProgressService] Error in getWaterAnalytics:', error);
      return this.getDefaultWaterAnalytics();
    }
  }

  /**
   * Generate weekly data for workouts/meals
   */
  private generateWeeklyData(entries: any[], completionField: string) {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const weeklyData = days.map(day => ({ day, completed: 0 }));

    entries.forEach(entry => {
      if (entry[completionField]) {
        const date = new Date(entry.completion_date);
        const dayIndex = (date.getDay() + 6) % 7; // Convert Sunday=0 to Monday=0
        weeklyData[dayIndex].completed += 1;
      }
    });

    return weeklyData;
  }

  /**
   * Group water entries by day
   */
  private groupWaterByDay(entries: WaterEntry[]) {
    const dailyWater: { [key: string]: number } = {};

    entries.forEach(entry => {
      const date = new Date(entry.timestamp).toDateString();
      dailyWater[date] = (dailyWater[date] || 0) + entry.amount;
    });

    return dailyWater;
  }

  /**
   * Generate weekly water data
   */
  private generateWaterWeeklyData(dailyWater: { [key: string]: number }) {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const weeklyData = days.map(day => ({ day, amount: 0 }));

    // Get the last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateString = date.toDateString();
      const dayIndex = (date.getDay() + 6) % 7; // Convert Sunday=0 to Monday=0
      
      weeklyData[dayIndex].amount = dailyWater[dateString] || 0;
    }

    return weeklyData;
  }

  /**
   * Calculate workout streaks
   */
  private calculateWorkoutStreaks(workouts: WorkoutEntry[]) {
    const completedDates = workouts
      .filter(w => w.completed)
      .map(w => new Date(w.completion_date).toDateString())
      .sort();

    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;

    // Calculate current streak (from today backwards)
    const today = new Date().toDateString();
    let checkDate = new Date();
    
    while (completedDates.includes(checkDate.toDateString())) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }

    // Calculate longest streak
    for (let i = 0; i < completedDates.length; i++) {
      if (i === 0 || this.isConsecutiveDay(completedDates[i-1], completedDates[i])) {
        tempStreak++;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
    }
    longestStreak = Math.max(longestStreak, tempStreak);

    return { currentStreak, longestStreak };
  }

  /**
   * Check if two date strings are consecutive days
   */
  private isConsecutiveDay(date1: string, date2: string): boolean {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays === 1;
  }

  /**
   * Get default analytics when data is not available
   */
  private getDefaultAnalytics(): ProgressAnalytics {
    return {
      workout: this.getDefaultWorkoutAnalytics(),
      meal: this.getDefaultMealAnalytics(),
      water: this.getDefaultWaterAnalytics()
    };
  }

  private getDefaultWorkoutAnalytics() {
    return {
      totalWorkouts: 1,
      completionRate: 0,
      totalCaloriesBurned: 0,
      weeklyData: [
        { day: 'Mon', completed: 0 },
        { day: 'Tue', completed: 0 },
        { day: 'Wed', completed: 0 },
        { day: 'Thu', completed: 0 },
        { day: 'Fri', completed: 0 },
        { day: 'Sat', completed: 0 },
        { day: 'Sun', completed: 0 }
      ],
      currentStreak: 0,
      longestStreak: 0
    };
  }

  private getDefaultMealAnalytics() {
    return {
      totalMeals: 0,
      completionRate: 0,
      weeklyData: [
        { day: 'Mon', completed: 0 },
        { day: 'Tue', completed: 0 },
        { day: 'Wed', completed: 0 },
        { day: 'Thu', completed: 0 },
        { day: 'Fri', completed: 0 },
        { day: 'Sat', completed: 0 },
        { day: 'Sun', completed: 0 }
      ]
    };
  }

  private getDefaultWaterAnalytics() {
    return {
      dailyAverage: 0,
      weeklyData: [
        { day: 'Mon', amount: 0 },
        { day: 'Tue', amount: 0 },
        { day: 'Wed', amount: 0 },
        { day: 'Thu', amount: 0 },
        { day: 'Fri', amount: 0 },
        { day: 'Sat', amount: 0 },
        { day: 'Sun', amount: 0 }
      ],
      goalCompletion: 0
    };
  }
}

export const progressService = ProgressService.getInstance();
