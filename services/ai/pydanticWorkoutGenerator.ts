/**
 * PydanticWorkoutGenerator - Highly structured workout generator
 * 
 * Uses strict schema enforcement (similar to Python's Pydantic) to ensure
 * the LLM always returns valid, structured workout plans.
 */

import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { GEMINI_API_KEY } from '../../constants/api';
import { UserFitnessPreferences } from "./workoutGenerator";
import { z } from 'zod';

// Create precise schema definitions using Zod (TypeScript's Pydantic equivalent)
// These will be used to validate LLM outputs and force them into the correct format

// 1. Define the exercise schema
const ExerciseSchema = z.object({
  name: z.string().min(2, "Exercise name must be at least 2 characters"),
  sets: z.number().int().min(1, "Sets must be at least 1"),
  reps: z.union([
    z.number().int().min(1, "Reps must be at least 1"), 
    z.string().regex(/^\d+(-\d+)?( seconds)?$/, "Reps must be a number or range, optionally with 'seconds'")
  ]),
  restSeconds: z.number().int().min(15, "Rest must be at least 15 seconds"),
  notes: z.string().optional()
});

// 2. Define the workout day schema
const WorkoutDaySchema = z.object({
  day: z.string().min(2, "Day name must be at least 2 characters"),
  focus: z.string().min(2, "Focus area must be at least 2 characters"),
  exercises: z.array(ExerciseSchema).min(1, "At least one exercise required")
});

// 3. Define the workout plan schema
const WorkoutPlanSchema = z.object({
  weeklySchedule: z.array(WorkoutDaySchema).min(1, "At least one workout day required"),
  warmUp: z.array(z.string()).min(2, "At least two warm-up activities required"),
  coolDown: z.array(z.string()).min(2, "At least two cool-down activities required"),
  progressionPlan: z.object({
    week2: z.string().min(5, "Week 2 progression must be detailed"),
    week3: z.string().min(5, "Week 3 progression must be detailed"),
    week4: z.string().min(5, "Week 4 progression must be detailed")
  })
});

// 4. Define TypeScript types from the schemas
export type Exercise = z.infer<typeof ExerciseSchema>;
export type WorkoutDay = z.infer<typeof WorkoutDaySchema>;
export type WorkoutPlan = z.infer<typeof WorkoutPlanSchema>;

/**
 * The PydanticWorkoutGenerator enforces a strict schema to ensure highly structured
 * LLM output for workout plans. It uses a multi-tier approach:
 * 
 * 1. Primary: Function calling with strict schema
 * 2. Backup: Multi-step guided generation with validation
 */
export class PydanticWorkoutGenerator {
  private generativeModel: GenerativeModel;
  
