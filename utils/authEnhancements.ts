import supabase from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Enhanced Authentication Utilities
 * Provides improved authentication flows and social login preparation
 */

export interface AuthResult {
  success: boolean;
  user?: any;
  session?: any;
  error?: string;
  needsEmailVerification?: boolean;
}

export interface EmailVerificationResult {
  success: boolean;
  message: string;
  error?: string;
}

export interface PasswordResetResult {
  success: boolean;
  message: string;
  error?: string;
}

/**
 * Enhanced sign up with better error handling and email verification
 */
export async function enhancedSignUp(
  email: string, 
  password: string, 
  fullName?: string
): Promise<AuthResult> {
  try {
    console.log('🔐 Starting enhanced sign up process...');

    // Validate input
    if (!email || !password) {
      return {
        success: false,
        error: 'Email and password are required'
      };
    }

    if (password.length < 6) {
      return {
        success: false,
        error: 'Password must be at least 6 characters long'
      };
    }

    // Attempt sign up
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName || '',
        }
      }
    });

    if (error) {
      console.error('Sign up error:', error);
      
      // Provide user-friendly error messages
      let userError = error.message;
      if (error.message.includes('already registered')) {
        userError = 'An account with this email already exists. Please sign in instead.';
      } else if (error.message.includes('invalid email')) {
        userError = 'Please enter a valid email address.';
      } else if (error.message.includes('weak password')) {
        userError = 'Password is too weak. Please choose a stronger password.';
      }

      return {
        success: false,
        error: userError
      };
    }

    // Check if email verification is required
    const needsVerification = !data.user?.email_confirmed_at;

    if (needsVerification) {
      console.log('📧 Email verification required');
      return {
        success: true,
        user: data.user,
        session: data.session,
        needsEmailVerification: true
      };
    }

    console.log('✅ Sign up successful');
    return {
      success: true,
      user: data.user,
      session: data.session,
      needsEmailVerification: false
    };

  } catch (error) {
    console.error('❌ Enhanced sign up failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Sign up failed'
    };
  }
}

/**
 * Enhanced sign in with better error handling
 */
export async function enhancedSignIn(email: string, password: string): Promise<AuthResult> {
  try {
    console.log('🔐 Starting enhanced sign in process...');

    // Validate input
    if (!email || !password) {
      return {
        success: false,
        error: 'Email and password are required'
      };
    }

    // Clear any previous auth errors
    await AsyncStorage.removeItem('auth_error');

    // Attempt sign in
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Sign in error:', error);
      
      // Provide user-friendly error messages
      let userError = error.message;
      if (error.message.includes('Invalid login credentials')) {
        userError = 'Email or password is incorrect. Please check your credentials and try again.';
      } else if (error.message.includes('Email not confirmed')) {
        userError = 'Please verify your email address before signing in.';
      } else if (error.message.includes('Too many requests')) {
        userError = 'Too many sign in attempts. Please wait a moment and try again.';
      }

      // Store error for debugging
      await AsyncStorage.setItem('auth_error', JSON.stringify({
        message: userError,
        timestamp: new Date().toISOString()
      }));

      return {
        success: false,
        error: userError
      };
    }

    console.log('✅ Sign in successful');
    return {
      success: true,
      user: data.user,
      session: data.session
    };

  } catch (error) {
    console.error('❌ Enhanced sign in failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Sign in failed'
    };
  }
}

/**
 * Send email verification
 */
