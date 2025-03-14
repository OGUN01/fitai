import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Stack } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { enhancedWorkoutGenerator, enhancedMealPlanGenerator } from '../services/ai';
import { UserFitnessPreferences, WorkoutPlan, FallbackWorkoutPlan } from '../services/ai';
import { UserDietPreferences, MealPlan, FallbackMealPlan } from '../services/ai';
import { 
  TestFailureMode, 
  setWorkoutTestMode, 
  setMealTestMode, 
  testWorkoutGeneration, 
  testMealGeneration 
} from '../services/ai/testUtils';

// Mock preferences for testing
const mockFitnessPreferences: UserFitnessPreferences = {
  fitnessLevel: 'intermediate',
  workoutLocation: 'home',
  availableEquipment: ['dumbbells', 'resistance bands'],
  exerciseFrequency: 3,
  timePerSession: 45,
  focusAreas: ['upper-body', 'core'],
  injuries: 'None'
};

// Mock diet preferences for testing
const mockDietPreferences: UserDietPreferences = {
  dietType: 'vegetarian',
  dietPlanPreference: 'balanced',
  allergies: ['nuts'],
  mealFrequency: 3,
  preferredMealTimes: ['8:00', '13:00', '19:00'],
  countryRegion: 'Mediterranean',
  waterIntakeGoal: 2.5,
  fitnessGoal: 'improved fitness'
};

// Available test scenarios
const testScenarios = [
  { label: 'Normal Operation', mode: TestFailureMode.NORMAL },
  { label: 'Primary Generation Fails', mode: TestFailureMode.FIRST_ATTEMPT },
  { label: 'All Generation Attempts Fail', mode: TestFailureMode.ALL_ATTEMPTS },
  { label: 'JSON Parsing Error', mode: TestFailureMode.PARSING_ERROR },
  { label: 'Validation Error', mode: TestFailureMode.VALIDATION_ERROR },
  { label: 'Network Error', mode: TestFailureMode.NETWORK_ERROR },
];

