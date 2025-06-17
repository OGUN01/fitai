import React, { createContext, useContext, useState, useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useProfile } from './ProfileContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NotificationService, { ReminderType } from '../services/notifications';

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
    try {
      console.log('Updating notification schedules with preferences:', prefs);

      // Update the notification service settings based on preferences
      if (profile) {
        // Update workout reminders
        await NotificationService.updateReminderSettings(
          ReminderType.WORKOUT,
          prefs.workout_notifications,
          profile
        );

        // Update meal reminders
        await NotificationService.updateReminderSettings(
          ReminderType.MEAL,
          prefs.meal_reminders,
          profile
        );

        // Update water reminders
        await NotificationService.updateReminderSettings(
          ReminderType.WATER,
          prefs.water_reminders,
          profile
        );

        console.log('Notification schedules updated successfully');
      } else {
        console.warn('No profile available for notification scheduling');
      }
    } catch (error) {
      console.error('Error updating notification schedules:', error);
      throw error;
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