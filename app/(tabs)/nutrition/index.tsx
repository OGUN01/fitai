import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Dimensions, Modal, Alert } from 'react-native';
import { Text, Button, Card, Title, Paragraph, Divider, List, Chip, useTheme, IconButton, Checkbox, Snackbar, Avatar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import gemini from '../../../lib/gemini';
import { useProfile } from '../../../contexts/ProfileContext';
import { useAuth } from '../../../contexts/AuthContext';
import supabase from '../../../lib/supabase';
import { format } from 'date-fns';
import { markMealComplete, isMealCompleted } from '../../../services/trackingService';
import { FadeIn, SlideIn, ScaleIn, Pulse } from '../../../components/animations';
import { colors, spacing, borderRadius, shadows, gradients } from '../../../theme/theme';
import StyledText from '../../../components/ui/StyledText';
import { UserDietPreferences } from '../../../services/ai/mealPlanGenerator';
import { parseJsonFromLLM } from '../../../services/ai/jsonUtils';
// Import reliable meal plan generator with fallbacks
import { reliableMealPlanGenerator } from '../../../services/ai';
// Import event emitter for cross-component communication
import { EventRegister } from 'react-native-event-listeners';
import Animated from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Define interfaces for the meal plan data structure
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

// Day abbreviations and full names for the selector
const weekdays = [
  { abbr: "Mon", dayName: "Monday" },
  { abbr: "Tue", dayName: "Tuesday" },
  { abbr: "Wed", dayName: "Wednesday" },
  { abbr: "Thu", dayName: "Thursday" },
  { abbr: "Fri", dayName: "Friday" },
  { abbr: "Sat", dayName: "Saturday" },
  { abbr: "Sun", dayName: "Sunday" },
];

/**
 * Nutrition screen - main entry point for the Nutrition tab
 */
export default function NutritionScreen() {
  // Theme setup with color variables for styling
  const theme = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [error, setError] = useState<{ title: string; message: string; isRetryable?: boolean } | null>(null);
  const [selectedDay, setSelectedDay] = useState<string>("Monday");
  const { profile, updateProfile } = useProfile();
  const [completedMeals, setCompletedMeals] = useState<Record<string, Record<string, boolean>>>({});
  const [markingMeal, setMarkingMeal] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [mealToDelete, setMealToDelete] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDayFilter, setShowDayFilter] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [mealModalVisible, setMealModalVisible] = useState(false);
  const [reload, setReload] = useState(false);
  
  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };
  
  const openMealDetail = (meal: Meal) => {
    setSelectedMeal(meal);
    setMealModalVisible(true);
  };
  
  const isMealMarkedComplete = (day: string, mealType: string): boolean => {
    return completedMeals[day]?.[mealType] || false;
  };
  
  // Update fallbackMealPlan to include all 7 days of the week
  const fallbackMealPlan: MealPlan = {
    id: 'default_meal_plan',
    weeklyPlan: [
      // Monday
      {
        day: "Monday",
        meals: [
          {
            meal: "Breakfast",
            time: "8:00 AM",
            recipe: {
              name: "Basic Protein Oatmeal",
              ingredients: ["1 cup oats", "1 scoop protein powder", "1 banana", "1 tbsp honey"],
              instructions: ["Cook oats according to package", "Stir in protein powder", "Top with sliced banana and honey"],
              nutrition: { calories: 350, protein: 25, carbs: 50, fats: 5 }
            }
          },
          {
            meal: "Lunch",
            time: "1:00 PM",
            recipe: {
              name: "Quick Veggie Wrap",
              ingredients: ["1 whole wheat wrap", "2 tbsp hummus", "Mixed vegetables", "1/4 cup chickpeas"],
              instructions: ["Spread hummus on wrap", "Add vegetables and chickpeas", "Roll up and enjoy"],
              nutrition: { calories: 400, protein: 15, carbs: 45, fats: 15 }
            }
          },
          {
            meal: "Dinner",
            time: "7:00 PM",
            recipe: {
              name: "Simple Rice Bowl",
              ingredients: ["1 cup brown rice", "1 cup mixed vegetables", "3 oz tofu", "2 tbsp soy sauce"],
              instructions: ["Cook rice according to package", "Sauté vegetables and tofu", "Combine and add sauce"],
              nutrition: { calories: 450, protein: 20, carbs: 65, fats: 10 }
            }
          }
        ],
        dailyNutrition: { calories: 1200, protein: 60, carbs: 160, fats: 30 }
      },
      // Tuesday
      {
        day: "Tuesday",
        meals: [
          {
            meal: "Breakfast",
            time: "8:00 AM",
            recipe: {
              name: "Yogurt Parfait",
              ingredients: ["1 cup Greek yogurt", "1/2 cup berries", "1/4 cup granola", "1 tsp honey"],
              instructions: ["Layer yogurt with berries and granola", "Drizzle with honey", "Serve immediately"],
              nutrition: { calories: 320, protein: 22, carbs: 45, fats: 8 }
            }
          },
          {
            meal: "Lunch",
            time: "1:00 PM",
            recipe: {
              name: "Quinoa Salad Bowl",
              ingredients: ["1 cup cooked quinoa", "1/2 cup beans", "1/2 cup vegetables", "2 tbsp vinaigrette"],
              instructions: ["Combine all ingredients", "Toss with dressing", "Season to taste"],
              nutrition: { calories: 380, protein: 16, carbs: 50, fats: 12 }
            }
          },
          {
            meal: "Dinner",
            time: "7:00 PM",
            recipe: {
              name: "Baked Sweet Potato",
              ingredients: ["1 large sweet potato", "1/2 cup black beans", "1/4 cup salsa", "1 tbsp greek yogurt"],
              instructions: ["Bake sweet potato until tender", "Top with beans, salsa, and yogurt", "Serve hot"],
              nutrition: { calories: 420, protein: 18, carbs: 70, fats: 5 }
            }
          }
        ],
        dailyNutrition: { calories: 1120, protein: 56, carbs: 165, fats: 25 }
      },
      // Wednesday
      {
        day: "Wednesday",
        meals: [
          {
            meal: "Breakfast",
            time: "8:00 AM",
            recipe: {
              name: "Avocado Toast",
              ingredients: ["2 slices whole grain bread", "1/2 avocado", "2 eggs", "Red pepper flakes"],
              instructions: ["Toast bread", "Mash avocado on toast", "Top with scrambled or fried eggs", "Sprinkle with red pepper flakes"],
              nutrition: { calories: 390, protein: 20, carbs: 35, fats: 22 }
            }
          },
          {
            meal: "Lunch",
            time: "1:00 PM",
            recipe: {
              name: "Lentil Soup",
              ingredients: ["1 cup lentils", "2 cups vegetable broth", "1/2 cup mixed vegetables", "1 tsp spices"],
              instructions: ["Simmer lentils in broth until tender", "Add vegetables and spices", "Cook until vegetables are soft"],
              nutrition: { calories: 350, protein: 18, carbs: 60, fats: 2 }
            }
          },
          {
            meal: "Dinner",
            time: "7:00 PM",
            recipe: {
              name: "Vegetable Stir Fry",
              ingredients: ["1 cup mixed vegetables", "3 oz tempeh", "1/2 cup brown rice", "2 tbsp stir fry sauce"],
              instructions: ["Stir fry vegetables and tempeh", "Serve over cooked brown rice", "Drizzle with sauce"],
              nutrition: { calories: 430, protein: 22, carbs: 55, fats: 12 }
            }
          }
        ],
        dailyNutrition: { calories: 1170, protein: 60, carbs: 150, fats: 36 }
      },
      // Thursday
      {
        day: "Thursday",
        meals: [
          {
            meal: "Breakfast",
            time: "8:00 AM",
            recipe: {
              name: "Smoothie Bowl",
              ingredients: ["1 frozen banana", "1/2 cup berries", "1 scoop protein powder", "1/4 cup almond milk", "Toppings of choice"],
              instructions: ["Blend frozen fruit with protein powder and milk", "Pour into a bowl", "Add toppings and enjoy"],
              nutrition: { calories: 340, protein: 25, carbs: 48, fats: 6 }
            }
          },
          {
            meal: "Lunch",
            time: "1:00 PM",
            recipe: {
              name: "Mediterranean Pita",
              ingredients: ["1 whole wheat pita", "2 tbsp hummus", "1/4 cup falafel", "Mixed salad greens"],
              instructions: ["Spread hummus inside pita", "Fill with falafel and greens", "Serve with lemon wedge"],
              nutrition: { calories: 370, protein: 14, carbs: 52, fats: 13 }
            }
          },
          {
            meal: "Dinner",
            time: "7:00 PM",
            recipe: {
              name: "Bean and Veggie Tacos",
              ingredients: ["2 corn tortillas", "1/2 cup black beans", "1/4 cup corn", "1/4 cup salsa", "1 tbsp greek yogurt"],
              instructions: ["Warm tortillas", "Fill with beans, corn, and toppings", "Serve immediately"],
              nutrition: { calories: 410, protein: 20, carbs: 65, fats: 8 }
            }
          }
        ],
        dailyNutrition: { calories: 1120, protein: 59, carbs: 165, fats: 27 }
      },
      // Friday
      {
        day: "Friday",
        meals: [
          {
            meal: "Breakfast",
            time: "8:00 AM",
            recipe: {
              name: "Chia Pudding",
              ingredients: ["3 tbsp chia seeds", "1 cup plant milk", "1 tsp vanilla extract", "1 tbsp maple syrup", "Fresh fruit"],
              instructions: ["Mix chia seeds with milk, vanilla, and sweetener", "Refrigerate overnight", "Top with fresh fruit"],
              nutrition: { calories: 310, protein: 12, carbs: 40, fats: 15 }
            }
          },
          {
            meal: "Lunch",
            time: "1:00 PM",
            recipe: {
              name: "Chickpea Salad Sandwich",
              ingredients: ["1/2 cup mashed chickpeas", "1 tbsp mayo or hummus", "Chopped vegetables", "2 slices whole grain bread"],
              instructions: ["Mix chickpeas with mayo and vegetables", "Spread on bread", "Cut and serve"],
              nutrition: { calories: 400, protein: 15, carbs: 55, fats: 14 }
            }
          },
          {
            meal: "Dinner",
            time: "7:00 PM",
            recipe: {
              name: "Zucchini Pasta",
              ingredients: ["2 zucchini, spiralized", "1/2 cup marinara sauce", "1/4 cup chickpeas", "2 tbsp nutritional yeast"],
              instructions: ["Sauté zucchini noodles until tender", "Add sauce and chickpeas", "Top with nutritional yeast"],
              nutrition: { calories: 350, protein: 18, carbs: 50, fats: 10 }
            }
          }
        ],
        dailyNutrition: { calories: 1060, protein: 45, carbs: 145, fats: 39 }
      },
      // Saturday
      {
        day: "Saturday",
        meals: [
          {
            meal: "Breakfast",
            time: "8:00 AM",
            recipe: {
              name: "Veggie Tofu Scramble",
              ingredients: ["6 oz firm tofu", "1/2 cup mixed vegetables", "1/4 tsp turmeric", "2 slices toast"],
              instructions: ["Crumble tofu in a pan", "Add vegetables and spices", "Cook until vegetables are tender", "Serve with toast"],
              nutrition: { calories: 380, protein: 25, carbs: 30, fats: 18 }
            }
          },
          {
            meal: "Lunch",
            time: "1:00 PM",
            recipe: {
              name: "Grain Bowl",
              ingredients: ["1 cup cooked farro", "1/2 cup roasted vegetables", "1/4 cup edamame", "2 tbsp dressing"],
              instructions: ["Combine all ingredients in a bowl", "Toss with dressing", "Serve warm or cold"],
              nutrition: { calories: 420, protein: 18, carbs: 65, fats: 10 }
            }
          },
          {
            meal: "Dinner",
            time: "7:00 PM",
            recipe: {
              name: "Stuffed Bell Peppers",
              ingredients: ["2 bell peppers", "1/2 cup cooked quinoa", "1/4 cup black beans", "1/4 cup corn", "2 tbsp salsa"],
              instructions: ["Cut peppers in half and remove seeds", "Mix quinoa with beans, corn, and salsa", "Stuff peppers with mixture", "Bake until peppers are tender"],
              nutrition: { calories: 380, protein: 16, carbs: 58, fats: 8 }
            }
          }
        ],
        dailyNutrition: { calories: 1180, protein: 59, carbs: 153, fats: 36 }
      },
      // Sunday
      {
        day: "Sunday",
        meals: [
          {
            meal: "Breakfast",
            time: "8:00 AM",
            recipe: {
              name: "Whole Grain Pancakes",
              ingredients: ["1 cup whole grain pancake mix", "1 cup plant milk", "1 tbsp ground flaxseed", "1/4 cup berries", "1 tbsp maple syrup"],
              instructions: ["Mix pancake batter according to package", "Add flaxseed", "Cook on griddle", "Top with berries and syrup"],
              nutrition: { calories: 380, protein: 12, carbs: 65, fats: 8 }
            }
          },
          {
            meal: "Lunch",
            time: "1:00 PM",
            recipe: {
              name: "Vegetable Soup",
              ingredients: ["2 cups mixed vegetables", "1 cup vegetable broth", "1/2 cup beans", "1 tsp herbs", "1 slice whole grain bread"],
              instructions: ["Simmer vegetables in broth", "Add beans and herbs", "Serve with whole grain bread"],
              nutrition: { calories: 320, protein: 15, carbs: 55, fats: 5 }
            }
          },
          {
            meal: "Dinner",
            time: "7:00 PM",
            recipe: {
              name: "Roasted Vegetable Plate",
              ingredients: ["2 cups mixed roasted vegetables", "1/2 cup quinoa", "1/4 cup hummus", "1 tbsp olive oil"],
              instructions: ["Roast vegetables with olive oil", "Serve over cooked quinoa", "Add a side of hummus"],
              nutrition: { calories: 450, protein: 18, carbs: 60, fats: 18 }
            }
          }
        ],
        dailyNutrition: { calories: 1150, protein: 45, carbs: 180, fats: 31 }
      }
    ],
    shoppingList: {
      protein: ["Tofu", "Protein powder", "Greek yogurt", "Tempeh", "Beans", "Chickpeas", "Edamame"],
      produce: ["Banana", "Mixed vegetables", "Berries", "Avocado", "Sweet potato", "Zucchini", "Bell peppers"],
      grains: ["Oats", "Brown rice", "Whole wheat wraps", "Quinoa", "Whole grain bread", "Corn tortillas", "Farro"],
      dairy: ["Greek yogurt"],
      other: ["Honey", "Hummus", "Soy sauce", "Maple syrup", "Chia seeds", "Nutritional yeast", "Salsa"]
    },
    mealPrepTips: [
      "Prepare grains and beans in batches for quick assembly",
      "Cut vegetables ahead of time and store in airtight containers",
      "Make overnight oats and chia pudding in advance for grab-and-go breakfasts",
      "Roast a variety of vegetables on Sunday to use throughout the week",
      "Freeze extra smoothie ingredients in portion-sized bags"
    ],
    batchCookingRecommendations: [
      "Cook a large pot of grains to use in multiple meals",
      "Roast a sheet pan of mixed vegetables to add to various dishes",
      "Prepare bean and grain bowls with different toppings for lunches",
      "Make a large batch of soup and freeze in individual portions"
    ]
  };

  // Sample user preferences - in a real app, these would come from user data
  const userPreferences = {
    dietType: (profile?.diet_preferences?.diet_type || "balanced") as 'vegetarian' | 'vegan' | 'non-vegetarian' | 'pescatarian' | 'flexitarian',
    dietPlanPreference: "balanced" as const,
    fitnessGoal: (profile?.fitness_goals?.[0] || "maintenance") as 'weight loss' | 'muscle gain' | 'improved fitness' | 'maintenance',
    allergies: profile?.allergies || [],
    mealFrequency: profile?.meal_frequency || 3,
    countryRegion: profile?.diet_preferences?.country_region || "International",
  };

  // Store meal times separately - will be mapped to meals after generation
  const userMealTimes = (profile?.diet_preferences as any)?.meal_times?.map((meal: any) => {
    // Handle different formats of meal time data
    if (typeof meal === 'string') {
      return meal;
    } else if (typeof meal === 'object' && meal !== null) {
      // If this is an object with a time property, extract it
      return meal.time || '12:00 PM';
    } else {
      return '12:00 PM'; // Default fallback
    }
  }) || ["8:00 AM", "12:30 PM", "6:30 PM"];

  // Create a mapping of meal type to meal time from user preferences
  const getMealTypeToTimeMap = (): Record<string, string> => {
    const mealTypeToTimeMap: Record<string, string> = {};
    
    // Get meal times from user preferences
    const mealTimes = (profile?.diet_preferences as any)?.meal_times || [];
    
    // Map meal types to times based on user preferences
    for (const meal of mealTimes) {
      if (typeof meal === 'object' && meal !== null) {
        const mealName = (meal.name || '').toLowerCase();
        const mealTime = meal.time || '12:00 PM';
        
        if (mealName.includes('breakfast')) {
          mealTypeToTimeMap['breakfast'] = mealTime;
        } else if (mealName.includes('lunch')) {
          mealTypeToTimeMap['lunch'] = mealTime;
        } else if (mealName.includes('dinner')) {
          mealTypeToTimeMap['dinner'] = mealTime;
        }
      }
    }
    
    // Set defaults if preferences aren't found
    if (!mealTypeToTimeMap['breakfast']) mealTypeToTimeMap['breakfast'] = '8:00 AM';
    if (!mealTypeToTimeMap['lunch']) mealTypeToTimeMap['lunch'] = '12:30 PM';
    if (!mealTypeToTimeMap['dinner']) mealTypeToTimeMap['dinner'] = '6:30 PM';
    
    return mealTypeToTimeMap;
  };

  const mapMealTimesToPlan = (plan, mealTimes) => {
    if (!plan || !plan.weeklyPlan) {
      return plan;
    }
    
    // Create a copy of the plan to avoid mutating the original
    const mappedPlan = JSON.parse(JSON.stringify(plan));
    
    // Get meal type to time mapping from user preferences
    const mealTypeToTimeMap = getMealTypeToTimeMap();
    
    console.log("Mapping meal times to plan with:", { mealTypeToTimeMap, mealTimes });
    
    // Apply preferred times to the meal plan
    mappedPlan.weeklyPlan.forEach(day => {
      // Ensure we have a valid meals array
      if (!day.meals || !Array.isArray(day.meals)) {
        console.warn(`mapMealTimesToPlan: No valid meals array found for day ${day.day}`);
        day.meals = [];
        return;
      }
      
      day.meals.forEach(meal => {
        // Skip if the meal object is invalid
        if (!meal) return;
        
        // Match meal type (case insensitive) with preferred time
        const mealType = (meal.meal || '').toLowerCase();
        let timeAssigned = false;
        
        // Try to assign time based on meal type
        for (const [type, time] of Object.entries(mealTypeToTimeMap)) {
          if (mealType.includes(type)) {
            // Ensure time is always a string
            meal.time = typeof time === 'string' ? time : 
                      (typeof time === 'object' && time !== null && 'time' in time) ? 
                      (time as { time: string }).time : '12:00 PM';
            timeAssigned = true;
            break;
          }
        }
        
        // If no match found, assign based on position in the day
        if (!timeAssigned && mealTimes.length > 0) {
          const mealIndex = day.meals.indexOf(meal);
          const mealTime = mealTimes[mealIndex % mealTimes.length];
          
          // Again, ensure we have a string
          if (typeof mealTime === 'string') {
            meal.time = mealTime;
          } else if (typeof mealTime === 'object' && mealTime !== null && 'time' in mealTime) {
            meal.time = (mealTime as { time: string }).time || '12:00 PM';
          } else {
            meal.time = '12:00 PM';
          }
        }
        
        // Ensure all meals have a default time as a last resort
        if (!meal.time || typeof meal.time === 'object') {
          meal.time = '12:00 PM';
        }
      });
    });
    
    return mappedPlan;
  };

  const saveMealPlan = async (plan: MealPlan) => {
    if (!profile) return;
    
    try {
      // Save to profile context and database
      await updateProfile({
        meal_plans: plan
      });
      console.log("Meal plan saved to database successfully");
    } catch (error) {
      console.error("Error saving meal plan:", error);
    }
  };

  // Enhanced validateAndRepairMealPlan function to handle all JSON structures
  const validateAndRepairMealPlan = (plan: any): MealPlan => {
    console.log("Validating meal plan structure");
    
    // If plan is null or undefined, use fallback
    if (!plan) {
      console.warn("Meal plan is null or undefined, using fallback");
      return fallbackMealPlan;
    }
    
    // Log the keys we received to help with debugging
    console.log("Plan keys received:", Object.keys(plan));
    
    try {
      // Case 1: Perfect structure - If the plan already has the correct weeklyPlan format
      if (plan.weeklyPlan && Array.isArray(plan.weeklyPlan) && plan.weeklyPlan.length > 0) {
        const firstDayMeals = plan.weeklyPlan[0]?.meals;
        
        // Check if first day has proper meals
        if (firstDayMeals && Array.isArray(firstDayMeals) && firstDayMeals.length > 0) {
          // Check if first meal has a recipe and it's not a placeholder
          const firstRecipe = firstDayMeals[0]?.recipe;
          if (firstRecipe && 
              firstRecipe.name && 
              firstRecipe.name !== "Recipe Name" && 
              !firstRecipe.name.includes("Placeholder")) {
            console.log("✅ Valid weeklyPlan structure with real recipes found:", firstRecipe.name);
            
            // Make sure the structure is complete - 7 days
            if (plan.weeklyPlan.length < 7) {
              console.log("Meal plan has only", plan.weeklyPlan.length, "days, adding missing days");
              // Extend to 7 days by copying existing days
              while (plan.weeklyPlan.length < 7) {
                const dayIndex = plan.weeklyPlan.length % plan.weeklyPlan.length;
                const dayName = getDayName(plan.weeklyPlan.length);
                const newDay = {
                  ...plan.weeklyPlan[dayIndex],
                  day: dayName
                };
                plan.weeklyPlan.push(newDay);
              }
            }
            
            // Add missing properties if needed
            return {
              id: plan.id || 'generated_meal_plan_' + Date.now(),
              weeklyPlan: plan.weeklyPlan,
              shoppingList: plan.shoppingList || {
                protein: [], produce: [], grains: [], dairy: [], other: []
              },
              mealPrepTips: plan.mealPrepTips || [],
              batchCookingRecommendations: plan.batchCookingRecommendations || []
            };
          }
        }
      }
      
      // Case 2: Flattened structure (common with repaired JSON)
      // Try to extract recipe data from flattened structure
      const extractedPlan = extractMealPlanFromFlattenedStructure(plan);
      if (extractedPlan) {
        console.log("✅ Successfully extracted meal plan from flattened structure");
        return extractedPlan;
      }
      
      // Case 3: Partial structure
      // Try to extract any valid days/meals from the structure
      const partialPlan = extractPartialMealPlan(plan);
      if (partialPlan) {
        console.log("✅ Extracted partial meal plan");
        return partialPlan;
      }
      
      // Case 4: No valid structure found, use fallback
      console.warn("⚠️ Could not determine plan format, using fallback");
      return fallbackMealPlan;
    } catch (error) {
      console.error("Error validating meal plan:", error);
      return fallbackMealPlan;
    }
  };

  // Helper function to extract meal plan from a flattened structure
  const extractMealPlanFromFlattenedStructure = (plan: any): MealPlan | null => {
    try {
      // Common patterns in flattened JSON from repairs
      // Look for recipe names, ingredients, etc. in any property
      const recipesExtracted: any[] = [];
      const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];
      
      // Extract recipe names from any string property
      Object.entries(plan).forEach(([key, value]) => {
        if (typeof value === 'string') {
          // Look for recipe patterns in the string
          mealTypes.forEach(mealType => {
            // Using regex to find recipe patterns
            const mealRegex = new RegExp(`"?${mealType}"?\\s*[:,"']\\s*["']?([^"',]+)["']?`, 'i');
            const match = value.match(mealRegex);
            
            if (match && match[1] && match[1].trim() !== 'Recipe Name') {
              const recipeName = match[1].trim();
              console.log(`Found recipe: ${recipeName} for meal: ${mealType}`);
              
              // Extract ingredients if possible
              let ingredients: string[] = [];
              const ingredientsRegex = /"ingredients"\s*[:,"']\s*\[(.*?)\]/i;
              const ingredientsMatch = value.match(ingredientsRegex);
              
              if (ingredientsMatch && ingredientsMatch[1]) {
                // Split by commas and clean up
                ingredients = ingredientsMatch[1]
                  .split(',')
                  .map(i => i.replace(/["']/g, '').trim())
                  .filter(i => i && i !== 'Ingredient 1' && i !== 'Ingredient 2');
              }
              
              // Extract nutrition if possible
              let nutrition = { calories: 0, protein: 0, carbs: 0, fats: 0 };
              
              // Try to find calories
              const caloriesRegex = /"calories"\s*[:,"']\s*(\d+)/i;
              const caloriesMatch = value.match(caloriesRegex);
              if (caloriesMatch && caloriesMatch[1]) {
                nutrition.calories = parseInt(caloriesMatch[1]);
              }
              
              // Add to extracted recipes
              recipesExtracted.push({
                name: recipeName,
                mealType: mealType,
                ingredients: ingredients,
                nutrition: nutrition
              });
            }
          });
        }
      });
      
      // If we found recipes, build a meal plan
      if (recipesExtracted.length > 0) {
        console.log(`Extracted ${recipesExtracted.length} recipes from flattened structure`);
        
        // Group recipes by meal type
        const groupedRecipes: { [key: string]: any[] } = {};
        recipesExtracted.forEach(recipe => {
          if (!groupedRecipes[recipe.mealType]) {
            groupedRecipes[recipe.mealType] = [];
          }
          groupedRecipes[recipe.mealType].push(recipe);
        });
        
        // Create days for the meal plan
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const weeklyPlan = days.map((day, dayIndex) => {
          const meals = [];
          
          // Add a meal for each meal type we found
          Object.keys(groupedRecipes).forEach((mealType, index) => {
            const recipeIndex = dayIndex % groupedRecipes[mealType].length;
            const recipe = groupedRecipes[mealType][recipeIndex];
            
            // Determine meal time based on type
            let mealTime = "8:00 AM";
            if (mealType.toLowerCase().includes('lunch')) {
              mealTime = "1:00 PM";
            } else if (mealType.toLowerCase().includes('dinner')) {
              mealTime = "7:00 PM";
            } else if (mealType.toLowerCase().includes('snack')) {
              mealTime = "4:00 PM";
            }
            
            meals.push({
              meal: mealType.charAt(0).toUpperCase() + mealType.slice(1),
              time: mealTime,
              recipe: {
                name: recipe.name,
                ingredients: recipe.ingredients.length > 0 ? recipe.ingredients : ["Fresh ingredients", "Spices", "Oil"],
                instructions: ["Prepare ingredients", "Cook according to traditional method", "Serve hot"],
                nutrition: recipe.nutrition
              }
            });
          });
          
          // Calculate daily nutrition
          const dailyNutrition = {
            calories: meals.reduce((sum, meal) => sum + (meal.recipe.nutrition?.calories || 0), 0) || 2000,
            protein: meals.reduce((sum, meal) => sum + (meal.recipe.nutrition?.protein || 0), 0) || 100,
            carbs: meals.reduce((sum, meal) => sum + (meal.recipe.nutrition?.carbs || 0), 0) || 250,
            fats: meals.reduce((sum, meal) => sum + (meal.recipe.nutrition?.fats || 0), 0) || 70
          };
          
          return {
            day,
            meals,
            dailyNutrition
          };
        });
        
        // If we couldn't extract enough meal types, add fallback meals
        if (Object.keys(groupedRecipes).length < 3) {
          const fallbackMealTypes = ['Breakfast', 'Lunch', 'Dinner'].filter(
            type => !Object.keys(groupedRecipes).some(
              m => m.toLowerCase() === type.toLowerCase()
            )
          );
          
          fallbackMealTypes.forEach(mealType => {
            console.log(`Adding fallback meal type: ${mealType}`);
            
            // Get fallback meal from the user's preferences
            const fallbackMeal = getFallbackMealByType(mealType, profile?.country_region || "international");
            
            weeklyPlan.forEach(day => {
              day.meals.push(fallbackMeal);
            });
          });
        }
        
        return {
          id: 'extracted_meal_plan_' + Date.now(),
          weeklyPlan: weeklyPlan,
          shoppingList: {
            protein: recipesExtracted.flatMap(r => r.ingredients.filter(i => isProtein(i))),
            produce: recipesExtracted.flatMap(r => r.ingredients.filter(i => isProduce(i))),
            grains: recipesExtracted.flatMap(r => r.ingredients.filter(i => isGrain(i))),
            dairy: recipesExtracted.flatMap(r => r.ingredients.filter(i => isDairy(i))),
            other: recipesExtracted.flatMap(r => r.ingredients.filter(i => 
              !isProtein(i) && !isProduce(i) && !isGrain(i) && !isDairy(i)
            ))
          },
          mealPrepTips: [
            "Prep ingredients in advance for faster cooking",
            "Store spices in airtight containers for freshness",
            "Batch cook staples like rice and beans"
          ],
          batchCookingRecommendations: [
            "Make extra portions and freeze them",
            "Prepare base sauces for multiple dishes"
          ]
        };
      }
      
      return null;
    } catch (error) {
      console.error("Error extracting from flattened structure:", error);
      return null;
    }
  };

  // Helper to extract partial meal plan when only some parts are valid
  const extractPartialMealPlan = (plan: any): MealPlan | null => {
    try {
      // Try to find any meal information in the object
      const validMeals: any[] = [];
      
      // Search recursively for recipe names and ingredients
      const findRecipes = (obj: any, path: string = "") => {
        if (!obj) return;
        
        if (typeof obj === 'object') {
          // Check if this object looks like a recipe
          if (obj.name && typeof obj.name === 'string' && 
              obj.name !== "Recipe Name" && 
              !obj.name.includes("Placeholder")) {
            
            console.log(`Found recipe at ${path}: ${obj.name}`);
            
            // Extract ingredients if possible
            let ingredients: string[] = [];
            const ingredientsRegex = /"ingredients"\s*[:,"']\s*\[(.*?)\]/i;
            const ingredientsMatch = obj.match(ingredientsRegex);
            
            if (ingredientsMatch && ingredientsMatch[1]) {
              // Split by commas and clean up
              ingredients = ingredientsMatch[1]
                .split(',')
                .map(i => i.replace(/["']/g, '').trim())
                .filter(i => i && i !== 'Ingredient 1' && i !== 'Ingredient 2');
            }
            
            // Extract nutrition if possible
            let nutrition = { calories: 0, protein: 0, carbs: 0, fats: 0 };
            
            // Try to find calories
            const caloriesRegex = /"calories"\s*[:,"']\s*(\d+)/i;
            const caloriesMatch = obj.match(caloriesRegex);
            if (caloriesMatch && caloriesMatch[1]) {
              nutrition.calories = parseInt(caloriesMatch[1]);
            }
            
            // Add to extracted recipes
            validMeals.push({
              name: obj.name,
              ingredients: ingredients,
              nutrition: nutrition
            });
            return;
          }
          
          // Recurse into object/array
          Object.entries(obj).forEach(([key, value]) => {
            findRecipes(value, path ? `${path}.${key}` : key);
          });
        }
      };
      
      findRecipes(plan);
      
      // If we found any valid recipes, build a meal plan
      if (validMeals.length > 0) {
        console.log(`Found ${validMeals.length} valid recipes in partial structure`);
        
        // Create a weekly plan with the valid meals
        const weeklyPlan = [];
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const mealTypes = ['Breakfast', 'Lunch', 'Dinner'];
        
        for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
          const dayMeals = [];
          
          for (let mealIndex = 0; mealIndex < 3; mealIndex++) {
            const recipeIndex = (dayIndex * 3 + mealIndex) % validMeals.length;
            const recipe = validMeals[recipeIndex];
            
            // Determine meal time based on type
            let mealTime = "8:00 AM";
            if (mealIndex === 1) {
              mealTime = "1:00 PM";
            } else if (mealIndex === 2) {
              mealTime = "7:00 PM";
            }
            
            dayMeals.push({
              meal: mealTypes[mealIndex],
              time: mealTime,
              recipe: {
                name: recipe.name,
                ingredients: recipe.ingredients.length > 0 ? recipe.ingredients : ["Fresh ingredients", "Spices", "Oil"],
                instructions: ["Prepare ingredients", "Cook according to traditional method", "Serve hot"],
                nutrition: recipe.nutrition
              }
            });
          }
          
          // Calculate daily nutrition
          const dailyNutrition = {
            calories: dayMeals.reduce((sum, meal) => sum + (meal.recipe.nutrition?.calories || 0), 0) || 2000,
            protein: dayMeals.reduce((sum, meal) => sum + (meal.recipe.nutrition?.protein || 0), 0) || 100,
            carbs: dayMeals.reduce((sum, meal) => sum + (meal.recipe.nutrition?.carbs || 0), 0) || 250,
            fats: dayMeals.reduce((sum, meal) => sum + (meal.recipe.nutrition?.fats || 0), 0) || 70
          };
          
          weeklyPlan.push({
            day: days[dayIndex],
            meals: dayMeals,
            dailyNutrition
          });
        }
        
        return {
          id: 'partial_meal_plan_' + Date.now(),
          weeklyPlan: weeklyPlan,
          shoppingList: {
            protein: [],
            produce: [],
            grains: [],
            dairy: [],
            other: []
          },
          mealPrepTips: [
            "Prep ingredients in advance for faster cooking",
            "Store spices in airtight containers for freshness"
          ],
          batchCookingRecommendations: [
            "Make extra portions and freeze them"
          ]
        };
      }
      
      return null;
    } catch (error) {
      console.error("Error extracting partial meal plan:", error);
      return null;
    }
  };

  // Simple categorization helpers for ingredients
  const isProtein = (ingredient: string): boolean => {
    const proteins = ['chicken', 'beef', 'pork', 'fish', 'tofu', 'paneer', 'eggs', 'lentils', 'beans', 'dal'];
    return proteins.some(p => ingredient.toLowerCase().includes(p));
  };

  const isProduce = (ingredient: string): boolean => {
    const produce = ['vegetable', 'fruit', 'tomato', 'potato', 'onion', 'carrot', 'spinach', 'greens', 'broccoli'];
    return produce.some(p => ingredient.toLowerCase().includes(p));
  };

  const isGrain = (ingredient: string): boolean => {
    const grains = ['rice', 'wheat', 'flour', 'pasta', 'bread', 'chapati', 'roti', 'naan', 'cereal'];
    return grains.some(p => ingredient.toLowerCase().includes(p));
  };

  const isDairy = (ingredient: string): boolean => {
    const dairy = ['milk', 'cheese', 'yogurt', 'curd', 'cream', 'butter', 'ghee', 'paneer'];
    return dairy.some(p => ingredient.toLowerCase().includes(p));
  };

  // Get fallback meal by type and region
  const getFallbackMealByType = (mealType: string, region: string): any => {
    // Create region-specific fallback meals
    const regionMeals: Record<string, Record<string, any>> = {
      "india": {
        "Breakfast": {
          meal: "Breakfast",
          time: "8:00 AM",
          recipe: {
            name: "Masala Dosa with Coconut Chutney",
            ingredients: ["Rice batter", "Potatoes", "Onions", "Mustard seeds", "Curry leaves", "Coconut", "Green chilies"],
            instructions: ["Prepare dosa batter", "Make potato masala filling", "Cook thin dosas", "Serve with coconut chutney"],
            nutrition: { calories: 350, protein: 8, carbs: 60, fats: 8 }
          }
        },
        "Lunch": {
          meal: "Lunch",
          time: "1:00 PM",
          recipe: {
            name: "Chole Bhature",
            ingredients: ["Chickpeas", "Onions", "Tomatoes", "Spices", "All-purpose flour", "Yogurt", "Oil"],
            instructions: ["Prepare chickpea curry", "Make bhature dough", "Deep fry bhature", "Serve hot with chole"],
            nutrition: { calories: 550, protein: 18, carbs: 75, fats: 22 }
          }
        },
        "Dinner": {
          meal: "Dinner",
          time: "7:00 PM",
          recipe: {
            name: "Palak Paneer with Jeera Rice",
            ingredients: ["Spinach", "Paneer", "Onions", "Tomatoes", "Spices", "Basmati rice", "Cumin seeds"],
            instructions: ["Blanch spinach", "Prepare paneer gravy", "Cook jeera rice", "Serve hot"],
            nutrition: { calories: 450, protein: 22, carbs: 45, fats: 18 }
          }
        }
      },
      "international": {
        "Breakfast": {
          meal: "Breakfast",
          time: "8:00 AM",
          recipe: {
            name: "Avocado Toast with Poached Eggs",
            ingredients: ["Bread", "Avocado", "Eggs", "Olive oil", "Salt", "Pepper", "Lemon juice"],
            instructions: ["Toast bread", "Mash avocado with lemon and seasonings", "Poach eggs", "Assemble and serve"],
            nutrition: { calories: 380, protein: 15, carbs: 25, fats: 25 }
          }
        },
        "Lunch": {
          meal: "Lunch",
          time: "1:00 PM",
          recipe: {
            name: "Mediterranean Quinoa Bowl",
            ingredients: ["Quinoa", "Chickpeas", "Cucumber", "Cherry tomatoes", "Feta cheese", "Olive oil", "Lemon juice"],
            instructions: ["Cook quinoa", "Combine all ingredients", "Dress with olive oil and lemon", "Season and serve"],
            nutrition: { calories: 420, protein: 18, carbs: 50, fats: 16 }
          }
        },
        "Dinner": {
          meal: "Dinner",
          time: "7:00 PM",
          recipe: {
            name: "Baked Salmon with Roasted Vegetables",
            ingredients: ["Salmon fillet", "Broccoli", "Bell peppers", "Carrots", "Olive oil", "Garlic", "Herbs"],
            instructions: ["Season salmon", "Prepare vegetables", "Bake in oven", "Serve hot"],
            nutrition: { calories: 480, protein: 35, carbs: 25, fats: 22 }
          }
        }
      }
    };
    
    // Default to international if region not found
    const regionData = regionMeals[region.toLowerCase()] || regionMeals.international;
    
    // Default to breakfast if meal type not found
    return regionData[mealType] || regionData.Breakfast;
  };

  // Helper to get day name by index
  const getDayName = (index: number): string => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return days[index % 7];
  };

  // Generate meal plan function
  const generateMealPlan = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log("🍽️ Starting meal plan generation process...");
      
      // Get preferences from profile context
      const preferences = {
        dietType: profile?.diet_preferences?.diet_type || "balanced",
        dietPlanPreference: "balanced", // Default value
        restrictions: profile?.diet_preferences?.dietary_restrictions || [],
        allergies: profile?.diet_preferences?.allergies || [],
        excludedFoods: profile?.diet_preferences?.excluded_foods || [],
        favoriteFoods: profile?.diet_preferences?.favorite_foods || [],
        mealFrequency: profile?.diet_preferences?.meal_frequency || 3,
        countryRegion: profile?.diet_preferences?.country_region || "international",
        fitnessGoal: profile?.fitness_goals?.[0] || "general-fitness",
        calorieTarget: calculateCalorieTarget(profile),
        // Add an explicit requirement for unique meals for all 7 days
        requireFullWeek: true,
        requireUniqueMeals: true
      };
      
      console.log("🥗 Generating meal plan with preferences:", JSON.stringify(preferences));
      
      // Use the reliable meal plan generator with all fallback mechanisms
      console.log("🔄 Using reliable meal plan generator with multi-tier fallbacks");
      const rawMealPlan = await reliableMealPlanGenerator.generateMealPlan(preferences) as MealPlan;
      console.log("Plan received with", rawMealPlan.weeklyPlan.length, "days");
      
      // Log the initial structure of days
      console.log("Initial weeklyPlan structure:", rawMealPlan.weeklyPlan.map(day => ({
        day: day.day,
        mealCount: day.meals ? day.meals.length : 0,
        meals: day.meals ? day.meals.map(m => m.meal) : []
      })));
      
      // Check if we need to add missing days - this should be rare if LLM generates correctly
      const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
      const existingDays = new Set(rawMealPlan.weeklyPlan.map(day => day.day));
      
      // Add any missing days as a fallback
      for (const day of daysOfWeek) {
        if (!existingDays.has(day)) {
          console.log("Adding missing day:", day);
          
          // Generate a unique meal plan for this day rather than cloning
          try {
            // Find days with complete meal data to use as inspiration
            const completeDays = rawMealPlan.weeklyPlan.filter(d => d.meals && d.meals.length >= 3);
            
            if (completeDays.length > 0) {
              // Create new day with proper structure but different meals
              const newDay = {
                day: day,
                meals: [],
                dailyNutrition: { calories: 0, protein: 0, carbs: 0, fats: 0 }
              };
              
              // Use meal structure from existing days but create variations for each meal
              completeDays[0].meals.forEach(meal => {
                // Create variation of the meal
                const newMeal = {
                  meal: meal.meal,
                  time: meal.time,
                  recipe: {
                    // Modify recipe name to make it unique
                    name: `${meal.recipe.name} Variation`,
                    // Keep similar ingredients but suggest it's different
                    ingredients: [...meal.recipe.ingredients],
                    instructions: [...meal.recipe.instructions],
                    // Keep similar nutritional profile
                    nutrition: { ...meal.recipe.nutrition }
                  }
                };
                
                // Add meal to new day
                newDay.meals.push(newMeal);
                
                // Update daily nutrition
                newDay.dailyNutrition.calories += newMeal.recipe.nutrition.calories;
                newDay.dailyNutrition.protein += newMeal.recipe.nutrition.protein;
                newDay.dailyNutrition.carbs += newMeal.recipe.nutrition.carbs;
                newDay.dailyNutrition.fats += newMeal.recipe.nutrition.fats;
              });
              
              rawMealPlan.weeklyPlan.push(newDay);
              console.log(`Added ${newDay.meals.length} unique meals to ${day}`);
            } else {
              console.error("No complete days found to use as template for", day);
            }
          } catch (e) {
            console.error("Error creating unique meals for", day, e);
          }
        }
      }
      
      // Sort days in correct order
      rawMealPlan.weeklyPlan.sort((a, b) => {
        return daysOfWeek.indexOf(a.day) - daysOfWeek.indexOf(b.day);
      });
      
      // Log the final structure after repair
      console.log("Final weeklyPlan structure:", rawMealPlan.weeklyPlan.map(day => ({
        day: day.day,
        mealCount: day.meals ? day.meals.length : 0,
        meals: day.meals ? day.meals.map(m => m.meal) : []
      })));
      
      // Check if the meal plan is valid
      const validatedMealPlan = validateAndRepairMealPlan(rawMealPlan);
      if (validatedMealPlan) {
        console.log("Meal plan successfully validated");
        
        // Save to profile
          await saveMealPlan(validatedMealPlan);
        
        // Show success message
        setSnackbarMessage('Meal plan regenerated successfully!');
        setSnackbarVisible(true);
        
        // Done!
        console.log("📅 Meal plan generation completed");
        } else {
        setError({
          title: "Validation Error",
          message: "Generated meal plan failed validation",
          isRetryable: true
        });
      }
    } catch (error) {
      console.error("❌ Error generating meal plan:", error);
      setError({
        title: "Generation Error",
        message: "Failed to generate meal plan: " + (error as Error).message,
        isRetryable: true
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Helper function to check if meal plan contains real recipes
  const checkForRealRecipes = (plan: any): boolean => {
    if (!plan) return false;
    
    try {
      // Check weeklyPlan structure
      if (plan.weeklyPlan && Array.isArray(plan.weeklyPlan) && plan.weeklyPlan.length > 0) {
        const firstDay = plan.weeklyPlan[0];
        if (firstDay && firstDay.meals && Array.isArray(firstDay.meals) && firstDay.meals.length > 0) {
          const firstMeal = firstDay.meals[0];
          if (firstMeal && firstMeal.recipe && firstMeal.recipe.name) {
            const recipeName = firstMeal.recipe.name;
            return (
              recipeName !== 'Recipe Name' && 
              !recipeName.includes('Placeholder') &&
              !recipeName.includes('Template') &&
              !recipeName.includes('Example')
            );
          }
        }
      }
      
      return false;
    } catch (error) {
      console.error("Error checking for real recipes:", error);
      return false;
    }
  };

  // Validate that meal plan has actual content, not just template placeholders
  const validateMealPlanContent = (plan: any): boolean => {
    // Check if we have an actual meal plan with real content
    try {
      if (!plan || !plan.weeklyPlan || !Array.isArray(plan.weeklyPlan)) {
        return false;
      }
      
      // Check first day's first meal recipe name - if it's template placeholder, reject
      const firstMeal = plan.weeklyPlan[0]?.meals?.[0];
      if (!firstMeal || !firstMeal.recipe) {
        return false;
      }
      
      const recipeName = firstMeal.recipe.name;
      if (!recipeName || 
          recipeName === "Recipe Name" || 
          recipeName.includes("Template") || 
          recipeName.includes("Placeholder")) {
        console.error("Meal plan contains placeholder recipe names:", recipeName);
        return false;
      }
      
      // Check if ingredients are just placeholders
      const ingredients = firstMeal.recipe.ingredients;
      if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
        return false;
      }
      
      if (ingredients.every(ing => 
        ing === "Ingredient 1" || 
        ing === "Ingredient 2" || 
        ing.includes("Template") || 
        ing.includes("Placeholder"))) {
        console.error("Meal plan contains placeholder ingredients");
        return false;
      }
      
      return true;
    } catch (error) {
      console.error("Error validating meal plan content:", error);
      return false;
    }
  };

  // Generate a summary of the meal plan for the home screen
  const generateMealSummary = (plan: MealPlan): string => {
    if (!plan || !plan.weeklyPlan || plan.weeklyPlan.length === 0) {
      return "No meal plan available. Visit the nutrition tab to generate one.";
    }
    
    try {
      // Get average calories per day
      const totalCalories = plan.weeklyPlan.reduce(
        (sum, day) => sum + (day.dailyNutrition?.calories || 0), 
        0
      );
      const avgCalories = Math.round(totalCalories / plan.weeklyPlan.length);
      
      // Get meal count per day
      const avgMeals = Math.round(
        plan.weeklyPlan.reduce(
          (sum, day) => sum + (day.meals?.length || 0), 
          0
        ) / plan.weeklyPlan.length
      );
      
      // Create a summary string
      return `${avgMeals} meals per day averaging ${avgCalories} calories. Custom meal plan ready.`;
    } catch (error) {
      console.error("Error generating meal summary:", error);
      return "Custom meal plan available. Visit the nutrition tab for details.";
    }
  };

  // Load or generate a meal plan on initial load
  useEffect(() => {
    const loadMealPlan = async () => {
      try {
        setLoading(true);
        console.log("Loading meal plan...");
        
        if (profile?.meal_plans) {
          console.log("Loading existing meal plan from profile");
          try {
            // Validate and repair the meal plan structure if needed
            const validatedPlan = validateAndRepairMealPlan(profile.meal_plans);
            console.log("Meal plan successfully validated");
            
            // Set the meal plan directly first
            setMealPlan(validatedPlan);
            
            // Ensure we have a selected day
            if (validatedPlan?.weeklyPlan && validatedPlan.weeklyPlan.length > 0) {
              setSelectedDay(validatedPlan.weeklyPlan[0].day);
            }
            
            // Generate summary if it doesn't exist yet
            if (!profile.diet_preferences?.meal_summary) {
              console.log("Generating meal summary for cached plan");
              const summary = generateMealSummary(validatedPlan);
              
              // Save the summary to the database within diet_preferences JSONB field
              updateProfile({
                diet_preferences: {
                  ...profile.diet_preferences,
                  meal_summary: summary
                }
              });
            }
            
            console.log("Meal plan loaded successfully from cache");
          } catch (validationError) {
            console.error("Error validating cached meal plan:", validationError);
            console.log("Falling back to generating a new meal plan");
            await generateMealPlan();
          }
        } else {
          console.log("No existing meal plan found, generating new one");
          await generateMealPlan();
        }
        
        // Load completed meals after a short delay
        setTimeout(() => {
          if (user && mealPlan) {
            loadCompletedMeals();
          }
        }, 500);
      } catch (err) {
        console.error("Error in meal plan loading process:", err);
        setError({
          title: "Loading Error",
          message: "Failed to load meal plan. Please try again later.",
          isRetryable: true
        });
        // In case of error, try to generate a new one
        try {
          await generateMealPlan();
        } catch (genError) {
          console.error("Error generating fallback meal plan:", genError);
        }
      } finally {
        setLoading(false);
      }
    };
    
    if (profile && profile.id) {
      loadMealPlan();
    }
  }, [profile?.id]); // Only depend on profile.id, not the entire profile object

  // Load completed meals from the database
  const loadCompletedMeals = async () => {
    if (!user || !mealPlan) return;
    
    try {
      const today = new Date();
      const todayFormatted = format(today, 'yyyy-MM-dd');
      const completed: Record<string, Record<string, boolean>> = {};
      
      console.log('Loading completed meals for date:', todayFormatted);
      
      // Initialize the structure
      mealPlan?.weeklyPlan?.forEach(day => {
        completed[day.day] = {};
        day.meals?.forEach(meal => {
          completed[day.day][meal.meal] = false;
        });
      });
      
      // Check which meals are completed
      for (const day of mealPlan?.weeklyPlan || []) {
        for (const meal of day.meals || []) {
          try {
            console.log(`Checking if meal ${meal.meal} is completed for ${todayFormatted}`);
            const isCompleted = await isMealCompleted(user.id, todayFormatted, meal.meal);
            console.log(`Meal ${meal.meal} completed status:`, isCompleted);
            
            if (isCompleted) {
              completed[day.day][meal.meal] = true;
            }
          } catch (mealError) {
            console.error(`Error checking completion for meal ${meal.meal}:`, mealError);
            // Continue with other meals even if one fails
          }
        }
      }
      
      console.log('Final completed meals state:', completed);
      setCompletedMeals(completed);
    } catch (err) {
      console.error('Error loading completed meals:', err);
    }
  };

  // Mark a meal as complete
  const handleCompleteMeal = async (dayName: string, mealType: string) => {
    if (!user || !mealPlan) return;
    
    setMarkingMeal(true);
    
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      
      // Find the meal plan ID - use a real ID from the data if available
      const mealPlanId = mealPlan.id || 'default_meal_plan';
      
      console.log(`Attempting to mark meal complete: ${mealType} for ${today}, user ${user.id}, plan ${mealPlanId}`);
      
      // Mark meal as complete in the database
      const result = await markMealComplete(
        user.id,
        today,
        mealType,
        mealPlanId
      );
      
      if (result) {
        console.log('Meal marked as complete successfully:', result);
        // Update local state
        setCompletedMeals(prev => ({
          ...prev,
          [dayName]: {
            ...prev[dayName],
            [mealType]: true
          }
        }));
        
        // Emit event to notify other components (like Home tab) that a meal was completed
        EventRegister.emit('mealCompleted', {
          userId: user.id,
          date: today,
          mealType: mealType
        });
        
        // Show success message
        setSnackbarMessage(`${mealType} has been marked as consumed. Great job!`);
        setSnackbarVisible(true);
      } else {
        throw new Error('Failed to mark meal as complete');
      }
    } catch (err) {
      console.error('Error marking meal as complete:', err);
      setSnackbarMessage('Failed to mark meal as consumed. Please try again.');
      setSnackbarVisible(true);
    } finally {
      setMarkingMeal(false);
    }
  };

  // Load completed meals when meal plan changes
  useEffect(() => {
    if (mealPlan) {
      loadCompletedMeals();
    }
  }, [mealPlan, user]);

  // Find the selected day's plan
  const selectedDayPlan = useMemo(() => {
    if (!mealPlan?.weeklyPlan) return null;
    
    console.log("Searching for day in meal plan:", selectedDay);
    console.log("Available days in meal plan:", mealPlan.weeklyPlan.map(day => day.day));
    
    // Find the selected day in the meal plan
    const dayPlan = mealPlan.weeklyPlan.find(day => day.day === selectedDay);
    
    if (dayPlan) {
      console.log(`Found selected day (${selectedDay}) with ${dayPlan.meals?.length || 0} meals`);
      
      // Log the found meals for debugging
      if (dayPlan.meals && dayPlan.meals.length > 0) {
        console.log("Meals for selected day:", dayPlan.meals.map(meal => meal.meal));
        console.log("First meal recipe:", dayPlan.meals[0].recipe.name);
      } else {
        console.warn(`No meals found for ${selectedDay}`);
      }
      
      return dayPlan;
    } else {
      console.warn(`Could not find day ${selectedDay} in meal plan`);
      // If we can't find the selected day, default to the first day available
      if (mealPlan.weeklyPlan.length > 0) {
        const firstDay = mealPlan.weeklyPlan[0];
        console.log(`Defaulting to first day (${firstDay.day})`);
        
        // Update the selected day to match what we're displaying
        setSelectedDay(firstDay.day);
        return firstDay;
      }
    }
    
    return null;
  }, [mealPlan, selectedDay]);

  // Calculate calorie target based on user profile
  const calculateCalorieTarget = (profile: any): number => {
    // Basic BMR calculation using Mifflin-St Jeor Equation
    if (!profile || !profile.body_analysis) return 2000; // Default value
    
    const { weight_kg, height_cm } = profile.body_analysis;
    const age = profile.age || 30;
    const gender = profile.gender || 'neutral';
    
    if (!weight_kg || !height_cm) return 2000;
    
    // BMR calculation
    let bmr = 0;
    if (gender.toLowerCase() === 'female') {
      bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age - 161;
    } else {
      bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age + 5;
    }
    
    // Activity multiplier based on fitness level
    const activityLevels = {
      'beginner': 1.2, // Sedentary
      'intermediate': 1.375, // Light activity
      'advanced': 1.55 // Moderate activity
    };
    
    const activityMultiplier = activityLevels[profile.fitness_level || 'beginner'] || 1.2;
    
    // Calculate TDEE (Total Daily Energy Expenditure)
    const tdee = bmr * activityMultiplier;
    
    // Adjust based on goal
    const goalAdjustments = {
      'weight-loss': 0.8, // 20% deficit
      'muscle-gain': 1.1, // 10% surplus
      'maintenance': 1,
      'improved-fitness': 1
    };
    
    const primaryGoal = profile.fitness_goals?.[0] || 'maintenance';
    const goalMultiplier = goalAdjustments[primaryGoal] || 1;
    
    return Math.round(tdee * goalMultiplier);
  };

  // Debug mode for development
  const testWorkoutStyleGeneration = async () => {
    if (!profile?.diet_preferences) {
      setError({
        title: "Missing Diet Preferences",
        message: "Please complete your diet preferences in profile settings first.",
        isRetryable: false
      });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Prepare the user preferences for meal plan generation
      const userPreferences = {
        dietType: (profile?.diet_preferences?.diet_type || "non-vegetarian") as "vegetarian" | "vegan" | "non-vegetarian" | "pescatarian" | "flexitarian",
        dietPlanPreference: "balanced" as const,
        restrictions: profile?.diet_preferences?.dietary_restrictions || [],
        allergies: profile?.diet_preferences?.allergies || [],
        excludedFoods: profile?.diet_preferences?.excluded_foods || [],
        favoriteFoods: profile?.diet_preferences?.favorite_foods || [],
        mealFrequency: profile?.diet_preferences?.meal_frequency || 3,
        countryRegion: profile?.diet_preferences?.country_region || "international",
        fitnessGoal: (profile?.fitness_goals?.[0] || "maintenance") as "weight loss" | "muscle gain" | "improved fitness" | "maintenance",
        calorieTarget: calculateCalorieTarget(profile)
      };
      
      console.log("Testing workout-style generation with preferences:", JSON.stringify(userPreferences));
      
      // Call the new workout-style method directly
      const result = await gemini.generateMealPlanWithWorkoutStyle(userPreferences);
      console.log("Workout-style generation result received, validating...");
      
      // Validate and repair the plan
      const validatedResult = validateAndRepairMealPlan(result);
      console.log("Plan validated");
      
      // Apply meal times to the generated plan
      const mappedResult = mapMealTimesToPlan(validatedResult, userMealTimes);
      
      // Set the meal plan and save it to the profile
      setMealPlan(mappedResult);
      await saveMealPlan(mappedResult);
      
      // If we have a valid plan, select the first day
      if (mappedResult.weeklyPlan && mappedResult.weeklyPlan.length > 0) {
        setSelectedDay(mappedResult.weeklyPlan[0].day);
      }
      
      console.log("Debug meal plan generation complete");
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error("Error in debug meal plan generation:", errorMessage);
      setError({
        title: "Debug Generation Error",
        message: `Failed to generate meal plan: ${errorMessage}`,
        isRetryable: true
      });
    } finally {
      setLoading(false);
    }
  };

  // When returning to the nutrition tab, load the meal plan
  useEffect(() => {
    if (reload) {
      const loadData = async () => {
        try {
          setLoading(true);
          // Access profile data and attempt to load the meal plan from cache or database
          const cachedPlan = await AsyncStorage.getItem(`mealPlan:${profile?.id}`);
          if (cachedPlan) {
            setMealPlan(JSON.parse(cachedPlan));
          } else {
            // If no cached plan, you might want to generate a new one
            // or load from another source
            console.log('No cached meal plan found');
          }
        } catch (error) {
          console.error("Error loading meal plan:", error);
        } finally {
          setLoading(false);
        }
      };
      
      loadData();
      setReload(false);
    }
  }, [reload, profile]);

  return (
    <SafeAreaView style={styles.container} edges={['right', 'left']}>
      <StatusBar style="light" />
      
      {/* Gradient Background */}
      <LinearGradient
        colors={[colors.primary.dark, colors.background.primary]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.3 }}
      />
      
      {/* Header */}
      <View style={styles.header}>
        <View>
          <StyledText variant="headingLarge" style={styles.title}>
            Meal Plan
          </StyledText>
        </View>
        <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}>
          <LinearGradient
            colors={[colors.primary.main, colors.secondary.main]}
            style={styles.profileGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Avatar.Text 
              size={40} 
              label={profile?.full_name ? profile.full_name.substring(0, 2).toUpperCase() : 'U'} 
              style={styles.profileAvatar}
              labelStyle={styles.profileLabel}
            />
          </LinearGradient>
        </TouchableOpacity>
      </View>
      
      {/* Main Content */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary.main} />
            <StyledText variant="bodyMedium" style={styles.loadingText}>Loading your meal plan...</StyledText>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <LinearGradient
              colors={['rgba(108, 19, 89, 0.7)', 'rgba(65, 12, 53, 0.9)']}
              style={styles.errorCard}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.errorIconContainer}>
                <MaterialCommunityIcons name="alert-circle" size={40} color="#FF9E9E" />
              </View>
              <StyledText variant="bodyLarge" style={styles.errorTitle}>
                Failed to generate meal plan. Please try again later.
              </StyledText>
              <StyledText variant="bodyMedium" style={styles.errorMessage}>
                {error?.message || 'Failed to load meal plan. Please try again.'}
              </StyledText>
              <TouchableOpacity 
                style={styles.retryButton} 
                onPress={generateMealPlan}
              >
                <LinearGradient
                  colors={['#FF4B81', '#FF6B4B']}
                  style={styles.gradientButton}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <StyledText variant="bodyMedium" style={styles.buttonText}>Try Again</StyledText>
                </LinearGradient>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        ) : (
          <>
            {/* Day Selector */}
            <FadeIn duration={600} delay={100}>
              <LinearGradient
                colors={[colors.surface.light, colors.surface.main]}
                style={styles.daySelectorContainer}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.daySelectorHeader}>
                  <StyledText variant="bodyLarge" style={styles.daySelectorTitle}>
                    Select Day
                  </StyledText>
                  <TouchableOpacity
                    style={styles.regenerateButton}
                    onPress={generateMealPlan}
                  >
                    <LinearGradient
                      colors={[colors.primary.main, colors.primary.dark]}
                      style={styles.regenerateGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <MaterialCommunityIcons name="refresh" size={16} color="white" />
                      <StyledText style={styles.regenerateText}>Regenerate</StyledText>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
                
                <View style={styles.daysContainer}>
                  {/* Log available days before rendering */}
                  {mealPlan?.weeklyPlan?.length > 0 && (() => {
                    console.log("Rendering day buttons, mealPlan available:", Boolean(mealPlan));
                    console.log("mealPlan?.weeklyPlan?.length:", mealPlan?.weeklyPlan?.length || 0);
                    
                    // Log all the days available in the meal plan
                    const availableDays = mealPlan.weeklyPlan.map(day => day.day);
                    console.log("Available days in meal plan:", availableDays);
                    
                    // Return nothing for this IIFE
                    return null;
                  })()}
                  
                  {/* Render day buttons */}
                  {weekdays.map(({ abbr, dayName }) => {
                    const isSelected = selectedDay === dayName;
                    
                    // Check if this day exists in the weekly plan (for debugging)
                    const dayExists = mealPlan?.weeklyPlan?.some(day => day.day === dayName);
                    
                    // Log basic debug info
                    console.log(`Day ${dayName}: exists=${dayExists}, selected=${isSelected}`);
                    
                    return (
                    <TouchableOpacity
                        key={abbr} 
                        style={[styles.weekdayButton, isSelected && styles.selectedWeekdayButton]}
                        onPress={() => setSelectedDay(dayName)}
                    >
                      <LinearGradient
                          colors={isSelected 
                          ? [colors.primary.main, colors.primary.dark]
                          : ['transparent', 'transparent']}
                          style={styles.weekdayGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      >
                        <StyledText 
                          variant="bodyMedium" 
                            style={isSelected ? styles.selectedWeekdayText : styles.weekdayText}
                        >
                            {abbr}
                        </StyledText>
                      </LinearGradient>
                    </TouchableOpacity>
                    );
                  })}
                </View>
              </LinearGradient>
            </FadeIn>
            
            {/* Daily Nutrition Goals */}
            <ScaleIn duration={600} delay={200}>
              <LinearGradient
                colors={[colors.primary.main, colors.secondary.main]}
                style={styles.nutritionCard}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <StyledText variant="headingSmall" style={styles.nutritionTitle}>
                  Daily Nutrition Goals
                </StyledText>
                
                <View style={styles.nutritionStats}>
                  <View style={styles.nutritionStat}>
                    <MaterialCommunityIcons name="fire" size={24} color={colors.text.primary} />
                    <StyledText variant="headingMedium" style={styles.statValue}>
                      {selectedDayPlan?.dailyNutrition?.calories || 0}
                    </StyledText>
                    <StyledText variant="bodySmall" style={styles.statLabel}>
                      calories
                    </StyledText>
                  </View>
                  
                  <View style={styles.nutritionStat}>
                    <MaterialCommunityIcons name="food-drumstick" size={24} color={colors.text.primary} />
                    <StyledText variant="headingMedium" style={styles.statValue}>
                      {selectedDayPlan?.dailyNutrition?.protein || 0}g
                    </StyledText>
                    <StyledText variant="bodySmall" style={styles.statLabel}>
                      protein
                    </StyledText>
                  </View>
                  
                  <View style={styles.nutritionStat}>
                    <MaterialCommunityIcons name="bread-slice" size={24} color={colors.text.primary} />
                    <StyledText variant="headingMedium" style={styles.statValue}>
                      {selectedDayPlan?.dailyNutrition?.carbs || 0}g
                    </StyledText>
                    <StyledText variant="bodySmall" style={styles.statLabel}>
                      carbs
                    </StyledText>
                  </View>
                  
                  <View style={styles.nutritionStat}>
                    <MaterialCommunityIcons name="oil" size={24} color={colors.text.primary} />
                    <StyledText variant="headingMedium" style={styles.statValue}>
                      {selectedDayPlan?.dailyNutrition?.fats || 0}g
                    </StyledText>
                    <StyledText variant="bodySmall" style={styles.statLabel}>
                      fats
                    </StyledText>
                  </View>
                </View>
              </LinearGradient>
            </ScaleIn>
            
            {/* Simplified Meal Cards with popup functionality */}
            {selectedDayPlan?.meals?.map((meal, index) => {
              // Clean up recipe name (remove quotes)
              const recipeName = meal?.recipe?.name 
                ? String(meal.recipe.name).replace(/^"/, '').replace(/"$/, '')
                : 'Recipe';
              
              // Get meal icon based on name
              const getMealIcon = (): any => {
                const name = (meal.meal || '').toLowerCase();
                if (name.includes('breakfast')) return "food-apple";
                if (name.includes('lunch')) return "food-turkey";
                if (name.includes('dinner')) return "food";
                if (name.includes('snack')) return "food-croissant";
                return "food-fork-drink";
              };
              
              return (
              <SlideIn key={`meal-${index}`} duration={500} delay={300 + (index * 100)}>
                <TouchableOpacity
                  style={styles.mealContainer}
                  onPress={() => openMealDetail(meal)}
                >
                  <LinearGradient
                    colors={[colors.surface.light, colors.surface.main]}
                    style={[styles.mealCard, isMealMarkedComplete(selectedDay, meal.meal) && styles.completedMealCard]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <View style={styles.mealHeader}>
                      <View style={styles.mealTitleContainer}>
                        <MaterialCommunityIcons 
                            name={getMealIcon()} 
                          size={28} 
                          color={colors.primary.main} 
                        />
                        <StyledText variant="headingMedium" style={styles.mealTitle}>
                          {meal.meal}
                        </StyledText>
                        
                        {isMealMarkedComplete(selectedDay, meal.meal) && (
                          <View style={styles.completedBadge}>
                            <MaterialCommunityIcons 
                              name="check-circle" 
                              size={18} 
                              color={colors.accent.green} 
                            />
                            <StyledText variant="bodySmall" style={styles.completedText}>
                              Completed
                        </StyledText>
                          </View>
                        )}
                      </View>
                      <View style={styles.mealActions}>
                        <StyledText variant="bodyMedium" style={styles.mealTime}>
                          <MaterialCommunityIcons name="clock-outline" size={16} color={colors.text.muted} />
                          {' '}{meal.time}
                        </StyledText>
                        <MaterialCommunityIcons 
                          name="chevron-right" 
                          size={24} 
                          color={colors.primary.main} 
                        />
                      </View>
                    </View>
                      
                      <StyledText variant="bodyLarge" style={styles.recipeName}>
                        {recipeName}
                      </StyledText>
                    
                    <View style={styles.nutritionBadges}>
                      <View style={styles.badge}>
                        <MaterialCommunityIcons name="fire" size={16} color={colors.accent.gold} />
                        <StyledText variant="bodySmall" style={styles.badgeText}>
                          {meal.recipe?.nutrition?.calories || 0} cal
                        </StyledText>
                      </View>
                      
                      <View style={styles.badge}>
                        <MaterialCommunityIcons name="food-drumstick" size={16} color={colors.accent.lavender} />
                        <StyledText variant="bodySmall" style={styles.badgeText}>
                          {meal.recipe?.nutrition?.protein || 0}g protein
                        </StyledText>
                      </View>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              </SlideIn>
              );
            })}
          </>
        )}
      </ScrollView>
      
      {/* Meal Detail Modal */}
      <Modal
        visible={mealModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setMealModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {selectedMeal && (
                <>
                  <View style={styles.modalHeader}>
                    <TouchableOpacity 
                      onPress={() => setMealModalVisible(false)} 
                      style={styles.closeButton}
                    >
                      <MaterialCommunityIcons name="close" size={24} color={colors.text.primary} />
                    </TouchableOpacity>
                    <StyledText variant="headingMedium" style={styles.modalTitle}>
                      {selectedMeal.meal || 'Meal'} - {selectedMeal.time || 'Time'}
                    </StyledText>
                  </View>
                  
                  <View style={styles.mealDetailContainer}>
                    <StyledText variant="headingSmall" style={styles.recipeTitle}>
                      {selectedMeal.recipe?.name || 'Recipe'}
                    </StyledText>
                    
                    <View style={styles.nutritionBadges}>
                      <View style={styles.badge}>
                        <MaterialCommunityIcons name="fire" size={16} color={colors.accent.gold} />
                        <StyledText variant="bodySmall" style={styles.badgeText}>
                          {selectedMeal.recipe?.nutrition?.calories || 0} cal
                        </StyledText>
                      </View>
                      
                      <View style={styles.badge}>
                        <MaterialCommunityIcons name="food-drumstick" size={16} color={colors.accent.lavender} />
                        <StyledText variant="bodySmall" style={styles.badgeText}>
                          {selectedMeal.recipe?.nutrition?.protein || 0}g protein
                        </StyledText>
                      </View>
                    </View>
                    
                    <TouchableOpacity 
                      style={styles.sectionButton}
                      onPress={() => toggleSection('modal-ingredients')}
                    >
                      <View style={styles.sectionHeader}>
                        <MaterialCommunityIcons name="food-apple" size={20} color={colors.primary.main} />
                        <StyledText variant="bodyLarge" style={styles.sectionTitle}>
                          Ingredients
                        </StyledText>
                      </View>
                      <MaterialCommunityIcons 
                        name={expandedSections['modal-ingredients'] ? "chevron-up" : "chevron-down"} 
                        size={24} 
                        color={colors.text.muted} 
                      />
                    </TouchableOpacity>
                    
                    {expandedSections['modal-ingredients'] && (
                      <View style={styles.sectionContent}>
                        {(selectedMeal.recipe?.ingredients || []).map((ingredient, ingIndex) => (
                          <View key={`ingredient-${ingIndex}`} style={styles.ingredientItem}>
                            <View style={styles.bulletPoint} />
                            <StyledText variant="bodyMedium" style={styles.ingredientText}>
                              {ingredient}
                            </StyledText>
                          </View>
                        ))}
                      </View>
                    )}
                    
                    <TouchableOpacity 
                      style={styles.sectionButton}
                      onPress={() => toggleSection('modal-instructions')}
                    >
                      <View style={styles.sectionHeader}>
                        <MaterialCommunityIcons name="chef-hat" size={20} color={colors.primary.main} />
                        <StyledText variant="bodyLarge" style={styles.sectionTitle}>
                          Instructions
                        </StyledText>
                      </View>
                      <MaterialCommunityIcons 
                        name={expandedSections['modal-instructions'] ? "chevron-up" : "chevron-down"} 
                        size={24} 
                        color={colors.text.muted} 
                      />
                    </TouchableOpacity>
                    
                    {expandedSections['modal-instructions'] && (
                      <View style={styles.sectionContent}>
                        {(selectedMeal.recipe?.instructions || []).map((instruction, instIndex) => (
                          <View key={`instruction-${instIndex}`} style={styles.instructionItem}>
                            <View style={styles.instructionNumber}>
                              <StyledText variant="bodySmall" style={styles.numberText}>
                                {instIndex + 1}
                              </StyledText>
                            </View>
                            <StyledText variant="bodyMedium" style={styles.instructionText}>
                              {instruction}
                            </StyledText>
                          </View>
                        ))}
                      </View>
                    )}
                    
                    <TouchableOpacity
                      style={styles.markCompleteButton}
                      onPress={() => {
                        handleCompleteMeal(selectedDay, selectedMeal.meal);
                        setMealModalVisible(false);
                      }}
                      disabled={markingMeal || isMealMarkedComplete(selectedDay, selectedMeal.meal)}
                    >
                      <LinearGradient
                        colors={isMealMarkedComplete(selectedDay, selectedMeal.meal) 
                          ? [colors.accent.green, colors.accent.green] 
                          : [colors.primary.main, colors.primary.dark]}
                        style={styles.gradientButton}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      >
                        <MaterialCommunityIcons 
                          name={isMealMarkedComplete(selectedDay, selectedMeal.meal) ? "check-circle" : "silverware-fork-knife"} 
                          size={20} 
                          color={colors.text.primary} 
                        />
                        <StyledText variant="bodyMedium" style={styles.buttonText}>
                          {isMealMarkedComplete(selectedDay, selectedMeal.meal) 
                            ? "Marked as Consumed" 
                            : markingMeal ? "Marking..." : "Mark as Consumed"}
                        </StyledText>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
      
      {/* Snackbar for notifications */}
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        style={styles.snackbar}
      >
        {snackbarMessage}
      </Snackbar>

      {/* Remove all debug controls */}
    </SafeAreaView>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  title: {
    color: colors.text.primary,
    fontSize: 32,
    fontWeight: 'bold',
  },
  profileGradient: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.medium,
  },
  profileAvatar: {
    backgroundColor: 'transparent',
  },
  profileLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.text.secondary,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  errorCard: {
    width: '100%',
    padding: spacing.xl,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.medium,
  },
  errorIconContainer: {
    marginBottom: spacing.md,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF9E9E',
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  errorMessage: {
    textAlign: 'center',
    color: 'white',
    marginBottom: spacing.xl,
  },
  retryButton: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    width: '100%',
  },
  gradientButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  daySelectorCard: {
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
    ...shadows.small,
  },
  dayScrollContent: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  dayButton: {
    marginHorizontal: spacing.xs,
    borderRadius: borderRadius.round,
    overflow: 'hidden',
  },
  selectedDayButton: {
    ...shadows.small,
  },
  dayGradient: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.round,
  },
  dayText: {
    color: colors.text.secondary.toString(),
  },
  selectedDayText: {
    color: colors.text.primary.toString(),
    fontWeight: 'bold',
  },
  nutritionCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.medium,
  },
  nutritionTitle: {
    color: colors.text.primary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  nutritionStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
  },
  nutritionStat: {
    alignItems: 'center',
  },
  statValue: {
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
  statLabel: {
    color: colors.text.secondary,
  },
  mealContainer: {
    marginBottom: spacing.lg,
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  mealTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mealTitle: {
    color: colors.text.primary,
    marginLeft: spacing.sm,
  },
  mealTime: {
    color: colors.text.muted,
  },
  mealCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.medium,
  },
  recipeName: {
    color: colors.text.primary,
    fontWeight: 'bold',
    marginBottom: spacing.md,
  },
  nutritionBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.md,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.round,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  badgeText: {
    color: colors.text.secondary,
    marginLeft: spacing.xs,
  },
  sectionButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    color: colors.text.primary,
    marginLeft: spacing.sm,
  },
  sectionContent: {
    paddingVertical: spacing.md,
  },
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  bulletPoint: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary.light,
    marginRight: spacing.sm,
  },
  ingredientText: {
    color: colors.text.secondary,
    flex: 1,
  },
  instructionItem: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  instructionNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary.main,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
    marginTop: 2,
  },
  numberText: {
    color: colors.text.primary,
    fontWeight: 'bold',
    fontSize: 12,
  },
  instructionText: {
    color: colors.text.secondary,
    flex: 1,
  },
  markCompleteButton: {
    marginTop: spacing.lg,
    borderRadius: borderRadius.round,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  snackbar: {
    backgroundColor: colors.surface.dark,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: colors.background.primary,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  closeButton: {
    padding: spacing.xs,
  },
  modalTitle: {
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: spacing.sm,
  },
  mealDetailContainer: {
    padding: spacing.md,
  },
  mealActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recipeTitle: {
    color: colors.text.primary,
    marginBottom: spacing.md,
    fontWeight: 'bold',
  },
  formatCheckerButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginTop: spacing.sm,
    alignSelf: 'center',
  },
  formatCheckerText: {
    color: '#00FF00',
    fontSize: 12,
  },
  daySelectHint: {
    color: colors.text.secondary,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  weekdayContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  weekdayButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    marginHorizontal: 2,
  },
  selectedWeekdayButton: {
    ...shadows.small,
  },
  weekdayGradient: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdayText: {
    color: colors.text.secondary,
    fontSize: 14,
    textAlign: 'center',
  },
  selectedWeekdayText: {
    color: colors.text.primary,
    fontWeight: 'bold',
    fontSize: 16,
    textAlign: 'center',
  },
  daySelectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  regenerateButton: {
    overflow: 'hidden',
    borderRadius: borderRadius.sm,
    elevation: 2,
    ...shadows.small,
  },
  regenerateGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  regenerateText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  daySelectorContainer: {
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
    ...shadows.small,
  },
  daySelectorTitle: {
    color: colors.text.primary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  daysContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  completedMealCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.accent.green,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(75, 181, 67, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.md,
    marginLeft: 8,
  },
  completedText: {
    color: colors.accent.green,
    marginLeft: 4,
    fontWeight: '500',
  },
});

const modalStyles = {
  container: {
    backgroundColor: colors.surface.dark,
    borderRadius: borderRadius.lg,
    margin: spacing.lg,
    overflow: 'hidden',
  },
  backgroundOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    flex: 1,
  },
  content: {
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    color: colors.text.primary,
    fontSize: 22,
    fontWeight: 'bold',
  },
  ingredient: {
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  instructionText: {
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  scrollContent: {
    flexGrow: 1,
  },
};
