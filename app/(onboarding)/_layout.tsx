import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from 'react-native-paper';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../theme/theme';

export default function OnboardingLayout() {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.background.primary, colors.background.secondary]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: 'transparent',
          },
          headerTransparent: true,
          headerTintColor: colors.text.primary,
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          animation: 'slide_from_right',
          headerShown: false, // Hide all headers by default and control in individual screens
        }}
      >
        <Stack.Screen
          name="welcome"
          options={{
            title: 'Welcome',
            headerShown: false,
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="user-details"
          options={{
            title: 'About You',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="diet-preferences"
          options={{
            title: 'Diet Preferences',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="body-analysis"
          options={{
            title: 'Body Analysis',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="workout-preferences"
          options={{
            title: 'Workout Preferences',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="review"
          options={{
            title: 'Review',
            headerShown: false,
          }}
        />
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
