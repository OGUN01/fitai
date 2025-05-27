import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import 'react-native-url-polyfill/auto';
import '../services/notifications/init';

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

  // LOCAL MODE CHANGES: No longer require login to start
  // For all users, direct them to onboarding which will properly route based on their status
  return <Redirect href="/(onboarding)/welcome" />;
}
