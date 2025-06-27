import React, { useEffect, useState, useRef } from 'react';
import { Slot, Stack, useSegments } from 'expo-router';
import router from '../lib/router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import { lightTheme } from '../constants/theme';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { ProfileProvider, useProfile } from '../contexts/ProfileContext';
import { StreakProvider } from '../contexts/StreakContext';
import { Platform, View, Text } from 'react-native';
import * as Font from 'expo-font';
import 'react-native-url-polyfill/auto';
import NotificationService from '../services/notifications';
import { useFonts } from 'expo-font';
import { NavigationContainerRef } from '@react-navigation/native';
import { useColorScheme } from 'react-native';
import * as Notifications from 'expo-notifications';
import { InitialState } from '@react-navigation/routers';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { NotificationProvider } from '../contexts/NotificationContext';
import type { AppRoutes } from '../types/routes';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SyncStatusIndicator from '../components/SyncStatusIndicator';
import WorkoutCompletionHandler from '../components/workout/WorkoutCompletionHandler';
import MealCompletionHandler from '../components/meal/MealCompletionHandler';
import { ErrorBoundary } from '../components/ErrorBoundary';
import persistenceAdapter from '../utils/persistenceAdapter';
import { isOnboardingComplete, repairOnboardingStatus } from '../utils/onboardingStatusChecker';
import useStorageInitialization from '../utils/storageInitializer';
import { initializeOfflineQueue } from '../utils/offlineQueue'; // Added for offline queue
import { SkiaProvider } from '../contexts/SkiaContext'; // Import SkiaProvider
import SkiaContextInitializer from '../components/utility/SkiaContextInitializer'; // Import the new initializer

