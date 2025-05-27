import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Text, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { EventRegister } from 'react-native-event-listeners';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getRandomQuote, getNextQuote } from '../../../data/motivationalQuotes';
import * as Haptics from 'expo-haptics';

// Import theme and components
import { colors, spacing } from '../../../theme/theme';
import ModernHomeScreen from '../../../components/home/ModernHomeScreen';
import EnhancedHomeScreen from '../../../components/home/EnhancedHomeScreen';
import LoginPrompt from '../../../components/ui/LoginPrompt';

// Import needed functions for progress calculation
import { format } from 'date-fns';

// Import tracking service functions
import { isWorkoutCompleted, isMealCompleted } from '../../../services/trackingService';

// Import real contexts instead of using mock data
import { useAuth } from '../../../contexts/AuthContext';
import { useProfile } from '../../../contexts/ProfileContext';
import { useStreak } from '../../../contexts/StreakContext';
import { UserProfile } from '../../../types/profile'; // Import UserProfile from the types folder

// Enhanced type for UserProfile with workout_plan
interface EnhancedUserProfile extends UserProfile {
  workout_plan?: {
    weeklySchedule?: any[];
    planCreatedAt?: string;
    planDetails?: any;
  };
}

// Define meal time interface
interface MealTime {
  name: string;
  time: string;
}

// Enhanced DietPreferences type to include meal_times
interface EnhancedDietPreferences {
  diet_type?: string;
  dietary_restrictions?: string[];
  allergies?: string[];
  goals?: string[];
  meal_frequency?: number;
  meal_times?: MealTime[];
  country_region?: string;
  excluded_foods?: string[];
  favorite_foods?: string[];
}

// MOCK WORKOUTS CONTEXT
const useWorkouts = () => {
  const { profile } = useProfile();
  const [hasWorkouts, setHasWorkouts] = useState(false);
  
  useEffect(() => {
    // Check if profile has workout_plan with valid data
    const enhancedProfile = profile as EnhancedUserProfile;
    const workoutPlan = enhancedProfile?.workout_plan;
    const hasValidWorkoutPlan = workoutPlan && 
      workoutPlan.weeklySchedule && 
      Array.isArray(workoutPlan.weeklySchedule) && 
      workoutPlan.weeklySchedule.length > 0;
    
    setHasWorkouts(hasValidWorkoutPlan || false);
  }, [profile]);
  
  return { 
    workouts: hasWorkouts ? (profile as EnhancedUserProfile)?.workout_plan?.weeklySchedule || [] : [],
    todayWorkout: hasWorkouts ? (profile as EnhancedUserProfile)?.workout_plan?.weeklySchedule?.[0] || null : null,
    completedWorkouts: [],
    loading: false,
    error: null,
    hasWorkouts
  };
};

// MOCK MEALS CONTEXT
const useMeals = () => {
  const { profile } = useProfile();
  
  // Get meal times from diet preferences directly
  let userMealTimes = [];
  
  // First, try to get meal times from diet_preferences
  if (profile?.diet_preferences?.meal_times && Array.isArray(profile.diet_preferences.meal_times)) {
    userMealTimes = profile.diet_preferences.meal_times.map((meal: any) => {
      // Handle different meal time formats
      if (typeof meal === 'string') {
        // If it's just a time string, try to determine the meal name based on the time
        const hour = parseInt(meal.split(':')[0]);
        let name = 'Meal';
        if (hour < 11) name = 'Breakfast';
        else if (hour < 15) name = 'Lunch';
        else name = 'Dinner';
        return { name, time: meal };
      } else if (typeof meal === 'object' && meal !== null) {
        return {
          name: meal.name || 'Meal',
          time: meal.time || '12:00 PM'
        };
      } else {
        return { name: 'Meal', time: '12:00 PM' };
      }
    });
  } 
  // If no meal times in diet_preferences, use default times
  else {
    userMealTimes = [
      { name: "Breakfast", time: "08:00 AM" },
      { name: "Lunch", time: "12:30 PM" },
      { name: "Dinner", time: "07:00 PM" }
    ];
  }
  
  return { 
    meals: [],
    todayMeals: null,
    completedMeals: [],
    mealTimes: userMealTimes,
    loading: false,
    error: null
  };
};

// Simple loading screen component
const LoadingScreen = () => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <ActivityIndicator size="large" color={colors.primary.main} />
  </View>
);

