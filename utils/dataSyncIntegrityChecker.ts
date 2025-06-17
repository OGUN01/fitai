/**
 * Data Sync Integrity Checker for FitAI
 * 
 * This module provides tools to check and clean local storage data before sync
 * to prevent invalid data from being synced to the database.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';
import { validateAndCleanSyncData, ValidationResult } from './dataValidation';

export interface IntegrityCheckResult {
  isValid: boolean;
  summary: {
    workouts: {
      total: number;
      valid: number;
      invalid: number;
      futureDate: number;
      missingFields: number;
    };
    meals: {
      total: number;
      valid: number;
      invalid: number;
      futureDate: number;
      missingFields: number;
    };
  };
  issues: string[];
  recommendations: string[];
}

/**
 * Performs a comprehensive integrity check on local storage data
 */
export async function performDataIntegrityCheck(): Promise<IntegrityCheckResult> {
  const result: IntegrityCheckResult = {
    isValid: true,
    summary: {
      workouts: { total: 0, valid: 0, invalid: 0, futureDate: 0, missingFields: 0 },
      meals: { total: 0, valid: 0, invalid: 0, futureDate: 0, missingFields: 0 }
    },
    issues: [],
    recommendations: []
  };

  try {
    // Check workout completions
    const workoutKeys = ['local_workout_completions', 'completed_workouts'];
    let allWorkouts: any[] = [];

    for (const key of workoutKeys) {
      try {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed)) {
            allWorkouts.push(...parsed);
          }
        }
      } catch (error) {
        result.issues.push(`Error reading ${key}: ${error}`);
      }
    }

    // Check meal completions
    const mealKeys = ['local_meal_completions', 'meals'];
    let allMeals: any[] = [];

    for (const key of mealKeys) {
      try {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed)) {
            allMeals.push(...parsed);
          }
        }
      } catch (error) {
        result.issues.push(`Error reading ${key}: ${error}`);
      }
    }

    // Validate and clean the data
    const cleanedData = validateAndCleanSyncData({
      workouts: allWorkouts,
      meals: allMeals
    });

    // Update summary
    result.summary.workouts = {
      total: cleanedData.summary.workouts.total,
      valid: cleanedData.summary.workouts.valid,
      invalid: cleanedData.summary.workouts.filtered,
      futureDate: 0, // Will be calculated below
      missingFields: 0
    };

    result.summary.meals = {
      total: cleanedData.summary.meals.total,
      valid: cleanedData.summary.meals.valid,
      invalid: cleanedData.summary.meals.filtered,
      futureDate: 0, // Will be calculated below
      missingFields: 0
    };

    // Analyze specific issues
    const today = new Date();
    const todayString = format(today, 'yyyy-MM-dd');

    // Check for future dates in workouts
    allWorkouts.forEach(workout => {
      if (workout.workout_date) {
        const workoutDate = new Date(workout.workout_date + 'T00:00:00');
        if (workoutDate > today) {
          result.summary.workouts.futureDate++;
          result.issues.push(`Future workout completion found: ${workout.workout_date}`);
        }
      } else {
        result.summary.workouts.missingFields++;
      }
    });

    // Check for future dates in meals
    allMeals.forEach(meal => {
      if (meal.meal_date) {
        const mealDate = new Date(meal.meal_date + 'T00:00:00');
        if (mealDate > today) {
          result.summary.meals.futureDate++;
          result.issues.push(`Future meal completion found: ${meal.meal_date} (${meal.meal_type})`);
        }
      } else {
        result.summary.meals.missingFields++;
      }
    });

    // Determine overall validity
    result.isValid = result.issues.length === 0 && 
                     result.summary.workouts.invalid === 0 && 
                     result.summary.meals.invalid === 0;

    // Generate recommendations
    if (result.summary.workouts.futureDate > 0) {
      result.recommendations.push(`Remove ${result.summary.workouts.futureDate} future workout completion(s)`);
    }

    if (result.summary.meals.futureDate > 0) {
      result.recommendations.push(`Remove ${result.summary.meals.futureDate} future meal completion(s)`);
    }

    if (result.summary.workouts.missingFields > 0) {
      result.recommendations.push(`Fix ${result.summary.workouts.missingFields} workout(s) with missing required fields`);
    }

    if (result.summary.meals.missingFields > 0) {
      result.recommendations.push(`Fix ${result.summary.meals.missingFields} meal(s) with missing required fields`);
    }

    if (result.isValid) {
      result.recommendations.push('Data integrity check passed - safe to sync');
    }

  } catch (error) {
    result.isValid = false;
    result.issues.push(`Critical error during integrity check: ${error}`);
    result.recommendations.push('Manual data cleanup required before sync');
  }

  return result;
}

