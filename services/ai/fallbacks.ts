/**
 * Fallback Mechanisms
 * 
 * This file serves as the main entry point for all fallback mechanisms,
 * combining workout and meal plan fallbacks into a unified interface.
 */

import { UserFitnessPreferences, WorkoutPlan, FallbackWorkoutPlan } from './workoutGenerator';
import { UserDietPreferences, MealPlan, FallbackMealPlan } from './mealPlanGenerator';
import { attemptEnhancedMealFallbacks } from './mealPlanFallbacks';

/**
 * Multi-level fallback system for workout plan generation
 */
export async function generateWorkoutPlanWithFallbacks(
  preferences: UserFitnessPreferences,
  originalGenerator: (prefs: UserFitnessPreferences) => Promise<WorkoutPlan | FallbackWorkoutPlan>
): Promise<WorkoutPlan | FallbackWorkoutPlan> {
  try {
    // Try the current implementation first
    const workoutPlan = await originalGenerator(preferences);
    
    // If it's already a fallback plan, try our enhanced fallbacks
    if ('isFallback' in workoutPlan) {
      console.log("Primary workout generation resulted in a fallback plan. Trying enhanced fallbacks.");
      return await attemptEnhancedWorkoutFallbacks(preferences);
    }
    
    // If we got a valid plan, return it
    return workoutPlan;
    
  } catch (error) {
    // If primary implementation throws an error, log and use enhanced fallbacks
    console.error("Error in primary workout plan generation:", error);
    return await attemptEnhancedWorkoutFallbacks(preferences);
  }
}

/**
 * Multi-level fallback system for meal plan generation
 */
export async function generateMealPlanWithFallbacks(
  preferences: UserDietPreferences,
  originalGenerator: (prefs: UserDietPreferences) => Promise<MealPlan | FallbackMealPlan>
): Promise<MealPlan | FallbackMealPlan> {
  try {
    // Try the current implementation first
    const mealPlan = await originalGenerator(preferences);
    
    // If it's already a fallback plan, try our enhanced fallbacks
    if ('isFallback' in mealPlan) {
      console.log("Primary meal generation resulted in a fallback plan. Trying enhanced fallbacks.");
      return await attemptEnhancedMealFallbacks(preferences);
    }
    
    // If we got a valid plan, return it
    return mealPlan;
    
  } catch (error) {
    // If primary implementation throws an error, log and use enhanced fallbacks
    console.error("Error in primary meal plan generation:", error);
    return await attemptEnhancedMealFallbacks(preferences);
  }
}

// Import from a different file to avoid circular dependencies
async function attemptEnhancedWorkoutFallbacks(preferences: UserFitnessPreferences): Promise<WorkoutPlan | FallbackWorkoutPlan> {
  // This is a placeholder that uses the existing fallback in WorkoutGenerator
  // In a full implementation, we would import from the advancedFallbacks.ts file
  const fallbackPlan: FallbackWorkoutPlan = {
    weeklySchedule: [],
    warmUp: [
      "Light jogging or marching in place for 3-5 minutes",
      "Arm circles (10 forward, 10 backward)",
      "Hip rotations (10 each direction)",
      "Bodyweight squats (10 reps)",
      "Push-ups or modified push-ups (5-10 reps)"
    ],
    coolDown: [
      "Walking in place for 2-3 minutes",
      "Quad stretch (30 seconds each leg)",
      "Hamstring stretch (30 seconds each leg)",
      "Chest and shoulder stretch (30 seconds each side)",
      "Deep breathing exercises (5 deep breaths)"
    ],
    isFallback: true,
    message: `We couldn't generate a custom workout plan. Here's a basic plan instead.`
  };
  
  // Generate some basic workout days
  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const focusAreas = preferences.focusAreas.length > 0 ? preferences.focusAreas : ['full-body'];
  
  for (let i = 0; i < preferences.exerciseFrequency; i++) {
    const day = daysOfWeek[i];
    const focus = focusAreas[i % focusAreas.length];
    
    // Add a basic exercise for this day
    fallbackPlan.weeklySchedule.push({
      day: day,
      focus: focus,
      exercises: [
        {
          name: "Bodyweight Exercise",
          sets: 3,
          reps: 10,
          restSeconds: 60,
          notes: "Modify as needed based on fitness level"
        }
      ]
    });
  }
  
  return fallbackPlan;
} 