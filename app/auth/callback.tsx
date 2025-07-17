/**
 * OAuth Callback Handler
 * 
 * Handles the OAuth callback from Google authentication
 * and redirects users appropriately after successful authentication
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import StyledText from '../../components/ui/StyledText';
import { colors, spacing } from '../../theme/theme';
import supabase from '../../lib/supabase';

export default function AuthCallback() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, userProfile } = useAuth();

  useEffect(() => {
    handleAuthCallback();
  }, []);

  const handleAuthCallback = async () => {
    try {
      console.log("🔄 Processing OAuth callback...");
      
      // Get the current session
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error("❌ Session error:", sessionError);
        setError("Authentication failed. Please try again.");
        return;
      }

      if (sessionData.session) {
        console.log("✅ OAuth session established successfully");
        
        // Check if user has completed onboarding
        const userId = sessionData.session.user.id;
        
        try {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('has_completed_onboarding, current_onboarding_step')
            .eq('id', userId)
            .single();

          if (profileError && profileError.code !== 'PGRST116') {
            console.error("❌ Profile fetch error:", profileError);
          }

          // Determine where to redirect the user
          if (profile?.has_completed_onboarding) {
            console.log("✅ User has completed onboarding, redirecting to home");
            router.replace('/(tabs)/home');
          } else {
            console.log("🔄 User needs to complete onboarding");
            // For new Google users, start with user details
            router.replace('/onboarding/user-details');
          }
        } catch (profileError) {
          console.error("❌ Error checking profile:", profileError);
          // Default to onboarding for safety
          router.replace('/onboarding/user-details');
        }
      } else {
        console.log("❌ No session found in callback");
        setError("Authentication failed. No session found.");
      }
    } catch (error: any) {
      console.error("❌ OAuth callback error:", error);
      setError("Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handle error state
  useEffect(() => {
    if (error) {
      // Redirect to login after showing error briefly
      const timer = setTimeout(() => {
        router.replace('/login');
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Handle successful authentication
  useEffect(() => {
    if (!loading && !error && user) {
      // This effect will run when auth state is properly updated
      console.log("🎉 Authentication completed, user state updated");
    }
  }, [loading, error, user]);

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <StyledText variant="headingMedium" style={styles.errorTitle}>
            Authentication Error
          </StyledText>
          <StyledText variant="bodyMedium" style={styles.errorMessage}>
            {error}
          </StyledText>
          <StyledText variant="bodySmall" style={styles.redirectMessage}>
            Redirecting to login...
          </StyledText>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <ActivityIndicator size="large" color={colors.primary.main} />
        <StyledText variant="headingMedium" style={styles.title}>
          Completing Sign In
        </StyledText>
        <StyledText variant="bodyMedium" style={styles.message}>
          Please wait while we set up your account...
        </StyledText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  title: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    textAlign: 'center',
    color: colors.text.primary,
  },
  message: {
    textAlign: 'center',
    color: colors.text.secondary,
    lineHeight: 24,
  },
  errorTitle: {
    marginBottom: spacing.md,
    textAlign: 'center',
    color: colors.feedback.error,
  },
  errorMessage: {
    textAlign: 'center',
    color: colors.text.secondary,
    marginBottom: spacing.lg,
    lineHeight: 24,
  },
  redirectMessage: {
    textAlign: 'center',
    color: colors.text.muted,
    fontStyle: 'italic',
  },
});
