// Default meal plans

interface Nutrition {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

interface Recipe {
  name: string;
  ingredients: string[];
  instructions: string[];
  nutrition: Nutrition;
}

interface Meal {
  meal: string;
  time: string;
  recipe: Recipe;
}

interface DayPlan {
  day: string;
  meals: Meal[];
  dailyNutrition: Nutrition;
}

interface ShoppingList {
  protein: string[];
  produce: string[];
  grains: string[];
  dairy: string[];
  other: string[];
}

interface MealPlan {
  id: string;
  weeklyPlan: DayPlan[];
  shoppingList: ShoppingList;
  mealPrepTips: string[];
  batchCookingRecommendations: string[];
}

// Create a base template for all meal plans
const baseMealPlan: MealPlan = {
  id: 'default_meal_plan',
  weeklyPlan: [
    { day: 'Monday', meals: [], dailyNutrition: { calories: 0, protein: 0, carbs: 0, fats: 0 } },
    { day: 'Tuesday', meals: [], dailyNutrition: { calories: 0, protein: 0, carbs: 0, fats: 0 } },
    { day: 'Wednesday', meals: [], dailyNutrition: { calories: 0, protein: 0, carbs: 0, fats: 0 } },
    { day: 'Thursday', meals: [], dailyNutrition: { calories: 0, protein: 0, carbs: 0, fats: 0 } },
    { day: 'Friday', meals: [], dailyNutrition: { calories: 0, protein: 0, carbs: 0, fats: 0 } },
    { day: 'Saturday', meals: [], dailyNutrition: { calories: 0, protein: 0, carbs: 0, fats: 0 } },
    { day: 'Sunday', meals: [], dailyNutrition: { calories: 0, protein: 0, carbs: 0, fats: 0 } }
  ],
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

// Export the required meal plans
export const vegetarianFallbackMealPlan: MealPlan = {
  ...baseMealPlan,
  id: 'vegetarian_fallback_meal_plan'
};

export const veganFallbackMealPlan: MealPlan = {
  ...baseMealPlan,
  id: 'vegan_fallback_meal_plan'
};

export const nonVegetarianFallbackMealPlan: MealPlan = {
  ...baseMealPlan,
  id: 'non_vegetarian_fallback_meal_plan'
};
