import React from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Text } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, spacing, borderRadius } from '../../theme/theme';

type LoginPromptProps = {
  variant?: 'banner' | 'card' | 'minimal';
  message?: string;
  onDismiss?: () => void;
  showDismiss?: boolean;
  onPress?: () => void;
};

const LoginPrompt: React.FC<LoginPromptProps> = ({ 
  variant = 'card',
  message = 'Create an account to sync your progress across devices and never lose your data.',
  onDismiss,
  showDismiss = true,
  onPress
}) => {
  
  const handleLoginPress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push('/(auth)/signin');
    }
  };
  
  if (variant === 'minimal') {
    return (
      <TouchableOpacity 
        style={styles.minimalContainer}
        onPress={handleLoginPress}
      >
        <Ionicons name="log-in-outline" size={18} color={colors.primary.main} />
        <Text style={styles.minimalText}>Login or Create Account</Text>
      </TouchableOpacity>
    );
  }
  
  if (variant === 'banner') {
    return (
      <View style={styles.bannerContainer}>
        {showDismiss && (
          <TouchableOpacity style={styles.dismissButton} onPress={onDismiss}>
            <Ionicons name="close" size={20} color={colors.text.secondary} />
          </TouchableOpacity>
        )}
        <Text style={styles.bannerText}>{message}</Text>
        <TouchableOpacity style={styles.bannerButton} onPress={handleLoginPress}>
          <Text style={styles.bannerButtonText}>Login</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  // Default card variant
  return (
    <View style={styles.cardContainer}>
      {showDismiss && (
        <TouchableOpacity style={styles.dismissButton} onPress={onDismiss}>
          <Ionicons name="close" size={20} color={colors.text.secondary} />
        </TouchableOpacity>
      )}
      <LinearGradient
        colors={[colors.primary.light, colors.primary.main]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.iconContainer}
      >
        <Ionicons name="cloud-upload-outline" size={24} color="white" />
      </LinearGradient>
      <Text style={styles.title}>Save Your Progress</Text>
      <Text style={styles.message}>{message}</Text>
      <View style={styles.buttonRow}>
        <TouchableOpacity 
          style={styles.loginButton}
          onPress={handleLoginPress}
        >
          <LinearGradient
            colors={[colors.primary.main, colors.primary.dark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.buttonGradient}
          >
            <Text style={styles.buttonText}>Login or Sign Up</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: colors.surface.main,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginVertical: spacing.md,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  message: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  buttonRow: {
    flexDirection: 'row',
  },
  loginButton: {
    flex: 1,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  buttonGradient: {
    padding: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  dismissButton: {
    position: 'absolute',
    right: spacing.sm,
    top: spacing.sm,
    zIndex: 10,
  },
  bannerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.light,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.md,
  },
  bannerText: {
    flex: 1,
    fontSize: 14,
    color: colors.text.secondary,
    marginRight: spacing.sm,
  },
  bannerButton: {
    backgroundColor: colors.primary.main,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  bannerButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  minimalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
  },
  minimalText: {
    marginLeft: spacing.xs,
    color: colors.primary.main,
    fontWeight: '500',
  },
});

export default LoginPrompt; 