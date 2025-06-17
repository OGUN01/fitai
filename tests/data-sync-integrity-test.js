/**
 * Data Sync Integrity Test
 * 
 * This test validates that the sync process correctly filters out invalid data
 * and prevents future dates from being marked as completed.
 */

const AsyncStorage = require('@react-native-async-storage/async-storage').default;

// Mock data for testing
const mockAsyncStorage = {
  storage: new Map(),
  
  async getItem(key) {
    return this.storage.get(key) || null;
  },
  
  async setItem(key, value) {
    this.storage.set(key, value);
  },
  
  async removeItem(key) {
    this.storage.delete(key);
  },
  
  async clear() {
    this.storage.clear();
  }
};

// Replace AsyncStorage with mock
Object.assign(AsyncStorage, mockAsyncStorage);

// Test data generators
function generateTestWorkouts() {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  return [
    // Valid workouts (past and today)
    {
      id: 'workout_1',
      user_id: 'local_user',
      workout_date: yesterday.toISOString().split('T')[0],
      workout_day_name: 'Monday',
      completed_at: yesterday.toISOString(),
      day_number: 1
    },
    {
      id: 'workout_2',
      user_id: 'local_user',
      workout_date: today.toISOString().split('T')[0],
      workout_day_name: 'Tuesday',
      completed_at: today.toISOString(),
      day_number: 2
    },
    // Invalid workouts (future dates)
    {
      id: 'workout_3',
      user_id: 'local_user',
      workout_date: tomorrow.toISOString().split('T')[0],
      workout_day_name: 'Wednesday',
      completed_at: tomorrow.toISOString(),
      day_number: 3
    },
    {
      id: 'workout_4',
      user_id: 'local_user',
      workout_date: nextWeek.toISOString().split('T')[0],
      workout_day_name: 'Monday',
      completed_at: nextWeek.toISOString(),
      day_number: 1
    },
    // Invalid workout (missing required fields)
    {
      id: 'workout_5',
      user_id: 'local_user',
      // Missing workout_date
      workout_day_name: 'Thursday',
      completed_at: today.toISOString()
    }
  ];
}

function generateTestMeals() {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return [
    // Valid meals (past and today)
    {
      id: 'meal_1',
      user_id: 'local_user',
      meal_date: yesterday.toISOString().split('T')[0],
      meal_type: 'breakfast',
      completed_at: yesterday.toISOString()
    },
    {
      id: 'meal_2',
      user_id: 'local_user',
      meal_date: today.toISOString().split('T')[0],
      meal_type: 'lunch',
      completed_at: today.toISOString()
    },
    // Invalid meals (future dates)
    {
      id: 'meal_3',
      user_id: 'local_user',
      meal_date: tomorrow.toISOString().split('T')[0],
      meal_type: 'dinner',
      completed_at: tomorrow.toISOString()
    },
    // Invalid meal (invalid meal type)
    {
      id: 'meal_4',
      user_id: 'local_user',
      meal_date: today.toISOString().split('T')[0],
      meal_type: 'invalid_meal_type',
      completed_at: today.toISOString()
    }
  ];
}

// Test functions
async function setupTestData() {
  console.log('🔧 Setting up test data...');
  
  const workouts = generateTestWorkouts();
  const meals = generateTestMeals();
  
  await AsyncStorage.setItem('local_workout_completions', JSON.stringify(workouts));
  await AsyncStorage.setItem('local_meal_completions', JSON.stringify(meals));
  
  console.log(`✅ Created ${workouts.length} test workouts and ${meals.length} test meals`);
  console.log('   - Valid workouts: 2 (yesterday, today)');
  console.log('   - Invalid workouts: 3 (2 future dates, 1 missing field)');
  console.log('   - Valid meals: 2 (yesterday, today)');
  console.log('   - Invalid meals: 2 (1 future date, 1 invalid type)');
}

