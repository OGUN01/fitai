/**
 * Meal Plan Generator Service
 * 
 * Handles generating personalized meal plans using the Gemini API
 * with advanced error handling and fallback mechanisms.
 */

import gemini from '../../lib/gemini';
import { promptManager } from './promptManager';
import { API_TIMEOUTS } from '../../constants/api';
import { parseJsonFromLLM } from './jsonUtils';

// Type definitions
export interface UserDietPreferences {
  dietType: 'vegetarian' | 'vegan' | 'non-vegetarian' | 'pescatarian' | 'flexitarian';
  dietPlanPreference: 'balanced' | 'high-protein' | 'low-carb' | 'keto' | 'mediterranean';
  allergies: string[];
  mealFrequency: number;
  countryRegion: string;
  fitnessGoal?: 'weight loss' | 'muscle gain' | 'improved fitness' | 'maintenance';
  calorieTarget?: number;
  // Additional preferences
  restrictions?: string[];
  excludedFoods?: string[];
  // Make these optional since we won't pass them to the AI
  preferredMealTimes?: string[];
  waterIntakeGoal?: number;
  // Demographic data
  age?: number;
  gender?: string;
  weight?: number;
  height?: number;
}

export interface MealIngredient {
  name: string;
  quantity: string;
  unit: string;
}

export interface MealNutrition {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

export interface MealRecipe {
  name: string;
  ingredients: MealIngredient[];
  instructions: string[];
  nutrition: MealNutrition;
  prepTime: string;
  alternatives?: string[];
}

export interface DailyMeal {
  meal: string;
  time: string;
  recipe: MealRecipe;
}

export interface DailyPlan {
  day: string;
  meals: DailyMeal[];
  totalNutrition: MealNutrition;
}

export interface ShoppingListCategory {
  category: string;
  items: string[];
}

export interface MealPlan {
  dailyMealPlan: DailyPlan[];
  shoppingList: ShoppingListCategory[];
  mealPrepTips: string[];
}

export interface FallbackMealPlan {
  dailyMealPlan: DailyPlan[];
  shoppingList: ShoppingListCategory[];
  mealPrepTips: string[];
  isFallback: true;
  message: string;
}

export class MealPlanGenerator {
  private static readonly PROMPT_ID = 'meal-plan-generation';
  private static readonly PROMPT_VERSION = 1;
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY_MS = 1000;
  
  /**
   * Generate a personalized meal plan for a user
   */
  async generateMealPlan(preferences: UserDietPreferences): Promise<MealPlan | FallbackMealPlan> {
    // Prepare prompt parameters from user preferences
    const promptParams = {
      dietType: preferences.dietType,
      dietPlanPreference: preferences.dietPlanPreference,
      allergies: preferences.allergies.length > 0 ? preferences.allergies.join(', ') : 'None',
      mealFrequency: preferences.mealFrequency,
      region: preferences.countryRegion,
      fitnessGoal: preferences.fitnessGoal || 'balanced nutrition',
      calorieTarget: preferences.calorieTarget || 'appropriate for goals',
      // Add demographic information for more personalized meal plans
      age: preferences.age || 'Not specified',
      gender: preferences.gender || 'Not specified',
      weight: preferences.weight || 'Not specified',
      height: preferences.height || 'Not specified'
    };
    
    // Get the formatted prompt with parameters
    const prompt = await promptManager.getPrompt(
      MealPlanGenerator.PROMPT_ID, 
      MealPlanGenerator.PROMPT_VERSION, 
      promptParams
    );
    
    // Call the Gemini API with retries
    let attempt = 0;
    let lastError: Error | null = null;
    
    while (attempt < MealPlanGenerator.MAX_RETRIES) {
      try {
        attempt++;
        console.log(`Meal plan generation attempt ${attempt}`);
        
        const result = await this.callGeminiApi(prompt);
        return result;
      } catch (error) {
        console.log(`Meal plan generation attempt ${attempt} failed:`, error);
        lastError = error;
        
        // Wait before retrying
        if (attempt < MealPlanGenerator.MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, MealPlanGenerator.RETRY_DELAY_MS));
        }
      }
    }
    
