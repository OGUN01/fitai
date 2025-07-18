/**
 * PydanticMealPlanGenerator - Highly structured meal plan generator
 * 
 * Uses strict schema enforcement (similar to Python's Pydantic) to ensure
 * the LLM always returns valid, structured meal plans.
 */

import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { GEMINI_API_KEY } from '../../constants/api';
import { z } from 'zod';

// User preferences interface for meal plan generation - ENHANCED with all onboarding parameters
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

  // MISSING CRITICAL PARAMETERS - NOW ADDED:
  // Meal timing preferences from onboarding
  preferredMealTimes?: string[] | any[];

  // Water intake goal from onboarding
  waterIntakeGoal?: number;

  // Demographics for personalized nutrition
  age?: number;
  gender?: string;
  weight?: number;
  height?: number;

  // Activity and weight goals affect nutritional needs
  activityLevel?: string;
  weightGoal?: string;
  currentWeight?: number;
  targetWeight?: number;
  bodyFatPercentage?: number;
}

// Basic meal plan structure interfaces
export interface MealRecipe {
  name: string;
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

const MealPlanSchema = z.object({
  weeklyPlan: z.array(DayPlanSchema).min(1, "At least one day required"),
});

// Export UserDietPreferences if it's defined here and not already exported
// Assuming UserDietPreferences is defined above as an interface.
// If it's not, this comment serves as a placeholder to ensure it's accessible.
// export { UserDietPreferences }; // This line might be commented out if already exported or defined elsewhere

// Export the class
export class PydanticMealPlanGenerator {
  private generativeModel!: GenerativeModel;
  private isInitialized: boolean = false;
  
  constructor() {
    // Initialize Generative AI with API key
    this.initializeModel();
  }
  
  // Initialize model with API key
  private initializeModel(): void {
    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      this.generativeModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash-preview-05-20" });
      this.isInitialized = true;
      console.log("[PydanticMealPlanGenerator] Successfully initialized Gemini model with gemini-2.5-flash-preview-05-20");
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
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    
    // Track generation start time for detailed logging
    const generationStartTime = Date.now();
    console.log(`[PydanticMealPlanGenerator] Generation started at ${new Date(generationStartTime).toISOString()}`);
    
    while (attempt < maxAttempts) {
      attempt++;
      console.log(`[PydanticMealPlanGenerator] Generation attempt ${attempt}/${maxAttempts}`);
      
      try {
        // Build the system prompt for structured meal plan generation with Zod schema
        const prompt = `
        You are a professional nutritionist creating a meal plan.
        Create a personalized ${preferences.requireFullWeek ? '7-day' : ''} meal plan for a ${preferences.dietType} diet.
        Your primary goal is to provide varied meal NAMES and their estimated NUTRITIONAL INFORMATION (calories, protein, carbs, fats).
        
        EXTREMELY IMPORTANT:
        - Create COMPLETELY UNIQUE, different meal NAMES for each day of the week. No variations of the same concept.
        - Each day should have entirely different meal NAMES from other days.
        - If Monday has "Oatmeal with Berries" for breakfast, do not suggest any other oatmeal-based meal NAMES for other days or other meals.
        - If Monday has "Lentil Soup" for lunch, do not suggest any other soup-based meal NAMES for other days or other meals.
        - Meal NAMES should sound appealing and appropriate for ${preferences.countryRegion || 'international'} cuisine.
        - DO NOT include ingredients, cooking instructions, shopping lists, or meal prep tips. ONLY meal names and nutrition.
        
        Details:
        - Diet type: ${preferences.dietType}
        - Meals per day: ${preferences.mealFrequency}
        - Target calories: ${preferences.calorieTarget || 2000} calories daily
        - Region/cuisine: ${preferences.countryRegion || 'international'}
        ${preferences.restrictions?.length ? `- Dietary restrictions: ${preferences.restrictions.join(', ')}` : ''}
        ${preferences.allergies?.length ? `- Allergies to avoid: ${preferences.allergies.join(', ')}` : ''}
        ${preferences.excludedFoods?.length ? `- Excluded foods: ${preferences.excludedFoods.join(', ')}` : ''}
        ${preferences.favoriteFoods?.length ? `- Favorite foods to include (inspire meal names): ${preferences.favoriteFoods.join(', ')}` : ''}
        
        Return a COMPLETE meal plan in the following JSON structure. ONLY include the fields shown:
        
        {
          "weeklyPlan": [
            {
              "day": "Monday",
              "meals": [
                {
                  "meal": "Breakfast",
                  "time": "8:00 AM",
                  "recipe": {
                    "name": "Unique Meal Name Here",
                    "nutrition": {"calories": 300, "protein": 20, "carbs": 30, "fats": 10}
                  }
                }
                // ... other meals for the day
              ],
              "dailyNutrition": {"calories": 2000, "protein": 100, "carbs": 250, "fats": 70} // This should sum the meal nutritions
            }
            // ... other days
          ]
          // DO NOT include shoppingList, mealPrepTips, or batchCookingRecommendations fields.
        }
        
        CRITICAL GUIDELINES:
        1. Create COMPLETELY DIFFERENT meal NAMES for each day of the week.
        2. Include EXACTLY ${preferences.requireFullWeek ? '7' : '1-7'} days (${preferences.requireFullWeek ? 'Monday-Sunday' : 'at least one day'}).
        3. Each day must have EXACTLY ${preferences.mealFrequency} meals (each with a name and nutrition).
        4. Daily calorie totals (in 'dailyNutrition') should approximate ${preferences.calorieTarget || 2000} and be the sum of the meal nutritions for that day.
        5. Return ONLY valid JSON - no markdown formatting, no explanations, no comments.
        6. DO NOT use placeholder values like "Unique Meal Name Here". Provide real, distinct meal names.
        7. Meal names should be for authentic ${preferences.countryRegion || 'international'} cuisine.
        8. DO NOT include ingredients, instructions, shopping lists, or meal prep tips in the JSON output.
        9. Ensure all strings are correctly quoted and escaped. Ensure all objects and arrays are correctly closed. The output MUST be parsable by a standard JSON parser.

        For each day, create a completely different set of meal names and their estimated nutrition.`;
        
        // Create AbortController for timeout handling
        const controller = new AbortController();
        const timeoutMs = 60000; // 60-second timeout
        timeoutId = setTimeout(() => {
          controller.abort();
          console.log(`[PydanticMealPlanGenerator] Request timed out after ${timeoutMs/1000} seconds`);
        }, timeoutMs);
        
        console.log(`[PydanticMealPlanGenerator] Setting API request timeout to ${timeoutMs/1000} seconds`);
        
        // Generate content with Gemini using AbortController
        const requestStartTime = Date.now();
        console.log(`[PydanticMealPlanGenerator] API request started at ${new Date(requestStartTime).toISOString()}`);
        
        const result = await this.generativeModel.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json", // Request JSON output directly
            temperature: 0.7, // Slightly creative but not too wild
            topP: 0.9,
            topK: 40,
          }
        }, { signal: controller.signal });
        
