import { Stack } from 'expo-router';
import { Platform } from 'react-native';

export default function ProfileLayout() {
  // Use a more compatible presentation mode based on platform
  // On Android, use 'modal' which is more stable
  // On iOS, use 'card' which provides a nicer animation
  const presentationMode = Platform.OS === 'android' ? 'modal' : 'card';
  
  return (
    <Stack screenOptions={{
      headerShown: false,
      contentStyle: {
        backgroundColor: '#121232',
      },
    }}>
      <Stack.Screen 
        name="index" 
        options={{ 
          headerShown: false
        }}
      />
      
      <Stack.Screen 
        name="edit-profile" 
        options={{ 
          headerShown: false,
          presentation: presentationMode,
          animation: 'slide_from_right',
          animationDuration: 200,
        }} 
      />
    </Stack>
  );
} 