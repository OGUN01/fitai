import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Dimensions, Modal, Alert } from 'react-native';
import { Text, Card, Button, useTheme, Divider, List, IconButton, Checkbox, Snackbar, Avatar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import gemini from '../../../lib/gemini';
import { useProfile } from '../../../contexts/ProfileContext';
import { useAuth } from '../../../contexts/AuthContext';
import supabase from '../../../lib/supabase';
import { format } from 'date-fns';
import { markWorkoutComplete, isWorkoutCompleted } from '../../../services/trackingService';
import { Celebration, FadeIn, ScaleIn } from '../../../components/animations';
import { colors, spacing, borderRadius, shadows, gradients } from '../../../theme/theme';
import StyledText from '../../../components/ui/StyledText';
import { UserFitnessPreferences } from '../../../services/ai/workoutGenerator';
import { reliableWorkoutGenerator } from '../../../services/ai';
import { EventRegister } from 'react-native-event-listeners';
import { useFocusEffect, useRouter } from 'expo-router';

// Define workout plan interface based on Gemini response
interface Exercise {
  name: string;
  sets: number;
  reps: number | string;
  rest?: string;
  restSeconds?: number;
  description?: string;
  alternatives?: string[];
}

interface WorkoutDay {
  day: string | number;
  focus: string;
  exercises: Exercise[];
  // For backward compatibility
  target?: string;
}

interface WorkoutPlan {
  id?: string;
  weeklySchedule?: WorkoutDay[];
  warmUp?: string[];
  coolDown?: string[];
  progressionPlan?: {
    [key: string]: string;
  };
  // Support for legacy API format
  workoutDays?: {
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
  weeklySchedule: [
    {
      day: "Day 1",
      focus: "Full Body",
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
          description: "Start in a push-up position, then bend your elbows and rest your weight on your forearms. Keep your body in a straight line from head to feet."
        }
      ]
    },
    {
      day: "Day 2",
      focus: "Rest Day",
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
      focus: "Full Body",
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
  // Add new state for selected day
  const [selectedDay, setSelectedDay] = useState<string | number>("");
  // Add state for expanded sections in the exercise detail modal
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  // Add state for selected exercise and modal visibility
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [exerciseModalVisible, setExerciseModalVisible] = useState(false);
  // Add state to track if workouts need to be generated
  const [workoutsGenerated, setWorkoutsGenerated] = useState<boolean | null>(null);

  // Animation states
  const [celebrationVisible, setCelebrationVisible] = useState(false);
  const [celebrationType, setCelebrationType] = useState<'success' | 'achievement' | 'streak' | 'confetti'>('success');
  const [celebrationMessage, setCelebrationMessage] = useState('');

  // Remove this useEffect for debugging the modal
  /* useEffect(() => {
    if (exerciseModalVisible) {
      console.log("EFFECT: Modal became visible");
      console.log("EFFECT: selectedExercise state:", selectedExercise ? {
        name: selectedExercise.name,
        sets: selectedExercise.sets,
        reps: selectedExercise.reps,
        rest: selectedExercise.rest,
        description: selectedExercise.description ? "Has description" : "No description",
        alternatives: selectedExercise.alternatives ? `Has ${selectedExercise.alternatives.length} alternatives` : "No alternatives"
      } : "null");
    }
  }, [exerciseModalVisible]); */

  // User preferences from profile data for workout generation
  const userPreferences = {
    // Core preferences from scalar fields
    fitnessLevel: (profile?.fitness_level || "beginner") as "beginner" | "intermediate" | "advanced",
    exerciseFrequency: profile?.workout_days_per_week || 3,
    timePerSession: profile?.workout_duration_minutes || 30,
    
    // Location and equipment from workout_preferences JSONB
    workoutLocation: (profile?.workout_preferences?.workout_location || "home") as "home" | "gym" | "outdoors" | "anywhere",
    // For gym location, we use standard equipment; otherwise use specified equipment
    availableEquipment: profile?.workout_preferences?.workout_location === 'gym' 
      ? ["standard gym equipment"] 
      : (profile?.workout_preferences?.equipment || ["bodyweight", "dumbbells"]),
    
    // Goals and limitations
    focusAreas: profile?.fitness_goals || ["full body"],
    exercisesToAvoid: profile?.workout_preferences?.exercises_to_avoid?.join(", ") || "",
    
    // Demographics
    age: profile?.age || null,
    gender: profile?.gender || null,
    weight_kg: profile?.weight_kg || null,
    height_cm: profile?.height_cm || null
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
      
      // Display feedback to the user
      console.log("🔄 [WORKOUT] Starting workout plan generation...");
      
      // Make sure we have valid preferences
      if (!userPreferences || !userPreferences.fitnessLevel) {
        throw new Error("Missing required workout preferences");
      }
      
      // Use the reliable workout generator service
      const newPlan = await reliableWorkoutGenerator.generateWorkoutPlan(userPreferences);
      
      // Check if the plan is a fallback plan (indicating partial failure)
      if (newPlan && 'fallbackReason' in newPlan) {
        console.log("⚠️ [WORKOUT] Received fallback plan:", (newPlan as any).fallbackReason);
        
        // Still use the fallback plan but ensure it matches WorkoutPlan type
        const typedPlan: WorkoutPlan = {
          ...newPlan,
          weeklySchedule: newPlan.weeklySchedule?.map(day => ({
            day: day.day || 'Unknown',
            focus: day.focus || 'General',
            exercises: day.exercises || [],
            isCompleted: false,
            inProgress: false
          })) || []
        };
        
        setWorkoutPlan(typedPlan);
        saveWorkoutPlan(typedPlan);
        return;
      }
      
      // Validate the plan
      if (!newPlan || !newPlan.weeklySchedule || newPlan.weeklySchedule.length === 0) {
        setError({
          title: "Invalid Workout Plan",
          message: "The workout plan couldn't be generated properly. Please try again.",
          isRetryable: true
        });
        return;
      }
      
      // Plan generated successfully - ensure it matches WorkoutPlan type
      console.log("✅ [WORKOUT] Workout plan generated successfully");
      
      const typedPlan: WorkoutPlan = {
        ...newPlan,
        weeklySchedule: newPlan.weeklySchedule.map(day => ({
          day: day.day || 'Unknown',
          focus: day.focus || 'General',
          exercises: day.exercises || [],
          isCompleted: false,
          inProgress: false
        }))
      };
      
      setWorkoutPlan(typedPlan);
      saveWorkoutPlan(typedPlan);
      
      // Set the first day as selected by default
      if (typedPlan.weeklySchedule && typedPlan.weeklySchedule.length > 0) {
        setSelectedDay(typedPlan.weeklySchedule[0].day);
      }
      
    } catch (err) {
      console.error('❌ [WORKOUT] Error generating workout plan:', err);
      
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
      // Skip if we're already loading
      if (loading) return;

      try {
        setLoading(true);
        
        if (profile?.workout_plan) {
          let plan = profile.workout_plan as WorkoutPlan;
          
          // Basic validation of the workout plan structure
          if (!plan || !plan.weeklySchedule || !Array.isArray(plan.weeklySchedule) || plan.weeklySchedule.length === 0) {
            setWorkoutsGenerated(false);
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
          setWorkoutsGenerated(true);
          
          // Generate summary if it doesn't exist yet
          if (!profile.workout_summary) {
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
          setWorkoutsGenerated(false);
        }
      } catch (err) {
        console.error("Error loading workout plan:", err);
        setWorkoutsGenerated(false);
      } finally {
        setLoading(false);
      }
    };
    
    // Only run if we have a profile
    if (profile && profile.id) {
      loadWorkoutPlan();
    }
  }, [profile?.id]); // Only depend on profile.id, not the entire profile object
  
  // Add effect to redirect to workout generator if no workouts are generated
  useEffect(() => {
    if (workoutsGenerated === false && !loading) {
      // Show workout generator UI instead of workouts
      console.log("No workouts generated, showing workout generator UI");
    }
  }, [workoutsGenerated, loading]);

  // Load workout completion data from the database
  const loadWorkoutCompletionData = async () => {
    if (!user || !workoutPlan) return;
    
    setLoadingTrackingData(true);
    
    try {
      const today = new Date(); // Use Date object for isWorkoutCompleted
      const completionStatus: Record<string, boolean> = {};
      
      console.log('Loading workout completion data for:', format(today, 'yyyy-MM-dd'));
      
      // Initialize structure for all workout days
      for (const day of getWorkoutDays()) {
        completionStatus[day.day] = false;
      }
      
      // Check completions by day name
      for (const day of getWorkoutDays()) {
        // Convert day.day to string for consistency and pass it as day name
        const dayName = String(day.day);
        
        try {
          console.log(`Checking completion status for workout day: ${dayName}`);
          const isCompleted = await isWorkoutCompleted(user.id, today, dayName);
          console.log(`Day ${dayName} completion status:`, isCompleted);
          completionStatus[day.day] = isCompleted;
        } catch (err) {
          console.error(`Error checking completion for day ${dayName}:`, err);
          // Continue with other days even if one fails
        }
      }
      
      console.log('Final workout completion status:', completionStatus);
      setCompletedWorkouts(completionStatus);
      
      // If we have a selected day, check if it's already completed to update UI
      if (selectedDay && completionStatus[selectedDay]) {
        console.log(`Selected day ${selectedDay} is already completed`);
      }
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
      
      // Immediately update UI state for better user feedback
      setCompletedWorkouts(prev => ({
        ...prev,
        [dayName]: true
      }));
      
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
      
      // Prepare workout completion data including the workout_day_name
      const completionData = {
        date: today,
        day_number: dayNum,
        day_name: day.day,
        workout_day_name: day.day, // Ensure this matches the parameter in trackingService
        focus_area: getWorkoutFocus(day),
        completed: true
      };
      
      // Mark workout as complete in the database
      const result = await markWorkoutComplete(
        user.id,
        today,
        dayNum, // Use numeric day index
        workoutPlan.id || 'workout_plan_1',
        completionData // Pass workout details
      );
      
      if (result) {
        console.log('Workout marked as complete in database:', result);
        
        // Double-check for UI consistency
        setCompletedWorkouts(prev => {
          const updatedState = {
            ...prev,
            [dayName]: true
          };
          console.log('Final completedWorkouts state:', updatedState);
          return updatedState;
        });
        
        // Emit event to notify other components (like Home tab) that a workout was completed
        EventRegister.emit('workoutCompleted', {
          userId: user.id,
          date: today,
          workoutName: day.day,
          dayNumber: dayNum,
          dayName: day.day,
          focusArea: getWorkoutFocus(day),
          completed: true,
          workoutPlanId: workoutPlan.id || 'workout_plan_1'
        });
        
        // Determine celebration type based on streak or achievements
        let celebrationType: 'success' | 'achievement' | 'streak' | 'confetti' = 'success';
        let message = `${getWorkoutFocus(day)} workout completed!`;
        
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
          setSnackbarMessage(`${getWorkoutFocus(day)} workout completed! Great job!`);
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
      console.log('Workout plan changed, loading completion data');
      // Load immediately for better UX
      loadWorkoutCompletionData();
    }
  }, [workoutPlan?.id]); // Only depend on workoutPlan.id, not the entire object
  
  // Add an additional effect to refresh completion data when completingWorkout changes to false
  useEffect(() => {
    if (!completingWorkout && workoutPlan) {
      console.log('Workout completion state changed, reloading completion data');
      // Short delay to ensure database has been updated
      const timer = setTimeout(() => {
        loadWorkoutCompletionData();
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [completingWorkout]);

  // Safely access nested properties
  const safelyAccess = <T extends unknown>(obj: any, path: string, defaultValue: T): T => {
    try {
      return path.split('.').reduce((o, p) => (o && o[p] !== undefined) ? o[p] : null, obj) || defaultValue;
    } catch (e) {
      return defaultValue;
    }
  };

  // Toggle section function for the modal
  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };
  
  // Function to open exercise detail modal
  const openExerciseDetail = (exercise: Exercise) => {
    const enhancedExercise = {
      ...exercise,
      // Format rest property correctly - handle both "rest" and "restSeconds" properties
      rest: exercise.rest || (exercise.restSeconds ? `${exercise.restSeconds} seconds` : "60 seconds"),
      description: exercise.description || getDefaultDescription(exercise.name),
      alternatives: exercise.alternatives || getDefaultAlternatives(exercise.name),
      // Ensure we have sets and reps
      sets: exercise.sets || 3,
      reps: exercise.reps || "10-12"
    };
    
    // Reset modal state first to avoid stale data
    setSelectedExercise(null);
    setExerciseModalVisible(false);
    
    // Use a timeout to ensure the state is properly reset before setting new data
    setTimeout(() => {
      setSelectedExercise(enhancedExercise);
      setExpandedSections({
        'modal-description': true,
        'modal-alternatives': true
      });
      setExerciseModalVisible(true);
    }, 100); // Increased timeout for better state separation
  };

  // Get default description for an exercise
  const getDefaultDescription = (exerciseName: string): string => {
    // Default descriptions for common exercises
    switch (exerciseName?.toLowerCase()) {
      case 'dumbbell squats':
        return "Stand with feet shoulder-width apart, holding dumbbells at shoulder height. Lower your body by bending your knees and pushing your hips back as if sitting in a chair. Keep your chest up and back straight. Push through your heels to return to standing position.";
      case 'dumbbell romanian deadlifts':
        return "Stand with feet hip-width apart holding dumbbells in front of thighs. Hinge at the hips, sending them backward while maintaining a flat back and slightly bent knees. Lower the weights toward the floor until you feel a stretch in your hamstrings. Return to starting position by driving hips forward and squeezing glutes.";
      case 'plank':
        return "Start in a push-up position, then bend your elbows 90 degrees and rest your weight on your forearms. Keep your body in a straight line from head to feet. Engage your core by sucking your belly button into your spine. Hold this position for the prescribed time.";
      case 'dumbbell rows':
        return "Place one knee and hand on a bench with your back parallel to the ground. Hold a dumbbell in your free hand, arm extended toward the floor. Pull the weight up toward your hip, keeping your elbow close to your body. Lower back to starting position with control.";
      default:
        return "Perform this exercise with proper form, maintaining control throughout the movement. Focus on the target muscles and ensure proper breathing - exhale during exertion and inhale during the easier phase.";
    }
  };
  
  // Get default alternatives for an exercise
  const getDefaultAlternatives = (exerciseName: string): string[] => {
    // Default alternatives for common exercises
    switch (exerciseName?.toLowerCase()) {
      case 'dumbbell squats':
        return ["Goblet Squats", "Barbell Squats", "Bodyweight Squats"];
      case 'dumbbell romanian deadlifts':
        return ["Barbell Romanian Deadlifts", "Single-Leg Romanian Deadlifts", "Good Mornings"];
      case 'plank':
        return ["Forearm Side Plank", "Mountain Climbers", "Bird Dog"];
      case 'dumbbell rows':
        return ["Barbell Rows", "Cable Rows", "Resistance Band Rows"];
      default:
        return ["Try a similar exercise targeting the same muscle group", "Adjust the weight or resistance to match your fitness level", "Consider machine alternatives if available"];
    }
  };

  // Get workout days safely
  const getWorkoutDays = () => {
    if (!workoutPlan) return [];
    // Access the correct property based on the WorkoutPlan interface
    return workoutPlan.weeklySchedule || [];
  };

  // Helper to safely get the workout day's target focus, handling inconsistent property names
  const getWorkoutFocus = (day: any): string => {
    // Handle both 'target' and 'focus' property names for backward compatibility
    return day.focus || day.target || 'General';
  };

  // Find the day with the target muscle group
  const findDayByTarget = (targetMuscleGroup: string) => {
    if (!workoutPlan) return null;
    
    // Find a day that focuses on the target muscle group
    const day = getWorkoutDays().find(day => {
      const focus = getWorkoutFocus(day);
      return focus.toLowerCase().includes(targetMuscleGroup.toLowerCase());
    });
    
    return day || null;
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
      const focuses = plan.weeklySchedule.map(day => getWorkoutFocus(day));
      
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

  // Find the selected day's plan - use the first day as default if none selected
  const selectedWorkoutDay = React.useMemo(() => {
    const days = getWorkoutDays();
    
    if (days.length === 0) return null;
    
    if (!selectedDay && days.length > 0) {
      // Set the default selected day on first load
      setSelectedDay(days[0].day);
      return days[0];
    }
    
    return days.find(day => day.day === selectedDay) || days[0];
  }, [workoutPlan, selectedDay]);

  return (
    <SafeAreaView style={styles.container} edges={['right', 'left']}>
      <StatusBar style="light" />
      
      {/* Gradient Background */}
      <LinearGradient
        colors={[colors.primary.dark, colors.background.primary]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.3 }}
      />
      
      {/* Header */}
      <View style={styles.header}>
        <View>
          <StyledText variant="headingLarge" style={styles.title}>
            {workoutsGenerated === false ? 'Create Workout Plan' : 'Workout Plan'}
          </StyledText>
        </View>
        <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}>
        <LinearGradient
            colors={[colors.primary.main, colors.secondary.main]}
            style={styles.profileGradient}
          start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Avatar.Text 
              size={40} 
              label={profile?.full_name ? profile.full_name.substring(0, 2).toUpperCase() : 'U'} 
              style={styles.profileAvatar}
              labelStyle={styles.profileLabel}
            />
          </LinearGradient>
              </TouchableOpacity>
      </View>

      {/* Main Content */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary.main} />
            <StyledText variant="bodyMedium" style={styles.loadingText}>Loading your workout plan...</StyledText>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <LinearGradient
              colors={[colors.surface.light, colors.surface.main]}
              style={styles.errorCard}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <MaterialCommunityIcons name="alert-circle" size={40} color={colors.feedback.error} />
              <StyledText variant="bodyLarge" style={styles.errorTitle}>{error.title || 'Error'}</StyledText>
              <StyledText variant="bodyMedium" style={styles.errorMessage}>{error.message || 'Failed to load workout plan'}</StyledText>
              {error.isRetryable && (
                <TouchableOpacity 
                  style={styles.retryButton}
                  onPress={handleGeneratePlan}
                >
              <LinearGradient
                    colors={[colors.primary.main, colors.primary.dark]}
                    style={styles.gradientButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                    <StyledText variant="bodyMedium" style={styles.buttonText}>Try Again</StyledText>
              </LinearGradient>
                </TouchableOpacity>
              )}
            </LinearGradient>
          </View>
        ) : workoutsGenerated === false ? (
          // Workout Generator UI when no workouts are available
          <View style={styles.generateWorkoutContainer}>
            <FadeIn from={0} duration={800}>
              <LinearGradient
                colors={[colors.surface.light, colors.surface.main]}
                style={styles.programCard}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <StyledText variant="headingMedium" style={styles.sectionTitle}>
                  Generate Your Workout Plan
                </StyledText>
                
                <View style={styles.programDetailsContainer}>
                  <StyledText variant="bodyLarge" style={styles.programDescription}>
                    Create a personalized workout plan based on your preferences and fitness level.
                  </StyledText>
                  
                  <View style={styles.generateIllustrationContainer}>
                    <MaterialCommunityIcons 
                      name="dumbbell" 
                      size={80} 
                      color={colors.primary.main} 
                      style={styles.generateIcon}
                    />
                  </View>
                  
                  <StyledText variant="bodyMedium" style={styles.generateText}>
                    We'll create a custom workout plan tailored to your:
                  </StyledText>
                  
                  <View style={styles.benefitsList}>
                    <View style={styles.benefitItem}>
                      <MaterialCommunityIcons name="check-circle" size={24} color={colors.accent.green} />
                      <StyledText variant="bodyMedium" style={styles.benefitText}>Fitness level: {profile?.fitness_level || 'Beginner'}</StyledText>
                    </View>
                    <View style={styles.benefitItem}>
                      <MaterialCommunityIcons name="check-circle" size={24} color={colors.accent.green} />
                      <StyledText variant="bodyMedium" style={styles.benefitText}>Location: {profile?.workout_preferences?.workout_location || 'Home'}</StyledText>
                    </View>
                    <View style={styles.benefitItem}>
                      <MaterialCommunityIcons name="check-circle" size={24} color={colors.accent.green} />
                      <StyledText variant="bodyMedium" style={styles.benefitText}>
                        Equipment: {Array.isArray(profile?.workout_preferences?.equipment || profile?.workout_preferences?.equipment_available) 
                          ? (profile?.workout_preferences?.equipment || profile?.workout_preferences?.equipment_available).join(', ') 
                          : 'Bodyweight'}
                      </StyledText>
                    </View>
                    <View style={styles.benefitItem}>
                      <MaterialCommunityIcons name="check-circle" size={24} color={colors.accent.green} />
                      <StyledText variant="bodyMedium" style={styles.benefitText}>Focus Areas: {(profile?.fitness_goals || ['Full Body']).join(', ')}</StyledText>
                    </View>
                  </View>
                  
                  <TouchableOpacity 
                    style={styles.generateButton}
                    onPress={handleGeneratePlan}
                  >
                    <LinearGradient
                      colors={[colors.primary.main, colors.primary.dark]}
                      style={styles.gradientButton}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <StyledText variant="bodyLarge" style={styles.buttonText}>
                        Generate My Workout Plan
                      </StyledText>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </LinearGradient>
            </FadeIn>
          </View>
        ) : (
          <>
            {/* Program Info Card */}
            <FadeIn from={0} duration={800}>
              <LinearGradient
                colors={[colors.surface.light, colors.surface.main]}
                style={styles.programCard}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <StyledText variant="headingMedium" style={styles.sectionTitle}>
                  Your Workout Program
                </StyledText>
                
                <View style={styles.programDetailsContainer}>
                  <StyledText variant="bodyLarge" style={styles.programDescription}>
                    Here's your personalized workout plan based on your preferences:
                  </StyledText>
                  
                  <View style={styles.detailItem}>
                    <View style={styles.iconContainer}>
                      <MaterialCommunityIcons name="trophy" size={24} color={colors.accent.gold} />
                  </View>
                    <StyledText variant="bodyLarge" style={styles.detailText}>
                      Level: {profile?.fitness_level || 'beginner'}
                    </StyledText>
                  </View>
                  
                  <View style={styles.detailItem}>
                    <View style={styles.iconContainer}>
                      <MaterialCommunityIcons name="map-marker" size={24} color={colors.accent.lavender} />
                  </View>
                    <StyledText variant="bodyLarge" style={styles.detailText}>
                      Location: {profile?.workout_preferences?.workout_location || 'home'}
                    </StyledText>
                  </View>
                  
                  <View style={styles.detailItem}>
                    <View style={styles.iconContainer}>
                      <MaterialCommunityIcons name="target" size={24} color={colors.accent.green} />
                </View>
                    <StyledText variant="bodyLarge" style={styles.detailText}>
                      Focus: {profile?.fitness_goals?.[0] || 'weight-loss'}
                    </StyledText>
                  </View>
                  
                  <View style={styles.detailItem}>
                    <View style={styles.iconContainer}>
                      <MaterialCommunityIcons name="calendar-week" size={24} color={colors.secondary.main} />
                    </View>
                    <StyledText variant="bodyLarge" style={styles.detailText}>
                      Sessions per week: {profile?.workout_days_per_week || 3}
                    </StyledText>
                  </View>
                </View>
                
                <TouchableOpacity 
                  style={styles.regenerateButton}
                  onPress={handleGeneratePlan}
                >
                  <LinearGradient 
                    colors={[colors.primary.main, colors.primary.dark]}
                    style={styles.gradientButton}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <MaterialCommunityIcons name="refresh" size={20} color="#fff" style={{marginRight: 8}} />
                    <StyledText variant="bodyMedium" style={styles.buttonText}>Regenerate Plan</StyledText>
                  </LinearGradient>
                </TouchableOpacity>
              </LinearGradient>
            </FadeIn>
            
            {/* Day Selector - Horizontal Scrollbar */}
            <FadeIn from={0} duration={500}>
              <LinearGradient
                colors={[colors.surface.light, colors.surface.main]}
                style={styles.daySelectorCard}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.dayScrollContent}
                >
                  {getWorkoutDays().map((day, index) => (
                    <TouchableOpacity
                      key={`day-${index}`}
                      style={[
                        styles.dayButton,
                        selectedDay === day.day && styles.selectedDayButton
                      ]}
                      onPress={() => setSelectedDay(day.day)}
                    >
                      {selectedDay === day.day ? (
                        <LinearGradient
                          colors={[colors.primary.main, colors.primary.dark]}
                          style={styles.dayGradient}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                        >
                          <StyledText 
                            variant="bodyMedium" 
                            style={{color: colors.text.primary}}
                          >
                            {typeof day.day === 'string' ? day.day : `Day ${day.day}`}
                          </StyledText>
              </LinearGradient>
                      ) : (
                        <StyledText 
                          variant="bodyMedium" 
                          style={styles.dayText}
                        >
                          {typeof day.day === 'string' ? day.day : `Day ${day.day}`}
                        </StyledText>
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </LinearGradient>
            </FadeIn>
            
            {/* Selected Day's Target */}
            {selectedWorkoutDay && (
              <ScaleIn duration={600} delay={200}>
                <LinearGradient
                  colors={[colors.primary.main, colors.secondary.main]}
                  style={styles.targetCard}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <StyledText variant="headingSmall" style={styles.targetTitle}>
                    {getWorkoutFocus(selectedWorkoutDay)} Workout
                  </StyledText>
                  
                  <View style={styles.targetDetails}>
                    <View style={styles.targetDetail}>
                      <MaterialCommunityIcons name="dumbbell" size={24} color={colors.text.primary} />
                      <StyledText variant="headingMedium" style={styles.detailValue}>
                        {selectedWorkoutDay.exercises?.length || 0}
                      </StyledText>
                      <StyledText variant="bodySmall" style={styles.detailLabel}>
                        exercises
                      </StyledText>
                    </View>
                    
                    <View style={styles.targetDetail}>
                      <MaterialCommunityIcons name="clock-outline" size={24} color={colors.text.primary} />
                      <StyledText variant="headingMedium" style={styles.detailValue}>
                        {userPreferences.timePerSession}
                      </StyledText>
                      <StyledText variant="bodySmall" style={styles.detailLabel}>
                        minutes
                      </StyledText>
                    </View>
                    
                    <View style={styles.targetDetail}>
                      <MaterialCommunityIcons 
                        name={completedWorkouts[String(selectedWorkoutDay.day)] ? "check-circle" : "timer-sand"} 
                        size={24} 
                        color={completedWorkouts[String(selectedWorkoutDay.day)] ? colors.accent.green : colors.text.primary} 
                      />
                      <StyledText 
                        variant="bodyMedium" 
                        style={{
                          ...styles.statusLabel,
                          color: completedWorkouts[String(selectedWorkoutDay.day)] ? colors.accent.green : colors.text.primary
                        }}
                      >
                        {completedWorkouts[String(selectedWorkoutDay.day)] ? "Completed" : "In Progress"}
                      </StyledText>
                    </View>
                  </View>
                </LinearGradient>
              </ScaleIn>
            )}
            
            {/* Warm-up Section */}
            {workoutPlan?.warmUp && workoutPlan.warmUp.length > 0 && (
              <ScaleIn duration={500} delay={250}>
              <LinearGradient
                  colors={[colors.surface.light, colors.surface.main]}
                  style={{
                    borderRadius: borderRadius.lg,
                    marginBottom: spacing.lg,
                    overflow: 'hidden',
                    elevation: 3,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 4
                  }}
                start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: spacing.md,
                    borderBottomWidth: 1,
                    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
                  }}>
                    <MaterialCommunityIcons name="fire" size={24} color={colors.accent.gold} style={{ marginRight: spacing.sm }} />
                    <StyledText variant="headingSmall" style={{
                      color: colors.text.primary,
                      fontWeight: 'bold',
                    }}>
                      Warm-up
                    </StyledText>
                </View>
                  
                  <View style={{ padding: spacing.md }}>
                    {workoutPlan.warmUp.map((item, index) => (
                      <View key={`warmup-${index}`} style={{
                        flexDirection: 'row',
                        alignItems: 'flex-start',
                        marginBottom: spacing.sm,
                      }}>
                        <View style={{
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: colors.accent.gold,
                          marginRight: spacing.sm,
                          marginTop: 8,
                        }} />
                        <StyledText variant="bodyMedium" style={{
                          color: colors.text.secondary,
                          flex: 1,
                        }}>
                          {item}
                        </StyledText>
                    </View>
                    ))}
                  </View>
                </LinearGradient>
              </ScaleIn>
            )}
            
            {/* Exercise Cards with Popup Functionality */}
            {selectedWorkoutDay?.exercises?.map((exercise, index) => (
              <ScaleIn key={`exercise-${index}`} duration={500} delay={300 + (index * 100)}>
                <TouchableOpacity
                  style={{
                    marginBottom: spacing.sm,
                    borderRadius: borderRadius.lg,
                    overflow: 'hidden',
                    elevation: 3,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 4
                  }}
                  onPress={() => openExerciseDetail(exercise)}
                >
              <LinearGradient
                    colors={[colors.surface.light, colors.surface.main]}
                    style={{
                      borderRadius: borderRadius.lg,
                    }}
                start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <View style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.sm,
                      borderBottomWidth: 1,
                      borderBottomColor: 'rgba(255, 255, 255, 0.1)',
                    }}>
                      <StyledText variant="bodyLarge" style={{
                        color: colors.text.primary,
                        fontWeight: '600',
                        flex: 1,
                      }}>
                        {exercise.name}
                      </StyledText>
                      <MaterialCommunityIcons 
                        name="chevron-right" 
                        size={20} 
                        color={colors.primary.main} 
                      />
                    </View>
                    
                    <View style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.sm,
                    }}>
                      <View style={{
                        alignItems: 'center',
                        paddingHorizontal: spacing.sm,
                      }}>
                        <StyledText variant="bodyMedium" style={{
                          color: colors.primary.main,
                          fontWeight: 'bold',
                        }}>
                          {exercise.sets}
                        </StyledText>
                        <StyledText variant="bodySmall" style={{
                          color: colors.text.muted,
                          fontSize: 12,
                        }}>
                          sets
                        </StyledText>
                      </View>
                      
                      <View style={{
                        alignItems: 'center',
                        paddingHorizontal: spacing.sm,
                      }}>
                        <StyledText variant="bodyMedium" style={{
                          color: colors.primary.main,
                          fontWeight: 'bold',
                          fontSize: typeof exercise.reps === 'string' && String(exercise.reps).length > 5 ? 12 : 16
                        }}>
                          {typeof exercise.reps === 'string' ? exercise.reps : `${exercise.reps}`}
                        </StyledText>
                        <StyledText variant="bodySmall" style={{
                          color: colors.text.muted,
                          fontSize: 12,
                        }}>
                          reps
                        </StyledText>
                      </View>
                      
                      <View style={{
                        alignItems: 'center',
                        paddingHorizontal: spacing.sm,
                      }}>
                        <StyledText variant="bodySmall" style={{
                          color: colors.text.primary,
                        }}>
                          {exercise.rest}
                        </StyledText>
                        <StyledText variant="bodySmall" style={{
                          color: colors.text.muted,
                          fontSize: 12,
                        }}>
                          rest
                        </StyledText>
                      </View>
                </View>
              </LinearGradient>
                </TouchableOpacity>
              </ScaleIn>
            ))}
            
            {/* Cool-down Section */}
            {workoutPlan?.coolDown && workoutPlan.coolDown.length > 0 && (
              <ScaleIn duration={500} delay={600}>
                <LinearGradient
                  colors={[colors.surface.light, colors.surface.main]}
                  style={{
                    borderRadius: borderRadius.lg,
                    marginBottom: spacing.lg,
                    overflow: 'hidden',
                    elevation: 3,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 4
                  }}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: spacing.md,
                    borderBottomWidth: 1,
                    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
                  }}>
                    <MaterialCommunityIcons name="snowflake" size={24} color={colors.accent.lavender} style={{ marginRight: spacing.sm }} />
                    <StyledText variant="headingSmall" style={{
                      color: colors.text.primary,
                      fontWeight: 'bold',
                    }}>
                      Cool-down
                    </StyledText>
                      </View>
                  
                  <View style={{ padding: spacing.md }}>
                    {workoutPlan.coolDown.map((item, index) => (
                      <View key={`cooldown-${index}`} style={{
                        flexDirection: 'row',
                        alignItems: 'flex-start',
                        marginBottom: spacing.sm,
                      }}>
                        <View style={{
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: colors.accent.lavender,
                          marginRight: spacing.sm,
                          marginTop: 8,
                        }} />
                        <StyledText variant="bodyMedium" style={{
                          color: colors.text.secondary,
                          flex: 1,
                        }}>
                          {item}
                        </StyledText>
                    </View>
                    ))}
                  </View>
                </LinearGradient>
              </ScaleIn>
            )}
            
            {/* Complete Workout Button */}
            {selectedWorkoutDay && (
              <TouchableOpacity
                style={[
                  styles.completeWorkoutButton,
                  completedWorkouts[String(selectedWorkoutDay.day)] ? 
                    styles.completedWorkoutButton : {}
                ]}
                onPress={() => handleCompleteWorkout(String(selectedWorkoutDay.day))}
                disabled={completingWorkout || completedWorkouts[String(selectedWorkoutDay.day)]}
              >
                <LinearGradient
                  colors={completedWorkouts[String(selectedWorkoutDay.day)]
                    ? [colors.accent.green, '#4CAF50']
                    : [colors.primary.main, colors.primary.dark]}
                  style={styles.gradientButton}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <MaterialCommunityIcons 
                    name={completedWorkouts[String(selectedWorkoutDay.day)] ? "check-circle" : "checkbox-marked-circle-outline"} 
                    size={24} 
                    color={completedWorkouts[String(selectedWorkoutDay.day)] ? '#FFFFFF' : colors.text.primary} 
                  />
                  <StyledText 
                    variant="bodyLarge" 
                    style={completedWorkouts[String(selectedWorkoutDay.day)] 
                      ? {...styles.buttonText, ...styles.completedButtonText}
                      : styles.buttonText}
                  >
                    {completedWorkouts[String(selectedWorkoutDay.day)] 
                      ? "Workout Completed" 
                      : completingWorkout ? "Marking..." : "Complete Workout"}
                  </StyledText>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>
      
      {/* Exercise Detail Modal - Final Optimized Version */}
      <Modal
        visible={exerciseModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setExerciseModalVisible(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <View style={{
            width: '90%',
            maxHeight: '80%',
            backgroundColor: '#1f1f2f',
            borderRadius: 16,
          }}>
            {/* Header */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: 'rgba(255, 255, 255, 0.1)',
              backgroundColor: '#2a2a42',
            }}>
              <TouchableOpacity 
                onPress={() => setExerciseModalVisible(false)}
                style={{ padding: 8 }}
              >
                <MaterialCommunityIcons name="close" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={{
                color: '#fff',
                fontSize: 20,
                fontWeight: 'bold',
                marginLeft: 16,
                flex: 1,
              }}>
                {selectedExercise?.name || "Exercise Details"}
              </Text>
            </View>
            
            {/* Content */}
            <View style={{flex: 1}}>
              {selectedExercise ? (
                <View style={{padding: 16}}>
                  {/* Stats Section */}
                  <View style={{
                    flexDirection: 'row',
                    backgroundColor: '#2a2a42',
                    borderRadius: 8,
                    padding: 16,
                    marginBottom: 16,
                    justifyContent: 'space-between',
                  }}>
                    <View style={{alignItems: 'center', flex: 1}}>
                      <Text style={{color: '#ff9f45', fontWeight: 'bold', marginBottom: 8}}>SETS</Text>
                      <Text style={{color: '#fff', fontSize: 20}}>{selectedExercise.sets || 3}</Text>
                    </View>
                    
                    <View style={{alignItems: 'center', flex: 1}}>
                      <Text style={{color: '#ff9f45', fontWeight: 'bold', marginBottom: 8}}>REPS</Text>
                      <Text style={{color: '#fff', fontSize: 18}}>
                        {selectedExercise.reps || "10-12"}
                      </Text>
                    </View>
                    
                    <View style={{alignItems: 'center', flex: 1}}>
                      <Text style={{color: '#ff9f45', fontWeight: 'bold', marginBottom: 8}}>REST</Text>
                      <Text style={{color: '#fff', fontSize: 18}}>{selectedExercise.rest || "60s"}</Text>
                    </View>
                  </View>
                  
                  {/* Description Section */}
                  <View style={{
                    backgroundColor: '#2a2a42',
                    borderRadius: 8,
                    padding: 16,
                    marginBottom: 16,
                  }}>
                    <Text style={{color: '#ff9f45', fontWeight: 'bold', marginBottom: 8}}>DESCRIPTION</Text>
                    <Text style={{color: '#fff', lineHeight: 22}}>
                      {selectedExercise.description || getDefaultDescription(selectedExercise.name)}
                    </Text>
                  </View>
                  
                  {/* Alternatives Section */}
                  <View style={{
                    backgroundColor: '#2a2a42',
                    borderRadius: 8,
                    padding: 16,
                  }}>
                    <Text style={{color: '#ff9f45', fontWeight: 'bold', marginBottom: 8}}>ALTERNATIVES</Text>
                    
                    {(selectedExercise.alternatives && selectedExercise.alternatives.length > 0) ?
                      selectedExercise.alternatives.map((alt, index) => (
                        <Text key={index} style={{color: '#fff', marginBottom: 6}}>• {alt}</Text>
                      )) :
                      getDefaultAlternatives(selectedExercise.name).map((alt, index) => (
                        <Text key={index} style={{color: '#fff', marginBottom: 6}}>• {alt}</Text>
                      ))
                    }
                  </View>
                </View>
              ) : (
                <View style={{padding: 24, alignItems: 'center'}}>
                  <MaterialCommunityIcons name="alert-circle" size={32} color="#ff5555" />
                  <Text style={{color: '#fff', marginTop: 12}}>No exercise details available</Text>
                </View>
              )}
            </View>
            
            {/* Close button */}
            <TouchableOpacity
              style={{
                margin: 16,
                backgroundColor: colors.primary.main,
                padding: 12,
                borderRadius: 8,
                alignItems: 'center'
              }}
              onPress={() => setExerciseModalVisible(false)}
            >
              <Text style={{color: 'white', fontWeight: 'bold'}}>CLOSE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      
      {/* Snackbar for notifications */}
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        style={styles.snackbar}
      >
        {snackbarMessage}
      </Snackbar>
      
      {/* Celebration animation */}
      <Celebration 
        visible={celebrationVisible} 
        type={celebrationType} 
        message={celebrationMessage} 
      />
    </SafeAreaView>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  title: {
    color: colors.text.primary,
    fontSize: 32,
    fontWeight: 'bold',
  },
  profileGradient: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.medium,
  },
  profileAvatar: {
    backgroundColor: 'transparent',
  },
  profileLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.text.secondary,
  },
  errorContainer: {
    paddingVertical: spacing.xl,
  },
  errorCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadows.medium,
  },
  errorTitle: {
    color: colors.feedback.error,
    marginTop: spacing.md,
    fontWeight: 'bold',
  },
  errorMessage: {
    marginTop: spacing.sm,
    textAlign: 'center',
    color: colors.text.secondary,
  },
  retryButton: {
    marginTop: spacing.lg,
    borderRadius: borderRadius.round,
    overflow: 'hidden',
  },
  programCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    ...shadows.medium,
  },
  programDetailsContainer: {
    marginTop: spacing.md,
  },
  programDescription: {
    marginBottom: spacing.md,
    color: colors.text.secondary,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xs,
  },
  iconContainer: {
    width: 32,
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  detailText: {
    color: colors.text.primary,
  },
  regenerateButton: {
    marginTop: spacing.lg,
    alignSelf: 'flex-end',
    borderRadius: borderRadius.round,
    overflow: 'hidden',
  },
  gradientButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
  },
  sectionCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.small,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    color: colors.text.primary,
    marginLeft: spacing.sm,
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xs,
  },
  exerciseBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.secondary.light,
    marginRight: spacing.sm,
  },
  dayContainer: {
    marginBottom: spacing.lg,
  },
  dayHeader: {
    marginBottom: spacing.sm,
  },
  dayIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayName: {
    color: colors.text.primary,
    marginLeft: spacing.sm,
  },
  focusText: {
    color: colors.text.muted,
    marginTop: 2,
    marginLeft: spacing.xl + 2,
  },
  exercisesCard: {
    borderRadius: borderRadius.lg,
    ...shadows.medium,
    overflow: 'hidden',
  },
  exerciseContainer: {
    padding: spacing.lg,
  },
  exerciseDivider: {
    height: 1,
    backgroundColor: colors.border.light,
  },
  exerciseName: {
    color: colors.text.primary,
    fontWeight: '600',
    flex: 1,
  },
  exerciseDetails: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  exerciseStat: {
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  statValue: {
    color: colors.primary.main,
    fontWeight: 'bold',
  },
  statLabel: {
    color: colors.text.muted,
    fontSize: 12,
  },
  restContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  restText: {
    color: colors.text.muted,
    marginLeft: spacing.xs,
  },
  alternativesContainer: {
    marginTop: spacing.xs,
  },
  alternativesLabel: {
    color: colors.text.secondary,
    fontWeight: 'bold',
  },
  alternativesText: {
    color: colors.text.muted,
  },
  markCompleteButton: {
    margin: spacing.lg,
    borderRadius: borderRadius.round,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  snackbar: {
    backgroundColor: colors.surface.dark,
  },
  daySelectorCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadows.medium,
  },
  dayScrollContent: {
    paddingHorizontal: spacing.md,
  },
  dayButton: {
    padding: spacing.md,
    borderRadius: borderRadius.round,
    marginRight: spacing.sm,
  },
  dayGradient: {
    flex: 1,
    borderRadius: borderRadius.round,
  },
  dayText: {
    color: colors.text.primary,
  },
  selectedDayButton: {
    backgroundColor: colors.primary.main,
  },
  selectedDayText: {
    color: colors.text.primary,
  },
  targetCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.medium,
  },
  targetTitle: {
    color: colors.text.primary,
    marginBottom: spacing.md,
    fontWeight: 'bold',
  },
  targetDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  targetDetail: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailValue: {
    color: colors.text.primary,
  },
  detailLabel: {
    color: colors.text.muted,
  },
  statusLabel: {
    color: colors.text.primary,
  },
  exerciseCardContainer: {
    marginBottom: spacing.md,
  },
  exerciseCard: {
    borderRadius: borderRadius.lg,
    ...shadows.medium,
    overflow: 'hidden',
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  exercisePreviewDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  restValue: {
    color: colors.text.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.surface.dark,
    borderRadius: borderRadius.lg,
    width: '90%',
    maxHeight: '75%',
    ...shadows.medium,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  closeButton: {
    padding: spacing.xs,
  },
  modalTitle: {
    color: colors.text.primary,
    marginLeft: spacing.sm,
    fontWeight: 'bold',
    flex: 1,
  },
  exerciseModalStat: {
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  exerciseDetailStatValue: {
    color: colors.text.primary,
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: spacing.xs,
  },
  exerciseDetailStatLabel: {
    color: colors.text.secondary,
    fontSize: 12,
  },
  completeWorkoutButton: {
    marginTop: 20,
    marginBottom: 40,
    paddingHorizontal: 16,
  },
  completedWorkoutButton: {
    opacity: 1, // Keep it fully visible even when completed
  },
  sectionHeaderTitle: {
    color: colors.text.primary,
    marginLeft: spacing.sm,
  },
  generateWorkoutContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  generateIllustrationContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  generateIcon: {
    opacity: 0.8,
  },
  generateText: {
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  benefitsList: {
    marginBottom: spacing.md,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  benefitText: {
    color: colors.text.primary,
    marginLeft: spacing.sm,
  },
  generateButton: {
    borderRadius: borderRadius.round,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  completedButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});
