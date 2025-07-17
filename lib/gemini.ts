import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, SchemaType } from '@google/generative-ai';
import { GEMINI_API_KEY, GEMINI_MODEL, GEMINI_VISION_MODEL, GEMINI_API_VERSION } from '../constants/api';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { UserFitnessPreferences } from '../services/ai/workoutGenerator';
import { UserDietPreferences } from '../services/ai/mealPlanGenerator';
import { parseJsonFromLLM, extractMealPlanFromLLMResponse } from '../services/ai/jsonUtils';
import { StructuredWorkoutGenerator } from '../services/ai/structuredWorkoutGenerator';

// Define photo type
interface BodyPhoto {
  uri: string;
  type: 'front' | 'side' | 'back';
}

// Initialize the Google Generative AI with API key
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Configure safety settings
const safetySettings = [
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

// Get the Gemini models with correct API version
const textModel = genAI.getGenerativeModel({
  model: GEMINI_MODEL,
  safetySettings,
}, { apiVersion: GEMINI_API_VERSION });

const visionModel = genAI.getGenerativeModel({
  model: GEMINI_VISION_MODEL,
  safetySettings,
}, { apiVersion: GEMINI_API_VERSION });

// Helper function to sanitize text before JSON parsing
export const extractAndParseJSON = (text: string) => {
  // First try to extract JSON with a code block pattern
  let match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (!match) {
    // Try to find any JSON-like structure
    match = text.match(/(\{[\s\S]*\})/);
  }
  
  if (match && match[1]) {
    try {
      let jsonContent = match[1];
      
      // PHASE 1: Basic cleanup
      // Fix trailing commas in arrays and objects
      jsonContent = jsonContent.replace(/,\s*([\]\}])/g, '$1');
      
      // Fix missing quotes around property names
      jsonContent = jsonContent.replace(/(\{|,)\s*([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
      
      // PHASE 2: Handle workout-specific format issues
      // Fix ranges like "10-12" in numeric fields - convert to strings
      jsonContent = jsonContent.replace(/"(sets|reps)":\s*(\d+)-(\d+)/g, '"$1": "$2-$3"');
      
      // Fix "reps": 10 per leg -> "reps": "10 per leg"
      jsonContent = jsonContent.replace(/"reps":\s*(\d+)(\s+per\s+[^",\}]+)/g, '"reps": "$1$2"');
      
      // Fix "reps": AMRAP or similar text values
      jsonContent = jsonContent.replace(/"reps":\s*([A-Za-z][^",\}]*)/g, '"reps": "$1"');
      
      // Fix "reps": 10-12 per leg or similar ranges with text
      jsonContent = jsonContent.replace(/"reps":\s*(\d+)-(\d+)([^",\}]*)/g, '"reps": "$1-$2$3"');
      
      // Try parsing after cleanup
      try {
        return JSON.parse(jsonContent);
      } catch (error) {
        console.error('Initial parsing failed, trying more aggressive cleanup:', error);
        
        // PHASE 3: More aggressive cleanup for major issues
        // Strip all newlines and excess whitespace
        jsonContent = jsonContent.replace(/\s+/g, ' ').trim();
        
        // Apply all previous fixes again on the compressed string
        jsonContent = jsonContent.replace(/,\s*([\]\}])/g, '$1');
        jsonContent = jsonContent.replace(/(\{|,)\s*([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
        jsonContent = jsonContent.replace(/"(sets|reps)":\s*(\d+)-(\d+)/g, '"$1": "$2-$3"');
        jsonContent = jsonContent.replace(/"reps":\s*(\d+)(\s+per\s+[^",\}]+)/g, '"reps": "$1$2"');
        jsonContent = jsonContent.replace(/"reps":\s*([A-Za-z][^",\}]*)/g, '"reps": "$1"');
        jsonContent = jsonContent.replace(/"reps":\s*(\d+)-(\d+)([^",\}]*)/g, '"reps": "$1-$2$3"');
        
        return JSON.parse(jsonContent);
      }
    } catch (finalError) {
      console.error('All parsing attempts failed:', finalError);
      throw new Error('The AI response contained invalid JSON format');
    }
  }
  
  throw new Error('Could not extract valid JSON from AI response');
};

// Add a retry mechanism with exponential backoff and better error handling for rate limits
const makeAPICallWithRetry = async <T>(
  apiCall: () => Promise<T>,
  fallbackData: T,
  maxRetries = 2,
  initialDelay = 1000
): Promise<T> => {
  let retries = 0;
  let delay = initialDelay;
  
  while (retries <= maxRetries) {
    try {
      return await apiCall();
    } catch (error: any) {
      console.log(`API call failed (attempt ${retries + 1}/${maxRetries + 1}):`, error.message);
      
      // Check if this is a rate limit error (429)
      if (error.message && error.message.includes('429') && error.message.includes('Resource has been exhausted')) {
        if (retries < maxRetries) {
          console.log(`Rate limit hit. Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          retries++;
          delay *= 2; // Exponential backoff
          continue;
        } else {
          console.log('Max retries reached for rate limit. Using fallback data.');
          return fallbackData;
        }
      }
      
      // For JSON parsing errors or other errors, return fallback data
      if (error.message && (error.message.includes('JSON') || error.message.includes('SyntaxError'))) {
        console.error('Error parsing API response:', error.message);
        return fallbackData;
      }
      
      // For any other error, return fallback data after all retries are exhausted
      if (retries >= maxRetries) {
        console.error('Max retries reached. Using fallback data.');
        return fallbackData;
      }
      
      // Otherwise retry with backoff
      console.log(`Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      retries++;
      delay *= 2;
    }
  }
  
  // This should never be reached due to the return in the final retry attempt
  return fallbackData;
};

// Default fallback workout plan for when API calls fail
export const fallbackWorkoutPlan = {
  weeklySchedule: [
    {
      day: "Day 1", 
      focus: "Upper Body",
      exercises: [
        {
          name: "Push-ups",
          sets: 3,
          reps: 10,
          restSeconds: 60, 
          notes: "Keep your body straight and core engaged"  
        },
        {
          name: "Bodyweight Rows",
          sets: 3,
          reps: 10,
          restSeconds: 60,
          notes: "Use a table or sturdy horizontal surface"
        },
        {
          name: "Shoulder Taps",
          sets: 3,
          reps: 20,
          restSeconds: 45,
          notes: "Start in a plank position and tap opposite shoulder"
        }
      ]
    },
    {
      day: "Day 2",
      focus: "Lower Body",
      exercises: [
        {
          name: "Bodyweight Squats",
          sets: 3,
          reps: 15,
          restSeconds: 60,
          notes: "Keep your knees aligned with your toes"
        },
        {
          name: "Walking Lunges",
          sets: 3,
          reps: 10,
          restSeconds: 60,
          notes: "Take a step forward and lower your back knee toward the ground"
        },
        {
          name: "Glute Bridges",
          sets: 3,
          reps: 15,
          restSeconds: 45,
          notes: "Squeeze your glutes at the top of the movement"
        }
      ]
    },
    {
      day: "Day 3",
      focus: "Core",
      exercises: [
        {
          name: "Plank",
          sets: 3,
          reps: 30,
          restSeconds: 60,
          notes: "Hold position with a straight back for time specified"
        },
        {
          name: "Mountain Climbers",
          sets: 3,
          reps: 20,
          restSeconds: 45,
          notes: "Maintain a strong plank while bringing knees to chest"
        },
        {
          name: "Russian Twists",
          sets: 3,
          reps: 20,
          restSeconds: 45,
          notes: "Rotate your torso from side to side"
        }
      ]
    }
  ],
  warmUp: [
    "5-minute light cardio (jogging in place or jumping jacks)",
    "10 arm circles forward and backward",
    "10 hip rotations in each direction",
    "10 jumping jacks",
    "10 bodyweight squats"
  ],
  coolDown: [
    "Hamstring stretch - 30 seconds each leg",
    "Quad stretch - 30 seconds each leg",
    "Child's pose - 30 seconds",
    "Cat-cow stretch - 30 seconds",
    "Deep breathing - 5 deep breaths"
  ],
  progressionPlan: {
    week2: "Increase reps by 2 for each exercise",
    week3: "Add one more set to each exercise",
    week4: "Reduce rest time by 15 seconds between sets"
  }
};

// Default fallback meal plan for when API calls fail
const fallbackMealPlan = {
  weeklyPlan: [
    {
      day: "Monday",
      meals: [
        {
          meal: "Breakfast",
          time: "8:00 AM",
          recipe: {
            name: "Recipe Name",
            ingredients: ["Ingredient 1", "Ingredient 2"],
            instructions: ["Step 1", "Step 2"],
            nutrition: {
              calories: 300,
              protein: 20,
              carbs: 30,
              fats: 10
            }
          }
        },
        {
          meal: "Lunch",
          time: "1:00 PM",
          recipe: {
            name: "Recipe Name",
            ingredients: ["Ingredient 1", "Ingredient 2"],
            instructions: ["Step 1", "Step 2"],
            nutrition: {
              calories: 400,
              protein: 30,
              carbs: 40,
              fats: 15
            }
          }
        }
      ],
      dailyNutrition: {
        calories: 1800,
        protein: 120,
        carbs: 180,
        fats: 60
      }
    }
  ],
  shoppingList: {
    protein: ["Item 1", "Item 2"],
    produce: ["Item 1", "Item 2"],
    grains: ["Item 1", "Item 2"],
    dairy: ["Item 1", "Item 2"],
    other: ["Item 1", "Item 2"]
  },
  mealPrepTips: ["Tip 1", "Tip 2"],
  batchCookingRecommendations: ["Recommendation 1", "Recommendation 2"]
};

// Add this helper function at the top of the file
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

// Gemini API functions
const gemini = {
  /**
   * Generic content generation method that can be used by any service
   */
  generateContent: async (prompt: string): Promise<string> => {
    try {
      const result = await textModel.generateContent(prompt);
      const response = result.response;
      return response.text();
    } catch (error) {
      console.error('Error generating content with Gemini:', error);
      throw error;
    }
  },

  /**
   * Generate workout plan based on user preferences
   */
  generateWorkoutPlan: async (preferences: UserFitnessPreferences) => {
    try {
      console.log("🔄 [GEMINI] Attempting workout plan generation with reliable generator");
      
      // Import here to avoid circular dependencies
      const { reliableWorkoutGenerator } = require('../services/ai');
      
      // Use the reliable generator that tries multiple approaches in sequence
      const workoutPlan = await reliableWorkoutGenerator.generateWorkoutPlan(preferences);
      
      console.log("✅ [GEMINI] Workout plan generation successful", 
        JSON.stringify({
          weeklyScheduleDays: workoutPlan.weeklySchedule?.length || 0,
          hasWarmUp: Array.isArray(workoutPlan.warmUp) && workoutPlan.warmUp.length > 0,
          hasCoolDown: Array.isArray(workoutPlan.coolDown) && workoutPlan.coolDown.length > 0,
          hasProgressionPlan: !!workoutPlan.progressionPlan
        })
      );
      return workoutPlan;
    } catch (error) {
      console.error("❌ [GEMINI] All workout plan generation methods failed:", getErrorMessage(error));
      
      // Use the fallback plan if all generator attempts fail
      console.log("⚠️ [GEMINI] Using default fallback workout plan");
      return fallbackWorkoutPlan;
    }
  },

  /**
   * Generate workout plan with primary prompt style
   */
  generatePlanWithPrimaryPrompt: async (preferences: UserFitnessPreferences) => {
    // Use type assertion to access properties safely
    const prefs = preferences as any;

    // Example implementation:
    const prompt = `Create a personalized workout plan for a ${preferences.fitnessLevel} level person.
      They want to work out ${preferences.exerciseFrequency} days per week, focusing on ${preferences.focusAreas.join(', ')}.
      They work out at ${preferences.workoutLocation} with access to: ${preferences.availableEquipment.join(', ')}.
      Each session should be around ${preferences.timePerSession} minutes.
      ${prefs.limitations ? `They have the following limitations: ${prefs.limitations}` : ''}
      
      Return the workout plan in valid JSON format with:
      - weeklySchedule: array of workout days with day name, focus area, and exercises
      - warmUp: array of warm-up activities
      - coolDown: array of cool-down activities
      - progressionPlan: object with progression for weeks 2-4`;
    
    const result = await gemini.generateContent(prompt);
    return parseJsonFromLLM(result);
  },

  /**
   * Generate workout plan with alternative prompt style
   */
  generatePlanWithAlternativePrompt: async (preferences: UserFitnessPreferences) => {
    // Use type assertion to access properties safely
    const prefs = preferences as any;

    // Example implementation with more structured guidance:
    const prompt = `TASK: Generate a customized workout plan.
      
      USER PROFILE:
      - Fitness level: ${preferences.fitnessLevel}
      - Workout location: ${preferences.workoutLocation}
      - Available equipment: ${preferences.availableEquipment.join(', ')}
      - Exercise frequency: ${preferences.exerciseFrequency} days/week
      - Session duration: ${preferences.timePerSession} minutes
      - Focus areas: ${preferences.focusAreas.join(', ')}
      - Limitations: ${prefs.limitations || 'None'}
      
      REQUIRED OUTPUT FORMAT (JSON):
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
        "warmUp": ["Warm up activity 1", "Warm up activity 2"],
        "coolDown": ["Cool down activity 1", "Cool down activity 2"],
        "progressionPlan": {
          "week2": "Week 2 progression",
          "week3": "Week 3 progression",
          "week4": "Week 4 progression"
        }
      }
      
      IMPORTANT REQUIREMENTS:
      1. Include EXACTLY ${preferences.exerciseFrequency} workout days
      2. Only use equipment they have available
      3. Match exercises to their fitness level
      4. Keep workout duration around ${preferences.timePerSession} minutes
      5. Focus primarily on ${preferences.focusAreas.join(', ')}
      6. ONLY return valid JSON, no other text`;
    
    const result = await gemini.generateContent(prompt);
    return parseJsonFromLLM(result);
  },

  /**
   * Generate meal plan based on user preferences
   */
  generateMealPlan: async (preferences: UserDietPreferences) => {
    console.log("🥗 [GEMINI] Starting meal plan generation with preferences:", JSON.stringify(preferences));
    
    try {
      // First attempt with workout-style prompt (new approach)
      console.log("🔄 [GEMINI] Attempting workout-style meal plan generation");
      const workoutStyleResult = await gemini.generateMealPlanWithWorkoutStyle(preferences);
      console.log("✅ [GEMINI] Workout-style meal plan generation successful");
      return workoutStyleResult;
    } catch (error) {
      console.error("❌ [GEMINI] Workout-style meal plan generation failed:", getErrorMessage(error));
      
      // Second attempt with primary prompt
      try {
        console.log("🔄 [GEMINI] Attempting primary prompt meal plan generation");
        const primaryResult = await gemini.generateMealPlanWithPrimaryPrompt(preferences);
        console.log("✅ [GEMINI] Primary meal plan generation successful");
        return primaryResult;
      } catch (primaryError) {
        console.error("❌ [GEMINI] Primary meal plan generation failed:", getErrorMessage(primaryError));
        
        // Third attempt with alternative prompt
        try {
          console.log("🔄 [GEMINI] Attempting alternative prompt meal plan generation");
          const alternativeResult = await gemini.generateMealPlanWithAlternativePrompt(preferences);
          console.log("✅ [GEMINI] Alternative meal plan generation successful");
          return alternativeResult;
        } catch (alternativeError) {
          console.error("❌ [GEMINI] Alternative meal plan generation failed:", getErrorMessage(alternativeError));
          
          // Continue with existing fallback chain
          try {
            console.log("🔄 [GEMINI] Attempting simplified prompt meal plan generation");
            const simplifiedResult = await gemini.generateMealPlanWithSimplifiedPrompt(preferences);
            console.log("✅ [GEMINI] Simplified meal plan generation successful");
            return simplifiedResult;
          } catch (simplifiedError) {
            console.error("❌ [GEMINI] Simplified meal plan generation failed:", getErrorMessage(simplifiedError));
            
            // Final attempt with minimal prompt
            try {
              console.log("⚠️ [GEMINI] Attempting minimal prompt meal plan generation (emergency fallback)");
              const minimalResult = await gemini.generateMealPlanWithMinimalPrompt(preferences);
              console.log("✅ [GEMINI] Minimal meal plan generation successful");
              return minimalResult;
            } catch (minimalError) {
              console.error("❌ [GEMINI] All meal plan generation attempts failed");
              
              // If all attempts fail, return a special error object
              return {
                fallbackReason: "temporary_service_issue",
                message: "Unable to generate a meal plan at this time. Our service is experiencing temporary issues. Please try again in a few moments."
              };
            }
          }
        }
      }
    }
  },

  /**
   * Generate meal plan with primary prompt style
   */
  generateMealPlanWithPrimaryPrompt: async (preferences: UserDietPreferences) => {
    // Use the correct field names based on the UserDietPreferences interface
    const dietType = preferences.dietType || 'balanced';
    const dietPlanPreference = preferences.dietPlanPreference || 'balanced';
    const allergies = preferences.allergies || [];
    const mealFrequency = preferences.mealFrequency || 3;
    const calorieTarget = preferences.calorieTarget || 2000;
    const fitnessGoal = preferences.fitnessGoal || 'maintenance';
    const countryRegion = preferences.countryRegion || 'International';
    
    // Improved prompt with strict JSON format requirements and template-based approach
    const prompt = `You are a professional nutritionist creating a 7-day meal plan for a client.

USER PROFILE:
- Diet type: ${dietType}
- Diet plan preference: ${dietPlanPreference}
- Allergies: ${allergies.length > 0 ? allergies.join(', ') : 'None'}
- Meal frequency: ${mealFrequency} meals daily
- Daily calorie target: ${calorieTarget} calories
- Fitness goal: ${fitnessGoal}
- Country/Region: ${countryRegion}

OUTPUT INSTRUCTIONS:
1. You MUST return ONLY valid JSON with NO explanation text
2. DO NOT include markdown code blocks or triple backticks
3. DO NOT include control characters, newlines inside string values, or special characters
4. ALL string values must use DOUBLE quotes, never single quotes
5. ALL object keys must use DOUBLE quotes
6. NO trailing commas in arrays or objects
7. Meals MUST be authentic ${countryRegion} cuisine

JSON TEMPLATE (FOLLOW EXACTLY):
{
  "weeklyPlan": [
    {
      "day": "Monday",
      "meals": [
        {
          "meal": "Breakfast",
          "time": "8:00 AM",
          "recipe": {
            "name": "Recipe Name",
            "ingredients": ["ingredient 1", "ingredient 2"],
            "instructions": ["Step 1", "Step 2"],
            "nutrition": {
              "calories": 300,
              "protein": 20,
              "carbs": 30,
              "fats": 10
            }
          }
        }
      ],
      "dailyNutrition": {
        "calories": 1800,
        "protein": 120,
        "carbs": 180,
        "fats": 60
      }
    }
  ],
  "shoppingList": {
    "protein": ["Item 1", "Item 2"],
    "produce": ["Item 1", "Item 2"],
    "grains": ["Item 1", "Item 2"],
    "dairy": ["Item 1", "Item 2"],
    "other": ["Item 1", "Item 2"]
  },
  "mealPrepTips": ["Tip 1", "Tip 2"],
  "batchCookingRecommendations": ["Recommendation 1", "Recommendation 2"]
}

IMPORTANT REQUIREMENTS:
1. Include EXACTLY 7 days
2. Each day MUST have EXACTLY ${mealFrequency} meals
3. Daily calories should add up to approximately ${calorieTarget}
4. NO placeholder text - provide real, specific recipes
5. ALL recipe names MUST reflect authentic ${countryRegion} cuisine
6. ALL ingredients MUST be specific, authentic items`;
    
    try {
      const result = await gemini.generateContent(prompt);
      // Use the enhanced parser with multiple fallback mechanisms
      return extractMealPlanFromLLMResponse(result);
    } catch (error) {
      console.error("Error generating meal plan with primary prompt:", error);
      throw error;
    }
  },

  /**
   * Generate meal plan with alternative prompt style
   */
  generateMealPlanWithAlternativePrompt: async (preferences: UserDietPreferences) => {
    // Use the correct field names
    const dietType = preferences.dietType || 'balanced';
    const allergies = preferences.allergies || [];
    const mealFrequency = preferences.mealFrequency || 3;
    const calorieTarget = preferences.calorieTarget || 2000;
    const fitnessGoal = preferences.fitnessGoal || 'maintenance';
    const countryRegion = preferences.countryRegion || 'International';
    
    // NEW: Include region-specific meal examples for better results
    const regionMealExamples = getRegionalMealExamples(countryRegion, dietType);
    
    // Updated alternative prompt focused on clean JSON and cuisine authenticity
    const prompt = `AI TASK: Create a 7-day ${dietType} meal plan with ${mealFrequency} meals per day (${calorieTarget} total calories) authentic to ${countryRegion} cuisine.

MUST AVOID: ${allergies.join(', ') || 'No restrictions'}

EXAMPLE ${countryRegion.toUpperCase()} MEALS:
${regionMealExamples}

RETURN ONLY THIS JSON STRUCTURE:
{
  "weeklyPlan": [
    {
      "day": "Monday",
      "meals": [
        {
          "meal": "Breakfast",
          "time": "8:00 AM",
          "recipe": {
            "name": "SPECIFIC RECIPE NAME",
            "ingredients": ["REAL INGREDIENT 1", "REAL INGREDIENT 2"],
            "instructions": ["REAL INSTRUCTION 1", "REAL INSTRUCTION 2"],
            "nutrition": {"calories": 0, "protein": 0, "carbs": 0, "fats": 0}
          }
        }
      ],
      "dailyNutrition": {"calories": 0, "protein": 0, "carbs": 0, "fats": 0}
    }
  ],
  "shoppingList": {"protein": [], "produce": [], "grains": [], "dairy": [], "other": []},
  "mealPrepTips": ["REAL TIP 1", "REAL TIP 2"],
  "batchCookingRecommendations": ["REAL RECOMMENDATION 1", "REAL RECOMMENDATION 2"]
}

JSON RULES:
1. ONLY valid JSON - no other text
2. NO control characters
3. NO markdown code blocks
4. ALL string values in DOUBLE quotes
5. NO trailing commas
6. EXACTLY 7 days
7. EXACTLY ${mealFrequency} meals per day
8. ALL recipe names MUST be specific to ${countryRegion} cuisine
9. ALL ingredients MUST be specific, authentic items`;
    
    try {
      const result = await gemini.generateContent(prompt);
      // Use enhanced JSON processing
      return extractMealPlanFromLLMResponse(result);
    } catch (error) {
      console.error("Error generating meal plan with alternative prompt:", error);
      throw error;
    }
  },

  /**
   * Generate meal plan with a specialized fallback approach that focuses on culturally appropriate options
   */
  generateMealPlanWithSimplifiedPrompt: async (preferences: UserDietPreferences) => {
    // Simplified approach - focus purely on getting valid JSON
    const dietType = preferences.dietType || 'balanced';
    const allergies = preferences.allergies || [];
    const mealFrequency = preferences.mealFrequency || 3;
    const calorieTarget = preferences.calorieTarget || 2000;
    const countryRegion = preferences.countryRegion || 'International';
    
    // Enhanced simplified prompt with JSON format focus and specialized cultural adaptation
    const prompt = `Create a simple 7-day ${dietType} meal plan with ${mealFrequency} meals per day and ${calorieTarget} calories daily.
    
    CRITICAL: Return ONLY valid JSON in this exact format (no extra text):
    {
      "weeklyPlan": [
        {
          "day": "Monday",
          "meals": [
            {
              "meal": "Breakfast",
              "recipe": {"name": "Meal name", "ingredients": ["Item 1"], "nutrition": {"calories": 400}}
            }
          ],
          "dailyNutrition": {"calories": ${calorieTarget}}
        }
      ]
    }
    
    RULES:
    1. Output must be VALID JSON with proper syntax
    2. Include all 7 days (Monday-Sunday)
    3. Each day must have exactly ${mealFrequency} meals
    4. NO comments, NO trailing commas
    5. Avoid allergens: ${allergies.join(', ') || 'None'}
    6. Use ${countryRegion} cuisine
    7. Triple-check all JSON brackets, quotes, and commas are correct`;
    
    try {
      const result = await gemini.generateContent(prompt);
      // Use enhanced JSON processing
      return extractMealPlanFromLLMResponse(result);
    } catch (error) {
      console.error("Error generating meal plan with simplified prompt:", error);
      throw error;
    }
  },

  /**
   * Generate meal plan with minimal prompt style but explicit format requirements
   * This is the last resort when other approaches fail
   */
  generateMealPlanWithMinimalPrompt: async (preferences: UserDietPreferences) => {
    // Ultimate fallback - absolute minimal prompt focused on getting any valid JSON
    const mealFrequency = preferences.mealFrequency || 3;
    
    // Extreme minimal prompt, focused exclusively on getting valid JSON
    const prompt = `Create a 7-day meal plan with ${mealFrequency} meals per day.
    
    CRITICAL - OUTPUT ONLY VALID JSON:
    {
      "weeklyPlan": [
        {
          "day": "Day 1",
          "meals": [
            {"meal": "Breakfast", "recipe": {"name": "Simple meal", "ingredients": ["Basic ingredient"]}}
          ]
        }
      ]
    }
    
    STRICT RULES:
    1. Output ONLY the JSON above with 7 days
    2. Each day MUST have ${mealFrequency} meals
    3. No comments, no trailing commas
    4. Triple-check JSON validity before submitting
    5. No markdown, no explanations, ONLY the JSON object`;
    
    try {
      const result = await gemini.generateContent(prompt);
      // Use enhanced JSON processing with all fallback mechanisms
      return extractMealPlanFromLLMResponse(result);
    } catch (error) {
      console.error("Error generating meal plan with minimal prompt:", error);
      throw error;
    }
  },

  /**
   * Analyze body composition from multiple images
   */
  analyzeBodyComposition: async (photos: BodyPhoto[]) => {
    try {
      // Process each photo and convert to base64
      const imageParts = await Promise.all(
        photos.map(async (photo) => {
          try {
            let base64: string;

            if (Platform.OS === 'web') {
              // On web, we need a different approach since FileSystem.readAsStringAsync isn't available
              // For web, photo URIs are often already data URLs or blob URLs
              if (photo.uri.startsWith('data:image')) {
                // If it's already a data URL, extract the base64 part
                base64 = photo.uri.split(',')[1];
              } else {
                // For blob URLs or other web URLs, we need to fetch and convert
                try {
                  const response = await fetch(photo.uri);
                  const blob = await response.blob();
                  return new Promise<{ inlineData: { data: string, mimeType: string }, photoType: string } | null>((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => {
                      const dataUrl = reader.result as string;
                      const base64 = dataUrl.split(',')[1];
                      resolve({
                        inlineData: {
                          data: base64,
                          mimeType: blob.type,
                        },
                        photoType: photo.type,
                      });
                    };
                    reader.onerror = () => {
                      console.error('Error reading blob as data URL');
                      resolve(null);
                    };
                    reader.readAsDataURL(blob);
                  });
                } catch (error) {
                  console.error(`Error fetching image on web:`, error);
                  return null;
                }
              }
            } else {
              // For native platforms, use FileSystem
              base64 = await FileSystem.readAsStringAsync(photo.uri, {
                encoding: FileSystem.EncodingType.Base64,
              });
            }
            
            // If we got here with the web data URL approach, we already returned from the promise
            // This return is for the native path and data URL path
            if (base64) {
              return {
                inlineData: {
                  data: base64,
                  mimeType: 'image/jpeg', // Assuming JPEG, but could be made dynamic
                },
                photoType: photo.type,
              };
            }
            return null;
          } catch (error) {
            console.error(`Error processing photo (${photo.type}):`, error);
            return null;
          }
        })
      );

      // Filter out any null results
      const validImageParts = imageParts.filter(part => part !== null);
      
      if (validImageParts.length === 0) {
        throw new Error('No valid images could be processed');
      }

      // Create a description of the available views
      const viewsDescription = photos
        .map(photo => photo.type)
        .join(', ');

      const prompt = `
        Analyze these images of a person's body composition. 
        I have provided the following views: ${viewsDescription}.
        
        Provide a comprehensive assessment including:
        1. Estimated body fat percentage
        2. Body type classification (ectomorph, mesomorph, endomorph, or combination)
        3. Muscle distribution and development
        4. Posture analysis
        5. Body proportions assessment
        6. Recommended focus areas for training
        
        Format the response as JSON with the following structure:
        {
          "bodyFatEstimate": 18,
          "bodyType": "Mesomorph with ectomorph tendencies",
          "analysisText": "Detailed analysis of the person's physique...",
          "bodyProportions": {
            "shoulders": "Description",
            "torso": "Description",
            "arms": "Description",
            "legs": "Description"
          },
          "recommendations": [
            "Recommendation 1",
            "Recommendation 2"
          ]
        }
        
        Important: This is NOT medical advice. This is just an AI estimation to help with fitness planning.
      `;

      // Extract just the inlineData parts for the API call
      const imagePartsForAPI = validImageParts.map(part => ({
        inlineData: part.inlineData
      }));

      const result = await visionModel.generateContent([prompt, ...imagePartsForAPI]);
      const response = result.response;
      const text = response.text();
      
      try {
        return extractAndParseJSON(text);
      } catch (jsonError) {
        // If the response isn't valid JSON, return a structured error
        console.error('Error parsing JSON from AI response:', jsonError);
        return {
          error: true,
          message: 'Could not parse AI response',
          rawText: text.substring(0, 200) + '...' // Include part of the raw text for debugging
        };
      }
    } catch (error) {
      console.error('Error analyzing body composition:', error);
      throw error;
    }
  },

  /**
   * Analyze user's progress based on tracking data
   */
  analyzeProgress: async (progressData: any) => {
    try {
      // Calculate weight change
      const weightLoss = progressData.startingWeight - progressData.currentWeight;
      const weightGoalProgress = Math.abs(progressData.startingWeight - progressData.targetWeight) > 0 
        ? (Math.abs(weightLoss) / Math.abs(progressData.targetWeight - progressData.startingWeight)) * 100 
        : 0;
      
      // Calculate consistency scores
      const workoutConsistency = progressData.workoutCompletionRate;
      const dietConsistency = progressData.dietAdherenceRate;
      const overallConsistency = (workoutConsistency + dietConsistency) / 2;
      
      // Determine progress rate
      let progressRate;
      if (overallConsistency >= 80) {
        progressRate = "Excellent";
      } else if (overallConsistency >= 60) {
        progressRate = "Good";
      } else if (overallConsistency >= 40) {
        progressRate = "Fair";
      } else {
        progressRate = "Needs improvement";
      }
      
      // Calculate estimated time to goal
      const weeklyRate = progressData.weeksActive > 0 ? Math.abs(weightLoss) / progressData.weeksActive : 0;
      const remainingWeight = Math.abs(progressData.currentWeight - progressData.targetWeight);
      const estimatedWeeksToGoal = weeklyRate > 0 ? Math.ceil(remainingWeight / weeklyRate) : "Unknown";
      
      // Generate recommendations based on data
      const recommendations = [];
      
      if (workoutConsistency < 70) {
        recommendations.push("Consider scheduling workouts at consistent times to improve adherence");
      }
      
      if (dietConsistency < 70) {
        recommendations.push("Meal planning and preparation may help improve diet consistency");
      }
      
      // If weight loss is the goal but progress is slow despite good consistency
      if (progressData.fitnessGoal.toLowerCase().includes("weight loss") && 
          weightGoalProgress < 30 && 
          overallConsistency > 70 && 
          progressData.weeksActive > 4) {
        recommendations.push("Consider adjusting your calorie intake or increasing workout intensity");
      }
      
      // If weight gain is the goal but progress is slow despite good consistency
      if (progressData.fitnessGoal.toLowerCase().includes("weight gain") && 
          weightGoalProgress < 30 && 
          overallConsistency > 70 && 
          progressData.weeksActive > 4) {
        recommendations.push("Consider increasing your calorie intake and focusing on strength training");
      }
      
      // Add recommendation based on recent challenges if provided
      if (progressData.recentChallenges && progressData.recentChallenges.trim().length > 0) {
        recommendations.push("Focus on addressing your recent challenges: finding strategies to overcome them will accelerate your progress");
      }
      
      // Provide a general recommendation if none have been added
      if (recommendations.length === 0) {
        recommendations.push("Continue with your current program - you're on track to reach your goals");
      }
      
      return {
        summary: {
          progressRate,
          weightChange: weightLoss.toFixed(1),
          weightGoalProgress: `${Math.min(100, Math.round(weightGoalProgress))}%`,
          overallConsistency: `${overallConsistency.toFixed(1)}%`,
          estimatedTimeToGoal: typeof estimatedWeeksToGoal === 'number' 
            ? `${estimatedWeeksToGoal} weeks` 
            : estimatedWeeksToGoal
        },
        details: {
          workoutConsistency: `${workoutConsistency}%`,
          dietConsistency: `${dietConsistency}%`,
          weeklyProgressRate: weeklyRate > 0 ? `${weeklyRate.toFixed(2)} kg per week` : "Not enough data",
        },
        recommendations
      };
    } catch (error) {
      console.error('Error analyzing progress:', error);
      throw error;
    }
  },

  /**
   * Generate motivational quote based on user's progress
   */
  generateMotivationalQuote: async (userProgress: any) => {
    const prompt = `
      Generate an inspirational fitness quote for a user with the following progress:
      - Fitness goal: ${userProgress.fitnessGoal}
      - Weeks active: ${userProgress.weeksActive}
      - Recent milestone: ${userProgress.recentMilestone || 'None'}
      - Current mood: ${userProgress.mood || 'Neutral'}
      
      The quote should be motivational, positive, and specific to their situation.
      Format the response as JSON: { "quote": "The quote text", "author": "Author name" }
    `;

    try {
      return await makeAPICallWithRetry(
        async () => {
          const result = await textModel.generateContent(prompt);
          const response = result.response;
          const text = response.text();
          return extractAndParseJSON(text);
        },
        { quote: "The best project you'll ever work on is you.", author: "Unknown" }
      );
    } catch (error) {
      console.error('Error generating motivational quote:', error);
      return { quote: "The best project you'll ever work on is you.", author: "Unknown" };
    }
  },

  /**
   * Generate fitness tip based on user's profile
   */
  generateFitnessTip: async (userProfile: any) => {
    const prompt = `
      Generate a personalized fitness tip for a user with the following profile:
      - Fitness level: ${userProfile.fitnessLevel}
      - Fitness goal: ${userProfile.fitnessGoal}
      - Workout focus: ${userProfile.workoutFocus || 'General fitness'}
      - Recent challenges: ${userProfile.recentChallenges || 'None mentioned'}
      
      Provide a specific, actionable tip that is grounded in exercise science.
      Format the response as JSON: { "tip": "The tip text", "category": "Category like Nutrition/Recovery/Exercise Form" }
    `;

    try {
      return await makeAPICallWithRetry(
        async () => {
          const result = await textModel.generateContent(prompt);
          const response = result.response;
          const text = response.text();
          return extractAndParseJSON(text);
        },
        { tip: "Stay hydrated by drinking plenty of water throughout the day.", category: "General Fitness" }
      );
    } catch (error) {
      console.error('Error generating fitness tip:', error);
      return { tip: "Stay hydrated by drinking plenty of water throughout the day.", category: "General Fitness" };
    }
  },
  /**
   * Export the normalizeToUIFormat function so it can be used by other modules
   */
  normalizeToUIFormat: (plan: any): any => {
    return normalizeToUIFormat(plan);
  },

  /**
   * Generate meal plan with workout-style prompt
   * This follows the successful pattern from the workout generator
   */
  generateMealPlanWithWorkoutStyle: async (preferences: UserDietPreferences) => {
    try {
      // Create a simple prompt that works well with the model
      const prompt = createWorkoutStyleMealPlanPrompt(preferences);
      
      // Get response from Gemini
      const model = getGeminiProModel();
      const result = await model.generateContent(prompt);
      let text = "";
      
      // Handle response based on its type using 'any' type casting
      if (typeof result === 'string') {
        text = result;
      } else if (result) {
        const anyResult = result as any;
        // For newer Gemini SDK
        if (anyResult.response && typeof anyResult.response.text === 'function') {
          text = anyResult.response.text();
        } 
        // For older Gemini SDK
        else if (typeof anyResult.text === 'function') {
          text = anyResult.text();
        }
        // Last resort - stringify the object
        else {
          console.log("⚠️ [GEMINI] Unknown response format:", result);
          text = JSON.stringify(result);
        }
      } else {
        console.log("⚠️ [GEMINI] Unknown response format:", result);
        text = JSON.stringify(result);
      }
      
      console.log("🔍 [GEMINI] Raw workout-style response:\n", text.substring(0, 200) + "...");
      
      // Parse the response to JSON
      const plan = parseJsonFromLLM(text);
      
      // Use the determineFormat method directly since it's defined as part of the object
      const format = gemini.determineFormat(plan);
      
      console.log("📊 [GEMINI] Parsed plan structure:", 
        JSON.stringify({
          format: format,
          days: plan.weeklyPlan?.length || plan.days?.length || (plan.day ? 1 : 0),
          sampleMeal: plan.weeklyPlan?.[0]?.meals?.[0]?.recipe?.name || 
                    plan.days?.[0]?.meals?.[0]?.recipe?.name ||
                    plan.meals?.[0]?.recipe?.name || "No meals found"
        })
      );
      
      return plan;
    } catch (error) {
      console.error("❌ [GEMINI] Error in workout-style meal plan generation:", error);
      throw error;
    }
  },

  // Determine the format of the meal plan
  determineFormat: (plan: any): string => {
    // Log the plan keys to help debug
    console.log("🔑 [GEMINI] Plan keys:", Object.keys(plan));
    
    if (plan.weeklyPlan && Array.isArray(plan.weeklyPlan)) {
      return "WeeklyPlan";
    } else if (plan.days && Array.isArray(plan.days)) {
      return "Days";
    } else if (plan.day && plan.meals) {
      return "SingleDay";
    } else if (plan.meals && Array.isArray(plan.meals)) {
      return "MealsOnly";
    } else {
      // Check if we've got a different format with days directly at top level
      const possibleDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      const planKeys = Object.keys(plan).map(k => k.toLowerCase());
      
      if (possibleDays.some(day => planKeys.includes(day.toLowerCase()))) {
        return "DaysAsKeys";
      }
      
      return "Unknown";
    }
  },
};

// Add this helper function to normalize meal plans to UI format
/**
 * Ensure that the meal plan has complete and consistent structure
 * This verifies the UI format is correct and fixes any missing elements
 */
function ensureCompleteUIFormat(plan: any): any {
  // Deep clone to avoid modifying the original
  const processedPlan = {
    id: plan.id || 'generated_meal_plan',
    weeklyPlan: [],
    shoppingList: {
      protein: [],
      produce: [],
      grains: [],
      dairy: [],
      other: []
    },
    mealPrepTips: Array.isArray(plan.mealPrepTips) ? plan.mealPrepTips : [],
    batchCookingRecommendations: Array.isArray(plan.batchCookingRecommendations) ? plan.batchCookingRecommendations : []
  };
  
  // Check if weeklyPlan exists and is an array
  if (!plan.weeklyPlan || !Array.isArray(plan.weeklyPlan)) {
    console.warn("⚠️ [GEMINI] Invalid meal plan structure: weeklyPlan missing or not an array");
    // Will create a complete weeklyPlan below
  } else {
    // Handle abnormally large weeklyPlan arrays (log shows 303 days in one case)
    if (plan.weeklyPlan.length > 7) {
      console.warn(`⚠️ [GEMINI] Abnormal weeklyPlan length (${plan.weeklyPlan.length}), truncating to 7 days`);
      plan.weeklyPlan = plan.weeklyPlan.slice(0, 7);
    }
  }
  
  // Day names for a complete week
  const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  
  // Map the existing days if available
  const existingDays = new Map();
  if (plan.weeklyPlan && Array.isArray(plan.weeklyPlan)) {
    plan.weeklyPlan.forEach((day: any, index: number) => {
      if (day && typeof day === 'object') {
        // Try to normalize the day name or use the index to assign a day
        const dayName = day.day ? normalizeDayName(day.day) : dayNames[index % 7].toLowerCase();
        existingDays.set(dayName, day);
      }
    });
  }
  
  // Create a complete 7-day plan
  for (let i = 0; i < 7; i++) {
    const dayName = dayNames[i];
    const normalizedDayName = dayName.toLowerCase();
    const existingDay = existingDays.get(normalizedDayName);
    
    // Use existing day or create a new one
    let dayData: any = {
      day: dayName,
      meals: [],
      dailyNutrition: { calories: 0, protein: 0, carbs: 0, fats: 0 }
    };
    
    if (existingDay) {
      // Copy properties from existing day
      dayData.day = existingDay.day || dayName;
      dayData.meals = Array.isArray(existingDay.meals) ? existingDay.meals : [];
      dayData.dailyNutrition = existingDay.dailyNutrition || existingDay.totalNutrition || 
                             { calories: 0, protein: 0, carbs: 0, fats: 0 };
    }
    
    // Ensure each day has at least 3 meals
    if (dayData.meals.length < 3) {
      // Default meal names and times
      const defaultMeals = [
        { name: "Breakfast", time: "8:00 AM" },
        { name: "Lunch", time: "12:30 PM" },
        { name: "Dinner", time: "7:00 PM" }
      ];
      
      // Add missing meals
      for (let j = dayData.meals.length; j < 3; j++) {
        const defaultMeal = defaultMeals[j];
        dayData.meals.push({
          meal: defaultMeal.name,
          time: defaultMeal.time,
          recipe: {
            name: `Sample ${defaultMeal.name}`,
            ingredients: ["Ingredient 1", "Ingredient 2"],
            instructions: ["Step 1", "Step 2"],
            nutrition: {
              calories: 0,
              protein: 0,
              carbs: 0,
              fats: 0
            }
          }
        });
      }
    }
    
    // Normalize each meal to ensure consistent structure
    dayData.meals = dayData.meals.map((meal: any) => {
      if (!meal || typeof meal !== 'object') {
        return createDefaultMeal("Meal");
      }
      
      return {
        meal: meal.meal || meal.name || "Meal",
        time: meal.time || getMealTimeByName(meal.meal || meal.name || "Meal"),
        recipe: {
          name: meal.recipe?.name || meal.name || "Recipe",
          ingredients: Array.isArray(meal.recipe?.ingredients) ? meal.recipe.ingredients : 
                    Array.isArray(meal.ingredients) ? meal.ingredients : ["Ingredients not specified"],
          instructions: Array.isArray(meal.recipe?.instructions) ? meal.recipe.instructions :
                      Array.isArray(meal.recipe?.preparation) ? meal.recipe.preparation :
                      Array.isArray(meal.preparation) ? meal.preparation : ["Instructions not provided"],
          nutrition: meal.recipe?.nutrition || meal.recipe?.nutritionInfo || meal.nutrition || 
                    { calories: 0, protein: 0, carbs: 0, fats: 0 }
        }
      };
    });
    
    // Add the processed day to the weeklyPlan
    processedPlan.weeklyPlan.push(dayData);
  }
  
  // Copy shopping list data if available
  if (plan.shoppingList && typeof plan.shoppingList === 'object') {
    // Copy each category
    Object.entries(plan.shoppingList).forEach(([key, value]) => {
      if (Array.isArray(value) && key in processedPlan.shoppingList) {
        processedPlan.shoppingList[key] = value;
      }
    });
  }
  
  console.log(`✅ [GEMINI] Meal plan structure normalized: ${processedPlan.weeklyPlan.length} days, each with ${processedPlan.weeklyPlan[0].meals.length} meals`);
  return processedPlan;
}

/**
 * Helper function to normalize day names for matching
 */
function normalizeDayName(dayName: string): string {
  if (!dayName) return '';
  
  const name = dayName.toLowerCase().trim();
  
  // Handle numeric days like "Day 1"
  if (name.includes('day 1') || name.includes('day1')) return 'monday';
  if (name.includes('day 2') || name.includes('day2')) return 'tuesday';
  if (name.includes('day 3') || name.includes('day3')) return 'wednesday';
  if (name.includes('day 4') || name.includes('day4')) return 'thursday';
  if (name.includes('day 5') || name.includes('day5')) return 'friday';
  if (name.includes('day 6') || name.includes('day6')) return 'saturday';
  if (name.includes('day 7') || name.includes('day7')) return 'sunday';
  
  // Handle abbreviated day names
  if (name.startsWith('mon')) return 'monday';
  if (name.startsWith('tue')) return 'tuesday';
  if (name.startsWith('wed')) return 'wednesday';
  if (name.startsWith('thu')) return 'thursday';
  if (name.startsWith('fri')) return 'friday';
  if (name.startsWith('sat')) return 'saturday';
  if (name.startsWith('sun')) return 'sunday';
  
  return name;
}

/**
 * Create a default meal with placeholder content
 */
function createDefaultMeal(mealName: string, mealTime?: string): any {
  return {
    meal: mealName,
    time: mealTime || getMealTimeByName(mealName),
    recipe: {
      name: `Sample ${mealName}`,
      ingredients: ["Ingredient 1", "Ingredient 2"],
      instructions: ["Step 1", "Step 2"],
      nutrition: {
        calories: 0,
        protein: 0,
        carbs: 0,
        fats: 0
      }
    }
  };
}

/**
 * Get appropriate time for a meal based on its name
 */
function getMealTimeByName(mealName: string): string {
  const name = (mealName || '').toLowerCase();
  
  if (name.includes('breakfast')) return '8:00 AM';
  if (name.includes('lunch')) return '12:30 PM';
  if (name.includes('dinner')) return '7:00 PM';
  if (name.includes('snack') && name.includes('morning')) return '10:30 AM';
  if (name.includes('snack') && name.includes('afternoon')) return '3:30 PM';
  if (name.includes('snack') && name.includes('evening')) return '9:00 PM';
  if (name.includes('snack')) return '3:30 PM';
  
  // Default time
  return '12:00 PM';
}

/**
 * Get examples of regional meals based on country/region and diet type
 * This helps guide the AI to produce more authentic regional cuisine
 */
function getRegionalMealExamples(region: string, dietType: string): string {
  const regionLower = region.toLowerCase();
  const examples: Record<string, Record<string, string>> = {
    'india': {
      'vegetarian': `Breakfast: Masala Dosa with Coconut Chutney, Vegetable Upma, Aloo Paratha
Lunch: Chole Bhature, Rajma Chawal, Vegetable Biryani
Dinner: Palak Paneer with Roti, Baingan Bharta with Naan, Dal Makhani with Rice`,
      'vegan': `Breakfast: Poha with Peanuts, Ragi Dosa, Vegetable Daliya
Lunch: Aloo Gobi with Roti, Chana Masala with Rice, Vegetable Pulao
Dinner: Mixed Vegetable Sabzi with Phulka, Mushroom Curry with Rice, Dal Fry with Roti`,
      'non-vegetarian': `Breakfast: Keema Paratha, Egg Bhurji with Pav, Chicken Kathi Roll
Lunch: Butter Chicken with Naan, Mutton Biryani, Fish Curry with Rice
Dinner: Tandoori Chicken with Roomali Roti, Lamb Korma with Paratha, Chicken Tikka Masala with Rice`
    },
    'china': {
      'vegetarian': `Breakfast: Congee with Century Egg, Scallion Pancakes, Steamed Vegetable Buns
Lunch: Vegetable Mapo Tofu, Buddha's Delight, Eggplant in Garlic Sauce
Dinner: Vegetable Hot Pot, Stir-fried Greens with Garlic, Vegetable Dumplings`,
      'vegan': `Breakfast: Soy Milk with Youtiao, Steamed Rice Rolls, Vegetable Jianbing
Lunch: Stir-fried Tofu with Mixed Vegetables, Vegan Kung Pao Mushrooms, Braised Tofu
Dinner: Garlic Eggplant, Stir-fried Green Beans, Vegetable Spring Rolls`,
      'non-vegetarian': `Breakfast: Pork Baozi, Beef Noodle Soup, Chicken Congee
Lunch: Kung Pao Chicken, Sweet and Sour Pork, Beef with Broccoli
Dinner: Peking Duck, Sichuan Spicy Fish, Steamed Chicken with Mushrooms`
    },
    'mediterranean': {
      'vegetarian': `Breakfast: Greek Yogurt with Honey and Nuts, Shakshuka, Tomato Toast with Olive Oil
Lunch: Greek Salad with Feta, Falafel Wrap, Spanakopita
Dinner: Pasta Primavera, Eggplant Moussaka, Vegetable Paella`,
      'vegan': `Breakfast: Avocado Toast with Tomatoes, Mushroom and Olive Bruschetta, Fruit and Nut Couscous
Lunch: Hummus Platter with Pita, Lentil Soup, Tabbouleh Salad
Dinner: Pasta with Tomato and Basil, Stuffed Vine Leaves, Vegetable Tagine`,
      'non-vegetarian': `Breakfast: Eggs with Chorizo, Smoked Salmon Bagel, Prosciutto and Cheese Plate
Lunch: Chicken Gyro, Seafood Risotto, Lamb Kebab Wrap
Dinner: Grilled Fish with Herbs, Chicken Tagine, Lamb Moussaka`
    }
  };
  
  // Default to international if region not found
  if (!examples[regionLower]) {
    return `Breakfast: Oatmeal with Fruits, Vegetable Omelet, Whole Grain Toast with Avocado
Lunch: Mixed Greens Salad with Protein, Vegetable Soup with Bread, Grain Bowl with Vegetables
Dinner: Grilled Protein with Roasted Vegetables, Stir-fry with Rice, Pasta with Sauce and Vegetables`;
  }
  
  // Default to balanced if diet type not found
  const dietLower = dietType.toLowerCase();
  if (!examples[regionLower][dietLower]) {
    return examples[regionLower]['vegetarian']; // Default to vegetarian examples
  }
  
  return examples[regionLower][dietLower];
}

/**
 * Normalize meal plan to UI format
 * Converts API format (dailyMealPlan) to UI format (weeklyPlan) if needed
 */
function normalizeToUIFormat(plan: any): any {
  // If plan is null or undefined, return fallback
  if (!plan) {
    console.log("⚠️ [GEMINI] Plan is null or undefined, using fallback");
    return fallbackMealPlan;
  }
  
  // If already in UI format with weeklyPlan, return as is
  if (plan.weeklyPlan && Array.isArray(plan.weeklyPlan) && plan.weeklyPlan.length > 0) {
    console.log("ℹ️ [GEMINI] Plan already in UI format, no conversion needed");
    return ensureCompleteUIFormat(plan);
  }
  
  // If in API format with dailyMealPlan, convert to UI format
  if (plan.dailyMealPlan && Array.isArray(plan.dailyMealPlan) && plan.dailyMealPlan.length > 0) {
    console.log("ℹ️ [GEMINI] Converting from API format to UI format");
    
    // Create UI format plan
    const uiPlan = {
      id: 'generated_meal_plan',
      weeklyPlan: plan.dailyMealPlan.map((day: any) => ({
        day: day.day || "Unknown Day",
        meals: Array.isArray(day.meals) ? day.meals : [],
        dailyNutrition: day.totalNutrition || { calories: 0, protein: 0, carbs: 0, fats: 0 }
      })),
      shoppingList: {
        protein: [],
        produce: [],
        grains: [],
        dairy: [],
        other: []
      },
      mealPrepTips: Array.isArray(plan.mealPrepTips) ? plan.mealPrepTips : [],
      batchCookingRecommendations: []
    };
    
    // Convert shopping list if available
    if (Array.isArray(plan.shoppingList)) {
      plan.shoppingList.forEach((category: any) => {
        if (category && typeof category === 'object') {
          // Handle category format with category and items properties
          if (category.category && Array.isArray(category.items)) {
            const categoryName = category.category.toLowerCase();
            if (categoryName.includes('protein')) {
              uiPlan.shoppingList.protein = category.items;
            } else if (categoryName.includes('produce') || categoryName.includes('vegetable') || categoryName.includes('fruit')) {
              uiPlan.shoppingList.produce = category.items;
            } else if (categoryName.includes('grain') || categoryName.includes('bread')) {
              uiPlan.shoppingList.grains = category.items;
            } else if (categoryName.includes('dairy')) {
              uiPlan.shoppingList.dairy = category.items;
            } else {
              uiPlan.shoppingList.other = uiPlan.shoppingList.other.concat(category.items);
            }
          }
        }
      });
    }
    
    return uiPlan;
  }
  
  // Check for alternate format - sometimes we get a direct array of days
  if (Array.isArray(plan) && plan.length > 0) {
    console.log("ℹ️ [GEMINI] Found array format, trying to convert to UI format");
    
    // Attempt to treat as array of days
    const days = plan.filter(item => item && typeof item === 'object' && (item.day || item.meals));
    
    if (days.length > 0) {
      const uiPlan = {
        id: 'generated_meal_plan',
        weeklyPlan: days.map((day: any) => ({
          day: day.day || "Unknown Day",
          meals: Array.isArray(day.meals) ? day.meals : [],
          dailyNutrition: day.totalNutrition || day.dailyNutrition || { calories: 0, protein: 0, carbs: 0, fats: 0 }
        })),
        shoppingList: {
          protein: [],
          produce: [],
          grains: [],
          dairy: [],
          other: []
        },
        mealPrepTips: [],
        batchCookingRecommendations: []
      };
      
      return uiPlan;
    }
  }
  
  // If neither format is valid, use fallback
  console.log("⚠️ [GEMINI] Could not determine plan format, using fallback");
  return fallbackMealPlan;
}

// Helper function to get the Gemini Pro model
const getGeminiProModel = () => {
  return gemini;
};

// Create a workout-style meal plan prompt
const createWorkoutStyleMealPlanPrompt = (preferences: UserDietPreferences): string => {
  // Extract preferences with proper fallbacks
  const dietType = preferences.dietType || 'balanced';
  const allergies = preferences.allergies || [];
  const mealFrequency = preferences.mealFrequency || 3;
  const calorieTarget = preferences.calorieTarget || 2000;
  const countryRegion = preferences.countryRegion || 'international';
  const restrictions = preferences.restrictions || [];
  const excludedFoods = preferences.excludedFoods || [];
  
  // Create a prompt similar to the workout generator's style but with more emphasis on authenticity
  return `Create a personalized 7-day meal plan for a ${dietType} diet.
  User wants ${mealFrequency} meals per day with a total of ${calorieTarget} calories.
  Their preferred cuisine is ${countryRegion}.
  ${allergies.length > 0 ? `Avoid these allergens: ${allergies.join(', ')}.` : ''}
  ${restrictions.length > 0 ? `Follow these dietary restrictions: ${restrictions.join(', ')}.` : ''}
  ${excludedFoods.length > 0 ? `Exclude these foods: ${excludedFoods.join(', ')}.` : ''}
  
  IMPORTANT: You MUST provide REAL, AUTHENTIC ${countryRegion.toUpperCase()} RECIPES with SPECIFIC recipe names and ingredients. DO NOT use placeholders or generic recipe names.
  
  Return the meal plan in this exact JSON format:

  {
    "weeklyPlan": [
      {
        "day": "Monday",
        "meals": [
          {
            "meal": "Breakfast",
            "time": "8:00 AM",
            "recipe": {
              "name": "SPECIFIC AUTHENTIC RECIPE NAME",
              "ingredients": ["REAL INGREDIENT 1", "REAL INGREDIENT 2"],
              "instructions": ["SPECIFIC STEP 1", "SPECIFIC STEP 2"],
              "nutrition": {"calories": 300, "protein": 20, "carbs": 30, "fats": 10}
            }
          }
        ],
        "dailyNutrition": {"calories": 2000, "protein": 100, "carbs": 250, "fats": 70}
      }
    ],
    "shoppingList": {
      "protein": ["REAL PROTEIN ITEM 1", "REAL PROTEIN ITEM 2"],
      "produce": ["REAL PRODUCE ITEM 1", "REAL PRODUCE ITEM 2"],
      "grains": ["REAL GRAIN ITEM 1", "REAL GRAIN ITEM 2"],
      "dairy": ["REAL DAIRY ITEM 1", "REAL DAIRY ITEM 2"],
      "other": ["REAL OTHER ITEM 1", "REAL OTHER ITEM 2"]
    }
  }

  CRITICAL GUIDELINES:
  1. Include EXACTLY 7 days (Monday-Sunday)
  2. Each day MUST have EXACTLY ${mealFrequency} meals
  3. Daily calories should total approximately ${calorieTarget}
  4. Return ONLY the JSON object, no explanations or other text
  5. All recipe names MUST be specific, authentic dishes from ${countryRegion} cuisine (e.g., "Palak Paneer" not "Spinach Curry")
  6. All ingredients MUST be specific, real ingredients (e.g., "2 tbsp ghee" not "cooking fat")
  7. All instructions MUST be specific, detailed steps
  8. DO NOT use placeholder text like "Recipe Name", "Ingredient 1", or "Step 1"
  9. DO NOT use generic names like "Healthy Breakfast" or "Nutritious Lunch"
  10. Give FULL, DETAILED recipes with SPECIFIC instructions and ingredients`;
};

export default gemini;
