/**
 * Comprehensive Schemas for FitAI Structured Output
 * 
 * These schemas utilize ALL onboarding data and replace JSON parsing
 * with Google's native structured output feature
 */

import { SchemaType } from '@google/generative-ai';
import { z } from 'zod';

// ===== WORKOUT SCHEMAS =====

// Exercise Schema with comprehensive validation
export const ExerciseSchema = z.object({
  name: z.string().min(2, "Exercise name required"),
  sets: z.number().int().min(1).max(10),
  reps: z.union([
    z.number().int().min(1).max(100),
    z.string().regex(/^\d+(-\d+)?( seconds| sec| minutes| min)?$/, "Valid reps format required")
  ]),
  restSeconds: z.number().int().min(15).max(300),
  notes: z.string().optional(),
  targetMuscles: z.array(z.string()).min(1),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  equipment: z.string().optional(),
  instructions: z.array(z.string()).min(1).optional()
});

// Workout Day Schema
export const WorkoutDaySchema = z.object({
  day: z.string().min(2),
  focus: z.string().min(2),
  duration: z.number().int().min(15).max(120),
  exercises: z.array(ExerciseSchema).min(3).max(12),
  warmUp: z.array(z.string()).min(2).max(5),
  coolDown: z.array(z.string()).min(2).max(5)
});

// Progression Plan Schema
export const ProgressionPlanSchema = z.object({
  week2: z.string().min(10),
  week3: z.string().min(10),
  week4: z.string().min(10),
  longTerm: z.string().min(10)
});

// Complete Workout Plan Schema
export const WorkoutPlanSchema = z.object({
  planName: z.string().min(5),
  description: z.string().min(20),
  weeklySchedule: z.array(WorkoutDaySchema).min(1).max(7),
  totalWeeklyDuration: z.number().int().min(60).max(600),
  difficultyLevel: z.enum(['beginner', 'intermediate', 'advanced']),
  equipmentRequired: z.array(z.string()),
  progressionPlan: ProgressionPlanSchema,
  safetyNotes: z.array(z.string()).min(2),
  nutritionTips: z.array(z.string()).min(2),
  personalizedNotes: z.string().optional()
});

