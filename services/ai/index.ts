/**
 * AI Services Export
 * 
 * Central export point for all AI-related services
 */

import { WorkoutGenerator } from './workoutGenerator';
import { MealPlanGenerator } from './mealPlanGenerator';
import { BodyAnalysisService } from './bodyAnalysis';
import { ProgressAnalysisService } from './progressAnalysis';
import { promptManager } from './promptManager';
import { generateWorkoutPlanWithFallbacks, generateMealPlanWithFallbacks } from './fallbacks';

// Create singleton instances
const workoutGenerator = new WorkoutGenerator();
const mealPlanGenerator = new MealPlanGenerator();
const bodyAnalysisService = new BodyAnalysisService();
const progressAnalysisService = new ProgressAnalysisService();

// Enhanced generators with fallbacks
const enhancedWorkoutGenerator = {
  ...workoutGenerator,
  generateWorkoutPlanSafe: (preferences: any) => 
    generateWorkoutPlanWithFallbacks(preferences, workoutGenerator.generateWorkoutPlan.bind(workoutGenerator))
};

const enhancedMealPlanGenerator = {
  ...mealPlanGenerator,
  generateMealPlanSafe: (preferences: any) => 
    generateMealPlanWithFallbacks(preferences, mealPlanGenerator.generateMealPlan.bind(mealPlanGenerator))
};

// Export services for use throughout the app
export {
  workoutGenerator,
  mealPlanGenerator,
  enhancedWorkoutGenerator,
  enhancedMealPlanGenerator,
  bodyAnalysisService,
  progressAnalysisService,
  promptManager
};

// Re-export types
export type { 
  UserFitnessPreferences, 
  WorkoutPlan, 
  WorkoutDay, 
  WorkoutExercise,
  FallbackWorkoutPlan
} from './workoutGenerator';

export type {
  UserDietPreferences,
  MealPlan,
  DailyPlan,
  DailyMeal,
  MealRecipe,
  MealIngredient,
  MealNutrition,
  ShoppingListCategory,
  FallbackMealPlan
} from './mealPlanGenerator';

export type {
  BodyPhoto,
  UserPhysicalDetails,
  BodyProportions,
  PostureAnalysis,
  BodyAnalysisResult,
  FallbackBodyAnalysis
} from './bodyAnalysis';

export type {
  UserProgressData,
  ProgressStrength,
  ProgressRecommendation,
  ProgressProjection,
  ProgressAnalysisResult,
  FallbackProgressAnalysis
} from './progressAnalysis'; 