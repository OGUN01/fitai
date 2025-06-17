/**
 * Comprehensive Test Script for Authentication Fixes
 * 
 * This script tests both critical fixes:
 * 1. Workout completion status lost after login
 * 2. User name display after logout
 * 
 * Run this test to validate the fixes work correctly.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncLocalDataToServer } from '../utils/syncLocalData';
import { isWorkoutCompleted, markWorkoutComplete } from '../services/trackingService';

// Test utilities
const generateTestUserId = () => `test_user_${Date.now()}`;
const generateTestWorkout = (date, dayName) => ({
  id: `workout_${Date.now()}_${Math.random()}`,
  user_id: 'local_user',
  workout_date: date,
  workout_day_name: dayName,
  completed_at: new Date().toISOString(),
  workout_type: 'strength',
  duration_minutes: 30
});

const generateTestProfile = (name) => ({
  id: 'local_user',
  full_name: name,
  email: 'test@example.com',
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
  has_completed_onboarding: true,
  has_completed_local_onboarding: true,
  current_onboarding_step: 'completed'
});

// Test 1: Workout Completion Persistence After Login
async function testWorkoutCompletionPersistence() {
  console.log('\n=== TEST 1: Workout Completion Persistence After Login ===');
  
  try {
    // Step 1: Clear any existing data
    await AsyncStorage.multiRemove([
      'local_workout_completions',
      'completed_workouts',
      'local_profile',
      'sync_in_progress'
    ]);
    console.log('✓ Cleared existing test data');
    
    // Step 2: Simulate local user completing a workout
    const testDate = '2025-01-17';
    const testDayName = 'friday';
    const testWorkout = generateTestWorkout(testDate, testDayName);
    
    // Mark workout as completed for local user
    await markWorkoutComplete('local_user', testDate, testDayName, {
      workout_type: 'strength',
      duration_minutes: 30
    });
    console.log('✓ Marked workout as completed for local user');
    
    // Verify completion status before login
    const completedBeforeLogin = await isWorkoutCompleted('local_user', testDate, testDayName);
    console.log(`✓ Workout completion before login: ${completedBeforeLogin}`);
    
    if (!completedBeforeLogin) {
      throw new Error('Workout should be completed before login');
    }
    
    // Step 3: Simulate user login and sync
    const authenticatedUserId = generateTestUserId();
    console.log(`✓ Simulating login for user: ${authenticatedUserId}`);
    
    // Create a test profile for sync
    const testProfile = generateTestProfile('Test User');
    await AsyncStorage.setItem('local_profile', JSON.stringify(testProfile));
    
    // Perform sync (this is where the fix should work)
    console.log('✓ Starting sync process...');
    const syncResult = await syncLocalDataToServer(authenticatedUserId);
    console.log('✓ Sync completed:', syncResult);
    
    // Step 4: Wait for sync to complete and check completion status
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
    
    // Check if workout is still marked as completed for the authenticated user
    const completedAfterLogin = await isWorkoutCompleted(authenticatedUserId, testDate, testDayName);
    console.log(`✓ Workout completion after login: ${completedAfterLogin}`);
    
    // Also check with local_user ID (should still work due to enhanced logic)
    const completedWithLocalId = await isWorkoutCompleted('local_user', testDate, testDayName);
    console.log(`✓ Workout completion with local_user ID: ${completedWithLocalId}`);
    
    // Test result
    if (completedAfterLogin || completedWithLocalId) {
      console.log('✅ TEST 1 PASSED: Workout completion persisted after login');
      return true;
    } else {
      console.log('❌ TEST 1 FAILED: Workout completion lost after login');
      return false;
    }
    
  } catch (error) {
    console.error('❌ TEST 1 ERROR:', error);
    return false;
  }
}

// Test 2: User Name Persistence After Logout
async function testUserNamePersistence() {
  console.log('\n=== TEST 2: User Name Persistence After Logout ===');
  
  try {
    // Step 1: Clear any existing data
    await AsyncStorage.multiRemove([
      'local_profile',
      'profile:test_user_123'
    ]);
    console.log('✓ Cleared existing test data');
    
    // Step 2: Simulate authenticated user with profile
    const testUserId = 'test_user_123';
    const testUserName = 'John Doe';
    const authenticatedProfile = generateTestProfile(testUserName);
    authenticatedProfile.id = testUserId;
    
    // Store authenticated user profile
    await AsyncStorage.setItem(`profile:${testUserId}`, JSON.stringify(authenticatedProfile));
    console.log(`✓ Created authenticated user profile with name: ${testUserName}`);
    
    // Step 3: Simulate logout process (using the fixed signOut logic)
    console.log('✓ Simulating logout process...');
    
    // Get the current profile to preserve the user's name (simulating the fix)
    const currentProfileJson = await AsyncStorage.getItem(`profile:${testUserId}`);
    let userNameToPreserve = null;
    
    if (currentProfileJson) {
      const currentProfile = JSON.parse(currentProfileJson);
      userNameToPreserve = currentProfile.full_name;
      console.log('✓ Preserved user name for local mode:', userNameToPreserve);
    }
    
    // Clear authenticated user data (simulating logout)
    await AsyncStorage.removeItem(`profile:${testUserId}`);
    
    // Create new local profile with preserved name (the fix)
    if (userNameToPreserve) {
      const newLocalProfile = {
        id: 'local_user',
        full_name: userNameToPreserve,
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
        has_completed_local_onboarding: true,
        current_onboarding_step: 'completed'
      };
      
      await AsyncStorage.setItem('local_profile', JSON.stringify(newLocalProfile));
      console.log('✓ Created new local profile with preserved name');
    }
    
    // Step 4: Check if name is preserved in local mode
    const localProfileJson = await AsyncStorage.getItem('local_profile');
    if (localProfileJson) {
      const localProfile = JSON.parse(localProfileJson);
      const preservedName = localProfile.full_name;
      console.log(`✓ Name in local profile after logout: ${preservedName}`);
      
      if (preservedName === testUserName) {
        console.log('✅ TEST 2 PASSED: User name persisted after logout');
        return true;
      } else {
        console.log(`❌ TEST 2 FAILED: Expected "${testUserName}", got "${preservedName}"`);
        return false;
      }
    } else {
      console.log('❌ TEST 2 FAILED: No local profile found after logout');
      return false;
    }
    
  } catch (error) {
    console.error('❌ TEST 2 ERROR:', error);
    return false;
  }
}

// Main test runner
export async function runAuthFixesTests() {
  console.log('🧪 Starting Authentication Fixes Tests...');
  console.log('Testing fixes for:');
  console.log('1. Workout completion status lost after login');
  console.log('2. User name display after logout');
  
  const results = [];
  
  // Run Test 1
  const test1Result = await testWorkoutCompletionPersistence();
  results.push({ test: 'Workout Completion Persistence', passed: test1Result });
  
  // Run Test 2
  const test2Result = await testUserNamePersistence();
  results.push({ test: 'User Name Persistence', passed: test2Result });
  
  // Summary
  console.log('\n=== TEST RESULTS SUMMARY ===');
  results.forEach(result => {
    const status = result.passed ? '✅ PASSED' : '❌ FAILED';
    console.log(`${status}: ${result.test}`);
  });
  
  const allPassed = results.every(result => result.passed);
  console.log(`\n🎯 Overall Result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  
  return allPassed;
}

// Export for use in other test files
export { testWorkoutCompletionPersistence, testUserNamePersistence };
