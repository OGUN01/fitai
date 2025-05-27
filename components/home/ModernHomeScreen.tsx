import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Card, Avatar, Chip } from 'react-native-paper';
import { format } from 'date-fns';
import { EventRegister } from 'react-native-event-listeners';
import { getCurrentStreak } from '../../utils/streakManager';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../../theme/theme';
import { FadeIn, SlideIn, ScaleIn } from '../animations';

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
  dayStreak: number;
}

interface MealStats {
  allCompleted: boolean;
  pendingMeals: string[];
}

interface NextWorkout {
  day: string;
  name: string;
  daysUntil: number;
}

interface ModernHomeScreenProps {
  profile: any;
  activitySummary: {
    workouts: { 
      count: number, 
      percentage: number, 
      isRestDay?: boolean,
      scheduledForToday?: boolean,
      todayCompleted?: boolean,
      todayWorkoutName?: string,
      dayStreak?: number
    },
    meals: { 
      count: number, 
      percentage: number,
      pendingMeals: string[],
      allCompleted: boolean
    },
    progress: { percentage: number }
  };
  meals: any[];
  nextWorkout: NextWorkout | null;
  completedWorkouts: number;
  todayWorkoutCompleted: boolean;
  todayMealsCompleted: string[];
  bodyAnalysis: any;
  hasWorkout: boolean;
  workoutName: string;
  motivationalQuote: string;
  onRefreshQuote: () => void;
  isRefreshingQuote?: boolean;
}

/**
 * ModernHomeScreen - Modern and bold minimalist design for home screen
 */
