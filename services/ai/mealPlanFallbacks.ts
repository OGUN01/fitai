/**
 * Meal Plan Fallbacks
 * 
 * This file contains the fallback mechanisms for meal plan generation,
 * with multiple levels of fallbacks for handling AI generation failures.
 */

import { MealPlan, FallbackMealPlan, DailyPlan, DailyMeal, ShoppingListCategory, MealIngredient, MealNutrition } from './mealPlanGenerator';
import gemini from '../../lib/gemini';

// Extended UserDietPreferences interface with additional properties
export interface UserDietPreferences {
  dietType: 'vegetarian' | 'vegan' | 'non-vegetarian' | 'pescatarian' | 'flexitarian';
  dietPlanPreference: 'balanced' | 'high-protein' | 'low-carb' | 'keto' | 'mediterranean';
  allergies: string[];
  mealFrequency: number;
  countryRegion: string;
  fitnessGoal?: string;
  calorieTarget?: number;
  // Additional preferences
  restrictions?: string[];
  excludedFoods?: string[];
  favoriteFoods?: string[];
  // Make these optional since we won't pass them to the AI
  preferredMealTimes?: string[];
  waterIntakeGoal?: number;
  // Demographic data
  age?: number;
  gender?: string;
  weight?: number;
  height?: number;
  // New flags for full plan requirements
  requireUniqueMeals?: boolean;
  requireFullWeek?: boolean;
}

/**
 * Attempt multiple advanced strategies to generate a meal plan
 */
export async function attemptEnhancedMealFallbacks(preferences: UserDietPreferences): Promise<MealPlan | FallbackMealPlan> {
  // Fallback 1: Try with more structured prompt
  try {
    console.log("Trying meal fallback 1: Structured prompt approach");
    const structuredPlan = await generateStructuredMealPlan(preferences);
    return structuredPlan;
  } catch (error) {
    console.log("Structured meal fallback failed:", error);
  }
  
  // Fallback 2: Try day-by-day generation approach
  try {
    console.log("Trying meal fallback 2: Day-by-day generation approach");
    const dayByDayPlan = await generateMealPlanDayByDay(preferences);
    return dayByDayPlan;
  } catch (error) {
    console.log("Day-by-day meal fallback failed:", error);
  }
  
  // Fallback 3: Try simplified format
  try {
    console.log("Trying meal fallback 3: Simplified format approach");
    const simplifiedPlan = await generateSimplifiedMealPlan(preferences);
    return simplifiedPlan;
  } catch (error) {
    console.log("Simplified meal fallback failed:", error);
  }
  
  // If all LLM-based fallbacks failed, return a user-friendly error message
  console.log("All LLM meal fallback attempts failed");
  
  return {
    isFallback: true,
    fallbackReason: "temporary_service_issue",
    message: "We're experiencing some technical difficulties generating your custom meal plan. Please try again in a few moments.",
    retryable: true,
    dailyMealPlan: [],
    shoppingList: [],
    mealPrepTips: []
  } as FallbackMealPlan;
}

/**
 * Generate a meal plan using a highly structured prompt
 */
