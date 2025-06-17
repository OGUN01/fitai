/**
 * Test for Logout and Refresh Data Persistence
 * 
 * This test validates that workout and meal data remains accessible
 * after logout and page refresh scenarios.
 */

// Mock AsyncStorage for Node.js testing
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

// Mock the convertActivityDataToLocalUser function
const convertActivityDataToLocalUser = async (authenticatedUserId) => {
  if (!authenticatedUserId) {
    console.log('No authenticated user ID provided, skipping activity data conversion');
    return;
  }

  console.log('Converting activity data to local_user format...');

  try {
    // Convert workout completions
    const workoutKeys = ['local_workout_completions', 'completed_workouts'];
    for (const key of workoutKeys) {
      try {
        const workoutData = await mockAsyncStorage.getItem(key);
        if (workoutData) {
          const workouts = JSON.parse(workoutData);
          if (Array.isArray(workouts)) {
            const convertedWorkouts = workouts.map(workout => ({
              ...workout,
              user_id: 'local_user' // Convert to local_user
            }));
            await mockAsyncStorage.setItem(key, JSON.stringify(convertedWorkouts));
            console.log(`✓ Converted ${convertedWorkouts.length} workouts in ${key} to local_user`);
          }
        }
      } catch (error) {
        console.error(`Error converting workouts in ${key}:`, error);
      }
    }

    // Convert meal completions
    const mealKeys = ['local_meal_completions', 'meals'];
    for (const key of mealKeys) {
      try {
        const mealData = await mockAsyncStorage.getItem(key);
        if (mealData) {
          const meals = JSON.parse(mealData);
          if (Array.isArray(meals)) {
            const convertedMeals = meals.map(meal => ({
              ...meal,
              user_id: 'local_user' // Convert to local_user
            }));
            await mockAsyncStorage.setItem(key, JSON.stringify(convertedMeals));
            console.log(`✓ Converted ${convertedMeals.length} meals in ${key} to local_user`);
          }
        }
      } catch (error) {
        console.error(`Error converting meals in ${key}:`, error);
      }
    }

    // Convert any cached meal plans
    try {
      const mealPlanKey = `mealPlan:${authenticatedUserId}`;
      const mealPlanData = await mockAsyncStorage.getItem(mealPlanKey);
      if (mealPlanData) {
        // Move meal plan to local user key
        await mockAsyncStorage.setItem('mealPlan:local_user', mealPlanData);
        await mockAsyncStorage.removeItem(mealPlanKey); // Remove old key
        console.log('✓ Converted meal plan to local_user format');
      }
    } catch (error) {
      console.error('Error converting meal plan:', error);
    }

    // Convert any workout completion state cache
    try {
      const workoutStateData = await mockAsyncStorage.getItem('workout_completion_state');
      if (workoutStateData) {
        const state = JSON.parse(workoutStateData);
        if (state.userId === authenticatedUserId) {
          state.userId = 'local_user';
          await mockAsyncStorage.setItem('workout_completion_state', JSON.stringify(state));
          console.log('✓ Converted workout completion state to local_user');
        }
      }
    } catch (error) {
      console.error('Error converting workout completion state:', error);
    }

    console.log('✅ Successfully converted all activity data to local_user format');

  } catch (error) {
    console.error('Error during activity data conversion:', error);
  }
};

