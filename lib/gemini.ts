import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { GEMINI_API_KEY, GEMINI_MODEL, GEMINI_VISION_MODEL, GEMINI_API_VERSION } from '../constants/api';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { UserFitnessPreferences } from '../services/ai/workoutGenerator';
import { UserDietPreferences } from '../services/ai/mealPlanGenerator';
import { parseJsonFromLLM } from '../services/ai/jsonUtils';

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
const extractAndParseJSON = (text: string) => {
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
const fallbackWorkoutPlan = {
  weeklySchedule: [
    {
      day: 1,
      focus: "Upper Body",
      exercises: [
        {
          name: "Push-ups",
          sets: 3,
          reps: 10,
          restSeconds: 60,
          alternatives: ["Wall Push-ups", "Knee Push-ups"]
        }
      ]
    }
  ],
  warmUp: ["Exercise 1", "Exercise 2"],
  coolDown: ["Stretch 1", "Stretch 2"],
  progressionPlan: {
    week2: "Description",
    week3: "Description",
    week4: "Description"
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
    // Try primary generation first
    try {
      console.log("🔄 [GEMINI] Attempting primary workout plan generation");
      const primaryResult = await gemini.generatePlanWithPrimaryPrompt(preferences);
      console.log("✅ [GEMINI] Primary workout plan generation successful");
      return primaryResult;
    } catch (error) {
      console.error("❌ [GEMINI] Primary workout plan generation failed:", error.message);
      
      // If primary generation fails, try with alternative prompt style
      try {
        console.log("🔄 [GEMINI] Attempting alternative prompt workout generation");
        const alternativeResult = await gemini.generatePlanWithAlternativePrompt(preferences);
        console.log("✅ [GEMINI] Alternative workout plan generation successful");
        return alternativeResult;
      } catch (alternativeError) {
        console.error("❌ [GEMINI] Alternative workout plan generation failed:", alternativeError.message);
        
        // If both attempts fail, use the fallback system
        throw new Error(`Failed to generate workout plan: ${error.message}`);
      }
    }
  },

  /**
   * Generate workout plan with primary prompt style
   */
  generatePlanWithPrimaryPrompt: async (preferences: UserFitnessPreferences) => {
    // Example implementation:
    const prompt = `Create a personalized workout plan for a ${preferences.fitnessLevel} level person.
      They want to work out ${preferences.exerciseFrequency} days per week, focusing on ${preferences.focusAreas.join(', ')}.
      They work out at ${preferences.workoutLocation} with access to: ${preferences.availableEquipment.join(', ')}.
      Each session should be around ${preferences.timePerSession} minutes.
      ${preferences.injuries ? `They have the following limitations/injuries: ${preferences.injuries}` : ''}
      
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
    // Example implementation with more structured guidance:
    const prompt = `TASK: Generate a customized workout plan.
      
      USER PROFILE:
      - Fitness level: ${preferences.fitnessLevel}
      - Workout location: ${preferences.workoutLocation}
      - Available equipment: ${preferences.availableEquipment.join(', ')}
      - Exercise frequency: ${preferences.exerciseFrequency} days/week
      - Session duration: ${preferences.timePerSession} minutes
      - Focus areas: ${preferences.focusAreas.join(', ')}
      - Limitations: ${preferences.injuries || 'None'}
      
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
      
      IMPORTANT: 
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
    // Try primary generation first
    try {
      console.log("🔄 [GEMINI] Attempting primary meal plan generation");
      const primaryResult = await gemini.generateMealPlanWithPrimaryPrompt(preferences);
      console.log("✅ [GEMINI] Primary meal plan generation successful");
      return primaryResult;
    } catch (error) {
      console.error("❌ [GEMINI] Primary meal plan generation failed:", error.message);
      
      // If primary generation fails, try with alternative prompt style
      try {
        console.log("🔄 [GEMINI] Attempting alternative prompt meal plan generation");
        const alternativeResult = await gemini.generateMealPlanWithAlternativePrompt(preferences);
        console.log("✅ [GEMINI] Alternative meal plan generation successful");
        return alternativeResult;
      } catch (alternativeError) {
        console.error("❌ [GEMINI] Alternative meal plan generation failed:", alternativeError.message);
        
        // If both attempts fail, use the fallback system
        throw new Error(`Failed to generate meal plan: ${error.message}`);
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
    
    // Implementation with proper references
    const prompt = `Create a personalized meal plan for someone with the following preferences:
      - Diet type: ${dietType}
      - Diet plan preference: ${dietPlanPreference}
      - Allergies: ${allergies.join(', ') || 'None'}
      - Meals per day: ${mealFrequency}
      - Calorie target: ${calorieTarget}
      - Fitness goal: ${fitnessGoal}
      
      Return the meal plan in valid JSON format.`;
    
    const result = await gemini.generateContent(prompt);
    return parseJsonFromLLM(result);
  },

  /**
   * Generate meal plan with alternative prompt style
   */
  generateMealPlanWithAlternativePrompt: async (preferences: UserDietPreferences) => {
    // Use the correct field names based on the UserDietPreferences interface
    const dietType = preferences.dietType || 'balanced';
    const dietPlanPreference = preferences.dietPlanPreference || 'balanced';
    const allergies = preferences.allergies || [];
    const mealFrequency = preferences.mealFrequency || 3;
    const calorieTarget = preferences.calorieTarget || 2000;
    const fitnessGoal = preferences.fitnessGoal || 'maintenance';
    const countryRegion = preferences.countryRegion || 'International';
    
    // Alternative prompt style for meal plan generation
    const prompt = `TASK: Generate a customized meal plan.
      
      USER DIETARY PROFILE:
      - Diet type: ${dietType}
      - Diet plan preference: ${dietPlanPreference}
      - Allergies: ${allergies.join(', ') || 'None'}
      - Number of meals: ${mealFrequency} per day
      - Daily calorie target: ${calorieTarget} calories
      - Fitness goal: ${fitnessGoal}
      - Region: ${countryRegion}
      
      REQUIRED OUTPUT FORMAT (JSON):
      {
        "dailyMealPlan": [
          {
            "day": "Day name",
            "meals": [
              {
                "meal": "Meal name (e.g., Breakfast)",
                "time": "Approximate time",
                "recipe": {
                  "name": "Recipe name",
                  "ingredients": [
                    { "name": "Ingredient name", "quantity": "amount", "unit": "measurement unit" }
                  ],
                  "instructions": ["Step 1", "Step 2"],
                  "nutrition": {
                    "calories": number,
                    "protein": number,
                    "carbs": number,
                    "fats": number
                  },
                  "prepTime": "Preparation time",
                  "alternatives": ["Alternative ingredient 1", "Alternative ingredient 2"]
                }
              }
            ],
            "totalNutrition": {
              "calories": number,
              "protein": number,
              "carbs": number,
              "fats": number
            }
          }
        ],
        "shoppingList": [
          {
            "category": "Category name",
            "items": ["Item 1", "Item 2"]
          }
        ],
        "mealPrepTips": ["Tip 1", "Tip 2"]
      }
      
      IMPORTANT: 
      1. Ensure daily calories match the target of ${calorieTarget}
      2. Include EXACTLY ${mealFrequency} meals per day
      3. Respect all dietary restrictions and allergies
      4. ONLY return valid JSON, no other text`;
    
    const result = await gemini.generateContent(prompt);
    return parseJsonFromLLM(result);
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
      const weightGoalProgress = Math.abs(progressData.targetWeight - progressData.startingWeight) > 0 
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
  }
};

export default gemini;
