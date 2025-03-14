import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  Dimensions, 
  TouchableOpacity, 
  Platform 
} from 'react-native';
import { 
  Button, 
  useTheme, 
  SegmentedButtons, 
  TextInput, 
  Chip, 
  List, 
  Checkbox, 
  IconButton 
} from 'react-native-paper';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { workoutPreferencesSchema } from '../../constants/validation';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { z } from 'zod';
import { useProfile } from '../../contexts/ProfileContext';
import { WorkoutPreferences } from '../../types/profile';
import { LinearGradient } from 'expo-linear-gradient';
import StyledText from '../../components/ui/StyledText';
import { colors, spacing, borderRadius, shadows } from '../../theme/theme';

// Get screen dimensions for responsive sizing
const { width, height } = Dimensions.get('window');

// Define the type based on the Zod schema
type WorkoutPreferencesFormData = z.infer<typeof workoutPreferencesSchema>;

// Common equipment options
const equipmentOptions = [
  'Dumbbells', 'Barbell', 'Kettlebells', 'Resistance bands', 
  'Pull-up bar', 'Bench', 'Treadmill', 'Exercise bike', 
  'Rowing machine', 'Yoga mat', 'Medicine ball', 'Stability ball'
];

// Time options
const timeOptions = [
  'Early morning (5-7 AM)', 'Morning (7-10 AM)', 'Midday (10 AM-2 PM)', 
  'Afternoon (2-5 PM)', 'Evening (5-8 PM)', 'Night (8-11 PM)'
];

// Focus areas with icons
const focusAreaOptions = [
  { value: 'upper-body', label: 'Upper Body', icon: 'arm-flex' },
  { value: 'lower-body', label: 'Lower Body', icon: 'foot-print' },
  { value: 'core', label: 'Core', icon: 'stomach' },
  { value: 'cardio', label: 'Cardio', icon: 'heart-pulse' },
  { value: 'full-body', label: 'Full Body', icon: 'human' },
  { value: 'flexibility', label: 'Flexibility', icon: 'yoga' }
];

