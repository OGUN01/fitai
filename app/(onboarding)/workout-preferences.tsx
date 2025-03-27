import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  Dimensions, 
  TouchableOpacity, 
  Platform,
  ImageBackground 
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
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import SafeBlurView from '../../components/ui/SafeBlurView';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

// Get screen dimensions for responsive sizing
const { width, height } = Dimensions.get('window');

// Define the type based on the Zod schema
type WorkoutPreferencesFormData = z.infer<typeof workoutPreferencesSchema>;

// Equipment options based on location
const homeEquipmentOptions = [
  'Dumbbells', 'Barbell', 'Kettlebells', 'Resistance bands', 
  'Pull-up bar', 'Bench', 'None'
];

const gymEquipmentOptions: string[] = [
  // Empty array as gym equipment is assumed to be available
];

const outdoorsEquipmentOptions = [
  'Resistance bands', 'None'
];

const mixEquipmentOptions = [
  'Dumbbells', 'Barbell', 'Kettlebells', 'Resistance bands', 
  'Pull-up bar', 'Bench', 'None'
];

// Workout times
const workoutTimeOptions = [
  'Early morning', 'Morning', 'Afternoon', 'Evening', 'Late night'
];

// Focus area options with values matching the schema requirements
const focusAreaOptions = [
  { value: 'upper-body', label: 'Upper Body' },
  { value: 'lower-body', label: 'Lower Body' },
  { value: 'core', label: 'Core' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'full-body', label: 'Full Body' },
  { value: 'flexibility', label: 'Flexibility' }
];

// Focus area type
type FocusAreaType = 'upper-body' | 'lower-body' | 'core' | 'cardio' | 'full-body' | 'flexibility';

// Custom styled segmented button component
const PremiumSegmentedButton = ({ 
  label, 
  options, 
  value, 
  onChange, 
  error 
}: { 
  label: string, 
  options: {value: string, label: string}[], 
  value: string, 
  onChange: (value: string) => void,
  error?: string
}) => {
  return (
    <View style={styles.inputContainer}>
      <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.inputLabel}>
        {label}
      </StyledText>
      <SafeBlurView intensity={20} style={styles.blurContainer}>
        <View style={styles.customSegmentedContainer}>
          {options.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.customSegmentButton,
                value === option.value && styles.customSegmentButtonSelected
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onChange(option.value);
              }}
            >
              <View style={value === option.value ? styles.selectedButtonBackground : null}>
                <StyledText 
                  variant="bodyMedium" 
                  color={value === option.value ? colors.text.primary : colors.text.secondary} 
                  style={styles.segmentButtonText}
                >
                  {option.label}
                </StyledText>
                {value === option.value && (
                  <View style={styles.selectedIndicator} />
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </SafeBlurView>
      {error && (
        <StyledText variant="bodySmall" color={colors.feedback.error}>
          {error}
        </StyledText>
      )}
    </View>
  );
};