export default function TestFallbacksScreen() {
  const [workoutResult, setWorkoutResult] = useState<any>(null);
  const [mealResult, setMealResult] = useState<any>(null);
  const [isLoadingWorkout, setIsLoadingWorkout] = useState(false);
  const [isLoadingMeal, setIsLoadingMeal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeWorkoutMode, setActiveWorkoutMode] = useState(TestFailureMode.NORMAL);
  const [activeMealMode, setActiveMealMode] = useState(TestFailureMode.NORMAL);
  
  // Track if component is mounted to avoid state updates after unmount
  const isMounted = useRef(true);
  const [isFocused, setIsFocused] = useState(true);
  
  // Setup and cleanup for component lifecycle
  useEffect(() => {
    // Set up component
    isMounted.current = true;
    
    // Clean up on unmount
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  // Track screen focus state
  useFocusEffect(
    React.useCallback(() => {
      setIsFocused(true);
      return () => {
        setIsFocused(false);
      };
    }, [])
  );
  
  // When screen loses focus, cancel any pending operations
  useEffect(() => {
    if (!isFocused) {
      // If screen is not focused, reset loading states
      if (isLoadingWorkout || isLoadingMeal) {
        console.log("Screen unfocused, cancelling pending operations");
        setIsLoadingWorkout(false);
        setIsLoadingMeal(false);
      }
    }
  }, [isFocused, isLoadingWorkout, isLoadingMeal]);
  
  // Test workout generation with selected failure mode
  const testWorkout = async () => {
    if (!isMounted.current) return;
    
    setIsLoadingWorkout(true);
    setError(null);
    
    // Use a timeout to ensure we don't block the UI
    setTimeout(async () => {
      try {
        if (!isMounted.current) return;
        
        // Set the test mode
        setWorkoutTestMode(activeWorkoutMode);
        console.log(`Testing workout generation with mode: ${activeWorkoutMode}`);
        
        // Run the test
        const result = await testWorkoutGeneration(mockFitnessPreferences);
        console.log('Workout generation result:', result);
        
        if (isMounted.current) {
          setWorkoutResult({
            plan: result,
            isFallback: result && 'isFallback' in result,
            message: result && 'isFallback' in result ? result.message : 'Successfully generated workout plan',
            testMode: activeWorkoutMode
          });
        }
      } catch (e) {
        console.error('Error during workout generation:', e);
        
        if (isMounted.current) {
          setError(`Workout generation error: ${e.message}`);
          setWorkoutResult({
            plan: null,
            isFallback: true,
            message: `Error: ${e.message}`,
            testMode: activeWorkoutMode
          });
        }
      } finally {
        if (isMounted.current) {
          setIsLoadingWorkout(false);
        }
      }
    }, 100); // Small delay to let UI update first
  };
  
  // Test meal generation with selected failure mode
  const testMeal = async () => {
    if (!isMounted.current) return;
    
    setIsLoadingMeal(true);
    setError(null);
    
    // Use a timeout to ensure we don't block the UI
    setTimeout(async () => {
      try {
        if (!isMounted.current) return;
        
        // Set the test mode
        setMealTestMode(activeMealMode);
        console.log(`Testing meal generation with mode: ${activeMealMode}`);
        
        // Run the test
        const result = await testMealGeneration(mockDietPreferences);
        console.log('Meal generation result:', result);
        
        if (isMounted.current) {
          setMealResult({
            plan: result,
            isFallback: result && 'isFallback' in result,
            message: result && 'isFallback' in result ? result.message : 'Successfully generated meal plan',
            testMode: activeMealMode
          });
        }
      } catch (e) {
        console.error('Error during meal generation:', e);
        
        if (isMounted.current) {
          setError(`Meal generation error: ${e.message}`);
          setMealResult({
            plan: null,
            isFallback: true,
            message: `Error: ${e.message}`,
            testMode: activeMealMode
          });
        }
      } finally {
        if (isMounted.current) {
          setIsLoadingMeal(false);
        }
      }
    }, 100); // Small delay to let UI update first
  };
  
  // Reset all results
  const resetResults = () => {
    setWorkoutResult(null);
    setMealResult(null);
    setError(null);
  };
  
  // Defensive rendering of workout details
  const renderWorkoutDetails = () => {
    try {
      if (!workoutResult?.plan?.weeklySchedule) {
        return <Text>No workout schedule available</Text>;
      }
      
      const totalExercises = workoutResult.plan.weeklySchedule.reduce(
        (total, day) => total + (day.exercises?.length || 0), 
        0
      );
      
      return (
        <View style={styles.planDetails}>
          <Text style={styles.detailLabel}>Workout Days: </Text>
          <Text>{workoutResult.plan.weeklySchedule.length}</Text>
          
          <Text style={styles.detailLabel}>Exercises: </Text>
          <Text>{totalExercises}</Text>
          
          <Text style={styles.detailLabel}>Sample Day: </Text>
          {workoutResult.plan.weeklySchedule.length > 0 && (
            <Text>
              {workoutResult.plan.weeklySchedule[0].day} - {workoutResult.plan.weeklySchedule[0].focus}
            </Text>
          )}
        </View>
      );
    } catch (error) {
      console.error("Error rendering workout details:", error);
      return <Text>Error displaying workout details</Text>;
    }
  };
  
  // Defensive rendering of meal details
  const renderMealDetails = () => {
    try {
      if (!mealResult?.plan?.dailyMealPlan) {
        return <Text>No meal plan available</Text>;
      }
      
      return (
        <View style={styles.planDetails}>
          <Text style={styles.detailLabel}>Days in Plan: </Text>
          <Text>{mealResult.plan.dailyMealPlan?.length || 0}</Text>
          
          <Text style={styles.detailLabel}>Meals per Day: </Text>
          {mealResult.plan.dailyMealPlan?.length > 0 && (
            <Text>{mealResult.plan.dailyMealPlan[0].meals?.length || 0}</Text>
          )}
          
          <Text style={styles.detailLabel}>Sample Meal: </Text>
          {mealResult.plan.dailyMealPlan?.length > 0 && 
           mealResult.plan.dailyMealPlan[0].meals?.length > 0 && (
            <Text>
              {mealResult.plan.dailyMealPlan[0].meals[0].meal} - {mealResult.plan.dailyMealPlan[0].meals[0].recipe?.name || 'N/A'}
            </Text>
          )}
        </View>
      );
    } catch (error) {
      console.error("Error rendering meal details:", error);
      return <Text>Error displaying meal details</Text>;
    }
  };
  
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Test Fallback System' }} />
      
      <ScrollView style={styles.scrollView}>
        <Text style={styles.header}>Fallback System Testing</Text>
        
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Workout Generation Tests</Text>
          
          <Text style={styles.sectionSubheader}>Select Test Scenario:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scenarioScroll}>
            {testScenarios.map((scenario, index) => (
              <TouchableOpacity
                key={`workout-${index}`}
                style={[
                  styles.scenarioButton,
                  activeWorkoutMode === scenario.mode && styles.activeScenarioButton
                ]}
                onPress={() => setActiveWorkoutMode(scenario.mode)}
              >
                <Text 
                  style={[
                    styles.scenarioButtonText,
                    activeWorkoutMode === scenario.mode && styles.activeScenarioButtonText
                  ]}
                >
                  {scenario.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          
          <TouchableOpacity 
            style={styles.runButton} 
            onPress={testWorkout}
            disabled={isLoadingWorkout}
          >
            <Text style={styles.buttonText}>Run Workout Test</Text>
          </TouchableOpacity>
          
          {isLoadingWorkout && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#0066cc" />
              <Text style={styles.loadingText}>Generating workout plan...</Text>
            </View>
          )}
          
          {workoutResult && (
            <View style={styles.resultContainer}>
              <Text style={styles.resultHeader}>
                {workoutResult.isFallback ? '⚠️ Fallback Used' : '✅ Primary Generation'}
              </Text>
              <Text style={styles.testModeText}>
                Test Mode: {workoutResult.testMode}
              </Text>
              <Text style={styles.resultMessage}>{workoutResult.message}</Text>
              
              {workoutResult.plan && renderWorkoutDetails()}
            </View>
          )}
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Meal Generation Tests</Text>
          
          <Text style={styles.sectionSubheader}>Select Test Scenario:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scenarioScroll}>
            {testScenarios.map((scenario, index) => (
              <TouchableOpacity
                key={`meal-${index}`}
                style={[
                  styles.scenarioButton,
                  activeMealMode === scenario.mode && styles.activeScenarioButton
                ]}
                onPress={() => setActiveMealMode(scenario.mode)}
              >
                <Text 
                  style={[
                    styles.scenarioButtonText,
                    activeMealMode === scenario.mode && styles.activeScenarioButtonText
                  ]}
                >
                  {scenario.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          
          <TouchableOpacity 
            style={styles.runButton}
            onPress={testMeal}
            disabled={isLoadingMeal}
          >
            <Text style={styles.buttonText}>Run Meal Test</Text>
          </TouchableOpacity>
          
          {isLoadingMeal && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#0066cc" />
              <Text style={styles.loadingText}>Generating meal plan...</Text>
            </View>
          )}
          
          {mealResult && (
            <View style={styles.resultContainer}>
              <Text style={styles.resultHeader}>
                {mealResult.isFallback ? '⚠️ Fallback Used' : '✅ Primary Generation'}
              </Text>
              <Text style={styles.testModeText}>
                Test Mode: {mealResult.testMode}
              </Text>
              <Text style={styles.resultMessage}>{mealResult.message}</Text>
              
              {mealResult.plan && renderMealDetails()}
            </View>
          )}
        </View>
        
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>Error:</Text>
            <Text style={styles.errorMessage}>{error}</Text>
          </View>
        )}
        
        <TouchableOpacity 
          style={[styles.button, styles.resetButton]} 
          onPress={resetResults}
        >
          <Text style={styles.buttonText}>Reset Results</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    padding: 16,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  sectionSubheader: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#555',
  },
  scenarioScroll: {
    marginBottom: 16,
  },
  scenarioButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  activeScenarioButton: {
    backgroundColor: '#0066cc',
    borderColor: '#0066cc',
  },
  scenarioButtonText: {
    fontSize: 14,
    color: '#555',
  },
  activeScenarioButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  runButton: {
    backgroundColor: '#0066cc',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#0066cc',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    flex: 1,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  warningButton: {
    backgroundColor: '#ff9500',
  },
  resetButton: {
    backgroundColor: '#555',
    marginTop: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  loadingText: {
    marginTop: 8,
    color: '#555',
  },
  resultContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  resultHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  testModeText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  resultMessage: {
    marginBottom: 12,
    color: '#444',
  },
  planDetails: {
    marginTop: 8,
  },
  detailLabel: {
    fontWeight: 'bold',
    marginTop: 8,
  },
  errorContainer: {
    padding: 16,
    backgroundColor: '#ffeeee',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ffcccc',
    marginBottom: 20,
  },
  errorTitle: {
    color: '#cc0000',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  errorMessage: {
    color: '#cc0000',
  },
}); 