/**
 * Modern Structured Output Generator for FitAI
 * 
 * This replaces ALL JSON parsing with Google's native structured output
 * Uses COMPLETE onboarding data for personalized generation
 */

import { GoogleGenerativeAI, GenerativeModel, SchemaType } from "@google/generative-ai";
import { GEMINI_API_KEY } from "../../constants/api";
import { 
  GoogleWorkoutPlanSchema, 
  GoogleMealPlanSchema,
  WorkoutPlan, 
  WeeklyMealPlan,
  WorkoutPlanSchema,
  WeeklyMealPlanSchema 
} from "./schemas/comprehensive-schemas";

// Complete user profile interface using ALL onboarding data
export interface CompleteUserProfile {
  // Basic Demographics (from user-details.tsx)
  full_name: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  height_cm: number;
  weight_kg: number;
  target_weight_kg: number;
  activity_level: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active';
  weight_goal: string;
  
  // Diet Preferences (from diet-preferences.tsx)
  diet_preferences: {
    diet_type: 'vegetarian' | 'vegan' | 'non-vegetarian' | 'pescatarian' | 'flexitarian';
    dietary_restrictions?: string[];
    allergies: string[];
    meal_frequency: number;
    meal_times?: Array<{ name: string, time: string }>;
    country_region?: string;
    excluded_foods?: string[];
    favorite_foods?: string[];
  };
  
  // Body Analysis (from body-analysis.tsx)
  body_analysis?: {
    weight_kg: number;
    body_type: string;
    analysis_text: string;
    recommended_focus_areas: string[];
  };
  
  // Workout Preferences (from workout-preferences.tsx)
  workout_preferences: {
    fitness_level: 'beginner' | 'intermediate' | 'advanced';
    workout_location: 'home' | 'gym' | 'outdoors' | 'anywhere';
    workout_duration: number;
    focus_areas: string[];
    equipment: string[];
    preferred_days: string[];
    exercises_to_avoid?: string[];
    days_per_week: number;
  };
  
  // Additional computed fields
  country_region?: string;
  fitness_level?: string;
  workout_days_per_week?: number;
  workout_duration_minutes?: number;
  fitness_goals?: string[];
}

export class ModernStructuredGenerator {
  private model: GenerativeModel;
  
