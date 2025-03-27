import React, { useEffect } from 'react';
import { View, StyleSheet, ImageBackground, Dimensions, Platform } from 'react-native';
import { Text, Button, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useProfile } from '../../contexts/ProfileContext';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { colors, gradients, spacing, borderRadius, shadows } from '../../theme/theme';

// Get screen dimensions for responsive sizing
const { width, height } = Dimensions.get('window');

// Import the welcome image
const welcomeImage = require('../../assets/images/onboarding/welcome.jpg');

export default function WelcomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { updateProfile } = useProfile();

  // Animation values
  const logoOpacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const featuresOpacity = useSharedValue(0);
  const buttonOpacity = useSharedValue(0);
  const buttonScale = useSharedValue(0.95);

  // Start animations when component mounts
  useEffect(() => {
    const animationConfig = {duration: 800, easing: Easing.bezier(0.16, 1, 0.3, 1)};
    
    logoOpacity.value = withTiming(1, animationConfig);
    textOpacity.value = withDelay(200, withTiming(1, animationConfig));
    featuresOpacity.value = withDelay(500, withTiming(1, animationConfig));
    buttonOpacity.value = withDelay(800, withTiming(1, animationConfig));
    buttonScale.value = withDelay(800, withTiming(1, animationConfig));
  }, []);

  // Animated styles
  const logoAnimatedStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value
  }));

  const textAnimatedStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value
  }));

  const featuresAnimatedStyle = useAnimatedStyle(() => ({
    opacity: featuresOpacity.value
  }));

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
    transform: [{ scale: buttonScale.value }]
  }));

  // Handle starting the onboarding process
  const handleGetStarted = () => {
    // Update animation
    buttonScale.value = withTiming(0.98, { duration: 100 });
    setTimeout(() => {
      buttonScale.value = withTiming(1, { duration: 200 });
    }, 100);

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
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <ImageBackground 
        source={welcomeImage} 
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        {/* Overlay gradient */}
        <LinearGradient
          colors={['rgba(23, 20, 41, 0.4)', 'rgba(23, 20, 41, 0.85)', 'rgba(23, 20, 41, 0.98)']}
          style={styles.overlay}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
        
        <SafeAreaView style={styles.safeArea}>
          {/* Logo and Brand */}
          <Animated.View style={[styles.logoContainer, logoAnimatedStyle]}>
            <LinearGradient
              colors={[colors.primary.light, colors.primary.main]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.logoPill}
            >
              <Text style={styles.logoText}>
                <Text style={{color: 'white'}}>Fit</Text>
                <Text style={{color: colors.primary.light}}>AI</Text>
              </Text>
            </LinearGradient>
            <Text style={styles.poweredBy}>POWERED BY GEMINI 2.0</Text>
          </Animated.View>
          
          {/* Main heading */}
          <Animated.View style={[styles.headingContainer, textAnimatedStyle]}>
            <Text style={styles.heading}>
              TRAIN SMARTER.{'\n'}ACHIEVE FASTER.
            </Text>
            <Text style={styles.subheading}>
              Your AI-powered personal fitness journey starts here
            </Text>
          </Animated.View>
          
          {/* Features */}
          <Animated.View style={[styles.features, featuresAnimatedStyle]}>
            <View style={styles.featureItem}>
              <LinearGradient 
                colors={[colors.primary.main, colors.secondary.main]} 
                style={styles.featureIcon}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.featureIconText}>✓</Text>
              </LinearGradient>
              <View style={styles.featureTextContainer}>
                <Text style={styles.featureTitle}>Personalized Workouts</Text>
                <Text style={styles.featureText}>
                  Customized training plans based on your fitness level and goals
                </Text>
              </View>
            </View>
            
            <View style={styles.featureItem}>
              <LinearGradient 
                colors={[colors.primary.main, colors.secondary.main]} 
                style={styles.featureIcon}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.featureIconText}>✓</Text>
              </LinearGradient>
              <View style={styles.featureTextContainer}>
                <Text style={styles.featureTitle}>Progress Tracking</Text>
                <Text style={styles.featureText}>
                  Monitor your improvements with detailed metrics and insights
                </Text>
              </View>
            </View>
            
            <View style={styles.featureItem}>
              <LinearGradient 
                colors={[colors.primary.main, colors.secondary.main]} 
                style={styles.featureIcon}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.featureIconText}>✓</Text>
              </LinearGradient>
              <View style={styles.featureTextContainer}>
                <Text style={styles.featureTitle}>AI Body Analysis</Text>
                <Text style={styles.featureText}>
                  Get recommendations tailored to your unique body composition
                </Text>
              </View>
            </View>
          </Animated.View>
          
          {/* Button */}
          <Animated.View style={[styles.buttonContainer, buttonAnimatedStyle]}>
            <LinearGradient
              colors={[colors.primary.main, colors.secondary.main]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.buttonGradient}
            >
              <Button
                mode="contained"
                onPress={handleGetStarted}
                style={styles.button}
                contentStyle={styles.buttonContent}
                labelStyle={styles.buttonLabel}
                buttonColor="transparent"
              >
                BEGIN YOUR JOURNEY
              </Button>
            </LinearGradient>
          </Animated.View>
        </SafeAreaView>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'space-between',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 50 : 30,
    zIndex: 2,
    justifyContent: 'space-between',
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: spacing.xl * 1.5,
  },
  logoPill: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.round,
    ...shadows.medium,
  },
  logoText: {
    fontSize: 28,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  poweredBy: {
    color: colors.text.muted,
    fontSize: 10,
    letterSpacing: 1.5,
    marginTop: spacing.sm,
    fontWeight: '500',
  },
  headingContainer: {
    marginTop: spacing.xl,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  heading: {
    fontSize: 32,
    color: colors.text.primary,
    textAlign: 'center',
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: spacing.sm,
    lineHeight: 42,
  },
  subheading: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    fontWeight: '400',
  },
  features: {
    marginTop: spacing.xl,
  },
  featureItem: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
    alignItems: 'flex-start',
  },
  featureIcon: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.round,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    ...shadows.small,
  },
  featureIconText: {
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    color: colors.text.primary,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  featureText: {
    fontSize: 14,
    color: colors.text.secondary,
    fontWeight: '400',
  },
  buttonContainer: {
    marginTop: spacing.xl,
    marginBottom: spacing.md,
    alignSelf: 'stretch',
    borderRadius: borderRadius.round,
    overflow: 'hidden',
    ...shadows.medium,
  },
  buttonGradient: {
    borderRadius: borderRadius.round,
  },
  button: {
    width: '100%',
    borderRadius: borderRadius.round,
    overflow: 'hidden',
  },
  buttonContent: {
    height: 50,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
    color: colors.text.primary,
  },
});
