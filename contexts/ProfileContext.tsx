import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile } from '../types/profile';
import supabase from '../lib/supabase';
import { useAuth } from './AuthContext';
import { router } from 'expo-router';
import { getUserWeight, getTargetWeight, synchronizeWeightFields } from '../utils/profileHelpers';
import { filterToDatabaseColumns, feetToCm, lbsToKg, DATABASE_COLUMNS } from '../utils/profileUtils';
import { synchronizeDietPreferences } from '../utils/profileSynchronizer';
import { updateOnboardingStep } from '../utils/onboardingTracker';

/**
 * Deep merge utility function since we're still having issues with the import
 */
function deepMerge<T extends Record<string, any>>(
  target: T,
  source: Partial<T>
): T {
  const output = { ...target } as Record<string, any>;
  
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        // If property doesn't exist in target, create it
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          // If property exists in target and is an object, merge it
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        // For non-object properties, simply overwrite with source value
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  
  return output as T;
}

/**
 * Check if value is an object (and not null, array, etc.)
 */
function isObject(item: any): boolean {
  return (
    item !== null && 
    typeof item === 'object' && 
    !Array.isArray(item)
  );
}

/**
 * Filter an object to only include properties that map to actual database columns
 * This helps prevent errors when trying to save to columns that don't exist
 * 
 * @param data The data object to filter
 * @returns A new object with only valid database columns
 */
function sanitizeForDatabase(data: Record<string, any>): Record<string, any> {
  // Get the filtered data using the database columns
  const filteredData = filterToDatabaseColumns(data);
  
  // Ensure critical fields like full_name are always included
  if (data.full_name) {
    filteredData.full_name = data.full_name;
  }
  
  // Log the preservation of critical fields
  console.log('SANITIZE: Preserving full_name in database update:', data.full_name);
  console.log('SANITIZE: Final filtered data includes full_name:', filteredData.full_name);
  
  return filteredData;
}

// Define the context type
export type ProfileContextType = {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  refreshProfile: (forceRefresh?: boolean) => Promise<UserProfile | null>;
  getCurrentOnboardingStep: () => string;
  completeOnboarding: () => Promise<void>;
  checkAndRouteUser: () => Promise<void>;
};

// Create the context with default values
const ProfileContext = createContext<ProfileContextType>({
  profile: null,
  loading: false,
  error: null,
  updateProfile: async () => {},
  refreshProfile: async () => null,
  getCurrentOnboardingStep: () => '',
  completeOnboarding: async () => {},
  checkAndRouteUser: async () => {},
});

// Custom hook to use the profile context
export const useProfile = () => useContext(ProfileContext);

