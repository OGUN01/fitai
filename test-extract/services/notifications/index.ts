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
const DEVICE_STATE_CHECK_KEY = 'fitnessapp:notifications:devicestate';

// Device state check interval (how often to warn about silent mode)
const DEVICE_STATE_CHECK_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 1 week

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

  // Create notification channels for Android
  if (Platform.OS === 'android') {
    await createNotificationChannels();
  }

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
 * Create notification channels for Android
 */
async function createNotificationChannels() {
  // Only create channels on Android
  if (Platform.OS !== 'android') return;

  try {
    // Workout reminder channel - High importance with sound
    await Notifications.setNotificationChannelAsync('workout-reminders', {
      name: 'Workout Reminders',
      description: 'Notifications for your scheduled workouts',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default', // Use default device sound
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2196F3',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });

    // Meal reminder channel - Default importance with sound
    await Notifications.setNotificationChannelAsync('meal-reminders', {
      name: 'Meal Reminders',
      description: 'Notifications for meal tracking and reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default', // Use default device sound
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4CAF50',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });

    // Water reminder channel - Default importance with sound
    await Notifications.setNotificationChannelAsync('water-reminders', {
      name: 'Water Reminders',
      description: 'Reminders to track your water intake',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default', // Use default device sound
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#03A9F4',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });

    console.log('Notification channels created successfully');
  } catch (error) {
    console.error('Error creating notification channels:', error);
  }
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
 * Enhanced to handle multiple workout time formats and locations
 */
function getWorkoutTimesFromProfile(profile: ProfileData): ReminderTime[] {
  console.log('Extracting workout times from profile:', profile?.workout_preferences);

  // Check multiple possible locations for workout times
  let workoutTimes: string[] | undefined;

  // Check workout_preferences.preferred_workout_times
  if (profile?.workout_preferences?.preferred_workout_times?.length) {
    workoutTimes = profile.workout_preferences.preferred_workout_times;
  }

  // Check if there are any workout time preferences in the profile
  if (!workoutTimes && profile?.workout_preferences) {
    // Look for other possible time fields
    const prefs = profile.workout_preferences;
    if (prefs.workout_times && Array.isArray(prefs.workout_times)) {
      workoutTimes = prefs.workout_times;
    } else if (prefs.preferred_times && Array.isArray(prefs.preferred_times)) {
      workoutTimes = prefs.preferred_times;
    }
  }

  if (!workoutTimes || workoutTimes.length === 0) {
    console.log('No workout times found in profile, using default 8 AM');
    return [{ hour: 8, minute: 0 }]; // Default to 8 AM
  }

  const reminderTimes: ReminderTime[] = [];

  for (const timeString of workoutTimes) {
    const parsedTime = parseTimeString(timeString);
    if (parsedTime) {
      reminderTimes.push(parsedTime);
      console.log(`Parsed workout time: ${parsedTime.hour}:${parsedTime.minute}`);
    } else {
      console.warn(`Failed to parse workout time: ${timeString}`);
    }
  }

  const result = reminderTimes.length > 0 ? reminderTimes : [{ hour: 8, minute: 0 }];
  console.log('Final workout reminder times:', result);
  return result;
}

/**
 * Extract meal reminder times from profile data
 * Enhanced to handle multiple meal time formats
 */
function getMealTimesFromProfile(profile: ProfileData): ReminderTime[] {
  console.log('Extracting meal times from profile:', profile?.diet_preferences?.meal_times);

  // Check multiple possible locations for meal times
  let mealTimes = profile?.diet_preferences?.meal_times;

  // If not found in diet_preferences, check root level
  if (!mealTimes && profile?.meal_times) {
    mealTimes = profile.meal_times;
  }

  if (!mealTimes || !Array.isArray(mealTimes) || mealTimes.length === 0) {
    console.log('No meal times found in profile, using defaults');
    return DEFAULT_SETTINGS.mealReminderTimes;
  }

  const reminderTimes: ReminderTime[] = [];

  for (const meal of mealTimes) {
    let timeString: string | undefined;

    if (typeof meal === 'string') {
      // Handle direct time string format like "08:00"
      timeString = meal;
    } else if (meal && typeof meal === 'object') {
      // Handle object format like { name: "Breakfast", time: "08:00" }
      timeString = meal.time;
    }

    if (timeString) {
      const parsedTime = parseTimeString(timeString);
      if (parsedTime) {
        reminderTimes.push(parsedTime);
        console.log(`Parsed meal time: ${parsedTime.hour}:${parsedTime.minute}`);
      } else {
        console.warn(`Failed to parse meal time: ${timeString}`);
      }
    }
  }

  const result = reminderTimes.length > 0 ? reminderTimes : DEFAULT_SETTINGS.mealReminderTimes;
  console.log('Final meal reminder times:', result);
  return result;
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
 * Sync notification settings with profile preferences
 * This should be called when profile is updated
 */
export async function syncNotificationSettingsWithProfile(profile: ProfileData) {
  try {
    console.log('Syncing notification settings with profile preferences');

    const settings = await loadNotificationSettings();

    // Update enabled/disabled status based on profile preferences
    if (profile.notification_preferences) {
      settings.workoutRemindersEnabled = profile.notification_preferences.workout_notifications ?? true;
      settings.mealRemindersEnabled = profile.notification_preferences.meal_reminders ?? true;
      settings.waterRemindersEnabled = profile.notification_preferences.water_reminders ?? true;
    }

    // Update timing based on profile data
    settings.workoutReminderTimes = getWorkoutTimesFromProfile(profile);
    settings.mealReminderTimes = getMealTimesFromProfile(profile);

    // Save updated settings
    await saveNotificationSettings(settings);

    // Re-schedule all notifications with new settings
    await scheduleAllReminders(profile);

    console.log('Notification settings synced successfully');
    return settings;
  } catch (error) {
    console.error('Error syncing notification settings with profile:', error);
    throw error;
  }
}

/**
 * Schedule water reminders based on last log time
 */
async function scheduleWaterReminders(settings: NotificationSettings) {
  if (!settings.waterRemindersEnabled) return;

  try {
    // Cancel existing water reminders only (not all notifications)
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    const waterReminderIds = scheduledNotifications
      .filter(notification => 
        notification.content?.data?.type === ReminderType.WATER ||
        notification.identifier?.startsWith('water_reminder'))
      .map(notification => notification.identifier);
    
    // Cancel only water reminders
    for (const id of waterReminderIds) {
      if (id) await Notifications.cancelScheduledNotificationAsync(id);
    }
    
    // Get current time
    const now = new Date();
    const currentHour = now.getHours();
    
    // Check if current time is within allowed hours (respect cutoff hour)
    if (currentHour >= settings.waterCutoffHour || currentHour < 8) {
      console.log('Outside of water reminder hours, skipping scheduling');
      return;
    }

    // Schedule next reminder based on last log time and cutoff hour
    if (await shouldSendWaterReminder()) {
      // Calculate next reminder time (next hour, but respecting cutoff)
      const nextHour = currentHour + 1;
      
      // Only schedule if next hour is before cutoff
      if (nextHour < settings.waterCutoffHour) {
        await scheduleDailyReminder(
          ReminderType.WATER, 
          nextHour, 
          0,
          undefined,
          'water-reminders' // Use water channel for Android
        );
        console.log(`Water reminder scheduled for ${nextHour}:00`);
      } else {
        console.log('Next water reminder would be after cutoff time, skipping');
      }
    }
  } catch (error) {
    console.error('Error scheduling water reminders:', error);
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
        await scheduleDailyReminder(
          ReminderType.WORKOUT, 
          time.hour, 
          time.minute, 
          undefined,
          Platform.OS === 'android' ? 'workout-reminders' : undefined
        );
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
        await scheduleDailyReminder(
          ReminderType.MEAL, 
          time.hour, 
          time.minute, 
          mealName,
          Platform.OS === 'android' ? 'meal-reminders' : undefined
        );
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
 * Enhanced with better timezone handling and minimum delay
 */
function getSecondsUntilTime(hour: number, minute: number): number {
  const now = new Date();
  const targetTime = new Date();

  // Set target time for today
  targetTime.setHours(hour, minute, 0, 0);

  // If the target time is earlier today, schedule it for tomorrow
  if (targetTime <= now) {
    targetTime.setDate(targetTime.getDate() + 1);
  }

  const secondsUntil = Math.floor((targetTime.getTime() - now.getTime()) / 1000);

  // Ensure we have at least 60 seconds to avoid immediate triggers
  return Math.max(secondsUntil, 60);
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
 * Schedule a single daily reminder using proper daily trigger
 */
async function scheduleDailyReminder(
  type: ReminderType,
  hour: number,
  minute: number,
  mealName?: string,
  channelId?: string
) {
  const identifier = getNotificationIdentifier(type, hour, minute);

  // Set notification content
  const content = {
    title: getNotificationTitle(type),
    body: getNotificationBody(type, mealName),
    data: { type },
    ...(Platform.OS === 'android' && channelId ? { channelId } : {})
  };

  try {
    // Use daily trigger for proper recurring notifications
    await Notifications.scheduleNotificationAsync({
      content,
      trigger: {
        type: SchedulableTriggerInputTypes.DAILY,
        hour: hour,
        minute: minute,
        repeats: true,
      },
      identifier,
    });

    console.log(`Scheduled ${type} reminder for ${hour}:${minute.toString().padStart(2, '0')} with ID: ${identifier}`);
    return identifier;
  } catch (error) {
    console.error(`Error scheduling ${type} reminder:`, error);

    // Fallback to time interval if daily trigger fails
    try {
      const secondsFromNow = getSecondsUntilTime(hour, minute);
      await Notifications.scheduleNotificationAsync({
        content,
        trigger: {
          type: SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: secondsFromNow,
          repeats: true,
        },
        identifier,
      });

      console.log(`Fallback: Scheduled ${type} reminder using interval trigger`);
      return identifier;
    } catch (fallbackError) {
      console.error(`Failed to schedule ${type} reminder with fallback:`, fallbackError);
      throw fallbackError;
    }
  }
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

/**
 * Check device notification state (silent mode, DND)
 * Returns information about potential notification delivery issues
 */
export async function checkDeviceNotificationState(): Promise<{
  hasIssues: boolean;
  silentMode?: boolean;
  doNotDisturb?: boolean;
  message?: string;
}> {
  const result = {
    hasIssues: false,
    silentMode: undefined as boolean | undefined,
    doNotDisturb: undefined as boolean | undefined,
    message: undefined as string | undefined
  };

  try {
    // Last time we checked device state
    const lastCheck = await AsyncStorage.getItem(DEVICE_STATE_CHECK_KEY);
    const now = Date.now();
    
    // Only check once per interval to avoid excessive warnings
    if (lastCheck && (now - parseInt(lastCheck)) < DEVICE_STATE_CHECK_INTERVAL) {
      return result;
    }
    
    // Check if we can detect silent mode (iOS only)
    if (Platform.OS === 'ios') {
      try {
        // Note: This requires the expo-av package
        // We'll check if it's available and only use it if it is
        // This is a simplified version - in a real app, you'd properly import the package
        const { Audio } = require('expo-av');
        const { sound } = await Audio.Sound.createAsync(
          require('../../assets/sounds/silent-check.mp3'),
          { shouldPlay: false }
        );
        
        if (sound) {
          const volume = await sound.getVolumeAsync();
          sound.unloadAsync();
          
          // If volume is 0, device might be in silent mode
          if (volume === 0) {
            result.silentMode = true;
            result.hasIssues = true;
            result.message = 'Your device appears to be in silent mode. Notification sounds may not play.';
          }
        }
      } catch (error) {
        // Silent failure - this is an optional feature
        console.log('Could not check for silent mode:', error);
      }
    }
    
    // Store that we checked
    await AsyncStorage.setItem(DEVICE_STATE_CHECK_KEY, now.toString());
    
    return result;
  } catch (error) {
    console.error('Error checking device notification state:', error);
    return result;
  }
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
  syncNotificationSettingsWithProfile,
  checkDeviceNotificationState,
  ReminderType,
};