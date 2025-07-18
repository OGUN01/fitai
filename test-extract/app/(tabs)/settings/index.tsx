import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../../contexts/AuthContext';
import { getSyncDiagnostics, repairDatabaseSync } from '../../../utils/syncLocalData';
import supabase from '../../../lib/supabase';
// Instead of importing the polyfill directly, we should use our own UUID generator
// that's already defined in syncLocalData.ts
// import 'react-native-get-random-values'; // Polyfill for crypto

// Generate a UUID without relying on crypto.randomUUID
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export default function SettingsScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();

  const handleDiagnostics = async () => {
    try {
      // Get sync diagnostics
      const diagnostics = await getSyncDiagnostics();
      console.log("Sync diagnostics:", JSON.stringify(diagnostics, null, 2));
      
      // Show user the data
      Alert.alert(
        "Sync Diagnostics",
        "Diagnostics logged to console. Would you like to attempt repair?",
        [
          {
            text: "View Summary",
            onPress: () => {
              // Show a summary of the diagnostics
              const localItems = diagnostics.storage || {};
              const workoutCount = localItems.local_workout_completions?.length || 0;
              const mealCount = localItems.local_meal_completions?.length || 0;
              
              Alert.alert(
                "Diagnostic Summary",
                `Found ${workoutCount} local workouts and ${mealCount} local meals. Check console for full details.`,
                [
                  { 
                    text: "Repair Now", 
                    onPress: () => user ? repairDatabase(user.id) : Alert.alert("Error", "You must be logged in to repair") 
                  },
                  { text: "Cancel", style: "cancel" }
                ]
              );
            }
          },
          {
            text: "Repair Now",
            onPress: () => {
              if (user) {
                repairDatabase(user.id);
              } else {
                Alert.alert("Error", "You must be logged in to repair");
              }
            }
          },
          { text: "Cancel", style: "cancel" }
        ]
      );
    } catch (error) {
      console.error("Error running diagnostics:", error);
      Alert.alert("Error", "Error running diagnostics. See console for details.");
    }
  };

  const repairDatabase = async (userId: string) => {
    try {
      Alert.alert("Repair", "Starting database repair. This may take a moment...");
      console.log("Attempting to repair database sync for user:", userId);
      
      // Use the new repair function
      const result = await repairDatabaseSync(userId);
      
      if (result.success) {
        console.log("Repair successful:", result.message);
        Alert.alert(
          "Repair Successful",
          `Fixed ${result.repairs.workouts} workouts and ${result.repairs.meals} meals.`,
          [{ text: "OK" }]
        );
      } else {
        console.error("Repair failed:", result.message);
        Alert.alert("Repair Failed", result.message, [{ text: "OK" }]);
      }
    } catch (error) {
      console.error("Error repairing database:", error);
      Alert.alert("Error", "Error during repair: " + (error.message || "Unknown error"));
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Settings' }} />
      <StatusBar style="light" />
      
      <ScrollView style={styles.scrollView}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <TouchableOpacity 
            style={styles.settingOption}
            onPress={() => router.push('/(tabs)/profile/edit-profile')}
          >
            <Text style={styles.settingLabel}>Profile</Text>
            <Text style={styles.settingDescription}>Manage your profile information</Text>
            <View style={styles.chevron}>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.settingOption}
            onPress={() => router.navigate('/(settings)/notifications')}
          >
            <Text style={styles.settingLabel}>Notifications</Text>
            <Text style={styles.settingDescription}>Configure notification preferences</Text>
            <View style={styles.chevron}>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.settingOption}
            onPress={() => router.push('/(tabs)/profile')}
          >
            <Text style={styles.settingLabel}>View Profile Dashboard</Text>
            <Text style={styles.settingDescription}>See your profile statistics and information</Text>
            <View style={styles.chevron}>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </View>
          </TouchableOpacity>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <TouchableOpacity style={styles.settingOption}>
            <Text style={styles.settingLabel}>Units</Text>
            <Text style={styles.settingDescription}>Set your preferred measurement units</Text>
            <View style={styles.chevron}>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.settingOption}>
            <Text style={styles.settingLabel}>Theme</Text>
            <Text style={styles.settingDescription}>Choose between light and dark theme</Text>
            <View style={styles.chevron}>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </View>
          </TouchableOpacity>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App</Text>
          <TouchableOpacity style={styles.settingOption}>
            <Text style={styles.settingLabel}>About</Text>
            <Text style={styles.settingDescription}>App version and information</Text>
            <View style={styles.chevron}>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.settingOption}>
            <Text style={styles.settingLabel}>Privacy Policy</Text>
            <Text style={styles.settingDescription}>Read our privacy policy</Text>
            <View style={styles.chevron}>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </View>
          </TouchableOpacity>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fitness</Text>
          <TouchableOpacity 
            style={styles.settingOption}
            onPress={() => router.push('/(tabs)/progress/body-details')}
          >
            <Text style={styles.settingLabel}>Body Metrics</Text>
            <Text style={styles.settingDescription}>Update your weight, height and measurements</Text>
            <View style={styles.chevron}>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.settingOption}
            onPress={() => router.push('/(tabs)/profile/edit-profile')}
          >
            <Text style={styles.settingLabel}>Fitness Goals</Text>
            <Text style={styles.settingDescription}>Update your fitness and weight goals</Text>
            <View style={styles.chevron}>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.settingOption}
            onPress={() => router.push('/(tabs)/progress')}
          >
            <Text style={styles.settingLabel}>Activity Level</Text>
            <Text style={styles.settingDescription}>Set your daily activity level</Text>
            <View style={styles.chevron}>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </View>
          </TouchableOpacity>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Links</Text>
          <TouchableOpacity 
            style={styles.settingOption}
            onPress={() => router.push('/(tabs)/profile')}
          >
            <Text style={styles.settingLabel}>Profile Dashboard</Text>
            <Text style={styles.settingDescription}>View your profile stats and information</Text>
            <View style={styles.chevron}>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </View>
          </TouchableOpacity>
        </View>
        
        {/* Developer Tools section - only visible in development */}
        {__DEV__ && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Developer Tools</Text>
            <TouchableOpacity 
              style={styles.settingOption}
              onPress={() => router.push('/test-fallbacks')}
            >
              <Text style={styles.settingLabel}>Test Fallback System</Text>
              <Text style={styles.settingDescription}>Test AI fallback mechanisms for workout and meal plans</Text>
              <View style={styles.chevron}>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </View>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity 
          style={[styles.settingButton, { marginTop: 20, backgroundColor: '#2c3e50' }]}
          onPress={handleDiagnostics}
        >
          <Text style={styles.settingButtonText}>Sync Diagnostics & Repair</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginVertical: 12,
    backgroundColor: 'white',
    borderRadius: 10,
    overflow: 'hidden',
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginVertical: 8,
    marginHorizontal: 16,
    paddingTop: 8,
  },
  settingOption: {
    flexDirection: 'column',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  chevron: {
    position: 'absolute',
    right: 16,
    top: '50%',
    transform: [{ translateY: -10 }],
  },
  settingButton: {
    padding: 16,
    backgroundColor: '#1e2732',
    borderRadius: 10,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  settingButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
}); 