// Test scenarios
const LogoutRefreshTests = {
  
  /**
   * Test 1: Data persistence through logout and refresh
   */
  async testLogoutRefreshPersistence() {
    console.log('\n🧪 TEST 1: Data Persistence Through Logout and Refresh');
    
    try {
      await mockAsyncStorage.clear();
      console.log('✓ Cleared all data');
      
      // Step 1: Create authenticated user with activity data
      const authenticatedUserId = 'auth_user_789';
      const userName = 'Test User';
      
      // Create authenticated profile
      const authenticatedProfile = {
        id: authenticatedUserId,
        full_name: userName,
        email: 'test@example.com',
        diet_preferences: {
          meal_frequency: 3,
          diet_type: 'balanced'
        }
      };
      
      await mockAsyncStorage.setItem(`profile:${authenticatedUserId}`, JSON.stringify(authenticatedProfile));
      console.log('✓ Created authenticated profile');
      
      // Add workout completions with authenticated user ID
      const workoutCompletions = [
        {
          id: 'workout_1',
          user_id: authenticatedUserId,
          workout_date: '2025-01-15',
          workout_day_name: 'monday',
          completed_at: new Date().toISOString()
        },
        {
          id: 'workout_2',
          user_id: authenticatedUserId,
          workout_date: '2025-01-16',
          workout_day_name: 'tuesday',
          completed_at: new Date().toISOString()
        }
      ];
      
      await mockAsyncStorage.setItem('local_workout_completions', JSON.stringify(workoutCompletions));
      console.log('✓ Added workout completions with authenticated user ID');
      
      // Add meal completions with authenticated user ID
      const mealCompletions = [
        {
          id: 'meal_1',
          user_id: authenticatedUserId,
          meal_date: '2025-01-15',
          meal_type: 'breakfast',
          completed_at: new Date().toISOString()
        },
        {
          id: 'meal_2',
          user_id: authenticatedUserId,
          meal_date: '2025-01-15',
          meal_type: 'lunch',
          completed_at: new Date().toISOString()
        }
      ];
      
      await mockAsyncStorage.setItem('local_meal_completions', JSON.stringify(mealCompletions));
      console.log('✓ Added meal completions with authenticated user ID');
      
      // Add meal plan
      const mealPlan = {
        id: 'plan_1',
        user_id: authenticatedUserId,
        plan_name: 'Balanced Diet',
        created_at: new Date().toISOString()
      };
      
      await mockAsyncStorage.setItem(`mealPlan:${authenticatedUserId}`, JSON.stringify(mealPlan));
      console.log('✓ Added meal plan with authenticated user ID');
      
      // Step 2: Simulate logout with our enhanced fix
      console.log('✓ Simulating logout with data conversion...');
      
      // Get current profile data
      const currentProfileJson = await mockAsyncStorage.getItem(`profile:${authenticatedUserId}`);
      const currentProfile = JSON.parse(currentProfileJson);
      
      // Clear authenticated profile
      await mockAsyncStorage.removeItem(`profile:${authenticatedUserId}`);
      
      // Create local profile with preserved data
      const preservedLocalProfile = {
        id: 'local_user',
        full_name: currentProfile.full_name,
        email: currentProfile.email,
        diet_preferences: currentProfile.diet_preferences,
        has_completed_local_onboarding: true
      };
      
      await mockAsyncStorage.setItem('local_profile', JSON.stringify(preservedLocalProfile));
      
      // CRITICAL FIX: Convert all activity data to use 'local_user' ID
      await convertActivityDataToLocalUser(authenticatedUserId);
      
      console.log('✓ Logout completed with data conversion');
      
      // Step 3: Simulate refresh - check if data is accessible as local_user
      console.log('✓ Simulating app refresh...');
      
      // Check if workout data is accessible with local_user ID
      const workoutsAfterLogout = JSON.parse(await mockAsyncStorage.getItem('local_workout_completions') || '[]');
      const localUserWorkouts = workoutsAfterLogout.filter(w => w.user_id === 'local_user');
      
      // Check if meal data is accessible with local_user ID
      const mealsAfterLogout = JSON.parse(await mockAsyncStorage.getItem('local_meal_completions') || '[]');
      const localUserMeals = mealsAfterLogout.filter(m => m.user_id === 'local_user');
      
      // Check if meal plan is accessible
      const mealPlanAfterLogout = await mockAsyncStorage.getItem('mealPlan:local_user');
      
      // Check if profile is accessible
      const profileAfterLogout = JSON.parse(await mockAsyncStorage.getItem('local_profile') || '{}');
      
      console.log('✓ Data after logout and refresh:', {
        workouts: localUserWorkouts.length,
        meals: localUserMeals.length,
        hasMealPlan: !!mealPlanAfterLogout,
        profileName: profileAfterLogout.full_name
      });
      
      // Step 4: Verify all data is accessible
      const checks = [
        { field: 'workouts', expected: 2, actual: localUserWorkouts.length },
        { field: 'meals', expected: 2, actual: localUserMeals.length },
        { field: 'meal_plan', expected: true, actual: !!mealPlanAfterLogout },
        { field: 'profile_name', expected: userName, actual: profileAfterLogout.full_name }
      ];
      
      const failedChecks = checks.filter(check => check.actual !== check.expected);
      
      if (failedChecks.length === 0) {
        console.log('✅ TEST 1 PASSED: All data accessible after logout and refresh');
        return true;
      } else {
        console.log('❌ TEST 1 FAILED: Some data not accessible after logout and refresh:');
        failedChecks.forEach(check => {
          console.log(`  - ${check.field}: expected ${check.expected}, got ${check.actual}`);
        });
        return false;
      }
      
    } catch (error) {
      console.error('❌ TEST 1 ERROR:', error);
      return false;
    }
  }
};

// Main test runner
async function runLogoutRefreshTests() {
  console.log('🧪 Starting Logout and Refresh Data Persistence Tests...');
  console.log('Testing that workout and meal data remains accessible after logout and refresh');
  
  const results = [];
  
  // Run test
  const test1Result = await LogoutRefreshTests.testLogoutRefreshPersistence();
  results.push({ test: 'Logout and Refresh Data Persistence', passed: test1Result });
  
  // Summary
  console.log('\n=== LOGOUT REFRESH TEST RESULTS ===');
  results.forEach(result => {
    const status = result.passed ? '✅ PASSED' : '❌ FAILED';
    console.log(`${status}: ${result.test}`);
  });
  
  const allPassed = results.every(result => result.passed);
  console.log(`\n🎯 Logout Refresh Tests Result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  
  return allPassed;
}

// Run tests
runLogoutRefreshTests().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Logout refresh test runner error:', error);
  process.exit(1);
});
