/**
 * Progress Analysis Service
 * 
 * Analyzes user fitness progress data and provides personalized insights and recommendations
 * using the Gemini AI with error handling and fallback mechanisms.
 */

import { gemini } from '../../lib/gemini';
import { promptManager } from './promptManager';
import { API_TIMEOUTS } from '../../constants/api';

// Type definitions
export interface UserProgressData {
  weeksActive: number;
  startingWeight: number;
  currentWeight: number;
  goalWeight: number;
  workoutCompletionRate: number; // percentage
  avgWorkoutDuration: number; // minutes
  strengthProgress: string; // e.g. "10% increase in bench press, 15% increase in squats"
  fitnessGoal: 'weight loss' | 'muscle gain' | 'improved fitness' | 'maintenance';
  dietAdherence?: number; // percentage
  sleepQuality?: number; // 1-10 scale
  energyLevels?: number; // 1-10 scale
  measurementChanges?: Record<string, number>; // e.g. { "waist": -2, "chest": 1 }
}

export interface ProgressStrength {
  strengths: string[];
  improvements: string[];
}

export interface ProgressRecommendation {
  area: 'Workout' | 'Nutrition' | 'Recovery' | 'Lifestyle';
  suggestion: string;
  reasoning: string;
}

export interface ProgressProjection {
  timeToGoal: string;
  nextMilestone: string;
}

export interface ProgressAnalysisResult {
  progressSummary: string;
  achievements: string[];
  areas: ProgressStrength;
  recommendations: ProgressRecommendation[];
  projections: ProgressProjection;
}

export interface FallbackProgressAnalysis {
  progressSummary: string;
  achievements: string[];
  areas: ProgressStrength;
  recommendations: ProgressRecommendation[];
  projections: ProgressProjection;
  isFallback: true;
  message: string;
}

export class ProgressAnalysisService {
  private static readonly PROMPT_ID = 'progress-analysis';
  private static readonly PROMPT_VERSION = 1;
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY_MS = 1000;
  
