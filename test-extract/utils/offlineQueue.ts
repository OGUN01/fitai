import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import supabase from '../lib/supabase'; // Assuming this is the correct path to your Supabase client

const OFFLINE_QUEUE_KEY = 'offline_sync_queue';

export interface QueuedOperation {
  id: string; // Unique ID for the queue item itself
  operationId: string; // ID of the entity being operated on (e.g., profile.id, workout_completion.id)
  type: 'upsert' | 'delete';
  table: string;
  data: any; // For upsert, this is the record. For delete, could be just { id: string } or the operationId is sufficient
  timestamp: string; // Timestamp of when the operation was queued
  attempts: number;
  userId?: string; // Optional: if queue needs to be user-specific beyond current session
  lastAttemptTimestamp?: string;
}

// Helper to generate unique IDs for queue items
const generateQueueItemId = () => `queue_item_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

export const addToQueue = async (
  operation: Omit<QueuedOperation, 'id' | 'timestamp' | 'attempts' | 'lastAttemptTimestamp'>
): Promise<void> => {
  try {
    const queue = await getQueue();
    const newQueueItem: QueuedOperation = {
      ...operation,
      id: generateQueueItemId(),
      timestamp: new Date().toISOString(),
      attempts: 0,
      // Ensure data for upsert includes an updated_at field.
      // This timestamp reflects when the action was intended.
      data: operation.type === 'upsert' && operation.data ? 
            { ...operation.data, updated_at: operation.data.updated_at || new Date().toISOString() } : 
            operation.data,
    };
    queue.push(newQueueItem);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    console.log(`[OfflineQueue] Added to queue: ${newQueueItem.operationId} for table ${newQueueItem.table}`);
    
    // Attempt to process immediately if online
    const netState = await NetInfo.fetch();
    if (netState.isConnected && netState.isInternetReachable) {
      processQueue(); // Fire and forget, processQueue handles its own locking
    }
  } catch (error) {
    console.error('[OfflineQueue] Error adding to queue:', error);
  }
};

export const getQueue = async (): Promise<QueuedOperation[]> => {
  try {
    const queueJson = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    return queueJson ? JSON.parse(queueJson) : [];
  } catch (error) {
    console.error('[OfflineQueue] Error getting queue:', error);
    return [];
  }
};

export const removeFromQueue = async (id: string): Promise<void> => {
  try {
    let queue = await getQueue();
    queue = queue.filter(item => item.id !== id);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    console.log(`[OfflineQueue] Removed from queue: ${id}`);
  } catch (error) {
    console.error('[OfflineQueue] Error removing from queue:', error);
  }
};

const updateQueueItem = async (id: string, updates: Partial<Omit<QueuedOperation, 'id'>>): Promise<void> => {
  try {
    let queue = await getQueue();
    const itemIndex = queue.findIndex(item => item.id === id);
    if (itemIndex > -1) {
      queue[itemIndex] = { ...queue[itemIndex], ...updates };
      await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    }
  } catch (error) {
    console.error('[OfflineQueue] Error updating queue item:', error);
  }
};

const MAX_ATTEMPTS = 5;
// Delays in milliseconds for retries: 1s, 5s, 15s, 30s, 60s
const RETRY_DELAYS = [1000, 5000, 15000, 30000, 60000]; 

let isProcessing = false; // Simple mutex to prevent concurrent processing runs

export const processQueue = async (): Promise<void> => {
  if (isProcessing) {
    console.log('[OfflineQueue] Already processing.');
    return;
  }

  const netState = await NetInfo.fetch();
  if (!netState.isConnected || !netState.isInternetReachable) {
    console.log('[OfflineQueue] No internet connection. Skipping processing.');
    return;
  }

  isProcessing = true;
  console.log('[OfflineQueue] Starting to process queue...');

  try {
    const queue = await getQueue(); // Get a fresh copy of the queue
    if (queue.length === 0) {
      console.log('[OfflineQueue] Queue is empty.');
      isProcessing = false;
      return;
    }

    for (const item of queue) {
      if (item.attempts >= MAX_ATTEMPTS) {
        console.warn(`[OfflineQueue] Item ${item.id} (${item.operationId} on ${item.table}) reached max attempts. It will remain in queue but won't be retried automatically.`);
        // Future: Implement dead-letter queue or user notification
        continue;
      }

      if (item.lastAttemptTimestamp && item.attempts > 0) {
        const delayIndex = Math.min(item.attempts -1, RETRY_DELAYS.length -1);
        const requiredDelay = RETRY_DELAYS[delayIndex];
        const timeSinceLastAttempt = new Date().getTime() - new Date(item.lastAttemptTimestamp).getTime();
        
        if (timeSinceLastAttempt < requiredDelay) {
          console.log(`[OfflineQueue] Item ${item.id} not ready for retry. Waiting for ${Math.round((requiredDelay - timeSinceLastAttempt)/1000)}s.`);
          continue; // Skip this item, will be checked in the next processing cycle
        }
      }
      
      console.log(`[OfflineQueue] Processing item: ${item.id}, type: ${item.type}, table: ${item.table}, operationId: ${item.operationId}, attempts: ${item.attempts + 1}`);
      // Update attempts and lastAttemptTimestamp before trying
      await updateQueueItem(item.id, { 
        attempts: item.attempts + 1, 
        lastAttemptTimestamp: new Date().toISOString() 
      });

      try {
        let supabaseError = null;
        if (item.type === 'upsert') {
          // The `updated_at` in item.data should be the one from when the action was performed/queued.
          // Supabase handles LWW based on this.
          const { error } = await supabase.from(item.table).upsert(item.data);
          supabaseError = error;
        } else if (item.type === 'delete') {
          const { error } = await supabase.from(item.table).delete().eq('id', item.operationId);
          supabaseError = error;
        }

        if (supabaseError) {
          console.error(`[OfflineQueue] Supabase error for item ${item.id} (${item.table} ${item.operationId}):`, supabaseError.message);
          // Item remains in queue for the next attempt. updateQueueItem already incremented attempts.
        } else {
          console.log(`[OfflineQueue] Successfully processed item ${item.id} for ${item.table} (${item.operationId}). Removing from queue.`);
          await removeFromQueue(item.id);
        }
      } catch (e: any) {
        console.error(`[OfflineQueue] Exception during Supabase operation for item ${item.id}:`, e.message || e);
        // Item remains in queue.
      }
    }
  } catch (error: any) {
    console.error('[OfflineQueue] General error during queue processing:', error.message || error);
  } finally {
    isProcessing = false;
    console.log('[OfflineQueue] Finished processing queue cycle.');
    
    // Check if there are still items eligible for retry and if online
    const remainingQueue = await getQueue();
    const hasRetriableItems = remainingQueue.some(item => item.attempts < MAX_ATTEMPTS);

    if (hasRetriableItems) {
        const currentNetState = await NetInfo.fetch();
        if (currentNetState.isConnected && currentNetState.isInternetReachable) {
            // Schedule another processing attempt after a short delay
            // This helps pick up items that were waiting for their retry delay
            const nextAttemptDelay = RETRY_DELAYS[0]; // Use the shortest delay
            console.log(`[OfflineQueue] Scheduling next check in ${nextAttemptDelay/1000}s as retriable items remain.`);
            setTimeout(() => processQueue(), nextAttemptDelay);
        }
    }
  }
};

let netInfoUnsubscribe: (() => void) | null = null;

// Call this once from your app's entry point (e.g., App.tsx or _layout.tsx)
export const initializeOfflineQueue = () => {
  if (netInfoUnsubscribe) {
    console.log('[OfflineQueue] Already initialized.');
    return netInfoUnsubscribe;
  }

  console.log('[OfflineQueue] Initializing...');
  // Attempt to process queue on startup if online
  NetInfo.fetch().then(state => {
    if (state.isConnected && state.isInternetReachable) {
      processQueue();
    }
  });

  // Listen for network connectivity changes
  netInfoUnsubscribe = NetInfo.addEventListener(state => {
    console.log(`[OfflineQueue] Network state changed. Connected: ${state.isConnected}, Reachable: ${state.isInternetReachable}`);
    if (state.isConnected && state.isInternetReachable) {
      processQueue(); // Attempt to process queue when connection is back
    }
  });

  return netInfoUnsubscribe; // Return the unsubscribe function for cleanup if needed
};

// Optional: Function to clear the entire queue (e.g., on user logout)
export const clearOfflineQueue = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
    console.log('[OfflineQueue] Cleared.');
  } catch (error) {
    console.error('[OfflineQueue] Error clearing queue:', error);
  }
};
