/**
 * Simple Data Validation Test
 * 
 * This test demonstrates the data validation logic without requiring
 * React Native or TypeScript compilation.
 */

// Simple date validation function (extracted from our validation logic)
function validateDate(dateString, fieldName = 'date') {
  const result = {
    isValid: true,
    errors: [],
    warnings: []
  };

  try {
    // Parse the date
    const date = new Date(dateString + 'T00:00:00');
    
    if (isNaN(date.getTime())) {
      result.errors.push(`Invalid ${fieldName} format: ${dateString}`);
      result.isValid = false;
      return result;
    }

    const today = new Date();
    const todayString = today.toISOString().split('T')[0];
    
    // Check if date is in the future
    if (date > today) {
      result.errors.push(`${fieldName} cannot be in the future: ${dateString} (today: ${todayString})`);
      result.isValid = false;
    }

    // Check if date is too far in the past (more than 1 year)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    if (date < oneYearAgo) {
      result.warnings.push(`${fieldName} is more than 1 year old: ${dateString}`);
    }

  } catch (error) {
    result.errors.push(`Error parsing ${fieldName}: ${dateString}`);
    result.isValid = false;
  }

  return result;
}

// Simple workout validation function
function validateWorkoutCompletion(workout) {
  const result = {
    isValid: true,
    errors: [],
    warnings: []
  };

  // Required field validation
  if (!workout.user_id) {
    result.errors.push('Missing user_id');
    result.isValid = false;
  }

  if (!workout.workout_date) {
    result.errors.push('Missing workout_date');
    result.isValid = false;
  }

  if (!workout.workout_day_name) {
    result.errors.push('Missing workout_day_name');
    result.isValid = false;
  }

  if (!workout.completed_at) {
    result.errors.push('Missing completed_at timestamp');
    result.isValid = false;
  }

  // Date validation
  if (workout.workout_date) {
    const dateValidation = validateDate(workout.workout_date, 'workout_date');
    if (!dateValidation.isValid) {
      result.errors.push(...dateValidation.errors);
      result.warnings.push(...dateValidation.warnings);
      result.isValid = false;
    }
  }

  return result;
}

// Simple meal validation function
function validateMealCompletion(meal) {
  const result = {
    isValid: true,
    errors: [],
    warnings: []
  };

  // Required field validation
  if (!meal.user_id) {
    result.errors.push('Missing user_id');
    result.isValid = false;
  }

  if (!meal.meal_date) {
    result.errors.push('Missing meal_date');
    result.isValid = false;
  }

  if (!meal.meal_type) {
    result.errors.push('Missing meal_type');
    result.isValid = false;
  }

  if (!meal.completed_at) {
    result.errors.push('Missing completed_at timestamp');
    result.isValid = false;
  }

  // Date validation
  if (meal.meal_date) {
    const dateValidation = validateDate(meal.meal_date, 'meal_date');
    if (!dateValidation.isValid) {
      result.errors.push(...dateValidation.errors);
      result.warnings.push(...dateValidation.warnings);
      result.isValid = false;
    }
  }

  // Meal type validation
  if (meal.meal_type) {
    const validMealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];
    if (!validMealTypes.includes(meal.meal_type.toLowerCase())) {
      result.errors.push(`Invalid meal_type: ${meal.meal_type}. Must be one of: ${validMealTypes.join(', ')}`);
      result.isValid = false;
    }
  }

  return result;
}

// Generate test data
function generateTestData() {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const workouts = [
    // Valid workouts (past and today) - these have 'local_user' which should be converted
    {
      id: 'workout_1',
      user_id: 'local_user', // This will be converted to real UUID during sync
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

  const meals = [
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

  return { workouts, meals };
}

// Main test function
function runValidationTests() {
  console.log('🚀 Starting Simple Data Validation Tests\n');
  
  const { workouts, meals } = generateTestData();
  
  console.log('📊 Test Data Generated:');
  console.log(`   Total workouts: ${workouts.length}`);
  console.log(`   Total meals: ${meals.length}\n`);
  
  // Test workout validation
  console.log('🏋️ Testing Workout Validation:');
  let validWorkouts = 0;
  let invalidWorkouts = 0;
  let futureWorkouts = 0;
  
  workouts.forEach((workout, index) => {
    const validation = validateWorkoutCompletion(workout);
    
    if (validation.isValid) {
      validWorkouts++;
      console.log(`   ✅ Workout ${index + 1}: VALID (${workout.workout_date})`);
    } else {
      invalidWorkouts++;
      const isFuture = validation.errors.some(e => e.includes('future'));
      if (isFuture) futureWorkouts++;
      
      console.log(`   ❌ Workout ${index + 1}: INVALID (${workout.workout_date || 'missing date'})`);
      validation.errors.forEach(error => console.log(`      - ${error}`));
    }
  });
  
  console.log(`\n📋 Workout Results: ${validWorkouts} valid, ${invalidWorkouts} invalid (${futureWorkouts} future dates)\n`);
  
  // Test meal validation
  console.log('🍽️ Testing Meal Validation:');
  let validMeals = 0;
  let invalidMeals = 0;
  let futureMeals = 0;
  
  meals.forEach((meal, index) => {
    const validation = validateMealCompletion(meal);
    
    if (validation.isValid) {
      validMeals++;
      console.log(`   ✅ Meal ${index + 1}: VALID (${meal.meal_date} - ${meal.meal_type})`);
    } else {
      invalidMeals++;
      const isFuture = validation.errors.some(e => e.includes('future'));
      if (isFuture) futureMeals++;
      
      console.log(`   ❌ Meal ${index + 1}: INVALID (${meal.meal_date || 'missing date'} - ${meal.meal_type})`);
      validation.errors.forEach(error => console.log(`      - ${error}`));
    }
  });
  
  console.log(`\n📋 Meal Results: ${validMeals} valid, ${invalidMeals} invalid (${futureMeals} future dates)\n`);
  
  // Summary
  console.log('🎯 Test Summary:');
  console.log(`   Expected: 2 valid workouts, 3 invalid workouts (2 future dates)`);
  console.log(`   Actual:   ${validWorkouts} valid workouts, ${invalidWorkouts} invalid workouts (${futureWorkouts} future dates)`);
  console.log(`   Expected: 2 valid meals, 2 invalid meals (1 future date)`);
  console.log(`   Actual:   ${validMeals} valid meals, ${invalidMeals} invalid meals (${futureMeals} future dates)`);
  
  const workoutTestPassed = validWorkouts === 2 && invalidWorkouts === 3 && futureWorkouts === 2;
  const mealTestPassed = validMeals === 2 && invalidMeals === 2 && futureMeals === 1;
  
  console.log(`\n🏋️ Workout Validation: ${workoutTestPassed ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`🍽️ Meal Validation: ${mealTestPassed ? '✅ PASSED' : '❌ FAILED'}`);
  
  const allTestsPassed = workoutTestPassed && mealTestPassed;
  console.log(`\n🎉 Overall Result: ${allTestsPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  
  if (allTestsPassed) {
    console.log('\n🛡️ Data Sync Integrity Fix Validation:');
    console.log('   ✅ Future dates are correctly identified and blocked');
    console.log('   ✅ Missing required fields are detected');
    console.log('   ✅ Invalid meal types are rejected');
    console.log('   ✅ Valid past and current date completions are accepted');
    console.log('\n🚀 The fix will prevent future dates from being synced to the database!');
  }
  
  return allTestsPassed;
}

// Run the test
if (require.main === module) {
  runValidationTests();
}

module.exports = { runValidationTests, validateDate, validateWorkoutCompletion, validateMealCompletion };
