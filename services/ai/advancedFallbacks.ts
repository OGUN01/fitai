/**
 * Advanced Fallback Mechanisms
 * 
 * This file contains enhanced fallback mechanisms for workout and meal plan generation,
 * with multiple levels of fallbacks and more sophisticated approaches to handle AI generation failures.
 */

import { UserFitnessPreferences, WorkoutPlan, FallbackWorkoutPlan, WorkoutDay, WorkoutExercise } from './workoutGenerator';
import { UserDietPreferences, MealPlan, FallbackMealPlan } from './mealPlanGenerator';
import gemini from '../../lib/gemini';
import { promptManager } from './promptManager';
import { attemptEnhancedMealFallbacks } from './mealPlanFallbacks';
import { parseJsonFromLLM } from './jsonUtils';

/**
 * Multi-level fallback system for workout plan generation
 */
export async function generateWorkoutPlanWithFallbacks(
  preferences: UserFitnessPreferences,
  originalGenerator: (prefs: UserFitnessPreferences) => Promise<WorkoutPlan | FallbackWorkoutPlan>
): Promise<WorkoutPlan | FallbackWorkoutPlan> {
  console.log("📋 [FALLBACK] Starting workout generation with fallback chain");
  
  try {
    // Try the current implementation first
    console.log("📋 [FALLBACK] Attempting primary workout generation");
    const workoutPlan = await originalGenerator(preferences);
    
    // If it's already a fallback plan, try our enhanced fallbacks
    if ('isFallback' in workoutPlan) {
      console.log("📋 [FALLBACK] Primary workout generation resulted in a fallback plan. Reason:", workoutPlan.message);
      console.log("📋 [FALLBACK] Launching enhanced fallback chain");
      return await attemptEnhancedWorkoutFallbacks(preferences);
    }
    
    // If we got a valid plan, return it
    console.log("📋 [FALLBACK] Primary workout generation succeeded! No fallback needed.");
    return workoutPlan;
    
  } catch (error) {
    // If primary implementation throws an error, log and use enhanced fallbacks
    console.error("📋 [FALLBACK] Error in primary workout plan generation:", error);
    console.log("📋 [FALLBACK] Launching enhanced fallback chain due to error");
    return await attemptEnhancedWorkoutFallbacks(preferences);
  }
}

/**
 * Multi-level fallback system for meal plan generation
 */
export async function generateMealPlanWithFallbacks(
  preferences: UserDietPreferences,
  originalGenerator: (prefs: UserDietPreferences) => Promise<MealPlan | FallbackMealPlan>
): Promise<MealPlan | FallbackMealPlan> {
  try {
    // Try the current implementation first
    const mealPlan = await originalGenerator(preferences);
    
    // If it's already a fallback plan, try our enhanced fallbacks
    if ('isFallback' in mealPlan) {
      console.log("Primary meal generation resulted in a fallback plan. Trying enhanced fallbacks.");
      return await attemptEnhancedMealFallbacks(preferences);
    }
    
    // If we got a valid plan, return it
    return mealPlan;
    
  } catch (error) {
    // If primary implementation throws an error, log and use enhanced fallbacks
    console.error("Error in primary meal plan generation:", error);
    return await attemptEnhancedMealFallbacks(preferences);
  }
}

/**
 * Attempt multiple advanced strategies to generate a workout plan
 */
