import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import supabase from '../lib/supabase';

/**
 * Enhanced Offline Functionality
 * Provides improved offline support with conflict resolution and sync status indicators
 */

export interface SyncStatus {
  isOnline: boolean;
  lastSyncTime?: Date;
  pendingSyncItems: number;
  syncInProgress: boolean;
  conflictsDetected: number;
}

export interface SyncConflict {
  id: string;
  type: 'profile' | 'workout' | 'meal';
  localData: any;
  serverData: any;
  timestamp: Date;
  resolved: boolean;
}

export interface OfflineQueueItem {
  id: string;
  type: 'create' | 'update' | 'delete';
  table: string;
  data: any;
  timestamp: Date;
  retryCount: number;
  maxRetries: number;
}

/**
 * Enhanced network status monitoring
 */
export class NetworkMonitor {
  private static instance: NetworkMonitor;
  private isOnline: boolean = true;
  private listeners: ((isOnline: boolean) => void)[] = [];

  static getInstance(): NetworkMonitor {
    if (!NetworkMonitor.instance) {
      NetworkMonitor.instance = new NetworkMonitor();
    }
    return NetworkMonitor.instance;
  }

  constructor() {
    this.initializeNetworkMonitoring();
  }

  private async initializeNetworkMonitoring() {
    try {
      // Get initial network state
      const netInfo = await NetInfo.fetch();
      this.isOnline = netInfo.isConnected ?? false;

      // Listen for network changes
      NetInfo.addEventListener(state => {
        const wasOnline = this.isOnline;
        this.isOnline = state.isConnected ?? false;

        if (wasOnline !== this.isOnline) {
          console.log(`📶 Network status changed: ${this.isOnline ? 'ONLINE' : 'OFFLINE'}`);
          this.notifyListeners();

          // Trigger sync when coming back online
          if (this.isOnline && !wasOnline) {
            this.handleBackOnline();
          }
        }
      });
    } catch (error) {
      console.error('❌ Error initializing network monitoring:', error);
    }
  }

  private notifyListeners() {
    this.listeners.forEach(listener => {
      try {
        listener(this.isOnline);
      } catch (error) {
        console.error('Error notifying network listener:', error);
      }
    });
  }

  private async handleBackOnline() {
    console.log('🔄 Back online - triggering sync...');
    try {
      await OfflineManager.getInstance().processPendingSync();
    } catch (error) {
      console.error('Error processing pending sync:', error);
    }
  }

  public addListener(listener: (isOnline: boolean) => void) {
    this.listeners.push(listener);
  }

  public removeListener(listener: (isOnline: boolean) => void) {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  public getIsOnline(): boolean {
    return this.isOnline;
  }
}

/**
 * Enhanced offline data management
 */
export class OfflineManager {
  private static instance: OfflineManager;
  private syncQueue: OfflineQueueItem[] = [];
  private conflicts: SyncConflict[] = [];
  private syncInProgress: boolean = false;

  static getInstance(): OfflineManager {
    if (!OfflineManager.instance) {
      OfflineManager.instance = new OfflineManager();
    }
    return OfflineManager.instance;
  }

  constructor() {
    this.loadSyncQueue();
    this.loadConflicts();
  }

  /**
   * Get current sync status
   */
  public async getSyncStatus(): Promise<SyncStatus> {
    const lastSyncTime = await this.getLastSyncTime();
    
    return {
      isOnline: NetworkMonitor.getInstance().getIsOnline(),
      lastSyncTime,
      pendingSyncItems: this.syncQueue.length,
      syncInProgress: this.syncInProgress,
      conflictsDetected: this.conflicts.filter(c => !c.resolved).length
    };
  }

  /**
   * Add item to sync queue for offline processing
   */
  public async addToSyncQueue(item: Omit<OfflineQueueItem, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
    const queueItem: OfflineQueueItem = {
      ...item,
      id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      retryCount: 0
    };

    this.syncQueue.push(queueItem);
    await this.saveSyncQueue();

    console.log(`📝 Added item to sync queue: ${queueItem.type} ${queueItem.table}`);

    // Try to process immediately if online
    if (NetworkMonitor.getInstance().getIsOnline()) {
      this.processPendingSync();
    }
  }

