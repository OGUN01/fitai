import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format, parse, isBefore, isAfter, addHours, set } from 'date-fns';

// Import required from Expo Notifications
const { SchedulableTriggerInputTypes } = Notifications;

// AsyncStorage keys
const NOTIFICATION_SETTINGS_KEY = 'fitnessapp:notifications:settings';
const LAST_WATER_LOG_KEY = 'fitnessapp:water:lastlog';

// Reminder Types
export enum ReminderType {
  WORKOUT = 'workout',
  MEAL = 'meal',
  WATER = 'water',
}

// Time formats for reminders
export interface ReminderTime {
  hour: number;
  minute: number;
}

// Settings interface
export interface NotificationSettings {
  workoutRemindersEnabled: boolean;
  mealRemindersEnabled: boolean;
  waterRemindersEnabled: boolean;
  workoutReminderTimes: ReminderTime[];
  mealReminderTimes: ReminderTime[];
  waterHourlyRemindersEnabled: boolean;
  waterCutoffHour: number;
  lastWaterLogTime: string | null;
}

// Default notification settings
const DEFAULT_SETTINGS: NotificationSettings = {
  workoutRemindersEnabled: true,
  mealRemindersEnabled: true,
  waterRemindersEnabled: true,
  workoutReminderTimes: [{ hour: 8, minute: 0 }],
  mealReminderTimes: [
    { hour: 8, minute: 0 },
    { hour: 13, minute: 0 },
    { hour: 19, minute: 0 },
  ],
  waterHourlyRemindersEnabled: true,
  waterCutoffHour: 21, // 9 PM cutoff
  lastWaterLogTime: null // Track last water log time
};

// Profile types for accessing workout and meal preferences
interface WorkoutPreferences {
  preferred_days?: string[];
  preferred_workout_times?: string[];
  [key: string]: any;
}

interface MealTime {
  name: string;
  time: string;
}

interface ProfileData {
  workout_preferences?: WorkoutPreferences;
  diet_preferences?: {
    meal_times?: MealTime[];
    [key: string]: any;
  };
  workout_tracking?: {
    water_tracking?: {
      logs?: Array<{
        amount: number;
        timestamp: string;
      }>;
      [key: string]: any;
    };
    [key: string]: any;
  };
  [key: string]: any;
}

/**
 * Set up notification handlers and permissions
 */
export async function setupNotifications() {
  // Configure how notifications appear when the app is in the foreground
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });

  // Request permissions for notifications
  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Failed to get notification permissions');
      return false;
    }
    
    return true;
  }
  
  return false;
}

/**
 * Save notification settings to AsyncStorage
 */
