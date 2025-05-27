import AsyncStorage from '@react-native-async-storage/async-storage';
import supabase from '../lib/supabase';
import { EventRegister } from 'react-native-event-listeners';

// Define sync status type
export interface SyncStatus {
  inProgress: boolean;
  completed: boolean;
  error: string | null;
  lastSyncTimestamp: number | null;
  itemsProcessed: number;
  totalItems: number;
  details: {
    [key: string]: {
      processed: number;
      total: number;
      success: number;
      failed: number;
    }
  }
}

// Storage keys
const SYNC_STATUS_KEY = 'data_sync_status';
const LAST_SYNC_KEY = 'last_data_sync';
const CHANGE_LOG_KEY = 'data_change_log';

/**
 * Get the initial empty sync status object
 */
function getInitialSyncStatus(): SyncStatus {
  return {
    inProgress: false,
    completed: false,
    error: null,
    lastSyncTimestamp: null,
    itemsProcessed: 0,
    totalItems: 0,
    details: {
      workouts: { processed: 0, total: 0, success: 0, failed: 0 },
      meals: { processed: 0, total: 0, success: 0, failed: 0 },
      bodyMeasurements: { processed: 0, total: 0, success: 0, failed: 0 },
      nutritionTracking: { processed: 0, total: 0, success: 0, failed: 0 }
    }
  };
}

/**
 * Get the current sync status
 */
export async function getSyncStatus(): Promise<SyncStatus> {
  try {
    const statusJson = await AsyncStorage.getItem(SYNC_STATUS_KEY);
    if (statusJson) {
      return JSON.parse(statusJson);
    }
    return getInitialSyncStatus();
  } catch (error) {
    console.error('Error getting sync status:', error);
    return getInitialSyncStatus();
  }
}

/**
 * Update the sync status
 */
async function updateSyncStatus(updates: Partial<SyncStatus>): Promise<SyncStatus> {
  try {
    // Get current status
    const current = await getSyncStatus();
    
    // Create updated status
    const updatedStatus = {
      ...current,
      ...updates,
    };
    
    // Save to storage
    await AsyncStorage.setItem(SYNC_STATUS_KEY, JSON.stringify(updatedStatus));
    
    // Broadcast event for listeners
    EventRegister.emit('syncStatusChanged', updatedStatus);
    
    return updatedStatus;
  } catch (error) {
    console.error('Error updating sync status:', error);
    throw error;
  }
}

/**
 * Check if a sync is currently in progress
 */
export async function isSyncInProgress(): Promise<boolean> {
  const status = await getSyncStatus();
  return status.inProgress;
}

/**
 * Get the total number of local items that need to be synced
 */
export async function getTotalLocalSyncItems(userId: string): Promise<{ 
  total: number, 
  breakdown: { [key: string]: number } 
}> {
  try {
    // Temporary implementation - directly access data from AsyncStorage
    // instead of using the imported functions that aren't available
    
    // Create a mock breakdown with zeros
    const breakdown = {
      workouts: 0,
      meals: 0,
      bodyMeasurements: 0,
      nutritionTracking: 0
    };
    
    try {
      // Try to read from AsyncStorage to determine if there are items to sync
      const workoutsJson = await AsyncStorage.getItem('completed_workouts');
      const mealsJson = await AsyncStorage.getItem('meals');
      const measurementsJson = await AsyncStorage.getItem('body_measurements');
      const nutritionJson = await AsyncStorage.getItem('nutrition_tracking');
      
      // Parse and count unsynced items if the data exists
      if (workoutsJson) {
        const workouts = JSON.parse(workoutsJson);
        breakdown.workouts = Array.isArray(workouts) ? 
          workouts.filter(w => !w.server_id).length : 0;
      }
      
      if (mealsJson) {
        const meals = JSON.parse(mealsJson);
        breakdown.meals = Array.isArray(meals) ? 
          meals.filter(m => !m.server_id).length : 0;
      }
      
      if (measurementsJson) {
        const measurements = JSON.parse(measurementsJson);
        breakdown.bodyMeasurements = Array.isArray(measurements) ? 
          measurements.filter(m => !m.server_id).length : 0;
      }
      
      if (nutritionJson) {
        const nutrition = JSON.parse(nutritionJson);
        breakdown.nutritionTracking = Array.isArray(nutrition) ? 
          nutrition.filter(n => !n.server_id).length : 0;
      }
    } catch (parseError) {
      console.error('Error parsing local storage items:', parseError);
    }
    
    // Calculate total
    const total = Object.values(breakdown).reduce((sum, count) => sum + count, 0);
    
    return { total, breakdown };
  } catch (error) {
    console.error('Error counting local items for sync:', error);
    return { total: 0, breakdown: {} };
  }
}

