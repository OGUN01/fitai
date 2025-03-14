import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, Dimensions, TouchableOpacity } from 'react-native';
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
  const screenWidth = Dimensions.get('window').width - 32; // 16px padding on each side

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
      // Convert UI timeRange to API period format
      const period = timeRange as '7days' | '30days' | '90days';
      
      const data = await getTrackingAnalytics(user.id, period);
      setAnalytics(data);
      setError(null);
    } catch (err) {
      console.error('Error loading analytics:', err);
      setError('Failed to load progress data. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // Load data when component mounts or timeRange changes
  useEffect(() => {
    loadAnalytics();
  }, [user, timeRange]);

  // Calculate current streak based on workout completion
  const calculateDayStreak = () => {
    // Default to API-provided streak if available
    if (analytics?.workout?.currentStreak && analytics.workout.currentStreak > 0) {
      return analytics.workout.currentStreak;
    }
    
    // Fallback: Calculate streak from completed workouts if available
    if (analytics?.workout?.workoutsPerDay) {
      // Count consecutive days with workouts
      const workoutData = analytics.workout.workoutsPerDay;
      const completedDays = Object.entries(workoutData)
        .filter(([_, count]) => (count as number) > 0)
        .map(([day]) => day);
      
      // For demo purposes, use the number of completed workouts as the streak
      // In a real app, this would be calculated from consecutive dates
      return Math.min(7, completedDays.length);
    }
    
    // Return streak from profile if available
    const profileData = profile as any;
    if (profileData?.streak_count || profileData?.streak) {
      return Number(profileData.streak_count || profileData.streak || 0);
    }
    
    // Last resort: simulate a streak based on workouts completed
    return Math.min(7, analytics?.workout?.completedWorkouts || 0);
  };

  // Format the workouts data for the bar chart
  const formatWorkoutsData = () => {
    if (!analytics || !analytics.workout) {
      return {
        labels: ['No Data'],
        datasets: [{ 
          data: [0],
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
      
      // Get only days that have at least one workout completed
      const completedWorkoutDays = Object.entries(analytics.workout.workoutsPerDay)
        .filter(([_, count]) => (count as number) > 0)
        .map(([dayName]) => dayName);
      
      console.log('Days that have workouts:', completedWorkoutDays);
      
      // Set a fixed value of 1 for each day that has workouts
      completedWorkoutDays.forEach(dayName => {
        // Only process if it's a valid day in our mapping
        if (dayMapping[dayName] !== undefined) {
          // Always use 1 as the value for completed days
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

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <StatusBar style="light" />
      
      {/* Header with Bold Minimalism design */}
      <View style={styles.headerContainer}>
        <LinearGradient
          colors={[theme.colors.primary, theme.colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <Text variant="headlineMedium" style={styles.headerTitle}>Progress</Text>
          </View>
        </LinearGradient>
      </View>
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <LinearGradient
            colors={[theme.colors.primaryContainer, theme.colors.secondaryContainer]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.loadingGradient}
          >
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Loading your progress data...</Text>
          </LinearGradient>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <LinearGradient
            colors={[theme.colors.primaryContainer, theme.colors.secondaryContainer]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.errorGradient}
          >
            <MaterialCommunityIcons name="alert-circle-outline" size={48} color={theme.colors.error} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={loadAnalytics}
            >
              <LinearGradient
                colors={[theme.colors.primary, theme.colors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.retryButtonGradient}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      ) : (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Time Range Selector with Bold Minimalism design */}
          <Card style={styles.timeRangeCard} mode="outlined">
            <LinearGradient
              colors={['#ffffff', '#f8f8f8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cardGradient}
            >
              <Card.Content>
                <View style={styles.cardHeaderRow}>
                  <MaterialCommunityIcons name="clock-outline" size={24} color={theme.colors.primary} />
                  <Text variant="titleMedium" style={styles.cardTitle}>Time Range</Text>
                </View>
                <SegmentedButtons
                  value={timeRange}
                  onValueChange={(value) => setTimeRange(value as '7days' | '30days' | '90days')}
                  buttons={[
                    { value: '7days', label: '7 Days', style: styles.segmentButton },
                    { value: '30days', label: '30 Days', style: styles.segmentButton },
                    { value: '90days', label: '3 Months', style: styles.segmentButton },
                  ]}
                  style={styles.segmentedButtons}
                />
              </Card.Content>
            </LinearGradient>
          </Card>
          {/* Workout Progress Card */}
          <Card style={styles.card} mode="outlined">
            <LinearGradient
              colors={['#ffffff', '#f8f8f8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cardGradient}
            >
              <Card.Content>
                <View style={styles.cardHeaderRow}>
                  <MaterialCommunityIcons name="arm-flex" size={24} color={theme.colors.primary} />
                  <Text variant="titleLarge" style={styles.cardTitle}>Workout Progress</Text>
                </View>
                
                {/* Current Streak */}
                <LinearGradient
                  colors={[theme.colors.primaryContainer, theme.colors.secondaryContainer]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.streakGradient}
                >
                  <View style={styles.streakContainer}>
                    <Text variant="titleLarge" style={styles.streakNumber}>
                      {analytics?.workoutStats?.currentStreak || 0}
                    </Text>
                    <Text style={styles.streakLabel}>Day Streak</Text>
                  </View>
                </LinearGradient>
                
                {/* Workout Completion Rate */}
                <Text style={styles.chartTitle}>Workout Completion Rate</Text>
                <WorkoutBarChart 
                  data={formatWorkoutsData()} 
                  width={screenWidth} 
                  height={220}
                  style={styles.chart}
                />
                
                {/* Workout Stats */}
                <Divider style={styles.divider} />
                <LinearGradient
                  colors={[theme.colors.primaryContainer, theme.colors.secondaryContainer]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.statsGradient}
                >
                  <View style={styles.statsGridContainer}>
                    <View style={styles.statGridItem}>
                      <Text variant="titleLarge" style={styles.statNumber}>{analytics?.workoutStats?.totalWorkouts || 0}</Text>
                      <Text style={styles.statLabel}>Total Workouts</Text>
                    </View>
                    <View style={styles.statGridItem}>
                      <Text variant="titleLarge" style={styles.statNumber}>{analytics?.workoutStats?.completionRate || 0}%</Text>
                      <Text style={styles.statLabel}>Completion Rate</Text>
                    </View>
                    <View style={styles.statGridItem}>
                      <Text variant="titleLarge" style={styles.statNumber}>{analytics?.workoutStats?.bestStreak || 0}</Text>
                      <Text style={styles.statLabel}>Best Streak</Text>
                    </View>
                  </View>
                </LinearGradient>
              </Card.Content>
            </LinearGradient>
          </Card>
          
          {/* Body Analysis Card */}
          <BodyAnalysisCard bodyAnalysis={profile?.body_analysis} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  headerContainer: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  headerGradient: {
    padding: 16,
    borderRadius: 16,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    color: 'white',
    fontWeight: 'bold',
    paddingLeft: 12,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  segmentedButtons: {
    marginBottom: 16,
  },
  card: {
    marginBottom: 16,
    elevation: 2,
  },
  achievementCard: {
    marginBottom: 16,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#FFD700',
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 16,
  },
  summaryItem: {
    width: '50%',
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  divider: {
    marginVertical: 12,
  },
  achievementItem: {
    paddingVertical: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  loadingGradient: {
    width: '100%',
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  errorGradient: {
    width: '100%',
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    marginTop: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 8,
  },
  streakContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  streakNumber: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  chartTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  statsGridContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statGridItem: {
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  timeRangeCard: {
    marginBottom: 16,
    elevation: 2,
  },
  cardGradient: {
    padding: 16,
    borderRadius: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    marginLeft: 8,
  },
  segmentButton: {
    padding: 8,
  },
  segmentedButtons: {
    marginBottom: 16,
  },
  retryButtonGradient: {
    padding: 8,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
  },
  streakGradient: {
    padding: 16,
    borderRadius: 16,
  },
  streakLabel: {
    fontSize: 14,
    color: 'rgba(0, 0, 0, 0.6)',
  },
  statsGradient: {
    padding: 16,
    borderRadius: 16,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: 'rgba(0, 0, 0, 0.6)',
  },
});