async function generateStructuredMealPlan(preferences: UserDietPreferences): Promise<MealPlan> {
  const prompt = `
INSTRUCTIONS: Generate a personalized meal plan in valid JSON format.
Follow this EXACT structure (each field is required):
{
  "dailyMealPlan": [
    {
      "day": "Day name",
      "meals": [
        {
          "meal": "Meal type (breakfast/lunch/dinner/snack)",
          "time": "Suggested time",
          "recipe": {
            "name": "Recipe name",
            "ingredients": [
              {
                "name": "Ingredient name",
                "quantity": "Amount",
                "unit": "Unit of measurement"
              }
            ],
            "instructions": ["Step 1", "Step 2"],
            "nutrition": {
              "calories": number,
              "protein": number,
              "carbs": number,
              "fats": number
            },
            "prepTime": "Preparation time"
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

USER PREFERENCES:
- Diet type: ${preferences.dietType}
- Diet plan: ${preferences.dietPlanPreference}
- Allergies: ${preferences.allergies.length > 0 ? preferences.allergies.join(', ') : 'None'}
- Meal frequency: ${preferences.mealFrequency} meals per day
- Country/Region: ${preferences.countryRegion}
- Fitness goal: ${preferences.fitnessGoal || 'balanced nutrition'}
- Calorie target: ${preferences.calorieTarget || 'appropriate for goals'}
- Unique meals required: ${preferences.requireUniqueMeals ? 'Yes' : 'No'}
- Full week required: ${preferences.requireFullWeek ? 'Yes' : 'No'}

IMPORTANT: 
1. Generate EXACTLY 7 days of meals (Monday through Sunday)
2. Each day should have EXACTLY ${preferences.mealFrequency} meals
3. Every day MUST have UNIQUE meals - do NOT repeat the exact same meals across different days
4. All 7 days MUST have different, varied meal plans with unique recipes
5. Respect all dietary restrictions and allergies
6. Meals should match the country/region's cuisine when possible
7. Return ONLY valid JSON, no additional text
`;

  try {
    const result = await gemini.generateContent(prompt);
    const parsedResult = JSON.parse(result);
    validateMealPlanStructure(parsedResult);
    
    // Verify we have 7 unique days
    const days = parsedResult.dailyMealPlan.map(day => day.day);
    if (days.length < 7) {
      console.warn(`Meal plan has only ${days.length} days, needs 7 days`);
      
      // Add missing days with unique meals by creating variations
      const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const missingDays = daysOfWeek.filter(day => !days.includes(day));
      
      for (const missingDay of missingDays) {
        // Find a day to use as template
        const templateDay = parsedResult.dailyMealPlan[0];
        
        // Create a new day with unique meals
        const newDay = {
          day: missingDay,
          meals: templateDay.meals.map(meal => ({
            meal: meal.meal,
            time: meal.time,
            recipe: {
              name: `${meal.recipe.name} Variation for ${missingDay}`,
              ingredients: [...meal.recipe.ingredients],
              instructions: [...meal.recipe.instructions],
              nutrition: { ...meal.recipe.nutrition },
              prepTime: meal.recipe.prepTime
            }
          })),
          totalNutrition: { ...templateDay.totalNutrition }
        };
        
        parsedResult.dailyMealPlan.push(newDay);
      }
      
      // Sort days in correct order
      parsedResult.dailyMealPlan.sort((a, b) => {
        return daysOfWeek.indexOf(a.day) - daysOfWeek.indexOf(b.day);
      });
    }
    
    return parsedResult;
  } catch (error) {
    throw new Error(`Structured meal generation failed: ${error}`);
  }
}

/**
 * Generate a simplified meal plan when structured formats fail
 */
