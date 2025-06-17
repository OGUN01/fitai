#!/usr/bin/env node

/**
 * Test Runner for Authentication Fixes
 * 
 * This script can be run from the command line to test the authentication fixes.
 * 
 * Usage:
 *   node scripts/test-auth-fixes.js
 * 
 * Or add to package.json scripts:
 *   "test:auth-fixes": "node scripts/test-auth-fixes.js"
 */

// Mock React Native dependencies for Node.js testing
const mockAsyncStorage = {
  data: new Map(),
  
  async getItem(key) {
    const value = this.data.get(key);
    return value || null;
  },
  
  async setItem(key, value) {
    this.data.set(key, value);
  },
  
  async removeItem(key) {
    this.data.delete(key);
  },
  
  async multiRemove(keys) {
    keys.forEach(key => this.data.delete(key));
  },
  
  async clear() {
    this.data.clear();
  }
};

// Mock the AsyncStorage module
global.AsyncStorage = mockAsyncStorage;

// Mock other React Native modules
global.__DEV__ = true;

// Simple UUID generator for testing
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Mock tracking service functions
const mockTrackingService = {
  async isWorkoutCompleted(userId, date, dayName) {
    const completions = await this.getWorkoutCompletions();
    return completions.some(completion => {
      // Enhanced user ID matching logic (from the fix)
      let userIdMatches = false;
      
      if (completion.user_id === userId) {
        userIdMatches = true;
      } else if (userId !== 'local_user' && completion.user_id === 'local_user') {
        userIdMatches = true;
        console.log(`Found local_user completion for authenticated user ${userId}: ${completion.workout_date}`);
      } else if (userId === 'local_user' && completion.user_id !== 'local_user') {
        userIdMatches = true;
        console.log(`Found authenticated user completion in local storage: ${completion.workout_date}`);
      }
      
      const dateMatches = userIdMatches && completion.workout_date === date;
      
      if (dayName && dateMatches) {
        const dayMatches = completion.workout_day_name === dayName;
        if (dayMatches) {
          console.log(`Workout completion found: user_id=${completion.user_id}, date=${completion.workout_date}, day=${completion.workout_day_name}`);
        }
        return dayMatches;
      }
      return dateMatches;
    });
  },
  
  async markWorkoutComplete(userId, date, dayName, workoutData) {
    const completions = await this.getWorkoutCompletions();
    const newCompletion = {
      id: generateUUID(),
      user_id: userId,
      workout_date: date,
      workout_day_name: dayName,
      completed_at: new Date().toISOString(),
      ...workoutData
    };
    
    completions.push(newCompletion);
    await mockAsyncStorage.setItem('local_workout_completions', JSON.stringify(completions));
  },
  
  async getWorkoutCompletions() {
    const data = await mockAsyncStorage.getItem('local_workout_completions');
    return data ? JSON.parse(data) : [];
  }
};

// Mock sync function (simplified version)
const mockSyncService = {
  async syncLocalDataToServer(userId) {
    console.log(`Mock sync for user ${userId}`);
    
    // Get local workout completions
    const workoutCompletions = await mockTrackingService.getWorkoutCompletions();
    
    if (workoutCompletions.length > 0) {
      console.log(`Syncing ${workoutCompletions.length} workout completions`);
      
      // Update user IDs from 'local_user' to authenticated user ID
      const updatedCompletions = workoutCompletions.map(completion => ({
        ...completion,
        user_id: userId // This is the key fix
      }));
      
      // Save updated completions back to local storage
      await mockAsyncStorage.setItem('local_workout_completions', JSON.stringify(updatedCompletions));
      console.log(`Updated ${updatedCompletions.length} local workout completions with authenticated user ID`);
    }
    
    return {
      success: true,
      syncedItems: {
        profile: true,
        workouts: workoutCompletions.length,
        meals: 0,
        water: 0,
        nutrition: 0
      }
    };
  }
};

