import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile } from '../types/profile';

// Constants for storage keys
const ONBOARDING_STATUS_KEY = 'onboarding_status';
const LOCAL_PROFILE_KEY = 'local_profile';

// Current version of the onboarding data structure
const ONBOARDING_DATA_VERSION = 1;

interface OnboardingStatus {
  completed: boolean;
  timestamp: number;
  version: number;
  step: string;
}

/**
 * Mark onboarding as complete with redundant storage mechanisms
 * This ensures that onboarding status is preserved across app launches
 * 
 * @param profile The user profile to update (optional)
 * @returns Promise<boolean> indicating success
 */
export async function markOnboardingComplete(profile?: UserProfile): Promise<boolean> {
  try {
    console.log('📝 Marking onboarding as complete with redundancy');
    
    // First, create onboarding status object
    const onboardingStatus: OnboardingStatus = {
      completed: true,
      timestamp: Date.now(),
      version: ONBOARDING_DATA_VERSION,
      step: 'completed'
    };
    
    // Store in dedicated storage for redundancy
    await AsyncStorage.setItem(ONBOARDING_STATUS_KEY, JSON.stringify(onboardingStatus));
    
    // If profile is provided, update it and save back to storage
    if (profile) {
      // Update profile with completion status
      const updatedProfile = {
        ...profile,
        has_completed_onboarding: true,
        has_completed_local_onboarding: true,
        current_onboarding_step: 'completed'
      };
      
      // Save the updated profile
      await AsyncStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(updatedProfile));
      console.log('✅ Updated and saved profile with onboarding completion status');
    } else {
      // If no profile provided, we still need to update the stored profile
      try {
        const profileJson = await AsyncStorage.getItem(LOCAL_PROFILE_KEY);
        if (profileJson) {
          const storedProfile = JSON.parse(profileJson);
          const updatedProfile = {
            ...storedProfile,
            has_completed_onboarding: true,
            has_completed_local_onboarding: true,
            current_onboarding_step: 'completed'
          };
          
          await AsyncStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(updatedProfile));
          console.log('✅ Updated stored profile with onboarding completion status');
        }
      } catch (profileError) {
        console.error('Error updating stored profile:', profileError);
        // Continue even if this fails since we have redundant storage
      }
    }
    
    // Create a fallback flag as absolute last resort
    await AsyncStorage.setItem('onboarding_completed', 'true');
    
    return true;
  } catch (error) {
    console.error('❌ Error marking onboarding as complete:', error);
    return false;
  }
}

/**
 * Check if onboarding is complete by checking multiple data sources
 * This creates redundancy to ensure we don't lose onboarding status
 * 
 * @param profile The user profile to check (optional)
 * @returns Promise<boolean> indicating if onboarding is complete
 */