// Profile provider component
export const ProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  // Helper function to get the profile from storage
  const getProfileFromStorage = async () => {
    try {
      if (!user) return null;
      const cachedProfile = await AsyncStorage.getItem(`profile:${user.id}`);
      return cachedProfile ? JSON.parse(cachedProfile) : null;
    } catch (error) {
      console.error("Error getting profile from storage:", error);
      return null;
    }
  };

  // Helper function to process profile data for unit conversions and ensure all required fields
  const processProfileData = (data: any): UserProfile => {
    // Clone the data to avoid mutating the original
    const processedData = { ...data };
    
    // Ensure diet_preferences exists
    if (!processedData.diet_preferences) {
      processedData.diet_preferences = {
        meal_frequency: 3,
        diet_type: 'balanced',
        allergies: [],
        excluded_foods: [],
        favorite_foods: []
      };
    }
    
    // Ensure workout_preferences exists
    if (!processedData.workout_preferences) {
      processedData.workout_preferences = {
        preferred_days: ['monday', 'wednesday', 'friday'],
        workout_duration: 30
      };
    }
    
    // Process country_region explicitly
    if (processedData.country_region && !processedData.diet_preferences.country_region) {
      processedData.diet_preferences.country_region = processedData.country_region;
    } else if (!processedData.country_region && processedData.diet_preferences.country_region) {
      processedData.country_region = processedData.diet_preferences.country_region;
    }
    
    return processedData as UserProfile;
  };

  // Function to create a new profile
  const createProfile = async (): Promise<UserProfile | null> => {
    if (!user) {
      console.error("Cannot create profile: No authenticated user");
      setError("You must be logged in to create a profile");
      return null;
    }
    
    try {
      console.log("Creating new profile for user:", user.id);
      
      // Create a new profile with default values
      const newProfile: Partial<UserProfile> = {
        id: user.id,
        // Removed created_at field as it doesn't exist in the database schema
        diet_preferences: {
          meal_frequency: 3,
          diet_type: 'balanced',
          allergies: [],
          excluded_foods: [],
          favorite_foods: [],
          country_region: "us" // Default country region
        },
        workout_preferences: {
          preferred_days: ['monday', 'wednesday', 'friday'],
          workout_duration: 30
        },
        country_region: "us", // Default to US
        has_completed_onboarding: false,
        current_onboarding_step: 'welcome'
      };
      
      // Ensure data is synchronized
      const synchronizedProfile = synchronizeProfileData(newProfile as UserProfile);
      
      // Filter the profile to only include fields that exist in the database schema
      const dbSafeProfile = sanitizeForDatabase(synchronizedProfile);
      
      console.log("Inserting profile with safe fields only");
      
      // Insert the profile into the database (with only valid columns)
      const { error: insertError } = await supabase
        .from('profiles')
        .insert([dbSafeProfile]);
      
      if (insertError) {
        console.error("Error creating profile:", insertError);
        setError(`Error creating profile: ${insertError.message}`);
        return null;
      }
      
      console.log("New profile created successfully");
      
      // Cache the new profile
      try {
        await AsyncStorage.setItem(`profile:${user.id}`, JSON.stringify(synchronizedProfile));
      } catch (storageError) {
        console.error("Error caching new profile:", storageError);
      }
      
      setProfile(synchronizedProfile);
      return synchronizedProfile;
    } catch (error) {
      console.error("Unexpected error creating profile:", error);
      setError("An unexpected error occurred creating your profile");
      return null;
    }
  };

  // Function to fetch profile from Supabase
  const fetchProfile = async (forceRefresh = false): Promise<UserProfile | null> => {
    setLoading(true);
    
    try {
      // If no user is logged in, return null
      if (!user) {
        console.error("Cannot fetch profile: No authenticated user");
        setLoading(false);
        return null;
      }
      
      console.log("🔍 FETCH PROFILE - Fetching profile for user:", user.id);
      console.log("🔍 FETCH PROFILE - Force refresh:", forceRefresh);
      
      // Try getting from AsyncStorage first (only if not forcing refresh)
      let cachedProfile: UserProfile | null = null;
      
      if (!forceRefresh) {
        try {
          const cachedData = await AsyncStorage.getItem(`profile:${user.id}`);
          
          if (cachedData) {
            cachedProfile = JSON.parse(cachedData) as UserProfile;
            console.log("🔍 FETCH PROFILE - Found cached profile with country_region:", cachedProfile.country_region);
            console.log("🔍 FETCH PROFILE - Diet preferences country_region:", cachedProfile.diet_preferences?.country_region);
          }
        } catch (error) {
          console.error("Error retrieving cached profile:", error);
        }
      }
      
      // Return cached profile if available and not forcing refresh
      if (cachedProfile && !forceRefresh) {
        setProfile(cachedProfile);
        setLoading(false);
        return cachedProfile;
      }
      
      // Fetch from database
      console.log("🔍 FETCH PROFILE - Fetching from Supabase...");
      const { data, error } = await supabase.from('profiles').select().eq('id', user.id).single();
      
      if (error) {
        console.error("Error fetching profile:", error.message);
        
        // Check if error is because profile doesn't exist
        if (error.code === 'PGRST116') {
          console.log("🔍 FETCH PROFILE - Profile doesn't exist, creating new profile");
          return await createProfile();
        }
        
        setError(`Error fetching profile: ${error.message}`);
        setLoading(false);
        return null;
      }
      
      if (!data) {
        console.log("🔍 FETCH PROFILE - No profile data, creating new profile");
        return await createProfile();
      }
      
      // Profile exists, process it
      console.log("🔍 FETCH PROFILE - Profile found in database");
      console.log("🔍 FETCH PROFILE - Raw DB country_region:", data.country_region);
      console.log("🔍 FETCH PROFILE - Raw DB has_completed_onboarding:", data.has_completed_onboarding);
      console.log("🔍 FETCH PROFILE - Raw DB workout_preferences:", data.workout_preferences);
      console.log("🔍 FETCH PROFILE - Raw DB diet_preferences:", data.diet_preferences);
      
      // Process for unit conversions and ensure all required fields
      const processedProfile = processProfileData(data);
      
      // Synchronize data between nested objects and root properties
      const synchronizedProfile = synchronizeProfileData(processedProfile);
      
      // CRITICAL FIX: Ensure onboarding completion status from DB is preserved
      if (data.has_completed_onboarding === true) {
        console.log("🔍 FETCH PROFILE - Preserving has_completed_onboarding=true from database");
        synchronizedProfile.has_completed_onboarding = true;
        synchronizedProfile.current_onboarding_step = 'completed';
      }
      
      // CRITICAL FIX: Ensure workout and diet preferences are preserved from database
      if (data.workout_preferences) {
        console.log("🔍 FETCH PROFILE - Preserving workout preferences from database");
        synchronizedProfile.workout_preferences = {
          ...synchronizedProfile.workout_preferences,
          ...data.workout_preferences
        };
      }
      
      if (data.diet_preferences) {
        console.log("🔍 FETCH PROFILE - Preserving diet preferences from database");
        synchronizedProfile.diet_preferences = {
          ...synchronizedProfile.diet_preferences,
          ...data.diet_preferences
        };
      }
      
      console.log("🔍 FETCH PROFILE - Final has_completed_onboarding:", synchronizedProfile.has_completed_onboarding);
      console.log("🔍 FETCH PROFILE - Final current_onboarding_step:", synchronizedProfile.current_onboarding_step);
      console.log("🔍 FETCH PROFILE - Final country_region:", synchronizedProfile.country_region);
      console.log("🔍 FETCH PROFILE - Final diet_preferences.country_region:", synchronizedProfile.diet_preferences?.country_region);
      console.log("🔍 FETCH PROFILE - Final workout_preferences:", synchronizedProfile.workout_preferences);
      console.log("🔍 FETCH PROFILE - Final diet_preferences:", synchronizedProfile.diet_preferences);
      
      // Cache the synchronized profile
      try {
        await AsyncStorage.setItem(`profile:${user.id}`, JSON.stringify(synchronizedProfile));
        console.log("🔍 FETCH PROFILE - Profile cached to AsyncStorage");
      } catch (cacheError) {
        console.error("Error caching profile:", cacheError);
      }
      
      // Update state and return
      setProfile(synchronizedProfile);
      setLoading(false);
      return synchronizedProfile;
    } catch (error) {
      console.error("Unexpected error in fetchProfile:", error);
      setError("An unexpected error occurred fetching your profile");
      setLoading(false);
      return null;
    }
  };

  // Update profile function
  const updateProfile = async (updatedFields: Partial<UserProfile>) => {
    try {
      console.log("updateProfile called with:", JSON.stringify(updatedFields, null, 2));
      
      if (!user) {
        console.error("Cannot update profile: No authenticated user");
        return;
      }
      
      // Start with the current profile or an empty object if profile doesn't exist
      const currentProfile = profile || {
        id: user.id,
        has_completed_onboarding: false,
        diet_preferences: {
          meal_frequency: 3,
          diet_type: 'balanced',
          allergies: [],
          excluded_foods: [],
          favorite_foods: []
        },
        workout_preferences: {
          preferred_days: ['monday', 'wednesday', 'friday'],
          workout_duration: 30
        }
      } as UserProfile;
      
      // CRITICAL FIX: If we're explicitly setting has_completed_onboarding to true, 
      // make sure it gets saved regardless of database column filtering
      const explicityCompletingOnboarding = updatedFields.has_completed_onboarding === true;
      
      // Special handling for country_region - ensure it's synced
      if (updatedFields.country_region && (!updatedFields.diet_preferences || !updatedFields.diet_preferences.country_region)) {
        console.log("Ensuring country_region sync - adding to diet_preferences");
        updatedFields.diet_preferences = {
          ...(updatedFields.diet_preferences || {}),
          ...(currentProfile.diet_preferences || {
            meal_frequency: 3,
            diet_type: 'balanced',
            allergies: [],
            excluded_foods: [],
            favorite_foods: []
          }),
          country_region: updatedFields.country_region
        };
      } else if (!updatedFields.country_region && updatedFields.diet_preferences?.country_region) {
        console.log("Ensuring country_region sync - adding to root from diet_preferences");
        updatedFields.country_region = updatedFields.diet_preferences.country_region;
      }
      
      // Create a merged profile with the updated fields
      const mergedProfile = {
        ...currentProfile,
        ...updatedFields,
      };
      
      // Always ensure the diet_preferences object exists with required fields
      if (!mergedProfile.diet_preferences) {
        mergedProfile.diet_preferences = {
          meal_frequency: 3,
          diet_type: 'balanced',
          allergies: [],
          excluded_foods: [],
          favorite_foods: []
        };
      }
      
      // Synchronize data and update onboarding step
      const synchronizedProfile = synchronizeProfileData(mergedProfile);
      
      // Process any unit conversions if needed (original function)
      const processedProfile = processUnitConversions(synchronizedProfile, updatedFields);
      
      // Sanitize data to only include actual database columns
      const sanitizedData = sanitizeForDatabase(processedProfile);
      
      // CRITICAL FIX: Ensure onboarding completion flag is preserved
      if (explicityCompletingOnboarding) {
        console.log('FORCING has_completed_onboarding=true into sanitized data');
        sanitizedData.has_completed_onboarding = true;
        sanitizedData.current_onboarding_step = 'completed';
      }
      
      // Special handling for country_region since it's giving us trouble
      // If the original update had a country_region, force it into the sanitized data
      // regardless of database column filtering
      if (updatedFields.country_region && typeof updatedFields.country_region === 'string') {
        console.log('FORCING country_region into sanitized data:', updatedFields.country_region);
        sanitizedData.country_region = updatedFields.country_region;
        
        // Also ensure it appears in the nested diet_preferences object
        if (sanitizedData.diet_preferences) {
          sanitizedData.diet_preferences.country_region = updatedFields.country_region;
        }
      }
      
      // Log what we're actually saving
      console.log("FINAL: Saving sanitized profile data:", JSON.stringify(sanitizedData, null, 2));
      console.log("FINAL: Does sanitized data include country_region?", 'country_region' in sanitizedData);
      console.log("FINAL: Does sanitized data include has_completed_onboarding?", 'has_completed_onboarding' in sanitizedData);
      
      if (sanitizedData.diet_preferences) {
        console.log("FINAL: Does diet_preferences include country_region?", 'country_region' in sanitizedData.diet_preferences);
      }
      
      // Save to Supabase
      const { data, error } = await supabase
        .from('profiles')
        .update(sanitizedData)
        .eq('id', user.id)
        .select()
        .single();

      if (error) {
        console.error("Failed to update profile:", error.message, error.details, error.hint);
        throw new Error(`Failed to update profile: ${error.message}`);
      }
      
      // Update local state with the returned data from Supabase
      if (data) {
        setProfile(data);
        
        // Save to AsyncStorage as cache
        await AsyncStorage.setItem(`profile:${user.id}`, JSON.stringify(data));
        
        console.log("Profile updated successfully:", data.id);
      }
      
    } catch (err: any) {
      const errorMessage = err.message || "Unknown error occurred while updating profile";
      console.error("Error updating profile:", errorMessage);
      setError(errorMessage);
      throw err; // Re-throw to allow calling code to handle the error
    } finally {
      setLoading(false);
    }
  };

  // Function to manually refresh the profile data
  const refreshProfile = async (forceRefresh = false): Promise<UserProfile | null> => {
    console.log("Refreshing profile with forceRefresh =", forceRefresh);
    return await fetchProfile(forceRefresh);
  };

  // Get the current onboarding step
  const getCurrentOnboardingStep = () => {
    if (!profile) return 'welcome';
    
    if (profile.has_completed_onboarding) {
      return 'completed';
    }
    
    return profile.current_onboarding_step || 'welcome';
  };

  // Mark onboarding as complete
  const completeOnboarding = async () => {
    if (!user || !profile) return;
    
    try {
      console.log("Marking onboarding as complete for user:", user.id);
      
      // Update profile with explicit onboarding completion flag
      await updateProfile({
        has_completed_onboarding: true,
        current_onboarding_step: 'completed'
      });
      
      // Double-check that onboarding is marked as complete in the database
      const { data, error } = await supabase
        .from('profiles')
        .select('has_completed_onboarding')
        .eq('id', user.id)
        .single();
      
      if (error) {
        console.error("Error verifying onboarding completion:", error);
        return;
      }
      
      if (!data.has_completed_onboarding) {
        console.error("Onboarding completion flag not set in database, forcing update");
        // Force update directly to ensure it's set
        await supabase
          .from('profiles')
          .update({ has_completed_onboarding: true, current_onboarding_step: 'completed' })
          .eq('id', user.id);
      }
      
    } catch (e) {
      console.error('Error completing onboarding:', e);
      setError('Failed to complete onboarding.');
    }
  };

  // Check user profile and route accordingly based on onboarding status
  const checkAndRouteUser = async () => {
    if (!user) {
      console.log("No user, redirecting to login page");
      router.replace('/login');
      return;
    }

    // Wait for profile loading to complete
    if (loading) {
      console.log("Profile still loading, waiting...");
      return;
    }

    // If profile is null after loading complete, try to fetch again
    if (!profile) {
      console.log("No profile found after loading, fetching profile...");
      await fetchProfile();
      return;
    }

    console.log("Checking profile status:", profile.current_onboarding_step, "Has completed onboarding:", profile.has_completed_onboarding);

    // Navigate based on onboarding status
    if (!profile.has_completed_onboarding) {
      const step = profile.current_onboarding_step || 'welcome';
      console.log(`User has not completed onboarding, redirecting to step: ${step}`);
      router.replace(`/(onboarding)/${step}`);
    } else {
      console.log("User has completed onboarding, redirecting to main app");
      router.replace('/(tabs)');
    }
  };

  // Fetch profile when user changes
  useEffect(() => {
    if (user) {
      fetchProfile();
    } else {
      setProfile(null);
      setLoading(false);
    }
  }, [user]);

  // Helper function to retrieve profile from Supabase
  const retrieveFromDb = async () => {
    if (!user) {
      console.error('No user found for profile retrieval');
      return null;
    }
    
    const { data, error } = await supabase
      .from('profiles')
      .select()
      .eq('id', user.id)
      .maybeSingle();
    
    if (error) {
      console.error('Error retrieving profile from database:', error);
      return null;
    }
    
    return data;
  };

  // Synchronize data between root properties and nested objects
  const synchronizeProfileData = (profile: UserProfile): UserProfile => {
    // Create a copy of the profile to avoid mutating the original
    const syncedProfile = { ...profile };
    
    // Log initial state for debugging
    console.log("Starting synchronization of profile data");
    
    try {
      // Ensure diet_preferences exists
      if (!syncedProfile.diet_preferences) {
        syncedProfile.diet_preferences = {
          meal_frequency: 3,
          diet_type: 'balanced',
          allergies: [],
          excluded_foods: [],
          favorite_foods: []
        };
      }
      
      // Ensure workout_preferences exists
      if (!syncedProfile.workout_preferences) {
        syncedProfile.workout_preferences = {
          preferred_days: ['monday', 'wednesday', 'friday'],
          workout_duration: 30
        };
      }
      
      // Ensure body_analysis exists
      if (!syncedProfile.body_analysis) {
        syncedProfile.body_analysis = {};
      }
      
      // Sync country_region between root and diet_preferences
      if (syncedProfile.country_region && !syncedProfile.diet_preferences.country_region) {
        syncedProfile.diet_preferences.country_region = syncedProfile.country_region;
      } else if (!syncedProfile.country_region && syncedProfile.diet_preferences.country_region) {
        syncedProfile.country_region = syncedProfile.diet_preferences.country_region;
      }
      
      // Sync workout plan - ensure it's properly stored in both locations
      if (syncedProfile.workout_plan) {
        // Make sure the workout plan has the expected structure
        if (!syncedProfile.workout_plan.id) {
          syncedProfile.workout_plan.id = `workout_plan_${Date.now()}`;
        }
        
        // Ensure weeklySchedule is present and valid
        if (!syncedProfile.workout_plan.weeklySchedule || !Array.isArray(syncedProfile.workout_plan.weeklySchedule)) {
          // Try to reconstruct from workoutDays if available (legacy format)
          if (syncedProfile.workout_plan.workoutDays && Array.isArray(syncedProfile.workout_plan.workoutDays)) {
            syncedProfile.workout_plan.weeklySchedule = syncedProfile.workout_plan.workoutDays;
          } else {
            // Initialize with empty array if nothing is available
            syncedProfile.workout_plan.weeklySchedule = [];
          }
        }
        
        // Also store in workout_preferences for redundancy
        // Use type assertion to handle additional properties not in the interface
        (syncedProfile.workout_preferences as any).workout_plan = syncedProfile.workout_plan;
      } else if ((syncedProfile.workout_preferences as any).workout_plan) {
        // If only in workout_preferences, copy to root
        syncedProfile.workout_plan = (syncedProfile.workout_preferences as any).workout_plan;
      }
      
      // Sync meal plans - ensure they're properly stored in both locations
      if (syncedProfile.meal_plans) {
        // Make sure the meal plan has the expected structure
        if (!syncedProfile.meal_plans.id) {
          syncedProfile.meal_plans.id = `meal_plan_${Date.now()}`;
        }
        
        // Ensure weeklyPlan is present and valid
        if (!syncedProfile.meal_plans.weeklyPlan || !Array.isArray(syncedProfile.meal_plans.weeklyPlan)) {
          // Initialize with empty array if nothing is available
          syncedProfile.meal_plans.weeklyPlan = [];
        }
        
        // Also store in diet_preferences for redundancy
        // Use type assertion to handle additional properties not in the interface
        (syncedProfile.diet_preferences as any).meal_plans = syncedProfile.meal_plans;
      } else if ((syncedProfile.diet_preferences as any).meal_plans) {
        // If only in diet_preferences, copy to root
        syncedProfile.meal_plans = (syncedProfile.diet_preferences as any).meal_plans;
      }
      
      // Handle measurements - sync between root and body_analysis
      if (syncedProfile.height_cm && !syncedProfile.body_analysis.height_cm) {
        syncedProfile.body_analysis.height_cm = syncedProfile.height_cm;
      } else if (!syncedProfile.height_cm && syncedProfile.body_analysis.height_cm) {
        syncedProfile.height_cm = syncedProfile.body_analysis.height_cm;
      }
      
      if (syncedProfile.weight_kg && !syncedProfile.body_analysis.weight_kg) {
        syncedProfile.body_analysis.weight_kg = syncedProfile.weight_kg;
      } else if (!syncedProfile.weight_kg && syncedProfile.body_analysis.weight_kg) {
        syncedProfile.weight_kg = syncedProfile.body_analysis.weight_kg;
      }
      
      console.log("Profile data synchronization complete");
      return syncedProfile;
    } catch (error) {
      console.error("Error during profile synchronization:", error);
      // Return the original profile if synchronization fails
      return profile;
    }
  };

  // Context value
  const value = {
    profile,
    loading,
    error,
    updateProfile,
    refreshProfile,
    getCurrentOnboardingStep,
    completeOnboarding,
    checkAndRouteUser
  };

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
};