export async function saveNotificationSettings(settings: NotificationSettings) {
  try {
    await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch (error) {
    console.error('Error saving notification settings:', error);
    return false;
  }
}

/**
 * Load notification settings from AsyncStorage
 */
export async function loadNotificationSettings(): Promise<NotificationSettings> {
  try {
    const settingsJson = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
    if (settingsJson) {
      return JSON.parse(settingsJson);
    }
    
    // If no settings found, save and return defaults
    await saveNotificationSettings(DEFAULT_SETTINGS);
    return DEFAULT_SETTINGS;
  } catch (error) {
    console.error('Error loading notification settings:', error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Parse time string (like "8:00 AM") into hour and minute values
 */
function parseTimeString(timeString: string): ReminderTime | null {
  try {
    // Handle different time formats that might exist in the profile
    let parsedTime;
    
    // Try parsing with AM/PM format
    try {
      parsedTime = parse(timeString, 'h:mm a', new Date());
    } catch (error) {
      // Try 24-hour format
      try {
        parsedTime = parse(timeString, 'HH:mm', new Date());
      } catch (error) {
        // Try just hour (like "8" for 8:00 AM)
        try {
          parsedTime = parse(timeString, 'H', new Date());
        } catch (error) {
          console.error(`Could not parse time: ${timeString}`);
          return null;
        }
      }
    }
    
    if (parsedTime && !isNaN(parsedTime.getTime())) {
      return {
        hour: parsedTime.getHours(),
        minute: parsedTime.getMinutes(),
      };
    }
    
    return null;
  } catch (error) {
    console.error(`Error parsing time string: ${timeString}`, error);
    return null;
  }
}

/**
 * Extract workout reminder times from profile data
 */
function getWorkoutTimesFromProfile(profile: ProfileData): ReminderTime[] {
  if (!profile?.workout_preferences?.preferred_workout_times?.length) {
    return [{ hour: 8, minute: 0 }]; // Default to 8 AM
  }
  
  const reminderTimes: ReminderTime[] = [];
  
  for (const timeString of profile.workout_preferences.preferred_workout_times) {
    const parsedTime = parseTimeString(timeString);
    if (parsedTime) {
      reminderTimes.push(parsedTime);
    }
  }
  
  return reminderTimes.length > 0 ? reminderTimes : [{ hour: 8, minute: 0 }];
}

/**
 * Extract meal reminder times from profile data
 */
function getMealTimesFromProfile(profile: ProfileData): ReminderTime[] {
  if (!profile?.diet_preferences?.meal_times?.length) {
    return DEFAULT_SETTINGS.mealReminderTimes;
  }
  
  const reminderTimes: ReminderTime[] = [];
  
  for (const meal of profile.diet_preferences.meal_times) {
    const timeString = typeof meal === 'string' ? meal : meal.time;
    if (timeString) {
      const parsedTime = parseTimeString(timeString);
      if (parsedTime) {
        reminderTimes.push(parsedTime);
      }
    }
  }
  
  return reminderTimes.length > 0 ? reminderTimes : DEFAULT_SETTINGS.mealReminderTimes;
}

/**
 * Check if water reminder should be sent based on last log
 */
async function shouldSendWaterReminder(): Promise<boolean> {
  const settings = await loadNotificationSettings();
  if (!settings.lastWaterLogTime) return true;
  
  const lastLog = new Date(settings.lastWaterLogTime);
  const now = new Date();
  const hoursSinceLastLog = (now.getTime() - lastLog.getTime()) / (1000 * 60 * 60);
  
  return hoursSinceLastLog >= 1;
}

/**
 * Update last water log time
 */
export async function updateLastWaterLogTime() {
  const settings = await loadNotificationSettings();
  settings.lastWaterLogTime = new Date().toISOString();
  await saveNotificationSettings(settings);
}

/**
 * Schedule water reminders based on last log time
 */
async function scheduleWaterReminders(settings: NotificationSettings) {
  if (!settings.waterRemindersEnabled) return;

  // Cancel existing water reminders
  await Notifications.cancelAllScheduledNotificationsAsync();

  // Schedule next reminder based on last log time
  if (await shouldSendWaterReminder()) {
    await scheduleDailyReminder(ReminderType.WATER, new Date().getHours() + 1, 0);
  }
}

/**
 * Schedule all enabled reminders based on current settings
 */
export async function scheduleAllReminders(profile?: ProfileData) {
  try {
    // First cancel all existing scheduled notifications
    await cancelAllReminders();
    
    // Load current settings
    const settings = await loadNotificationSettings();
    
    // Update settings from profile if provided
    if (profile) {
      settings.workoutReminderTimes = getWorkoutTimesFromProfile(profile);
      settings.mealReminderTimes = getMealTimesFromProfile(profile);
      await saveNotificationSettings(settings);
    }
    
    // Schedule workout reminders if enabled
    if (settings.workoutRemindersEnabled) {
      for (const time of settings.workoutReminderTimes) {
        await scheduleDailyReminder(ReminderType.WORKOUT, time.hour, time.minute);
      }
    }
    
    // Schedule meal reminders if enabled
    if (settings.mealRemindersEnabled) {
      // Get meal names if profile is provided
      const mealNames: string[] = [];
      
      if (profile?.diet_preferences?.meal_times) {
        for (const meal of profile.diet_preferences.meal_times) {
          if (typeof meal === 'string') {
            mealNames.push('Meal');
          } else {
            mealNames.push(meal.name || 'Meal');
          }
        }
      }
      
      for (let i = 0; i < settings.mealReminderTimes.length; i++) {
        const time = settings.mealReminderTimes[i];
        const mealName = mealNames[i] || undefined;
        await scheduleDailyReminder(ReminderType.MEAL, time.hour, time.minute, mealName);
      }
    }
    
    // Schedule water reminders if enabled
    if (settings.waterRemindersEnabled) {
      await scheduleWaterReminders(settings);
    }
    
    return true;
  } catch (error) {
    console.error('Error scheduling reminders:', error);
    return false;
  }
}

/**
 * Get the current enabled status for a specific reminder type
 */
export async function getReminderEnabledStatus(type: ReminderType): Promise<boolean> {
  const settings = await loadNotificationSettings();
  
  switch (type) {
    case ReminderType.WORKOUT:
      return settings.workoutRemindersEnabled;
    case ReminderType.MEAL:
      return settings.mealRemindersEnabled;
    case ReminderType.WATER:
      return settings.waterRemindersEnabled;
    default:
      return false;
  }
}

/**
 * Generate a unique identifier for notifications based on type and time
 */
function getNotificationIdentifier(type: ReminderType, hour?: number, minute?: number, index?: number) {
  if (hour !== undefined && minute !== undefined) {
    return `${type}_reminder_${hour}_${minute}`;
  }
  
  if (index !== undefined) {
    return `${type}_reminder_${index}`;
  }
  
  return `${type}_reminder`;
}

/**
 * Get the notification title based on reminder type
 */
function getNotificationTitle(type: ReminderType) {
  switch (type) {
    case ReminderType.WORKOUT:
      return 'Workout Reminder';
    case ReminderType.MEAL:
      return 'Meal Reminder';
    case ReminderType.WATER:
      return 'Hydration Reminder';
    default:
      return 'Reminder';
  }
}

/**
 * Get the notification body based on reminder type
 */
function getNotificationBody(type: ReminderType, mealName?: string) {
  switch (type) {
    case ReminderType.WORKOUT:
      return 'Time to get moving! Your workout is waiting for you.';
    case ReminderType.MEAL:
      return mealName 
        ? `Time for your ${mealName}. Remember to eat healthy!` 
        : 'Time for your meal. Remember to eat healthy!';
    case ReminderType.WATER:
      return 'Stay hydrated! Time to drink some water.';
    default:
      return 'Don\'t forget your health goals for today!';
  }
}

/**
 * Calculate seconds until next occurrence of specified hour and minute
 */
function getSecondsUntilTime(hour: number, minute: number): number {
  const now = new Date();
  const targetTime = new Date();
  
  targetTime.setHours(hour, minute, 0, 0);
  
  // If the target time is earlier today, schedule it for tomorrow
  if (targetTime <= now) {
    targetTime.setDate(targetTime.getDate() + 1);
  }
  
  return Math.floor((targetTime.getTime() - now.getTime()) / 1000);
}

/**
 * Calculate seconds until the next hour
 */
function getSecondsUntilNextHour(): number {
  const now = new Date();
  const nextHour = new Date(now);
  
  // Set to the beginning of the next hour
  nextHour.setHours(now.getHours() + 1, 0, 0, 0);
  
  return Math.floor((nextHour.getTime() - now.getTime()) / 1000);
}

/**
 * Schedule a single daily reminder
 */
async function scheduleDailyReminder(
  type: ReminderType, 
  hour: number, 
  minute: number, 
  mealName?: string
) {
  const identifier = getNotificationIdentifier(type, hour, minute);
  
  // Set notification content
  const content = {
    title: getNotificationTitle(type),
    body: getNotificationBody(type, mealName),
    data: { type },
  };

  // Get seconds until the specified time
  const secondsFromNow = getSecondsUntilTime(hour, minute);
  
  // Schedule using time interval trigger with the required type property
  await Notifications.scheduleNotificationAsync({
    content,
    trigger: {
      type: SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: secondsFromNow,
      repeats: true,
    },
    identifier,
  });
  
  return identifier;
}

/**
 * Cancel all scheduled reminders
 */
export async function cancelAllReminders() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Update reminder settings for a specific type
 */
export async function updateReminderSettings(
  type: ReminderType, 
  enabled: boolean,
  profile?: ProfileData
) {
  const settings = await loadNotificationSettings();
  
  switch (type) {
    case ReminderType.WORKOUT:
      settings.workoutRemindersEnabled = enabled;
      if (profile) {
        settings.workoutReminderTimes = getWorkoutTimesFromProfile(profile);
      }
      break;
    case ReminderType.MEAL:
      settings.mealRemindersEnabled = enabled;
      if (profile) {
        settings.mealReminderTimes = getMealTimesFromProfile(profile);
      }
      break;
    case ReminderType.WATER:
      settings.waterRemindersEnabled = enabled;
      break;
  }
  
  await saveNotificationSettings(settings);
  await scheduleAllReminders(profile);
  
  return settings;
}

/**
 * Update all notification settings with profile data
 */
export async function updateAllNotificationSettings(profile: ProfileData) {
  const settings = await loadNotificationSettings();
  
  // Update workout and meal times based on profile data
  settings.workoutReminderTimes = getWorkoutTimesFromProfile(profile);
  settings.mealReminderTimes = getMealTimesFromProfile(profile);
  
  await saveNotificationSettings(settings);
  await scheduleAllReminders(profile);
  
  return settings;
}

/**
 * Check if the user has logged water within the last hour
 */
export async function hasLoggedWaterRecently(): Promise<boolean> {
  const settings = await loadNotificationSettings();
  if (!settings.lastWaterLogTime) return false;
  
  const lastLog = new Date(settings.lastWaterLogTime);
  const now = new Date();
  const hoursSinceLastLog = (now.getTime() - lastLog.getTime()) / (1000 * 60 * 60);
  
  return hoursSinceLastLog < 1;
}

// Export a default object with all notification functions
export default {
  setupNotifications,
  loadNotificationSettings,
  saveNotificationSettings,
  updateReminderSettings,
  updateAllNotificationSettings,
  scheduleAllReminders,
  cancelAllReminders,
  getReminderEnabledStatus,
  hasLoggedWaterRecently,
  updateLastWaterLogTime,
  ReminderType,
}; 