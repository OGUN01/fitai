/**
 * Test Script: Modern Meal Plan Generation
 * 
 * Demonstrates the exponential improvement from structured output
 * vs complex JSON parsing for meal plan generation
 */

import { ModernMealGenerator } from './generators/modern-meal-generator';
import { testUser1, testUser2, testUser3, allTestUsers } from './test-data/sample-onboarding-data';
import * as fs from 'fs';
import * as path from 'path';

// Create results directory
const resultsDir = path.join(__dirname, 'results');
if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir, { recursive: true });
}

/**
 * Test complete weekly meal plan generation
 */
async function testWeeklyMealPlanGeneration() {
  console.log("\n🍽️ TESTING WEEKLY MEAL PLAN GENERATION");
  console.log("======================================");
  
  const generator = new ModernMealGenerator();
  
  try {
    console.log(`\n👤 Testing with: ${testUser1.name}`);
    console.log(`🥗 Diet: ${testUser1.dietType} (${testUser1.cuisinePreferences.join(', ')})`);
    console.log(`🎯 Calories: ${testUser1.calorieTarget}/day`);
    console.log(`🚫 Allergies: ${testUser1.allergies.join(', ') || 'None'}`);
    console.log(`🌍 Region: ${testUser1.countryRegion}`);
    
    const startTime = Date.now();
    const mealPlan = await generator.generateWeeklyMealPlan(testUser1);
    const endTime = Date.now();
    
    console.log("\n✅ GENERATION SUCCESSFUL!");
    console.log(`⏱️  Generation Time: ${endTime - startTime}ms`);
    console.log(`📋 Plan Name: ${mealPlan.planName}`);
    console.log(`🥗 Diet Type: ${mealPlan.dietType}`);
    console.log(`📅 Days Planned: ${mealPlan.weeklyPlan.length}`);
    console.log(`🔥 Weekly Calories: ${mealPlan.totalWeeklyNutrition.calories}`);
    console.log(`🛒 Shopping Items: ${mealPlan.shoppingList.length}`);
    console.log(`💡 Meal Prep Tips: ${mealPlan.mealPrepTips.length}`);
    
    // Show sample day
    const sampleDay = mealPlan.weeklyPlan[0];
    console.log(`\n📝 Sample Day (${sampleDay.day}):`);
    console.log(`   🌅 Breakfast: ${sampleDay.meals.breakfast.name} (${sampleDay.meals.breakfast.nutrition.calories} cal)`);
    console.log(`   🌞 Lunch: ${sampleDay.meals.lunch.name} (${sampleDay.meals.lunch.nutrition.calories} cal)`);
    console.log(`   🌙 Dinner: ${sampleDay.meals.dinner.name} (${sampleDay.meals.dinner.nutrition.calories} cal)`);
    console.log(`   💧 Water: ${sampleDay.waterIntake}ml`);
    console.log(`   📊 Daily Total: ${sampleDay.totalNutrition.calories} calories`);
    
    // Show sample recipe details
    const sampleMeal = sampleDay.meals.breakfast;
    console.log(`\n🍳 Sample Recipe (${sampleMeal.name}):`);
    console.log(`   🍽️  Cuisine: ${sampleMeal.cuisine}`);
    console.log(`   ⏰ Prep: ${sampleMeal.prepTime}min, Cook: ${sampleMeal.cookTime}min`);
    console.log(`   👥 Servings: ${sampleMeal.servings}`);
    console.log(`   📈 Difficulty: ${sampleMeal.difficulty}`);
    console.log(`   🥘 Ingredients: ${sampleMeal.ingredients.length} items`);
    console.log(`   📝 Instructions: ${sampleMeal.instructions.length} steps`);
    
    // Save result to file
    const resultFile = path.join(resultsDir, `meal-plan-${testUser1.name.replace(' ', '-')}-${Date.now()}.json`);
    fs.writeFileSync(resultFile, JSON.stringify(mealPlan, null, 2));
    console.log(`💾 Result saved to: ${resultFile}`);
    
    return { success: true, duration: endTime - startTime, plan: mealPlan };
    
  } catch (error: any) {
    console.error("❌ GENERATION FAILED:", error.message);
    return { success: false, duration: 0, error: error.message };
  }
}

/**
 * Test daily meal plan generation
 */
async function testDailyMealPlanGeneration() {
  console.log("\n⚡ TESTING DAILY MEAL PLAN GENERATION");
  console.log("====================================");
  
  const generator = new ModernMealGenerator();
  
  try {
    console.log(`\n👤 Daily plan for: ${testUser2.name}`);
    
    const startTime = Date.now();
    const dailyPlan = await generator.generateDailyMealPlan(testUser2, "Wednesday");
    const endTime = Date.now();
    
    console.log("\n✅ DAILY GENERATION SUCCESSFUL!");
    console.log(`⏱️  Generation Time: ${endTime - startTime}ms`);
    console.log(`📅 Day: ${dailyPlan.day}`);
    console.log(`🔥 Total Calories: ${dailyPlan.totalCalories}`);
    
    // Show all meals
    console.log("\n🍽️ Daily Meals:");
    console.log(`   🌅 Breakfast: ${dailyPlan.meals.breakfast.name} (${dailyPlan.meals.breakfast.calories} cal)`);
    console.log(`   🌞 Lunch: ${dailyPlan.meals.lunch.name} (${dailyPlan.meals.lunch.calories} cal)`);
    console.log(`   🌙 Dinner: ${dailyPlan.meals.dinner.name} (${dailyPlan.meals.dinner.calories} cal)`);
    
    // Show sample ingredients
    console.log(`\n🥘 Sample Ingredients (${dailyPlan.meals.breakfast.name}):`);
    dailyPlan.meals.breakfast.ingredients.slice(0, 5).forEach((ingredient: string, index: number) => {
      console.log(`   ${index + 1}. ${ingredient}`);
    });
    
    return { success: true, duration: endTime - startTime };
    
  } catch (error: any) {
    console.error("❌ DAILY GENERATION FAILED:", error.message);
    return { success: false, duration: 0, error: error.message };
  }
}

