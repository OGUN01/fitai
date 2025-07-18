import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/**
 * Platform-specific secure storage implementation
 * Uses SecureStore on native platforms and AsyncStorage on web
 */
export const SecureStorage = {
  /**
   * Get an item from secure storage
   * @param key The key to retrieve
   * @returns The stored value or null if not found
   */
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (Platform.OS === 'web') {
        return await AsyncStorage.getItem(key);
      }
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error('Error getting item from secure storage:', error);
      return null;
    }
  },

  /**
   * Set an item in secure storage
   * @param key The key to store
   * @param value The value to store
   */
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (Platform.OS === 'web') {
        await AsyncStorage.setItem(key, value);
      } else {
        await SecureStore.setItemAsync(key, value);
      }
    } catch (error) {
      console.error('Error setting item in secure storage:', error);
      throw error;
    }
  },

  /**
   * Remove an item from secure storage
   * @param key The key to remove
   */
  deleteItem: async (key: string): Promise<void> => {
    try {
      if (Platform.OS === 'web') {
        await AsyncStorage.removeItem(key);
      } else {
        await SecureStore.deleteItemAsync(key);
      }
    } catch (error) {
      console.error('Error deleting item from secure storage:', error);
      throw error;
    }
  }
}; 