import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, Dimensions, TouchableOpacity, TextStyle, ViewStyle, Platform } from 'react-native';
import { Text, Card, Title, Paragraph, useTheme, Button, Divider, SegmentedButtons } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { BarChart, LineChart, PieChart } from 'react-native-chart-kit';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../../contexts/AuthContext';
import { useProfile } from '../../../contexts/ProfileContext';
import { useStreak } from '../../../contexts/StreakContext';
import { getTrackingAnalytics } from '../../../services/trackingService';
import { TrackingAnalytics } from '../../../types/tracking';
import { format, subDays, parseISO } from 'date-fns';
import BodyAnalysisCard from '../../../components/progress/BodyAnalysisCard';
import StyledText from '../../../components/ui/StyledText';
import { colors, spacing, borderRadius, shadows } from '../../../theme/theme';
import { useFocusEffect } from 'expo-router';
import { EventRegister } from 'react-native-event-listeners';
import WaterTrackingProgress, { WaterAnalytics } from '../../../components/progress/WaterTrackingProgress';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, Easing, interpolate } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { UserProfile, BodyAnalysis, WorkoutPreferences } from '../../../types/profile';

// Restore local definition of PREMIUM_GRADIENTS
const PREMIUM_GRADIENTS = {
  primary: ['#6366F1', '#8B5CF6'] as const,   // Deep purple gradient
  secondary: ['#F43F5E', '#EC4899'] as const, // Vibrant pink gradient
  tertiary: ['#0EA5E9', '#22D3EE'] as const,  // Cyan blue gradient
  dark: ['#0F172A', '#1E293B'] as const,      // Rich dark gradient (reversed order for better effect)
  success: ['#10B981', '#059669'] as const,   // Green gradient for success states
  warning: ['#F59E0B', '#D97706'] as const,   // Amber gradient for warning states
};

// Define the type for weight history entries, if not already globally available
// Based on UserProfile.body_analysis.weight_history structure
interface WeightEntry {
  date: string; // Initially string from DB/JSON
  weight: number;
  body_fat_percentage?: number;
}

interface ProcessedWeightEntry {
  date: Date; // After parsing
  weight: number;
  body_fat_percentage?: number;
}

/**
 * Progress screen component
 */