// Import initialization to ensure notifications are set up
import '../services/notifications/init';

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
  const { profile, loading: profileLoading, refreshProfile } = useProfile();
  // Use segments safely with type checking
  const rawSegments = useSegments();
  const segments = Array.isArray(rawSegments) ? rawSegments : [];
  const [isNavigating, setIsNavigating] = useState(false);
  const [initialCheckComplete, setInitialCheckComplete] = useState(false);
  const initialAuthCheckRef = useRef(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);

  // First effect just for initial auth verification
  useEffect(() => {
    if (!authLoading && user && !initialAuthCheckRef.current) {
      console.log("Auth detected on app launch, attempting to restore previous session");
      initialAuthCheckRef.current = true;
      
      // If we have auth but no profile yet, trigger profile refresh
      if (!profileLoading && !profile) {
        console.log("No profile loaded, forcing refresh for authenticated user");
        refreshProfile(true)
          .then(() => console.log("Initial profile loaded successfully"))
          .catch(err => console.error("Error loading initial profile:", err));
      }
    }
    
    // Check onboarding status on app launch
    const checkOnboardingStatus = async () => {
      try {
        const isComplete = await isOnboardingComplete();
        console.log(`📱 App launch - Onboarding status: ${isComplete ? 'COMPLETE' : 'INCOMPLETE'}`);
        setOnboardingCompleted(isComplete);
      } catch (error) {
        console.error('Error checking onboarding status on app launch:', error);
      }
    };
    
    checkOnboardingStatus();
  }, [authLoading, user, profile, profileLoading, refreshProfile]);

  useEffect(() => {
    if (authLoading || profileLoading || isNavigating) return;

    // Check authentication state and route accordingly - safely access segments
    const inAuthGroup = segments.length > 0 && segments[0] === '(auth)';
    const inOnboardingGroup = segments.length > 0 && segments[0] === '(onboarding)';
    const inDevGroup = segments.length > 0 && segments[0] === '(dev)';
    const inSettingsGroup = segments.length > 0 && segments[0] === '(settings)';
    
    // Allow dev routes regardless of auth status
    if (inDevGroup) {
      return;
    }
    
    // Allow settings routes for users who completed onboarding
    if (inSettingsGroup) {
      if (profile && (profile.has_completed_onboarding || profile.has_completed_local_onboarding || profile.current_onboarding_step === 'completed')) {
        setIsNavigating(false);
        return;
      }
    }
    
    // Handle navigation logic
    const handleNavigation = async () => {
      try {
        setIsNavigating(true);
        
        // LOCAL MODE CHANGES: No longer force redirect to login
        // Handle non-authenticated users
        if (!user) {
          // If we're in auth group, that's fine - user wants to authenticate
          if (inAuthGroup) {
            setIsNavigating(false);
            return;
          }
          
          // Check if we have a local profile
          if (profile) {
            console.log("Local profile detected:", {
              has_completed_local_onboarding: profile.has_completed_local_onboarding,
              current_step: profile.current_onboarding_step
            });
            
            // Check if onboarding is completed using our robust status check
            // This uses multiple sources including the profile, but also other dedicated storage
            if (onboardingCompleted || profile.has_completed_local_onboarding || profile.current_onboarding_step === 'completed') {
              console.log("Local onboarding is complete, ensuring we're in main app");
              // Local onboarding is complete, ensure we're in main app
              if (!inOnboardingGroup && segments[0] !== '(tabs)') {
                await router.replace('/(tabs)');
              }
            } else if (profile.current_onboarding_step === 'review') {
              // Fixed: Allow viewing the review screen first instead of skipping directly to completed
              console.log("Current step is review, ensuring user sees the review screen");

              // Check if user is on an edit screen (workout-preferences, diet-preferences, etc.)
              const isOnEditScreen = segments.length > 1 && (
                segments[1] === 'workout-preferences' ||
                segments[1] === 'diet-preferences' ||
                segments[1] === 'body-analysis' ||
                segments[1] === 'user-details'
              );

              // Don't redirect if user is on an edit screen - let them complete their edits
              if (isOnEditScreen) {
                console.log("User is on edit screen, allowing them to stay");
                setIsNavigating(false);
                return;
              }

              // If we're not already on the review screen AND not on the completed screen, go to review
              if (segments.length > 1 && segments[1] !== 'review' && segments[1] !== 'completed') {
                await router.replace('/(onboarding)/review');
              } else if (segments.length <= 1) {
                await router.replace('/(onboarding)/review');
              }
              // Don't automatically go to completed screen - let review screen handle that
            } else {
              // Double-check if onboarding is actually complete using our robust checker
              // This handles cases where profile.has_completed_local_onboarding might be false
              // but onboarding is actually complete according to other storage mechanisms
              const actuallyComplete = await isOnboardingComplete();
              if (actuallyComplete) {
                console.log('🔎 Onboarding appears incomplete in profile but is actually complete according to status checker');                  
                // Update profile to reflect that onboarding is complete to fix discrepancy
                await repairOnboardingStatus(true);
                await router.replace('/(tabs)');
                return;
              }
                
              // Local onboarding is indeed not complete, route to appropriate step
              if (!inOnboardingGroup) {
                const nextStep = profile.current_onboarding_step || 'welcome';
                console.log(`Local onboarding incomplete, routing to step: ${nextStep}`);
                // Use typed paths instead of template literals
                if (nextStep === 'welcome' || nextStep === 'user-details') {
                  await router.replace('/(onboarding)/welcome');
                } else if (nextStep === 'personal-info') {
                  await router.replace('/(onboarding)/personal-info');
                } else if (nextStep === 'body-metrics') {
                  await router.replace('/(onboarding)/body-metrics');
                } else if (nextStep === 'fitness-goals') {
                  await router.replace('/(onboarding)/fitness-goals');
                } else if (nextStep === 'workout-preferences') {
                  await router.replace('/(onboarding)/workout-preferences');
                } else if (nextStep === 'diet-preferences') {
                  await router.replace('/(onboarding)/diet-preferences');
                } else if (nextStep === 'review') {
                  await router.replace('/(onboarding)/review');
                } else {
                  // Default case
                  await router.replace('/(onboarding)/welcome');
                }
              }
            }
          } else {
            // No profile at all, start onboarding
            console.log("No local profile detected, starting onboarding");
            if (!inOnboardingGroup) {
              await router.replace('/(onboarding)/welcome');
            }
          }
          
          setIsNavigating(false);
          return;
        }
          
        // Handle authenticated users below
        if (!initialCheckComplete) {
          // Force fresh profile load from database on initial app load
          // This ensures we have the latest onboarding status
          console.log("Initial app load, forcing profile refresh to get latest onboarding status");
          await refreshProfile(true);
          setInitialCheckComplete(true);
          // We'll handle routing in the next effect cycle after profile is refreshed
          setIsNavigating(false);
          return;
        }
          
        if (profile) {
          console.log("Navigation check - has_completed_onboarding:", profile.has_completed_onboarding);
          console.log("Navigation check - current_onboarding_step:", profile.current_onboarding_step);
          
          if (!profile.has_completed_onboarding) {
            // Check if they're on the review step
            if (profile.current_onboarding_step === 'review') {
              // Fixed: Allow viewing the review screen first instead of skipping to completed
              console.log("Current step is review, ensuring authenticated user sees the review screen");

              // Check if user is on an edit screen (workout-preferences, diet-preferences, etc.)
              const isOnEditScreen = segments.length > 1 && (
                segments[1] === 'workout-preferences' ||
                segments[1] === 'diet-preferences' ||
                segments[1] === 'body-analysis' ||
                segments[1] === 'user-details'
              );

              // Don't redirect if user is on an edit screen - let them complete their edits
              if (isOnEditScreen) {
                console.log("Authenticated user is on edit screen, allowing them to stay");
                setIsNavigating(false);
                return;
              }

              // If we're not already on the review screen AND not on the completed screen, go to review
              if (segments.length > 1 && segments[1] !== 'review' && segments[1] !== 'completed') {
                await router.replace('/(onboarding)/review');
              } else if (segments.length <= 1) {
                await router.replace('/(onboarding)/review');
              }
              // Don't automatically go to completed screen - let review screen handle that
            } else {
              // Not completed onboarding, go to current step or start
              const nextStep = profile.current_onboarding_step || 'user-details';
              console.log(`User hasn't completed onboarding, redirecting to step: ${nextStep}`);
              
              // Use typed paths instead of template literals
              if (nextStep === 'welcome' || nextStep === 'user-details') {
                await router.replace('/(onboarding)/welcome');
              } else if (nextStep === 'personal-info') {
                await router.replace('/(onboarding)/personal-info');
              } else if (nextStep === 'body-metrics') {
                await router.replace('/(onboarding)/body-metrics');
              } else if (nextStep === 'fitness-goals') {
                await router.replace('/(onboarding)/fitness-goals');
              } else if (nextStep === 'workout-preferences') {
                await router.replace('/(onboarding)/workout-preferences');
              } else if (nextStep === 'diet-preferences') {
                await router.replace('/(onboarding)/diet-preferences');
              } else if (nextStep === 'review') {
                await router.replace('/(onboarding)/review');
              } else {
                // Default case
                await router.replace('/(onboarding)/welcome');
              }
            }
          } else if (segments[0] !== '(tabs)') {
            // Onboarding is complete, make sure they're in the main app
            console.log("User has completed onboarding, redirecting to main app");
            await router.replace('/(tabs)');
          }
        }
      } finally {
        setIsNavigating(false);
      }
    };
    
    // Debounce navigation to prevent rapid route changes
    const navigationTimeout = setTimeout(() => {
      handleNavigation();
    }, 300);

    return () => clearTimeout(navigationTimeout);
  }, [user, profile, segments, authLoading, profileLoading, router, isNavigating, initialCheckComplete]);

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

