import { WorkoutSession, NutritionDay, BodyMetrics, UserGoals } from './dataManager';

export interface WorkoutAnalysis {
  totalWorkouts: number;
  completedWorkouts: number;
  completionRate: number; // percentage
  averageDuration: number; // in minutes
  weeklyDistribution: { [key: string]: number }; // day of week -> count
  muscleGroupDistribution: { [key: string]: number }; // muscle group -> count
}

export interface NutritionAnalysis {
  averageCalories: number;
  averageProtein: number;
  averageCarbs: number;
  averageFat: number;
  calorieAdherence: number; // percentage vs target
  macroAdherence: number; // percentage vs target
  averageWaterIntake: number;
}

export interface WeightAnalysis {
  startWeight: number;
  currentWeight: number;
  totalChange: number;
  weeklyChangeRate: number; // kg per week
  targetDifference: number; // difference from target
  estimatedTimeToGoal: number; // in weeks
}

export interface MeasurementAnalysis {
  [key: string]: {
    initial: number | null;
    current: number | null;
    change: number | null;
    percentChange: number | null;
  };
}

/**
 * ProgressCalculator utility to analyze fitness tracking data and generate insights
 */
class ProgressCalculator {
  /**
   * Analyze workout data to generate statistics
   */
  analyzeWorkouts(workouts: WorkoutSession[]): WorkoutAnalysis {
    if (!workouts.length) {
      return {
        totalWorkouts: 0,
        completedWorkouts: 0,
        completionRate: 0,
        averageDuration: 0,
        weeklyDistribution: {},
        muscleGroupDistribution: {},
      };
    }
    
    // Sort workouts by date
    const sortedWorkouts = [...workouts].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    // Calculate completion metrics
    const completedWorkouts = sortedWorkouts.filter(w => w.completed).length;
    const completionRate = (completedWorkouts / sortedWorkouts.length) * 100;
    
    // Calculate average duration (only for completed workouts)
    const totalDuration = sortedWorkouts
      .filter(w => w.completed)
      .reduce((sum, workout) => sum + workout.duration, 0);
    const averageDuration = completedWorkouts > 0 ? totalDuration / completedWorkouts : 0;
    
    // Analyze weekly distribution
    const weeklyDistribution: { [key: string]: number } = {};
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    sortedWorkouts.forEach(workout => {
      const day = days[new Date(workout.date).getDay()];
      weeklyDistribution[day] = (weeklyDistribution[day] || 0) + 1;
    });
    
    // Analyze muscle group distribution
    const muscleGroupDistribution: { [key: string]: number } = {};
    sortedWorkouts.forEach(workout => {
      workout.exercises.forEach(exercise => {
        const muscleGroup = exercise.targetMuscleGroup;
        muscleGroupDistribution[muscleGroup] = (muscleGroupDistribution[muscleGroup] || 0) + 1;
      });
    });
    
    return {
      totalWorkouts: sortedWorkouts.length,
      completedWorkouts,
      completionRate,
      averageDuration,
      weeklyDistribution,
      muscleGroupDistribution,
    };
  }
  
  /**
   * Analyze nutrition data to generate insights
   */
  analyzeNutrition(nutritionDays: NutritionDay[], goals?: UserGoals): NutritionAnalysis {
    if (!nutritionDays.length) {
      return {
        averageCalories: 0,
        averageProtein: 0,
        averageCarbs: 0,
        averageFat: 0,
        calorieAdherence: 0,
        macroAdherence: 0,
        averageWaterIntake: 0,
      };
    }
    
    // Sort nutrition days by date
    const sortedDays = [...nutritionDays].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    // Calculate averages
    const totalCalories = sortedDays.reduce((sum, day) => sum + day.totalCalories, 0);
    const totalProtein = sortedDays.reduce((sum, day) => sum + day.totalProtein, 0);
    const totalCarbs = sortedDays.reduce((sum, day) => sum + day.totalCarbs, 0);
    const totalFat = sortedDays.reduce((sum, day) => sum + day.totalFat, 0);
    const totalWater = sortedDays.reduce((sum, day) => sum + day.waterIntake, 0);
    
    const averageCalories = totalCalories / sortedDays.length;
    const averageProtein = totalProtein / sortedDays.length;
    const averageCarbs = totalCarbs / sortedDays.length;
    const averageFat = totalFat / sortedDays.length;
    const averageWaterIntake = totalWater / sortedDays.length;
    
    // Calculate adherence if goals are available
    let calorieAdherence = 0;
    let macroAdherence = 0;
    
    if (goals && goals.targetCaloriesPerDay) {
      const calorieDeviation = sortedDays.reduce(
        (sum, day) => sum + Math.abs(day.totalCalories - goals.targetCaloriesPerDay!),
        0
      );
      const averageDeviation = calorieDeviation / sortedDays.length;
      calorieAdherence = 100 - (averageDeviation / goals.targetCaloriesPerDay) * 100;
      
      // Calculate macro adherence if targets are available
      if (goals.targetProtein && goals.targetCarbs && goals.targetFat) {
        const proteinAdherence = 100 - (Math.abs(averageProtein - goals.targetProtein) / goals.targetProtein) * 100;
        const carbsAdherence = 100 - (Math.abs(averageCarbs - goals.targetCarbs) / goals.targetCarbs) * 100;
        const fatAdherence = 100 - (Math.abs(averageFat - goals.targetFat) / goals.targetFat) * 100;
        macroAdherence = (proteinAdherence + carbsAdherence + fatAdherence) / 3;
      }
    }
    
    return {
      averageCalories,
      averageProtein,
      averageCarbs,
      averageFat,
      calorieAdherence,
      macroAdherence,
      averageWaterIntake,
    };
  }

