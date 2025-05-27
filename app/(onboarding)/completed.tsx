import React, { useState } from 'react';
import { View, StyleSheet, Dimensions, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import Animated, { 
  FadeInDown, 
  FadeInUp, 
  BounceIn,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useProfile } from '../../contexts/ProfileContext';
import { markOnboardingComplete } from '../../utils/onboardingPersistence';

const { width, height } = Dimensions.get('window');

function PatternOverlay() {
  const dotSpacing = 40;
  const rows = Math.ceil(height / dotSpacing);
  const cols = Math.ceil(width / dotSpacing);
  const dots = [];

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      dots.push(
        <Circle
          key={`${i}-${j}`}
          cx={j * dotSpacing}
          cy={i * dotSpacing}
          r={1}
          fill="white"
          opacity={0.1}
        />
      );
    }
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      <Svg width={width} height={height}>
        {dots}
      </Svg>
    </View>
  );
}

export default function CompletedScreen() {
  const { profile, completeOnboarding } = useProfile();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleContinue = async () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSaving(true);
      setError(null);
      
      // First, mark onboarding as complete using our reliable utility
      const success = await markOnboardingComplete(profile || undefined);
      
      if (!success) {
        throw new Error('Failed to save onboarding completion status');
      }
      
      // Then also use the context method for API updates if user is logged in
      await completeOnboarding();
      
      // Redirect to main app
      router.replace('/(tabs)');
    } catch (err) {
      console.error('Error completing onboarding:', err);
      setError('Failed to save your progress. Please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#7C3AED', '#4C1D95']}
        style={StyleSheet.absoluteFill}
      />
      
      {/* Pattern Overlay */}
      <PatternOverlay />

      {/* Success Icon */}
      <Animated.View 
        entering={BounceIn.delay(200).springify()}
        style={styles.iconContainer}
      >
        <View style={styles.successCircle}>
          <Ionicons name="checkmark-sharp" size={60} color="white" />
        </View>
      </Animated.View>

      {/* Title and Description */}
      <Animated.View 
        entering={FadeInDown.delay(600).springify()}
        style={styles.textContainer}
      >
        <Text style={styles.title}>Setup Complete!</Text>
        <Text style={styles.description}>
          Your fitness profile has been set up successfully. You're all ready to start your fitness journey!
        </Text>
      </Animated.View>

      {/* Info Box */}
      <Animated.View 
        entering={FadeInUp.delay(800).springify()}
        style={styles.infoContainer}
      >
        <View style={styles.infoIcon}>
          <Text style={styles.infoIconText}>i</Text>
        </View>
        <Text style={styles.infoText}>
          Your data is currently stored locally on your device. To back up your data and access it across devices, create an account later from the Profile tab.
        </Text>
      </Animated.View>

      {/* Continue Button */}
      <Animated.View 
        entering={FadeInUp.delay(1000).springify()}
        style={styles.buttonContainer}
      >
        <TouchableOpacity 
          style={[styles.button, saving && styles.buttonDisabled]}
          onPress={handleContinue}
          activeOpacity={0.8}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#7C3AED" size="small" />
          ) : (
            <Text style={styles.buttonText}>Continue to App</Text>
          )}
        </TouchableOpacity>
        
        {error && (
          <Text style={styles.errorText}>{error}</Text>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  iconContainer: {
    marginBottom: 40,
  },
  successCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#4ADE80',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    maxWidth: width * 0.8,
  },
  infoContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 40,
    maxWidth: width * 0.9,
    alignItems: 'center',
  },
  infoIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoIconText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  infoText: {
    flex: 1,
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    lineHeight: 20,
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 400,
    paddingHorizontal: 20,
  },
  button: {
    backgroundColor: 'white',
    height: 56,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#7C3AED',
    fontSize: 18,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  errorText: {
    marginTop: 10,
    color: '#FF4757',
    textAlign: 'center',
    fontSize: 14,
  },
}); 