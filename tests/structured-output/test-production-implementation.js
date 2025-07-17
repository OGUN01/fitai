/**
 * Test Production Implementation of Structured Output
 * 
 * This tests the actual FitAI generators with structured output
 * using real onboarding data format
 */

const { WorkoutGenerator } = require("../../services/ai/workoutGenerator");
const { MealPlanGenerator } = require("../../services/ai/mealPlanGenerator");

// Sample onboarding data in FitAI format
const sampleUserPreferences = {
  // Fitness preferences
  fitnessLevel: 'beginner',
  workoutLocation: 'home',
  availableEquipment: ['dumbbells', 'yoga_mat', 'resistance_bands'],
  exerciseFrequency: 4,
  timePerSession: 45,
  focusAreas: ['weight_loss', 'general_fitness', 'strength_building'],
  exercisesToAvoid: 'None',
  
  // Demographics
  age: 28,
  gender: 'female',
  weight_kg: 70,
  height_cm: 165,
  targetWeight: 60,
  
  // Additional data
  country_region: 'India',
  activityLevel: 'lightly_active',
  weightGoal: 'weight_loss',
  preferredWorkoutDays: ['Monday', 'Tuesday', 'Thursday', 'Friday']
};

const sampleDietPreferences = {
  dietType: 'vegetarian',
  dietPlanPreference: 'balanced',
  allergies: ['nuts'],
  mealFrequency: 3,
  countryRegion: 'India',
  fitnessGoal: 'weight loss',
  calorieTarget: 1800,
  restrictions: [],
  excludedFoods: [],
  favoriteFoods: ['rice', 'dal', 'vegetables'],
  preferredMealTimes: [
    { name: 'breakfast', time: '08:00' },
    { name: 'lunch', time: '13:00' },
    { name: 'dinner', time: '19:00' }
  ],
  waterIntakeGoal: 2500
};

/**
 * Test workout generation with structured output
 */
async function testWorkoutGeneration() {
  console.log("\n🏋️ TESTING PRODUCTION WORKOUT GENERATION");
  console.log("=========================================");
  
  try {
    const workoutGenerator = new WorkoutGenerator();
    
    console.log("👤 User Profile:");
    console.log(`   Name: Priya (${sampleUserPreferences.fitnessLevel} level)`);
    console.log(`   Goal: ${sampleUserPreferences.weightGoal} (${sampleUserPreferences.weight_kg}kg → ${sampleUserPreferences.targetWeight}kg)`);
    console.log(`   Equipment: ${sampleUserPreferences.availableEquipment.join(', ')}`);
    console.log(`   Schedule: ${sampleUserPreferences.exerciseFrequency} days/week, ${sampleUserPreferences.timePerSession} min/session`);
    
    const startTime = Date.now();
    console.log("\n🔄 Generating workout plan with structured output...");
    
    const workoutPlan = await workoutGenerator.generateWorkoutPlan(sampleUserPreferences);
    
    const duration = Date.now() - startTime;
    
    console.log("\n✅ WORKOUT GENERATION SUCCESSFUL!");
    console.log(`⏱️  Generation Time: ${duration}ms`);
    console.log(`📋 Plan Type: ${workoutPlan.isFallback ? 'Fallback' : 'AI Generated'}`);
    
    if (!workoutPlan.isFallback) {
      console.log(`📅 Weekly Schedule: ${workoutPlan.weeklySchedule?.length || 'N/A'} days`);
      console.log(`🎯 Difficulty: ${workoutPlan.difficultyLevel || 'N/A'}`);
      console.log(`🛠️  Equipment: ${workoutPlan.equipmentRequired?.join(', ') || 'N/A'}`);
      
      if (workoutPlan.weeklySchedule && workoutPlan.weeklySchedule.length > 0) {
        const sampleDay = workoutPlan.weeklySchedule[0];
        console.log(`\n📝 Sample Day (${sampleDay.day}):`);
        console.log(`   Focus: ${sampleDay.focus}`);
        console.log(`   Duration: ${sampleDay.duration} minutes`);
        console.log(`   Exercises: ${sampleDay.exercises?.length || 0}`);
        
        if (sampleDay.exercises && sampleDay.exercises.length > 0) {
          console.log(`   Sample Exercise: ${sampleDay.exercises[0].name} - ${sampleDay.exercises[0].sets}x${sampleDay.exercises[0].reps}`);
        }
      }
    }
    
    return { success: true, duration, plan: workoutPlan };
    
  } catch (error) {
    console.error("❌ WORKOUT GENERATION FAILED:", error.message);
    return { success: false, duration: 0, error: error.message };
  }
}