// Simple error screen component
const ErrorScreen = ({ message, onRetry }: { message: string, onRetry: () => void }) => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
    <Text style={{ fontSize: 16, color: colors.text.primary, marginBottom: 20, textAlign: 'center' }}>
      Something went wrong: {message}
    </Text>
    <Button mode="contained" onPress={onRetry}>
      Retry
    </Button>
  </View>
);

/**
 * HomeScreen component - main landing page for the app
 */
export default function HomeScreen() {
  // Get authenticated user
  const { user } = useAuth();  
  const { profile, loading, error } = useProfile();
  const { currentStreak, syncStreakData } = useStreak();
  const { workouts, todayWorkout, hasWorkouts } = useWorkouts();
  const { mealTimes } = useMeals();
  
  // Define state variables
  const [refreshing, setRefreshing] = useState(false);
  const [quote, setQuote] = useState<string | null>(null);
  const [showLoginBanner, setShowLoginBanner] = useState(true);
  const [isRefreshingQuote, setIsRefreshingQuote] = useState(false);
  const [activeTab, setActiveTab] = useState<'modern' | 'enhanced'>('enhanced');
  const [streak, setStreak] = useState(0);
  const [todayMealsCompleted, setTodayMealsCompleted] = useState<string[]>([]);
  const [todayWorkoutCompleted, setTodayWorkoutCompleted] = useState(false);
  const [isWorkoutScheduledToday, setIsWorkoutScheduledToday] = useState(false);
  
  // Register event listeners for meal and workout completion
  useEffect(() => {
    // Listen for meal completion events
    const mealCompletionListener = EventRegister.addEventListener('mealCompleted', (data: any) => {
      console.log('🍽️ Home tab received meal completion event:', data);
      
      // Be more lenient with user ID matching to handle async user loading
      // Only use the user ID check if we have a user and the event has a userId
      const shouldProcess = !user || !data.userId || data.userId === user.id || data.userId === 'local_user';
      
      if (data && shouldProcess) {
        console.log('✅ Processing meal completion in home tab');
        // Update the meals completed state
        setTodayMealsCompleted(prev => {
          // Only add the meal if it's not already in the array
          if (!prev.includes(data.mealType)) {
            return [...prev, data.mealType];
          }
          return prev;
        });
        
        // Force an immediate refresh of completion status
        setTimeout(() => {
          checkCompletionStatus();
        }, 100);
      } else {
        console.log('❌ Home tab ignoring meal completion event - user ID mismatch');
      }
    });
    
    // Listen for workout completion event
    const workoutCompletionListener = EventRegister.addEventListener('workoutCompleted', (data: any) => {
      console.log('🏋️ Home tab received workout completion event:', data);
      
      // Be more lenient with user ID matching to handle async user loading
      // Only use the user ID check if we have a user and the event has a userId
      const shouldProcess = !user || !data.userId || data.userId === user.id || data.userId === 'local_user';
      
      if (data && shouldProcess) {
        console.log('✅ Processing workout completion in home tab');
        // Update the workout completed state
        setTodayWorkoutCompleted(true);
        
        // Force an immediate refresh of completion status
        setTimeout(() => {
          checkCompletionStatus();
        }, 100);
      } else {
        console.log('❌ Home tab ignoring workout completion event - user ID mismatch');
      }
    });
    
    // Listen for direct streak updates
    const streakUpdatedListener = EventRegister.addEventListener('streakUpdated', (data: any) => {
      console.log('🔥 Home tab received streak update event:', data);
      if (data && typeof data.streak === 'number') {
        console.log(`Setting streak state directly to ${data.streak}`);
        setStreak(data.streak);
      }
    });
    
    // Clean up event listeners when component unmounts
    return () => {
      EventRegister.removeEventListener(mealCompletionListener as string);
      EventRegister.removeEventListener(workoutCompletionListener as string);
      EventRegister.removeEventListener(streakUpdatedListener as string);
    };
  }, [user, todayWorkoutCompleted]);
  
  // Use useFocusEffect to run checkCompletionStatus when the screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      console.log('Home screen focused, checking completion status...');
      // Check completion status regardless of auth state - works for both local and authenticated users
        checkCompletionStatus();
        loadSavedQuote(); // Also load quote on focus
      
      // Check if login banner should be hidden
      const checkBannerPreference = async () => {
        try {
          const hideBanner = await AsyncStorage.getItem('hideLoginBanner');
          if (hideBanner === 'true') {
            setShowLoginBanner(false);
          }
        } catch (e) {
          console.warn('Could not read banner preference:', e);
        }
      };
      checkBannerPreference();
    }, [profile]) // Keep profile as dependency to catch any profile changes
  );
  
  // Get the current day name (needed for useMemo hooks below)
  const currentDayName = format(new Date(), 'EEEE');

  // Check if there's a workout scheduled for today based on workout days
  // Removed useMemo of isWorkoutScheduledToday to use state variable instead
  
  // Update isWorkoutScheduledToday state on profile changes
  useEffect(() => {
    if (profile?.workout_preferences?.preferred_days) {
      const preferredDays = profile.workout_preferences.preferred_days || [];
      const normalizedPreferredDays = preferredDays.map(day => 
        typeof day === 'string' ? day.toLowerCase() : ''
      );
      setIsWorkoutScheduledToday(normalizedPreferredDays.includes(currentDayName.toLowerCase()));
    } else {
      setIsWorkoutScheduledToday(false);
    }
  }, [profile, currentDayName]);

  // Get the next workout day (if workouts exist)
  const getNextWorkout = useMemo(() => {
    if (!profile || !hasWorkouts || !workouts || workouts.length === 0) {
      return null;
    }
    // Simplified example, actual logic might be more complex
    // This assumes 'workouts' is an array of objects with a 'day' or 'date' property
    // and 'todayWorkout' gives info about today.
    // For now, returning the structure used by components.
    return {
      day: todayWorkout?.title ? 'Today' : 'Next', // Placeholder
      name: todayWorkout?.title || workouts[0]?.title || 'Upcoming Workout',
      daysUntil: 0 // Placeholder, would need date logic
    };
  }, [profile, hasWorkouts, workouts, todayWorkout]);
  
  // Create the activity summary data for the UI components
  const activitySummary = useMemo(() => {
    const isWorkoutDay = isWorkoutScheduledToday; // Use the memoized value
    const isRestDay = !isWorkoutDay;
    let dailyProgressPercentage = 0;
    const totalMeals = mealTimes?.length || 1;

    if (isWorkoutDay) {
      const completedItems = (todayWorkoutCompleted ? 1 : 0) + todayMealsCompleted.length;
      const totalItems = 1 + totalMeals;
      dailyProgressPercentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
    } else {
      dailyProgressPercentage = totalMeals > 0 ? Math.round((todayMealsCompleted.length / totalMeals) * 100) : 0;
    }
    
    let workoutPercentage = 0;
    if (isRestDay) {
      workoutPercentage = 100;
    } else {
      // It's a scheduled workout day
      workoutPercentage = todayWorkoutCompleted ? 100 : 0;
    }

    return {
      workouts: {
        count: todayWorkoutCompleted ? 1 : 0,
        percentage: workoutPercentage,
        isRestDay: isRestDay,
        scheduledForToday: isWorkoutDay,
        todayCompleted: todayWorkoutCompleted,
        todayWorkoutName: todayWorkout?.title || (isRestDay ? 'Rest Day' : 'Workout'),
        dayStreak: streak
      },
      meals: {
        count: todayMealsCompleted.length,
        percentage: totalMeals > 0 ? Math.round((todayMealsCompleted.length / totalMeals) * 100) : 0,
        pendingMeals: mealTimes
          ?.filter(meal => !todayMealsCompleted.includes(meal.name))
          ?.map(meal => meal.name) || [],
        allCompleted: (mealTimes?.length || 0) > 0 && todayMealsCompleted.length === (mealTimes?.length || 0)
      },
      progress: {
        percentage: dailyProgressPercentage
      }
    };
  }, [profile, todayMealsCompleted, todayWorkoutCompleted, mealTimes, todayWorkout, streak, isWorkoutScheduledToday]);
  
  // Function to check meal and workout completion status
  const checkCompletionStatus = async () => {
    console.log('Checking completion status for home screen...');
    try {
      // Check if workout is completed for today
      const now = new Date();
      const dateString = format(now, 'yyyy-MM-dd');
      const userId = user?.id || 'local_user';
      
      // Determine if today is a workout day
      const currentDayName = format(now, 'EEEE');
      
      // Check if workout is scheduled for today based on profile workout_preferences
      setIsWorkoutScheduledToday(
        profile?.workout_preferences?.preferred_days
          ? profile.workout_preferences.preferred_days.some(
              (day: string) => day === currentDayName
            )
          : false
      );
      
      // Check if workout is completed for today
      let workoutDone = false;
      try {
        workoutDone = await isWorkoutCompleted(userId, dateString);
        console.log(`🏋️‍♂️ Is workout completed for today? ${workoutDone ? 'Yes' : 'No'}`);
      } catch (workoutCheckError) {
        console.error('Error checking workout completion:', workoutCheckError);
      }
      
      // Check if meals are completed for today
      let mealResults: string[] = [];
      try {
        // We check each meal type
        const mealTypes = ["Breakfast", "Lunch", "Dinner"];
        for (const mealType of mealTypes) {
          const isMealDone = await isMealCompleted(userId, dateString, mealType);
          if (isMealDone) {
            mealResults.push(mealType);
          }
        }
        console.log(`🍽️ Meals completed for today: ${mealResults.length > 0 ? mealResults.join(', ') : 'None'}`);
      } catch (mealCheckError) {
        console.error('Error checking meal completion:', mealCheckError);
      }
      
      setTodayMealsCompleted(mealResults);
      setTodayWorkoutCompleted(workoutDone);

      // --- STREAK CHECK ---
      try {
        // Check if today is a rest day based on workout schedule
        const currentDayName = format(new Date(), 'EEEE').toLowerCase();
        const isRestDay = profile?.workout_preferences?.preferred_days 
          ? !profile.workout_preferences.preferred_days.some(
              (day: string) => day.toLowerCase() === currentDayName
            )
          : true; // Default to rest day if no preferences
        
        console.log(`Checking streak (today is ${isRestDay ? 'a REST day' : 'a WORKOUT day'})`);
        
        // Sync streak data to ensure we have the latest streak value
        await syncStreakData();
        
        // Get the current streak from the StreakContext
        console.log(`Current streak: ${currentStreak} days`);
        setStreak(currentStreak);
      } catch (streakError) {
        console.error('Error checking streak:', streakError);
      }
    } catch (e) {
      console.error('Error checking completion status:', e);
    }
  };

  // Function to load a saved quote from AsyncStorage
  const loadSavedQuote = async () => {
    try {
      const savedQuote = await AsyncStorage.getItem('motivational_quote');
      if (savedQuote) {
        setQuote(savedQuote);
      } else {
        // If no saved quote, get a random one and save it
        const newQuote = getRandomQuote();
        setQuote(newQuote);
        await AsyncStorage.setItem('motivational_quote', newQuote);
      }
    } catch (error) {
      console.error('Error loading saved quote:', error);
      // Fallback to a random quote if loading fails
      setQuote(getRandomQuote());
    }
  };

  // Function to refresh quote with animation
  const refreshQuote = async () => {
    setIsRefreshingQuote(true);
    
    try {
      // Get the next quote based on the current one
      const currentQuote = quote || '';
      const newQuote = getNextQuote(currentQuote);
      
      // Save the new quote to AsyncStorage
      await AsyncStorage.setItem('motivational_quote', newQuote);
      
      // Update state with the new quote
      setQuote(newQuote);
    } catch (error) {
      console.error('Error refreshing quote:', error);
    } finally {
      // Add a small delay for the animation effect
      setTimeout(() => {
        setIsRefreshingQuote(false);
      }, 500);
    }
  };
  
  const router = useRouter();
  
  // Function to handle dismissing the login banner
  const handleDismissBanner = () => {
    setShowLoginBanner(false);
    
    // Save preference to localStorage if available
    try {
      localStorage.setItem('hideLoginBanner', 'true');
    } catch (e) {
      // Handle the case where localStorage is not available (e.g., in native app)
      console.warn('Could not save banner preference to localStorage:', e);
    }
  };

  // Conditional rendering for loading state
  if (loading) {
    return <LoadingScreen />;
  }
  
  // Conditional rendering for error state
  if (error) {
    return (
      <ErrorScreen 
        message={typeof error === 'string' ? error : 'An unknown error occurred'} 
        onRetry={checkCompletionStatus} // Or a more general retry logic
      />
    );
  }
  
  // Process and format the data for the home screen (after loading and error checks)
  const userStats = {
    name: profile?.full_name ? profile.full_name.split(' ')[0] : 'User',
    goal: profile?.weight_goal || 'Maintain Weight',
    progress: {
      currentWeight: String(profile?.weight_kg || profile?.current_weight_kg || profile?.body_analysis?.weight_kg || 0),
      startWeight: String(profile?.starting_weight_kg || profile?.initial_weight_kg || 0),
      targetWeight: String(profile?.target_weight_kg || profile?.body_analysis?.target_weight_kg || 0),
      percentComplete: calculateProgressPercentage(profile)
    }
  };
  
  // Determine if today is a workout day based on preferences (already done by isWorkoutScheduledToday)
  const isWorkoutDayForStats = isWorkoutScheduledToday;

  const workoutStats = {
    scheduledForToday: isWorkoutDayForStats,
    todayCompleted: todayWorkoutCompleted,
    todayWorkoutName: isWorkoutDayForStats ? (todayWorkout?.title || 'Daily Workout') : 'Rest Day',
    focusArea: isWorkoutDayForStats ? (todayWorkout?.focusArea || null) : null,
    bodyParts: [],
    dayStreak: streak
  };
  
  const mealStats = {
    allCompleted: (mealTimes?.length || 0) > 0 && todayMealsCompleted.length === (mealTimes?.length || 0),
    pendingMeals: mealTimes
      ?.filter(meal => !todayMealsCompleted.includes(meal.name))
      ?.map(meal => {
        const mealName = typeof meal.name === 'string' ? meal.name : 'Meal';
        const mealTime = typeof meal.time === 'string' ? meal.time : '12:00 PM';
        return `${mealName} (${mealTime})`;
      }) || [],
    mealDetails: {
      breakfast: {
        name: "Breakfast",
        completed: todayMealsCompleted.includes("Breakfast"),
        time: getBreakfastTime()
      },
      lunch: {
        name: "Lunch",
        completed: todayMealsCompleted.includes("Lunch"),
        time: getLunchTime()
      },
      dinner: {
        name: "Dinner",
        completed: todayMealsCompleted.includes("Dinner"),
        time: getDinnerTime()
      }
    }
  };
  
  // Next workout info (using the memoized getNextWorkout)
  const nextWorkoutInfo = getNextWorkout;
  
  // Motivational quote
  const motivationalQuoteToDisplay = quote || 'Stay consistent, see results.';
  
  // Body analysis data
  const bodyAnalysisData = profile?.body_analysis || {
    height_cm: 0,
    weight_kg: 0,
    body_fat_percentage: 0,
    body_type: 'Unknown',
    // Add bodyType as fallback for body_type to ensure compatibility
    bodyType: profile?.body_analysis?.body_type || 'Unknown'
  };
  
  // If there's a body_type property but no bodyType property, set bodyType from body_type
  if (bodyAnalysisData.body_type && !bodyAnalysisData.bodyType) {
    bodyAnalysisData.bodyType = bodyAnalysisData.body_type;
  }

  // Helper functions (ensure they don't rely on profile being defined before loading check if called by useMemos)
  function calculateProgressPercentage(currentProfile: EnhancedUserProfile | null): number {
    if (!currentProfile) return 0;
    const currentWeight = currentProfile?.weight_kg || currentProfile?.current_weight_kg || currentProfile?.body_analysis?.weight_kg;
    const startWeight = currentProfile?.starting_weight_kg || currentProfile?.initial_weight_kg;
    const targetWeight = currentProfile?.target_weight_kg || currentProfile?.body_analysis?.target_weight_kg;
    if (!currentWeight || !startWeight || !targetWeight) return 0;
    const isWeightLoss = startWeight > targetWeight;
    if (isWeightLoss) {
      const totalToLose = startWeight - targetWeight;
      const lostSoFar = startWeight - currentWeight;
      if (totalToLose === 0) return currentWeight === targetWeight ? 100 : 0; // if start and target are same
      const percentage = Math.min(100, Math.max(0, (lostSoFar / totalToLose) * 100));
      return Math.round(percentage);
    } else {
      const totalToGain = targetWeight - startWeight;
      const gainedSoFar = currentWeight - startWeight;
      if (totalToGain === 0) return currentWeight === targetWeight ? 100 : 0; // if start and target are same
      const percentage = Math.min(100, Math.max(0, (gainedSoFar / totalToGain) * 100));
      return Math.round(percentage);
    }
  }
  
  function getBreakfastTime(): string {
    if (profile?.meal_times && Array.isArray(profile.meal_times)) {
      const meal = profile.meal_times.find(m => {
        if (typeof m === 'object' && m !== null && 'name' in m) {
          return (m.name || '').toLowerCase() === 'breakfast';
        }
        return false;
      });
      if (meal && typeof meal === 'object' && 'time' in meal) {
        return meal.time || "08:00 AM";
      }
    }
    
    if (profile?.diet_preferences?.meal_times && Array.isArray(profile.diet_preferences.meal_times)) {
      const meal = profile.diet_preferences.meal_times.find(m => {
        if (typeof m === 'object' && m !== null && 'name' in m) {
          return (m.name || '').toLowerCase() === 'breakfast';
        }
        return false;
      });
      if (meal && typeof meal === 'object' && 'time' in meal) {
        return meal.time || "08:00 AM";
      }
    }
    
    return "08:00 AM";
  }

  function getLunchTime(): string {
    if (profile?.meal_times && Array.isArray(profile.meal_times)) {
      const meal = profile.meal_times.find(m => {
        if (typeof m === 'object' && m !== null && 'name' in m) {
          return (m.name || '').toLowerCase() === 'lunch';
        }
        return false;
      });
      if (meal && typeof meal === 'object' && 'time' in meal) {
        return meal.time || "12:30 PM";
      }
    }
    
    if (profile?.diet_preferences?.meal_times && Array.isArray(profile.diet_preferences.meal_times)) {
      const meal = profile.diet_preferences.meal_times.find(m => {
        if (typeof m === 'object' && m !== null && 'name' in m) {
          return (m.name || '').toLowerCase() === 'lunch';
        }
        return false;
      });
      if (meal && typeof meal === 'object' && 'time' in meal) {
        return meal.time || "12:30 PM";
      }
    }
    
    return "12:30 PM";
  }

  function getDinnerTime(): string {
    if (profile?.meal_times && Array.isArray(profile.meal_times)) {
      const meal = profile.meal_times.find(m => {
        if (typeof m === 'object' && m !== null && 'name' in m) {
          return (m.name || '').toLowerCase() === 'dinner';
        }
        return false;
      });
      if (meal && typeof meal === 'object' && 'time' in meal) {
        return meal.time || "07:00 PM";
      }
    }
    
    if (profile?.diet_preferences?.meal_times && Array.isArray(profile.diet_preferences.meal_times)) {
      const meal = profile.diet_preferences.meal_times.find(m => {
        if (typeof m === 'object' && m !== null && 'name' in m) {
          return (m.name || '').toLowerCase() === 'dinner';
        }
        return false;
      });
      if (meal && typeof meal === 'object' && 'time' in meal) {
        return meal.time || "07:00 PM";
      }
    }
    
    return "07:00 PM";
  }
  
  // Return the enhanced home screen interface
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <StatusBar style="light" />
      {!user && showLoginBanner && (
        <LoginPrompt 
          variant="banner"
          message="Create an account to sync your progress across devices"
          onDismiss={handleDismissBanner} 
          showDismiss={true}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/(auth)/signin');
          }}
        />
      )}
      {activeTab === 'modern' ? (
        <ModernHomeScreen 
          profile={profile!}
          activitySummary={activitySummary}
          meals={mealTimes}
          nextWorkout={nextWorkoutInfo}
          completedWorkouts={streak}
          todayWorkoutCompleted={todayWorkoutCompleted}
          todayMealsCompleted={todayMealsCompleted}
          bodyAnalysis={bodyAnalysisData}
          hasWorkout={hasWorkouts}
          workoutName={todayWorkout?.title || 'Daily Workout'}
          motivationalQuote={motivationalQuoteToDisplay}
          onRefreshQuote={refreshQuote}
          isRefreshingQuote={isRefreshingQuote}
        />
      ) : (
        <EnhancedHomeScreen
          userStats={userStats}
          workoutStats={workoutStats}
          mealStats={mealStats}
          nextWorkout={nextWorkoutInfo}
          motivationalQuote={motivationalQuoteToDisplay}
          onRefreshQuote={refreshQuote}
          bodyAnalysis={bodyAnalysisData}
          activitySummary={activitySummary}
          isRefreshingQuote={isRefreshingQuote}
        />
      )}
      {__DEV__ && (
        <View style={{ padding: 10, marginTop: 20 }}>
          <Button 
            mode="text" 
            onPress={() => router.push('/(dev)/debug-panel')}
            compact
          >
            Debug Panel
          </Button>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
  },
  safeArea: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: colors.background.primary,
  },
  errorText: {
    color: 'red',
    marginBottom: 20,
  },
});
