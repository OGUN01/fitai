import { Redirect } from 'expo-router';

// This file serves as a redirect to the home tab
export default function TabsIndex() {
  return <Redirect href="/(tabs)/home" />;
}