async function attemptEnhancedWorkoutFallbacks(preferences: UserFitnessPreferences): Promise<WorkoutPlan | FallbackWorkoutPlan> {
  console.log("📋 [FALLBACK] 🔄 STARTING ENHANCED FALLBACK CHAIN");
  
  // Fallback 1: Try with more structured prompt
  try {
    console.log("📋 [FALLBACK] 🔄 Attempt #1: Using structured prompt approach");
    console.log("📋 [FALLBACK] Generating with explicit JSON structure instructions");
    const structuredPlan = await generateStructuredWorkoutPlan(preferences);
    console.log("📋 [FALLBACK] ✅ Structured workout fallback SUCCEEDED!");
    return structuredPlan;
  } catch (error) {
    console.log("📋 [FALLBACK] ❌ Structured workout fallback FAILED:", error.message);
  }
  
  // Fallback 2: Try day-by-day generation approach
  try {
    console.log("📋 [FALLBACK] 🔄 Attempt #2: Using day-by-day generation approach");
    console.log("📋 [FALLBACK] Breaking down workout into individual day generations");
    const dayByDayPlan = await generateWorkoutPlanDayByDay(preferences);
    console.log("📋 [FALLBACK] ✅ Day-by-day workout fallback SUCCEEDED!");
    return dayByDayPlan;
  } catch (error) {
    console.log("📋 [FALLBACK] ❌ Day-by-day workout fallback FAILED:", error.message);
  }
  
  // Fallback 3: Try simplified format
  try {
    console.log("📋 [FALLBACK] 🔄 Attempt #3: Using simplified format approach");
    console.log("📋 [FALLBACK] Generating with bare-minimum structure requirements");
    const simplifiedPlan = await generateSimplifiedWorkoutPlan(preferences);
    console.log("📋 [FALLBACK] ✅ Simplified workout fallback SUCCEEDED!");
    return simplifiedPlan;
  } catch (error) {
    console.log("📋 [FALLBACK] ❌ Simplified workout fallback FAILED:", error.message);
  }
  
  // If all LLM-based fallbacks failed, return a user-friendly error message
  console.log("📋 [FALLBACK] ❌ All LLM fallback attempts failed");
  
  return {
    isFallback: true,
    fallbackReason: "temporary_service_issue",
    message: "We're experiencing some technical difficulties generating your custom workout plan. Please try again in a few moments.",
    retryable: true,
    weeklySchedule: [],
    warmUp: [],
    coolDown: []
  } as FallbackWorkoutPlan;
}

/**
 * Generate a workout plan using a highly structured prompt
 */
async function generateStructuredWorkoutPlan(preferences: UserFitnessPreferences): Promise<WorkoutPlan> {
  console.log("📋 [FALLBACK-DETAIL] Generating structured workout plan");
  
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
  
  console.log(`📋 [FALLBACK-DETAIL] Using structured prompt (first 100 chars): ${prompt.substring(0, 100)}...`);

  try {
    console.log("📋 [FALLBACK-DETAIL] Calling Gemini API with structured prompt...");
    const result = await gemini.generateContent(prompt);
    console.log("📋 [FALLBACK-DETAIL] Received response from Gemini API");
    console.log(`📋 [FALLBACK-DETAIL] Raw response (first 100 chars): ${result.substring(0, 100)}...`);
    
    console.log("📋 [FALLBACK-DETAIL] Parsing JSON from response...");
    const parsedResult = parseJsonFromLLM(result);
    console.log("📋 [FALLBACK-DETAIL] Successfully parsed JSON from response");
    
    console.log("📋 [FALLBACK-DETAIL] Validating workout plan structure...");
    validateWorkoutPlanStructure(parsedResult);
    console.log("📋 [FALLBACK-DETAIL] Workout plan structure validation passed");
    
    return parsedResult;
  } catch (error) {
    console.error("📋 [FALLBACK-DETAIL] Error in structured workout generation:", error);
    throw new Error(`Structured workout generation failed: ${error.message}`);
  }
}

/**
 * Generate a simplified workout plan when structured formats fail
 * This uses a simpler format that's easier for the AI to generate correctly
 */
