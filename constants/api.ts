// Supabase configuration
export const SUPABASE_URL = "https://palugixdzhbrtplwgxdj.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhbHVnaXhkemhicnRwbHdneGRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE1OTQ3MDQsImV4cCI6MjA1NzE3MDcwNH0.cFRMvqwGitkvJpg1Eq9LK1vL-xxpyNnli_j9Zq_OUkA";

// Gemini AI API configuration
export const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || "AIzaSyAZLFWQ1BbvyroagG9kUZZLp8YMOruPNvM";
export const GEMINI_MODEL = 'gemini-2.0-flash-exp';
export const GEMINI_VISION_MODEL = 'gemini-2.0-flash-exp';
export const GEMINI_API_VERSION = 'v1beta'; // Using v1beta as the experimental models may not be fully available in v1

// API endpoints
export const API_ENDPOINTS = {
  // User endpoints
  USER: {
    PROFILE: '/api/user/profile',
    PREFERENCES: '/api/user/preferences',
    MEASUREMENTS: '/api/user/measurements',
  },
  
  // Workout endpoints
  WORKOUT: {
    LIST: '/api/workouts',
    DETAIL: '/api/workouts/:id',
    HISTORY: '/api/workouts/history',
    GENERATE: '/api/workouts/generate',
  },
  
  // Nutrition endpoints
  NUTRITION: {
    MEAL_PLANS: '/api/nutrition/meal-plans',
    MEAL_PLAN_DETAIL: '/api/nutrition/meal-plans/:id',
    WATER_TRACKING: '/api/nutrition/water',
    GENERATE_MEAL_PLAN: '/api/nutrition/generate',
  },
  
  // Progress endpoints
  PROGRESS: {
    WEIGHT: '/api/progress/weight',
    MEASUREMENTS: '/api/progress/measurements',
    STATS: '/api/progress/stats',
    ACHIEVEMENTS: '/api/progress/achievements',
  },
};

// API request timeouts (in milliseconds)
export const API_TIMEOUTS = {
  SHORT: 5000,  // 5 seconds
  MEDIUM: 15000, // 15 seconds
  LONG: 30000,  // 30 seconds
  AI_GENERATION: 60000, // 60 seconds for AI content generation
};

// API error messages
export const API_ERROR_MESSAGES = {
  DEFAULT: 'Something went wrong. Please try again.',
  NETWORK: 'Network error. Please check your connection and try again.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  NOT_FOUND: 'The requested resource was not found.',
  SERVER: 'Server error. Our team has been notified.',
  TIMEOUT: 'Request timed out. Please try again.',
  AI_GENERATION: 'AI content generation failed. Please try again.',
};