/**
 * Process unit conversions and store original values
 */
function processUnitConversions(
  mergedProfile: UserProfile,
  updates: Partial<UserProfile> & Record<string, any>
): UserProfile {
  const result = { ...mergedProfile };
  
  // Handle nested objects that need special merging
  if (updates.body_analysis) {
    console.log('Processing body_analysis update:', JSON.stringify(updates.body_analysis, null, 2));
    
    // Create a proper body_analysis object
    const bodyAnalysisUpdate = { ...updates.body_analysis };
    
    // Ensure body_analysis exists in the merged profile
    if (!result.body_analysis || typeof result.body_analysis !== 'object') {
      result.body_analysis = {};
    }
    
    // Convert any camelCase properties to snake_case for database compatibility
    if (bodyAnalysisUpdate.bodyType) {
      bodyAnalysisUpdate.body_type = bodyAnalysisUpdate.bodyType;
    }
    
    if (bodyAnalysisUpdate.analysisText) {
      bodyAnalysisUpdate.analysis_text = bodyAnalysisUpdate.analysisText;
    }
    
    if (bodyAnalysisUpdate.bodyProportions) {
      bodyAnalysisUpdate.body_proportions = bodyAnalysisUpdate.bodyProportions;
    }
    
    if (bodyAnalysisUpdate.recommendedFocusAreas) {
      bodyAnalysisUpdate.recommended_focus_areas = bodyAnalysisUpdate.recommendedFocusAreas;
    }
    
    // Deep merge the body_analysis object, preserving any existing data
    result.body_analysis = {
      ...result.body_analysis,
      ...bodyAnalysisUpdate
    };
    
    console.log('Updated body_analysis:', JSON.stringify(result.body_analysis, null, 2));
  }
  
  if (updates.workout_preferences) {
    console.log('Processing workout_preferences update:', updates.workout_preferences);
    // Ensure workout_preferences object is properly merged
    if (!result.workout_preferences) {
      // Initialize with empty values that match the interface
      result.workout_preferences = {
        preferred_days: [],
        workout_duration: 0,
        intensity_level: 'beginner',
        focus_areas: [],
        equipment_available: []
      };
    }
    
    // Deep merge the workout_preferences object
    result.workout_preferences = {
      ...result.workout_preferences,
      ...updates.workout_preferences
    };
  }
  
  // Handle height conversion if present (ft to cm)
  if ((updates as any).height !== undefined) {
    const heightUnit = (updates as any).heightUnit || (result.body_analysis && result.body_analysis.height_unit) || 'cm';
    const heightValue = (updates as any).height;
    let heightInCm = heightValue;
    
    // Convert from feet to cm if needed
    if (heightUnit === 'ft') {
      heightInCm = feetToCm(heightValue);
    }
    
    // Store in the standardized column
    result.height_cm = heightInCm;
    
    // Store original value and unit in body_analysis
    if (!result.body_analysis) result.body_analysis = {};
    result.body_analysis.original_height = heightValue;
    result.body_analysis.height_unit = heightUnit;
    result.body_analysis.height_cm = heightInCm;
    
    // Remove non-existent column to prevent errors
    delete (result as any).height;
  }
  
  // Handle weight conversion if present (lb to kg)
  if ((updates as any).weight !== undefined || (updates as any).currentWeight !== undefined) {
    const weightUnit = (updates as any).weightUnit || (result.body_analysis && result.body_analysis.weight_unit) || 'kg';
    const weightValue = (updates as any).weight !== undefined ? (updates as any).weight : (updates as any).currentWeight;
    let weightInKg = weightValue;
    
    // Convert from lbs to kg if needed
    if (weightUnit === 'lbs') {
      weightInKg = lbsToKg(weightValue);
    }
    
    // Store in the standardized column
    result.weight_kg = weightInKg;
    
    // Store original value and unit in body_analysis
    if (!result.body_analysis) result.body_analysis = {};
    result.body_analysis.original_weight = weightValue;
    result.body_analysis.weight_unit = weightUnit;
    result.body_analysis.weight_kg = weightInKg;
    
    // Remove non-existent columns to prevent errors
    delete (result as any).weight;
    delete (result as any).currentWeight;
  }
  
  // Handle target weight conversion (lb to kg)
  if ((updates as any).targetWeight !== undefined || (updates as any).target_weight !== undefined) {
    const weightUnit = (updates as any).weightUnit || (result.body_analysis && result.body_analysis.weight_unit) || 'kg';
    const targetWeightValue = (updates as any).targetWeight !== undefined ? (updates as any).targetWeight : (updates as any).target_weight;
    let targetWeightInKg = targetWeightValue;
    
    // Convert from lbs to kg if needed
    if (weightUnit === 'lbs') {
      targetWeightInKg = lbsToKg(targetWeightValue);
    }
    
    // Store in the standardized column
    result.target_weight_kg = targetWeightInKg;
    
    // Store original value and unit in body_analysis
    if (!result.body_analysis) result.body_analysis = {};
    result.body_analysis.original_target_weight = targetWeightValue;
    result.body_analysis.target_weight_kg = targetWeightInKg;
    
    // Remove non-existent columns to prevent errors
    delete (result as any).target_weight;
    delete (result as any).targetWeight;
  }
  
  // Handle fitness goal mapping
  if ((updates as any).fitnessGoal || (updates as any).fitness_goal) {
    const fitnessGoal = (updates as any).fitnessGoal || (updates as any).fitness_goal;
    result.weight_goal = fitnessGoal;
    
    // Ensure fitness_goals array exists
    if (!Array.isArray(result.fitness_goals)) {
      result.fitness_goals = [];
    }
    
    // Update the array too for consistency
    result.fitness_goals = [fitnessGoal];
    
    // Remove non-existent columns
    delete (result as any).fitnessGoal;
    delete (result as any).fitness_goal;
  }
  
  return result as UserProfile;
}
