/**
 * Body Analysis Service
 * 
 * Handles analyzing user body photos using the Gemini Vision API
 * with advanced error handling and fallback mechanisms.
 */

import gemini, { extractAndParseJSON } from '../../lib/gemini';
import { API_TIMEOUTS } from '../../constants/api';
import { promptManager } from './promptManager';

// Type definitions
export interface BodyPhoto {
  uri: string;
  type: 'front' | 'side' | 'back';
}

export interface UserPhysicalDetails {
  gender?: string;
  age?: number;
  height?: number;
  weight?: number;
  height_cm?: number;
  weight_kg?: number;
  date_of_birth?: Date;
  body_fat_percentage?: number;
  fitnessGoal?: 'weight loss' | 'muscle gain' | 'improved fitness' | 'maintenance';
}

export interface BodyProportions {
  shoulders: string;
  torso: string;
  arms: string;
  legs: string;
}

export interface PostureAnalysis {
  alignment: string;
  issues: string[];
  recommendations: string[];
}

/**
 * Body Analysis Result
 * 
 * Note: Gemini API sometimes returns 'recommendations' instead of 'recommendedFocusAreas',
 * which is handled by the validation process.
 */
export interface BodyAnalysisResult {
  bodyFatEstimate: number;
  bodyType: string;
  analysisText: string;
  bodyProportions: BodyProportions;
  posture: PostureAnalysis;
  recommendedFocusAreas: string[];
  recommendations: string[];
}

export interface FallbackBodyAnalysis {
  bodyFatEstimate: number | null;
  bodyType: string;
  analysisText: string;
  bodyProportions: BodyProportions;
  posture: PostureAnalysis;
  recommendedFocusAreas: string[];
  recommendations: string[];
  isFallback: true;
  message: string;
}

export class BodyAnalysisService {
  private static readonly PROMPT_ID = 'body-analysis';
  private static readonly PROMPT_VERSION = 1;
  private static readonly MAX_RETRIES = 2;
  private static readonly RETRY_DELAY_MS = 1000;
  
