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
import persistenceAdapter from '../utils/persistenceAdapter';
import { isOnboardingComplete, repairOnboardingStatus } from '../utils/onboardingStatusChecker';
import useStorageInitialization from '../utils/storageInitializer';
import { initializeOfflineQueue } from '../utils/offlineQueue'; // Added for offline queue

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
    
    handleNavigation();
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

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [appIsReady, setAppIsReady] = useState(false);
  const [loaded, error] = useFonts({
    ...FontAwesome.font,
  });
  
  // Initialize storage system - this ensures data persists across session restarts
  const isStorageInitialized = useStorageInitialization();

  // Use to persist navigation state
  const [initialNavigationState, setInitialNavigationState] = useState<InitialState | undefined>(
    undefined
  );
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>();
  
  // Initialize notification service when app starts
  useEffect(() => {
    async function initializeNotifications() {
      try {
        await NotificationService.setupNotifications();
        console.log('Notification service initialized');
      } catch (error) {
        console.error('Failed to initialize notification service:', error);
      }
    }
    
    initializeNotifications();

    // Initialize offline queue
    const unsubscribeOfflineQueue = initializeOfflineQueue();

    return () => {
      // Cleanup listeners
      if (unsubscribeOfflineQueue) {
        unsubscribeOfflineQueue();
      }
    };
  }, []);

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

  // Prevent the splash screen from auto-hiding
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  // Initialization for the app (before the Stack is rendered)
  useEffect(() => {
    // Clean up any stale API rate limit flags
    resetApiRateLimitFlags();
  }, []);

  // Reset any stale API rate limit flags
  const resetApiRateLimitFlags = async () => {
    try {
      // Always clear meal plan generation progress flag on app start
      await AsyncStorage.setItem('meal_plan_generation_in_progress', 'false');
      await AsyncStorage.removeItem('mealplan_loading_lock');
      await AsyncStorage.removeItem('mealplan_loading_timestamp');
      
      // Check for rate limit flags
      const rateLimitTimestamp = await AsyncStorage.getItem('meal_plan_rate_limit_timestamp');
      if (rateLimitTimestamp) {
        const timestamp = parseInt(rateLimitTimestamp);
        // If the rate limit was set more than 2 hours ago, clear it
        if (Date.now() - timestamp > 2 * 60 * 60 * 1000) {
          console.log("Clearing stale API rate limit flags");
          await AsyncStorage.setItem('skipApiCalls', 'false');
          await AsyncStorage.setItem('meal_plan_rate_limited', 'false');
        } else {
          // If rate limit is less than 2 hours old, make sure we know about it
          console.log("API rate limit detected (still active), will use fallback plans");
          await AsyncStorage.setItem('skipApiCalls', 'true');
          await AsyncStorage.setItem('meal_plan_rate_limited', 'true');
        }
      }
    } catch (error) {
      console.error("Error resetting API rate limit flags:", error);
    }
  };

  // <<< START AsyncStorage Persistence Test >>>
  useEffect(() => {
    const testPersistence = async () => {
      const key = 'fitai_core_persist_test'; // Unique key
      console.log(`[PERSIST TEST] Checking key: ${key}`);
      try {
        const storedValue = await AsyncStorage.getItem(key);
        console.log(`[PERSIST TEST] Value on start/reload: ${storedValue}`);
        
        if (!storedValue) {
          const newValue = `TestValue_${Date.now()}`;
          console.log(`[PERSIST TEST] Value not found. Writing new value: ${newValue}`);
          await AsyncStorage.setItem(key, newValue);
          const writtenValue = await AsyncStorage.getItem(key);
          console.log(`[PERSIST TEST] Verified write, read back: ${writtenValue}`);
        } else {
          console.log('[PERSIST TEST] Value found from previous session/reload.');
        }
      } catch (error) {
        console.error('[PERSIST TEST] Error during test:', error);
      }
    };
    
    // Run the test shortly after mount to allow initial render
    const timerId = setTimeout(testPersistence, 100);
    
    return () => clearTimeout(timerId); // Cleanup timer
  }, []);
  // <<< END AsyncStorage Persistence Test >>>

  // Show loading indicator while app is preparing or storage is initializing
  if (!appIsReady || !isStorageInitialized) {
    return <AppLoadingFallback />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <ProfileProvider>
          <StreakProvider>
            <NotificationProvider>
              <SafeAreaProvider>
                <NavigationGuard>
                  <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
                    <PaperProvider theme={lightTheme}>
                      <StatusBar translucent />
                      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
                        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                        <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
                        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                        <Stack.Screen name="(dev)" options={{ headerShown: false }} />
                        <Stack.Screen name="(settings)" options={{ headerShown: false }} />
                        <Stack.Screen name="(modal)" options={{ presentation: 'modal', headerShown: false }} />
                      </Stack>
                      <WorkoutCompletionHandler />
                      <MealCompletionHandler />
                      <SyncStatusIndicator />
                    </PaperProvider>
                  </ThemeProvider>
                </NavigationGuard>
              </SafeAreaProvider>
            </NotificationProvider>
          </StreakProvider>
        </ProfileProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
