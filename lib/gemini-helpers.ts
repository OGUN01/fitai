import { UserDietPreferences } from '../services/ai/mealPlanGenerator';

/**
 * Create a workout-style meal plan prompt
 * This uses the same approach that's proven reliable for workout generation
 */
export function createWorkoutStyleMealPlanPrompt(preferences: UserDietPreferences): string {
  // Extract preferences with proper fallbacks
  const dietType = preferences.dietType || 'balanced';
  const allergies = preferences.allergies || [];
  const mealFrequency = preferences.mealFrequency || 3;
  const calorieTarget = preferences.calorieTarget || 2000;
  const countryRegion = preferences.countryRegion || 'international';
  
  // Create a prompt similar to the workout generator's style
  return `Create a personalized 7-day meal plan for a ${dietType} diet.
  User wants ${mealFrequency} meals per day with a total of ${calorieTarget} calories.
  Their preferred cuisine is ${countryRegion}.
  ${allergies.length > 0 ? `Avoid these allergens: ${allergies.join(', ')}.` : ''}
  
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
              "name": "Recipe Name",
              "ingredients": ["Ingredient 1", "Ingredient 2"],
              "instructions": ["Step 1", "Step 2"],
              "nutrition": {"calories": 300, "protein": 20, "carbs": 30, "fats": 10}
            }
          }
        ],
        "dailyNutrition": {"calories": 2000, "protein": 100, "carbs": 250, "fats": 70}
      }
    ],
    "shoppingList": {
      "protein": ["Item 1", "Item 2"],
      "produce": ["Item 1", "Item 2"],
      "grains": ["Item 1", "Item 2"],
      "dairy": ["Item 1", "Item 2"],
      "other": ["Item 1", "Item 2"]
    }
  }

  IMPORTANT GUIDELINES:
  1. Include EXACTLY 7 days (Monday-Sunday)
  2. Each day must have EXACTLY ${mealFrequency} meals
  3. Daily calories should total approximately ${calorieTarget}
  4. Return ONLY the JSON object, no explanations or other text
  5. Ensure all meal names, ingredients, and instructions are authentic ${countryRegion} cuisine
  6. Give full, detailed recipes with specific instructions and ingredients`;
}

/**
 * Create a workout-style meal plan directly using gemini
 */
export async function generateDirectMealPlan(gemini: any, preferences: UserDietPreferences): Promise<any> {
  // Create the prompt
  const prompt = createWorkoutStyleMealPlanPrompt(preferences);
  
  // Get raw response directly from the model
  const result = await gemini.generateContent(prompt);
  
  // Handle different result formats
  let text = '';
  if (typeof result === 'string') {
    text = result;
  } else if (result && result.text) {
    text = result.text();
  } else {
    console.log("Unknown response format:", result);
    text = JSON.stringify(result);
  }
  
  // Use the parseJsonFromLLM from imports
  const { parseJsonFromLLM } = require('../services/ai/jsonUtils');
  return parseJsonFromLLM(text);
} 