  /**
   * Analyze user fitness progress data
   */
  async analyzeProgress(
    progressData: UserProgressData
  ): Promise<ProgressAnalysisResult | FallbackProgressAnalysis> {
    // Prepare prompt parameters
    const promptParams = {
      weeksActive: progressData.weeksActive,
      startingWeight: progressData.startingWeight,
      currentWeight: progressData.currentWeight,
      goalWeight: progressData.goalWeight,
      workoutCompletionRate: progressData.workoutCompletionRate,
      avgWorkoutDuration: progressData.avgWorkoutDuration,
      strengthProgress: progressData.strengthProgress,
      fitnessGoal: progressData.fitnessGoal
    };
    
    // Get the formatted prompt with parameters
    const prompt = promptManager.getPrompt(
      ProgressAnalysisService.PROMPT_ID, 
      ProgressAnalysisService.PROMPT_VERSION, 
      promptParams
    );
    
    // Set up a timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('AI request timed out')), API_TIMEOUTS.AI_GENERATION);
    });
    
    // Try to analyze progress with retries
    for (let attempt = 1; attempt <= ProgressAnalysisService.MAX_RETRIES; attempt++) {
      try {
        // Race against timeout
        const result = await Promise.race([
          this.callGeminiAPI(prompt),
          timeoutPromise
        ]);
        
        // Validate the response
        if (this.validateProgressAnalysis(result)) {
          return result;
        } else {
          throw new Error('Invalid progress analysis structure received from AI');
        }
      } catch (error) {
        console.error(`Progress analysis attempt ${attempt} failed:`, error);
        
        // If we've reached max retries, provide a fallback
        if (attempt === ProgressAnalysisService.MAX_RETRIES) {
          console.warn('All progress analysis attempts failed, using fallback analysis');
          return this.getFallbackProgressAnalysis(progressData, String(error));
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, ProgressAnalysisService.RETRY_DELAY_MS));
      }
    }
    
    // This should never be reached due to the fallback, but TypeScript requires a return
    return this.getFallbackProgressAnalysis(progressData, 'Unexpected error in progress analysis');
  }
  
  /**
   * Call the Gemini API to analyze progress
   */
  private async callGeminiAPI(prompt: string): Promise<ProgressAnalysisResult> {
    try {
      const result = await gemini.generateContent(prompt);
      return JSON.parse(result);
    } catch (error) {
      throw new Error(`Gemini API error: ${error}`);
    }
  }
  
  /**
   * Validate the structure of the progress analysis result
   */
  private validateProgressAnalysis(analysis: any): analysis is ProgressAnalysisResult {
    if (!analysis) return false;
    
    // Basic structure validation
    if (typeof analysis.progressSummary !== 'string') return false;
    if (!Array.isArray(analysis.achievements)) return false;
    if (!analysis.areas || !Array.isArray(analysis.areas.strengths) || !Array.isArray(analysis.areas.improvements)) return false;
    if (!Array.isArray(analysis.recommendations)) return false;
    if (!analysis.projections || typeof analysis.projections.timeToGoal !== 'string' || typeof analysis.projections.nextMilestone !== 'string') return false;
    
    // Check recommendations have required fields
    for (const recommendation of analysis.recommendations) {
      if (!recommendation.area || !recommendation.suggestion || !recommendation.reasoning) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Get fallback progress analysis when AI analysis fails
   */
  private getFallbackProgressAnalysis(progressData: UserProgressData, errorMessage: string): FallbackProgressAnalysis {
    // Weight change calculation
    const weightChange = progressData.currentWeight - progressData.startingWeight;
    const weightGoalDifference = Math.abs(progressData.goalWeight - progressData.currentWeight);
    const isWeightLossGoal = progressData.goalWeight < progressData.startingWeight;
    const weightChangeDirection = weightChange < 0 ? 'lost' : 'gained';
    
    // Generate a simple progress summary based on basic data
    let progressSummary = `Over the past ${progressData.weeksActive} weeks, you have ${weightChangeDirection} ${Math.abs(weightChange).toFixed(1)} kg`;
    
    if (progressData.workoutCompletionRate > 0) {
      progressSummary += ` with a workout completion rate of ${progressData.workoutCompletionRate}%.`;
    } else {
      progressSummary += '.';
    }
    
    // Calculate time to goal (very simplified)
    let timeToGoal = 'Undetermined';
    if (weightChange !== 0) {
      // Calculate weeks based on current weight change rate
      const weeklyChange = Math.abs(weightChange) / progressData.weeksActive;
      if (weeklyChange > 0) {
        const weeksToGoal = Math.ceil(weightGoalDifference / weeklyChange);
        timeToGoal = `Approximately ${weeksToGoal} more weeks at your current rate`;
      }
    }
    
    // Generate achievements based on available data
    const achievements: string[] = [];
    
    if (progressData.weeksActive >= 4) {
      achievements.push(`Consistently tracking your fitness for ${progressData.weeksActive} weeks`);
    }
    
    if (progressData.workoutCompletionRate >= 80) {
      achievements.push(`High workout consistency with ${progressData.workoutCompletionRate}% completion rate`);
    }
    
    if ((isWeightLossGoal && weightChange < 0) || (!isWeightLossGoal && weightChange > 0)) {
      achievements.push(`Moving toward your weight goal by ${Math.abs(weightChange).toFixed(1)} kg`);
    }
    
    if (achievements.length === 0) {
      achievements.push('Starting your fitness journey');
    }
    
    // Create basic fallback analysis
    const fallbackAnalysis: FallbackProgressAnalysis = {
      progressSummary,
      achievements,
      areas: {
        strengths: this.getFallbackStrengths(progressData),
        improvements: this.getFallbackImprovements(progressData)
      },
      recommendations: this.getFallbackRecommendations(progressData),
      projections: {
        timeToGoal,
        nextMilestone: this.getNextMilestone(progressData)
      },
      isFallback: true,
      message: `We couldn't generate a detailed progress analysis: ${errorMessage}. Here's a basic analysis based on your data.`
    };
    
    return fallbackAnalysis;
  }
  
  /**
   * Generate fallback strengths based on user data
   */
  private getFallbackStrengths(data: UserProgressData): string[] {
    const strengths: string[] = [];
    
    // Add strengths based on available metrics
    if (data.workoutCompletionRate >= 70) {
      strengths.push('Consistent workout routine');
    }
    
    if (data.avgWorkoutDuration >= 45) {
      strengths.push('Good workout duration');
    }
    
    if (data.fitnessGoal === 'weight loss' && data.currentWeight < data.startingWeight) {
      strengths.push('Making progress toward weight loss goal');
    } else if (data.fitnessGoal === 'muscle gain' && data.currentWeight > data.startingWeight) {
      strengths.push('Making progress toward muscle gain goal');
    }
    
    if (data.dietAdherence && data.dietAdherence >= 70) {
      strengths.push('Strong nutrition plan adherence');
    }
    
    // Add generic strength if none found
    if (strengths.length === 0) {
      strengths.push('Commitment to tracking fitness progress');
    }
    
    return strengths;
  }
  
  /**
   * Generate fallback improvements based on user data
   */
  private getFallbackImprovements(data: UserProgressData): string[] {
    const improvements: string[] = [];
    
    // Add improvement areas based on available metrics
    if (data.workoutCompletionRate < 70) {
      improvements.push('Workout consistency');
    }
    
    if (data.avgWorkoutDuration < 30) {
      improvements.push('Workout duration');
    }
    
    if (data.fitnessGoal === 'weight loss' && data.currentWeight >= data.startingWeight) {
      improvements.push('Nutrition strategy for weight loss');
    } else if (data.fitnessGoal === 'muscle gain' && data.currentWeight <= data.startingWeight) {
      improvements.push('Nutrition strategy for muscle gain');
    }
    
    if (data.dietAdherence && data.dietAdherence < 70) {
      improvements.push('Meal plan adherence');
    }
    
    if (data.sleepQuality && data.sleepQuality < 6) {
      improvements.push('Sleep quality');
    }
    
    // Add generic improvement if none found
    if (improvements.length === 0) {
      improvements.push('Tracking more detailed fitness metrics');
    }
    
    return improvements;
  }
  
  /**
   * Generate fallback recommendations based on user data
   */
  private getFallbackRecommendations(data: UserProgressData): ProgressRecommendation[] {
    const recommendations: ProgressRecommendation[] = [];
    
    // Workout recommendation
    if (data.workoutCompletionRate < 70) {
      recommendations.push({
        area: 'Workout',
        suggestion: 'Schedule your workouts at the same time each day to build consistency',
        reasoning: 'Regular workout timing helps establish a habit and improves adherence'
      });
    } else {
      recommendations.push({
        area: 'Workout',
        suggestion: 'Consider progressively increasing your workout intensity by 5-10%',
        reasoning: 'Progressive overload is key to continued improvement and avoiding plateaus'
      });
    }
    
    // Nutrition recommendation
    if (data.fitnessGoal === 'weight loss') {
      recommendations.push({
        area: 'Nutrition',
        suggestion: 'Focus on protein intake and fiber-rich vegetables at each meal',
        reasoning: 'Higher protein and fiber intake increases satiety and helps maintain a calorie deficit'
      });
    } else if (data.fitnessGoal === 'muscle gain') {
      recommendations.push({
        area: 'Nutrition',
        suggestion: 'Ensure you\'re in a slight calorie surplus with adequate protein (1.6-2.2g/kg of bodyweight)',
        reasoning: 'Muscle building requires both extra energy and sufficient protein for tissue repair and growth'
      });
    } else {
      recommendations.push({
        area: 'Nutrition',
        suggestion: 'Maintain a balanced diet with a focus on whole foods and adequate hydration',
        reasoning: 'Whole foods provide the micronutrients needed for optimal performance and recovery'
      });
    }
    
    // Recovery recommendation
    if (data.sleepQuality && data.sleepQuality < 7) {
      recommendations.push({
        area: 'Recovery',
        suggestion: 'Improve sleep quality by establishing a consistent bedtime routine',
        reasoning: 'Quality sleep is essential for muscle recovery, hormone regulation, and overall progress'
      });
    } else {
      recommendations.push({
        area: 'Recovery',
        suggestion: 'Incorporate active recovery sessions like walking or light yoga between intense workouts',
        reasoning: 'Active recovery promotes blood flow to muscles and speeds up the recovery process'
      });
    }
    
    return recommendations;
  }
  
  /**
   * Generate next milestone based on user data
   */
  private getNextMilestone(data: UserProgressData): string {
    // Weight-based milestone
    if (data.fitnessGoal === 'weight loss' || data.fitnessGoal === 'muscle gain') {
      const currentDiff = Math.abs(data.currentWeight - data.goalWeight);
      const nextTarget = data.fitnessGoal === 'weight loss' 
        ? Math.max(data.goalWeight, data.currentWeight - (currentDiff * 0.25))
        : Math.min(data.goalWeight, data.currentWeight + (currentDiff * 0.25));
      
      return `Reach a weight of ${nextTarget.toFixed(1)} kg, which is 25% closer to your goal`;
    }
    
    // Workout consistency milestone
    if (data.workoutCompletionRate < 80) {
      const targetRate = Math.min(85, data.workoutCompletionRate + 15);
      return `Achieve a ${targetRate}% workout completion rate for the next month`;
    }
    
    // Generic milestone
    return 'Continue your current routine for another 4 weeks while tracking progress';
  }
} 