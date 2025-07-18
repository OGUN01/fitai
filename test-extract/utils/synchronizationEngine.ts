import AsyncStorage from '@react-native-async-storage/async-storage';
import supabase from '../lib/supabase';
import { EventRegister } from 'react-native-event-listeners';

// Storage keys
const CHANGE_LOG_KEY = 'data_change_log';
const SYNC_METADATA_KEY = 'sync_metadata';

// Interface for the change log entry
interface ChangeLogEntry {
  timestamp: number;
  synced: boolean;
  syncTimestamp?: number;
  operation: 'create' | 'update' | 'delete';
  itemId?: string;
}

// Interface for the change log
interface ChangeLog {
  [dataType: string]: {
    [itemId: string]: ChangeLogEntry;
  };
}

// Interface for sync metadata
interface SyncMetadata {
  lastSync: {
    [dataType: string]: number;
  };
  deviceId: string;
  conflictResolutionStrategy: 'server' | 'client' | 'newest' | 'manual';
}

/**
 * Bi-directional synchronization engine for handling data reconciliation
 * between local storage and Supabase cloud storage
 */
export class SynchronizationEngine {
  private metadata: SyncMetadata | null = null;
  private changeLog: ChangeLog | null = null;
  private initialized = false;

  constructor() {
    // Initialize the engine
    this.init();
  }

  /**
   * Initialize the synchronization engine
   */
  private async init(): Promise<void> {
    try {
      // Load sync metadata
      const metadataJson = await AsyncStorage.getItem(SYNC_METADATA_KEY);
      this.metadata = metadataJson ? JSON.parse(metadataJson) : this.createDefaultMetadata();

      // Load change log
      const changeLogJson = await AsyncStorage.getItem(CHANGE_LOG_KEY);
      this.changeLog = changeLogJson ? JSON.parse(changeLogJson) : {};

      // Set initialized flag
      this.initialized = true;

      console.log('Synchronization engine initialized successfully');
    } catch (error) {
      console.error('Error initializing synchronization engine:', error);
      // Create default metadata and empty change log if initialization fails
      this.metadata = this.createDefaultMetadata();
      this.changeLog = {};
    }
  }

