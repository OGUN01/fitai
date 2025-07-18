import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, Dimensions, TouchableOpacity, TextStyle, ViewStyle, Platform } from 'react-native';
import { Text, Card, Paragraph, useTheme, Button, Divider, SegmentedButtons } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../../contexts/AuthContext';
import { useProfile } from '../../../contexts/ProfileContext';
import { useStreak } from '../../../contexts/StreakContext';
import { getTrackingAnalytics } from '../../../services/trackingService';
import { TrackingAnalytics } from '../../../types/tracking';
import { format, subDays, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay } from 'date-fns';
import BodyAnalysisCard from '../../../components/progress/BodyAnalysisCard';
import StyledText from '../../../components/ui/StyledText';
import { colors, spacing, borderRadius, shadows } from '../../../theme/theme';
import { useFocusEffect } from 'expo-router';
import { EventRegister } from 'react-native-event-listeners';
import WaterTrackingProgress, { WaterAnalytics } from '../../../components/progress/WaterTrackingProgress';
import FallbackChart from '../../../components/progress/FallbackChart';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, Easing, interpolate } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { UserProfile, BodyAnalysis, WorkoutPreferences } from '../../../types/profile';
import { Canvas, Rect, Skia, PaintStyle, Text as SkiaText, useFont } from '@shopify/react-native-skia';
import { useSkiaContext } from '../../../contexts/SkiaContext';
import { progressService } from '../../../services/progressService';

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

const dayMappingGlobal: Record<string, number> = {
  'Monday': 0, 'Tuesday': 1, 'Wednesday': 2, 'Thursday': 3,
  'Friday': 4, 'Saturday': 5, 'Sunday': 6
};