export default function WorkoutPreferencesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { profile, updateProfile } = useProfile();
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
  const [selectedFocusAreas, setSelectedFocusAreas] = useState<string[]>([]);
  const [submittedData, setSubmittedData] = useState<WorkoutPreferencesFormData | null>(null);
  const [navigateBack, setNavigateBack] = useState(false);
  const [recommendedAreas, setRecommendedAreas] = useState<string[]>([]);

  // Get URL params including returnToReview
  const params = useLocalSearchParams<{
    recommendedFocusAreas: string;
    returnToReview?: string;
  }>();

  const { control, handleSubmit, setValue, formState: { errors } } = useForm<WorkoutPreferencesFormData>({
    resolver: zodResolver(workoutPreferencesSchema),
    defaultValues: {
      fitnessLevel: 'beginner',
      workoutLocation: 'home',
      workoutDuration: 30,
      workoutFrequency: 3,
      availableEquipment: [],
      preferredWorkoutTimes: [],
      focusAreas: [],
      exercisesToAvoid: '',
    }
  });

  // Parse recommended focus areas from URL parameter
  useEffect(() => {
    if (params?.recommendedFocusAreas) {
      // Split comma-separated string into array
      const areas = params.recommendedFocusAreas.split(',');
      console.log('Recommended focus areas from URL:', areas);
      setRecommendedAreas(areas);

      // Pre-select recommended areas
      setSelectedFocusAreas(prev => {
        const newAreas = [...prev];
        areas.forEach(area => {
          if (!newAreas.includes(area)) {
            newAreas.push(area);
          }
        });
        return newAreas;
      });
    }
  }, [params?.recommendedFocusAreas]);

  // Update form values when selected items change
  useEffect(() => {
    setValue('availableEquipment', selectedEquipment);
  }, [selectedEquipment, setValue]);

  useEffect(() => {
    setValue('preferredWorkoutTimes', selectedTimes);
  }, [selectedTimes, setValue]);

  useEffect(() => {
    setValue('focusAreas', selectedFocusAreas);
  }, [selectedFocusAreas, setValue]);

  // Use effect to handle navigation after form submission
  useEffect(() => {
    if (submittedData && navigateBack) {
      // Navigation logic
      if (params?.returnToReview === 'true') {
        router.push('/(onboarding)/review');
      } else {
        // Complete the onboarding
        router.push('/(tabs)/');
      }
    }
  }, [submittedData, navigateBack, router, params]);

  const toggleEquipment = (equipment: string) => {
    setSelectedEquipment(prev => 
      prev.includes(equipment) 
        ? prev.filter(e => e !== equipment) 
        : [...prev, equipment]
    );
  };

  const toggleTime = (time: string) => {
    setSelectedTimes(prev => 
      prev.includes(time) 
        ? prev.filter(t => t !== time) 
        : [...prev, time]
    );
  };

  const toggleFocusArea = (area: string) => {
    setSelectedFocusAreas(prev => 
      prev.includes(area) 
        ? prev.filter(a => a !== area) 
        : [...prev, area]
    );
  };

  const onSubmit = (data: WorkoutPreferencesFormData) => {
    console.log('Workout preferences form data:', data);
    
    // Create a workout preferences object
    const workoutPreferences: Partial<WorkoutPreferences> = {
      fitness_level: data.fitnessLevel,
      workout_location: data.workoutLocation,
      workout_duration: data.workoutDuration,
      equipment: data.availableEquipment,
      preferred_days: data.preferredWorkoutTimes,
      focus_areas: data.focusAreas,
      exercises_to_avoid: data.exercisesToAvoid ? data.exercisesToAvoid.split(',').map(ex => ex.trim()) : [],
    };
    
    // Update profile with workout preferences
    updateProfile({
      workout_preferences: workoutPreferences as WorkoutPreferences,
      // Also store essential fields at root level
      fitness_level: data.fitnessLevel,
      workout_duration_minutes: data.workoutDuration,
      workout_days_per_week: data.workoutFrequency,
      has_completed_onboarding: true,
      current_onboarding_step: 'completed',
    }).then(() => {
      console.log('Profile updated with workout preferences');
      setSubmittedData(data);
      setNavigateBack(true);
    }).catch(error => {
      console.error('Error updating profile with workout preferences:', error);
      alert('There was an error saving your preferences. Please try again.');
    });
  };

  // Helper to check if an area is recommended
  const isRecommendedArea = (area: string) => {
    return recommendedAreas.includes(area);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient
        colors={[colors.background.primary, colors.background.secondary]}
        style={styles.background}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        {/* Decorative elements */}
        <View style={[styles.decorativeCircle, styles.decorativeCircle1]} />
        <View style={[styles.decorativeCircle, styles.decorativeCircle2]} />
        
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={() => router.back()}
            >
              <IconButton
                icon="arrow-left"
                size={24}
                iconColor={colors.text.primary}
                style={styles.backIcon}
              />
            </TouchableOpacity>
            <StyledText variant="headingLarge" style={styles.title}>
              Workout Preferences
            </StyledText>
            <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.subtitle}>
              Tell us how you want to train for a customized fitness plan
            </StyledText>
          </View>
          
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.formCard}>
              {/* Fitness Level */}
              <View style={styles.inputContainer}>
                <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.inputLabel}>
                  Fitness Level
                </StyledText>
                <Controller
                  control={control}
                  name="fitnessLevel"
                  render={({ field: { onChange, value } }) => (
                    <SegmentedButtons
                      value={value}
                      onValueChange={onChange}
                      buttons={[
                        { value: 'beginner', label: 'Beginner' },
                        { value: 'intermediate', label: 'Intermediate' },
                        { value: 'advanced', label: 'Advanced' },
                      ]}
                      style={styles.segmentedButtons}
                      theme={{ 
                        colors: { 
                          primary: colors.primary.main,
                          secondaryContainer: colors.surface.dark,
                          onSecondaryContainer: colors.text.primary,
                        } 
                      }}
                    />
                  )}
                />
                {errors.fitnessLevel && (
                  <StyledText variant="bodySmall" color={colors.feedback.error}>
                    {errors.fitnessLevel.message}
                  </StyledText>
                )}
              </View>

              {/* Workout Location */}
              <View style={styles.inputContainer}>
                <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.inputLabel}>
                  Workout Location
                </StyledText>
                <Controller
                  control={control}
                  name="workoutLocation"
                  render={({ field: { onChange, value } }) => (
                    <SegmentedButtons
                      value={value}
                      onValueChange={onChange}
                      buttons={[
                        { value: 'home', label: 'Home' },
                        { value: 'gym', label: 'Gym' },
                        { value: 'outdoors', label: 'Outdoors' },
                        { value: 'mix', label: 'Mix' },
                      ]}
                      style={styles.segmentedButtons}
                      theme={{ 
                        colors: { 
                          primary: colors.primary.main,
                          secondaryContainer: colors.surface.dark,
                          onSecondaryContainer: colors.text.primary,
                        } 
                      }}
                    />
                  )}
                />
                {errors.workoutLocation && (
                  <StyledText variant="bodySmall" color={colors.feedback.error}>
                    {errors.workoutLocation.message}
                  </StyledText>
                )}
              </View>

              {/* Workout Duration */}
              <View style={styles.inputContainer}>
                <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.inputLabel}>
                  Workout Duration (minutes)
                </StyledText>
                <Controller
                  control={control}
                  name="workoutDuration"
                  render={({ field: { onChange, value } }) => (
                    <SegmentedButtons
                      value={value.toString()}
                      onValueChange={(val) => onChange(parseInt(val, 10))}
                      buttons={[
                        { value: '15', label: '15' },
                        { value: '30', label: '30' },
                        { value: '45', label: '45' },
                        { value: '60', label: '60' },
                        { value: '90', label: '90' },
                      ]}
                      style={styles.segmentedButtons}
                      theme={{ 
                        colors: { 
                          primary: colors.primary.main,
                          secondaryContainer: colors.surface.dark,
                          onSecondaryContainer: colors.text.primary,
                        } 
                      }}
                    />
                  )}
                />
                {errors.workoutDuration && (
                  <StyledText variant="bodySmall" color={colors.feedback.error}>
                    {errors.workoutDuration.message}
                  </StyledText>
                )}
              </View>
              
              {/* Workout Frequency */}
              <View style={styles.inputContainer}>
                <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.inputLabel}>
                  Workouts Per Week
                </StyledText>
                <Controller
                  control={control}
                  name="workoutFrequency"
                  render={({ field: { onChange, value } }) => (
                    <SegmentedButtons
                      value={value.toString()}
                      onValueChange={(val) => onChange(parseInt(val, 10))}
                      buttons={[
                        { value: '2', label: '2' },
                        { value: '3', label: '3' },
                        { value: '4', label: '4' },
                        { value: '5', label: '5' },
                        { value: '6', label: '6' },
                      ]}
                      style={styles.segmentedButtons}
                      theme={{ 
                        colors: { 
                          primary: colors.primary.main,
                          secondaryContainer: colors.surface.dark,
                          onSecondaryContainer: colors.text.primary,
                        } 
                      }}
                    />
                  )}
                />
                {errors.workoutFrequency && (
                  <StyledText variant="bodySmall" color={colors.feedback.error}>
                    {errors.workoutFrequency.message}
                  </StyledText>
                )}
              </View>

              {/* Available Equipment */}
              <View style={styles.inputContainer}>
                <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.inputLabel}>
                  Available Equipment
                </StyledText>
                <View style={styles.chipsContainer}>
                  {equipmentOptions.map((equipment) => (
                    <Chip
                      key={equipment}
                      selected={selectedEquipment.includes(equipment)}
                      onPress={() => toggleEquipment(equipment)}
                      style={[
                        styles.chip,
                        selectedEquipment.includes(equipment) && styles.selectedChip
                      ]}
                      textStyle={selectedEquipment.includes(equipment) ? styles.selectedChipText : styles.chipText}
                      showSelectedCheck={false}
                    >
                      {equipment}
                    </Chip>
                  ))}
                </View>
                {errors.availableEquipment && (
                  <StyledText variant="bodySmall" color={colors.feedback.error}>
                    {errors.availableEquipment.message}
                  </StyledText>
                )}
              </View>

              {/* Preferred Workout Times */}
              <View style={styles.inputContainer}>
                <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.inputLabel}>
                  Preferred Workout Times
                </StyledText>
                <View style={styles.chipsContainer}>
                  {timeOptions.map((time) => (
                    <Chip
                      key={time}
                      selected={selectedTimes.includes(time)}
                      onPress={() => toggleTime(time)}
                      style={[
                        styles.chip,
                        selectedTimes.includes(time) && styles.selectedChip
                      ]}
                      textStyle={selectedTimes.includes(time) ? styles.selectedChipText : styles.chipText}
                      showSelectedCheck={false}
                    >
                      {time}
                    </Chip>
                  ))}
                </View>
                {errors.preferredWorkoutTimes && (
                  <StyledText variant="bodySmall" color={colors.feedback.error}>
                    {errors.preferredWorkoutTimes.message}
                  </StyledText>
                )}
              </View>

              {/* Focus Areas */}
              <View style={styles.inputContainer}>
                <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.inputLabel}>
                  Focus Areas
                </StyledText>
                {recommendedAreas.length > 0 && (
                  <View style={styles.recommendationBanner}>
                    <StyledText variant="bodySmall" color={colors.text.primary} style={styles.recommendationText}>
                      Based on your body analysis, we recommend focusing on these areas
                    </StyledText>
                  </View>
                )}
                <View style={styles.focusAreasGrid}>
                  {focusAreaOptions.map((area) => (
                    <TouchableOpacity
                      key={area.value}
                      style={[
                        styles.focusAreaItem,
                        selectedFocusAreas.includes(area.value) && styles.selectedFocusArea,
                        isRecommendedArea(area.value) && styles.recommendedArea
                      ]}
                      onPress={() => toggleFocusArea(area.value)}
                    >
                      <IconButton
                        icon={area.icon}
                        size={28}
                        iconColor={selectedFocusAreas.includes(area.value) ? colors.text.primary : colors.text.secondary}
                      />
                      <StyledText 
                        variant="bodyMedium" 
                        color={selectedFocusAreas.includes(area.value) ? colors.text.primary : colors.text.secondary}
                      >
                        {area.label}
                      </StyledText>
                      {isRecommendedArea(area.value) && (
                        <View style={styles.recommendedBadge}>
                          <StyledText variant="bodySmall" style={styles.recommendedBadgeText}>
                            Recommended
                          </StyledText>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
                {errors.focusAreas && (
                  <StyledText variant="bodySmall" color={colors.feedback.error}>
                    {errors.focusAreas.message}
                  </StyledText>
                )}
              </View>

              {/* Exercises to Avoid */}
              <View style={styles.inputContainer}>
                <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.inputLabel}>
                  Exercises to Avoid (comma separated)
                </StyledText>
                <Controller
                  control={control}
                  name="exercisesToAvoid"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder="e.g. burpees, deadlifts, jump rope"
                      style={styles.input}
                      mode="outlined"
                      outlineColor={colors.border.medium}
                      activeOutlineColor={colors.primary.main}
                      textColor={colors.text.primary}
                      theme={{ 
                        colors: { 
                          background: colors.surface.dark,
                          placeholder: colors.text.muted,
                          text: colors.text.primary
                        }
                      }}
                    />
                  )}
                />
                {errors.exercisesToAvoid && (
                  <StyledText variant="bodySmall" color={colors.feedback.error}>
                    {errors.exercisesToAvoid.message}
                  </StyledText>
                )}
              </View>

              {/* Submit Button */}
              <Button
                mode="contained"
                onPress={handleSubmit(onSubmit)}
                style={styles.button}
                contentStyle={styles.buttonContent}
                buttonColor={colors.primary.main}
              >
                Complete Onboarding
              </Button>
            </View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
  },
  backButton: {
    marginBottom: spacing.md,
  },
  backIcon: {
    margin: 0,
    padding: 0,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: spacing.xs,
  },
  subtitle: {
    marginBottom: spacing.md,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  formCard: {
    backgroundColor: colors.surface.light,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.medium,
  },
  inputContainer: {
    marginBottom: spacing.lg,
  },
  inputLabel: {
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface.dark,
  },
  segmentedButtons: {
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.xs,
  },
  chip: {
    margin: spacing.xs / 2,
    backgroundColor: colors.surface.dark,
  },
  selectedChip: {
    backgroundColor: colors.primary.dark,
  },
  chipText: {
    color: colors.text.secondary,
  },
  selectedChipText: {
    color: colors.text.primary,
  },
  focusAreasGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  focusAreaItem: {
    width: '48%',
    backgroundColor: colors.surface.dark,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
    alignItems: 'center',
    position: 'relative',
  },
  selectedFocusArea: {
    backgroundColor: colors.primary.dark,
  },
  recommendedArea: {
    borderWidth: 1,
    borderColor: colors.accent.gold,
  },
  recommendationBanner: {
    backgroundColor: colors.accent.gold,
    padding: spacing.xs,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
  },
  recommendationText: {
    textAlign: 'center',
  },
  recommendedBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: colors.accent.gold,
    borderRadius: borderRadius.round,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  recommendedBadgeText: {
    fontSize: 8,
    color: colors.background.primary,
    fontWeight: 'bold',
  },
  button: {
    marginTop: spacing.md,
    borderRadius: borderRadius.round,
  },
  buttonContent: {
    paddingVertical: spacing.sm,
  },
  decorativeCircle: {
    position: 'absolute',
    borderRadius: borderRadius.round,
    opacity: 0.1,
  },
  decorativeCircle1: {
    width: width * 0.5,
    height: width * 0.5,
    backgroundColor: colors.accent.green,
    top: -width * 0.2,
    right: -width * 0.2,
  },
  decorativeCircle2: {
    width: width * 0.3,
    height: width * 0.3,
    backgroundColor: colors.primary.main,
    bottom: height * 0.1,
    left: -width * 0.15,
  },
});
