import { UserProfile } from '../types/profile';

/**
 * Get the user's current weight in kg with fallbacks for different field locations
 * @param profile UserProfile object
 * @returns number | undefined
 */
export const getUserWeight = (profile?: UserProfile): number | undefined => {
  if (!profile) return undefined;
  
  // Try all possible weight fields with metric standardization
  return profile.weight_kg || 
         profile.current_weight_kg || 
         profile.body_analysis?.weight_kg ||
         undefined;
};

/**
 * Get the user's target weight in kg with fallbacks for different field locations
 * @param profile UserProfile object
 * @returns number | undefined
 */
export const getTargetWeight = (profile?: UserProfile): number | undefined => {
  if (!profile) return undefined;
  
  // Try all possible target weight fields with metric standardization
  return profile.target_weight_kg || 
         profile.body_analysis?.target_weight_kg ||
         undefined;
};

/**
 * Formats weight value for display with the correct unit
 * @param weight Weight value in kg
 * @param unit Unit to display ('kg' or 'lb')
 * @returns Formatted string
 */
export const formatWeight = (weight?: number, unit: 'kg' | 'lb' = 'kg'): string => {
  if (weight === undefined || weight === null) return 'Not set';
  
  if (unit === 'lb') {
    // Convert to pounds for display
    const weightLb = Math.round(weight * 2.20462);
    return `${weightLb} lb`;
  }
  
  return `${weight} kg`;
};