  /**
   * Process pending sync items
   */
  public async processPendingSync(): Promise<void> {
    if (this.syncInProgress || !NetworkMonitor.getInstance().getIsOnline()) {
      return;
    }

    this.syncInProgress = true;
    console.log('🔄 Processing pending sync items...');

    try {
      const itemsToProcess = [...this.syncQueue];
      
      for (const item of itemsToProcess) {
        try {
          await this.processSyncItem(item);
          
          // Remove from queue on success
          this.syncQueue = this.syncQueue.filter(q => q.id !== item.id);
          
        } catch (error) {
          console.error(`❌ Error processing sync item ${item.id}:`, error);
          
          // Increment retry count
          const queueItem = this.syncQueue.find(q => q.id === item.id);
          if (queueItem) {
            queueItem.retryCount++;
            
            // Remove if max retries exceeded
            if (queueItem.retryCount >= queueItem.maxRetries) {
              console.warn(`⚠️ Max retries exceeded for sync item ${item.id}, removing from queue`);
              this.syncQueue = this.syncQueue.filter(q => q.id !== item.id);
            }
          }
        }
      }

      await this.saveSyncQueue();
      await this.setLastSyncTime(new Date());
      
      console.log('✅ Sync processing completed');
      
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Process individual sync item
   */
  private async processSyncItem(item: OfflineQueueItem): Promise<void> {
    console.log(`🔄 Processing sync item: ${item.type} ${item.table}`);

    switch (item.type) {
      case 'create':
        await supabase.from(item.table).insert(item.data);
        break;
      case 'update':
        await supabase.from(item.table).update(item.data).eq('id', item.data.id);
        break;
      case 'delete':
        await supabase.from(item.table).delete().eq('id', item.data.id);
        break;
    }
  }

  /**
   * Detect and handle sync conflicts
   */
  public async detectConflicts(localData: any, serverData: any, type: string): Promise<SyncConflict | null> {
    if (!localData || !serverData) {
      return null;
    }

    // Simple conflict detection based on updated_at timestamps
    const localUpdated = new Date(localData.updated_at || 0);
    const serverUpdated = new Date(serverData.updated_at || 0);

    if (localUpdated.getTime() !== serverUpdated.getTime()) {
      const conflict: SyncConflict = {
        id: `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: type as any,
        localData,
        serverData,
        timestamp: new Date(),
        resolved: false
      };

      this.conflicts.push(conflict);
      await this.saveConflicts();

      console.log(`⚠️ Sync conflict detected for ${type}`);
      return conflict;
    }

    return null;
  }

  /**
   * Resolve sync conflict
   */
  public async resolveConflict(conflictId: string, resolution: 'local' | 'server' | 'merge'): Promise<void> {
    const conflict = this.conflicts.find(c => c.id === conflictId);
    if (!conflict) {
      throw new Error('Conflict not found');
    }

    let resolvedData: any;

    switch (resolution) {
      case 'local':
        resolvedData = conflict.localData;
        break;
      case 'server':
        resolvedData = conflict.serverData;
        break;
      case 'merge':
        resolvedData = this.mergeConflictData(conflict.localData, conflict.serverData);
        break;
    }

    // Apply resolution
    await this.addToSyncQueue({
      type: 'update',
      table: this.getTableForType(conflict.type),
      data: resolvedData,
      maxRetries: 3
    });

    // Mark conflict as resolved
    conflict.resolved = true;
    await this.saveConflicts();

    console.log(`✅ Conflict ${conflictId} resolved using ${resolution} strategy`);
  }

  /**
   * Merge conflict data (simple merge strategy)
   */
  private mergeConflictData(localData: any, serverData: any): any {
    // Simple merge: prefer local data but keep server timestamps
    return {
      ...serverData,
      ...localData,
      updated_at: new Date().toISOString()
    };
  }

  /**
   * Get table name for conflict type
   */
  private getTableForType(type: string): string {
    switch (type) {
      case 'profile':
        return 'profiles';
      case 'workout':
        return 'workout_completions';
      case 'meal':
        return 'meal_completions';
      default:
        return 'profiles';
    }
  }

  /**
   * Get unresolved conflicts
   */
  public getUnresolvedConflicts(): SyncConflict[] {
    return this.conflicts.filter(c => !c.resolved);
  }

  /**
   * Clear resolved conflicts
   */
  public async clearResolvedConflicts(): Promise<void> {
    this.conflicts = this.conflicts.filter(c => !c.resolved);
    await this.saveConflicts();
  }

  // Storage methods
  private async loadSyncQueue(): Promise<void> {
    try {
      const queueData = await AsyncStorage.getItem('offline_sync_queue');
      if (queueData) {
        this.syncQueue = JSON.parse(queueData);
      }
    } catch (error) {
      console.error('Error loading sync queue:', error);
    }
  }

  private async saveSyncQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem('offline_sync_queue', JSON.stringify(this.syncQueue));
    } catch (error) {
      console.error('Error saving sync queue:', error);
    }
  }

  private async loadConflicts(): Promise<void> {
    try {
      const conflictsData = await AsyncStorage.getItem('sync_conflicts');
      if (conflictsData) {
        this.conflicts = JSON.parse(conflictsData);
      }
    } catch (error) {
      console.error('Error loading conflicts:', error);
    }
  }

  private async saveConflicts(): Promise<void> {
    try {
      await AsyncStorage.setItem('sync_conflicts', JSON.stringify(this.conflicts));
    } catch (error) {
      console.error('Error saving conflicts:', error);
    }
  }

  private async getLastSyncTime(): Promise<Date | undefined> {
    try {
      const timeStr = await AsyncStorage.getItem('last_sync_time');
      return timeStr ? new Date(timeStr) : undefined;
    } catch (error) {
      console.error('Error getting last sync time:', error);
      return undefined;
    }
  }

  private async setLastSyncTime(time: Date): Promise<void> {
    try {
      await AsyncStorage.setItem('last_sync_time', time.toISOString());
    } catch (error) {
      console.error('Error setting last sync time:', error);
    }
  }
}

/**
 * Initialize offline enhancements
 */
export function initializeOfflineEnhancements(): void {
  console.log('🚀 Initializing offline enhancements...');
  
  // Initialize network monitor
  NetworkMonitor.getInstance();
  
  // Initialize offline manager
  OfflineManager.getInstance();
  
  console.log('✅ Offline enhancements initialized');
}

/**
 * Get sync status for UI display
 */
export async function getSyncStatusForUI(): Promise<SyncStatus> {
  return await OfflineManager.getInstance().getSyncStatus();
}

/**
 * Force sync when user requests it
 */
export async function forceSyncNow(): Promise<void> {
  console.log('🔄 Force sync requested by user...');
  await OfflineManager.getInstance().processPendingSync();
}