/**
 * Benchmark meal generation for all users
 */
async function benchmarkAllMealUsers() {
  console.log("\n📊 BENCHMARKING ALL MEAL USERS");
  console.log("===============================");
  
  const generator = new ModernMealGenerator();
  const results = [];
  
  for (const user of allTestUsers) {
    console.log(`\n🔄 Benchmarking: ${user.name} (${user.dietType}, ${user.countryRegion})`);
    
    try {
      const benchmark = await generator.benchmarkGeneration(user);
      results.push({
        user: user.name,
        profile: {
          dietType: user.dietType,
          cuisine: user.cuisinePreferences,
          calories: user.calorieTarget,
          allergies: user.allergies,
          country: user.countryRegion
        },
        performance: benchmark
      });
      
      console.log(`   ✅ Success: ${benchmark.success}`);
      console.log(`   ⏱️  Duration: ${benchmark.duration}ms`);
      console.log(`   📏 Plan Size: ${(benchmark.planSize / 1024).toFixed(1)}KB`);
      console.log(`   🍽️  Meals Generated: ${benchmark.mealsGenerated}`);
      
    } catch (error: any) {
      console.log(`   ❌ Failed: ${error.message}`);
      results.push({
        user: user.name,
        profile: { dietType: user.dietType },
        performance: { success: false, error: error.message, duration: 0, planSize: 0, mealsGenerated: 0 }
      });
    }
  }
  
  // Save benchmark results
  const benchmarkFile = path.join(resultsDir, `meal-benchmark-${Date.now()}.json`);
  fs.writeFileSync(benchmarkFile, JSON.stringify(results, null, 2));
  console.log(`\n💾 Benchmark results saved to: ${benchmarkFile}`);
  
  // Summary statistics
  const successful = results.filter(r => r.performance.success);
  if (successful.length > 0) {
    const avgDuration = successful.reduce((sum, r) => sum + r.performance.duration, 0) / successful.length;
    const avgSize = successful.reduce((sum, r) => sum + r.performance.planSize, 0) / successful.length;
    const avgMeals = successful.reduce((sum, r) => sum + r.performance.mealsGenerated, 0) / successful.length;
    
    console.log("\n📈 BENCHMARK SUMMARY:");
    console.log(`   Success Rate: ${successful.length}/${results.length} (${(successful.length/results.length*100).toFixed(1)}%)`);
    console.log(`   Average Duration: ${avgDuration.toFixed(0)}ms`);
    console.log(`   Average Plan Size: ${(avgSize / 1024).toFixed(1)}KB`);
    console.log(`   Average Meals Generated: ${avgMeals.toFixed(1)}`);
  }
  
  return results;
}

/**
 * Test cuisine-specific generation
 */
async function testCuisineSpecificGeneration() {
  console.log("\n🌍 TESTING CUISINE-SPECIFIC GENERATION");
  console.log("======================================");
  
  const generator = new ModernMealGenerator();
  const cuisineTests = [
    { user: testUser1, focus: "Indian Vegetarian" },
    { user: testUser2, focus: "American Omnivore" },
    { user: testUser3, focus: "European Vegan" }
  ];
  
  for (const test of cuisineTests) {
    console.log(`\n🍽️ Testing ${test.focus} cuisine for ${test.user.name}`);
    
    try {
      const startTime = Date.now();
      const dailyPlan = await generator.generateDailyMealPlan(test.user, "Friday");
      const endTime = Date.now();
      
      console.log(`   ✅ Generated in ${endTime - startTime}ms`);
      console.log(`   🥗 Breakfast: ${dailyPlan.meals.breakfast.name}`);
      console.log(`   🍽️  Lunch: ${dailyPlan.meals.lunch.name}`);
      console.log(`   🍽️  Dinner: ${dailyPlan.meals.dinner.name}`);
      
    } catch (error: any) {
      console.log(`   ❌ Failed: ${error.message}`);
    }
  }
}

/**
 * Main test runner for meal generation
 */
async function runMealTests() {
  console.log("🚀 STARTING MODERN MEAL GENERATION TESTS");
  console.log("========================================");
  console.log("Demonstrating structured output improvements for meal planning!");
  
  const testResults = {
    timestamp: new Date().toISOString(),
    tests: {
      weeklyGeneration: null as any,
      dailyGeneration: null as any,
      benchmark: null as any
    }
  };
  
  try {
    // Test 1: Weekly meal plan generation
    testResults.tests.weeklyGeneration = await testWeeklyMealPlanGeneration();
    
    // Test 2: Daily meal plan generation
    testResults.tests.dailyGeneration = await testDailyMealPlanGeneration();
    
    // Test 3: Benchmark all users
    testResults.tests.benchmark = await benchmarkAllMealUsers();
    
    // Test 4: Cuisine-specific generation
    await testCuisineSpecificGeneration();
    
    console.log("\n🎉 ALL MEAL TESTS COMPLETED!");
    console.log("============================");
    
    // Save complete test results
    const testResultsFile = path.join(resultsDir, `complete-meal-tests-${Date.now()}.json`);
    fs.writeFileSync(testResultsFile, JSON.stringify(testResults, null, 2));
    console.log(`📊 Complete test results: ${testResultsFile}`);
    
  } catch (error: any) {
    console.error("💥 MEAL TEST SUITE FAILED:", error);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runMealTests().catch(console.error);
}

export { runMealTests, testWeeklyMealPlanGeneration, benchmarkAllMealUsers };