/**
 * Create a backup of local data before attempting sync
 */
async function createLocalDataBackup(): Promise<boolean> {
  try {
    console.log('📦 Creating backup of local data before sync...');
    
    // Get all AsyncStorage keys
    const allKeys = await AsyncStorage.getAllKeys();
    
    // Filter to data keys we care about (excluding system keys, etc.)
    const dataKeys = allKeys.filter(key => 
      key.includes('workouts') || 
      key.includes('meals') || 
      key.includes('body_measurements') || 
      key.includes('nutrition') ||
      key.includes('profile')
    );
    
    // Get all data for these keys
    const keyValuePairs = await AsyncStorage.multiGet(dataKeys);
    
    // Create a backup object
    const backup = Object.fromEntries(keyValuePairs);
    
    // Store the backup with timestamp
    const backupObj = {
      timestamp: Date.now(),
      data: backup
    };
    
    await AsyncStorage.setItem('data_backup_' + Date.now(), JSON.stringify(backupObj));
    console.log('✅ Local data backup created successfully');
    
    return true;
  } catch (error) {
    console.error('❌ Error creating local data backup:', error);
    return false;
  }
}

/**
 * Track changes to local data for better sync decisions
 * This should be called whenever local data is modified
 */
export async function trackDataChange(dataType: string): Promise<void> {
  try {
    // Get current change log
    const logJson = await AsyncStorage.getItem(CHANGE_LOG_KEY);
    let currentLog = logJson ? JSON.parse(logJson) : {};
    
    // Update the log with latest change timestamp
    currentLog = {
      ...currentLog,
      [dataType]: { 
        timestamp: Date.now(), 
        synced: false 
      }
    };
    
    // Save updated log
    await AsyncStorage.setItem(CHANGE_LOG_KEY, JSON.stringify(currentLog));
  } catch (error) {
    console.error('Error tracking data change:', error);
  }
}

/**
 * Mark data type as synced in change log
 */
async function markDataAsSynced(dataType: string): Promise<void> {
  try {
    // Get current change log
    const logJson = await AsyncStorage.getItem(CHANGE_LOG_KEY);
    let currentLog = logJson ? JSON.parse(logJson) : {};
    
    // If this data type exists in log, mark it as synced
    if (currentLog[dataType]) {
      currentLog[dataType].synced = true;
      currentLog[dataType].syncTimestamp = Date.now();
      
      // Save updated log
      await AsyncStorage.setItem(CHANGE_LOG_KEY, JSON.stringify(currentLog));
    }
  } catch (error) {
    console.error('Error marking data as synced:', error);
  }
}

/**
 * Migrate local data to cloud when user creates a new account
 * This is a comprehensive process that ensures all local data is transferred
 * to the user's new Supabase account
 */