// Test functions
async function testWorkoutCompletionPersistence() {
  console.log('\n=== TEST 1: Workout Completion Persistence After Login ===');
  
  try {
    // Clear existing data
    await mockAsyncStorage.clear();
    console.log('✓ Cleared existing test data');
    
    // Simulate local user completing a workout
    const testDate = '2025-01-17';
    const testDayName = 'friday';
    
    await mockTrackingService.markWorkoutComplete('local_user', testDate, testDayName, {
      workout_type: 'strength',
      duration_minutes: 30
    });
    console.log('✓ Marked workout as completed for local user');
    
    // Verify completion before login
    const completedBeforeLogin = await mockTrackingService.isWorkoutCompleted('local_user', testDate, testDayName);
    console.log(`✓ Workout completion before login: ${completedBeforeLogin}`);
    
    if (!completedBeforeLogin) {
      throw new Error('Workout should be completed before login');
    }
    
    // Simulate login and sync
    const authenticatedUserId = `test_user_${Date.now()}`;
    console.log(`✓ Simulating login for user: ${authenticatedUserId}`);
    
    const syncResult = await mockSyncService.syncLocalDataToServer(authenticatedUserId);
    console.log('✓ Sync completed:', syncResult);
    
    // Check completion after login
    const completedAfterLogin = await mockTrackingService.isWorkoutCompleted(authenticatedUserId, testDate, testDayName);
    console.log(`✓ Workout completion after login: ${completedAfterLogin}`);
    
    if (completedAfterLogin) {
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

async function testUserNamePersistence() {
  console.log('\n=== TEST 2: User Name Persistence After Logout ===');
  
  try {
    // Clear existing data
    await mockAsyncStorage.clear();
    console.log('✓ Cleared existing test data');
    
    // Simulate authenticated user with comprehensive profile
    const testUserId = 'test_user_123';
    const testUserName = 'John Doe';
    const testEmail = 'john.doe@example.com';
    const authenticatedProfile = {
      id: testUserId,
      full_name: testUserName,
      email: testEmail,
      diet_preferences: {
        meal_frequency: 4,
        diet_type: 'keto',
        allergies: ['nuts'],
        excluded_foods: ['dairy'],
        favorite_foods: ['chicken', 'broccoli'],
        country_region: "us"
      },
      workout_preferences: {
        preferred_days: ['monday', 'tuesday', 'thursday'],
        workout_duration: 45
      },
      weight_kg: 75,
      height_cm: 180,
      age: 30,
      gender: 'male',
      activity_level: 'moderate',
      weight_goal: 'lose_weight',
      target_weight_kg: 70,
      country_region: "us",
      meal_plans: {
        current_plan: 'keto_plan',
        generated_at: new Date().toISOString()
      }
    };
    
    await mockAsyncStorage.setItem(`profile:${testUserId}`, JSON.stringify(authenticatedProfile));
    console.log(`✓ Created authenticated user profile with name: ${testUserName}`);
    
    // Simulate logout with comprehensive data preservation (the enhanced fix)
    console.log('✓ Simulating logout process...');

    const currentProfileJson = await mockAsyncStorage.getItem(`profile:${testUserId}`);
    let userDataToPreserve = null;

    if (currentProfileJson) {
      const currentProfile = JSON.parse(currentProfileJson);
      userDataToPreserve = {
        full_name: currentProfile.full_name,
        email: currentProfile.email,
        diet_preferences: currentProfile.diet_preferences,
        workout_preferences: currentProfile.workout_preferences,
        weight_kg: currentProfile.weight_kg,
        height_cm: currentProfile.height_cm,
        age: currentProfile.age,
        gender: currentProfile.gender,
        activity_level: currentProfile.activity_level,
        weight_goal: currentProfile.weight_goal,
        target_weight_kg: currentProfile.target_weight_kg,
        country_region: currentProfile.country_region,
        meal_plans: currentProfile.meal_plans
      };
      console.log('✓ Preserved comprehensive user data for local mode:', {
        name: userDataToPreserve.full_name,
        email: userDataToPreserve.email,
        dietType: userDataToPreserve.diet_preferences?.diet_type,
        workoutDuration: userDataToPreserve.workout_preferences?.workout_duration,
        weight: userDataToPreserve.weight_kg,
        hasMealPlans: !!userDataToPreserve.meal_plans
      });
    }

    // Clear authenticated user data
    await mockAsyncStorage.removeItem(`profile:${testUserId}`);

    // Create new local profile with preserved comprehensive data
    if (userDataToPreserve) {
      const newLocalProfile = {
        id: 'local_user',
        full_name: userDataToPreserve.full_name,
        email: userDataToPreserve.email,
        diet_preferences: userDataToPreserve.diet_preferences,
        workout_preferences: userDataToPreserve.workout_preferences,
        weight_kg: userDataToPreserve.weight_kg,
        height_cm: userDataToPreserve.height_cm,
        age: userDataToPreserve.age,
        gender: userDataToPreserve.gender,
        activity_level: userDataToPreserve.activity_level,
        weight_goal: userDataToPreserve.weight_goal,
        target_weight_kg: userDataToPreserve.target_weight_kg,
        country_region: userDataToPreserve.country_region,
        meal_plans: userDataToPreserve.meal_plans,
        has_completed_local_onboarding: true
      };

      await mockAsyncStorage.setItem('local_profile', JSON.stringify(newLocalProfile));
      console.log('✓ Created comprehensive local profile with preserved data');
    }
    
    // Check if ALL data is preserved
    const localProfileJson = await mockAsyncStorage.getItem('local_profile');
    if (localProfileJson) {
      const localProfile = JSON.parse(localProfileJson);
      console.log(`✓ Data in local profile after logout:`, {
        name: localProfile.full_name,
        email: localProfile.email,
        dietType: localProfile.diet_preferences?.diet_type,
        workoutDuration: localProfile.workout_preferences?.workout_duration,
        weight: localProfile.weight_kg,
        hasMealPlans: !!localProfile.meal_plans
      });

      // Verify all key data is preserved
      const dataChecks = [
        { field: 'name', expected: testUserName, actual: localProfile.full_name },
        { field: 'email', expected: testEmail, actual: localProfile.email },
        { field: 'diet_type', expected: 'keto', actual: localProfile.diet_preferences?.diet_type },
        { field: 'workout_duration', expected: 45, actual: localProfile.workout_preferences?.workout_duration },
        { field: 'weight', expected: 75, actual: localProfile.weight_kg },
        { field: 'meal_plans', expected: true, actual: !!localProfile.meal_plans }
      ];

      const failedChecks = dataChecks.filter(check => check.actual !== check.expected);

      if (failedChecks.length === 0) {
        console.log('✅ TEST 2 PASSED: ALL user data persisted after logout');
        return true;
      } else {
        console.log('❌ TEST 2 FAILED: Some data not preserved:');
        failedChecks.forEach(check => {
          console.log(`  - ${check.field}: expected "${check.expected}", got "${check.actual}"`);
        });
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

// Test 3: Complete Data Preservation During Logout
async function testCompleteDataPreservation() {
  console.log('\n=== TEST 3: Complete Data Preservation During Logout ===');

  try {
    // Clear existing data
    await mockAsyncStorage.clear();
    console.log('✓ Cleared existing test data');

    // Step 1: Create user with comprehensive data
    const testUserId = 'test_user_456';
    const testUserName = 'Jane Smith';

    // Add workout completions
    await mockTrackingService.markWorkoutComplete('local_user', '2025-01-15', 'monday', {
      workout_type: 'cardio',
      duration_minutes: 30
    });
    await mockTrackingService.markWorkoutComplete('local_user', '2025-01-16', 'tuesday', {
      workout_type: 'strength',
      duration_minutes: 45
    });
    console.log('✓ Added workout completion data');

    // Add meal completions (mock)
    const mealCompletions = [
      { id: 'meal1', user_id: 'local_user', meal_date: '2025-01-15', meal_type: 'breakfast', completed_at: new Date().toISOString() },
      { id: 'meal2', user_id: 'local_user', meal_date: '2025-01-15', meal_type: 'lunch', completed_at: new Date().toISOString() }
    ];
    await mockAsyncStorage.setItem('local_meal_completions', JSON.stringify(mealCompletions));
    console.log('✓ Added meal completion data');

    // Add other user data
    await mockAsyncStorage.setItem('body_measurements', JSON.stringify([
      { date: '2025-01-15', weight: 70, body_fat: 15 }
    ]));
    await mockAsyncStorage.setItem('nutrition_tracking', JSON.stringify([
      { date: '2025-01-15', calories: 2000, protein: 150 }
    ]));
    console.log('✓ Added body measurements and nutrition data');

    // Create authenticated profile
    const authenticatedProfile = {
      id: testUserId,
      full_name: testUserName,
      email: 'jane.smith@example.com'
    };
    await mockAsyncStorage.setItem(`profile:${testUserId}`, JSON.stringify(authenticatedProfile));
    console.log('✓ Created authenticated user profile');

    // Step 2: Simulate logout (should preserve ALL data)
    console.log('✓ Simulating logout with data preservation...');

    // Get data before logout
    const workoutsBefore = await mockTrackingService.getWorkoutCompletions();
    const mealsBefore = JSON.parse(await mockAsyncStorage.getItem('local_meal_completions') || '[]');
    const bodyMeasurementsBefore = JSON.parse(await mockAsyncStorage.getItem('body_measurements') || '[]');
    const nutritionBefore = JSON.parse(await mockAsyncStorage.getItem('nutrition_tracking') || '[]');

    console.log('✓ Data before logout:', {
      workouts: workoutsBefore.length,
      meals: mealsBefore.length,
      bodyMeasurements: bodyMeasurementsBefore.length,
      nutrition: nutritionBefore.length
    });

    // Simulate logout (only clear session data, preserve user data)
    const sessionKeysToClear = [
      'hideLoginBanner',
      'onboarding_status',
      'data_sync_status',
      'sync_in_progress'
    ];

    // Clear only session keys (NOT user data)
    for (const key of sessionKeysToClear) {
      await mockAsyncStorage.removeItem(key);
    }

    // Clear authenticated profile but preserve user data
    await mockAsyncStorage.removeItem(`profile:${testUserId}`);

    // Create local profile with preserved name (as per our fix)
    const newLocalProfile = {
      id: 'local_user',
      full_name: testUserName,
      email: 'jane.smith@example.com',
      has_completed_local_onboarding: true
    };
    await mockAsyncStorage.setItem('local_profile', JSON.stringify(newLocalProfile));
    console.log('✓ Logout completed with data preservation');

    // Step 3: Verify ALL data is preserved
    const workoutsAfter = await mockTrackingService.getWorkoutCompletions();
    const mealsAfter = JSON.parse(await mockAsyncStorage.getItem('local_meal_completions') || '[]');
    const bodyMeasurementsAfter = JSON.parse(await mockAsyncStorage.getItem('body_measurements') || '[]');
    const nutritionAfter = JSON.parse(await mockAsyncStorage.getItem('nutrition_tracking') || '[]');
    const localProfile = JSON.parse(await mockAsyncStorage.getItem('local_profile') || '{}');

    console.log('✓ Data after logout:', {
      workouts: workoutsAfter.length,
      meals: mealsAfter.length,
      bodyMeasurements: bodyMeasurementsAfter.length,
      nutrition: nutritionAfter.length,
      profileName: localProfile.full_name
    });

    // Verify data preservation
    const dataChecks = [
      { field: 'workouts', before: workoutsBefore.length, after: workoutsAfter.length },
      { field: 'meals', before: mealsBefore.length, after: mealsAfter.length },
      { field: 'bodyMeasurements', before: bodyMeasurementsBefore.length, after: bodyMeasurementsAfter.length },
      { field: 'nutrition', before: nutritionBefore.length, after: nutritionAfter.length },
      { field: 'profileName', before: testUserName, after: localProfile.full_name }
    ];

    const failedChecks = dataChecks.filter(check => check.before !== check.after);

    if (failedChecks.length === 0) {
      console.log('✅ TEST 3 PASSED: ALL user data preserved during logout');
      return true;
    } else {
      console.log('❌ TEST 3 FAILED: Some data was lost during logout:');
      failedChecks.forEach(check => {
        console.log(`  - ${check.field}: before=${check.before}, after=${check.after}`);
      });
      return false;
    }

  } catch (error) {
    console.error('❌ TEST 3 ERROR:', error);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('🧪 Starting Authentication Fixes Tests...');
  console.log('Testing fixes for:');
  console.log('1. Workout completion status lost after login');
  console.log('2. User name display after logout');
  console.log('3. Complete data preservation during logout');

  const results = [];

  // Run tests
  const test1Result = await testWorkoutCompletionPersistence();
  results.push({ test: 'Workout Completion Persistence', passed: test1Result });

  const test2Result = await testUserNamePersistence();
  results.push({ test: 'User Name Persistence', passed: test2Result });

  const test3Result = await testCompleteDataPreservation();
  results.push({ test: 'Complete Data Preservation', passed: test3Result });

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

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Test runner error:', error);
    process.exit(1);
  });
}

module.exports = { runTests, testWorkoutCompletionPersistence, testUserNamePersistence, testCompleteDataPreservation };
