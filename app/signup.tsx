import React, { useState } from 'react';
import { 
  View, 
  StyleSheet, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform,
  Image,
  Dimensions,
  ScrollView
} from 'react-native';
import { TextInput, Button, Snackbar } from 'react-native-paper';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import StyledText from '../components/ui/StyledText';
import { colors, spacing, borderRadius, shadows, gradients } from '../theme/theme';

// Get screen dimensions for responsive sizing
const { width, height } = Dimensions.get('window');

export default function SignupScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const { signUp } = useAuth();

  const handleSignup = async () => {
    // Form validation
    if (!fullName || !email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      setSnackbarVisible(true);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setSnackbarVisible(true);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setSnackbarVisible(true);
      return;
    }

    try {
      setLoading(true);
      setError('');
      await signUp(email, password);
      // Navigate to onboarding after successful signup
      router.replace('/onboarding/user-details');
    } catch (err) {
      console.error('Signup error:', err);
      setError(err instanceof Error ? err.message : 'Failed to create account');
      setSnackbarVisible(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient
        colors={[colors.background.primary, colors.background.secondary]}
        style={styles.background}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        {/* Floating decorative elements */}
        <View style={[styles.decorativeCircle, styles.decorativeCircle1]} />
        <View style={[styles.decorativeCircle, styles.decorativeCircle2]} />
        <View style={[styles.decorativeCircle, styles.decorativeCircle3]} />
        
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoid}
        >
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.contentContainer}>
              {/* Header */}
              <TouchableOpacity 
                style={styles.backButton} 
                onPress={() => router.back()}
              >
                <StyledText color={colors.text.secondary}>← Back</StyledText>
              </TouchableOpacity>
              
              <StyledText variant="headingLarge" style={styles.title}>
                Create Account
              </StyledText>
              <StyledText variant="bodyMedium" style={styles.subtitle}>
                Join FitAI and start your fitness journey
              </StyledText>

              {/* Signup Form */}
              <View style={styles.formContainer}>
                <TextInput
                  label="Full Name"
                  value={fullName}
                  onChangeText={setFullName}
                  style={styles.input}
                  mode="outlined"
                  autoCapitalize="words"
                  outlineColor={colors.border.medium}
                  activeOutlineColor={colors.primary.main}
                  textColor={colors.text.primary}
                  theme={{ 
                    colors: { 
                      background: colors.surface.dark,
                      placeholder: colors.text.muted,
                      text: colors.text.primary
                    }
                  }}
                />
                
                <TextInput
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  style={styles.input}
                  mode="outlined"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  outlineColor={colors.border.medium}
                  activeOutlineColor={colors.primary.main}
                  textColor={colors.text.primary}
                  theme={{ 
                    colors: { 
                      background: colors.surface.dark,
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
                  outlineColor={colors.border.medium}
                  activeOutlineColor={colors.primary.main}
                  textColor={colors.text.primary}
                  theme={{ 
                    colors: { 
                      background: colors.surface.dark,
                      placeholder: colors.text.muted,
                      text: colors.text.primary
                    }
                  }}
                />
                
                <TextInput
                  label="Confirm Password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  style={styles.input}
                  mode="outlined"
                  outlineColor={colors.border.medium}
                  activeOutlineColor={colors.primary.main}
                  textColor={colors.text.primary}
                  theme={{ 
                    colors: { 
                      background: colors.surface.dark,
                      placeholder: colors.text.muted,
                      text: colors.text.primary
                    }
                  }}
                />
                
                <Button
                  mode="contained"
                  onPress={handleSignup}
                  loading={loading}
                  disabled={loading}
                  style={styles.signupButton}
                  contentStyle={styles.buttonContent}
                  buttonColor={colors.primary.main}
                >
                  {loading ? 'Creating Account...' : 'Create Account'}
                </Button>
              </View>

              {/* Already have account link */}
              <View style={styles.loginContainer}>
                <StyledText variant="bodyMedium" color={colors.text.secondary}>
                  Already have an account?
                </StyledText>
                <TouchableOpacity onPress={() => router.push('/login')}>
                  <StyledText
                    variant="bodyMedium"
                    color={colors.primary.main}
                    style={styles.loginText}
                  >
                    Sign In
                  </StyledText>
                </TouchableOpacity>
              </View>
              
              {/* Terms and privacy */}
              <StyledText 
                variant="bodySmall" 
                color={colors.text.muted}
                align="center"
                style={styles.termsText}
              >
                By creating an account, you agree to our{' '}
                <StyledText
                  variant="bodySmall"
                  color={colors.text.secondary}
                  style={{ textDecorationLine: 'underline' }}
                >
                  Terms of Service
                </StyledText>
                {' '}and{' '}
                <StyledText
                  variant="bodySmall"
                  color={colors.text.secondary}
                  style={{ textDecorationLine: 'underline' }}
                >
                  Privacy Policy
                </StyledText>
              </StyledText>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
        
        {/* Error Snackbar */}
        <Snackbar
          visible={snackbarVisible}
          onDismiss={() => setSnackbarVisible(false)}
          duration={3000}
          style={styles.snackbar}
        >
          {error}
        </Snackbar>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    paddingTop: spacing.xxl,
  },
  backButton: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.lg,
    zIndex: 10,
  },
  title: {
    fontSize: 36,
    marginBottom: spacing.xs,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  subtitle: {
    color: colors.text.secondary,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  formContainer: {
    backgroundColor: colors.surface.light,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.medium,
  },
  input: {
    marginBottom: spacing.md,
    backgroundColor: colors.surface.dark,
  },
  signupButton: {
    marginTop: spacing.md,
    borderRadius: borderRadius.round,
  },
  buttonContent: {
    paddingVertical: spacing.sm,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  loginText: {
    marginLeft: spacing.xs,
    fontWeight: 'bold',
  },
  termsText: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  decorativeCircle: {
    position: 'absolute',
    borderRadius: borderRadius.round,
    opacity: 0.1,
  },
  decorativeCircle1: {
    width: width * 0.4,
    height: width * 0.4,
    backgroundColor: colors.accent.lavender,
    top: -width * 0.1,
    right: -width * 0.1,
  },
  decorativeCircle2: {
    width: width * 0.3,
    height: width * 0.3,
    backgroundColor: colors.primary.main,
    bottom: height * 0.3,
    left: -width * 0.15,
  },
  decorativeCircle3: {
    width: width * 0.5,
    height: width * 0.5,
    backgroundColor: colors.secondary.main,
    bottom: -width * 0.2,
    right: -width * 0.1,
  },
  snackbar: {
    backgroundColor: colors.feedback.error,
  },
}); 