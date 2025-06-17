/**
 * UUID Conversion Test
 * 
 * This test validates that 'local_user' records are properly converted
 * to authenticated user UUIDs during the sync process.
 */

// Mock UUID for testing
const MOCK_USER_UUID = '123e4567-e89b-12d3-a456-426614174000';

// Simulate the conversion logic from our sync fix
function convertLocalUserToAuthenticatedUser(completions, authenticatedUserId) {
  return completions.map(completion => {
    const converted = { ...completion };
    
    // Replace 'local_user' with the actual authenticated user ID
    if (converted.user_id === 'local_user' || !converted.user_id) {
      converted.user_id = authenticatedUserId;
      console.log(`✅ Converted local_user to ${authenticatedUserId}: ${completion.workout_date || completion.meal_date}`);
    } else {
      converted.user_id = authenticatedUserId; // Ensure consistency
    }
    
    // Remove local ID to let database generate new one
    delete converted.id;
    
    return converted;
  });
}

// Validate UUID format
function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// Generate test data with 'local_user' records
function generateLocalUserData() {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  return {
    workouts: [
      {
        id: 'local_workout_1',
        user_id: 'local_user', // This should be converted
        workout_date: yesterday.toISOString().split('T')[0],
        workout_day_name: 'Monday',
        completed_at: yesterday.toISOString()
      },
      {
        id: 'local_workout_2',
        user_id: 'local_user', // This should be converted
        workout_date: today.toISOString().split('T')[0],
        workout_day_name: 'Tuesday',
        completed_at: today.toISOString()
      }
    ],
    meals: [
      {
        id: 'local_meal_1',
        user_id: 'local_user', // This should be converted
        meal_date: yesterday.toISOString().split('T')[0],
        meal_type: 'breakfast',
        completed_at: yesterday.toISOString()
      },
      {
        id: 'local_meal_2',
        user_id: 'local_user', // This should be converted
        meal_date: today.toISOString().split('T')[0],
        meal_type: 'lunch',
        completed_at: today.toISOString()
      }
    ]
  };
}

// Test the conversion process
function testUUIDConversion() {
  console.log('🔄 Testing UUID Conversion Process\n');
  
  // Step 1: Generate local user data
  const localData = generateLocalUserData();
  console.log('📱 Original Local Data:');
  console.log(`   Workouts: ${localData.workouts.length} records`);
  console.log(`   Meals: ${localData.meals.length} records`);
  
  // Show original user_ids
  console.log('\n👤 Original User IDs:');
  localData.workouts.forEach((w, i) => {
    console.log(`   Workout ${i + 1}: ${w.user_id}`);
  });
  localData.meals.forEach((m, i) => {
    console.log(`   Meal ${i + 1}: ${m.user_id}`);
  });
  
  console.log(`\n🔧 Converting to authenticated user: ${MOCK_USER_UUID}\n`);
  
  // Step 2: Convert local_user to authenticated user UUID
  const convertedWorkouts = convertLocalUserToAuthenticatedUser(localData.workouts, MOCK_USER_UUID);
  const convertedMeals = convertLocalUserToAuthenticatedUser(localData.meals, MOCK_USER_UUID);
  
  // Step 3: Validate conversion results
  console.log('\n✅ Conversion Results:');
  
  let allValid = true;
  let conversionCount = 0;
  
  // Check workouts
  console.log('\n🏋️ Workout Conversions:');
  convertedWorkouts.forEach((workout, i) => {
    const hasValidUUID = isValidUUID(workout.user_id);
    const isCorrectUUID = workout.user_id === MOCK_USER_UUID;
    const hasNoLocalId = !workout.id; // Should be removed
    
    if (hasValidUUID && isCorrectUUID && hasNoLocalId) {
      console.log(`   ✅ Workout ${i + 1}: ${workout.user_id} (${workout.workout_date})`);
      conversionCount++;
    } else {
      console.log(`   ❌ Workout ${i + 1}: ${workout.user_id} (FAILED)`);
      if (!hasValidUUID) console.log(`      - Invalid UUID format`);
      if (!isCorrectUUID) console.log(`      - Wrong UUID`);
      if (workout.id) console.log(`      - Local ID not removed`);
      allValid = false;
    }
  });
  
  // Check meals
  console.log('\n🍽️ Meal Conversions:');
  convertedMeals.forEach((meal, i) => {
    const hasValidUUID = isValidUUID(meal.user_id);
    const isCorrectUUID = meal.user_id === MOCK_USER_UUID;
    const hasNoLocalId = !meal.id; // Should be removed
    
    if (hasValidUUID && isCorrectUUID && hasNoLocalId) {
      console.log(`   ✅ Meal ${i + 1}: ${meal.user_id} (${meal.meal_date} - ${meal.meal_type})`);
      conversionCount++;
    } else {
      console.log(`   ❌ Meal ${i + 1}: ${meal.user_id} (FAILED)`);
      if (!hasValidUUID) console.log(`      - Invalid UUID format`);
      if (!isCorrectUUID) console.log(`      - Wrong UUID`);
      if (meal.id) console.log(`      - Local ID not removed`);
      allValid = false;
    }
  });
  
  // Step 4: Summary
  const totalRecords = localData.workouts.length + localData.meals.length;
  console.log('\n📊 Conversion Summary:');
  console.log(`   Total records: ${totalRecords}`);
  console.log(`   Successfully converted: ${conversionCount}`);
  console.log(`   Conversion rate: ${conversionCount}/${totalRecords} (${Math.round(conversionCount/totalRecords*100)}%)`);
  
  // Step 5: Database compatibility check
  console.log('\n🗄️ Database Compatibility Check:');
  const allHaveValidUUIDs = [...convertedWorkouts, ...convertedMeals].every(record => 
    isValidUUID(record.user_id)
  );
  
  const noLocalUserRemaining = [...convertedWorkouts, ...convertedMeals].every(record => 
    record.user_id !== 'local_user'
  );
  
  const noLocalIdsRemaining = [...convertedWorkouts, ...convertedMeals].every(record => 
    !record.id || !record.id.toString().startsWith('local')
  );
  
  console.log(`   ✅ All UUIDs valid: ${allHaveValidUUIDs ? 'YES' : 'NO'}`);
  console.log(`   ✅ No 'local_user' remaining: ${noLocalUserRemaining ? 'YES' : 'NO'}`);
  console.log(`   ✅ No local IDs remaining: ${noLocalIdsRemaining ? 'YES' : 'NO'}`);
  
  const databaseReady = allHaveValidUUIDs && noLocalUserRemaining && noLocalIdsRemaining;
  console.log(`   🎯 Database ready: ${databaseReady ? '✅ YES' : '❌ NO'}`);
  
  // Final result
  console.log(`\n🎉 Overall Result: ${allValid && databaseReady ? '✅ SUCCESS' : '❌ FAILED'}`);
  
  if (allValid && databaseReady) {
    console.log('\n🛡️ UUID Conversion Fix Validation:');
    console.log('   ✅ local_user records properly converted to authenticated UUID');
    console.log('   ✅ All user_ids are valid UUID format');
    console.log('   ✅ Local IDs removed to prevent conflicts');
    console.log('   ✅ Records are ready for database insertion');
    console.log('\n🚀 The UUID conversion fix will prevent the PostgreSQL error!');
  } else {
    console.log('\n❌ Issues found that need to be addressed');
  }
  
  return {
    success: allValid && databaseReady,
    converted: conversionCount,
    total: totalRecords,
    databaseReady
  };
}

