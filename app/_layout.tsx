import React, { useEffect, useState } from 'react';
import { Slot, Stack, useSegments, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import { lightTheme } from '../constants/theme';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { ProfileProvider, useProfile } from '../contexts/ProfileContext';
import { Platform, View, Text } from 'react-native';
import * as Font from 'expo-font';
import 'react-native-url-polyfill/auto';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

// Define our font loading function with proper timeout handling
const cacheFonts = async () => {
  try {
    // Use a shorter timeout to avoid waiting too long for font loading
    const fontTimeout = 2000; // 2 seconds timeout instead of default 6 seconds
    
    if (Platform.OS === 'web') {
      // For web, use dynamic stylesheet loading instead of FontFaceObserver
      const fontFamilies = [
        'MaterialCommunityIcons',
        'MaterialIcons',
        'FontAwesome'
      ];

      // Create a link element for each font 
      fontFamilies.forEach(family => {
        // Check if the link already exists
        const existingLink = document.getElementById(`font-${family}`);
        if (!existingLink) {
          const link = document.createElement('link');
          link.id = `font-${family}`;
          link.rel = 'stylesheet';
          link.type = 'text/css';
          // Point to the CDN where the fonts are hosted
          link.href = `https://cdn.jsdelivr.net/npm/@expo/vector-icons/build/vendor/${family}.ttf`;
          link.media = 'all';
          document.head.appendChild(link);
        }
      });
    } else {
      // On native platforms, use Promise.race to implement a timeout
      const fontLoadPromise = Font.loadAsync({
        // These are the default icon fonts used by react-native-paper
        'MaterialCommunityIcons': require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialCommunityIcons.ttf'),
        'MaterialIcons': require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialIcons.ttf'),
        'FontAwesome': require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/FontAwesome.ttf'),
      });
      
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Font loading timed out after ${fontTimeout}ms`)), fontTimeout)
      );
      
      // Race the font loading against the timeout
      try {
        await Promise.race([fontLoadPromise, timeoutPromise]);
        console.log('Fonts loaded successfully');
      } catch (error) {
        console.warn('Font loading issue:', error);
        // Continue with app launch even if font loading fails or times out
      }
    }
    
    return true;
  } catch (error) {
    console.warn('Font caching error:', error);
    // Continue app initialization even if font loading fails
    return false;
  }
};

// Navigation guard to control user flow based on auth and onboarding status
function NavigationGuard({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const segments = useSegments();
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    if (authLoading || profileLoading || isNavigating) return;

    // Check authentication state and route accordingly
    const inAuthGroup = segments[0] === '(auth)';
    const inOnboardingGroup = segments[0] === '(onboarding)';
    const inDevGroup = segments[0] === '(dev)';
    
    // Allow dev routes regardless of auth status
    if (inDevGroup) {
      return;
    }
    
    // Handle navigation logic
    const handleNavigation = async () => {
      try {
        setIsNavigating(true);
        
        if (!user && !inAuthGroup) {
          // Not signed in, redirect to login
          await router.replace('/(auth)/login');
        } else if (user && !inAuthGroup && !inOnboardingGroup) {
          // User is signed in, check if they've completed onboarding
          if (profile && !profile.has_completed_onboarding) {
            // Not completed onboarding, go to current step or start
            const nextStep = profile.current_onboarding_step || 'user-details';
            await router.replace(`/(onboarding)/${nextStep}`);
          }
        }
      } finally {
        setIsNavigating(false);
      }
    };
    
    handleNavigation();
  }, [user, profile, segments, authLoading, profileLoading, router, isNavigating]);

  return <>{children}</>;
}

// Create a loading component to display while fonts are loading
function AppLoadingFallback() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Loading resources...</Text>
    </View>
  );
}

export default function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        console.log('Loading app resources...');
        
        // Pre-load fonts with timeout handling
        await cacheFonts();
        
        // Add any other asset loading here
        // For example: images, audio files, etc.
        
        console.log('Resources loaded successfully');
      } catch (e) {
        // Log any errors during initialization but proceed with app launch
        console.warn('Error loading resources:', e);
      } finally {
        // Mark app as ready and hide splash screen
        setAppIsReady(true);
        await SplashScreen.hideAsync().catch(error => 
          console.warn('Error hiding splash screen:', error)
        );
      }
    }

    prepare();
  }, []);

  // Show loading indicator while app is preparing
  if (!appIsReady) {
    return <AppLoadingFallback />;
  }

  return (
    <AuthProvider>
      <ProfileProvider>
        <PaperProvider theme={lightTheme}>
          <SafeAreaProvider>
            <StatusBar style="auto" />
            <NavigationGuard>
              <Slot />
            </NavigationGuard>
          </SafeAreaProvider>
        </PaperProvider>
      </ProfileProvider>
    </AuthProvider>
  );
}