  /**
   * Analyze weight data to track progress
   */
  analyzeWeight(metrics: BodyMetrics[], goals?: UserGoals): WeightAnalysis {
    if (!metrics.length) {
      return {
        startWeight: 0,
        currentWeight: 0,
        totalChange: 0,
        weeklyChangeRate: 0,
        targetDifference: 0,
        estimatedTimeToGoal: 0,
      };
    }
    
    // Sort metrics by date
    const sortedMetrics = [...metrics].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    const startWeight = sortedMetrics[0].weight;
    const currentWeight = sortedMetrics[sortedMetrics.length - 1].weight;
    const totalChange = currentWeight - startWeight;
    
    // Calculate weekly change rate
    const startDate = new Date(sortedMetrics[0].date).getTime();
    const endDate = new Date(sortedMetrics[sortedMetrics.length - 1].date).getTime();
    const weeksDifference = (endDate - startDate) / (7 * 24 * 60 * 60 * 1000);
    const weeklyChangeRate = weeksDifference > 0 ? totalChange / weeksDifference : 0;
    
    // Calculate target-related metrics
    let targetDifference = 0;
    let estimatedTimeToGoal = 0;
    
    if (goals && goals.targetWeight) {
      targetDifference = currentWeight - goals.targetWeight;
      estimatedTimeToGoal = weeklyChangeRate !== 0 ? Math.abs(targetDifference / weeklyChangeRate) : 0;
    }
    
    return {
      startWeight,
      currentWeight,
      totalChange,
      weeklyChangeRate,
      targetDifference,
      estimatedTimeToGoal,
    };
  }

  /**
   * Analyze body measurements data to track changes
   */
  analyzeMeasurements(metrics: BodyMetrics[]): MeasurementAnalysis {
    if (!metrics.length) {
      return {};
    }
    
    // Sort metrics by date
    const sortedMetrics = [...metrics].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    const firstMetrics = sortedMetrics[0];
    const lastMetrics = sortedMetrics[sortedMetrics.length - 1];
    
    const result: MeasurementAnalysis = {};
    
    // Function to calculate changes for a measurement
    const calculateChange = (key: string, initial: number | undefined, current: number | undefined) => {
      if (initial === undefined || current === undefined) {
        return {
          initial: null,
          current: null,
          change: null,
          percentChange: null,
        };
      }
      
      const change = current - initial;
      const percentChange = initial !== 0 ? (change / initial) * 100 : 0;
      
      return {
        initial,
        current,
        change,
        percentChange,
      };
    };
    
    // Calculate for each measurement type if available
    const measurementKeys = [
      'chest', 'waist', 'hips',
      'leftArm', 'rightArm',
      'leftThigh', 'rightThigh',
      'leftCalf', 'rightCalf',
    ];
    
    measurementKeys.forEach(key => {
      if (firstMetrics.measurements && lastMetrics.measurements) {
        result[key] = calculateChange(
          key,
          firstMetrics.measurements[key as keyof typeof firstMetrics.measurements],
          lastMetrics.measurements[key as keyof typeof lastMetrics.measurements]
        );
      }
    });
    
    return result;
  }
}

export const progressCalculator = new ProgressCalculator();