export async function sendEmailVerification(email: string): Promise<EmailVerificationResult> {
  try {
    console.log('📧 Sending email verification...');

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email,
    });

    if (error) {
      console.error('Email verification error:', error);
      return {
        success: false,
        message: 'Failed to send verification email',
        error: error.message
      };
    }

    console.log('✅ Email verification sent');
    return {
      success: true,
      message: 'Verification email sent successfully. Please check your inbox.'
    };

  } catch (error) {
    console.error('❌ Send email verification failed:', error);
    return {
      success: false,
      message: 'Failed to send verification email',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Enhanced password reset with better UX
 */
export async function enhancedPasswordReset(email: string): Promise<PasswordResetResult> {
  try {
    console.log('🔑 Starting password reset process...');

    if (!email) {
      return {
        success: false,
        message: 'Email address is required',
        error: 'Email is required'
      };
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://your-app.com/reset-password', // Update with your app's deep link
    });

    if (error) {
      console.error('Password reset error:', error);
      
      let userMessage = 'Failed to send password reset email';
      if (error.message.includes('rate limit')) {
        userMessage = 'Too many password reset requests. Please wait before trying again.';
      } else if (error.message.includes('not found')) {
        userMessage = 'No account found with this email address.';
      }

      return {
        success: false,
        message: userMessage,
        error: error.message
      };
    }

    console.log('✅ Password reset email sent');
    return {
      success: true,
      message: 'Password reset email sent successfully. Please check your inbox and follow the instructions.'
    };

  } catch (error) {
    console.error('❌ Enhanced password reset failed:', error);
    return {
      success: false,
      message: 'Failed to send password reset email',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Check authentication status with enhanced error handling
 */
export async function checkAuthStatus(): Promise<{
  isAuthenticated: boolean;
  user?: any;
  session?: any;
  error?: string;
}> {
  try {
    console.log('🔍 Checking authentication status...');

    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      console.error('Auth status check error:', error);
      return {
        isAuthenticated: false,
        error: error.message
      };
    }

    if (!session) {
      console.log('❌ No active session found');
      return {
        isAuthenticated: false
      };
    }

    console.log('✅ Active session found');
    return {
      isAuthenticated: true,
      user: session.user,
      session: session
    };

  } catch (error) {
    console.error('❌ Auth status check failed:', error);
    return {
      isAuthenticated: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Enhanced sign out with cleanup
 */
export async function enhancedSignOut(): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('🚪 Starting enhanced sign out process...');

    // Sign out from Supabase
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('Sign out error:', error);
      return {
        success: false,
        error: error.message
      };
    }

    // Clear local storage
    const keysToRemove = [
      'auth_error',
      'profile_local',
      'local_profile',
      'local_workout_completions',
      'local_meal_completions',
      'local_nutrition_tracking',
      'workout_plan',
      'meal_plans'
    ];

    await Promise.all(keysToRemove.map(key => AsyncStorage.removeItem(key)));

    console.log('✅ Sign out successful');
    return { success: true };

  } catch (error) {
    console.error('❌ Enhanced sign out failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Sign out failed'
    };
  }
}

/**
 * Prepare for social login integration (Google, Apple)
 * This sets up the foundation for future social login implementation
 */
export const socialLoginConfig = {
  google: {
    enabled: false, // Set to true when implementing
    clientId: '', // Add your Google client ID
    scopes: ['openid', 'email', 'profile']
  },
  apple: {
    enabled: false, // Set to true when implementing
    scopes: ['email', 'name']
  }
};

/**
 * Placeholder for Google sign in (to be implemented)
 */
export async function signInWithGoogle(): Promise<AuthResult> {
  return {
    success: false,
    error: 'Google sign in not yet implemented. Coming soon!'
  };
}

/**
 * Placeholder for Apple sign in (to be implemented)
 */
export async function signInWithApple(): Promise<AuthResult> {
  return {
    success: false,
    error: 'Apple sign in not yet implemented. Coming soon!'
  };
}

/**
 * Get authentication error from storage
 */
export async function getStoredAuthError(): Promise<string | null> {
  try {
    const errorData = await AsyncStorage.getItem('auth_error');
    if (errorData) {
      const parsed = JSON.parse(errorData);
      return parsed.message;
    }
    return null;
  } catch (error) {
    console.error('Error getting stored auth error:', error);
    return null;
  }
}

/**
 * Clear stored authentication error
 */
export async function clearStoredAuthError(): Promise<void> {
  try {
    await AsyncStorage.removeItem('auth_error');
  } catch (error) {
    console.error('Error clearing stored auth error:', error);
  }
}
