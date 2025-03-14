import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from 'react-native-paper';

export default function OnboardingLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.primary,
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        animation: 'slide_from_right',
      }}
    >
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
        }}
      />
      <Stack.Screen
        name="body-analysis"
        options={{
          title: 'Body Analysis',
        }}
      />
      <Stack.Screen
        name="workout-preferences"
        options={{
          title: 'Workout Preferences',
        }}
      />
      <Stack.Screen
        name="review"
        options={{
          title: 'Review',
        }}
      />
    </Stack>
  );
}
