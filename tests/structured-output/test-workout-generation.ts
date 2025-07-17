/**
 * Test Script: Modern Workout Generation
 * 
 * This script demonstrates the exponential improvement from using
 * Google's structured output vs old JSON parsing approach
 */

import { ModernWorkoutGenerator } from './generators/modern-workout-generator';
import { testUser1, testUser2, testUser3, allTestUsers } from './test-data/sample-onboarding-data';
import * as fs from 'fs';
import * as path from 'path';

// Create results directory if it doesn't exist
const resultsDir = path.join(__dirname, 'results');
if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir, { recursive: true });
}

/**
 * Test individual workout generation
 */
async function testSingleWorkoutGeneration() {
  console.log("\n🏋️ TESTING SINGLE WORKOUT GENERATION");
  console.log("=====================================");
  
  const generator = new ModernWorkoutGenerator();
  
  try {
    console.log(`\n👤 Testing with: ${testUser1.name}`);
    console.log(`📊 Profile: ${testUser1.fitnessLevel} level, ${testUser1.fitnessGoals.join(' + ')}`);
    console.log(`⚡ Equipment: ${testUser1.availableEquipment.join(', ')}`);
    
    const startTime = Date.now();
    const workoutPlan = await generator.generateWorkoutPlan(testUser1);
    const endTime = Date.now();
    
    console.log("\n✅ GENERATION SUCCESSFUL!");
    console.log(`⏱️  Generation Time: ${endTime - startTime}ms`);
    console.log(`📋 Plan Name: ${workoutPlan.planName}`);
    console.log(`📅 Weekly Schedule: ${workoutPlan.weeklySchedule.length} days`);
    console.log(`⏰ Total Weekly Duration: ${workoutPlan.totalWeeklyDuration} minutes`);
    console.log(`🎯 Difficulty Level: ${workoutPlan.difficultyLevel}`);
    console.log(`🛠️  Equipment Required: ${workoutPlan.equipmentRequired.join(', ')}`);
    
    // Show sample workout day
    const sampleDay = workoutPlan.weeklySchedule[0];
    console.log(`\n📝 Sample Day (${sampleDay.day}):`);
    console.log(`   Focus: ${sampleDay.focus}`);
    console.log(`   Duration: ${sampleDay.duration} minutes`);
    console.log(`   Exercises: ${sampleDay.exercises.length}`);
    console.log(`   Sample Exercise: ${sampleDay.exercises[0].name} - ${sampleDay.exercises[0].sets}x${sampleDay.exercises[0].reps}`);
    
    // Save result to file
    const resultFile = path.join(resultsDir, `workout-${testUser1.name.replace(' ', '-')}-${Date.now()}.json`);
    fs.writeFileSync(resultFile, JSON.stringify(workoutPlan, null, 2));
    console.log(`💾 Result saved to: ${resultFile}`);
    
    return { success: true, duration: endTime - startTime, plan: workoutPlan };
    
  } catch (error: any) {
    console.error("❌ GENERATION FAILED:", error.message);
    return { success: false, duration: 0, error: error.message };
  }
}

/**
 * Test quick workout generation
 */
async function testQuickWorkoutGeneration() {
  console.log("\n⚡ TESTING QUICK WORKOUT GENERATION");
  console.log("===================================");
  
  const generator = new ModernWorkoutGenerator();
  
  try {
    console.log(`\n👤 Quick workout for: ${testUser2.name}`);
    
    const startTime = Date.now();
    const quickWorkout = await generator.generateQuickWorkout(testUser2);
    const endTime = Date.now();
    
    console.log("\n✅ QUICK GENERATION SUCCESSFUL!");
    console.log(`⏱️  Generation Time: ${endTime - startTime}ms`);
    console.log(`📅 Day: ${quickWorkout.day}`);
    console.log(`🎯 Focus: ${quickWorkout.focus}`);
    console.log(`⏰ Duration: ${quickWorkout.duration} minutes`);
    console.log(`💪 Exercises: ${quickWorkout.exercises.length}`);
    
    // Show all exercises
    console.log("\n📋 Exercise List:");
    quickWorkout.exercises.forEach((exercise: any, index: number) => {
      console.log(`   ${index + 1}. ${exercise.name} - ${exercise.sets}x${exercise.reps} (${exercise.restSeconds}s rest)`);
    });
    
    return { success: true, duration: endTime - startTime };
    
  } catch (error: any) {
    console.error("❌ QUICK GENERATION FAILED:", error.message);
    return { success: false, duration: 0, error: error.message };
  }
}

