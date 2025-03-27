import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Dimensions } from 'react-native';
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
              colors={[colors.surface.light, colors.surface.main]}
              style={styles.errorCard}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <MaterialCommunityIcons name="alert-circle" size={40} color={colors.feedback.error} />
              <StyledText variant="bodyLarge" style={styles.errorTitle}>{error || 'Error'}</StyledText>
              <StyledText variant="bodyMedium" style={styles.errorMessage}>Failed to load meal plan. Please try again.</StyledText>
              <TouchableOpacity 
                style={styles.retryButton} 
                onPress={generateMealPlan}
              >
                <LinearGradient
                  colors={[colors.primary.main, colors.primary.dark]}
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
            <FadeIn from={0} duration={500}>
              <LinearGradient
                colors={[colors.surface.light, colors.surface.main]}
                style={styles.daySelectorCard}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.dayScrollContent}
                >
                  {mealPlan?.weeklyPlan.map((dayPlan, index) => (
                    <TouchableOpacity
                      key={`day-${index}`}
                      style={[
                        styles.dayButton,
                        selectedDay === dayPlan.day && styles.selectedDayButton
                      ]}
                      onPress={() => setSelectedDay(dayPlan.day)}
                    >
                      <LinearGradient
                        colors={selectedDay === dayPlan.day 
                          ? [colors.primary.main, colors.primary.dark]
                          : ['transparent', 'transparent']}
                        style={styles.dayGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      >
                        <StyledText 
                          variant="bodyMedium" 
                          style={[
                            styles.dayText,
                            selectedDay === dayPlan.day && styles.selectedDayText
                          ]}
                        >
                          {dayPlan.day}
                        </StyledText>
                      </LinearGradient>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
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
                      {selectedDayPlan?.dailyNutrition.calories || 0}
                    </StyledText>
                    <StyledText variant="bodySmall" style={styles.statLabel}>
                      calories
                    </StyledText>
                  </View>
                  
                  <View style={styles.nutritionStat}>
                    <MaterialCommunityIcons name="food-drumstick" size={24} color={colors.text.primary} />
                    <StyledText variant="headingMedium" style={styles.statValue}>
                      {selectedDayPlan?.dailyNutrition.protein || 0}g
                    </StyledText>
                    <StyledText variant="bodySmall" style={styles.statLabel}>
                      protein
                    </StyledText>
                  </View>
                  
                  <View style={styles.nutritionStat}>
                    <MaterialCommunityIcons name="bread-slice" size={24} color={colors.text.primary} />
                    <StyledText variant="headingMedium" style={styles.statValue}>
                      {selectedDayPlan?.dailyNutrition.carbs || 0}g
                    </StyledText>
                    <StyledText variant="bodySmall" style={styles.statLabel}>
                      carbs
                    </StyledText>
                  </View>
                  
                  <View style={styles.nutritionStat}>
                    <MaterialCommunityIcons name="oil" size={24} color={colors.text.primary} />
                    <StyledText variant="headingMedium" style={styles.statValue}>
                      {selectedDayPlan?.dailyNutrition.fats || 0}g
                    </StyledText>
                    <StyledText variant="bodySmall" style={styles.statLabel}>
                      fats
                    </StyledText>
                  </View>
                </View>
              </LinearGradient>
            </ScaleIn>
            
            {/* Meals for the selected day */}
            {selectedDayPlan?.meals.map((meal, index) => (
              <SlideIn from="right" key={`meal-${index}`} duration={500} delay={300 + (index * 100)}>
                <View style={styles.mealContainer}>
                  <View style={styles.mealHeader}>
                    <View style={styles.mealTitleContainer}>
                      <MaterialCommunityIcons 
                        name={meal.meal.toLowerCase().includes('breakfast') ? "food-apple" : 
                              meal.meal.toLowerCase().includes('lunch') ? "food-turkey" : 
                              meal.meal.toLowerCase().includes('dinner') ? "food" : "food-fork-drink"} 
                        size={28} 
                        color={colors.primary.main} 
                      />
                      <StyledText variant="headingMedium" style={styles.mealTitle}>
                        {meal.meal}
                      </StyledText>
                    </View>
                    <StyledText variant="bodyMedium" style={styles.mealTime}>
                      <MaterialCommunityIcons name="clock-outline" size={16} color={colors.text.muted} />
                      {' '}{meal.time}
                    </StyledText>
                  </View>
                  
                  <LinearGradient
                    colors={[colors.surface.light, colors.surface.main]}
                    style={styles.mealCard}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <StyledText variant="bodyLarge" style={styles.recipeName}>
                      {meal.recipe.name}
                    </StyledText>
                    
                    <View style={styles.nutritionBadges}>
                      <View style={styles.badge}>
                        <MaterialCommunityIcons name="fire" size={16} color={colors.accent.gold} />
                        <StyledText variant="bodySmall" style={styles.badgeText}>
                          {meal.recipe.nutrition.calories} cal
                        </StyledText>
                      </View>
                      
                      <View style={styles.badge}>
                        <MaterialCommunityIcons name="food-drumstick" size={16} color={colors.accent.lavender} />
                        <StyledText variant="bodySmall" style={styles.badgeText}>
                          {meal.recipe.nutrition.protein}g protein
                        </StyledText>
                      </View>
                      
                      <View style={styles.badge}>
                        <MaterialCommunityIcons name="bread-slice" size={16} color={colors.secondary.main} />
                        <StyledText variant="bodySmall" style={styles.badgeText}>
                          {meal.recipe.nutrition.carbs}g carbs
                        </StyledText>
                      </View>
                      
                      <View style={styles.badge}>
                        <MaterialCommunityIcons name="oil" size={16} color={colors.accent.green} />
                        <StyledText variant="bodySmall" style={styles.badgeText}>
                          {meal.recipe.nutrition.fats}g fats
                        </StyledText>
                      </View>
                    </View>
                    
                    <TouchableOpacity 
                      style={styles.sectionButton}
                      onPress={() => toggleSection(`ingredients-${index}`)}
                    >
                      <View style={styles.sectionHeader}>
                        <MaterialCommunityIcons name="food-apple" size={20} color={colors.primary.main} />
                        <StyledText variant="bodyLarge" style={styles.sectionTitle}>
                          Ingredients
                        </StyledText>
                      </View>
                      <MaterialCommunityIcons 
                        name={expandedSections[`ingredients-${index}`] ? "chevron-up" : "chevron-down"} 
                        size={24} 
                        color={colors.text.muted} 
                      />
                    </TouchableOpacity>
                    
                    {expandedSections[`ingredients-${index}`] && (
                      <View style={styles.sectionContent}>
                        {meal.recipe.ingredients.map((ingredient, ingIndex) => (
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
                      onPress={() => toggleSection(`instructions-${index}`)}
                    >
                      <View style={styles.sectionHeader}>
                        <MaterialCommunityIcons name="chef-hat" size={20} color={colors.primary.main} />
                        <StyledText variant="bodyLarge" style={styles.sectionTitle}>
                          Instructions
                        </StyledText>
                      </View>
                      <MaterialCommunityIcons 
                        name={expandedSections[`instructions-${index}`] ? "chevron-up" : "chevron-down"} 
                        size={24} 
                        color={colors.text.muted} 
                      />
                    </TouchableOpacity>
                    
                    {expandedSections[`instructions-${index}`] && (
                      <View style={styles.sectionContent}>
                        {meal.recipe.instructions.map((instruction, instIndex) => (
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
                      onPress={() => handleCompleteMeal(selectedDay, meal.meal)}
                      disabled={markingMeal}
                    >
                      <LinearGradient
                        colors={isMealMarkedComplete(selectedDay, meal.meal) 
                          ? [colors.accent.green, colors.accent.green] 
                          : [colors.primary.main, colors.primary.dark]}
                        style={styles.gradientButton}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      >
                        <MaterialCommunityIcons 
                          name={isMealMarkedComplete(selectedDay, meal.meal) ? "check-circle" : "silverware-fork-knife"} 
                          size={20} 
                          color={colors.text.primary} 
                        />
                        <StyledText variant="bodyMedium" style={styles.buttonText}>
                          {isMealMarkedComplete(selectedDay, meal.meal) 
                            ? "Marked as Consumed" 
                            : markingMeal ? "Marking..." : "Mark as Consumed"}
                        </StyledText>
                      </LinearGradient>
                    </TouchableOpacity>
                  </LinearGradient>
                </View>
              </SlideIn>
            ))}
          </>
        )}
      </ScrollView>
      
      {/* Snackbar for notifications */}
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        style={styles.snackbar}
      >
        {snackbarMessage}
      </Snackbar>
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
    paddingVertical: spacing.xl,
  },
  errorCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadows.medium,
  },
  errorTitle: {
    color: colors.feedback.error,
    marginTop: spacing.md,
    fontWeight: 'bold',
  },
  errorMessage: {
    marginTop: spacing.sm,
    textAlign: 'center',
    color: colors.text.secondary,
  },
  retryButton: {
    marginTop: spacing.lg,
    borderRadius: borderRadius.round,
    overflow: 'hidden',
  },
  gradientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.round,
  },
  buttonText: {
    color: colors.text.primary,
    fontWeight: 'bold',
    marginLeft: spacing.xs,
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
    color: colors.text.secondary,
  },
  selectedDayText: {
    color: colors.text.primary,
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
});

