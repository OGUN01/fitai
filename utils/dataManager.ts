import AsyncStorage from '@react-native-async-storage/async-storage';

// Data structure types
export interface WorkoutSession {
  id: string;
  date: string; // ISO string
  completed: boolean;
  duration: number; // in minutes
  exercises: WorkoutExercise[];
  notes?: string;
}

export interface WorkoutExercise {
  name: string;
  sets: ExerciseSet[];
  targetMuscleGroup: string;
}

export interface ExerciseSet {
  reps: number;
  weight: number; // in kg
  completed: boolean;
}

export interface NutritionDay {
  id: string;
  date: string; // ISO string
  meals: Meal[];
  totalCalories: number;
  totalProtein: number; // in grams
  totalCarbs: number; // in grams
  totalFat: number; // in grams
  waterIntake: number; // in ml
  adherenceRating?: number; // 1-10 rating
}

export interface Meal {
  id: string;
  name: string;
  foods: FoodItem[];
  totalCalories: number;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  time: string; // ISO string
}

export interface FoodItem {
  name: string;
  serving: number;
  servingUnit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface BodyMetrics {
  id: string;
  date: string; // ISO string
  weight: number; // in kg
  bodyFatPercentage?: number;
  measurements?: {
    chest?: number;
    waist?: number;
    hips?: number;
    leftArm?: number;
    rightArm?: number;
    leftThigh?: number;
    rightThigh?: number;
    leftCalf?: number;
    rightCalf?: number;
  };
}

export interface UserGoals {
  targetWeight?: number;
  targetBodyFat?: number;
  fitnessGoal: 'weight_loss' | 'muscle_gain' | 'maintenance' | 'endurance' | 'strength';
  workoutsPerWeek: number;
  targetCaloriesPerDay?: number;
  targetProtein?: number;
  targetCarbs?: number;
  targetFat?: number;
  specificGoals?: string[];
}

// Storage keys
const STORAGE_KEYS = {
  WORKOUTS: 'fitness_app_workouts',
  NUTRITION: 'fitness_app_nutrition',
  BODY_METRICS: 'fitness_app_body_metrics',
  USER_GOALS: 'fitness_app_user_goals',
};

// Data management class
class DataManager {
  // Workouts
  async saveWorkout(workout: WorkoutSession): Promise<void> {
    try {
      const workouts = await this.getWorkouts();
      const existingIndex = workouts.findIndex(w => w.id === workout.id);
      
      if (existingIndex >= 0) {
        workouts[existingIndex] = workout;
      } else {
        workouts.push(workout);
      }
      
      await AsyncStorage.setItem(STORAGE_KEYS.WORKOUTS, JSON.stringify(workouts));
    } catch (error) {
      console.error('Error saving workout:', error);
      throw error;
    }
  }

  async getWorkouts(): Promise<WorkoutSession[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.WORKOUTS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting workouts:', error);
      return [];
    }
  }

  async getWorkoutsByDateRange(startDate: string, endDate: string): Promise<WorkoutSession[]> {
    try {
      const workouts = await this.getWorkouts();
      const start = new Date(startDate).getTime();
      const end = new Date(endDate).getTime();
      
      return workouts.filter(workout => {
        const workoutDate = new Date(workout.date).getTime();
        return workoutDate >= start && workoutDate <= end;
      });
    } catch (error) {
      console.error('Error getting workouts by date range:', error);
      return [];
    }
  }

  // Nutrition
  async saveNutritionDay(nutritionDay: NutritionDay): Promise<void> {
    try {
      const nutritionDays = await this.getNutritionDays();
      const existingIndex = nutritionDays.findIndex(n => n.id === nutritionDay.id);
      
      if (existingIndex >= 0) {
        nutritionDays[existingIndex] = nutritionDay;
      } else {
        nutritionDays.push(nutritionDay);
      }
      
      await AsyncStorage.setItem(STORAGE_KEYS.NUTRITION, JSON.stringify(nutritionDays));
    } catch (error) {
      console.error('Error saving nutrition day:', error);
      throw error;
    }
  }

  async getNutritionDays(): Promise<NutritionDay[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.NUTRITION);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting nutrition days:', error);
      return [];
    }
  }

  async getNutritionByDateRange(startDate: string, endDate: string): Promise<NutritionDay[]> {
    try {
      const nutritionDays = await this.getNutritionDays();
      const start = new Date(startDate).getTime();
      const end = new Date(endDate).getTime();
      
      return nutritionDays.filter(day => {
        const dayDate = new Date(day.date).getTime();
        return dayDate >= start && dayDate <= end;
      });
    } catch (error) {
      console.error('Error getting nutrition by date range:', error);
      return [];
    }
  }

  // Body Metrics
  async saveBodyMetrics(metrics: BodyMetrics): Promise<void> {
    try {
      const allMetrics = await this.getBodyMetrics();
      const existingIndex = allMetrics.findIndex(m => m.id === metrics.id);
      
      if (existingIndex >= 0) {
        allMetrics[existingIndex] = metrics;
      } else {
        allMetrics.push(metrics);
      }
      
      await AsyncStorage.setItem(STORAGE_KEYS.BODY_METRICS, JSON.stringify(allMetrics));
    } catch (error) {
      console.error('Error saving body metrics:', error);
      throw error;
    }
  }

  async getBodyMetrics(): Promise<BodyMetrics[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.BODY_METRICS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting body metrics:', error);
      return [];
    }
  }

  async getBodyMetricsByDateRange(startDate: string, endDate: string): Promise<BodyMetrics[]> {
    try {
      const metrics = await this.getBodyMetrics();
      const start = new Date(startDate).getTime();
      const end = new Date(endDate).getTime();
      
      return metrics.filter(metric => {
        const metricDate = new Date(metric.date).getTime();
        return metricDate >= start && metricDate <= end;
      });
    } catch (error) {
      console.error('Error getting body metrics by date range:', error);
      return [];
    }
  }

  // User Goals
  async saveUserGoals(goals: UserGoals): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER_GOALS, JSON.stringify(goals));
    } catch (error) {
      console.error('Error saving user goals:', error);
      throw error;
    }
  }

  async getUserGoals(): Promise<UserGoals | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.USER_GOALS);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error getting user goals:', error);
      return null;
    }
  }

  // Data clearing (for testing or user account reset)
  async clearAllData(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.WORKOUTS,
        STORAGE_KEYS.NUTRITION,
        STORAGE_KEYS.BODY_METRICS,
        STORAGE_KEYS.USER_GOALS,
      ]);
    } catch (error) {
      console.error('Error clearing all data:', error);
      throw error;
    }
  }
}

export const dataManager = new DataManager();
