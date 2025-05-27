import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform,
  Dimensions,
  ImageBackground,
  ScrollView,
  Animated
} from 'react-native';
import { TextInput, Button, Snackbar } from 'react-native-paper';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import StyledText from '../../components/ui/StyledText';
import { colors, spacing, borderRadius, shadows } from '../../theme/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

// Get screen dimensions for responsive sizing
const { width, height } = Dimensions.get('window');

// Use a different image for the signin screen
const signinBackground = require('../../assets/images/login/login.jpg');

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [errorOpacity] = useState(new Animated.Value(0));
  const { signIn } = useAuth();

  useEffect(() => {
    // Check if there's an auth error from previous attempt
    const checkAuthError = async () => {
      try {
        const errorJson = await AsyncStorage.getItem('auth_error');
        if (errorJson) {
          const errorData = JSON.parse(errorJson);
          setError(errorData.message);
          showErrorAnimation();
          // Clean up the error
          await AsyncStorage.removeItem('auth_error');
        }
      } catch (err) {
        console.error('Error checking auth status:', err);
      }
    };
    
    checkAuthError();
  }, []);

  const showErrorAnimation = () => {
    // Reset the animation value first to ensure it works if called multiple times
    errorOpacity.setValue(0);
    
    // Use a longer display time and no fade out animation to ensure visibility
    Animated.timing(errorOpacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true
    }).start();
    
    // Error stays visible until next login attempt or for 20 seconds
    setTimeout(() => {
      Animated.timing(errorOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true
      }).start();
    }, 20000); // Keep error visible for 20 seconds
  };

  const handleSignIn = async () => {
    // Clear any previous error
    setError('');
    
    // Input validation
    if (!email || !password) {
      setError('Please enter both email and password');
      showErrorAnimation();
      return;
    }

    try {
      setLoading(true);
      console.log("Starting sign in process...");
      
      // Try to sign in and get the auth data
      const authData = await signIn(email, password);
      
      // If we get here, sign in was successful
      console.log("Sign in successful, redirecting...");
      
      // Navigate to the tabs screen
      if (authData && authData.session) {
        router.replace("/(tabs)" as any);
      }
    } catch (err) {
      console.error('Login error:', err);
      
      // Set the error directly in the component with a user-friendly message
      let errorMessage = "Sign in failed. Please try again.";
      
      if (err.message) {
        if (err.message.includes("Invalid login credentials")) {
          errorMessage = "Email or password is incorrect";
        } else if (err.message.includes("network")) {
          errorMessage = "Network error. Check your connection and try again.";
        } else {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
      showErrorAnimation();
    } finally {
      // Always ensure loading is reset
      setLoading(false);
    }
  };

  // Add a function to dismiss the error message
  const dismissError = () => {
    Animated.timing(errorOpacity, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true
    }).start(() => setError(''));
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <ImageBackground 
        source={signinBackground} 
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <View style={styles.overlay} />
        
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoid}
        >
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Error Message */}
            {error ? (
              <Animated.View 
                style={[
                  styles.errorContainer, 
                  { 
                    opacity: errorOpacity,
                    transform: [{ translateY: errorOpacity.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-20, 0]
                    }) }] 
                  }
                ]}
              >
                <View style={styles.errorContent}>
                  <Ionicons name="alert-circle" size={24} color="#fff" />
                  <StyledText variant="bodyMedium" style={styles.errorText}>
                    {error}
                  </StyledText>
                </View>
                <TouchableOpacity onPress={dismissError} style={styles.dismissButton}>
                  <Ionicons name="close-circle" size={24} color="#fff" />
                </TouchableOpacity>
              </Animated.View>
            ) : null}
            
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <StyledText variant="headingMedium">←</StyledText>
              </TouchableOpacity>
              
              <View style={styles.logoContainer}>
                <LinearGradient
                  colors={['#c2ff3d', '#55e474']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.logoBackground}
                >
                  <StyledText variant="headingLarge" color="#000" style={styles.logoText}>F</StyledText>
                </LinearGradient>
              </View>
            </View>
            
            {/* Welcome Text */}
            <View style={styles.welcomeContainer}>
              <StyledText variant="headingLarge" style={styles.welcomeText}>
                Welcome Back
              </StyledText>
              <StyledText variant="bodyLarge" style={styles.subtitleText}>
                Sign in to continue your fitness journey
              </StyledText>
            </View>
            
            {/* Form */}
            <View style={styles.formContainer}>
              <TextInput
                label="Email"
                value={email}
                onChangeText={setEmail}
                style={styles.input}
                mode="outlined"
                autoCapitalize="none"
                keyboardType="email-address"
                outlineColor="rgba(255, 255, 255, 0.3)"
                activeOutlineColor="#c2ff3d"
                textColor={colors.text.primary}
                theme={{ 
                  colors: { 
                    background: 'rgba(30, 30, 30, 0.7)',
                    placeholder: colors.text.muted,
                    text: colors.text.primary
                  }
                }}
              />
              
              <TextInput
                label="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                style={styles.input}
                mode="outlined"
                outlineColor="rgba(255, 255, 255, 0.3)"
                activeOutlineColor="#c2ff3d" 
                textColor={colors.text.primary}
                theme={{ 
                  colors: { 
                    background: 'rgba(30, 30, 30, 0.7)',
                    placeholder: colors.text.muted,
                    text: colors.text.primary
                  }
                }}
              />
              
              <TouchableOpacity onPress={() => router.push('/forgot-password')} style={styles.forgotPasswordContainer}>
                <StyledText
                  variant="bodyMedium"
                  color="#c2ff3d"
                  style={styles.forgotPasswordText}
                >
                  Forgot Password?
                </StyledText>
              </TouchableOpacity>
              
              <TouchableOpacity onPress={handleSignIn} activeOpacity={0.8} disabled={loading}>
                <LinearGradient
                  colors={['#c2ff3d', '#55e474']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.button}
                >
                  <StyledText variant="bodyLarge" color="#000" style={styles.buttonText}>
                    {loading ? 'Signing In...' : 'Sign In'}
                  </StyledText>
                </LinearGradient>
              </TouchableOpacity>
            </View>
            
            {/* Create Account Link */}
            <View style={styles.createAccountContainer}>
              <StyledText variant="bodyMedium" color={colors.text.secondary}>
                Don't have an account?
              </StyledText>
              <TouchableOpacity onPress={() => router.push('/signup')} style={styles.createAccountButton}>
                <StyledText
                  variant="bodyMedium"
                  color="#c2ff3d"
                  style={styles.createAccountText}
                >
                  Create Account
                </StyledText>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.xl,
    justifyContent: 'center',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.9)',
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  errorText: {
    color: '#fff',
    marginLeft: spacing.sm,
    flex: 1,
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  backButton: {
    marginRight: spacing.lg,
  },
  logoContainer: {
    flex: 1,
    alignItems: 'center',
  },
  logoBackground: {
    width: 50,
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontWeight: 'bold',
    fontSize: 28,
  },
  welcomeContainer: {
    marginBottom: spacing.xl,
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: spacing.xs,
  },
  subtitleText: {
    color: colors.text.secondary,
  },
  formContainer: {
    marginBottom: spacing.xl,
  },
  input: {
    marginBottom: spacing.md,
    backgroundColor: 'rgba(30, 30, 30, 0.7)',
    height: 56,
  },
  forgotPasswordContainer: {
    alignSelf: 'flex-end',
    marginBottom: spacing.lg,
  },
  forgotPasswordText: {
    fontWeight: 'bold',
  },
  button: {
    paddingVertical: spacing.md,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
  },
  buttonText: {
    fontWeight: 'bold',
    fontSize: 18,
  },
  createAccountContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  createAccountButton: {
    marginLeft: spacing.xs,
  },
  createAccountText: {
    fontWeight: 'bold',
  },
  snackbar: {
    backgroundColor: colors.feedback.error,
  },
  errorContent: {
    flexDirection: 'row',
    flex: 1,
    alignItems: 'center',
  },
  dismissButton: {
    padding: 4,
  },
}); 