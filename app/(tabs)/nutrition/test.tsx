import React, { useState } from 'react';
import { View, ScrollView, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { Text, Button, Card, Title, Paragraph, Divider, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useProfile } from '../../../contexts/ProfileContext';
import { reliableMealPlanGenerator } from '../../../services/ai';
import { colors, spacing, borderRadius, shadows } from '../../../theme/theme';
import StyledText from '../../../components/ui/StyledText';

// Interfaces for meal plan data structure
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
  id?: string;
  weeklyPlan: DayPlan[];
  shoppingList: ShoppingList;
  mealPrepTips?: string[];
  batchCookingRecommendations?: string[];
}

/**
 * Test screen for the new PydanticMealPlanGenerator
 */
export default function MealPlanGeneratorTest() {
  const theme = useTheme();
  const { profile } = useProfile();
  const [loading, setLoading] = useState(false);
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string>("Monday");
  const [generationTime, setGenerationTime] = useState<number | null>(null);

  // Calculate calorie target based on profile
  const calculateCalorieTarget = (profile: any): number => {
    const baseCals = profile?.body_metrics?.bmr || 2000;
    
    // Adjust based on fitness goal
    const goal = profile?.fitness_goals?.[0] || 'maintain-weight';
    
    if (goal === 'lose-weight') {
      return Math.round(baseCals * 0.85); // 15% deficit
    } else if (goal === 'gain-muscle') {
      return Math.round(baseCals * 1.15); // 15% surplus
    } else {
      return baseCals; // Maintenance calories
    }
  };

  // Generate meal plan using the new PydanticMealPlanGenerator
  const generateMealPlan = async () => {
    setLoading(true);
    setError(null);
    const startTime = Date.now();

    try {
      console.log("🍽️ Starting meal plan generation with PydanticMealPlanGenerator...");
      
      // Get preferences from profile context
      const preferences = {
        dietType: profile?.diet_preferences?.diet_type || "balanced",
        restrictions: profile?.diet_preferences?.dietary_restrictions || [],
        allergies: profile?.diet_preferences?.allergies || [],
        excludedFoods: profile?.diet_preferences?.excluded_foods || [],
        favoriteFoods: profile?.diet_preferences?.favorite_foods || [],
        mealFrequency: profile?.diet_preferences?.meal_frequency || 3,
        countryRegion: profile?.diet_preferences?.country_region || "international",
        fitnessGoal: profile?.fitness_goals?.[0] || "general-fitness",
        calorieTarget: calculateCalorieTarget(profile)
      };
      
      console.log("🥗 Generating meal plan with preferences:", JSON.stringify(preferences));
      
      // Use the reliable meal plan generator
      const generatedMealPlan = await reliableMealPlanGenerator.generateMealPlan(preferences) as unknown as MealPlan;
      console.log("Plan received with", generatedMealPlan.weeklyPlan.length, "days");
      
      // Make sure all 7 days are present
      const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
      const existingDays = new Set(generatedMealPlan.weeklyPlan.map(day => day.day));
      
      // Add any missing days to ensure we have all 7
      for (const day of daysOfWeek) {
        if (!existingDays.has(day)) {
          console.log("Adding missing day:", day);
          // Clone the first day and change its name to the missing day
          const templateDay = JSON.parse(JSON.stringify(generatedMealPlan.weeklyPlan[0]));
          templateDay.day = day;
          generatedMealPlan.weeklyPlan.push(templateDay);
        }
      }
      
      // Sort days in correct order
      generatedMealPlan.weeklyPlan.sort((a, b) => {
        return daysOfWeek.indexOf(a.day) - daysOfWeek.indexOf(b.day);
      });
      
      console.log("✅ Meal plan generation successful with", generatedMealPlan.weeklyPlan.length, "days");
      setMealPlan(generatedMealPlan);
      setGenerationTime(Date.now() - startTime);
    } catch (error) {
      console.error("❌ Error generating meal plan:", error);
      setError("Failed to generate meal plan: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setLoading(false);
    }
  };

  // Render a single meal card
  const renderMealCard = (meal: Meal) => {
    return (
      <Card key={meal.meal} style={styles.mealCard}>
        <Card.Content>
          <Title style={styles.mealTitle}>{meal.meal}</Title>
          <Paragraph style={styles.mealTime}>{meal.time}</Paragraph>
          <Divider style={styles.divider} />
          <Title style={styles.recipeName}>{meal.recipe.name}</Title>
          
          <Text style={styles.sectionTitle}>Ingredients:</Text>
          {meal.recipe.ingredients.map((ingredient, index) => (
            <Text key={index} style={styles.ingredientText}>• {ingredient}</Text>
          ))}
          
          <Text style={styles.sectionTitle}>Instructions:</Text>
          {meal.recipe.instructions.map((instruction, index) => (
            <Text key={index} style={styles.instructionText}>{index + 1}. {instruction}</Text>
          ))}
          
          <Text style={styles.sectionTitle}>Nutrition:</Text>
          <View style={styles.nutritionRow}>
            <View style={styles.nutritionItem}>
              <Text style={styles.nutritionValue}>{meal.recipe.nutrition.calories}</Text>
              <Text style={styles.nutritionLabel}>calories</Text>
            </View>
            <View style={styles.nutritionItem}>
              <Text style={styles.nutritionValue}>{meal.recipe.nutrition.protein}g</Text>
              <Text style={styles.nutritionLabel}>protein</Text>
            </View>
            <View style={styles.nutritionItem}>
              <Text style={styles.nutritionValue}>{meal.recipe.nutrition.carbs}g</Text>
              <Text style={styles.nutritionLabel}>carbs</Text>
            </View>
            <View style={styles.nutritionItem}>
              <Text style={styles.nutritionValue}>{meal.recipe.nutrition.fats}g</Text>
              <Text style={styles.nutritionLabel}>fats</Text>
            </View>
          </View>
        </Card.Content>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <StyledText variant="headingLarge" style={styles.title}>
          Meal Plan Generator Test
        </StyledText>
      </View>
      
      <View style={styles.contentContainer}>
        <View style={styles.topSection}>
          <Card style={styles.infoCard}>
            <Card.Content>
              <StyledText variant="bodyMedium">
                This screen tests the new PydanticMealPlanGenerator with multi-tier generation approach.
              </StyledText>
            </Card.Content>
          </Card>
          
          <Button 
            mode="contained" 
            onPress={generateMealPlan}
            loading={loading}
            style={styles.generateButton}
            disabled={loading}
          >
            {loading ? "Generating..." : "Generate Meal Plan"}
          </Button>
          
          {generationTime !== null && (
            <Text style={styles.timeText}>
              Generation completed in {(generationTime / 1000).toFixed(2)} seconds
            </Text>
          )}
        </View>
        
        {error && (
          <Card style={styles.errorCard}>
            <Card.Content>
              <StyledText variant="bodyMedium" style={styles.errorText}>
                {error}
              </StyledText>
            </Card.Content>
          </Card>
        )}
        
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary.main} />
            <StyledText variant="bodyMedium" style={styles.loadingText}>
              Generating meal plan...
            </StyledText>
          </View>
        )}
        
        {mealPlan && !loading && (
          <View style={styles.resultContainer}>
            {/* Top days row - compact layout to show all days */}
            <View style={styles.weekdayContainer}>
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((abbr, idx) => {
                const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
                const dayName = dayNames[idx];
                const isSelected = selectedDay === dayName;
                return (
                  <TouchableOpacity 
                    key={abbr} 
                    style={[styles.weekdayButton, isSelected && styles.selectedWeekdayButton]}
                    onPress={() => setSelectedDay(dayName)}
                  >
                    <Text style={[styles.weekdayText, isSelected && styles.selectedWeekdayText]}>
                      {abbr}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            
            {/* The original day selector (hidden but keep for compatibility) */}
            <View style={[styles.daySelector, { display: 'none' }]}>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={true}
                contentContainerStyle={styles.daySelectorContent}
              >
                {mealPlan.weeklyPlan.map((day) => (
                  <TouchableOpacity
                    key={day.day}
                    style={[
                      styles.dayButton,
                      selectedDay === day.day && styles.selectedDayButton
                    ]}
                    onPress={() => setSelectedDay(day.day)}
                  >
                    <Text 
                      style={[
                        styles.dayButtonText,
                        selectedDay === day.day && styles.selectedDayButtonText
                      ]}
                    >
                      {day.day}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            
            {/* Selected day display */}
            <View style={styles.selectedDayDisplay}>
              <Text style={styles.selectedDayText}>{selectedDay}</Text>
            </View>
            
            <View style={styles.dailyNutrition}>
              <StyledText variant="bodyMedium" style={styles.dailyNutritionTitle}>
                Daily Nutrition
              </StyledText>
              
              {mealPlan.weeklyPlan
                .filter((day) => day.day === selectedDay)
                .map((day) => (
                  <View key={day.day} style={styles.nutritionRow}>
                    <View style={styles.nutritionItem}>
                      <Text style={styles.nutritionValue}>{day.dailyNutrition.calories}</Text>
                      <Text style={styles.nutritionLabel}>calories</Text>
                    </View>
                    <View style={styles.nutritionItem}>
                      <Text style={styles.nutritionValue}>{day.dailyNutrition.protein}g</Text>
                      <Text style={styles.nutritionLabel}>protein</Text>
                    </View>
                    <View style={styles.nutritionItem}>
                      <Text style={styles.nutritionValue}>{day.dailyNutrition.carbs}g</Text>
                      <Text style={styles.nutritionLabel}>carbs</Text>
                    </View>
                    <View style={styles.nutritionItem}>
                      <Text style={styles.nutritionValue}>{day.dailyNutrition.fats}g</Text>
                      <Text style={styles.nutritionLabel}>fats</Text>
                    </View>
                  </View>
                ))}
            </View>
            
            <ScrollView 
              style={styles.mealsContainer}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={true}
            >
              {mealPlan.weeklyPlan
                .filter((day) => day.day === selectedDay)
                .map((day) => (
                  <View key={day.day}>
                    {day.meals.map((meal) => renderMealCard(meal))}
                  </View>
                ))}
                
              <Card style={styles.shoppingListCard}>
                <Card.Content>
                  <Title style={styles.shoppingListTitle}>Shopping List</Title>
                  <Text style={styles.shoppingListCategory}>Protein:</Text>
                  <Text style={styles.shoppingListItems}>
                    {mealPlan.shoppingList.protein.join(', ')}
                  </Text>
                  
                  <Text style={styles.shoppingListCategory}>Produce:</Text>
                  <Text style={styles.shoppingListItems}>
                    {mealPlan.shoppingList.produce.join(', ')}
                  </Text>
                  
                  <Text style={styles.shoppingListCategory}>Grains:</Text>
                  <Text style={styles.shoppingListItems}>
                    {mealPlan.shoppingList.grains.join(', ')}
                  </Text>
                  
                  <Text style={styles.shoppingListCategory}>Dairy:</Text>
                  <Text style={styles.shoppingListItems}>
                    {mealPlan.shoppingList.dairy.join(', ')}
                  </Text>
                  
                  <Text style={styles.shoppingListCategory}>Other:</Text>
                  <Text style={styles.shoppingListItems}>
                    {mealPlan.shoppingList.other.join(', ')}
                  </Text>
                </Card.Content>
              </Card>
              
              {/* Extra padding at bottom to ensure visibility of all content */}
              <View style={styles.bottomPadding} />
            </ScrollView>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    paddingTop: spacing.lg,
  },
  title: {
    marginLeft: spacing.md,
    color: colors.text.primary,
  },
  contentContainer: {
    flex: 1,
    padding: spacing.md,
  },
  topSection: {
    marginBottom: spacing.md,
  },
  resultContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  infoCard: {
    marginBottom: spacing.md,
    ...shadows.medium,
    backgroundColor: colors.surface.main,
  },
  generateButton: {
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary.main,
  },
  timeText: {
    textAlign: 'center',
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  errorCard: {
    marginBottom: spacing.md,
    backgroundColor: colors.feedback.error,
    ...shadows.medium,
  },
  errorText: {
    color: colors.text.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.text.secondary,
  },
  daySelector: {
    marginBottom: spacing.md,
    backgroundColor: colors.surface.main,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    ...shadows.small,
  },
  daySelectHint: {
    color: colors.text.secondary,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  daySelectorContent: {
    paddingRight: spacing.md,
    paddingVertical: spacing.xs,
    paddingBottom: spacing.sm,
  },
  dayButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surface.dark,
    ...shadows.small,
    minWidth: 90,  // Ensure buttons have consistent width
  },
  selectedDayButton: {
    backgroundColor: colors.primary.main,
  },
  dayButtonText: {
    color: colors.text.primary,
    fontWeight: '500',
  },
  selectedDayButtonText: {
    color: colors.text.primary,
    fontWeight: 'bold',
  },
  dailyNutrition: {
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface.dark,
    borderRadius: borderRadius.md,
    ...shadows.medium,
  },
  dailyNutritionTitle: {
    marginBottom: spacing.sm,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  nutritionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  nutritionItem: {
    alignItems: 'center',
  },
  nutritionValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  nutritionLabel: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  mealsContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120, // Extra padding at the bottom for better scrolling
  },
  mealCard: {
    marginBottom: spacing.md,
    ...shadows.medium,
    backgroundColor: colors.surface.dark,
  },
  mealTitle: {
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  mealTime: {
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  divider: {
    marginVertical: spacing.sm,
    backgroundColor: colors.border.medium,
  },
  recipeName: {
    fontSize: 18,
    marginBottom: spacing.sm,
    color: colors.primary.light,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    color: colors.text.primary,
  },
  ingredientText: {
    color: colors.text.primary,
    marginLeft: spacing.sm,
    marginBottom: spacing.xs,
  },
  instructionText: {
    color: colors.text.primary,
    marginLeft: spacing.sm,
    marginBottom: spacing.sm,
    lineHeight: 20,
  },
  shoppingListCard: {
    marginBottom: spacing.md,
    ...shadows.medium,
    backgroundColor: colors.surface.dark,
  },
  shoppingListTitle: {
    marginBottom: spacing.md,
    color: colors.primary.light,
    fontWeight: 'bold',
  },
  shoppingListCategory: {
    fontWeight: 'bold',
    marginTop: spacing.sm,
    color: colors.text.primary,
  },
  shoppingListItems: {
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  bottomPadding: {
    height: 100, // Extra padding at the bottom
  },
  weekdayContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surface.main,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
    ...shadows.small,
  },
  weekdayButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    minWidth: 40,
    alignItems: 'center',
  },
  selectedWeekdayButton: {
    backgroundColor: colors.primary.main,
  },
  weekdayText: {
    color: colors.text.primary,
    fontWeight: '500',
    fontSize: 14,
  },
  selectedWeekdayText: {
    color: colors.text.primary,
    fontWeight: 'bold',
  },
  selectedDayDisplay: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  selectedDayText: {
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: 'bold',
  },
}); 