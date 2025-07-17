/**
 * Modern Workout Generator using Google's Native Structured Output
 * 
 * This replaces the old JSON parsing approach with Google's guaranteed structured responses
 * NO MORE parseJsonFromLLM() or complex JSON repair utilities!
 */

import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { GEMINI_API_KEY } from "../../../constants/api";
import { GoogleWorkoutPlanSchema, WorkoutPlan, WorkoutPlanSchema } from "../schemas/workout-schemas";
import { TestUserProfile } from "../test-data/sample-onboarding-data";

export class ModernWorkoutGenerator {
  private model: GenerativeModel;
  
  constructor() {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    
    // Use stable model with structured output configuration
    this.model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash", // Stable model, not experimental
      generationConfig: {
        temperature: 0.3, // Lower temperature for more consistent structured output
        topK: 40,
        topP: 0.8,
        maxOutputTokens: 4096,
      }
    });
  }

  /**
   * Generate workout plan using modern structured output
   * NO JSON PARSING REQUIRED - Direct structured response!
   */
  async generateWorkoutPlan(userProfile: TestUserProfile): Promise<WorkoutPlan> {
    console.log("🚀 [MODERN] Starting structured workout generation for:", userProfile.name);
    
    const prompt = this.buildPersonalizedPrompt(userProfile);
    
    try {
      // 🎯 MODERN APPROACH: Native structured output
      const response = await this.model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json", // 🔥 This ensures JSON output
          responseSchema: GoogleWorkoutPlanSchema // 🔥 This constrains the structure
        }
      });

      // ✅ GUARANTEED VALID JSON - No parsing utilities needed!
      const rawResponse = response.response.text();
      const workoutPlan = JSON.parse(rawResponse);
      
      console.log("✅ [MODERN] Structured output received successfully!");
      console.log("📊 [MODERN] Plan overview:", {
        name: workoutPlan.planName,
        days: workoutPlan.weeklySchedule.length,
        totalDuration: workoutPlan.totalWeeklyDuration,
        difficulty: workoutPlan.difficultyLevel
      });

      // Optional: Validate with Zod for extra safety (but should always pass)
      const validatedPlan = WorkoutPlanSchema.parse(workoutPlan);
      
      return validatedPlan;
      
    } catch (error) {
      console.error("❌ [MODERN] Structured generation failed:", error);
      throw new Error(`Modern workout generation failed: ${error.message}`);
    }
  }

  /**
   * Build personalized prompt based on user's onboarding data
   */
  private buildPersonalizedPrompt(user: TestUserProfile): string {
    return `Create a personalized workout plan for ${user.name} with the following specifications:

PERSONAL DETAILS:
- Age: ${user.age}, Gender: ${user.gender}
- Height: ${user.height_cm}cm, Current Weight: ${user.weight_kg}kg, Target: ${user.target_weight_kg}kg
- Fitness Level: ${user.fitnessLevel}
- Activity Level: ${user.activityLevel}

FITNESS GOALS:
${user.fitnessGoals.map(goal => `- ${goal}`).join('\n')}

WORKOUT PREFERENCES:
- Frequency: ${user.workoutFrequency} days per week
- Duration: ${user.workoutDuration} minutes per session
- Preferred Types: ${user.preferredWorkoutTypes.join(', ')}

AVAILABLE EQUIPMENT:
${user.availableEquipment.map(eq => `- ${eq}`).join('\n')}

REQUIREMENTS:
1. Create a comprehensive weekly workout plan
2. Include proper warm-up and cool-down for each day
3. Progress exercises appropriately for ${user.fitnessLevel} level
4. Focus on ${user.fitnessGoals.join(' and ')}
5. Use only available equipment: ${user.availableEquipment.join(', ')}
6. Each workout should be approximately ${user.workoutDuration} minutes
7. Include safety notes and nutrition tips
8. Provide 4-week progression plan

IMPORTANT: 
- Exercises must be appropriate for ${user.fitnessLevel} fitness level
- Consider ${user.gender} and age ${user.age} for exercise selection
- Target weight change from ${user.weight_kg}kg to ${user.target_weight_kg}kg
- Plan should be sustainable for ${user.activityLevel} lifestyle`;
  }

  /**
   * Generate quick workout for testing
   */
  async generateQuickWorkout(user: TestUserProfile): Promise<any> {
    const quickPrompt = `Generate a single workout day for ${user.name}:
- Fitness Level: ${user.fitnessLevel}
- Duration: ${user.workoutDuration} minutes
- Equipment: ${user.availableEquipment.join(', ')}
- Focus: ${user.fitnessGoals[0]}`;

    try {
      const response = await this.model.generateContent({
        contents: [{ role: "user", parts: [{ text: quickPrompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              day: { type: "string" },
              focus: { type: "string" },
              duration: { type: "number" },
              exercises: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    sets: { type: "number" },
                    reps: { type: "string" },
                    restSeconds: { type: "number" }
                  },
                  required: ["name", "sets", "reps", "restSeconds"]
                }
              }
            },
            required: ["day", "focus", "duration", "exercises"]
          }
        }
      });

      return JSON.parse(response.response.text());
    } catch (error) {
      console.error("❌ Quick workout generation failed:", error);
      throw error;
    }
  }

  /**
   * Test method to compare response times
   */
  async benchmarkGeneration(user: TestUserProfile): Promise<{
    duration: number;
    success: boolean;
    planSize: number;
  }> {
    const startTime = Date.now();
    
    try {
      const plan = await this.generateWorkoutPlan(user);
      const endTime = Date.now();
      
      return {
        duration: endTime - startTime,
        success: true,
        planSize: JSON.stringify(plan).length
      };
    } catch (error) {
      const endTime = Date.now();
      return {
        duration: endTime - startTime,
        success: false,
        planSize: 0
      };
    }
  }
}
