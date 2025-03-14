import { UserProfile } from '../types/profile';

/**
 * Profile Data Access Helpers
 * 
 * These utilities provide consistent access to profile data
 * across the app, handling different field locations and formats.
 */

/**
 * Gets the user's current weight from any available source in the profile
 * Checks all possible locations where weight might be stored
 * 
 * @param profile The user profile
 * @returns The user's weight as a number, or 0 if not found
 */
export function getUserWeight(profile: UserProfile | null): number {
  if (!profile) return 0;
  
  // Try all possible weight fields in order of preference
  const weightValues = [
    // Direct weight fields
    typeof profile.weight === 'string' ? parseFloat(profile.weight) : (typeof profile.weight === 'number' ? profile.weight : 0),
    typeof profile.weight_kg === 'string' ? parseFloat(profile.weight_kg) : (typeof profile.weight_kg === 'number' ? profile.weight_kg : 0),
    
    // Body analysis weight fields
    profile.body_analysis?.weight_kg ? Number(profile.body_analysis.weight_kg) : 0,
    profile.body_analysis?.weight ? Number(profile.body_analysis.weight) : 0,
    
    // Other possible weight fields
    (profile as any).current_weight ? Number((profile as any).current_weight) : 0
  ];
  
  // Use the first non-zero value
  for (const weight of weightValues) {
    if (weight > 0) {
      return weight;
    }
  }
  
  return 0;
}

/**
 * Gets the user's target weight from any available source in the profile
 * 
 * @param profile The user profile
 * @returns The user's target weight as a number, or current weight if not found
 */
export function getTargetWeight(profile: UserProfile | null): number {
  if (!profile) return 0;
  
  const currentWeight = getUserWeight(profile);
  
  // Try all possible target weight fields
  const targetWeightValues = [
    typeof profile.target_weight === 'string' ? parseFloat(profile.target_weight) : (typeof profile.target_weight === 'number' ? profile.target_weight : 0),
    typeof profile.target_weight_kg === 'string' ? parseFloat(profile.target_weight_kg) : (typeof profile.target_weight_kg === 'number' ? profile.target_weight_kg : 0),
    (profile as any).goal_weight ? Number((profile as any).goal_weight) : 0
  ];
  
  // Use the first non-zero value
  for (const weight of targetWeightValues) {
    if (weight > 0) {
      return weight;
    }
  }
  
  // If no target weight, use current weight
  return currentWeight;
}

/**
 * Gets the user's initial/starting weight from any available source
 * 
 * @param profile The user profile
 * @returns The user's starting weight as a number, or current weight if not found
 */
export function getStartingWeight(profile: UserProfile | null): number {
  if (!profile) return 0;
  
  const currentWeight = getUserWeight(profile);
  
  // Try all possible starting weight fields
  const startingWeightValues = [
    typeof (profile as any).starting_weight === 'string' ? parseFloat((profile as any).starting_weight) : (typeof (profile as any).starting_weight === 'number' ? (profile as any).starting_weight : 0),
    typeof (profile as any).initial_weight === 'string' ? parseFloat((profile as any).initial_weight) : (typeof (profile as any).initial_weight === 'number' ? (profile as any).initial_weight : 0),
    typeof (profile as any).start_weight === 'string' ? parseFloat((profile as any).start_weight) : (typeof (profile as any).start_weight === 'number' ? (profile as any).start_weight : 0)
  ];
  
  // Use the first non-zero value
  for (const weight of startingWeightValues) {
    if (weight > 0) {
      return weight;
    }
  }
  
  // If no starting weight found, use current weight as fallback
  return currentWeight;
}

/**
 * Gets the user's streak days from any available source
 * 
 * @param profile The user profile
 * @param workoutCompletions Optional workout completion data to calculate streak
 * @returns The user's streak days as a number
 */
export function getUserStreak(profile: UserProfile | null, workoutCompletions?: any[]): number {
  if (!profile) return 0;
  
  // Try to get streak from profile fields first
  const streakFromProfile = Math.max(
    Number((profile as any).streak_days || 0),
    Number((profile as any).streak_count || 0),
    Number((profile as any).streak || 0)
  );
  
  // If we have a valid streak from profile, use it
  if (streakFromProfile > 0) {
    return streakFromProfile;
  }
  
  // If workout completions were provided, calculate streak from them
  if (workoutCompletions && workoutCompletions.length > 0) {
    // This is a simplified example - in a real app, you'd do more detailed streak calculation
    // based on consecutive days with completed workouts
    return Math.min(workoutCompletions.length, 7); // Example: cap at 7 days
  }
  
  return 0;
}

/**
 * Calculates the user's weight progress percentage
 * 
 * @param profile The user profile
 * @returns Progress percentage (0-100)
 */
export function getWeightProgress(profile: UserProfile | null): number {
  if (!profile) return 0;
  
  const currentWeight = getUserWeight(profile);
  const targetWeight = getTargetWeight(profile);
  const startWeight = getStartingWeight(profile);
  
  // Ensure we have valid values to avoid division issues
  if (currentWeight === 0 || targetWeight === 0 || startWeight === targetWeight) {
    return 0;
  }
  
  // Calculate progress percentage
  const totalChange = Math.abs(startWeight - targetWeight);
  const currentChange = Math.abs(startWeight - currentWeight);
  
  return totalChange > 0 
    ? Math.min(100, Math.round((currentChange / totalChange) * 100))
    : 0;
}

/**
 * Synchronizes weight data across all profile fields
 * Used to ensure data consistency when updating profile
 * 
 * @param profile Current profile object
 * @param weight Weight value to synchronize
 * @returns Updated profile with synchronized weight fields
 */
export function synchronizeWeightFields(profile: UserProfile, weight: number): Partial<UserProfile> {
  if (!weight || weight <= 0) return profile;
  
  // Create a deep copy of body_analysis to avoid mutation issues
  const bodyAnalysis = profile.body_analysis 
    ? { ...profile.body_analysis, weight_kg: weight, weight: weight }
    : { weight_kg: weight, weight: weight };
  
  // Return object with all weight fields synchronized
  return {
    weight: weight,
    weight_kg: weight,
    body_analysis: bodyAnalysis
  };
}