// Custom chip component for a more premium look
const PremiumChip = ({ 
  label, 
  selected, 
  onPress,
  icon
}: { 
  label: string; 
  selected: boolean; 
  onPress: () => void;
  icon?: React.ReactNode;
}) => {
  return (
    <TouchableOpacity 
      style={[
        styles.premiumChip,
        selected && styles.premiumChipSelected
      ]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
    >
      <SafeBlurView
        intensity={15}
        style={[
          styles.premiumChipBlur,
          selected && styles.premiumChipBlurSelected
        ]}
      >
        <StyledText 
          variant="bodyMedium" 
          color={selected ? colors.text.primary : colors.text.secondary}
          style={styles.chipLabel}
        >
          {icon && <View style={styles.chipIconContainer}>{icon}</View>}
          {label}
        </StyledText>
        {selected && (
          <View style={styles.chipSelectedDot} />
        )}
      </SafeBlurView>
    </TouchableOpacity>
  );
};

export default function WorkoutPreferencesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { profile, updateProfile } = useProfile();
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
  const [selectedFocusAreas, setSelectedFocusAreas] = useState<FocusAreaType[]>([]);
  const [submittedData, setSubmittedData] = useState<WorkoutPreferencesFormData | null>(null);
  const [navigateBack, setNavigateBack] = useState(false);
  const [recommendedAreas, setRecommendedAreas] = useState<string[]>([]);
  const [currentWorkoutLocation, setCurrentWorkoutLocation] = useState<string>('home');
  const [availableEquipment, setAvailableEquipment] = useState<string[]>(homeEquipmentOptions);
  
  // Animation values
  const buttonScale = useSharedValue(1);
  
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
        const newAreas: FocusAreaType[] = [...prev];
        areas.forEach(area => {
          if (!newAreas.includes(area as FocusAreaType) && 
              focusAreaOptions.some(option => option.value === area)) {
            newAreas.push(area as FocusAreaType);
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
        console.log("Returning to review page as requested");
        router.push('/review');
      } else {
        // Complete the onboarding
        router.push('/(tabs)/');
      }
    }
  }, [submittedData, navigateBack, router, params]);

  // Update available equipment based on workout location
  const updateEquipmentOptions = (location: string) => {
    switch(location) {
      case 'home':
        setAvailableEquipment(homeEquipmentOptions);
        break;
      case 'gym':
        setAvailableEquipment(gymEquipmentOptions);
        // Clear any previously selected equipment that's not available in the gym
        setSelectedEquipment(prev => prev.filter(item => gymEquipmentOptions.includes(item)));
        break;
      case 'outdoors':
        setAvailableEquipment(outdoorsEquipmentOptions);
        // Clear any previously selected equipment that's not available outdoors
        setSelectedEquipment(prev => prev.filter(item => outdoorsEquipmentOptions.includes(item)));
        break;
      case 'mix':
        setAvailableEquipment(mixEquipmentOptions);
        break;
      default:
        setAvailableEquipment(homeEquipmentOptions);
    }
  };

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

  const toggleFocusArea = (area: FocusAreaType) => {
    setSelectedFocusAreas(prev => {
      if (prev.includes(area)) {
        return prev.filter(a => a !== area);
      } else {
        return [...prev, area];
      }
    });
  };

  const onSubmit = (data: WorkoutPreferencesFormData) => {
    console.log('Workout preferences form data:', data);
    
    // Create a workout preferences object for the JSONB column
    const workoutPreferences: Partial<WorkoutPreferences> & { days_per_week?: number } = {
      fitness_level: data.fitnessLevel,
      workout_location: data.workoutLocation,
      workout_duration: data.workoutDuration,
      focus_areas: data.focusAreas,
      // For gym location, equipment is standard; otherwise use selected equipment
      equipment: data.workoutLocation === 'gym' 
        ? ["standard gym equipment"] 
        : data.availableEquipment,
      // Store preferred days
      preferred_days: data.preferredWorkoutTimes,
      // Store exercises to avoid if specified
      exercises_to_avoid: data.exercisesToAvoid ? data.exercisesToAvoid.split(',').map(ex => ex.trim()) : [],
      // Add days_per_week for consistency
      days_per_week: data.workoutFrequency
    };
    
    // Update profile with workout preferences but don't mark onboarding as complete yet
    updateProfile({
      // Store structured data in the JSONB column
      workout_preferences: workoutPreferences as WorkoutPreferences,
      
      // Also store essential fields in direct columns that exist in the database schema
      fitness_level: data.fitnessLevel,
      workout_days_per_week: data.workoutFrequency,
      workout_duration_minutes: data.workoutDuration,
      
      // Update onboarding progress to the review step
      current_onboarding_step: 'review',
      
      // Set fitness goals (source of truth for focus areas)
      fitness_goals: data.focusAreas,
    } as any).then(() => {
      console.log('Profile updated with workout preferences');
      setSubmittedData(data);
      
      // Navigate to the review page as the next step
      if (params?.returnToReview === 'true') {
        console.log("Returning to review page as requested");
        router.push('/review');
      } else {
        router.push('/(onboarding)/review');
      }
    }).catch(error => {
      console.error('Error updating profile with workout preferences:', error);
      alert('There was an error saving your preferences. Please try again.');
    });
  };

  // Update form with current profile values when component mounts or profile changes
  useEffect(() => {
    if (profile) {
      console.log("Updating workout form with latest profile values");
      
      // Get values from profile with appropriate fallbacks
      // @ts-ignore - Property workout_fitness_level exists at runtime but not in TypeScript definition
      const fitnessLevel = profile.workout_fitness_level || 'beginner';
      // @ts-ignore - Property workout_location exists at runtime but not in TypeScript definition
      const workoutLocation = profile.workout_location || 'home';
      // @ts-ignore - Property workout_duration_minutes exists at runtime but not in TypeScript definition
      const workoutDuration = profile.workout_duration_minutes || 30;
      // @ts-ignore - Property workout_days_per_week exists at runtime but not in TypeScript definition
      const workoutFrequency = profile.workout_days_per_week || 3;
      // @ts-ignore - Property available_equipment exists at runtime but not in TypeScript definition
      const availableEquipment = profile.available_equipment || [];
      // @ts-ignore - Property preferred_workout_times exists at runtime but not in TypeScript definition
      const preferredWorkoutTimes = profile.preferred_workout_times || [];
      // @ts-ignore - Properties focus_areas and preferred_workouts exist at runtime but not in TypeScript definition
      const focusAreas = profile.focus_areas || profile.preferred_workouts || [];
      // @ts-ignore - Property exercises_to_avoid exists at runtime but not in TypeScript definition
      const exercisesToAvoid = profile.exercises_to_avoid || '';
      
      // Detailed logging
      console.log("Setting workout form values:", {
        fitnessLevel,
        workoutLocation,
        workoutDuration,
        workoutFrequency,
        equipmentCount: availableEquipment.length,
        timesCount: preferredWorkoutTimes.length,
        focusAreasCount: focusAreas.length,
        hasExercisesToAvoid: !!exercisesToAvoid
      });
      
      // Set form values
      setValue('fitnessLevel', fitnessLevel);
      setValue('workoutLocation', workoutLocation);
      setValue('workoutDuration', workoutDuration);
      setValue('workoutFrequency', workoutFrequency);
      setValue('availableEquipment', availableEquipment);
      setValue('preferredWorkoutTimes', preferredWorkoutTimes);
      setValue('focusAreas', focusAreas);
      setValue('exercisesToAvoid', exercisesToAvoid);
      
      // Update related state variables
      setSelectedFocusAreas(focusAreas as FocusAreaType[]);
      
      // Update equipment options based on the workout location
      updateEquipmentOptions(workoutLocation);
    }
  }, [profile, setValue]);

  // Helper to check if an area is recommended
  const isRecommendedArea = (area: FocusAreaType) => {
    return recommendedAreas.includes(area);
  };

  // Button animation style
  const animatedButtonStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: buttonScale.value }]
    };
  });

  // Start button pulsing animation
  useEffect(() => {
    buttonScale.value = withRepeat(
      withTiming(1.05, { duration: 1000 }),
      -1,
      true
    );
  }, []);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.background.primary, colors.background.secondary]}
        style={styles.background}
      >
        {/* Decorative elements */}
        <View style={[styles.decorativeCircle, styles.decorativeCircle1]} />
        <View style={[styles.decorativeCircle, styles.decorativeCircle2]} />
        <View style={[styles.decorativeCircle, styles.decorativeCircle3]} />
        
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.headerContainer}>
            <TouchableOpacity
              style={styles.backButton} 
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.back();
              }}
              accessibilityLabel="Go back"
            >
              <MaterialCommunityIcons
                name="arrow-left"
                size={24}
                color={colors.text.primary}
              />
            </TouchableOpacity>
            
            <View style={styles.headerContent}>
              <StyledText variant="headingLarge" style={styles.title}>
                Workout Preferences
              </StyledText>
              <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.subtitle}>
                Customize your perfect workout routine
              </StyledText>
            </View>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Animated.View 
              entering={FadeInDown.delay(100).springify()} 
              style={styles.formCard}
            >
              {/* Fitness Level */}
              <Controller
                control={control}
                name="fitnessLevel"
                render={({ field: { onChange, value }, fieldState: { error } }) => (
                  <PremiumSegmentedButton
                    label="Fitness Level"
                    options={[
                      { value: 'beginner', label: 'Beginner' },
                      { value: 'intermediate', label: 'Intermediate' },
                      { value: 'advanced', label: 'Advanced' },
                    ]}
                    value={value}
                    onChange={onChange}
                    error={error?.message}
                  />
                )}
              />

              {/* Workout Location */}
              <Controller
                control={control}
                name="workoutLocation"
                render={({ field: { onChange, value }, fieldState: { error } }) => (
                  <PremiumSegmentedButton
                    label="Workout Location"
                    options={[
                      { value: 'home', label: 'Home' },
                      { value: 'gym', label: 'Gym' },
                      { value: 'outdoors', label: 'Outdoors' },
                      { value: 'mix', label: 'Mix' },
                    ]}
                    value={value}
                    onChange={(newValue) => {
                      onChange(newValue);
                      setCurrentWorkoutLocation(newValue);
                      updateEquipmentOptions(newValue);
                    }}
                    error={error?.message}
                  />
                )}
              />

              {/* Workout Duration */}
              <Controller
                control={control}
                name="workoutDuration"
                render={({ field: { onChange, value }, fieldState: { error } }) => (
                  <PremiumSegmentedButton
                    label="Workout Duration (minutes)"
                    options={[
                      { value: '15', label: '15' },
                      { value: '30', label: '30' },
                      { value: '45', label: '45' },
                      { value: '60', label: '60' },
                      { value: '90', label: '90' },
                    ]}
                    value={value.toString()}
                    onChange={(val) => onChange(parseInt(val, 10))}
                    error={error?.message}
                  />
                )}
              />
              
              {/* Workout Frequency */}
              <Controller
                control={control}
                name="workoutFrequency"
                render={({ field: { onChange, value }, fieldState: { error } }) => (
                  <PremiumSegmentedButton
                    label="Workouts Per Week"
                    options={[
                      { value: '2', label: '2' },
                      { value: '3', label: '3' },
                      { value: '4', label: '4' },
                      { value: '5', label: '5' },
                      { value: '6', label: '6' },
                    ]}
                    value={value.toString()}
                    onChange={(val) => onChange(parseInt(val, 10))}
                    error={error?.message}
                  />
                )}
              />

              {/* Available Equipment */}
              <View style={styles.inputContainer}>
                <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.inputLabel}>
                  Available Equipment
                </StyledText>
                {currentWorkoutLocation === 'gym' && (
                  <View style={styles.infoMessageContainer}>
                    <MaterialCommunityIcons
                      name="information-outline"
                      size={16}
                      color={colors.primary.light}
                      style={{ marginRight: spacing.xs }}
                    />
                    <StyledText 
                      variant="bodyMedium" 
                      style={{ color: colors.primary.light, flex: 1 }}
                    >
                      Standard gym equipment is assumed to be available
                    </StyledText>
                  </View>
                )}
                {currentWorkoutLocation === 'outdoors' && (
                  <View style={styles.infoMessageContainer}>
                    <MaterialCommunityIcons
                      name="information-outline"
                      size={16}
                      color={colors.primary.light}
                      style={{ marginRight: spacing.xs }}
                    />
                    <StyledText 
                      variant="bodyMedium" 
                      style={{ color: colors.primary.light, flex: 1 }}
                    >
                      For outdoor workouts, only portable equipment options are shown
                    </StyledText>
                  </View>
                )}
                {availableEquipment.length > 0 && (
                  <View style={styles.premiumChipContainer}>
                    {availableEquipment.map((equipment) => (
                      <PremiumChip
                        key={equipment}
                        label={equipment}
                        selected={selectedEquipment.includes(equipment)}
                        onPress={() => toggleEquipment(equipment)}
                      />
                    ))}
                  </View>
                )}
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
                <View style={styles.premiumChipContainer}>
                  {workoutTimeOptions.map((time) => (
                    <PremiumChip
                      key={time}
                      label={time}
                      selected={selectedTimes.includes(time)}
                      onPress={() => toggleTime(time)}
                    />
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
                  <View style={styles.infoMessageContainer}>
                    <MaterialCommunityIcons
                      name="star-outline"
                      size={16}
                      color={colors.primary.light}
                      style={{ marginRight: spacing.xs }}
                    />
                    <StyledText 
                      variant="bodyMedium" 
                      style={{ color: colors.primary.light, flex: 1 }}
                    >
                      Based on your analysis, we recommend focusing on: {recommendedAreas.map(area => 
                        focusAreaOptions.find(opt => opt.value === area)?.label || area).join(', ')}
                    </StyledText>
                  </View>
                )}
                <View style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  marginTop: spacing.xs
                }}>
                  {focusAreaOptions.map((area) => {
                    const isSelected = selectedFocusAreas.includes(area.value as FocusAreaType);
                    const isRecommended = isRecommendedArea(area.value as FocusAreaType);
                    
                    return (
                      <TouchableOpacity
                        key={area.value}
                        style={[
                          {
                            width: '48%',
                            backgroundColor: 'rgba(255, 255, 255, 0.08)',
                            borderRadius: borderRadius.md,
                            padding: spacing.sm,
                            marginBottom: spacing.md,
                            alignItems: 'center',
                            position: 'relative',
                            borderWidth: isRecommended ? 1 : 0,
                            borderColor: 'rgba(59, 130, 246, 0.4)'
                          },
                          isSelected ? {
                            backgroundColor: 'rgba(74, 222, 128, 0.2)'
                          } : {}
                        ]}
                        onPress={() => toggleFocusArea(area.value as FocusAreaType)}
                      >
                        <MaterialCommunityIcons
                          name="dumbbell"
                          size={28}
                          color={isSelected ? colors.text.primary : colors.text.secondary}
                        />
                        <StyledText 
                          variant="bodyMedium" 
                          color={isSelected ? colors.text.primary : colors.text.secondary}
                        >
                          {area.label}
                        </StyledText>
                        {isRecommended && (
                          <View style={styles.recommendedLabel}>
                            <StyledText variant="bodySmall" style={styles.recommendedText}>
                              Recommended
                            </StyledText>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
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
            </Animated.View>
          </ScrollView>
          
          {/* Form submission button - Moved outside ScrollView */}
          <View style={styles.fixedButtonContainer}>
            <TouchableOpacity 
              style={styles.submitButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                handleSubmit(onSubmit)();
              }}
            >
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <StyledText variant="headingSmall" color="#FFFFFF">
                  Save & Continue
                </StyledText>
                <MaterialCommunityIcons
                  name="arrow-right"
                  size={24}
                  color="white"
                  style={{ marginLeft: 8 }}
                />
              </View>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  decorativeCircle: {
    position: 'absolute',
    borderRadius: 1000,
    opacity: 0.2,
  },
  decorativeCircle1: {
    width: width * 0.8,
    height: width * 0.8,
    backgroundColor: colors.primary.light,
    top: -width * 0.4,
    right: -width * 0.2,
    transform: [{ scale: 1.5 }],
    opacity: 0.15,
  },
  decorativeCircle2: {
    width: width * 0.7,
    height: width * 0.7,
    backgroundColor: colors.secondary.light,
    bottom: -width * 0.35,
    left: -width * 0.35,
    opacity: 0.1,
  },
  decorativeCircle3: {
    width: width * 0.4,
    height: width * 0.4,
    backgroundColor: colors.accent.lavender,
    top: height * 0.3,
    right: -width * 0.2,
    opacity: 0.08,
  },
  safeArea: {
    flex: 1,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.small,
  },
  headerContent: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  title: {
    color: colors.text.primary,
    fontWeight: 'bold',
    marginBottom: spacing.xs,
  },
  subtitle: {
    opacity: 0.8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xl * 5, // Extra padding at bottom to account for fixed button
    paddingHorizontal: spacing.md,
  },
  formCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.medium,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  inputContainer: {
    marginBottom: spacing.lg,
  },
  inputLabel: {
    marginBottom: spacing.xs,
    fontWeight: '600',
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  segmentedButtons: {
    backgroundColor: 'transparent',
  },
  segmentedButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  segmentedButtonActive: {
    backgroundColor: 'rgba(74, 222, 128, 0.2)',
  },
  premiumChipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  premiumChip: {
    marginBottom: spacing.xs,
    marginRight: spacing.xs,
    borderRadius: 50,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  premiumChipSelected: {
    borderColor: colors.primary.light,
  },
  premiumChipBlur: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    flexDirection: 'row',
  },
  premiumChipBlurSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  chipSelectedDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary.main,
    marginLeft: spacing.xs,
  },
  infoMessageContainer: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  recommendedLabel: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: colors.accent.lavender,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 1,
  },
  recommendedText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  errorText: {
    color: colors.feedback.error,
    marginTop: spacing.xs,
  },
  timeListItem: {
    padding: 0,
    borderRadius: borderRadius.md,
    marginVertical: spacing.xs,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  timeListItemActive: {
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
    borderColor: 'rgba(74, 222, 128, 0.3)',
  },
  checkboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionsContainer: {
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
    width: '100%',
  },
  fixedButtonContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? spacing.xl : spacing.lg,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    alignItems: 'center',
    width: '100%',
    zIndex: 10,
    backgroundColor: 'rgba(18, 18, 23, 0.8)',
  },
  submitButton: {
    width: '100%',
    height: 56,
    borderRadius: 12,
    backgroundColor: '#ff3bac',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
  customSegmentedContainer: {
    flexDirection: 'row',
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: spacing.xs,
    overflow: 'hidden',
  },
  customSegmentButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
  },
  customSegmentButtonSelected: {
    backgroundColor: 'transparent',
  },
  selectedButtonBackground: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  segmentButtonText: {
    textAlign: 'center',
    fontWeight: '600',
  },
  selectedIndicator: {
    position: 'absolute',
    bottom: -spacing.xs / 2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary.main,
    alignSelf: 'center',
  },
  blurContainer: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  chipLabel: {
    fontWeight: '600',
  },
  chipIconContainer: {
    marginRight: spacing.xs,
  },
});
