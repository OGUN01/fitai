import React, { useState } from 'react';
import { 
  View, 
  StyleSheet, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView, 
  Dimensions,
  ImageBackground,
  TouchableOpacity
} from 'react-native';
import { TextInput, Button, HelperText, Snackbar } from 'react-native-paper';
import { router } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import StyledText from '../../components/ui/StyledText';
import { colors, spacing, borderRadius, shadows } from '../../theme/theme';

// Get screen dimensions for responsive sizing
const { width, height } = Dimensions.get('window');

// Use the same background image as the login page
const backgroundImage = require('../../assets/images/login/login.jpg');

export default function SignupScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [secureTextEntry, setSecureTextEntry] = useState(true);
  const [secureConfirmTextEntry, setSecureConfirmTextEntry] = useState(true);
  
  const { signUp } = useAuth();

  const validateEmail = (email: string) => {
    const re = /\S+@\S+\.\S+/;
    return re.test(email);
  };

  const validatePassword = (password: string) => {
    return password.length >= 8; // Minimum 8 characters
  };

  const handleSignup = async () => {
    // Reset error state
    setError('');
    
    // Validate inputs
    if (!name || !email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      setSnackbarVisible(true);
      return;
    }
    
    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      setSnackbarVisible(true);
      return;
    }
    
    if (!validatePassword(password)) {
      setError('Password must be at least 8 characters long');
      setSnackbarVisible(true);
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setSnackbarVisible(true);
      return;
    }
    
    try {
      setLoading(true);
      await signUp(email, password);
      
      // Show success message
      setError('Account created successfully! Redirecting to onboarding...');
      setSnackbarVisible(true);
      
      // Redirect to onboarding
      setTimeout(() => {
        router.replace('/onboarding/user-details');
      }, 1500);
    } catch (err: any) {
      console.error('Signup error:', err);
      setError(err.message || 'Failed to create account. Please try again.');
      setSnackbarVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    router.replace('/(auth)/signin');
  };

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
          style={styles.keyboardAvoidingView}
        >
          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={styles.headerContainer}>
              <StyledText variant="headingLarge" style={styles.title}>
                Create Your Account
              </StyledText>
              <StyledText variant="bodyLarge" style={styles.subtitle}>
                Join your personal fitness journey
              </StyledText>
            </View>
            
            {/* Form Fields */}
            <View style={styles.formContainer}>
              {/* Name Field */}
              <View style={styles.inputContainer}>
                <TextInput
                  label="Full Name"
                  value={name}
                  onChangeText={setName}
                  style={styles.input}
                  mode="flat"
                  disabled={loading}
                  textColor="#FFFFFF"
                  activeUnderlineColor="#c2ff3d"
                  underlineColor="rgba(255,255,255,0.3)"
                  theme={{ colors: { placeholder: 'rgba(255,255,255,0.7)' } }}
                />
              </View>
              
              {/* Email Field */}
              <View style={styles.inputContainer}>
                <TextInput
                  label="Email Address"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={styles.input}
                  mode="flat"
                  disabled={loading}
                  textColor="#FFFFFF"
                  activeUnderlineColor="#c2ff3d"
                  underlineColor="rgba(255,255,255,0.3)"
                  theme={{ colors: { placeholder: 'rgba(255,255,255,0.7)' } }}
                />
              </View>
              
              {/* Password Field */}
              <View style={styles.inputContainer}>
                <TextInput
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={secureTextEntry}
                  style={styles.input}
                  mode="flat"
                  disabled={loading}
                  textColor="#FFFFFF"
                  activeUnderlineColor="#c2ff3d"
                  underlineColor="rgba(255,255,255,0.3)"
                  theme={{ colors: { placeholder: 'rgba(255,255,255,0.7)' } }}
                  right={
                    <TextInput.Icon 
                      icon={secureTextEntry ? 'eye-off' : 'eye'}
                      onPress={() => setSecureTextEntry(!secureTextEntry)}
                      color="rgba(255,255,255,0.7)"
                    />
                  }
                />
              </View>
              
              {/* Confirm Password Field */}
              <View style={styles.inputContainer}>
                <TextInput
                  label="Confirm Password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={secureConfirmTextEntry}
                  style={styles.input}
                  mode="flat"
                  disabled={loading}
                  textColor="#FFFFFF"
                  activeUnderlineColor="#c2ff3d"
                  underlineColor="rgba(255,255,255,0.3)"
                  theme={{ colors: { placeholder: 'rgba(255,255,255,0.7)' } }}
                  right={
                    <TextInput.Icon 
                      icon={secureConfirmTextEntry ? 'eye-off' : 'eye'}
                      onPress={() => setSecureConfirmTextEntry(!secureConfirmTextEntry)}
                      color="rgba(255,255,255,0.7)"
                    />
                  }
                />
              </View>
            </View>
            
            {/* Signup Button */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity 
                onPress={handleSignup}
                activeOpacity={0.8}
                disabled={loading}
              >
                <LinearGradient
                  colors={['#c2ff3d', '#55e474']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.gradientButton}
                >
                  <StyledText 
                    variant="bodyLarge" 
                    color="#000" 
                    style={styles.buttonText}
                  >
                    {loading ? 'Creating Account...' : 'Create Account'}
                  </StyledText>
                </LinearGradient>
              </TouchableOpacity>
            </View>
            
            {/* Back to Login */}
            <View style={styles.loginContainer}>
              <StyledText variant="bodyMedium" color={colors.text.secondary}>
                Already have an account?
              </StyledText>
              <TouchableOpacity 
                onPress={handleBackToLogin} 
                style={styles.loginButton}
                activeOpacity={0.7}
              >
                <StyledText
                  variant="bodyMedium"
                  color="#c2ff3d"
                  style={styles.loginText}
                >
                  Sign In
                </StyledText>
              </TouchableOpacity>
            </View>
          </ScrollView>
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)', // Darker overlay for better text readability
    zIndex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
    zIndex: 2,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: 60,
    paddingBottom: 40,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  title: {
    fontWeight: 'bold',
    fontSize: 28,
    textAlign: 'center',
    color: '#FFFFFF',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  formContainer: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 8,
    overflow: 'hidden',
  },
  input: {
    backgroundColor: 'transparent',
    fontSize: 16,
    paddingHorizontal: 0,
  },
  buttonContainer: {
    marginVertical: spacing.xl,
  },
  gradientButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#c2ff3d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  buttonText: {
    fontWeight: 'bold',
    fontSize: 18,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  loginButton: {
    marginLeft: spacing.xs,
    padding: 8,
  },
  loginText: {
    fontWeight: 'bold',
  },
  snackbar: {
    backgroundColor: colors.feedback.error,
  },
});
