import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { Text, Avatar, Chip } from 'react-native-paper';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows } from '../../theme/theme';
import { FadeIn, SlideIn, ScaleIn, Pulse } from '../animations';
import StyledText from '../ui/StyledText';
import WaterTrackingCard from './WaterTrackingCard';

// TypeScript interfaces
interface UserStats {
  name: string;
  goal: string;
  progress: {
    currentWeight: string;
    startWeight: string;
    targetWeight: string;
    percentComplete: number;
  };
}

interface WorkoutStats {
  scheduledForToday: boolean;
  todayCompleted: boolean;
  todayWorkoutName: string;
  focusArea?: string | null;
  bodyParts?: string[];
  dayStreak: number;
}

interface MealItem {
  name: string;
  completed: boolean;
  time?: string;
}

interface MealStats {
  allCompleted: boolean;
  pendingMeals: string[];
  mealDetails?: Record<string, MealItem>;
}

interface NextWorkout {
  day: string;
  name: string;
  daysUntil: number;
}

interface EnhancedHomeScreenProps {
  userStats: UserStats;
  workoutStats: WorkoutStats;
  mealStats: MealStats;
  nextWorkout: NextWorkout | null;
  motivationalQuote: string;
  onRefreshQuote: () => void;
  isRefreshingQuote?: boolean;
  bodyAnalysis?: any; // Body analysis data
  activitySummary?: {
    workouts: { count: number, percentage: number, isRestDay?: boolean },
    meals: { count: number, percentage: number },
    progress: { percentage: number }
  };
}

const SCREEN_WIDTH = Dimensions.get('window').width;

/**
 * EnhancedHomeScreen - Modern fitness app design with circular progress indicators and body analysis
 */