  /**
   * Analyze body composition from user photos
   */
  async analyzeBodyComposition(
    photos: BodyPhoto[], 
    userDetails: UserPhysicalDetails
  ): Promise<BodyAnalysisResult | FallbackBodyAnalysis> {
    // Parameter defaults - support both old and new field names
    const promptParams = {
      gender: userDetails.gender || 'unspecified',
      age: userDetails.age ? userDetails.age.toString() : 'unspecified',
      height: (userDetails.height_cm || userDetails.height) ? `${userDetails.height_cm || userDetails.height}cm` : 'unspecified',
      weight: (userDetails.weight_kg || userDetails.weight) ? `${userDetails.weight_kg || userDetails.weight}kg` : 'unspecified',
      fitnessGoal: userDetails.fitnessGoal || 'overall fitness improvement',
      bodyFat: userDetails.body_fat_percentage ? `${userDetails.body_fat_percentage}%` : 'unspecified'
    };
    
    // Get the formatted prompt with parameters
    const prompt = promptManager.getPrompt(
      BodyAnalysisService.PROMPT_ID, 
      BodyAnalysisService.PROMPT_VERSION, 
      promptParams
    );
    
    // Set up a timeout promise (longer timeout for vision API)
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('AI request timed out')), API_TIMEOUTS.AI_GENERATION * 1.5);
    });
    
    // Try to analyze body composition with retries
    for (let attempt = 1; attempt <= BodyAnalysisService.MAX_RETRIES; attempt++) {
      try {
        // Race against timeout
        const result = await Promise.race([
          this.callGeminiVisionAPI(prompt, photos),
          timeoutPromise
        ]);
        
        // Validate the response
        if (this.validateBodyAnalysis(result)) {
          return result;
        } else {
          throw new Error('Invalid body analysis structure received from AI');
        }
      } catch (error) {
        console.error(`Body analysis attempt ${attempt} failed:`, error);
        
        // If we've reached max retries, provide a fallback
        if (attempt === BodyAnalysisService.MAX_RETRIES) {
          console.warn('All body analysis attempts failed, using fallback analysis');
          return this.getFallbackBodyAnalysis(userDetails, String(error));
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, BodyAnalysisService.RETRY_DELAY_MS));
      }
    }
    
    // This should never be reached due to the fallback, but TypeScript requires a return
    return this.getFallbackBodyAnalysis(userDetails, 'Unexpected error in body analysis');
  }
  
  /**
   * Call the Gemini Vision API to analyze body photos
   */
  private async callGeminiVisionAPI(prompt: string, photos: BodyPhoto[]): Promise<BodyAnalysisResult> {
    try {
      const result = await gemini.analyzeBodyComposition(photos);
      
      // Add detailed debugging
      console.log('Raw body analysis result from Gemini:', JSON.stringify(result, null, 2));
      console.log('Result type:', typeof result);
      
      // Check if the result is an error from the Gemini service
      if ('error' in result && result.error) {
        throw new Error(result.message || 'Unknown error from vision API');
      }
      
      // Parse the result using our enhanced JSON parser
      if (typeof result === 'string') {
        const parsedResult = extractAndParseJSON(result) as BodyAnalysisResult;
        console.log('Parsed result:', JSON.stringify(parsedResult, null, 2));
        return parsedResult;
      }
      
      return result as BodyAnalysisResult;
    } catch (error) {
      throw new Error(`Gemini Vision API error: ${error}`);
    }
  }
  
  /**
   * Validate the structure of the body analysis result
   */
  private validateBodyAnalysis(analysis: any): analysis is BodyAnalysisResult {
    console.log('Validating body analysis structure:', JSON.stringify(analysis, null, 2));
    
    if (!analysis) {
      console.error('Body analysis is null or undefined');
      return false;
    }
    
    // Check if the API returned recommendations instead of recommendedFocusAreas and map it
    if (Array.isArray(analysis.recommendations) && (!analysis.recommendedFocusAreas || !Array.isArray(analysis.recommendedFocusAreas))) {
      console.log('Mapping recommendations to recommendedFocusAreas');
      analysis.recommendedFocusAreas = analysis.recommendations;
    }
    
    // More flexible structure validation with detailed logging
    const validations = [
      { field: 'bodyType', check: () => typeof analysis.bodyType === 'string', required: true },
      { field: 'analysisText', check: () => typeof analysis.analysisText === 'string', required: true },
      { field: 'bodyProportions', check: () => analysis.bodyProportions !== null && typeof analysis.bodyProportions === 'object', required: true },
      { field: 'bodyFatEstimate', check: () => analysis.bodyFatEstimate === null || typeof analysis.bodyFatEstimate === 'number', required: false },
      { field: 'recommendedFocusAreas', check: () => Array.isArray(analysis.recommendedFocusAreas), required: true },
      // Posture may or may not be included in the response, so make it optional
      { field: 'posture', check: () => !analysis.posture || typeof analysis.posture === 'object', required: false }
    ];
    
    // Check for required fields and log issues
    const failures = validations
      .filter(v => v.required && !v.check())
      .map(v => v.field);
    
    if (failures.length > 0) {
      console.error(`Body analysis validation failed for fields: ${failures.join(', ')}`);
      return false;
    }
    
    // Create or normalize missing non-required fields
    if (!analysis.posture) {
      console.log('Creating default posture object');
      analysis.posture = {
        alignment: 'Not analyzed',
        issues: [],
        recommendations: ['Maintain proper posture']
      };
    }
    
    // Ensure all required bodyProportions fields exist
    if (analysis.bodyProportions) {
      const requiredProps = ['shoulders', 'torso', 'arms', 'legs'];
      for (const prop of requiredProps) {
        if (!analysis.bodyProportions[prop]) {
          console.log(`Adding missing bodyProportions.${prop}`);
          analysis.bodyProportions[prop] = 'Not specifically analyzed';
        }
      }
    }
    
    return true;
  }
  
  /**
   * Get fallback body analysis when AI analysis fails
   */
  private getFallbackBodyAnalysis(userDetails: UserPhysicalDetails, errorMessage: string): FallbackBodyAnalysis {
    // Determine body type based on basic info if available
    let bodyType = 'Unknown (insufficient data)';
    let recommendedFocusAreas: string[] = [];
    
    // Extract height and weight from the user details
    // Support both legacy and new field names from the database
    const height = userDetails.height_cm || userDetails.height;
    const weight = userDetails.weight_kg || userDetails.weight;
    const bodyFat = userDetails.body_fat_percentage;
    
    if (userDetails.gender && height && weight) {
      // Very basic BMI calculation for body type estimation
      const heightInMeters = height / 100;
      const bmi = weight / (heightInMeters * heightInMeters);
      
      // If we have body fat percentage, use that for more accurate classification
      if (bodyFat) {
        if (userDetails.gender.toLowerCase() === 'male') {
          if (bodyFat < 10) {
            bodyType = 'Athletic build with low body fat'; 
            recommendedFocusAreas = ['Maintain your current muscle', 'Focus on performance training', 'Eat enough to support your activity'];
          } else if (bodyFat < 20) {
            bodyType = 'Balanced build with good muscle tone';
            recommendedFocusAreas = ['Work on improving muscle definition', 'Build overall strength', 'Keep a balanced diet'];
          } else {
            bodyType = 'Build with higher body fat';
            recommendedFocusAreas = ['Focus on fat loss', 'Add cardio workouts', 'Reduce daily calories slightly'];
          }
        } else if (userDetails.gender.toLowerCase() === 'female') {
          if (bodyFat < 18) {
            bodyType = 'Athletic build with low body fat';
            recommendedFocusAreas = ['Maintain your current muscle', 'Focus on performance training', 'Eat enough to support your activity'];
          } else if (bodyFat < 28) {
            bodyType = 'Balanced build with good muscle tone';
            recommendedFocusAreas = ['Work on improving muscle definition', 'Build overall strength', 'Keep a balanced diet'];
          } else {
            bodyType = 'Build with higher body fat';
            recommendedFocusAreas = ['Focus on fat loss', 'Add cardio workouts', 'Reduce daily calories slightly'];
          }
        }
      } else {
        // Use BMI as fallback if body fat percentage isn't available
        if (bmi < 18.5) {
          bodyType = 'Naturally slim build';
          recommendedFocusAreas = ['Build strength with regular weight training', 'Add muscle with proper nutrition', 'Eat more calories than you burn'];
        } else if (bmi >= 18.5 && bmi < 25) {
          bodyType = 'Balanced build';
          recommendedFocusAreas = ['Mix of strength and cardio training', 'Focus on overall fitness'];
        } else if (bmi >= 25 && bmi < 30) {
          bodyType = 'Solid build with some extra weight';
          recommendedFocusAreas = ['Focus on fat loss', 'Add regular cardio', 'Slightly reduce daily calories'];
        } else {
          bodyType = 'Build with significant extra weight';
          recommendedFocusAreas = ['Focus on fat loss', 'Regular cardio workouts', 'Strength training', 'Reduce daily calories'];
        }
      }
    } else {
      // Without sufficient data, provide general recommendations
      recommendedFocusAreas = ['Mix of strength and cardio training', 'Balance of different exercise types'];
    }
    
    // Default posture analysis
    const posture: PostureAnalysis = {
      alignment: 'Not enough information to assess your posture',
      issues: ['We need more information to give you feedback on your posture'],
      recommendations: ['Stand tall with shoulders back', 'Sit with good back support']
    };
    
    // Default proportions
    const bodyProportions: BodyProportions = {
      shoulders: 'Not enough information available',
      torso: 'Not enough information available',
      arms: 'Not enough information available',
      legs: 'Not enough information available'
    };
    
    // Return a structured fallback response
    return {
      bodyFatEstimate: null, // Cannot estimate without analysis
      bodyType,
      analysisText: `Based on your height and weight information, you have a ${bodyType.toLowerCase()}. ` +
                  `To get more detailed feedback, please try uploading a photo for analysis.`,
      bodyProportions,
      posture,
      recommendedFocusAreas,
      recommendations: [
        'Talk to a fitness trainer for personalized advice',
        'Start with a balanced fitness plan until you get more specific guidance',
        ...recommendedFocusAreas
      ],
      isFallback: true,
      message: `AI analysis failed: ${errorMessage}`
    };
  }
}