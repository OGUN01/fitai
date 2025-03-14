import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../../../contexts/AuthContext';
import { useProfile } from '../../../contexts/ProfileContext';
import { format, isToday, parseISO } from 'date-fns';
import supabase from '../../../lib/supabase';
import { colors, spacing } from '../../../theme/theme';
import ModernHomeScreen from '../../../components/home/ModernHomeScreen';

/**
 * Home screen - main entry point for the Home tab
 * Redesigned with Bold Minimalism design philosophy
 */
export default function HomeScreen() {
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const [loading, setLoading] = useState(true);
  const [workoutSummary, setWorkoutSummary] = useState<any>(null);
  const [mealSummary, setMealSummary] = useState<any>(null);
  const [workoutCompletionStatus, setWorkoutCompletionStatus] = useState<Record<string, boolean>>({});
  const [mealCompletionStatus, setMealCompletionStatus] = useState<Record<string, Record<string, boolean>>>({});
  const [motivationalQuote, setMotivationalQuote] = useState<string>("Every journey begins with a single step. You’re here, ready to start, and that’s the biggest win.");
  const [todayWorkoutCompleted, setTodayWorkoutCompleted] = useState(false);
  const [todayMealsCompleted, setTodayMealsCompleted] = useState(false);
  const [pendingMeals, setPendingMeals] = useState<string[]>(['Breakfast', 'Lunch', 'Dinner']);
  const [workoutScheduledForToday, setWorkoutScheduledForToday] = useState(true);
  const [todayWorkoutName, setTodayWorkoutName] = useState('Full Body');
  const [refreshing, setRefreshing] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [workoutStreak, setWorkoutStreak] = useState(0);
  
  // Initialize user profile data
  useEffect(() => {
    if (profile && !profileLoading) {
      setUserProfile(getUserStats());
      fetchData();
    }
  }, [profile, profileLoading]);
  
  useFocusEffect(
    React.useCallback(() => {
      if (profile) {
        fetchData();
      }
      return () => {};
    }, [profile])
  );
  
  // Fetch all data needed for the home screen
  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchWorkoutCompletions(),
        fetchMealCompletions(),
        fetchWorkoutSummary(),
        fetchMealSummary()
      ]);
    } catch (error) {
      console.error('Error fetching home data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Calculate user stats from profile data
  const getUserStats = () => {
    if (!profile) return null;
    
    // Extract user's name - use full_name if available, otherwise use email or "User"
    const name = profile.full_name || (user?.email?.split('@')[0] || "User");
    
    // Extract fitness goal
    const goal = profile.fitness_goal || "Get fit";
    
    // Get weight data with fallbacks
    let currentWeight = Number(profile.weight || profile.current_weight || 80);
    let targetWeight = Number(profile.target_weight || 70);
    let startWeight = Number(profile.starting_weight || profile.initial_weight || 85);
    
    // Calculate progress percentage
    let percentComplete = 0;
    if (currentWeight > 0 && targetWeight > 0 && startWeight !== targetWeight) {
      const totalChange = Math.abs(startWeight - targetWeight);
      const currentChange = Math.abs(startWeight - currentWeight);
      percentComplete = totalChange > 0 
        ? Math.min(100, Math.round((currentChange / totalChange) * 100))
        : 0;
    }
    
    return {
      name,
      goal,
      progress: {
        currentWeight: currentWeight.toFixed(1),
        startWeight: startWeight.toFixed(1),
        targetWeight: targetWeight.toFixed(1),
        percentComplete
      }
    };
  };

  // Fetch workout completions from Supabase
  const fetchWorkoutCompletions = async () => {
    if (!user) return;
    
    try {
      const { data: completions, error } = await supabase
        .from('workout_completions')
        .select('*')
        .eq('user_id', user.id);
      
      if (error) {
        console.error('Error fetching workout completions:', error);
        return;
      }
      
      // Create a map of day names to completion status
      const completionStatus: Record<string, boolean> = {};
      let todayCompleted = false;
      
      // Process completions
      if (completions && completions.length > 0) {
        // Sort by date
        const sortedCompletions = [...completions].sort((a, b) => 
          new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime()
        );
        
        // Count streak (simple implementation)
        let streak = 0;
        let lastDate: Date | null = null;
        
        sortedCompletions.forEach(completion => {
          const completionDate = parseISO(completion.completed_at);
          const dayName = completion.workout_day_name || `Day ${completion.day_number}`;
          
          completionStatus[dayName] = true;
          
          // Check if any workout was completed today
          if (isToday(completionDate)) {
            todayCompleted = true;
          }
          
          // Count streak
          if (lastDate === null) {
            streak = 1;
          } else {
            const dayDiff = Math.abs(
              (completionDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
            );
            if (dayDiff <= 1) {
              streak++;
            } else {
              streak = 1;
            }
          }
          lastDate = completionDate;
        });
        
        setWorkoutStreak(streak);
      }
      
      setWorkoutCompletionStatus(completionStatus);
      setTodayWorkoutCompleted(todayCompleted);
    } catch (error) {
      console.error('Error in fetchWorkoutCompletions:', error);
    }
  };

  // Fetch meal completions from Supabase
  const fetchMealCompletions = async () => {
    if (!user) return;
    
    try {
      const { data: completions, error } = await supabase
        .from('meal_completions')
        .select('*')
        .eq('user_id', user.id);
      
      if (error) {
        console.error('Error fetching meal completions:', error);
        return;
      }
      
      // Create a map of dates to meal types to completion status
      const completionStatusByDate: Record<string, Record<string, boolean>> = {};
      let allTodayMealsCompleted = true;
      const today = new Date().toISOString().split('T')[0];
      
      // Start with default pending meals
      const pendingTodayMeals = ['Breakfast', 'Lunch', 'Dinner'];
      
      if (completions && completions.length > 0) {
        completions.forEach(completion => {
          const completionDate = completion.completed_at.split('T')[0];
          
          if (!completionStatusByDate[completionDate]) {
            completionStatusByDate[completionDate] = {};
          }
          
          completionStatusByDate[completionDate][completion.meal_type.toLowerCase()] = true;
          
          // If this is today, update pending meals
          if (completionDate === today) {
            const mealType = completion.meal_type;
            const index = pendingTodayMeals.indexOf(mealType);
            if (index !== -1) {
              pendingTodayMeals.splice(index, 1);
            }
          }
        });
      }
      
      // Check if all meals for today are completed
      if (completionStatusByDate[today]) {
        const todayCompletions = completionStatusByDate[today];
        allTodayMealsCompleted = ['breakfast', 'lunch', 'dinner'].every(
          meal => todayCompletions[meal]
        );
      } else {
        allTodayMealsCompleted = false;
      }
      
      setMealCompletionStatus(completionStatusByDate);
      setTodayMealsCompleted(allTodayMealsCompleted);
      setPendingMeals(pendingTodayMeals);
    } catch (error) {
      console.error('Error in fetchMealCompletions:', error);
    }
  };

  // Fetch workout summary
  const fetchWorkoutSummary = async () => {
    if (!user) return;
    
    try {
      // First, check if the workout_plans table exists
      const { error: tableCheckError } = await supabase
        .from('workout_plans')
        .select('count')
        .limit(1)
        .single();
      
      if (tableCheckError && tableCheckError.code === '42P01') {
        // Table doesn't exist, use fallback data
        console.log('Workout plans table does not exist, using fallback data');
        const fallbackWorkoutPlan = [
          { day: 'Monday', workout: 'Upper Body', exercises: ['Push-ups', 'Pull-ups', 'Shoulder Press'] },
          { day: 'Tuesday', workout: 'Lower Body', exercises: ['Squats', 'Lunges', 'Calf Raises'] },
          { day: 'Wednesday', workout: 'Rest Day', exercises: [] },
          { day: 'Thursday', workout: 'Core', exercises: ['Planks', 'Crunches', 'Russian Twists'] },
          { day: 'Friday', workout: 'Full Body', exercises: ['Burpees', 'Mountain Climbers', 'Jumping Jacks'] },
          { day: 'Saturday', workout: 'Cardio', exercises: ['Running', 'Cycling', 'Jump Rope'] },
          { day: 'Sunday', workout: 'Rest Day', exercises: [] }
        ];
        
        setWorkoutSummary(fallbackWorkoutPlan);
        
        // Check if there's a workout scheduled for today
        const today = new Date();
        const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][today.getDay()];
        
        const todayWorkout = fallbackWorkoutPlan.find(workout => workout.day === dayName);
        if (todayWorkout) {
          setWorkoutScheduledForToday(true);
          setTodayWorkoutName(todayWorkout.workout || "Workout");
        } else {
          setWorkoutScheduledForToday(false);
        }
        
        return;
      }
      
      const { data, error } = await supabase
        .from('workout_plans')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (error) {
        console.error('Error fetching workout plan:', error);
        return;
      }
      
      if (data && data.length > 0 && data[0].plan) {
        let workoutPlan = data[0].plan;
        
        // Handle different data formats
        if (typeof workoutPlan === 'string') {
          try {
            workoutPlan = JSON.parse(workoutPlan);
          } catch (e) {
            console.error('Error parsing workout plan JSON:', e);
          }
        }
        
        setWorkoutSummary(workoutPlan);
        
        // Check if there's a workout scheduled for today
        const today = new Date();
        const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][today.getDay()];
        
        if (Array.isArray(workoutPlan)) {
          const todayWorkout = workoutPlan.find(workout => {
            if (!workout || !workout.day) return false;
            return workout.day === dayName;
          });
          
          if (todayWorkout) {
            setWorkoutScheduledForToday(true);
            setTodayWorkoutName(todayWorkout.target || todayWorkout.workout || "Workout");
          } else {
            setWorkoutScheduledForToday(false);
          }
        }
      }
    } catch (error) {
      console.error('Error in fetchWorkoutSummary:', error);
    }
  };

  // Fetch meal summary
  const fetchMealSummary = async () => {
    if (!user) return;
    
    try {
      // First, check if the meal_plans table exists
      const { error: tableCheckError } = await supabase
        .from('meal_plans')
        .select('count')
        .limit(1)
        .single();
      
      if (tableCheckError && tableCheckError.code === '42P01') {
        // Table doesn't exist, use fallback data
        console.log('Meal plans table does not exist, using fallback data');
        const fallbackMealPlan = {
          breakfast: ['Oatmeal with fruit', 'Greek yogurt with honey', 'Avocado toast'],
          lunch: ['Chicken salad', 'Quinoa bowl', 'Vegetable wrap'],
          dinner: ['Grilled salmon', 'Stir-fry vegetables', 'Pasta with tomato sauce'],
          snacks: ['Nuts', 'Fruit', 'Protein bar']
        };
        
        setMealSummary(fallbackMealPlan);
        return;
      }
      
      const { data, error } = await supabase
        .from('meal_plans')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (error) {
        console.error('Error fetching meal plan:', error);
        return;
      }
      
      if (data && data.length > 0 && data[0].plan) {
        let mealPlan = data[0].plan;
        
        // Handle different data formats
        if (typeof mealPlan === 'string') {
          try {
            mealPlan = JSON.parse(mealPlan);
          } catch (e) {
            console.error('Error parsing meal plan JSON:', e);
          }
        }
        
        setMealSummary(mealPlan);
      }
    } catch (error) {
      console.error('Error in fetchMealSummary:', error);
    }
  };
  
  // Generate motivational quote
  const refreshQuote = () => {
    const quotes = [
      "Every journey begins with a single step. You’re here, ready to start, and that’s the biggest win.",
      "Your only competition is the person you were yesterday.",
      "Small daily improvements are the key to long-term success.",
      "The harder you work for something, the greater you'll feel when you achieve it.",
      "Your body can stand almost anything. It's your mind you have to convince.",
      "Strength doesn't come from what you can do. It comes from overcoming the things you thought you couldn't."
    ];
    
    // Get a different quote than the current one
    let newQuote = motivationalQuote;
    while (newQuote === motivationalQuote && quotes.length > 1) {
      newQuote = quotes[Math.floor(Math.random() * quotes.length)];
    }
    setMotivationalQuote(newQuote);
  };
  
  // Find the next workout day
  const getNextWorkout = () => {
    if (!workoutSummary || !Array.isArray(workoutSummary) || workoutSummary.length === 0) {
      return {
        day: "Monday",
        name: "Upper Body",
        daysUntil: 3
      };
    }
    
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    // Find the next scheduled workout
    for (let i = 1; i <= 7; i++) {
      const nextDay = (dayOfWeek + i) % 7;
      const nextDayName = daysOfWeek[nextDay];
      
      const nextWorkout = workoutSummary.find((workout: any) => workout.day === nextDayName);
      
      if (nextWorkout) {
        return {
          day: nextDayName,
          name: nextWorkout.target || nextWorkout.workout || "Workout",
          daysUntil: i
        };
      }
    }
    
    // Default if no workouts are scheduled
    return {
      day: "Monday",
      name: "Upper Body",
      daysUntil: 3
    };
  };
  
  if (loading && !userProfile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary.main} />
      </View>
    );
  }

  // Pass the loaded data to our modern UI component
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea}>
        {userProfile && (
          <ModernHomeScreen 
            userStats={userProfile}
            workoutStats={{
              scheduledForToday: workoutScheduledForToday,
              todayCompleted: todayWorkoutCompleted,
              todayWorkoutName: todayWorkoutName,
              dayStreak: workoutStreak
            }}
            mealStats={{
              allCompleted: todayMealsCompleted,
              pendingMeals: pendingMeals
            }}
            nextWorkout={getNextWorkout()}
            motivationalQuote={motivationalQuote}
            onRefreshQuote={refreshQuote}
          />
        )}
      </SafeAreaView>
    </View>
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
  },
  safeArea: {
    flex: 1,
  }
});
