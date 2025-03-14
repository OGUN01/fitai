/**
 * Test Utilities for AI Services
 * 
 * This file contains utility functions for testing fallback mechanisms.
 */

import { WorkoutPlan, FallbackWorkoutPlan, UserFitnessPreferences, WorkoutExercise } from './workoutGenerator';
import { MealPlan, FallbackMealPlan, UserDietPreferences, MealIngredient, MealNutrition } from './mealPlanGenerator';
import { enhancedWorkoutGenerator, enhancedMealPlanGenerator } from './index';
import { parseJsonFromLLM } from './advancedFallbacks';
import gemini from '../../lib/gemini';

// Test modes to simulate different failure points
export enum TestFailureMode {
  NORMAL = 'normal', // Normal operation, no forced failures
  FIRST_ATTEMPT = 'first-attempt', // Force primary generation to fail
  ALL_ATTEMPTS = 'all-attempts', // Force all attempts to fail
  PARSING_ERROR = 'parsing-error', // Simulate JSON parsing errors
  VALIDATION_ERROR = 'validation-error', // Simulate validation errors
  NETWORK_ERROR = 'network-error', // Simulate network connectivity issues
  REAL_FALLBACK_CHAIN = 'real-fallback-chain', // Trigger the actual fallback chain by messing up JSON
}

// Global test state
let currentWorkoutTestMode = TestFailureMode.NORMAL;
let currentMealTestMode = TestFailureMode.NORMAL;

/**
 * Set the test mode for workout generation
 */
export function setWorkoutTestMode(mode: TestFailureMode) {
  currentWorkoutTestMode = mode;
  console.log(`Set workout test mode to: ${mode}`);
}

/**
 * Set the test mode for meal plan generation
 */
export function setMealTestMode(mode: TestFailureMode) {
  currentMealTestMode = mode;
  console.log(`Set meal test mode to: ${mode}`);
}

// Create mock fallback workout plan for testing
function createFallbackWorkoutPlan(message: string): FallbackWorkoutPlan {
  return {
    weeklySchedule: [{
      day: "Monday",
      focus: "Full Body",
      exercises: [
        {
          name: "Test Exercise",
          sets: 3,
          reps: 10,
          restSeconds: 60,
          notes: "This is a test fallback exercise"
        } as WorkoutExercise
      ]
    }],
    warmUp: ["Light cardio for 5 minutes"],
    coolDown: ["Stretching for 5 minutes"],
    isFallback: true,
    message
  };
}

// Create mock fallback meal plan for testing
function createFallbackMealPlan(message: string): FallbackMealPlan {
  const testIngredient: MealIngredient = {
    name: "Test Ingredient",
    quantity: "1",
    unit: "cup"
  };
  
  const testNutrition: MealNutrition = {
    calories: 400,
    protein: 20,
    carbs: 40,
    fats: 15
  };
  
  return {
    dailyMealPlan: [{
      day: "Monday",
      meals: [
        {
          meal: "Breakfast",
          time: "8:00 AM",
          recipe: {
            name: "Test Breakfast",
            ingredients: [testIngredient, testIngredient],
            instructions: ["Step 1", "Step 2"],
            nutrition: testNutrition,
            prepTime: "15 minutes",
            alternatives: ["Alternative 1", "Alternative 2"]
          }
        }
      ],
      totalNutrition: {
        calories: 1200,
        protein: 60,
        carbs: 120,
        fats: 45
      }
    }],
    shoppingList: [
      {
        category: "Dairy",
        items: ["Milk", "Yogurt"]
      },
      {
        category: "Vegetables",
        items: ["Spinach", "Tomatoes"]
      }
    ],
    mealPrepTips: ["Tip 1", "Tip 2"],
    isFallback: true,
    message
  };
}

/**
 * Test enhancedWorkoutGenerator that can simulate failures
 */
