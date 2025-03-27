/**
 * Test script for the StructuredWorkoutGenerator
 */
import { StructuredWorkoutGenerator } from '../services/ai/structuredWorkoutGenerator';

async function testWorkoutGenerator() {
  console.log('Testing Workout Generator...');
  
  const generator = new StructuredWorkoutGenerator();
  
  const preferences = {
    fitnessLevel: 'beginner',
    focusAreas: ['strength', 'cardio'],
    availableEquipment: ['dumbbells', 'bodyweight'],
    workoutLocation: 'home',
    daysPerWeek: 3,
    timePerSession: 30,
    workoutPreference: 'balanced',
    fitnessGoals: ['build strength', 'improve cardio'],
    healthConditions: []
  };
  
  try {
    console.log('Generating workout plan...');
    const workoutPlan = await generator.generateWorkoutPlanWithFallback(preferences);
    
    // Print a summary of the plan
    console.log('\nWorkout Plan Generated Successfully!');
    console.log(`Schedule: ${workoutPlan.weeklySchedule.length} days per week`);
    console.log(`Days: ${workoutPlan.weeklySchedule.map(day => day.day).join(', ')}`);
    
    // Print one sample day
    if (workoutPlan.weeklySchedule.length > 0) {
      const sampleDay = workoutPlan.weeklySchedule[0];
      console.log('\nSample Day:', sampleDay.day);
      console.log('Focus:', sampleDay.focus);
      console.log('Exercises:');
      sampleDay.exercises.forEach((ex, i) => {
        console.log(`  ${i+1}. ${ex.name}: ${ex.sets} sets x ${ex.reps} reps, Rest: ${ex.restSeconds}s`);
      });
    }
    
    console.log('\nWarm-up:', workoutPlan.warmUp.join(', '));
    console.log('Cool-down:', workoutPlan.coolDown.join(', '));
    console.log('\nProgression Plan:');
    console.log('Week 2:', workoutPlan.progressionPlan.week2);
    console.log('Week 3:', workoutPlan.progressionPlan.week3);
    console.log('Week 4:', workoutPlan.progressionPlan.week4);
    
  } catch (error) {
    console.error('Error generating workout plan:', error);
  }
}

// Run the test
testWorkoutGenerator();