export default function ProgressScreen() {
  const theme = useTheme();
  const { user, signOut, loading: authLoading } = useAuth();
  const { profile, refreshProfile, loading: profileLoading } = useProfile();
  const { currentStreak, bestStreak, syncStreakData } = useStreak();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<TrackingAnalytics | null>(null);
  const [timeRange, setTimeRange] = useState<'7days' | '30days' | '90days'>('7days');
  const [waterAnalytics, setWaterAnalytics] = useState<WaterAnalytics | undefined>(undefined);
  const [waterLoading, setWaterLoading] = useState(true);
  const screenWidth = Dimensions.get('window').width;
  const [lastRefreshTime, setLastRefreshTime] = useState<number | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [contextReady, setContextReady] = useState(false);

  // Animated values for UI elements
  const headerOpacity = useSharedValue(0);
  const contentOpacity = useSharedValue(0);

  // Default chart config for Bold Minimalism design
  const chartConfig = {
    backgroundColor: 'transparent',
    backgroundGradientFrom: '#121212',
    backgroundGradientTo: '#1E1E30',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '6',
      strokeWidth: '2',
      stroke: '#FFFFFF',
    },
    barPercentage: 0.7,
    useShadowColorFromDataset: false,
    propsForBackgroundLines: {
      strokeDasharray: "",
      strokeWidth: 1,
      stroke: "rgba(255, 255, 255, 0.1)"
    }
  };

  // Create a specific config for the workout bar chart
  const workoutChartConfig = {
    ...chartConfig,
    decimalPlaces: 0,
    barPercentage: 0.8,
    backgroundGradientFrom: 'rgba(40, 40, 70, 0.4)',
    backgroundGradientTo: 'rgba(30, 30, 50, 0.6)',
    // Control the y-axis ticks
    propsForBackgroundLines: {
      strokeDasharray: "", // Solid line
      strokeWidth: 1,
      stroke: "rgba(255, 255, 255, 0.1)"
    },
    // Custom function to control y-axis labels
    formatYLabel: (value: string) => {
        return value;
    },
    // Set a fixed step size for the y-axis
    stepSize: 1,
    fillShadowGradientOpacity: 1,
    fillShadowGradient: "#8A2BE2",
    labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
  };

  // Effect to detect when both contexts are ready
  useEffect(() => {
    // Check if both contexts have finished their loading state
    if (!authLoading && !profileLoading) {


      setContextReady(true);
    }
  }, [authLoading, profileLoading, user, profile]);

  // Only proceed with loadAnalytics when contexts are ready
  useEffect(() => {
    if (contextReady) {
      loadAnalytics();
      // Also process water data when contexts are ready
      processWaterData();
    }
  }, [contextReady, timeRange]);

  // Sync streak data only when profile changes
  useEffect(() => {
    if (profile) {
      syncStreakData();
    }
  }, [profile, syncStreakData]);

  // Only update analytics when streak changes, do not sync streak here
  useEffect(() => {
    if (analytics) {
      setAnalytics(prev => {
        if (!prev) return null;
        return {
          ...prev,
          workout: { 
            ...prev.workout, 
            currentStreak: currentStreak,
            longestStreak: Math.max(bestStreak, prev.workout.longestStreak || 0) 
          },
          workoutStats: { 
            ...prev.workoutStats, 
            currentStreak: currentStreak,
            bestStreak: Math.max(bestStreak, prev.workoutStats.bestStreak || 0) 
          }
        };
      });
    }
  }, [currentStreak, bestStreak]);
  
  // Load analytics data
  const loadAnalytics = useCallback(async () => {
    // CHECK: If profile exists but user doesn't, we can still proceed
    // Most apps would show error, but since profile has all data we need, we can proceed
    if (profile && !user) {
      try {
        setLoading(true);
        setError(null);
        
        // Use profile.id instead of user.id
        const profileUserId = profile.id;
        if (!profileUserId) {
          throw new Error('Profile ID is missing');
        }
        
        const result = await getTrackingAnalytics(profileUserId, timeRange);
        
        // Ensure streak is consistent with profile
        if (profile.streak && typeof profile.streak === 'number') {
          // Use the higher streak value between analytics and profile
          const syncedStreak = Math.max(profile.streak, result.workoutStats?.currentStreak || 0);
          
          result.workout.currentStreak = syncedStreak;
          result.workout.longestStreak = Math.max(syncedStreak, result.workout.longestStreak || 0);
          
          if (result.workoutStats) {
            result.workoutStats.currentStreak = syncedStreak;
            result.workoutStats.bestStreak = Math.max(syncedStreak, result.workoutStats.bestStreak || 0);
          }
        }
        
        setAnalytics(result);
        setError(null);
        setLoading(false);
        return;
      } catch (err) {
        console.error('Error loading analytics using profile ID:', err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(`Failed to load progress data: ${errorMessage}`);
        setAnalytics({
          workout: { totalWorkouts: 0, completedWorkouts: 0, completionRate: 0, currentStreak: profile?.streak || 0, longestStreak: profile?.streak || 0, totalCaloriesBurned: 0, lastWorkoutDate: null, workoutsPerDay: {} },
          meal: { totalMeals: 0, completedMeals: 0, completionRate: 0, mealsPerDay: {}, lastMealDate: null },
          workoutStats: { totalWorkouts: 0, completionRate: 0, currentStreak: profile?.streak || 0, bestStreak: profile?.streak || 0 },
          period: 'week',
          water: { dailyIntake: {}, averageIntake: 0, goalCompletionRate: 0, streak: 0 }
        });
        setLoading(false);
        return;
      }
    }
    
    // Original function for when both user and profile or neither are available
    if (!user || !profile) {
      console.log('[ProgressScreen] loadAnalytics - User or profile unavailable but proceeding with fallback.', 
                 { userExists: !!user, profileExists: !!profile });
      setError('Unable to load user data. Please try again or restart the app.');
      setAnalytics({
        workout: { totalWorkouts: 0, completedWorkouts: 0, completionRate: 0, currentStreak: 0, longestStreak: 0, totalCaloriesBurned: 0, lastWorkoutDate: null, workoutsPerDay: {} },
        meal: { totalMeals: 0, completedMeals: 0, completionRate: 0, mealsPerDay: {}, lastMealDate: null },
        workoutStats: { totalWorkouts: 0, completionRate: 0, currentStreak: 0, bestStreak: 0 },
        period: 'week',
        water: { dailyIntake: {}, averageIntake: 0, goalCompletionRate: 0, streak: 0 }
      });
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    let analyticsTimeout: NodeJS.Timeout | null = null;
    let isResolved = false;
    
    const timeoutPromise = new Promise<null>((resolve) => {
      analyticsTimeout = setTimeout(() => {
        console.error('Analytics loading timed out after 10 seconds');
        if (!isResolved) {
          isResolved = true;
          resolve(null);
        }
      }, 10000); 
    });
    
    try {
      if (Platform.OS === 'web') {
        console.log('Web platform detected, using web-optimized analytics loading');
        setTimeout(() => {
          if (!isResolved) {
            console.log('Using fallback data for web platform after 1s');
            isResolved = true;
            setAnalytics({
              workout: { totalWorkouts: 0, completedWorkouts: 0, completionRate: 0, currentStreak: profile?.streak || 0, longestStreak: profile?.streak || 0, totalCaloriesBurned: 0, lastWorkoutDate: null, workoutsPerDay: {} },
              meal: { totalMeals: 0, completedMeals: 0, completionRate: 0, mealsPerDay: {}, lastMealDate: null },
              workoutStats: { totalWorkouts: 0, completionRate: 0, currentStreak: profile?.streak || 0, bestStreak: profile?.streak || 0 },
              period: 'week',
              water: { dailyIntake: {}, averageIntake: 0, goalCompletionRate: 0, streak: 0 }
            });
            setTimeout(() => { setLoading(false); }, 100);
          }
        }, 1000);
        
        getTrackingAnalytics(user.id, timeRange)
          .then(result => {
            if (!isResolved) {
              isResolved = true;
              setAnalytics(result);
              setLoading(false);
            }
          })
          .catch(err => {
            console.warn('Background fetch failed for web, might be using fallback data:', err);
            if(!isResolved){
                isResolved = true;
                setError('Failed to load progress data.');
                setAnalytics(prev => prev || { 
                    workout: { totalWorkouts: 0, completedWorkouts: 0, completionRate: 0, currentStreak: profile?.streak || 0, longestStreak: profile?.streak || 0, totalCaloriesBurned: 0, lastWorkoutDate: null, workoutsPerDay: {} },
                    meal: { totalMeals: 0, completedMeals: 0, completionRate: 0, mealsPerDay: {}, lastMealDate: null },
                    workoutStats: { totalWorkouts: 0, completionRate: 0, currentStreak: profile?.streak || 0, bestStreak: profile?.streak || 0 },
                    period: 'week',
                    water: { dailyIntake: {}, averageIntake: 0, goalCompletionRate: 0, streak: 0 }
                });
                setLoading(false);
            }
          });
        return; 
      }
      
      const analyticsPromise = getTrackingAnalytics(user.id, timeRange);
      const result = await Promise.race([analyticsPromise, timeoutPromise]);
      
      if (analyticsTimeout) {
        clearTimeout(analyticsTimeout);
        analyticsTimeout = null;
      }
      
      if (result === null) {
        console.error('Analytics loading timed out, showing error message');
        isResolved = true;
        setError('Loading analytics timed out. Please try again later.');
        setAnalytics({
          workout: { totalWorkouts: 0, completedWorkouts: 0, completionRate: 0, currentStreak: profile?.streak || 0, longestStreak: profile?.streak || 0, totalCaloriesBurned: 0, lastWorkoutDate: null, workoutsPerDay: {} },
          meal: { totalMeals: 0, completedMeals: 0, completionRate: 0, mealsPerDay: {}, lastMealDate: null },
          workoutStats: { totalWorkouts: 0, completionRate: 0, currentStreak: profile?.streak || 0, bestStreak: profile?.streak || 0 },
          period: 'week',
          water: { dailyIntake: {}, averageIntake: 0, goalCompletionRate: 0, streak: 0 }
        });
      } else {
        console.error('Received analytics data successfully');
        isResolved = true;
        setAnalytics(result);
        setError(null);
      }
    } catch (err) {
      console.error('Error loading analytics:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      const isNotificationError = errorMessage.includes('notification') || errorMessage.includes('permission') || errorMessage.includes('channel closed');
      isResolved = true;
      setError(isNotificationError 
        ? 'Unable to load data due to notification permission issues. Please check your browser settings.' 
        : 'Failed to load progress data. Please try again later.');
      setAnalytics({
        workout: { totalWorkouts: 0, completedWorkouts: 0, completionRate: 0, currentStreak: profile?.streak || 0, longestStreak: profile?.streak || 0, totalCaloriesBurned: 0, lastWorkoutDate: null, workoutsPerDay: {} },
        meal: { totalMeals: 0, completedMeals: 0, completionRate: 0, mealsPerDay: {}, lastMealDate: null },
        workoutStats: { totalWorkouts: 0, completionRate: 0, currentStreak: profile?.streak || 0, bestStreak: profile?.streak || 0 },
        period: 'week',
        water: { dailyIntake: {}, averageIntake: 0, goalCompletionRate: 0, streak: 0 }
      });
    } finally {
      if (!isResolved) isResolved = true; 

      if (Platform.OS !== 'web') {
        setLoading(false);
      }
      
      if (analyticsTimeout) {
        clearTimeout(analyticsTimeout);
        analyticsTimeout = null;
      }
    }
  }, [user, profile, timeRange]);

  // Function to process water tracking data from profile
  const processWaterData = useCallback(() => {
    if (!profile) {
      console.log('[ProgressScreen] processWaterData - Profile not available');
      setWaterLoading(false);
      return;
    }
    
    console.log('[ProgressScreen] Processing water tracking data');
    setWaterLoading(true);
    
    try {
      if (!profile.workout_tracking || typeof profile.workout_tracking !== 'object') {
        console.log('[ProgressScreen] No workout_tracking data in profile');
        setWaterAnalytics(undefined);
        setWaterLoading(false);
        return;
      }
      
      // Get water tracking data from profile
      const waterTrackingData = profile.workout_tracking.water_tracking;
      
      if (!waterTrackingData) {
        console.log('[ProgressScreen] No water_tracking data in profile');
        setWaterAnalytics(undefined);
        setWaterLoading(false);
        return;
      }
      
      // Get water goal from profile with proper unit conversion
      // Default to 3.5L if not set
      let waterGoalInML = 3500; // Default 3.5L in ml
      
      if (profile.water_intake_goal) {
        if (profile.water_intake_unit === 'oz') {
          // Convert oz to ml (1 oz = 29.5735 ml)
          waterGoalInML = profile.water_intake_goal * 29.5735;
        } else {
          // Already in liters, convert to ml
          waterGoalInML = profile.water_intake_goal * 1000;
        }
      }
      
      console.log(`[ProgressScreen] Water goal: ${waterGoalInML}ml`);
      
      // Create daily intake map from logs
      const dailyIntake: Record<string, number> = {};
      
      if (Array.isArray(waterTrackingData.logs) && waterTrackingData.logs.length > 0) {
        console.log(`[ProgressScreen] Processing ${waterTrackingData.logs.length} water logs`);
        waterTrackingData.logs.forEach((log: { timestamp: string | number | Date; amount: number }) => {
          try {
            // Format date as YYYY-MM-DD to group by day
            const date = new Date(log.timestamp);
            const dateStr = date.toISOString().split('T')[0];
            
            // Add to daily total (convert l to ml)
            if (!dailyIntake[dateStr]) {
              dailyIntake[dateStr] = 0;
            }
            dailyIntake[dateStr] += log.amount * 1000; // Convert liters to ml
          } catch (err) {
            console.error('Error processing water log:', err);
          }
        });
      }
      
      // Create monthly intake data
      const monthlyIntake: Record<string, number> = {};
      
      Object.entries(dailyIntake).forEach(([dateStr, amount]) => {
        const date = new Date(dateStr);
        const monthIndex = date.getMonth() + 1; // 1-based month index
        
        if (!monthlyIntake[monthIndex]) {
          monthlyIntake[monthIndex] = 0;
        }
        monthlyIntake[monthIndex] += amount;
      });
      
      // Calculate current streak using the user's actual goal
      let currentStreak = 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Sort dates in descending order (newest first)
      const sortedDates = Object.keys(dailyIntake)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
      
      for (let i = 0; i < sortedDates.length; i++) {
        const dateStr = sortedDates[i];
        const date = new Date(dateStr);
        date.setHours(0, 0, 0, 0);
        
        // Check if this date is consecutive with previous one
        if (i === 0) {
          // First date in streak, check if it's today or yesterday
          const diffDays = Math.floor((today.getTime() - date.getTime()) / (24 * 60 * 60 * 1000));
          if (diffDays > 1) break; // Break if first entry is older than yesterday
        } else {
          // Check consecutive days
          const prevDate = new Date(sortedDates[i - 1]);
          prevDate.setHours(0, 0, 0, 0);
          
          const diffDays = Math.floor((prevDate.getTime() - date.getTime()) / (24 * 60 * 60 * 1000));
          if (diffDays !== 1) break; // Break if not consecutive
        }
        
        // Check if goal was met using the proper goal value
        if (dailyIntake[dateStr] >= waterGoalInML) {
          currentStreak++;
        } else {
          break; // Break if goal not met
        }
      }
      
      console.log(`[ProgressScreen] Calculated water streak: ${currentStreak} days`);
      
      // Calculate average intake and goal completion rate
      // Get the recent days based on time range selected
      const daysToConsider = timeRange === '7days' ? 7 : timeRange === '30days' ? 30 : 90;
      
      // Get dates for the selected period
      const recentDates: string[] = [];
      for (let i = 0; i < daysToConsider; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        recentDates.push(date.toISOString().split('T')[0]);
      }
      
      // Filter intake data to only include recent dates
      const recentIntake = Object.entries(dailyIntake)
        .filter(([dateStr]) => recentDates.includes(dateStr))
        .reduce((obj, [date, amount]) => {
          obj[date] = amount;
          return obj;
        }, {} as Record<string, number>);
      
      // Calculate average daily intake for the selected period
      const averageIntake = Object.keys(recentIntake).length > 0 
        ? Object.values(recentIntake).reduce((sum, val) => sum + val, 0) / Object.keys(recentIntake).length
        : 0;
        
      // Calculate goal completion rate for the selected period
      const goalCompletionRate = Object.keys(recentIntake).length > 0
        ? (Object.values(recentIntake).filter(val => val >= waterGoalInML).length / Object.keys(recentIntake).length) * 100
        : 0;
      
      console.log(`[ProgressScreen] Water stats - Avg: ${(averageIntake/1000).toFixed(2)}L, Goal completion: ${goalCompletionRate.toFixed(0)}%`);
      
      // Create analytics object
      const analytics: WaterAnalytics = {
        dailyIntake,
        monthlyIntake,
        dailyGoal: waterGoalInML,  // Store in ml for consistent calculations
        currentStreak,
        averageIntake,
        goalCompletionRate
      };
      
      setWaterAnalytics(analytics);
    } catch (error) {
      console.error('Error processing water data:', error);
      setWaterAnalytics(undefined);
    } finally {
      setWaterLoading(false);
    }
  }, [profile, timeRange]);
  
  // Use useFocusEffect to refresh data whenever the Progress tab is focused
  useFocusEffect(
    React.useCallback(() => {
      console.log('[ProgressScreen] useFocusEffect - Screen focused.');
      let focusLoadingTimeout: NodeJS.Timeout | null = null;

      // Only proceed if contexts are ready
      if (!contextReady) {
        console.log('[ProgressScreen] useFocusEffect - Contexts not ready yet, skipping refresh');
        return;
      }

      // Always try to refresh when the screen is focused
      // The loadAnalytics function now handles cases where user/profile are null
      const shouldRefresh = !analytics || (lastRefreshTime && Date.now() - lastRefreshTime > 120000); // 2 minutes
      if (shouldRefresh) {
        console.log('[ProgressScreen] useFocusEffect - Refreshing data.');
        loadAnalytics();
        setLastRefreshTime(Date.now());

        // Safeguard timeout for focus effect load
        focusLoadingTimeout = setTimeout(() => {
          console.warn('[ProgressScreen] useFocusEffect - Focus loading safeguard triggered after 15s.');
          setLoading(false);
        }, 15000); // Reduced to 15 seconds
      } else if (analytics) {
        console.log('[ProgressScreen] useFocusEffect - Skipping refresh, using existing data.');
        // If not refreshing, ensure loading is false if analytics are present
        if(loading) setLoading(false);
      }

      // Event listeners setup (as before)
      // ... make sure this section is complete as in the original file
      const workoutCompletionListener = EventRegister.addEventListener('workoutCompleted', (data: any) => {
        console.log('Workout completion detected in Progress tab:', data);
        setTimeout(() => { loadAnalytics(); }, 500);
      });
      const mealCompletionListener = EventRegister.addEventListener('mealCompleted', (data: any) => {
        console.log('Meal completion detected in Progress tab:', data);
        setTimeout(() => { loadAnalytics(); }, 500);
      });
      const waterTrackingListener = EventRegister.addEventListener('waterTracked', (data: any) => {
        console.log('Water tracking updated in Progress tab');
        setTimeout(() => { processWaterData();}, 300);
      });
      const bodyStatsListener = EventRegister.addEventListener('bodyStatsUpdated', (data: any) => {
        console.log('Body stats updated in Progress tab');
        loadAnalytics();
      });
      const streakUpdatedListener = EventRegister.addEventListener('streakUpdated', (data: any) => {
        console.log('🔥 Progress tab received streak update event:', data);
        if (data && typeof data.streak === 'number') {
          setAnalytics(prevAnalytics => {
            if (!prevAnalytics) return null;
            return {
              ...prevAnalytics,
              workout: { ...prevAnalytics.workout, currentStreak: data.streak, longestStreak: Math.max(data.streak, prevAnalytics.workout.longestStreak || 0) },
              workoutStats: { ...prevAnalytics.workoutStats, currentStreak: data.streak, bestStreak: Math.max(data.streak, prevAnalytics.workoutStats.bestStreak || 0) }
            };
          });
        }
      });

      return () => {
        if (focusLoadingTimeout) {
          clearTimeout(focusLoadingTimeout);
        }
        EventRegister.removeEventListener(workoutCompletionListener as string);
        EventRegister.removeEventListener(mealCompletionListener as string);
        EventRegister.removeEventListener(waterTrackingListener as string);
        EventRegister.removeEventListener(bodyStatsListener as string);
        EventRegister.removeEventListener(streakUpdatedListener as string);
      };
    }, [user, profile, analytics, loadAnalytics, processWaterData, lastRefreshTime]) // Added lastRefreshTime and other potentially missing dependencies
  );
  
  // Animate elements when data loads
  useEffect(() => {
    if (!loading) {
      // Animate header
      headerOpacity.value = withTiming(1, {
        duration: 400,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      });
      
      // Animate content with a slight delay
      setTimeout(() => {
        contentOpacity.value = withTiming(1, {
          duration: 800,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        });
      }, 200);
    }
  }, [loading]);
  
  // Animated styles
  const animatedHeaderStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
  }));
  
  const animatedContentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: (1 - contentOpacity.value) * 20 }],
  }));
  
  // Format the workouts data for the bar chart
  const formatWorkoutsData = () => {
    if (!analytics || !analytics.workout) {
      return {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [{ 
          data: [0, 0, 0, 0, 0, 0, 0],
          color: (opacity = 1) => `rgba(134, 65, 244, ${opacity})` 
        }],
      };
    }

    // Use the workout days from the analytics
    const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    
    // Initialize with zeros
    const workoutCounts = daysOfWeek.map(() => 0);
    
    // Map the full day names to our abbreviated labels
    const dayMapping: Record<string, number> = {
      'Monday': 0,    // Mon
      'Tuesday': 1,   // Tue
      'Wednesday': 2, // Wed
      'Thursday': 3,  // Thu
      'Friday': 4,    // Fri
      'Saturday': 5,  // Sat
      'Sunday': 6     // Sun
    };
    
    // First, determine which days are workout days vs rest days
    const workoutDays: boolean[] = [false, false, false, false, false, false, false];
    
    // Get workout schedule from profile
    let preferredDays = profile?.workout_preferences?.preferred_days;
    if (!preferredDays || preferredDays.length === 0) {
      preferredDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    }
    if (preferredDays) {
      preferredDays.forEach((day: string) => {
        if (typeof day === 'string' && dayMapping[day] !== undefined) {
          workoutDays[dayMapping[day]] = true;
        }
      });
    }
    
    
    // Process workout completion data
    if (analytics.workout && analytics.workout.workoutsPerDay) {
      
      
      // Process each day in the workout data
      Object.entries(analytics.workout.workoutsPerDay).forEach(([dayName, count]) => {
        if (dayMapping[dayName] !== undefined && count > 0) {
          // Set to 1 to indicate completion (this is for the visual indicator)
          workoutCounts[dayMapping[dayName]] = 1;
        }
      });
    }

    // Now also look at meal completion data to check rest days
    // On rest days, we should show completion if meals were completed
    if (analytics.meal && analytics.meal.mealsPerDay) {
      
      
      // Process each day in the meal data
      Object.entries(analytics.meal.mealsPerDay).forEach(([dayName, count]) => {
        const dayIndex = dayMapping[dayName];
        // Only consider meal completions for rest days
        if (dayIndex !== undefined && !workoutDays[dayIndex] && count > 0) {
          // For rest days, check if at least one meal was completed
          workoutCounts[dayIndex] = 1;
        }
      });
    }

    
    
    // Ensure the data is within the range [0, 1]
    const normalizedData = workoutCounts.map(count => Math.min(1, Math.max(0, count)));
    
    return {
      labels: daysOfWeek,
      datasets: [
        {
          data: normalizedData,
          color: (opacity = 1) => `rgba(134, 65, 244, ${opacity})`,  
          strokeWidth: 2,
        },
      ],
    };
  };

  // Format the nutrition data for the line chart
  const formatNutritionData = () => {
    if (!analytics || !analytics.meal) {
      return {
        labels: ['No Data'],
        datasets: [{ data: [0] }],
      };
    }
    // Add a default return for the case where analytics and analytics.meal exist
    // TODO: Implement actual data formatting for nutrition
    return {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [{ data: [0, 0, 0, 0, 0, 0, 0] }],
    };
  }
}
