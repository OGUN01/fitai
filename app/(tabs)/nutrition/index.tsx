import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Dimensions } from 'react-native';
import { Text, Button, Card, Title, Paragraph, Divider, List, Chip, useTheme, IconButton, Checkbox, Snackbar, Avatar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import gemini from '../../../lib/gemini';
import { useProfile } from '../../../contexts/ProfileContext';
import { useAuth } from '../../../contexts/AuthContext';
import supabase from '../../../lib/supabase';
import { format } from 'date-fns';
import { markMealComplete, isMealCompleted } from '../../../services/trackingService';
import { FadeIn, SlideIn, ScaleIn, Pulse } from '../../../components/animations';

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

/**
 * Nutrition screen - main entry point for the Nutrition tab
 */
export default function NutritionScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string>("Monday");
  const { profile, updateProfile } = useProfile();
  const [completedMeals, setCompletedMeals] = useState<Record<string, Record<string, boolean>>>({});
  const [markingMeal, setMarkingMeal] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  
  // Fallback meal plan for when the API fails
  const fallbackMealPlan: MealPlan = {
    id: 'default_meal_plan',
    weeklyPlan: [
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
      }
    ],
    shoppingList: {
      protein: ["Tofu", "Protein powder"],
      produce: ["Banana", "Mixed vegetables"],
      grains: ["Oats", "Brown rice", "Whole wheat wraps"],
      dairy: [],
      other: ["Honey", "Hummus", "Soy sauce"]
    },
    mealPrepTips: ["Prepare rice in batches", "Cut vegetables ahead of time"],
    batchCookingRecommendations: ["Make extra rice for multiple meals"]
  };

  // Sample user preferences - in a real app, these would come from user data
  const userPreferences = {
    dietType: (profile?.diet_type || "balanced") as 'vegetarian' | 'vegan' | 'non-vegetarian' | 'pescatarian' | 'flexitarian',
    dietPlanPreference: (profile?.diet_plan_preference || "balanced") as 'balanced' | 'high-protein' | 'low-carb' | 'keto' | 'mediterranean',
    fitnessGoal: (profile?.fitness_goal || "maintenance") as 'weight loss' | 'muscle gain' | 'improved fitness' | 'maintenance',
    allergies: profile?.allergies || [],
    mealFrequency: profile?.meal_frequency || 3,
    preferredMealTimes: ["8:00 AM", "12:30 PM", "6:30 PM"],
    countryRegion: "International",
    waterIntakeGoal: 2000,
    calorieTarget: 2000
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

  /**
   * Generate a meal plan using the Gemini AI
   */
  const generateMealPlan = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log("Generating meal plan with preferences:", JSON.stringify(userPreferences));
      const result = await gemini.generateMealPlan(userPreferences);
      
      // Check if we got a temporary service issue fallback
      if ('fallbackReason' in result && result.fallbackReason === 'temporary_service_issue') {
        console.log("Received temporary service issue fallback:", result.message);
        setError(result.message || 'We\'re experiencing some technical difficulties. Please try again in a few moments.');
        return; // Don't set or save the empty plan
      }
      
      if (!result || Object.keys(result).length === 0) {
        console.warn("Empty meal plan result");
        setError("Could not generate a complete meal plan. Please try again.");
      } else {
        console.log("Meal plan generated successfully");
        setMealPlan(result);
        saveMealPlan(result);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error("Error generating meal plan:", errorMessage);
      setError("Failed to generate meal plan. Please try again later.");
    } finally {
      setLoading(false);
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
          setMealPlan(profile.meal_plans as MealPlan);
          // Ensure we have a selected day
          if (profile.meal_plans?.weeklyPlan && profile.meal_plans.weeklyPlan.length > 0) {
            setSelectedDay(profile.meal_plans.weeklyPlan[0].day);
          }
          
          // Generate summary if it doesn't exist yet
          if (!profile.diet_preferences?.meal_summary) {
            console.log("Generating meal summary for cached plan");
            const summary = generateMealSummary(profile.meal_plans as MealPlan);
            
            // Save the summary to the database within diet_preferences JSONB field
            // instead of trying to save to a non-existent column
            updateProfile({
              diet_preferences: {
                ...profile.diet_preferences,
                meal_summary: summary
              }
            });
          }
        } else {
          console.log("No existing meal plan found, generating new one");
          await generateMealPlan();
        }
      } catch (err) {
        console.error("Error loading meal plan:", err);
        setError("Failed to load meal plan. Please try again later.");
        // In case of error, try to generate a new one
        await generateMealPlan();
      } finally {
        setLoading(false);
      }
    };
    
    loadMealPlan();
  }, [profile]);

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
  const selectedDayPlan = mealPlan?.weeklyPlan?.find(day => day.day === selectedDay);

  // Render meal component with tracking functionality
  const renderMeal = (meal: Meal, dayName: string) => {
    const isCompleted = completedMeals[dayName]?.[meal.meal] || false;
    
    return (
      <Card key={meal.meal} style={[styles.mealCard, isCompleted && styles.completedMealCard]} mode="outlined">
        <LinearGradient
          colors={isCompleted ? 
            [theme.colors.secondary, theme.colors.primary] : 
            ['#ffffff', '#f8f8f8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.cardGradient, isCompleted && styles.completedGradient]}
        >
          <Card.Content>
            <View style={styles.mealHeader}>
              <View style={styles.mealTitleContainer}>
                <View style={styles.mealTitleRow}>
                  <MaterialCommunityIcons 
                    name={meal.meal.toLowerCase().includes('breakfast') ? "food-apple" : 
                          meal.meal.toLowerCase().includes('lunch') ? "food-turkey" : 
                          meal.meal.toLowerCase().includes('dinner') ? "food" : "food-fork-drink"} 
                    size={24} 
                    color={isCompleted ? theme.colors.background : theme.colors.primary} 
                  />
                  <Text variant="titleMedium" style={[styles.mealTitle, isCompleted && styles.completedText]}>{meal.meal}</Text>
                </View>
                <Text variant="bodySmall" style={[styles.mealTime, isCompleted && styles.completedText]}>
                  <MaterialCommunityIcons name="clock-outline" size={14} color={isCompleted ? theme.colors.background : 'gray'} /> {meal.time}
                </Text>
              </View>
              {isCompleted ? (
                <View style={styles.consumedBadge}>
                  <MaterialCommunityIcons name="check-circle" size={20} color={theme.colors.background} />
                  <Text style={styles.consumedText}>Consumed</Text>
                </View>
              ) : (
                <TouchableOpacity 
                  style={styles.trackButton}
                  onPress={() => handleCompleteMeal(dayName, meal.meal)}
                  disabled={markingMeal}
                >
                  <LinearGradient 
                    colors={[theme.colors.primary, theme.colors.secondary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.trackButtonGradient}
                  >
                    <Text style={styles.trackButtonText}>Track</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
            
            <Divider style={styles.divider} />
            
            <Text variant="titleSmall" style={[styles.recipeTitle, isCompleted && styles.completedText]}>{meal.recipe.name}</Text>
            
            <View style={styles.nutritionInfo}>
              <View style={[styles.nutritionChip, isCompleted && styles.completedChip]}>
                <MaterialCommunityIcons name="fire" size={16} color={isCompleted ? theme.colors.background : theme.colors.primary} />
                <Text style={isCompleted ? styles.completedChipText : styles.chipText}>{meal.recipe.nutrition.calories} cal</Text>
              </View>
              <View style={[styles.nutritionChip, isCompleted && styles.completedChip]}>
                <MaterialCommunityIcons name="food-drumstick" size={16} color={isCompleted ? theme.colors.background : theme.colors.primary} />
                <Text style={isCompleted ? styles.completedChipText : styles.chipText}>{meal.recipe.nutrition.protein}g protein</Text>
              </View>
              <View style={[styles.nutritionChip, isCompleted && styles.completedChip]}>
                <MaterialCommunityIcons name="bread-slice" size={16} color={isCompleted ? theme.colors.background : theme.colors.primary} />
                <Text style={isCompleted ? styles.completedChipText : styles.chipText}>{meal.recipe.nutrition.carbs}g carbs</Text>
              </View>
              <View style={[styles.nutritionChip, isCompleted && styles.completedChip]}>
                <MaterialCommunityIcons name="oil" size={16} color={isCompleted ? theme.colors.background : theme.colors.primary} />
                <Text style={isCompleted ? styles.completedChipText : styles.chipText}>{meal.recipe.nutrition.fats}g fats</Text>
              </View>
            </View>
            
            <List.Accordion title="Ingredients" id={`ingredients-${meal.meal}`} style={styles.accordion}>
              {meal.recipe.ingredients.map((ingredient, index) => (
                <List.Item
                  key={`ingredient-${index}`}
                  title={ingredient}
                  left={props => <List.Icon {...props} icon="food" />}
                />
              ))}
            </List.Accordion>
            
            <List.Accordion title="Instructions" id={`instructions-${meal.meal}`} style={styles.accordion}>
              {meal.recipe.instructions.map((instruction, index) => (
                <List.Item
                  key={`instruction-${index}`}
                  title={instruction}
                  left={props => <List.Icon {...props} icon="numeric-${index + 1}-circle" />}
                  titleNumberOfLines={3}
                />
              ))}
            </List.Accordion>
          </Card.Content>
          <Card.Actions>
            <Button
              mode={isCompleted ? "outlined" : "contained"}
              icon={isCompleted ? "check" : "silverware-fork-knife"}
              onPress={() => handleCompleteMeal(dayName, meal.meal)}
              loading={markingMeal}
              disabled={markingMeal || isCompleted}
              style={styles.mealButton}
            >
              {isCompleted ? "Consumed" : "Mark as Consumed"}
            </Button>
          </Card.Actions>
        </LinearGradient>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <StatusBar style="light" />
      
      {/* Header with Bold Minimalism design */}
      <View style={styles.headerContainer}>
        <LinearGradient
          colors={[theme.colors.primary, theme.colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <FadeIn from={0} duration={600} delay={100}>
              <View style={styles.headerRow}>
                <Text variant="headlineMedium" style={styles.headerTitle}>Meal Plan</Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/profile')} style={styles.avatarContainer}>
                  <Avatar.Text size={40} label={profile?.full_name?.[0] || "U"} style={styles.avatar} />
                </TouchableOpacity>
              </View>
            </FadeIn>
          </View>
        </LinearGradient>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <LinearGradient
              colors={[theme.colors.secondary, theme.colors.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.loadingCard}
            >
              <ActivityIndicator size="large" color="white" />
              <Text style={styles.loadingText}>Creating your personalized meal plan...</Text>
            </LinearGradient>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Card style={styles.errorCard}>
              <Card.Content>
                <MaterialCommunityIcons name="alert-circle" size={48} color={theme.colors.error} style={styles.errorIcon} />
                <Text variant="headlineSmall" style={styles.errorTitle}>Oops!</Text>
                <Text style={styles.errorText}>{error}</Text>
                <Button 
                  mode="contained" 
                  onPress={generateMealPlan}
                  style={styles.errorButton}
                >
                  Try Again
                </Button>
              </Card.Content>
            </Card>
          </View>
        ) : mealPlan ? (
          <>
            {/* Day Selection with Gradient Tab Bar */}
            <View style={styles.daysContainer}>
              <LinearGradient
                colors={[theme.colors.primaryContainer, theme.colors.secondaryContainer]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.daysGradient}
              >
                <FadeIn from={0} duration={600} delay={200}>
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.daysScrollContent}
                  >
                    {mealPlan.weeklyPlan.map((day, index) => (
                      <SlideIn 
                        key={day.day} 
                        distance={20} 
                        direction="down" 
                        duration={500} 
                        delay={200 + (index * 50)}
                      >
                        <TouchableOpacity
                          style={[
                            styles.dayTab,
                            selectedDay === day.day && styles.selectedDayTab
                          ]}
                          onPress={() => setSelectedDay(day.day)}
                        >
                          <LinearGradient
                            colors={selectedDay === day.day ? 
                              [theme.colors.primary, theme.colors.secondary] : 
                              ['transparent', 'transparent']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.dayTabGradient}
                          >
                            <Text 
                              style={[
                                styles.dayTabText,
                                selectedDay === day.day && styles.selectedDayTabText
                              ]}
                            >
                              {day.day}
                            </Text>
                          </LinearGradient>
                        </TouchableOpacity>
                      </SlideIn>
                    ))}
                  </ScrollView>
                </FadeIn>
              </LinearGradient>
            </View>

            {/* Daily Nutrition Summary */}
            {selectedDayPlan && (
              <FadeIn from={0} duration={700} delay={400}>
                <LinearGradient
                  colors={[theme.colors.primary, theme.colors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.nutritionSummaryCard}
                >
                  <View style={styles.nutritionSummaryHeader}>
                    <Text variant="titleMedium" style={styles.nutritionSummaryTitle}>
                      Daily Nutrition Goals
                    </Text>
                  </View>
                  <View style={styles.nutritionSummaryContent}>
                    <View style={styles.nutritionSummaryItem}>
                      <MaterialCommunityIcons name="fire" size={24} color="white" />
                      <Text style={styles.nutritionSummaryValue}>
                        {selectedDayPlan.dailyNutrition.calories}
                      </Text>
                      <Text style={styles.nutritionSummaryLabel}>calories</Text>
                    </View>
                    <View style={styles.nutritionSummaryItem}>
                      <MaterialCommunityIcons name="food-drumstick" size={24} color="white" />
                      <Text style={styles.nutritionSummaryValue}>
                        {selectedDayPlan.dailyNutrition.protein}g
                      </Text>
                      <Text style={styles.nutritionSummaryLabel}>protein</Text>
                    </View>
                    <View style={styles.nutritionSummaryItem}>
                      <MaterialCommunityIcons name="bread-slice" size={24} color="white" />
                      <Text style={styles.nutritionSummaryValue}>
                        {selectedDayPlan.dailyNutrition.carbs}g
                      </Text>
                      <Text style={styles.nutritionSummaryLabel}>carbs</Text>
                    </View>
                    <View style={styles.nutritionSummaryItem}>
                      <MaterialCommunityIcons name="oil" size={24} color="white" />
                      <Text style={styles.nutritionSummaryValue}>
                        {selectedDayPlan.dailyNutrition.fats}g
                      </Text>
                      <Text style={styles.nutritionSummaryLabel}>fats</Text>
                    </View>
                  </View>
                </LinearGradient>
              </FadeIn>
            )}
            {/* Meals for the selected day */}
            {selectedDayPlan?.meals?.length > 0 ? (
              selectedDayPlan.meals.map((meal, index) => (
                <SlideIn 
                  key={`${meal.meal}-${index}`} 
                  distance={30} 
                  direction="right" 
                  duration={600} 
                  delay={500 + (index * 100)}
                >
                  {renderMeal(meal, selectedDayPlan.day)}
                </SlideIn>
              ))
            ) : (
              <FadeIn from={0} duration={600} delay={500}>
                <Card style={styles.noMealsCard}>
                  <Card.Content style={styles.noMealsContent}>
                    <MaterialCommunityIcons name="food-off" size={40} color={theme.colors.secondary} />
                    <Text style={[styles.noMealsText, {color: theme.colors.secondary}]}>No meals available for this day</Text>
                  </Card.Content>
                </Card>
              </FadeIn>
            )}
            
            {/* Shopping List with Bold Minimalism design */}
            <FadeIn from={0} duration={700} delay={800}>
              <Card style={styles.card} mode="outlined">
                <LinearGradient
                  colors={['#ffffff', '#f8f8f8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.cardGradient}
                >
                  <Card.Content>
                    <View style={styles.cardHeaderRow}>
                      <MaterialCommunityIcons name="cart-outline" size={24} color={theme.colors.primary} />
                      <Text variant="titleLarge" style={styles.cardTitle}>Shopping List</Text>
                    </View>
                    
                    <SlideIn distance={30} direction="left" duration={600} delay={900}>
                      <View style={styles.shoppingCategory}>
                        <View style={styles.categoryHeader}>
                          <MaterialCommunityIcons name="food-drumstick" size={20} color={theme.colors.primary} />
                          <Text variant="titleSmall" style={styles.sectionTitle}>Protein</Text>
                        </View>
                        <ScaleIn duration={500} delay={950}>
                          {mealPlan?.shoppingList?.protein?.map((item, i) => (
                            <View key={i} style={styles.listItemRow}>
                              <MaterialCommunityIcons name="circle-small" size={20} color={theme.colors.primary} />
                              <Text variant="bodyMedium" style={styles.listItem}>{item || 'Item not specified'}</Text>
                            </View>
                          )) || (
                            <View style={styles.listItemRow}>
                              <MaterialCommunityIcons name="circle-small" size={20} color={theme.colors.primary} />
                              <Text variant="bodyMedium" style={styles.listItem}>No protein items listed</Text>
                            </View>
                          )}
                        </ScaleIn>
                      </View>
                    </SlideIn>
                    
                    <SlideIn distance={30} direction="left" duration={600} delay={1100}>
                      <View style={styles.shoppingCategory}>
                        <View style={styles.categoryHeader}>
                          <MaterialCommunityIcons name="fruit-watermelon" size={20} color={theme.colors.primary} />
                          <Text variant="titleSmall" style={styles.sectionTitle}>Produce</Text>
                        </View>
                        <ScaleIn duration={500} delay={1150}>
                          {mealPlan?.shoppingList?.produce?.map((item, i) => (
                            <View key={i} style={styles.listItemRow}>
                              <MaterialCommunityIcons name="circle-small" size={20} color={theme.colors.primary} />
                              <Text variant="bodyMedium" style={styles.listItem}>{item || 'Item not specified'}</Text>
                            </View>
                          )) || (
                            <View style={styles.listItemRow}>
                              <MaterialCommunityIcons name="circle-small" size={20} color={theme.colors.primary} />
                              <Text variant="bodyMedium" style={styles.listItem}>No produce items listed</Text>
                            </View>
                          )}
                        </ScaleIn>
                      </View>
                    </SlideIn>
                    
                    <SlideIn distance={30} direction="left" duration={600} delay={1200}>
                      <View style={styles.shoppingCategory}>
                        <View style={styles.categoryHeader}>
                          <MaterialCommunityIcons name="bread-slice" size={20} color={theme.colors.primary} />
                          <Text variant="titleSmall" style={styles.sectionTitle}>Grains</Text>
                        </View>
                        <ScaleIn duration={500} delay={1250}>
                          {mealPlan?.shoppingList?.grains?.map((item, i) => (
                            <View key={i} style={styles.listItemRow}>
                              <MaterialCommunityIcons name="circle-small" size={20} color={theme.colors.primary} />
                              <Text variant="bodyMedium" style={styles.listItem}>{item || 'Item not specified'}</Text>
                            </View>
                          )) || (
                            <View style={styles.listItemRow}>
                              <MaterialCommunityIcons name="circle-small" size={20} color={theme.colors.primary} />
                              <Text variant="bodyMedium" style={styles.listItem}>No grain items listed</Text>
                            </View>
                          )}
                        </ScaleIn>
                      </View>
                    </SlideIn>
                    
                    <SlideIn distance={30} direction="left" duration={600} delay={1300}>
                      <View style={styles.shoppingCategory}>
                        <View style={styles.categoryHeader}>
                          <MaterialCommunityIcons name="cheese" size={20} color={theme.colors.primary} />
                          <Text variant="titleSmall" style={styles.sectionTitle}>Dairy</Text>
                        </View>
                        <ScaleIn duration={500} delay={1350}>
                          {mealPlan?.shoppingList?.dairy?.map((item, i) => (
                            <View key={i} style={styles.listItemRow}>
                              <MaterialCommunityIcons name="circle-small" size={20} color={theme.colors.primary} />
                              <Text variant="bodyMedium" style={styles.listItem}>{item || 'Item not specified'}</Text>
                            </View>
                          )) || (
                            <View style={styles.listItemRow}>
                              <MaterialCommunityIcons name="circle-small" size={20} color={theme.colors.primary} />
                              <Text variant="bodyMedium" style={styles.listItem}>No dairy items listed</Text>
                            </View>
                          )}
                        </ScaleIn>
                      </View>
                    </SlideIn>
                    
                    <SlideIn distance={30} direction="left" duration={600} delay={1400}>
                      <View style={styles.shoppingCategory}>
                        <View style={styles.categoryHeader}>
                          <MaterialCommunityIcons name="food-variant" size={20} color={theme.colors.primary} />
                          <Text variant="titleSmall" style={styles.sectionTitle}>Other</Text>
                        </View>
                        <ScaleIn duration={500} delay={1450}>
                          {mealPlan?.shoppingList?.other?.map((item, i) => (
                            <View key={i} style={styles.listItemRow}>
                              <MaterialCommunityIcons name="circle-small" size={20} color={theme.colors.primary} />
                              <Text variant="bodyMedium" style={styles.listItem}>{item || 'Item not specified'}</Text>
                            </View>
                          )) || (
                            <View style={styles.listItemRow}>
                              <MaterialCommunityIcons name="circle-small" size={20} color={theme.colors.primary} />
                              <Text variant="bodyMedium" style={styles.listItem}>No other items listed</Text>
                            </View>
                          )}
                        </ScaleIn>
                      </View>
                    </SlideIn>
                  </Card.Content>
                </LinearGradient>
              </Card>
            </FadeIn>

            {/* Meal Prep Tips with Bold Minimalism design */}
            <FadeIn from={0} duration={700} delay={1500}>
              <Card style={styles.card} mode="outlined">
                <LinearGradient
                  colors={['#ffffff', '#f8f8f8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.cardGradient}
                >
                  <Card.Content>
                    <View style={styles.cardHeaderRow}>
                      <MaterialCommunityIcons name="silverware-fork-knife" size={24} color={theme.colors.primary} />
                      <Text variant="titleLarge" style={styles.cardTitle}>Meal Prep Tips</Text>
                    </View>
                    
                    <SlideIn distance={20} direction="right" duration={500} delay={1600}>
                      {mealPlan?.mealPrepTips?.map((tip, i) => (
                        <ScaleIn key={i} duration={400} delay={1600 + (i * 100)}>
                          <View style={styles.tipsItemRow}>
                            <Pulse>
                              <MaterialCommunityIcons name="check-circle-outline" size={20} color={theme.colors.primary} />
                            </Pulse>
                            <Text variant="bodyMedium" style={styles.tipsItem}>{tip || 'Tip not specified'}</Text>
                          </View>
                        </ScaleIn>
                      )) || (
                        <View style={styles.tipsItemRow}>
                          <MaterialCommunityIcons name="information-outline" size={20} color={theme.colors.primary} />
                          <Text variant="bodyMedium" style={styles.tipsItem}>No meal prep tips available</Text>
                        </View>
                      )}
                    </SlideIn>
                  </Card.Content>
                </LinearGradient>
              </Card>
            </FadeIn>

            {/* Batch Cooking Recommendations with Bold Minimalism design */}
            <FadeIn from={0} duration={700} delay={1700}>
              <Card style={styles.card} mode="outlined">
                <LinearGradient
                  colors={['#ffffff', '#f8f8f8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.cardGradient}
                >
                  <Card.Content>
                    <View style={styles.cardHeaderRow}>
                      <MaterialCommunityIcons name="pot-steam" size={24} color={theme.colors.primary} />
                      <Text variant="titleLarge" style={styles.cardTitle}>Batch Cooking Ideas</Text>
                    </View>
                    
                    <SlideIn distance={20} direction="right" duration={500} delay={1800}>
                      {mealPlan?.batchCookingRecommendations?.map((tip, i) => (
                        <ScaleIn key={i} duration={400} delay={1800 + (i * 100)}>
                          <View style={styles.tipsItemRow}>
                            <Pulse>
                              <MaterialCommunityIcons name="chef-hat" size={20} color={theme.colors.primary} />
                            </Pulse>
                            <Text variant="bodyMedium" style={styles.tipsItem}>{tip || 'Recommendation not specified'}</Text>
                          </View>
                        </ScaleIn>
                      )) || (
                        <View style={styles.tipsItemRow}>
                          <MaterialCommunityIcons name="information-outline" size={20} color={theme.colors.primary} />
                          <Text variant="bodyMedium" style={styles.tipsItem}>No batch cooking recommendations available</Text>
                        </View>
                      )}
                    </SlideIn>
                  </Card.Content>
                </LinearGradient>
              </Card>
            </FadeIn>
          </>
        ) : (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleLarge" style={styles.cardTitle}>No Meal Plan</Text>
              <Text variant="bodyLarge">Tap the button below to generate a personalized meal plan.</Text>
            </Card.Content>
            <Card.Actions>
              <Button 
                mode="contained"
                onPress={generateMealPlan}
              >
                Generate Meal Plan
              </Button>
            </Card.Actions>
          </Card>
        )}
      </ScrollView>
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        action={{
          label: 'OK',
          onPress: () => setSnackbarVisible(false),
        }}
      >
        {snackbarMessage}
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  headerContainer: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    elevation: 4,
  },
  headerGradient: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: 'white',
    fontWeight: 'bold',
  },
  avatarContainer: {
    marginLeft: 16,
  },
  avatar: {
    backgroundColor: 'white',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  card: {
    marginBottom: 16,
    elevation: 2,
  },
  dayCard: {
    marginBottom: 16,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  mealCard: {
    marginBottom: 16,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  completedMealCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
    opacity: 0.9,
  },
  cardTitle: {
    marginBottom: 8,
    fontWeight: 'bold',
  },
  preferenceChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  chip: {
    marginRight: 8,
    marginBottom: 8,
  },
  daySelector: {
    marginBottom: 16,
  },
  daySelectorContent: {
    paddingVertical: 8,
  },
  dayChip: {
    marginRight: 8,
    paddingHorizontal: 12,
  },
  nutritionSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  nutritionItem: {
    alignItems: 'center',
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mealTitleContainer: {
    flexDirection: 'column',
  },
  mealTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mealTitle: {
    fontWeight: 'bold',
  },
  mealTime: {
    opacity: 0.7,
    marginTop: 2,
  },
  consumedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  consumedText: {
    marginLeft: 4,
    color: 'white',
  },
  trackButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    elevation: 2,
  },
  trackButtonGradient: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  trackButtonText: {
    color: 'white',
  },
  mealButton: {
    marginTop: 8,
  },
  nutritionInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  nutritionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f8f8f8',
  },
  completedChip: {
    backgroundColor: '#4CAF50',
  },
  chipText: {
    marginLeft: 4,
  },
  completedChipText: {
    color: 'white',
  },
  recipeTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  divider: {
    marginVertical: 12,
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  topMargin: {
    marginTop: 16,
  },
  listItem: {
    marginVertical: 4,
  },
  loadingContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingCard: {
    padding: 24,
    borderRadius: 8,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: 'white',
  },
  errorContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorCard: {
    marginBottom: 16,
    elevation: 2,
    backgroundColor: '#FFEBEE',
  },
  errorIcon: {
    marginBottom: 16,
  },
  errorTitle: {
    color: '#D32F2F',
    marginBottom: 8,
  },
  errorText: {
    color: '#D32F2F',
    marginBottom: 16,
  },
  errorButton: {
    marginTop: 8,
  },
  accordion: {
    marginBottom: 16,
  },
  cardGradient: {
    padding: 16,
    borderRadius: 8,
  },
  completedGradient: {
    backgroundColor: '#4CAF50',
  },
  completedText: {
    color: 'white',
  },
  daysContainer: {
    marginBottom: 16,
  },
  daysGradient: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  daysScrollContent: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  dayTab: {
    marginRight: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  selectedDayTab: {
    elevation: 2,
  },
  dayTabGradient: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  dayTabText: {
    fontSize: 16,
  },
  selectedDayTabText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  nutritionSummaryCard: {
    padding: 16,
    borderRadius: 8,
  },
  nutritionSummaryHeader: {
    marginBottom: 16,
  },
  nutritionSummaryTitle: {
    color: 'white',
  },
  nutritionSummaryContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  nutritionSummaryItem: {
    alignItems: 'center',
  },
  nutritionSummaryValue: {
    fontSize: 24,
    color: 'white',
  },
  nutritionSummaryLabel: {
    fontSize: 14,
    color: 'white',
    opacity: 0.7,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  shoppingCategory: {
    marginBottom: 16,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  listItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tipsItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tipsItem: {
    marginLeft: 8,
    flex: 1,
    flexWrap: 'wrap',
  },
  noMealsCard: {
    marginBottom: 16,
    elevation: 2,
  },
  noMealsContent: {
    padding: 16,
    alignItems: 'center',
  },
  noMealsText: {
    fontSize: 16,
    marginTop: 8,
  },
});