  constructor() {
    // Initialize the model
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    this.generativeModel = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        temperature: 0.1,
        topK: 1,
        topP: 0.8,
        maxOutputTokens: 4096,
      }
    });
  }

  /**
   * Generate a workout plan with strong schema constraints
   */
  public async generateWorkoutPlan(preferences: UserFitnessPreferences): Promise<WorkoutPlan> {
    try {
      console.log("📊 [PYDANTIC] Attempting primary generation with function calling");
      return await this.primaryGeneration(preferences);
    } catch (primaryError) {
      console.error("❌ [PYDANTIC] Primary generation failed:", primaryError);
      
      try {
        console.log("🔄 [PYDANTIC] Attempting backup generation");
        return await this.backupGeneration(preferences);
      } catch (backupError) {
        console.error("❌ [PYDANTIC] Backup generation failed:", backupError);
        
        console.log("🔧 [PYDANTIC] Using local fallback plan");
        // Create and return fallback plan without any potential for errors
        try {
          const fallbackPlan = this.createFallbackPlan(preferences);
          return fallbackPlan;
        } catch (fallbackError) {
          console.error("⚠️ [PYDANTIC] Error creating fallback plan:", fallbackError);
          // Return absolute minimum viable workout plan that can't fail
          return this.createMinimalFallbackPlan();
        }
      }
    }
  }

  /**
   * Primary method to generate a workout plan using structured text generation
   */
  private async primaryGeneration(preferences: UserFitnessPreferences): Promise<z.infer<typeof WorkoutPlanSchema>> {
    console.log("[PydanticWorkoutGenerator] Attempting primary generation...");
    
    const userPrompt = this.buildStructuredPrompt(preferences);
    let attempt = 0;
    const maxAttempts = 3;
    let lastError: Error | null = null;
    
    while (attempt < maxAttempts) {
      attempt++;
      console.log(`[PydanticWorkoutGenerator] Primary generation attempt ${attempt}/${maxAttempts}`);
      
      try {
        const response = await this.generativeModel.generateContent({
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: 0.2,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 4096,
          }
        });
        
        const responseText = response.response.text();
        console.log(`[PydanticWorkoutGenerator] Got response (first 100 chars): ${responseText.substring(0, 100)}...`);
        
        // Check if response is in markdown code block format
        let jsonData;
        if (responseText.trim().startsWith('```')) {
          // Extract JSON from markdown code block
          console.log("[PydanticWorkoutGenerator] Detected markdown code block, extracting JSON");
          const extractedJson = this.extractJsonFromText(responseText);
          if (extractedJson) {
            jsonData = extractedJson;
              } else {
            throw new Error("Failed to extract JSON from code block");
          }
        } else {
          // Try to parse as direct JSON
          try {
            jsonData = JSON.parse(responseText);
          } catch (jsonParseError) {
            console.error("[PydanticWorkoutGenerator] JSON parse error:", jsonParseError);
            
            // Try to extract JSON from the text as fallback
            const extractedJson = this.extractJsonFromText(responseText);
            if (extractedJson) {
              jsonData = extractedJson;
            } else {
              throw jsonParseError;
            }
          }
        }
        
        // Process the data to ensure consistency and handle edge cases
        const processedData = this.standardizePlanData(jsonData);
        
        // Check for empty exercise arrays before validation
        if (processedData.weeklySchedule && Array.isArray(processedData.weeklySchedule)) {
          const emptyExerciseDays = processedData.weeklySchedule
            .map((day, index) => ({ day: day.day, index, exercises: day.exercises?.length || 0 }))
            .filter(info => info.exercises === 0);
            
          if (emptyExerciseDays.length > 0) {
            console.warn(`[PydanticWorkoutGenerator] Found empty exercise arrays for days: ${emptyExerciseDays.map(d => `${d.day} (index ${d.index})`).join(', ')}`);
          }
        }
        
        // Validate with Zod schema
        try {
          const validatedPlan = WorkoutPlanSchema.parse(processedData);
          console.log("[PydanticWorkoutGenerator] Successfully validated workout plan");
          return validatedPlan;
        } catch (validationError) {
          console.error("[PydanticWorkoutGenerator] Validation error:", validationError);
          
          // Check if the validation error is due to empty exercise arrays
          if (validationError instanceof z.ZodError) {
            const emptyExercisesErrors = validationError.errors.filter(err => 
              err.code === 'too_small' && 
              err.message === 'At least one exercise required' &&
              err.path.includes('exercises')
            );
            
            if (emptyExercisesErrors.length > 0) {
              console.warn(`[PydanticWorkoutGenerator] Validation failed due to empty exercise arrays at paths: ${emptyExercisesErrors.map(e => e.path.join('.')).join(', ')}`);
            }
          }
          
          lastError = validationError as Error;
          // Continue to next attempt if validation fails
        }
      } catch (error) {
        console.error(`[PydanticWorkoutGenerator] API error on attempt ${attempt}:`, error);
        lastError = error as Error;
        
        // Check if we should retry based on error type
        const errorMessage = (error as Error).message.toLowerCase();
        const isRateLimit = errorMessage.includes('rate') && errorMessage.includes('limit');
        
        if (isRateLimit && attempt < maxAttempts) {
          const backoffSeconds = Math.pow(2, attempt) * 1;
          console.log(`[PydanticWorkoutGenerator] Rate limit hit, backing off for ${backoffSeconds} seconds...`);
          await new Promise(resolve => setTimeout(resolve, backoffSeconds * 1000));
        }
      }
    }
    
    console.error("[PydanticWorkoutGenerator] All primary generation attempts failed");
    throw lastError || new Error("Failed to generate workout plan after multiple attempts");
  }

  /**
   * Build a structured prompt optimized for pure text generation
   */
  private buildStructuredPrompt(preferences: UserFitnessPreferences): string {
    // Create descriptive introductions based on preferences
    const levelDescriptions = {
      beginner: "a novice exerciser who is just starting their fitness journey",
      intermediate: "someone with 6-12 months of consistent exercise experience",
      advanced: "an experienced exerciser with over a year of consistent training"
    };
    
    const levelDescription = levelDescriptions[preferences.fitnessLevel] || "a person interested in fitness";
    
    // Create more specific equipment context
    const equipmentContext = preferences.availableEquipment.length > 0 
      ? `The client has access to: ${preferences.availableEquipment.join(', ')}`
      : `The client has minimal equipment available`;
      
    // Create specific focus area guidance
    let focusGuidance = "";
    if (preferences.focusAreas.length > 0) {
      if (preferences.focusAreas.includes("full-body")) {
        focusGuidance = "Prioritize full-body workouts that target major muscle groups in each session";
      } else if (preferences.focusAreas.length === 1) {
        focusGuidance = `Design workouts that specifically target ${preferences.focusAreas[0]}`;
        } else {
        focusGuidance = `Distribute focus areas across different workout days: ${preferences.focusAreas.join(', ')}`;
      }
    }
    
    // Create exercise avoidance notes if needed
    const avoidanceNotes = preferences.exercisesToAvoid 
      ? `IMPORTANT: The client needs to avoid these exercises due to limitations or injuries: ${preferences.exercisesToAvoid}`
      : "";

    // Add country-specific context if available
    const countryContext = preferences.country_region 
      ? `The client is from ${preferences.country_region}. Consider culturally relevant exercises and terminology.`
      : "";

    return `Create a personalized workout plan for ${levelDescription}. Follow these specific requirements:

CLIENT PROFILE:
- Fitness level: ${preferences.fitnessLevel}
- Workout location: ${preferences.workoutLocation}
- Exercise frequency: ${preferences.exerciseFrequency} days per week
- Time per session: ${preferences.timePerSession} minutes
- Focus areas: ${preferences.focusAreas.join(', ')}
${preferences.age ? `- Age: ${preferences.age}` : ''}
${preferences.gender ? `- Gender: ${preferences.gender}` : ''}
${preferences.weight ? `- Weight: ${preferences.weight} kg` : ''}
${preferences.height ? `- Height: ${preferences.height} cm` : ''}
${preferences.country_region ? `- Country/Region: ${preferences.country_region}` : ''}

TRAINING CONTEXT:
${equipmentContext}
${focusGuidance}
${avoidanceNotes}
${countryContext}

PLAN REQUIREMENTS:
1. Create exactly ${preferences.exerciseFrequency} workout days spaced appropriately throughout the week
2. Each day should have 4-6 exercises appropriate for a ${preferences.fitnessLevel} fitness level
3. IMPORTANT: Every workout day MUST have at least one exercise - no empty exercise arrays allowed
4. Include proper sets (2-4 for beginners, 3-5 for intermediate/advanced), reps, and rest periods
5. Provide at least 3 specific warm-up activities relevant to each workout
6. Include at least 3 cool-down/stretching activities targeting worked muscles
7. Create a clear progression plan for weeks 2-4 that gradually increases intensity

RESPONSE FORMAT:
Return a raw JSON object WITHOUT ANY MARKDOWN CODE BLOCKS.
Do not start your response with \`\`\`json or any other markdown.
Do not end your response with \`\`\` or any other closing tags.
Just return the pure JSON object with this structure:
{
  "weeklySchedule": [
    {
      "day": "Monday",
      "focus": "Upper Body",
      "exercises": [
        {"name": "Push-ups", "sets": 3, "reps": "10", "restSeconds": 60, "notes": "Keep core tight"},
        {"name": "Dumbbell Rows", "sets": 3, "reps": "12", "restSeconds": 60}
      ]
    }
  ],
  "warmUp": [
    "5 minutes of light cardio",
    "Arm circles",
    "Hip rotations"
  ],
  "coolDown": [
    "Light walking",
    "Quad stretch",
    "Hamstring stretch"
  ],
  "progressionPlan": {
    "week2": "Increase reps by 2 for each exercise",
    "week3": "Add one set to each exercise",
    "week4": "Reduce rest time by 15 seconds"
  }
}

IMPORTANT FORMAT RULES:
1. The "reps" field must be a string with either a simple number (like "10"), a range (like "8-12"), or a number with "seconds" (like "30 seconds").
2. Do not use formats like "10 reps", "10x", or "10 repetitions" - just use the number as a string.
3. For timed exercises, only use the format "30 seconds" (not "30s" or "30 secs").
4. Make sure "sets" is always a number (not a string).
5. Make sure "restSeconds" is always a number of seconds (not a string).
6. Every workout day MUST have at least one exercise - empty exercise arrays are not allowed.`;
  }

  /**
   * Backup generation using a guided, step-by-step approach
   */
  private async backupGeneration(preferences: UserFitnessPreferences): Promise<WorkoutPlan> {
    // Retry utility function with exponential backoff
    const retryApiCall = async (apiCall: () => Promise<any>, stepName: string): Promise<any> => {
      const maxRetries = 3;
      let delay = 1000;
      let lastError: any = null;
      
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          return await apiCall();
        } catch (error) {
          lastError = error;
          // Check if it's a rate limit error
          if (error.message?.includes('429') || 
              error.message?.includes('Resource has been exhausted') ||
              error.message?.includes('Too Many Requests')) {
            console.log(`⚠️ [PYDANTIC] Backup rate limit hit. Retrying in ${delay}ms... (Attempt ${attempt + 1}/${maxRetries})`);
            
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, delay));
            
            // Exponential backoff
            delay *= 2;
          } else {
            // For other errors, don't retry
            throw error;
          }
        }
      }
      
      // If we've exhausted all retries, throw the last error
      throw lastError || new Error(`Failed ${stepName} after maximum retry attempts`);
    };
    
    try {
      // Alternative approach: generate the entire plan at once with a simplified prompt
      console.log("📝 [PYDANTIC] Trying simplified backup approach");
      
      const simplifiedPrompt = this.buildSimplifiedPrompt(preferences);
      const simplifiedResponse = await retryApiCall(() => this.generativeModel.generateContent({
        contents: [{ role: "user", parts: [{ text: simplifiedPrompt }] }]
      }), "simplified backup");
      
      const simplifiedText = simplifiedResponse.response.text();
      
      try {
        // Try to extract JSON from response
        console.log("🔍 [PYDANTIC] Extracting JSON from simplified backup response");
        const planJson = this.extractAndPreprocessJson(simplifiedText);
        return this.validatePlan(planJson);
      } catch (jsonError) {
        console.error("❌ [PYDANTIC] Failed to extract JSON from simplified backup:", jsonError);
        // Continue to step-by-step approach if JSON extraction fails
      }
      
      // Fall back to step-by-step approach
      console.log("🔄 [PYDANTIC] Using step-by-step backup approach");
      
      // Step 1: Generate the weekly schedule structure
      const schedulePrompt = this.buildSchedulePrompt(preferences);
      const scheduleResponse = await retryApiCall(() => this.generativeModel.generateContent({
        contents: [{ role: "user", parts: [{ text: schedulePrompt }] }]
      }), "schedule generation");
      
      const scheduleText = scheduleResponse.response.text();
      const scheduleData = this.extractAndPreprocessJson(scheduleText);
      
      // Step 2: Generate exercises for each day
      const weeklySchedule: WorkoutDay[] = [];
      
      for (const dayInfo of scheduleData) {
        const exercisesPrompt = this.buildExercisesPrompt(preferences, dayInfo.day, dayInfo.focus);
        const exercisesResponse = await retryApiCall(() => this.generativeModel.generateContent({
          contents: [{ role: "user", parts: [{ text: exercisesPrompt }] }]
        }), `exercises for ${dayInfo.day}`);
        
        const exercisesText = exercisesResponse.response.text();
        const exercises = this.extractAndPreprocessJson(exercisesText);
        
        weeklySchedule.push({
          day: dayInfo.day,
          focus: dayInfo.focus,
          exercises: exercises
        });
      }
      
      // Step 3: Generate warm-up, cool-down, and progression
      const finalizingPrompt = this.buildFinalizingPrompt(preferences);
      const finalizingResponse = await retryApiCall(() => this.generativeModel.generateContent({
        contents: [{ role: "user", parts: [{ text: finalizingPrompt }] }]
      }), "finalization");
      
      const finalizingText = finalizingResponse.response.text();
      const finalizingData = this.extractAndPreprocessJson(finalizingText);
      
      // Combine all data into a workout plan
      const workoutPlan: WorkoutPlan = {
        weeklySchedule,
        warmUp: finalizingData.warmUp,
        coolDown: finalizingData.coolDown,
        progressionPlan: finalizingData.progressionPlan
      };
      
      // Validate the final plan
      return this.validatePlan(workoutPlan);
    } catch (error) {
      console.error("❌ [PYDANTIC] Backup generation steps failed:", error);
      throw error;
    }
  }
  
  /**
   * Validate a workout plan against our schema
   */
  private validatePlan(plan: any): WorkoutPlan {
    try {
      // Process and standardize the data
      this.standardizePlanData(plan);
      
      // Validate with Zod schema
      const validatedPlan = WorkoutPlanSchema.parse(plan);
      return validatedPlan;
    } catch (error) {
      console.error("❌ [PYDANTIC] Validation error:", error);
      throw new Error(`Plan validation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Ensures the workout plan data meets minimum requirements and has consistent structure
   */
  private standardizePlanData(plan: any): any {
    // Safety check - ensure we have required structures
    if (!plan) plan = {};
    if (!plan.weeklySchedule || !Array.isArray(plan.weeklySchedule)) plan.weeklySchedule = [];
    if (!plan.warmUp || !Array.isArray(plan.warmUp)) plan.warmUp = ["Light cardio for 5 minutes", "Arm circles", "Hip rotations"];
    if (!plan.coolDown || !Array.isArray(plan.coolDown)) plan.coolDown = ["Light walking", "Stretching major muscle groups", "Deep breathing"];
    if (!plan.progressionPlan) plan.progressionPlan = {
      week2: "Increase reps by 2 for each exercise",
      week3: "Add one set to each exercise",
      week4: "Reduce rest time by 15 seconds"
    };
    
    // Process each workout day
    for (const day of plan.weeklySchedule) {
      if (!day.exercises || !Array.isArray(day.exercises)) {
        day.exercises = [];
      }

      // Ensure each exercise has required properties
      for (const exercise of day.exercises) {
        if (!exercise.name) exercise.name = "Generic Exercise";
        if (!exercise.sets || typeof exercise.sets !== 'number') exercise.sets = 3;
        if (!exercise.restSeconds || typeof exercise.restSeconds !== 'number') exercise.restSeconds = 60;
        
        // Sanitize the reps field - this is critical for validation
        exercise.reps = this.sanitizeReps(exercise.reps);
      }
    }

    return plan;
  }

  /**
   * Sanitize the reps field to ensure it matches the expected format
   * Valid formats: "10", "10-12", "30 seconds", "10-12 seconds"
   */
  private sanitizeReps(reps: any): string {
    // If reps is already a number, convert to string and return
    if (typeof reps === 'number') {
      return reps.toString();
    }
    
    // If reps is not a string, default to "10"
    if (typeof reps !== 'string') {
      return "10";
    }
    
    // Check if it already matches our regex pattern
    if (/^\d+(-\d+)?( seconds)?$/.test(reps)) {
      return reps;
    }
    
    // Extract all numbers from the string
    const numbers = reps.match(/\d+/g);
    if (!numbers || numbers.length === 0) {
      return "10"; // Default if no numbers found
    }
    
    // Check for common patterns
    if (reps.toLowerCase().includes('second') || reps.toLowerCase().includes('sec') || reps.toLowerCase().includes('s')) {
      return `${numbers[0]} seconds`;
    }
    
    // Check if it might be a range
    if (numbers.length >= 2 && (reps.includes('-') || reps.includes('to') || reps.includes('–'))) {
      return `${numbers[0]}-${numbers[1]}`;
    }
    
    // Default to just the first number found
    return numbers[0];
  }

  /**
   * Generate JSON schema for function calling
   */
  private getJsonSchema(): any {
    return {
      type: "object",
      properties: {
        workoutPlan: {
          type: "object",
          description: "Complete workout plan object with all required data",
          properties: {
            weeklySchedule: {
              type: "array",
              description: "Weekly workout schedule with specific days and exercises",
              items: {
                type: "object",
                properties: {
                  day: { type: "string", description: "Day of the week (e.g., Monday, Tuesday)" },
                  focus: { type: "string", description: "Focus area for this workout day (e.g., Upper Body, Legs)" },
                  exercises: {
                    type: "array",
                    description: "List of exercises for this workout day",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "Name of the exercise" },
                        sets: { type: "integer", description: "Number of sets" },
                        reps: { 
                          type: "string", 
                          description: "Number of repetitions or duration (e.g., '10', '30 seconds', '8-10')"
                        },
                        restSeconds: { type: "integer", description: "Rest time between sets in seconds" },
                        notes: { type: "string", description: "Form tips or additional instructions" }
                      },
                      required: ["name", "sets", "reps", "restSeconds"]
                    }
                  }
                },
                required: ["day", "focus", "exercises"]
              }
            },
            warmUp: {
              type: "array",
              description: "List of warm-up activities to perform before each workout",
              items: { type: "string" }
            },
            coolDown: {
              type: "array",
              description: "List of cool-down activities to perform after each workout",
              items: { type: "string" }
            },
            progressionPlan: {
              type: "object",
              description: "Plan for progression over weeks 2-4",
              properties: {
                week2: { type: "string", description: "Progression for week 2" },
                week3: { type: "string", description: "Progression for week 3" },
                week4: { type: "string", description: "Progression for week 4" }
              },
              required: ["week2", "week3", "week4"]
            }
          },
          required: ["weeklySchedule", "warmUp", "coolDown", "progressionPlan"]
        }
      },
      required: ["workoutPlan"]
    };
  }
  
  /**
   * Create a schedule prompt for the backup method
   */
  private buildSchedulePrompt(preferences: UserFitnessPreferences): string {
    return `Create a weekly workout schedule for a ${preferences.fitnessLevel} level person who wants to work out ${preferences.exerciseFrequency} days per week.
Focus areas: ${preferences.focusAreas.join(', ')}

Return ONLY a JSON array of workout days, with each day having a day name and focus area.
Example:
[
  {"day": "Monday", "focus": "Chest and Triceps"},
  {"day": "Wednesday", "focus": "Back and Biceps"},
  {"day": "Friday", "focus": "Legs and Core"}
]`;
  }
  
  /**
   * Create an exercises prompt for the backup method
   */
  private buildExercisesPrompt(preferences: UserFitnessPreferences, day: string, focus: string): string {
    return `Create a list of exercises for a ${preferences.fitnessLevel} level person for a ${focus} workout on ${day}.
- Workout location: ${preferences.workoutLocation}
- Available equipment: ${preferences.availableEquipment.join(', ')}
- Time per session: ${preferences.timePerSession} minutes
- Exercises to avoid: ${preferences.exercisesToAvoid || 'None'}

Return ONLY a JSON array of exercises, each with name, sets, reps, restSeconds (as a number), and optional notes.
Example:
[
  {"name": "Bench Press", "sets": 3, "reps": 10, "restSeconds": 60, "notes": "Keep elbows at 45 degrees"},
  {"name": "Push-ups", "sets": 3, "reps": 12, "restSeconds": 45, "notes": "Keep core tight"}
]`;
  }
  
  /**
   * Create a finalizing prompt for the backup method
   */
  private buildFinalizingPrompt(preferences: UserFitnessPreferences): string {
    return `Create warm-up activities, cool-down activities, and a progression plan for a ${preferences.fitnessLevel} level person.

Return ONLY a JSON object with the following structure:
{
  "warmUp": ["Activity 1", "Activity 2", "Activity 3"],
  "coolDown": ["Activity 1", "Activity 2", "Activity 3"],
  "progressionPlan": {
    "week2": "Description of how to progress in week 2",
    "week3": "Description of how to progress in week 3",
    "week4": "Description of how to progress in week 4"
  }
}`;
  }
  
  /**
   * Parse rest time from string to seconds
   */
  private parseRestTime(restTime: string): number {
    if (typeof restTime === 'number') return restTime;
    
    // Extract numbers from strings like "60 seconds" or "1 minute"
    const match = restTime.match(/(\d+)/);
    if (match) {
      const time = parseInt(match[0], 10);
      
      // Convert to seconds if needed
      if (restTime.includes('minute')) {
        return time * 60;
      } else {
        return time;
      }
    }
    
    return 60; // Default rest time
  }
  
  /**
   * Create a fallback plan when all else fails
   */
  public createFallbackPlan(preferences: UserFitnessPreferences): WorkoutPlan {
    const daysOfWeek = ['Monday', 'Wednesday', 'Friday', 'Sunday', 'Tuesday', 'Thursday', 'Saturday'];
    const focusAreas = preferences.focusAreas.length > 0 ? preferences.focusAreas : ['Full Body'];
    
    // Create basic workout days
    const weeklySchedule: WorkoutDay[] = [];
    for (let i = 0; i < preferences.exerciseFrequency; i++) {
      const focusIndex = i % focusAreas.length;
      const focus = this.mapFocusArea(focusAreas[focusIndex]);
      
      weeklySchedule.push({
        day: daysOfWeek[i],
        focus: focus,
        exercises: this.getFallbackExercises(focus, preferences)
      });
    }
    
    // Create the fallback plan
    return {
      weeklySchedule,
      warmUp: [
        "5 minutes of light cardio (jogging in place, jumping jacks)",
        "Arm circles (10 forward, 10 backward)",
        "Hip rotations (10 each direction)",
        "Bodyweight squats (10 reps)",
        "Push-ups (5-10 reps)"
      ],
      coolDown: [
        "Light walking for 2-3 minutes",
        "Quad stretch (30 seconds each leg)",
        "Hamstring stretch (30 seconds each leg)",
        "Chest and shoulder stretch (30 seconds each side)",
        "Deep breathing exercises (5 deep breaths)"
      ],
      progressionPlan: {
        week2: "Increase reps by 2 for each exercise",
        week3: "Add one set to each exercise",
        week4: "Reduce rest time by 15 seconds"
      }
    };
  }
  
  /**
   * Map focus area to standardized name
   */
  private mapFocusArea(area: string): string {
    const map: Record<string, string> = {
      'upper-body': 'Upper Body',
      'lower-body': 'Lower Body',
      'core': 'Core',
      'cardio': 'Cardio',
      'full-body': 'Full Body',
      'flexibility': 'Flexibility'
    };
    
    return map[area] || area;
  }
  
  /**
   * Get fallback exercises for a focus area
   */
  private getFallbackExercises(focus: string, preferences: UserFitnessPreferences): Exercise[] {
    const isHome = preferences.workoutLocation === 'home';
    const isBeginner = preferences.fitnessLevel === 'beginner';
    const sets = isBeginner ? 2 : 3;
    const reps = isBeginner ? 8 : 12;
    const rest = isBeginner ? 90 : 60;
    
    // Basic exercises by focus area
    const exerciseMap: Record<string, Exercise[]> = {
      'Upper Body': [
        { name: isHome ? 'Push-ups' : 'Bench Press', sets, reps, restSeconds: rest, notes: 'Keep elbows at 45 degrees' },
        { name: isHome ? 'Tricep Dips' : 'Tricep Extensions', sets, reps, restSeconds: rest },
        { name: isHome ? 'Pike Push-ups' : 'Shoulder Press', sets, reps, restSeconds: rest },
        { name: isHome ? 'Doorway Rows' : 'Dumbbell Rows', sets, reps, restSeconds: rest }
      ],
      'Lower Body': [
        { name: 'Bodyweight Squats', sets, reps, restSeconds: rest, notes: 'Keep knees tracking over toes' },
        { name: 'Walking Lunges', sets, reps, restSeconds: rest },
        { name: 'Glute Bridges', sets, reps, restSeconds: rest },
        { name: 'Calf Raises', sets, reps, restSeconds: rest }
      ],
      'Core': [
        { name: 'Plank', sets, reps: '30 seconds', restSeconds: rest },
        { name: 'Crunches', sets, reps, restSeconds: rest },
        { name: 'Russian Twists', sets, reps, restSeconds: rest },
        { name: 'Mountain Climbers', sets, reps, restSeconds: rest }
      ],
      'Full Body': [
        { name: 'Burpees', sets, reps, restSeconds: rest },
        { name: 'Bodyweight Squats', sets, reps, restSeconds: rest },
        { name: 'Push-ups', sets, reps, restSeconds: rest },
        { name: 'Mountain Climbers', sets, reps, restSeconds: rest }
      ],
      'Cardio': [
        { name: 'Jumping Jacks', sets, reps, restSeconds: rest },
        { name: 'High Knees', sets, reps, restSeconds: rest },
        { name: 'Burpees', sets, reps, restSeconds: rest },
        { name: 'Mountain Climbers', sets, reps, restSeconds: rest }
      ],
      'Flexibility': [
        { name: 'Forward Fold', sets, reps: '30 seconds', restSeconds: rest },
        { name: 'Butterfly Stretch', sets, reps: '30 seconds', restSeconds: rest },
        { name: 'Hip Flexor Stretch', sets, reps: '30 seconds', restSeconds: rest },
        { name: 'Child\'s Pose', sets, reps: '30 seconds', restSeconds: rest }
      ]
    };
    
    // Return exercises for the focus area or default to full body
    return exerciseMap[focus] || exerciseMap['Full Body'];
  }

  /**
   * Create a minimal fallback plan that cannot fail
   * Used as a last resort when other fallbacks fail
   */
  private createMinimalFallbackPlan(): WorkoutPlan {
    return {
      weeklySchedule: [
        {
          day: "Monday",
          focus: "Full Body",
          exercises: [
            { name: "Push-ups", sets: 3, reps: 10, restSeconds: 60 },
            { name: "Bodyweight Squats", sets: 3, reps: 10, restSeconds: 60 },
            { name: "Plank", sets: 3, reps: "30 seconds", restSeconds: 60 }
          ]
        },
        {
          day: "Wednesday",
          focus: "Full Body",
          exercises: [
            { name: "Jumping Jacks", sets: 3, reps: 20, restSeconds: 60 },
            { name: "Lunges", sets: 3, reps: 10, restSeconds: 60 },
            { name: "Mountain Climbers", sets: 3, reps: 20, restSeconds: 60 }
          ]
        },
        {
          day: "Friday",
          focus: "Full Body",
          exercises: [
            { name: "Burpees", sets: 3, reps: 8, restSeconds: 60 },
            { name: "Glute Bridges", sets: 3, reps: 12, restSeconds: 60 },
            { name: "Bicycle Crunches", sets: 3, reps: 15, restSeconds: 60 }
          ]
        }
      ],
      warmUp: [
        "Light jogging in place for 3 minutes",
        "Arm circles for 30 seconds",
        "Leg swings for 30 seconds"
      ],
      coolDown: [
        "Static stretching for 5 minutes",
        "Deep breathing for 1 minute",
        "Gentle walking for 2 minutes" 
      ],
      progressionPlan: {
        week2: "Add 2 reps to each exercise",
        week3: "Add one set to each exercise",
        week4: "Reduce rest periods by 15 seconds"
      }
    };
  }

  /**
   * Builds a simplified prompt for one-shot generation
   */
  private buildSimplifiedPrompt(preferences: UserFitnessPreferences): string {
    return `Generate a complete workout plan based on these preferences:
- Fitness Level: ${preferences.fitnessLevel}
- Workout Location: ${preferences.workoutLocation}
- Available Equipment: ${preferences.availableEquipment.join(', ') || 'None'}
- Exercise Frequency: ${preferences.exerciseFrequency} days per week
- Time Per Session: ${preferences.timePerSession} minutes
- Focus Areas: ${preferences.focusAreas.join(', ')}
${preferences.exercisesToAvoid ? `- Exercises to Avoid: ${preferences.exercisesToAvoid}` : ''}

The response MUST be a valid JSON object with this structure:
{
  "weeklySchedule": [
    {
      "day": "Monday",
      "focus": "Upper Body",
      "exercises": [
        {"name": "Push-ups", "sets": 3, "reps": 10, "restSeconds": 60},
        ...more exercises
      ]
    },
    ...more days
  ],
  "warmUp": [
    "5 minutes of light cardio",
    ...more warm-up activities
  ],
  "coolDown": [
    "Stretching for 5 minutes",
    ...more cool-down activities
  ],
  "progressionPlan": {
    "week2": "Increase reps by 2",
    "week3": "Add one more set",
    "week4": "Decrease rest time by 15 seconds"
  }
}

IMPORTANT: The output must be valid JSON with no additional text or explanations.`;
  }

  /**
   * Helper to extract and preprocess JSON from text responses
   */
  private extractAndPreprocessJson(text: string): any {
    try {
      // First try to find a JSON block with code fences
      const jsonBlockMatch = text.match(/```(?:json)?([\s\S]*?)```/);
      let jsonContent;
      
      if (jsonBlockMatch && jsonBlockMatch[1]) {
        jsonContent = jsonBlockMatch[1].trim();
      } else {
        // Then try to find any JSON-like structure
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonContent = jsonMatch[0];
        } else {
          throw new Error("No JSON found in text");
        }
      }
      
      // Parse the JSON
      const parsedJson = JSON.parse(jsonContent);
      
      // Ensure the JSON has the minimum required structure
      const preprocessedJson = this.ensureMinimumRequirements(parsedJson);
      
      return preprocessedJson;
    } catch (error) {
      console.error("❌ [PYDANTIC] JSON extraction/preprocessing failed:", error);
      throw error;
    }
  }
  
  /**
   * Ensure JSON has minimum required fields to pass basic validation
   */
  private ensureMinimumRequirements(json: any): any {
    // Make a deep copy to avoid modifying the original
    const result = JSON.parse(JSON.stringify(json));
    
    // Ensure required arrays exist and have minimum items
    if (!result.weeklySchedule || !Array.isArray(result.weeklySchedule) || result.weeklySchedule.length === 0) {
      console.log("⚠️ [PYDANTIC] Adding default workout day to weeklySchedule");
      result.weeklySchedule = [{
        day: "Monday",
        focus: "Full Body",
        exercises: [
          { name: "Push-ups", sets: 3, reps: 10, restSeconds: 60 },
          { name: "Bodyweight Squats", sets: 3, reps: 10, restSeconds: 60 },
          { name: "Plank", sets: 3, reps: "30 seconds", restSeconds: 60 }
        ]
      }];
    }
    
    // Ensure each workout day has required fields
    result.weeklySchedule.forEach((day: any, index: number) => {
      if (!day.day) day.day = ["Monday", "Wednesday", "Friday", "Sunday", "Tuesday", "Thursday", "Saturday"][index % 7];
      if (!day.focus) day.focus = "Full Body";
      if (!day.exercises || !Array.isArray(day.exercises) || day.exercises.length === 0) {
        day.exercises = [
          { name: "Push-ups", sets: 3, reps: 10, restSeconds: 60 },
          { name: "Bodyweight Squats", sets: 3, reps: 10, restSeconds: 60 }
        ];
      }
      
      // Ensure each exercise has required fields
      day.exercises.forEach((exercise: any) => {
        if (!exercise.name) exercise.name = "Bodyweight Exercise";
        if (!exercise.sets) exercise.sets = 3;
        if (!exercise.reps) exercise.reps = 10;
        if (!exercise.restSeconds) exercise.restSeconds = 60;
      });
    });
    
    // Ensure warm-up has minimum required items
    if (!result.warmUp || !Array.isArray(result.warmUp) || result.warmUp.length < 2) {
      console.log("⚠️ [PYDANTIC] Adding default warm-up activities");
      result.warmUp = [
        "5 minutes of light cardio (jogging in place, jumping jacks)",
        "Arm circles (10 forward, 10 backward)",
        "Hip rotations (10 each direction)"
      ];
    }
    
    // Ensure cool-down has minimum required items
    if (!result.coolDown || !Array.isArray(result.coolDown) || result.coolDown.length < 2) {
      console.log("⚠️ [PYDANTIC] Adding default cool-down activities");
      result.coolDown = [
        "Light walking for 2-3 minutes",
        "Quad stretch (30 seconds each leg)",
        "Hamstring stretch (30 seconds each leg)"
      ];
    }
    
    // Ensure progression plan exists
    if (!result.progressionPlan) {
      console.log("⚠️ [PYDANTIC] Adding default progression plan");
      result.progressionPlan = {
        week2: "Increase reps by 2 for each exercise",
        week3: "Add one set to each exercise",
        week4: "Reduce rest time by 15 seconds"
      };
    } else {
      if (!result.progressionPlan.week2) result.progressionPlan.week2 = "Increase reps by 2 for each exercise";
      if (!result.progressionPlan.week3) result.progressionPlan.week3 = "Add one set to each exercise";
      if (!result.progressionPlan.week4) result.progressionPlan.week4 = "Reduce rest time by 15 seconds";
    }
    
    return result;
  }

  /**
   * Extract JSON from text if direct parsing fails
   * This handles cases where the model may add explanations or markdown formatting
   */
  private extractJsonFromText(text: string): any | null {
    // Try to find JSON between code blocks
    const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (codeBlockMatch && codeBlockMatch[1]) {
      try {
        return JSON.parse(codeBlockMatch[1]);
      } catch (e) {
        console.log("[PydanticWorkoutGenerator] Failed to parse JSON from code block");
      }
    }

    // Try to extract content between curly braces
    const jsonRegex = /(\{[\s\S]*\})/g;
    const matches = text.match(jsonRegex);
    
    if (matches) {
      for (const match of matches) {
        try {
          return JSON.parse(match);
        } catch (e) {
          // Try next match if there are multiple
          continue;
        }
      }
    }
    
    // Try to extract the largest JSON-like structure
    let openBraces = 0;
    let startIndex = -1;
    let endIndex = -1;
    let maxLength = 0;
    let bestStart = -1;
    let bestEnd = -1;
    
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '{') {
        if (openBraces === 0) {
          startIndex = i;
        }
        openBraces++;
      } else if (text[i] === '}') {
        openBraces--;
        if (openBraces === 0) {
          endIndex = i;
          const length = endIndex - startIndex + 1;
          if (length > maxLength) {
            maxLength = length;
            bestStart = startIndex;
            bestEnd = endIndex;
          }
        }
      }
    }
    
    if (bestStart !== -1 && bestEnd !== -1) {
      const jsonString = text.substring(bestStart, bestEnd + 1);
      try {
        return JSON.parse(jsonString);
      } catch (e) {
        console.log("[PydanticWorkoutGenerator] Failed to parse largest JSON-like structure");
      }
    }
    
    return null;
  }
}

// Export an instance for easy use
export const pydanticWorkoutGenerator = new PydanticWorkoutGenerator(); 