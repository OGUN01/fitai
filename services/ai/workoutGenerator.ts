/**
 * Workout Generator Service
 * 
 * Handles generating personalized workout plans using the Gemini API
 * with advanced error handling and fallback mechanisms.
 */

import { gemini } from '../../lib/gemini';
import { promptManager } from './promptManager';
import { API_TIMEOUTS } from '../../constants/api';
import { parseJsonFromLLM } from './advancedFallbacks';

// Type definitions
export interface UserFitnessPreferences {
  fitnessLevel: 'beginner' | 'intermediate' | 'advanced';
  workoutLocation: 'home' | 'gym' | 'outdoors' | 'anywhere';
  availableEquipment: string[];
  exerciseFrequency: number;
  timePerSession: number;
  focusAreas: string[];
  injuries?: string;
  age?: number;
  gender?: string;
  weight?: number;
  height?: number;
}

export interface WorkoutExercise {
  name: string;
  sets: number;
  reps: number;
  restSeconds: number;
  notes?: string;
  alternatives?: string[];
}

export interface WorkoutDay {
  day: string;
  focus: string;
  exercises: WorkoutExercise[];
}

export interface WorkoutPlan {
  weeklySchedule: WorkoutDay[];
  warmUp: string[];
  coolDown: string[];
  progressionPlan: {
    week2: string;
    week3: string;
    week4: string;
  };
}

export interface FallbackWorkoutPlan {
  weeklySchedule: WorkoutDay[];
  warmUp: string[];
  coolDown: string[];
  isFallback: true;
  message: string;
}

export class WorkoutGenerator {
  private static readonly PROMPT_ID = 'workout-generation';
  private static readonly PROMPT_VERSION = 1;
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY_MS = 1000;
  