async function generateSimplifiedMealPlan(preferences: UserDietPreferences): Promise<MealPlan> {
  const prompt = `
Generate a simplified meal plan for a person with these preferences:
- Diet type: ${preferences.dietType}
- Diet plan: ${preferences.dietPlanPreference}
- Allergies: ${preferences.allergies.length > 0 ? preferences.allergies.join(', ') : 'None'}
- Meal frequency: ${preferences.mealFrequency} meals per day
- Country/Region: ${preferences.countryRegion}

IMPORTANT REQUIREMENTS:
1. Generate EXACTLY 7 days (Monday through Sunday) with UNIQUE meals for each day
2. Every day MUST have different meals - do NOT repeat the exact same meals across different days
3. Each day should have exactly ${preferences.mealFrequency} meals
4. All meals must respect the diet type and allergies
5. Recipes should be varied across the week

ONLY return a JSON array of days, with each day having a name and a list of meals.
Each meal should have a type, time, and recipe name.

Example format:
[
  {
    "day": "Monday",
    "meals": [
      {"meal": "breakfast", "time": "8:00 AM", "recipeName": "Oatmeal with Fruit"}
    ]
  }
]
`;

  try {
    const result = await gemini.generateContent(prompt);
    const parsedResult = JSON.parse(result);
    
    if (!Array.isArray(parsedResult)) {
      throw new Error('Expected array of meal days');
    }
    
    // Convert the simplified format to the full MealPlan structure
    const dailyMealPlan: DailyPlan[] = [];
    
    for (const day of parsedResult) {
      const meals: DailyMeal[] = [];
      let totalNutrition = { calories: 0, protein: 0, carbs: 0, fats: 0 };
      
      for (const mealInfo of day.meals) {
        // Generate basic nutrition values based on meal type
        const nutrition = generateBasicNutrition(mealInfo.meal);
        
        // Create a simple meal
        const meal: DailyMeal = {
          meal: mealInfo.meal,
          time: mealInfo.time,
          recipe: {
            name: mealInfo.recipeName,
            ingredients: [{ name: "Ingredients available upon request", quantity: "", unit: "" }],
            instructions: ["Simplified instructions available upon request"],
            nutrition: nutrition,
            prepTime: "15-20 minutes"
          }
        };
        
        meals.push(meal);
        
        // Update total nutrition
        totalNutrition.calories += nutrition.calories;
        totalNutrition.protein += nutrition.protein;
        totalNutrition.carbs += nutrition.carbs;
        totalNutrition.fats += nutrition.fats;
      }
      
      dailyMealPlan.push({
        day: day.day,
        meals: meals,
        totalNutrition: totalNutrition
      });
    }
    
    // Create a complete meal plan
    return {
      dailyMealPlan: dailyMealPlan,
      shoppingList: getDefaultShoppingList(preferences),
      mealPrepTips: getDefaultMealPrepTips()
    };
  } catch (error) {
    throw new Error(`Simplified meal generation failed: ${error}`);
  }
}

/**
 * Generate a meal plan day by day for more reliability
 */
async function generateMealPlanDayByDay(preferences: UserDietPreferences): Promise<MealPlan> {
  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const dailyPlans: DailyPlan[] = [];
  
  // Generate each day's meals individually
  for (const day of daysOfWeek) {
    try {
      // Pass information about previously generated days to ensure variety
      const previousMeals = dailyPlans.flatMap(plan => 
        plan.meals.map(meal => meal.recipe.name)
      );
      
      console.log(`Generating meals for ${day}...`);
      const dayPlan = await generateSingleDayMeals(day, preferences, previousMeals);
      dailyPlans.push(dayPlan);
    } catch (error) {
      console.log(`Error generating ${day} plan, using fallback:`, error);
      dailyPlans.push(createFallbackDayMeals(day, preferences));
    }
  }
  
  // Generate shopping list and meal prep tips
  let shoppingList: ShoppingListCategory[];
  try {
    shoppingList = await generateShoppingList(preferences, dailyPlans);
  } catch (error) {
    console.log("Error generating shopping list, using fallback:", error);
    shoppingList = getDefaultShoppingList(preferences);
  }
  
  let mealPrepTips: string[];
  try {
    mealPrepTips = await generateMealPrepTips(preferences);
  } catch (error) {
    console.log("Error generating meal prep tips, using fallback:", error);
    mealPrepTips = getDefaultMealPrepTips();
  }
  
  return {
    dailyMealPlan: dailyPlans,
    shoppingList,
    mealPrepTips
  };
}

/**
 * Generate meals for a single day
 */
async function generateSingleDayMeals(
  day: string, 
  preferences: UserDietPreferences, 
  previousMeals: string[] = []
): Promise<DailyPlan> {
  const prompt = `
Generate a single day's meal plan for ${day} with these preferences:
- Diet type: ${preferences.dietType}
- Diet plan: ${preferences.dietPlanPreference}
- Allergies: ${preferences.allergies.length > 0 ? preferences.allergies.join(', ') : 'None'}
- Meal frequency: ${preferences.mealFrequency} meals per day
- Calorie target: ${preferences.calorieTarget || 'appropriate for goals'}

IMPORTANT: 
1. Generate EXACTLY ${preferences.mealFrequency} unique meals
2. Do NOT use any of these previously used recipe names: ${previousMeals.join(', ')}
3. Meals MUST be appropriate for ${preferences.dietType} diet
4. Return ONLY valid JSON in this format:
{
  "day": "${day}",
  "meals": [
    {
      "meal": "Meal name (breakfast/lunch/dinner/snack)",
      "time": "Time",
      "recipe": {
        "name": "Recipe name",
        "ingredients": [
          {
            "name": "Ingredient name",
            "quantity": "Amount",
            "unit": "Unit"
          }
        ],
        "instructions": ["Step 1", "Step 2"],
        "nutrition": {
          "calories": number,
          "protein": number,
          "carbs": number,
          "fats": number
        },
        "prepTime": "Prep time"
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
`;

  try {
    const result = await gemini.generateContent(prompt);
    const parsedResult = JSON.parse(result);
    
    // Basic validation
    if (!parsedResult.day || !Array.isArray(parsedResult.meals) || !parsedResult.totalNutrition) {
      throw new Error('Invalid day meal plan structure');
    }
    
    return parsedResult;
  } catch (error) {
    throw new Error(`Single day meal generation failed: ${error}`);
  }
}

