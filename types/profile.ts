import { User } from '@supabase/supabase-js';
import { WorkoutCompletion, MealCompletion } from '../types/tracking';

export interface UserProfile {
  id: string; // Maps to auth.users.id
  username?: string;
  full_name?: string;
  
  // Use standardized metric column names that match the database
  height_cm?: number; // Standardized column for height in centimeters
  weight_kg?: number; // Standardized column for weight in kilograms
  target_weight_kg?: number; // Standardized column for target weight in kilograms
  
  // Legacy fields - kept for reference but should not be used for DB operations
  // height?: number; // DEPRECATED - use height_cm instead
  // weight?: number; // DEPRECATED - use weight_kg instead
  // target_weight?: number; // DEPRECATED - use target_weight_kg instead
  
  // Keep existing fields
  weight_goal?: string; // Actual column in database for fitness goal (singular)
  workout_preferences?: WorkoutPreferences;
  diet_preferences?: DietPreferences;
  body_analysis?: BodyAnalysis;
  current_onboarding_step?: string;
  has_completed_onboarding: boolean;
  created_at?: string;
  updated_at?: string;
  
  // Added streak tracking fields
  streak_days?: number;
  streak_count?: number;
  streak?: number;
  
  // Added weight tracking fields - use standardized metric naming
  starting_weight_kg?: number;
  initial_weight_kg?: number;
  current_weight_kg?: number;
  
  // Fields for workout preferences (from DB schema)
  fitness_level?: string;
  workout_days_per_week?: number;
  workout_duration_minutes?: number;
  fitness_goals?: string[]; // Array of fitness goals in database
  
  // Fields for nutrition preferences
  diet_type?: string;
  diet_plan_preference?: string;
  allergies?: string[];
  meal_frequency?: number;
  meal_times?: string[] | Array<{name: string, time: string}>; // Support both formats
  country_region?: string;
  diet_restrictions?: string[];
  water_intake_goal?: number;
  water_intake_unit?: string;
  
  // Generated content fields
  workout_plan?: any; // Using any for now, could be typed as WorkoutPlan
  meal_plans?: any; // Using any for now, could be typed as MealPlan
  
  // Cache fields for summaries and quotes
  workout_summary?: string;
  meal_summary?: string;
  motivational_quote?: string;
  
  // Demographic data fields
  age?: number;
  gender?: string;
  activity_level?: string;
  
  // JSONB tracking columns (should be arrays)
  workout_tracking?: any;
  meal_tracking?: any[];
  
  // New field for local mode
  has_completed_local_onboarding?: boolean;

  // Add notification preferences
  notification_preferences?: {
    workout_notifications: boolean;
    meal_reminders: boolean;
    water_reminders: boolean;
  };

  // **** ADDED FIELDS FOR LOCAL COMPLETION TRACKING ****
  completedWorkouts?: WorkoutCompletion[];
  completedMeals?: MealCompletion[];
}

export interface WorkoutPreferences {
  preferred_days: string[];
  workout_duration: number; // in minutes
  fitness_level?: string;
  workout_location?: string;
  equipment?: string[];
  workout_focus?: string;
  exercises_to_avoid?: string[];
  workout_summary?: string; // Added for caching summaries
  motivational_quote?: string; // Added for caching quotes
  
  // Added fields from review page
  focus_areas?: string[];
  intensity_level?: string;
  equipment_available?: string[];
}

export interface DietPreferences {
  meal_frequency: number;
  diet_type: string;
  allergies: string[];
  excluded_foods: string[];
  favorite_foods: string[];
  macronutrient_ratio?: { // Optional field for macronutrient ratios
    protein: number,
    carbs: number,
    fats: number
  };
  meal_summary?: string; // Added for caching meal summaries
  
  // Added fields from review page
  dietary_restrictions?: string[];
  meal_count?: number;
  
  // Additional properties for meal planning
  country_region?: string; // Changed from countryRegion to country_region for consistency
  calorieTarget?: number;
  
  // Meal times configuration for scheduling
  meal_times?: Array<{name: string, time: string}>;
}

export interface BodyAnalysis {
  // Support both old and new schema fields
  height?: number; // in cm
  weight?: number; // in kg
  height_cm?: number; // new field from database
  weight_kg?: number; // new field from database
  bmi?: number;
  body_fat_percentage?: number;
  
  // Fields for unit conversions and original values
  height_unit?: string; // 'cm' or 'ft'
  weight_unit?: string; // 'kg' or 'lbs'
  original_height?: number; // original height in user's preferred unit
  original_weight?: number; // original weight in user's preferred unit
  original_target_weight?: number; // original target weight in user's preferred unit
  target_weight_kg?: number; // target weight in kg
  
  // Weight tracking fields
  starting_weight_kg?: number;
  initial_weight_kg?: number;
  current_weight_kg?: number;
  weight_history?: Array<{date: string, weight: number}>; // Array of weight entries
  
  // Using snake_case to match database schema
  body_type?: string; // Body type classification (previously bodyType)
  analysis_text?: string; // Text analysis of body composition (previously analysisText)
  body_proportions?: {
    shoulders: string;
    torso: string;
    arms: string;
    legs: string;
  };
  posture?: {
    alignment: string;
    issues: string[];
    recommendations: string[];
  };
  recommended_focus_areas?: string[];
  
  // Keep camelCase for backward compatibility
  bodyType?: string;
  analysisText?: string;
  bodyProportions?: {
    shoulders: string;
    torso: string;
    arms: string;
    legs: string;
  };
  recommendedFocusAreas?: string[];
}

export type OnboardingStep = 
  | 'welcome'
  | 'personal-info'
  | 'body-metrics'
  | 'fitness-goals'
  | 'workout-preferences'
  | 'diet-preferences'
  | 'completion';
