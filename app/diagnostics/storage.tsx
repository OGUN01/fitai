import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import diagnoseStorageState from '../../utils/debugStorage';
import persistenceAdapter from '../../utils/persistenceAdapter';
import StorageKeys from '../../utils/storageKeys';
import { Platform } from 'react-native';

export default function StorageDiagnosticsScreen() {
  const [diagnosisResults, setDiagnosisResults] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [testDataAdded, setTestDataAdded] = useState(false);
  
  // Run diagnostics on mount
  useEffect(() => {
    runDiagnostics();
  }, []);
  
  // Run diagnostic tests
  const runDiagnostics = async () => {
    setLoading(true);
    try {
      const results = await diagnoseStorageState();
      setDiagnosisResults(results);
      console.log('Diagnosis results:', results);
    } catch (error) {
      console.error('Diagnosis failed:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Add test data to verify storage
  const addTestData = async () => {
    setLoading(true);
    try {
      // Create sample workout data
      const workoutCompletion = {
        id: 'test-workout-' + Date.now(),
        user_id: 'local_user',
        workout_date: new Date().toISOString().split('T')[0],
        day_number: 1,
        workout_day_name: 'Monday',
        workout_plan_id: 'test-plan',
        completed_at: new Date().toISOString(),
        estimated_calories_burned: 150
      };
      
      // Create sample meal data
      const mealCompletion = {
        id: 'test-meal-' + Date.now(),
        user_id: 'local_user',
        meal_date: new Date().toISOString().split('T')[0],
        meal_type: 'breakfast',
        meal_plan_id: 'test-plan',
        completed_at: new Date().toISOString()
      };
      
      // Get existing data or start with empty arrays
      const existingWorkouts = await persistenceAdapter.getItem(StorageKeys.COMPLETED_WORKOUTS, []);
      const existingMeals = await persistenceAdapter.getItem(StorageKeys.MEALS, []);
      
      // Add new test items
      const updatedWorkouts = [...(existingWorkouts || []), workoutCompletion];
      const updatedMeals = [...(existingMeals || []), mealCompletion];
      
      // Save updated data
      await persistenceAdapter.setItem(StorageKeys.COMPLETED_WORKOUTS, updatedWorkouts);
      await persistenceAdapter.setItem(StorageKeys.MEALS, updatedMeals);
      
      // Run diagnostics again
      await runDiagnostics();
      setTestDataAdded(true);
    } catch (error) {
      console.error('Error adding test data:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Clear all test data
  const clearTestData = async () => {
    setLoading(true);
    try {
      await persistenceAdapter.setItem(StorageKeys.COMPLETED_WORKOUTS, []);
      await persistenceAdapter.setItem(StorageKeys.MEALS, []);
      await runDiagnostics();
      setTestDataAdded(false);
    } catch (error) {
      console.error('Error clearing test data:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Storage Diagnostics' }} />
      
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.title}>Storage Diagnostics</Text>
        <Text style={styles.subtitle}>
          Identifying why data is lost on page refresh
        </Text>
        
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.button, styles.primaryButton]} 
            onPress={runDiagnostics}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.buttonText}>Run Diagnostics</Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, testDataAdded ? styles.warningButton : styles.secondaryButton]} 
            onPress={testDataAdded ? clearTestData : addTestData}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {testDataAdded ? 'Clear Test Data' : 'Add Test Data'}
            </Text>
          </TouchableOpacity>
        </View>
        
        {diagnosisResults && (
          <View style={styles.resultsContainer}>
            <Text style={styles.sectionTitle}>Diagnosis Results</Text>
            
            <View style={styles.infoCard}>
              <Text style={styles.cardTitle}>Platform Info</Text>
              <Text style={styles.infoText}>Platform: {Platform.OS}</Text>
              <Text style={styles.infoText}>Browser: {diagnosisResults.browserType}</Text>
              <Text style={styles.infoText}>
                Persistence Status: {diagnosisResults.persistenceStatus}
              </Text>
            </View>
            
            <View style={styles.infoCard}>
              <Text style={styles.cardTitle}>Storage Keys</Text>
              <Text style={styles.infoText}>
                Found {diagnosisResults.storageKeys.length} keys in persistence adapter
              </Text>
              <View style={styles.codeBlock}>
                {diagnosisResults.storageKeys.slice(0, 5).map((key, index) => (
                  <Text key={index} style={styles.codeText}>
                    - {key}
                  </Text>
                ))}
                {diagnosisResults.storageKeys.length > 5 && (
                  <Text style={styles.codeText}>
                    ... and {diagnosisResults.storageKeys.length - 5} more
                  </Text>
                )}
              </View>
            </View>
            
            <View style={styles.infoCard}>
              <Text style={styles.cardTitle}>Memory Cache</Text>
              <Text style={styles.infoText}>
                Workouts: {diagnosisResults.memoryCache.workouts ? 
                  `${diagnosisResults.memoryCache.workouts.length} items` : 
                  'Not found'}
              </Text>
              <Text style={styles.infoText}>
                Meals: {diagnosisResults.memoryCache.meals ? 
                  `${diagnosisResults.memoryCache.meals.length} items` : 
                  'Not found'}
              </Text>
            </View>
            
            <View style={styles.infoCard}>
              <Text style={styles.cardTitle}>AsyncStorage</Text>
              <Text style={styles.infoText}>
                Workouts: {diagnosisResults.asyncStorage.workouts ? 
                  `${diagnosisResults.asyncStorage.workouts.length} items` : 
                  'Not found'}
              </Text>
              <Text style={styles.infoText}>
                Meals: {diagnosisResults.asyncStorage.meals ? 
                  `${diagnosisResults.asyncStorage.meals.length} items` : 
                  'Not found'}
              </Text>
            </View>
            
            {Platform.OS === 'web' && (
              <View style={styles.infoCard}>
                <Text style={styles.cardTitle}>LocalStorage</Text>
                <Text style={styles.infoText}>
                  Workouts: {diagnosisResults.localStorage.workouts ? 
                    `${diagnosisResults.localStorage.workouts.length} items` : 
                    'Not found'}
                </Text>
                <Text style={styles.infoText}>
                  Meals: {diagnosisResults.localStorage.meals ? 
                    `${diagnosisResults.localStorage.meals.length} items` : 
                    'Not found'}
                </Text>
              </View>
            )}
            
            <View style={styles.diagnosisCard}>
              <Text style={styles.cardTitle}>Root Cause Analysis</Text>
              
              {/* Persistence Adapter Initialization */}
              <Text style={styles.diagnosisTitle}>1. Persistence Adapter Initialization</Text>
              <Text style={styles.diagnosisText}>
                Status: {diagnosisResults.persistenceStatus === 'Working' ? '✅ Functional' : '❌ Not Working'}
              </Text>
              
              {/* Storage Compatibility */}
              <Text style={styles.diagnosisTitle}>2. Storage Mechanisms</Text>
              <Text style={styles.diagnosisText}>
                Memory Cache: {diagnosisResults.memoryCache.workouts ? '✅ Present' : '❌ Missing'}
              </Text>
              <Text style={styles.diagnosisText}>
                AsyncStorage: {diagnosisResults.asyncStorage.workouts ? '✅ Present' : '❌ Missing'}
              </Text>
              {Platform.OS === 'web' && (
                <Text style={styles.diagnosisText}>
                  LocalStorage: {diagnosisResults.localStorage.workouts ? '✅ Present' : '❌ Missing'}
                </Text>
              )}
              
              {/* Conclusion */}
              <Text style={styles.diagnosisTitle}>Conclusion</Text>
              <Text style={styles.diagnosisText}>
                {Platform.OS === 'web' && !diagnosisResults.localStorage.workouts && 
                 diagnosisResults.memoryCache.workouts ? 
                  '❌ Data exists in memory but not in localStorage - browser storage is not persisting data correctly' : 
                  diagnosisResults.asyncStorage.workouts && !diagnosisResults.memoryCache.workouts ? 
                  '❌ AsyncStorage contains data but memory cache doesn\'t - adapter not caching properly' :
                  '❌ Unknown issue - requires further investigation'}
              </Text>
              
              <Text style={styles.instructionsText}>
                1. Test by adding sample data using the button above{'\n'}
                2. Verify data exists in all storage locations{'\n'}
                3. Refresh the page to see if the data persists{'\n'}
                4. If data is lost, check which storage mechanism failed
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  scrollContainer: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 24,
    color: '#666',
  },
  buttonContainer: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  primaryButton: {
    backgroundColor: '#5D5FEF',
  },
  secondaryButton: {
    backgroundColor: '#38A169',
  },
  warningButton: {
    backgroundColor: '#E53E3E',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  resultsContainer: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  infoCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      },
      default: {
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
    }),
  },
  diagnosisCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#5D5FEF',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      },
      default: {
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
    }),
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  infoText: {
    fontSize: 14,
    marginBottom: 8,
    color: '#555',
  },
  codeBlock: {
    backgroundColor: '#f5f7fa',
    padding: 12,
    borderRadius: 6,
    marginTop: 8,
  },
  codeText: {
    fontFamily: Platform.OS === 'web' ? 'monospace' : 'Courier',
    fontSize: 12,
    color: '#333',
  },
  diagnosisTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    color: '#333',
  },
  diagnosisText: {
    fontSize: 14,
    marginBottom: 6,
    color: '#555',
  },
  instructionsText: {
    fontSize: 14,
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 6,
    color: '#666',
    lineHeight: 20,
  },
});