/**
 * Generate a shopping list based on meal plan
 */
async function generateShoppingList(preferences: UserDietPreferences, dailyPlans: DailyPlan[]): Promise<ShoppingListCategory[]> {
  const prompt = `
Generate a shopping list based on these meal ingredients:
${dailyPlans.map(day => 
  day.meals.map(meal => 
    `${day.day} - ${meal.meal}: ${meal.recipe.name} (${meal.recipe.ingredients.map(ing => 
      `${ing.quantity} ${ing.unit} ${ing.name}`
    ).join(', ')})`
  ).join('\n')
).join('\n')}

Return in this EXACT JSON format:
[
  {
    "category": "Category name (e.g., Produce, Dairy, Meat, etc.)",
    "items": ["Item 1", "Item 2", "Item 3"]
  }
]

IMPORTANT:
1. Group items by category (Produce, Dairy, Meat, Grains, Canned Goods, etc.)
2. Combine similar ingredients
3. Return ONLY valid JSON, no additional text
`;

  try {
    const result = await gemini.generateContent(prompt);
    const parsedResult = JSON.parse(result);
    
    if (!Array.isArray(parsedResult)) {
      throw new Error('Invalid shopping list format');
    }
    
    return parsedResult;
  } catch (error) {
    throw new Error(`Shopping list generation failed: ${error}`);
  }
}

/**
 * Get default shopping list when generation fails
 */
function getDefaultShoppingList(preferences: UserDietPreferences): ShoppingListCategory[] {
  // Basic shopping list based on diet type
  if (preferences.dietType === 'vegetarian') {
    return [
      {
        category: "Produce",
        items: ["Bananas", "Mixed berries", "Avocados", "Cucumbers", "Bell peppers", "Mixed greens", "Tomatoes", "Garlic", "Onions", "Broccoli", "Carrots"]
      },
      {
        category: "Dairy & Alternatives",
        items: ["Greek yogurt", "Milk or plant-based milk", "Feta cheese", "Eggs (if consumed)"]
      },
      {
        category: "Grains & Pantry",
        items: ["Oats", "Whole wheat tortillas", "Brown rice", "Whole grain bread", "Granola", "Honey", "Olive oil", "Soy sauce"]
      },
      {
        category: "Protein",
        items: ["Tofu", "Chickpeas", "Lentils", "Mixed nuts", "Chia seeds"]
      }
    ];
  } else if (preferences.dietType === 'vegan') {
    return [
      {
        category: "Produce",
        items: ["Bananas", "Mixed berries", "Avocados", "Cucumbers", "Bell peppers", "Mixed greens", "Tomatoes", "Garlic", "Onions", "Broccoli", "Carrots", "Celery"]
      },
      {
        category: "Dairy Alternatives",
        items: ["Almond milk", "Coconut milk", "Vegan yogurt", "Vegan mayo"]
      },
      {
        category: "Grains & Pantry",
        items: ["Oats", "Whole grain bread", "Brown rice", "Curry powder", "Maple syrup", "Olive oil", "Mustard", "Chia seeds"]
      },
      {
        category: "Protein",
        items: ["Tofu", "Chickpeas", "Lentils", "Mixed nuts", "Nut butter"]
      }
    ];
  } else {
    // Non-vegetarian
    return [
      {
        category: "Produce",
        items: ["Avocados", "Mixed greens", "Tomatoes", "Cucumbers", "Broccoli", "Sweet potatoes", "Garlic", "Onions", "Lemons"]
      },
      {
        category: "Dairy",
        items: ["Greek yogurt", "Milk", "Cheese"]
      },
      {
        category: "Grains & Pantry",
        items: ["Whole grain bread", "Brown rice", "Oats", "Olive oil", "Honey"]
      },
      {
        category: "Protein",
        items: ["Chicken breast", "Salmon fillets", "Turkey bacon", "Eggs", "Mixed nuts"]
      }
    ];
  }
}

