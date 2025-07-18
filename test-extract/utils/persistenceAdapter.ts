import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { EventRegister } from 'react-native-event-listeners';
import StorageKeys from './storageKeys';

/**
 * Cross-platform storage adapter that enhances AsyncStorage
 * to work reliably across web and native platforms
 */
class PersistenceAdapter {
  // Storage prefix to avoid conflicts
  private readonly PREFIX = 'fitai_';
  
  // In-memory cache to speed up reads and provide backup
  private memoryCache: Record<string, any> = {};
  
  // Track initialization status
  private isInitialized: boolean = false;
  
  // Pending writes that need to be flushed
  private pendingWrites: Array<{key: string, value: any}> = [];
  
  // Storage event name
  private readonly STORAGE_CHANGE_EVENT = 'fitai_storage_changed';
  
  /**
   * Handle storage events from other tabs (web only)
   */
  private handleStorageEvent = (event: StorageEvent) => {
    if (!event.key || !event.key.startsWith(this.PREFIX)) return;
    
    try {
      if (event.newValue === null) {
        // Item was removed
        delete this.memoryCache[event.key];
      } else {
        // Item was added or modified
        this.memoryCache[event.key] = JSON.parse(event.newValue);
      }
    } catch (e) {
      console.warn('Error handling storage event:', e);
    }
  };
  
  /**
   * Handle our custom storage events for same-tab communication
   */
  private handleCustomStorageEvent = (data: {key: string, newValue: string}) => {
    if (!data.key || !data.key.startsWith(this.PREFIX)) return;
    
    try {
      this.memoryCache[data.key] = JSON.parse(data.newValue);
    } catch (e) {
      console.warn('Error handling custom storage event:', e);
    }
  };
  
  // Initialize memory cache from storage on app start
  public async initialize(): Promise<void> {
    try {
      // Prevent double initialization
      if (this.isInitialized) {
        console.log('Persistence adapter already initialized');
        return;
      }
      
      console.log('Initializing persistence adapter...');
      
      // Set up storage event listener for web to handle cross-tab synchronization
      if (Platform.OS === 'web') {
        // Listen for storage events from other tabs
        window.addEventListener('storage', this.handleStorageEvent);
        
        // Set up our custom event for same-tab synchronization
        EventRegister.addEventListener(this.STORAGE_CHANGE_EVENT, this.handleCustomStorageEvent);
      }
      
      // Get all keys from AsyncStorage
      const allKeys = await AsyncStorage.getAllKeys();
      const ourKeys = allKeys.filter(key => key.startsWith(this.PREFIX));
      
      console.log(`Found ${ourKeys.length} keys with prefix ${this.PREFIX}`);
      
      // Load all our data into memory cache
      const loadPromises = [];
      
      for (const key of ourKeys) {
        const promise = new Promise<void>(async (resolve) => {
          let value = null; // Declare value outside try
          try {
            value = await AsyncStorage.getItem(key);
            if (value !== null) {
              try {
                const parsedValue = JSON.parse(value); // Parse first
                this.memoryCache[key] = parsedValue; // Store parsed value in cache
                if (key === `fitai_${StorageKeys.COMPLETED_WORKOUTS}`) { // Check against prefixed key
                  console.log(`Successfully parsed ${StorageKeys.COMPLETED_WORKOUTS}:`, parsedValue);
                }
              } catch (parseError) {
                console.warn(`Error PARSING value for ${key}:`, parseError);
                if (key === `fitai_${StorageKeys.COMPLETED_WORKOUTS}`) {
                  console.error(`FAILED TO PARSE ${StorageKeys.COMPLETED_WORKOUTS} DATA! Raw value: ${value.substring(0, 200)}...`);
                }
                this.memoryCache[key] = undefined; // Explicitly mark as unloadable?
              }
            } else {
              console.log(`Value for ${key} was null.`);
            }
          } catch (error) {
            console.warn(`Error LOADING ${key} from AsyncStorage:`, error);
          } finally {
            resolve();
          }
        });
        loadPromises.push(promise);
      }
      
      // Wait for all keys to be loaded
      await Promise.all(loadPromises);
      
      // Web-specific setup to ensure proper storage behavior
      if (Platform.OS === 'web') {
        // Verify localStorage is actually working
        try {
          const testKey = `${this.PREFIX}storage_test`;
          const testValue = { timestamp: Date.now() };
          
          // Try to write to localStorage
          localStorage.setItem(testKey, JSON.stringify(testValue));
          
          // Verify it was written correctly
          const readValue = localStorage.getItem(testKey);
          if (!readValue) {
            console.warn('localStorage test write failed - storage may be disabled in this browser');
          } else {
            console.log('localStorage test successful');
            localStorage.removeItem(testKey); // Clean up test item
          }
        } catch (e) {
          console.warn('localStorage test failed:', e);
        }
      }
      
      this.isInitialized = true;
      console.log('Persistence adapter initialized successfully');
      
      // Process pending writes now that we're initialized
      if (this.pendingWrites.length > 0) {
        console.log(`Flushing ${this.pendingWrites.length} pending writes...`);
        // Use Promise.allSettled to ensure all writes are attempted even if some fail
        await Promise.allSettled(this.pendingWrites.map(async ({ key, value }) => {
          try {
            // Use setItem directly, skipping adding to pendingWrites again
            await this.setItem(key, value, true); 
          } catch (writeError) {
            console.error(`Error flushing pending write for ${key}:`, writeError);
          }
        }));
        this.pendingWrites = []; // Clear the queue
      }
    } catch (error) {
      console.error('Error initializing persistence adapter:', error);
      // Initialization failed, but allow app to continue with empty cache
      this.isInitialized = true; // Still mark as initialized to prevent loops
    }
  }
  
