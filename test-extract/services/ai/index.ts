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
import { 
  PydanticMealPlanGenerator, 
  // Import types used in reliableMealPlanGenerator
  type UserDietPreferences, 
  type DayPlan, 
  type DailyMeal, 
  type MealPlan 
} from './pydanticMealPlanGenerator';
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
  generateMealPlan: async (preferences: UserDietPreferences) => {
    const skipApiCalls = await isApiRateLimited();

    const enhancedPreferences: UserDietPreferences = {
      ...preferences,
      requireFullWeek: true,
      requireUniqueMeals: true,
    };

    if (skipApiCalls) {
      console.log("⚠️ [AI] Skipping API calls due to known quota limits, using static fallback directly");
      return pydanticMealPlanGenerator.createStaticFallbackPlan(enhancedPreferences);
    }

    try {
      // --- ATTEMPT 1: Full 7-Day Plan ---
      console.log("🔍 [AI - Reliable] Attempt 1: Full 7-Day Plan via Pydantic Generator");
      const fullPlan = await pydanticMealPlanGenerator.generateMealPlan(enhancedPreferences);
      console.log("✅ [AI - Reliable] Attempt 1: Successfully generated full 7-day plan.");
      return fullPlan;
    } catch (errorAttempt1: any) {
      console.warn("⚠️ [AI - Reliable] Attempt 1 (Full 7-Day Plan) failed:", errorAttempt1.message);
      if (errorAttempt1.message?.includes('API_RATE_LIMITED') || errorAttempt1.message?.includes('429')) {
        await markApiAsRateLimited();
        console.log("⚠️ [AI - Reliable] API Rate Limited. Switching to static fallback.");
        return pydanticMealPlanGenerator.createStaticFallbackPlan(enhancedPreferences);
      } 
    }

    // --- ATTEMPT 2: Day-by-Day Generation ---
    console.log("🔄 [AI - Reliable] Attempt 2: Day-by-Day Generation");
    let dailyGeneratedPlans: DayPlan[] = [];
    let attempt2FailedCompletely = false;

    for (let i = 0; i < 7; i++) {
      try {
        console.log(`  [AI - Reliable] Attempt 2: Generating Day ${i + 1}`);
        const dailyPlan = await pydanticMealPlanGenerator.generateDailyPlan(enhancedPreferences, i, dailyGeneratedPlans);
        dailyGeneratedPlans.push(dailyPlan);
      } catch (errorDailyFull: any) {
        console.warn(`  ⚠️ [AI - Reliable] Attempt 2: Full generation for Day ${i + 1} failed: ${errorDailyFull.message}. Trying meal-by-meal for this day.`);
        try {
          const breakfast = await pydanticMealPlanGenerator.generateSingleMealForDay(enhancedPreferences, i, "Breakfast", []);
          const lunch = await pydanticMealPlanGenerator.generateSingleMealForDay(enhancedPreferences, i, "Lunch", [breakfast].filter(m => m) as DailyMeal[]);
          const dinner = await pydanticMealPlanGenerator.generateSingleMealForDay(enhancedPreferences, i, "Dinner", [breakfast, lunch].filter(m => m) as DailyMeal[]);
          
          const mealsForDay: DailyMeal[] = [breakfast, lunch, dinner].filter(m => m) as DailyMeal[];
          if (mealsForDay.length === enhancedPreferences.mealFrequency) {
             const dayPlanFromMeals: DayPlan = {
                day: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][i],
                meals: mealsForDay,
                dailyNutrition: mealsForDay.reduce((acc, meal) => ({
                    calories: acc.calories + meal.recipe.nutrition.calories,
                    protein: acc.protein + meal.recipe.nutrition.protein,
                    carbs: acc.carbs + meal.recipe.nutrition.carbs,
                    fats: acc.fats + meal.recipe.nutrition.fats,
                }), { calories: 0, protein: 0, carbs: 0, fats: 0 })
            };
            dailyGeneratedPlans.push(pydanticMealPlanGenerator['standardizeMealPlan']({weeklyPlan: [dayPlanFromMeals]}).weeklyPlan[0]);
            console.log(`  ✅ [AI - Reliable] Attempt 2: Successfully generated Day ${i + 1} meal-by-meal.`);
          } else {
            console.error(`  ❌ [AI - Reliable] Attempt 2: Meal-by-meal generation for Day ${i + 1} resulted in incomplete meals.`);
            dailyGeneratedPlans.push(null as any);
          }
        } catch (errorDailyMealByMeal: any) {
          console.error(`  ❌ [AI - Reliable] Attempt 2: Meal-by-meal generation for Day ${i + 1} failed entirely:`, errorDailyMealByMeal.message);
          dailyGeneratedPlans.push(null as any);
        }
      }
    }

    dailyGeneratedPlans = dailyGeneratedPlans.filter(day => day !== null);

    if (dailyGeneratedPlans.length === 7) {
      console.log("✅ [AI - Reliable] Attempt 2: Successfully generated all 7 days day-by-day.");
      const assembledPlanAttempt2: Partial<MealPlan> = { weeklyPlan: dailyGeneratedPlans };
      try {
        return await pydanticMealPlanGenerator.repairAndEnrichPlan(assembledPlanAttempt2, enhancedPreferences);
      } catch (repairError) {
        console.warn("⚠️ [AI - Reliable] Attempt 2: Repair/Assembly failed after day-by-day generation:", repairError);
      }
    } else {
      console.warn(`⚠️ [AI - Reliable] Attempt 2: Day-by-Day generation resulted in ${dailyGeneratedPlans.length}/7 days.`);
    }

    // --- ATTEMPT 3: Meal-Type by Meal-Type Generation ---
    console.log("🔄 [AI - Reliable] Attempt 3: Meal-Type by Meal-Type Generation");
    try {
      const breakfasts = await pydanticMealPlanGenerator.generateAllMealsOfTypeForWeek(enhancedPreferences, "Breakfast", dailyGeneratedPlans.map(d => d ? d.meals.filter((m: DailyMeal)=>m.meal==="Breakfast") : []));
      const lunches = await pydanticMealPlanGenerator.generateAllMealsOfTypeForWeek(enhancedPreferences, "Lunch", dailyGeneratedPlans.map(d => d ? d.meals.filter((m: DailyMeal)=>m.meal==="Lunch") : []));
      const dinners = await pydanticMealPlanGenerator.generateAllMealsOfTypeForWeek(enhancedPreferences, "Dinner", dailyGeneratedPlans.map(d => d ? d.meals.filter((m: DailyMeal)=>m.meal==="Dinner") : []));

      if (breakfasts.length === 7 && lunches.length === 7 && dinners.length === 7) {
        const weeklyPlanAttempt3: DayPlan[] = [];
        const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
        for (let i = 0; i < 7; i++) {
          const mealsForDay: DailyMeal[] = [breakfasts[i], lunches[i], dinners[i]].filter(m => m) as DailyMeal[];
          if (mealsForDay.length === enhancedPreferences.mealFrequency) {
            const dayPlan: DayPlan = {
              day: daysOfWeek[i],
              meals: mealsForDay,
              dailyNutrition: mealsForDay.reduce((acc, meal) => ({
                calories: acc.calories + meal.recipe.nutrition.calories,
                protein: acc.protein + meal.recipe.nutrition.protein,
                carbs: acc.carbs + meal.recipe.nutrition.carbs,
                fats: acc.fats + meal.recipe.nutrition.fats,
              }), { calories: 0, protein: 0, carbs: 0, fats: 0 })
            };
            weeklyPlanAttempt3.push(pydanticMealPlanGenerator['standardizeMealPlan']({weeklyPlan: [dayPlan]}).weeklyPlan[0]);
          } else {
            console.warn(`  ⚠️ [AI - Reliable] Attempt 3: Day ${daysOfWeek[i]} has incomplete meals after meal-type generation.`);
            weeklyPlanAttempt3.push(null as any);
          }
        }
        
        const validDaysAttempt3 = weeklyPlanAttempt3.filter(d => d !== null);
        if (validDaysAttempt3.length > 0) {
            console.log(`✅ [AI - Reliable] Attempt 3: Successfully generated ${validDaysAttempt3.length}/7 days via Meal-Type by Meal-Type.`);
            const assembledPlanAttempt3: Partial<MealPlan> = { weeklyPlan: validDaysAttempt3 };
            return await pydanticMealPlanGenerator.repairAndEnrichPlan(assembledPlanAttempt3, enhancedPreferences);
        }
      }
      console.warn("⚠️ [AI - Reliable] Attempt 3 (Meal-Type by Meal-Type) did not yield a complete plan.");
    } catch (errorAttempt3: any) {
      console.error("❌ [AI - Reliable] Attempt 3 (Meal-Type by Meal-Type) failed:", errorAttempt3.message);
    }

    // --- ATTEMPT 4: Final LLM-Based Repair / Static Fallback ---
    console.log("🔄 [AI - Reliable] Attempt 4: Final LLM-Based Repair or Static Fallback");
    const planToRepair: Partial<MealPlan> = { weeklyPlan: dailyGeneratedPlans.length > 0 ? dailyGeneratedPlans : [] };

    try {
      console.log("  [AI - Reliable] Attempting LLM-based repair on potentially incomplete plan.");
      const repairedPlan = await pydanticMealPlanGenerator.repairAndEnrichPlan(planToRepair, enhancedPreferences);
      console.log("✅ [AI - Reliable] Attempt 4: LLM-based repair finished.");
      return repairedPlan;
    } catch (errorAttempt4: any) {
      console.error("❌ [AI - Reliable] Attempt 4 (Final LLM Repair) failed:", errorAttempt4.message);
      console.log("⚠️ [AI - Reliable] All LLM-based generation attempts failed. Using static fallback plan.");
      return pydanticMealPlanGenerator.createStaticFallbackPlan(enhancedPreferences);
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