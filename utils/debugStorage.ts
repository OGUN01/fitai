import persistenceAdapter from './persistenceAdapter';
import StorageKeys from './storageKeys';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/**
 * Diagnostic function to verify storage state
 * This will log the state of various storage mechanisms to identify issues
 */
export async function diagnoseStorageState(): Promise<{
  browserType: string;
  persistenceStatus: string;
  memoryCache: any;
  asyncStorage: any;
  localStorage: any;
  storageKeys: string[];
}> {
  console.log('📊 RUNNING STORAGE DIAGNOSTIC');
  console.log('===========================');
  
  // Identify browser environment
  const browserType = Platform.OS === 'web' 
    ? `Web - ${navigator.userAgent}`
    : 'Native App';
  console.log(`📱 Platform: ${browserType}`);
  
  // Check if we're initialized
  let persistenceStatus = 'Unknown';
  try {
    // Test if adapter is working by writing and reading
    await persistenceAdapter.setItem('diagnostic_test', { timestamp: Date.now() });
    const testRead = await persistenceAdapter.getItem('diagnostic_test');
    persistenceStatus = testRead ? 'Working' : 'Failed';
    console.log(`🔄 Persistence adapter: ${persistenceStatus}`);
  } catch (e) {
    persistenceStatus = `Error: ${e.message}`;
    console.error('❌ Persistence adapter test failed:', e);
  }
  
  // Get all keys to check storage state
  const storageKeys = await persistenceAdapter.getAllKeys();
  console.log(`🔑 Found ${storageKeys.length} keys in persistence adapter`);
  
  // Check workout and meal data specifically
  const workoutData = await persistenceAdapter.getItem(StorageKeys.COMPLETED_WORKOUTS);
  console.log(`💪 Workout completions: ${workoutData ? JSON.stringify(workoutData).slice(0, 100) + '...' : 'Not found'}`);
  
  const mealData = await persistenceAdapter.getItem(StorageKeys.MEALS);
  console.log(`🍽️ Meal completions: ${mealData ? JSON.stringify(mealData).slice(0, 100) + '...' : 'Not found'}`);
  
  // Compare with direct AsyncStorage access
  let asyncData = {};
  try {
    const rawWorkoutData = await AsyncStorage.getItem('fitai_' + StorageKeys.COMPLETED_WORKOUTS);
    const rawMealData = await AsyncStorage.getItem('fitai_' + StorageKeys.MEALS);
    
    asyncData = {
      workouts: rawWorkoutData ? JSON.parse(rawWorkoutData) : null,
      meals: rawMealData ? JSON.parse(rawMealData) : null
    };
    
    console.log(`🔄 AsyncStorage direct access - Workouts: ${rawWorkoutData ? 'Found' : 'Missing'}, Meals: ${rawMealData ? 'Found' : 'Missing'}`);
  } catch (e) {
    console.error('❌ Error accessing AsyncStorage directly:', e);
    asyncData = { error: e.message };
  }
  
  // Check browser localStorage if on web
  let localStorageData = {};
  if (Platform.OS === 'web') {
    try {
      const workoutKey = 'fitai_' + StorageKeys.COMPLETED_WORKOUTS;
      const mealKey = 'fitai_' + StorageKeys.MEALS;
      
      localStorageData = {
        workouts: localStorage.getItem(workoutKey) ? JSON.parse(localStorage.getItem(workoutKey)) : null,
        meals: localStorage.getItem(mealKey) ? JSON.parse(localStorage.getItem(mealKey)) : null
      };
      
      console.log(`🌐 Browser localStorage - Workouts: ${localStorage.getItem(workoutKey) ? 'Found' : 'Missing'}, Meals: ${localStorage.getItem(mealKey) ? 'Found' : 'Missing'}`);
      
      // Check localStorage size
      let totalSize = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key);
        totalSize += (key.length + value.length) * 2; // Rough estimate (2 bytes per character)
      }
      
      console.log(`📦 Browser localStorage usage: ~${(totalSize / 1024).toFixed(2)} KB`);
    } catch (e) {
      console.error('❌ Error accessing browser localStorage:', e);
      localStorageData = { error: e.message };
    }
  }
  
  // Check the implementation of AsyncStorage on web
  if (Platform.OS === 'web') {
    try {
      // @ts-ignore - Access internal implementation to diagnose issue
      const asyncStorageType = AsyncStorage._getRequests ? 'Default AsyncStorage' : 'Custom Implementation';
      console.log(`🔧 AsyncStorage web implementation: ${asyncStorageType}`);
    } catch (e) {
      console.error('❌ Could not determine AsyncStorage implementation:', e);
    }
  }
  
  console.log('===========================');
  console.log('📊 DIAGNOSTIC COMPLETE');
  
  return {
    browserType,
    persistenceStatus,
    memoryCache: { 
      workouts: await persistenceAdapter.getItem(StorageKeys.COMPLETED_WORKOUTS),
      meals: await persistenceAdapter.getItem(StorageKeys.MEALS)
    },
    asyncStorage: asyncData,
    localStorage: localStorageData,
    storageKeys
  };
}

// Run diagnostic on import - comment this out after debugging
// diagnoseStorageState().catch(e => console.error('Diagnostic failed:', e));

export default diagnoseStorageState;
