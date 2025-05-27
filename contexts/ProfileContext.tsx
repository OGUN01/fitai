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
import { isSyncInProgress, getSyncStatus } from '../utils/syncLocalData';
import { isOnboardingComplete, markOnboardingComplete, repairOnboardingStatus } from '../utils/onboardingPersistence';
import persistenceAdapter from '../utils/persistenceAdapter';
import StorageKeys from '../utils/storageKeys';
import { WorkoutCompletion, MealCompletion } from '../types/tracking';

// Constants for local storage keys
const LOCAL_PROFILE_KEY = 'local_profile';

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
      const sourceValue = source[key]; // Store source[key] to avoid repeated lookups
      if (isObject(sourceValue)) {
        // If property doesn't exist in target or target property is not an object, assign source directly
        if (!(key in target) || !isObject(target[key])) {
          Object.assign(output, { [key]: sourceValue });
        } else {
          // If property exists in target and both are objects, merge them recursively
          // We know sourceValue is an object here, and target[key] is checked above
          output[key] = deepMerge(target[key], sourceValue as Partial<T[Extract<keyof T, string>]>);
        }
      } else {
        // For non-object properties (including null, undefined, primitives, arrays), simply overwrite with source value
        Object.assign(output, { [key]: sourceValue });
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

// Define the shape of our ProfileContext
interface ProfileContextType {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  updateProfile: (updatedFields: Partial<UserProfile>) => Promise<void>;
  refreshProfile: (forceRefresh?: boolean) => Promise<UserProfile | null>;
  getCurrentOnboardingStep: () => Promise<string>;
  completeOnboarding: () => Promise<void>;
  checkAndRouteUser: () => Promise<void>;
}

// Create the context with default values
const ProfileContext = createContext<ProfileContextType>({
  profile: null,
  loading: false,
  error: null,
  updateProfile: async () => {},
  refreshProfile: async () => null,
  getCurrentOnboardingStep: async () => '',
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

  // Helper function to get the profile from storage for authenticated users
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

  // New helper function to get local profile for non-authenticated users
  const getLocalProfileFromStorage = async () => {
    try {
      const localProfileData = await AsyncStorage.getItem(LOCAL_PROFILE_KEY);
      return localProfileData ? JSON.parse(localProfileData) : null;
    } catch (error) {
      console.error("Error getting local profile from storage:", error);
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

  // Function to create a new profile for authenticated users
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

  // New function to create a local profile for non-authenticated users
  const createLocalProfile = async (): Promise<UserProfile | null> => {
    try {
      console.log("Creating new local profile");
      
      // Create a default local profile
      const localProfile: UserProfile = {
        id: 'local_user', // Use a fixed ID for local user
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
        has_completed_local_onboarding: false, // New field for local mode
        current_onboarding_step: 'welcome'
      } as UserProfile;
      
      // Ensure data is synchronized between nested objects and root properties
      const synchronizedProfile = synchronizeProfileData(localProfile);
      
      // Save to AsyncStorage
      try {
        await AsyncStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(synchronizedProfile));
        console.log("Local profile created and saved to AsyncStorage");
      } catch (storageError) {
        console.error("Error saving local profile:", storageError);
        throw storageError;
      }
      
      setProfile(synchronizedProfile);
      return synchronizedProfile;
    } catch (error) {
      console.error("Unexpected error creating local profile:", error);
      setError("An unexpected error occurred creating your profile");
      return null;
    }
  };

  // Function to fetch profile from Supabase for authenticated users
  const fetchProfile = async (forceRefresh = false): Promise<UserProfile | null> => {
    setLoading(true);
    
    try {
      // If no user is logged in, try to get local profile
      if (!user) {
        console.log("No authenticated user, switching to local profile");
        const localProfile = await getLocalProfileFromStorage();
        
        if (localProfile) {
          console.log("Local profile found:", {
            has_completed_local_onboarding: localProfile.has_completed_local_onboarding,
            current_step: localProfile.current_onboarding_step
          });
          
          // Ensure the has_completed_local_onboarding flag is set correctly
          // This is critical to prevent showing onboarding again on app restart
          if (localProfile.current_onboarding_step === 'completed' && !localProfile.has_completed_local_onboarding) {
            console.log("Fixing local profile: Setting has_completed_local_onboarding to true");
            localProfile.has_completed_local_onboarding = true;
            await AsyncStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(localProfile));
          }
          
          // Fetch completion data for local user
          try {
            const completedWorkouts = await persistenceAdapter.getItem<WorkoutCompletion[]>(StorageKeys.COMPLETED_WORKOUTS, []);
            const completedMeals = await persistenceAdapter.getItem<MealCompletion[]>(StorageKeys.MEALS, []);

            console.log(`Fetched local completions: ${completedWorkouts?.length || 0} workouts, ${completedMeals?.length || 0} meals`);

            // Add completion data to the profile object
            localProfile.completedWorkouts = completedWorkouts || [];
            localProfile.completedMeals = completedMeals || [];

          } catch (completionError) {
            console.error("Error fetching local completion data:", completionError);
            // Assign empty arrays if fetching fails to avoid breaking the profile structure
            localProfile.completedWorkouts = [];
            localProfile.completedMeals = [];
          }
          
          // Ensure localProfileData is a full UserProfile before processing
          const processedData = processProfileData(localProfile);
          const profileData = synchronizeProfileData(processedData); // Ensure synchronization
          console.log('[ProfileContext] Setting local profile state:', JSON.stringify(profileData, null, 2));
          setProfile(profileData);
          setLoading(false);
          return profileData;
        } else {
          console.log("No local profile found, creating new one");
          const newLocalProfile = await createLocalProfile();
          setLoading(false);
          return newLocalProfile;
        }
      }
      
      console.log("🔍 FETCH PROFILE - Fetching profile for user:", user.id);
      console.log("🔍 FETCH PROFILE - Force refresh:", forceRefresh);
      
      // Check if data synchronization is in progress - if so, delay profile fetch
      const syncInProgress = await isSyncInProgress();
      if (syncInProgress && !forceRefresh) {
        console.log("🔍 FETCH PROFILE - Sync in progress, waiting for completion");
        // Wait and then try again
        setLoading(false);
        setTimeout(() => refreshProfile(forceRefresh), 1000);
        return null;
      }
      
      // Try getting from AsyncStorage first (only if not forcing refresh)
      let cachedProfile: UserProfile | null = null;
      
      if (!forceRefresh) {
        try {
          const cachedData = await AsyncStorage.getItem(`profile:${user.id}`);
          
          if (cachedData) {
            cachedProfile = JSON.parse(cachedData) as UserProfile;
            console.log("🔍 FETCH PROFILE - Found cached profile with country_region:", cachedProfile.country_region);
            console.log("🔍 FETCH PROFILE - Diet preferences country_region:", cachedProfile.diet_preferences?.country_region);
            console.log("🔍 FETCH PROFILE - Has meal plans:", !!cachedProfile.meal_plans);
            
            // When login just happened, we've already synced data to server
            // Check for 'recently_synced' flag that might be set by AuthContext
            const recentlySynced = await AsyncStorage.getItem(`recently_synced:${user.id}`);
            if (recentlySynced) {
              console.log("🔍 FETCH PROFILE - Using cached profile due to recent sync");
              
              // Clear the sync flag after using it
              await AsyncStorage.removeItem(`recently_synced:${user.id}`);
              
              // Check if there were any sync errors
              const lastSyncErrorJson = await AsyncStorage.getItem('last_sync_error');
              if (lastSyncErrorJson) {
                const syncError = JSON.parse(lastSyncErrorJson);
                console.warn("🔍 FETCH PROFILE - Note: Last sync had errors:", syncError.message);
                // We still use the cached profile even with sync errors
              }
              
              setProfile(cachedProfile);
              setLoading(false);
              return cachedProfile;
            }
          }
        } catch (error) {
          console.error("Error retrieving cached profile:", error);
        }
      }
      
      // Get last sync status to check for issues
      try {
        const syncStatus = await getSyncStatus(user.id);
        if (syncStatus && !syncStatus.success) {
          console.warn("🔍 FETCH PROFILE - Last sync failed:", syncStatus.error);
          // Continue with profile fetch despite sync issues
        }
      } catch (error) {
        console.error("Error checking sync status:", error);
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
      
      // LOCAL MODE: Handle updates for non-authenticated users
      if (!user) {
        setLoading(true);
        console.log("Updating local profile (non-authenticated mode)");
        
        // Get the current local profile or create a new one
        const currentLocalProfile = await getLocalProfileFromStorage() || await createLocalProfile();
        if (!currentLocalProfile) {
          throw new Error("Failed to get or create local profile");
        }
        
        // Merge the current profile with updates
        const mergedProfile = deepMerge(currentLocalProfile, updatedFields);
        
        // Process unit conversions and ensure all fields
        const processedProfile = processProfileData(mergedProfile);
        
        // Synchronize data between nested objects and root properties
        const synchronizedProfile = synchronizeProfileData(processedProfile);
        
        // Save to AsyncStorage
        await AsyncStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(synchronizedProfile));
        
        // Update local state
        setProfile(synchronizedProfile);
        console.log("Local profile updated successfully");
        setLoading(false);
        return;
      }
      
      // AUTHENTICATED MODE: Continue with the existing update logic
      setLoading(true);
      
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
      
      // Preserve current onboarding step
      let currentStep = null;
      if (updatedFields.current_onboarding_step) {
        currentStep = updatedFields.current_onboarding_step;
        console.log(`Updating onboarding step to: ${currentStep}`);
      }
      
      // Deep merge the current profile with the updated fields
      const mergedProfile = deepMerge(currentProfile, updatedFields);
      
      // If we're updating workout preferences, make sure they are properly synced
      if (updatedFields.workout_preferences || 
          updatedFields.fitness_level || 
          updatedFields.fitness_goals) {
        console.log("Synchronizing workout preferences");
        synchronizeWorkoutPreferences(mergedProfile);
      }
      
      // If we're updating diet preferences, make sure they are properly synced
      if (updatedFields.diet_preferences || 
          updatedFields.diet_type || 
          updatedFields.allergies) {
        console.log("Synchronizing diet preferences");
        synchronizeDietPreferences(mergedProfile);
      }
      
      // Synchronize weight fields between body_analysis and root properties
      synchronizeWeightFields(mergedProfile, 0);
      
      // Filter the profile to only include fields that exist in the database schema
      const dbSafeProfile = sanitizeForDatabase(mergedProfile);
      
      // Extra protection for critical fields
      if (explicityCompletingOnboarding) {
        console.log("Explicitly ensuring has_completed_onboarding=true is included");
        dbSafeProfile.has_completed_onboarding = true;
      }
      
      // If onboarding step is being updated, update the tracker
      if (currentStep) {
        // Create a profile object with the current step to pass to updateOnboardingStep
        const profileWithStep = {
          ...mergedProfile,
          current_onboarding_step: currentStep
        };
        await updateOnboardingStep(profileWithStep);
      }
      
      console.log("Updating profile in database");
      
      // Update the profile in the database
      const { data, error } = await supabase
        .from('profiles')
        .update(dbSafeProfile)
        .eq('id', user.id)
        .select()
        .single();

      if (error) {
        console.error("Error updating profile:", error);
        throw error;
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

  // Get the current onboarding step with improved reliability
  const getCurrentOnboardingStep = async () => {
    // Validate that we have a profile
    if (!profile) return 'welcome';
    
    // ENHANCED: First check our reliable utility for onboarding completion
    try {
      const onboardingComplete = await isOnboardingComplete(profile);
      if (onboardingComplete) {
        console.log('✅ Using enhanced onboarding check - onboarding is complete');
        return 'completed';
      }
    } catch (error) {
      console.error('Error checking onboarding completion status:', error);
      // Continue with fallback checks if this fails
    }
    
    // FALLBACK: LOCAL MODE: Check for local onboarding completion
    if (!user && profile.has_completed_local_onboarding) {
      return 'completed';
    }
    
    // FALLBACK: AUTHENTICATED MODE: Check for server onboarding completion
    if (user && profile.has_completed_onboarding) {
      return 'completed';
    }
    
    return profile.current_onboarding_step || 'welcome';
  };

  // Function to complete the onboarding process with enhanced reliability
  const completeOnboarding = async () => {
    try {
      console.log("Starting enhanced onboarding completion process");
      
      // Use our robust utility for reliable onboarding completion
      const success = await markOnboardingComplete(profile || undefined);
      
      if (!success) {
        console.warn("Enhanced onboarding marker failed, falling back to traditional method");
      }
      
      if (!user) {
        // LOCAL MODE: Complete local onboarding
        console.log("Completing onboarding in local mode");
        await updateProfile({
          has_completed_local_onboarding: true,
          current_onboarding_step: 'completed'
        });
      } else {
        // AUTHENTICATED MODE: Complete server onboarding
        console.log("Completing onboarding in authenticated mode");
        await updateProfile({
          has_completed_onboarding: true,
          current_onboarding_step: 'completed'
        });
      }
      
      console.log("Onboarding completed successfully with multiple safeguards");
    } catch (error) {
      console.error("Error in completeOnboarding:", error);
      throw error;
    }
  };

  // Check user's auth and onboarding status with enhanced reliability, and route accordingly
  const checkAndRouteUser = async () => {
    try {
      console.log('🔍 Enhanced checking of user and onboarding status');
      
      // First attempt to repair any potentially inconsistent onboarding state
      await repairOnboardingStatus();
      
      // Use enhanced onboarding check first for maximum reliability
      const localProfile = await getLocalProfileFromStorage();
      const onboardingComplete = await isOnboardingComplete(localProfile || undefined);
      
      if (onboardingComplete) {
        console.log('✅ Enhanced check determined onboarding is complete, routing to tabs');
        router.replace('/(tabs)');
        return;
      }
      
      // If onboarding is not complete, proceed with standard flow
      if (user) {
        // User is authenticated
        const currentProfile = await refreshProfile();
        
        // Double-check with traditional method
        if (currentProfile?.has_completed_onboarding) {
          console.log('✅ Profile indicates onboarding is complete, routing to tabs');
          router.replace('/(tabs)');
        } else {
          // User hasn't completed onboarding, determine next step
          const nextStep = currentProfile?.current_onboarding_step || 'welcome';
          console.log(`⏭️ Routing to onboarding step: ${nextStep}`);
          // Use as() to convert to a valid path
          router.replace(`/(onboarding)/${nextStep}` as any);
        }
      } else {
        // LOCAL MODE: User is not authenticated
        // We already have localProfile from above
        
        // Double-check with traditional method as fallback
        if (localProfile?.has_completed_local_onboarding) {
          console.log('✅ Local profile indicates onboarding is complete, routing to tabs');
          router.replace('/(tabs)');
        } else {
          // Local onboarding is not complete, go to welcome
          console.log('🔄 Routing to onboarding welcome');
          router.replace('/(onboarding)/welcome');
        }
      }
    } catch (error) {
      console.error("❌ Error checking user status:", error);
      // Default to welcome if any errors occur
      router.replace('/(onboarding)/welcome');
    }
  };

  // Function to synchronize workout preferences (extracted for clarity)
  const synchronizeWorkoutPreferences = (profile: UserProfile): void => {
    try {
      // Ensure workout_preferences object exists
      if (!profile.workout_preferences) {
        profile.workout_preferences = {
          preferred_days: ['monday', 'wednesday', 'friday'],
          workout_duration: 30
        };
      }
      
      // Sync fitness level both ways
      if (profile.fitness_level && !profile.workout_preferences.fitness_level) {
        profile.workout_preferences.fitness_level = profile.fitness_level;
      } else if (profile.workout_preferences.fitness_level && !profile.fitness_level) {
        profile.fitness_level = profile.workout_preferences.fitness_level;
      }
      
      // Sync fitness goals to focus areas and vice versa
      if (profile.fitness_goals && profile.fitness_goals.length > 0) {
        if (!profile.workout_preferences.focus_areas) {
          profile.workout_preferences.focus_areas = [...profile.fitness_goals];
        }
      } else if (profile.workout_preferences.focus_areas && profile.workout_preferences.focus_areas.length > 0) {
        profile.fitness_goals = [...profile.workout_preferences.focus_areas];
      }
      
      // Sync workout days per week - handle as a custom property that may not be in the type
      if (profile.workout_days_per_week && !profile.workout_preferences.preferred_days?.length) {
        // If we have a number, convert to appropriate number of preferred days
        const daysArray = ['monday', 'wednesday', 'friday', 'saturday'];
        profile.workout_preferences.preferred_days = daysArray.slice(0, profile.workout_days_per_week);
      } else if (profile.workout_preferences.preferred_days?.length && !profile.workout_days_per_week) {
        // Set the days per week based on the number of preferred days
        profile.workout_days_per_week = profile.workout_preferences.preferred_days.length;
      }
    } catch (error) {
      console.error("Error during workout preferences synchronization:", error);
    }
  };

  // Function to ensure profile data is consistent
  const synchronizeProfileData = (profile: UserProfile): UserProfile => {
    try {
      // Create a deep copy to avoid mutating the original
      const synchronizedProfile = { ...profile };
      
      // Call the helper function to synchronize workout preferences
      synchronizeWorkoutPreferences(synchronizedProfile);
      
      // Call the helper function to synchronize diet preferences
      synchronizeDietPreferences(synchronizedProfile);
      
      // Sync country region between root and diet preferences
      if (synchronizedProfile.country_region && 
          (!synchronizedProfile.diet_preferences?.country_region || 
           synchronizedProfile.diet_preferences.country_region !== synchronizedProfile.country_region)) {
        if (!synchronizedProfile.diet_preferences) {
          synchronizedProfile.diet_preferences = {
            meal_frequency: 3,
            diet_type: 'balanced',
            allergies: [],
            excluded_foods: [],
            favorite_foods: [],
            country_region: synchronizedProfile.country_region
          };
        } else {
          synchronizedProfile.diet_preferences.country_region = synchronizedProfile.country_region;
        }
      } else if (synchronizedProfile.diet_preferences?.country_region && 
                (!synchronizedProfile.country_region || 
                 synchronizedProfile.country_region !== synchronizedProfile.diet_preferences.country_region)) {
        synchronizedProfile.country_region = synchronizedProfile.diet_preferences.country_region;
      }
      
      // Ensure weight fields are synchronized between body_analysis and root
      synchronizeWeightFields(synchronizedProfile, 0);
      
      return synchronizedProfile;
    } catch (error) {
      console.error("Error during profile synchronization:", error);
      // Return the original profile if synchronization fails
      return profile;
    }
  };

  // Initialize profile - run on first mount
  useEffect(() => {
    const loadInitialProfile = async () => {
      try {
        console.log('📱 App initialized, loading profile with enhanced reliability');
        // Ensure adapter is initialized before fetching profile
        await persistenceAdapter.initialize(); // Make sure adapter is ready
        await refreshProfile();
        
        // Verify and repair onboarding status on every app launch
        // This ensures we don't lose track of completed onboarding
        await repairOnboardingStatus();
      } catch (error) {
        console.error("❌ Error loading initial profile:", error);
      }
    };
    
    loadInitialProfile();
  }, [user]); // Reload when user changes (login/logout)

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