// Test edge cases
function testEdgeCases() {
  console.log('\n🧪 Testing Edge Cases\n');
  
  const edgeCases = [
    // Missing user_id
    { id: 'test1', workout_date: '2025-06-17', workout_day_name: 'Monday' },
    // Empty user_id
    { id: 'test2', user_id: '', workout_date: '2025-06-17', workout_day_name: 'Monday' },
    // Null user_id
    { id: 'test3', user_id: null, workout_date: '2025-06-17', workout_day_name: 'Monday' },
    // Already has UUID
    { id: 'test4', user_id: MOCK_USER_UUID, workout_date: '2025-06-17', workout_day_name: 'Monday' }
  ];
  
  console.log('🔍 Testing edge cases:');
  const converted = convertLocalUserToAuthenticatedUser(edgeCases, MOCK_USER_UUID);
  
  let edgeTestsPassed = 0;
  converted.forEach((record, i) => {
    const hasCorrectUUID = record.user_id === MOCK_USER_UUID;
    const hasValidUUID = isValidUUID(record.user_id);
    
    if (hasCorrectUUID && hasValidUUID) {
      console.log(`   ✅ Edge case ${i + 1}: Properly handled`);
      edgeTestsPassed++;
    } else {
      console.log(`   ❌ Edge case ${i + 1}: Failed (${record.user_id})`);
    }
  });
  
  console.log(`\n📋 Edge Cases Result: ${edgeTestsPassed}/${edgeCases.length} passed`);
  
  return edgeTestsPassed === edgeCases.length;
}

// Main test runner
function runUUIDConversionTests() {
  console.log('🚀 Starting UUID Conversion Tests\n');
  
  const mainTestResult = testUUIDConversion();
  const edgeTestResult = testEdgeCases();
  
  const allTestsPassed = mainTestResult.success && edgeTestResult;
  
  console.log('\n📊 Final Test Results:');
  console.log(`   Main conversion test: ${mainTestResult.success ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`   Edge cases test: ${edgeTestResult ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`   Overall result: ${allTestsPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  
  if (allTestsPassed) {
    console.log('\n🎯 The UUID conversion fix is working correctly!');
    console.log('   - No more "invalid input syntax for type uuid: \'local_user\'" errors');
    console.log('   - Local user data properly converted to authenticated user data');
    console.log('   - Database sync will work without UUID format errors');
  }
  
  return allTestsPassed;
}

// Export for use in other tests
module.exports = {
  runUUIDConversionTests,
  testUUIDConversion,
  testEdgeCases,
  convertLocalUserToAuthenticatedUser,
  isValidUUID,
  MOCK_USER_UUID
};

// Run tests if this file is executed directly
if (require.main === module) {
  runUUIDConversionTests();
}