async function generateSimplifiedWorkoutPlan(preferences: UserFitnessPreferences): Promise<WorkoutPlan> {
  const prompt = `
Generate a simplified workout plan for a ${preferences.fitnessLevel} level person.
- Workout location: ${preferences.workoutLocation}
- Available equipment: ${preferences.availableEquipment.join(', ')}
- Exercise frequency: ${preferences.exerciseFrequency} days per week
- Time per session: ${preferences.timePerSession} minutes
- Focus areas: ${preferences.focusAreas.join(', ')}
- Limitations/injuries: ${preferences.injuries || 'None'}

ONLY return a JSON array of workout days, with each day having a name, focus area, and a list of exercises.
Each exercise should have a name, sets, reps, rest time in seconds, and optional notes.

Example format:
[
  {
    "day": "Monday",
    "focus": "upper-body",
    "exercises": [
      {"name": "Push-ups", "sets": 3, "reps": 10, "restSeconds": 60, "notes": "Keep core tight"}
    ]
  }
]
`;

  try {
    const result = await gemini.generateContent(prompt);
    const parsedResult = JSON.parse(result);
    
    // Convert the simple array format to the full WorkoutPlan structure
    if (!Array.isArray(parsedResult)) {
      throw new Error('Expected array of workout days');
    }
    
    // Build a complete workout plan from the simplified days
    const workoutPlan: WorkoutPlan = {
      weeklySchedule: parsedResult,
      warmUp: getDefaultWarmUp(),
      coolDown: getDefaultCoolDown(),
      progressionPlan: getDefaultProgressionPlan()
    };
    
    return workoutPlan;
  } catch (error) {
    throw new Error(`Simplified workout generation failed: ${error}`);
  }
}

/**
 * Generate a workout plan day by day for more reliability
 */
async function generateWorkoutPlanDayByDay(preferences: UserFitnessPreferences): Promise<WorkoutPlan> {
  // Initialize the plan structure
  const workoutPlan: WorkoutPlan = {
    weeklySchedule: [],
    warmUp: [],
    coolDown: [],
    progressionPlan: {
      week2: "",
      week3: "",
      week4: ""
    }
  };
  
  // Determine what days to generate workouts for
  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const selectedDays = daysOfWeek.slice(0, preferences.exerciseFrequency);
  
  // Distribute focus areas across selected days
  const focusAreaDistribution = distributeFocusAreas(selectedDays, preferences.focusAreas);
  
  // Generate each day's workout
  for (let i = 0; i < selectedDays.length; i++) {
    const day = selectedDays[i];
    const focus = focusAreaDistribution[i];
    
    try {
      const dayWorkout = await generateSingleDayWorkout(day, focus, preferences);
      workoutPlan.weeklySchedule.push(dayWorkout);
    } catch (error) {
      console.error(`Failed to generate workout for ${day}:`, error);
      // Add a simple fallback day if generation fails
      workoutPlan.weeklySchedule.push(createFallbackDay(day, focus, preferences));
    }
  }
  
  // Generate warm-up and cool-down separately
  try {
    workoutPlan.warmUp = await generateWarmUpExercises(preferences);
  } catch (error) {
    workoutPlan.warmUp = getDefaultWarmUp();
  }
  
  try {
    workoutPlan.coolDown = await generateCoolDownExercises(preferences);
  } catch (error) {
    workoutPlan.coolDown = getDefaultCoolDown();
  }
  
  // Generate progression plan
  try {
    workoutPlan.progressionPlan = await generateProgressionPlan(preferences);
  } catch (error) {
    workoutPlan.progressionPlan = getDefaultProgressionPlan();
  }
  
  return workoutPlan;
}

/**
 * Create a minimal workout fallback when all else fails
 */
function createMinimalWorkoutFallback(preferences: UserFitnessPreferences, errorMessage: string): FallbackWorkoutPlan {
  const weeklySchedule: WorkoutDay[] = [];
  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const focusAreas = preferences.focusAreas.length > 0 ? preferences.focusAreas : ['full-body'];
  
  // Generate the requested number of workout days
  for (let i = 0; i < preferences.exerciseFrequency; i++) {
    const day = daysOfWeek[i];
    const focus = focusAreas[i % focusAreas.length];
    weeklySchedule.push(createFallbackDay(day, focus, preferences));
  }
  
  // Return the complete fallback plan
  return {
    weeklySchedule,
    warmUp: getDefaultWarmUp(),
    coolDown: getDefaultCoolDown(),
    isFallback: true,
    message: `We couldn't generate a custom workout plan: ${errorMessage}. Here's a basic plan instead.`
  };
}

