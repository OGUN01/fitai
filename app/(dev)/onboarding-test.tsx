import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Text as RNText } from 'react-native';
import { Text, Button, useTheme, Card, Snackbar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useProfile } from '../../contexts/ProfileContext';
import { useAuth } from '../../contexts/AuthContext';

export default function OnboardingTestScreen() {
  const theme = useTheme();
  const { profile, updateProfile } = useProfile();
  const { user } = useAuth();
  const [isUpdating, setIsUpdating] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // Helper function to show snackbar
  const showSnackbar = (message) => {
    setSnackbarMessage(message);
    setSnackbarVisible(true);
  };

  // Reset onboarding and restart from the beginning
  const resetOnboarding = async () => {
    if (isUpdating) return;
    
    try {
      console.log('Starting reset onboarding');
      setIsUpdating(true);
      
      // Update profile first
      await updateProfile({
        has_completed_onboarding: false,
        current_onboarding_step: 'user-details'
      });
      
      console.log('Profile updated, navigating to user-details');
      showSnackbar('Onboarding reset. Redirecting...');
      
      // Small delay before navigation to ensure state is updated
      setTimeout(() => {
        router.push('/(onboarding)/user-details');
      }, 500);
    } catch (error) {
      console.error('Error resetting onboarding:', error);
      showSnackbar('Failed to reset onboarding. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  // Test specific onboarding screens
  const goToStep = async (step) => {
    if (isUpdating) return;
    
    try {
      console.log(`Going to step: ${step}`);
      setIsUpdating(true);
      
      // Update profile first
      await updateProfile({
        current_onboarding_step: step
      });
      
      console.log(`Profile updated, navigating to ${step}`);
      showSnackbar(`Step updated to ${step}. Redirecting...`);
      
      // Small delay before navigation to ensure state is updated
      setTimeout(() => {
        router.push(`/(onboarding)/${step}`);
      }, 500);
    } catch (error) {
      console.error('Error updating onboarding step:', error);
      showSnackbar('Failed to update step. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  // Go to main app without completing onboarding (for testing only)
  const skipToMainApp = () => {
    console.log('Skipping to main app');
    showSnackbar('Navigating to main app...');
    
    // Small delay before navigation
    setTimeout(() => {
      router.push('/(tabs)');
    }, 300);
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <StatusBar style="light" />
      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
        <Text variant="headlineSmall" style={styles.headerTitle}>
          Onboarding Test
        </Text>
      </View>
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <RNText style={styles.debugText}>Debug info: Using navigation with folder parentheses</RNText>
        
        <Card style={styles.card}>
          <Card.Title title="Current Onboarding Status" />
          <Card.Content>
            <Text variant="bodyMedium">
              <Text style={styles.label}>User ID: </Text>
              {user?.id || 'Not logged in'}
            </Text>
            <Text variant="bodyMedium">
              <Text style={styles.label}>Has Completed Onboarding: </Text>
              {profile?.has_completed_onboarding ? 'Yes' : 'No'}
            </Text>
            <Text variant="bodyMedium">
              <Text style={styles.label}>Current Step: </Text>
              {profile?.current_onboarding_step || 'Not started'}
            </Text>
          </Card.Content>
          <Card.Actions>
            <Button 
              mode="contained" 
              onPress={resetOnboarding}
              loading={isUpdating}
              disabled={isUpdating}
            >
              Reset & Restart Onboarding
            </Button>
          </Card.Actions>
        </Card>

        <Card style={styles.card}>
          <Card.Title title="Test Specific Steps" />
          <Card.Content>
            <View style={styles.stepButtons}>
              <Button 
                mode="outlined" 
                style={styles.stepButton}
                onPress={() => goToStep('user-details')}
                disabled={isUpdating}
              >
                User Details
              </Button>
              <Button 
                mode="outlined" 
                style={styles.stepButton}
                onPress={() => goToStep('diet-preferences')}
                disabled={isUpdating}
              >
                Diet Prefs
              </Button>
              <Button 
                mode="outlined" 
                style={styles.stepButton}
                onPress={() => goToStep('body-analysis')}
                disabled={isUpdating}
              >
                Body Analysis
              </Button>
              <Button 
                mode="outlined" 
                style={styles.stepButton}
                onPress={() => goToStep('workout-preferences')}
                disabled={isUpdating}
              >
                Workout Prefs
              </Button>
              <Button 
                mode="outlined" 
                style={styles.stepButton}
                onPress={() => goToStep('review')}
                disabled={isUpdating}
              >
                Review
              </Button>
            </View>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Title title="Testing Options" />
          <Card.Content>
            <Button 
              mode="contained" 
              onPress={skipToMainApp}
              style={{marginBottom: 8}}
            >
              Skip to Main App (Testing Only)
            </Button>
          </Card.Content>
        </Card>
      </ScrollView>
      
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        action={{
          label: 'OK',
          onPress: () => setSnackbarVisible(false),
        }}
      >
        {snackbarMessage}
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    elevation: 4,
  },
  headerTitle: {
    color: 'white',
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    marginBottom: 16,
  },
  label: {
    fontWeight: 'bold',
  },
  stepButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  stepButton: {
    marginBottom: 8,
    width: '48%',
  },
  debugText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    fontStyle: 'italic',
  }
});
