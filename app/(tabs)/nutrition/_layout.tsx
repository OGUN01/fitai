import React from 'react';
import { Stack } from 'expo-router';

export default function NutritionLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="test"
        options={{
          headerShown: false,
          title: "Meal Plan Test"
        }}
      />
    </Stack>
  );
} 