const EnhancedHomeScreen: React.FC<EnhancedHomeScreenProps> = ({
  userStats,
  workoutStats,
  mealStats,
  nextWorkout,
  motivationalQuote,
  onRefreshQuote,
  isRefreshingQuote = false,
  bodyAnalysis,
  activitySummary
}) => {
  // Get time of day for greeting
  const getTimeOfDay = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';
    return 'evening';
  };

  // Generate weekly calendar with indicators
  const renderWeeklyCalendar = () => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const today = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.
    const adjustedToday = today === 0 ? 6 : today - 1; // Convert to 0 = Monday, 6 = Sunday
    
    return (
      <View style={styles.calendarContainer}>
        {days.map((day, index) => (
          <View 
            key={day} 
            style={[
              styles.calendarDay,
              adjustedToday === index && styles.todayContainer
            ]}
          >
            <Text style={[
              styles.calendarDayText,
              adjustedToday === index && styles.todayText
            ]}>
              {day}
            </Text>
            <View style={[
              styles.calendarIndicator,
              adjustedToday === index && styles.todayIndicator,
              // Sample data - in production, this would be based on actual workout/nutrition data
              index % 2 === 0 && styles.completedIndicator
            ]} />
          </View>
        ))}
      </View>
    );
  };

  // Render circular progress chart for weight tracking
  const renderWeightProgressChart = () => {
    const progress = userStats.progress.percentComplete / 100;
    const size = 120;
    const strokeWidth = 12;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDashoffset = circumference * (1 - progress);
    
    return (
      <View style={styles.weightProgressContainer}>
        <View style={styles.progressChartContainer}>
          <Svg width={size} height={size}>
            {/* Background Circle */}
            <Circle
              stroke="rgba(255, 255, 255, 0.1)"
              fill="none"
              cx={size / 2}
              cy={size / 2}
              r={radius}
              strokeWidth={strokeWidth}
            />
            {/* Progress Circle */}
            <AnimatedCircle
              stroke={colors.primary.main}
              fill="none"
              cx={size / 2}
              cy={size / 2}
              r={radius}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
            />
          </Svg>
          <View style={styles.progressTextContainer}>
            <Text style={styles.progressPercentText}>{userStats.progress.percentComplete}%</Text>
            <Text style={styles.progressLabel}>to goal</Text>
          </View>
        </View>
        
        <View style={styles.weightInfoContainer}>
          <View style={styles.weightInfoItem}>
            <Text style={styles.weightInfoLabel}>Current</Text>
            <Text style={styles.weightInfoValue}>{userStats.progress.currentWeight}kg</Text>
          </View>
          <View style={styles.weightInfoItem}>
            <Text style={styles.weightInfoLabel}>Target</Text>
            <Text style={styles.weightInfoValue}>{userStats.progress.targetWeight}kg</Text>
          </View>
        </View>
      </View>
    );
  };

  // Render circular activity summary
  const renderActivitySummary = () => {
    // Use activitySummary data if available, otherwise use derived data
    const activities = [
      { 
        label: 'Workouts', 
        percent: activitySummary?.workouts.percentage ?? 
          (workoutStats.dayStreak > 0 ? 80 : 0), 
        isRestDay: activitySummary?.workouts.isRestDay ?? false,
        color: colors.primary.main 
      },
      { 
        label: 'Meals', 
        percent: activitySummary?.meals.percentage ??
          (mealStats.allCompleted ? 100 : mealStats.pendingMeals.length === 1 ? 66 : mealStats.pendingMeals.length === 2 ? 33 : 0), 
        color: colors.secondary.main 
      },
      { 
        label: 'Progress', 
        percent: activitySummary?.progress?.percentage ?? userStats.progress.percentComplete, 
        color: colors.accent.lavender 
      }
    ];

    return (
      <View style={styles.activitySummaryContainer}>
        <View style={styles.activityHeader}>
          <MaterialCommunityIcons name="poll" size={22} color={colors.primary.main} />
          <Text style={styles.activityHeaderText}>Activity Summary</Text>
        </View>
        
        <View style={styles.activityRowContainer}>
          {activities.map((activity, index) => (
            <View key={index} style={styles.activityItem}>
              <View style={styles.activityCircleContainer}>
                {activity.isRestDay ? (
                  // Display Rest Day indicator for workout rest days
                  <>
                    <Svg width={60} height={60}>
                      {/* Background Circle */}
                      <Circle
                        stroke="rgba(255, 255, 255, 0.1)"
                        fill="none"
                        cx={30}
                        cy={30}
                        r={25}
                        strokeWidth={4}
                      />
                      {/* Dashed Circle for Rest Day */}
                      <Circle
                        stroke={activity.color}
                        fill="none"
                        cx={30}
                        cy={30}
                        r={25}
                        strokeWidth={4}
                        strokeDasharray="5,5"
                      />
                    </Svg>
                    <Text style={styles.activityRestText}>Rest</Text>
                  </>
                ) : (
                  // Normal percentage circle
                  <>
                <Svg width={60} height={60}>
                  {/* Background Circle */}
                  <Circle
                    stroke="rgba(255, 255, 255, 0.1)"
                    fill="none"
                    cx={30}
                    cy={30}
                    r={25}
                    strokeWidth={4}
                  />
                  {/* Progress Circle */}
                  <Circle
                    stroke={activity.color}
                    fill="none"
                    cx={30}
                    cy={30}
                    r={25}
                    strokeWidth={4}
                    strokeDasharray={25 * 2 * Math.PI}
                    strokeDashoffset={25 * 2 * Math.PI * (1 - activity.percent / 100)}
                    strokeLinecap="round"
                  />
                </Svg>
                <Text style={styles.activityPercentText}>{activity.percent}%</Text>
                  </>
                )}
              </View>
              <Text style={styles.activityLabel}>{activity.label}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  // Render body analysis summary card
  const renderBodyAnalysisSummary = () => {
    // Helper function to check if body analysis is actually complete
    const isBodyAnalysisComplete = () => {
      if (!bodyAnalysis) return false;
      
      // We need at least body_fat_percentage or body_type to consider it complete
      const hasRequiredData = 
        (bodyAnalysis.body_fat_percentage || (bodyAnalysis as any).bodyFatEstimate) && 
        (bodyAnalysis.body_type || (bodyAnalysis as any).bodyType);
      
      // Check if the data is legitimate or just defaults
      const height = bodyAnalysis.height_cm || (bodyAnalysis as any).height;
      const weight = bodyAnalysis.weight_kg || (bodyAnalysis as any).weight;
      
      // Need both height and weight PLUS at least one more measurement
      return !!height && !!weight && hasRequiredData;
    };
    
    // If no body analysis data available or it's incomplete, show prompt card
    if (!isBodyAnalysisComplete()) {
      return (
        <TouchableOpacity 
          style={styles.bodyAnalysisCard}
          onPress={() => router.push('/(onboarding)/body-analysis?returnToProgress=true')}
        >
          <LinearGradient
            colors={['rgba(40, 40, 70, 0.8)', 'rgba(30, 30, 50, 0.95)']}
            style={[StyleSheet.absoluteFill, {borderRadius: borderRadius.lg}]}
          />
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardIcon}>
              <Ionicons name="body-outline" size={24} color="white" />
            </View>
            <Text style={styles.cardTitleWhite}>Body Analysis</Text>
          </View>
          
          <View style={styles.bodyPromptContainer}>
            <Text style={styles.bodyPromptText}>Complete your body analysis to unlock personalized insights</Text>
            <View style={styles.bodyPromptButton}>
              <LinearGradient 
                colors={[colors.primary.main, colors.primary.dark]}
                style={styles.promptButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.promptButtonText}>Start Analysis</Text>
              </LinearGradient>
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    // If body analysis data exists, show the data
    return (
      <TouchableOpacity 
        style={styles.bodyAnalysisCard}
        onPress={() => router.push('/(tabs)/progress/body-details')}
      >
        <LinearGradient
          colors={[colors.accent.purple || '#9932CC', colors.primary.dark]}
          style={[StyleSheet.absoluteFill, {borderRadius: borderRadius.lg}]}
        />
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardIcon}>
            <Ionicons name="body-outline" size={24} color="white" />
          </View>
          <Text style={styles.cardTitleWhite}>Body Analysis</Text>
        </View>
        
        <View style={styles.bodyMetricsContainer}>
          <View style={styles.bodyMetricItem}>
            <MaterialCommunityIcons name="human-male-height" size={22} color="#FFFFFF" />
            <Text style={styles.bodyMetricLabel}>Height</Text>
            <Text style={styles.bodyMetricValue}>{Math.round(bodyAnalysis.height_cm || (bodyAnalysis as any).height || 0)} cm</Text>
          </View>
          
          <View style={styles.bodyMetricItem}>
            <MaterialCommunityIcons name="scale" size={22} color="#FFFFFF" />
            <Text style={styles.bodyMetricLabel}>Weight</Text>
            <Text style={styles.bodyMetricValue}>{Math.round(bodyAnalysis.weight_kg || (bodyAnalysis as any).weight || 0)} kg</Text>
          </View>
          
          <View style={styles.bodyMetricItem}>
            <MaterialCommunityIcons name="percent" size={22} color="#FFFFFF" />
            <Text style={styles.bodyMetricLabel}>Body Fat</Text>
            <Text style={styles.bodyMetricValue}>{bodyAnalysis.body_fat_percentage ? parseFloat(bodyAnalysis.body_fat_percentage.toString()).toFixed(1) : "N/A"}%</Text>
          </View>
          
          <View style={styles.bodyMetricItem}>
            <MaterialCommunityIcons name="human" size={22} color="#FFFFFF" />
            <Text style={styles.bodyMetricLabel}>Type</Text>
            <Text style={styles.bodyMetricValue}>{bodyAnalysis.body_type || (bodyAnalysis as any).bodyType || "N/A"}</Text>
          </View>
        </View>
        
        <TouchableOpacity 
          style={styles.bodyDetailsButton}
          onPress={() => router.push('/(tabs)/progress/body-details')}
        >
          <Text style={styles.bodyDetailsButtonText}>View Full Details</Text>
          <Ionicons name="chevron-forward" size={16} color="white" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  // Render today's workout card
  const renderTodayWorkout = () => {
    if (!nextWorkout) {
      // No workout plan generated
      return (
        <View style={styles.workoutCard}>
          <View style={styles.workoutCardHeader}>
            <StyledText variant="headingMedium" style={styles.workoutCardTitle}>
              Today's Workout
            </StyledText>
            <TouchableOpacity
              style={styles.viewWorkoutsButton}
              onPress={() => router.push('/(tabs)/workout')}
            >
              <StyledText variant="bodySmall" style={styles.viewAllText}>
                View All
              </StyledText>
            </TouchableOpacity>
          </View>
          
          <View style={styles.noWorkoutContainer}>
            <StyledText variant="bodyLarge" style={styles.noWorkoutText}>
              No workout plan generated yet.
            </StyledText>
            <TouchableOpacity 
              style={styles.createPlanButton}
              onPress={() => router.push('/(tabs)/workout')}
            >
              <LinearGradient
                colors={[colors.primary.main, colors.primary.dark]}
                style={styles.workoutButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <StyledText variant="bodyMedium" style={styles.workoutButtonText}>
                  Create Plan
                </StyledText>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    const { scheduledForToday, todayWorkoutName, focusArea, todayCompleted } = workoutStats;
    
    return (
      <View style={styles.todayCard}>
        <LinearGradient
          colors={['rgba(40, 40, 70, 0.8)', 'rgba(30, 30, 50, 0.95)']}
          style={[StyleSheet.absoluteFill, {borderRadius: borderRadius.lg}]}
        />
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardIcon}>
            <Ionicons name="fitness-outline" size={24} color={colors.primary.main} />
          </View>
          <Text style={styles.cardTitle}>Today's Workout</Text>
          
          {workoutStats.todayCompleted && (
            <Chip 
              icon="check-circle" 
              style={[styles.statusChip, { backgroundColor: colors.accent.green }]}
            >
              Done
            </Chip>
          )}
        </View>
        
        <View style={styles.workoutContentContainer}>
          {workoutStats.scheduledForToday ? (
            <>
              <View style={styles.workoutIconContainer}>
                <View style={styles.workoutIconBackground}>
                  <Ionicons name="barbell-outline" size={36} color={colors.primary.main} />
                </View>
              </View>
              
              <View style={styles.workoutInfoContainer}>
                {workoutStats.focusArea ? (
                  <Text style={styles.workoutFocusArea}>
                    {workoutStats.focusArea}
                  </Text>
                ) : (
                  <Text style={styles.workoutFocusArea}>
                    {getFocusAreaFromWorkout(workoutStats.todayWorkoutName)}
                  </Text>
                )}
                <Text style={styles.workoutName}>{workoutStats.todayWorkoutName}</Text>
                <Text style={styles.workoutDescription}>Ready for your daily workout session?</Text>
                
                {!workoutStats.todayCompleted && (
                  <TouchableOpacity 
                    style={styles.startButton}
                    onPress={() => router.push('/(tabs)/workout')}
                  >
                    <LinearGradient
                      colors={[colors.primary.main, colors.primary.dark]}
                      style={styles.startButtonGradient}
                    >
                      <Text style={styles.startButtonText}>Start Workout</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </View>
            </>
          ) : (
            <View style={styles.restDayContainer}>
              <View style={styles.restDayIconContainer}>
                <Ionicons name="bed-outline" size={36} color={colors.accent.lavender} />
              </View>
              <Text style={styles.restDayText}>Rest Day</Text>
              <Text style={styles.restDaySubtext}>
                Next workout: {nextWorkout?.name} in {nextWorkout?.daysUntil} day{nextWorkout?.daysUntil !== 1 ? 's' : ''}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  // Main render
  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Top Gradient */}
      <LinearGradient
        colors={[colors.primary.dark, colors.background.primary]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.25 }}
      />
      
      {/* Header with Profile & Greeting */}
      <View style={styles.header}>
        <FadeIn from={0} duration={800}>
          <View style={styles.greetingContainer}>
            <Text style={styles.greeting}>Good {getTimeOfDay()},</Text>
            <Text style={styles.userName}>{userStats.name}</Text>
          </View>
        </FadeIn>
        
        <ScaleIn duration={800} delay={300}>
          <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}>
            <LinearGradient
              colors={[colors.primary.main, colors.secondary.main]}
              style={styles.profileGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Avatar.Text 
                size={40} 
                label={userStats.name.split(' ').map((n: string) => n[0]).join('')} 
                style={styles.avatar}
                labelStyle={styles.avatarLabel}
              />
            </LinearGradient>
          </TouchableOpacity>
        </ScaleIn>
      </View>
      
      {/* Day Streak Badge - Use Pulse animation for visual emphasis */}
      {workoutStats.dayStreak > 0 && (
        <ScaleIn duration={800} delay={400}>
          <Pulse duration={2000}>
            <View style={styles.streakContainer}>
              <LinearGradient
                colors={[colors.accent.gold, '#FFA000']}
                style={styles.streakGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Ionicons name="flame" size={20} color="#FFF" />
                <Text style={styles.streakText}>
                  {workoutStats.dayStreak} day{workoutStats.dayStreak !== 1 ? 's' : ''} streak!
                </Text>
              </LinearGradient>
            </View>
          </Pulse>
        </ScaleIn>
      )}
      
      {/* Weekly Calendar with Activity Indicators */}
      <SlideIn distance={30} direction="right" duration={800} delay={200}>
        <View style={styles.sectionCard}>
          <LinearGradient
            colors={['rgba(40, 40, 70, 0.8)', 'rgba(30, 30, 50, 0.95)']}
            style={[StyleSheet.absoluteFill, {borderRadius: borderRadius.lg}]}
          />
          {renderWeeklyCalendar()}
        </View>
      </SlideIn>
      
      {/* Activity Summary with Circular Progress */}
      <FadeIn from={0} duration={800} delay={300}>
        <View style={styles.sectionCard}>
          <LinearGradient
            colors={['rgba(40, 40, 70, 0.8)', 'rgba(30, 30, 50, 0.95)']}
            style={[StyleSheet.absoluteFill, {borderRadius: borderRadius.lg}]}
          />
          {renderActivitySummary()}
        </View>
      </FadeIn>
      
      {/* Water Tracking Card */}
      <WaterTrackingCard />
      
      {/* Today's Workout Card with Circular Progress */}
      <SlideIn distance={30} direction="left" duration={800} delay={400}>
        {renderTodayWorkout()}
      </SlideIn>
      
      {/* Meal Tracking Card */}
      <SlideIn distance={30} direction="right" duration={800} delay={500}>
        <View style={styles.todayCard}>
          <LinearGradient
            colors={['rgba(40, 40, 70, 0.8)', 'rgba(30, 30, 50, 0.95)']}
            style={[StyleSheet.absoluteFill, {borderRadius: borderRadius.lg}]}
          />
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardIcon}>
              <Ionicons name="restaurant-outline" size={24} color={colors.secondary.main} />
            </View>
            <Text style={styles.cardTitle}>Nutrition</Text>
            
            {mealStats.allCompleted && (
              <Chip 
                icon="check-circle" 
                style={[styles.statusChip, { backgroundColor: colors.accent.green }]}
              >
                Done
              </Chip>
            )}
          </View>
          
          <View style={styles.mealsContainer}>
            {mealStats.pendingMeals.length > 0 ? (
              <>
                <View style={styles.mealProgressContainer}>
                  <View style={styles.mealProgressBar}>
                    <LinearGradient
                      colors={[colors.secondary.main, colors.secondary.light]}
                      style={[
                        styles.mealProgressFill,
                        { width: `${100 - (mealStats.pendingMeals.length / 3) * 100}%` }
                      ]}
                    />
                  </View>
                  <Text style={styles.mealProgressText}>
                    {3 - mealStats.pendingMeals.length}/3 meals logged
                  </Text>
                </View>
                
                <View style={styles.pendingMealsContainer}>
                  <Text style={styles.pendingMealsTitle}>Pending meals:</Text>
                  <View style={styles.mealChipsContainer}>
                    {/* Use mealDetails directly for accurate meal names and times */}
                    {!mealStats.mealDetails?.breakfast?.completed && (
                      <Chip
                        key="breakfast"
                        style={styles.mealChip}
                        textStyle={styles.mealChipText}
                        onPress={() => router.push('/(tabs)/nutrition')}
                      >
                        Breakfast ({mealStats.mealDetails?.breakfast?.time || "08:00 AM"})
                      </Chip>
                    )}
                    {!mealStats.mealDetails?.lunch?.completed && (
                      <Chip
                        key="lunch"
                        style={styles.mealChip}
                        textStyle={styles.mealChipText}
                        onPress={() => router.push('/(tabs)/nutrition')}
                      >
                        Lunch ({mealStats.mealDetails?.lunch?.time || "12:30 PM"})
                      </Chip>
                    )}
                    {!mealStats.mealDetails?.dinner?.completed && (
                      <Chip
                        key="dinner"
                        style={styles.mealChip}
                        textStyle={styles.mealChipText}
                        onPress={() => router.push('/(tabs)/nutrition')}
                      >
                        Dinner ({mealStats.mealDetails?.dinner?.time || "07:00 PM"})
                      </Chip>
                    )}
                  </View>
                </View>
                
                <TouchableOpacity 
                  style={styles.logMealButton}
                  onPress={() => router.push('/(tabs)/nutrition')}
                >
                  <LinearGradient
                    colors={[colors.secondary.main, colors.secondary.dark]}
                    style={styles.logMealButtonGradient}
                  >
                    <Text style={styles.logMealButtonText}>Log Meal</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.allMealsContainer}>
                <View style={styles.allMealsCompletedIcon}>
                  <Ionicons name="checkmark-circle" size={40} color={colors.accent.green} />
                </View>
                <Text style={styles.allMealsCompletedText}>All meals logged for today!</Text>
                <TouchableOpacity 
                  style={styles.viewMealsButton}
                  onPress={() => router.push('/(tabs)/nutrition')}
                >
                  <Text style={styles.viewMealsButtonText}>View Nutrition Plan</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </SlideIn>
      
      {/* Body Analysis Summary - Moved to second-to-last position */}
      <FadeIn from={0} duration={800} delay={600}>
        {renderBodyAnalysisSummary()}
      </FadeIn>
      
      {/* Motivational Quote Card */}
      <SlideIn distance={30} direction="up" duration={800} delay={700}>
        <View style={styles.quoteCard}>
          <LinearGradient
            colors={[colors.secondary.dark, colors.secondary.main]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, {borderRadius: borderRadius.lg}]}
          />
          <View style={styles.quoteCardContent}>
            <View style={styles.quoteIconContainer}>
              <Ionicons name="chatbubble-ellipses-outline" size={40} color="rgba(255,255,255,0.3)" />
            </View>
            <Text style={styles.quoteText}>"{motivationalQuote}"</Text>
            <TouchableOpacity 
              style={styles.refreshButton} 
              onPress={onRefreshQuote}
              disabled={isRefreshingQuote}
            >
              <Ionicons 
                name="refresh-outline" 
                size={20} 
                color="white"
                style={{
                  opacity: isRefreshingQuote ? 0.5 : 1,
                  transform: [{ rotate: isRefreshingQuote ? '45deg' : '0deg' }]
                }}
              />
            </TouchableOpacity>
          </View>
        </View>
      </SlideIn>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: 120, // Extra padding for floating tab bar
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  greetingContainer: {
    flexDirection: 'column',
  },
  greeting: {
    fontSize: 16,
    color: colors.text.secondary,
    fontWeight: '400',
  },
  userName: {
    fontSize: 24,
    color: colors.text.primary,
    fontWeight: 'bold',
  },
  profileGradient: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.round,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    backgroundColor: colors.background.primary,
  },
  avatarLabel: {
    color: colors.text.primary,
  },
  streakContainer: {
    alignSelf: 'flex-start',
    marginBottom: spacing.md,
  },
  streakGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  streakText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: 'rgba(40, 40, 70, 0.8)',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.medium,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginLeft: spacing.sm,
  },
  calendarContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  calendarDay: {
    alignItems: 'center',
    width: (SCREEN_WIDTH - spacing.md * 2 - spacing.md * 2) / 7,
  },
  calendarDayText: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  calendarIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  todayContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: borderRadius.sm,
    paddingVertical: 4,
  },
  todayText: {
    color: colors.text.primary,
    fontWeight: 'bold',
  },
  todayIndicator: {
    backgroundColor: colors.primary.main,
  },
  completedIndicator: {
    backgroundColor: colors.accent.green,
  },
  activitySummaryContainer: {
    padding: spacing.md,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  activityHeaderText: {
    fontSize: 16,
    color: colors.text.primary,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  activityRowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  activityItem: {
    alignItems: 'center',
    width: '30%',
  },
  activityCircleContainer: {
    position: 'relative',
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityPercentText: {
    position: 'absolute',
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  activityLabel: {
    marginTop: 8,
    fontSize: 14,
    color: colors.text.secondary,
  },
  weightProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  progressChartContainer: {
    position: 'relative',
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressTextContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressPercentText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  progressLabel: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  weightInfoContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  weightInfoItem: {
    marginBottom: spacing.md,
  },
  weightInfoLabel: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  weightInfoValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  todayCard: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
    ...shadows.medium,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.round,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  cardTitle: {
    fontSize: 18,
    color: colors.text.primary,
    fontWeight: 'bold',
    flex: 1,
  },
  cardTitleWhite: {
    fontSize: 18,
    color: 'white',
    fontWeight: 'bold',
    flex: 1,
  },
  statusChip: {
    height: 26,
    paddingHorizontal: spacing.sm,
  },
  workoutContentContainer: {
    flexDirection: 'row',
    padding: spacing.md,
    paddingTop: 0,
  },
  workoutIconContainer: {
    paddingRight: spacing.md,
  },
  workoutIconBackground: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  workoutInfoContainer: {
    flex: 1,
    padding: spacing.md,
  },
  workoutName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: 4,
  },
  workoutDescription: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  startButton: {
    alignSelf: 'flex-start',
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  startButtonGradient: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  startButtonText: {
    color: colors.text.primary,
    fontWeight: '500',
  },
  restDayContainer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  restDayIconContainer: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(167, 139, 250, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  restDayText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.accent.lavender,
    marginBottom: 4,
  },
  restDaySubtext: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  mealsContainer: {
    padding: spacing.md,
    paddingTop: 0,
  },
  mealProgressContainer: {
    marginBottom: spacing.md,
  },
  mealProgressBar: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: borderRadius.round,
    marginBottom: spacing.xs,
    overflow: 'hidden',
  },
  mealProgressFill: {
    height: '100%',
    borderRadius: borderRadius.round,
  },
  mealProgressText: {
    fontSize: 12,
    color: colors.text.secondary,
    textAlign: 'right',
  },
  pendingMealsContainer: {
    marginBottom: spacing.md,
  },
  pendingMealsTitle: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  mealChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  mealChip: {
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  mealChipText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  logMealButton: {
    alignSelf: 'center',
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    width: '100%',
  },
  logMealButtonGradient: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  logMealButtonText: {
    color: colors.text.primary,
    fontWeight: '500',
  },
  allMealsContainer: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  allMealsCompletedIcon: {
    marginBottom: spacing.sm,
  },
  allMealsCompletedText: {
    fontSize: 16,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  viewMealsButton: {
    paddingVertical: spacing.xs,
  },
  viewMealsButtonText: {
    color: colors.secondary.main,
    fontWeight: '500',
  },
  bodyAnalysisCard: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
    ...shadows.medium,
  },
  bodyPromptContainer: {
    padding: spacing.md,
    alignItems: 'center',
  },
  bodyPromptText: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  bodyPromptButton: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  promptButtonGradient: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  promptButtonText: {
    color: colors.text.primary,
    fontWeight: '500',
  },
  bodyMetricsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.md,
    paddingTop: 0,
  },
  bodyMetricItem: {
    width: '50%',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  bodyMetricLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  bodyMetricValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  bodyDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: borderRadius.md,
    alignSelf: 'center',
    marginTop: spacing.md,
  },
  bodyDetailsButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
    marginRight: 4,
  },
  quoteCard: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
    ...shadows.medium,
  },
  quoteCardContent: {
    padding: spacing.md,
    minHeight: 100,
  },
  quoteIconContainer: {
    position: 'absolute',
    top: spacing.xs,
    left: spacing.xs,
  },
  quoteText: {
    fontSize: 16,
    color: colors.text.primary,
    fontWeight: '500',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  refreshButton: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
    width: 32,
    height: 32,
    borderRadius: borderRadius.round,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  workoutFocus: {
    fontSize: 14,
    color: colors.secondary.light,
    fontWeight: '500',
    marginBottom: 4,
  },
  workoutFocusArea: {
    fontSize: 14,
    color: colors.secondary.light,
    fontWeight: '500',
    marginBottom: 4,
  },
  workoutCard: {
    flex: 1,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
    ...shadows.medium,
  },
  workoutCardGradient: {
    flex: 1,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  workoutInfo: {
    flex: 1,
    padding: spacing.md,
  },
  workoutSection: {
    backgroundColor: 'rgba(40, 40, 70, 0.8)',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.medium,
  },
  workoutSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  workoutSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginLeft: spacing.sm,
  },
  todayWorkoutCard: {
    flex: 1,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
    ...shadows.medium,
  },
  todayWorkoutCardGradient: {
    flex: 1,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  todayWorkoutInfo: {
    flex: 1,
    padding: spacing.md,
  },
  todayWorkoutName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: 4,
  },
  todayWorkoutFocus: {
    fontSize: 14,
    color: colors.secondary.light,
    fontWeight: '500',
    marginBottom: 4,
  },
  todayCompletedTag: {
    backgroundColor: colors.accent.green,
    borderRadius: borderRadius.sm,
    padding: spacing.xs,
    marginTop: spacing.sm,
  },
  todayCompletedTagText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  todayWorkoutCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  todayWorkoutCtaText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  todayRestDayCard: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
  },
  todayRestDayIcon: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(167, 139, 250, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  todayRestDayText: {
    fontSize: 18,
    color: colors.text.primary,
    fontWeight: 'bold',
    marginBottom: spacing.xs,
  },
  todayNextWorkoutText: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  noWorkoutContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  noWorkoutText: {
    color: colors.text.secondary,
    marginBottom: 16,
  },
  createPlanButton: {
    height: 40,
    width: 140,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    elevation: 2,
  },
  workoutCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  workoutCardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
  },
  viewWorkoutsButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  viewAllText: {
    color: colors.primary.main,
    fontSize: 14,
  },
  workoutButton: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  workoutButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  activityRestText: {
    position: 'absolute',
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
});

// Need to import Svg components for circular progress
import Svg, { Circle } from 'react-native-svg';
import { Animated } from 'react-native';

// Animated Circle for progress visualization
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Add this utility function near the top of the component
const getFocusAreaFromWorkout = (workoutName: string) => {
  // Extract focus area from workout name
  // Examples: "Cardio Blast" → "Cardio", "Upper Body Focus" → "Upper Body"
  const focusAreas = [
    { keyword: "cardio", area: "Cardio" },
    { keyword: "upper", area: "Upper Body" },
    { keyword: "lower", area: "Lower Body" },
    { keyword: "leg", area: "Legs" },
    { keyword: "arm", area: "Arms" },
    { keyword: "chest", area: "Chest" },
    { keyword: "back", area: "Back" },
    { keyword: "shoulder", area: "Shoulders" },
    { keyword: "core", area: "Core" },
    { keyword: "ab", area: "Abs" },
    { keyword: "full", area: "Full Body" },
    { keyword: "hiit", area: "HIIT" },
  ];
  
  const workoutLower = workoutName.toLowerCase();
  for (const { keyword, area } of focusAreas) {
    if (workoutLower.includes(keyword)) {
      return area;
    }
  }
  
  // Default if no matching focus area found
  return "Today's Focus";
};

export default EnhancedHomeScreen; 