  /**
   * Generate a personalized workout plan for a user
   */
  async generateWorkoutPlan(preferences: UserFitnessPreferences): Promise<WorkoutPlan | FallbackWorkoutPlan> {
    // Get the prompt text from the prompt manager
    const promptParams = {
      fitnessLevel: preferences.fitnessLevel,
      workoutLocation: preferences.workoutLocation,
      equipment: preferences.availableEquipment.join(', '),
      frequency: preferences.exerciseFrequency,
      timePerSession: preferences.timePerSession,
      focusAreas: preferences.focusAreas.join(', '),
      injuries: preferences.injuries || 'None'
    };

    // Get the prompt for workout generation
    const prompt = await promptManager.getPrompt(
      WorkoutGenerator.PROMPT_ID,
      WorkoutGenerator.PROMPT_VERSION,
      promptParams
    );

    // Call the Gemini API
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt < WorkoutGenerator.MAX_RETRIES) {
      try {
        attempt++;
        console.log(`Workout generation attempt ${attempt}`);
        
        const result = await this.callGeminiApi(prompt);
        return result;
      } catch (error) {
        console.log(`Workout generation attempt ${attempt} failed:`, error);
        lastError = error;
        
        // Wait before retrying
        if (attempt < WorkoutGenerator.MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, WorkoutGenerator.RETRY_DELAY_MS));
        }
      }
    }

    // If all attempts failed, create a fallback plan
    console.log("All workout generation attempts failed, using fallback plan");
    return this.getFallbackWorkoutPlan(preferences, "All workout generation attempts failed");
  }
  
  /**
   * Call the Gemini API to generate a workout plan
   */
  private async callGeminiApi(prompt: string): Promise<WorkoutPlan> {
    try {
      const result = await gemini.generateContent(prompt);
      return this.parseWorkoutPlanResponse(result);
    } catch (error) {
      throw new Error(`Gemini API error: ${error}`);
    }
  }
  
  /**
   * Parse the response from the Gemini API into a workout plan
   */
  private parseWorkoutPlanResponse(response: string): WorkoutPlan {
    try {
      // Use our robust parser instead of direct JSON.parse
      const parsedResponse = parseJsonFromLLM(response);
      
      // Validate the parsed response - this will throw an error if validation fails
      this.validateWorkoutPlan(parsedResponse);
      
      return parsedResponse;
    } catch (error) {
      console.error('Error parsing workout plan response:', error);
      throw new Error(`Failed to parse workout plan: ${error.message}`);
    }
  }
  
  /**
   * Validate that the workout plan has all required fields and structure
   */
  private validateWorkoutPlan(plan: any): void {
    if (!plan) {
      throw new Error('Parsed response is null or undefined');
    }
    
    // Basic structure validation
    if (!Array.isArray(plan.weeklySchedule)) {
      throw new Error('Workout plan is missing weeklySchedule array');
    }
    
    if (!Array.isArray(plan.warmUp)) {
      throw new Error('Workout plan is missing warmUp array');
    }
    
    if (!Array.isArray(plan.coolDown)) {
      throw new Error('Workout plan is missing coolDown array');
    }
    
    if (!plan.progressionPlan) {
      throw new Error('Workout plan is missing progressionPlan');
    }
    
    // Check that weekly schedule has valid days
    if (plan.weeklySchedule.length === 0) {
      throw new Error('Workout plan has no days in the schedule');
    }
    
    for (const day of plan.weeklySchedule) {
      if (!day.day || !day.focus || !Array.isArray(day.exercises)) {
        throw new Error(`Invalid day in workout plan: ${JSON.stringify(day)}`);
      }
      
      // Check each exercise has required fields
      for (const exercise of day.exercises) {
        if (!exercise.name || 
            typeof exercise.sets !== 'number' || 
            typeof exercise.reps !== 'number' || 
            typeof exercise.restSeconds !== 'number') {
          throw new Error(`Invalid exercise in workout plan: ${JSON.stringify(exercise)}`);
        }
      }
    }
  }
  
  /**
   * Get a fallback workout plan when AI generation fails
   */
  private getFallbackWorkoutPlan(preferences: UserFitnessPreferences, errorMessage: string): FallbackWorkoutPlan {
    // Create a basic fallback plan based on user preferences
    const fallbackPlan: FallbackWorkoutPlan = {
      weeklySchedule: this.createFallbackWorkouts(preferences),
      warmUp: [
        'Light jogging or marching in place for 3-5 minutes',
        'Arm circles (10 forward, 10 backward)',
        'Hip rotations (10 each direction)',
        'Bodyweight squats (10 reps)',
        'Push-ups or modified push-ups (5-10 reps)'
      ],
      coolDown: [
        'Walking in place for 2-3 minutes',
        'Quad stretch (30 seconds each leg)',
        'Hamstring stretch (30 seconds each leg)',
        'Chest and shoulder stretch (30 seconds each side)',
        'Deep breathing exercises (5 deep breaths)'
      ],
      isFallback: true,
      message: `We couldn't generate a custom workout plan at this time: ${errorMessage}. Here's a general plan instead.`
    };
    
    return fallbackPlan;
  }
  
  /**
   * Create basic fallback workout days based on user preferences
   */
  private createFallbackWorkouts(preferences: UserFitnessPreferences): WorkoutDay[] {
    const workoutDays: WorkoutDay[] = [];
    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    // Determine workout split based on frequency
    const workoutTypes = this.determineFallbackSplit(preferences);
    
    // Create workout schedule
    for (let i = 0; i < preferences.exerciseFrequency; i++) {
      const workoutType = workoutTypes[i % workoutTypes.length];
      const exercises = this.getFallbackExercises(workoutType, preferences);
      
      workoutDays.push({
        day: daysOfWeek[i],
        focus: workoutType,
        exercises: exercises
      });
    }
    
    return workoutDays;
  }
  
  /**
   * Determine appropriate workout split based on frequency
   */
  private determineFallbackSplit(preferences: UserFitnessPreferences): string[] {
    // Determine appropriate split based on frequency and focus areas
    switch (preferences.exerciseFrequency) {
      case 1:
        return ['Full Body'];
      case 2:
        return ['Upper Body', 'Lower Body'];
      case 3:
        if (preferences.fitnessLevel === 'beginner') {
          return ['Full Body', 'Full Body', 'Full Body'];
        } else {
          return ['Push', 'Pull', 'Legs'];
        }
      case 4:
        return ['Upper Body', 'Lower Body', 'Upper Body', 'Lower Body'];
      case 5:
        return ['Chest & Triceps', 'Back & Biceps', 'Legs & Shoulders', 'Upper Body', 'Lower Body'];
      case 6:
      case 7:
        return ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Full Body', 'Rest'];
      default:
        return ['Full Body'];
    }
  }
  
  /**
   * Get basic exercises for fallback plans
   */
  private getFallbackExercises(workoutType: string, preferences: UserFitnessPreferences): WorkoutExercise[] {
    const isHome = preferences.workoutLocation === 'home' || preferences.workoutLocation === 'anywhere';
    const hasEquipment = preferences.availableEquipment.length > 0;
    const isBeginner = preferences.fitnessLevel === 'beginner';
    
    // Define base exercises based on workout type
    let exercises: WorkoutExercise[] = [];
    
    switch (workoutType) {
      case 'Full Body':
        exercises = [
          {
            name: isHome ? 'Push-ups' : 'Bench Press',
            sets: isBeginner ? 2 : 3,
            reps: isBeginner ? 8 : 10,
            restSeconds: 60,
            alternatives: ['Wall Push-ups', 'Knee Push-ups']
          },
          {
            name: isHome ? 'Bodyweight Squats' : 'Barbell Squats',
            sets: isBeginner ? 2 : 3,
            reps: isBeginner ? 10 : 12,
            restSeconds: 90,
            alternatives: ['Chair Squats', 'Wall Squats']
          },
          {
            name: isHome && !hasEquipment ? 'Superman Holds' : 'Dumbbell Rows',
            sets: 3,
            reps: 12,
            restSeconds: 60,
            alternatives: ['Bird-dog', 'Wall Angels']
          },
          {
            name: 'Plank',
            sets: 3,
            reps: 1,
            restSeconds: 60,
            notes: 'Hold for 20-30 seconds',
            alternatives: ['Forearm Plank', 'Knee Plank']
          }
        ];
        break;
        
      case 'Upper Body':
      case 'Push':
      case 'Chest':
      case 'Chest & Triceps':
        exercises = [
          {
            name: isHome ? 'Push-ups' : 'Bench Press',
            sets: isBeginner ? 3 : 4,
            reps: isBeginner ? 8 : 10,
            restSeconds: 60,
            alternatives: ['Wall Push-ups', 'Knee Push-ups']
          },
          {
            name: isHome ? 'Shoulder Taps' : 'Shoulder Press',
            sets: 3,
            reps: 10,
            restSeconds: 60,
            alternatives: ['Wall Push-ups', 'Arm Raises']
          },
          {
            name: isHome ? 'Tricep Dips' : 'Tricep Extensions',
            sets: 3,
            reps: 12,
            restSeconds: 60,
            alternatives: ['Countertop Dips', 'Diamond Push-ups']
          }
        ];
        break;
        
      case 'Lower Body':
      case 'Legs':
      case 'Legs & Shoulders':
        exercises = [
          {
            name: isHome ? 'Bodyweight Squats' : 'Barbell Squats',
            sets: isBeginner ? 3 : 4,
            reps: 12,
            restSeconds: 90,
            alternatives: ['Chair Squats', 'Wall Squats']
          },
          {
            name: isHome ? 'Lunges' : 'Walking Lunges with Weights',
            sets: 3,
            reps: 10,
            restSeconds: 60,
            notes: 'Each leg',
            alternatives: ['Stationary Lunges', 'Step-ups']
          },
          {
            name: isHome ? 'Glute Bridges' : 'Hip Thrusts',
            sets: 3,
            reps: 15,
            restSeconds: 60,
            alternatives: ['Single Leg Glute Bridges', 'Fire Hydrants']
          },
          {
            name: 'Calf Raises',
            sets: 3,
            reps: 15,
            restSeconds: 45,
            alternatives: ['Seated Calf Raises', 'Single Leg Calf Raises']
          }
        ];
        break;
        
      case 'Pull':
      case 'Back':
      case 'Back & Biceps':
        exercises = [
          {
            name: hasEquipment ? 'Dumbbell Rows' : 'Superman Holds',
            sets: 3,
            reps: 12,
            restSeconds: 60,
            alternatives: ['Bird-dog', 'Wall Angels']
          },
          {
            name: hasEquipment ? 'Bicep Curls' : 'Towel Bicep Curls',
            sets: 3,
            reps: 12,
            restSeconds: 45,
            alternatives: ['Isometric Bicep Holds', 'Resistance Band Curls']
          },
          {
            name: isHome ? 'Reverse Snow Angels' : 'Face Pulls',
            sets: 3,
            reps: 15,
            restSeconds: 45,
            alternatives: ['Wall Slides', 'Band Pull-Aparts']
          }
        ];
        break;
        
      case 'Shoulders':
      case 'Arms':
        exercises = [
          {
            name: isHome ? 'Pike Push-ups' : 'Shoulder Press',
            sets: 3,
            reps: 10,
            restSeconds: 60,
            alternatives: ['Wall Push-ups', 'Arm Raises']
          },
          {
            name: isHome ? 'Lateral Raises with Household Items' : 'Lateral Raises',
            sets: 3,
            reps: 12,
            restSeconds: 45,
            alternatives: ['Arm Circles', 'Upright Rows']
          },
          {
            name: hasEquipment ? 'Bicep Curls' : 'Towel Bicep Curls',
            sets: 3,
            reps: 12,
            restSeconds: 45,
            alternatives: ['Isometric Bicep Holds', 'Water Bottle Curls']
          },
          {
            name: isHome ? 'Tricep Dips' : 'Tricep Extensions',
            sets: 3,
            reps: 12,
            restSeconds: 45,
            alternatives: ['Diamond Push-ups', 'Overhead Tricep Extensions']
          }
        ];
        break;
        
      default:
        exercises = [
          {
            name: 'Push-ups',
            sets: 3,
            reps: 10,
            restSeconds: 60,
            alternatives: ['Wall Push-ups', 'Knee Push-ups']
          },
          {
            name: 'Bodyweight Squats',
            sets: 3,
            reps: 12,
            restSeconds: 90,
            alternatives: ['Chair Squats', 'Wall Squats']
          },
          {
            name: 'Jumping Jacks',
            sets: 3,
            reps: 30,
            restSeconds: 30,
            alternatives: ['Marching in Place', 'Step Jacks']
          }
        ];
    }
    
    return exercises;
  }
}

// Export singleton instance
export const workoutGenerator = new WorkoutGenerator();