// Google Gemini Workout Schema
export const GoogleWorkoutPlanSchema = {
  type: SchemaType.OBJECT,
  properties: {
    planName: {
      type: SchemaType.STRING,
      description: "Personalized name of the workout plan"
    },
    description: {
      type: SchemaType.STRING,
      description: "Detailed description of the plan based on user's goals and preferences"
    },
    weeklySchedule: {
      type: SchemaType.ARRAY,
      description: "Weekly workout schedule based on user's frequency preference",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          day: {
            type: SchemaType.STRING,
            description: "Day name (e.g., Monday, Day 1)"
          },
          focus: {
            type: SchemaType.STRING,
            description: "Focus area based on user's selected focus areas"
          },
          duration: {
            type: SchemaType.NUMBER,
            description: "Workout duration matching user's time preference"
          },
          exercises: {
            type: SchemaType.ARRAY,
            description: "Exercises using user's available equipment",
            items: {
              type: SchemaType.OBJECT,
              properties: {
                name: {
                  type: SchemaType.STRING,
                  description: "Exercise name appropriate for user's fitness level"
                },
                sets: {
                  type: SchemaType.NUMBER,
                  description: "Number of sets based on fitness level"
                },
                reps: {
                  type: SchemaType.STRING,
                  description: "Reps (number, range, or time-based)"
                },
                restSeconds: {
                  type: SchemaType.NUMBER,
                  description: "Rest time appropriate for fitness level"
                },
                notes: {
                  type: SchemaType.STRING,
                  description: "Exercise-specific notes and modifications"
                },
                targetMuscles: {
                  type: SchemaType.ARRAY,
                  items: { type: SchemaType.STRING },
                  description: "Target muscle groups"
                },
                difficulty: {
                  type: SchemaType.STRING,
                  description: "Exercise difficulty level"
                },
                equipment: {
                  type: SchemaType.STRING,
                  description: "Required equipment from user's available equipment"
                },
                instructions: {
                  type: SchemaType.ARRAY,
                  items: { type: SchemaType.STRING },
                  description: "Step-by-step exercise instructions"
                }
              },
              required: ["name", "sets", "reps", "restSeconds", "targetMuscles", "difficulty"]
            }
          },
          warmUp: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description: "Warm-up activities appropriate for the workout"
          },
          coolDown: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description: "Cool-down activities and stretches"
          }
        },
        required: ["day", "focus", "duration", "exercises", "warmUp", "coolDown"]
      }
    },
    totalWeeklyDuration: {
      type: SchemaType.NUMBER,
      description: "Total weekly workout time in minutes"
    },
    difficultyLevel: {
      type: SchemaType.STRING,
      description: "Overall plan difficulty matching user's fitness level"
    },
    equipmentRequired: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: "Equipment needed, limited to user's available equipment"
    },
    progressionPlan: {
      type: SchemaType.OBJECT,
      properties: {
        week2: {
          type: SchemaType.STRING,
          description: "Week 2 progression strategy"
        },
        week3: {
          type: SchemaType.STRING,
          description: "Week 3 progression strategy"
        },
        week4: {
          type: SchemaType.STRING,
          description: "Week 4 progression strategy"
        },
        longTerm: {
          type: SchemaType.STRING,
          description: "Long-term progression plan based on user's goals"
        }
      },
      required: ["week2", "week3", "week4", "longTerm"]
    },
    safetyNotes: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: "Safety considerations based on user's fitness level and any limitations"
    },
    nutritionTips: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: "Nutrition recommendations supporting the workout goals"
    },
    personalizedNotes: {
      type: SchemaType.STRING,
      description: "Personalized notes addressing user's specific goals and preferences"
    }
  },
  required: [
    "planName", "description", "weeklySchedule", "totalWeeklyDuration",
    "difficultyLevel", "equipmentRequired", "progressionPlan", "safetyNotes", "nutritionTips"
  ]
};

// ===== MEAL PLAN SCHEMAS =====

// Nutrition Schema
export const NutritionSchema = z.object({
  calories: z.number().int().min(50).max(2000),
  protein: z.number().min(0).max(200),
  carbs: z.number().min(0).max(300),
  fats: z.number().min(0).max(150),
  fiber: z.number().min(0).max(50),
  sugar: z.number().min(0).max(100),
  sodium: z.number().min(0).max(5000).optional()
});

// Recipe Schema
export const RecipeSchema = z.object({
  name: z.string().min(3),
  description: z.string().min(10),
  cuisine: z.string().min(3),
  prepTime: z.number().int().min(5).max(180),
  cookTime: z.number().int().min(0).max(240),
  servings: z.number().int().min(1).max(8),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  ingredients: z.array(z.string()).min(3).max(20),
  instructions: z.array(z.string()).min(3).max(15),
  nutrition: NutritionSchema,
  tags: z.array(z.string()).optional(),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack'])
});

// Daily Meal Plan Schema
export const DailyMealPlanSchema = z.object({
  day: z.string().min(3),
  date: z.string().optional(),
  meals: z.object({
    breakfast: RecipeSchema,
    lunch: RecipeSchema,
    dinner: RecipeSchema,
    snacks: z.array(RecipeSchema).min(0).max(3).optional()
  }),
  totalNutrition: NutritionSchema,
  waterIntake: z.number().int().min(1000).max(5000),
  notes: z.string().optional()
});

// Weekly Meal Plan Schema
export const WeeklyMealPlanSchema = z.object({
  planName: z.string().min(5),
  description: z.string().min(20),
  weeklyPlan: z.array(DailyMealPlanSchema).min(7).max(7),
  dietType: z.enum(['vegetarian', 'vegan', 'non-vegetarian', 'pescatarian', 'flexitarian']),
  totalWeeklyNutrition: NutritionSchema,
  shoppingList: z.array(z.string()).min(10).max(100),
  mealPrepTips: z.array(z.string()).min(3).max(10),
  nutritionTips: z.array(z.string()).min(3).max(8),
  budgetEstimate: z.string().optional(),
  allergenInfo: z.array(z.string()).optional(),
  personalizedNotes: z.string().optional()
});