  /**
   * Save data to storage with memory cache backup
   * @param key The key to store data under (without prefix)
   * @param value The value to store
   * @param skipPendingWrites If true, won't add to pending writes (used internally)
   */
  public async setItem(key: string, value: any, skipPendingWrites: boolean = false): Promise<void> {
    const prefixedKey = this.PREFIX + key;
    const stringValue = JSON.stringify(value);
    
    // If not initialized yet, queue the write
    if (!this.isInitialized && !skipPendingWrites) {
      // Avoid duplicate entries for the same key in the queue
      const existingIndex = this.pendingWrites.findIndex(item => item.key === key);
      if (existingIndex >= 0) {
        this.pendingWrites[existingIndex].value = value; // Update existing entry
      } else {
        this.pendingWrites.push({ key, value });
      }
      return;
    }
    
    // Update memory cache immediately
    this.memoryCache[prefixedKey] = value;
    
    try {
      // Attempt to save to AsyncStorage
      await AsyncStorage.setItem(prefixedKey, stringValue);
      
      // Emit custom event for same-tab listeners
      EventRegister.emit(this.STORAGE_CHANGE_EVENT, { key: prefixedKey, newValue: stringValue });
      
      // On web, manually emit the storage event for cross-tab listeners
      // (AsyncStorage polyfill might not trigger 'storage' event reliably)
      if (Platform.OS === 'web') {
        try {
          localStorage.setItem(prefixedKey, stringValue); // Ensure localStorage is set
        } catch (lsError: any) { 
          // Handle potential localStorage errors separately (e.g., if AsyncStorage polyfill failed)
          console.warn(`Direct localStorage set failed for ${key}:`, lsError);
        }
      }
      
    } catch (error: any) {
      console.error(`Error saving ${key}:`, error);
      
      // Handle quota exceeded specifically on web
      if (Platform.OS === 'web' && (error.name === 'QuotaExceededError' || (error.message && error.message.includes('quota')))) {
        console.warn(`Quota exceeded for ${key}. Attempting to optimize storage...`);
        await this.optimizeStorage();
        
        try {
          // Retry saving after optimization
          await AsyncStorage.setItem(prefixedKey, stringValue);
          console.log(`Successfully saved ${key} after storage optimization.`);
        } catch (retryError) {
          console.error(`Error saving ${key} even after optimization:`, retryError);
          // If retry fails, remove from cache to reflect reality?
          // delete this.memoryCache[prefixedKey]; // Consider this? Maybe too aggressive.
          throw retryError; // Re-throw the error after retry fails
        }
      } else {
        // If it's not a quota error, re-throw
        throw error;
      }
    }
  }

