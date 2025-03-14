import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

/**
 * Utility for managing local data storage and caching
 */
export const StorageUtil = {
  /**
   * Save data to local storage
   * @param key Storage key
   * @param data Data to store
   */
  setItem: async <T>(key: string, data: T): Promise<void> => {
    try {
      const jsonValue = JSON.stringify(data);
      await AsyncStorage.setItem(key, jsonValue);
    } catch (error) {
      console.error('Error saving data to storage:', error);
      throw error;
    }
  },

  /**
   * Get data from local storage
   * @param key Storage key
   * @returns The stored data or null if not found
   */
  getItem: async <T>(key: string): Promise<T | null> => {
    try {
      const jsonValue = await AsyncStorage.getItem(key);
      return jsonValue != null ? JSON.parse(jsonValue) as T : null;
    } catch (error) {
      console.error('Error getting data from storage:', error);
      return null;
    }
  },

  /**
   * Remove data from local storage
   * @param key Storage key
   */
  removeItem: async (key: string): Promise<void> => {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('Error removing data from storage:', error);
      throw error;
    }
  },
  
  /**
   * Clear all data from local storage
   */
  clear: async (): Promise<void> => {
    try {
      await AsyncStorage.clear();
    } catch (error) {
      console.error('Error clearing storage:', error);
      throw error;
    }
  },

  /**
   * Check if network is connected
   * @returns True if connected, false otherwise
   */
  isNetworkConnected: async (): Promise<boolean> => {
    try {
      const state = await NetInfo.fetch();
      return state.isConnected ?? false;
    } catch (error) {
      console.error('Error checking network connection:', error);
      return false;
    }
  },

  /**
   * Get all keys from storage
   * @returns Array of keys
   */
  getAllKeys: async (): Promise<string[]> => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      return [...keys]; // Convert readonly array to mutable array
    } catch (error) {
      console.error('Error getting all keys from storage:', error);
      return [];
    }
  },

  /**
   * Create a cache key for a specific user and data type
   * @param userId User ID
   * @param dataType Type of data
   * @returns Cache key
   */
  createCacheKey: (userId: string, dataType: string): string => {
    return `cache:${userId}:${dataType}`;
  }
};
