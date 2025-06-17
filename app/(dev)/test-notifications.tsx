import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import NotificationService, { ReminderType } from '../../services/notifications';
import { useProfile } from '../../contexts/ProfileContext';

export default function TestNotificationsScreen() {
  const router = useRouter();
  const { profile } = useProfile();
  const [permissionStatus, setPermissionStatus] = useState<string>('unknown');
  const [scheduledNotifications, setScheduledNotifications] = useState<any[]>([]);
  const [notificationSettings, setNotificationSettings] = useState<any>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    loadNotificationInfo();
  }, []);

  const loadNotificationInfo = async () => {
    try {
      // Check permissions
      const { status } = await Notifications.getPermissionsAsync();
      setPermissionStatus(status);

      // Get scheduled notifications
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      setScheduledNotifications(scheduled);

      // Get notification settings
      const settings = await NotificationService.loadNotificationSettings();
      setNotificationSettings(settings);
    } catch (error) {
      console.error('Error loading notification info:', error);
    }
  };

  const requestPermissions = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      setPermissionStatus(status);
      Alert.alert('Permission Status', `Notification permissions: ${status}`);
    } catch (error) {
      console.error('Error requesting permissions:', error);
      Alert.alert('Error', 'Failed to request permissions');
    }
  };

  const testNotificationScheduling = async () => {
    if (!profile) {
      Alert.alert('Error', 'No profile available for testing');
      return;
    }

    setTesting(true);
    try {
      console.log('Testing notification scheduling with profile:', profile);
      
      // Test scheduling all reminders
      await NotificationService.scheduleAllReminders(profile);
      
      // Reload info
      await loadNotificationInfo();
      
      Alert.alert('Success', 'Notifications scheduled successfully! Check the scheduled notifications list below.');
    } catch (error) {
      console.error('Error testing notification scheduling:', error);
      Alert.alert('Error', `Failed to schedule notifications: ${error.message}`);
    } finally {
      setTesting(false);
    }
  };

  const sendTestNotification = async () => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Test Notification',
          body: 'This is a test notification from FitAI',
          sound: true,
        },
        trigger: null, // Send immediately
      });
      
      Alert.alert('Test Sent', 'Test notification sent immediately');
    } catch (error) {
      console.error('Error sending test notification:', error);
      Alert.alert('Error', 'Failed to send test notification');
    }
  };

  const clearAllNotifications = async () => {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      await loadNotificationInfo();
      Alert.alert('Success', 'All scheduled notifications cleared');
    } catch (error) {
      console.error('Error clearing notifications:', error);
      Alert.alert('Error', 'Failed to clear notifications');
    }
  };

  const syncNotificationSettings = async () => {
    if (!profile) {
      Alert.alert('Error', 'No profile available for syncing');
      return;
    }

    try {
      await NotificationService.syncNotificationSettingsWithProfile(profile);
      await loadNotificationInfo();
      Alert.alert('Success', 'Notification settings synced with profile');
    } catch (error) {
      console.error('Error syncing notification settings:', error);
      Alert.alert('Error', `Failed to sync settings: ${error.message}`);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Notification Testing</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Permission Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Permission Status</Text>
          <Text style={styles.statusText}>
            Status: {permissionStatus}
          </Text>
          <TouchableOpacity style={styles.button} onPress={requestPermissions}>
            <Text style={styles.buttonText}>Request Permissions</Text>
          </TouchableOpacity>
        </View>

        {/* Profile Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile Info</Text>
          <Text style={styles.infoText}>
            Profile ID: {profile?.id || 'No profile'}
          </Text>
          <Text style={styles.infoText}>
            Meal Times: {profile?.diet_preferences?.meal_times?.length || 0} configured
          </Text>
          <Text style={styles.infoText}>
            Workout Preferences: {profile?.workout_preferences ? 'Available' : 'Not set'}
          </Text>
        </View>

        {/* Test Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Test Actions</Text>
          
          <TouchableOpacity 
            style={[styles.button, testing && styles.buttonDisabled]} 
            onPress={testNotificationScheduling}
            disabled={testing}
          >
            <Text style={styles.buttonText}>
              {testing ? 'Scheduling...' : 'Schedule All Notifications'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={sendTestNotification}>
            <Text style={styles.buttonText}>Send Test Notification</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={syncNotificationSettings}>
            <Text style={styles.buttonText}>Sync Settings with Profile</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.button, styles.dangerButton]} onPress={clearAllNotifications}>
            <Text style={styles.buttonText}>Clear All Notifications</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={loadNotificationInfo}>
            <Text style={styles.buttonText}>Refresh Info</Text>
          </TouchableOpacity>
        </View>

        {/* Notification Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Settings</Text>
          {notificationSettings ? (
            <View>
              <Text style={styles.infoText}>
                Workout Reminders: {notificationSettings.workoutRemindersEnabled ? 'Enabled' : 'Disabled'}
              </Text>
              <Text style={styles.infoText}>
                Meal Reminders: {notificationSettings.mealRemindersEnabled ? 'Enabled' : 'Disabled'}
              </Text>
              <Text style={styles.infoText}>
                Water Reminders: {notificationSettings.waterRemindersEnabled ? 'Enabled' : 'Disabled'}
              </Text>
              <Text style={styles.infoText}>
                Workout Times: {notificationSettings.workoutReminderTimes?.length || 0}
              </Text>
              <Text style={styles.infoText}>
                Meal Times: {notificationSettings.mealReminderTimes?.length || 0}
              </Text>
            </View>
          ) : (
            <Text style={styles.infoText}>Loading settings...</Text>
          )}
        </View>

        {/* Scheduled Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Scheduled Notifications ({scheduledNotifications.length})</Text>
          {scheduledNotifications.length > 0 ? (
            scheduledNotifications.map((notification, index) => (
              <View key={index} style={styles.notificationItem}>
                <Text style={styles.notificationTitle}>{notification.content.title}</Text>
                <Text style={styles.notificationBody}>{notification.content.body}</Text>
                <Text style={styles.notificationId}>ID: {notification.identifier}</Text>
                <Text style={styles.notificationTrigger}>
                  Trigger: {JSON.stringify(notification.trigger, null, 2)}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.infoText}>No scheduled notifications</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121232',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  statusText: {
    fontSize: 16,
    color: '#4CAF50',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  button: {
    backgroundColor: '#5E72EB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  buttonDisabled: {
    backgroundColor: 'rgba(94,114,235,0.5)',
  },
  dangerButton: {
    backgroundColor: '#FF4444',
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
  },
  notificationItem: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  notificationBody: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  notificationId: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 4,
  },
  notificationTrigger: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    fontFamily: 'monospace',
  },
});
