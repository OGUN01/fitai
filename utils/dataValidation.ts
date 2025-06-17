/**
 * Data Validation Utilities for FitAI
 * 
 * This module provides comprehensive validation functions to ensure data integrity
 * during sync operations and prevent invalid data from being stored in the database.
 */

import { format } from 'date-fns';

export interface WorkoutCompletion {
  id?: string;
  user_id: string;
  workout_date: string;
  workout_day_name: string;
  day_number?: number;
  workout_plan_id?: string;
  completed_at: string;
  estimated_calories_burned?: number;
}

export interface MealCompletion {
  id?: string;
  user_id: string;
  meal_date: string;
  meal_type: string;
  meal_plan_id?: string;
  completed_at: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates a workout completion record
 */
export function validateWorkoutCompletion(workout: any): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: []
  };

  // Required field validation
  if (!workout.user_id) {
    result.errors.push('Missing user_id');
    result.isValid = false;
  }

  // Check for 'local_user' - these should have been converted to real user ID before validation
  if (workout.user_id === 'local_user') {
    result.errors.push('local_user records should be converted to authenticated user_id before sync');
    result.isValid = false;
  }

  // Validate user_id format (should be UUID)
  if (workout.user_id && workout.user_id !== 'local_user') {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(workout.user_id)) {
      result.errors.push(`Invalid user_id format: ${workout.user_id} (must be UUID)`);
      result.isValid = false;
    }
  }

  if (!workout.workout_date) {
    result.errors.push('Missing workout_date');
    result.isValid = false;
  }

  if (!workout.workout_day_name) {
    result.errors.push('Missing workout_day_name');
    result.isValid = false;
  }

  if (!workout.completed_at) {
    result.errors.push('Missing completed_at timestamp');
    result.isValid = false;
  }

  // Date validation
  if (workout.workout_date) {
    const dateValidation = validateDate(workout.workout_date, 'workout_date');
    if (!dateValidation.isValid) {
      result.errors.push(...dateValidation.errors);
      result.warnings.push(...dateValidation.warnings);
      result.isValid = false;
    }
  }

  // Day name validation
  if (workout.workout_day_name) {
    const validDayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    if (!validDayNames.includes(workout.workout_day_name)) {
      result.warnings.push(`Unusual workout_day_name: ${workout.workout_day_name}`);
    }
  }

  // Timestamp validation
  if (workout.completed_at) {
    try {
      const completedDate = new Date(workout.completed_at);
      if (isNaN(completedDate.getTime())) {
        result.errors.push('Invalid completed_at timestamp format');
        result.isValid = false;
      }
    } catch (error) {
      result.errors.push('Invalid completed_at timestamp');
      result.isValid = false;
    }
  }

  return result;
}

/**
 * Validates a meal completion record
 */
export function validateMealCompletion(meal: any): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: []
  };

  // Required field validation
  if (!meal.user_id) {
    result.errors.push('Missing user_id');
    result.isValid = false;
  }

  // Check for 'local_user' - these should have been converted to real user ID before validation
  if (meal.user_id === 'local_user') {
    result.errors.push('local_user records should be converted to authenticated user_id before sync');
    result.isValid = false;
  }

  // Validate user_id format (should be UUID)
  if (meal.user_id && meal.user_id !== 'local_user') {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(meal.user_id)) {
      result.errors.push(`Invalid user_id format: ${meal.user_id} (must be UUID)`);
      result.isValid = false;
    }
  }

  if (!meal.meal_date) {
    result.errors.push('Missing meal_date');
    result.isValid = false;
  }

  if (!meal.meal_type) {
    result.errors.push('Missing meal_type');
    result.isValid = false;
  }

  if (!meal.completed_at) {
    result.errors.push('Missing completed_at timestamp');
    result.isValid = false;
  }

  // Date validation
  if (meal.meal_date) {
    const dateValidation = validateDate(meal.meal_date, 'meal_date');
    if (!dateValidation.isValid) {
      result.errors.push(...dateValidation.errors);
      result.warnings.push(...dateValidation.warnings);
      result.isValid = false;
    }
  }

  // Meal type validation
  if (meal.meal_type) {
    const validMealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];
    if (!validMealTypes.includes(meal.meal_type.toLowerCase())) {
      result.errors.push(`Invalid meal_type: ${meal.meal_type}. Must be one of: ${validMealTypes.join(', ')}`);
      result.isValid = false;
    }
  }

  // Timestamp validation
  if (meal.completed_at) {
    try {
      const completedDate = new Date(meal.completed_at);
      if (isNaN(completedDate.getTime())) {
        result.errors.push('Invalid completed_at timestamp format');
        result.isValid = false;
      }
    } catch (error) {
      result.errors.push('Invalid completed_at timestamp');
      result.isValid = false;
    }
  }

  return result;
}

