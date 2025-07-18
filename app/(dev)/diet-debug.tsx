import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput } from 'react-native';
import { Stack } from 'expo-router';
import { Button, Switch, Card, Paragraph } from 'react-native-paper';
import gemini from '../../lib/gemini';
import { UserFitnessPreferences } from '../../services/ai/workoutGenerator';
import { UserDietPreferences } from '../../services/ai/mealPlanGenerator';
import { parseJsonFromLLM } from '../../services/ai/jsonUtils';

// Simple debug tool for comparing workout and meal plan generation
export default function DietDebug() {
  const [workoutResult, setWorkoutResult] = useState<any>(null);
  const [mealPlanResult, setMealPlanResult] = useState<any>(null);
  const [loading, setLoading] = useState({ workout: false, mealPlan: false });
  const [customPrompt, setCustomPrompt] = useState('');
  const [showCustomPrompt, setShowCustomPrompt] = useState(false);
  const [rawResponse, setRawResponse] = useState('');
  
  // Test workout generation (which works reliably)
  const testWorkoutGeneration = async () => {
    setLoading(prev => ({ ...prev, workout: true }));
    try {
      const workoutPreferences: UserFitnessPreferences = {
        fitnessLevel: "intermediate",
        workoutLocation: "home",
        availableEquipment: ["dumbbells", "resistance bands"],
        exerciseFrequency: 3,
        timePerSession: 30,
        focusAreas: ["upper body", "core"]
      };
      
      console.log("Testing workout generation...");
      const result = await gemini.generatePlanWithPrimaryPrompt(workoutPreferences);
      console.log("Workout generation successful", result);
      setWorkoutResult(result);
    } catch (error) {
      console.error("Workout generation failed:", error);
    } finally {
      setLoading(prev => ({ ...prev, workout: false }));
    }
  };
  
  // Use the new direct workout-style approach that's proven reliable
  const testDirectWorkoutStyleMealPlan = async () => {
    setLoading(prev => ({ ...prev, mealPlan: true }));
    setRawResponse('');
    try {
      const dietPreferences: UserDietPreferences = {
        dietType: "vegetarian",
        dietPlanPreference: "balanced",
        allergies: [],
        mealFrequency: 3,
        countryRegion: "india",
        fitnessGoal: "maintenance",
        calorieTarget: 2198
      };
      
      console.log("Testing direct workout-style meal plan generation...");
      
      // Create the workout-style prompt directly - same as in lib/gemini.ts
      const prompt = createWorkoutStylePrompt(dietPreferences);
      console.log("Using prompt:", prompt.substring(0, 200) + "...");
      
      // Get raw response directly from the model
      const model = gemini;
      const result = await model.generateContent(prompt);
      
      // Extract text based on response type
      let text = '';
      if (typeof result === 'string') {
        text = result;
      } else if (result && (result as any).response && typeof (result as any).response.text === 'function') {
        // For newer Gemini SDK
        text = (result as any).response.text();
      } else if (result && typeof (result as any).text === 'function') {
        // For older Gemini SDK
        text = (result as any).text();
      } else {
        console.log("Unknown response format:", result);
        text = JSON.stringify(result);
      }
      
      // Save raw response for debugging
      setRawResponse(text);
      console.log("Raw response:", text.substring(0, 200) + "...");
      
      // Parse the response to JSON
      const plan = parseJsonFromLLM(text);
      console.log("Parsed meal plan:", plan);
      
      // Update state with the result
      setMealPlanResult(plan);
    } catch (error) {
      console.error("Direct workout-style meal plan generation failed:", error);
    } finally {
      setLoading(prev => ({ ...prev, mealPlan: false }));
    }
  };
  
  // Test meal plan generation with the main function (which has issues)
  const testFullMealPlanChain = async () => {
    setLoading(prev => ({ ...prev, mealPlan: true }));
    try {
      const dietPreferences: UserDietPreferences = {
        dietType: "vegetarian",
        dietPlanPreference: "balanced",
        allergies: [],
        mealFrequency: 3,
        countryRegion: "india",
        fitnessGoal: "maintenance",
        calorieTarget: 2198
      };
      
      console.log("Testing full meal plan generation chain...");
      const result = await gemini.generateMealPlan(dietPreferences);
      console.log("Full meal plan chain successful", result);
      setMealPlanResult(result);
    } catch (error) {
      console.error("Full meal plan chain failed:", error);
    } finally {
      setLoading(prev => ({ ...prev, mealPlan: false }));
    }
  };
  
  // Helper function to create a workout-style prompt
  const createWorkoutStylePrompt = (preferences: UserDietPreferences): string => {
    // Extract preferences with proper fallbacks
    const dietType = preferences.dietType || 'balanced';
    const allergies = preferences.allergies || [];
    const mealFrequency = preferences.mealFrequency || 3;
    const calorieTarget = preferences.calorieTarget || 2000;
    const countryRegion = preferences.countryRegion || 'international';
    const restrictions = preferences.restrictions || [];
    const excludedFoods = preferences.excludedFoods || [];
    
    // Create a prompt with improved pattern that ensures real content
    return `Create a personalized 7-day meal plan for a ${dietType} diet.
    User wants ${mealFrequency} meals per day with a total of ${calorieTarget} calories.
    Their preferred cuisine is ${countryRegion}.
    ${allergies.length > 0 ? `Avoid these allergens: ${allergies.join(', ')}.` : ''}
    ${restrictions?.length > 0 ? `Follow these dietary restrictions: ${restrictions.join(', ')}.` : ''}
    ${excludedFoods?.length > 0 ? `Exclude these foods: ${excludedFoods.join(', ')}.` : ''}
    
    IMPORTANT: You MUST provide REAL, AUTHENTIC ${countryRegion.toUpperCase()} RECIPES with SPECIFIC recipe names and ingredients. DO NOT use placeholders or generic recipe names.
    
    Return the meal plan in this exact JSON format:
  
    {
      "weeklyPlan": [
        {
          "day": "Monday",
          "meals": [
            {
              "meal": "Breakfast",
              "time": "8:00 AM",
              "recipe": {
                "name": "SPECIFIC AUTHENTIC RECIPE NAME",
                "ingredients": ["REAL INGREDIENT 1", "REAL INGREDIENT 2"],
                "instructions": ["SPECIFIC STEP 1", "SPECIFIC STEP 2"],
                "nutrition": {"calories": 300, "protein": 20, "carbs": 30, "fats": 10}
              }
            }
          ],
          "dailyNutrition": {"calories": 2000, "protein": 100, "carbs": 250, "fats": 70}
        }
      ],
      "shoppingList": {
        "protein": ["REAL PROTEIN ITEM 1", "REAL PROTEIN ITEM 2"],
        "produce": ["REAL PRODUCE ITEM 1", "REAL PRODUCE ITEM 2"],
        "grains": ["REAL GRAIN ITEM 1", "REAL GRAIN ITEM 2"],
        "dairy": ["REAL DAIRY ITEM 1", "REAL DAIRY ITEM 2"],
        "other": ["REAL OTHER ITEM 1", "REAL OTHER ITEM 2"]
      }
    }
  
    CRITICAL GUIDELINES:
    1. Include EXACTLY 7 days (Monday-Sunday)
    2. Each day must have EXACTLY ${mealFrequency} meals
    3. Daily calories should total approximately ${calorieTarget}
    4. Return ONLY the JSON object, no explanations or other text
    5. All recipe names MUST be specific, authentic dishes from ${countryRegion} cuisine (e.g., "Palak Paneer" not "Spinach Curry")
    6. All ingredients MUST be specific, real ingredients (e.g., "2 tbsp ghee" not "cooking fat")
    7. All instructions MUST be specific, detailed steps
    8. DO NOT use placeholder text like "Recipe Name", "Ingredient 1", or "Step 1"
    9. DO NOT use generic names like "Healthy Breakfast" or "Nutritious Lunch"
    10. Give FULL, DETAILED recipes with SPECIFIC instructions and ingredients`;
  };
  
  // Test using a custom prompt
  const testCustomPrompt = async () => {
    if (!customPrompt) {
      alert("Please enter a custom prompt first");
      return;
    }
    
    setLoading(prev => ({ ...prev, mealPlan: true }));
    setRawResponse('');
    try {
      console.log("Testing custom prompt:", customPrompt);
      
      // Use direct gemini.generateContent for the custom prompt
      const result = await gemini.generateContent(customPrompt);
      
      // Extract text based on response type
      let text = '';
      if (typeof result === 'string') {
        text = result;
      } else if (result && (result as any).response && typeof (result as any).response.text === 'function') {
        // For newer Gemini SDK
        text = (result as any).response.text();
      } else if (result && typeof (result as any).text === 'function') {
        // For older Gemini SDK
        text = (result as any).text();
      } else {
        console.log("Unknown response format:", result);
        text = JSON.stringify(result);
      }
      
      // Save raw response for debugging
      setRawResponse(text);
      console.log("Raw response from custom prompt:", text);
      
      // Try to parse as JSON
      try {
        const parsedResult = parseJsonFromLLM(text);
        console.log("Parsed result:", parsedResult);
        setMealPlanResult(parsedResult);
      } catch (parseError) {
        console.error("Failed to parse response as JSON:", parseError);
        alert("Failed to parse response as JSON. See console for raw output.");
      }
    } catch (error) {
      console.error("Custom prompt test failed:", error);
    } finally {
      setLoading(prev => ({ ...prev, mealPlan: false }));
    }
  };
  
  return (
    <ScrollView style={styles.container}>
      <Stack.Screen options={{ title: 'Diet Plan Debug' }} />
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Test Options</Text>
        
        <Button 
          mode="contained" 
          onPress={testDirectWorkoutStyleMealPlan}
          loading={loading.mealPlan}
          style={[styles.button, styles.primaryButton]}
        >
          Test Direct Workout-Style Approach
        </Button>
        
        <Button 
          mode="contained-tonal" 
          onPress={testFullMealPlanChain}
          loading={loading.mealPlan}
          style={styles.button}
        >
          Test Full Generation Chain
        </Button>
        
        <Button 
          mode="outlined" 
          onPress={testWorkoutGeneration}
          loading={loading.workout}
          style={styles.button}
        >
          Test Workout Generation
        </Button>
        
        <View style={styles.customPromptToggle}>
          <Text>Use Custom Prompt</Text>
          <Switch 
            value={showCustomPrompt} 
            onValueChange={setShowCustomPrompt} 
          />
        </View>
        
        {showCustomPrompt && (
          <View style={styles.customPromptContainer}>
            <TextInput
              style={styles.customPromptInput}
              multiline
              numberOfLines={6}
              placeholder="Enter custom prompt here..."
              value={customPrompt}
              onChangeText={setCustomPrompt}
            />
            
            <Button 
              mode="contained-tonal" 
              onPress={testCustomPrompt}
              loading={loading.mealPlan}
              style={styles.button}
            >
              Test Custom Prompt
            </Button>
          </View>
        )}
      </View>
      
      {mealPlanResult && (
        <View style={styles.resultSection}>
          <Text style={styles.sectionTitle}>Meal Plan Result</Text>
          
          <Card style={styles.resultCard}>
            <Card.Content>
              <Text style={styles.resultSummary}>
                Format: {mealPlanResult.weeklyPlan ? "Weekly Plan" : 
                         mealPlanResult.days ? "Days Array" : 
                         mealPlanResult.day ? "Single Day" : "Unknown"}
              </Text>
              <Text style={styles.resultSummary}>
                Days: {mealPlanResult.weeklyPlan?.length || 
                      mealPlanResult.days?.length || 
                      (mealPlanResult.day ? 1 : 0)}
              </Text>
              <Text style={styles.resultSummary}>
                Meals per day: {mealPlanResult.weeklyPlan?.[0]?.meals?.length || 
                               mealPlanResult.days?.[0]?.meals?.length || 
                               mealPlanResult.meals?.length || 0}
              </Text>
              <Text style={styles.resultSummary}>
                First recipe: {mealPlanResult.weeklyPlan?.[0]?.meals?.[0]?.recipe?.name || 
                              mealPlanResult.days?.[0]?.meals?.[0]?.recipe?.name || 
                              mealPlanResult.meals?.[0]?.recipe?.name || "None"}
              </Text>
            </Card.Content>
          </Card>
          
          {rawResponse && (
            <Card style={[styles.resultCard, styles.rawResponseCard]}>
              <Card.Content>
                <Text style={styles.resultTitle}>Raw Response (First 500 chars)</Text>
                <Text style={styles.rawResponseText}>
                  {rawResponse.substring(0, 500) + (rawResponse.length > 500 ? '...' : '')}
                </Text>
              </Card.Content>
            </Card>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  section: {
    marginBottom: 24,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  resultSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  button: {
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: '#4CAF50',
  },
  customPromptToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 12,
  },
  customPromptContainer: {
    marginTop: 12,
  },
  customPromptInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    padding: 8,
    height: 120,
    marginBottom: 12,
    textAlignVertical: 'top',
    backgroundColor: '#fff',
  },
  resultCard: {
    marginBottom: 12,
    elevation: 2,
  },
  rawResponseCard: {
    backgroundColor: '#f8f9fa',
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  resultSummary: {
    fontSize: 14,
    marginBottom: 4,
  },
  rawResponseText: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
  divider: {
    height: 1,
    backgroundColor: '#ddd',
    marginVertical: 16,
  },
}); 