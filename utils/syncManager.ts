import AsyncStorage from '@react-native-async-storage/async-storage';
import { synchronizationEngine } from './synchronizationEngine';
import { EventRegister } from 'react-native-event-listeners';

// Define types for data configuration
type DataConfig = {
  table: string;
  storageKey: string;
  fieldName?: string; // Optional for JSON fields in profiles
};

// Define the data types and their corresponding table names and storage keys
const DATA_TYPES: Record<string, DataConfig> = {
  workouts: { table: 'workout_completions', storageKey: 'completed_workouts' },
  meals: { table: 'meal_completions', storageKey: 'meals' },
  // Store body measurements and nutrition tracking in profile.body_analysis for now
  // since there are no dedicated tables for these in the current schema
  bodyMeasurements: { table: 'profiles', storageKey: 'body_measurements', fieldName: 'body_analysis' },
  nutritionTracking: { table: 'profiles', storageKey: 'nutrition_tracking', fieldName: 'meal_tracking' }
};

// Status key for tracking sync operations
const SYNC_STATUS_KEY = 'sync_manager_status';

// Interface for sync status
interface SyncStatus {
  inProgress: boolean;
  lastSync: number | null;
  error: string | null;
  syncResults: {
    [dataType: string]: {
      success: boolean;
      syncedItems: number;
      conflicts: number;
      timestamp: number;
    };
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
 * Get an empty initial sync status
 */
function getInitialSyncStatus(): SyncStatus {
  return {
    inProgress: false,
    lastSync: null,
    error: null,
    syncResults: {}
  };
}

/**
 * Update the sync status
 */
async function updateSyncStatus(updates: Partial<SyncStatus>): Promise<SyncStatus> {
  try {
    const current = await getSyncStatus();
    const updatedStatus = { ...current, ...updates };
    await AsyncStorage.setItem(SYNC_STATUS_KEY, JSON.stringify(updatedStatus));
    
    // Broadcast event for any listeners
    EventRegister.emit('syncStatusChanged', updatedStatus);
    
    return updatedStatus;
  } catch (error) {
    console.error('Error updating sync status:', error);
    throw error;
  }
}

/**
 * Track changes to local data for better sync decisions
 * This should be called whenever local data is modified
 */
export async function trackDataChange(
  dataType: string, 
  itemId: string, 
  operation: 'create' | 'update' | 'delete'
): Promise<void> {
  try {
    // Validate data type
    if (!DATA_TYPES[dataType]) {
      console.error(`Invalid data type: ${dataType}`);
      return;
    }
    
    // Track the change in the synchronization engine
    await synchronizationEngine.trackChange(dataType, itemId, operation);
  } catch (error) {
    console.error(`Error tracking change for ${dataType}:`, error);
  }
}

/**
 * Perform bi-directional synchronization between local storage and Supabase
 * This ensures that data is consistent between the two sources
 */
export async function synchronizeAllData(userId: string): Promise<boolean> {
  if (!userId) {
    console.error('Cannot synchronize data: No user ID provided');
    return false;
  }
  
  try {
    console.log('🔄 Starting comprehensive data synchronization...');
    
    // Update status to indicate sync is in progress
    await updateSyncStatus({
      inProgress: true,
      error: null
    });
    
    // Keep track of overall success
    let allSuccessful = true;
    
    // Synchronize each data type
    for (const [dataType, config] of Object.entries(DATA_TYPES)) {
      try {
        console.log(`Synchronizing ${dataType}...`);
        
        // Use the synchronization engine to perform bi-directional sync
        const result = await synchronizationEngine.synchronizeData(
          userId,
          dataType,
          config.table,
          config.storageKey,
          config.fieldName // Pass the fieldName for JSON fields in profiles table
        );
        
        // Update the sync results for this data type
        await updateSyncStatus({
          syncResults: {
            ...(await getSyncStatus()).syncResults,
            [dataType]: {
              ...result,
              timestamp: Date.now()
            }
          }
        });
        
        // Update overall success flag
        if (!result.success) {
          allSuccessful = false;
        }
        
        console.log(`✅ ${dataType} sync completed:`, result);
      } catch (error) {
        console.error(`❌ Error synchronizing ${dataType}:`, error);
        allSuccessful = false;
        
        // Update sync results with error
        await updateSyncStatus({
          syncResults: {
            ...(await getSyncStatus()).syncResults,
            [dataType]: {
              success: false,
              syncedItems: 0,
              conflicts: 0,
              timestamp: Date.now()
            }
          }
        });
      }
    }
    
    // Update the final sync status
    await updateSyncStatus({
      inProgress: false,
      lastSync: Date.now(),
      error: allSuccessful ? null : 'Some data types failed to synchronize'
    });
    
    // Broadcast a sync completed event
    EventRegister.emit('syncCompleted', {
      success: allSuccessful,
      timestamp: Date.now()
    });
    
    console.log(`🔄 Data synchronization completed with ${allSuccessful ? 'success' : 'some errors'}`);
    return allSuccessful;
  } catch (error) {
    console.error('❌ Error in synchronizeAllData:', error);
    
    // Update status to indicate sync failed
    await updateSyncStatus({
      inProgress: false,
      error: error instanceof Error ? error.message : 'Unknown error during synchronization'
    });
    
    // Broadcast a sync failed event
    EventRegister.emit('syncFailed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now()
    });
    
    return false;
  }
}

/**
 * Check if a synchronization is currently in progress
 */
export async function isSyncInProgress(): Promise<boolean> {
  const status = await getSyncStatus();
  return status.inProgress;
}

/**
 * Get a summary of the last synchronization
 */
export async function getSyncSummary(): Promise<{
  lastSync: number | null;
  dataTypesSynced: number;
  totalItemsSynced: number;
  hasConflicts: boolean;
}> {
  const status = await getSyncStatus();
  
  // Calculate the summary data
  const resultsEntries = Object.entries(status.syncResults || {});
  const dataTypesSynced = resultsEntries.length;
  const totalItemsSynced = resultsEntries.reduce(
    (sum, [_, result]) => sum + result.syncedItems, 
    0
  );
  const hasConflicts = resultsEntries.some(([_, result]) => result.conflicts > 0);
  
  return {
    lastSync: status.lastSync,
    dataTypesSynced,
    totalItemsSynced,
    hasConflicts
  };
}

/**
 * Force a resync of all data by clearing sync metadata
 */
export async function forceResync(): Promise<void> {
  try {
    // Reset the sync status
    await updateSyncStatus(getInitialSyncStatus());
    
    // Clear sync metadata (this will force a full resync on next sync)
    await AsyncStorage.removeItem('sync_metadata');
    
    console.log('✅ Sync metadata cleared, next sync will be a full resync');
  } catch (error) {
    console.error('❌ Error forcing resync:', error);
    throw error;
  }
}