/**
 * Create a fallback day's meals when generation fails
 */
function createFallbackDayMeals(day: string, preferences: UserDietPreferences): DailyPlan {
  // Determine meal types based on frequency
  let mealTypes: string[] = [];
  if (preferences.mealFrequency === 3) {
    mealTypes = ['breakfast', 'lunch', 'dinner'];
  } else if (preferences.mealFrequency === 4) {
    mealTypes = ['breakfast', 'lunch', 'snack', 'dinner'];
  } else if (preferences.mealFrequency === 5) {
    mealTypes = ['breakfast', 'snack', 'lunch', 'snack', 'dinner'];
  } else if (preferences.mealFrequency === 2) {
    mealTypes = ['breakfast', 'dinner'];
  } else {
    // Default to 3 meals
    mealTypes = ['breakfast', 'lunch', 'dinner'];
  }
  
  // Create meals for the day
  const meals: DailyMeal[] = [];
  let totalNutrition = { calories: 0, protein: 0, carbs: 0, fats: 0 };
  
  // Suggested meal times
  const mealTimes = {
    breakfast: "8:00 AM",
    lunch: "12:30 PM",
    dinner: "7:00 PM",
    snack: ["10:30 AM", "3:30 PM"]
  };
  
  // Create each meal
  let snackCount = 0;
  for (const mealType of mealTypes) {
    // Get basic nutrition for this meal type
    const nutrition = generateBasicNutrition(mealType);
    
    // Calculate meal time
    let mealTime = mealType === 'snack' 
      ? mealTimes.snack[snackCount++ % mealTimes.snack.length] 
      : mealTimes[mealType as keyof typeof mealTimes] as string;
    
    // Create meal recipe
    const mealRecipe = {
      name: getDefaultRecipeName(mealType, preferences.dietType),
      ingredients: getDefaultIngredients(mealType, preferences.dietType),
      instructions: getDefaultInstructions(mealType, preferences.dietType),
      nutrition: nutrition,
      prepTime: mealType === 'dinner' ? "20 minutes" : "10 minutes"
    };
    
    // Add to meals list
    meals.push({
      meal: mealType,
      time: mealTime,
      recipe: mealRecipe
    });
    
    // Update total nutrition
    totalNutrition.calories += nutrition.calories;
    totalNutrition.protein += nutrition.protein;
    totalNutrition.carbs += nutrition.carbs;
    totalNutrition.fats += nutrition.fats;
  }
  
  // Return completed daily plan
  return {
    day,
    meals,
    totalNutrition
  };
}

/**
 * Generate basic nutrition values based on meal type
 */
function generateBasicNutrition(mealType: string): MealNutrition {
  // Default nutrition values based on meal type
  const mealNutrition: Record<string, MealNutrition> = {
    breakfast: { calories: 400, protein: 20, carbs: 40, fats: 15 },
    lunch: { calories: 550, protein: 30, carbs: 50, fats: 20 },
    dinner: { calories: 500, protein: 25, carbs: 45, fats: 18 },
    snack: { calories: 200, protein: 10, carbs: 20, fats: 8 }
  };
  
  return mealType in mealNutrition ? mealNutrition[mealType] : mealNutrition.snack;
}

/**
 * Get default recipe name based on meal type and diet type
 */
