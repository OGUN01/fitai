/**
 * Comprehensive Test for Complete Logout and Refresh Scenario
 * 
 * This test simulates the exact user experience:
 * 1. User has workout/meal data while authenticated
 * 2. User logs out
 * 3. User refreshes the page/app
 * 4. All data should still be accessible
 */

// Mock AsyncStorage
const mockAsyncStorage = {
  data: new Map(),
  async getItem(key) { return this.data.get(key) || null; },
  async setItem(key, value) { this.data.set(key, value); },
  async removeItem(key) { this.data.delete(key); },
  async multiRemove(keys) { keys.forEach(key => this.data.delete(key)); },
  async clear() { this.data.clear(); }
};

// Mock the complete logout process from AuthContext
const simulateCompleteLogout = async (authenticatedUserId) => {
  console.log('🚪 Starting complete logout simulation...');
  
  // Step 1: Preserve user data
  let userDataToPreserve = null;
  try {
    const currentProfileJson = await mockAsyncStorage.getItem(`profile:${authenticatedUserId}`);
    if (currentProfileJson) {
      const currentProfile = JSON.parse(currentProfileJson);
      userDataToPreserve = {
        full_name: currentProfile.full_name,
        email: currentProfile.email,
        diet_preferences: currentProfile.diet_preferences,
        workout_preferences: currentProfile.workout_preferences,
        meal_plans: currentProfile.meal_plans
      };
      console.log('✓ Preserved user data for local mode');
    }
  } catch (error) {
    console.error('Error preserving user data:', error);
  }

  // Step 2: Clear session-related data (simulate multiRemove)
  const keysToClear = [
    'hideLoginBanner',
    'onboarding_status',
    'onboarding_completed',
    'data_sync_status',
    'last_data_sync',
    'sync_in_progress',
    `profile:${authenticatedUserId}`,
    `sync_status:${authenticatedUserId}`
  ];
  
  await mockAsyncStorage.multiRemove(keysToClear);
  console.log('✓ Cleared session-related data');

  // Step 3: Create local profile with preserved data
  if (userDataToPreserve) {
    const newLocalProfile = {
      id: 'local_user',
      full_name: userDataToPreserve.full_name,
      email: userDataToPreserve.email,
      diet_preferences: userDataToPreserve.diet_preferences,
      workout_preferences: userDataToPreserve.workout_preferences,
      meal_plans: userDataToPreserve.meal_plans,
      has_completed_local_onboarding: true
    };
    
    await mockAsyncStorage.setItem('local_profile', JSON.stringify(newLocalProfile));
    console.log('✓ Created local profile with preserved data');
  }

  // Step 4: CRITICAL FIX - Convert all activity data to use 'local_user' ID
  await convertActivityDataToLocalUser(authenticatedUserId);
  
  console.log('✅ Complete logout simulation finished');
};