/**
 * Cleans invalid data from local storage
 */
export async function cleanInvalidLocalData(): Promise<{
  success: boolean;
  cleaned: {
    workouts: number;
    meals: number;
  };
  errors: string[];
}> {
  const result = {
    success: true,
    cleaned: { workouts: 0, meals: 0 },
    errors: []
  };

  try {
    // Clean workout completions
    const workoutKeys = ['local_workout_completions', 'completed_workouts'];
    
    for (const key of workoutKeys) {
      try {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed)) {
            const cleanedData = validateAndCleanSyncData({ workouts: parsed, meals: [] });
            const originalCount = parsed.length;
            const cleanedCount = cleanedData.workouts.length;
            
            if (cleanedCount < originalCount) {
              await AsyncStorage.setItem(key, JSON.stringify(cleanedData.workouts));
              result.cleaned.workouts += (originalCount - cleanedCount);
              console.log(`Cleaned ${originalCount - cleanedCount} invalid workouts from ${key}`);
            }
          }
        }
      } catch (error) {
        result.errors.push(`Error cleaning ${key}: ${error}`);
        result.success = false;
      }
    }

    // Clean meal completions
    const mealKeys = ['local_meal_completions', 'meals'];
    
    for (const key of mealKeys) {
      try {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed)) {
            const cleanedData = validateAndCleanSyncData({ workouts: [], meals: parsed });
            const originalCount = parsed.length;
            const cleanedCount = cleanedData.meals.length;
            
            if (cleanedCount < originalCount) {
              await AsyncStorage.setItem(key, JSON.stringify(cleanedData.meals));
              result.cleaned.meals += (originalCount - cleanedCount);
              console.log(`Cleaned ${originalCount - cleanedCount} invalid meals from ${key}`);
            }
          }
        }
      } catch (error) {
        result.errors.push(`Error cleaning ${key}: ${error}`);
        result.success = false;
      }
    }

  } catch (error) {
    result.success = false;
    result.errors.push(`Critical error during cleanup: ${error}`);
  }

  return result;
}

/**
 * Generates a detailed report of local storage data
 */
export async function generateDataReport(): Promise<{
  timestamp: string;
  storage: {
    [key: string]: {
      exists: boolean;
      size?: number;
      itemCount?: number;
      sample?: any;
      errors?: string[];
    };
  };
  integrityCheck: IntegrityCheckResult;
}> {
  const report = {
    timestamp: new Date().toISOString(),
    storage: {} as any,
    integrityCheck: await performDataIntegrityCheck()
  };

  const keysToCheck = [
    'local_workout_completions',
    'completed_workouts',
    'local_meal_completions',
    'meals',
    'local_profile',
    'streak_data'
  ];

  for (const key of keysToCheck) {
    try {
      const data = await AsyncStorage.getItem(key);
      if (data) {
        const parsed = JSON.parse(data);
        report.storage[key] = {
          exists: true,
          size: data.length,
          itemCount: Array.isArray(parsed) ? parsed.length : 1,
          sample: Array.isArray(parsed) ? parsed.slice(0, 2) : parsed
        };
      } else {
        report.storage[key] = { exists: false };
      }
    } catch (error) {
      report.storage[key] = {
        exists: true,
        errors: [`Parse error: ${error}`]
      };
    }
  }

  return report;
}

/**
 * Pre-sync validation to ensure data is safe to sync
 */
export async function validatePreSync(): Promise<{
  canSync: boolean;
  issues: string[];
  autoFixApplied: boolean;
}> {
  const result = {
    canSync: false,
    issues: [],
    autoFixApplied: false
  };

  try {
    // Perform integrity check
    const integrityCheck = await performDataIntegrityCheck();
    
    if (integrityCheck.isValid) {
      result.canSync = true;
      return result;
    }

    // Try to auto-fix issues
    const cleanupResult = await cleanInvalidLocalData();
    
    if (cleanupResult.success) {
      result.autoFixApplied = true;
      
      // Re-check after cleanup
      const recheckResult = await performDataIntegrityCheck();
      result.canSync = recheckResult.isValid;
      result.issues = recheckResult.issues;
      
      if (result.canSync) {
        console.log('Data integrity issues auto-fixed, sync can proceed');
      }
    } else {
      result.issues = cleanupResult.errors;
      result.canSync = false;
    }

  } catch (error) {
    result.issues.push(`Pre-sync validation failed: ${error}`);
    result.canSync = false;
  }

  return result;
}
