/**
 * Centralized storage keys for the app
 * This helps avoid typos and makes it easier to track what data is stored
 */
export const StorageKeys = {
  // Profile and user data
  LOCAL_PROFILE: 'local_profile',
  ONBOARDING_STATUS: 'onboarding_status',
  ONBOARDING_COMPLETED: 'onboarding_completed',
  ONBOARDING_VERIFICATION: 'onboarding_verification',
  
  // Fitness data
  COMPLETED_WORKOUTS: 'completed_workouts',
  WORKOUT_HISTORY: 'workout_history',
  MEALS: 'meals',
  MEAL_HISTORY: 'meal_history',
  WATER_INTAKE: 'water_intake',
  
  // Tracking and analytics
  STREAK_DATA: 'streak_data',
  SYSTEM_STARTUP: 'system_startup_info',
  SYSTEM_HEALTH: 'system_health_status',
  
  // App settings
  NOTIFICATION_SETTINGS: 'notification_settings',
  APP_THEME: 'app_theme',
  MEASUREMENT_UNITS: 'measurement_units',
  
  // Session data
  AUTH_SESSION: 'auth_session',
  SYNC_STATUS: 'sync_status',
  LAST_SYNC: 'last_sync_timestamp',
  
  // Temporary data
  WORKOUT_DRAFT: 'workout_draft',
  MEAL_DRAFT: 'meal_draft',
  TEMP_IMAGES: 'temp_images',
};

export default StorageKeys;