  /**
   * Create default sync metadata
   */
  private createDefaultMetadata(): SyncMetadata {
    return {
      lastSync: {},
      deviceId: `device_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      conflictResolutionStrategy: 'newest'
    };
  }

  /**
   * Ensure the engine is initialized before performing operations
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }
  }

  /**
   * Update the change log with a new change
   */
  public async trackChange(
    dataType: string,
    itemId: string,
    operation: 'create' | 'update' | 'delete'
  ): Promise<void> {
    await this.ensureInitialized();

    // Create or update the entry in the change log
    if (!this.changeLog) {
      this.changeLog = {};
    }

    if (!this.changeLog[dataType]) {
      this.changeLog[dataType] = {};
    }

    this.changeLog[dataType][itemId] = {
      timestamp: Date.now(),
      synced: false,
      operation
    };

    // Save the updated change log
    await AsyncStorage.setItem(CHANGE_LOG_KEY, JSON.stringify(this.changeLog));
  }

  /**
   * Get unsynchronized changes for a specific data type
   */
  public async getUnsyncedChanges(dataType: string): Promise<{ [itemId: string]: ChangeLogEntry }> {
    await this.ensureInitialized();

    if (!this.changeLog || !this.changeLog[dataType]) {
      return {};
    }

    // Filter to items that haven't been synced
    const unsyncedChanges = Object.entries(this.changeLog[dataType])
      .filter(([_, entry]) => !entry.synced)
      .reduce((acc, [itemId, entry]) => {
        acc[itemId] = entry;
        return acc;
      }, {} as { [itemId: string]: ChangeLogEntry });

    return unsyncedChanges;
  }

  /**
   * Mark an item as synced in the change log
   */
  public async markAsSynced(dataType: string, itemId: string): Promise<void> {
    await this.ensureInitialized();

    if (this.changeLog && this.changeLog[dataType] && this.changeLog[dataType][itemId]) {
      this.changeLog[dataType][itemId].synced = true;
      this.changeLog[dataType][itemId].syncTimestamp = Date.now();

      // Save the updated change log
      await AsyncStorage.setItem(CHANGE_LOG_KEY, JSON.stringify(this.changeLog));
    }
  }

  /**
   * Update the last sync timestamp for a data type
   */
  public async updateLastSync(dataType: string): Promise<void> {
    await this.ensureInitialized();

    if (this.metadata) {
      this.metadata.lastSync[dataType] = Date.now();
      await AsyncStorage.setItem(SYNC_METADATA_KEY, JSON.stringify(this.metadata));
    }
  }

  /**
   * Determine which version of data is newer
   */
  public determineNewerData<T extends { id: string; updated_at?: string | number }>(
    localItem: T | null,
    serverItem: T | null
  ): { source: 'local' | 'server' | 'both'; item: T | null } {
    // If one version doesn't exist, the other is newer by default
    if (!localItem && !serverItem) return { source: 'both', item: null };
    if (!localItem) return { source: 'server', item: serverItem };
    if (!serverItem) return { source: 'local', item: localItem };

    // Get timestamps or default to 0
    const localTimestamp = this.getTimestamp(localItem);
    const serverTimestamp = this.getTimestamp(serverItem);

    // Compare timestamps to determine which is newer
    if (localTimestamp > serverTimestamp) {
      return { source: 'local', item: localItem };
    } else if (serverTimestamp > localTimestamp) {
      return { source: 'server', item: serverItem };
    } else {
      // If timestamps are equal, prioritize server data by default
      return { source: 'server', item: serverItem };
    }
  }

  /**
   * Get a timestamp from an item
   */
  private getTimestamp<T extends { updated_at?: string | number }>(item: T): number {
    if (!item.updated_at) return 0;

    if (typeof item.updated_at === 'number') {
      return item.updated_at;
    } else {
      // Try to parse the string timestamp
      try {
        return new Date(item.updated_at).getTime();
      } catch (e) {
        return 0;
      }
    }
  }

  /**
   * Merge conflicting data intelligently
   */
  public mergeConflicts<T extends { id: string }>(localItem: T, serverItem: T): T {
    // Simple field-by-field merge strategy (preferring non-null values)
    const mergedItem = { ...localItem };

    // Merge each field from server item if it exists and local field is null/undefined
    Object.entries(serverItem).forEach(([key, value]) => {
      if (value != null && mergedItem[key as keyof T] == null) {
        mergedItem[key as keyof T] = value as any;
      }
    });

    return mergedItem;
  }

  /**
   * Synchronize data between local storage and Supabase
   * This is the main method for bi-directional synchronization
   */
  public async synchronizeData(
    userId: string,
    dataType: string,
    tableName: string,
    storageKey: string,
    fieldName?: string // Optional field name for JSON data stored in profiles
  ): Promise<{ success: boolean; syncedItems: number; conflicts: number }> {
    await this.ensureInitialized();
    console.log(`🔄 Starting bi-directional sync for ${dataType}...`);

    try {
      // Create result object
      const result = {
        success: false,
        syncedItems: 0,
        conflicts: 0
      };

      // 1. Get the last sync time for this data type
      const lastSyncTime = this.metadata?.lastSync[dataType] || 0;

      // 2. Get local data
      const localDataJson = await AsyncStorage.getItem(storageKey);
      const localData: any[] = localDataJson ? JSON.parse(localDataJson) : [];

      // 3. Create a map of local data by ID for easier lookup
      const localDataMap = localData.reduce((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {} as { [id: string]: any });

      // 4. Get all modifications from our change log
      const unsyncedChanges = await this.getUnsyncedChanges(dataType);

      // Handle differently based on whether this is a direct table or a JSON field in profiles
      if (fieldName) {
        // This is a JSON field in the profiles table (body measurements, nutrition tracking)
        return await this.synchronizeJsonFieldData(
          userId,
          dataType,
          tableName,
          fieldName,
          storageKey,
          localData,
          localDataMap,
          unsyncedChanges,
          lastSyncTime,
          result
        );
      }

      // 5. Get server data that's been updated since the last sync
      const { data: serverData, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('user_id', userId)
        .gt('updated_at', new Date(lastSyncTime).toISOString());

      if (error) {
        console.error(`Error fetching ${dataType} from Supabase:`, error);
        return result;
      }

      // 6. Create a map of server data by ID for easier lookup
      const serverDataMap = (serverData || []).reduce((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {} as { [id: string]: any });

      // 7. Get all IDs from both sources
      const allIds = new Set([
        ...Object.keys(localDataMap),
        ...Object.keys(serverDataMap)
      ]);

      // 8. Process each item
      for (const id of allIds) {
        const localItem = localDataMap[id];
        const serverItem = serverDataMap[id];
        const changeLog = unsyncedChanges[id];

        // Always use the server data for any item that hasn't been modified locally
        if (!changeLog && serverItem) {
          // Server version but no local change - use server version
          if (localItem) {
            // Overwrites local with server if not locally modified
            localDataMap[id] = serverItem;
          } else {
            // Add to local from server
            localData.push(serverItem);
            localDataMap[id] = serverItem;
          }
          result.syncedItems++;
          continue;
        }

        // If we have local changes that haven't been synced
        if (changeLog) {
          if (changeLog.operation === 'create' || changeLog.operation === 'update') {
            // Check for conflicts
            if (serverItem) {
              // Determine which version is newer
              const { source, item } = this.determineNewerData(localItem, serverItem);
              
              if (source === 'local') {
                // Local is newer, push to server
                const { data, error } = await supabase
                  .from(tableName)
                  .upsert({ ...localItem, user_id: userId })
                  .select()
                  .single();
                
                if (!error && data) {
                  // Update local with server ID if needed
                  localDataMap[id] = { ...localItem, server_id: data.id };
                  await this.markAsSynced(dataType, id);
                  result.syncedItems++;
                }
              } else if (source === 'server') {
                // Server is newer, update local
                localDataMap[id] = serverItem;
                await this.markAsSynced(dataType, id);
                result.syncedItems++;
              } else {
                // Needs conflict resolution
                const mergedItem = this.mergeConflicts(localItem, serverItem);
                localDataMap[id] = mergedItem;
                
                // Push merged item to server
                await supabase
                  .from(tableName)
                  .upsert({ ...mergedItem, user_id: userId });
                
                await this.markAsSynced(dataType, id);
                result.conflicts++;
                result.syncedItems++;
              }
            } else {
              // No server version, push local to server
              const { data, error } = await supabase
                .from(tableName)
                .upsert({ ...localItem, user_id: userId })
                .select()
                .single();
              
              if (!error && data) {
                // Update local with server ID
                localDataMap[id] = { ...localItem, server_id: data.id };
                await this.markAsSynced(dataType, id);
                result.syncedItems++;
              }
            }
          } else if (changeLog.operation === 'delete') {
            // Handle delete operations
            if (serverItem) {
              // Delete from server
              await supabase
                .from(tableName)
                .delete()
                .eq('id', id);
            }
            
            // Remove from local
            delete localDataMap[id];
            await this.markAsSynced(dataType, id);
            result.syncedItems++;
          }
        }
      }

      // 9. Rebuild the local data array from the map
      const newLocalData = Object.values(localDataMap);
      
      // 10. Save updated local data
      await AsyncStorage.setItem(storageKey, JSON.stringify(newLocalData));
      
      // 11. Update last sync time
      await this.updateLastSync(dataType);

      console.log(`✅ Bi-directional sync completed for ${dataType}:`, result);
      result.success = true;
      return result;
    } catch (error) {
      console.error(`❌ Error in synchronizeData for ${dataType}:`, error);
      return { success: false, syncedItems: 0, conflicts: 0 };
    }
  }

  /**
   * Synchronize data that is stored as a JSON field in the profiles table
   * This handles body measurements and nutrition tracking which are stored in the profile
   */
  private async synchronizeJsonFieldData(
    userId: string,
    dataType: string,
    tableName: string,
    fieldName: string,
    storageKey: string,
    localData: any[],
    localDataMap: { [id: string]: any },
    unsyncedChanges: { [id: string]: ChangeLogEntry },
    lastSyncTime: number,
    result: { success: boolean; syncedItems: number; conflicts: number }
  ): Promise<{ success: boolean; syncedItems: number; conflicts: number }> {
    try {
      // First get the profile data from Supabase
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select(`id, ${fieldName}, updated_at`)
        .eq('id', userId)
        .single();

      if (error) {
        console.error(`Error fetching profile data for ${dataType}:`, error);
        return result;
      }

      // Extract the JSON array data from the profile field
      // If no data exists yet in this field, create an empty array
      const serverData = profileData?.[fieldName] || [];

      // Create a map of server data by ID
      const serverDataMap = Array.isArray(serverData) 
        ? serverData.reduce((acc, item) => {
            if (item && item.id) {
              acc[item.id] = item;
            }
            return acc;
          }, {} as { [id: string]: any })
        : {};

      // Get all IDs from both sources
      const allIds = new Set([
        ...Object.keys(localDataMap),
        ...Object.keys(serverDataMap)
      ]);

      // Track if we need to update the profile
      let needsProfileUpdate = false;
      
      // Build a new array for the server data
      let newServerData = [...(Array.isArray(serverData) ? serverData : [])];

      // Process each item
      for (const id of allIds) {
        const localItem = localDataMap[id];
        const serverItem = serverDataMap[id];
        const changeLog = unsyncedChanges[id];

        // If server has data and no local changes, use server data
        if (!changeLog && serverItem) {
          if (localItem) {
            // Update local with server data
            localDataMap[id] = serverItem;
          } else {
            // Add server item to local
            localData.push(serverItem);
            localDataMap[id] = serverItem;
          }
          result.syncedItems++;
        }
        // If we have local changes
        else if (changeLog) {
          if (changeLog.operation === 'create' || changeLog.operation === 'update') {
            if (serverItem) {
              // Determine which version is newer
              const { source, item } = this.determineNewerData(localItem, serverItem);
              
              if (source === 'local') {
                // Local is newer, update server data array
                const serverIndex = newServerData.findIndex(item => item.id === id);
                if (serverIndex >= 0) {
                  newServerData[serverIndex] = { ...localItem };
                } else {
                  newServerData.push({ ...localItem });
                }
                needsProfileUpdate = true;
                await this.markAsSynced(dataType, id);
                result.syncedItems++;
              } else if (source === 'server') {
                // Server is newer, update local
                localDataMap[id] = serverItem;
                await this.markAsSynced(dataType, id);
                result.syncedItems++;
              } else {
                // Conflict resolution
                const mergedItem = this.mergeConflicts(localItem, serverItem);
                localDataMap[id] = mergedItem;
                
                // Update server data
                const serverIndex = newServerData.findIndex(item => item.id === id);
                if (serverIndex >= 0) {
                  newServerData[serverIndex] = { ...mergedItem };
                } else {
                  newServerData.push({ ...mergedItem });
                }
                needsProfileUpdate = true;
                
                await this.markAsSynced(dataType, id);
                result.conflicts++;
                result.syncedItems++;
              }
            } else {
              // No server version, add to server array
              newServerData.push({ ...localItem });
              needsProfileUpdate = true;
              await this.markAsSynced(dataType, id);
              result.syncedItems++;
            }
          } else if (changeLog.operation === 'delete') {
            // Remove from server data
            if (serverItem) {
              newServerData = newServerData.filter(item => item.id !== id);
              needsProfileUpdate = true;
            }
            
            // Remove from local
            delete localDataMap[id];
            await this.markAsSynced(dataType, id);
            result.syncedItems++;
          }
        }
      }

      // If changes were made to server data, update the profile
      if (needsProfileUpdate) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            [fieldName]: newServerData,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);

        if (updateError) {
          console.error(`Error updating profile ${fieldName}:`, updateError);
          return { ...result, success: false };
        }
      }

      // Rebuild local data and save to AsyncStorage
      const newLocalData = Object.values(localDataMap);
      await AsyncStorage.setItem(storageKey, JSON.stringify(newLocalData));
      
      // Update last sync time
      await this.updateLastSync(dataType);

      console.log(`✅ JSON field sync completed for ${dataType} in ${fieldName}:`, result);
      return { ...result, success: true };
    } catch (error) {
      console.error(`❌ Error syncing JSON field data for ${dataType}:`, error);
      return { ...result, success: false };
    }
  }
}

// Create a singleton instance for use throughout the app
export const synchronizationEngine = new SynchronizationEngine();
