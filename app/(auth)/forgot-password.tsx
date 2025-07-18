import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { TextInput, Button, Text, HelperText, useTheme } from 'react-native-paper';
import { Link, router } from 'expo-router';
import { auth } from '../../lib/supabase';
import { StatusBar } from 'expo-status-bar';
import Svg, { Circle, Path } from 'react-native-svg';

const Logo = () => {
  return (
    <Svg width="120" height="120" viewBox="0 0 200 200">
      <Circle cx="100" cy="100" r="90" fill="#6200EE" />
      <Path d="M70 70V130M130 70V130M50 100H150" stroke="white" strokeWidth="12" strokeLinecap="round" />
    </Svg>
  );
};

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  const theme = useTheme();

  const validateEmail = (email: string) => {
    const re = /\S+@\S+\.\S+/;
    return re.test(email);
  };

  const handleResetPassword = async () => {
    // Reset states
    setError('');
    setSuccess(false);
    
    // Validate email
    if (!email) {
      setError('Please enter your email address');
      return;
    }
    
    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }
    
    try {
      setLoading(true);
      
      // Call the resetPassword function
      await auth.resetPassword(email);
      
      // Show success message
      setSuccess(true);
    } catch (err: any) {
      console.error('Password reset error:', err);
      setError(err.message || 'Failed to send password reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    router.replace('/(auth)/signin');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar style="auto" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.logoContainer}>
          <Logo />
          <Text variant="headlineMedium" style={styles.title}>Reset Password</Text>
          <Text variant="titleMedium" style={styles.subtitle}>
            Enter your email to receive reset instructions
          </Text>
        </View>
        
        <View style={styles.formContainer}>
          {success ? (
            <View style={styles.successContainer}>
              <Text variant="bodyLarge" style={styles.successText}>
                Password reset email sent successfully! Please check your inbox.
              </Text>
              <Button 
                mode="contained" 
                onPress={handleBackToLogin}
                style={styles.button}
              >
                Back to Login
              </Button>
            </View>
          ) : (
            <>
              {error ? (
                <HelperText type="error" visible={!!error}>
                  {error}
                </HelperText>
              ) : null}
              
              <TextInput
                label="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                style={styles.input}
                mode="outlined"
                disabled={loading}
              />
              
              <Button 
                mode="contained" 
                onPress={handleResetPassword} 
                loading={loading}
                disabled={loading}
                style={styles.button}
              >
                Send Reset Link
              </Button>
              
              <View style={styles.loginContainer}>
                <Text variant="bodyMedium">Remember your password? </Text>
                <Link href="/(auth)/login">
                  <Text variant="bodyMedium" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>
                    Log In
                  </Text>
                </Link>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    opacity: 0.8,
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
  },
  input: {
    marginBottom: 16,
  },
  button: {
    marginBottom: 20,
    paddingVertical: 8,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  successContainer: {
    alignItems: 'center',
    padding: 20,
  },
  successText: {
    textAlign: 'center',
    marginBottom: 20,
    color: 'green',
  },
});