export async function migrateLocalToCloud(userId: string): Promise<boolean> {
  try {
    console.log('🔄 Starting comprehensive local-to-cloud data migration for new user:', userId);
    
    // Check if sync is already in progress
    if (await isSyncInProgress()) {
      console.warn('⚠️ Sync already in progress, cannot start new sync');
      return false;
    }
    
    // Create backup before sync
    const backupCreated = await createLocalDataBackup();
    if (!backupCreated) {
      console.warn('⚠️ Failed to create backup, proceeding with caution');
    }
    
    // Initialize sync status
    const { total, breakdown } = await getTotalLocalSyncItems(userId);
    
    // Update sync status to started
    await updateSyncStatus({
      inProgress: true,
      completed: false,
      error: null,
      itemsProcessed: 0,
      totalItems: total,
      details: {
        workouts: { processed: 0, total: breakdown.workouts || 0, success: 0, failed: 0 },
        meals: { processed: 0, total: breakdown.meals || 0, success: 0, failed: 0 },
        bodyMeasurements: { processed: 0, total: breakdown.bodyMeasurements || 0, success: 0, failed: 0 },
        nutritionTracking: { processed: 0, total: breakdown.nutritionTracking || 0, success: 0, failed: 0 }
      }
    });
    
    // If no items to sync, mark as complete and return
    if (total === 0) {
      await updateSyncStatus({
        inProgress: false,
        completed: true,
        lastSyncTimestamp: Date.now()
      });
      console.log('✅ No items to migrate, sync completed');
      return true;
    }
    
    // Sync low-risk data first
    const lowRiskSuccess = await performLowRiskSync(userId);
    
    // Then sync high-risk data
    const highRiskSuccess = await performHighRiskSync(userId);
    
    // Update final sync status
    const finalStatus = await getSyncStatus();
    await updateSyncStatus({
      inProgress: false,
      completed: true,
      error: lowRiskSuccess && highRiskSuccess ? null : 'Some items failed to sync',
      lastSyncTimestamp: Date.now()
    });
    
    // Log success
    console.log(`✅ Data migration completed. ${finalStatus.itemsProcessed}/${total} items processed.`);
    
    return lowRiskSuccess && highRiskSuccess;
  } catch (error) {
    console.error('❌ Error in migrateLocalToCloud:', error);
    
    // Update status to failed
    await updateSyncStatus({
      inProgress: false,
      completed: false,
      error: error instanceof Error ? error.message : 'Unknown error in migration'
    });
    
    return false;
  }
}

/**
 * Perform sync of non-critical data first
 * This includes meals and nutrition tracking
 */