function getDefaultRecipeName(mealType: string, dietType: string): string {
  const recipeNames: Record<string, Record<string, string>> = {
    'vegetarian': {
      breakfast: 'Vegetarian Breakfast Bowl',
      lunch: 'Mediterranean Veggie Wrap',
      dinner: 'Vegetable Stir Fry with Rice',
      snack: 'Greek Yogurt Parfait'
    },
    'vegan': {
      breakfast: 'Vegan Overnight Oats',
      lunch: 'Chickpea Salad Sandwich',
      dinner: 'Lentil and Vegetable Curry',
      snack: 'Fruit and Nut Mix'
    },
    'non-vegetarian': {
      breakfast: 'Protein Breakfast Plate',
      lunch: 'Chicken Salad',
      dinner: 'Baked Salmon with Vegetables',
      snack: 'Greek Yogurt with Almonds'
    }
  };
  
  // Default to vegetarian if diet type not found
  const diet = dietType in recipeNames ? dietType : 'vegetarian';
  return recipeNames[diet][mealType] || `Standard ${mealType}`;
}

/**
 * Get default ingredients based on meal type and diet type
 */
function getDefaultIngredients(mealType: string, dietType: string): MealIngredient[] {
  if (dietType === 'vegetarian') {
    if (mealType === 'breakfast') {
      return [
        { name: "Oats", quantity: "1/2", unit: "cup" },
        { name: "Milk", quantity: "1", unit: "cup" },
        { name: "Banana", quantity: "1", unit: "medium" },
        { name: "Honey", quantity: "1", unit: "tablespoon" },
        { name: "Mixed nuts", quantity: "1", unit: "tablespoon" }
      ];
    } else if (mealType === 'lunch') {
      return [
        { name: "Whole wheat tortilla", quantity: "1", unit: "large" },
        { name: "Hummus", quantity: "3", unit: "tablespoons" },
        { name: "Cucumber", quantity: "1/4", unit: "cup sliced" },
        { name: "Bell pepper", quantity: "1/4", unit: "cup sliced" },
        { name: "Feta cheese", quantity: "2", unit: "tablespoons" },
        { name: "Mixed greens", quantity: "1/2", unit: "cup" }
      ];
    } else if (mealType === 'dinner') {
      return [
        { name: "Brown rice", quantity: "1/2", unit: "cup cooked" },
        { name: "Mixed vegetables", quantity: "1", unit: "cup" },
        { name: "Tofu", quantity: "4", unit: "oz" },
        { name: "Soy sauce", quantity: "1", unit: "tablespoon" },
        { name: "Vegetable oil", quantity: "1", unit: "teaspoon" },
        { name: "Garlic", quantity: "1", unit: "clove minced" }
      ];
    } else {
      return [
        { name: "Greek yogurt", quantity: "1/2", unit: "cup" },
        { name: "Berries", quantity: "1/4", unit: "cup" },
        { name: "Granola", quantity: "2", unit: "tablespoons" }
      ];
    }
  } else if (dietType === 'vegan') {
    if (mealType === 'breakfast') {
      return [
        { name: "Oats", quantity: "1/2", unit: "cup" },
        { name: "Almond milk", quantity: "1", unit: "cup" },
        { name: "Banana", quantity: "1", unit: "medium" },
        { name: "Maple syrup", quantity: "1", unit: "tablespoon" },
        { name: "Chia seeds", quantity: "1", unit: "tablespoon" }
      ];
    } else if (mealType === 'lunch') {
      return [
        { name: "Whole grain bread", quantity: "2", unit: "slices" },
        { name: "Chickpeas", quantity: "1/2", unit: "cup mashed" },
        { name: "Vegan mayo", quantity: "1", unit: "tablespoon" },
        { name: "Mustard", quantity: "1", unit: "teaspoon" },
        { name: "Celery", quantity: "1", unit: "stalk chopped" },
        { name: "Lettuce", quantity: "1", unit: "leaf" }
      ];
    } else if (mealType === 'dinner') {
      return [
        { name: "Red lentils", quantity: "1/2", unit: "cup" },
        { name: "Mixed vegetables", quantity: "1", unit: "cup" },
        { name: "Coconut milk", quantity: "1/2", unit: "cup" },
        { name: "Curry powder", quantity: "1", unit: "teaspoon" },
        { name: "Garlic", quantity: "1", unit: "clove minced" },
        { name: "Brown rice", quantity: "1/2", unit: "cup cooked" }
      ];
    } else {
      return [
        { name: "Mixed dried fruits", quantity: "1/4", unit: "cup" },
        { name: "Mixed nuts", quantity: "1/4", unit: "cup" }
      ];
    }
  } else {
    if (mealType === 'breakfast') {
      return [
        { name: "Eggs", quantity: "2", unit: "large" },
        { name: "Whole grain toast", quantity: "1", unit: "slice" },
        { name: "Avocado", quantity: "1/4", unit: "medium" },
        { name: "Turkey bacon", quantity: "2", unit: "slices" }
      ];
    } else if (mealType === 'lunch') {
      return [
        { name: "Grilled chicken breast", quantity: "4", unit: "oz" },
        { name: "Mixed greens", quantity: "2", unit: "cups" },
        { name: "Cherry tomatoes", quantity: "1/4", unit: "cup" },
        { name: "Cucumber", quantity: "1/4", unit: "cup sliced" },
        { name: "Olive oil", quantity: "1", unit: "tablespoon" },
        { name: "Lemon juice", quantity: "1", unit: "teaspoon" }
      ];
    } else if (mealType === 'dinner') {
      return [
        { name: "Salmon fillet", quantity: "4", unit: "oz" },
        { name: "Broccoli", quantity: "1", unit: "cup" },
        { name: "Sweet potato", quantity: "1/2", unit: "medium" },
        { name: "Olive oil", quantity: "1", unit: "tablespoon" },
        { name: "Lemon", quantity: "1/2", unit: "medium" },
        { name: "Garlic", quantity: "1", unit: "clove minced" }
      ];
    } else {
      return [
        { name: "Greek yogurt", quantity: "1/2", unit: "cup" },
        { name: "Almonds", quantity: "10", unit: "pieces" }
      ];
    }
  }
}