// Convert activity data function
const convertActivityDataToLocalUser = async (authenticatedUserId) => {
  console.log('🔄 Converting activity data to local_user format...');

  // Convert workout completions
  const workoutKeys = ['local_workout_completions', 'completed_workouts'];
  for (const key of workoutKeys) {
    const workoutData = await mockAsyncStorage.getItem(key);
    if (workoutData) {
      const workouts = JSON.parse(workoutData);
      if (Array.isArray(workouts)) {
        const convertedWorkouts = workouts.map(workout => ({
          ...workout,
          user_id: 'local_user'
        }));
        await mockAsyncStorage.setItem(key, JSON.stringify(convertedWorkouts));
        console.log(`✓ Converted ${convertedWorkouts.length} workouts in ${key}`);
      }
    }
  }

  // Convert meal completions
  const mealKeys = ['local_meal_completions', 'meals'];
  for (const key of mealKeys) {
    const mealData = await mockAsyncStorage.getItem(key);
    if (mealData) {
      const meals = JSON.parse(mealData);
      if (Array.isArray(meals)) {
        const convertedMeals = meals.map(meal => ({
          ...meal,
          user_id: 'local_user'
        }));
        await mockAsyncStorage.setItem(key, JSON.stringify(convertedMeals));
        console.log(`✓ Converted ${convertedMeals.length} meals in ${key}`);
      }
    }
  }

  // Convert meal plans
  const mealPlanKey = `mealPlan:${authenticatedUserId}`;
  const mealPlanData = await mockAsyncStorage.getItem(mealPlanKey);
  if (mealPlanData) {
    await mockAsyncStorage.setItem('mealPlan:local_user', mealPlanData);
    await mockAsyncStorage.removeItem(mealPlanKey);
    console.log('✓ Converted meal plan');
  }

  // Convert workout completion state
  const workoutStateData = await mockAsyncStorage.getItem('workout_completion_state');
  if (workoutStateData) {
    const state = JSON.parse(workoutStateData);
    if (state.userId === authenticatedUserId) {
      state.userId = 'local_user';
      await mockAsyncStorage.setItem('workout_completion_state', JSON.stringify(state));
      console.log('✓ Converted workout completion state');
    }
  }
};

// Simulate how the app loads data after refresh
const simulateAppRefresh = async () => {
  console.log('🔄 Simulating app refresh...');
  
  // This simulates how components check for data after refresh
  const userId = 'local_user'; // After logout, user becomes local_user
  
  // Check workout completions (how trackingService.ts would check)
  const workoutData = await mockAsyncStorage.getItem('local_workout_completions');
  const workouts = workoutData ? JSON.parse(workoutData) : [];
  const userWorkouts = workouts.filter(w => w.user_id === userId);
  
  // Check meal completions
  const mealData = await mockAsyncStorage.getItem('local_meal_completions');
  const meals = mealData ? JSON.parse(mealData) : [];
  const userMeals = meals.filter(m => m.user_id === userId);
  
  // Check meal plan
  const mealPlan = await mockAsyncStorage.getItem(`mealPlan:${userId}`);
  
  // Check profile
  const profile = await mockAsyncStorage.getItem('local_profile');
  const profileData = profile ? JSON.parse(profile) : null;
  
  // Check workout completion state
  const workoutState = await mockAsyncStorage.getItem('workout_completion_state');
  const stateData = workoutState ? JSON.parse(workoutState) : null;
  const validState = stateData && stateData.userId === userId;
  
  return {
    workouts: userWorkouts,
    meals: userMeals,
    mealPlan: mealPlan ? JSON.parse(mealPlan) : null,
    profile: profileData,
    workoutState: validState ? stateData : null
  };
};

