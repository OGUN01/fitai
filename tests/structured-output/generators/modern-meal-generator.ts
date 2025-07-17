/**
 * Modern Meal Plan Generator using Google's Native Structured Output
 * 
 * Replaces complex JSON parsing with guaranteed structured responses
 * Direct integration with onboarding data for personalized meal plans
 */

import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { GEMINI_API_KEY } from "../../../constants/api";
import { GoogleMealPlanSchema, WeeklyMealPlan, WeeklyMealPlanSchema } from "../schemas/meal-schemas";
import { TestUserProfile } from "../test-data/sample-onboarding-data";

export class ModernMealGenerator {
  private model: GenerativeModel;
  
  constructor() {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    
    // Use stable model optimized for structured output
    this.model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash", // Stable, not experimental
      generationConfig: {
        temperature: 0.4, // Balanced creativity and consistency
        topK: 40,
        topP: 0.9,
        maxOutputTokens: 8192, // Larger for comprehensive meal plans
      }
    });
  }

  /**
   * Generate complete weekly meal plan using structured output
   * NO JSON PARSING - Direct structured response!
   */
  async generateWeeklyMealPlan(userProfile: TestUserProfile): Promise<WeeklyMealPlan> {
    console.log("🍽️ [MODERN] Starting structured meal plan generation for:", userProfile.name);
    
    const prompt = this.buildPersonalizedMealPrompt(userProfile);
    
    try {
      // 🎯 MODERN APPROACH: Native structured output
      const response = await this.model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json", // 🔥 Guaranteed JSON
          responseSchema: GoogleMealPlanSchema // 🔥 Exact structure constraint
        }
      });

      // ✅ GUARANTEED VALID JSON - No complex parsing needed!
      const rawResponse = response.response.text();
      const mealPlan = JSON.parse(rawResponse);
      
      console.log("✅ [MODERN] Structured meal plan received successfully!");
      console.log("📊 [MODERN] Plan overview:", {
        name: mealPlan.planName,
        dietType: mealPlan.dietType,
        days: mealPlan.weeklyPlan.length,
        totalCalories: mealPlan.totalWeeklyNutrition.calories,
        shoppingItems: mealPlan.shoppingList.length
      });

      // Optional: Validate with Zod for extra safety
      const validatedPlan = WeeklyMealPlanSchema.parse(mealPlan);
      
      return validatedPlan;
      
    } catch (error) {
      console.error("❌ [MODERN] Structured meal generation failed:", error);
      throw new Error(`Modern meal generation failed: ${error.message}`);
    }
  }

  /**
   * Build personalized meal plan prompt from onboarding data
   */
  private buildPersonalizedMealPrompt(user: TestUserProfile): string {
    const weightGoal = user.target_weight_kg > user.weight_kg ? "weight gain" : "weight loss";
    const calorieAdjustment = user.target_weight_kg > user.weight_kg ? "surplus" : "deficit";
    
    return `Create a personalized 7-day meal plan for ${user.name} with these specifications:

PERSONAL DETAILS:
- Age: ${user.age}, Gender: ${user.gender}
- Height: ${user.height_cm}cm, Current Weight: ${user.weight_kg}kg, Target: ${user.target_weight_kg}kg
- Goal: ${weightGoal} (${Math.abs(user.target_weight_kg - user.weight_kg)}kg change needed)
- Activity Level: ${user.activityLevel}

DIETARY PREFERENCES:
- Diet Type: ${user.dietType}
- Cuisine Preferences: ${user.cuisinePreferences.join(', ')}
- Meal Frequency: ${user.mealFrequency} meals per day
- Daily Calorie Target: ${user.calorieTarget} calories (${calorieAdjustment})
- Country/Region: ${user.countryRegion}

RESTRICTIONS & ALLERGIES:
${user.allergies.length > 0 ? user.allergies.map(allergy => `- Avoid: ${allergy}`).join('\n') : '- No known allergies'}

LIFESTYLE FACTORS:
- Sleep: ${user.sleepHours} hours per night
- Stress Level: ${user.stressLevel}
- Water Goal: ${user.waterIntakeGoal}ml per day

REQUIREMENTS:
1. Create exactly 7 days of meal plans (Monday to Sunday)
2. Each day must include breakfast, lunch, and dinner
3. All meals must be ${user.dietType} and avoid ${user.allergies.join(', ') || 'no restrictions'}
4. Focus on ${user.cuisinePreferences.join(' and ')} cuisine styles
5. Target ${user.calorieTarget} calories per day for ${weightGoal}
6. Include detailed nutrition information for each meal
7. Provide complete ingredient lists and cooking instructions
8. Generate comprehensive shopping list for the week
9. Include meal prep tips and nutrition advice
10. Consider ${user.countryRegion} food availability and preferences

MEAL PLANNING GUIDELINES:
- Breakfast: 20-25% of daily calories
- Lunch: 30-35% of daily calories  
- Dinner: 30-35% of daily calories
- Snacks (if included): 10-15% of daily calories
- Ensure adequate protein for ${user.fitnessGoals.join(' and ')}
- Include variety across the 7 days
- Make recipes appropriate for ${user.activityLevel} lifestyle

IMPORTANT: 
- All recipes must be authentic to ${user.cuisinePreferences.join('/')} cuisine
- Consider ${user.age} and ${user.gender} nutritional needs
- Support ${weightGoal} with appropriate calorie distribution
- Include hydration recommendations (target: ${user.waterIntakeGoal}ml/day)`;
  }

  /**
   * Generate single day meal plan for quick testing
   */
  async generateDailyMealPlan(user: TestUserProfile, day: string = "Monday"): Promise<any> {
    const dailyPrompt = `Generate a single day meal plan for ${user.name} (${day}):
- Diet: ${user.dietType}
- Calories: ${user.calorieTarget}
- Cuisine: ${user.cuisinePreferences[0]}
- Allergies: ${user.allergies.join(', ') || 'none'}
- Country: ${user.countryRegion}`;

    try {
      const response = await this.model.generateContent({
        contents: [{ role: "user", parts: [{ text: dailyPrompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              day: { type: "string" },
              meals: {
                type: "object",
                properties: {
                  breakfast: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      calories: { type: "number" },
                      ingredients: { type: "array", items: { type: "string" } },
                      instructions: { type: "array", items: { type: "string" } }
                    },
                    required: ["name", "calories", "ingredients", "instructions"]
                  },
                  lunch: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      calories: { type: "number" },
                      ingredients: { type: "array", items: { type: "string" } },
                      instructions: { type: "array", items: { type: "string" } }
                    },
                    required: ["name", "calories", "ingredients", "instructions"]
                  },
                  dinner: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      calories: { type: "number" },
                      ingredients: { type: "array", items: { type: "string" } },
                      instructions: { type: "array", items: { type: "string" } }
                    },
                    required: ["name", "calories", "ingredients", "instructions"]
                  }
                },
                required: ["breakfast", "lunch", "dinner"]
              },
              totalCalories: { type: "number" }
            },
            required: ["day", "meals", "totalCalories"]
          }
        }
      });

      return JSON.parse(response.response.text());
    } catch (error) {
      console.error("❌ Daily meal generation failed:", error);
      throw error;
    }
  }

  /**
   * Benchmark meal generation performance
   */
  async benchmarkGeneration(user: TestUserProfile): Promise<{
    duration: number;
    success: boolean;
    planSize: number;
    mealsGenerated: number;
  }> {
    const startTime = Date.now();
    
    try {
      const plan = await this.generateWeeklyMealPlan(user);
      const endTime = Date.now();
      
      const totalMeals = plan.weeklyPlan.reduce((count, day) => {
        return count + 3 + (day.meals.snacks?.length || 0); // breakfast, lunch, dinner + snacks
      }, 0);
      
      return {
        duration: endTime - startTime,
        success: true,
        planSize: JSON.stringify(plan).length,
        mealsGenerated: totalMeals
      };
    } catch (error) {
      const endTime = Date.now();
      return {
        duration: endTime - startTime,
        success: false,
        planSize: 0,
        mealsGenerated: 0
      };
    }
  }
}
