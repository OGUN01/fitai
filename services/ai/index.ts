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
import { pydanticWorkoutGenerator } from './pydanticWorkoutGenerator';
import { StructuredWorkoutGenerator } from './structuredWorkoutGenerator';
import { PydanticMealPlanGenerator } from './pydanticMealPlanGenerator';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Check if API is rate limited
const isApiRateLimited = async (): Promise<boolean> => {
  try {
    const skipApiCalls = await AsyncStorage.getItem('skipApiCalls');
    return skipApiCalls === 'true';
  } catch (error) {
    console.error("Error checking API rate limit status:", error);
    return false;
  }
};

// Mark API as rate limited
const markApiAsRateLimited = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem('skipApiCalls', 'true');
    await AsyncStorage.setItem('skipApiCallsTimestamp', Date.now().toString());
    await AsyncStorage.setItem('meal_plan_rate_limited', 'true');
    await AsyncStorage.setItem('meal_plan_rate_limit_timestamp', Date.now().toString());
    console.log("⚠️ [AI] API rate limits detected, enabling skip mode for future requests");
  } catch (error) {
    console.error("Error marking API as rate limited:", error);
  }
};

// Create singleton instances
const workoutGenerator = new WorkoutGenerator();
const mealPlanGenerator = new MealPlanGenerator();
const bodyAnalysisService = new BodyAnalysisService();
const progressAnalysisService = new ProgressAnalysisService();
const structuredWorkoutGenerator = new StructuredWorkoutGenerator();
const pydanticMealPlanGenerator = new PydanticMealPlanGenerator();

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

/**
 * Reliable workout plan generator with multiple validation strategies
 * 
 * This combines both the Pydantic and Structured generators, trying them
 * in sequence and falling back as needed to ensure 100% success rate
 */
const reliableWorkoutGenerator = {
  generateWorkoutPlan: async (preferences: any) => {
    // Check if we should skip API calls entirely (useful when we know API quota is exceeded)
    const skipApiCalls = await isApiRateLimited();
    
    if (skipApiCalls) {
      console.log("⚠️ [AI] Skipping API calls due to known quota limits, using fallback directly");
      return pydanticWorkoutGenerator.createFallbackPlan(preferences);
    }
    
    try {
      // First try the Pydantic approach (strongest schema validation)
      console.log("🔍 [AI] Trying Pydantic workout generator");
      return await pydanticWorkoutGenerator.generateWorkoutPlan(preferences);
    } catch (pydanticError: any) {
      console.error("❌ [AI] Pydantic workout generator failed:", pydanticError);
      
      // Check if this was a rate limit error
      const errorMessage = pydanticError?.message || '';
      const isRateLimit = errorMessage.includes('429') || 
                          errorMessage.includes('Resource has been exhausted') || 
                          errorMessage.includes('Too Many Requests');
      
      if (isRateLimit) {
        await markApiAsRateLimited();
      }
      
      try {
        // Then try the Structured approach
        console.log("🔄 [AI] Falling back to Structured workout generator");
        return await structuredWorkoutGenerator.generateWorkoutPlanWithFallback(preferences);
      } catch (structuredError) {
        console.error("❌ [AI] Structured workout generator failed:", structuredError);
        
        // Last resort: classic generator with fallbacks
        console.log("⚠️ [AI] Falling back to classic workout generator with fallbacks");
        return await enhancedWorkoutGenerator.generateWorkoutPlanSafe(preferences);
      }
    }
  }
};

/**
 * Reliable meal plan generator with multiple validation strategies
 * 
 * This combines both the Pydantic and traditional generators, trying them
 * in sequence and falling back as needed to ensure 100% success rate
 */
const reliableMealPlanGenerator = {
  generateMealPlan: async (preferences: any) => {
    // Check if we should skip API calls entirely (useful when we know API quota is exceeded)
    const skipApiCalls = await isApiRateLimited();
    
    // Ensure we're requesting complete 7-day plans with unique meals
    const enhancedPreferences = {
      ...preferences,
      requireFullWeek: true,
      requireUniqueMeals: true
    };
    
    if (skipApiCalls) {
      console.log("⚠️ [AI] Skipping API calls due to known quota limits, using fallback directly");
      return pydanticMealPlanGenerator.generateMealPlan(enhancedPreferences);
    }
    
    try {
      // First try the Pydantic approach (strongest schema validation)
      console.log("🔍 [AI] Trying Pydantic meal plan generator");
      return await pydanticMealPlanGenerator.generateMealPlan(enhancedPreferences);
    } catch (pydanticError: any) {
      console.error("❌ [AI] Pydantic meal plan generator failed:", pydanticError);
      
      // Check if this was a rate limit error
      const errorMessage = pydanticError?.message || '';
      const isRateLimit = errorMessage.includes('429') || 
                          errorMessage.includes('Resource has been exhausted') || 
                          errorMessage.includes('Too Many Requests');
      
      if (isRateLimit) {
        await markApiAsRateLimited();
      }
      
      // Last resort: classic generator with fallbacks
      console.log("⚠️ [AI] Falling back to classic meal plan generator with fallbacks");
      // Pass the same enhanced preferences to fallback generators
      return await enhancedMealPlanGenerator.generateMealPlanSafe(enhancedPreferences);
    }
  }
};

// Export services for use throughout the app
export {
  workoutGenerator,
  mealPlanGenerator,
  enhancedWorkoutGenerator,
  enhancedMealPlanGenerator,
  bodyAnalysisService,
  progressAnalysisService,
  promptManager,
  pydanticWorkoutGenerator,
  pydanticMealPlanGenerator,
  structuredWorkoutGenerator,
  reliableWorkoutGenerator,
  reliableMealPlanGenerator
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