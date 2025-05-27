/**
 * Prompt Manager Service
 * 
 * Manages reusable prompt templates for AI requests with versioning
 * and parameter replacement.
 */

export interface PromptTemplate {
  id: string;
  version: number;
  template: string;
}

export class PromptManager {
  private templates: Record<string, PromptTemplate> = {};

  constructor() {
    this.initializeTemplates();
  }

  private initializeTemplates() {
    // Register all prompt templates
    this.registerTemplate({
      id: 'workout-generation',
      version: 1,
      template: `
Create a personalized workout plan for the following user:
- Fitness level: {{fitnessLevel}}
- Workout location: {{workoutLocation}}
- Available equipment: {{equipment}}
- Exercise frequency: {{exerciseFrequency}} days per week
- Time per session: {{timePerSession}} minutes
- Focus areas: {{focusAreas}}
- Exercises/movements to avoid: {{exercisesToAvoid}}
- Age: {{age}}
- Gender: {{gender}}
- Weight: {{weight}}
- Height: {{height}}

The workout plan should include:
1. A weekly schedule with specific workouts for each day
2. Detailed exercises for each workout with sets, reps, and rest periods
3. Beginner-friendly alternatives for challenging exercises
4. Warm-up and cool-down routines
5. Progression plan for the next 4 weeks

Format the response as JSON with the following structure:
{
  "weeklySchedule": [
    {
      "day": "Monday",
      "focus": "Upper Body",
      "exercises": [
        {
          "name": "Push-ups",
          "sets": 3,
          "reps": 10,
          "restSeconds": 60,
          "notes": "Keep core tight",
          "alternatives": ["Wall Push-ups", "Knee Push-ups"]
        }
      ]
    }
  ],
  "warmUp": ["Exercise 1", "Exercise 2"],
  "coolDown": ["Stretch 1", "Stretch 2"],
  "progressionPlan": {
    "week2": "Description",
    "week3": "Description",
    "week4": "Description"
  }
}
`
    });
    
    this.registerTemplate({
      id: 'meal-plan-generation',
      version: 1,
      template: `
Create a personalized meal plan for the following user:
- Diet type: {{dietType}}
- Diet plan preference: {{dietPlanPreference}}
- Allergies: {{allergies}}
- Meal frequency: {{mealFrequency}} meals per day
- Country/Region: {{region}}
- Fitness goal: {{fitnessGoal}}
- Age: {{age}}
- Gender: {{gender}}
- Weight: {{weight}}
- Height: {{height}}

The meal plan should include:
1. Daily meal schedule with meal types (breakfast, lunch, dinner, snacks)
2. Detailed recipes for each meal with ingredients and preparation instructions
3. Nutritional information (calories, protein, carbs, fats)
4. Shopping list for the week
5. Meal prep tips

Format the response as JSON with the following structure:
{
  "dailyMealPlan": [
    {
      "day": "Monday",
      "meals": [
        {
          "meal": "Breakfast",
          "time": "8:00 AM",
          "recipe": {
            "name": "Recipe Name",
            "ingredients": [
              {"name": "Ingredient 1", "quantity": "1", "unit": "cup"},
              {"name": "Ingredient 2", "quantity": "2", "unit": "tbsp"}
            ],
            "instructions": ["Step 1", "Step 2"],
            "nutrition": {
              "calories": 300,
              "protein": 20,
              "carbs": 30,
              "fats": 10
            },
            "prepTime": "15 minutes"
          }
        }
      ]
    }
  ],
  "shoppingList": [
    {"category": "Protein", "items": ["Chicken breast", "Eggs"]},
    {"category": "Vegetables", "items": ["Spinach", "Broccoli"]}
  ],
  "mealPrepTips": ["Tip 1", "Tip 2"]
}
`
    });
    
    this.registerTemplate({
      id: 'body-analysis',
      version: 1,
      template: `
Analyze these images of a person's body composition. 
I have provided the following views: {{viewsDescription}}.

Please provide a comprehensive assessment including:
1. Estimated body fat percentage
2. Body type classification (ectomorph, mesomorph, endomorph, or combination)
3. Muscle distribution and development
4. Posture analysis
5. Body proportions assessment
6. Recommended focus areas for training

Context about the person:
- Gender: {{gender}}
- Age: {{age}}
- Height: {{height}}
- Weight: {{weight}}
- Fitness goal: {{fitnessGoal}}

IMPORTANT: Use simple, everyday language that is easy for non-fitness experts to understand. Avoid technical terminology and jargon. Write as if you're explaining to someone without fitness or medical background. Use short, clear sentences.

Format the response as JSON with the following structure:
{
  "bodyFatEstimate": 18,
  "bodyType": "Natural build with moderate muscle",
  "analysisText": "Your body has a balanced look with some natural muscle. You have good potential for both gaining strength and improving overall fitness. Your build is suited for various types of workouts.",
  "bodyProportions": {
    "shoulders": "Your shoulders appear average width compared to your hips",
    "torso": "Your upper and lower body are well-proportioned",
    "arms": "Your arms show some natural muscle tone",
    "legs": "Your legs are in good proportion to your upper body"
  },
  "posture": {
    "alignment": "Your posture is generally good with some minor adjustments needed",
    "issues": ["Slight forward lean in shoulders", "Minor imbalance between left and right sides"],
    "recommendations": ["Try standing taller when walking", "Simple stretches for shoulders and chest"]
  },
  "recommendedFocusAreas": ["Focus on compound exercises like squats and pushups", "Add some cardio for overall fitness", "Include regular stretching"],
  "recommendations": [
    "Try full-body workouts 3 times weekly",
    "Include plenty of protein in your diet"
  ]
}

Important: This is NOT medical advice. This is just an AI estimation to help with fitness planning.
`
    });
    
    this.registerTemplate({
      id: 'progress-analysis',
      version: 1,
      template: `
Analyze the following user's fitness progress data:
- Weeks active: {{weeksActive}}
- Starting weight: {{startingWeight}}
- Current weight: {{currentWeight}}
- Goal weight: {{goalWeight}}
- Workout completion rate: {{workoutCompletionRate}}%
- Average workout duration: {{avgWorkoutDuration}} minutes
- Strength progression: {{strengthProgress}}
- Fitness goal: {{fitnessGoal}}

Provide insightful analysis of their progress and actionable recommendations.

Format the response as JSON with the following structure:
{
  "progressSummary": "Overall assessment of progress...",
  "achievements": [
    "Achievement 1",
    "Achievement 2"
  ],
  "areas": {
    "strengths": ["Strength 1", "Strength 2"],
    "improvements": ["Area 1", "Area 2"]
  },
  "recommendations": [
    {
      "area": "Workout",
      "suggestion": "Specific actionable suggestion",
      "reasoning": "Why this is recommended"
    },
    {
      "area": "Nutrition",
      "suggestion": "Specific actionable suggestion",
      "reasoning": "Why this is recommended"
    }
  ],
  "projections": {
    "timeToGoal": "Estimated time to reach goal",
    "nextMilestone": "Description of next expected milestone"
  }
}
`
    });
    
    this.registerTemplate({
      id: 'motivational-quote',
      version: 1,
      template: `
Generate an inspirational fitness quote for a user with the following context:
- Fitness goal: {{fitnessGoal}}
- Weeks active: {{weeksActive}}
- Recent milestone: {{recentMilestone}}
- Current mood: {{mood}}

The quote should be motivational, positive, and specific to their situation.
Format the response as JSON: { "quote": "The quote text", "author": "Author name" }
`
    });
    
    this.registerTemplate({
      id: 'fitness-tip',
      version: 1,
      template: `
Generate a personalized fitness tip for a user with the following profile:
- Fitness level: {{fitnessLevel}}
- Fitness goal: {{fitnessGoal}}
- Workout focus: {{workoutFocus}}
- Recent challenges: {{recentChallenges}}

Provide a specific, actionable tip that is grounded in exercise science.
Format the response as JSON: { "tip": "The tip text", "category": "Category like Nutrition/Recovery/Exercise Form" }
`
    });
  }

