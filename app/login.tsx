import React, { useState, useCallback } from 'react';
import { 
  View, 
  StyleSheet, 
  KeyboardAvoidingView, 
  Platform,
  ImageBackground,
  Dimensions,
  TouchableHighlight,
  Alert
} from 'react-native';
import { Snackbar, Button } from 'react-native-paper';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import StyledText from '../components/ui/StyledText';
import { colors, spacing, borderRadius, shadows } from '../theme/theme';

// Get screen dimensions for responsive sizing
const { width, height } = Dimensions.get('window');

// Use the same background image for all platforms
const backgroundImage = require('../assets/images/login/login.jpg');

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const { signIn } = useAuth();

  // Handle navigation to signup page
  const handleGetStarted = useCallback(() => {
    // Show loading state
    setLoading(true);
    
    // Use standard router path format for group routes
    setTimeout(() => {
      router.push('/(auth)/signup');
      // Reset loading after a short delay
      setTimeout(() => setLoading(false), 500);
    }, 100);
  }, [setLoading]);

  // Handle navigation to signin page
  const handleSignIn = useCallback(() => {
    // Use standard router path format for group routes
    router.push('/(auth)/signin');
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <ImageBackground 
        source={backgroundImage} 
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <View style={styles.overlay} />
        
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.contentContainer}
        >
          {/* Main Content - Centered Text */}
          <View style={styles.textContainer}>
            <StyledText variant="headingLarge" style={styles.heading}>
              Train Your Body,
            </StyledText>
            <StyledText variant="headingLarge" style={styles.heading}>
              Elevate Your Spirit
            </StyledText>
            <StyledText variant="bodyLarge" style={styles.subheading}>
              Your Virtual Coach For Health & Fitness
            </StyledText>
          </View>
          
          {/* Get Started Button */}
          <View style={styles.buttonContainer}>
            <Button 
              mode="contained" 
              onPress={handleGetStarted}
              loading={loading}
              style={styles.paperButton}
              buttonColor="#c2ff3d"
              textColor="#000"
              labelStyle={styles.buttonText}
              uppercase={false}
              contentStyle={{ paddingVertical: 8 }}
              rippleColor="rgba(0, 0, 0, 0.2)"
              theme={{ roundness: 30 }}
            >
              Get Started
            </Button>
          </View>
          
          {/* Sign In Button */}
          <View style={styles.signUpContainer}>
            <StyledText variant="bodyMedium" color={colors.text.secondary}>
              Already have an account?
            </StyledText>
            <TouchableHighlight 
              onPress={handleSignIn} 
              style={styles.signUpButton}
              underlayColor="rgba(194, 255, 61, 0.1)"
              activeOpacity={0.6}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <StyledText
                variant="bodyMedium"
                color="#c2ff3d"
                style={styles.signUpText}
              >
                Sign In
              </StyledText>
            </TouchableHighlight>
          </View>
        </KeyboardAvoidingView>
      </ImageBackground>
      
      {/* Error Snackbar */}
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        style={styles.snackbar}
      >
        {error}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000', // Fallback background color
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    zIndex: 1, // Ensure overlay is below content
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    zIndex: 2, // Ensure content is above overlay
  },
  textContainer: {
    alignItems: 'center', // Center-align text
    justifyContent: 'center',
    marginBottom: spacing.xxl * 1.5,
  },
  heading: {
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    lineHeight: 38,
    textAlign: 'center', // Center-align text
  },
  subheading: {
    marginTop: spacing.md,
    color: colors.text.secondary,
    fontWeight: '400',
    textAlign: 'center', // Center-align text
  },
  buttonContainer: {
    zIndex: 10, // Ensure button is above other elements
    elevation: 5, // Add elevation for Android
    marginBottom: spacing.xl,
  },
  paperButton: {
    borderRadius: 30,
    paddingVertical: 5,
  },
  buttonText: {
    fontWeight: 'bold',
    fontSize: 18,
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    zIndex: 10, // Ensure button is above other elements
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
  },
  signUpButton: {
    marginLeft: spacing.xs,
    padding: 8, // Add padding for larger touch area
  },
  signUpText: {
    fontWeight: 'bold',
  },
  snackbar: {
    backgroundColor: colors.feedback.error,
  },
}); 