import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Switch, Text, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useProfile } from '../../contexts/ProfileContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { router } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import NotificationService from '../../services/notifications';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Default notification preferences
const DEFAULT_PREFERENCES = {
  workout_notifications: true,
  meal_reminders: true,
  water_reminders: true
};

export default function NotificationsScreen() {
  const { profile: userProfile, updateProfile } = useProfile();
  const { hasPermissions, requestPermissions } = useNotifications();
  const [deviceState, setDeviceState] = useState<{
    hasIssues: boolean;
    message?: string;
  }>({ hasIssues: false });
  const [testingNotification, setTestingNotification] = useState(false);

  // Ensure notification preferences exist with defaults
  const notificationPreferences = userProfile?.notification_preferences || DEFAULT_PREFERENCES;
  
  // Initialize notification preferences if they don't exist
  useEffect(() => {
    if (userProfile && !userProfile.notification_preferences) {
      updateProfile({
        notification_preferences: DEFAULT_PREFERENCES
      });
    }
  }, [userProfile]);

  // Check device state on mount
  useEffect(() => {
    checkDeviceState();
  }, []);

  // Check device notification state (silent mode, etc.)
  const checkDeviceState = async () => {
    try {
      const state = await NotificationService.checkDeviceNotificationState();
      setDeviceState(state);
    } catch (error) {
      console.error('Error checking device state:', error);
    }
  };

  const handleToggleNotification = async (type: keyof typeof DEFAULT_PREFERENCES) => {
    if (!userProfile) return;

    if (!hasPermissions) {
      const granted = await requestPermissions();
      if (!granted) {
        Alert.alert(
          "Notifications Disabled",
          "Please enable notifications in your device settings to receive reminders.",
          [{ text: "OK" }]
        );
        return;
      }
    }

    const updatedPreferences = {
      ...notificationPreferences,
      [type]: !notificationPreferences[type],
    };

    try {
      // Update profile with new preferences
      await updateProfile({
        ...userProfile,
        notification_preferences: updatedPreferences,
      });

      // Update notification service settings based on the type
      const reminderType = type === 'workout_notifications' ? NotificationService.ReminderType.WORKOUT :
                          type === 'meal_reminders' ? NotificationService.ReminderType.MEAL :
                          NotificationService.ReminderType.WATER;

      await NotificationService.updateReminderSettings(
        reminderType,
        updatedPreferences[type],
        userProfile
      );

      console.log(`Updated ${type} to ${updatedPreferences[type]}`);
    } catch (error) {
      console.error("Failed to update notification preferences:", error);
      Alert.alert("Error", "Failed to update notification preferences. Please try again.");
    }
  };

  // Send a test notification to verify if notifications work
  const sendTestNotification = async (type: string) => {
    if (!hasPermissions) {
      const granted = await requestPermissions();
      if (!granted) {
        Alert.alert(
          "Notifications Disabled",
          "Please enable notifications in your device settings to receive reminders.",
          [{ text: "OK" }]
        );
        return;
      }
    }

    setTestingNotification(true);

    try {
      let title = "Test Notification";
      let body = "This is a test notification to verify your notification settings.";
      let channelId: string | undefined = undefined;

      switch (type) {
        case 'workout':
          title = "Workout Reminder Test";
          body = "This is a test workout reminder notification.";
          channelId = 'workout-reminders';
          break;
        case 'meal':
          title = "Meal Reminder Test";
          body = "This is a test meal reminder notification.";
          channelId = 'meal-reminders';
          break;
        case 'water':
          title = "Water Reminder Test";
          body = "This is a test water reminder notification.";
          channelId = 'water-reminders';
          break;
      }

      // Send the test notification
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: true,
          ...(channelId && Platform.OS === 'android' ? { channelId } : {})
        },
        trigger: null // Send immediately
      });

      // Notify user in UI that test notification was sent
      Alert.alert(
        "Test Notification Sent",
        "Please check if you received the notification with sound.",
        [{ text: "OK" }]
      );
    } catch (error) {
      console.error('Error sending test notification:', error);
      Alert.alert("Error", "Failed to send test notification. Please try again.");
    } finally {
      setTestingNotification(false);
    }
  };

  if (!userProfile) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
      </View>

      {deviceState.hasIssues && (
        <View style={styles.warningBanner}>
          <MaterialIcons name="warning" size={24} color="#f39c12" />
          <Text style={styles.warningText}>{deviceState.message || "Notification issues detected"}</Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Workout Reminders</Text>
        <View style={styles.settingItem}>
          <View>
            <Text style={styles.settingLabel}>Workout Notifications</Text>
            <Text style={styles.settingDescription}>Get reminded about your scheduled workouts</Text>
          </View>
          <Switch
            value={notificationPreferences.workout_notifications}
            onValueChange={() => handleToggleNotification('workout_notifications')}
            trackColor={{ false: '#767577', true: '#81b0ff' }}
            thumbColor={notificationPreferences.workout_notifications ? '#2f95dc' : '#f4f3f4'}
          />
        </View>
        {notificationPreferences.workout_notifications && (
          <TouchableOpacity
            style={styles.testButton}
            onPress={() => sendTestNotification('workout')}
            disabled={testingNotification}
          >
            <Text style={styles.testButtonText}>Test Workout Notification</Text>
            {testingNotification && <ActivityIndicator size="small" color="#fff" style={styles.loader} />}
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Meal Tracking</Text>
        <View style={styles.settingItem}>
          <View>
            <Text style={styles.settingLabel}>Meal Reminders</Text>
            <Text style={styles.settingDescription}>Get reminded to log your meals</Text>
          </View>
          <Switch
            value={notificationPreferences.meal_reminders}
            onValueChange={() => handleToggleNotification('meal_reminders')}
            trackColor={{ false: '#767577', true: '#81b0ff' }}
            thumbColor={notificationPreferences.meal_reminders ? '#2f95dc' : '#f4f3f4'}
          />
        </View>
        {notificationPreferences.meal_reminders && (
          <TouchableOpacity
            style={styles.testButton}
            onPress={() => sendTestNotification('meal')}
            disabled={testingNotification}
          >
            <Text style={styles.testButtonText}>Test Meal Notification</Text>
            {testingNotification && <ActivityIndicator size="small" color="#fff" style={styles.loader} />}
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Water Tracking</Text>
        <View style={styles.settingItem}>
          <View>
            <Text style={styles.settingLabel}>Water Intake Reminders</Text>
            <Text style={styles.settingDescription}>Get reminded to track your water intake</Text>
          </View>
          <Switch
            value={notificationPreferences.water_reminders}
            onValueChange={() => handleToggleNotification('water_reminders')}
            trackColor={{ false: '#767577', true: '#81b0ff' }}
            thumbColor={notificationPreferences.water_reminders ? '#2f95dc' : '#f4f3f4'}
          />
        </View>
        {notificationPreferences.water_reminders && (
          <TouchableOpacity
            style={styles.testButton}
            onPress={() => sendTestNotification('water')}
            disabled={testingNotification}
          >
            <Text style={styles.testButtonText}>Test Water Notification</Text>
            {testingNotification && <ActivityIndicator size="small" color="#fff" style={styles.loader} />}
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 20,
    textAlign: 'center',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  settingLabel: {
    fontSize: 16,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
    maxWidth: '80%',
  },
  warningBanner: {
    backgroundColor: '#fff9e6',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#f39c12',
  },
  warningText: {
    marginLeft: 8,
    color: '#333',
    flex: 1,
  },
  testButton: {
    backgroundColor: '#2f95dc',
    padding: 10,
    borderRadius: 6,
    marginTop: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  testButtonText: {
    color: '#fff',
    fontWeight: '500',
  },
  loader: {
    marginLeft: 8,
  },
}); 