import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity, ViewStyle, TextStyle, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows } from '../../theme/theme';
import StyledText from '../ui/StyledText';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, Easing } from 'react-native-reanimated';
import Svg, { Circle, Path, G } from 'react-native-svg';
import { Canvas, Rect, Skia, PaintStyle, Path as SkiaPath, Line } from '@shopify/react-native-skia';
import { useSkiaContext } from '../../contexts/SkiaContext';
import FallbackChart from './FallbackChart';

// Add missing type definitions
// Generic water analytics interface
export interface WaterAnalytics {
  dailyIntake?: Record<string, number>;
  monthlyIntake?: Record<string, number>;
  dailyGoal?: number;
  currentStreak?: number;
  averageIntake?: number;
  goalCompletionRate?: number;
}

// Helper functions for date formatting
export const formatDate = (date: Date, format: string): string => {
  // Simple implementation for MMM d format
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}`;
};

export const getDayOfWeek = (date: Date): string => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay()];
};

// Premium water colors
const WATER_COLOR_LIGHT = '#36D1DC';  
const WATER_COLOR_DARK = '#5B86E5';
const WATER_COLOR_HIGHLIGHT = '#00E0FF';

// Constants for spacing
const EXTRA_SMALL_SPACING = 4;

// Define achievement badge icons
const BADGE_ICONS = {
  streak: 'fire',
  goal: 'trophy',
  improvement: 'trending-up',
  consistency: 'check-decagram'
} as const;

// Define icon types
type WaterIcon = 'water' | 'calendar-week' | 'calendar-month';
type BadgeIconType = typeof BADGE_ICONS[keyof typeof BADGE_ICONS];

// Props for the WaterTrackingProgress component
interface WaterTrackingProgressProps {
  timeRange: '7days' | '30days' | '90days';
  waterData: WaterAnalytics | undefined;
  isLoading: boolean;
}

/**
 * Component to display water tracking progress over different time periods
 */
const WaterTrackingProgress: React.FC<WaterTrackingProgressProps> = ({ 
  timeRange, 
  waterData,
  isLoading
}) => {
  const { isSkiaLoaded } = useSkiaContext();

  // Animation values
  const chartOpacity = useSharedValue(0);
  const statsScale = useSharedValue(0.8);
  
  // Reset and trigger animations when data changes
  useEffect(() => {
    if (!isLoading) {
      // Animate chart appearance
      chartOpacity.value = 0;
      setTimeout(() => {
        chartOpacity.value = withTiming(1, {
          duration: 800,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        });
      }, 300);
      
      // Animate stats with bounce effect
      statsScale.value = 0.8;
      setTimeout(() => {
        statsScale.value = withSpring(1, {
          damping: 12,
          stiffness: 100,
        });
      }, 500);
    }
  }, [isLoading, waterData, timeRange]);
  
  // Animated styles
  const chartAnimStyle = useAnimatedStyle(() => ({
    opacity: chartOpacity.value,
    transform: [{ translateY: (1 - chartOpacity.value) * 15 }],
  }));
  
  const statsAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: statsScale.value }],
  }));
  
  // Get the screen width for chart sizing
  const screenWidth = Dimensions.get('window').width;
  const chartCardWidth = screenWidth - (spacing.md * 2); // Full width of the card
  const skiaChartWidth = chartCardWidth - (spacing.sm * 2); // Width inside card padding
  const skiaChartHeight = 200; // Fixed height for the water chart
  
  // Chart drawing constants
  const chartPadding = { top: 10, right: 10, bottom: 20, left: 30 }; // Adjusted for simpler chart
  const barAreaHeight = skiaChartHeight - chartPadding.top - chartPadding.bottom;
  const barAreaWidth = skiaChartWidth - chartPadding.left - chartPadding.right;

  // Check if Skia is actually available (not just the context state)
  const isSkiaActuallyAvailable = React.useMemo(() => {
    try {
      // More comprehensive Skia availability check
      const skiaAvailable = isSkiaLoaded &&
        typeof Skia !== 'undefined' &&
        Skia !== null &&
        typeof Skia.Paint === 'function' &&
        typeof Skia.Color === 'function' &&
        typeof Skia.Point === 'function';

      if (!skiaAvailable) {
        console.log("[WaterTrackingProgress] Skia availability check failed:", {
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
      console.error("[WaterTrackingProgress] Error checking Skia availability:", error);
      return false;
    }
  }, [isSkiaLoaded]);

  // Prepare paints (memoized for performance)
  const barPaint = React.useMemo(() => {
    // Early return if Skia is not available
    if (!isSkiaActuallyAvailable) {
      return null;
    }

    try {
      const paint = Skia.Paint();
      paint.setColor(Skia.Color(WATER_COLOR_LIGHT)); // Use water theme color
      paint.setStyle(PaintStyle.Fill);
      return paint;
    } catch (error) {
      console.error("[WaterTrackingProgress] Error creating barPaint:", error);
      return null;
    }
  }, [isSkiaActuallyAvailable]);

  const axisPaint = React.useMemo(() => {
    // Early return if Skia is not available
    if (!isSkiaActuallyAvailable) {
      return null;
    }

    try {
      const paint = Skia.Paint();
      paint.setColor(Skia.Color(colors.text.muted)); // A subtle color for axis lines
      paint.setStyle(PaintStyle.Stroke);
      paint.setStrokeWidth(1);
      return paint;
    } catch (error) {
      console.error("[WaterTrackingProgress] Error creating axisPaint:", error);
      return null;
    }
  }, [isSkiaActuallyAvailable]);

  // Format data for charts based on time range
  const getFormattedWaterData = React.useCallback(() => {
    // Default empty data
    let labels: string[] = [];
    let data: number[] = [];
    let maxValue = 1;
    
    if (!waterData || !waterData.dailyIntake || Object.keys(waterData.dailyIntake).length === 0) {
      // Return empty state based on timeRange
      if (timeRange === '7days') {
        labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
        data = [0, 0, 0, 0, 0, 0, 0];
      } else if (timeRange === '30days') {
        labels = ['W1', 'W2', 'W3', 'W4'];
        data = [0, 0, 0, 0];
      } else {
        labels = ['Jan', 'Feb', 'Mar'];
        data = [0, 0, 0];
      }
      return { labels, data, maxValue };
    }
    
    // Format data based on timeRange
    if (timeRange === '7days') {
      // Use daily data for the past week
      const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      labels = daysOfWeek.map(day => day.charAt(0));
      
      // Initialize with zeros
      data = [0, 0, 0, 0, 0, 0, 0];
      
      if (waterData.dailyIntake && Object.keys(waterData.dailyIntake).length > 0) {
        // Get today's date
        const today = new Date();
        const weekAgo = new Date();
        weekAgo.setDate(today.getDate() - 7);
        
        // Map intake data to days
        Object.entries(waterData.dailyIntake).forEach(([dateStr, amount]) => {
          try {
            const date = new Date(dateStr);
            
            // Only include data from the last 7 days
            if (date >= weekAgo && date <= today) {
            const dayIndex = date.getDay(); // 0 for Sunday, 6 for Saturday
            if (dayIndex >= 0 && dayIndex < 7) {
              // Convert to liters with proper rounding to 1 decimal place
              data[dayIndex] = parseFloat((Number(amount) / 1000).toFixed(1));
              }
            }
          } catch (err) {
            console.error('Error parsing date:', dateStr, err);
          }
        });
      }
    } else if (timeRange === '30days') {
      // Group data by week for 30 days view
      labels = ['W1', 'W2', 'W3', 'W4'];
      data = [0, 0, 0, 0];
      
      if (waterData.dailyIntake) {
        // Get today's date to calculate dates from past 30 days
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);
        
        // Group data into weeks
        Object.entries(waterData.dailyIntake).forEach(([dateStr, amount]) => {
          try {
            const date = new Date(dateStr);
            
            // Only include data from the last 30 days
            if (date >= thirtyDaysAgo && date <= today) {
              // Calculate days from thirty days ago
              const dayDiff = Math.floor((date.getTime() - thirtyDaysAgo.getTime()) / (24 * 60 * 60 * 1000));
              
              // Determine which week (0-3 for W1-W4)
              const weekIndex = Math.min(Math.floor(dayDiff / 7), 3);
              
              if (weekIndex >= 0 && weekIndex < 4) {
                // Add to the weekly total, convert to liters
                data[weekIndex] += Number(amount) / 1000;
              }
            }
          } catch (err) {
            console.error('Error parsing date for 30-day view:', dateStr, err);
          }
        });
        
        // Round each weekly value to 1 decimal place
        data = data.map(weeklyTotal => parseFloat(weeklyTotal.toFixed(1)));
      }
    } else { // 90days
      // Group data by month for 90 days view
      labels = ['Month 1', 'Month 2', 'Month 3'];
      data = [0, 0, 0];
      
      if (waterData.monthlyIntake) {
        // Use the monthly data if available
        Object.entries(waterData.monthlyIntake).forEach(([month, amount]) => {
          const monthIndex = parseInt(month) - 1; // Convert to 0-based index
          if (monthIndex >= 0 && monthIndex < 3) {
            // Convert to liters with proper rounding
            data[monthIndex] = parseFloat((Number(amount) / 1000).toFixed(1));
          }
        });
      } else if (waterData.dailyIntake) {
        // Get today's date to calculate dates from past 90 days
        const today = new Date();
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(today.getDate() - 90);
        
        // Group by month (roughly 30 days per month)
        Object.entries(waterData.dailyIntake).forEach(([dateStr, amount]) => {
          try {
            const date = new Date(dateStr);
            
            // Only include data from the last 90 days
            if (date >= ninetyDaysAgo && date <= today) {
              // Calculate days from ninety days ago
              const dayDiff = Math.floor((date.getTime() - ninetyDaysAgo.getTime()) / (24 * 60 * 60 * 1000));
              
              // Determine which month (0-2 for Month 1-3)
              const monthIndex = Math.min(Math.floor(dayDiff / 30), 2);
              
              if (monthIndex >= 0 && monthIndex < 3) {
                // Add to the monthly total, convert to liters
                data[monthIndex] += Number(amount) / 1000;
              }
            }
          } catch (err) {
            console.error('Error parsing date for 90-day view:', dateStr, err);
          }
        });
        
        // Round each monthly value to 1 decimal place
        data = data.map(monthlyTotal => parseFloat(monthlyTotal.toFixed(1)));
      }
    }
    
    // Determine the max value from the data for scaling, default to 1 if no data or all zeros
    maxValue = data.length > 0 ? Math.max(...data, 1) : 1;
    
    return { labels, data, maxValue };
  }, [timeRange, waterData]);
  
  const { labels: chartLabels, data: chartData, maxValue: calculatedMaxValue } = getFormattedWaterData();
  
  // Determine a reasonable Y-axis max value for scaling bars
  const yAxisMax = calculatedMaxValue > 0 ? Math.ceil(calculatedMaxValue / 0.5) * 0.5 : 1; // Round up to nearest 0.5L, default 1L

  // Calculate average consumption and daily goal
  const averageConsumption = waterData?.averageIntake ? (waterData.averageIntake / 1000).toFixed(1) : '0';
  const dailyGoal = waterData?.dailyGoal ? (waterData.dailyGoal / 1000).toFixed(1) : '3.5';
  const goalPercentage = waterData?.goalCompletionRate ? Math.round(waterData.goalCompletionRate) : 0;
  const waterStreak = waterData?.currentStreak || 0;
  
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(30, 42, 72, 0.8)', 'rgba(35, 37, 64, 0.95)']}
        style={[StyleSheet.absoluteFill, { borderRadius: borderRadius.lg }]}
      />
      
      {/* Header */}
      <View style={styles.header}>
        <MaterialCommunityIcons 
          name="water" 
          size={20} 
          color={WATER_COLOR_HIGHLIGHT} 
          style={styles.headerIcon}
        />
        <StyledText style={styles.title}>Water Intake</StyledText>
        
        {/* Streak badge */}
        {waterStreak > 0 && (
          <View style={styles.streakContainer}>
            <MaterialCommunityIcons name="fire" size={16} color="#FFA500" />
            <StyledText style={styles.streakText}>{waterStreak} Day Streak</StyledText>
          </View>
        )}
      </View>
      
      {/* Stats */}
      <Animated.View style={[styles.statsContainer, statsAnimStyle]}>
        <View style={styles.statItem}>
          <StyledText style={styles.statValue}>{averageConsumption}L</StyledText>
          <StyledText style={styles.statLabel}>Daily Average</StyledText>
        </View>
        
        <View style={styles.divider} />
        
        <View style={styles.statItem}>
          <StyledText style={styles.statValue}>{dailyGoal}L</StyledText>
          <StyledText style={styles.statLabel}>Daily Goal</StyledText>
        </View>
        
        <View style={styles.divider} />
        
        <View style={styles.statItem}>
          <StyledText style={styles.statValue}>{goalPercentage}%</StyledText>
          <StyledText style={styles.statLabel}>Goal Completion</StyledText>
        </View>
      </Animated.View>
      
      {/* Chart */}
      <Animated.View style={[styles.chartContainer, chartAnimStyle]}>
        {isLoading ? (
          <ActivityIndicator size="large" color={WATER_COLOR_LIGHT} style={{height: 200}} />
        ) : chartData && chartData.length > 0 ? (
          isSkiaActuallyAvailable && axisPaint && barPaint ? (
            <Canvas style={{ width: skiaChartWidth, height: skiaChartHeight }}>
              {/* Y-axis Line */}
              <Line
                p1={Skia.Point(chartPadding.left, chartPadding.top)}
                p2={Skia.Point(chartPadding.left, chartPadding.top + barAreaHeight)}
                paint={axisPaint}
              />
              {/* X-axis Line */}
              <Line
                p1={Skia.Point(chartPadding.left, chartPadding.top + barAreaHeight)}
                p2={Skia.Point(chartPadding.left + barAreaWidth, chartPadding.top + barAreaHeight)}
                paint={axisPaint}
              />

              {/* Bars */}
              {chartData.map((value, index) => {
                const barSlotWidth = barAreaWidth / chartData.length;
                const barActualWidth = barSlotWidth * 0.6; // Make bars narrower
                const barSpacing = (barSlotWidth - barActualWidth) / 2;

                const x = chartPadding.left + index * barSlotWidth + barSpacing;
                const normalizedValue = Math.max(0, value);
                const barHeight = (normalizedValue / yAxisMax) * barAreaHeight;
                const y = chartPadding.top + barAreaHeight - barHeight;

                if (barHeight > 0) {
                  return (
                    <Rect
                      key={`water-bar-${index}`}
                      x={x}
                      y={y}
                      width={barActualWidth}
                      height={barHeight}
                      paint={barPaint}
                    />
                  );
                }
                return null;
              })}
            </Canvas>
          ) : (
            // Fallback chart when Skia is not available
            <FallbackChart
              data={chartData}
              labels={chartLabels}
              title=""
              maxValue={yAxisMax}
              color={WATER_COLOR_LIGHT}
              height={skiaChartHeight}
            />
          )
        ) : (
          <View style={styles.noDataContainer}>
            <MaterialCommunityIcons name="chart-bar" size={32} color={colors.text.muted} />
            <StyledText variant="bodySmall" style={{ color: colors.text.muted, marginTop: spacing.sm }}>
              No water data available for this period.
            </StyledText>
          </View>
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
    ...shadows.large,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerIcon: {
    marginRight: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
    flex: 1,
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 165, 0, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  streakText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFA500',
    marginLeft: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  divider: {
    width: 1,
    height: '70%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignSelf: 'center',
  },
  chartContainer: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  noDataContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
});

export default WaterTrackingProgress; 