import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Text, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { EventRegister } from 'react-native-event-listeners';
import { useRouter } from 'expo-router';

// Import theme and components
import { colors, spacing } from '../../../theme/theme';
import ModernHomeScreen from '../../../components/home/ModernHomeScreen';
import EnhancedHomeScreen from '../../../components/home/EnhancedHomeScreen';

// Import needed functions for streak and progress calculation
import { getUserStreak } from '../../../utils/profileHelpers';
import { format } from 'date-fns';

// Import tracking service functions
import { isWorkoutCompleted, isMealCompleted } from '../../../services/trackingService';

// Import real contexts instead of using mock data
import { useAuth } from '../../../contexts/AuthContext';
import { useProfile } from '../../../contexts/ProfileContext';
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
const ErrorScreen = ({ message, onRetry }) => (
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
  const { workouts, todayWorkout, hasWorkouts } = useWorkouts();
  const { mealTimes } = useMeals();
  
  // Define state variables
  const [refreshing, setRefreshing] = useState(false);
  const [quote, setQuote] = useState<string | null>(null);
  
  // Keep track of the active tab
  const [activeTab, setActiveTab] = useState<'modern' | 'enhanced'>('enhanced');
  
  // Calculate the streak days if any
  const [streak, setStreak] = useState(0);
  // Track today's meal and workout completion
  const [todayMealsCompleted, setTodayMealsCompleted] = useState<string[]>([]);
  const [todayWorkoutCompleted, setTodayWorkoutCompleted] = useState(false);
  
  // Register event listeners for meal and workout completion
  useEffect(() => {
    // Listen for meal completion events
    const mealCompletionListener = EventRegister.addEventListener('mealCompleted', (data: any) => {
      if (data && data.userId === user?.id) {
        console.log('Home tab received meal completion event:', data);
        // Update the meals completed state
        setTodayMealsCompleted(prev => {
          // Only add the meal if it's not already in the array
          if (!prev.includes(data.mealType)) {
            return [...prev, data.mealType];
          }
          return prev;
        });
      }
    });
    
    // Listen for workout completion event
    const workoutCompletionListener = EventRegister.addEventListener('workoutCompleted', (data: any) => {
      if (data && data.userId === user?.id) {
        console.log('Home tab received workout completion event:', data);
        
        // Update the workout completed state
        setTodayWorkoutCompleted(true);
        
        // Force a refresh of the UI after a small delay
        setTimeout(() => {
          checkCompletionStatus();
          
          // Log completion status for debugging
          const currentMeals = todayMealsCompleted || [];
          const completedMeals = todayMealsCompleted || [];
          
          console.log('Today workout completion status:', {
            workoutCompleted: todayWorkoutCompleted,
            mealsCompleted: completedMeals.length,
            totalMeals: currentMeals.length || 0,
            activitySummary
          });
        }, 500);
      }
    });
    
    // Cleanup listeners on component unmount
    return () => {
      EventRegister.removeEventListener(mealCompletionListener as string);
      EventRegister.removeEventListener(workoutCompletionListener as string);
    };
  }, [user, todayWorkoutCompleted]);
  
  // Function to check meal and workout completion status
  const checkCompletionStatus = async () => {
    if (!user) return;
    
    try {
      // Check meal completion
      const today = format(new Date(), 'yyyy-MM-dd');
      const completedMeals: string[] = [];
      
      // Check each meal type
      const standardMealTypes = ['Breakfast', 'Lunch', 'Dinner'];
      for (const mealType of standardMealTypes) {
        try {
          const isCompleted = await isMealCompleted(user.id, today, mealType);
          if (isCompleted) {
            completedMeals.push(mealType);
          }
        } catch (err) {
          console.error(`Error checking completion for ${mealType}:`, err);
        }
      }
      
      setTodayMealsCompleted(completedMeals);
      
      // Check workout completion for today
      try {
        const isWorkoutDone = await isWorkoutCompleted(user.id, new Date());
        setTodayWorkoutCompleted(isWorkoutDone);
      } catch (err) {
        console.error('Error checking workout completion:', err);
      }
    } catch (err) {
      console.error('Error checking completion status:', err);
    }
  };
  
  useFocusEffect(
    React.useCallback(() => {
      if (profile) {
        // Calculate streak from workout history or fetch from profile if it exists
        const calculatedStreak = profile.streak || 0;
        setStreak(calculatedStreak);
        
        // Set motivational quote from profile cache or get new one
        if (profile.motivational_quote) {
          setQuote(profile.motivational_quote);
        } else {
          // Default quote if none exists
          setQuote("Believe in yourself and all that you are.");
        }
        
        // Check completion status when screen is focused
        checkCompletionStatus();
      }
    }, [profile, user])
  );
  
  // Function to refresh quote
  const refreshQuote = () => {
    // In a real app, this would fetch a new quote from a quotes API
    setQuote("Your body can stand almost anything. It's your mind that you have to convince.");
  };
  
  const router = useRouter();
  
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#6A65D8" />
        <Text style={{ fontSize: 16, color: colors.text.primary, marginBottom: 20, textAlign: 'center' }}>
          Loading your fitness data...
        </Text>
      </View>
    );
  }
  
  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ fontSize: 16, color: 'red', marginBottom: 20, textAlign: 'center' }}>
          Error loading profile: {error}
        </Text>
      </View>
    );
  }
  
  // Process and format the data for the home screen
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
  
  // Calculate percentage progress towards weight goal
  function calculateProgressPercentage(profile: any): number {
    if (!profile) return 0;
    
    const currentWeight = profile?.weight_kg || profile?.current_weight_kg || profile?.body_analysis?.weight_kg;
    const startWeight = profile?.starting_weight_kg || profile?.initial_weight_kg;
    const targetWeight = profile?.target_weight_kg || profile?.body_analysis?.target_weight_kg;
    
    // If any values are missing, return 0
    if (!currentWeight || !startWeight || !targetWeight) return 0;
    
    // Check if user wants to lose or gain weight
    const isWeightLoss = startWeight > targetWeight;
    
    if (isWeightLoss) {
      // Weight loss calculation
      const totalToLose = startWeight - targetWeight;
      const lostSoFar = startWeight - currentWeight;
      
      // Avoid division by zero
      if (totalToLose === 0) return 100;
      
      // Calculate percentage and cap between 0-100
      const percentage = Math.min(100, Math.max(0, (lostSoFar / totalToLose) * 100));
      return Math.round(percentage);
    } else {
      // Weight gain calculation
      const totalToGain = targetWeight - startWeight;
      const gainedSoFar = currentWeight - startWeight;
      
      // Avoid division by zero
      if (totalToGain === 0) return 100;
      
      // Calculate percentage and cap between 0-100
      const percentage = Math.min(100, Math.max(0, (gainedSoFar / totalToGain) * 100));
      return Math.round(percentage);
    }
  }
  
  // Workout stats from actual data if available
  const workoutStats = {
    scheduledForToday: hasWorkouts,
    todayCompleted: todayWorkoutCompleted,
    todayWorkoutName: hasWorkouts ? (todayWorkout?.title || 'Daily Workout') : 'No Workout',
    focusArea: hasWorkouts ? todayWorkout?.focusArea || null : null,
    bodyParts: [],
    dayStreak: streak
  };
  
  // Actual meal times from profile
  const mealStats = {
    allCompleted: todayMealsCompleted.length === mealTimes.length,
    pendingMeals: mealTimes
      .filter(meal => !todayMealsCompleted.includes(meal.name))
      .map(meal => {
        // Extract the name and time directly from user preferences
        const mealName = typeof meal.name === 'string' ? meal.name : 'Meal';
        const mealTime = typeof meal.time === 'string' ? meal.time : '12:00 PM';
        return `${mealName} (${mealTime})`;
      }),
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
  
  // Helper functions to safely extract meal times with proper type checking
  function getBreakfastTime(): string {
    // Check root meal_times array
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
    
    // Check diet_preferences.meal_times
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
    
    // Default fallback
    return "08:00 AM";
  }

  function getLunchTime(): string {
    // Check root meal_times array
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
    
    // Check diet_preferences.meal_times
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
    
    // Default fallback
    return "12:30 PM";
  }

  function getDinnerTime(): string {
    // Check root meal_times array
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
    
    // Check diet_preferences.meal_times
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
    
    // Default fallback
    return "07:00 PM";
  }
  
  // Next workout info
  const nextWorkout = hasWorkouts ? {
    day: 'Today',
    name: todayWorkout?.title || 'Daily Workout',
    daysUntil: 0
  } : null;
  
  // Motivational quote
  const motivationalQuote = quote || 'Stay consistent, see results.';
  
  // Body analysis data - this is the key part we're fixing
  const bodyAnalysis = profile?.body_analysis || {
    height_cm: 0,
    weight_kg: 0,
    body_fat_percentage: 0,
    body_type: 'Unknown',
    // Add bodyType as fallback for body_type to ensure compatibility
    bodyType: profile?.body_analysis?.body_type || 'Unknown'
  };
  
  // If there's a body_type property but no bodyType property, set bodyType from body_type
  if (bodyAnalysis.body_type && !bodyAnalysis.bodyType) {
    bodyAnalysis.bodyType = bodyAnalysis.body_type;
  }
  
  console.log('Body Analysis Data:', bodyAnalysis);

  // Activity summary for the week
  const activitySummary = {
    workouts: { 
      count: todayWorkoutCompleted ? 1 : 0, 
      percentage: todayWorkoutCompleted ? 100 : 0 
    },
    meals: { 
      count: todayMealsCompleted.length, 
      percentage: mealTimes.length > 0 ? Math.round((todayMealsCompleted.length / mealTimes.length) * 100) : 0 
    },
    progress: { 
      percentage: Math.round(
        ((todayWorkoutCompleted ? 1 : 0) + todayMealsCompleted.length) / 
        (1 + mealTimes.length) * 100
      ) 
    }
  };
  
  console.log('Today\'s completion status:', {
    workoutCompleted: todayWorkoutCompleted,
    mealsCompleted: todayMealsCompleted,
    totalMeals: mealTimes.length,
    activitySummary
  });
  
  // Return the enhanced home screen interface
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <StatusBar style="light" />
      {activeTab === 'modern' ? (
        <ModernHomeScreen 
          userStats={userStats}
          workoutStats={workoutStats}
          mealStats={mealStats}
          nextWorkout={nextWorkout}
          motivationalQuote={motivationalQuote}
          onRefreshQuote={refreshQuote}
        />
      ) : (
        <EnhancedHomeScreen
          userStats={userStats}
          workoutStats={workoutStats}
          mealStats={mealStats}
          nextWorkout={nextWorkout}
          motivationalQuote={motivationalQuote}
          onRefreshQuote={refreshQuote}
          bodyAnalysis={bodyAnalysis}
          activitySummary={activitySummary}
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
