import { useEffect, useState } from 'react';
import persistenceAdapter from './persistenceAdapter';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import StorageKeys from './storageKeys';

/**
 * Initialize the persistence adapter and ensure storage is working
 * This is a critical service that must be run at app startup
 * @returns boolean indicating if storage is ready
 */
export function useStorageInitialization(): boolean {
  const [isInitialized, setIsInitialized] = useState(false);
  const [initializationError, setInitializationError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function initializeStorage() {
      console.log('🔄 Initializing storage system...');
      setInitializationError(null);
      
      try {
        // Initialize the persistence adapter
        await persistenceAdapter.initialize();
        
        if (isMounted) {
          // For Android - make sure AsyncStorage is working properly
          if (Platform.OS === 'android') {
            await verifyAndroidStorage();
          }
          
          // For Web - make sure localStorage is properly synced with AsyncStorage
          if (Platform.OS === 'web') {
            await verifyWebStorage();
          }
          
          // Mark storage as initialized ONLY if successful
          setIsInitialized(true);
          console.log('✅ Storage system initialized successfully');
        }
      } catch (error: any) {
        console.error('❌ Error during storage initialization sequence:', error);
        if (isMounted) {
          setInitializationError(error);
          setIsInitialized(false);
        }
      }
    }
    
    initializeStorage();
    
    // Cleanup function
    return () => {
      isMounted = false;
      if (Platform.OS === 'web') {
        try {
          // Clean up any event listeners if needed
          window.removeEventListener('storage', (event) => {
            console.log('Storage event listener removed');
          });
        } catch (error) {
          console.error('Error cleaning up storage event listeners:', error);
        }
      }
    };
  }, []);
  
  return isInitialized;
}

/**
 * Verify Android storage is working properly
 */
async function verifyAndroidStorage() {
  try {
    // Test writing and reading from AsyncStorage
    const testKey = 'storage_verification_android';
    const testValue = { timestamp: Date.now(), platform: 'android' };
    
    await AsyncStorage.setItem(testKey, JSON.stringify(testValue));
    const storedValue = await AsyncStorage.getItem(testKey);
    
    if (!storedValue) {
      console.error('❌ Android AsyncStorage verification failed - could not read test value');
    } else {
      console.log('✅ Android AsyncStorage verification passed');
    }
    
    // Clean up test key
    await AsyncStorage.removeItem(testKey);
  } catch (error) {
    console.error('❌ Error verifying Android storage:', error);
  }
}

/**
 * Verify Web storage is working properly
 * This is critical for ensuring data persists across page refreshes
 */
async function verifyWebStorage() {
  try {
    // Test data
    const testKey = 'storage_verification_web';
    const testValue = { timestamp: Date.now(), platform: 'web' };
    
    // Test AsyncStorage
    await AsyncStorage.setItem(testKey, JSON.stringify(testValue));
    const asyncValue = await AsyncStorage.getItem(testKey);
    
    // Test direct localStorage 
    localStorage.setItem('fitai_direct_test', JSON.stringify({ direct: true }));
    const directValue = localStorage.getItem('fitai_direct_test');
    
    console.log('AsyncStorage test:', asyncValue ? '✅ Success' : '❌ Failed');
    console.log('localStorage direct test:', directValue ? '✅ Success' : '❌ Failed');
    
    // Check data consistency
    if (asyncValue) {
      // Verify AsyncStorage is actually using localStorage
      const localValue = localStorage.getItem(testKey);
      if (!localValue) {
        console.warn('⚠️ AsyncStorage is not using localStorage - implementing fallback');
        
        // Implement a fallback to fix AsyncStorage → localStorage connection
        try {
          // Copy all AsyncStorage items to localStorage
          const keys = await AsyncStorage.getAllKeys();
          for (const key of keys) {
            const value = await AsyncStorage.getItem(key);
            if (value) {
              localStorage.setItem(key, value);
            }
          }
          console.log('✅ AsyncStorage to localStorage fallback applied');
        } catch (fallbackError) {
          console.error('❌ AsyncStorage to localStorage fallback failed:', fallbackError);
        }
      } else {
        console.log('✅ AsyncStorage is properly using localStorage');
      }
    }
    
    // Clean up test keys
    await AsyncStorage.removeItem(testKey);
    localStorage.removeItem('fitai_direct_test');
    
    // Verify actual workout data
    const workouts = await persistenceAdapter.getItem(StorageKeys.COMPLETED_WORKOUTS);
    const meals = await persistenceAdapter.getItem(StorageKeys.MEALS);
    
    console.log(`Found ${workouts?.length || 0} workouts and ${meals?.length || 0} meals in storage`);
  } catch (error) {
    console.error('❌ Error verifying web storage:', error);
  }
}

export default useStorageInitialization;
