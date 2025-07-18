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
