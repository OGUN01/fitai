import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Dimensions } from 'react-native';
import { Text, Card, Button, useTheme, Divider, List, IconButton, Checkbox, Snackbar, Avatar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import gemini from '../../../lib/gemini';
import { useProfile } from '../../../contexts/ProfileContext';
import { useAuth } from '../../../contexts/AuthContext';
import supabase from '../../../lib/supabase';
import { format } from 'date-fns';
import { markWorkoutComplete, isWorkoutCompleted } from '../../../services/trackingService';
import { Celebration, FadeIn, ScaleIn } from '../../../components/animations';

// Define workout plan interface based on Gemini response
interface Exercise {
  name: string;
  sets: number;
  reps: number;
  rest: string;
  description?: string;
  alternatives?: string[];
}

interface WorkoutDay {
  day: string | number;
  target: string;
  exercises: Exercise[];
}

interface WorkoutPlan {
  id?: string;
  workoutDays?: WorkoutDay[];
  warmUp?: string[];
  coolDown?: string[];
  progressionPlan?: {
    [key: string]: string;
  };
  // Support for legacy API format
  weeklySchedule?: {
    day: string | number;
    focus: string;
    exercises: Exercise[];
  }[];
}

// Add this interface near the top of the file with other interfaces
interface WorkoutError {
  title: string;
  message: string;
  isRetryable?: boolean;
  details?: string;
}

// Default fallback workout plan that follows the interface exactly
const fallbackWorkoutPlan: WorkoutPlan = {
  workoutDays: [
    {
      day: "Day 1",
      target: "Full Body",
      exercises: [
        {
          name: "Push-ups",
          sets: 3,
          reps: 10,
          rest: "60 seconds",
          description: "Start in a plank position with hands shoulder-width apart. Lower your body until your chest nearly touches the floor, then push back up."
        },
        {
          name: "Bodyweight Squats",
          sets: 3,
          reps: 15,
          rest: "60 seconds",
          description: "Stand with feet shoulder-width apart. Lower your body by bending your knees and pushing your hips back as if sitting in a chair."
        },
        {
          name: "Plank",
          sets: 3,
          reps: 30,
          rest: "45 seconds",
          description: "Hold a push-up position with your weight on your forearms. Keep your body in a straight line from head to heels."
        }
      ]
    },
    {
      day: "Day 2",
      target: "Rest Day",
      exercises: [
        {
          name: "Light Walking",
          sets: 1,
          reps: 1,
          rest: "None",
          description: "Go for a 20-minute walk at a comfortable pace to promote recovery."
        }
      ]
    },
    {
      day: "Day 3",
      target: "Full Body",
      exercises: [
        {
          name: "Dumbbell Rows",
          sets: 3,
          reps: 10,
          rest: "60 seconds",
          description: "Bend at the waist with one hand on a bench and the other holding a dumbbell. Pull the dumbbell up to your side."
        },
        {
          name: "Lunges",
          sets: 3,
          reps: 10,
          rest: "60 seconds",
          description: "Step forward with one leg and lower your body until both knees are bent at 90-degree angles. Push back to start and repeat with the other leg."
        }
      ]
    }
  ],
  warmUp: [
    "5 minutes of light cardio (jogging in place or jumping jacks)",
    "10 arm circles forward and backward",
    "10 hip rotations in each direction",
    "10 bodyweight squats"
  ],
  coolDown: [
    "Hamstring stretch: 30 seconds per leg",
    "Quad stretch: 30 seconds per leg",
    "Chest stretch: 30 seconds",
    "Deep breathing: 1 minute"
  ],
  progressionPlan: {
    "Week 1-2": "Focus on form, complete all sets and reps as written",
    "Week 3-4": "Increase reps by 2-3 per set if current sets feel manageable",
    "Week 5-6": "Add an additional set to each exercise or increase weight if using dumbbells"
  }
};

// WorkoutScreen component is the main component for the workout tab
export default function WorkoutScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<WorkoutError | null>(null);
  const [workoutPlan, setWorkoutPlan] = useState<WorkoutPlan | null>(null);
  const { profile, updateProfile } = useProfile();
  const [completedWorkouts, setCompletedWorkouts] = useState<Record<string, boolean>>({});
  const [loadingTrackingData, setLoadingTrackingData] = useState(true);
  const [completingWorkout, setCompletingWorkout] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // Animation states
  const [celebrationVisible, setCelebrationVisible] = useState(false);
  const [celebrationType, setCelebrationType] = useState<'success' | 'achievement' | 'streak' | 'confetti'>('success');
  const [celebrationMessage, setCelebrationMessage] = useState('');

  // Sample user preferences - in a real app, these would come from user data or onboarding
  const userPreferences = {
    fitnessLevel: (profile?.fitness_level || "beginner") as "beginner" | "intermediate" | "advanced",
    workoutLocation: "home" as "home" | "gym" | "outdoors" | "anywhere",
    availableEquipment: ["bodyweight", "dumbbells"],
    exerciseFrequency: profile?.workout_days_per_week || 3,
    timePerSession: profile?.workout_duration_minutes || 30,
    focusAreas: profile?.fitness_goals || ["full body"],
    injuries: "",
  };

  const saveWorkoutPlan = async (plan: WorkoutPlan) => {
    if (!profile) return;
    
    try {
      // Save to profile context and database
      await updateProfile({
        workout_plan: plan
      });
      console.log("Workout plan saved to database successfully");
    } catch (error) {
      console.error("Error saving workout plan:", error);
    }
  };

  const handleGeneratePlan = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const newPlan = await gemini.generateWorkoutPlan(userPreferences);
      
      if (newPlan && 'fallbackReason' in newPlan) {
        // Handle fallback reason specifically
        if (newPlan.fallbackReason === 'temporary_service_issue') {
          setError({
            title: "Temporary Service Issue",
            message: "We're having trouble generating your workout plan right now. Please try again in a few moments.",
            isRetryable: true
          });
        } else {
          setError({
            title: "Couldn't Generate Your Plan",
            message: newPlan.message || "We couldn't create your custom workout plan. Please try again or adjust your preferences.",
            isRetryable: true
          });
        }
        return;
      }
      
      if (!newPlan || !newPlan.weeklySchedule || newPlan.weeklySchedule.length === 0) {
        setError({
          title: "Invalid Workout Plan",
          message: "The workout plan couldn't be generated properly. Please try again.",
          isRetryable: true
        });
        return;
      }
      
      // Plan generated successfully
      setWorkoutPlan(newPlan);
      saveWorkoutPlan(newPlan);
      
    } catch (err) {
      console.error('Error generating workout plan:', err);
      setError({
        title: "Error Generating Plan",
        message: "Something went wrong while creating your workout plan. Please try again.",
        isRetryable: true,
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    } finally {
      setLoading(false);
    }
  };

  // Load or generate a workout plan on initial load
  useEffect(() => {
    const loadWorkoutPlan = async () => {
      try {
        setLoading(true);
        console.log("Loading workout plan...");
        
        if (profile?.workout_plan) {
          console.log("Loading existing workout plan from profile");
          let plan = profile.workout_plan as WorkoutPlan;
          
          // Basic validation of the workout plan structure
          if (!plan || !plan.weeklySchedule || !Array.isArray(plan.weeklySchedule) || plan.weeklySchedule.length === 0) {
            console.warn("Saved workout plan is invalid or empty, generating new one");
            await handleGeneratePlan();
            return;
          }
          
          // Ensure each day has the required fields
          const validPlan = {
            ...plan,
            weeklySchedule: plan.weeklySchedule.map(day => ({
              day: day.day || "Unknown Day",
              focus: day.focus || "General Workout",
              exercises: Array.isArray(day.exercises) ? day.exercises : []
            }))
          };
          
          setWorkoutPlan(validPlan);
          
          // Generate summary if it doesn't exist yet
          if (!profile.workout_summary) {
            console.log("Generating workout summary for cached plan");
            const summary = generateWorkoutSummary(validPlan);
            
            // Save the summary to the database within workout_preferences JSONB field
            // instead of trying to save to a non-existent column
            updateProfile({
              workout_preferences: {
                ...profile.workout_preferences,
                workout_summary: summary
              }
            });
          }
        } else {
          console.log("No existing workout plan found, generating new one");
          await handleGeneratePlan();
        }
      } catch (err) {
        console.error("Error loading workout plan:", err);
        // If there's an error loading from database, generate a new plan
        await handleGeneratePlan();
      } finally {
        setLoading(false);
      }
    };
    
    loadWorkoutPlan();
  }, [profile]);

  // Load workout completion data from the database
  const loadWorkoutCompletionData = async () => {
    if (!user || !workoutPlan) return;
    
    setLoadingTrackingData(true);
    
    try {
      const today = new Date(); // Use Date object for isWorkoutCompleted
      const completionStatus: Record<string, boolean> = {};
      
      // Initialize structure for all workout days
      for (const day of getWorkoutDays()) {
        completionStatus[day.day] = false;
      }
      
      // Check completions by day name
      for (const day of getWorkoutDays()) {
        // Convert day.day to string for consistency and pass it as day name
        const dayName = String(day.day);
        const isCompleted = await isWorkoutCompleted(user.id, today, dayName);
        completionStatus[day.day] = isCompleted;
        console.log(`Checking completion for ${dayName}: ${isCompleted}`);
      }
      
      console.log('Final completion status:', completionStatus);
      setCompletedWorkouts(completionStatus);
    } catch (err) {
      console.error('Error loading workout completion data:', err);
    } finally {
      setLoadingTrackingData(false);
    }
  };
  
  // Mark a workout as complete
  const handleCompleteWorkout = async (dayName: string) => {
    if (!user || !workoutPlan) return;
    
    setCompletingWorkout(true);
    
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      console.log('Workout days:', getWorkoutDays());
      console.log('Looking for day:', dayName);
      
      const workoutDays = getWorkoutDays();
      
      // Find the workout day by its name
      const day = workoutDays.find(d => d.day === dayName);
      
      if (!day) {
        console.error('Available days:', workoutDays.map(d => d.day));
        console.error('Searching for day:', dayName);
        throw new Error('Workout day not found');
      }
      
      // Get the index of the day (1-based) to use as day number
      const dayIndex = workoutDays.findIndex(d => d.day === dayName);
      const dayNum = dayIndex + 1;
      
      console.log(`Found workout day: ${day.day}, using day number: ${dayNum}`);
      
      // Mark workout as complete in the database
      const result = await markWorkoutComplete(
        user.id,
        today,
        dayNum, // Use numeric day index
        workoutPlan.id || 'workout_plan_1',
        {
          estimated_duration_minutes: userPreferences.timePerSession,
          focus_area: day.target,
          workout_day_name: dayName // Pass the day name to track which workout day was completed
        }
      );
      
      if (result) {
        // Update local state
        setCompletedWorkouts(prev => ({
          ...prev,
          [dayName]: true
        }));
        
        // Determine celebration type based on streak or achievements
        let celebrationType: 'success' | 'achievement' | 'streak' | 'confetti' = 'success';
        let message = `${day.target} workout completed!`;
        
        // Check for streak (this is a placeholder - real app would check actual streak)
        const hasStreak = Object.values(completedWorkouts).filter(Boolean).length >= 2;
        
        if (hasStreak) {
          celebrationType = 'streak';
          message = "You're on a roll! Keep up the great work!";
        } else {
          // Randomly choose between success and confetti for variety
          celebrationType = Math.random() > 0.5 ? 'success' : 'confetti';
        }
        
        // Show celebration animation
        setCelebrationType(celebrationType);
        setCelebrationMessage(message);
        setCelebrationVisible(true);
        
        // Hide celebration after a delay and show snackbar
        setTimeout(() => {
          setCelebrationVisible(false);
          setSnackbarMessage(`${day.target} workout completed! Great job!`);
          setSnackbarVisible(true);
        }, 3000);
      }
    } catch (err) {
      console.error('Error completing workout:', err);
      setSnackbarMessage('Failed to mark workout as complete. Please try again.');
      setSnackbarVisible(true);
    } finally {
      setCompletingWorkout(false);
    }
  };

  // Load completion data when workout plan changes
  useEffect(() => {
    if (workoutPlan) {
      loadWorkoutCompletionData();
    }
  }, [workoutPlan, user]);

  // Safely access nested properties
  const safelyAccess = <T extends unknown>(obj: any, path: string, defaultValue: T): T => {
    try {
      return path.split('.').reduce((o, p) => (o && o[p] !== undefined) ? o[p] : null, obj) || defaultValue;
    } catch (e) {
      return defaultValue;
    }
  };

  // Render a workout day card with proper null checking
  const renderWorkoutDay = (day: WorkoutDay) => {
    // Make sure all required properties exist
    if (!day) return null;
    
    const dayName = day.day || 'Workout Day';
    const target = day.target || 'General Fitness';
    const exercises = day.exercises || [];
    
    // Check if the workout is completed using the day name as the key
    const isCompleted = completedWorkouts[dayName];
    
    return (
      <Card style={[styles.workoutDayCard, isCompleted && styles.completedWorkoutCard]} key={dayName}>
        <LinearGradient
          colors={isCompleted ? 
            [theme.colors.secondary, theme.colors.primary] : 
            ['#ffffff', '#f8f8f8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.cardGradient, isCompleted && styles.completedGradient]}
        >
          <Card.Content>
            <View style={styles.workoutDayHeader}>
              <View style={styles.dayHeaderLeft}>
                <MaterialCommunityIcons 
                  name={target.toLowerCase().includes('legs') ? "dumbbell" : 
                        target.toLowerCase().includes('cardio') ? "run-fast" : 
                        target.toLowerCase().includes('rest') ? "sleep" : "weight-lifter"} 
                  size={28} 
                  color={isCompleted ? theme.colors.background : theme.colors.primary} 
                />
                <View style={styles.dayTitleContainer}>
                  <Text variant="titleLarge" style={[styles.cardTitle, isCompleted && styles.completedText]}>{dayName}</Text>
                  <Text variant="titleMedium" style={[styles.targetText, isCompleted && styles.completedText]}>{target}</Text>
                </View>
              </View>
              {isCompleted && (
                <View style={styles.completedBadge}>
                  <MaterialCommunityIcons name="check-circle" size={24} color={theme.colors.background} />
                  <Text style={styles.completedText}>Completed</Text>
                </View>
              )}
            </View>
            
            <Divider style={[styles.divider, {marginVertical: 12}]} />
            
            {exercises.length > 0 ? (
              exercises.map((exercise, index) => (
                <View key={`${dayName}-${index}`} style={styles.exerciseItem}>
                  <View style={styles.exerciseHeader}>
                    <Text variant="titleMedium" style={isCompleted ? styles.completedText : null}>{exercise.name || 'Exercise'}</Text>
                    <View style={styles.exerciseMetrics}>
                      <View style={styles.metricBadge}>
                        <Text style={styles.metricText}>{exercise.sets || 3}</Text>
                        <Text style={styles.metricLabel}>sets</Text>
                      </View>
                      <View style={styles.metricBadge}>
                        <Text style={styles.metricText}>{exercise.reps || 10}</Text>
                        <Text style={styles.metricLabel}>reps</Text>
                      </View>
                    </View>
                  </View>
                  <Text variant="bodySmall">Rest: {exercise.rest || '60 seconds'}</Text>
                  {exercise.description && (
                    <Text variant="bodySmall" style={styles.description}>{exercise.description}</Text>
                  )}
                  {exercise.alternatives && exercise.alternatives.length > 0 && (
                    <View style={styles.alternatives}>
                      <Text variant="bodySmall" style={styles.alternativesLabel}>Alternatives:</Text>
                      <Text variant="bodySmall">{exercise.alternatives.join(', ')}</Text>
                    </View>
                  )}
                  {index < exercises.length - 1 && <Divider style={styles.divider} />}
                </View>
              ))
            ) : (
              <Text variant="bodyMedium">No exercises specified for this day.</Text>
            )}
          </Card.Content>
          <Card.Actions>
            <TouchableOpacity 
              style={[styles.completeButton, isCompleted && styles.completedButton]}
              onPress={() => handleCompleteWorkout(String(dayName))}
              disabled={completingWorkout || isCompleted}
            >
              <LinearGradient 
                colors={isCompleted ? ['#888888', '#666666'] : [theme.colors.primary, theme.colors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buttonGradient}
              >
                <Text style={styles.buttonText}>{isCompleted ? "Completed" : "Mark Complete"}</Text>
                {!isCompleted && <MaterialCommunityIcons name="check" size={20} color="white" style={{marginLeft: 8}} />}
              </LinearGradient>
            </TouchableOpacity>
          </Card.Actions>
        </LinearGradient>
      </Card>
    );
  };

  // Get workout days safely
  const getWorkoutDays = () => {
    if (!workoutPlan) return [];
    return workoutPlan.workoutDays || [];
  };

  // Generate a summary of the workout plan for the home screen
  const generateWorkoutSummary = (plan: WorkoutPlan): string => {
    if (!plan || !plan.weeklySchedule || plan.weeklySchedule.length === 0) {
      return "No workout plan available. Visit the workout tab to generate one.";
    }
    
    try {
      // Count total workouts per week
      const totalWorkouts = plan.weeklySchedule.length;
      
      // Get the focuses for the week
      const focuses = plan.weeklySchedule.map(day => day.focus);
      
      // Count total exercises
      const totalExercises = plan.weeklySchedule.reduce(
        (sum, day) => sum + (day.exercises?.length || 0), 
        0
      );
      
      // Create a summary string
      return `${totalWorkouts} workouts per week focusing on ${focuses.join(', ')}. ${totalExercises} total exercises.`;
    } catch (error) {
      console.error("Error generating workout summary:", error);
      return "Custom workout plan available. Visit the workout tab for details.";
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <StatusBar style="light" />
      
      {/* Celebration Animation */}
      <Celebration 
        visible={celebrationVisible}
        type={celebrationType}
        message={celebrationMessage}
        onAnimationFinish={() => setCelebrationVisible(false)}
      />
      
      {/* Header with Bold Minimalism design */}
      <View style={styles.headerContainer}>
        <LinearGradient
          colors={[theme.colors.primary, theme.colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <View style={styles.headerRow}>
              <Text variant="headlineMedium" style={styles.headerTitle}>Workout Plan</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/profile')} style={styles.avatarContainer}>
                <Avatar.Text size={40} label={profile?.full_name?.[0] || "U"} style={styles.avatar} />
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Generating your personalized workout plan...</Text>
          </View>
        ) : error ? (
          <Card style={styles.errorCard}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.errorText}>{error.title}</Text>
              <Text variant="bodyMedium">{error.message}</Text>
              {error.details && process.env.NODE_ENV === 'development' && (
                <Text variant="bodySmall" style={styles.errorDetails}>Details: {error.details}</Text>
              )}
              {error.isRetryable && (
                <Button 
                  mode="contained" 
                  onPress={handleGeneratePlan} 
                  style={styles.retryButton}
                >
                  Try Again
                </Button>
              )}
            </Card.Content>
          </Card>
        ) : workoutPlan ? (
          <>
            <Card style={styles.card}>
              <LinearGradient
                colors={[theme.colors.primary, theme.colors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.programHeaderGradient}
              >
                <Text variant="titleLarge" style={styles.programHeaderTitle}>Your Workout Program</Text>
              </LinearGradient>
              <Card.Content style={styles.cardContent}>
                <Text variant="bodyLarge" style={{marginBottom: 12}}>Here's your personalized workout plan based on your preferences:</Text>
                
                <View style={styles.detailsContainer}>
                  <View style={styles.preferenceItem}>
                    <MaterialCommunityIcons name="trophy" size={20} color={theme.colors.primary} />
                    <Text variant="bodyMedium" style={styles.preferenceText}>Level: {userPreferences.fitnessLevel}</Text>
                  </View>
                  <View style={styles.preferenceItem}>
                    <MaterialCommunityIcons name="map-marker" size={20} color={theme.colors.primary} />
                    <Text variant="bodyMedium" style={styles.preferenceText}>Location: {userPreferences.workoutLocation}</Text>
                  </View>
                  <View style={styles.preferenceItem}>
                    <MaterialCommunityIcons name="target" size={20} color={theme.colors.primary} />
                    <Text variant="bodyMedium" style={styles.preferenceText}>Focus: {userPreferences.focusAreas.join(', ')}</Text>
                  </View>
                  <View style={styles.preferenceItem}>
                    <MaterialCommunityIcons name="calendar-week" size={20} color={theme.colors.primary} />
                    <Text variant="bodyMedium" style={styles.preferenceText}>Sessions per week: {userPreferences.exerciseFrequency}</Text>
                  </View>
                </View>
              </Card.Content>
              <Card.Actions style={styles.cardActions}>
                <TouchableOpacity 
                  style={styles.regenerateButton}
                  onPress={handleGeneratePlan}
                >
                  <LinearGradient 
                    colors={[theme.colors.primary, theme.colors.secondary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.buttonGradient}
                  >
                    <Text style={styles.buttonText}>Regenerate Plan</Text>
                    <MaterialCommunityIcons name="refresh" size={20} color="white" style={{marginLeft: 8}} />
                  </LinearGradient>
                </TouchableOpacity>
              </Card.Actions>
            </Card>
            
            {/* Warm-up section */}
            <Card style={styles.card}>
              <LinearGradient
                colors={['#E0F7FA', '#B2EBF2']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.sectionHeaderGradient}
              >
                <View style={styles.sectionHeader}>
                  <MaterialCommunityIcons name="fire" size={24} color="#00838F" />
                  <Text variant="titleLarge" style={styles.sectionHeaderTitle}>Warm-up (5-10 minutes)</Text>
                </View>
              </LinearGradient>
              <Card.Content style={styles.cardContent}>
                {(workoutPlan.warmUp && workoutPlan.warmUp.length > 0) ? (
                  workoutPlan.warmUp.map((exercise, index) => (
                    <View key={`warmup-${index}`} style={styles.listItemContainer}>
                      <MaterialCommunityIcons name="circle-small" size={20} color={theme.colors.primary} />
                      <Text variant="bodyMedium" style={styles.listItemText}>{exercise}</Text>
                    </View>
                  ))
                ) : (
                  <Text variant="bodyMedium">Perform 5-10 minutes of light cardio and dynamic stretching.</Text>
                )}
              </Card.Content>
            </Card>
            
            {/* Workout days */}
            {getWorkoutDays().length > 0 ? (
              getWorkoutDays().map((day, index) => renderWorkoutDay(day))
            ) : (
              <Card style={styles.card}>
                <Card.Content>
                  <Text variant="titleMedium">No workout days specified</Text>
                  <Text variant="bodyMedium">Try regenerating your workout plan.</Text>
                </Card.Content>
              </Card>
            )}
            
            {/* Cool-down section */}
            <Card style={styles.card}>
              <LinearGradient
                colors={['#E8F5E9', '#C8E6C9']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.sectionHeaderGradient}
              >
                <View style={styles.sectionHeader}>
                  <MaterialCommunityIcons name="water" size={24} color="#2E7D32" />
                  <Text variant="titleLarge" style={[styles.sectionHeaderTitle, {color: '#2E7D32'}]}>Cool-down (5-10 minutes)</Text>
                </View>
              </LinearGradient>
              <Card.Content style={styles.cardContent}>
                {(workoutPlan.coolDown && workoutPlan.coolDown.length > 0) ? (
                  workoutPlan.coolDown.map((exercise, index) => (
                    <View key={`cooldown-${index}`} style={styles.listItemContainer}>
                      <MaterialCommunityIcons name="circle-small" size={20} color={theme.colors.primary} />
                      <Text variant="bodyMedium" style={styles.listItemText}>{exercise}</Text>
                    </View>
                  ))
                ) : (
                  <Text variant="bodyMedium">Perform 5-10 minutes of static stretching for the major muscle groups.</Text>
                )}
              </Card.Content>
            </Card>
            
            {/* Progression plan */}
            <Card style={styles.card}>
              <LinearGradient
                colors={['#FFF3E0', '#FFE0B2']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.sectionHeaderGradient}
              >
                <View style={styles.sectionHeader}>
                  <MaterialCommunityIcons name="chart-line" size={24} color="#E65100" />
                  <Text variant="titleLarge" style={[styles.sectionHeaderTitle, {color: '#E65100'}]}>Progression Plan</Text>
                </View>
              </LinearGradient>
              <Card.Content style={styles.cardContent}>
                {workoutPlan.progressionPlan ? (
                  Object.entries(workoutPlan.progressionPlan).map(([period, plan], index) => (
                    <View key={`progression-${index}`} style={styles.progressionItem}>
                      <View style={styles.progressionPeriod}>
                        <MaterialCommunityIcons name="calendar-range" size={20} color={theme.colors.primary} />
                        <Text variant="titleMedium" style={styles.periodText}>{period}</Text>
                      </View>
                      <Text variant="bodyMedium" style={styles.planText}>{plan}</Text>
                    </View>
                  ))
                ) : (
                  <Text variant="bodyMedium">No progression plan specified. As you get stronger, gradually increase the weight, reps, or sets.</Text>
                )}
              </Card.Content>
            </Card>
          </>
        ) : (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleLarge" style={styles.cardTitle}>No Workout Plan</Text>
              <Text variant="bodyLarge">Tap the button below to generate a personalized workout plan.</Text>
            </Card.Content>
            <Card.Actions>
              <Button 
                mode="contained"
                onPress={handleGeneratePlan}
              >
                Generate Workout Plan
              </Button>
            </Card.Actions>
          </Card>
        )}
      </ScrollView>
      
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        action={{
          label: 'OK',
          onPress: () => setSnackbarVisible(false),
        }}
      >
        {snackbarMessage}
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  headerContainer: {
    height: 60,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  headerGradient: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
  },
  avatarContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    backgroundColor: 'white',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  card: {
    marginBottom: 16,
    elevation: 2,
  },
  workoutDayCard: {
    marginBottom: 16,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  completedWorkoutCard: {
    borderLeftColor: '#2196F3',
    opacity: 0.9,
  },
  workoutDayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  completedBadge: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  completedText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  completeButton: {
    marginTop: 8,
  },
  cardTitle: {
    marginBottom: 8,
    fontWeight: 'bold',
  },
  workoutTime: {
    marginTop: 4,
    opacity: 0.7,
  },
  workoutItem: {
    marginVertical: 8,
  },
  exerciseItem: {
    marginTop: 12,
  },
  description: {
    marginTop: 4,
    fontStyle: 'italic',
  },
  alternatives: {
    marginTop: 4,
  },
  alternativesLabel: {
    fontWeight: 'bold',
  },
  divider: {
    marginVertical: 12,
  },
  detailsContainer: {
    marginTop: 16,
    marginBottom: 8,
  },
  listItem: {
    marginVertical: 4,
  },
  progressionItem: {
    marginVertical: 8,
  },
  loadingContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorCard: {
    marginBottom: 16,
    elevation: 2,
    backgroundColor: '#FFEBEE',
  },
  errorText: {
    color: '#D32F2F',
    marginBottom: 16,
  },
  retryButton: {
    marginTop: 8,
  },
  errorContainer: {
    padding: 16,
    backgroundColor: '#FFEBEE',
  },
  errorTitle: {
    color: '#D32F2F',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  errorMessage: {
    color: '#333',
    marginBottom: 16,
  },
  errorDetails: {
    color: '#666',
    marginTop: 8,
  },
  cardGradient: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 8,
  },
  completedGradient: {
    backgroundColor: '#2196F3',
  },
  dayHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayTitleContainer: {
    marginLeft: 8,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exerciseMetrics: {
    flexDirection: 'row',
  },
  metricBadge: {
    backgroundColor: '#f8f8f8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  metricText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  metricLabel: {
    fontSize: 12,
    opacity: 0.7,
  },
  buttonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  buttonText: {
    fontSize: 16,
    color: 'white',
  },
  completedButton: {
    backgroundColor: '#2196F3',
  },
  targetText: {
    fontSize: 16,
    color: '#555',
    marginTop: 2,
  },
  programHeaderGradient: {
    height: 60,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  programHeaderTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  sectionHeaderGradient: {
    height: 60,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionHeaderTitle: {
    color: '#00838F',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  cardContent: {
    padding: 16,
  },
  preferenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  preferenceText: {
    marginLeft: 8,
  },
  regenerateButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  cardActions: {
    padding: 8,
  },
  listItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  listItemText: {
    marginLeft: 8,
  },
  progressionPeriod: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  periodText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  planText: {
    fontSize: 14,
    opacity: 0.7,
  },
});