// Google Gemini Meal Plan Schema
export const GoogleMealPlanSchema = {
  type: SchemaType.OBJECT,
  properties: {
    planName: {
      type: SchemaType.STRING,
      description: "Personalized meal plan name based on user's diet type and goals"
    },
    description: {
      type: SchemaType.STRING,
      description: "Detailed description considering user's preferences and restrictions"
    },
    weeklyPlan: {
      type: SchemaType.ARRAY,
      description: "7-day meal plan with user's preferred meal frequency",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          day: {
            type: SchemaType.STRING,
            description: "Day name"
          },
          date: {
            type: SchemaType.STRING,
            description: "Date in YYYY-MM-DD format"
          },
          meals: {
            type: SchemaType.OBJECT,
            properties: {
              breakfast: {
                type: SchemaType.OBJECT,
                properties: {
                  name: { type: SchemaType.STRING, description: "Meal name" },
                  description: { type: SchemaType.STRING, description: "Meal description" },
                  cuisine: { type: SchemaType.STRING, description: "Cuisine type matching user's region" },
                  prepTime: { type: SchemaType.NUMBER, description: "Prep time in minutes" },
                  cookTime: { type: SchemaType.NUMBER, description: "Cook time in minutes" },
                  servings: { type: SchemaType.NUMBER, description: "Number of servings" },
                  difficulty: { type: SchemaType.STRING, description: "Recipe difficulty" },
                  ingredients: {
                    type: SchemaType.ARRAY,
                    items: { type: SchemaType.STRING },
                    description: "Ingredients avoiding user's allergies and restrictions"
                  },
                  instructions: {
                    type: SchemaType.ARRAY,
                    items: { type: SchemaType.STRING },
                    description: "Step-by-step cooking instructions"
                  },
                  nutrition: {
                    type: SchemaType.OBJECT,
                    properties: {
                      calories: { type: SchemaType.NUMBER, description: "Calories" },
                      protein: { type: SchemaType.NUMBER, description: "Protein in grams" },
                      carbs: { type: SchemaType.NUMBER, description: "Carbohydrates in grams" },
                      fats: { type: SchemaType.NUMBER, description: "Fats in grams" },
                      fiber: { type: SchemaType.NUMBER, description: "Fiber in grams" },
                      sugar: { type: SchemaType.NUMBER, description: "Sugar in grams" }
                    },
                    required: ["calories", "protein", "carbs", "fats", "fiber", "sugar"]
                  },
                  mealType: { type: SchemaType.STRING, description: "Type of meal" }
                },
                required: ["name", "description", "cuisine", "prepTime", "cookTime", "servings", "difficulty", "ingredients", "instructions", "nutrition", "mealType"]
              },
              lunch: {
                type: SchemaType.OBJECT,
                properties: {
                  name: { type: SchemaType.STRING },
                  description: { type: SchemaType.STRING },
                  cuisine: { type: SchemaType.STRING },
                  prepTime: { type: SchemaType.NUMBER },
                  cookTime: { type: SchemaType.NUMBER },
                  servings: { type: SchemaType.NUMBER },
                  difficulty: { type: SchemaType.STRING },
                  ingredients: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                  instructions: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                  nutrition: {
                    type: SchemaType.OBJECT,
                    properties: {
                      calories: { type: SchemaType.NUMBER },
                      protein: { type: SchemaType.NUMBER },
                      carbs: { type: SchemaType.NUMBER },
                      fats: { type: SchemaType.NUMBER },
                      fiber: { type: SchemaType.NUMBER },
                      sugar: { type: SchemaType.NUMBER }
                    },
                    required: ["calories", "protein", "carbs", "fats", "fiber", "sugar"]
                  },
                  mealType: { type: SchemaType.STRING }
                },
                required: ["name", "description", "cuisine", "prepTime", "cookTime", "servings", "difficulty", "ingredients", "instructions", "nutrition", "mealType"]
              },
              dinner: {
                type: SchemaType.OBJECT,
                properties: {
                  name: { type: SchemaType.STRING },
                  description: { type: SchemaType.STRING },
                  cuisine: { type: SchemaType.STRING },
                  prepTime: { type: SchemaType.NUMBER },
                  cookTime: { type: SchemaType.NUMBER },
                  servings: { type: SchemaType.NUMBER },
                  difficulty: { type: SchemaType.STRING },
                  ingredients: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                  instructions: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                  nutrition: {
                    type: SchemaType.OBJECT,
                    properties: {
                      calories: { type: SchemaType.NUMBER },
                      protein: { type: SchemaType.NUMBER },
                      carbs: { type: SchemaType.NUMBER },
                      fats: { type: SchemaType.NUMBER },
                      fiber: { type: SchemaType.NUMBER },
                      sugar: { type: SchemaType.NUMBER }
                    },
                    required: ["calories", "protein", "carbs", "fats", "fiber", "sugar"]
                  },
                  mealType: { type: SchemaType.STRING }
                },
                required: ["name", "description", "cuisine", "prepTime", "cookTime", "servings", "difficulty", "ingredients", "instructions", "nutrition", "mealType"]
              }
            },
            required: ["breakfast", "lunch", "dinner"]
          },
          totalNutrition: {
            type: SchemaType.OBJECT,
            properties: {
              calories: { type: SchemaType.NUMBER },
              protein: { type: SchemaType.NUMBER },
              carbs: { type: SchemaType.NUMBER },
              fats: { type: SchemaType.NUMBER },
              fiber: { type: SchemaType.NUMBER },
              sugar: { type: SchemaType.NUMBER }
            },
            required: ["calories", "protein", "carbs", "fats", "fiber", "sugar"]
          },
          waterIntake: {
            type: SchemaType.NUMBER,
            description: "Daily water intake in ml based on user's goal"
          }
        },
        required: ["day", "meals", "totalNutrition", "waterIntake"]
      }
    },
    dietType: {
      type: SchemaType.STRING,
      description: "User's selected diet type"
    },
    totalWeeklyNutrition: {
      type: SchemaType.OBJECT,
      properties: {
        calories: { type: SchemaType.NUMBER },
        protein: { type: SchemaType.NUMBER },
        carbs: { type: SchemaType.NUMBER },
        fats: { type: SchemaType.NUMBER },
        fiber: { type: SchemaType.NUMBER },
        sugar: { type: SchemaType.NUMBER }
      },
      required: ["calories", "protein", "carbs", "fats", "fiber", "sugar"]
    },
    shoppingList: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: "Weekly shopping list organized by categories"
    },
    mealPrepTips: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: "Meal preparation tips for efficiency"
    },
    nutritionTips: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: "Nutrition advice supporting user's fitness goals"
    },
    personalizedNotes: {
      type: SchemaType.STRING,
      description: "Personalized notes addressing user's specific dietary needs and goals"
    }
  },
  required: ["planName", "description", "weeklyPlan", "dietType", "totalWeeklyNutrition", "shoppingList", "mealPrepTips", "nutritionTips"]
};

// TypeScript types
export type Exercise = z.infer<typeof ExerciseSchema>;
export type WorkoutDay = z.infer<typeof WorkoutDaySchema>;
export type WorkoutPlan = z.infer<typeof WorkoutPlanSchema>;
export type Nutrition = z.infer<typeof NutritionSchema>;
export type Recipe = z.infer<typeof RecipeSchema>;
export type DailyMealPlan = z.infer<typeof DailyMealPlanSchema>;
export type WeeklyMealPlan = z.infer<typeof WeeklyMealPlanSchema>;
