import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile } from '../types/profile';
import supabase from '../lib/supabase';
import { useAuth } from './AuthContext';
import { router } from 'expo-router';
import { getUserWeight, getTargetWeight, synchronizeWeightFields } from '../utils/profileHelpers';

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

// Define the context type
export type ProfileContextType = {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
  getCurrentOnboardingStep: () => string;
  completeOnboarding: () => Promise<void>;
  checkAndRouteUser: () => Promise<void>;
};

// Create the context with default values
const ProfileContext = createContext<ProfileContextType>({
  profile: null,
  loading: true,
  error: null,
  updateProfile: async () => {},
  refreshProfile: async () => {},
  getCurrentOnboardingStep: () => 'welcome',
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

  // Function to fetch profile data from Supabase
  const fetchProfile = async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Try to get from AsyncStorage first for faster loading
      const cachedProfile = await AsyncStorage.getItem(`profile:${user.id}`);
      if (cachedProfile) {
        setProfile(JSON.parse(cachedProfile));
      }

      // Define default profile
      const newProfile: UserProfile = {
        id: user.id,
        has_completed_onboarding: false,
        current_onboarding_step: 'welcome',
      };

      try {
        // Then check Supabase for the latest data - using proper query syntax
        console.log(`Fetching profile for user ID: ${user.id}`);
        const { data, error } = await supabase
          .from('profiles')
          .select()
          .eq('id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error fetching profile:', error);
          
          // Check if the error is because the profile doesn't exist
          if (error.code === 'PGRST116' || error.message.includes('not found')) {
            console.log('Profile not found, creating new profile');
            try {
              // Create a new profile
              const { error: insertError } = await supabase
                .from('profiles')
                .insert([newProfile]);
              
              if (insertError) {
                console.error('Error creating profile:', insertError);
                throw new Error('Failed to create profile');
              }
              
              console.log('New profile created successfully, setting initial profile');
              setProfile(newProfile);
              await AsyncStorage.setItem(`profile:${user.id}`, JSON.stringify(newProfile));
            } catch (insertErr) {
              console.error('Error during profile creation:', insertErr);
              // Still use the local profile even if DB insert fails
              setProfile(newProfile);
              await AsyncStorage.setItem(`profile:${user.id}`, JSON.stringify(newProfile));
            }
          } else {
            // Handle other database errors
            console.error('Database error:', error);
            throw new Error(`Database error: ${error.message}`);
          }
        } else if (data) {
          // Profile exists, update local state
          console.log('Profile found in Supabase:', data);
          setProfile(data);
          await AsyncStorage.setItem(`profile:${user.id}`, JSON.stringify(data));
        } else {
          // No profile found but no error (empty result)
          console.log('No profile found in Supabase, creating new profile');
          try {
            const { error: insertError } = await supabase
              .from('profiles')
              .insert([newProfile]);
            
            if (insertError) {
              console.error('Error creating profile:', insertError);
              throw new Error('Failed to create profile');
            }
            
            setProfile(newProfile);
            await AsyncStorage.setItem(`profile:${user.id}`, JSON.stringify(newProfile));
          } catch (insertErr) {
            console.error('Error during profile creation:', insertErr);
            setProfile(newProfile);
            await AsyncStorage.setItem(`profile:${user.id}`, JSON.stringify(newProfile));
          }
        }
      } catch (dbError) {
        console.error('Error interacting with database:', dbError);
        // Fallback to local profile
        setProfile(newProfile);
        await AsyncStorage.setItem(`profile:${user.id}`, JSON.stringify(newProfile));
      }
    } catch (e) {
      console.error('Unexpected error in fetchProfile:', e);
      setError('Failed to fetch profile.');
    } finally {
      setLoading(false);
    }
  };

  // Update profile function
  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user || !profile) {
      console.error('Cannot update profile: User or profile is not available');
      return;
    }

    try {
      console.log('Updating profile with:', updates);
      
      // Make a deep copy of current profile to compare later for changes
      const originalProfileJson = JSON.stringify(profile);
      
      // Merge updates with current profile data
      let mergedProfile = deepMerge(profile, updates);
      
      // Handle nested objects that need special merging
      if (updates.body_analysis) {
        console.log('Processing body_analysis update:', JSON.stringify(updates.body_analysis, null, 2));
        
        // Create a proper body_analysis object
        const bodyAnalysisUpdate = { ...updates.body_analysis };
        
        // Ensure body_analysis exists in the merged profile
        if (!mergedProfile.body_analysis || typeof mergedProfile.body_analysis !== 'object') {
          mergedProfile.body_analysis = {};
        }
        
        // Deep merge the body_analysis object, preserving any existing data
        mergedProfile.body_analysis = {
          ...mergedProfile.body_analysis,
          ...bodyAnalysisUpdate
        };
        
        console.log('Updated body_analysis:', JSON.stringify(mergedProfile.body_analysis, null, 2));
      }
      
      if (updates.workout_preferences) {
        console.log('Processing workout_preferences update:', updates.workout_preferences);
        // Ensure workout_preferences object is properly merged
        if (!mergedProfile.workout_preferences) {
          // Initialize with empty values that match the interface
          mergedProfile.workout_preferences = {
            preferred_days: [],
            workout_duration: 0,
            intensity_level: 'beginner',
            focus_areas: [],
            equipment_available: []
          };
        }
        
        // Deep merge the workout_preferences object
        mergedProfile.workout_preferences = {
          ...mergedProfile.workout_preferences,
          ...updates.workout_preferences
        };
      }
      
      // Ensure weight fields are synchronized
      if (updates.weight !== undefined || updates.weight_kg !== undefined || 
          (updates.body_analysis && updates.body_analysis.weight_kg !== undefined)) {
        // Determine the updated weight value
        const updatedWeight = updates.weight !== undefined ? updates.weight : 
                             (updates.weight_kg !== undefined ? updates.weight_kg : 
                             (updates.body_analysis?.weight_kg !== undefined ? updates.body_analysis.weight_kg : 
                             getUserWeight(profile)));
        
        // Only update if the weight actually changed
        const currentWeight = getUserWeight(profile);
        if (updatedWeight && (!currentWeight || updatedWeight !== currentWeight)) {
          console.log('Synchronizing weight fields to:', updatedWeight);
          // Update all weight fields to ensure consistency
          mergedProfile.weight = updatedWeight;
          mergedProfile.weight_kg = updatedWeight;
          
          // Ensure body_analysis exists before setting its properties
          if (!mergedProfile.body_analysis) {
            mergedProfile.body_analysis = {};
          }
          
          mergedProfile.body_analysis.weight_kg = updatedWeight;
        } else {
          console.log('Weight unchanged, skipping weight synchronization');
        }
      }
      
      // Similarly synchronize target weight fields
      if (updates.target_weight !== undefined || updates.target_weight_kg !== undefined) {
        const updatedTargetWeight = updates.target_weight !== undefined ? updates.target_weight : 
                                   (updates.target_weight_kg !== undefined ? updates.target_weight_kg : 
                                   getTargetWeight(profile));
        
        // Only update if the target weight actually changed
        const currentTargetWeight = getTargetWeight(profile);
        if (updatedTargetWeight && (!currentTargetWeight || updatedTargetWeight !== currentTargetWeight)) {
          console.log('Synchronizing target weight fields to:', updatedTargetWeight);
          mergedProfile.target_weight = updatedTargetWeight;
          mergedProfile.target_weight_kg = updatedTargetWeight;
        } else {
          console.log('Target weight unchanged, skipping synchronization');
        }
      }
      
      // Check if the profile actually changed to avoid unnecessary updates
      const mergedProfileJson = JSON.stringify(mergedProfile);
      if (mergedProfileJson === originalProfileJson) {
        console.log('Profile unchanged, skipping update');
        return;
      }
      
      // Update local state first for immediate UI response
      setProfile(mergedProfile);
      
      // Save to AsyncStorage
      await AsyncStorage.setItem(`profile:${user.id}`, JSON.stringify(mergedProfile));
      
      // Save to Supabase
      console.log('Saving profile to Supabase:', mergedProfile);
      const { error } = await supabase
        .from('profiles')
        .upsert({ ...mergedProfile, updated_at: new Date().toISOString() });

      if (error) {
        console.error('Error saving profile to Supabase:', error);
        throw new Error(`Failed to update profile: ${error.message}`);
      }
      
      console.log('Profile updated successfully');
    } catch (e) {
      console.error('Error updating profile:', e);
      setError('Failed to update profile.');
      throw e;
    }
  };

  // Function to manually refresh the profile data
  const refreshProfile = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select()
        .eq('id', user.id)
        .maybeSingle();
        
      if (error) {
        console.error('Error refreshing profile:', error);
        throw new Error(`Failed to refresh profile: ${error.message}`);
      }
      
      if (data) {
        console.log('Profile refreshed from Supabase:', data);
        setProfile(data);
        await AsyncStorage.setItem(`profile:${user.id}`, JSON.stringify(data));
      }
    } catch (e) {
      console.error('Unexpected error refreshing profile:', e);
      setError('Failed to refresh profile.');
    }
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
      await updateProfile({
        has_completed_onboarding: true,
        current_onboarding_step: 'completed'
      });
    } catch (e) {
      console.error('Error completing onboarding:', e);
      setError('Failed to complete onboarding.');
    }
  };

  // Check user profile and route accordingly based on onboarding status
  const checkAndRouteUser = async () => {
    if (!user) {
      console.log("No user, redirecting to login page");
      router.replace('/(auth)/login');
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
