/**
 * Notification Service Initialization
 * This file automatically initializes the notification service when imported
 */

import NotificationService from './index';

/**
 * Initialize all notification services
 * This function sets up notifications and handles any errors that occur
 */
export async function initializeNotifications() {
  try {
    await NotificationService.setupNotifications();
    console.log('Notification service initialized successfully');
  } catch (error) {
    console.error('Failed to initialize notification service:', error);
  }
}

// Auto-initialize when this module is imported
initializeNotifications();

export default initializeNotifications; 