import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import supabase, { auth } from '../lib/supabase';
import { router } from 'expo-router';
import { verifyOnboardingCompletion } from '../utils/profileMigration';
import { syncLocalDataToServer, repairDatabaseSync } from '../utils/syncLocalData';
import { migrateLocalToCloud as migrateFunc, getTotalLocalSyncItems as getItemsFunc } from '../utils/dataSynchronizer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SecureStorage } from '../utils/secureStorage';
import { repairOnboardingStatus } from '../utils/onboardingPersistence';

// Auth session storage keys
const AUTH_SESSION_KEY = 'auth-session';
const AUTH_USER_KEY = 'auth-user';

/**
 * Convert all activity data from authenticated user ID to 'local_user' ID
 * This ensures data remains accessible after logout and refresh
 */
const convertActivityDataToLocalUser = async (authenticatedUserId: string | undefined) => {
  if (!authenticatedUserId) {
    console.log('AuthContext: No authenticated user ID provided, skipping activity data conversion');
    return;
  }

  console.log('AuthContext: Converting activity data to local_user format...');

  try {
    // Convert workout completions
    const workoutKeys = ['local_workout_completions', 'completed_workouts'];
    for (const key of workoutKeys) {
      try {
        const workoutData = await AsyncStorage.getItem(key);
        if (workoutData) {
          const workouts = JSON.parse(workoutData);
          if (Array.isArray(workouts)) {
            const convertedWorkouts = workouts.map(workout => ({
              ...workout,
              user_id: 'local_user' // Convert to local_user
            }));
            await AsyncStorage.setItem(key, JSON.stringify(convertedWorkouts));
            console.log(`AuthContext: Converted ${convertedWorkouts.length} workouts in ${key} to local_user`);
          }
        }
      } catch (error) {
        console.error(`AuthContext: Error converting workouts in ${key}:`, error);
      }
    }

    // Convert meal completions
    const mealKeys = ['local_meal_completions', 'meals'];
    for (const key of mealKeys) {
      try {
        const mealData = await AsyncStorage.getItem(key);
        if (mealData) {
          const meals = JSON.parse(mealData);
          if (Array.isArray(meals)) {
            const convertedMeals = meals.map(meal => ({
              ...meal,
              user_id: 'local_user' // Convert to local_user
            }));
            await AsyncStorage.setItem(key, JSON.stringify(convertedMeals));
            console.log(`AuthContext: Converted ${convertedMeals.length} meals in ${key} to local_user`);
          }
        }
      } catch (error) {
        console.error(`AuthContext: Error converting meals in ${key}:`, error);
      }
    }

    // Convert any cached meal plans
    try {
      const mealPlanKey = `mealPlan:${authenticatedUserId}`;
      const mealPlanData = await AsyncStorage.getItem(mealPlanKey);
      if (mealPlanData) {
        // Move meal plan to local user key
        await AsyncStorage.setItem('mealPlan:local_user', mealPlanData);
        await AsyncStorage.removeItem(mealPlanKey); // Remove old key
        console.log('AuthContext: Converted meal plan to local_user format');
      }
    } catch (error) {
      console.error('AuthContext: Error converting meal plan:', error);
    }

    // Convert any workout completion state cache
    try {
      const workoutStateData = await AsyncStorage.getItem('workout_completion_state');
      if (workoutStateData) {
        const state = JSON.parse(workoutStateData);
        if (state.userId === authenticatedUserId) {
          state.userId = 'local_user';
          await AsyncStorage.setItem('workout_completion_state', JSON.stringify(state));
          console.log('AuthContext: Converted workout completion state to local_user');
        }
      }
    } catch (error) {
      console.error('AuthContext: Error converting workout completion state:', error);
    }

    // Convert any additional data that might contain user IDs
    try {
      // Convert streak data if it contains user-specific information
      const streakData = await AsyncStorage.getItem('streak_data');
      if (streakData) {
        const streak = JSON.parse(streakData);
        if (streak.userId === authenticatedUserId) {
          streak.userId = 'local_user';
          await AsyncStorage.setItem('streak_data', JSON.stringify(streak));
          console.log('AuthContext: Converted streak data to local_user');
        }
      }
    } catch (error) {
      console.error('AuthContext: Error converting streak data:', error);
    }

    // Convert any water intake data
    try {
      const waterData = await AsyncStorage.getItem('water_intake');
      if (waterData) {
        const water = JSON.parse(waterData);
        if (Array.isArray(water)) {
          const convertedWater = water.map(entry => ({
            ...entry,
            user_id: entry.user_id === authenticatedUserId ? 'local_user' : entry.user_id
          }));
          await AsyncStorage.setItem('water_intake', JSON.stringify(convertedWater));
          console.log('AuthContext: Converted water intake data to local_user');
        }
      }
    } catch (error) {
      console.error('AuthContext: Error converting water intake data:', error);
    }

    // Convert any body measurements data
    try {
      const bodyData = await AsyncStorage.getItem('body_measurements');
      if (bodyData) {
        const measurements = JSON.parse(bodyData);
        if (Array.isArray(measurements)) {
          const convertedMeasurements = measurements.map(measurement => ({
            ...measurement,
            user_id: measurement.user_id === authenticatedUserId ? 'local_user' : measurement.user_id
          }));
          await AsyncStorage.setItem('body_measurements', JSON.stringify(convertedMeasurements));
          console.log('AuthContext: Converted body measurements to local_user');
        }
      }
    } catch (error) {
      console.error('AuthContext: Error converting body measurements:', error);
    }

    // Convert any nutrition tracking data
    try {
      const nutritionData = await AsyncStorage.getItem('nutrition_tracking');
      if (nutritionData) {
        const nutrition = JSON.parse(nutritionData);
        if (Array.isArray(nutrition)) {
          const convertedNutrition = nutrition.map(entry => ({
            ...entry,
            user_id: entry.user_id === authenticatedUserId ? 'local_user' : entry.user_id
          }));
          await AsyncStorage.setItem('nutrition_tracking', JSON.stringify(convertedNutrition));
          console.log('AuthContext: Converted nutrition tracking to local_user');
        }
      }
    } catch (error) {
      console.error('AuthContext: Error converting nutrition tracking:', error);
    }

    console.log('AuthContext: ✅ Successfully converted all activity data to local_user format');

  } catch (error) {
    console.error('AuthContext: Error during activity data conversion:', error);
  }
};