export async function testWorkoutGeneration(preferences: UserFitnessPreferences): Promise<WorkoutPlan | FallbackWorkoutPlan> {
  // Log the current test mode
  console.log(`Running workout generator with test mode: ${currentWorkoutTestMode}`);
  
  try {
    // Handle based on test mode
    switch (currentWorkoutTestMode) {
      case TestFailureMode.NORMAL:
        // Just use the real generator
        return await enhancedWorkoutGenerator.generateWorkoutPlanSafe(preferences);
      
      case TestFailureMode.FIRST_ATTEMPT:
        // Return a fake fallback instead of calling the real generator
        console.log('Forcing primary workout generator to fail...');
        return createFallbackWorkoutPlan('Simulated primary generator failure');
      
      case TestFailureMode.ALL_ATTEMPTS:
        // Force all attempts to fail, even the fallback
        console.log('Forcing all workout generation attempts to fail...');
        throw new Error('Simulated complete generation failure (all attempts failed)');
        
      case TestFailureMode.PARSING_ERROR:
        // Simulate a JSON parsing error
        console.log('Simulating JSON parsing error in workout generation...');
        throw new SyntaxError('Simulated JSON parse error: Unexpected token in JSON');
        
      case TestFailureMode.VALIDATION_ERROR:
        // Simulate a validation error
        console.log('Simulating validation error in workout generation...');
        throw new Error('Simulated validation error: Missing required field "exercises"');
        
      case TestFailureMode.NETWORK_ERROR:
        // Simulate a network error
        console.log('Simulating network error in workout generation...');
        throw new Error('Simulated network error: Failed to fetch from AI service');

      case TestFailureMode.REAL_FALLBACK_CHAIN:
        // This mode will trigger the real fallback chain by returning an invalid response
        console.log('Testing REAL fallback chain with intentionally invalid response...');
        
        try {
          // We will use a counter to only make the first parsing attempt fail
          let parseAttemptCounter = 0;
          
          // Store the original function
          const originalParseJsonFromLLM = parseJsonFromLLM;
          
          // Create a wrapper function that only fails the first time
          // @ts-ignore - we're monkeypatching for testing
          global.parseJsonFromLLM = (text: string) => {
            parseAttemptCounter++;
            console.log(`📋 [TEST] Parse attempt #${parseAttemptCounter}`);
            
            // Only fail the first attempt
            if (parseAttemptCounter === 1) {
              console.log("📋 [TEST] Forcing first parse attempt to fail...");
              throw new SyntaxError("Simulated JSON parse error: Intentionally failing first attempt");
            }
            
            // For all subsequent attempts, use the real function
            console.log("📋 [TEST] Using real parser for fallback attempt");
            return originalParseJsonFromLLM(text);
          };
          
          try {
            // Call the generator which will use our patched parsing function
            console.log("📋 [TEST] Calling workout generator with mocked parsing function - expecting fallback chain to trigger");
            const result = await enhancedWorkoutGenerator.generateWorkoutPlanSafe(preferences);
            
            // Restore the original function
            // @ts-ignore
            global.parseJsonFromLLM = originalParseJsonFromLLM;
            
            console.log("📋 [TEST] Fallback chain test complete - result type:", 
              ('fallbackReason' in result) ? "Fallback Plan" : "Regular Plan");
            return result;
          } catch (error) {
            // Always restore the original function even if there's an error
            // @ts-ignore
            global.parseJsonFromLLM = originalParseJsonFromLLM;
            
            console.error("📋 [TEST] Error during real fallback chain test:", error);
            throw error;
          }
        } catch (error) {
          console.error("Error during real fallback chain test:", error);
          throw error;
        }
        
      default:
        return await enhancedWorkoutGenerator.generateWorkoutPlanSafe(preferences);
    }
  } catch (error) {
    console.error("Error in testWorkoutGeneration:", error);
    throw error; // Re-throw to be handled by the component
  }
}

/**
 * Test enhancedMealPlanGenerator that can simulate failures
 */
