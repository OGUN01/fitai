import React, { useState } from 'react';
import { 
  View, 
  StyleSheet, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform,
  Image,
  Dimensions
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

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const { signIn } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please enter both email and password');
      setSnackbarVisible(true);
      return;
    }

    try {
      setLoading(true);
      setError('');
      await signIn(email, password);
      router.replace('/(tabs)/');
    } catch (err) {
      console.error('Login error:', err);
      setError(err instanceof Error ? err.message : 'Failed to sign in');
      setSnackbarVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccount = () => {
    router.push('/signup');
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
          <View style={styles.contentContainer}>
            {/* App Logo */}
            <View style={styles.logoContainer}>
              {/* Temporary placeholder for the app icon */}
              <View style={styles.logoPlaceholder}>
                <StyledText variant="headingLarge" color={colors.primary.main}>F</StyledText>
              </View>
              <StyledText variant="headingLarge" style={styles.appName}>
                FitAI
              </StyledText>
              <StyledText variant="bodyMedium" style={styles.tagline}>
                Your AI-powered fitness journey
              </StyledText>
            </View>

            {/* Login Form */}
            <View style={styles.formContainer}>
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
              
              <Button
                mode="contained"
                onPress={handleLogin}
                loading={loading}
                disabled={loading}
                style={styles.loginButton}
                contentStyle={styles.buttonContent}
                buttonColor={colors.primary.main}
              >
                {loading ? 'Signing In...' : 'Sign In'}
              </Button>
              
              <TouchableOpacity onPress={() => router.push('/forgot-password')}>
                <StyledText
                  variant="bodyMedium"
                  color={colors.text.secondary}
                  align="center"
                  style={styles.forgotPassword}
                >
                  Forgot your password?
                </StyledText>
              </TouchableOpacity>
            </View>

            {/* Create Account Button */}
            <View style={styles.createAccountContainer}>
              <StyledText variant="bodyMedium" color={colors.text.secondary}>
                Don't have an account?
              </StyledText>
              <TouchableOpacity onPress={handleCreateAccount}>
                <StyledText
                  variant="bodyMedium"
                  color={colors.primary.main}
                  style={styles.createAccountText}
                >
                  Create Account
                </StyledText>
              </TouchableOpacity>
            </View>

          </View>
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
    position: 'relative',
  },
  keyboardAvoid: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoPlaceholder: {
    width: width * 0.3,
    height: width * 0.3,
    borderRadius: width * 0.15,
    backgroundColor: colors.surface.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    ...shadows.medium,
  },
  logo: {
    width: width * 0.3,
    height: width * 0.3,
    marginBottom: spacing.md,
  },
  appName: {
    marginBottom: spacing.xs,
    fontSize: 42,
    fontWeight: 'bold',
  },
  tagline: {
    color: colors.text.secondary,
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
  loginButton: {
    marginTop: spacing.md,
    borderRadius: borderRadius.round,
  },
  buttonContent: {
    paddingVertical: spacing.sm,
  },
  forgotPassword: {
    marginTop: spacing.md,
  },
  createAccountContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  createAccountText: {
    marginLeft: spacing.xs,
    fontWeight: 'bold',
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