async function testDataValidation() {
  console.log('\n🧪 Testing data validation...');
  
  try {
    // Import validation functions
    const { validateAndCleanSyncData } = require('../utils/dataValidation');
    
    const workoutsData = await AsyncStorage.getItem('local_workout_completions');
    const mealsData = await AsyncStorage.getItem('local_meal_completions');
    
    const workouts = workoutsData ? JSON.parse(workoutsData) : [];
    const meals = mealsData ? JSON.parse(mealsData) : [];
    
    console.log(`📊 Original data: ${workouts.length} workouts, ${meals.length} meals`);
    
    const cleanedData = validateAndCleanSyncData({ workouts, meals });
    
    console.log('📋 Validation Results:');
    console.log(`   Workouts: ${cleanedData.summary.workouts.valid}/${cleanedData.summary.workouts.total} valid (${cleanedData.summary.workouts.filtered} filtered)`);
    console.log(`   Meals: ${cleanedData.summary.meals.valid}/${cleanedData.summary.meals.total} valid (${cleanedData.summary.meals.filtered} filtered)`);
    
    // Verify expected results
    const expectedValidWorkouts = 2; // yesterday + today
    const expectedValidMeals = 2; // yesterday + today
    
    if (cleanedData.summary.workouts.valid === expectedValidWorkouts) {
      console.log('✅ Workout validation passed');
    } else {
      console.log(`❌ Workout validation failed: expected ${expectedValidWorkouts}, got ${cleanedData.summary.workouts.valid}`);
    }
    
    if (cleanedData.summary.meals.valid === expectedValidMeals) {
      console.log('✅ Meal validation passed');
    } else {
      console.log(`❌ Meal validation failed: expected ${expectedValidMeals}, got ${cleanedData.summary.meals.valid}`);
    }
    
    return {
      success: cleanedData.summary.workouts.valid === expectedValidWorkouts && 
               cleanedData.summary.meals.valid === expectedValidMeals,
      cleanedData
    };
    
  } catch (error) {
    console.log(`❌ Validation test failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function testIntegrityChecker() {
  console.log('\n🔍 Testing integrity checker...');
  
  try {
    const { performDataIntegrityCheck } = require('../utils/dataSyncIntegrityChecker');
    
    const result = await performDataIntegrityCheck();
    
    console.log('📋 Integrity Check Results:');
    console.log(`   Overall valid: ${result.isValid}`);
    console.log(`   Issues found: ${result.issues.length}`);
    console.log(`   Recommendations: ${result.recommendations.length}`);
    
    if (result.issues.length > 0) {
      console.log('   Issues:');
      result.issues.forEach(issue => console.log(`     - ${issue}`));
    }
    
    if (result.recommendations.length > 0) {
      console.log('   Recommendations:');
      result.recommendations.forEach(rec => console.log(`     - ${rec}`));
    }
    
    // Should find future date issues
    const expectedIssues = 3; // 2 future workouts + 1 future meal
    const foundFutureIssues = result.issues.filter(issue => issue.includes('Future')).length;
    
    if (foundFutureIssues >= expectedIssues) {
      console.log('✅ Integrity checker correctly identified future date issues');
      return { success: true, result };
    } else {
      console.log(`❌ Integrity checker missed future date issues: found ${foundFutureIssues}, expected at least ${expectedIssues}`);
      return { success: false, result };
    }
    
  } catch (error) {
    console.log(`❌ Integrity check failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function testDataCleaning() {
  console.log('\n🧹 Testing data cleaning...');
  
  try {
    const { cleanInvalidLocalData } = require('../utils/dataSyncIntegrityChecker');
    
    const result = await cleanInvalidLocalData();
    
    console.log('📋 Cleaning Results:');
    console.log(`   Success: ${result.success}`);
    console.log(`   Cleaned workouts: ${result.cleaned.workouts}`);
    console.log(`   Cleaned meals: ${result.cleaned.meals}`);
    console.log(`   Errors: ${result.errors.length}`);
    
    if (result.errors.length > 0) {
      console.log('   Errors:');
      result.errors.forEach(error => console.log(`     - ${error}`));
    }
    
    // Verify data was actually cleaned
    const workoutsData = await AsyncStorage.getItem('local_workout_completions');
    const mealsData = await AsyncStorage.getItem('local_meal_completions');
    
    const remainingWorkouts = workoutsData ? JSON.parse(workoutsData) : [];
    const remainingMeals = mealsData ? JSON.parse(mealsData) : [];
    
    console.log(`   Remaining workouts: ${remainingWorkouts.length}`);
    console.log(`   Remaining meals: ${remainingMeals.length}`);
    
    // Should have 2 valid workouts and 2 valid meals remaining
    if (remainingWorkouts.length === 2 && remainingMeals.length === 2) {
      console.log('✅ Data cleaning successfully removed invalid records');
      return { success: true, result };
    } else {
      console.log(`❌ Data cleaning failed: expected 2 workouts and 2 meals, got ${remainingWorkouts.length} workouts and ${remainingMeals.length} meals`);
      return { success: false, result };
    }
    
  } catch (error) {
    console.log(`❌ Data cleaning failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Main test runner
async function runDataSyncIntegrityTests() {
  console.log('🚀 Starting Data Sync Integrity Tests\n');
  
  const results = {
    setup: false,
    validation: false,
    integrityCheck: false,
    cleaning: false
  };
  
  try {
    // Setup test data
    await setupTestData();
    results.setup = true;
    
    // Test validation
    const validationResult = await testDataValidation();
    results.validation = validationResult.success;
    
    // Test integrity checker
    const integrityResult = await testIntegrityChecker();
    results.integrityCheck = integrityResult.success;
    
    // Test data cleaning
    const cleaningResult = await testDataCleaning();
    results.cleaning = cleaningResult.success;
    
  } catch (error) {
    console.log(`❌ Test suite failed: ${error.message}`);
  }
  
  // Summary
  console.log('\n📊 Test Results Summary:');
  console.log(`   Setup: ${results.setup ? '✅' : '❌'}`);
  console.log(`   Validation: ${results.validation ? '✅' : '❌'}`);
  console.log(`   Integrity Check: ${results.integrityCheck ? '✅' : '❌'}`);
  console.log(`   Data Cleaning: ${results.cleaning ? '✅' : '❌'}`);
  
  const allPassed = Object.values(results).every(result => result === true);
  console.log(`\n🎯 Overall Result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  
  if (allPassed) {
    console.log('\n🎉 Data sync integrity fix is working correctly!');
    console.log('   - Future dates are properly filtered out');
    console.log('   - Invalid data is detected and cleaned');
    console.log('   - Only valid completion records will be synced');
  }
  
  return allPassed;
}

// Export for use in other tests
module.exports = {
  runDataSyncIntegrityTests,
  generateTestWorkouts,
  generateTestMeals,
  setupTestData,
  testDataValidation,
  testIntegrityChecker,
  testDataCleaning
};

// Run tests if this file is executed directly
if (require.main === module) {
  runDataSyncIntegrityTests().catch(console.error);
}