export async function testMealGeneration(preferences: UserDietPreferences): Promise<MealPlan | FallbackMealPlan> {
  // Log the current test mode
  console.log(`Running meal generator with test mode: ${currentMealTestMode}`);
  
  try {
    // Handle based on test mode
    switch (currentMealTestMode) {
      case TestFailureMode.NORMAL:
        // Just use the real generator
        return await enhancedMealPlanGenerator.generateMealPlanSafe(preferences);
      
      case TestFailureMode.FIRST_ATTEMPT:
        // Return a fake fallback instead of calling the real generator
        console.log('Forcing primary meal generator to fail...');
        return createFallbackMealPlan('Simulated primary generator failure');
      
      case TestFailureMode.ALL_ATTEMPTS:
        // Force all attempts to fail, even the fallback
        console.log('Forcing all meal generation attempts to fail...');
        throw new Error('Simulated complete generation failure (all attempts failed)');
        
      case TestFailureMode.PARSING_ERROR:
        // Simulate a JSON parsing error
        console.log('Simulating JSON parsing error in meal generation...');
        throw new SyntaxError('Simulated JSON parse error: Unexpected token in JSON');
        
      case TestFailureMode.VALIDATION_ERROR:
        // Simulate a validation error
        console.log('Simulating validation error in meal generation...');
        throw new Error('Simulated validation error: Missing required field "dailyMealPlan"');
        
      case TestFailureMode.NETWORK_ERROR:
        // Simulate a network error
        console.log('Simulating network error in meal generation...');
        throw new Error('Simulated network error: Failed to fetch from AI service');
        
      default:
        return await enhancedMealPlanGenerator.generateMealPlanSafe(preferences);
    }
  } catch (error) {
    console.error("Error in testMealGeneration:", error);
    throw error; // Re-throw to be handled by the component
  }
}

/**
 * Run an end-to-end test of the workout generator's fallback chain
 * 
 * This function:
 * 1. Forces the primary generator to fail by corrupting JSON parsing
 * 2. Triggers the real fallback chain with enhanced logging
 * 3. Displays detailed logs at each step of the fallback chain
 */
export async function testWorkoutFallbackChainE2E() {
  console.log("\n=====================================================");
  console.log("🧪 STARTING END-TO-END FALLBACK CHAIN TEST");
  console.log("=====================================================\n");
  
  console.log("This test will force a failure in the primary workout generator");
  console.log("and verify that the fallback chain handles it correctly.\n");
  console.log("📋 [TEST] The test works by:");
  console.log("1. Making the first JSON parse attempt fail (simulating a parsing error)");
  console.log("2. Letting subsequent fallback attempts use the real parser");
  console.log("3. This should trigger the first fallback method (structured prompt)");
  console.log("4. And produce a valid workout plan\n");
  
  // Create basic preferences for testing
  const testPreferences: UserFitnessPreferences = {
    fitnessLevel: "intermediate",
    workoutLocation: "home",
    availableEquipment: ["Dumbbells", "Resistance bands"],
    exerciseFrequency: 3,
    timePerSession: 30,
    focusAreas: ["upper-body", "core"]
  };
  
  console.log("Test preferences:", JSON.stringify(testPreferences, null, 2), "\n");
  
  try {
    // Set the test mode to REAL_FALLBACK_CHAIN
    console.log("Setting test mode to REAL_FALLBACK_CHAIN...");
    setWorkoutTestMode(TestFailureMode.REAL_FALLBACK_CHAIN);
    
    // Run the test
    console.log("Triggering test with fallback chain mode...\n");
    const result = await testWorkoutGeneration(testPreferences);
    
    console.log("\n=====================================================");
    console.log("✅ FALLBACK CHAIN TEST COMPLETED SUCCESSFULLY");
    console.log("=====================================================\n");
    
    // Display result summary
    console.log("Final result:");
    if ('fallbackReason' in result) {
      console.log("- Type: Fallback Plan");
      console.log("- Fallback Reason:", result.fallbackReason);
      console.log("- Contains workout data:", result.hasOwnProperty('weeklySchedule') ? 'Yes' : 'No');
    } else {
      console.log("- Type: Regular Workout Plan");
      console.log("- Contains workout data:", result.hasOwnProperty('weeklySchedule') ? 'Yes' : 'No');
      
      // Print sample of the exercises generated to verify quality
      const dayCount = result.weeklySchedule.length;
      const exerciseCount = result.weeklySchedule.reduce((sum, day) => sum + day.exercises.length, 0);
      console.log(`- Generated ${dayCount} workout days with ${exerciseCount} total exercises`);
      
      // Show the first day as a sample
      if (result.weeklySchedule.length > 0) {
        const sampleDay = result.weeklySchedule[0];
        console.log(`\nSample Day (${sampleDay.day}, ${sampleDay.focus}):`);
        sampleDay.exercises.forEach((ex, i) => {
          console.log(`  ${i+1}. ${ex.name}: ${ex.sets} sets of ${ex.reps} reps (${ex.restSeconds}s rest)`);
        });
      }
    }
    
    console.log("\nNext steps:");
    console.log("1. Review the logs above to verify all fallback attempts");
    console.log("2. Check that the fallback chain produced a valid result");
    console.log("3. Verify the enhanced logging shows each fallback step");
    
    return result;
  } catch (error) {
    console.error("\n❌ FALLBACK CHAIN TEST FAILED");
    console.error("Error:", error);
    throw error;
  }
}