// Define profile type
type UserProfile = {
  id: string;
  first_name?: string;
  last_name?: string;
  has_completed_onboarding: boolean;
  current_onboarding_step: string;
  [key: string]: any;
};

// Define types for auth context
type AuthContextType = {
  session: Session | null;
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<any>;
  signUp: (email: string, password: string) => Promise<any>;
  signOut: () => Promise<void>;
};

// Create the auth context with default values
const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  userProfile: null,
  loading: true,
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
});

// Custom hook for using the auth context
export const useAuth = () => {
  return useContext(AuthContext);
};

// Provider component that wraps the app and makes auth available
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const isMounted = useRef(true);
  
  // Safe setState functions that only update state if component is mounted
  const safeSetSession = useCallback(async (data: Session | null) => {
    if (isMounted.current) {
      setSession(data);
      
      // Also store in secure storage for persistence
      if (data) {
        try {
          await SecureStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(data));
          await SecureStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
        } catch (error) {
          console.error('Error saving session to secure storage:', error);
        }
      }
    }
  }, []);
  
  const safeSetUser = useCallback((data: User | null) => {
    if (isMounted.current) setUser(data);
  }, []);
  
  const safeSetLoading = useCallback((isLoading: boolean) => {
    if (isMounted.current) setLoading(isLoading);
  }, []);

  // Initialize auth state
  useEffect(() => {
    // Check for existing session
    const initializeAuth = async () => {
      try {
        safeSetLoading(true);
        
        // Try to restore session from secure storage first (faster startup)
        try {
          const storedSession = await SecureStorage.getItem(AUTH_SESSION_KEY);
          const storedUser = await SecureStorage.getItem(AUTH_USER_KEY);
          
          if (storedSession && storedUser) {
            const sessionData = JSON.parse(storedSession);
            const userData = JSON.parse(storedUser);
            
            // Only temporarily set these while we verify with Supabase
            if (isMounted.current) {
              setSession(sessionData);
              setUser(userData);
            }
            
            console.log('Restored session from secure storage');
          }
        } catch (storageError) {
          console.error('Error reading session from secure storage:', storageError);
        }
        
        // Get current session from Supabase (the source of truth)
        const { data: sessionData } = await supabase.auth.getSession();
        
        if (sessionData.session) {
          await safeSetSession(sessionData.session);
          safeSetUser(sessionData.session?.user ?? null);
          console.log('Session restored from Supabase');
        } else if (session) {
          // If we have a session in state but Supabase doesn't recognize it,
          // try to refresh the session
          try {
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
            
            if (refreshError) {
              throw refreshError;
            }
            
            if (refreshData.session) {
              await safeSetSession(refreshData.session);
              safeSetUser(refreshData.session.user);
              console.log('Session refreshed successfully');
            } else {
              // No valid session, clear storage
              await SecureStorage.deleteItem(AUTH_SESSION_KEY);
              await SecureStorage.deleteItem(AUTH_USER_KEY);
              safeSetSession(null);
              safeSetUser(null);
              console.log('No valid session found after refresh attempt');
            }
          } catch (refreshError) {
            console.error('Error refreshing session:', refreshError);
            // Clear invalid session
            await SecureStorage.deleteItem(AUTH_SESSION_KEY);
            await SecureStorage.deleteItem(AUTH_USER_KEY);
            safeSetSession(null);
            safeSetUser(null);
          }
        }
        
        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event, newSession) => {
            console.log('Auth state changed:', event);
            if (newSession) {
              await safeSetSession(newSession);
              safeSetUser(newSession.user);
            } else if (event === 'SIGNED_OUT') {
              // Clear session on sign out
              await SecureStorage.deleteItem(AUTH_SESSION_KEY);
              await SecureStorage.deleteItem(AUTH_USER_KEY);
              safeSetSession(null);
              safeSetUser(null);
            }
          }
        );
        
        return () => {
          subscription.unsubscribe();
        };
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        safeSetLoading(false);
      }
    };
    
    initializeAuth();
    
    // Cleanup function
    return () => {
      isMounted.current = false;
    };
  }, [safeSetLoading, safeSetSession, safeSetUser]);

  // Auth functions
  const signIn = async (email: string, password: string) => {
    try {
      console.log("Starting sign-in process for:", email);
      setLoading(true);
      
      await AsyncStorage.removeItem('auth_error');
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        await AsyncStorage.setItem('auth_error', JSON.stringify({
          message: error.message === "Invalid login credentials" 
            ? "Email or password is incorrect" 
            : error.message,
          timestamp: new Date().toISOString()
        }));
        setLoading(false);
        throw error;
      }
      
      await AsyncStorage.removeItem('auth_error');
      
      await SecureStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(data.session));
      await SecureStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
      
      safeSetSession(data.session);
      safeSetUser(data.user);
      
      if (data.session && data.user) {
        try {
          const localProfile = await AsyncStorage.getItem('local_profile');
          
          if (localProfile) {
            console.log("Local profile found, proceeding with comprehensive sync.");
            
            const syncTimestamp = Date.now();
            await AsyncStorage.setItem('sync_in_progress', 'true'); // Managed by syncLocalDataToServer now, but can keep for wider visibility
            await AsyncStorage.setItem('sync_in_progress_since', JSON.stringify(syncTimestamp)); // Same as above

            // Primary sync operation using the enhanced syncLocalDataToServer
            const syncResult = await syncLocalDataToServer(data.user.id);
            console.log("Comprehensive sync result:", syncResult);

            if (syncResult.success) {
              console.log("Comprehensive sync completed successfully after sign-in.");
              await AsyncStorage.setItem(`sync_status:${data.user.id}`, JSON.stringify({
                timestamp: new Date().toISOString(),
                status: 'success',
                details: syncResult.syncedItems
              }));
            } else {
              console.error("Comprehensive sync failed after sign-in:", syncResult.error);
              // Conditional repair call, as was present before
              if (syncResult.error && (
                  syncResult.error.includes("workout_completions") || 
                  syncResult.error.includes("meal_completions") ||
                  syncResult.error.includes("violates not-null") ||
                  syncResult.error.includes("null value")
              )) {
                console.log("Detected potential ID/NULL issues in sync, attempting repairDatabaseSync.");
                const repairResult = await repairDatabaseSync(data.user.id);
                console.log("RepairDatabaseSync result:", repairResult);
                // Log repair result appropriately
                 await AsyncStorage.setItem('sync_repair_result', JSON.stringify({
                    timestamp: new Date().toISOString(),
                    message: repairResult.message,
                    success: repairResult.success,
                    repairs: repairResult.repairs
                  }));
              }
              await AsyncStorage.setItem('last_sync_error', JSON.stringify({
                message: syncResult.error,
                timestamp: new Date().toISOString(),
                syncId: syncResult.syncId
              }));
            }
            // The 'sync_in_progress' flags are cleared by syncLocalDataToServer's finally block

          } else {
            console.log("No local profile found, fetching profile from server.");
            await fetchUserProfile(data.user.id);
          }
        } catch (profileError) {
          console.error("Error during post-login profile/sync handling:", profileError);
          if (data.user) await fetchUserProfile(data.user.id); // Fallback to fetch profile
        }
      }
      
      await verifyAndFixOnboardingStatus(); // Keep this for robust onboarding checks
      
      console.log("✅ Sign in process completed");
      return data;
    } catch (error) {
      console.error("Sign in process failed:", error);
      try {
        const existingError = await AsyncStorage.getItem('auth_error');
        if (!existingError) {
          await AsyncStorage.setItem('auth_error', JSON.stringify({
            message: (error as Error).message || "Sign in failed",
            timestamp: new Date().toISOString()
          }));
        }
      } catch (storageError) {
        console.error("Error storing auth error:", storageError);
      }
      setLoading(false);
      throw error;
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      console.log("✉️ Starting enhanced sign-up process for:", email);
      setLoading(true);
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      
      if (error) throw error;
      
      // If signup was successful and user is confirmed (or confirms immediately)
      // data.user will exist. The check for !data.user.identities... was for auto-confirmation, may not always hold true.
      if (data?.user) { 
        console.log("🔄 New user created/session obtained, proceeding with comprehensive data sync to cloud.");
        
        // Check if there's any local data that might need syncing by checking for local_profile
        // syncLocalDataToServer will internally check for various data items.
        const localProfile = await AsyncStorage.getItem('local_profile');
        if (localProfile) {
            console.log("Local profile found, indicating potential local data to sync for new user.");
            try {
                const syncResult = await syncLocalDataToServer(data.user.id);
                if (syncResult.success) {
                    console.log("✅ Successfully synced local data to new user account after signup.");
                } else {
                    console.warn("⚠️ Some items failed to sync during signup comprehensive sync:", syncResult.error);
                    // Potentially call repairDatabaseSync here too if specific errors occur, similar to signIn
                }
            } catch (syncError) {
                console.error("❌ Error during comprehensive data sync after signup:", syncError);
            }
        } else {
            console.log("ℹ️ No local profile found, assuming no local data to sync for new user.");
        }
      }
      
      console.log("✅ Sign-up successful. User might need to confirm email then sign in.");
      return data;
    } catch (error: any) {
      console.error('❌ Error signing up:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      console.log('AuthContext: Starting signOut process');

      const userIdForClearing = user?.id; // Capture user ID before it's nulled

      // ENHANCED FIX: Preserve ALL user data for local mode
      // Get the current profile to preserve ALL user information
      let userDataToPreserve = null;
      try {
        if (userIdForClearing) {
          const currentProfileJson = await AsyncStorage.getItem(`profile:${userIdForClearing}`);
          if (currentProfileJson) {
            const currentProfile = JSON.parse(currentProfileJson);
            userDataToPreserve = {
              full_name: currentProfile.full_name,
              email: currentProfile.email,
              diet_preferences: currentProfile.diet_preferences,
              workout_preferences: currentProfile.workout_preferences,
              body_analysis: currentProfile.body_analysis,
              weight_kg: currentProfile.weight_kg,
              height_cm: currentProfile.height_cm,
              age: currentProfile.age,
              gender: currentProfile.gender,
              activity_level: currentProfile.activity_level,
              weight_goal: currentProfile.weight_goal,
              target_weight_kg: currentProfile.target_weight_kg,
              starting_weight_kg: currentProfile.starting_weight_kg,
              country_region: currentProfile.country_region,
              meal_plans: currentProfile.meal_plans,
              workout_tracking: currentProfile.workout_tracking,
              meal_tracking: currentProfile.meal_tracking
            };
            console.log('AuthContext: Preserving complete user data for local mode:', {
              name: userDataToPreserve.full_name,
              email: userDataToPreserve.email,
              hasDietPrefs: !!userDataToPreserve.diet_preferences,
              hasWorkoutPrefs: !!userDataToPreserve.workout_preferences,
              hasMealPlans: !!userDataToPreserve.meal_plans
            });
          }
        }

        // Also check local_profile as fallback
        if (!userDataToPreserve) {
          const localProfileJson = await AsyncStorage.getItem('local_profile');
          if (localProfileJson) {
            const localProfile = JSON.parse(localProfileJson);
            userDataToPreserve = localProfile;
            console.log('AuthContext: Found user data in local profile');
          }
        }
      } catch (dataPreservationError) {
        console.error('AuthContext: Error preserving user data:', dataPreservationError);
      }

      // Sign out from Supabase first
      await supabase.auth.signOut();

      // Clear secure storage for auth tokens
      await SecureStorage.deleteItem(AUTH_SESSION_KEY);
      await SecureStorage.deleteItem(AUTH_USER_KEY);

      // Then clear the local context state
      safeSetSession(null);
      safeSetUser(null);
      setUserProfile(null); // Also clear userProfile from context state

      // ENHANCED FIX: Clear only session-related data, preserve ALL user data
      console.log('AuthContext: Clearing session-related AsyncStorage data while preserving ALL user data...');
      const keysToClear = [
        // ✅ PRESERVED USER DATA (NOT cleared):
        // - 'completed_workouts' (workout completions)
        // - 'local_workout_completions' (new workout completions format)
        // - 'meals' (meal completions - legacy)
        // - 'local_meal_completions' (new meal completions format)
        // - 'body_measurements' (user body tracking data)
        // - 'nutrition_tracking' (user nutrition data)
        // - 'streak_data' (user streak information)
        // - 'water_intake' (user water tracking)
        // - 'meal_history' (user meal history)
        // - 'workout_history' (user workout history)
        // - 'notification_settings' (user notification preferences)
        // - 'app_theme' (user app preferences)
        // - 'measurement_units' (user unit preferences)
        // - 'local_profile' (handled separately to preserve with auth data)

        // 🗑️ CLEARED SESSION DATA (safe to clear):
        'hideLoginBanner',

        // Onboarding Status - clear these as they're session-specific
        'onboarding_status',
        'onboarding_completed',
        'onboarding_fallback_complete', // From FALLBACK_KEY in onboardingStatusChecker
        'onboarding_verification_details', // From VERIFICATION_KEY in onboardingStatusChecker

        // Sync Status & Logs - clear these as they're session-specific
        'data_sync_status',
        'last_data_sync',
        'data_change_log',
        'sync_in_progress',
        'sync_in_progress_since',
        'sync_repair_result',
        'last_sync_error',
        'sync_error',

        // Developer/Debug Flags - clear these
        'skipApiCalls',
        'skipApiCallsTimestamp',
        'meal_plan_rate_limited',
        'meal_plan_rate_limit_timestamp',
        'meal_plan_generation_in_progress',

        // Legacy keys that might exist (but preserve main data)
        'LocalWorkoutCompletions', // older key from trackingService if used directly
        'LocalMealCompletions', // older key from trackingService if used directly
      ];

      if (userIdForClearing) {
        keysToClear.push(...[
          `profile:${userIdForClearing}`,
          `sync_status:${userIdForClearing}`,
          `sync_backup:${userIdForClearing}`,
          `recently_synced:${userIdForClearing}`,
          // Add any other userId-prefixed keys here if necessary
        ]);
      }

      // It's good practice to also clear keys that might have been dynamically created with user patterns
      // if not covered by the specific userIdForClearing block. However, multiRemove is safer with known keys.

      try {
        await AsyncStorage.multiRemove(keysToClear);
        console.log('AuthContext: Specified AsyncStorage keys cleared.');
      } catch (e) {
        console.error('AuthContext: Error clearing AsyncStorage keys:', e);
      }

      // ENHANCED FIX: Create a comprehensive local profile preserving ALL user data
      // AND convert all activity data to use 'local_user' ID for proper access after logout
      if (userDataToPreserve) {
        try {
          const newLocalProfile = {
            id: 'local_user',
            // Preserve all user data
            full_name: userDataToPreserve.full_name,
            email: userDataToPreserve.email,

            // Preserve diet preferences (use preserved data or defaults)
            diet_preferences: userDataToPreserve.diet_preferences || {
              meal_frequency: 3,
              diet_type: 'balanced',
              allergies: [],
              excluded_foods: [],
              favorite_foods: [],
              country_region: userDataToPreserve.country_region || "us"
            },

            // Preserve workout preferences (use preserved data or defaults)
            workout_preferences: userDataToPreserve.workout_preferences || {
              preferred_days: ['monday', 'wednesday', 'friday'],
              workout_duration: 30
            },

            // Preserve body analysis and measurements
            body_analysis: userDataToPreserve.body_analysis,
            weight_kg: userDataToPreserve.weight_kg,
            height_cm: userDataToPreserve.height_cm,
            age: userDataToPreserve.age,
            gender: userDataToPreserve.gender,
            activity_level: userDataToPreserve.activity_level,
            weight_goal: userDataToPreserve.weight_goal,
            target_weight_kg: userDataToPreserve.target_weight_kg,
            starting_weight_kg: userDataToPreserve.starting_weight_kg,

            // Preserve meal plans and tracking data
            meal_plans: userDataToPreserve.meal_plans,
            workout_tracking: userDataToPreserve.workout_tracking,
            meal_tracking: userDataToPreserve.meal_tracking,

            // Basic settings
            country_region: userDataToPreserve.country_region || "us",
            has_completed_onboarding: false, // Reset for local mode
            has_completed_local_onboarding: true, // Mark as completed to avoid re-onboarding
            current_onboarding_step: 'completed'
          };

          await AsyncStorage.setItem('local_profile', JSON.stringify(newLocalProfile));
          console.log('AuthContext: Created comprehensive local profile with preserved data:', {
            name: newLocalProfile.full_name,
            email: newLocalProfile.email,
            hasDietPrefs: !!newLocalProfile.diet_preferences,
            hasWorkoutPrefs: !!newLocalProfile.workout_preferences,
            hasMealPlans: !!newLocalProfile.meal_plans,
            hasBodyAnalysis: !!newLocalProfile.body_analysis
          });

          // CRITICAL FIX: Convert all activity data to use 'local_user' ID
          // This ensures data is accessible after logout and refresh
          await convertActivityDataToLocalUser(userIdForClearing);

        } catch (profileCreationError) {
          console.error('AuthContext: Error creating comprehensive local profile:', profileCreationError);
        }
      } else {
        // If no data to preserve, create a minimal local profile
        try {
          const minimalLocalProfile = {
            id: 'local_user',
            full_name: 'User',
            diet_preferences: {
              meal_frequency: 3,
              diet_type: 'balanced',
              allergies: [],
              excluded_foods: [],
              favorite_foods: [],
              country_region: "us"
            },
            workout_preferences: {
              preferred_days: ['monday', 'wednesday', 'friday'],
              workout_duration: 30
            },
            country_region: "us",
            has_completed_onboarding: false,
            has_completed_local_onboarding: false,
            current_onboarding_step: 'personal_info'
          };

          await AsyncStorage.setItem('local_profile', JSON.stringify(minimalLocalProfile));
          console.log('AuthContext: Created minimal local profile (no data to preserve)');
        } catch (clearError) {
          console.error('AuthContext: Error creating minimal local profile:', clearError);
        }
      }

      // Optionally, clear all AsyncStorage if a completely fresh start is desired,
      // but this is aggressive and might remove things unrelated to this app or user session.
      // await AsyncStorage.clear();
      // console.log('AuthContext: All AsyncStorage cleared (aggressive option).');

      console.log('AuthContext: Signout successful, local data cleared.');
    } catch (error) {
      console.error('AuthContext: Error signing out:', error);
      throw error;
    }
  };

  // Fetch user profile from Supabase
  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId);

      if (error) {
        // Handle specific errors gracefully
        if (error.message?.includes('JSON object requested, multiple (or no) rows returned') ||
            error.code === 'PGRST116') {
          console.warn('Profile not found or multiple profiles found:', error.message);
          return null;
        }
        throw error;
      }

      // Handle array response (since we removed .single())
      const profile = data && data.length > 0 ? data[0] : null;
      setUserProfile(profile);
      return profile;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  };
  
  // Verify and fix onboarding status if needed - enhanced reliability
  const verifyAndFixOnboardingStatus = async () => {
    if (!user) return;
    
    try {
      console.log("🔍 Verifying onboarding completion status with enhanced reliability...");
      
      // First use our new reliable utility to check and repair onboarding status
      await repairOnboardingStatus();
      
      // Then, for backward compatibility, also use the existing verification
      const verificationResult = await verifyOnboardingCompletion(user.id);
      
      if (verificationResult.success) {
        console.log("✓ Traditional onboarding verification result:", verificationResult.message);
        if (verificationResult.wasFixed) {
          console.log("🔧 Fixed onboarding status during traditional verification");
        }
      } else {
        console.error("⚠️ Error in traditional onboarding verification:", verificationResult.message);
      }
      
      // Sync onboarding status between local and server if needed
      try {
        // Get user profile from Supabase to check server-side status
        const { data: profileData } = await supabase
          .from('profiles')
          .select('has_completed_onboarding, current_onboarding_step')
          .eq('id', user.id)
          .single();
        
        if (profileData) {
          // Get local profile to compare
          const localProfileJson = await AsyncStorage.getItem('local_profile');
          const localProfile = localProfileJson ? JSON.parse(localProfileJson) : null;
          
          // If local shows completed but server doesn't, update server
          if (localProfile?.has_completed_local_onboarding === true && 
              profileData.has_completed_onboarding === false) {
            console.log("🔄 Syncing onboarding completion status to server");
            await supabase
              .from('profiles')
              .update({
                has_completed_onboarding: true,
                current_onboarding_step: 'completed'
              })
              .eq('id', user.id);
          }
        }
      } catch (syncError) {
        console.error("❌ Error syncing onboarding status:", syncError);
      }
    } catch (verificationError) {
      console.error("❌ Exception during enhanced onboarding verification:", verificationError);
    }
  };

  const value = {
    session,
    user,
    userProfile,
    loading,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
