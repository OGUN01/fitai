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
    console.log('Starting notification service initialization...');

    // Step 1: Set up notification handler and permissions
    const setupSuccess = await NotificationService.setupNotifications();
    if (!setupSuccess) {
      console.log('Notification setup failed - permissions not granted');
      return false;
    }

    console.log('Notification service initialized successfully');

    // Step 2: Check for permission status
    const permissionStatus = await checkNotificationPermissions();
    console.log(`Notification permission status: ${permissionStatus}`);

    // Step 3: Only schedule notifications if permissions are granted
    if (permissionStatus === 'granted') {
      // Get notification settings first
      const settings = await NotificationService.loadNotificationSettings();
      console.log('Current notification settings:', settings);

      // Only re-schedule if at least one notification type is enabled
      if (settings.workoutRemindersEnabled ||
          settings.mealRemindersEnabled ||
          settings.waterRemindersEnabled) {

        // Check if we've already scheduled notifications recently
        const lastScheduled = await AsyncStorage.getItem('last_notification_schedule');
        const scheduleThreshold = 2 * 60 * 60 * 1000; // 2 hours in milliseconds (increased)

        if (!lastScheduled || (Date.now() - parseInt(lastScheduled)) > scheduleThreshold) {
          console.log('Re-scheduling notifications for resilience');

          try {
            await NotificationService.scheduleAllReminders();

            // Record when we last scheduled
            await AsyncStorage.setItem('last_notification_schedule', Date.now().toString());
            console.log('Notifications scheduled successfully');
          } catch (scheduleError) {
            console.error('Error scheduling notifications:', scheduleError);
          }
        } else {
          console.log('Notifications were recently scheduled, skipping re-schedule');
        }
      } else {
        console.log('No notifications enabled, skipping scheduling');
      }
    } else {
      console.log('Notification permissions not granted, skipping scheduling');
    }

    return true;
  } catch (error) {
    console.error('Failed to initialize notification service:', error);
    return false;
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