  /**
   * Register a new template or update an existing one
   */
  registerTemplate(template: PromptTemplate): void {
    this.templates[`${template.id}-v${template.version}`] = template;
  }

  /**
   * Get a complete prompt with parameters filled in
   */
  getPrompt(id: string, version: number, parameters: Record<string, any>): string {
    const templateKey = `${id}-v${version}`;
    const template = this.templates[templateKey];
    
    if (!template) {
      throw new Error(`Prompt template ${templateKey} not found`);
    }
    
    // Replace all parameters in the template
    let promptText = template.template;
    for (const [key, value] of Object.entries(parameters)) {
      const placeholder = new RegExp(`{{${key}}}`, 'g');
      promptText = promptText.replace(placeholder, String(value || ''));
    }
    
    // Check for any unreplaced parameters
    const unreplacedParams = promptText.match(/{{([^}]+)}}/g);
    if (unreplacedParams) {
      console.warn(`Warning: Unreplaced parameters in prompt: ${unreplacedParams.join(', ')}`);
      
      // Replace any remaining parameters with empty strings to avoid template errors
      unreplacedParams.forEach(param => {
        promptText = promptText.replace(param, '');
      });
    }
    
    return promptText;
  }
}

// Export singleton instance
export const promptManager = new PromptManager();