// Helper function to convert preferred days (string[]) to a boolean schedule
const getWorkoutDaysSchedule = (preferredDays?: string[]): boolean[] => {
  const schedule = new Array(7).fill(false);
  if (!preferredDays || preferredDays.length === 0) {
    // If no preference, assume all days are workout days for chart display purposes, 
    // or handle as per desired default behavior (e.g., all false if that's more appropriate)
    return new Array(7).fill(true); // Default to all days if none specified for now
  }
  preferredDays.forEach((day: string) => {
    if (typeof day === 'string' && dayMappingGlobal[day] !== undefined) {
      schedule[dayMappingGlobal[day]] = true;
    }
  });
  return schedule;
};

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
  const [dataChanged, setDataChanged] = useState(false); // Track when data has been changed
  const loadingRef = useRef(false);
  const lastFocusTime = useRef(0);

  const { isSkiaLoaded } = useSkiaContext();

  // Reset loading ref on mount
  useEffect(() => {
    loadingRef.current = false;
  }, []);

  // Check if Skia is actually available (not just the context state)
  const isSkiaActuallyAvailable = React.useMemo(() => {
    try {
      // On web platform, Skia is often not available or has limited functionality
      if (Platform.OS === 'web') {
        console.log("[ProgressScreen] Web platform detected - Skia charts disabled");
        return false;
      }

      // More comprehensive Skia availability check
      const skiaAvailable = isSkiaLoaded &&
        typeof Skia !== 'undefined' &&
        Skia !== null &&
        typeof Skia.Paint === 'function' &&
        typeof Skia.Color === 'function' &&
        typeof Skia.Point === 'function';

      if (!skiaAvailable) {
        console.log("[ProgressScreen] Skia availability check failed:", {
          isSkiaLoaded,
          skiaUndefined: typeof Skia === 'undefined',
          skiaNull: Skia === null,
          paintFunction: typeof Skia?.Paint,
          colorFunction: typeof Skia?.Color,
          pointFunction: typeof Skia?.Point
        });
      }

      return skiaAvailable;
    } catch (error) {
      console.error("[ProgressScreen] Error checking Skia availability:", error);
      return false;
    }
  }, [isSkiaLoaded]);

  // Animated values for UI elements
  const headerOpacity = useSharedValue(0);
  const contentOpacity = useSharedValue(0);

  // Skia chart constants
  const chartWidth = screenWidth - spacing.md * 2 - spacing.sm * 2; // Width of the card content area
  const chartHeight = 220;
  const chartPadding = { top: 20, right: 20, bottom: 40, left: 40 }; // Increased bottom/left for labels
  const barAreaHeight = chartHeight - chartPadding.top - chartPadding.bottom;
  const barAreaWidth = chartWidth - chartPadding.left - chartPadding.right;
  const numDays = 7; // For weekly view

  // Font for Skia labels
  const skiaFont = React.useMemo(() => {
    // All attempts to dynamically get a SkiaTypeface for v1.12.4 have failed due to API differences.
    // Returning null for now to prevent app crashes and allow other chart elements to render.
    // Text rendering will be revisited.
    console.warn("[Skia Font] Default font creation is problematic for this Skia version. Labels will be hidden.");
    return null;
  }, []);

  const axisPaint = React.useMemo(() => {
    // Early return if Skia is not available
    if (!isSkiaActuallyAvailable) {
      return null;
    }

    try {
      const paint = Skia.Paint();
      paint.setColor(Skia.Color(theme.colors.outline)); // Use theme color for axis lines
      paint.setStyle(PaintStyle.Stroke);
      paint.setStrokeWidth(1);
      return paint;
    } catch (error) {
      console.error("[ProgressScreen] Error creating axisPaint:", error);
      return null;
    }
  }, [theme.colors.outline, isSkiaActuallyAvailable]);

  const labelPaint = React.useMemo(() => {
    // Early return if Skia is not available
    if (!isSkiaActuallyAvailable) {
      return null;
    }

    try {
      const paint = Skia.Paint();
      paint.setColor(Skia.Color(theme.colors.onSurfaceVariant)); // Use theme color for labels
      paint.setAntiAlias(true);
      return paint;
    } catch (error) {
      console.error("[ProgressScreen] Error creating labelPaint:", error);
      return null;
    }
  }, [theme.colors.onSurfaceVariant, isSkiaActuallyAvailable]);

  // Effect to detect when both contexts are ready
  useEffect(() => {
    // Check if both contexts have finished their loading state
    if (!authLoading && !profileLoading) {
      setContextReady(true);
    }
  }, [authLoading, profileLoading, user, profile]);

  // Safety timeout to prevent infinite loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading && !analytics) {
        console.warn("[ProgressScreen] Safety timeout - forcing loading to false");
        setLoading(false);
        loadingRef.current = false;
        setError("Failed to load progress data. Please try refreshing the page.");
      }
    }, 10000); // 10 seconds timeout

    return () => clearTimeout(timeout);
  }, [loading, analytics]);

  // Only proceed with loadAnalytics when contexts are ready
  useEffect(() => {
    if (contextReady) {
      loadAnalytics();
      // Also process water data when contexts are ready
      processWaterData();
    }
  }, [contextReady, timeRange]); // Removed function dependencies to prevent infinite re-renders

  // Sync streak data only when profile changes
  useEffect(() => {
    if (profile) {
      syncStreakData();
    }
  }, [profile, syncStreakData]);

  // Only update analytics when streak changes, do not sync streak here
  useEffect(() => {
    if (analytics && (analytics.workout.currentStreak !== currentStreak || analytics.workout.longestStreak < bestStreak)) {
      setAnalytics(prev => {
        if (!prev) return null;
        // Only update if values actually changed to prevent infinite loops
        const newCurrentStreak = currentStreak;
        const newLongestStreak = Math.max(bestStreak, prev.workout.longestStreak || 0);

        if (prev.workout.currentStreak === newCurrentStreak && prev.workout.longestStreak >= newLongestStreak) {
          return prev; // No change needed
        }

        return {
          ...prev,
          workout: {
            ...prev.workout,
            currentStreak: newCurrentStreak,
            longestStreak: newLongestStreak
          },
          workoutStats: {
            ...prev.workoutStats,
            currentStreak: newCurrentStreak,
            longestStreak: newLongestStreak
          }
        };
      });
    }
  }, [currentStreak, bestStreak, analytics?.workout?.currentStreak, analytics?.workout?.longestStreak]);
  
  // Load analytics data
  const loadAnalytics = useCallback(async () => {
    // Prevent multiple simultaneous calls
    if (loadingRef.current) {
      console.log("[ProgressScreen] loadAnalytics already in progress, skipping");
      return;
    }

    loadingRef.current = true;

    // Safety timeout to reset loading ref in case of unexpected errors
    const safetyTimeout = setTimeout(() => {
      console.warn("[ProgressScreen] Safety timeout triggered - resetting loading ref");
      loadingRef.current = false;
    }, 30000); // 30 seconds safety timeout

    // Add console.log for the entire analytics object when it's set or updated
    if (analytics) {
      console.log("[ProgressScreen] Analytics Object State:", JSON.stringify(analytics, null, 2));
    }

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
        
        // Pass the profile object for local user scenario
        const result = await getTrackingAnalytics(profileUserId, timeRange, profile);
        
        // Ensure streak is consistent with profile
        if (profile.streak && typeof profile.streak === 'number') {
          // Use the higher streak value between analytics and profile
          const syncedStreak = Math.max(profile.streak, result.workoutStats?.currentStreak || 0);
          
          result.workout.currentStreak = syncedStreak;
          result.workout.longestStreak = Math.max(syncedStreak, result.workout.longestStreak || 0);
          
          if (result.workoutStats) {
            result.workoutStats.currentStreak = syncedStreak;
            result.workoutStats.longestStreak = Math.max(syncedStreak, result.workoutStats.longestStreak || 0);
          }
        }
        
        setAnalytics(result);
        setError(null);
        setLoading(false);
        loadingRef.current = false;
        return;
      } catch (err) {
        console.error('Error loading analytics using profile ID:', err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(`Failed to load progress data: ${errorMessage}`);
        setAnalytics({
          workout: { totalWorkouts: 0, completedWorkouts: 0, completionRate: 0, currentStreak: profile?.streak || 0, longestStreak: profile?.streak || 0, totalCaloriesBurned: 0, lastWorkoutDate: null, workoutsPerDay: {} },
          meal: { totalMeals: 0, completedMeals: 0, completionRate: 0, mealsPerDay: {}, lastMealDate: null },
          workoutStats: { totalWorkouts: 0, completionRate: 0, currentStreak: profile?.streak || 0, longestStreak: profile?.streak || 0 },
          period: 'week',
          water: { dailyIntake: {}, averageIntake: 0, goalCompletionRate: 0, streak: 0 }
        });
        setLoading(false);
        loadingRef.current = false;
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
        workoutStats: { totalWorkouts: 0, completionRate: 0, currentStreak: 0, longestStreak: 0 },
        period: 'week',
        water: { dailyIntake: {}, averageIntake: 0, goalCompletionRate: 0, streak: 0 }
      });
      setLoading(false);
      loadingRef.current = false;
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

        // For web, just call the analytics function directly without timeout fallback
        try {
          const result = await getTrackingAnalytics(user.id, timeRange, profile);
          console.log('[ProgressScreen] Web analytics loaded successfully:', result);
          if (!isResolved) {
            isResolved = true;
            setAnalytics(result);
            setLoading(false);
            loadingRef.current = false;
            console.log('[ProgressScreen] Analytics set successfully for web platform');
          }
        } catch (err) {
          console.error('Web analytics loading failed:', err);
          if (!isResolved) {
            isResolved = true;
            setError('Failed to load progress data.');
            setAnalytics({
              workout: { totalWorkouts: 0, completedWorkouts: 0, completionRate: 0, currentStreak: profile?.streak || 0, longestStreak: profile?.streak || 0, totalCaloriesBurned: 0, lastWorkoutDate: null, workoutsPerDay: {} },
              meal: { totalMeals: 0, completedMeals: 0, completionRate: 0, mealsPerDay: {}, lastMealDate: null },
              workoutStats: { totalWorkouts: 0, completionRate: 0, currentStreak: profile?.streak || 0, longestStreak: profile?.streak || 0 },
              period: 'week',
              water: { dailyIntake: {}, averageIntake: 0, goalCompletionRate: 0, streak: 0 }
            });
            setLoading(false);
            loadingRef.current = false;
          }
        }
        return;
      }
      
      const analyticsPromise = getTrackingAnalytics(user.id, timeRange, profile);
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
          workoutStats: { totalWorkouts: 0, completionRate: 0, currentStreak: profile?.streak || 0, longestStreak: profile?.streak || 0 },
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
        workoutStats: { totalWorkouts: 0, completionRate: 0, currentStreak: profile?.streak || 0, longestStreak: profile?.streak || 0 },
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

      // Clear safety timeout and reset loading flag
      clearTimeout(safetyTimeout);
      loadingRef.current = false;
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
      const now = Date.now();

      console.log('[ProgressScreen] 🎯 useFocusEffect triggered at', new Date().toISOString());
      console.log('[ProgressScreen] 🎯 Current state:', {
        dataChanged,
        hasAnalytics: !!analytics,
        contextReady,
        isLoading: loadingRef.current,
        lastFocusTime: lastFocusTime.current,
        timeSinceLastFocus: now - lastFocusTime.current
      });

      // Debounce focus effect to prevent infinite loops (minimum 1 second between calls)
      if (now - lastFocusTime.current < 1000) {
        console.log('[ProgressScreen] useFocusEffect - Debounced, skipping refresh');
        return;
      }

      lastFocusTime.current = now;
      console.log('[ProgressScreen] useFocusEffect - Screen focused.');
      let focusLoadingTimeout: NodeJS.Timeout | null = null;

      // Only proceed if contexts are ready
      if (!contextReady) {
        console.log('[ProgressScreen] useFocusEffect - Contexts not ready yet, skipping refresh');
        return;
      }

      // Prevent multiple simultaneous focus refreshes
      if (loadingRef.current) {
        console.log('[ProgressScreen] useFocusEffect - Already loading, skipping refresh');
        return;
      }

      // Always refresh when the screen is focused to ensure data is up-to-date
      // This ensures that any changes made in other tabs are reflected immediately
      console.log('[ProgressScreen] 🔄 ALWAYS refreshing data on focus for reliability');
      console.log('[ProgressScreen] Current state before refresh:', {
        dataChanged,
        hasAnalytics: !!analytics,
        lastRefreshTime: lastRefreshTime ? new Date(lastRefreshTime).toISOString() : 'never'
      });

      loadAnalytics();
      setLastRefreshTime(Date.now());
      setDataChanged(false); // Reset the flag after refreshing

      // Safeguard timeout for focus effect load
      focusLoadingTimeout = setTimeout(() => {
        console.warn('[ProgressScreen] useFocusEffect - Focus loading safeguard triggered after 15s.');
        setLoading(false);
        loadingRef.current = false;
      }, 15000);

      // Event listeners setup (as before)
      // ... make sure this section is complete as in the original file
      const workoutCompletionListener = EventRegister.addEventListener('workoutCompleted', (data: any) => {
        console.log('🔥 [ProgressScreen] Workout completion detected:', data);
        console.log('🔥 [ProgressScreen] Marking data as changed and refreshing analytics in 500ms...');
        setDataChanged(true);
        setTimeout(() => {
          console.log('🔥 [ProgressScreen] Calling loadAnalytics() after workout completion');
          loadAnalytics();
        }, 500);
      });

      const workoutDataChangedListener = EventRegister.addEventListener('workoutDataChanged', (data: any) => {
        console.log('🔥 [ProgressScreen] Workout data changed detected:', data);
        console.log('🔥 [ProgressScreen] Marking data as changed and refreshing analytics in 500ms...');
        setDataChanged(true);
        setTimeout(() => {
          console.log('🔥 [ProgressScreen] Calling loadAnalytics() after data change');
          loadAnalytics();
        }, 500);
      });
      const mealCompletionListener = EventRegister.addEventListener('mealCompleted', (data: any) => {
        console.log('Meal completion detected in Progress tab:', data);
        setTimeout(() => {
          loadAnalytics(); // This already includes meal data
          // loadMealCompletionData(); // Remove duplicate - analytics already includes meal data
        }, 500);
      });
      const waterTrackingListener = EventRegister.addEventListener('waterTracked', () => {
        console.log('Water tracking updated in Progress tab');
        setTimeout(() => { processWaterData();}, 300);
      });
      const bodyStatsListener = EventRegister.addEventListener('bodyStatsUpdated', () => {
        console.log('Body stats updated in Progress tab');
        loadAnalytics();
      });
      const streakUpdatedListener = EventRegister.addEventListener('streakUpdated', (data: any) => {
        console.log('🔥 Progress tab received streak update event:', data);
        if (data && typeof data.streak === 'number') {
          setAnalytics(prevAnalytics => {
            if (!prevAnalytics) return null;
            // Ensure that prevAnalytics and its nested properties are not null before spreading
            const currentWorkoutStats = prevAnalytics.workoutStats || { totalWorkouts: 0, completionRate: 0, currentStreak: 0, longestStreak: 0 };
            const currentWorkout = prevAnalytics.workout || { totalWorkouts: 0, completedWorkouts: 0, completionRate: 0, currentStreak: 0, longestStreak: 0, totalCaloriesBurned: 0, lastWorkoutDate: null, workoutsPerDay: {} };
            
            return {
              ...prevAnalytics,
              workout: { 
                ...currentWorkout, 
                currentStreak: data.streak, 
                longestStreak: Math.max(data.streak, currentWorkout.longestStreak || 0) 
              },
              workoutStats: { 
                ...currentWorkoutStats, 
                currentStreak: data.streak, 
                longestStreak: Math.max(data.streak, currentWorkoutStats.longestStreak || 0)
              }
            };
          });
        }
      });

      return () => {
        if (focusLoadingTimeout) {
          clearTimeout(focusLoadingTimeout);
        }
        EventRegister.removeEventListener(workoutCompletionListener as string);
        EventRegister.removeEventListener(workoutDataChangedListener as string);
        EventRegister.removeEventListener(mealCompletionListener as string);
        EventRegister.removeEventListener(waterTrackingListener as string);
        EventRegister.removeEventListener(bodyStatsListener as string);
        EventRegister.removeEventListener(streakUpdatedListener as string);
      };
    }, [contextReady, analytics, lastRefreshTime, loading]) // Removed function dependencies to prevent infinite re-renders
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
  
  // Animated styles - add dependency arrays to prevent render warnings
  const animatedHeaderStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
  }), []);

  const animatedContentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: (1 - contentOpacity.value) * 20 }],
  }), []);
  
  // Format the workouts data for the bar chart
  const formatWorkoutsData = (
    analytics: TrackingAnalytics | null, 
    currentPeriod: '7days' | '30days' | '90days', 
    selectedDate?: string
  ): Array<{ x: string; y: number; label?: string }> => {
    if (!analytics || !analytics.workout || !analytics.workout.workoutsPerDay) {
      return []; // Return empty array for Victory
    }

    const initialReferenceDate = selectedDate ? parseISO(selectedDate) : new Date();
    const today = new Date(initialReferenceDate.getFullYear(), initialReferenceDate.getMonth(), initialReferenceDate.getDate());

    if (currentPeriod === '7days') {
      const victoryData: Array<{ x: string; y: number; label?: string }> = [];

      // Get the start of the current week (Monday)
      const currentDayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const daysFromMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1; // Convert to Monday = 0
      const startOfWeek = subDays(today, daysFromMonday);

      console.log(`[ProgressScreen] Chart date calculation - Today: ${format(today, 'yyyy-MM-dd')} (${format(today, 'EEEE')}), Start of week: ${format(startOfWeek, 'yyyy-MM-dd')} (${format(startOfWeek, 'EEEE')})`);
      console.log(`[ProgressScreen] Available workout data:`, analytics.workout.workoutsPerDay);

      for (let i = 0; i < 7; i++) {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() + i); // Add i days to get Mon, Tue, Wed, etc.

        const dayName = format(date, 'EEEE'); // Full day name like "Monday"
        const shortDayName = format(date, 'EEE'); // Short day name like "Mon"
        const dateString = format(date, 'yyyy-MM-dd');

        // analytics.workout.workoutsPerDay uses full day names like "Monday"
        const workoutCount = analytics.workout.workoutsPerDay[dayName] || 0;
        const activityCompleted = workoutCount > 0 ? 1 : 0;

        console.log(`[ProgressScreen] Chart data - Day ${i}: ${shortDayName} (${dateString}): Looking for '${dayName}' = ${workoutCount} workouts, showing: ${activityCompleted}`);

        victoryData.push({ x: shortDayName, y: activityCompleted });
      }

      return victoryData;

    } else if (currentPeriod === '30days') {
      // For 30-day view, Victory might expect data grouped by week or individual points.
      // Let's return aggregated data per week for now, similar to before.
      // Victory can also handle more granular data if we want to show all 30 days.
      // This part will need more specific design for Victory.
      // For now, returning a simplified version, but this would need refinement.
      const labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
      const aggregatedData = new Array(4).fill(0);
      console.log(`[ProgressScreen] 30-day workout aggregation - Available data:`, analytics.workout.workoutsPerDay);

      for (let i = 0; i < 30; i++) {
        const date = subDays(today, i);
        const dateString = format(date, 'yyyy-MM-dd');
        const dayName = format(date, 'EEEE');
        const workoutCount = analytics.workout.workoutsPerDay[dateString] || 0; // Only check by date, not day name

        console.log(`[ProgressScreen] 30-day check - Date: ${dateString} (${dayName}), Count: ${workoutCount}`);

        if (workoutCount > 0) {
          const weekIndex = Math.floor((29 - i) / 7);
          if (weekIndex >= 0 && weekIndex < 4) {
             aggregatedData[3-weekIndex] = (aggregatedData[3-weekIndex] || 0) + 1;
             console.log(`[ProgressScreen] 30-day - Added to week ${weekIndex + 1} (index ${3-weekIndex})`);
          }
        }
      }
      console.log(`[ProgressScreen] 30-day final aggregated data:`, aggregatedData);
      return labels.map((label, index) => ({ x: label, y: aggregatedData[index] }));

    } else if (currentPeriod === '90days') {
      const labels = ['Month 1', 'Month 2', 'Month 3'];
      const aggregatedData = new Array(3).fill(0);
      console.log(`[ProgressScreen] 90-day workout aggregation - Available data:`, analytics.workout.workoutsPerDay);

      for (let i = 0; i < 90; i++) {
        const date = subDays(today, i);
        const dateString = format(date, 'yyyy-MM-dd');
        const dayName = format(date, 'EEEE');
        const workoutCount = analytics.workout.workoutsPerDay[dateString] || 0; // Only check by date, not day name

        console.log(`[ProgressScreen] 90-day check - Date: ${dateString} (${dayName}), Count: ${workoutCount}`);

        if (workoutCount > 0) {
          const monthIndex = Math.floor((89 - i) / 30);
          if (monthIndex >= 0 && monthIndex < 3) {
            aggregatedData[2-monthIndex] = (aggregatedData[2-monthIndex] || 0) + 1;
            console.log(`[ProgressScreen] 90-day - Added to month ${monthIndex + 1} (index ${2-monthIndex})`);
          }
        }
      }
      console.log(`[ProgressScreen] 90-day final aggregated data:`, aggregatedData);
      return labels.map((label, index) => ({ x: label, y: aggregatedData[index] }));
    }
    return []; // Default empty array
  };

  // Format the nutrition data for the line chart
  const formatNutritionData = (analytics: TrackingAnalytics | null, currentPeriod: '7days' | '30days' | '90days', profile: UserProfile | null, selectedDate?: string) => {
    if (!analytics || !analytics.meal || !analytics.meal.mealsPerDay) {
      return { labels: [], datasets: [{ data: [] }] };
    }

    let labels: string[] = [];
    let aggregatedData: number[] = [];

    const initialReferenceDate = selectedDate ? parseISO(selectedDate) : new Date();
    const today = new Date(initialReferenceDate.getFullYear(), initialReferenceDate.getMonth(), initialReferenceDate.getDate());

    // Attempt to import DayPlan or define inline if not available
    // Assuming DayPlan structure: { date: string, meals: Array<{...}>, ... }
    type DayPlanEntry = { date: string; meals: Array<any>; [key: string]: any };

    if (currentPeriod === '7days') {
      labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      aggregatedData = new Array(7).fill(0);
      console.log(`[ProgressScreen] Formatting nutrition data for 7 days. Profile meal_frequency: ${profile?.diet_preferences?.meal_frequency}, Meal Plan available: ${!!profile?.meal_plans?.weeklyPlan}`);

      // Get the start of the current week (Monday) - same logic as workout chart
      const currentDayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const daysFromMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1; // Convert to Monday = 0
      const startOfWeek = subDays(today, daysFromMonday);

      for (let i = 0; i < 7; i++) {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() + i); // Add i days to get Mon, Tue, Wed, etc.

        const dayName = format(date, 'EEEE');
        const dateStringKey = format(date, 'yyyy-MM-dd');
        const dayOfWeekForData = i; // Since we're iterating Mon=0, Tue=1, etc.
        
        let plannedMealsForThisDay = profile?.diet_preferences?.meal_frequency || 3;

        if (profile?.meal_plans?.weeklyPlan && Array.isArray(profile.meal_plans.weeklyPlan)) {
          const dayPlan = profile.meal_plans.weeklyPlan.find((dp: DayPlanEntry) => {
            if (!dp || !dp.date) return false;
            try {
              return isSameDay(parseISO(dp.date), date);
            } catch (e) {
              return false;
            }
          });

          if (dayPlan && dayPlan.meals && Array.isArray(dayPlan.meals) && dayPlan.meals.length > 0) {
            plannedMealsForThisDay = dayPlan.meals.length;
          }
        }
        
        const loggedDistinctMeals = analytics.meal.mealsPerDay[dayName] || analytics.meal.mealsPerDay[dateStringKey] || 0;

        let dayResult = 0;
        if (plannedMealsForThisDay > 0 && loggedDistinctMeals >= plannedMealsForThisDay) {
          dayResult = 1;
        }

        aggregatedData[dayOfWeekForData] = dayResult;
        
        console.log(`[ProgressScreen] Nutrition - Date: ${dateStringKey} (${dayName}), LoggedDistinct: ${loggedDistinctMeals}, Planned: ${plannedMealsForThisDay}, Result: ${dayResult}, ChartIndex: ${dayOfWeekForData}`);
      }
    } else if (currentPeriod === '30days') {
      labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
      aggregatedData = new Array(4).fill(0);
      const fallbackPlannedMeals = profile?.diet_preferences?.meal_frequency || 3;

      for (let i = 0; i < 30; i++) {
        const date = subDays(today, i);
        const dateString = format(date, 'yyyy-MM-dd');
          const dayName = format(date, 'EEEE');

          let plannedForDay = fallbackPlannedMeals;
          if (profile?.meal_plans?.weeklyPlan && Array.isArray(profile.meal_plans.weeklyPlan)) {
              const dayPlan = profile.meal_plans.weeklyPlan.find((dp: DayPlanEntry) => {
                  if (!dp || !dp.date) return false;
                  try { return isSameDay(parseISO(dp.date), date); } catch (e) { return false; }
              });
              if (dayPlan && dayPlan.meals && Array.isArray(dayPlan.meals) && dayPlan.meals.length > 0) {
                  plannedForDay = dayPlan.meals.length;
              }
          }
          const loggedDistinct = analytics.meal.mealsPerDay[dateString] || 0; // Only check by date for 30-day view
        
          if (plannedForDay > 0 && loggedDistinct >= plannedForDay) {
          const weekIndex = Math.floor((29 - i) / 7);
          if (weekIndex >= 0 && weekIndex < 4) {
                  aggregatedData[3 - weekIndex] = (aggregatedData[3 - weekIndex] || 0) + 1;
          }
        }
      }
      console.log(`[ProgressScreen] Nutrition - 30 Days: ${JSON.stringify(aggregatedData)}`);

    } else if (currentPeriod === '90days') { 
      labels = ['Month 1', 'Month 2', 'Month 3'];
      aggregatedData = new Array(3).fill(0);
      const fallbackPlannedMeals = profile?.diet_preferences?.meal_frequency || 3;

      for (let i = 0; i < 90; i++) {
        const date = subDays(today, i);
        const dateString = format(date, 'yyyy-MM-dd');
          const dayName = format(date, 'EEEE');
          
          let plannedForDay = fallbackPlannedMeals;
           if (profile?.meal_plans?.weeklyPlan && Array.isArray(profile.meal_plans.weeklyPlan)) {
              const dayPlan = profile.meal_plans.weeklyPlan.find((dp: DayPlanEntry) => {
                  if (!dp || !dp.date) return false;
                  try { return isSameDay(parseISO(dp.date), date); } catch (e) { return false; }
              });
              if (dayPlan && dayPlan.meals && Array.isArray(dayPlan.meals) && dayPlan.meals.length > 0) {
                  plannedForDay = dayPlan.meals.length;
              }
          }
          const loggedDistinct = analytics.meal.mealsPerDay[dateString] || 0; // Only check by date for 90-day view

          if (plannedForDay > 0 && loggedDistinct >= plannedForDay) {
          const monthIndex = Math.floor((89 - i) / 30);
          if (monthIndex >= 0 && monthIndex < 3) {
                  aggregatedData[2 - monthIndex] = (aggregatedData[2 - monthIndex] || 0) + 1; 
          }
        }
      }
      console.log(`[ProgressScreen] Nutrition - 90 Days: ${JSON.stringify(aggregatedData)}`);
    }
    // Log the data being sent to the meal completion chart
    console.log('[ProgressScreen] formatNutritionData output for Meal Completion chart:', JSON.stringify({ labels, aggregatedData }, null, 2));
    return { labels, datasets: [{ data: aggregatedData }] };
  };



  const workoutChartData = React.useMemo(() => {
    return formatWorkoutsData(analytics, timeRange, undefined);
  }, [analytics, timeRange]);

  const nutritionChartData = React.useMemo(() => {
    return formatNutritionData(analytics, timeRange, profile, timeRange === '7days' ? format(new Date(), 'yyyy-MM-dd') : undefined);
  }, [analytics, timeRange, profile]);

  // Main component render
  console.log("[ProgressScreen] Final Analytics before render:", JSON.stringify(analytics, null, 2));

  if (loading && !error) { // Prioritize showing loader if loading, unless there's an error
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" animating={true} color={theme.colors.primary} />
        <StyledText variant="bodyLarge" style={{ marginTop: spacing.md, color: theme.colors.onSurface }}>
          Loading progress...
        </StyledText>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <MaterialCommunityIcons name="alert-circle-outline" size={48} color={theme.colors.error} />
        <StyledText variant="bodyLarge" style={styles.errorTitle}>Oops! Something went wrong.</StyledText>
        <StyledText variant="bodyMedium" style={styles.errorText}>{error}</StyledText>
        <Button 
          mode="contained" 
          onPress={() => {
            setError(null); // Clear error before retrying
            setLoading(true); // Set loading state for retry
            loadAnalytics();
            processWaterData(); // Also re-process water data
          }} 
          style={styles.retryButton}
          labelStyle={{color: theme.colors.onErrorContainer}}
          buttonColor={theme.colors.errorContainer}
        >
          Try Again
        </Button>
      </SafeAreaView>
    );
  }

  if (!analytics) {
    return (
      <SafeAreaView style={styles.noDataContainer}>
        <MaterialCommunityIcons name="chart-bar-stacked" size={48} color={theme.colors.onSurfaceVariant} />
        <StyledText variant="bodyLarge" style={{ marginTop: spacing.md, color: theme.colors.onSurfaceVariant }}>
          No Progress Data
        </StyledText>
        <StyledText variant="bodyMedium" style={{ textAlign: 'center', marginTop: spacing.sm, color: theme.colors.onSurfaceVariant }}>
          Start tracking your workouts and meals to see your progress here!
        </StyledText>
      </SafeAreaView>
    );
  }

  // If analytics data is available, render the main progress screen
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} backgroundColor={theme.colors.background} />
      
      <Animated.View style={[styles.headerContainer, animatedHeaderStyle]}>
        <StyledText variant="headingMedium" style={styles.screenTitle}>
          Your Progress
        </StyledText>
        <SegmentedButtons
          value={timeRange}
          onValueChange={(value) => setTimeRange(value as '7days' | '30days' | '90days')}
          density="medium"
          style={styles.segmentedButtonContainer}
          buttons={[
            {
              value: '7days',
              label: '7 Days',
              style: [
                styles.buttonStyle,
                timeRange === '7days' && styles.selectedButtonStyle,
              ],
              labelStyle: [
                styles.buttonLabelStyle,
                timeRange === '7days' && styles.selectedButtonLabelStyle,
              ],
              checkedColor: colors.primary.main, // Icon color when selected
            },
            {
              value: '30days',
              label: '30 Days',
              style: [
                styles.buttonStyle,
                timeRange === '30days' && styles.selectedButtonStyle,
              ],
              labelStyle: [
                styles.buttonLabelStyle,
                timeRange === '30days' && styles.selectedButtonLabelStyle,
              ],
              checkedColor: colors.primary.main,
            },
            {
              value: '90days',
              label: '90 Days',
              style: [
                styles.buttonStyle,
                timeRange === '90days' && styles.selectedButtonStyle,
              ],
              labelStyle: [
                styles.buttonLabelStyle,
                timeRange === '90days' && styles.selectedButtonLabelStyle,
              ],
              checkedColor: colors.primary.main,
            },
          ]}
        />
      </Animated.View>
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={animatedContentStyle}>
          {/* Streak Information */}
          <View style={styles.streakContainer}>
            <View style={styles.streakItem}>
              <MaterialCommunityIcons name="fire" size={28} color={colors.accent.gold} />
              <StyledText variant="headingSmall" style={styles.streakValue}>{analytics.workout.currentStreak ?? 0}</StyledText>
              <StyledText variant="bodySmall" style={styles.streakLabel}>Current Streak</StyledText>
            </View>
            <View style={styles.streakItem}>
              <MaterialCommunityIcons name="trophy-award" size={28} color={colors.accent.green} />
              <StyledText variant="headingSmall" style={styles.streakValue}>{analytics.workout.longestStreak ?? 0}</StyledText>
              <StyledText variant="bodySmall" style={styles.streakLabel}>Longest Streak</StyledText>
            </View>
          </View>

          {/* Workout Stats Card */}
          {analytics.workout && (
            <Card style={styles.card}>
              <Card.Title 
                title="Workout Summary"
                titleStyle={styles.cardTitle}
                left={(props) => <MaterialCommunityIcons {...props} name="dumbbell" size={24} color={colors.primary.main} />}
              />
              <Card.Content>
                <View style={styles.statRow}>
                  <StyledText style={styles.statLabel}>Total Workouts:</StyledText>
                  <StyledText style={styles.statValue}>{analytics.workout.totalWorkouts ?? 0}</StyledText>
                </View>
                <Divider style={styles.divider} />
                <View style={styles.statRow}>
                  <StyledText style={styles.statLabel}>Completion Rate:</StyledText>
                  <StyledText style={styles.statValue}>{`${analytics.workout.completionRate?.toFixed(0) ?? 0}%`}</StyledText>
                </View>
                <Divider style={styles.divider} />
                <View style={styles.statRow}>
                  <StyledText style={styles.statLabel}>Calories Burned (est.):</StyledText>
                  <StyledText style={styles.statValue}>{analytics.workout.totalCaloriesBurned?.toFixed(0) ?? 0} kcal</StyledText>
                </View>
              </Card.Content>
            </Card>
          )}

          {/* Workout Chart */}
          {analytics.workout && (
            <Card style={[styles.card, animatedContentStyle]}>
              <Card.Content>
                <StyledText variant="headingSmall" style={styles.cardTitle}>
                  {timeRange === '7days' ? 'Weekly Activity' : timeRange === '30days' ? 'Monthly Activity' : 'Quarterly Activity'}
                </StyledText>
                {workoutChartData && workoutChartData.length > 0 ? (
                  isSkiaActuallyAvailable && axisPaint ? (
                    <Canvas style={{ width: chartWidth, height: chartHeight }}>
                      {/* Y-axis Line */}
                      <Rect x={chartPadding.left} y={chartPadding.top} width={1} height={barAreaHeight} paint={axisPaint} />

                      {/* X-axis Line */}
                      <Rect x={chartPadding.left} y={chartPadding.top + barAreaHeight} width={barAreaWidth} height={1} paint={axisPaint} />

                      {/* Bars will be drawn here */}
                      {workoutChartData.map((dataPoint, index) => {
                        const barSlotWidth = barAreaWidth / numDays;
                        const barWidth = barSlotWidth * 0.6; // Make bars narrower than the slot
                        const barSpacing = (barSlotWidth - barWidth) / 2;
                        const x = chartPadding.left + index * barSlotWidth + barSpacing;

                        const barMaxRenderHeight = barAreaHeight * 0.9; // Max height for a '1' bar to avoid touching top padding edge
                        const barActualHeight = dataPoint.y === 1 ? barMaxRenderHeight : 0;
                        // Bars grow upwards from bottom of bar area (which is chartPadding.top + barAreaHeight)
                        const y = chartPadding.top + barAreaHeight - barActualHeight;

                        // Only create paint if Skia is available
                        if (!isSkiaActuallyAvailable) {
                          return null;
                        }

                        let barPaint;
                        try {
                          barPaint = Skia.Paint();
                          barPaint.setColor(Skia.Color(theme.colors.primary));
                          barPaint.setStyle(PaintStyle.Fill);
                        } catch (error) {
                          console.error("[ProgressScreen] Error creating barPaint:", error);
                          return null;
                        }

                        if (barActualHeight > 0 && barPaint) {
                          return (
                            <Rect
                              key={`bar-${index}`}
                              x={x}
                              y={y}
                              width={barWidth}
                              height={barActualHeight}
                              paint={barPaint}
                            />
                          );
                        }
                        return null;
                      })}

                      {/* X-axis Labels (Mon, Tue, ...) - Temporarily disabled due to font loading issues */}
                      {/* {skiaFont && workoutChartData.map((dataPoint, index) => { ... })} */}

                      {/* Y-axis Labels (0, 1) - Temporarily disabled due to font loading issues */}
                      {/* {skiaFont && (() => { ... })()} */}

                    </Canvas>
                  ) : (
                    // Fallback chart when Skia is not available
                    <FallbackChart
                      data={workoutChartData.map(d => d.y)}
                      labels={workoutChartData.map(d => d.x)}
                      title=""
                      maxValue={timeRange === '7days' ? 1 : Math.max(...workoutChartData.map(d => d.y), 1)}
                      color={theme.colors.primary}
                      height={chartHeight}
                    />
                  )
                ) : (
                  <View style={styles.emptyChartContainer}>
                    <ActivityIndicator animating={loading} color={theme.colors.primary} />
                    {!loading &&
                        <Text style={styles.emptyChartText}>No workout data available for this period.</Text>}
                  </View>
                )}
              </Card.Content>
            </Card>
          )}

          {/* Nutrition Chart (Meal Completion) */}
          <Card style={styles.card}>
            <Card.Title
              title="Meal Completion"
              titleStyle={styles.cardTitle}
              left={(props) => <MaterialCommunityIcons {...props} name="food-fork-drink" size={24} color={colors.primary.main} />}
            />
            <Card.Content>
              {loading ? (
                <View style={styles.emptyChartContainer}>
                  <ActivityIndicator animating={true} color={theme.colors.primary} />
                  <Text style={styles.emptyChartText}>Loading meal data...</Text>
                </View>
              ) : (
                <FallbackChart
                  data={nutritionChartData?.datasets?.[0]?.data || [0, 0, 0, 0, 0, 0, 0]}
                  labels={nutritionChartData?.labels || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']}
                  title=""
                  maxValue={timeRange === '7days' ? 1 : Math.max(...(nutritionChartData?.datasets?.[0]?.data || [1]), 1)}
                  color={colors.secondary.main}
                  height={200}
                />
              )}
            </Card.Content>
          </Card>

          {/* Water Tracking */}
          <WaterTrackingProgress 
            timeRange={timeRange} 
            waterData={waterAnalytics} 
            isLoading={waterLoading} 
          />

          {/* Body Analysis */}
          <BodyAnalysisCard bodyAnalysis={profile?.body_analysis} />
          
        </Animated.View>
      </ScrollView>
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
    padding: spacing.lg,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
    padding: spacing.lg,
  },
  errorTitle: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  errorText: {
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  retryButton: {
    marginTop: spacing.md,
  },
  noDataContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
    padding: spacing.lg,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  headerContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: Platform.OS === 'android' ? spacing.lg : spacing.sm,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background.primary,
  },
  screenTitle: {
    textAlign: 'center',
    marginBottom: spacing.md,
    color: colors.text.primary,
  },
  segmentedButtonContainer: {
  },
  buttonStyle: {
    flex: 1,
    borderColor: colors.primary.dark,
    backgroundColor: colors.surface.dark,
  },
  buttonLabelStyle: {
    color: colors.text.secondary,
  },
  selectedButtonStyle: {
    backgroundColor: colors.primary.main,
    borderColor: colors.primary.main,
  },
  selectedButtonLabelStyle: {
    color: colors.text.primary,
    fontWeight: 'bold',
  },
  streakContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: colors.surface.light,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    ...shadows.small,
  },
  streakItem: {
    alignItems: 'center',
  },
  streakValue: {
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
  streakLabel: {
    color: colors.text.muted,
    fontSize: 12,
  },
  card: {
    marginBottom: spacing.md,
    backgroundColor: colors.surface.main,
    borderRadius: borderRadius.lg,
    ...shadows.medium,
  },
  cardTitle: {
    color: colors.text.primary,
    fontWeight: 'bold',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  statLabel: {
    color: colors.text.secondary,
    fontSize: 14,
  },
  statValue: {
    color: colors.text.primary,
    fontWeight: 'bold',
    fontSize: 15,
  },
  divider: {
    backgroundColor: colors.border.light,
    marginVertical: spacing.xs / 2,
  },
  chartContainer: {
    backgroundColor: colors.surface.main,
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    marginBottom: spacing.md,
    ...shadows.medium,
    alignItems: 'center',
  },
  chartTitle: {
    color: colors.text.primary,
    marginBottom: spacing.sm,
    alignSelf: 'flex-start',
    paddingLeft: spacing.xs
  },
  chartStyle: {
    borderRadius: borderRadius.md,
  },
  emptyChartContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyChartText: {
    marginTop: spacing.sm,
    color: colors.text.secondary,
  },
});