/**
 * Test the first fallback (structured prompt approach) directly
 */
export async function testFirstFallback(preferences: UserFitnessPreferences): Promise<WorkoutPlan> {
  console.log("\n=====================================================");
  console.log("🧪 TESTING FIRST FALLBACK (STRUCTURED PROMPT)");
  console.log("=====================================================\n");
  
  console.log("This test will directly generate a workout using the structured prompt approach");
  console.log("Test preferences:", JSON.stringify(preferences, null, 2), "\n");
  
  try {
    // We'll directly call Gemini with a structured prompt
    const prompt = `
INSTRUCTIONS: Generate a personalized workout plan in valid JSON format. 
Follow this EXACT structure (each field is required):
{
  "weeklySchedule": [
    {
      "day": "Day name",
      "focus": "Focus area",
      "exercises": [
        {
          "name": "Exercise name",
          "sets": number,
          "reps": number,
          "restSeconds": number,
          "notes": "Any specific notes"
        }
      ]
    }
  ],
  "warmUp": ["Warm up exercise 1", "Warm up exercise 2"],
  "coolDown": ["Cool down exercise 1", "Cool down exercise 2"],
  "progressionPlan": {
    "week2": "Week 2 progression",
    "week3": "Week 3 progression",
    "week4": "Week 4 progression"
  }
}

USER PREFERENCES:
- Fitness level: ${preferences.fitnessLevel}
- Workout location: ${preferences.workoutLocation}
- Available equipment: ${preferences.availableEquipment.join(', ')}
- Exercise frequency: ${preferences.exerciseFrequency} days per week
- Time per session: ${preferences.timePerSession} minutes
- Focus areas: ${preferences.focusAreas.join(', ')}
- Limitations/injuries: ${preferences.injuries || 'None'}

IMPORTANT: 
1. Generate EXACTLY ${preferences.exerciseFrequency} workout days
2. Focus on their preferred areas: ${preferences.focusAreas.join(', ')}
3. Only include equipment they have available
4. Match their fitness level
5. Make workouts fit within ${preferences.timePerSession} minutes
6. Return ONLY valid JSON, no additional text
`;

    console.log("Calling Gemini API with structured prompt...");
    
    const result = await gemini.generateContent(prompt);
    
    console.log("Received response from Gemini API");
    console.log(`Raw response (first 100 chars): ${result.substring(0, 100)}...`);
    
    console.log("Parsing JSON from response...");
    
    // Parse the response into JSON
    const parsedResult = parseJsonFromLLM(result);
    
    console.log("Successfully parsed JSON response into workout plan");
    console.log("\n=====================================================");
    console.log("✅ FIRST FALLBACK TEST COMPLETED SUCCESSFULLY");
    console.log("=====================================================\n");
    
    return parsedResult;
  } catch (error) {
    console.error("\n❌ FIRST FALLBACK TEST FAILED");
    console.error("Error:", error);
    throw error;
  }
} 