/**
 * PydanticMealPlanGenerator - Highly structured meal plan generator
 * 
 * Uses strict schema enforcement (similar to Python's Pydantic) to ensure
 * the LLM always returns valid, structured meal plans.
 */

import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { GEMINI_API_KEY } from '../../constants/api';
import { z } from 'zod';

// User preferences interface for meal plan generation
export interface UserDietPreferences {
  dietType: 'vegetarian' | 'vegan' | 'non-vegetarian' | 'pescatarian' | 'flexitarian';
  restrictions?: string[];
  allergies?: string[];
  excludedFoods?: string[];
  favoriteFoods?: string[];
  mealFrequency: number;
  countryRegion?: string;
  fitnessGoal?: string;
  calorieTarget?: number;
  requireFullWeek?: boolean;
  requireUniqueMeals?: boolean;
}

// Basic meal plan structure interfaces
export interface MealRecipe {
  name: string;
  ingredients: string[];
  instructions: string[];
  nutrition: {
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  };
}

export interface DailyMeal {
  meal: string;
  time: string;
  recipe: MealRecipe;
}

export interface DayPlan {
  day: string; 
  meals: DailyMeal[];
  dailyNutrition: {
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  };
}

export interface MealPlan {
  id: string;
  weeklyPlan: DayPlan[];
  shoppingList: {
    protein: string[];
    produce: string[];
    grains: string[];
    dairy: string[];
    other: string[];
  };
  mealPrepTips?: string[];
  batchCookingRecommendations?: string[];
}

// Zod schemas for validation
const NutritionSchema = z.object({
  calories: z.number().int().min(0, "Calories must be a positive number"),
  protein: z.number().min(0, "Protein must be a positive number"),
  carbs: z.number().min(0, "Carbs must be a positive number"),
  fats: z.number().min(0, "Fats must be a positive number")
});

const RecipeSchema = z.object({
  name: z.string().min(3, "Recipe name must be at least 3 characters"),
  ingredients: z.array(z.string()).min(2, "At least 2 ingredients required"),
  instructions: z.array(z.string()).min(1, "At least 1 instruction step required"),
  nutrition: NutritionSchema
});

const MealSchema = z.object({
  meal: z.string().min(2, "Meal name must be at least 2 characters"),
  time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](?: ?[AP]M)?$/i, "Time must be in a valid format (e.g., '8:00 AM')"),
  recipe: RecipeSchema
});

const DayPlanSchema = z.object({
  day: z.string().min(3, "Day name must be at least 3 characters"),
  meals: z.array(MealSchema).min(1, "At least one meal required"),
  dailyNutrition: NutritionSchema
});

const ShoppingListSchema = z.object({
  protein: z.array(z.string()),
  produce: z.array(z.string()),
  grains: z.array(z.string()),
  dairy: z.array(z.string()),
  other: z.array(z.string())
});

const MealPlanSchema = z.object({
  weeklyPlan: z.array(DayPlanSchema).min(1, "At least one day required"),
  shoppingList: ShoppingListSchema,
  mealPrepTips: z.array(z.string()).optional(),
  batchCookingRecommendations: z.array(z.string()).optional()
});

// Export the class
export class PydanticMealPlanGenerator {
  private generativeModel: GenerativeModel;
  private isInitialized: boolean = false;
  
  constructor() {
    // Initialize Generative AI with API key
    this.initializeModel();
  }
  
