/**
 * Modern Meal Plan Schemas for Google Structured Output
 * 
 * These schemas define the exact structure for meal plan generation
 * using Google's native structured output feature
 */

import { z } from 'zod';

// Nutrition Information Schema
export const NutritionSchema = z.object({
  calories: z.number().int().min(50).max(2000),
  protein: z.number().min(0).max(200), // grams
  carbs: z.number().min(0).max(300), // grams
  fats: z.number().min(0).max(150), // grams
  fiber: z.number().min(0).max(50), // grams
  sugar: z.number().min(0).max(100) // grams
});

// Individual Meal Recipe Schema
export const MealRecipeSchema = z.object({
  name: z.string().min(3, "Meal name required"),
  description: z.string().min(10, "Meal description required"),
  cuisine: z.string().min(3, "Cuisine type required"),
  prepTime: z.number().int().min(5).max(180), // minutes
  cookTime: z.number().int().min(0).max(240), // minutes
  servings: z.number().int().min(1).max(8),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  ingredients: z.array(z.string()).min(3).max(20),
  instructions: z.array(z.string()).min(3).max(15),
  nutrition: NutritionSchema,
  tags: z.array(z.string()).optional(), // e.g., ["high-protein", "gluten-free"]
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack'])
});

// Daily Meal Plan Schema
export const DailyMealPlanSchema = z.object({
  day: z.string().min(3), // e.g., "Monday", "Day 1"
  date: z.string().optional(), // ISO date string
  meals: z.object({
    breakfast: MealRecipeSchema,
    lunch: MealRecipeSchema,
    dinner: MealRecipeSchema,
    snacks: z.array(MealRecipeSchema).min(0).max(3).optional()
  }),
  totalNutrition: NutritionSchema,
  waterIntake: z.number().int().min(1000).max(5000), // ml
  notes: z.string().optional()
});

// Weekly Meal Plan Schema
export const WeeklyMealPlanSchema = z.object({
  planName: z.string().min(5),
  description: z.string().min(20),
  weeklyPlan: z.array(DailyMealPlanSchema).min(7).max(7), // exactly 7 days
  dietType: z.enum(['omnivore', 'vegetarian', 'vegan', 'keto', 'paleo', 'mediterranean']),
  totalWeeklyNutrition: NutritionSchema,
  shoppingList: z.array(z.string()).min(10).max(100),
  mealPrepTips: z.array(z.string()).min(3).max(10),
  nutritionTips: z.array(z.string()).min(3).max(8),
  budgetEstimate: z.string().optional(), // e.g., "$150-200 per week"
  allergenInfo: z.array(z.string()).optional()
});

// TypeScript types
export type Nutrition = z.infer<typeof NutritionSchema>;
export type MealRecipe = z.infer<typeof MealRecipeSchema>;
export type DailyMealPlan = z.infer<typeof DailyMealPlanSchema>;
export type WeeklyMealPlan = z.infer<typeof WeeklyMealPlanSchema>;

// Google Gemini Schema Format for Meal Plans
export const GoogleMealPlanSchema = {
  type: "object",
  properties: {
    planName: { type: "string", description: "Name of the meal plan" },
    description: { type: "string", description: "Brief description of the meal plan" },
    weeklyPlan: {
      type: "array",
      description: "7-day meal plan",
      items: {
        type: "object",
        properties: {
          day: { type: "string", description: "Day name (e.g., Monday)" },
          date: { type: "string", description: "Date in YYYY-MM-DD format" },
          meals: {
            type: "object",
            properties: {
              breakfast: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Meal name" },
                  description: { type: "string", description: "Meal description" },
                  cuisine: { type: "string", description: "Cuisine type" },
                  prepTime: { type: "number", description: "Prep time in minutes" },
                  cookTime: { type: "number", description: "Cook time in minutes" },
                  servings: { type: "number", description: "Number of servings" },
                  difficulty: { 
                    type: "string", 
                    enum: ["easy", "medium", "hard"],
                    description: "Recipe difficulty"
                  },
                  ingredients: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of ingredients"
                  },
                  instructions: {
                    type: "array",
                    items: { type: "string" },
                    description: "Cooking instructions"
                  },
                  nutrition: {
                    type: "object",
                    properties: {
                      calories: { type: "number", description: "Calories" },
                      protein: { type: "number", description: "Protein in grams" },
                      carbs: { type: "number", description: "Carbohydrates in grams" },
                      fats: { type: "number", description: "Fats in grams" },
                      fiber: { type: "number", description: "Fiber in grams" },
                      sugar: { type: "number", description: "Sugar in grams" }
                    },
                    required: ["calories", "protein", "carbs", "fats", "fiber", "sugar"]
                  },
                  mealType: { 
                    type: "string", 
                    enum: ["breakfast", "lunch", "dinner", "snack"],
                    description: "Type of meal"
                  }
                },
                required: ["name", "description", "cuisine", "prepTime", "cookTime", "servings", "difficulty", "ingredients", "instructions", "nutrition", "mealType"]
              },
              lunch: { /* same structure as breakfast */ },
              dinner: { /* same structure as breakfast */ },
              snacks: {
                type: "array",
                items: { /* same structure as breakfast */ },
                description: "Optional snacks"
              }
            },
            required: ["breakfast", "lunch", "dinner"]
          },
          totalNutrition: {
            type: "object",
            properties: {
              calories: { type: "number" },
              protein: { type: "number" },
              carbs: { type: "number" },
              fats: { type: "number" },
              fiber: { type: "number" },
              sugar: { type: "number" }
            },
            required: ["calories", "protein", "carbs", "fats", "fiber", "sugar"]
          },
          waterIntake: { type: "number", description: "Daily water intake in ml" }
        },
        required: ["day", "meals", "totalNutrition", "waterIntake"]
      }
    },
    dietType: { 
      type: "string", 
      enum: ["omnivore", "vegetarian", "vegan", "keto", "paleo", "mediterranean"],
      description: "Diet type"
    },
    totalWeeklyNutrition: {
      type: "object",
      properties: {
        calories: { type: "number" },
        protein: { type: "number" },
        carbs: { type: "number" },
        fats: { type: "number" },
        fiber: { type: "number" },
        sugar: { type: "number" }
      },
      required: ["calories", "protein", "carbs", "fats", "fiber", "sugar"]
    },
    shoppingList: {
      type: "array",
      items: { type: "string" },
      description: "Weekly shopping list"
    },
    mealPrepTips: {
      type: "array",
      items: { type: "string" },
      description: "Meal preparation tips"
    },
    nutritionTips: {
      type: "array",
      items: { type: "string" },
      description: "Nutrition advice"
    }
  },
  required: ["planName", "description", "weeklyPlan", "dietType", "totalWeeklyNutrition", "shoppingList", "mealPrepTips", "nutritionTips"]
};