  /**
   * Get data from storage with memory cache fallback
   */
  public async getItem<T>(key: string, defaultValue: T | null = null): Promise<T | null> {
    const prefixedKey = this.PREFIX + key;
    
    // 1. Check memory cache first
    if (this.memoryCache[prefixedKey] !== undefined) {
      return this.memoryCache[prefixedKey] as T;
    }
    
    // 2. If cache miss, try reading from AsyncStorage
    try {
      const value = await AsyncStorage.getItem(prefixedKey);
      
      if (value !== null) {
        try {
          const parsedValue = JSON.parse(value);
          // Update memory cache for future reads
          this.memoryCache[prefixedKey] = parsedValue;
          return parsedValue;
        } catch (parseError) {
          console.warn(`Error parsing value for ${key} from AsyncStorage:`, parseError);
          // If parsing fails, return the raw value (if it matches type T) or default
          // This case is tricky, returning default is safer
          return defaultValue;
        }
      } else {
        // Key doesn't exist in AsyncStorage
        return defaultValue;
      }
    } catch (error) {
      console.error(`Error reading ${key} directly from AsyncStorage:`, error);
      // If direct read fails, return the default value
      return defaultValue;
    }
    
    // Original web-specific localStorage check can be removed or kept as secondary fallback if desired
    // For simplicity and consistency, relying solely on AsyncStorage (polyfilled on web) is cleaner.
  }
  
  /**
   * Remove item from both storage and cache
   */
  public async removeItem(key: string): Promise<void> {
    const prefixedKey = this.PREFIX + key;
    
    try {
      await AsyncStorage.removeItem(prefixedKey);
      delete this.memoryCache[prefixedKey];
    } catch (error) {
      console.error(`Error removing ${key}:`, error);
      // Still remove from memory cache even if storage fails
      delete this.memoryCache[prefixedKey];
    }
  }
  
  /**
   * Check if an item exists in storage or cache
   */
  public async hasItem(key: string): Promise<boolean> {
    const prefixedKey = this.PREFIX + key;
    
    // Check memory cache first (faster)
    if (this.memoryCache[prefixedKey] !== undefined) {
      return true;
    }
    
    try {
      // Then check AsyncStorage
      const value = await AsyncStorage.getItem(prefixedKey);
      return value !== null;
    } catch (error) {
      console.error(`Error checking ${key}:`, error);
      return false;
    }
  }
  
  /**
   * Get all keys with our prefix
   */
  public async getAllKeys(): Promise<string[]> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const ourKeys = allKeys
        .filter(key => key.startsWith(this.PREFIX))
        .map(key => key.substring(this.PREFIX.length));
      
      return ourKeys;
    } catch (error) {
      console.error('Error getting all keys:', error);
      
      // Fallback to memory cache keys
      return Object.keys(this.memoryCache)
        .filter(key => key.startsWith(this.PREFIX))
        .map(key => key.substring(this.PREFIX.length));
    }
  }
  
  /**
   * Optimize storage by cleaning up unnecessary data
   * Used when storage quota is exceeded on web
   */
  private async optimizeStorage(): Promise<void> {
    if (Platform.OS !== 'web') return;
    
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const ourKeys = allKeys.filter(key => key.startsWith(this.PREFIX));
      
      // Strategy: Identify and remove least important data
      // For example, old logs or cached images
      
      // This is just an example - adapt based on your app's specific data types
      const logsKeys = ourKeys.filter(key => key.includes('log_') || key.includes('debug_'));
      const tempDataKeys = ourKeys.filter(key => key.includes('temp_') || key.includes('cache_'));
      
      // Remove some logs and temporary data to free space
      const keysToRemove = [...logsKeys, ...tempDataKeys].slice(0, 5); // Remove up to 5 items
      
      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
        console.log(`Removed ${keysToRemove.length} items to optimize storage`);
      }
    } catch (error) {
      console.error('Error optimizing storage:', error);
    }
  }
}

// Create singleton instance
const persistenceAdapter = new PersistenceAdapter();

export default persistenceAdapter;