export async function isOnboardingComplete(profile?: UserProfile): Promise<boolean> {
  try {
    console.log('🔍 Checking onboarding completion status from multiple sources');
    
    // Check each source and count positive results
    let completionIndicators = 0;
    let totalIndicators = 0;
    
    // Source 1: Check dedicated onboarding status
    try {
      const statusJson = await AsyncStorage.getItem(ONBOARDING_STATUS_KEY);
      if (statusJson) {
        const status = JSON.parse(statusJson) as OnboardingStatus;
        if (status.completed) {
          console.log('✓ Onboarding status indicates completion');
          completionIndicators++;
        }
        totalIndicators++;
      }
    } catch (error) {
      console.warn('Could not read onboarding status:', error);
    }
    
    // Source 2: Check profile data
    const profileToCheck = profile || await getProfileFromStorage();
    if (profileToCheck) {
      totalIndicators++;
      
      // Check local onboarding completion flag
      if (profileToCheck.has_completed_local_onboarding) {
        console.log('✓ Profile has_completed_local_onboarding is true');
        completionIndicators++;
      }
      
      // Check server onboarding completion flag
      if (profileToCheck.has_completed_onboarding) {
        console.log('✓ Profile has_completed_onboarding is true');
        completionIndicators++;
        totalIndicators++; // Count this as an additional indicator
      }
      
      // Check onboarding step
      if (profileToCheck.current_onboarding_step === 'completed') {
        console.log('✓ Profile current_onboarding_step is "completed"');
        completionIndicators++;
        totalIndicators++; // Count this as an additional indicator
      }
    }
    
    // Source 3: Check fallback flag
    try {
      const fallbackFlag = await AsyncStorage.getItem('onboarding_completed');
      if (fallbackFlag === 'true') {
        console.log('✓ Fallback onboarding flag is set to true');
        completionIndicators++;
      }
      totalIndicators++;
    } catch (error) {
      console.warn('Could not read fallback flag:', error);
    }
    
    // Consider onboarding complete if majority of indicators say so
    const isComplete = totalIndicators > 0 && (completionIndicators / totalIndicators) >= 0.5;
    console.log(`Onboarding completion check: ${completionIndicators}/${totalIndicators} indicators positive → ${isComplete ? 'COMPLETE' : 'INCOMPLETE'}`);
    
    return isComplete;
  } catch (error) {
    console.error('❌ Error checking onboarding completion:', error);
    return false;
  }
}

/**
 * Repair onboarding status if inconsistencies are detected
 * This ensures all indicators are in sync
 * 
 * @returns Promise<boolean> indicating success
 */
export async function repairOnboardingStatus(): Promise<boolean> {
  try {
    console.log('🔧 Repairing onboarding status consistency');
    
    // Get profile from storage
    const profile = await getProfileFromStorage();
    if (!profile) {
      console.warn('No profile found to repair');
      return false;
    }
    
    // Check different indicators
    const hasLocalFlag = profile.has_completed_local_onboarding === true;
    const hasServerFlag = profile.has_completed_onboarding === true;
    const hasCompletedStep = profile.current_onboarding_step === 'completed';
    
    // Check status storage
    let statusObj: OnboardingStatus | null = null;
    try {
      const statusJson = await AsyncStorage.getItem(ONBOARDING_STATUS_KEY);
      if (statusJson) {
        statusObj = JSON.parse(statusJson);
      }
    } catch (error) {
      console.warn('Could not read onboarding status during repair:', error);
    }
    
    // Check fallback flag
    let hasFallbackFlag = false;
    try {
      const fallbackFlag = await AsyncStorage.getItem('onboarding_completed');
      hasFallbackFlag = fallbackFlag === 'true';
    } catch (error) {
      console.warn('Could not read fallback flag during repair:', error);
    }
    
    // Count positive indicators
    const indicators = [hasLocalFlag, hasServerFlag, hasCompletedStep, statusObj?.completed === true, hasFallbackFlag];
    const positiveCount = indicators.filter(Boolean).length;
    
    // If majority indicates completion, update all to completed
    if (positiveCount >= 3) {
      console.log('Majority indicates onboarding is complete, updating all flags');
      return await markOnboardingComplete(profile);
    }
    // If minority indicates completion but completed step is set, consider it complete
    else if (positiveCount >= 1 && hasCompletedStep) {
      console.log('Onboarding step indicates completion, updating all flags');
      return await markOnboardingComplete(profile);
    }
    // Otherwise, no repair needed for incomplete onboarding
    else {
      console.log('Onboarding is incomplete, no repair needed');
      return true;
    }
  } catch (error) {
    console.error('❌ Error repairing onboarding status:', error);
    return false;
  }
}

/**
 * Helper function to get profile from AsyncStorage
 * 
 * @returns Promise<UserProfile | null>
 */
async function getProfileFromStorage(): Promise<UserProfile | null> {
  try {
    const profileJson = await AsyncStorage.getItem(LOCAL_PROFILE_KEY);
    if (profileJson) {
      return JSON.parse(profileJson);
    }
    return null;
  } catch (error) {
    console.error('Error reading profile from storage:', error);
    return null;
  }
}