// Define RootStackParamList type
type RootStackParamList = AppRoutes;

// Root layout combining all providers and navigation logic
export default function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [initialRouteChecked, setInitialRouteChecked] = useState(false);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);
  const colorScheme = useColorScheme();

  // Initialize offline queue on app start
  useEffect(() => {
    initializeOfflineQueue();
  }, []);

  // Initialize custom storage solution
  useStorageInitialization();

  // Note: Notification initialization is handled by services/notifications/init.ts
  // which is imported at the top of this file and runs automatically

  // Initialize app resources
  useEffect(() => {
    async function prepare() {
      try {
        console.log('Starting app initialization...');

        // Load fonts
        await cacheFonts();
        setFontsLoaded(true);

        // Notifications are automatically initialized by services/notifications/init.ts

        console.log('App initialization complete');
        setAppIsReady(true);
      } catch (e) {
        console.warn('App initialization error:', e);
        // Continue with app launch even if some initialization fails
        setAppIsReady(true);
      } finally {
        // Hide splash screen
        await SplashScreen.hideAsync();
      }
    }

    prepare();
  }, []);

  // If the app is not ready (fonts not loaded, initial route not checked), show a fallback or splash screen
  if (!appIsReady) {
    return <AppLoadingFallback />;
  }

  return (
    <ErrorBoundary>
      <SkiaProvider>
        <SkiaContextInitializer />
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <PaperProvider theme={lightTheme}>
              <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
                <NotificationProvider>
                  <AuthProvider> { /* AuthProvider is already here, good */ }
                    <ProfileProvider>
                      <StreakProvider>
                        <NavigationGuard>
                        <Stack 
                          screenOptions={{
                            headerShown: false,
                            animation: 'slide_from_right',
                            gestureEnabled: true,
                          }}
                        >
                          <Stack.Screen name="index" redirect={true} />
                          <Stack.Screen name="(tabs)" />
                          <Stack.Screen name="(auth)" />
                          <Stack.Screen name="(onboarding)" />
                          <Stack.Screen name="(settings)" />
                           {/* Development/Testing Routes */}
                          <Stack.Screen name="(dev)/test-onboarding" />
                          <Stack.Screen name="(dev)/test-notifications" />
                          <Stack.Screen name="(dev)/test-modal" />
                          <Stack.Screen name="(dev)/test-camera" />
                          <Stack.Screen name="(dev)/test-image-picker" />
                          <Stack.Screen name="(dev)/test-sync" />
                          <Stack.Screen name="(dev)/test-skia" />
                          {/* Add other modal routes here if necessary */}
                          <Stack.Screen name="modal/cameraModal" options={{ presentation: 'modal' }} />
                          <Stack.Screen name="modal/imagePickerModal" options={{ presentation: 'modal' }} />
                          <Stack.Screen name="modal/confirmationModal" options={{ presentation: 'modal' }} />
                          <Stack.Screen name="modal/notificationSettingsModal" options={{ presentation: 'modal'}}/>
                          <Stack.Screen name="modal/feedbackModal" options={{ presentation: 'modal' }} />
                          <Stack.Screen name="modal/errorModal" options={{ presentation: 'modal' }} />
                          <Stack.Screen name="modal/premiumUpsellModal" options={{ presentation: 'modal' }} />
                        </Stack>
                      </NavigationGuard>
                      <WorkoutCompletionHandler />
                      <MealCompletionHandler />
                      <SyncStatusIndicator />
                      </StreakProvider>
                    </ProfileProvider>
                  </AuthProvider>
                </NotificationProvider>
              </ThemeProvider>
            </PaperProvider>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </SkiaProvider>
    </ErrorBoundary>
  );
}
