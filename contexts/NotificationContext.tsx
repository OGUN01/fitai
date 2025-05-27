import React, { createContext, useContext, useState, useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useProfile } from './ProfileContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Define types for notification preferences
export interface NotificationPreferences {
  workout_notifications: boolean;
  meal_reminders: boolean;
  water_reminders: boolean;
}

interface NotificationContextType {
  preferences: NotificationPreferences;
  updatePreferences: (prefs: Partial<NotificationPreferences>) => Promise<void>;
  requestPermissions: () => Promise<boolean>;
  hasPermissions: boolean;
  loading: boolean;
}

// Create the context
const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Storage key for notification preferences
const NOTIFICATION_PREFS_KEY = 'notification_preferences';

// Default preferences
const DEFAULT_PREFERENCES: NotificationPreferences = {
  workout_notifications: true,
  meal_reminders: true,
  water_reminders: true,
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, updateProfile } = useProfile();
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [loading, setLoading] = useState(true);

  // Initialize notification settings
  useEffect(() => {
    initializeNotifications();
  }, []);

  // Load preferences when profile changes
  useEffect(() => {
    if (profile?.notification_preferences) {
      setPreferences(profile.notification_preferences as NotificationPreferences);
    } else {
      // If no notification preferences in profile, use default preferences
      loadPreferencesFromStorage();
    }
  }, [profile]);

  const initializeNotifications = async () => {
    try {
      // Configure notification behavior
      await Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });

      // Check existing permissions
      const { status } = await Notifications.getPermissionsAsync();
      setHasPermissions(status === 'granted');
      
      // Load saved preferences
      await loadPreferencesFromStorage();
    } catch (error) {
      console.error('Error initializing notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPreferencesFromStorage = async () => {
    try {
      const storedPrefs = await AsyncStorage.getItem(NOTIFICATION_PREFS_KEY);
      if (storedPrefs) {
        const parsedPrefs = JSON.parse(storedPrefs);
        setPreferences(parsedPrefs);
      }
    } catch (error) {
      console.error('Error loading notification preferences:', error);
    }
  };

  const requestPermissions = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      
      const granted = status === 'granted';
      setHasPermissions(granted);
      return granted;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  };

  const updatePreferences = async (newPrefs: Partial<NotificationPreferences>) => {
    try {
      // Update local state
      const updatedPrefs = { ...preferences, ...newPrefs };
      setPreferences(updatedPrefs);

      // Save to AsyncStorage
      await AsyncStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(updatedPrefs));

      // Update profile if authenticated
      if (profile) {
        await updateProfile({
          ...profile,
          notification_preferences: updatedPrefs
        });
      }

      // Schedule or cancel notifications based on new preferences
      await updateNotificationSchedules(updatedPrefs);
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      throw error;
    }
  };

  const updateNotificationSchedules = async (prefs: NotificationPreferences) => {
    // Cancel all existing notifications first
    await Notifications.cancelAllScheduledNotificationsAsync();

    // Schedule new notifications based on preferences
    if (prefs.workout_notifications) {
      // Schedule workout notifications based on workout_preferences
      // This will be implemented in the next step
    }

    if (prefs.meal_reminders) {
      // Schedule meal reminders based on diet_preferences
      // This will be implemented in the next step
    }

    if (prefs.water_reminders) {
      // Schedule water reminders
      // This will be implemented in the next step
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        preferences,
        updatePreferences,
        requestPermissions,
        hasPermissions,
        loading,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

// Custom hook to use the notification context
export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}; 