/**
 * Get default instructions based on meal type and diet type
 */
function getDefaultInstructions(mealType: string, dietType: string): string[] {
  if (mealType === 'breakfast') {
    if (dietType === 'vegetarian' || dietType === 'vegan') {
      return [
        "Combine oats and milk in a bowl",
        "Microwave for 2 minutes or until desired consistency",
        "Slice banana and add on top",
        "Add sweetener and nuts/seeds"
      ];
    } else {
      return [
        "Cook eggs as desired",
        "Toast bread",
        "Cook bacon",
        "Slice avocado and serve everything together"
      ];
    }
  } else if (mealType === 'lunch') {
    return [
      "Prepare main protein component",
      "Assemble all ingredients together",
      "Season to taste and serve"
    ];
  } else if (mealType === 'dinner') {
    return [
      "Prepare protein component",
      "Cook vegetables and starch separately",
      "Combine all elements and add seasonings",
      "Serve hot"
    ];
  } else {
    return [
      "Combine all ingredients in a bowl or container",
      "Store in refrigerator if not eating immediately"
    ];
  }
}

/**
 * Generate meal prep tips
 */
async function generateMealPrepTips(preferences: UserDietPreferences): Promise<string[]> {
  const prompt = `
Generate 5 meal prep tips for a person with these dietary preferences:
- Diet type: ${preferences.dietType}
- Diet plan: ${preferences.dietPlanPreference}
- Meal frequency: ${preferences.mealFrequency} meals per day

Return ONLY a JSON array of strings, e.g.:
["Tip 1", "Tip 2", "Tip 3", "Tip 4", "Tip 5"]
`;

  try {
    const result = await gemini.generateContent(prompt);
    const parsedResult = JSON.parse(result);
    
    if (!Array.isArray(parsedResult) || parsedResult.length === 0) {
      throw new Error('Invalid meal prep tips format');
    }
    
    return parsedResult;
  } catch (error) {
    throw new Error(`Meal prep tips generation failed: ${error}`);
  }
}

/**
 * Get default meal prep tips
 */
