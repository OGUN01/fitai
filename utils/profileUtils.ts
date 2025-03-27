import { UserProfile } from '../types/profile';

/**
 * Database column list - matches the actual columns in the profiles table
 * Use this to filter objects before saving to the database
 */
export const DATABASE_COLUMNS = [
  'id',
  'username',
  'full_name',
  'height_cm',
  'weight_kg',
  'target_weight_kg',
  'weight_goal',
  'workout_preferences',
  'diet_preferences',
  'body_analysis',
  'current_onboarding_step',
  'has_completed_onboarding',
  'created_at',
  'updated_at',
  'streak_days',
  'streak_count',
  'streak',
  'starting_weight_kg',
  'initial_weight_kg',
  'current_weight_kg',
  'fitness_level',
  'workout_days_per_week',
  'workout_duration_minutes',
  'fitness_goals',
  'diet_type',
  'diet_plan_preference',
  'allergies',
  'meal_frequency',
  'meal_times',
  'country_region',
  'diet_restrictions',
  'water_intake_goal',
  'water_intake_unit',
  'workout_plan',
  'meal_plans',
  'workout_summary',
  'meal_summary',
  'motivational_quote',
  'age',
  'gender',
  'activity_level',
  'workout_tracking',
  'meal_tracking'
];

/**
 * Filter an object to only include properties that map to actual database columns
 * This helps prevent errors when trying to save to columns that don't exist
 * 
 * @param data The data object to filter
 * @returns A new object with only valid database columns
 */
export function filterToDatabaseColumns(data: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  
  // Keep only the fields that match actual database columns
  Object.entries(data).forEach(([key, value]) => {
    if (DATABASE_COLUMNS.includes(key)) {
      result[key] = value;
    }
  });
  
  return result;
}

/**
 * Unit conversion functions for height and weight
 */

// Convert height from feet to centimeters
export function feetToCm(feet: number): number {
  return feet * 30.48;
}

// Convert height from centimeters to feet
export function cmToFeet(cm: number): number {
  return cm / 30.48;
}

// Convert weight from pounds to kilograms
export function lbsToKg(pounds: number): number {
  return pounds * 0.45359237;
}

// Convert weight from kilograms to pounds
export function kgToLbs(kg: number): number {
  return kg / 0.45359237;
}

/**
 * Get user's height in their preferred unit (cm or feet)
 */
export function getDisplayHeight(profile: UserProfile | null): { value: number, unit: string } {
  if (!profile) return { value: 0, unit: 'cm' };
  
  const heightUnit = profile.body_analysis?.height_unit || 'cm';
  
  if (heightUnit === 'cm') {
    // Return height in cm
    return { 
      value: profile.height_cm || profile.body_analysis?.height_cm || 0, 
      unit: 'cm' 
    };
  } else {
    // Convert to feet if that's the preferred unit
    const heightInCm = profile.height_cm || profile.body_analysis?.height_cm || 0;
    return { 
      value: cmToFeet(heightInCm), 
      unit: 'ft' 
    };
  }
}

/**
 * Get user's weight in their preferred unit (kg or lbs)
 */
export function getDisplayWeight(profile: UserProfile | null): { value: number, unit: string } {
  if (!profile) return { value: 0, unit: 'kg' };
  
  const weightUnit = profile.body_analysis?.weight_unit || 'kg';
  
  if (weightUnit === 'kg') {
    // Return weight in kg
    return { 
      value: profile.weight_kg || profile.body_analysis?.weight_kg || 0, 
      unit: 'kg' 
    };
  } else {
    // Convert to pounds if that's the preferred unit
    const weightInKg = profile.weight_kg || profile.body_analysis?.weight_kg || 0;
    return { 
      value: kgToLbs(weightInKg), 
      unit: 'lbs' 
    };
  }
} 