const ModernHomeScreen: React.FC<ModernHomeScreenProps> = ({
  profile,
  activitySummary,
  meals,
  nextWorkout,
  completedWorkouts,
  todayWorkoutCompleted,
  todayMealsCompleted,
  bodyAnalysis,
  hasWorkout,
  workoutName,
  motivationalQuote,
  onRefreshQuote,
  isRefreshingQuote = false
}) => {
  // Use local state to track the streak from our new streak manager
  const [currentStreak, setCurrentStreak] = useState(0);
  
  // Load the current streak when component mounts
  useEffect(() => {
    loadCurrentStreak();
    
    // Listen for streak updates
    const streakListener = EventRegister.addEventListener(
      'streakUpdated', 
      (data: { streak: number }) => {
        console.log('🔥 ModernHomeScreen received streak update event:', data);
        setCurrentStreak(data.streak);
      }
    );
    
    return () => {
      EventRegister.removeEventListener(streakListener as string);
    };
  }, []);
  
  // Load current streak from the streak manager
  const loadCurrentStreak = async () => {
    try {
      const streak = await getCurrentStreak();
      console.log('🔄 ModernHomeScreen loaded current streak:', streak);
      setCurrentStreak(streak);
    } catch (error) {
      console.error('Error loading streak:', error);
    }
  };

  // Get time of day for greeting
  const getTimeOfDay = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';
    return 'evening';
  };

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Header with Linear Gradient Background */}
      <LinearGradient
        colors={[colors.primary.dark, colors.background.primary]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.3 }}
      />
      
      {/* Header Section */}
      <View style={styles.header}>
        <FadeIn from={0} duration={800}>
          <View style={styles.greetingContainer}>
            <Text style={styles.greeting}>Good {getTimeOfDay()},</Text>
            <Text style={styles.userName}>{profile.name}</Text>
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
                label={profile.name.split(' ').map((n: string) => n[0]).join('')} 
                style={styles.avatar}
                labelStyle={styles.avatarLabel}
              />
            </LinearGradient>
          </TouchableOpacity>
        </ScaleIn>
      </View>
      
      {/* Streak Indicator */}
      {(currentStreak > 0 || (activitySummary.workouts.dayStreak ?? 0) > 0) && (
        <ScaleIn duration={800} delay={400}>
          <View style={styles.streakContainer}>
            <LinearGradient
              colors={[colors.accent.gold, colors.accent.gold]}
              style={styles.streakGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="flame" size={20} color="#FFF" />
              <Text style={styles.streakText}>
                {currentStreak || (activitySummary.workouts.dayStreak ?? 0)} day{(currentStreak || (activitySummary.workouts.dayStreak ?? 0)) !== 1 ? 's' : ''} streak!
              </Text>
            </LinearGradient>
          </View>
        </ScaleIn>
      )}
      
      {/* Weight Progress Card */}
      <FadeIn from={0} duration={800} delay={200}>
        <Card style={styles.progressCard}>
          <LinearGradient
            colors={['rgba(40, 40, 70, 0.8)', 'rgba(30, 30, 50, 0.95)']}
            style={[StyleSheet.absoluteFill, {borderRadius: borderRadius.lg}]}
          />
          <Card.Content style={styles.progressCardContent}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>Weight Progress</Text>
              <Text style={styles.progressValues}>
                {profile.progress.currentWeight}kg of {profile.progress.targetWeight}kg
              </Text>
            </View>
            
            <View style={styles.progressBarContainer}>
              <LinearGradient
                colors={[colors.primary.main, colors.secondary.main]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                  styles.progressBarFill,
                  { width: `${profile.progress.percentComplete}%` }
                ]}
              />
            </View>
            
            <Text style={styles.progressDetails}>
              {profile.progress.percentComplete}% to goal • Started at {profile.progress.startWeight}kg
            </Text>
          </Card.Content>
        </Card>
      </FadeIn>
      
      {/* Motivational Quote Card */}
      <SlideIn distance={30} direction="right" duration={800} delay={400}>
        <LinearGradient
          colors={[colors.primary.main, colors.secondary.main]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.quoteCard}
        >
          <View style={styles.quoteContent}>
            <Text style={styles.quoteText}>"{motivationalQuote}"</Text>
            <TouchableOpacity 
              onPress={onRefreshQuote} 
              style={styles.refreshButton}
              disabled={isRefreshingQuote}
            >
              <Ionicons 
                name="refresh" 
                size={20} 
                color="white" 
                style={{
                  opacity: isRefreshingQuote ? 0.5 : 1,
                  transform: [{ rotate: isRefreshingQuote ? '45deg' : '0deg' }]
                }}
              />
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </SlideIn>
      
      {/* Today's Workout Plan Card */}
      <FadeIn from={0} duration={800} delay={600}>
        <Card style={styles.todayCard}>
          <LinearGradient
            colors={['rgba(40, 40, 70, 0.8)', 'rgba(30, 30, 50, 0.95)']}
            style={[StyleSheet.absoluteFill, {borderRadius: borderRadius.lg}]}
          />
          <Card.Content>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardIcon}>
                <Ionicons name="fitness-outline" size={24} color={colors.primary.main} />
              </View>
              <Text style={styles.cardTitle}>Your Workout Plan</Text>
            </View>
            
            <View style={styles.todayWorkout}>
              {!nextWorkout ? (
                <View>
                  <Text style={styles.workoutDescription}>
                    No workout plan generated yet.
                  </Text>
                  <View style={styles.actionRow}>
                    <TouchableOpacity 
                      style={styles.generateButton}
                      onPress={() => router.push('/(tabs)/workout')}
                    >
                      <LinearGradient
                        colors={[colors.primary.main, colors.primary.dark]}
                        style={styles.startButtonGradient}
                      >
                        <Text style={styles.startButtonText}>Create Plan</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : activitySummary.workouts.scheduledForToday ? (
                <>
                  <Text style={styles.workoutDescription}>
                    You have a workout scheduled for today: 
                    <Text style={styles.workoutHighlight}> {activitySummary.workouts.todayWorkoutName}</Text>
                  </Text>
                  
                  {activitySummary.workouts.todayCompleted ? (
                    <Chip 
                      icon="check-circle" 
                      style={[styles.statusChip, { backgroundColor: colors.accent.green }]}
                    >
                      Completed
                    </Chip>
                  ) : (
                    <View style={styles.actionRow}>
                      <Chip 
                        icon="alert" 
                        style={[styles.statusChip, { backgroundColor: colors.accent.gold }]}
                      >
                        Action needed
                      </Chip>
                      
                      <TouchableOpacity 
                        style={styles.startButton}
                        onPress={() => router.push('/(tabs)/workout')}
                      >
                        <LinearGradient
                          colors={[colors.primary.main, colors.primary.dark]}
                          style={styles.startButtonGradient}
                        >
                          <Text style={styles.startButtonText}>Start</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              ) : (
                <>
                  <Text style={styles.workoutDescription}>
                    No workout scheduled for today. Next workout:
                    <Text style={styles.workoutHighlight}> {nextWorkout.name}</Text> in {nextWorkout.daysUntil} day{nextWorkout.daysUntil !== 1 ? 's' : ''}
                  </Text>
                  
                  <Chip 
                    icon="calendar" 
                    style={[styles.statusChip, { backgroundColor: colors.background.secondary }]}
                  >
                    Rest day
                  </Chip>
                </>
              )}
            </View>
            
            <View style={styles.cardActions}>
              <TouchableOpacity 
                style={styles.viewAllButton}
                onPress={() => router.push('/(tabs)/workout')}
              >
                <Text style={styles.viewAllButtonText}>View Workout Plan</Text>
              </TouchableOpacity>
            </View>
          </Card.Content>
        </Card>
      </FadeIn>
      
      {/* Today's Meal Plan Card */}
      <FadeIn from={0} duration={800} delay={800}>
        <Card style={styles.todayCard}>
          <LinearGradient
            colors={['rgba(40, 40, 70, 0.8)', 'rgba(30, 30, 50, 0.95)']}
            style={[StyleSheet.absoluteFill, {borderRadius: borderRadius.lg}]}
          />
          <Card.Content>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardIcon}>
                <Ionicons name="restaurant-outline" size={24} color={colors.secondary.main} />
              </View>
              <Text style={styles.cardTitle}>Your Meal Plan</Text>
            </View>
            
            <View style={styles.todayMeals}>
              <Text style={styles.mealDescription}>
                {activitySummary.meals.pendingMeals.length > 0 
                  ? 'Pending for today: ' 
                  : 'All meals completed for today'}
                <Text style={styles.mealHighlight}>
                  {activitySummary.meals.pendingMeals.length > 0
                    ? activitySummary.meals.pendingMeals.join(', ')
                    : ''}
                </Text>
              </Text>
              
              {activitySummary.meals.allCompleted ? (
                <Chip 
                  icon="check-circle" 
                  style={[styles.statusChip, { backgroundColor: colors.accent.green }]}
                >
                  All Complete
                </Chip>
              ) : (
                <Chip 
                  icon="alert" 
                  style={[styles.statusChip, { backgroundColor: colors.accent.gold }]}
                >
                  {activitySummary.meals.pendingMeals.length} meal{activitySummary.meals.pendingMeals.length !== 1 ? 's' : ''} remaining
                </Chip>
              )}
            </View>
            
            <View style={styles.cardActions}>
              <TouchableOpacity 
                style={styles.viewAllButton}
                onPress={() => router.push('/(tabs)/nutrition')}
              >
                <Text style={styles.viewAllButtonText}>View Meal Plan</Text>
              </TouchableOpacity>
            </View>
          </Card.Content>
        </Card>
      </FadeIn>
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
  progressCard: {
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    elevation: 4,
    backgroundColor: 'transparent',
  },
  progressCardContent: {
    padding: spacing.md,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  progressTitle: {
    fontSize: 16,
    color: colors.text.primary,
    fontWeight: '500',
  },
  progressValues: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: borderRadius.round,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: borderRadius.round,
  },
  progressDetails: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  quoteCard: {
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    elevation: 4,
    backgroundColor: 'transparent',
  },
  quoteContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
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
  },
  todayCard: {
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    elevation: 4,
    backgroundColor: 'transparent',
  },
  todayWorkout: {
    marginVertical: spacing.sm,
  },
  workoutDescription: {
    fontSize: 15,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  workoutHighlight: {
    color: colors.text.primary,
    fontWeight: '500',
  },
  statusChip: {
    alignSelf: 'flex-start',
    marginBottom: spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  startButton: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  startButtonGradient: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  startButtonText: {
    color: colors.text.primary,
    fontWeight: '500',
  },
  cardActions: {
    marginTop: spacing.sm,
  },
  viewAllButton: {
    paddingVertical: spacing.xs,
  },
  viewAllButtonText: {
    color: colors.primary.main,
    fontWeight: '500',
  },
  todayMeals: {
    marginVertical: spacing.sm,
  },
  mealDescription: {
    fontSize: 15,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  mealHighlight: {
    color: colors.text.primary,
    fontWeight: '500',
  },
  generateButton: {
    flex: 1,
    height: 36,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    elevation: 2,
  },
});

export default ModernHomeScreen;