async function performLowRiskSync(userId: string): Promise<boolean> {
  try {
    console.log('🔄 Starting low-risk data sync...');
    let success = true;
    
    // 1. Sync meals
    try {
      // Get meals from AsyncStorage
      const mealsJson = await AsyncStorage.getItem('meals');
      const meals = mealsJson ? JSON.parse(mealsJson) : [];
      const unsyncedMeals = meals.filter(meal => !meal.server_id);
      console.log(`Found ${unsyncedMeals.length} unsynced meals to process`);
      
      let successCount = 0;
      let failedCount = 0;
      
      for (let i = 0; i < unsyncedMeals.length; i++) {
        const meal = unsyncedMeals[i];
        try {
          // Add user_id to meal
          const mealWithUserId = {
            ...meal,
            user_id: userId
          };
          
          // Save to Supabase directly
          const { data, error } = await supabase
            .from('meals')
            .insert(mealWithUserId)
            .select()
            .single();
          
          const syncSuccess = !error && data;
          
          if (syncSuccess) {
            // Update the local meal with server_id
            const updatedMeals = meals.map(m => 
              m.id === meal.id ? { ...m, server_id: data.id } : m
            );
            await AsyncStorage.setItem('meals', JSON.stringify(updatedMeals));
            successCount++;
          } else {
            failedCount++;
            console.error('Error saving meal to Supabase:', error);
          }
          
          // Update sync status (fixed to use proper type)
          const currentStatus = await getSyncStatus();
          await updateSyncStatus({
            itemsProcessed: currentStatus.itemsProcessed + 1,
            details: {
              ...currentStatus.details,
              meals: {
                ...currentStatus.details.meals,
                processed: currentStatus.details.meals.processed + 1,
                success: currentStatus.details.meals.success + (syncSuccess ? 1 : 0),
                failed: currentStatus.details.meals.failed + (syncSuccess ? 0 : 1)
              }
            }
          });
        } catch (error) {
          console.error('Error syncing meal:', error);
          failedCount++;
        }
      }
      
      console.log(`Meals sync completed: ${successCount} succeeded, ${failedCount} failed`);
      await markDataAsSynced('meals');
      
      if (failedCount > 0) {
        success = false;
      }
    } catch (mealError) {
      console.error('Error in meals sync:', mealError);
      success = false;
    }
    
    // 2. Sync nutrition tracking
    try {
      // Get nutrition data from AsyncStorage
      const nutritionJson = await AsyncStorage.getItem('nutrition_tracking');
      const nutritionEntries = nutritionJson ? JSON.parse(nutritionJson) : [];
      const unsyncedEntries = nutritionEntries.filter(entry => !entry.server_id);
      console.log(`Found ${unsyncedEntries.length} unsynced nutrition entries to process`);
      
      let successCount = 0;
      let failedCount = 0;
      
      for (let i = 0; i < unsyncedEntries.length; i++) {
        const entry = unsyncedEntries[i];
        try {
          // Add user_id to entry
          const entryWithUserId = {
            ...entry,
            user_id: userId
          };
          
          // Save to Supabase directly
          const { data, error } = await supabase
            .from('nutrition_tracking')
            .insert(entryWithUserId)
            .select()
            .single();
          
          const syncSuccess = !error && data;
          
          if (syncSuccess) {
            // Update the local entry with server_id
            const updatedEntries = nutritionEntries.map(e => 
              e.id === entry.id ? { ...e, server_id: data.id } : e
            );
            await AsyncStorage.setItem('nutrition_tracking', JSON.stringify(updatedEntries));
            successCount++;
          } else {
            failedCount++;
            console.error('Error saving nutrition tracking to Supabase:', error);
          }
          
          // Update sync status (fixed to use proper type)
          const currentStatus = await getSyncStatus();
          await updateSyncStatus({
            itemsProcessed: currentStatus.itemsProcessed + 1,
            details: {
              ...currentStatus.details,
              nutritionTracking: {
                ...currentStatus.details.nutritionTracking,
                processed: currentStatus.details.nutritionTracking.processed + 1,
                success: currentStatus.details.nutritionTracking.success + (syncSuccess ? 1 : 0),
                failed: currentStatus.details.nutritionTracking.failed + (syncSuccess ? 0 : 1)
              }
            }
          });
        } catch (error) {
          console.error('Error syncing nutrition entry:', error);
          failedCount++;
        }
      }
      
      console.log(`Nutrition tracking sync completed: ${successCount} succeeded, ${failedCount} failed`);
      await markDataAsSynced('nutritionTracking');
      
      if (failedCount > 0) {
        success = false;
      }
    } catch (nutritionError) {
      console.error('Error in nutrition tracking sync:', nutritionError);
      success = false;
    }
    
    return success;
  } catch (error) {
    console.error('❌ Error in performLowRiskSync:', error);
    return false;
  }
}

/**
 * Perform sync of critical data 
 * This includes workouts and body measurements
 */