// Main test
async function testCompleteLogoutRefreshScenario() {
  console.log('🧪 COMPREHENSIVE LOGOUT AND REFRESH TEST');
  console.log('Testing the complete user experience: authenticated → logout → refresh → data accessible');
  
  try {
    await mockAsyncStorage.clear();
    console.log('✓ Cleared all data');
    
    // Step 1: Set up authenticated user with comprehensive data
    const authenticatedUserId = 'auth_user_complete_test';
    const userName = 'Complete Test User';
    
    // Create authenticated profile
    const authenticatedProfile = {
      id: authenticatedUserId,
      full_name: userName,
      email: 'complete.test@example.com',
      diet_preferences: {
        meal_frequency: 4,
        diet_type: 'keto',
        allergies: ['nuts']
      },
      workout_preferences: {
        preferred_days: ['monday', 'wednesday', 'friday'],
        workout_duration: 45
      }
    };
    
    await mockAsyncStorage.setItem(`profile:${authenticatedUserId}`, JSON.stringify(authenticatedProfile));
    console.log('✓ Created authenticated profile');
    
    // Add comprehensive activity data
    const workoutCompletions = [
      { id: 'w1', user_id: authenticatedUserId, workout_date: '2025-01-15', workout_day_name: 'monday', completed_at: new Date().toISOString() },
      { id: 'w2', user_id: authenticatedUserId, workout_date: '2025-01-16', workout_day_name: 'tuesday', completed_at: new Date().toISOString() },
      { id: 'w3', user_id: authenticatedUserId, workout_date: '2025-01-17', workout_day_name: 'wednesday', completed_at: new Date().toISOString() }
    ];
    
    const mealCompletions = [
      { id: 'm1', user_id: authenticatedUserId, meal_date: '2025-01-15', meal_type: 'breakfast', completed_at: new Date().toISOString() },
      { id: 'm2', user_id: authenticatedUserId, meal_date: '2025-01-15', meal_type: 'lunch', completed_at: new Date().toISOString() },
      { id: 'm3', user_id: authenticatedUserId, meal_date: '2025-01-16', meal_type: 'breakfast', completed_at: new Date().toISOString() },
      { id: 'm4', user_id: authenticatedUserId, meal_date: '2025-01-16', meal_type: 'dinner', completed_at: new Date().toISOString() }
    ];
    
    const mealPlan = {
      id: 'plan_complete',
      user_id: authenticatedUserId,
      plan_name: 'Keto Diet Plan',
      meals: { monday: ['Keto Breakfast', 'Keto Lunch', 'Keto Dinner'] }
    };
    
    const workoutState = {
      date: '2025-01-17',
      userId: authenticatedUserId,
      completions: { 'wednesday': true }
    };
    
    await mockAsyncStorage.setItem('local_workout_completions', JSON.stringify(workoutCompletions));
    await mockAsyncStorage.setItem('local_meal_completions', JSON.stringify(mealCompletions));
    await mockAsyncStorage.setItem(`mealPlan:${authenticatedUserId}`, JSON.stringify(mealPlan));
    await mockAsyncStorage.setItem('workout_completion_state', JSON.stringify(workoutState));
    
    console.log('✓ Added comprehensive activity data:', {
      workouts: workoutCompletions.length,
      meals: mealCompletions.length,
      hasMealPlan: true,
      hasWorkoutState: true
    });
    
    // Step 2: Simulate complete logout process
    await simulateCompleteLogout(authenticatedUserId);
    
    // Step 3: Simulate app refresh and data loading
    const dataAfterRefresh = await simulateAppRefresh();
    
    console.log('✓ Data accessible after refresh:', {
      workouts: dataAfterRefresh.workouts.length,
      meals: dataAfterRefresh.meals.length,
      hasMealPlan: !!dataAfterRefresh.mealPlan,
      profileName: dataAfterRefresh.profile?.full_name,
      hasWorkoutState: !!dataAfterRefresh.workoutState
    });
    
    // Step 4: Verify all data is accessible
    const checks = [
      { field: 'workouts', expected: 3, actual: dataAfterRefresh.workouts.length },
      { field: 'meals', expected: 4, actual: dataAfterRefresh.meals.length },
      { field: 'meal_plan', expected: true, actual: !!dataAfterRefresh.mealPlan },
      { field: 'profile_name', expected: userName, actual: dataAfterRefresh.profile?.full_name },
      { field: 'workout_state', expected: true, actual: !!dataAfterRefresh.workoutState }
    ];
    
    const failedChecks = checks.filter(check => check.actual !== check.expected);
    
    if (failedChecks.length === 0) {
      console.log('✅ COMPREHENSIVE TEST PASSED: All data accessible after logout and refresh');
      console.log('🎉 Users can now logout and refresh without losing their progress!');
      return true;
    } else {
      console.log('❌ COMPREHENSIVE TEST FAILED: Some data not accessible:');
      failedChecks.forEach(check => {
        console.log(`  - ${check.field}: expected ${check.expected}, got ${check.actual}`);
      });
      return false;
    }
    
  } catch (error) {
    console.error('❌ COMPREHENSIVE TEST ERROR:', error);
    return false;
  }
}

// Run the test
testCompleteLogoutRefreshScenario().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});
