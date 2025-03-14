import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button, useTheme, Surface } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useProfile } from '../../contexts/ProfileContext';

export default function WelcomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { updateProfile } = useProfile();

  // Handle starting the onboarding process
  const handleGetStarted = () => {
    // Update the current onboarding step
    updateProfile({
      current_onboarding_step: 'user-details'
    }).then(() => {
      // Navigate to the user details screen
      router.push('/(onboarding)/user-details');
    }).catch(error => {
      console.error('Error updating onboarding step:', error);
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      <View style={styles.header}>
        <Text variant="displaySmall" style={styles.title}>Welcome to FitAI</Text>
        <Text variant="titleMedium" style={styles.subtitle}>
          Your personal fitness journey starts here
        </Text>
      </View>
      
      <View style={styles.imageContainer}>
        <Surface style={styles.placeholderImage}>
          <Text variant="headlineMedium" style={{ color: theme.colors.primary }}>
            FitAI
          </Text>
          <Text variant="bodyLarge" style={{ textAlign: 'center', marginTop: 8 }}>
            Your Personal Fitness Coach
          </Text>
        </Surface>
      </View>
      
      <View style={styles.features}>
        <View style={styles.featureItem}>
          <Text variant="titleMedium" style={styles.featureTitle}>✓ Personalized Workouts</Text>
          <Text variant="bodyMedium" style={styles.featureText}>
            Customized training plans based on your fitness level and goals
          </Text>
        </View>
        
        <View style={styles.featureItem}>
          <Text variant="titleMedium" style={styles.featureTitle}>✓ Progress Tracking</Text>
          <Text variant="bodyMedium" style={styles.featureText}>
            Monitor your improvements with detailed metrics and insights
          </Text>
        </View>
        
        <View style={styles.featureItem}>
          <Text variant="titleMedium" style={styles.featureTitle}>✓ AI Body Analysis</Text>
          <Text variant="bodyMedium" style={styles.featureText}>
            Get recommendations tailored to your unique body composition
          </Text>
        </View>
      </View>
      
      <View style={styles.buttonContainer}>
        <Button 
          mode="contained" 
          onPress={handleGetStarted}
          style={styles.button}
          contentStyle={styles.buttonContent}
        >
          Get Started
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    alignItems: 'center',
    padding: 24,
    paddingTop: 40,
  },
  title: {
    fontWeight: 'bold',
    color: '#2e7d32',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    textAlign: 'center',
    color: '#546e7a',
  },
  imageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  placeholderImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e8f5e9',
    elevation: 2,
  },
  features: {
    padding: 24,
  },
  featureItem: {
    marginBottom: 16,
  },
  featureTitle: {
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 4,
  },
  featureText: {
    color: '#546e7a',
  },
  buttonContainer: {
    padding: 24,
    marginTop: 'auto',
  },
  button: {
    borderRadius: 8,
  },
  buttonContent: {
    paddingVertical: 8,
  },
});