/**
 * Distribute focus areas across workout days
 */
function distributeFocusAreas(days: string[], focusAreas: string[]): string[] {
  const result: string[] = [];
  
  // If we have more or equal focus areas than days, assign them directly
  if (focusAreas.length >= days.length) {
    for (let i = 0; i < days.length; i++) {
      result.push(focusAreas[i % focusAreas.length]);
    }
    return result;
  }
  
  // If we have fewer focus areas than days, need to distribute them
  const allFocusAreas = [...focusAreas];
  
  // Add "full-body" to fill in if we're short on focus areas
  if (!allFocusAreas.includes('full-body')) {
    allFocusAreas.push('full-body');
  }
  
  // Distribute focus areas evenly
  for (let i = 0; i < days.length; i++) {
    result.push(allFocusAreas[i % allFocusAreas.length]);
  }
  
  return result;
}

/**
 * Generate a single day's workout
 */
async function generateSingleDayWorkout(day: string, focus: string, preferences: UserFitnessPreferences): Promise<WorkoutDay> {
  const prompt = `
Generate a single workout day focusing on ${focus} for a ${preferences.fitnessLevel} level person.
Workout should be for ${preferences.workoutLocation} and use only this equipment: ${preferences.availableEquipment.join(', ')}.
The session should last around ${preferences.timePerSession} minutes.

Return in this EXACT JSON format:
{
  "day": "${day}",
  "focus": "${focus}",
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

IMPORTANT: 
1. Return ONLY valid JSON, no additional text.
2. Include 4-8 exercises suitable for the focus area.
3. Ensure exercises are appropriate for the fitness level.
4. Only include equipment they have available.
`;

  try {
    const result = await gemini.generateContent(prompt);
    const parsedResult = JSON.parse(result);
    
    // Basic validation
    if (!parsedResult.day || !parsedResult.focus || !Array.isArray(parsedResult.exercises)) {
      throw new Error('Invalid day workout structure');
    }
    
    return parsedResult;
  } catch (error) {
    throw new Error(`Single day workout generation failed: ${error}`);
  }
}

/**
 * Create a fallback workout day when generation fails
 */