    // If all attempts failed, create a fallback plan
    console.log("All meal plan generation attempts failed, using fallback plan");
    return this.getFallbackMealPlan(preferences, "All meal plan generation attempts failed");
  }
  
  /**
   * Call the Gemini API to generate a meal plan
   */
  private async callGeminiApi(prompt: string): Promise<MealPlan> {
    try {
      const result = await gemini.generateContent(prompt);
      return this.parseMealPlanResponse(result);
    } catch (error) {
      throw new Error(`Gemini API error: ${error}`);
    }
  }
  
  /**
   * Parse the response from the Gemini API into a meal plan
   */
  private parseMealPlanResponse(response: string): MealPlan {
    try {
      // Use our robust parser instead of direct JSON.parse
      const parsedResponse = parseJsonFromLLM(response);
      
      // Validate the parsed response - this will throw an error if validation fails
      this.validateMealPlan(parsedResponse);
      
      return parsedResponse;
    } catch (error) {
      console.error('Error parsing meal plan response:', error);
      throw new Error(`Failed to parse meal plan: ${error.message}`);
    }
  }
  
  /**
   * Validate that the meal plan has all required fields and structure
   */
  private validateMealPlan(plan: any): void {
    if (!plan) {
      throw new Error('Parsed response is null or undefined');
    }
    
    // Basic structure validation
    if (!Array.isArray(plan.dailyMealPlan)) {
      throw new Error('Meal plan is missing dailyMealPlan array');
    }
    
    if (!Array.isArray(plan.shoppingList)) {
      throw new Error('Meal plan is missing shoppingList array');
    }
    
    if (!Array.isArray(plan.mealPrepTips)) {
      throw new Error('Meal plan is missing mealPrepTips array');
    }
    
    // Check that meal plan has valid days
    if (plan.dailyMealPlan.length === 0) {
      throw new Error('Meal plan has no days defined');
    }
    
    for (const day of plan.dailyMealPlan) {
      if (!day.day || !Array.isArray(day.meals) || !day.totalNutrition) {
        throw new Error(`Invalid day in meal plan: ${JSON.stringify(day)}`);
      }
      
      // Check each meal has required fields
      for (const meal of day.meals) {
        if (!meal.meal || !meal.time || !meal.recipe) {
          throw new Error(`Invalid meal in meal plan: ${JSON.stringify(meal)}`);
        }
        
        // Check recipe
        const recipe = meal.recipe;
        if (!recipe.name || !Array.isArray(recipe.ingredients) || 
            !Array.isArray(recipe.instructions) || !recipe.nutrition) {
          throw new Error(`Invalid recipe in meal plan: ${JSON.stringify(recipe)}`);
        }
      }
    }
  }
  
  /**
   * Get a fallback meal plan when AI generation fails
   */
  private getFallbackMealPlan(preferences: UserDietPreferences, errorMessage: string): FallbackMealPlan {
    // Create a basic fallback plan based on user preferences
    const fallbackPlan: FallbackMealPlan = {
      dailyMealPlan: this.createFallbackMeals(preferences),
      shoppingList: this.createFallbackShoppingList(preferences),
      mealPrepTips: [
        'Prep vegetables in advance and store in airtight containers',
        'Cook grains and proteins in batches for easy meal assembly',
        'Use single-ingredient foods when possible for simplicity',
        'Invest in quality food storage containers for portion control',
        'Set aside 2-3 hours on weekends for efficient meal prep'
      ],
      isFallback: true,
      message: `We couldn't generate a custom meal plan at this time: ${errorMessage}. Here's a general plan instead.`
    };
    
    return fallbackPlan;
  }
  
  /**
   * Create basic fallback meals based on user preferences
   */
  private createFallbackMeals(preferences: UserDietPreferences): DailyPlan[] {
    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const dailyPlans: DailyPlan[] = [];
    
    // Create a plan for each day of the week
    for (const day of daysOfWeek) {
      const dailyMeals = this.getFallbackMealsForDay(preferences);
      
      // Calculate total nutrition
      const totalNutrition: MealNutrition = {
        calories: dailyMeals.reduce((sum, meal) => sum + meal.recipe.nutrition.calories, 0),
        protein: dailyMeals.reduce((sum, meal) => sum + meal.recipe.nutrition.protein, 0),
        carbs: dailyMeals.reduce((sum, meal) => sum + meal.recipe.nutrition.carbs, 0),
        fats: dailyMeals.reduce((sum, meal) => sum + meal.recipe.nutrition.fats, 0)
      };
      
      dailyPlans.push({
        day,
        meals: dailyMeals,
        totalNutrition
      });
    }
    
    return dailyPlans;
  }
  
  /**
   * Get fallback meals for a single day
   */
  private getFallbackMealsForDay(preferences: UserDietPreferences): DailyMeal[] {
    const mealsForDay: DailyMeal[] = [];
    const mealTypes = this.determineMealTypes(preferences.mealFrequency);
    
    // Create meals based on frequency
    for (let i = 0; i < mealTypes.length; i++) {
      const mealType = mealTypes[i];
      const mealTime = this.getDefaultMealTime(mealType);
      const recipe = this.getFallbackRecipe(mealType, preferences);
      
      mealsForDay.push({
        meal: mealType,
        time: mealTime,
        recipe
      });
    }
    
    return mealsForDay;
  }
  
  /**
   * Determine meal types based on frequency
   */
  private determineMealTypes(frequency: number): string[] {
    switch (frequency) {
      case 1:
        return ['Lunch'];
      case 2:
        return ['Breakfast', 'Dinner'];
      case 3:
        return ['Breakfast', 'Lunch', 'Dinner'];
      case 4:
        return ['Breakfast', 'Lunch', 'Snack', 'Dinner'];
      case 5:
        return ['Breakfast', 'Morning Snack', 'Lunch', 'Afternoon Snack', 'Dinner'];
      case 6:
        return ['Breakfast', 'Morning Snack', 'Lunch', 'Afternoon Snack', 'Dinner', 'Evening Snack'];
      default:
        return ['Breakfast', 'Lunch', 'Dinner'];
    }
  }
  
  /**
   * Get default meal time for meal type
   */
  private getDefaultMealTime(mealType: string): string {
    switch (mealType) {
      case 'Breakfast':
        return '8:00 AM';
      case 'Morning Snack':
        return '10:30 AM';
      case 'Lunch':
        return '1:00 PM';
      case 'Afternoon Snack':
        return '4:00 PM';
      case 'Dinner':
        return '7:00 PM';
      case 'Evening Snack':
        return '9:00 PM';
      default:
        return '12:00 PM';
    }
  }
  
  /**
   * Get fallback recipe for meal type
   */
  private getFallbackRecipe(mealType: string, preferences: UserDietPreferences): MealRecipe {
    // Select appropriate recipe based on meal type and diet preferences
    switch (mealType) {
      case 'Breakfast':
        return this.getFallbackBreakfast(preferences);
      case 'Lunch':
        return this.getFallbackLunch(preferences);
      case 'Dinner':
        return this.getFallbackDinner(preferences);
      case 'Morning Snack':
      case 'Afternoon Snack':
      case 'Evening Snack':
      case 'Snack':
        return this.getFallbackSnack(preferences);
      default:
        return this.getFallbackLunch(preferences);
    }
  }
  
  /**
   * Create a fallback breakfast recipe
   */
  private getFallbackBreakfast(preferences: UserDietPreferences): MealRecipe {
    // Different defaults based on diet type
    if (preferences.dietType === 'vegan') {
      return {
        name: 'Overnight Oats with Fruit',
        ingredients: [
          { name: 'Rolled oats', quantity: '1/2', unit: 'cup' },
          { name: 'Plant-based milk', quantity: '1/2', unit: 'cup' },
          { name: 'Chia seeds', quantity: '1', unit: 'tbsp' },
          { name: 'Banana', quantity: '1/2', unit: 'medium' },
          { name: 'Berries', quantity: '1/4', unit: 'cup' },
          { name: 'Maple syrup', quantity: '1', unit: 'tsp' }
        ],
        instructions: [
          'Combine oats, plant milk, and chia seeds in a jar',
          'Stir well and refrigerate overnight',
          'In the morning, top with sliced banana, berries, and a drizzle of maple syrup'
        ],
        nutrition: {
          calories: 350,
          protein: 10,
          carbs: 60,
          fats: 8
        },
        prepTime: '5 minutes (plus overnight soaking)'
      };
    } else {
      return {
        name: 'Greek Yogurt Parfait',
        ingredients: [
          { name: 'Greek yogurt', quantity: '1', unit: 'cup' },
          { name: 'Granola', quantity: '1/4', unit: 'cup' },
          { name: 'Mixed berries', quantity: '1/2', unit: 'cup' },
          { name: 'Honey', quantity: '1', unit: 'tsp' }
        ],
        instructions: [
          'Layer Greek yogurt in a glass or bowl',
          'Add granola and berries',
          'Drizzle with honey'
        ],
        nutrition: {
          calories: 300,
          protein: 20,
          carbs: 40,
          fats: 5
        },
        prepTime: '5 minutes'
      };
    }
  }
  
  /**
   * Create a fallback lunch recipe
   */
  private getFallbackLunch(preferences: UserDietPreferences): MealRecipe {
    if (preferences.dietType === 'vegetarian' || preferences.dietType === 'vegan') {
      return {
        name: 'Quinoa Buddha Bowl',
        ingredients: [
          { name: 'Quinoa', quantity: '1/2', unit: 'cup' },
          { name: 'Mixed vegetables', quantity: '1', unit: 'cup' },
          { name: 'Chickpeas', quantity: '1/2', unit: 'cup' },
          { name: 'Avocado', quantity: '1/4', unit: 'medium' },
          { name: 'Lemon juice', quantity: '1', unit: 'tbsp' },
          { name: 'Olive oil', quantity: '1', unit: 'tsp' },
          { name: 'Salt and pepper', quantity: '1', unit: 'pinch' }
        ],
        instructions: [
          'Cook quinoa according to package instructions',
          'Roast or steam mixed vegetables',
          'Combine all ingredients in a bowl',
          'Dress with lemon juice, olive oil, salt, and pepper'
        ],
        nutrition: {
          calories: 400,
          protein: 15,
          carbs: 55,
          fats: 12
        },
        prepTime: '20 minutes'
      };
    } else {
      return {
        name: 'Grilled Chicken Salad',
        ingredients: [
          { name: 'Chicken breast', quantity: '4', unit: 'oz' },
          { name: 'Mixed greens', quantity: '2', unit: 'cups' },
          { name: 'Cherry tomatoes', quantity: '1/2', unit: 'cup' },
          { name: 'Cucumber', quantity: '1/2', unit: 'medium' },
          { name: 'Balsamic vinaigrette', quantity: '1', unit: 'tbsp' }
        ],
        instructions: [
          'Grill chicken breast until fully cooked',
          'Combine mixed greens, halved cherry tomatoes, and sliced cucumber in a bowl',
          'Slice chicken and add to salad',
          'Drizzle with balsamic vinaigrette'
        ],
        nutrition: {
          calories: 350,
          protein: 35,
          carbs: 10,
          fats: 15
        },
        prepTime: '15 minutes'
      };
    }
  }
  
  /**
   * Create a fallback dinner recipe
   */
  private getFallbackDinner(preferences: UserDietPreferences): MealRecipe {
    if (preferences.dietType === 'vegetarian') {
      return {
        name: 'Vegetable Stir Fry with Tofu',
        ingredients: [
          { name: 'Firm tofu', quantity: '4', unit: 'oz' },
          { name: 'Broccoli', quantity: '1', unit: 'cup' },
          { name: 'Bell pepper', quantity: '1/2', unit: 'medium' },
          { name: 'Carrots', quantity: '1/2', unit: 'cup' },
          { name: 'Brown rice', quantity: '1/2', unit: 'cup' },
          { name: 'Soy sauce', quantity: '1', unit: 'tbsp' },
          { name: 'Garlic', quantity: '2', unit: 'cloves' },
          { name: 'Ginger', quantity: '1', unit: 'tsp' }
        ],
        instructions: [
          'Press and cube tofu, then sauté until golden',
          'Stir-fry vegetables with minced garlic and ginger',
          'Add tofu back to pan with soy sauce',
          'Serve over cooked brown rice'
        ],
        nutrition: {
          calories: 400,
          protein: 20,
          carbs: 45,
          fats: 15
        },
        prepTime: '25 minutes'
      };
    } else if (preferences.dietType === 'vegan') {
      return {
        name: 'Lentil and Vegetable Curry',
        ingredients: [
          { name: 'Red lentils', quantity: '1/2', unit: 'cup' },
          { name: 'Coconut milk', quantity: '1/2', unit: 'cup' },
          { name: 'Mixed vegetables', quantity: '1', unit: 'cup' },
          { name: 'Curry powder', quantity: '1', unit: 'tbsp' },
          { name: 'Onion', quantity: '1/2', unit: 'medium' },
          { name: 'Garlic', quantity: '2', unit: 'cloves' },
          { name: 'Brown rice', quantity: '1/2', unit: 'cup' }
        ],
        instructions: [
          'Sauté diced onion and minced garlic',
          'Add curry powder and cook until fragrant',
          'Add lentils, vegetables, and coconut milk',
          'Simmer until lentils are tender',
          'Serve over brown rice'
        ],
        nutrition: {
          calories: 450,
          protein: 18,
          carbs: 65,
          fats: 14
        },
        prepTime: '30 minutes'
      };
    } else {
      return {
        name: 'Baked Salmon with Roasted Vegetables',
        ingredients: [
          { name: 'Salmon fillet', quantity: '4', unit: 'oz' },
          { name: 'Asparagus', quantity: '1', unit: 'cup' },
          { name: 'Sweet potato', quantity: '1/2', unit: 'medium' },
          { name: 'Olive oil', quantity: '1', unit: 'tbsp' },
          { name: 'Lemon', quantity: '1/2', unit: 'medium' },
          { name: 'Dill', quantity: '1', unit: 'tsp' },
          { name: 'Salt and pepper', quantity: '1', unit: 'pinch' }
        ],
        instructions: [
          'Preheat oven to 400°F (200°C)',
          'Place salmon on a baking sheet, drizzle with olive oil',
          'Season with dill, salt, pepper, and lemon slices',
          'Toss vegetables in olive oil, salt, and pepper',
          'Bake salmon and roast vegetables until done'
        ],
        nutrition: {
          calories: 400,
          protein: 30,
          carbs: 25,
          fats: 20
        },
        prepTime: '30 minutes'
      };
    }
  }
  
  /**
   * Create a fallback snack recipe
   */
  private getFallbackSnack(preferences: UserDietPreferences): MealRecipe {
    if (preferences.dietType === 'vegan') {
      return {
        name: 'Apple with Almond Butter',
        ingredients: [
          { name: 'Apple', quantity: '1', unit: 'medium' },
          { name: 'Almond butter', quantity: '1', unit: 'tbsp' }
        ],
        instructions: [
          'Slice apple into wedges',
          'Serve with almond butter for dipping'
        ],
        nutrition: {
          calories: 200,
          protein: 5,
          carbs: 25,
          fats: 10
        },
        prepTime: '2 minutes'
      };
    } else {
      return {
        name: 'Greek Yogurt with Honey and Nuts',
        ingredients: [
          { name: 'Greek yogurt', quantity: '1/2', unit: 'cup' },
          { name: 'Honey', quantity: '1', unit: 'tsp' },
          { name: 'Mixed nuts', quantity: '1', unit: 'tbsp' }
        ],
        instructions: [
          'Top Greek yogurt with honey and mixed nuts'
        ],
        nutrition: {
          calories: 150,
          protein: 12,
          carbs: 10,
          fats: 7
        },
        prepTime: '1 minute'
      };
    }
  }
  
  /**
   * Create a fallback shopping list
   */
  private createFallbackShoppingList(preferences: UserDietPreferences): ShoppingListCategory[] {
    // Create a basic shopping list based on diet type
    if (preferences.dietType === 'vegan') {
      return [
        {
          category: 'Fruits',
          items: ['Bananas', 'Apples', 'Berries', 'Lemons']
        },
        {
          category: 'Vegetables',
          items: ['Broccoli', 'Carrots', 'Bell peppers', 'Spinach', 'Onions', 'Garlic']
        },
        {
          category: 'Grains',
          items: ['Rolled oats', 'Quinoa', 'Brown rice']
        },
        {
          category: 'Proteins',
          items: ['Tofu', 'Lentils', 'Chickpeas', 'Almonds', 'Chia seeds']
        },
        {
          category: 'Other',
          items: ['Plant-based milk', 'Coconut milk', 'Maple syrup', 'Olive oil', 'Soy sauce', 'Curry powder']
        }
      ];
    } else if (preferences.dietType === 'vegetarian') {
      return [
        {
          category: 'Fruits',
          items: ['Bananas', 'Apples', 'Berries']
        },
        {
          category: 'Vegetables',
          items: ['Broccoli', 'Carrots', 'Bell peppers', 'Spinach', 'Onions', 'Garlic']
        },
        {
          category: 'Grains',
          items: ['Rolled oats', 'Quinoa', 'Brown rice']
        },
        {
          category: 'Proteins',
          items: ['Greek yogurt', 'Eggs', 'Tofu', 'Chickpeas']
        },
        {
          category: 'Other',
          items: ['Honey', 'Olive oil', 'Soy sauce', 'Granola']
        }
      ];
    } else {
      return [
        {
          category: 'Fruits',
          items: ['Apples', 'Berries', 'Lemons']
        },
        {
          category: 'Vegetables',
          items: ['Broccoli', 'Asparagus', 'Sweet potatoes', 'Mixed greens', 'Cherry tomatoes', 'Cucumber']
        },
        {
          category: 'Grains',
          items: ['Brown rice', 'Quinoa']
        },
        {
          category: 'Proteins',
          items: ['Chicken breast', 'Salmon', 'Greek yogurt', 'Eggs']
        },
        {
          category: 'Other',
          items: ['Olive oil', 'Balsamic vinaigrette', 'Honey', 'Granola', 'Mixed nuts']
        }
      ];
    }
  }
} 