/**
 * Validates a date string and checks if it's within acceptable range
 */
export function validateDate(dateString: string, fieldName: string = 'date'): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: []
  };

  try {
    // Parse the date
    const date = new Date(dateString + 'T00:00:00');
    
    if (isNaN(date.getTime())) {
      result.errors.push(`Invalid ${fieldName} format: ${dateString}`);
      result.isValid = false;
      return result;
    }

    const today = new Date();
    const todayString = format(today, 'yyyy-MM-dd');
    
    // Check if date is in the future
    if (date > today) {
      result.errors.push(`${fieldName} cannot be in the future: ${dateString} (today: ${todayString})`);
      result.isValid = false;
    }

    // Check if date is too far in the past (more than 1 year)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    if (date < oneYearAgo) {
      result.warnings.push(`${fieldName} is more than 1 year old: ${dateString}`);
    }

    // Check if date is too far in the past (more than 2 years - error)
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    
    if (date < twoYearsAgo) {
      result.errors.push(`${fieldName} is too old (more than 2 years): ${dateString}`);
      result.isValid = false;
    }

  } catch (error) {
    result.errors.push(`Error parsing ${fieldName}: ${dateString}`);
    result.isValid = false;
  }

  return result;
}

/**
 * Filters an array of workout completions to only include valid records
 */
export function filterValidWorkoutCompletions(workouts: any[]): WorkoutCompletion[] {
  const validWorkouts: WorkoutCompletion[] = [];
  const invalidCount = { total: 0, futureDate: 0, missingFields: 0, invalidFormat: 0 };

  workouts.forEach((workout, index) => {
    const validation = validateWorkoutCompletion(workout);
    
    if (validation.isValid) {
      validWorkouts.push(workout as WorkoutCompletion);
    } else {
      invalidCount.total++;
      
      // Categorize the type of error
      if (validation.errors.some(e => e.includes('future'))) {
        invalidCount.futureDate++;
      } else if (validation.errors.some(e => e.includes('Missing'))) {
        invalidCount.missingFields++;
      } else {
        invalidCount.invalidFormat++;
      }
      
      console.warn(`Filtered out invalid workout completion at index ${index}:`, {
        workout,
        errors: validation.errors,
        warnings: validation.warnings
      });
    }
  });

  if (invalidCount.total > 0) {
    console.log(`Workout completion filtering summary:`, {
      total: workouts.length,
      valid: validWorkouts.length,
      invalid: invalidCount.total,
      breakdown: invalidCount
    });
  }

  return validWorkouts;
}

/**
 * Filters an array of meal completions to only include valid records
 */
export function filterValidMealCompletions(meals: any[]): MealCompletion[] {
  const validMeals: MealCompletion[] = [];
  const invalidCount = { total: 0, futureDate: 0, missingFields: 0, invalidFormat: 0 };

  meals.forEach((meal, index) => {
    const validation = validateMealCompletion(meal);
    
    if (validation.isValid) {
      validMeals.push(meal as MealCompletion);
    } else {
      invalidCount.total++;
      
      // Categorize the type of error
      if (validation.errors.some(e => e.includes('future'))) {
        invalidCount.futureDate++;
      } else if (validation.errors.some(e => e.includes('Missing'))) {
        invalidCount.missingFields++;
      } else {
        invalidCount.invalidFormat++;
      }
      
      console.warn(`Filtered out invalid meal completion at index ${index}:`, {
        meal,
        errors: validation.errors,
        warnings: validation.warnings
      });
    }
  });

  if (invalidCount.total > 0) {
    console.log(`Meal completion filtering summary:`, {
      total: meals.length,
      valid: validMeals.length,
      invalid: invalidCount.total,
      breakdown: invalidCount
    });
  }

  return validMeals;
}

/**
 * Validates and cleans completion data before sync
 */
export function validateAndCleanSyncData(data: {
  workouts: any[];
  meals: any[];
}): {
  workouts: WorkoutCompletion[];
  meals: MealCompletion[];
  summary: {
    workouts: { total: number; valid: number; filtered: number };
    meals: { total: number; valid: number; filtered: number };
  };
} {
  const validWorkouts = filterValidWorkoutCompletions(data.workouts);
  const validMeals = filterValidMealCompletions(data.meals);

  return {
    workouts: validWorkouts,
    meals: validMeals,
    summary: {
      workouts: {
        total: data.workouts.length,
        valid: validWorkouts.length,
        filtered: data.workouts.length - validWorkouts.length
      },
      meals: {
        total: data.meals.length,
        valid: validMeals.length,
        filtered: data.meals.length - validMeals.length
      }
    }
  };
}