function createFallbackDay(day: string, focus: string, preferences: UserFitnessPreferences): WorkoutDay {
  const isBeginner = preferences.fitnessLevel === 'beginner';
  
  // Basic exercise templates based on focus area
  const exercises: Record<string, WorkoutExercise[]> = {
    'upper-body': [
      {
        name: "Push-ups",
        sets: isBeginner ? 3 : 4,
        reps: isBeginner ? 8 : 12,
        restSeconds: 60,
        notes: "Modify on knees if needed"
      },
      {
        name: "Dumbbell Bicep Curls",
        sets: 3,
        reps: isBeginner ? 8 : 12,
        restSeconds: 60,
        notes: "Use water bottles if no dumbbells"
      },
      {
        name: "Tricep Dips",
        sets: 3,
        reps: isBeginner ? 8 : 12,
        restSeconds: 60,
        notes: "Use a stable chair or bench"
      }
    ],
    'lower-body': [
      {
        name: "Bodyweight Squats",
        sets: isBeginner ? 3 : 4,
        reps: isBeginner ? 12 : 15,
        restSeconds: 60,
        notes: "Focus on form"
      },
      {
        name: "Walking Lunges",
        sets: 3,
        reps: isBeginner ? 10 : 12,
        restSeconds: 60,
        notes: "Each leg"
      },
      {
        name: "Calf Raises",
        sets: 3,
        reps: 15,
        restSeconds: 45,
        notes: "Use wall for balance if needed"
      }
    ],
    'core': [
      {
        name: "Plank",
        sets: 3,
        reps: 1,
        restSeconds: 60,
        notes: isBeginner ? "Hold for 20 seconds" : "Hold for 30-45 seconds"
      },
      {
        name: "Bicycle Crunches",
        sets: 3,
        reps: isBeginner ? 10 : 15,
        restSeconds: 45,
        notes: "Slow and controlled"
      },
      {
        name: "Mountain Climbers",
        sets: 3,
        reps: isBeginner ? 10 : 20,
        restSeconds: 45,
        notes: "Each leg"
      }
    ],
    'cardio': [
      {
        name: "Jumping Jacks",
        sets: 3,
        reps: isBeginner ? 20 : 30,
        restSeconds: 30,
        notes: "Moderate pace"
      },
      {
        name: "High Knees",
        sets: 3,
        reps: isBeginner ? 20 : 30,
        restSeconds: 45,
        notes: "Each leg"
      },
      {
        name: "Burpees",
        sets: 3,
        reps: isBeginner ? 8 : 12,
        restSeconds: 60,
        notes: "Modify by stepping back instead of jumping if needed"
      }
    ],
    'full-body': [
      {
        name: "Bodyweight Squats",
        sets: 3,
        reps: isBeginner ? 10 : 15,
        restSeconds: 45,
        notes: "Focus on form"
      },
      {
        name: "Push-ups",
        sets: 3,
        reps: isBeginner ? 8 : 12,
        restSeconds: 45,
        notes: "Modify on knees if needed"
      },
      {
        name: "Plank",
        sets: 3,
        reps: 1,
        restSeconds: 45,
        notes: isBeginner ? "Hold for 20 seconds" : "Hold for 30 seconds"
      },
      {
        name: "Jumping Jacks",
        sets: 3,
        reps: isBeginner ? 20 : 30,
        restSeconds: 45,
        notes: "Moderate pace"
      }
    ]
  };
  
  // Default to full-body if focus area not found
  const targetFocus = focus in exercises ? focus : 'full-body';
  
  return {
    day: day,
    focus: targetFocus,
    exercises: exercises[targetFocus]
  };
}

/**
 * Get default warm-up exercises
 */
function getDefaultWarmUp(): string[] {
  return [
    "Light jogging or marching in place for 3-5 minutes",
    "Arm circles (10 forward, 10 backward)",
    "Hip rotations (10 each direction)",
    "Bodyweight squats (10 reps)",
    "Push-ups or modified push-ups (5-10 reps)"
  ];
}

/**
 * Get default cool-down exercises
 */
function getDefaultCoolDown(): string[] {
  return [
    "Walking in place for 2-3 minutes",
    "Quad stretch (30 seconds each leg)",
    "Hamstring stretch (30 seconds each leg)",
    "Chest and shoulder stretch (30 seconds each side)",
    "Deep breathing exercises (5 deep breaths)"
  ];
}

/**
 * Get default progression plan
 */
function getDefaultProgressionPlan(): { week2: string; week3: string; week4: string } {
  return {
    week2: "Increase repetitions by 2-3 per exercise",
    week3: "Increase sets from 3 to 4 for most exercises",
    week4: "Decrease rest time between sets by 10-15 seconds"
  };
}

/**
 * Generate warm-up exercises
 */
async function generateWarmUpExercises(preferences: UserFitnessPreferences): Promise<string[]> {
  const prompt = `
Generate 5 warm-up exercises suitable for a ${preferences.fitnessLevel} fitness level person.
These should prepare the body for workouts focusing on: ${preferences.focusAreas.join(', ')}.

Return ONLY a JSON array of strings, e.g.:
["Warm-up exercise 1", "Warm-up exercise 2", "Warm-up exercise 3", "Warm-up exercise 4", "Warm-up exercise 5"]
`;

  try {
    const result = await gemini.generateContent(prompt);
    const parsedResult = JSON.parse(result);
    
    if (!Array.isArray(parsedResult) || parsedResult.length === 0) {
      throw new Error('Invalid warm-up format');
    }
    
    return parsedResult;
  } catch (error) {
    throw new Error(`Warm-up generation failed: ${error}`);
  }
}

