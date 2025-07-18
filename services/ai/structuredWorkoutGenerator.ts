/**
 * Helper function to parse JSON from LLM responses, handling common issues
 */
export function parseJsonFromLLM(text: string): any {
  if (!text || text.trim() === '') {
    throw new Error("Empty text cannot be parsed as JSON");
  }
  
  // Remove markdown code blocks
  let cleanedText = text.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();
  
  // Remove any additional backticks that might be present
  cleanedText = cleanedText.replace(/`/g, '').trim();
  
  // Try direct JSON parse first
  try {
    return JSON.parse(cleanedText);
  } catch (e) {
    // Check if the content is still wrapped in a code block without explicit language
    const codeBlockMatch = cleanedText.match(/```\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch && codeBlockMatch[1]) {
      try {
        return JSON.parse(codeBlockMatch[1].trim());
      } catch (innerError) {
        // Continue to other strategies
      }
    }
    
    // Look for potential JSON objects in the text
    const jsonPattern = /\{[\s\S]*\}/;
    const jsonMatch = cleanedText.match(jsonPattern);
    if (jsonMatch && jsonMatch[0]) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (innerError) {
        // Continue to other strategies
      }
    }
    
    // Check for arrays
    const arrayPattern = /\[[\s\S]*\]/;
    const arrayMatch = cleanedText.match(arrayPattern);
    if (arrayMatch && arrayMatch[0]) {
      try {
        return JSON.parse(arrayMatch[0]);
      } catch (innerError) {
        // Continue to final error
      }
    }
    
    // If nothing worked, throw the original error
    throw new Error(`Failed to parse JSON: ${e.message}`);
  }
}

/**
 * Structured Workout Generator Service
 * 
 * Provides robust workout plan generation with Gemini function calling
 * and a comprehensive multi-tier fallback system for 100% reliability.
 */

import { HarmBlockThreshold, HarmCategory, GenerateContentRequest, GenerateContentResult, FunctionDeclaration, SchemaType } from '@google/generative-ai';
import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { UserFitnessPreferences } from "./workoutGenerator";
import { GEMINI_API_KEY } from '../../constants/api';
import { fallbackWorkoutPlan } from '../../lib/gemini';

// Types for structured workout plan
export interface WorkoutExercise {
  name: string;
  sets: number;
  reps: number;
  restSeconds: number;
  notes?: string;
}

export interface WorkoutDay {
  day: string;
  focus: string;
  exercises: WorkoutExercise[];
}

export interface WorkoutPlan {
  weeklySchedule: WorkoutDay[];
  warmUp: string[];
  coolDown: string[];
  progressionPlan: {
    week2: string;
    week3: string;
    week4: string;
  };
}

// Type definition for function call schema
export interface FunctionCallSchema {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}

/**
 * Workout Plan Function Schema
 * 
 * Defines the exact structure expected from function calling 
 * to ensure consistent, validated output
 */
export const workoutPlanSchema: FunctionCallSchema = {
  name: "generateWorkoutPlan",
  description: "Generate a personalized workout plan based on user fitness preferences",
  parameters: {
    type: "object",
    properties: {
      weeklySchedule: {
        type: "array",
        description: "Weekly workout schedule with specific exercises for each day",
        items: {
          type: "object",
          properties: {
            day: { 
              type: "string",
              description: "Day of the week (Monday, Tuesday, etc.)"
            },
            focusArea: { 
              type: "string",
              description: "Primary muscle group or fitness focus for this workout day"
            },
            exercises: {
              type: "array",
              description: "List of exercises for this workout day",
              items: {
                type: "object",
                properties: {
                  name: { 
                    type: "string",
                    description: "Name of the exercise"
                  },
                  sets: { 
                    type: "integer",
                    description: "Number of sets to perform"
                  },
                  reps: { 
                    type: "string",
                    description: "Number of repetitions or duration (e.g., '10' or '30 seconds')"
                  },
                  rest: { 
                    type: "string",
                    description: "Rest period between sets (e.g., '60 seconds')"
                  },
                  description: {
                    type: "string",
                    description: "Brief instruction on how to perform the exercise correctly"
                  }
                },
                required: ["name", "sets", "reps", "rest"]
              }
            }
          },
          required: ["day", "focusArea", "exercises"]
        }
      },
      warmUp: { 
        type: "array", 
        description: "Warm-up activities to perform before the workout",
        items: { type: "string" } 
      },
      coolDown: { 
        type: "array", 
        description: "Cool-down activities to perform after the workout",
        items: { type: "string" } 
      },
      progressionPlan: { 
        type: "object", 
        description: "How to progress the workout over time (e.g., by week)",
        additionalProperties: { type: "string" } 
      }
    },
    required: ["weeklySchedule", "warmUp", "coolDown", "progressionPlan"]
  }
};

/**
 * Structured Workout Generator Class
 * 
 * Provides a multi-tier approach to workout plan generation
 * with robust fallbacks to ensure 100% reliability
 */