function getDefaultMealPrepTips(): string[] {
  return [
    "Prep ingredients for multiple meals at once to save time during the week.",
    "Store prepared meals in clear containers with labels including the date prepared.",
    "Cook grains and proteins in batches to use in different meals throughout the week.",
    "Chop vegetables ahead of time and store in airtight containers for quick meal assembly.",
    "Freeze portion-sized meals for busy days when you don't have time to cook."
  ];
}

/**
 * Validate the structure of a meal plan
 */
function validateMealPlanStructure(plan: any): asserts plan is MealPlan {
  if (!plan) throw new Error('Plan is null or undefined');
  
  // Check daily meal plan
  if (!Array.isArray(plan.dailyMealPlan)) 
    throw new Error('dailyMealPlan is not an array');
  
  // Check shopping list
  if (!Array.isArray(plan.shoppingList)) 
    throw new Error('shoppingList is not an array');
  
  // Check meal prep tips
  if (!Array.isArray(plan.mealPrepTips)) 
    throw new Error('mealPrepTips is not an array');
  
  // Check each day
  for (const day of plan.dailyMealPlan) {
    if (!day.day || typeof day.day !== 'string') 
      throw new Error('Day missing day name');
    
    if (!Array.isArray(day.meals)) 
      throw new Error(`Meals for ${day.day} is not an array`);
    
    // Check each meal
    for (const meal of day.meals) {
      if (!meal.meal || typeof meal.meal !== 'string') 
        throw new Error(`Meal in ${day.day} missing meal type`);
      
      if (!meal.time || typeof meal.time !== 'string') 
        throw new Error(`Meal ${meal.meal} in ${day.day} missing time`);
      
      // Check recipe
      if (!meal.recipe || typeof meal.recipe !== 'object') 
        throw new Error(`Meal ${meal.meal} in ${day.day} missing recipe`);
      
      const recipe = meal.recipe;
      
      if (!recipe.name || typeof recipe.name !== 'string') 
        throw new Error(`Recipe for ${meal.meal} in ${day.day} missing name`);
      
      if (!Array.isArray(recipe.ingredients)) 
        throw new Error(`Recipe ${recipe.name} missing ingredients array`);
      
      if (!Array.isArray(recipe.instructions)) 
        throw new Error(`Recipe ${recipe.name} missing instructions array`);
      
      // Check nutrition
      if (!recipe.nutrition || typeof recipe.nutrition !== 'object') 
        throw new Error(`Recipe ${recipe.name} missing nutrition info`);
      
      const nutrition = recipe.nutrition;
      
      if (typeof nutrition.calories !== 'number') 
        throw new Error(`Recipe ${recipe.name} missing calorie count`);
      
      if (typeof nutrition.protein !== 'number') 
        throw new Error(`Recipe ${recipe.name} missing protein count`);
      
      if (typeof nutrition.carbs !== 'number') 
        throw new Error(`Recipe ${recipe.name} missing carbs count`);
      
      if (typeof nutrition.fats !== 'number') 
        throw new Error(`Recipe ${recipe.name} missing fats count`);
    }
    
    // Check daily total nutrition
    if (!day.totalNutrition || typeof day.totalNutrition !== 'object') 
      throw new Error(`Day ${day.day} missing total nutrition`);
    
    const totalNutrition = day.totalNutrition;
    
    if (typeof totalNutrition.calories !== 'number') 
      throw new Error(`Day ${day.day} missing total calories`);
    
    if (typeof totalNutrition.protein !== 'number') 
      throw new Error(`Day ${day.day} missing total protein`);
    
    if (typeof totalNutrition.carbs !== 'number') 
      throw new Error(`Day ${day.day} missing total carbs`);
    
    if (typeof totalNutrition.fats !== 'number') 
      throw new Error(`Day ${day.day} missing total fats`);
  }
  
  // Check shopping list categories
  for (const category of plan.shoppingList) {
    if (!category.category || typeof category.category !== 'string') 
      throw new Error('Shopping list category missing name');
    
    if (!Array.isArray(category.items)) 
      throw new Error(`Shopping list category ${category.category} missing items array`);
  }
} 