/**
 * Generate cool-down exercises
 */
async function generateCoolDownExercises(preferences: UserFitnessPreferences): Promise<string[]> {
  const prompt = `
Generate 5 cool-down exercises suitable for a ${preferences.fitnessLevel} fitness level person.
These should help the body recover after workouts focusing on: ${preferences.focusAreas.join(', ')}.

Return ONLY a JSON array of strings, e.g.:
["Cool-down exercise 1", "Cool-down exercise 2", "Cool-down exercise 3", "Cool-down exercise 4", "Cool-down exercise 5"]
`;

  try {
    const result = await gemini.generateContent(prompt);
    const parsedResult = JSON.parse(result);
    
    if (!Array.isArray(parsedResult) || parsedResult.length === 0) {
      throw new Error('Invalid cool-down format');
    }
    
    return parsedResult;
  } catch (error) {
    throw new Error(`Cool-down generation failed: ${error}`);
  }
}

/**
 * Generate a progression plan
 */
async function generateProgressionPlan(preferences: UserFitnessPreferences): Promise<{ week2: string; week3: string; week4: string }> {
  const prompt = `
Generate a 4-week progression plan for a ${preferences.fitnessLevel} fitness level person.
The progression should build upon workouts focusing on: ${preferences.focusAreas.join(', ')}.

Return ONLY a JSON object with week2, week3, and week4 progression, e.g.:
{
  "week2": "Week 2 progression description",
  "week3": "Week 3 progression description",
  "week4": "Week 4 progression description"
}
`;

  try {
    const result = await gemini.generateContent(prompt);
    const parsedResult = JSON.parse(result);
    
    if (!parsedResult.week2 || !parsedResult.week3 || !parsedResult.week4) {
      throw new Error('Invalid progression plan format');
    }
    
    return parsedResult;
  } catch (error) {
    throw new Error(`Progression plan generation failed: ${error}`);
  }
}

/**
 * Validate the structure of a workout plan
 */
function validateWorkoutPlanStructure(plan: any): asserts plan is WorkoutPlan {
  if (!plan) throw new Error('Plan is null or undefined');
  
  // Check weekly schedule
  if (!Array.isArray(plan.weeklySchedule)) 
    throw new Error('weeklySchedule is not an array');
  
  // Check warm up and cool down
  if (!Array.isArray(plan.warmUp)) 
    throw new Error('warmUp is not an array');
  
  if (!Array.isArray(plan.coolDown)) 
    throw new Error('coolDown is not an array');
  
  // Check progression plan
  if (!plan.progressionPlan || 
      typeof plan.progressionPlan !== 'object' ||
      typeof plan.progressionPlan.week2 !== 'string' ||
      typeof plan.progressionPlan.week3 !== 'string' ||
      typeof plan.progressionPlan.week4 !== 'string') {
    throw new Error('progressionPlan has invalid structure');
  }
  
  // Check each workout day
  for (const day of plan.weeklySchedule) {
    if (!day.day || typeof day.day !== 'string') 
      throw new Error('Workout day missing day name');
    
    if (!day.focus || typeof day.focus !== 'string') 
      throw new Error('Workout day missing focus area');
    
    if (!Array.isArray(day.exercises)) 
      throw new Error(`Exercises for ${day.day} is not an array`);
    
    // Check each exercise
    for (const exercise of day.exercises) {
      if (!exercise.name || typeof exercise.name !== 'string') 
        throw new Error(`Exercise in ${day.day} missing name`);
      
      if (typeof exercise.sets !== 'number') 
        throw new Error(`Exercise ${exercise.name} has invalid sets`);
      
      if (typeof exercise.reps !== 'number') 
        throw new Error(`Exercise ${exercise.name} has invalid reps`);
      
      if (typeof exercise.restSeconds !== 'number') 
        throw new Error(`Exercise ${exercise.name} has invalid rest time`);
    }
  }
}

// We'll add more functions in the final phase
// ... existing code ... 