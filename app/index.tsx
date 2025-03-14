import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import 'react-native-url-polyfill/auto';

// This is the entry point of the app
export default function Index() {
  const { user, loading: authLoading } = useAuth();
  
  // Show loading indicator while auth is loading
  if (authLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Simple redirect based only on authentication
  // The NavigationGuard in _layout.tsx will handle the rest of the navigation logic
  if (!user) {
    return <Redirect href="/(auth)/login" />;
  } else {
    // Just redirect to tabs - NavigationGuard will handle onboarding check
    return <Redirect href="/(tabs)" />;
  }
}