  constructor() {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    
    // Use stable model optimized for structured output
    this.model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash", // Stable model
      generationConfig: {
        temperature: 0.3, // Lower for consistent structured output
        topK: 40,
        topP: 0.8,
        maxOutputTokens: 8192, // Large enough for comprehensive plans
      }
    });
  }

  /**
   * Generate comprehensive workout plan using ALL onboarding data
   * NO JSON PARSING - Direct structured output!
   */
  async generateWorkoutPlan(userProfile: CompleteUserProfile): Promise<WorkoutPlan> {
    console.log("🏋️ [MODERN] Starting structured workout generation for:", userProfile.full_name);
    
    const prompt = this.buildComprehensiveWorkoutPrompt(userProfile);
    
    try {
      const startTime = Date.now();
      
      // 🔥 STRUCTURED OUTPUT - NO PARSING NEEDED!
      const response = await this.model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: GoogleWorkoutPlanSchema
        }
      });

      const duration = Date.now() - startTime;
      const rawResponse = response.response.text();
      const workoutPlan = JSON.parse(rawResponse);
      
      console.log(`✅ [MODERN] Structured workout plan generated in ${duration}ms`);
      console.log(`📊 [MODERN] Plan: ${workoutPlan.planName} (${workoutPlan.weeklySchedule.length} days)`);

      // Validate with Zod for extra safety
      const validatedPlan = WorkoutPlanSchema.parse(workoutPlan);
      
      return validatedPlan;
      
    } catch (error: any) {
      console.error("❌ [MODERN] Structured workout generation failed:", error);
      throw new Error(`Modern workout generation failed: ${error.message}`);
    }
  }

  /**
   * Generate comprehensive meal plan using ALL onboarding data
   * NO JSON PARSING - Direct structured output!
   */
  async generateMealPlan(userProfile: CompleteUserProfile): Promise<WeeklyMealPlan> {
    console.log("🍽️ [MODERN] Starting structured meal plan generation for:", userProfile.full_name);
    
    const prompt = this.buildComprehensiveMealPrompt(userProfile);
    
    try {
      const startTime = Date.now();
      
      // 🔥 STRUCTURED OUTPUT - NO PARSING NEEDED!
      const response = await this.model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: GoogleMealPlanSchema
        }
      });

      const duration = Date.now() - startTime;
      const rawResponse = response.response.text();
      const mealPlan = JSON.parse(rawResponse);
      
      console.log(`✅ [MODERN] Structured meal plan generated in ${duration}ms`);
      console.log(`📊 [MODERN] Plan: ${mealPlan.planName} (${mealPlan.dietType})`);

      // Validate with Zod for extra safety
      const validatedPlan = WeeklyMealPlanSchema.parse(mealPlan);
      
      return validatedPlan;
      
    } catch (error: any) {
      console.error("❌ [MODERN] Structured meal generation failed:", error);
      throw new Error(`Modern meal generation failed: ${error.message}`);
    }
  }

  /**
   * Build comprehensive workout prompt using ALL onboarding data
   */
  private buildComprehensiveWorkoutPrompt(user: CompleteUserProfile): string {
    const weightGoal = user.target_weight_kg > user.weight_kg ? "weight gain" : "weight loss";
    const weightDifference = Math.abs(user.target_weight_kg - user.weight_kg);
    
    return `Create a personalized workout plan for ${user.full_name} using their complete onboarding profile:

PERSONAL DETAILS:
- Name: ${user.full_name}
- Age: ${user.age}, Gender: ${user.gender}
- Height: ${user.height_cm}cm, Current Weight: ${user.weight_kg}kg
- Target Weight: ${user.target_weight_kg}kg (${weightGoal}: ${weightDifference}kg)
- Activity Level: ${user.activity_level}

FITNESS PROFILE:
- Fitness Level: ${user.workout_preferences.fitness_level}
- Workout Location: ${user.workout_preferences.workout_location}
- Frequency: ${user.workout_preferences.days_per_week} days per week
- Duration: ${user.workout_preferences.workout_duration} minutes per session
- Focus Areas: ${user.workout_preferences.focus_areas.join(', ')}
- Available Equipment: ${user.workout_preferences.equipment.join(', ')}
- Preferred Days: ${user.workout_preferences.preferred_days.join(', ')}
${user.workout_preferences.exercises_to_avoid ? `- Exercises to Avoid: ${user.workout_preferences.exercises_to_avoid.join(', ')}` : ''}

BODY ANALYSIS:
${user.body_analysis ? `- Body Type: ${user.body_analysis.body_type}
- Analysis: ${user.body_analysis.analysis_text}
- Recommended Focus: ${user.body_analysis.recommended_focus_areas.join(', ')}` : '- No body analysis available'}

GOALS & PREFERENCES:
- Primary Goal: ${user.weight_goal}
- Fitness Goals: ${user.fitness_goals?.join(', ') || user.workout_preferences.focus_areas.join(', ')}
- Country/Region: ${user.country_region || user.diet_preferences.country_region || 'Not specified'}

REQUIREMENTS:
1. Create a ${user.workout_preferences.days_per_week}-day weekly workout plan
2. Each workout should be exactly ${user.workout_preferences.workout_duration} minutes
3. Use ONLY equipment from: ${user.workout_preferences.equipment.join(', ')}
4. Focus on: ${user.workout_preferences.focus_areas.join(' and ')}
5. Appropriate for ${user.workout_preferences.fitness_level} fitness level
6. Support ${weightGoal} goal (${weightDifference}kg change needed)
7. Consider ${user.gender} and age ${user.age} specific needs
8. Include proper warm-up and cool-down for each session
9. Provide 4-week progression plan
10. Include safety notes and nutrition tips

Make this plan highly personalized and specific to ${user.full_name}'s profile and goals.`;
  }

  /**
   * Build comprehensive meal plan prompt using ALL onboarding data
   */
  private buildComprehensiveMealPrompt(user: CompleteUserProfile): string {
    const weightGoal = user.target_weight_kg > user.weight_kg ? "weight gain" : "weight loss";
    const weightDifference = Math.abs(user.target_weight_kg - user.weight_kg);
    const calorieAdjustment = user.target_weight_kg > user.weight_kg ? "surplus" : "deficit";
    
    // Calculate estimated calorie needs
    const estimatedCalories = this.estimateCalorieNeeds(user);
    
    return `Create a personalized 7-day meal plan for ${user.full_name} using their complete onboarding profile:

PERSONAL DETAILS:
- Name: ${user.full_name}
- Age: ${user.age}, Gender: ${user.gender}
- Height: ${user.height_cm}cm, Current Weight: ${user.weight_kg}kg
- Target Weight: ${user.target_weight_kg}kg (${weightGoal}: ${weightDifference}kg)
- Activity Level: ${user.activity_level}

DIETARY PROFILE:
- Diet Type: ${user.diet_preferences.diet_type}
- Meal Frequency: ${user.diet_preferences.meal_frequency} meals per day
- Country/Region: ${user.diet_preferences.country_region || user.country_region || 'Not specified'}
- Allergies: ${user.diet_preferences.allergies.length > 0 ? user.diet_preferences.allergies.join(', ') : 'None'}
- Dietary Restrictions: ${user.diet_preferences.dietary_restrictions?.join(', ') || 'None'}
- Excluded Foods: ${user.diet_preferences.excluded_foods?.join(', ') || 'None'}
- Favorite Foods: ${user.diet_preferences.favorite_foods?.join(', ') || 'Not specified'}

MEAL TIMING:
${user.diet_preferences.meal_times ? 
  user.diet_preferences.meal_times.map(mt => `- ${mt.name}: ${mt.time}`).join('\n') : 
  '- Standard meal times (breakfast, lunch, dinner)'}

FITNESS INTEGRATION:
- Fitness Level: ${user.workout_preferences.fitness_level}
- Workout Days: ${user.workout_preferences.days_per_week} per week
- Workout Duration: ${user.workout_preferences.workout_duration} minutes
- Focus Areas: ${user.workout_preferences.focus_areas.join(', ')}

NUTRITIONAL TARGETS:
- Primary Goal: ${user.weight_goal} (${calorieAdjustment})
- Estimated Daily Calories: ${estimatedCalories}
- Support for: ${user.workout_preferences.focus_areas.join(' and ')}

REQUIREMENTS:
1. Create exactly 7 days of meal plans (Monday to Sunday)
2. Each day must include ${user.diet_preferences.meal_frequency} meals
3. All meals must be ${user.diet_preferences.diet_type}
4. Strictly avoid: ${user.diet_preferences.allergies.join(', ') || 'no restrictions'}
5. Exclude: ${user.diet_preferences.excluded_foods?.join(', ') || 'no exclusions'}
6. Focus on ${user.diet_preferences.country_region || 'international'} cuisine
7. Target approximately ${estimatedCalories} calories per day for ${weightGoal}
8. Support ${user.workout_preferences.focus_areas.join(' and ')} fitness goals
9. Include detailed nutrition information for each meal
10. Provide complete ingredient lists and cooking instructions
11. Generate comprehensive shopping list for the week
12. Include meal prep tips and nutrition advice
13. Consider ${user.gender} and age ${user.age} nutritional needs

Make this meal plan highly personalized and specific to ${user.full_name}'s dietary preferences and fitness goals.`;
  }

  /**
   * Estimate calorie needs based on user profile
   */
  private estimateCalorieNeeds(user: CompleteUserProfile): number {
    // Basic BMR calculation (Mifflin-St Jeor Equation)
    let bmr: number;
    
    if (user.gender === 'male') {
      bmr = 10 * user.weight_kg + 6.25 * user.height_cm - 5 * user.age + 5;
    } else {
      bmr = 10 * user.weight_kg + 6.25 * user.height_cm - 5 * user.age - 161;
    }
    
    // Activity multiplier
    const activityMultipliers = {
      'sedentary': 1.2,
      'lightly_active': 1.375,
      'moderately_active': 1.55,
      'very_active': 1.725
    };
    
    const tdee = bmr * activityMultipliers[user.activity_level];
    
    // Adjust for weight goal
    if (user.target_weight_kg < user.weight_kg) {
      return Math.round(tdee - 500); // Deficit for weight loss
    } else if (user.target_weight_kg > user.weight_kg) {
      return Math.round(tdee + 300); // Surplus for weight gain
    } else {
      return Math.round(tdee); // Maintenance
    }
  }
}
