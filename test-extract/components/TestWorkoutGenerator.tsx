import React, { useState } from 'react';
import { View, Text, Button, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import gemini from '../lib/gemini';
import { UserFitnessPreferences } from '../services/ai/workoutGenerator';

/**
 * TestWorkoutGenerator Component
 * 
 * A simple component to test the workout plan generation functionality
 * with the integrated StructuredWorkoutGenerator.
 */
export default function TestWorkoutGenerator() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workoutPlan, setWorkoutPlan] = useState(null);

  // Sample user preferences for testing
  const testPreferences: UserFitnessPreferences = {
    fitnessLevel: 'intermediate',
    exerciseFrequency: 4,
    timePerSession: 60,
    focusAreas: ['Upper Body', 'Lower Body', 'Core'],
    availableEquipment: ['Dumbbells', 'Resistance Bands', 'Pull-up Bar'],
    workoutLocation: 'home',
    exercisesToAvoid: 'None',
    gender: 'Male',
    age: 30,
    weight: 80,
    height: 180
  };

  // Function to generate a workout plan using the new system
  const generateTestWorkout = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('Generating workout plan with preferences:', JSON.stringify(testPreferences));
      const plan = await gemini.generateWorkoutPlan(testPreferences);
      setWorkoutPlan(plan);
      console.log('Workout plan generated successfully, structure:', 
        JSON.stringify({
          weeklyScheduleDays: plan.weeklySchedule?.length || 0,
          hasWarmUp: Array.isArray(plan.warmUp) && plan.warmUp.length > 0,
          hasCoolDown: Array.isArray(plan.coolDown) && plan.coolDown.length > 0,
          hasProgressionPlan: !!plan.progressionPlan
        })
      );
    } catch (err) {
      console.error('Error generating workout plan:', err);
      setError(err.message || 'Failed to generate workout plan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Workout Generator Test</Text>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Test Preferences</Text>
        <Text>Fitness Level: {testPreferences.fitnessLevel}</Text>
        <Text>Frequency: {testPreferences.exerciseFrequency} days/week</Text>
        <Text>Session Time: {testPreferences.timePerSession} minutes</Text>
        <Text>Focus Areas: {testPreferences.focusAreas.join(', ')}</Text>
        <Text>Equipment: {testPreferences.availableEquipment.join(', ')}</Text>
      </View>
      
      <View style={styles.buttonContainer}>
        <Button 
          title="Generate Workout Plan" 
          onPress={generateTestWorkout} 
          disabled={loading}
        />
      </View>
      
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0000ff" />
          <Text style={styles.loadingText}>Generating workout plan...</Text>
        </View>
      )}
      
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error: {error}</Text>
        </View>
      )}
      
      {workoutPlan && (
        <View style={styles.resultContainer}>
          <Text style={styles.sectionTitle}>Generated Workout Plan:</Text>
          
          {workoutPlan.weeklySchedule && workoutPlan.weeklySchedule.length > 0 ? (
            workoutPlan.weeklySchedule.map((day, index) => (
              <View key={index} style={styles.dayContainer}>
                <Text style={styles.dayTitle}>{day.day} - {day.focus}</Text>
                {day.exercises && day.exercises.length > 0 ? (
                  day.exercises.map((exercise, i) => (
                    <View key={i} style={styles.exerciseContainer}>
                      <Text style={styles.exerciseName}>{exercise.name}</Text>
                      <Text style={styles.exerciseDetail}>
                        {exercise.sets} sets × {exercise.reps} reps 
                        ({exercise.restSeconds}s rest)
                      </Text>
                      {exercise.notes && (
                        <Text style={styles.exerciseNotes}>{exercise.notes}</Text>
                      )}
                    </View>
                  ))
                ) : (
                  <Text style={styles.errorText}>No exercises found for this day</Text>
                )}
              </View>
            ))
          ) : (
            <Text style={styles.errorText}>No weekly schedule found</Text>
          )}
          
          <Text style={styles.sectionTitle}>Warm-up:</Text>
          {workoutPlan.warmUp && workoutPlan.warmUp.length > 0 ? (
            workoutPlan.warmUp.map((item, index) => (
              <Text key={index} style={styles.listItem}>• {item}</Text>
            ))
          ) : (
            <Text style={styles.errorText}>No warm-up routine found</Text>
          )}
          
          <Text style={styles.sectionTitle}>Cool-down:</Text>
          {workoutPlan.coolDown && workoutPlan.coolDown.length > 0 ? (
            workoutPlan.coolDown.map((item, index) => (
              <Text key={index} style={styles.listItem}>• {item}</Text>
            ))
          ) : (
            <Text style={styles.errorText}>No cool-down routine found</Text>
          )}
          
          <Text style={styles.sectionTitle}>Progression Plan:</Text>
          {workoutPlan.progressionPlan ? (
            <>
              <Text style={styles.listItem}>• Week 2: {workoutPlan.progressionPlan.week2}</Text>
              <Text style={styles.listItem}>• Week 3: {workoutPlan.progressionPlan.week3}</Text>
              <Text style={styles.listItem}>• Week 4: {workoutPlan.progressionPlan.week4}</Text>
            </>
          ) : (
            <Text style={styles.errorText}>No progression plan found</Text>
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 15,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingBottom: 5,
  },
  buttonContainer: {
    marginBottom: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 10,
    borderRadius: 5,
    marginBottom: 20,
  },
  errorText: {
    color: '#c62828',
  },
  resultContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  dayContainer: {
    marginBottom: 15,
    backgroundColor: '#f9f9f9',
    padding: 10,
    borderRadius: 5,
  },
  dayTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1976d2',
  },
  exerciseContainer: {
    marginLeft: 10,
    marginBottom: 8,
  },
  exerciseName: {
    fontSize: 15,
    fontWeight: '500',
  },
  exerciseDetail: {
    fontSize: 14,
    color: '#616161',
  },
  exerciseNotes: {
    fontSize: 13,
    fontStyle: 'italic',
    color: '#757575',
  },
  listItem: {
    fontSize: 14,
    marginBottom: 5,
    marginLeft: 10,
  },
});
