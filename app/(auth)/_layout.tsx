import React from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

export default function AuthLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Screen 
          name="login" 
          options={{ 
            title: 'Log In',
            headerShown: false 
          }} 
        />
        <Stack.Screen 
          name="signin" 
          options={{ 
            title: 'Sign In',
            headerShown: false 
          }} 
        />
        <Stack.Screen 
          name="signup" 
          options={{ 
            title: 'Sign Up',
            headerShown: false 
          }} 
        />
        <Stack.Screen 
          name="forgot-password" 
          options={{ 
            title: 'Reset Password',
            headerShown: false 
          }} 
        />
      </Stack>
    </SafeAreaProvider>
  );
}