/**
 * Benchmark all test users
 */
async function benchmarkAllUsers() {
  console.log("\n📊 BENCHMARKING ALL TEST USERS");
  console.log("===============================");
  
  const generator = new ModernWorkoutGenerator();
  const results = [];
  
  for (const user of allTestUsers) {
    console.log(`\n🔄 Benchmarking: ${user.name} (${user.fitnessLevel}, ${user.countryRegion})`);
    
    try {
      const benchmark = await generator.benchmarkGeneration(user);
      results.push({
        user: user.name,
        profile: {
          level: user.fitnessLevel,
          goals: user.fitnessGoals,
          equipment: user.availableEquipment.length,
          country: user.countryRegion
        },
        performance: benchmark
      });
      
      console.log(`   ✅ Success: ${benchmark.success}`);
      console.log(`   ⏱️  Duration: ${benchmark.duration}ms`);
      console.log(`   📏 Plan Size: ${(benchmark.planSize / 1024).toFixed(1)}KB`);
      
    } catch (error: any) {
      console.log(`   ❌ Failed: ${error.message}`);
      results.push({
        user: user.name,
        profile: { level: user.fitnessLevel },
        performance: { success: false, error: error.message, duration: 0, planSize: 0 }
      });
    }
  }
  
  // Save benchmark results
  const benchmarkFile = path.join(resultsDir, `workout-benchmark-${Date.now()}.json`);
  fs.writeFileSync(benchmarkFile, JSON.stringify(results, null, 2));
  console.log(`\n💾 Benchmark results saved to: ${benchmarkFile}`);
  
  // Summary statistics
  const successful = results.filter(r => r.performance.success);
  if (successful.length > 0) {
    const avgDuration = successful.reduce((sum, r) => sum + r.performance.duration, 0) / successful.length;
    const avgSize = successful.reduce((sum, r) => sum + r.performance.planSize, 0) / successful.length;
    
    console.log("\n📈 BENCHMARK SUMMARY:");
    console.log(`   Success Rate: ${successful.length}/${results.length} (${(successful.length/results.length*100).toFixed(1)}%)`);
    console.log(`   Average Duration: ${avgDuration.toFixed(0)}ms`);
    console.log(`   Average Plan Size: ${(avgSize / 1024).toFixed(1)}KB`);
  }
  
  return results;
}

/**
 * Main test runner
 */
async function runWorkoutTests() {
  console.log("🚀 STARTING MODERN WORKOUT GENERATION TESTS");
  console.log("===========================================");
  console.log("This demonstrates the exponential improvement from structured output!");
  
  const testResults = {
    timestamp: new Date().toISOString(),
    tests: {
      singleGeneration: null as any,
      quickGeneration: null as any,
      benchmark: null as any
    }
  };
  
  try {
    // Test 1: Single workout generation
    testResults.tests.singleGeneration = await testSingleWorkoutGeneration();
    
    // Test 2: Quick workout generation
    testResults.tests.quickGeneration = await testQuickWorkoutGeneration();
    
    // Test 3: Benchmark all users
    testResults.tests.benchmark = await benchmarkAllUsers();
    
    console.log("\n🎉 ALL TESTS COMPLETED!");
    console.log("========================");
    
    // Save complete test results
    const testResultsFile = path.join(resultsDir, `complete-workout-tests-${Date.now()}.json`);
    fs.writeFileSync(testResultsFile, JSON.stringify(testResults, null, 2));
    console.log(`📊 Complete test results: ${testResultsFile}`);
    
  } catch (error: any) {
    console.error("💥 TEST SUITE FAILED:", error);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runWorkoutTests().catch(console.error);
}

export { runWorkoutTests, testSingleWorkoutGeneration, benchmarkAllUsers };