export class StructuredWorkoutGenerator {
  // Get the model used for function calling
  private getGeminiModel() {
    // Create a new model instance for each call to avoid state issues
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    
    console.log("ud83dudc1f [GEMINI] Using API key:", GEMINI_API_KEY.substring(0, 5) + "...");
    
    // Configure the model for function calling
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-pro",
      generationConfig: {
        temperature: 0.4,
        topP: 0.8,
        topK: 40,
      },
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
      ],
    });
    
    return model;
  }

  /**
   * Construct a detailed prompt based on user preferences
   */
  private constructPrompt(preferences: UserFitnessPreferences): string {
    // Use type assertion to access properties safely
    const prefs = preferences as any;
    
    return `Create a personalized workout plan for a ${preferences.fitnessLevel} level individual.
      They want to work out ${preferences.exerciseFrequency} days per week, focusing on ${preferences.focusAreas.join(', ')}.
      They exercise at ${preferences.workoutLocation} with access to: ${preferences.availableEquipment.join(', ')}.
      Each session should be around ${preferences.timePerSession} minutes.
      ${prefs.exercisesToAvoid ? `They want to avoid these exercises: ${prefs.exercisesToAvoid}` : ''}
      ${prefs.limitations ? `They have the following limitations: ${prefs.limitations}` : ''}
      
      Create a comprehensive workout plan that matches their exact preferences.
      Make sure each exercise is appropriate for their fitness level and available equipment.
      The plan should progress over time to challenge them appropriately.
      
      Provide detailed descriptions for exercises to ensure proper form.
      Include a mix of compound and isolation exercises appropriate for their goals.
      Rest periods should be appropriate for their fitness level.
      
      The workout plan MUST have the following components:
      1. Weekly schedule with exercises for each workout day
      2. Warm-up activities
      3. Cool-down activities
      4. A progression plan`;
  }

  /**
   * Validate that a workout plan has all required components
   */
  private validateWorkoutPlan(plan: any): void {
    if (!plan) {
      throw new Error("Invalid workout plan: missing or empty plan");
    }
    
    // Check for required sections
    if (!plan.weeklySchedule || !Array.isArray(plan.weeklySchedule) || plan.weeklySchedule.length === 0) {
      throw new Error("Invalid workout plan: missing or empty weeklySchedule");
    }
    
    // Validate each workout day
    plan.weeklySchedule.forEach((day: any, index: number) => {
      if (!day.day || !day.focus || !day.exercises || !Array.isArray(day.exercises)) {
        throw new Error(`Invalid workout day at index ${index}: missing required fields`);
      }
      
      // Validate each exercise
      day.exercises.forEach((exercise: any, exerciseIndex: number) => {
        if (!exercise.name) {
          throw new Error(`Invalid exercise at day ${index}, exercise ${exerciseIndex}: missing name`);
        }
        
        // Convert string reps to numbers if needed
        if (typeof exercise.reps === 'string') {
          const parsedReps = parseInt(exercise.reps);
          if (!isNaN(parsedReps)) {
            exercise.reps = parsedReps;
          } else {
            exercise.reps = 10; // Default if we can't parse
          }
        }
        
        // Convert string sets to numbers if needed
        if (typeof exercise.sets === 'string') {
          const parsedSets = parseInt(exercise.sets);
          if (!isNaN(parsedSets)) {
            exercise.sets = parsedSets;
          } else {
            exercise.sets = 3; // Default if we can't parse
          }
        }
        
        // Handle rest either as restSeconds (number) or as rest (string)
        if (exercise.rest && typeof exercise.rest === 'string' && !exercise.restSeconds) {
          // Try to extract number from string like "60 seconds"
          const restMatch = exercise.rest.match(/\d+/);
          if (restMatch) {
            exercise.restSeconds = parseInt(restMatch[0]);
          } else {
            exercise.restSeconds = 60; // Default
          }
        }
        
        // Ensure we have restSeconds
        if (!exercise.restSeconds) {
          exercise.restSeconds = 60; // Default
        }
        
        // Convert description to notes if needed
        if (exercise.description && !exercise.notes) {
          exercise.notes = exercise.description;
          delete exercise.description;
        }
      });
    });
    
    // Check for warm-up and cool-down
    if (!plan.warmUp || !Array.isArray(plan.warmUp)) {
      plan.warmUp = [
        "5 minutes of light cardio",
        "Dynamic stretching for major muscle groups"
      ];
    }
    
    if (!plan.coolDown || !Array.isArray(plan.coolDown)) {
      plan.coolDown = [
        "Static stretching for worked muscle groups",
        "5 minutes of relaxation breathing"
      ];
    }
    
    // Check for progression plan
    if (!plan.progressionPlan || typeof plan.progressionPlan !== 'object') {
      plan.progressionPlan = {
        week2: "Increase reps by 2 per exercise",
        week3: "Add one set to each exercise",
        week4: "Decrease rest time by 15 seconds"
      };
    }
  }

  /**
   * Convert workout plan schema to Gemini function declaration format
   */
  private getWorkoutPlanFunctionDeclaration(): FunctionDeclaration {
    return {
      name: "generateWorkoutPlan",
      description: "Generate a structured workout plan based on the user's preferences",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          workoutPlan: {
            type: SchemaType.STRING,
            description: "The JSON string of the workout plan"
          }
        },
        required: ["workoutPlan"]
      }
    };
  }

  /**
   * Extract function call results from a Gemini response object
   */
  private extractFunctionCallResults(response: any): any {
    if (!response) {
      console.log("ud83dudcdd [GEMINI] No response received");
      return null;
    }
    
    try {
      // Check if the response has a functionCall property with a structured response
      if (response.functionCall && response.functionCall.response) {
        try {
          // Attempt to parse the function call response as JSON
          return JSON.parse(response.functionCall.response);
        } catch (jsonError) {
          console.log("ud83dudcdd [GEMINI] Function call response is not valid JSON:", response.functionCall.response);
          // Try to extract any JSON-like content from the response
          try {
            return parseJsonFromLLM(response.functionCall.response);
          } catch (jsonParseError) {
            console.error("ud83dudcdd [GEMINI] Failed to parse function call response as JSON:", jsonParseError.message);
            return null;
          }
        }
      }
      
      // If there are function calls in candidates
      if (response.candidates && response.candidates.length > 0) {
        const candidate = response.candidates[0];
        
        if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
          for (const part of candidate.content.parts) {
            if (part.functionCall && part.functionCall.args) {
              return part.functionCall.args;
            }
          }
        }
        
        // Check for functionCall at the candidate level
        if (candidate.functionCall && candidate.functionCall.args) {
          return candidate.functionCall.args;
        }
      }
      
      // If we have text that might contain JSON, try to parse it
      if (response.text && typeof response.text === 'function') {
        const text = response.text();
        try {
          return parseJsonFromLLM(text);
        } catch (error) {
          console.log("ud83dudcdd [GEMINI] Response text is not valid JSON");
        }
      }
      
      // Last resort: try to get any text response
      if (response.response && typeof response.response.text === 'function') {
        return response.response.text();
      }
      
      // If we've tried everything and still no result, return null
      console.log("ud83dudcdd [GEMINI] Could not extract function call results");
      return null;
    } catch (error) {
      console.error("ud83dudcdd [GEMINI] Error extracting function call results:", error.message);
      return null;
    }
  }

  /**
   * Generate workout plan using function calling for structured output
   */
  public async generateWorkoutPlanWithFallback(preferences: UserFitnessPreferences): Promise<WorkoutPlan> {
    console.log("ud83dudcdd [GEMINI] Generating workout plan with fallback");
    
    try {
      // Attempt primary generation with function calling
      console.log("ud83dudcdd [GEMINI] Attempting primary generation with function calling");
      const model = await this.getGeminiModel();
      const structuredPrompt = this.buildStructuredPromptWithFunctionCalling(preferences);
      
      try {
        // Make the API call
        const response = await model.generateContent(structuredPrompt);
        
        // Extract the workout plan from the response
        const workoutPlanData = this.extractFunctionCallResults(response);
        
        if (workoutPlanData) {
          try {
            // Validate the workout plan
            this.validateWorkoutPlan(workoutPlanData);
            return workoutPlanData as WorkoutPlan;
          } catch (validationError) {
            console.log("ud83dudcdd [GEMINI] Validation error:", validationError.message);
            // Continue to fallback tier 1
          }
        }
      } catch (apiError) {
        console.log("ud83dudcdd [GEMINI] Primary generation error:", apiError.message);
        // Continue to fallback tier 1
      }
      
      // Begin fallback tiers
      try {
        // Tier 1: Try with simplified prompt
        return await this.tier1Fallback(preferences);
      } catch (tier1Error) {
        console.error("ud83dudcdd [GEMINI] Tier 1 fallback failed:", tier1Error.message);
        
        try {
          // Tier 2: Try component-by-component generation
          return await this.tier2Fallback(preferences);
        } catch (tier2Error) {
          console.error("ud83dudcdd [GEMINI] Tier 2 fallback failed:", tier2Error.message);
          
          try {
            // Tier 3: Try template-based generation with minimal LLM customization
            return await this.tier3Fallback(preferences);
          } catch (tier3Error) {
            console.error("ud83dudcdd [GEMINI] Tier 3 fallback failed:", tier3Error.message);
            
            // Tier 4: Final failsafe - pure template fallback (100% guaranteed)
            console.log("ud83dudcdd [GEMINI] All AI generations failed, using guaranteed fallback");
            console.log("ud83dudc1f [GEMINI] API Key issues may be the cause of failures");
            return this.tier4Fallback(preferences); // Use the imported fallback plan
          }
        }
      }
    } catch (error) {
      console.error("ud83dudcdd [GEMINI] Error generating workout plan:", error.message);
      throw error;
    }
  }
  
  /**
   * Build structured prompt with function calling
   */
  private buildStructuredPromptWithFunctionCalling(preferences: UserFitnessPreferences): GenerateContentRequest {
    console.log("ud83dudc1f [GEMINI] Using API key:", GEMINI_API_KEY.slice(0, 5) + '...');
    
    // Construct a prompt based on user preferences
    const prompt = this.constructPrompt(preferences);
    
    // Get function declaration with proper typing
    const functionDeclaration = this.getWorkoutPlanFunctionDeclaration();
    
    // Configure the structured prompt
    return {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        topP: 0.8,
        topK: 40,
      },
      tools: [{
        functionDeclarations: [functionDeclaration],
      }],
      safetySettings: this.getSafetySettings()
    };
  }
  
  /**
   * Tier 1 Fallback: Try with simplified prompt and lower temperature
   */
  private async tier1Fallback(preferences: UserFitnessPreferences): Promise<WorkoutPlan> {
    try {
      console.log("ud83dudd04 [GEMINI] Attempting Tier 1 fallback with simplified prompt");
      
      const model = this.getGeminiModel();
      
      // Simplify the prompt to focus on core requirements
      const simplifiedPrompt = `Generate a ${preferences.fitnessLevel} level workout plan for ${preferences.exerciseFrequency} days per week. 
        Equipment: ${preferences.availableEquipment.join(', ')}. 
        Time: ${preferences.timePerSession} minutes per session.
        Focus on: ${preferences.focusAreas.join(', ')}.
        
        Return the workout plan in this exact JSON format:
        {
          "weeklySchedule": [
            {
              "day": "Day of week",
              "focus": "Focus area",
              "exercises": [
                {
                  "name": "Exercise name",
                  "sets": 3,
                  "reps": 10,
                  "restSeconds": 60,
                  "notes": "exercise description"
                }
              ]
            }
          ],
          "warmUp": ["Warm-up activity 1", "Warm-up activity 2"],
          "coolDown": ["Cool-down activity 1", "Cool-down activity 2"],
          "progressionPlan": {
            "week2": "Week 2 progression",
            "week3": "Week 3 progression",
            "week4": "Week 4 progression"
          }
        }
        
        RESPOND ONLY WITH VALID JSON WITH NO COMMENTS. NO MARKDOWN FORMATTING.`;
      
      // Call API with lower temperature for more reliable output
      console.log("ud83dudcdd [GEMINI] Sending Tier 1 fallback request to Gemini");
      const response = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: simplifiedPrompt }] }],
        generationConfig: {
          temperature: 0.3,  // Lower temperature for more reliable, conservative output
          topK: 20,
          topP: 0.8,
        }
      });
      
      const responseText = response.response.text();
      console.log("ud83dudcdd [GEMINI] Received Tier 1 fallback response, parsing JSON");
      
      // Parse the response as JSON
      const workoutPlan = parseJsonFromLLM(responseText);
      
      // Validate the workout plan
      this.validateWorkoutPlan(workoutPlan);
      
      console.log("ud83dudc4d [GEMINI] Tier 1 fallback successful");
      return workoutPlan;
    } catch (error) {
      console.error("ud83dudcdd [GEMINI] Tier 1 fallback failed:", error.message);
      throw error;
    }
  }

  /**
   * Tier 2 Fallback: Generate plan component by component
   */
  private async tier2Fallback(preferences: UserFitnessPreferences): Promise<WorkoutPlan> {
    try {
      console.log("ud83dudd04 [GEMINI] Attempting Tier 2 fallback with component generation");
      
      const model = this.getGeminiModel();
      
      // Step 1: Generate workout schedule structure
      const schedulePrompt = `Create a ${preferences.exerciseFrequency}-day workout schedule for ${preferences.fitnessLevel} level, focusing on ${preferences.focusAreas.join(', ')}. 
        Just provide the days and focus areas in this JSON format:
        [
          { "day": "Monday", "focus": "Chest and Triceps" },
          { "day": "Wednesday", "focus": "Back and Biceps" },
          { "day": "Friday", "focus": "Legs and Shoulders" }
        ]
        Only return valid JSON, no other text.`;
      
      const scheduleResponse = await model.generateContent(schedulePrompt);
      const scheduleText = scheduleResponse.response.text();
      let scheduleDays = this.parseSchedule(scheduleText);
      
      if (!scheduleDays || !Array.isArray(scheduleDays) || scheduleDays.length === 0) {
        console.log("ud83dudcdd [GEMINI] Failed to parse schedule, using default schedule");
        // Create a default schedule based on frequency
        const defaultScheduleDays = [];
        const defaultFocusAreas = this.getWorkoutSplit(preferences.exerciseFrequency);
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        
        for (let i = 0; i < preferences.exerciseFrequency; i++) {
          defaultScheduleDays.push({
            day: days[i],
            focus: defaultFocusAreas[i] || 'Full Body',
            numExercises: 4
          });
        }
        
        console.log("ud83dudcdd [GEMINI] Using default schedule", JSON.stringify(defaultScheduleDays));
        scheduleDays = defaultScheduleDays;
      }
      
      // Ensure we have at least one day in the schedule
      if (scheduleDays.length === 0) {
        scheduleDays.push({
          day: "Monday",
          focus: "Full Body",
          numExercises: 4
        });
      }
      
      console.log("ud83dudcdd [GEMINI] Generating exercises for", scheduleDays.length, "days");
      
      // Step 2: For each day, generate exercises separately
      const weeklySchedule: WorkoutDay[] = [];
      
      for (const scheduleDay of scheduleDays) {
        try {
          // Check if we've already had rate limit errors, if so, skip API calls and use templates
          if (weeklySchedule.some(day => day.exercises.length === 0)) {
            throw new Error("Previous API call failed, using template exercises");
          }
          
          const exercisesPrompt = `Create ${scheduleDay.numExercises || 4} exercises for a ${preferences.fitnessLevel} level workout focusing on ${scheduleDay.focus}.
            Available equipment: ${preferences.availableEquipment.join(', ')}.
            Time: ${preferences.timePerSession} minutes per session.
            Focus on: ${preferences.focusAreas.join(', ')}.
            
            Return the workout plan in this exact JSON format:
            {
              "day": "${scheduleDay.day}",
              "focus": "${scheduleDay.focus}",
              "exercises": [
                {
                  "name": "Exercise name",
                  "sets": 3,
                  "reps": 10,
                  "restSeconds": 60,
                  "notes": "exercise description"
                }
              ]
            }
            
            RESPOND ONLY WITH VALID JSON WITH NO COMMENTS. NO MARKDOWN FORMATTING.`;
          
          // Add retry logic for rate limiting
          let retryCount = 0;
          let exercisesResponse;
          let exercisesText = "";
          
          while (retryCount < 2) {
            try {
              exercisesResponse = await model.generateContent(exercisesPrompt);
              exercisesText = exercisesResponse.response.text();
              break; // Success, exit retry loop
            } catch (retryError) {
              // Check if it's a rate limit error
              if (retryError.message && retryError.message.includes("429")) {
                console.log(`ud83dudcdd [GEMINI] Rate limit hit, retry ${retryCount + 1}/2`);
                retryCount++;
                // Wait briefly before retrying
                await new Promise(resolve => setTimeout(resolve, 1000));
              } else {
                // Not a rate limit error, rethrow
                throw retryError;
              }
            }
          }
          
          // If we exhausted retries, throw error to use template
          if (!exercisesText && retryCount >= 2) {
            throw new Error("Rate limit retries exhausted");
          }
          
          // Parse exercises and handle potential formatting issues
          console.log("ud83dudcdd [GEMINI] Parsing exercises for", scheduleDay.day);
          let parsedExercises;
          
          try {
            // Try to parse as complete day object first
            const dayObject = JSON.parse(exercisesText.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim());
            
            if (dayObject && Array.isArray(dayObject.exercises)) {
              // Valid day object with exercises array
              const formattedExercises = dayObject.exercises.map(ex => ({
                name: ex.name || 'Unknown Exercise',
                sets: typeof ex.sets === 'string' ? parseInt(ex.sets) || this.getDefaultSets(preferences.fitnessLevel) : (ex.sets || this.getDefaultSets(preferences.fitnessLevel)),
                reps: typeof ex.reps === 'string' ? parseInt(ex.reps) || this.getDefaultReps(preferences.fitnessLevel) : (ex.reps || this.getDefaultReps(preferences.fitnessLevel)),
                restSeconds: ex.restSeconds || this.parseRestTime(ex.rest || '60 seconds'),
                notes: ex.notes || ex.description || ''
              }));
              
              weeklySchedule.push({
                day: dayObject.day || scheduleDay.day,
                focus: dayObject.focus || scheduleDay.focus,
                exercises: formattedExercises
              });
              
              // Skip the rest of this iteration since we've added the day
              continue;
            }
          } catch (error) {
            console.log("ud83dudcdd [GEMINI] Failed to parse as day object, trying as exercises array");
            // Continue to next parsing approach
          }
          
          // If we reached here, try parsing as just exercises
          parsedExercises = this.parseExercises(exercisesText, preferences.fitnessLevel);
          
          // If we still don't have valid exercises, use templated ones
          if (!parsedExercises || !Array.isArray(parsedExercises) || parsedExercises.length === 0) {
            console.log("ud83dudcdd [GEMINI] Failed to parse exercises, using template exercises");
            parsedExercises = this.getTemplateExercises(scheduleDay.focus, preferences.fitnessLevel);
          }
          
          // Convert to proper WorkoutExercise format
          const formattedExercises: WorkoutExercise[] = parsedExercises.map(ex => ({
            name: ex.name || 'Unknown Exercise',
            sets: typeof ex.sets === 'string' ? parseInt(ex.sets) || this.getDefaultSets(preferences.fitnessLevel) : (ex.sets || this.getDefaultSets(preferences.fitnessLevel)),
            reps: typeof ex.reps === 'string' ? parseInt(ex.reps) || this.getDefaultReps(preferences.fitnessLevel) : (ex.reps || this.getDefaultReps(preferences.fitnessLevel)),
            restSeconds: ex.restSeconds || this.parseRestTime(ex.rest || '60 seconds'),
            notes: ex.notes || ex.description || ''
          }));
          
          weeklySchedule.push({
            day: scheduleDay.day,
            focus: scheduleDay.focus,
            exercises: formattedExercises
          });
        } catch (dayError) {
          console.error("ud83dudcdd [GEMINI] Error generating exercises for", scheduleDay.day, dayError.message);
          // Add a fallback day with template exercises
          weeklySchedule.push({
            day: scheduleDay.day,
            focus: scheduleDay.focus,
            exercises: this.getTemplateExercises(scheduleDay.focus, preferences.fitnessLevel)
          });
        }
      }
      
      // Step 3: Generate warm-up activities
      let warmUp = [];
      try {
        const warmUpPrompt = `Create a list of 4-5 warm-up activities appropriate for ${preferences.fitnessLevel} level. Format as JSON array of strings. Return only valid JSON, no other text.`;
        
        // Use the same retry logic
        let retryCount = 0;
        let warmUpResponse;
        let warmUpText = "";
        
        while (retryCount < 2) {
          try {
            warmUpResponse = await model.generateContent(warmUpPrompt);
            warmUpText = warmUpResponse.response.text();
            break;
          } catch (retryError) {
            if (retryError.message && retryError.message.includes("429")) {
              console.log(`ud83dudcdd [GEMINI] Rate limit hit on warm-up, retry ${retryCount + 1}/2`);
              retryCount++;
              await new Promise(resolve => setTimeout(resolve, 1000));
            } else {
              throw retryError;
            }
          }
        }
        
        warmUp = this.parseList(warmUpText);
      } catch (warmUpError) {
        console.log("ud83dudcdd [GEMINI] Error generating warm-up:", warmUpError.message);
      }
      
      // Fallback for warm-up
      if (!warmUp || !Array.isArray(warmUp) || warmUp.length === 0) {
        warmUp = [
          "5 minutes of light cardio", 
          "Dynamic stretching for major muscle groups"
        ];
      }
      
      // Step 4: Generate cool-down activities
      let coolDown = [];
      try {
        const coolDownPrompt = `Create a list of 4-5 cool-down stretches appropriate for ${preferences.fitnessLevel} level. Format as JSON array of strings. Return only valid JSON, no other text.`;
        
        // Use the same retry logic
        let retryCount = 0;
        let coolDownResponse;
        let coolDownText = "";
        
        while (retryCount < 2) {
          try {
            coolDownResponse = await model.generateContent(coolDownPrompt);
            coolDownText = coolDownResponse.response.text();
            break;
          } catch (retryError) {
            if (retryError.message && retryError.message.includes("429")) {
              console.log(`ud83dudcdd [GEMINI] Rate limit hit on cool-down, retry ${retryCount + 1}/2`);
              retryCount++;
              await new Promise(resolve => setTimeout(resolve, 1000));
            } else {
              throw retryError;
            }
          }
        }
        
        coolDown = this.parseList(coolDownText);
      } catch (coolDownError) {
        console.log("ud83dudcdd [GEMINI] Error generating cool-down:", coolDownError.message);
      }
      
      // Fallback for cool-down
      if (!coolDown || !Array.isArray(coolDown) || coolDown.length === 0) {
        coolDown = [
          "Quad stretch", 
          "Hamstring stretch", 
          "Upper back stretch", 
          "Child's pose", 
          "Deep breathing"
        ];
      }
      
      // Step 5: Generate progression plan
      let progressionPlan = {
        week2: "Increase repetitions by 1-2 per exercise",
        week3: "Add one set to each exercise",
        week4: "Decrease rest time between sets by 15 seconds"
      };
      
      try {
        const progressionPrompt = `Create a 4-week progression plan for ${preferences.fitnessLevel} level. Format as JSON with keys week2, week3, week4 and string values. Return only valid JSON.`;
        
        // Use the same retry logic
        let retryCount = 0;
        let progressionResponse;
        let progressionText = "";
        
        while (retryCount < 2) {
          try {
            progressionResponse = await model.generateContent(progressionPrompt);
            progressionText = progressionResponse.response.text();
            break;
          } catch (retryError) {
            if (retryError.message && retryError.message.includes("429")) {
              console.log(`ud83dudcdd [GEMINI] Rate limit hit on progression plan, retry ${retryCount + 1}/2`);
              retryCount++;
              await new Promise(resolve => setTimeout(resolve, 1000));
            } else {
              throw retryError;
            }
          }
        }
        
        // The parseProgressionPlan method now guarantees all required properties with fallbacks
        const parsed = this.parseProgressionPlan(progressionText);
        if (parsed) {
          progressionPlan = parsed;
        }
      } catch (progressionError) {
        console.log("ud83dudcdd [GEMINI] Error generating progression plan:", progressionError.message);
      }
      
      // Combine all components
      const workoutPlan: WorkoutPlan = {
        weeklySchedule,
        warmUp,
        coolDown,
        progressionPlan
      };
      
      console.log("ud83dudc4d [GEMINI] Tier 2 fallback successful, generated", weeklySchedule.length, "workout days");
      return workoutPlan;
    } catch (error) {
      console.error("ud83dudcdd [GEMINI] Tier 2 fallback failed:", error.message);
      throw error;
    }
  }

  /**
   * Tier 3 Fallback: Use template-based generation with minimal LLM customization
   */
  private async tier3Fallback(preferences: UserFitnessPreferences): Promise<WorkoutPlan> {
    try {
      console.log("ud83dudd04 [GEMINI] Attempting Tier 3 fallback with template-based generation");
      
      // Create basic workout structure based on preferences
      const weeklySchedule: WorkoutDay[] = [];
      const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const focusAreas = this.determineFocusAreas(preferences);
      
      // Ensure at least one focus area
      if (focusAreas.length === 0) {
        focusAreas.push('Full Body');
      }
      
      // Ensure we have the correct number of workout days based on frequency
      let workoutDays = [];
      for (let i = 0; i < preferences.exerciseFrequency; i++) {
        workoutDays.push(daysOfWeek[i % daysOfWeek.length]);
      }
      
      // Use the Gemini API only for generating exercises for each focus area
      const model = this.getGeminiModel();
      console.log("ud83dudcdd [GEMINI] Creating workouts for", workoutDays.length, "days");
      
      // Generate at least one day, even if frequency is set to 0
      if (workoutDays.length === 0) {
        workoutDays.push('Monday');
      }
      
      for (let i = 0; i < workoutDays.length; i++) {
        const day = workoutDays[i];
        const focusArea = focusAreas[i % focusAreas.length];
        
        // Generate exercises for this focus area
        const exercisesPrompt = `List 4 exercises appropriate for ${preferences.fitnessLevel} level ${focusArea} workout. For each exercise, provide just the name - no descriptions.`;
        
        try {
          const exercisesResponse = await model.generateContent(exercisesPrompt);
          const exercisesText = exercisesResponse.response.text();
          
          // Extract exercise names from the response
          const exerciseNames = this.extractExerciseNames(exercisesText);
          
          // Ensure we have exercises
          if (!exerciseNames || exerciseNames.length === 0) {
            throw new Error("Failed to extract exercise names");
          }
          
          // Create structured exercise objects
          const exercises: WorkoutExercise[] = exerciseNames.map(name => ({
            name: name,
            sets: this.getDefaultSets(preferences.fitnessLevel),
            reps: this.getDefaultReps(preferences.fitnessLevel),
            restSeconds: this.getDefaultRest(preferences.fitnessLevel),
            notes: "Perform with proper form"
          }));
          
          weeklySchedule.push({
            day: day,
            focus: focusArea,
            exercises: exercises
          });
        } catch (error) {
          console.log("ud83dudea8 [GEMINI] Exercise generation failed, using standard exercises for", focusArea);
          // Fallback to standard exercises if generation fails
          weeklySchedule.push({
            day: day,
            focus: focusArea,
            exercises: this.getStandardExercises(focusArea, preferences.fitnessLevel)
          });
        }
      }
      
      // Final safety check - if we still have no workout days, add a default one
      if (weeklySchedule.length === 0) {
        console.log("ud83dudcdd [GEMINI] Adding emergency fallback workout day");
        weeklySchedule.push({
          day: 'Monday',
          focus: 'Full Body',
          exercises: this.getStandardExercises('Full Body', preferences.fitnessLevel)
        });
      }
      
      // Add standard warm-up and cool-down routines
      const warmUp = [
        "5 minutes of light cardio",
        "Arm circles",
        "Leg swings",
        "Torso twists"
      ];
      
      const coolDown = [
        "Quad stretch",
        "Hamstring stretch",
        "Upper back stretch",
        "Child's pose",
        "Deep breathing"
      ];
      
      // Create a progression plan
      const progressionPlan = {
        week2: "Increase reps by 2-3 per exercise",
        week3: "Add one set to each exercise",
        week4: "Decrease rest time by 15 seconds"
      };
      
      const workoutPlan: WorkoutPlan = {
        weeklySchedule,
        warmUp,
        coolDown,
        progressionPlan
      };
      
      console.log("ud83dudc4d [GEMINI] Tier 3 fallback successful with", weeklySchedule.length, "workout days");
      return workoutPlan;
    } catch (error) {
      console.error("ud83dudeab [GEMINI] Tier 3 fallback failed:", error.message);
      throw error;
    }
  }
  
  /**
   * Tier 4 Fallback: Use pure template fallback (100% guaranteed)
   */
  private tier4Fallback(preferences: UserFitnessPreferences): WorkoutPlan {
    console.log("ud83dudd04 [GEMINI] Using Tier 4 failsafe template fallback");
    console.log("ud83dudc1f [GEMINI] Creating fully predefined workout plan with zero API calls");
    
    // Create a fully predefined workout plan based on preferences
    const weeklySchedule: WorkoutDay[] = [];
    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    // Determine appropriate workout splits based on frequency
    const workoutSplits = this.getWorkoutSplit(preferences.exerciseFrequency);
    console.log("ud83dudcdd [GEMINI] Workout split for frequency", preferences.exerciseFrequency, ":", workoutSplits);
    
    // Create workout for each day
    for (let i = 0; i < preferences.exerciseFrequency; i++) {
      const focusArea = workoutSplits[i % workoutSplits.length];
      const exercises = this.getTemplateExercises(focusArea, preferences.fitnessLevel);
      
      weeklySchedule.push({
        day: daysOfWeek[i],
        focus: focusArea,
        exercises: exercises
      });
    }
    
    // Standard warm-up routine
    const warmUp = [
      "Light cardio for 5 minutes",
      "Arm circles",
      "Leg swings",
      "Torso twists"
    ];
    
    // Standard cool-down routine
    const coolDown = [
      "Quad stretch (hold 30 seconds each leg)",
      "Hamstring stretch (hold 30 seconds each leg)",
      "Upper back stretch (hold 30 seconds)",
      "Child's pose (hold 30 seconds)",
      "Deep breathing (10 slow breaths)"
    ];
    
    // Standard progression plan
    const progressionPlan = {
      week2: "Increase repetitions by 1-2 per exercise",
      week3: "Add one more set to each exercise",
      week4: "Reduce rest time between sets by 15 seconds"
    };
    
    const workoutPlan: WorkoutPlan = {
      weeklySchedule,
      warmUp,
      coolDown,
      progressionPlan
    };
    
    console.log("ud83dudc4d [GEMINI] Tier 4 fallback successful - this is 100% reliable");
    return workoutPlan;
  }
  
  /**
   * Determine focus areas based on user preferences
   */
  private determineFocusAreas(preferences: UserFitnessPreferences): string[] {
    if (preferences.focusAreas && preferences.focusAreas.length > 0) {
      return preferences.focusAreas;
    }
    
    // Default focus areas based on frequency
    switch (preferences.exerciseFrequency) {
      case 1: return ['Full Body'];
      case 2: return ['Upper Body', 'Lower Body'];
      case 3: return ['Push', 'Pull', 'Legs'];
      case 4: return ['Chest & Triceps', 'Back & Biceps', 'Legs', 'Shoulders & Core'];
      case 5: return ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms & Core'];
      case 6: return ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core'];
      case 7: return ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Cardio'];
      default: return ['Full Body'];
    }
  }
  
  /**
   * Get workout split based on frequency
   */
  private getWorkoutSplit(frequency: number): string[] {
    switch (frequency) {
      case 1: return ['Full Body'];
      case 2: return ['Upper Body', 'Lower Body'];
      case 3: return ['Push', 'Pull', 'Legs'];
      case 4: return ['Chest & Triceps', 'Back & Biceps', 'Legs', 'Shoulders & Core'];
      case 5: return ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms & Core'];
      case 6: return ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core'];
      case 7: return ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Cardio'];
      default: return ['Full Body'];
    }
  }
  
  /**
   * Extract exercise names from text
   */
  private extractExerciseNames(text: string): string[] {
    // Try to extract exercise names from different formats
    
    // Try numbered or bulleted list format
    const listRegex = /(?:\d+\.\s*|[\*\-\u2022]\s*)([^\n]+)/g;
    const matches = [];
    let match;
    
    while ((match = listRegex.exec(text)) !== null) {
      matches.push(match[1].trim());
    }
    
    if (matches.length > 0) {
      return matches.slice(0, 4); // Limit to 4 exercises
    }
    
    // Try line-by-line format
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    if (lines.length > 0) {
      return lines.slice(0, 4); // Limit to 4 exercises
    }
    
    // Fallback to default exercises
    return [
      "Push-ups",
      "Bodyweight Squats",
      "Plank",
      "Mountain Climbers"
    ];
  }
  
  /**
   * Get default sets based on fitness level
   */
  private getDefaultSets(fitnessLevel: string): number {
    switch(fitnessLevel.toLowerCase()) {
      case 'beginner':
        return 2;
      case 'intermediate':
        return 3;
      case 'advanced':
        return 4;
      default:
        return 3;
    }
  }
  
  /**
   * Get default reps based on fitness level
   */
  private getDefaultReps(fitnessLevel: string): number {
    switch(fitnessLevel.toLowerCase()) {
      case 'beginner':
        return 8;
      case 'intermediate':
        return 10;
      case 'advanced':
        return 12;
      default:
        return 10;
    }
  }
  
  /**
   * Get default rest time in seconds based on fitness level
   */
  private getDefaultRest(fitnessLevel: string): number {
    switch(fitnessLevel.toLowerCase()) {
      case 'beginner':
        return 90;
      case 'intermediate':
        return 60;
      case 'advanced':
        return 45;
      default:
        return 60;
    }
  }
  
  /**
   * Get standard exercises for a specific focus area
   */
  private getStandardExercises(focusArea: string, fitnessLevel: string): WorkoutExercise[] {
    const sets = this.getDefaultSets(fitnessLevel);
    const reps = this.getDefaultReps(fitnessLevel);
    const rest = this.getDefaultRest(fitnessLevel);
    
    // Map of focus areas to standard exercises
    const exerciseMap: Record<string, WorkoutExercise[]> = {
      'Chest': [
        { name: "Push-ups", sets, reps, restSeconds: rest, notes: "Keep elbows at 45° angle" },
        { name: "Incline Push-ups", sets, reps, restSeconds: rest, notes: "Hands elevated on sturdy surface" },
        { name: "Decline Push-ups", sets, reps, restSeconds: rest, notes: "Feet elevated on sturdy surface" },
        { name: "Diamond Push-ups", sets, reps, restSeconds: rest, notes: "Hands close together forming diamond shape" }
      ],
      'Back': [
        { name: "Superman", sets, reps, restSeconds: rest, notes: "Lift arms and legs simultaneously" },
        { name: "Prone Y", sets, reps, restSeconds: rest, notes: "Arms extended in Y position" },
        { name: "Prone T", sets, reps, restSeconds: rest, notes: "Arms extended in T position" },
        { name: "Prone W", sets, reps, restSeconds: rest, notes: "Arms bent in W position" }
      ],
      'Legs': [
        { name: "Bodyweight Squats", sets, reps, restSeconds: rest, notes: "Keep weight in heels" },
        { name: "Walking Lunges", sets, reps, restSeconds: rest, notes: "Step forward into lunge position" },
        { name: "Glute Bridges", sets, reps, restSeconds: rest, notes: "Squeeze glutes at top of movement" },
        { name: "Calf Raises", sets, reps, restSeconds: rest, notes: "Rise onto balls of feet" }
      ],
      'Shoulders': [
        { name: "Pike Push-ups", sets, reps, restSeconds: rest, notes: "Form inverted V with body" },
        { name: "Lateral Raises", sets, reps, restSeconds: rest, notes: "Use water bottles if needed for weight" },
        { name: "Front Raises", sets, reps, restSeconds: rest, notes: "Use water bottles if needed for weight" },
        { name: "Arm Circles", sets, reps, restSeconds: rest, notes: "Small circles forward and backward" }
      ],
      'Arms': [
        { name: "Tricep Dips", sets, reps, restSeconds: rest, notes: "Use sturdy chair or bench" },
        { name: "Diamond Push-ups", sets, reps, restSeconds: rest, notes: "Hands forming diamond shape" },
        { name: "Bicep Curls", sets, reps, restSeconds: rest, notes: "Use water bottles if needed for weight" },
        { name: "Hammer Curls", sets, reps, restSeconds: rest, notes: "Use water bottles if needed for weight" }
      ],
      'Core': [
        { name: "Crunches", sets, reps, restSeconds: rest, notes: "Focus on contracting abdominals" },
        { name: "Plank", sets: sets, reps: 30, restSeconds: rest, notes: "Hold position, time in seconds" },
        { name: "Russian Twists", sets, reps, restSeconds: rest, notes: "Rotate torso side to side" },
        { name: "Mountain Climbers", sets, reps, restSeconds: rest, notes: "Bring knees to chest alternating" }
      ],
      'Cardio': [
        { name: "Jumping Jacks", sets, reps, restSeconds: rest, notes: "Full range of motion" },
        { name: "High Knees", sets, reps, restSeconds: rest, notes: "Bring knees up to waist level" },
        { name: "Burpees", sets, reps, restSeconds: rest, notes: "Modify by stepping back if needed" },
        { name: "Mountain Climbers", sets, reps, restSeconds: rest, notes: "Keep hips stable throughout" }
      ],
      'Full Body': [
        { name: "Burpees", sets, reps, restSeconds: rest, notes: "Complete movement with push-up" },
        { name: "Mountain Climbers", sets, reps, restSeconds: rest, notes: "Maintain plank position" },
        { name: "Jumping Jacks", sets, reps, restSeconds: rest, notes: "Full extension of arms and legs" },
        { name: "Plank to Push-up", sets, reps, restSeconds: rest, notes: "Alternate between forearms and hands" }
      ],
      'Upper Body': [
        { name: "Push-ups", sets, reps, restSeconds: rest, notes: "Modify on knees if needed" },
        { name: "Tricep Dips", sets, reps, restSeconds: rest, notes: "Keep elbows pointing back" },
        { name: "Superman", sets, reps, restSeconds: rest, notes: "Squeeze shoulder blades together" },
        { name: "Pike Push-ups", sets, reps, restSeconds: rest, notes: "Head points toward floor" }
      ],
      'Lower Body': [
        { name: "Bodyweight Squats", sets, reps, restSeconds: rest, notes: "Knees track over toes" },
        { name: "Lunges", sets, reps, restSeconds: rest, notes: "Alternate legs" },
        { name: "Glute Bridges", sets, reps, restSeconds: rest, notes: "Fully extend hips at top" },
        { name: "Calf Raises", sets, reps, restSeconds: rest, notes: "Full range of motion" }
      ],
      'Push': [
        { name: "Push-ups", sets, reps, restSeconds: rest, notes: "Elbows at 45° angle" },
        { name: "Decline Push-ups", sets, reps, restSeconds: rest, notes: "Feet elevated" },
        { name: "Pike Push-ups", sets, reps, restSeconds: rest, notes: "Shoulders directly over hands" },
        { name: "Tricep Dips", sets, reps, restSeconds: rest, notes: "Keep back close to bench" }
      ],
      'Pull': [
        { name: "Superman Pull", sets, reps, restSeconds: rest, notes: "Arms extended, pull back" },
        { name: "Reverse Snow Angels", sets, reps, restSeconds: rest, notes: "Keep arms off ground" },
        { name: "Door Frame Rows", sets, reps, restSeconds: rest, notes: "Pull chest to door frame" },
        { name: "Towel Rows", sets, reps, restSeconds: rest, notes: "Use towel wrapped around pole" }
      ]
    };
    
    // Handle combined focus areas
    for (const key in exerciseMap) {
      if (focusArea.includes(key)) {
        return exerciseMap[key];
      }
    }
    
    // Default exercises if no match found
    return exerciseMap['Full Body'];
  }
  
  /**
   * Get template exercises (100% reliable fallback)
   */
  private getTemplateExercises(focusArea: string, fitnessLevel: string): WorkoutExercise[] {
    return this.getStandardExercises(focusArea, fitnessLevel);
  }

  /**
   * Parse workout schedule from text to structured format
   */
  private parseSchedule(text: string): { day: string; focus: string; numExercises?: number }[] {
    try {
      // Try JSON parse first
      return JSON.parse(text);
    } catch (e) {
      console.log("Schedule parsing failed, using fallback parsing");
      
      const scheduleDays = [];
      
      // Try different parsing strategies
      const dayRegex = /([A-Za-z]+)(?:\s*:|\s*-)\s*(.+)/g;
      let match;
      
      while ((match = dayRegex.exec(text)) !== null) {
        scheduleDays.push({
          day: match[1].trim(),
          focus: match[2].trim(),
          numExercises: 4 // Default
        });
      }
      
      // Fallback if regex didn't work - look for day names
      if (scheduleDays.length === 0) {
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        
        for (const day of days) {
          if (text.includes(day)) {
            // Extract focus area - everything after the day name
            const focusStart = text.indexOf(day) + day.length;
            const focusArea = text.substring(focusStart).replace(/[:-]/g, '').trim();
            
            scheduleDays.push({
              day: day,
              focus: focusArea || 'General Fitness',
              numExercises: 4
            });
          }
        }
      }
      
      // If we still have no days, create a default schedule
      if (scheduleDays.length === 0) {
        const defaultDays = ['Monday', 'Wednesday', 'Friday'];
        const defaultFocus = ['Full Body', 'Upper Body', 'Lower Body'];
        
        for (let i = 0; i < 3; i++) {
          scheduleDays.push({
            day: defaultDays[i],
            focus: defaultFocus[i],
            numExercises: 4
          });
        }
      }
      
      return scheduleDays;
    }
  }
  
  /**
   * Parse exercises from text to structured format
   */
  private parseExercises(text: string, fitnessLevel: string = 'beginner'): any[] {
    if (!text || text.trim() === '') {
      return [];
    }
    
    try {
      // Clean up and parse JSON
      const json = parseJsonFromLLM(text);
      
      // Handle different JSON structures that might be returned
      if (Array.isArray(json)) {
        // Direct array of exercises
        return json.map(ex => {
          return {
            name: ex.name || 'Unknown Exercise',
            sets: typeof ex.sets === 'string' ? parseInt(ex.sets) || this.getDefaultSets(fitnessLevel) : (ex.sets || this.getDefaultSets(fitnessLevel)),
            reps: typeof ex.reps === 'string' ? parseInt(ex.reps) || this.getDefaultReps(fitnessLevel) : (ex.reps || this.getDefaultReps(fitnessLevel)),
            restSeconds: ex.restSeconds || this.parseRestTime(ex.rest || '60 seconds'),
            notes: ex.notes || ex.description || ''
          };
        });
      } else if (json.exercises && Array.isArray(json.exercises)) {
        // Object with exercises array
        return json.exercises.map(ex => {
          return {
            name: ex.name || 'Unknown Exercise',
            sets: typeof ex.sets === 'string' ? parseInt(ex.sets) || this.getDefaultSets(fitnessLevel) : (ex.sets || this.getDefaultSets(fitnessLevel)),
            reps: typeof ex.reps === 'string' ? parseInt(ex.reps) || this.getDefaultReps(fitnessLevel) : (ex.reps || this.getDefaultReps(fitnessLevel)),
            restSeconds: ex.restSeconds || this.parseRestTime(ex.rest || '60 seconds'),
            notes: ex.notes || ex.description || ''
          };
        });
      } else if (json.weeklySchedule && Array.isArray(json.weeklySchedule)) {
        // Get exercises from the first day in weekly schedule as fallback
        if (json.weeklySchedule[0] && Array.isArray(json.weeklySchedule[0].exercises)) {
          return json.weeklySchedule[0].exercises.map(ex => {
            return {
              name: ex.name || 'Unknown Exercise',
              sets: typeof ex.sets === 'string' ? parseInt(ex.sets) || this.getDefaultSets(fitnessLevel) : (ex.sets || this.getDefaultSets(fitnessLevel)),
              reps: typeof ex.reps === 'string' ? parseInt(ex.reps) || this.getDefaultReps(fitnessLevel) : (ex.reps || this.getDefaultReps(fitnessLevel)),
              restSeconds: ex.restSeconds || this.parseRestTime(ex.rest || '60 seconds'),
              notes: ex.notes || ex.description || ''
            };
          });
        }
      } else {
        // Try to extract any exercise-like objects as fields
        const extractedExercises = [];
        for (const key in json) {
          const value = json[key];
          // If this looks like an exercise object, include it
          if (value && typeof value === 'object' && value.name) {
            extractedExercises.push({
              name: value.name || 'Unknown Exercise',
              sets: typeof value.sets === 'string' ? parseInt(value.sets) || this.getDefaultSets(fitnessLevel) : (value.sets || this.getDefaultSets(fitnessLevel)),
              reps: typeof value.reps === 'string' ? parseInt(value.reps) || this.getDefaultReps(fitnessLevel) : (value.reps || this.getDefaultReps(fitnessLevel)),
              restSeconds: value.restSeconds || this.parseRestTime(value.rest || '60 seconds'),
              notes: value.notes || value.description || ''
            });
          }
        }
        
        if (extractedExercises.length > 0) {
          return extractedExercises;
        }
      }
      
      // Could not find any exercises in the structure, treat entries as exercise names
      if (typeof json === 'object') {
        const namesList = Object.values(json)
          .filter(val => typeof val === 'string')
          .map(name => ({
            name: name as string,
            sets: this.getDefaultSets(fitnessLevel),
            reps: this.getDefaultReps(fitnessLevel),
            restSeconds: this.getDefaultRest(fitnessLevel),
            notes: ''
          }));
          
        if (namesList.length > 0) {
          return namesList;
        }
      }
      
      return [];
    } catch (error) {
      console.error('Error parsing exercises:', error.message);
      return [];
    }
  }
  
  /**
   * Parse list from text to array of strings
   */
  private parseList(text: string): string[] {
    try {
      // Try JSON parse first
      return JSON.parse(text);
    } catch (e) {
      console.log("List parsing failed, using fallback parsing");
      
      // Split by line breaks or numbered/bulleted items
      const items = text.split(/\n|(?:\d+\.\s*)|(?:[\u2022\-*]\s*)/).map(item => item.trim()).filter(item => item.length > 0);
      
      // If unable to parse properly, provide default
      if (items.length === 0) {
        return ["Light cardio for 5 minutes", "Arm circles", "Leg swings", "Torso twists"];
      }
      
      return items;
    }
  }
  
  /**
   * Parse progression plan from text to structured format
   */
  private parseProgressionPlan(text: string): { week2: string; week3: string; week4: string } {
    if (!text || text.trim() === '') {
      return this.getDefaultProgressionPlan();
    }
    
    try {
      // Try to parse the JSON
      const json = parseJsonFromLLM(text);
      
      // Check if the JSON has the expected fields
      let hasRequiredFields = json && json.week2 && json.week3 && json.week4;
      
      if (hasRequiredFields) {
        // Return the structured plan
        return {
          week2: String(json.week2),
          week3: String(json.week3),
          week4: String(json.week4)
        };
      }
      
      // Try to extract from nested structure
      if (json && json.progressionPlan) {
        const plan = json.progressionPlan;
        if (plan.week2 && plan.week3 && plan.week4) {
          return {
            week2: String(plan.week2),
            week3: String(plan.week3),
            week4: String(plan.week4)
          };
        }
      }
      
      // If we have some but not all weeks, fill in the missing ones
      const partialPlan = { ...this.getDefaultProgressionPlan() };
      
      if (json) {
        if (json.week2) partialPlan.week2 = String(json.week2);
        if (json.week3) partialPlan.week3 = String(json.week3);
        if (json.week4) partialPlan.week4 = String(json.week4);
        
        // Try alternate property names
        if (json['Week 2']) partialPlan.week2 = String(json['Week 2']);
        if (json['Week 3']) partialPlan.week3 = String(json['Week 3']);
        if (json['Week 4']) partialPlan.week4 = String(json['Week 4']);
      }
      
      return partialPlan;
    } catch (error) {
      console.error('Error parsing progression plan:', error.message);
      return this.getDefaultProgressionPlan();
    }
  }
  
  /**
   * Get default progression plan
   */
  private getDefaultProgressionPlan(): { week2: string; week3: string; week4: string } {
    return {
      week2: "Increase repetitions by 1-2 per exercise",
      week3: "Add one more set to each exercise",
      week4: "Reduce rest time between sets by 15 seconds"
    };
  }
  
  /**
   * Parse rest time from string to seconds
   */
  private parseRestTime(restTime: string): number {
    const seconds = restTime.match(/(\d+)\s*(?:s|sec|seconds?)?/i);
    if (seconds) {
      return parseInt(seconds[1]);
    }
    
    const minutes = restTime.match(/(\d+)\s*(?:m|min|minutes?)/i);
    if (minutes) {
      return parseInt(minutes[1]) * 60;
    }
    
    // Default to 60 seconds if no valid time found
    return 60;
  }

  /**
   * Get safety settings for Gemini API
   */
  private getSafetySettings() {
    return [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
    ];
  }
}