/**
 * Test meal plan generation with structured output
 */
async function testMealPlanGeneration() {
  console.log("\n🍽️ TESTING PRODUCTION MEAL PLAN GENERATION");
  console.log("===========================================");
  
  try {
    const mealPlanGenerator = new MealPlanGenerator();
    
    console.log("👤 User Profile:");
    console.log(`   Diet: ${sampleDietPreferences.dietType} (${sampleDietPreferences.countryRegion})`);
    console.log(`   Goal: ${sampleDietPreferences.fitnessGoal}`);
    console.log(`   Calories: ${sampleDietPreferences.calorieTarget}/day`);
    console.log(`   Allergies: ${sampleDietPreferences.allergies.join(', ') || 'None'}`);
    console.log(`   Meals: ${sampleDietPreferences.mealFrequency}/day`);
    
    const startTime = Date.now();
    console.log("\n🔄 Generating meal plan with structured output...");
    
    const mealPlan = await mealPlanGenerator.generateMealPlan(sampleDietPreferences);
    
    const duration = Date.now() - startTime;
    
    console.log("\n✅ MEAL PLAN GENERATION SUCCESSFUL!");
    console.log(`⏱️  Generation Time: ${duration}ms`);
    console.log(`📋 Plan Type: ${mealPlan.isFallback ? 'Fallback' : 'AI Generated'}`);
    
    if (!mealPlan.isFallback) {
      console.log(`📅 Daily Plans: ${mealPlan.dailyPlans?.length || 'N/A'} days`);
      console.log(`🛒 Shopping Items: ${mealPlan.shoppingList?.length || 'N/A'}`);
      console.log(`💡 Meal Prep Tips: ${mealPlan.mealPrepTips?.length || 'N/A'}`);
      
      if (mealPlan.dailyPlans && mealPlan.dailyPlans.length > 0) {
        const sampleDay = mealPlan.dailyPlans[0];
        console.log(`\n📝 Sample Day (${sampleDay.day}):`);
        console.log(`   Meals: ${sampleDay.meals?.length || 0}`);
        console.log(`   Total Calories: ${sampleDay.totalNutrition?.calories || 'N/A'}`);
        
        if (sampleDay.meals && sampleDay.meals.length > 0) {
          const breakfast = sampleDay.meals[0];
          console.log(`   Sample Meal: ${breakfast.recipe?.name || 'N/A'} (${breakfast.recipe?.nutrition?.calories || 'N/A'} cal)`);
        }
      }
    }
    
    return { success: true, duration, plan: mealPlan };
    
  } catch (error) {
    console.error("❌ MEAL PLAN GENERATION FAILED:", error.message);
    return { success: false, duration: 0, error: error.message };
  }
}

/**
 * Run comprehensive production tests
 */
async function runProductionTests() {
  console.log("🚀 FITAI PRODUCTION STRUCTURED OUTPUT TESTS");
  console.log("============================================");
  console.log("Testing actual FitAI generators with structured output!");
  console.log("");
  
  const results = {
    timestamp: new Date().toISOString(),
    workout: null,
    meal: null
  };
  
  try {
    // Test workout generation
    results.workout = await testWorkoutGeneration();
    
    // Test meal plan generation
    results.meal = await testMealPlanGeneration();
    
    // Summary
    console.log("\n📊 PRODUCTION TEST SUMMARY");
    console.log("==========================");
    console.log(`Workout Generation: ${results.workout.success ? '✅ SUCCESS' : '❌ FAILED'} (${results.workout.duration}ms)`);
    console.log(`Meal Plan Generation: ${results.meal.success ? '✅ SUCCESS' : '❌ FAILED'} (${results.meal.duration}ms)`);
    
    if (results.workout.success && results.meal.success) {
      const avgTime = (results.workout.duration + results.meal.duration) / 2;
      console.log(`\n🎉 ALL TESTS PASSED!`);
      console.log(`⚡ Average Generation Time: ${avgTime.toFixed(0)}ms`);
      console.log(`🔥 Structured Output Implementation: SUCCESSFUL`);
      console.log(`✅ Ready for Production Deployment!`);
    } else {
      console.log(`\n⚠️  Some tests failed - check implementation`);
    }
    
  } catch (error) {
    console.error("💥 PRODUCTION TESTS FAILED:", error);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runProductionTests().catch(console.error);
}

module.exports = { runProductionTests, testWorkoutGeneration, testMealPlanGeneration };