        clearTimeout(timeoutId); // Clear the timeout
        const response = result.response;
        const responseText = response.text();
        const generationEndTime = Date.now();
        console.log(`[PydanticMealPlanGenerator] API request completed in ${(generationEndTime - requestStartTime) / 1000} seconds`);
        
        // Extract and parse JSON using the new repair function
        const json = this._extractAndRepairJson(responseText, "generateMealPlan");

        // Standardize and validate the plan
        return this.validateAndStandardizeMealPlan(json, preferences);
      } catch (error) {
        console.error(`[PydanticMealPlanGenerator] API error on attempt ${attempt}:`, error);
        lastError = error as Error;
        
        // Check if we should retry based on error type
        let retryErrorMessage = '';
        if (error instanceof Error) {
            retryErrorMessage = error.message?.toLowerCase() || '';
        } else {
            retryErrorMessage = String(error).toLowerCase();
        }

        const isRateLimit = retryErrorMessage.includes('rate') && retryErrorMessage.includes('limit');
        const isTimeout = retryErrorMessage.includes('abort') || retryErrorMessage.includes('timeout');
        
        // Clear timeout if it was an abort error (we triggered it)
        if (isTimeout) {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          console.log(`[PydanticMealPlanGenerator] Request aborted due to timeout`);
          
          // For timeouts, we'll use a longer backoff period
          if (attempt < maxAttempts) {
            const timeoutBackoffSeconds = Math.pow(2, attempt) * 5 + Math.random() * 3;
            console.log(`[PydanticMealPlanGenerator] Timeout occurred, backing off for ${timeoutBackoffSeconds.toFixed(1)} seconds...`);
            await new Promise(resolve => setTimeout(resolve, timeoutBackoffSeconds * 1000));
          }
        } else if (isRateLimit && attempt < maxAttempts) {
          // Use improved exponential backoff with randomization for rate limits
          const backoffSeconds = Math.pow(2, attempt) * 3 + Math.random() * 2;
          console.log(`[PydanticMealPlanGenerator] Rate limit hit, backing off for ${backoffSeconds.toFixed(1)} seconds...`);
          await new Promise(resolve => setTimeout(resolve, backoffSeconds * 1000));
        }
      }
    }
    
    const totalDuration = (Date.now() - generationStartTime) / 1000;
    console.error(`[PydanticMealPlanGenerator] All primary generation attempts failed after ${totalDuration.toFixed(1)} seconds`);
    
    // Create a more descriptive error for the UI layer
    if (lastError && lastError.message.includes('timeout')) {
      throw new Error("API_TIMEOUT: The meal plan generation timed out. Please try again later.");
    } else if (lastError && lastError.message.includes('rate limit')) {
      throw new Error("API_RATE_LIMITED: You've reached the usage limit. Please try again in a few minutes.");
    } else {
      throw lastError || new Error("Failed to generate meal plan after multiple attempts");
    }
  }
  
  private finalizeMealPlan(plan: Partial<MealPlan>): MealPlan {
    if (!plan.weeklyPlan) {
      // This case should ideally be prevented by ensureMinimumRequirements or prior validation
      console.error("[PydanticMealPlanGenerator] Attempted to finalize a meal plan without a weeklyPlan.");
      // We'll let ensureMinimumRequirements in createStaticFallbackPlan handle base structure for static fallbacks
      // For LLM generated plans, weeklyPlan should always be present or generation should fail earlier.
      // However, to satisfy MealPlan type for return, we must provide it.
      plan.weeklyPlan = []; // Should not happen in normal flow if Zod parsing is effective
    }
    return {
      id: `meal_plan_${Date.now()}`,
      weeklyPlan: plan.weeklyPlan,
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
            nutrition: { calories: 300, protein: 15, carbs: 40, fats: 10 }
          };
        } else {
          if (!meal.recipe.name) meal.recipe.name = "Basic Recipe";
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
    
    return result;
  }

  private validateAndStandardizeMealPlan(json: any, preferences: UserDietPreferences): MealPlan {
    // Validate the meal plan
    const validatedPlan = MealPlanSchema.parse(json);
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
  }

  // --- START: NEW GRANULAR AND FALLBACK METHODS ---

  /**
   * Extracts a JSON string from a raw model output and attempts to repair common issues.
   */
  private _extractAndRepairJson(rawOutput: string, context: string): any {
    console.log(`[PydanticMealPlanGenerator] (${context}) Starting JSON extraction and repair. Raw output length: ${rawOutput.length}`);

    let jsonString = rawOutput;

    // 1. Remove Markdown code block delimiters if present
    jsonString = jsonString.replace(/^```json\s*|\s*```$/g, '');
    jsonString = jsonString.trim();

    // 2. Basic cleanup: remove newlines within strings (common issue)
    // This is a simplified approach; a more robust one might involve a parser or more complex regex
    // For now, we target unescaped newlines that break JSON strings.
    // jsonString = jsonString.replace(/([^\\])\\n/g, '$1 '); // Be cautious with this, might corrupt intended newlines if any were allowed

    // 3. Attempt to find the main JSON object boundaries
    let startIndex = jsonString.indexOf('{');
    let endIndex = jsonString.lastIndexOf('}');

    if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
      console.error(`[PydanticMealPlanGenerator] (${context}) No valid JSON object found after basic cleanup.`);
      throw new Error("No valid JSON object found in LLM output after basic cleanup.");
    }
    jsonString = jsonString.substring(startIndex, endIndex + 1);
    console.log(`[PydanticMealPlanGenerator] (${context}) Tentative JSON string after boundary find: ${jsonString.substring(0, 200)}...`);

    // 4. Iterative parsing and repair attempts
    const MAX_REPAIR_ATTEMPTS = 3;
    for (let i = 0; i < MAX_REPAIR_ATTEMPTS; i++) {
      try {
        const parsedJson = JSON.parse(jsonString);
        console.log(`[PydanticMealPlanGenerator] (${context}) Successfully parsed JSON on attempt ${i + 1}.`);
        return parsedJson;
      } catch (error: any) {
        console.warn(`[PydanticMealPlanGenerator] (${context}) JSON parsing failed on attempt ${i + 1}: ${error.message}`);
        if (i === MAX_REPAIR_ATTEMPTS - 1) {
          console.error(`[PydanticMealPlanGenerator] (${context}) Max JSON repair attempts reached. Final attempt failed.`);
          throw error; // Re-throw the last error
        }

        // Attempt basic repairs
        // 4a. Fix unterminated strings (very basic: adds a quote if a string seems to end abruptly before a comma/brace)
        // This is highly heuristic. A more robust solution is complex.
        // Example: "name": "Some Meal Name, ... -> "name": "Some Meal Name", ...
        // It looks for patterns like: "key": "value without closing quote immediately followed by a comma or closing brace.
        jsonString = jsonString.replace(/("[a-zA-Z0-9_\s]+"):\s*("[^"\n]*)(,|}|\])/g, (match, key, value, endChar) => {
          if (!value.endsWith('"')) {
            const fixedValue = value + '"';
            console.log(`[PydanticMealPlanGenerator] (${context}) Attempting to fix unterminated string: ${value} -> ${fixedValue}`);
            return `${key}: ${fixedValue}${endChar}`;
          }
          return match; // No change needed
        });
        
        // 4b. Remove trailing commas (from arrays or objects)
        jsonString = jsonString.replace(/,\s*(\}|\])/g, '$1');
        console.log(`[PydanticMealPlanGenerator] (${context}) Attempted to remove trailing commas.`);

        // 4c. Balance braces/brackets (very simple: trim trailing characters if they seem unbalanced)
        // This is a naive approach and might not always work.
        let openBraces = (jsonString.match(/\{/g) || []).length;
        let closeBraces = (jsonString.match(/\}/g) || []).length;
        let openBrackets = (jsonString.match(/\[/g) || []).length;
        let closeBrackets = (jsonString.match(/\]/g) || []).length;

        if (openBraces > closeBraces && jsonString.endsWith('}')) { /* all good */ } 
        else if (openBraces > closeBraces) {
            jsonString += '}'.repeat(openBraces - closeBraces);
            console.warn(`[PydanticMealPlanGenerator] (${context}) Attempted to balance missing closing braces.`);
        } else if (closeBraces > openBraces && jsonString.startsWith('{')) { /* all good */ } 
        else if (closeBraces > openBraces) {
            let diff = closeBraces - openBraces;
            if (jsonString.endsWith('}'.repeat(diff))) { /* potentially ok */ } 
            else { 
              // console.warn(`[PydanticMealPlanGenerator] (${context}) Too many closing braces, no simple fix applied.`);
            }        
        }

        if (openBrackets > closeBrackets && jsonString.endsWith(']')) { /* all good */ } 
        else if (openBrackets > closeBrackets) {
            jsonString += ']'.repeat(openBrackets - closeBrackets);
            console.warn(`[PydanticMealPlanGenerator] (${context}) Attempted to balance missing closing brackets.`);
        } else if (closeBrackets > openBrackets && jsonString.startsWith('[')) { /* all good */ } 
        else if (closeBrackets > openBrackets) {
            // console.warn(`[PydanticMealPlanGenerator] (${context}) Too many closing brackets, no simple fix applied.`);
        }
      }
    }
    // Should not be reached if MAX_REPAIR_ATTEMPTS > 0, as the loop either returns or throws.
    throw new Error("JSON repair loop finished unexpectedly."); 
  }

  /**
   * Creates a static, non-API-calling fallback meal plan.
   * This is used when API calls are skipped (e.g., due to rate limits).
   */
  createStaticFallbackPlan(preferences: UserDietPreferences): MealPlan {
    console.log("[PydanticMealPlanGenerator] Creating static fallback meal plan.");
    // Use ensureMinimumRequirements to build a basic, valid plan structure
    // and then apply some very basic personalization if possible without an LLM.
    let fallbackPlan = this.ensureMinimumRequirements({}); 

    // Attempt to make the static plan slightly more relevant if preferences are available
    if (fallbackPlan.weeklyPlan && fallbackPlan.weeklyPlan.length > 0) {
      fallbackPlan.weeklyPlan[0].day = "Monday"; // Default to Monday if not set
      if (fallbackPlan.weeklyPlan[0].meals && fallbackPlan.weeklyPlan[0].meals.length > 0) {
        let mealName = "Fallback Breakfast";
        if (preferences.dietType === 'vegan') mealName = "Vegan Oatmeal";
        else if (preferences.dietType === 'vegetarian') mealName = "Vegetarian Scramble";
        else if (preferences.favoriteFoods && preferences.favoriteFoods.length > 0) {
          mealName = `Simple ${preferences.favoriteFoods[0]} Dish`;
        }
        fallbackPlan.weeklyPlan[0].meals[0].recipe.name = mealName;
        fallbackPlan.weeklyPlan[0].meals[0].meal = "Breakfast";
        fallbackPlan.weeklyPlan[0].meals[0].time = "08:00";
      }
    }
    // Ensure it has an ID and other finalized properties
    fallbackPlan = this.finalizeMealPlan(fallbackPlan as Partial<MealPlan>);
    // Re-standardize after potential modifications
    return this.standardizeMealPlan(fallbackPlan) as MealPlan;
  }

  /**
   * Generates a meal plan for a single day.
   */
  async generateDailyPlan(preferences: UserDietPreferences, dayNumber: number, contextMeals: DayPlan[]): Promise<DayPlan> {
    console.log(`[PydanticMealPlanGenerator] Generating DailyPlan for day index ${dayNumber} with context meals count: ${contextMeals.length}`);

    if (!this.isInitialized) {
      this.initializeModel();
      if (!this.isInitialized) {
        throw new Error("Failed to initialize Gemini model for DailyPlan generation");
      }
    }

    const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const currentDayName = daysOfWeek[dayNumber % 7];

    // Build context string from previously generated meals
    let contextPrompt = "Previously generated meals to ensure variety (avoid similar dishes):";
    if (contextMeals.length > 0) {
      contextMeals.forEach(dayPlan => {
        if (dayPlan && dayPlan.day && dayPlan.meals) { // Add null checks for safety
            contextPrompt += `\n- ${dayPlan.day}: ${dayPlan.meals.map(m => m.recipe.name).join(', ')}`;
        }
      });
    } else {
      contextPrompt += " None so far for this plan.";
    }

    const prompt = `
    You are a professional nutritionist creating a single day's meal plan.
    Create a personalized meal plan for ${currentDayName}, focusing on meal NAMES and NUTRITIONAL INFORMATION.
    
    User Preferences:
    - Diet type: ${preferences.dietType}
    - Meals per day for ${currentDayName}: ${preferences.mealFrequency}
    - Target calories for ${currentDayName}: ${preferences.calorieTarget || 2000} calories
    - Region/cuisine: ${preferences.countryRegion || 'international'}
    ${preferences.restrictions?.length ? `- Dietary restrictions: ${preferences.restrictions.join(', ')}` : ''}
    ${preferences.allergies?.length ? `- Allergies to avoid: ${preferences.allergies.join(', ')}` : ''}
    ${preferences.excludedFoods?.length ? `- Excluded foods: ${preferences.excludedFoods.join(', ')}` : ''}
    ${preferences.favoriteFoods?.length ? `- Favorite foods to include (inspire meal names): ${preferences.favoriteFoods.join(', ')}` : ''}

    ENHANCED USER CONTEXT (NOW INCLUDED):
    ${preferences.age ? `- Age: ${preferences.age} years` : ''}
    ${preferences.gender ? `- Gender: ${preferences.gender}` : ''}
    ${preferences.weight ? `- Weight: ${preferences.weight}kg` : ''}
    ${preferences.height ? `- Height: ${preferences.height}cm` : ''}
    ${preferences.activityLevel ? `- Activity level: ${preferences.activityLevel}` : ''}
    ${preferences.weightGoal ? `- Weight goal: ${preferences.weightGoal}` : ''}
    ${preferences.waterIntakeGoal ? `- Daily water goal: ${preferences.waterIntakeGoal}ml` : ''}
    ${preferences.preferredMealTimes?.length ? `- Preferred meal times: ${Array.isArray(preferences.preferredMealTimes) ? preferences.preferredMealTimes.map(time => typeof time === 'string' ? time : `${time.name}: ${time.time}`).join(', ') : 'Standard times'}` : ''}

    ${contextPrompt}

    Return a COMPLETE meal plan for ${currentDayName} in the following JSON structure. ONLY include the fields shown:
    {
      "day": "${currentDayName}",
      "meals": [
        {
          "meal": "Breakfast",
          "time": "8:00 AM",
          "recipe": {
            "name": "Unique Meal Name for ${currentDayName} Breakfast",
            "nutrition": {"calories": 300, "protein": 20, "carbs": 30, "fats": 10}
          }
        }
        // ... other meals for the day, up to ${preferences.mealFrequency} meals
      ],
      "dailyNutrition": {"calories": ${preferences.calorieTarget || 2000}, "protein": 100, "carbs": 250, "fats": 70} // This should sum the meal nutritions
    }

    CRITICAL GUIDELINES:
    1. Provide meal NAMES that are unique and different from the context meals provided (if any).
    2. Include EXACTLY ${preferences.mealFrequency} meals for the day (each with a name and nutrition).
    3. The sum of meal calories (reflected in 'dailyNutrition') should approximate the daily target of ${preferences.calorieTarget || 2000}.
    4. Return ONLY valid JSON - no markdown formatting, no explanations, no comments.
    5. DO NOT use placeholder values like "Unique Meal Name Here". Provide real, distinct meal names.
    6. Meal names MUST be for authentic ${preferences.countryRegion || 'international'} cuisine.
    7. DO NOT include ingredients, instructions, shopping lists, or meal prep tips in the JSON output.
    8. Ensure 'dailyNutrition' accurately sums up the nutrition from all meals provided for the day.
    9. Ensure all strings are correctly quoted and escaped. Ensure all objects and arrays are correctly closed. The output MUST be parsable by a standard JSON parser.
    `;

    const maxAttempts = 3;
    let attempt = 0;
    let lastError: Error | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    while (attempt < maxAttempts) {
      attempt++;
      console.log(`[PydanticMealPlanGenerator] DailyPlan Generation attempt ${attempt}/${maxAttempts} for ${currentDayName}`);
      try {
        const controller = new AbortController();
        const timeoutMs = 45000; // 45-second timeout for a single day plan
        timeoutId = setTimeout(() => { controller.abort(); console.log(`[PydanticMealPlanGenerator] DailyPlan request timed out for ${currentDayName}`); }, timeoutMs);

        const result = await this.generativeModel.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json", // Ensure JSON output is requested
            temperature: 0.75, 
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 4096
          }
        }, { signal: controller.signal });
        if (timeoutId) clearTimeout(timeoutId);

        let text = result?.response?.text() || '';
        if (!text) throw new Error("Empty response from model for DailyPlan");

        // Extract and parse JSON using the new repair function
        const json = this._extractAndRepairJson(text, `generateDailyPlan-${currentDayName}`);

        // Basic validation and standardization for the single day plan
        const validatedDailyPlan = DayPlanSchema.parse(json);
        console.log(`[PydanticMealPlanGenerator] Successfully validated DailyPlan schema for ${currentDayName}`);
        
        // Standardize to ensure dailyNutrition is summed correctly from meals.
        const standardizedPlan = this.standardizeMealPlan({ weeklyPlan: [validatedDailyPlan] }); 
        return standardizedPlan.weeklyPlan[0];

      } catch (error) {
        console.error(`[PydanticMealPlanGenerator] API error on DailyPlan attempt ${attempt} for ${currentDayName}:`, error);
        lastError = error as Error;
        let retryErrorMessage = (error instanceof Error) ? error.message?.toLowerCase() || '' : String(error).toLowerCase();
        const isRateLimit = retryErrorMessage.includes('rate') && retryErrorMessage.includes('limit');
        const isTimeout = retryErrorMessage.includes('abort') || retryErrorMessage.includes('timeout');
        if (timeoutId) clearTimeout(timeoutId);

        if ((isRateLimit || isTimeout) && attempt < maxAttempts) {
          const backoffSeconds = Math.pow(2, attempt) + Math.random(); // Simpler backoff for shorter calls
          console.log(`[PydanticMealPlanGenerator] Backing off for ${backoffSeconds.toFixed(1)}s for ${currentDayName} (DailyPlan)`);
          await new Promise(resolve => setTimeout(resolve, backoffSeconds * 1000));
        } else if (attempt >= maxAttempts) {
          break; 
        }
      }
    }
    console.error(`[PydanticMealPlanGenerator] All DailyPlan generation attempts failed for ${currentDayName}. Last error: ${lastError?.message}`);
    throw lastError || new Error(`Failed to generate DailyPlan for ${currentDayName} after ${maxAttempts} attempts`);
  }

  /**
   * Generates a single meal (e.g., Breakfast) for a specific day.
   */
  async generateSingleMealForDay(preferences: UserDietPreferences, dayNumber: number, mealType: string, contextMealsThisDay: DailyMeal[]): Promise<DailyMeal> {
    console.log(`[PydanticMealPlanGenerator] Generating SingleMeal: ${mealType} for day index ${dayNumber}. Context meals this day: ${contextMealsThisDay.length}`);

    if (!this.isInitialized) {
      this.initializeModel();
      if (!this.isInitialized) {
        throw new Error("Failed to initialize Gemini model for SingleMeal generation");
      }
    }

    const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const currentDayName = daysOfWeek[dayNumber % 7];

    let contextPrompt = `Previously generated meals for ${currentDayName} to ensure variety (avoid similar dishes/ingredients if possible):`;
    if (contextMealsThisDay.length > 0) {
      contextMealsThisDay.forEach(meal => {
        if (meal && meal.recipe && meal.recipe.name) { // Add null checks for safety
            contextPrompt += `\n- ${meal.meal}: ${meal.recipe.name}`;
        }
      });
    } else {
      contextPrompt += " None so far for this day.";
    }

    // Estimate target calories for this specific meal
    const dailyTargetCalories = preferences.calorieTarget || 2000;
    const mealTargetCalories = Math.round(dailyTargetCalories / (preferences.mealFrequency || 3)); // Default to 3 meals if frequency not set

    const prompt = `
    You are a professional nutritionist creating a single meal.
    Create a personalized ${mealType} for ${currentDayName}, providing only its NAME and NUTRITIONAL INFORMATION.
    
    User Preferences:
    - Diet type: ${preferences.dietType}
    - Region/cuisine: ${preferences.countryRegion || 'international'}
    - Target calories for this meal: approximately ${mealTargetCalories}
    ${preferences.restrictions?.length ? `- Dietary restrictions: ${preferences.restrictions.join(', ')}` : ''}
    ${preferences.allergies?.length ? `- Allergies to avoid: ${preferences.allergies.join(', ')}` : ''}
    ${preferences.excludedFoods?.length ? `- Excluded foods: ${preferences.excludedFoods.join(', ')}` : ''}
    ${preferences.favoriteFoods?.length ? `- Favorite foods to include (inspire meal name): ${preferences.favoriteFoods.join(', ')}` : ''}

    ENHANCED USER CONTEXT (NOW INCLUDED):
    ${preferences.age ? `- Age: ${preferences.age} years` : ''}
    ${preferences.gender ? `- Gender: ${preferences.gender}` : ''}
    ${preferences.weight ? `- Weight: ${preferences.weight}kg` : ''}
    ${preferences.height ? `- Height: ${preferences.height}cm` : ''}
    ${preferences.activityLevel ? `- Activity level: ${preferences.activityLevel}` : ''}
    ${preferences.weightGoal ? `- Weight goal: ${preferences.weightGoal}` : ''}

    ${contextPrompt}

    Return a COMPLETE ${mealType} recipe name and nutrition in the following JSON structure. ONLY include the fields shown:
    {
      "meal": "${mealType}",
      "time": "${mealType === 'Breakfast' ? '08:00' : mealType === 'Lunch' ? '12:30' : '18:30'}", 
      "recipe": {
        "name": "Unique Meal Name for ${currentDayName} ${mealType}",
        "nutrition": {"calories": ${mealTargetCalories}, "protein": 20, "carbs": 30, "fats": 10} 
      }
    }

    CRITICAL GUIDELINES:
    1. The meal NAME MUST be for ${mealType} on ${currentDayName}.
    2. Create a UNIQUE meal NAME, different from the context meals provided (if any).
    3. Calories should approximate ${mealTargetCalories}.
    4. Return ONLY valid JSON - no markdown formatting, no explanations, no comments.
    5. DO NOT use placeholder values like "Unique Meal Name Here". Provide real, distinct meal names.
    6. The meal NAME MUST be for authentic ${preferences.countryRegion || 'international'} cuisine.
    7. DO NOT include ingredients, instructions, shopping lists, or meal prep tips in the JSON output.
    8. Ensure all strings are correctly quoted and escaped. Ensure all objects and arrays are correctly closed. The output MUST be parsable by a standard JSON parser.
    `;

    const maxAttempts = 2; // Fewer attempts for a single meal
    let attempt = 0;
    let lastError: Error | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    while (attempt < maxAttempts) {
      attempt++;
      console.log(`[PydanticMealPlanGenerator] SingleMeal Generation attempt ${attempt}/${maxAttempts} for ${currentDayName} ${mealType}`);
      try {
        const controller = new AbortController();
        const timeoutMs = 30000; // 30-second timeout for a single meal
        timeoutId = setTimeout(() => { controller.abort(); console.log(`[PydanticMealPlanGenerator] SingleMeal request timed out for ${currentDayName} ${mealType}`); }, timeoutMs);

        const result = await this.generativeModel.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json", // Ensure JSON output is requested
            temperature: 0.5, 
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 2048
          }
        }, { signal: controller.signal });
        if (timeoutId) clearTimeout(timeoutId);

        let text = result?.response?.text() || '';
        if (!text) throw new Error("Empty response from model for SingleMeal");

        // Extract and parse JSON using the new repair function
        const json = this._extractAndRepairJson(text, `generateSingleMeal-${currentDayName}-${mealType}`);
        
        // Validate the single meal (schema validation)
        const validatedMeal = MealSchema.parse(json);
        console.log(`[PydanticMealPlanGenerator] Successfully generated and validated SingleMeal for ${currentDayName} ${mealType}`);
        return validatedMeal;

      } catch (error) {
        console.error(`[PydanticMealPlanGenerator] API error on SingleMeal attempt ${attempt} for ${currentDayName} ${mealType}:`, error);
        lastError = error as Error;
        let retryErrorMessage = (error instanceof Error) ? error.message?.toLowerCase() || '' : String(error).toLowerCase();
        const isRateLimit = retryErrorMessage.includes('rate') && retryErrorMessage.includes('limit');
        const isTimeout = retryErrorMessage.includes('abort') || retryErrorMessage.includes('timeout');
        if (timeoutId) clearTimeout(timeoutId);

        if ((isRateLimit || isTimeout) && attempt < maxAttempts) {
          const backoffSeconds = Math.pow(2, attempt) + Math.random(); 
          console.log(`[PydanticMealPlanGenerator] Backing off for ${backoffSeconds.toFixed(1)}s for ${currentDayName} ${mealType} (SingleMeal)`);
          await new Promise(resolve => setTimeout(resolve, backoffSeconds * 1000));
        } else if (attempt >= maxAttempts) {
          break; 
        }
      }
    }
    console.error(`[PydanticMealPlanGenerator] All SingleMeal generation attempts failed for ${currentDayName} ${mealType}. Last error: ${lastError?.message}`);
    throw lastError || new Error(`Failed to generate SingleMeal for ${currentDayName} ${mealType} after ${maxAttempts} attempts`);
  }

  /**
   * Generates all meals of a specific type (e.g., all breakfasts) for the week.
   * This method orchestrates calls to generateSingleMealForDay for each day.
   */
  async generateAllMealsOfTypeForWeek(preferences: UserDietPreferences, mealType: string, contextMealsByDay: DailyMeal[][]): Promise<DailyMeal[]> {
    console.log(`[PydanticMealPlanGenerator] Generating all ${mealType}s for the week.`);
    const mealsForWeek: (DailyMeal | null)[] = []; // Allow null for days that fail, then filter

    for (let i = 0; i < 7; i++) {
      try {
        // For context, provide meals of the same type from previous days, and other meals from the current day if available.
        // This is a simplified context for this specific call. More complex context could be built if needed.
        const singleMealContext: DailyMeal[] = [];
        if (contextMealsByDay && contextMealsByDay[i]) {
          // Add other meals from the current day as context
          contextMealsByDay[i].forEach(meal => {
            if (meal.meal !== mealType) { // Only add if it's not the meal type we are currently generating
              singleMealContext.push(meal);
            }
          });
        }
        // Add meals of the same type from previous days (already successfully generated in this loop)
        for(let prevDayIndex = 0; prevDayIndex < i; prevDayIndex++){
            const prevDayMeal = mealsForWeek[prevDayIndex];
            if(prevDayMeal && prevDayMeal.meal === mealType){
                // We could add it, but the prompt for generateSingleMealForDay mainly considers context for *its own day*
                // and overall variety is handled by `reliableMealPlanGenerator` passing context from prior *full days*.
                // So, for now, the context for generateSingleMealForDay is primarily intra-day meals.
            }
        }

        const meal = await this.generateSingleMealForDay(preferences, i, mealType, singleMealContext);
        mealsForWeek.push(meal);
        console.log(`  [PydanticMealPlanGenerator] Successfully generated ${mealType} for day index ${i}.`);
      } catch (error) {
        console.error(`  [PydanticMealPlanGenerator] Failed to generate ${mealType} for day index ${i}:`, error);
        mealsForWeek.push(null); // Add null if a specific day fails, to maintain 7 entries before filtering
      }
    }
    
    const successfullyGeneratedMeals = mealsForWeek.filter(meal => meal !== null) as DailyMeal[];
    if (successfullyGeneratedMeals.length < 7) {
        console.warn(`[PydanticMealPlanGenerator] Only ${successfullyGeneratedMeals.length}/7 ${mealType}s were successfully generated.`);
        // Depending on strictness, could throw error or return partial list.
        // The orchestrator (reliableMealPlanGenerator) will decide how to handle partial success.
    }
    return successfullyGeneratedMeals;
  }

  /**
   * Repairs and enriches an incomplete meal plan. 
   * Focuses on structural completeness and uses existing helpers.
   * True LLM-based targeted repair for content gaps is a potential future enhancement.
   */
  async repairAndEnrichPlan(incompletePlan: Partial<MealPlan>, preferences: UserDietPreferences): Promise<MealPlan> {
    console.log("[PydanticMealPlanGenerator] Attempting to repair and enrich plan.");

    // 1. Ensure basic structure and minimum requirements for the weekly plan component.
    let planToProcess: Partial<MealPlan> = this.ensureMinimumRequirements(incompletePlan || {});

    // 2. Ensure full week coverage if not already present (uses programmatic fill based on templates).
    if (preferences.requireFullWeek && (!planToProcess.weeklyPlan || planToProcess.weeklyPlan.length < 7)) {
      // Cast to MealPlan after ensureMinimumRequirements as it should have basic structure
      // ensureFullWeekCoverage expects a MealPlan but might receive one still being built
      planToProcess = this.ensureFullWeekCoverage(planToProcess as MealPlan, preferences);
    }

    // 3. Ensure unique meals (uses programmatic renaming for duplicates).
    if (preferences.requireUniqueMeals) {
      // ensureUniqueMeals expects a MealPlan
      planToProcess = this.ensureUniqueMeals(planToProcess as MealPlan);
    }

    // 4. Standardize the plan (e.g., recalculate daily nutrition).
    planToProcess = this.standardizeMealPlan(planToProcess);

    // 5. Generate Shopping List if missing (placeholder - ideally an LLM call or derived from ingredients)
    // REMOVED THIS SECTION as shoppingList is no longer part of MealPlan
    // if (!planToProcess.shoppingList || Object.keys(planToProcess.shoppingList).length === 0) {
    //   console.log("[PydanticMealPlanGenerator] Shopping list missing or empty. Generating a basic one.");
    //   const allIngredients = new Set<string>();
    //   planToProcess.weeklyPlan?.forEach(day => {
    //     day.meals.forEach(meal => {
    //       // meal.recipe.ingredients.forEach(ingredient => allIngredients.add(ingredient)); // ingredients removed
    //     });
    //   });
    //   planToProcess.shoppingList = { // shoppingList removed
    //     protein: [],
    //     produce: [],
    //     grains: [],
    //     dairy: [],
    //     other: [],
    //   };
    //   if (Object.values(planToProcess.shoppingList).every(arr => arr.length === 0)){
    //     // planToProcess.shoppingList = this.ensureMinimumRequirements({}).shoppingList; // shoppingList removed
    //   }
    // }

    // 6. Add meal prep tips and batch cooking recommendations (placeholders)
    // REMOVED THIS SECTION as these properties are no longer part of MealPlan
    // if (!planToProcess.mealPrepTips || planToProcess.mealPrepTips.length === 0) {
    //   planToProcess.mealPrepTips = ["Chop vegetables in advance.", "Cook grains in bulk."];
    // }
    // if (!planToProcess.batchCookingRecommendations || planToProcess.batchCookingRecommendations.length === 0) {
    //   planToProcess.batchCookingRecommendations = ["Make a large batch of quinoa or rice for the week.", "Prepare smoothie packs."];
    // }

    // 7. Final validation against the full MealPlanSchema.
    // The `finalizeMealPlan` method also adds the ID.
    try {
      const finalPlan = this.finalizeMealPlan(MealPlanSchema.parse(planToProcess));
      console.log("[PydanticMealPlanGenerator] Plan successfully repaired, enriched, and validated.");
      return finalPlan;
    } catch (error) {
      console.error("[PydanticMealPlanGenerator] Failed to validate the plan after repair and enrichment:", error);
      console.error("[PydanticMealPlanGenerator] Failing plan object:", JSON.stringify(planToProcess, null, 2));
      // If validation fails, fall back to a very basic static plan to ensure something is returned.
      console.warn("[PydanticMealPlanGenerator] Falling back to a createStaticFallbackPlan due to final validation failure during repair.");
      return this.createStaticFallbackPlan(preferences);
    }
  }

  // --- END: NEW GRANULAR AND FALLBACK METHODS ---
} 