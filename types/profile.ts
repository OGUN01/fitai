import { User } from '@supabase/supabase-js';

export interface UserProfile {
  id: string; // Maps to auth.users.id
  username?: string;
  full_name?: string;
  height?: number;
  weight?: number;
  weight_kg?: number; // Added for consistency with database schema
  fitness_goal?: string;
  target_weight?: number;
  target_weight_kg?: number; // Added for consistency with database schema
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
  
  // Added weight tracking fields
  starting_weight?: number;
  initial_weight?: number;
  start_weight?: number;
  current_weight?: number;
  
  // Fields for workout preferences (from DB schema)
  fitness_level?: string;
  workout_days_per_week?: number;
  workout_duration_minutes?: number;
  fitness_goals?: string[];
  
  // Fields for nutrition preferences
  diet_type?: string;
  diet_plan_preference?: string;
  allergies?: string[];
  meal_frequency?: number;
  
  // Generated content fields
  workout_plan?: any; // Using any for now, could be typed as WorkoutPlan
  meal_plans?: any; // Using any for now, could be typed as MealPlan
  
  // Cache fields for summaries and quotes
  workout_summary?: string;
  meal_summary?: string;
  motivational_quote?: string;
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
}

export interface BodyAnalysis {
  // Support both old and new schema fields
  height?: number; // in cm
  weight?: number; // in kg
  height_cm?: number; // new field from database
  weight_kg?: number; // new field from database
  bmi?: number;
  body_fat_percentage?: number;
  bodyType?: string; // Body type classification
  analysisText?: string; // Text analysis of body composition
  bodyProportions?: {
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
  recommendedFocusAreas?: string[];
  measurements?: {
    waist?: number;
    chest?: number;
    hips?: number;
    arms?: number;
    legs?: number;
  };
}

export type OnboardingStep = 
  | 'welcome'
  | 'personal-info'
  | 'body-metrics'
  | 'fitness-goals'
  | 'workout-preferences'
  | 'diet-preferences'
  | 'completion';