async function performHighRiskSync(userId: string): Promise<boolean> {
  try {
    console.log('🔄 Starting high-risk data sync...');
    let success = true;
    
    // 1. Sync workouts
    try {
      // Get workouts from AsyncStorage directly
      const workoutsJson = await AsyncStorage.getItem('completed_workouts');
      const workouts = workoutsJson ? JSON.parse(workoutsJson) : [];
      const unsyncedWorkouts = workouts.filter(workout => !workout.server_id);
      console.log(`Found ${unsyncedWorkouts.length} unsynced workouts to process`);
      
      let successCount = 0;
      let failedCount = 0;
      
      for (let i = 0; i < unsyncedWorkouts.length; i++) {
        const workout = unsyncedWorkouts[i];
        try {
          // Add user_id to workout
          const workoutWithUserId = {
            ...workout,
            user_id: userId
          };
          
          // Save to Supabase directly
          const { data, error } = await supabase
            .from('completed_workouts')
            .insert(workoutWithUserId)
            .select()
            .single();
          
          const syncSuccess = !error && data;
          
          if (syncSuccess) {
            // Update the local workout with server_id
            const updatedWorkouts = workouts.map(w => 
              w.id === workout.id ? { ...w, server_id: data.id } : w
            );
            await AsyncStorage.setItem('completed_workouts', JSON.stringify(updatedWorkouts));
            successCount++;
          } else {
            failedCount++;
            console.error('Error saving workout to Supabase:', error);
          }
          
          // Update sync status with correct type
          const currentStatus = await getSyncStatus();
          await updateSyncStatus({
            itemsProcessed: currentStatus.itemsProcessed + 1,
            details: {
              ...currentStatus.details,
              workouts: {
                ...currentStatus.details.workouts,
                processed: currentStatus.details.workouts.processed + 1,
                success: currentStatus.details.workouts.success + (syncSuccess ? 1 : 0),
                failed: currentStatus.details.workouts.failed + (syncSuccess ? 0 : 1)
              }
            }
          });
        } catch (error) {
          console.error('Error syncing workout:', error);
          failedCount++;
        }
      }
      
      console.log(`Workouts sync completed: ${successCount} succeeded, ${failedCount} failed`);
      await markDataAsSynced('workouts');
      
      if (failedCount > 0) {
        success = false;
      }
    } catch (workoutError) {
      console.error('Error in workouts sync:', workoutError);
      success = false;
    }
    
    // 2. Sync body measurements
    try {
      // Get body measurements from AsyncStorage directly
      const measurementsJson = await AsyncStorage.getItem('body_measurements');
      const measurements = measurementsJson ? JSON.parse(measurementsJson) : [];
      const unsyncedMeasurements = measurements.filter(measurement => !measurement.server_id);
      console.log(`Found ${unsyncedMeasurements.length} unsynced body measurements to process`);
      
      let successCount = 0;
      let failedCount = 0;
      
      for (let i = 0; i < unsyncedMeasurements.length; i++) {
        const measurement = unsyncedMeasurements[i];
        try {
          // Add user_id to measurement
          const measurementWithUserId = {
            ...measurement,
            user_id: userId
          };
          
          // Save to Supabase directly
          const { data, error } = await supabase
            .from('body_measurements')
            .insert(measurementWithUserId)
            .select()
            .single();
          
          const syncSuccess = !error && data;
          
          if (syncSuccess) {
            // Update the local measurement with server_id
            const updatedMeasurements = measurements.map(m => 
              m.id === measurement.id ? { ...m, server_id: data.id } : m
            );
            await AsyncStorage.setItem('body_measurements', JSON.stringify(updatedMeasurements));
            successCount++;
          } else {
            failedCount++;
            console.error('Error saving body measurement to Supabase:', error);
          }
          
          // Update sync status with correct type
          const currentStatus = await getSyncStatus();
          await updateSyncStatus({
            itemsProcessed: currentStatus.itemsProcessed + 1,
            details: {
              ...currentStatus.details,
              bodyMeasurements: {
                ...currentStatus.details.bodyMeasurements,
                processed: currentStatus.details.bodyMeasurements.processed + 1,
                success: currentStatus.details.bodyMeasurements.success + (syncSuccess ? 1 : 0),
                failed: currentStatus.details.bodyMeasurements.failed + (syncSuccess ? 0 : 1)
              }
            }
          });
        } catch (error) {
          console.error('Error syncing body measurement:', error);
          failedCount++;
        }
      }
      
      console.log(`Body measurements sync completed: ${successCount} succeeded, ${failedCount} failed`);
      await markDataAsSynced('bodyMeasurements');
      
      if (failedCount > 0) {
        success = false;
      }
    } catch (measurementError) {
      console.error('Error in body measurements sync:', measurementError);
      success = false;
    }
    
    return success;
  } catch (error) {
    console.error('❌ Error in performHighRiskSync:', error);
    return false;
  }
}