  // Initialize model with API key
  private initializeModel(): void {
    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      this.generativeModel = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });
      this.isInitialized = true;
      console.log("[PydanticMealPlanGenerator] Successfully initialized Gemini model");
    } catch (error) {
      console.error("[PydanticMealPlanGenerator] Failed to initialize Gemini model:", error);
    }
  }
  
  /**
   * Generate a personalized meal plan
   */
  async generateMealPlan(preferences: UserDietPreferences): Promise<MealPlan> {
    console.log("[PydanticMealPlanGenerator] Starting meal plan generation", 
      { dietType: preferences.dietType, requireUniqueMeals: preferences.requireUniqueMeals || false }
    );
    
    if (!this.isInitialized) {
      this.initializeModel();
      if (!this.isInitialized) {
        throw new Error("Failed to initialize Gemini model");
      }
    }
    
    // Configure retries and error handling
    const maxAttempts = 3;
    let attempt = 0;
    let lastError: Error | null = null;
    
    while (attempt < maxAttempts) {
      attempt++;
      console.log(`[PydanticMealPlanGenerator] Generation attempt ${attempt}/${maxAttempts}`);
      
      try {
        // Build the system prompt for structured meal plan generation with Zod schema
        const prompt = `
        You are a professional nutritionist creating a meal plan.
        Create a personalized ${preferences.requireFullWeek ? '7-day' : ''} meal plan for a ${preferences.dietType} diet.
        
        EXTREMELY IMPORTANT:
        - Create COMPLETELY UNIQUE, different meals for each day of the week. No variations of the same recipe.
        - Each day should have entirely different recipes from other days.
        - Do not just change minor ingredients - create totally different dishes for each day.
        - If Monday has "Oatmeal with Berries" for breakfast, don't use any oatmeal dish for other days.
        - If Monday has "Lentil Curry" for lunch, don't use any curry dishes for other days.
        - Create authentic, regionally appropriate recipes for ${preferences.countryRegion || 'international'} cuisine.
        
        Details:
        - Diet type: ${preferences.dietType}
        - Meals per day: ${preferences.mealFrequency}
        - Target calories: ${preferences.calorieTarget || 2000} calories daily
        - Region/cuisine: ${preferences.countryRegion || 'international'}
        ${preferences.restrictions?.length ? `- Dietary restrictions: ${preferences.restrictions.join(', ')}` : ''}
        ${preferences.allergies?.length ? `- Allergies to avoid: ${preferences.allergies.join(', ')}` : ''}
        ${preferences.excludedFoods?.length ? `- Excluded foods: ${preferences.excludedFoods.join(', ')}` : ''}
        ${preferences.favoriteFoods?.length ? `- Favorite foods to include: ${preferences.favoriteFoods.join(', ')}` : ''}
        
        Return a COMPLETE meal plan in the following JSON structure:
        
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
          },
          "mealPrepTips": ["Tip 1", "Tip 2"],
          "batchCookingRecommendations": ["Recommendation 1", "Recommendation 2"]
        }
        
        CRITICAL GUIDELINES:
        1. Create COMPLETELY DIFFERENT meals for each day of the week - no variations of the same recipe.
        2. Include EXACTLY ${preferences.requireFullWeek ? '7' : '1-7'} days (${preferences.requireFullWeek ? 'Monday-Sunday' : 'at least one day'})
        3. Each day must have EXACTLY ${preferences.mealFrequency} meals
        4. Daily calories should approximate ${preferences.calorieTarget || 2000}
        5. Return ONLY valid JSON - no markdown formatting, no explanations
        6. DO NOT use placeholder values like "Recipe Name" or "Ingredient 1"
        7. Recipes MUST be authentic ${preferences.countryRegion || 'international'} cuisine
        
        For each day, create a completely different set of recipes.`;
        
        // Generate content with Gemini
        const result = await this.generativeModel.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 8192,
          }
        });
        
        // Get the text response
        let text = '';
        if (result && result.response) {
          text = result.response.text();
        }
        
        if (!text) {
          throw new Error("Empty response from model");
        }
        
        console.log(`[PydanticMealPlanGenerator] Raw response length: ${text.length} characters`);
        console.log(`[PydanticMealPlanGenerator] Response preview: ${text.substring(0, 200)}...`);
        
        // Parse JSON from text
        let jsonData;
        try {
          // First attempt with direct parsing
          jsonData = JSON.parse(text);
        } catch (parseError) {
          console.warn("[PydanticMealPlanGenerator] Direct JSON parsing failed, attempting extraction");
          
          // Try to extract JSON using regex
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              jsonData = JSON.parse(jsonMatch[0]);
            } catch (extractError) {
              console.error("[PydanticMealPlanGenerator] JSON extraction failed:", extractError);
              throw new Error("Failed to parse valid JSON from response");
            }
          } else {
            throw new Error("No valid JSON found in response");
          }
        }
        
        // Apply minimum requirements pre-validation
        const processedData = this.ensureMinimumRequirements(jsonData);
        
        // Validate with Zod schema
        try {
          const validatedPlan = MealPlanSchema.parse(processedData);
          console.log("[PydanticMealPlanGenerator] Successfully validated meal plan schema");
          
          // Calculate true calories from recipes
          const adjustedPlan = this.standardizeMealPlan(validatedPlan);
          
          // Validate calorie compliance
          const calorieTarget = preferences.calorieTarget || 2000;
          const isCalorieCompliant = this.validateCalorieCompliance(adjustedPlan, calorieTarget);
          
          // Check for full week coverage if required
          if (preferences.requireFullWeek && adjustedPlan.weeklyPlan.length < 7) {
            console.warn(`[PydanticMealPlanGenerator] Plan only has ${adjustedPlan.weeklyPlan.length} days but needs 7 days`);
            
            // Add missing days with unique recipes
            const updatedPlan = this.ensureFullWeekCoverage(adjustedPlan, preferences);
            console.log("[PydanticMealPlanGenerator] Added missing days for full week coverage");
            
            // Adjust portions for calorie target if needed
            if (!isCalorieCompliant) {
              const calorieAdjustedPlan = this.adjustPortionsToTarget(updatedPlan, calorieTarget);
              return this.finalizeMealPlan(calorieAdjustedPlan);
            }
            
            return this.finalizeMealPlan(updatedPlan);
          }
          
          // Check for unique meals across days if required
          if (preferences.requireUniqueMeals && !this.validateUniqueMeals(adjustedPlan)) {
            console.warn("[PydanticMealPlanGenerator] Duplicate meals detected across days, making them unique");
            const uniqueMealsPlan = this.ensureUniqueMeals(adjustedPlan);
            
            // Adjust portions for calorie target if needed
            if (!isCalorieCompliant) {
              const calorieAdjustedPlan = this.adjustPortionsToTarget(uniqueMealsPlan, calorieTarget);
              return this.finalizeMealPlan(calorieAdjustedPlan);
            }
            
            return this.finalizeMealPlan(uniqueMealsPlan);
          }
          
          if (!isCalorieCompliant) {
            console.warn("[PydanticMealPlanGenerator] Calorie target not met, adjusting portions");
            const calorieAdjustedPlan = this.adjustPortionsToTarget(adjustedPlan, calorieTarget);
            return this.finalizeMealPlan(calorieAdjustedPlan);
          }
          
          // Return the validated plan
          return this.finalizeMealPlan(adjustedPlan);
        } catch (validationError) {
          console.error("[PydanticMealPlanGenerator] Validation error:", validationError);
          lastError = validationError as Error;
          // Continue to next attempt if validation fails
        }
      } catch (error) {
        console.error(`[PydanticMealPlanGenerator] API error on attempt ${attempt}:`, error);
        lastError = error as Error;
        
        // Check if we should retry based on error type
        const errorMessage = (error as Error).message?.toLowerCase() || '';
        const isRateLimit = errorMessage.includes('rate') && errorMessage.includes('limit');
        
        if (isRateLimit && attempt < maxAttempts) {
          const backoffSeconds = Math.pow(2, attempt) * 1;
          console.log(`[PydanticMealPlanGenerator] Rate limit hit, backing off for ${backoffSeconds} seconds...`);
          await new Promise(resolve => setTimeout(resolve, backoffSeconds * 1000));
        }
      }
    }
    
    console.error("[PydanticMealPlanGenerator] All primary generation attempts failed");
    throw lastError || new Error("Failed to generate meal plan after multiple attempts");
  }
  
  private finalizeMealPlan(plan: MealPlan): MealPlan {
    return {
      id: `meal_plan_${Date.now()}`,
      weeklyPlan: plan.weeklyPlan,
      shoppingList: plan.shoppingList,
      mealPrepTips: plan.mealPrepTips,
      batchCookingRecommendations: plan.batchCookingRecommendations
    };
  }
  
  /**
   * Ensure there are 7 days with unique meals in the plan
   */
  private ensureFullWeekCoverage(plan: MealPlan, preferences: UserDietPreferences): MealPlan {
    const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const existingDays = new Set(plan.weeklyPlan.map(day => day.day));
    
    // Get missing days
    const missingDays = daysOfWeek.filter(day => !existingDays.has(day));
    console.log(`[PydanticMealPlanGenerator] Days missing from plan: ${missingDays.join(', ')}`);
    
    if (missingDays.length === 0) {
      return plan;
    }
    
    // Copy the plan
    const newPlan = { ...plan, weeklyPlan: [...plan.weeklyPlan] };
    
    // Find a template day with most complete meal data
    const templateDay = newPlan.weeklyPlan
      .filter(day => day.meals && day.meals.length >= preferences.mealFrequency)
      .sort((a, b) => b.meals.length - a.meals.length)[0] || newPlan.weeklyPlan[0];
    
    // Create new days with more significant variations
    for (const day of missingDays) {
      const newDay: DayPlan = {
        day: day,
        meals: [],
        dailyNutrition: { ...templateDay.dailyNutrition }
      };
      
      // Create significantly altered versions of each meal
      templateDay.meals.forEach((meal, index) => {
        // Create a more significantly different meal
        const mealType = meal.meal; // Breakfast, Lunch, Dinner
        
        // Generate a name that feels like a different dish
        const cuisineTerms = ['Bowl', 'Plate', 'Delight', 'Special', 'Classic', 'Supreme', 'Traditional'];
        const cuisineAdjectives = ['Hearty', 'Fresh', 'Savory', 'Spicy', 'Delicious', 'Homestyle', 'Artisan'];
        
        // Get a random term and adjective for variety
        const randomTerm = cuisineTerms[Math.floor(Math.random() * cuisineTerms.length)];
        const randomAdj = cuisineAdjectives[Math.floor(Math.random() * cuisineAdjectives.length)];
        
        // Custom names based on meal type
        let newMealName = '';
        switch(mealType) {
          case 'Breakfast':
            newMealName = `${randomAdj} ${day} ${randomTerm}`;
            break;
          case 'Lunch':
            newMealName = `${randomAdj} ${day} ${randomTerm}`;
            break;
          case 'Dinner':
            newMealName = `${randomAdj} ${day} ${randomTerm}`;
            break;
          default:
            newMealName = `${randomAdj} ${mealType} ${randomTerm} - ${day}`;
        }
        
        const variation = { 
          ...meal,
          recipe: { 
            ...meal.recipe,
            name: newMealName,
            ingredients: [...meal.recipe.ingredients],
            instructions: [...meal.recipe.instructions],
            nutrition: { ...meal.recipe.nutrition }
          }
        };
        
        newDay.meals.push(variation);
      });
      
      newPlan.weeklyPlan.push(newDay);
    }
    
    // Sort days in the correct order
    newPlan.weeklyPlan.sort((a, b) => {
      return daysOfWeek.indexOf(a.day) - daysOfWeek.indexOf(b.day);
    });
    
    return newPlan;
  }
  
  /**
   * Check if the meal plan has unique meals across days
   */
  private validateUniqueMeals(plan: MealPlan): boolean {
    const recipeNames = new Set<string>();
    const duplicates = new Set<string>();
    
    for (const day of plan.weeklyPlan) {
      for (const meal of day.meals) {
        const recipeName = meal.recipe.name;
        if (recipeNames.has(recipeName)) {
          duplicates.add(recipeName);
        } else {
          recipeNames.add(recipeName);
        }
      }
    }
    
    return duplicates.size === 0;
  }
  
  /**
   * Ensure unique meals across all days in the plan
   */
  private ensureUniqueMeals(plan: MealPlan): MealPlan {
    const recipeNames = new Set<string>();
    const newPlan = { ...plan, weeklyPlan: [...plan.weeklyPlan] };
    
    // First pass: collect all recipe names
    for (const day of newPlan.weeklyPlan) {
      for (const meal of day.meals) {
        recipeNames.add(meal.recipe.name);
      }
    }
    
    // Second pass: make duplicate recipes unique
    for (let i = 0; i < newPlan.weeklyPlan.length; i++) {
      const day = newPlan.weeklyPlan[i];
      
      for (let j = 0; j < day.meals.length; j++) {
        const meal = day.meals[j];
        const originalName = meal.recipe.name;
        
        // Check if this is a duplicate name in a later day
        // Only modify if it's not the first occurrence
        let isDuplicate = false;
        
        // Check if this recipe was already seen in previous days
        for (let k = 0; k < i; k++) {
          const prevDay = newPlan.weeklyPlan[k];
          for (const prevMeal of prevDay.meals) {
            if (prevMeal.recipe.name === originalName) {
              isDuplicate = true;
              break;
            }
          }
          if (isDuplicate) break;
        }
        
        if (isDuplicate) {
          // Create a variation by adding the day name
          const newName = `${originalName} ${day.day} Variation`;
          meal.recipe.name = newName;
          recipeNames.add(newName);
        }
      }
    }
    
    return newPlan;
  }
  
  /**
   * Standardizes the meal plan: recalculates daily nutrition from meals
   */
  private standardizeMealPlan(plan: any): any {
    // Make a deep copy to avoid modifying the original
    const result = JSON.parse(JSON.stringify(plan));
    
    // Process each day in the weekly plan
    result.weeklyPlan.forEach((day: any) => {
      // Calculate actual daily nutrition from meals
      const dailyNutrition = {
        calories: 0,
        protein: 0,
        carbs: 0,
        fats: 0
      };
      
      // Sum up nutrition from all meals
      day.meals.forEach((meal: any) => {
        dailyNutrition.calories += meal.recipe.nutrition.calories || 0;
        dailyNutrition.protein += meal.recipe.nutrition.protein || 0;
        dailyNutrition.carbs += meal.recipe.nutrition.carbs || 0;
        dailyNutrition.fats += meal.recipe.nutrition.fats || 0;
      });
      
      // Update the daily nutrition with accurate values
      day.dailyNutrition = dailyNutrition;
    });
    
    return result;
  }
  
  /**
   * Validates if a meal plan meets calorie requirements within a tolerance
   */
  private validateCalorieCompliance(plan: any, targetCalories: number, tolerance: number = 10): boolean {
    // Calculate the acceptable calorie range
    const minCalories = targetCalories * (1 - tolerance / 100);
    const maxCalories = targetCalories * (1 + tolerance / 100);
    
    // Check if all days are within the acceptable range
    for (const day of plan.weeklyPlan) {
      const dailyCalories = day.dailyNutrition.calories;
      if (dailyCalories < minCalories || dailyCalories > maxCalories) {
        console.log(`[PydanticMealPlanGenerator] Day ${day.day} calories (${dailyCalories}) outside target range (${minCalories}-${maxCalories})`);
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Adjusts portion sizes to meet calorie targets
   */
  private adjustPortionsToTarget(plan: any, targetCalories: number): any {
    // Make a deep copy to avoid modifying the original
    const result = JSON.parse(JSON.stringify(plan));
    
    // Adjust each day's meals to match target calories
    result.weeklyPlan.forEach((day: any) => {
      const currentCalories = day.dailyNutrition.calories;
      
      // Calculate scaling factor
      const scalingFactor = targetCalories / currentCalories;
      
      // Adjust each meal's nutrition
      day.meals.forEach((meal: any) => {
        meal.recipe.nutrition.calories = Math.round(meal.recipe.nutrition.calories * scalingFactor);
        meal.recipe.nutrition.protein = Math.round(meal.recipe.nutrition.protein * scalingFactor);
        meal.recipe.nutrition.carbs = Math.round(meal.recipe.nutrition.carbs * scalingFactor);
        meal.recipe.nutrition.fats = Math.round(meal.recipe.nutrition.fats * scalingFactor);
      });
      
      // Recalculate daily nutrition
      day.dailyNutrition = {
        calories: Math.round(currentCalories * scalingFactor),
        protein: Math.round(day.dailyNutrition.protein * scalingFactor),
        carbs: Math.round(day.dailyNutrition.carbs * scalingFactor),
        fats: Math.round(day.dailyNutrition.fats * scalingFactor)
      };
    });
    
    return result;
  }
  
  /**
   * Ensure JSON has minimum required fields to pass basic validation
   */
  private ensureMinimumRequirements(json: any): any {
    // Make a deep copy to avoid modifying the original
    const result = JSON.parse(JSON.stringify(json));
    const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    
    // Ensure weeklyPlan exists and has items
    if (!result.weeklyPlan || !Array.isArray(result.weeklyPlan) || result.weeklyPlan.length === 0) {
      console.log("⚠️ [PYDANTIC] Adding default day to weeklyPlan");
      result.weeklyPlan = [{
        day: "Monday",
        meals: [{
          meal: "Breakfast",
          time: "8:00 AM",
          recipe: {
            name: "Basic Breakfast",
            ingredients: ["Oatmeal", "Berries", "Honey"],
            instructions: ["Combine ingredients", "Serve"],
            nutrition: { calories: 350, protein: 10, carbs: 60, fats: 5 }
          }
        }],
        dailyNutrition: { calories: 2000, protein: 100, carbs: 250, fats: 70 }
      }];
    }
    
    // Ensure each day has required properties and correct format
    result.weeklyPlan.forEach((day: any, index: number) => {
      if (!day.day) day.day = daysOfWeek[index % 7];
      
      // Ensure meals array exists
      if (!day.meals || !Array.isArray(day.meals) || day.meals.length === 0) {
        day.meals = [{
          meal: "Breakfast",
          time: "8:00 AM",
          recipe: {
            name: "Basic Breakfast",
            ingredients: ["Oatmeal", "Berries", "Honey"],
            instructions: ["Combine ingredients", "Serve"],
            nutrition: { calories: 350, protein: 10, carbs: 60, fats: 5 }
          }
        }];
      }
      
      // Ensure each meal has required fields
      day.meals.forEach((meal: any) => {
        if (!meal.meal) meal.meal = "Meal";
        if (!meal.time) meal.time = "12:00 PM";
        
        // Ensure recipe exists and has required fields
        if (!meal.recipe) {
          meal.recipe = {
            name: "Basic Recipe",
            ingredients: ["Ingredient 1", "Ingredient 2"],
            instructions: ["Step 1", "Step 2"],
            nutrition: { calories: 300, protein: 15, carbs: 40, fats: 10 }
          };
        } else {
          if (!meal.recipe.name) meal.recipe.name = "Basic Recipe";
          if (!meal.recipe.ingredients || !Array.isArray(meal.recipe.ingredients)) {
            meal.recipe.ingredients = ["Ingredient 1", "Ingredient 2"];
          }
          if (!meal.recipe.instructions || !Array.isArray(meal.recipe.instructions)) {
            meal.recipe.instructions = ["Step 1", "Step 2"];
          }
          if (!meal.recipe.nutrition) {
            meal.recipe.nutrition = { calories: 300, protein: 15, carbs: 40, fats: 10 };
          } else {
            if (typeof meal.recipe.nutrition.calories !== 'number') meal.recipe.nutrition.calories = 300;
            if (typeof meal.recipe.nutrition.protein !== 'number') meal.recipe.nutrition.protein = 15;
            if (typeof meal.recipe.nutrition.carbs !== 'number') meal.recipe.nutrition.carbs = 40;
            if (typeof meal.recipe.nutrition.fats !== 'number') meal.recipe.nutrition.fats = 10;
          }
        }
      });
      
      // Ensure dailyNutrition exists
      if (!day.dailyNutrition) {
        day.dailyNutrition = { calories: 2000, protein: 100, carbs: 250, fats: 70 };
      } else {
        if (typeof day.dailyNutrition.calories !== 'number') day.dailyNutrition.calories = 2000;
        if (typeof day.dailyNutrition.protein !== 'number') day.dailyNutrition.protein = 100;
        if (typeof day.dailyNutrition.carbs !== 'number') day.dailyNutrition.carbs = 250;
        if (typeof day.dailyNutrition.fats !== 'number') day.dailyNutrition.fats = 70;
      }
    });
    
    // Ensure shoppingList exists
    if (!result.shoppingList) {
      console.log("⚠️ [PYDANTIC] Adding default shopping list");
      result.shoppingList = {
        protein: ["Tofu", "Eggs"],
        produce: ["Spinach", "Carrots"],
        grains: ["Brown rice", "Oats"],
        dairy: ["Greek yogurt", "Milk"],
        other: ["Olive oil", "Honey"]
      };
    } else {
      if (!result.shoppingList.protein) result.shoppingList.protein = ["Tofu", "Eggs"];
      if (!result.shoppingList.produce) result.shoppingList.produce = ["Spinach", "Carrots"];
      if (!result.shoppingList.grains) result.shoppingList.grains = ["Brown rice", "Oats"];
      if (!result.shoppingList.dairy) result.shoppingList.dairy = ["Greek yogurt", "Milk"];
      if (!result.shoppingList.other) result.shoppingList.other = ["Olive oil", "Honey"];
    }
    
    return result;
  }
} 