/**
 * Parameter Validation Utility
 * 
 * This utility helps validate that ALL onboarding parameters are being
 * properly passed to AI generation systems.
 */

import { UserProfile } from '../types/profile';

export interface WorkoutParameterCheck {
  fitnessLevel: boolean;
  exerciseFrequency: boolean;
  timePerSession: boolean;
  workoutLocation: boolean;
  availableEquipment: boolean;
  focusAreas: boolean;
  exercisesToAvoid: boolean;
  age: boolean;
  gender: boolean;
  weight: boolean;
  height: boolean;
  // MISSING CRITICAL PARAMETERS - NOW CHECKED:
  country_region: boolean;
  activityLevel: boolean;
  weightGoal: boolean;
  preferredWorkoutDays: boolean;
  currentWeight: boolean;
  targetWeight: boolean;
  bodyFatPercentage: boolean;
}

export interface MealParameterCheck {
  dietType: boolean;
  restrictions: boolean;
  allergies: boolean;
  excludedFoods: boolean;
  favoriteFoods: boolean;
  mealFrequency: boolean;
  countryRegion: boolean;
  fitnessGoal: boolean;
  calorieTarget: boolean;
  age: boolean;
  gender: boolean;
  weight: boolean;
  height: boolean;
  // MISSING CRITICAL PARAMETERS - NOW CHECKED:
  preferredMealTimes: boolean;
  waterIntakeGoal: boolean;
  activityLevel: boolean;
  weightGoal: boolean;
  currentWeight: boolean;
  targetWeight: boolean;
  bodyFatPercentage: boolean;
}

/**
 * Validates that all workout parameters are being extracted from profile
 */
export function validateWorkoutParameters(profile: UserProfile | null): {
  isValid: boolean;
  missingParameters: string[];
  parameterCheck: WorkoutParameterCheck;
} {
  if (!profile) {
    return {
      isValid: false,
      missingParameters: ['Profile is null'],
      parameterCheck: {} as WorkoutParameterCheck
    };
  }

  const parameterCheck: WorkoutParameterCheck = {
    fitnessLevel: !!profile.fitness_level,
    exerciseFrequency: !!profile.workout_days_per_week,
    timePerSession: !!profile.workout_duration_minutes,
    workoutLocation: !!profile.workout_preferences?.workout_location,
    availableEquipment: !!(profile.workout_preferences?.equipment?.length),
    focusAreas: !!(profile.fitness_goals?.length),
    exercisesToAvoid: !!profile.workout_preferences?.exercises_to_avoid,
    age: !!profile.age,
    gender: !!profile.gender,
    weight: !!profile.weight_kg,
    height: !!profile.height_cm,
    // MISSING CRITICAL PARAMETERS - NOW CHECKED:
    country_region: !!(profile.country_region || profile.diet_preferences?.country_region),
    activityLevel: !!profile.activity_level,
    weightGoal: !!profile.weight_goal,
    preferredWorkoutDays: !!(profile.workout_preferences?.preferred_days?.length),
    currentWeight: !!profile.weight_kg,
    targetWeight: !!profile.target_weight_kg,
    bodyFatPercentage: !!(profile.body_analysis?.body_fat_percentage || profile.body_fat_percentage)
  };

  const missingParameters = Object.entries(parameterCheck)
    .filter(([_, hasValue]) => !hasValue)
    .map(([key, _]) => key);

  return {
    isValid: missingParameters.length === 0,
    missingParameters,
    parameterCheck
  };
}

/**
 * Validates that all meal parameters are being extracted from profile
 */
export function validateMealParameters(profile: UserProfile | null): {
  isValid: boolean;
  missingParameters: string[];
  parameterCheck: MealParameterCheck;
} {
  if (!profile) {
    return {
      isValid: false,
      missingParameters: ['Profile is null'],
      parameterCheck: {} as MealParameterCheck
    };
  }

  const parameterCheck: MealParameterCheck = {
    dietType: !!profile.diet_preferences?.diet_type,
    restrictions: !!(profile.diet_preferences?.dietary_restrictions?.length),
    allergies: !!(profile.diet_preferences?.allergies?.length),
    excludedFoods: !!(profile.diet_preferences?.excluded_foods?.length),
    favoriteFoods: !!(profile.diet_preferences?.favorite_foods?.length),
    mealFrequency: !!profile.diet_preferences?.meal_frequency,
    countryRegion: !!(profile.diet_preferences?.country_region || profile.country_region),
    fitnessGoal: !!(profile.fitness_goals?.length),
    calorieTarget: true, // This is calculated, so always available
    age: !!profile.age,
    gender: !!profile.gender,
    weight: !!profile.weight_kg,
    height: !!profile.height_cm,
    // MISSING CRITICAL PARAMETERS - NOW CHECKED:
    preferredMealTimes: !!(profile.meal_times?.length || profile.diet_preferences?.meal_times?.length),
    waterIntakeGoal: !!(profile.diet_preferences?.water_intake_goal || profile.water_intake_goal),
    activityLevel: !!profile.activity_level,
    weightGoal: !!profile.weight_goal,
    currentWeight: !!profile.weight_kg,
    targetWeight: !!profile.target_weight_kg,
    bodyFatPercentage: !!(profile.body_analysis?.body_fat_percentage || profile.body_fat_percentage)
  };

  const missingParameters = Object.entries(parameterCheck)
    .filter(([_, hasValue]) => !hasValue)
    .map(([key, _]) => key);

  return {
    isValid: missingParameters.length === 0,
    missingParameters,
    parameterCheck
  };
}

/**
 * Logs detailed parameter validation results
 */
export function logParameterValidation(profile: UserProfile | null) {
  console.log('🔍 PARAMETER VALIDATION REPORT');
  console.log('================================');
  
  const workoutValidation = validateWorkoutParameters(profile);
  const mealValidation = validateMealParameters(profile);
  
  console.log('📋 WORKOUT PARAMETERS:');
  console.log(`✅ Valid: ${workoutValidation.isValid}`);
  if (!workoutValidation.isValid) {
    console.log(`❌ Missing: ${workoutValidation.missingParameters.join(', ')}`);
  }
  console.log('Details:', workoutValidation.parameterCheck);
  
  console.log('\n🍽️ MEAL PARAMETERS:');
  console.log(`✅ Valid: ${mealValidation.isValid}`);
  if (!mealValidation.isValid) {
    console.log(`❌ Missing: ${mealValidation.missingParameters.join(', ')}`);
  }
  console.log('Details:', mealValidation.parameterCheck);
  
  console.log('\n📊 OVERALL SUMMARY:');
  console.log(`Workout Parameters: ${Object.values(workoutValidation.parameterCheck).filter(Boolean).length}/${Object.keys(workoutValidation.parameterCheck).length} present`);
  console.log(`Meal Parameters: ${Object.values(mealValidation.parameterCheck).filter(Boolean).length}/${Object.keys(mealValidation.parameterCheck).length} present`);
  
  return {
    workout: workoutValidation,
    meal: mealValidation
  };
}
