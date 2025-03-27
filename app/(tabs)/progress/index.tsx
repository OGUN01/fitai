import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, Dimensions, TouchableOpacity, TextStyle, ViewStyle } from 'react-native';
import { Text, Card, Title, Paragraph, useTheme, Button, Divider, SegmentedButtons } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { BarChart, LineChart, PieChart } from 'react-native-chart-kit';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../../contexts/AuthContext';
import { useProfile } from '../../../contexts/ProfileContext';
import { getTrackingAnalytics } from '../../../services/trackingService';
import { TrackingAnalytics } from '../../../types/tracking';
import { format, subDays, parseISO } from 'date-fns';
import BodyAnalysisCard from '../../../components/progress/BodyAnalysisCard';
import StyledText from '../../../components/ui/StyledText';
import { colors, spacing, borderRadius, shadows } from '../../../theme/theme';
import { useFocusEffect } from 'expo-router';
import { EventRegister } from 'react-native-event-listeners';
import WaterTrackingProgress, { WaterAnalytics } from '../../../components/progress/WaterTrackingProgress';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, Easing } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

// Premium Colors with proper typing
const PREMIUM_GRADIENTS = {
  primary: ['#5B86E5', '#36D1DC'] as const,
  secondary: ['#FF416C', '#FF4B2B'] as const,
  tertiary: ['#11998e', '#38ef7d'] as const,
  dark: ['#121212', '#2D3436'] as const,
};

/**
 * Progress screen component
 */
