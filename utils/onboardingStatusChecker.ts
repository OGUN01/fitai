import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile } from '../types/profile';

// Key constants for storage
const ONBOARDING_STATUS_KEY = 'onboarding_status';
const LOCAL_PROFILE_KEY = 'local_profile';
const FALLBACK_KEY = 'onboarding_completed';
const VERIFICATION_KEY = 'onboarding_verification';

/**
 * Comprehensive onboarding status checker that uses multiple sources
 * to determine if onboarding has been completed
 * 
 * @returns Promise<boolean> - true if onboarding is complete, false otherwise
 */
export async function isOnboardingComplete(): Promise<boolean> {
  try {
    console.log('🔍 Checking onboarding completion status from multiple sources...');
    
    // Create an array to track positive signals that onboarding is complete
    const completionSignals: boolean[] = [];
    
    // Check 1: Direct flag in onboarding status object
    try {
      const onboardingStatusJson = await AsyncStorage.getItem(ONBOARDING_STATUS_KEY);
      if (onboardingStatusJson) {
        const onboardingStatus = JSON.parse(onboardingStatusJson);
        if (onboardingStatus.completed === true) {
          console.log('✅ Signal 1: Dedicated onboarding status indicates completion');
          completionSignals.push(true);
        }
      }
    } catch (error) {
      console.warn('⚠️ Error checking dedicated onboarding status:', error);
    }
    
    // Check 2: Completion flags in profile
    try {
      const profileJson = await AsyncStorage.getItem(LOCAL_PROFILE_KEY);
      if (profileJson) {
        const profile = JSON.parse(profileJson) as UserProfile;
        
        if (profile.has_completed_onboarding === true || 
            profile.has_completed_local_onboarding === true ||
            profile.current_onboarding_step === 'completed') {
          console.log('✅ Signal 2: Profile data indicates onboarding completion');
          completionSignals.push(true);
        }
      }
    } catch (error) {
      console.warn('⚠️ Error checking profile for onboarding status:', error);
    }
    
    // Check 3: Fallback flag
    try {
      const fallbackFlag = await AsyncStorage.getItem(FALLBACK_KEY);
      if (fallbackFlag === 'true') {
        console.log('✅ Signal 3: Fallback flag indicates onboarding completion');
        completionSignals.push(true);
      }
    } catch (error) {
      console.warn('⚠️ Error checking fallback flag:', error);
    }
    
    // Check 4: Verification record (stores timestamp of completion)
    try {
      const verificationJson = await AsyncStorage.getItem(VERIFICATION_KEY);
      if (verificationJson) {
        const verification = JSON.parse(verificationJson);
        if (verification.timestamp && verification.completed === true) {
          console.log('✅ Signal 4: Verification record indicates onboarding completion');
          completionSignals.push(true);
        }
      }
    } catch (error) {
      console.warn('⚠️ Error checking verification record:', error);
    }
    
    // Make a decision based on the completion signals
    // If ANY source indicates completion, consider onboarding complete
    const isComplete = completionSignals.some(signal => signal === true);
    
    console.log(`📊 Onboarding completion status: ${isComplete ? 'COMPLETE' : 'INCOMPLETE'}`);
    console.log(`📊 Positive signals: ${completionSignals.length} out of 4 possible sources`);
    
    // If onboarding is complete but we didn't have all signals, repair the missing signals
    if (isComplete && completionSignals.length < 4) {
      console.log('🔧 Repairing partial onboarding completion records...');
      repairOnboardingStatus(true);
    }
    
    return isComplete;
  } catch (error) {
    console.error('❌ Error checking onboarding completion status:', error);
    return false;
  }
}

/**
 * Repair onboarding status records to ensure consistency
 * This is used when some but not all signals indicate completion
 * 
 * @param isComplete The correct completion status to set
 */
export async function repairOnboardingStatus(isComplete: boolean): Promise<void> {
  try {
    // 1. Update onboarding status object
    const onboardingStatus = {
      completed: isComplete,
      timestamp: Date.now(),
      version: 2, // Increment version to indicate repair
      step: isComplete ? 'completed' : null
    };
    await AsyncStorage.setItem(ONBOARDING_STATUS_KEY, JSON.stringify(onboardingStatus));
    
    // 2. Update profile if it exists
    try {
      const profileJson = await AsyncStorage.getItem(LOCAL_PROFILE_KEY);
      if (profileJson) {
        const profile = JSON.parse(profileJson);
        const updatedProfile = {
          ...profile,
          has_completed_onboarding: isComplete,
          has_completed_local_onboarding: isComplete,
          current_onboarding_step: isComplete ? 'completed' : profile.current_onboarding_step || 'welcome'
        };
        await AsyncStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(updatedProfile));
      }
    } catch (profileError) {
      console.warn('⚠️ Error updating profile during repair:', profileError);
    }
    
    // 3. Update fallback flag
    await AsyncStorage.setItem(FALLBACK_KEY, isComplete ? 'true' : 'false');
    
    // 4. Update verification record
    const verification = {
      completed: isComplete,
      timestamp: Date.now(),
      repaired: true
    };
    await AsyncStorage.setItem(VERIFICATION_KEY, JSON.stringify(verification));
    
    console.log('✅ Onboarding status repair complete');
  } catch (error) {
    console.error('❌ Error repairing onboarding status:', error);
  }
}
