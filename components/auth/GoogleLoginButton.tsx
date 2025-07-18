/**
 * Google Login Button Component
 * 
 * Reusable Google OAuth login button for FitAI authentication
 * Integrates with Supabase OAuth and AuthContext
 */

import React, { useState } from 'react';
import { 
  TouchableOpacity, 
  View, 
  StyleSheet, 
  Alert,
  ActivityIndicator 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import StyledText from '../ui/StyledText';
import { useAuth } from '../../contexts/AuthContext';
import { colors, spacing, borderRadius, shadows } from '../../theme/theme';

interface GoogleLoginButtonProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  size?: 'small' | 'medium' | 'large';
}

export default function GoogleLoginButton({
  onSuccess,
  onError,
  disabled = false,
  variant = 'primary',
  size = 'medium'
}: GoogleLoginButtonProps) {
  const [loading, setLoading] = useState(false);
  const { signInWithGoogle } = useAuth();

  const handleGoogleSignIn = async () => {
    if (disabled || loading) return;

    try {
      setLoading(true);
      console.log("🔍 Google login button pressed");
      
      await signInWithGoogle();
      
      console.log("✅ Google sign-in completed successfully");
      onSuccess?.();
      
    } catch (error: any) {
      console.error("❌ Google sign-in failed:", error);
      
      const errorMessage = error.message || "Google sign-in failed. Please try again.";
      
      // Show user-friendly error
      Alert.alert(
        "Sign-in Failed",
        errorMessage,
        [{ text: "OK" }]
      );
      
      onError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getButtonStyle = () => {
    const baseStyle = [styles.button];
    
    // Variant styles
    if (variant === 'primary') {
      baseStyle.push(styles.primaryButton);
    } else {
      baseStyle.push(styles.secondaryButton);
    }
    
    // Size styles
    if (size === 'small') {
      baseStyle.push(styles.smallButton);
    } else if (size === 'large') {
      baseStyle.push(styles.largeButton);
    } else {
      baseStyle.push(styles.mediumButton);
    }
    
    // Disabled style
    if (disabled || loading) {
      baseStyle.push(styles.disabledButton);
    }
    
    return baseStyle;
  };

  const getTextStyle = () => {
    const baseStyle = [styles.buttonText];
    
    if (variant === 'primary') {
      baseStyle.push(styles.primaryText);
    } else {
      baseStyle.push(styles.secondaryText);
    }
    
    if (size === 'small') {
      baseStyle.push(styles.smallText);
    } else if (size === 'large') {
      baseStyle.push(styles.largeText);
    }
    
    return baseStyle;
  };

  const getIconSize = () => {
    switch (size) {
      case 'small': return 18;
      case 'large': return 28;
      default: return 22;
    }
  };

  return (
    <TouchableOpacity
      style={getButtonStyle()}
      onPress={handleGoogleSignIn}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      <View style={styles.buttonContent}>
        {loading ? (
          <ActivityIndicator 
            size="small" 
            color={variant === 'primary' ? colors.text.primary : colors.primary.main}
            style={styles.loadingIcon}
          />
        ) : (
          <Ionicons 
            name="logo-google" 
            size={getIconSize()} 
            color={variant === 'primary' ? colors.text.primary : colors.primary.main}
            style={styles.icon}
          />
        )}
        
        <StyledText 
          variant={size === 'small' ? 'bodySmall' : size === 'large' ? 'bodyLarge' : 'bodyMedium'}
          style={getTextStyle()}
        >
          {loading ? 'Signing in...' : 'Continue with Google'}
        </StyledText>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: borderRadius.medium,
    borderWidth: 1,
    ...shadows.small,
  },
  
  // Variant styles
  primaryButton: {
    backgroundColor: colors.surface.light,
    borderColor: colors.border.medium,
  },
  
  secondaryButton: {
    backgroundColor: 'transparent',
    borderColor: colors.primary.main,
  },
  
  // Size styles
  smallButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    minHeight: 40,
  },
  
  mediumButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  
  largeButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 56,
  },
  
  disabledButton: {
    opacity: 0.6,
  },
  
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  icon: {
    marginRight: spacing.sm,
  },
  
  loadingIcon: {
    marginRight: spacing.sm,
  },
  
  buttonText: {
    fontWeight: '600',
  },
  
  // Text variant styles
  primaryText: {
    color: colors.text.primary,
  },
  
  secondaryText: {
    color: colors.primary.main,
  },
  
  // Text size styles
  smallText: {
    fontSize: 14,
  },
  
  largeText: {
    fontSize: 18,
  },
});

// Export types for use in other components
export type { GoogleLoginButtonProps };
