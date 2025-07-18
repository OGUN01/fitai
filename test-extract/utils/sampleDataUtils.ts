import { dataManager, WorkoutSession, NutritionDay, BodyMetrics, UserGoals } from './dataManager';

/**
 * Utilities for generating and adding sample data to test the fitness tracking features
 */
export class SampleDataUtils {
  /**
   * Generate and save sample workout data for testing
   */
  static async generateSampleWorkouts(numWeeks: number = 6): Promise<void> {
    const workouts: WorkoutSession[] = [];
    const today = new Date();
    let currentDate = new Date();
    currentDate.setDate(today.getDate() - (numWeeks * 7)); // Start numWeeks ago
    
    // We'll create ~3-5 workouts per week
    while (currentDate <= today) {
      // 70% chance of having a workout on any given day
      if (Math.random() < 0.4) {
        const workoutId = `workout-${currentDate.toISOString()}`;
        const isCompleted = Math.random() < 0.85; // 85% chance of completing a workout
        
        const workout: WorkoutSession = {
          id: workoutId,
          date: currentDate.toISOString(),
          completed: isCompleted,
          duration: Math.floor(Math.random() * 30) + 30, // 30-60 minutes
          exercises: [
            {
              name: 'Bench Press',
              targetMuscleGroup: 'Chest',
              sets: [
                { reps: 10, weight: 60, completed: isCompleted },
                { reps: 8, weight: 70, completed: isCompleted },
                { reps: 6, weight: 75, completed: isCompleted },
              ]
            },
            {
              name: 'Squats',
              targetMuscleGroup: 'Legs',
              sets: [
                { reps: 12, weight: 80, completed: isCompleted },
                { reps: 10, weight: 90, completed: isCompleted },
                { reps: 8, weight: 100, completed: isCompleted },
              ]
            },
            {
              name: 'Pull-ups',
              targetMuscleGroup: 'Back',
              sets: [
                { reps: 8, weight: 0, completed: isCompleted },
                { reps: 8, weight: 0, completed: isCompleted },
                { reps: 6, weight: 0, completed: isCompleted },
              ]
            },
          ],
          notes: isCompleted ? 'Felt great today!' : 'Missed workout'
        };
        
        workouts.push(workout);
      }
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Save each workout
    for (const workout of workouts) {
      await dataManager.saveWorkout(workout);
    }
    
    console.log(`Generated ${workouts.length} sample workouts over ${numWeeks} weeks`);
  }
  
  /**
   * Generate and save sample nutrition data for testing
   */
  static async generateSampleNutrition(numWeeks: number = 6): Promise<void> {
    const nutritionDays: NutritionDay[] = [];
    const today = new Date();
    let currentDate = new Date();
    currentDate.setDate(today.getDate() - (numWeeks * 7)); // Start numWeeks ago
    
    // Create nutrition data for each day
    while (currentDate <= today) {
      const dayId = `nutrition-${currentDate.toISOString()}`;
      
      // Target calorie range with some variation
      const targetCalories = 2000;
      const actualCalories = targetCalories + (Math.random() * 400 - 200); // +/- 200 calories
      
      // Create meals for the day
      const breakfast = {
        id: `breakfast-${currentDate.toISOString()}`,
        name: 'Breakfast',
        mealType: 'breakfast' as const,
        time: this.setTime(new Date(currentDate), 8, 0).toISOString(),
        foods: [
          {
            name: 'Oatmeal',
            serving: 1,
            servingUnit: 'cup',
            calories: 150,
            protein: 6,
            carbs: 25,
            fat: 2.5
          },
          {
            name: 'Banana',
            serving: 1,
            servingUnit: 'medium',
            calories: 105,
            protein: 1.3,
            carbs: 27,
            fat: 0.4
          }
        ],
        totalCalories: 255
      };
      
      const lunch = {
        id: `lunch-${currentDate.toISOString()}`,
        name: 'Lunch',
        mealType: 'lunch' as const,
        time: this.setTime(new Date(currentDate), 13, 0).toISOString(),
        foods: [
          {
            name: 'Chicken Breast',
            serving: 150,
            servingUnit: 'g',
            calories: 240,
            protein: 45,
            carbs: 0,
            fat: 5
          },
          {
            name: 'Brown Rice',
            serving: 1,
            servingUnit: 'cup',
            calories: 215,
            protein: 5,
            carbs: 45,
            fat: 1.8
          },
          {
            name: 'Broccoli',
            serving: 1,
            servingUnit: 'cup',
            calories: 55,
            protein: 4,
            carbs: 11,
            fat: 0.5
          }
        ],
        totalCalories: 510
      };
      
      const dinner = {
        id: `dinner-${currentDate.toISOString()}`,
        name: 'Dinner',
        mealType: 'dinner' as const,
        time: this.setTime(new Date(currentDate), 19, 0).toISOString(),
        foods: [
          {
            name: 'Salmon',
            serving: 150,
            servingUnit: 'g',
            calories: 280,
            protein: 39,
            carbs: 0,
            fat: 13
          },
          {
            name: 'Sweet Potato',
            serving: 1,
            servingUnit: 'medium',
            calories: 115,
            protein: 2,
            carbs: 27,
            fat: 0.1
          },
          {
            name: 'Green Beans',
            serving: 1,
            servingUnit: 'cup',
            calories: 44,
            protein: 2.4,
            carbs: 10,
            fat: 0.4
          }
        ],
        totalCalories: 439
      };
      
      const snack = {
        id: `snack-${currentDate.toISOString()}`,
        name: 'Snack',
        mealType: 'snack' as const,
        time: this.setTime(new Date(currentDate), 16, 0).toISOString(),
        foods: [
          {
            name: 'Greek Yogurt',
            serving: 1,
            servingUnit: 'cup',
            calories: 130,
            protein: 22,
            carbs: 9,
            fat: 0.5
          },
          {
            name: 'Blueberries',
            serving: 0.5,
            servingUnit: 'cup',
            calories: 42,
            protein: 0.5,
            carbs: 11,
            fat: 0.2
          }
        ],
        totalCalories: 172
      };
      
      // Occasionally skip a meal to create more realistic data
      const meals = [];
      meals.push(breakfast);
      meals.push(lunch);
      meals.push(dinner);
      if (Math.random() > 0.3) { // 70% chance of having a snack
        meals.push(snack);
      }
      
      // Calculate totals
      const totalProtein = meals.reduce((sum, meal) => 
        sum + meal.foods.reduce((mealSum, food) => mealSum + food.protein, 0), 0);
      
      const totalCarbs = meals.reduce((sum, meal) => 
        sum + meal.foods.reduce((mealSum, food) => mealSum + food.carbs, 0), 0);
      
      const totalFat = meals.reduce((sum, meal) => 
        sum + meal.foods.reduce((mealSum, food) => mealSum + food.fat, 0), 0);
      
      // Create the nutrition day entry
      const nutritionDay: NutritionDay = {
        id: dayId,
        date: currentDate.toISOString(),
        meals,
        totalCalories: Math.round(actualCalories),
        totalProtein: Math.round(totalProtein),
        totalCarbs: Math.round(totalCarbs),
        totalFat: Math.round(totalFat),
        waterIntake: Math.floor(Math.random() * 1000) + 1500, // 1500-2500ml
        adherenceRating: Math.floor(Math.random() * 5) + 5 // 5-10 rating
      };
      
      nutritionDays.push(nutritionDay);
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Save each nutrition day
    for (const day of nutritionDays) {
      await dataManager.saveNutritionDay(day);
    }
    
    console.log(`Generated ${nutritionDays.length} sample nutrition days over ${numWeeks} weeks`);
  }
  
  /**
   * Generate and save sample body metrics data for testing
   */
  static async generateSampleBodyMetrics(numWeeks: number = 6): Promise<void> {
    const metrics: BodyMetrics[] = [];
    const today = new Date();
    let currentDate = new Date();
    currentDate.setDate(today.getDate() - (numWeeks * 7)); // Start numWeeks ago
    
    // Generate a starting weight and goal
    const startWeight = 82; // kg
    const goalWeight = 75; // kg
    
    // We'll create measurements ~2 times per week
    while (currentDate <= today) {
      // 30% chance of taking measurements on any given day
      if (Math.random() < 0.3) {
        const metricId = `metric-${currentDate.toISOString()}`;
        
        // Calculate weight trend (generally decreasing)
        const daysPassed = Math.floor((currentDate.getTime() - (today.getTime() - numWeeks * 7 * 24 * 60 * 60 * 1000)) / (24 * 60 * 60 * 1000));
        const progressRatio = daysPassed / (numWeeks * 7);
        
        // Target weight loss of 3.3kg over the period with some variation
        const expectedWeightLoss = (startWeight - goalWeight) * progressRatio;
        const actualWeight = startWeight - expectedWeightLoss + (Math.random() * 1 - 0.5); // +/- 0.5kg variation
        
        // Create the metric
        const metric: BodyMetrics = {
          id: metricId,
          date: currentDate.toISOString(),
          weight: parseFloat(actualWeight.toFixed(1)),
          bodyFatPercentage: 20 - (progressRatio * 3) + (Math.random() * 2 - 1), // Starting at 20%, aiming for 17%
          measurements: {
            chest: 100 - (progressRatio * 1.2) + (Math.random() * 0.6 - 0.3),
            waist: 88 - (progressRatio * 3.5) + (Math.random() * 0.8 - 0.4),
            hips: 105 - (progressRatio * 2.1) + (Math.random() * 0.6 - 0.3),
            leftArm: 35 + (progressRatio * 0.5) + (Math.random() * 0.4 - 0.2),
            rightArm: 35.5 + (progressRatio * 0.5) + (Math.random() * 0.4 - 0.2),
            leftThigh: 60 - (progressRatio * 1.8) + (Math.random() * 0.6 - 0.3),
            rightThigh: 60.5 - (progressRatio * 1.8) + (Math.random() * 0.6 - 0.3),
            leftCalf: 38 - (progressRatio * 0.5) + (Math.random() * 0.4 - 0.2),
            rightCalf: 38.2 - (progressRatio * 0.5) + (Math.random() * 0.4 - 0.2),
          }
        };
        
        metrics.push(metric);
      }
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Save each metric
    for (const metric of metrics) {
      await dataManager.saveBodyMetrics(metric);
    }
    
    console.log(`Generated ${metrics.length} sample body metrics over ${numWeeks} weeks`);
  }
  
  /**
   * Save sample user goals
   */
  static async generateSampleUserGoals(): Promise<void> {
    const goals: UserGoals = {
      targetWeight: 75,
      targetBodyFat: 17,
      fitnessGoal: 'weight_loss',
      workoutsPerWeek: 4,
      targetCaloriesPerDay: 2000,
      targetProtein: 150,
      targetCarbs: 200,
      targetFat: 67,
      specificGoals: [
        'Lose 7kg in 3 months',
        'Run 5k under 25 minutes',
        'Complete 10 consecutive pull-ups'
      ]
    };
    
    await dataManager.saveUserGoals(goals);
    console.log('Generated sample user goals');
  }
  
  /**
   * Generate all sample data for testing
   */
  static async generateAllSampleData(numWeeks: number = 6): Promise<void> {
    await this.generateSampleUserGoals();
    await this.generateSampleWorkouts(numWeeks);
    await this.generateSampleNutrition(numWeeks);
    await this.generateSampleBodyMetrics(numWeeks);
    
    console.log('Completed generating all sample data');
  }
  
  /**
   * Helper to set time on a date object
   */
  private static setTime(date: Date, hours: number, minutes: number): Date {
    date.setHours(hours, minutes, 0, 0);
    return date;
  }
}
