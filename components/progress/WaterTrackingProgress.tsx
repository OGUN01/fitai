import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity, ViewStyle, TextStyle } from 'react-native';
import { BarChart } from 'react-native-chart-kit';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows } from '../../theme/theme';
import StyledText from '../ui/StyledText';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, Easing } from 'react-native-reanimated';
import Svg, { Circle, Path, G } from 'react-native-svg';

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
  const chartWidth = screenWidth - (spacing.md * 2) - 16; // Adjust for padding
  
  // Format data for charts based on time range
  const formatWaterData = () => {
    // Default empty data
    let labels: string[] = [];
    let data: number[] = [];
    
    if (!waterData) {
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
      return { labels, data };
    }
    
    // Format data based on timeRange
    if (timeRange === '7days') {
      // Use daily data for the past week
      const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      labels = daysOfWeek.map(day => day.charAt(0));
      
      // Initialize with zeros
      data = [0, 0, 0, 0, 0, 0, 0];
      
      if (waterData.dailyIntake && Object.keys(waterData.dailyIntake).length > 0) {
        // Map intake data to days
        Object.entries(waterData.dailyIntake).forEach(([dateStr, amount]) => {
          try {
            const date = new Date(dateStr);
            const dayIndex = date.getDay(); // 0 for Sunday, 6 for Saturday
            if (dayIndex >= 0 && dayIndex < 7) {
              // Convert to liters with proper rounding to 1 decimal place
              data[dayIndex] = parseFloat((Number(amount) / 1000).toFixed(1));
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
    
    return { labels, data };
  };
  
  // Calculate average water intake
  const calculateAverageIntake = (): number => {
    if (!waterData) return 0;
    
    let totalIntake = 0;
    let daysWithData = 0;
    
    if (waterData.dailyIntake) {
      Object.values(waterData.dailyIntake).forEach(amount => {
        totalIntake += Number(amount);
        daysWithData++;
      });
    }
    
    if (daysWithData === 0) return 0;
    
    // Return average in liters, rounded to 1 decimal place
    return parseFloat((totalIntake / daysWithData / 1000).toFixed(1));
  };
  
  // Calculate completion percentage against daily goal
  const calculateCompletionPercentage = (): number => {
    if (!waterData || !waterData.dailyGoal || waterData.dailyGoal <= 0) {
      return 0;
    }
    
    const avgIntake = calculateAverageIntake() * 1000; // Convert back to ml
    const percentage = (avgIntake / waterData.dailyGoal) * 100;
    
    // Cap at 100% for display purposes
    return Math.min(Math.round(percentage), 100);
  };
  
  // Calculate the streak of meeting water goals
  const calculateWaterStreak = (): number => {
    if (!waterData || !waterData.dailyIntake || !waterData.dailyGoal) {
      return 0;
    }
    
    // Default to the API value if available
    if (waterData.currentStreak !== undefined) {
      return waterData.currentStreak;
    }
    
    // Otherwise calculate it manually
    let streak = 0;
    const sortedDates = Object.entries(waterData.dailyIntake)
      .sort(([dateA], [dateB]) => new Date(dateB).getTime() - new Date(dateA).getTime());
    
    for (const [date, amount] of sortedDates) {
      if (Number(amount) >= waterData.dailyGoal) {
        streak++;
      } else {
        break; // Stop counting once we hit a day where goal wasn't met
      }
    }
    
    return streak;
  };
  
  // Best and worst days for 30-day view
  const findBestAndWorstDays = () => {
    if (!waterData || !waterData.dailyIntake) {
      return { best: null, worst: null };
    }
    
    // Get today's date to calculate dates from past 30 days
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    let bestDay = { date: '', amount: 0 };
    let worstDay = { date: '', amount: Infinity };
    let hasData = false;
    
    Object.entries(waterData.dailyIntake).forEach(([dateStr, amount]) => {
      try {
        const date = new Date(dateStr);
        
        // Only consider data from the last 30 days
        if (date >= thirtyDaysAgo && date <= today) {
          const numAmount = Number(amount);
          hasData = true;
          
          if (numAmount > bestDay.amount) {
            bestDay = { date: dateStr, amount: numAmount };
          }
          
          // Only consider days with actual water data (> 0) for worst day
          if (numAmount < worstDay.amount && numAmount > 0) {
            worstDay = { date: dateStr, amount: numAmount };
          }
        }
      } catch (err) {
        console.error('Error parsing date:', dateStr, err);
      }
    });
    
    // If no actual data was found in the last 30 days, return null
    if (!hasData) {
      return { best: null, worst: null };
    }
    
    // Format the results, ensuring proper rounding to 1 decimal place
    return {
      best: bestDay.amount > 0 ? {
        day: getDayOfWeek(new Date(bestDay.date)),
        date: formatDate(new Date(bestDay.date), 'MMM d'),
        amount: parseFloat((bestDay.amount / 1000).toFixed(1)).toString()
      } : null,
      worst: worstDay.amount < Infinity ? {
        day: getDayOfWeek(new Date(worstDay.date)),
        date: formatDate(new Date(worstDay.date), 'MMM d'),
        amount: parseFloat((worstDay.amount / 1000).toFixed(1)).toString()
      } : null
    };
  };
  
  // Achievement badges for 90-day view
  const calculateAchievements = () => {
    if (!waterData) return [];
    
    const achievements = [];
    
    // Streak achievement
    const streak = calculateWaterStreak();
    if (streak >= 3) {
      achievements.push({
        type: 'streak',
        title: `${streak} Day Streak`,
        description: 'Consecutive days meeting your water goal',
        icon: BADGE_ICONS.streak as BadgeIconType,
        color: '#FF9500'
      });
    }
    
    // Goal achievement
    const completionPercentage = calculateCompletionPercentage();
    if (completionPercentage >= 80) {
      achievements.push({
        type: 'goal',
        title: 'Goal Crusher',
        description: `Averaging ${completionPercentage}% of your daily goal`,
        icon: BADGE_ICONS.goal as BadgeIconType,
        color: '#30D158'
      });
    }
    
    // Consistency achievement (dummy for now)
    if (waterData.dailyIntake && Object.keys(waterData.dailyIntake).length > 20) {
      achievements.push({
        type: 'consistency',
        title: 'Consistency King',
        description: 'Tracked water for 20+ days',
        icon: BADGE_ICONS.consistency as BadgeIconType,
        color: '#5E5CE6'
      });
    }
    
    return achievements;
  };
  
  // Chart configuration
  const chartConfig = {
    backgroundGradientFrom: WATER_COLOR_DARK,
    backgroundGradientTo: WATER_COLOR_LIGHT,
    decimalPlaces: 1, // Ensure only 1 decimal place is shown
    color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    barPercentage: 0.7,
    propsForBackgroundLines: {
      strokeDasharray: "", 
    },
    propsForLabels: {
      fontSize: 10,
      fontWeight: '600',
    },
    // Format y-axis values to prevent strange numbers
    formatYLabel: (yValue: string) => {
      const value = parseFloat(yValue);
      return value.toFixed(1);
    },
    // Format top of bar values
    formatTopValue: (value: number) => {
      return value.toFixed(1);
    }
  };
  
  // Format title based on time range
  const renderTitle = () => {
    let title = 'Daily Water Intake';
    let icon: WaterIcon = 'water';
    
    if (timeRange === '30days') {
      title = 'Weekly Water Intake';
      icon = 'calendar-week';
    } else if (timeRange === '90days') {
      title = 'Monthly Water Intake';
      icon = 'calendar-month';
    }
    
    return (
      <View style={styles.titleContainer}>
        <MaterialCommunityIcons name={icon} size={22} color="#5CE1E6" />
        <StyledText style={styles.cardTitle}>{title}</StyledText>
      </View>
    );
  };

  // Render water statistics
  const renderWaterStats = () => {
    const formattedData = formatWaterData();
    
    // For 7-day view, show average and streak
    if (timeRange === '7days') {
      const avgIntake = calculateAverageIntake();
      const goalCompletion = calculateCompletionPercentage();
      const streak = calculateWaterStreak();
      
      return (
        <Animated.View style={[styles.statsContainer, statsAnimStyle]}>
          <View style={styles.statItem}>
            <StyledText style={styles.statValue}>
              {avgIntake.toFixed(1)}L
            </StyledText>
            <StyledText style={styles.statLabel}>Daily Average</StyledText>
          </View>
          
          <View style={styles.statDivider} />
          
          <View style={styles.statItem}>
            <StyledText style={styles.statValue}>
              {goalCompletion}%
            </StyledText>
            <StyledText style={styles.statLabel}>Goal Completion</StyledText>
          </View>
          
          <View style={styles.statDivider} />
          
          <View style={styles.statItem}>
            <StyledText style={styles.statValue}>
              {streak}
            </StyledText>
            <StyledText style={styles.statLabel}>Day Streak</StyledText>
          </View>
        </Animated.View>
      );
    }
    
    // For 30-day view, show best and worst days
    else if (timeRange === '30days') {
      const { best, worst } = findBestAndWorstDays();
      
      return (
        <Animated.View style={[styles.statsContainer, statsAnimStyle]}>
          {best && (
            <View style={styles.dayStatItem}>
              <View style={styles.dayStatHeader}>
                <MaterialCommunityIcons name="thumb-up" size={16} color="#30D158" />
                <StyledText style={styles.dayStatTitle}>
                  Best Day
                </StyledText>
              </View>
              <StyledText style={styles.dayStatDay}>{best.day}</StyledText>
              <StyledText style={styles.dayStatDate}>{best.date}</StyledText>
              <StyledText style={styles.dayStatAmount}>{best.amount}L</StyledText>
            </View>
          )}
          
          <View style={styles.statDivider} />
          
          {worst && (
            <View style={styles.dayStatItem}>
              <View style={styles.dayStatHeader}>
                <MaterialCommunityIcons name="thumb-down" size={16} color="#FF453A" />
                <StyledText style={styles.dayStatTitle}>
                  Needs Improvement
                </StyledText>
              </View>
              <StyledText style={styles.dayStatDay}>{worst.day}</StyledText>
              <StyledText style={styles.dayStatDate}>{worst.date}</StyledText>
              <StyledText style={styles.dayStatAmount}>{worst.amount}L</StyledText>
            </View>
          )}
        </Animated.View>
      );
    } 
    
    // For 90-day view, show achievements
    else {
      const achievements = calculateAchievements();
      
      return (
        <Animated.View style={[styles.achievementsContainer, statsAnimStyle]}>
          {achievements.map((achievement, index) => (
            <View key={index} style={styles.achievementBadge}>
              <View 
                style={[styles.badgeIconContainer, { backgroundColor: achievement.color }]}
              >
                <MaterialCommunityIcons 
                  name={achievement.icon}
                  size={20} 
                  color="white" 
                />
              </View>
              <View style={styles.badgeContent}>
                <StyledText style={styles.badgeTitle}>
                  {achievement.title}
                </StyledText>
                <StyledText style={styles.badgeDescription}>
                  {achievement.description}
                </StyledText>
              </View>
            </View>
          ))}
          
          {achievements.length === 0 && (
            <View style={styles.noAchievementsContainer}>
              <MaterialCommunityIcons 
                name="trophy-outline"
                size={40} 
                color="rgba(255, 255, 255, 0.3)" 
              />
              <StyledText style={styles.noAchievementsText}>
                Keep tracking your water intake to earn achievements!
              </StyledText>
            </View>
          )}
        </Animated.View>
      );
    }
  };
  
  // Main render
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(22, 40, 60, 0.98)', 'rgba(16, 30, 50, 0.95)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: borderRadius.lg }]}
      />
      
      <View style={styles.header}>
        {renderTitle()}
      </View>
      
      <Animated.View style={[styles.chartContainer, chartAnimStyle]}>
        <BarChart
          data={{
            labels: formatWaterData().labels,
            datasets: [
              {
                data: formatWaterData().data,
              },
            ],
          }}
          width={chartWidth}
          height={180}
          chartConfig={chartConfig}
          fromZero
          showValuesOnTopOfBars
          withInnerLines={false}
          showBarTops={false}
          withHorizontalLabels={true}
          segments={4}
          yAxisLabel=""
          yAxisSuffix="L"
          style={{ 
            borderRadius: borderRadius.md,
            marginVertical: spacing.xs,
          }}
        />
      </Animated.View>
      
      {renderWaterStats()}
    </View>
  );
};

// Component styles
const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    position: 'relative',
    ...shadows.large,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: spacing.sm,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  chartContainer: {
    alignItems: 'center',
    paddingBottom: spacing.sm,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    marginTop: spacing.xs,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    color: WATER_COLOR_HIGHLIGHT,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: EXTRA_SMALL_SPACING,
  },
  statLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: '80%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignSelf: 'center',
  },
  dayStatItem: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.sm,
  },
  dayStatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  dayStatTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginLeft: EXTRA_SMALL_SPACING,
    color: '#30D158',
  },
  dayStatDay: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  dayStatDate: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    marginVertical: EXTRA_SMALL_SPACING,
  },
  dayStatAmount: {
    color: WATER_COLOR_HIGHLIGHT,
    fontSize: 18,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  achievementsContainer: {
    padding: spacing.md,
  },
  achievementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  badgeIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.small,
  },
  badgeContent: {
    marginLeft: spacing.sm,
    flex: 1,
  },
  badgeTitle: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: EXTRA_SMALL_SPACING,
  },
  badgeDescription: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
  },
  noAchievementsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  noAchievementsText: {
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
    marginTop: spacing.sm,
    fontSize: 14,
  },
});

export default WaterTrackingProgress; 