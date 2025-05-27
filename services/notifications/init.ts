/**
 * Notification Service Initialization
 * This file automatically initializes the notification service when imported
 */

import NotificationService from './index';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

/**
 * Initialize all notification services
 * This function sets up notifications and handles any errors that occur
 */
export async function initializeNotifications() {
  try {
    // Step 1: Set up notification handler
    await NotificationService.setupNotifications();
    console.log('Notification service initialized successfully');
    
    // Step 2: Check for permission status
    const permissionStatus = await checkNotificationPermissions();
    console.log(`Notification permission status: ${permissionStatus}`);
    
    // Step 3: Re-schedule notifications for resilience
    // This ensures notifications persist after app restarts or updates
    if (permissionStatus === 'granted') {
      // Get notification settings first
      const settings = await NotificationService.loadNotificationSettings();
      
      // Only re-schedule if at least one notification type is enabled
      if (settings.workoutRemindersEnabled || 
          settings.mealRemindersEnabled || 
          settings.waterRemindersEnabled) {
        
        // Check if we've already scheduled notifications recently
        const lastScheduled = await AsyncStorage.getItem('last_notification_schedule');
        const scheduleThreshold = 1 * 60 * 60 * 1000; // 1 hour in milliseconds
        
        if (!lastScheduled || (Date.now() - parseInt(lastScheduled)) > scheduleThreshold) {
          console.log('Re-scheduling notifications for resilience');
          await NotificationService.scheduleAllReminders();
          
          // Record when we last scheduled
          await AsyncStorage.setItem('last_notification_schedule', Date.now().toString());
        } else {
          console.log('Notifications were recently scheduled, skipping re-schedule');
        }
      }
    }
  } catch (error) {
    console.error('Failed to initialize notification service:', error);
  }
}

/**
 * Check notification permission status
 * Returns the current permission status as a string
 */
async function checkNotificationPermissions() {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status;
  } catch (error) {
    console.error('Error checking notification permissions:', error);
    return 'error';
  }
}

// Auto-initialize when this module is imported
initializeNotifications();

export default initializeNotifications; 