export default function ProgressScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const { profile } = useProfile();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<TrackingAnalytics | null>(null);
  const [timeRange, setTimeRange] = useState<'7days' | '30days' | '90days'>('7days');
  const [waterAnalytics, setWaterAnalytics] = useState<WaterAnalytics | undefined>(undefined);
  const [waterLoading, setWaterLoading] = useState(true);
  const screenWidth = Dimensions.get('window').width;

  // Animated values for UI elements
  const headerOpacity = useSharedValue(0);
  const contentOpacity = useSharedValue(0);

  // Default chart config for Bold Minimalism design
  const chartConfig = {
    backgroundColor: 'transparent',
    backgroundGradientFrom: theme.colors.primary,
    backgroundGradientTo: theme.colors.secondary,
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
  };

  // Create a specific config for the workout bar chart
  const workoutChartConfig = {
    ...chartConfig,
    decimalPlaces: 0,
    // Control the y-axis ticks
    propsForBackgroundLines: {
      strokeDasharray: "", // Solid line
    },
    // Custom function to control y-axis labels
    formatYLabel: (value: string) => {
      // Only show 0 and 1 on the y-axis
      const numValue = parseFloat(value);
      if (numValue === 0 || numValue === 1) {
        return value;
      }
      return "";
    },
    // Set a fixed step size for the y-axis
    stepSize: 1,
    // Override the y-axis configuration
    yAxisInterval: 1,
    // Set a fixed y-axis maximum
    yAxisMaxValue: 1,
    // Set a fixed y-axis minimum
    yAxisMinValue: 0,
  };

  // Load analytics data
  const loadAnalytics = async () => {
    if (!user) return;
    
    setLoading(true);
    
    try {
      // The period already matches the expected type
      console.log('Fetching tracking analytics with period:', timeRange);
      const data = await getTrackingAnalytics(user.id, timeRange);
      console.log('Received analytics data:', JSON.stringify(data, null, 2));
      setAnalytics(data);
      setError(null);
    } catch (err) {
      console.error('Error loading analytics:', err);
      setError('Failed to load progress data. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // Function to process water tracking data from profile
  const processWaterData = () => {
    setWaterLoading(true);
    
    try {
      if (!profile || !profile.workout_tracking || typeof profile.workout_tracking !== 'object') {
        setWaterAnalytics(undefined);
        setWaterLoading(false);
        return;
      }
      
      // Get water tracking data from profile
      const waterTrackingData = profile.workout_tracking.water_tracking;
      
      if (!waterTrackingData) {
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
      
      // Create daily intake map from logs
      const dailyIntake: Record<string, number> = {};
      
      if (Array.isArray(waterTrackingData.logs) && waterTrackingData.logs.length > 0) {
        waterTrackingData.logs.forEach(log => {
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
      
      // Calculate average intake and goal completion rate
      const averageIntake = Object.keys(dailyIntake).length > 0 
        ? Object.values(dailyIntake).reduce((sum, val) => sum + val, 0) / Object.keys(dailyIntake).length
        : 0;
        
      const goalCompletionRate = Object.keys(dailyIntake).length > 0
        ? (Object.values(dailyIntake).filter(val => val >= waterGoalInML).length / Object.keys(dailyIntake).length) * 100
        : 0;
      
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
  };
  
  // Fetch data on component mount and when profile changes
  useEffect(() => {
      loadAnalytics();
    processWaterData();
  }, [timeRange, profile]);
  
  // Animate elements when data loads
  useEffect(() => {
    if (!loading) {
      // Animate header
      headerOpacity.value = withTiming(1, {
        duration: 600,
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
  
  // Refresh data when the screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        console.log('Progress tab in focus, refreshing data');
        loadAnalytics();
      }
      return () => {
        // Cleanup if needed
      };
    }, [user, timeRange])
  );
  
  // Listen for workout completion events to update progress
  useEffect(() => {
    const workoutCompletionListener = EventRegister.addEventListener('workoutCompleted', (data: any) => {
      if (data && data.userId === user?.id) {
        console.log('Progress tab received workout completion event:', data);
        // Refresh analytics data
        loadAnalytics();
      }
    });
    
    // Cleanup listener on component unmount
    return () => {
      EventRegister.removeEventListener(workoutCompletionListener as string);
    };
  }, [user]);

  // Calculate current streak based on workout completion
  const calculateDayStreak = () => {
    // Use the analytics data if available
    if (analytics?.workout?.currentStreak !== undefined) {
      console.log('Using streak from analytics:', analytics.workout.currentStreak);
      return analytics.workout.currentStreak;
    }
    
    // Fallback to profile streak if available
    if (profile?.streak !== undefined) {
      console.log('Using streak from profile:', profile.streak);
      return profile.streak;
    }
    
    // If all else fails, return 0
    console.log('No streak data available, using 0');
    return 0;
  };

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
    
    // If we have actual workout data, use it
    if (analytics.workout && analytics.workout.workoutsPerDay) {
      console.log('Workout data:', analytics.workout.workoutsPerDay);
      
      // Process each day in the workout data
      Object.entries(analytics.workout.workoutsPerDay).forEach(([dayName, count]) => {
        if (dayMapping[dayName] !== undefined && count > 0) {
          // Set to 1 to indicate completion (this is for the visual indicator)
          workoutCounts[dayMapping[dayName]] = 1;
        }
      });
    }

    console.log('Final chart data:', workoutCounts);
    
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

    // Use real meal data instead of dummy data
    const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    
    // Initialize with zeros
    const mealCounts = daysOfWeek.map(() => 0);
    
    // If we have actual meal data, use it
    if (analytics.meal && analytics.meal.mealsPerDay) {
      // Map the actual meal counts to the days of the week
      Object.entries(analytics.meal.mealsPerDay).forEach(([date, count]) => {
        try {
          const dayIndex = new Date(date).getDay();
          // Convert Sunday (0) to be the last day (6) in our array
          const adjustedIndex = dayIndex === 0 ? 6 : dayIndex - 1;
          if (adjustedIndex >= 0 && adjustedIndex < 7) {
            mealCounts[adjustedIndex] = count;
          }
        } catch (err) {
          console.error('Error parsing date:', date, err);
        }
      });
    }

    return {
      labels: daysOfWeek,
      datasets: [
        {
          data: mealCounts,
          color: (opacity = 1) => `rgba(134, 65, 244, ${opacity})`,
          strokeWidth: 2,
        },
      ],
    };
  };

  // Format the calories data for the pie chart
  const formatCaloriesData = () => {
    if (!analytics || !analytics.workout) {
      return [
        { name: 'No Data', population: 1, color: '#AAAAAA', legendFontColor: '#7F7F7F', legendFontSize: 15 },
      ];
    }

    // Use the total calories burned from workout stats
    const caloriesBurned = analytics.workout.totalCaloriesBurned || 0;
    
    // Create dummy consumed calories (about 1.5x burned)
    const caloriesConsumed = Math.round(caloriesBurned * 1.5);
    const calorieDeficit = Math.max(0, caloriesConsumed - caloriesBurned);

    return [
      {
        name: 'Burned',
        population: caloriesBurned,
        color: '#FF5733',
        legendFontColor: '#7F7F7F',
        legendFontSize: 15,
      },
      {
        name: 'Consumed',
        population: caloriesConsumed,
        color: '#33FF57',
        legendFontColor: '#7F7F7F',
        legendFontSize: 15,
      },
      {
        name: 'Deficit',
        population: calorieDeficit,
        color: '#3357FF',
        legendFontColor: '#7F7F7F',
        legendFontSize: 15,
      },
    ];
  };

  // Custom wrapper for BarChart to fix y-axis issues
  const WorkoutBarChart = ({ data, width, height, style }: any) => {
    const theme = useTheme();
    
    // Simple chart config with minimal y-axis
    const simpleChartConfig = {
      backgroundColor: 'transparent',
      backgroundGradientFrom: theme.colors.primary,
      backgroundGradientTo: theme.colors.secondary,
      decimalPlaces: 0,
      color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
      labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
      style: {
        borderRadius: 16,
      },
    };
    
    return (
      <View style={[style, { position: 'relative' }]}>
        {/* Custom y-axis labels */}
        <View style={{ 
          position: 'absolute', 
          left: 10, 
          top: 0, 
          bottom: 0, 
          justifyContent: 'space-between',
          paddingBottom: 30,
          paddingTop: 10
        }}>
          <Text style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.6)' }}>1</Text>
          <Text style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.6)' }}>0</Text>
        </View>
        
        {/* The actual chart */}
        <BarChart
          data={data}
          width={width}
          height={height}
          chartConfig={simpleChartConfig}
          verticalLabelRotation={30}
          fromZero
          withInnerLines={false}
          showValuesOnTopOfBars={false}
          withHorizontalLabels={false} // Hide default y-axis labels
          withVerticalLabels={true}
          yAxisLabel=""
          yAxisSuffix=""
        />
      </View>
    );
  };

  // Create a custom workout completion chart
  const WorkoutCompletionChart = () => {
    const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const workoutData = formatWorkoutsData();
    const data = workoutData.datasets[0].data;
    
    // Current day index (0 = Monday, 6 = Sunday)
    const today = new Date().getDay();
    const todayIndex = today === 0 ? 6 : today - 1; // Convert to our 0-indexed week (Mon=0, Sun=6)
    
    return (
      <View style={styles.workoutChartCard}>
        <LinearGradient
          colors={['rgba(25, 25, 35, 0.98)', 'rgba(15, 15, 25, 0.95)']}
          style={[StyleSheet.absoluteFill, { borderRadius: borderRadius.lg }]}
        />
        
        <View style={styles.workoutChartHeader}>
          <View style={styles.workoutTitleContainer}>
            <MaterialCommunityIcons name="dumbbell" size={22} color="#FF2E93" />
            <StyledText style={styles.workoutChartTitle}>Weekly Workout Progress</StyledText>
          </View>
          
          <View style={styles.streakContainer}>
            <MaterialCommunityIcons name="fire" size={18} color="#FF9500" />
            <StyledText style={styles.streakText}>{calculateDayStreak()} Day Streak</StyledText>
          </View>
        </View>
        
      <View style={styles.completionChartContainer}>
          {daysOfWeek.map((day, index) => {
            const isCompleted = data[index] > 0;
            const isToday = index === todayIndex;
            
            // Create individual styles instead of arrays to fix TypeScript errors
            const barStyle: ViewStyle = {
              ...styles.dayBar,
              ...(isCompleted ? styles.dayBarCompleted : {}),
              ...(isToday ? styles.dayBarToday : {}),
              ...(isToday && isCompleted ? styles.dayBarTodayCompleted : {})
            };
            
            const labelStyle: TextStyle = {
              ...styles.dayLabel,
              ...(isToday ? styles.dayLabelToday : {})
            };
            
            return (
          <View key={index} style={styles.dayColumn}>
                <View style={barStyle}>
                  {isCompleted && (
                    <MaterialCommunityIcons 
                      name="check" 
                      size={18} 
                      color="white" 
                      style={styles.checkIcon} 
                    />
              )}
            </View>
                <StyledText style={labelStyle}>{day}</StyledText>
          </View>
            );
          })}
        </View>
      </View>
    );
  };

  // Custom Time Selector with premium styling
  const PremiumTimeSelector = () => {
  return (
      <View style={styles.timeSelectorContainer}>
      <LinearGradient
          colors={['rgba(30, 30, 40, 0.6)', 'rgba(20, 20, 30, 0.8)']}
        start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.timeSelectorGradient}
        />
        
        <View style={styles.timeButtonsContainer}>
          {[
            { value: '7days', label: '1 Week' },
            { value: '30days', label: '30 Days' },
            { value: '90days', label: '90 Days' }
          ].map((option) => {
            // Create individual styles to fix TypeScript errors
            const buttonStyle: ViewStyle = {
              ...styles.timeButton,
              ...(timeRange === option.value ? styles.timeButtonActive : {})
            };
            
            const textStyle: TextStyle = {
              ...styles.timeButtonText,
              ...(timeRange === option.value ? styles.timeButtonTextActive : {})
            };
            
            return (
              <TouchableOpacity
                key={option.value}
                style={buttonStyle}
                onPress={() => setTimeRange(option.value as '7days' | '30days' | '90days')}
              >
                {timeRange === option.value ? (
                <LinearGradient
                    colors={PREMIUM_GRADIENTS.primary}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                  />
                ) : null}
                
                <StyledText style={textStyle}>
                  {option.label}
                  </StyledText>
              </TouchableOpacity>
            );
          })}
            </View>
                </View>
    );
  };

  // Render the Progress screen
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />
      
      <Animated.View style={[styles.header, animatedHeaderStyle]}>
        <StyledText style={styles.headerTitle}>Progress</StyledText>
      </Animated.View>
      
      <PremiumTimeSelector />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FF2E93" />
            <StyledText style={styles.loadingText}>Loading your progress data...</StyledText>
                    </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <StyledText style={styles.errorText}>{error}</StyledText>
            <Button 
              mode="contained" 
              onPress={loadAnalytics} 
              style={styles.tryAgainButton}
              buttonColor="#FF2E93"
            >
              Try Again
            </Button>
                    </View>
        ) : (
          <Animated.View style={animatedContentStyle}>
            {/* Workout Completion Chart */}
            <WorkoutCompletionChart />
            
            {/* Water Tracking Progress */}
            <WaterTrackingProgress 
              timeRange={timeRange}
              waterData={waterAnalytics}
              isLoading={waterLoading}
            />
            
            {/* Body Analysis Card */}
            {profile?.body_analysis && (
              <BodyAnalysisCard bodyAnalysis={profile.body_analysis} />
            )}
          </Animated.View>
        )}
      </ScrollView>
        </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  timeSelectorContainer: {
    marginHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
    ...shadows.medium,
  },
  timeSelectorGradient: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  timeButtonsContainer: {
    flexDirection: 'row',
    padding: spacing.xs,
  },
  timeButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    position: 'relative',
    overflow: 'hidden',
  } as ViewStyle,
  timeButtonActive: {
    ...shadows.small,
  } as ViewStyle,
  timeButtonText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '600',
    fontSize: 14,
  } as TextStyle,
  timeButtonTextActive: {
    color: 'white',
    fontWeight: '700',
  } as TextStyle,
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    minHeight: 300,
  },
  loadingText: {
    marginTop: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    minHeight: 300,
  },
  errorText: {
    marginTop: 16,
    textAlign: 'center',
    marginBottom: 16,
    color: '#F87171',
  },
  tryAgainButton: {
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
  },
  workoutChartCard: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
    ...shadows.large,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  workoutChartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  workoutTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  workoutChartTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: spacing.sm,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 149, 0, 0.15)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 12,
  },
  streakText: {
    color: '#FF9500',
    fontWeight: '700',
    fontSize: 12,
    marginLeft: 4,
  },
  completionChartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  dayColumn: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: 140,
  },
  dayBar: {
    width: 28,
    height: 80,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  } as ViewStyle,
  dayBarCompleted: {
    backgroundColor: '#FF2E93',
    ...shadows.small,
  } as ViewStyle,
  dayBarToday: {
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  } as ViewStyle,
  dayBarTodayCompleted: {
    borderColor: 'rgba(255, 255, 255, 0.5)',
  } as ViewStyle,
  checkIcon: {
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  dayLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    fontWeight: '600',
  } as TextStyle,
  dayLabelToday: {
    color: 'white',
    fontWeight: '700',
  } as TextStyle,
});
