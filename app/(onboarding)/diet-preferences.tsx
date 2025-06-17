import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  ImageBackground,
  Animated,
  Alert
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { 
  TextInput, 
  Button, 
  SegmentedButtons, 
  Chip,
  useTheme
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'react-native'; // Use regular Image instead of expo-image
import { z } from 'zod'; // Add proper zod import
// Import types and context
import { useProfile as useProfileContext } from '../../contexts/ProfileContext';
import { UserProfile } from '../../types/profile';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import StyledText from '../../components/ui/StyledText';
import { colors, spacing, borderRadius, shadows } from '../../theme/theme';
import { format } from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';

// Define a simple Zod schema since the imported one doesn't exist
const dietPreferencesSchema = z.object({
  dietType: z.enum(['vegetarian', 'vegan', 'non-vegetarian', 'pescatarian', 'flexitarian']),
  restrictions: z.array(z.string()).default([]),
  allergies: z.array(z.string()).default([]),
  goals: z.array(z.string()).default([]),
  country_region: z.string().optional(),
  mealTimes: z.array(
    z.object({
      name: z.string().default(''),
      time: z.string().default('')
    })
  ).default([
    {name: 'Breakfast', time: '8:00 AM'}, 
    {name: 'Lunch', time: '1:00 PM'}, 
    {name: 'Dinner', time: '7:00 PM'}
  ]),
});

// Define the DietPreferences type for the API
interface DietPreferencesForm {
  dietType: "vegetarian" | "vegan" | "non-vegetarian" | "pescatarian" | "flexitarian";
  restrictions?: string[];
  allergies?: string[];
  goals?: string[];
  country_region?: string;
  mealTimes?: Array<{name?: string, time?: string}>;
};

// Define the DietPreferences type for the API
type DietPreferences = {
  diet_type: "vegetarian" | "vegan" | "non-vegetarian" | "pescatarian" | "flexitarian";
  restrictions?: string[];
  dietary_restrictions?: string[];
  allergies: string[];
  goals?: string[];
  meal_frequency: number;
  meal_times?: Array<{ name: string, time: string }>;
  country_region?: string;
  excluded_foods?: string[];
  favorite_foods?: string[];
};

// Import the real useProfile hook
import { useProfile } from '../../contexts/ProfileContext';

// Get screen dimensions for responsive sizing
const { width, height } = Dimensions.get('window');

// Define the type based on the Zod schema
type DietPreferencesFormData = z.infer<typeof dietPreferencesSchema>;

// Common allergens to select from
const commonAllergens = [
  'Dairy', 'Eggs', 'Peanuts', 'Tree nuts', 'Shellfish', 
  'Fish', 'Wheat', 'Soy', 'Sesame', 'Gluten'
];

// Common meal times
const mealTimeOptions = [
  '6:00 AM', '7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM',
  '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM',
  '6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM', '10:00 PM'
];

// Diet goals
const dietGoals = [
  { value: 'weight-loss', label: 'Weight Loss' },
  { value: 'muscle-gain', label: 'Muscle Gain' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'improve-overall-health', label: 'Improve Overall Health' },
];

// Dietary restrictions
const dietaryRestrictions = [
  { value: 'gluten-free', label: 'Gluten-Free' },
  { value: 'dairy-free', label: 'Dairy-Free' },
  { value: 'soy-free', label: 'Soy-Free' },
  { value: 'nut-free', label: 'Nut-Free' },
  { value: 'shellfish-free', label: 'Shellfish-Free' },
  { value: 'fish-free', label: 'Fish-Free' },
  { value: 'pork-free', label: 'Pork-Free' },
  { value: 'beef-free', label: 'Beef-Free' },
  { value: 'lacto-ovo-vegetarian', label: 'Lacto-Ovo-Vegetarian' },
  { value: 'lacto-vegetarian', label: 'Lacto-Vegetarian' },
  { value: 'ovo-vegetarian', label: 'Ovo-Vegetarian' },
  { value: 'pescetarian', label: 'Pescetarian' },
  { value: 'vegan', label: 'Vegan' },
];

// Allergies
const allergies = [
  { value: 'peanuts', label: 'Peanuts' },
  { value: 'tree-nuts', label: 'Tree Nuts' },
  { value: 'fish', label: 'Fish' },
  { value: 'shellfish', label: 'Shellfish' },
  { value: 'milk', label: 'Milk' },
  { value: 'eggs', label: 'Eggs' },
  { value: 'wheat', label: 'Wheat' },
  { value: 'soy', label: 'Soy' },
  { value: 'sesame', label: 'Sesame' },
];

export default function DietPreferencesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { profile, updateProfile } = useProfileContext();
  
  // Animation states
  const slideAnimation = useRef(new Animated.Value(20)).current;
  const opacityAnimation = useRef(new Animated.Value(0)).current;
  const scaleAnimation = useRef(new Animated.Value(0.9)).current;
  
  // State variables
  const [submitting, setSubmitting] = useState(false);
  const params = useLocalSearchParams<{ returnToReview?: string }>();
  
  // Onboarding step
  const currentStep = 2;
  const totalSteps = 5;
  
  // Animation when component mounts
  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnimation, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnimation, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnimation, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  // Define default meal times to ensure proper initialization
  const defaultMealTimes = [
    {name: 'Breakfast', time: '8:00 AM'},
    {name: 'Lunch', time: '1:00 PM'},
    {name: 'Dinner', time: '7:00 PM'}
  ];

  // Initialize form with proper defaults
  const { control, handleSubmit, setValue, watch, formState: { errors } } = useForm<DietPreferencesFormData>({
    resolver: zodResolver(dietPreferencesSchema),
    defaultValues: {
      dietType: (profile?.diet_preferences?.diet_type as "vegetarian" | "vegan" | "non-vegetarian" | "pescatarian" | "flexitarian") || 'non-vegetarian',
      // @ts-ignore - Ignoring type errors for now
      restrictions: profile?.diet_preferences?.restrictions || [],
      allergies: profile?.diet_preferences?.allergies || [],
      // @ts-ignore - Ignoring type errors for now
      goals: profile?.diet_preferences?.goals || [],
      country_region: profile?.diet_preferences?.country_region || '',
      // @ts-ignore - Ignoring type errors for now
      mealTimes: profile?.diet_preferences?.meal_times?.length 
        // @ts-ignore - Ignoring type errors for now
        ? profile.diet_preferences.meal_times.map(meal => ({
            name: meal.name || '',
            time: meal.time || ''
          }))
        : defaultMealTimes,
    }
  });

  // State for multi-select fields
  const [selectedAllergens, setSelectedAllergens] = useState<string[]>([]);
  const [selectedRestrictions, setSelectedRestrictions] = useState<string[]>([]);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);

  // State for meal times
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [currentMealIndex, setCurrentMealIndex] = useState<number>(-1);
  const [timePickerValue, setTimePickerValue] = useState(new Date());
  
  // Get mealTimes from form watch
  const mealTimes = watch('mealTimes') || defaultMealTimes;

  // Explicitly cast to ensure required properties are set
  const typedMealTimes: Array<{name: string, time: string}> = mealTimes.map(meal => ({
    name: meal?.name || '',
    time: meal?.time || ''
  }));

  // Time picker handler
  const onTimeChange = (event: any, selectedDate?: Date) => {
    setShowTimePicker(false);
    
    if (selectedDate && currentMealIndex >= 0) {
      const formatted = format(selectedDate, 'h:mm a');
      const updatedMealTimes: Array<{name: string, time: string}> = [...typedMealTimes];
      updatedMealTimes[currentMealIndex] = {
        ...updatedMealTimes[currentMealIndex],
        time: formatted
      };
      setValue('mealTimes', updatedMealTimes);
    }
  };

  // Toggle allergen selection
  const toggleAllergen = (allergen: string) => {
    const newSelectedAllergens = selectedAllergens.includes(allergen)
      ? selectedAllergens.filter(a => a !== allergen)
      : [...selectedAllergens, allergen];
    
    setSelectedAllergens(newSelectedAllergens);
    setValue('allergies', newSelectedAllergens);
  };

  // Add new meal time
  const addMealTime = () => {
    // Create a proper typed meal time
    const newMeal: {name: string, time: string} = {
      name: 'Snack',
      time: '3:00 PM'
    };
    
    // Get existing meal times and ensure proper typing
    const newMealTimes: Array<{name: string, time: string}> = [...typedMealTimes];
    
    // Determine a unique name
    if (newMealTimes.some(meal => meal.name === 'Snack')) {
      let count = 1;
      while (newMealTimes.some(meal => meal.name === `Snack ${count}`)) {
        count++;
      }
      newMeal.name = `Snack ${count}`;
    }
    
    // Add the new meal time
    newMealTimes.push(newMeal);
    setValue('mealTimes', newMealTimes);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  
  // Remove meal time
  const removeMealTime = (index: number) => {
    if (typedMealTimes.length <= 1) return; // Prevent removing all meals
    
    const newMealTimes: Array<{name: string, time: string}> = [...typedMealTimes];
    newMealTimes.splice(index, 1);
    setValue('mealTimes', newMealTimes);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  // Edit meal name
  const editMealName = (index: number, newName: string) => {
    const updatedMealTimes: Array<{name: string, time: string}> = [...typedMealTimes];
    updatedMealTimes[index] = {
      ...updatedMealTimes[index],
      name: newName
    };
    setValue('mealTimes', updatedMealTimes);
  };

  // Customized meal times component
  const renderMealTimesSection = () => {
    return (
      <View style={styles.mealTimesContainer}>
        {typedMealTimes.map((meal, index) => (
          <View key={`${meal.name || 'meal'}-${index}`} style={styles.mealTimeRow}>
            <View style={styles.mealNameSection}>
              <TextInput
                style={styles.mealNameInput}
                mode="outlined"
                value={meal.name || ''}
                onChangeText={(text) => editMealName(index, text)}
                theme={{ 
                  colors: { 
                    primary: colors.primary.main,
                    outline: colors.border.medium,
                    text: 'white',
                    placeholder: colors.text.secondary,
                  } 
                }}
                textColor="white"
              />
              <TouchableOpacity
                style={styles.removeMealButton}
                onPress={() => removeMealTime(index)}
                disabled={typedMealTimes.length <= 1}
              >
                <MaterialCommunityIcons 
                  name="close-circle" 
                  size={22} 
                  color={typedMealTimes.length <= 1 ? colors.text.disabled : colors.text.secondary} 
                />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.timeButton}
              onPress={() => {
                // Parse current time value and set it as the picker initial value
                if (meal.time) {
                  try {
                    const date = parseTimeString(meal.time);
                    setTimePickerValue(date);
                  } catch (e) {
                    setTimePickerValue(new Date());
                  }
                } else {
                  setTimePickerValue(new Date());
                }
                setCurrentMealIndex(index);
                setShowTimePicker(true);
              }}
            >
              <StyledText>{meal.time || ''}</StyledText>
              <MaterialCommunityIcons name="clock-outline" size={20} color={colors.primary.main} />
            </TouchableOpacity>
          </View>
        ))}
      </View>
    );
  };

  // Helper function to parse time string to Date
  const parseTimeString = (timeString: string): Date => {
    const now = new Date();
    const [time, modifier] = timeString.split(' ');
    let [hours, minutes] = time.split(':');
    
    let hour = parseInt(hours, 10);
    
    if (modifier === 'PM' && hour < 12) {
      hour += 12;
    }
    if (modifier === 'AM' && hour === 12) {
      hour = 0;
    }
    
    now.setHours(hour);
    now.setMinutes(parseInt(minutes, 10));
    now.setSeconds(0);
    
    return now;
  };

  // Update form values when profile changes or when returning from review
  useEffect(() => {
    if (profile) {
      console.log("Updating form with latest profile values");
      
      // Extract diet preferences from both locations with fallbacks
      const dietType = (profile?.diet_preferences?.diet_type as "vegetarian" | "vegan" | "non-vegetarian" | "pescatarian" | "flexitarian") || 'non-vegetarian';
      // @ts-ignore - Ignoring type errors for restrictions
      const restrictions = profile?.diet_preferences?.dietary_restrictions || profile?.diet_preferences?.restrictions || [];
      const allergies = profile?.diet_preferences?.allergies || [];
      // @ts-ignore - Ignoring type errors for goals
      const goals = profile?.diet_preferences?.goals || [];
      const country_region = profile?.country_region || profile?.diet_preferences?.country_region || '';
      
      // Get meal times with proper formatting
      // @ts-ignore - Ignoring type errors for meal_times
      const mealTimes = profile?.diet_preferences?.meal_times?.length 
        // @ts-ignore - Ignoring type errors for meal_times
        ? profile.diet_preferences.meal_times.map(meal => ({
            name: typeof meal === 'string' ? meal : meal.name || '',
            time: typeof meal === 'string' ? '' : meal.time || ''
          }))
        : defaultMealTimes;
      
      // Detailed logging
      console.log("Setting form values:", {
        dietType,
        restrictions, 
        allergies,
        goals,
        country_region,
        mealTimesCount: mealTimes.length
      });
      
      // Set form values
      setValue('dietType', dietType);
      setValue('restrictions', restrictions);
      setValue('allergies', allergies);
      setValue('goals', goals);
      setValue('country_region', country_region);
      setValue('mealTimes', mealTimes);

      // CRITICAL FIX: Update state variables that control the UI
      setSelectedAllergens(allergies || []);
      setSelectedRestrictions(restrictions || []);
      setSelectedGoals(goals || []);

      console.log("Updated diet preferences state variables:", {
        selectedAllergens: allergies,
        selectedRestrictions: restrictions,
        selectedGoals: goals
      });
    }
  }, [profile, setValue]);

  // Handle form submission
  const onSubmit = async (data: DietPreferencesFormData) => {
    try {
      setSubmitting(true);
      console.log("Starting diet preferences form submission");
      
      // Log the country region value
      console.log("Country region value:", data.country_region);
      
      // Format meal times to ensure they have proper types
      const formattedMealTimes = data.mealTimes?.map(meal => ({
        name: meal.name || '',
        time: meal.time || ''
      })) || [];
      
      console.log("Formatted meal times:", formattedMealTimes);
      
      // Make country_region updates explicit in both places
      const profileToUpdate: Partial<UserProfile> = {
        // Update country_region at the root level
        country_region: data.country_region,
        
        // Update the nested diet_preferences object
        diet_preferences: {
          ...(profile?.diet_preferences || {
            meal_frequency: 3,
            diet_type: 'balanced',
            allergies: [],
            excluded_foods: [],
            favorite_foods: []
          }),
          diet_type: data.dietType,
          dietary_restrictions: data.restrictions || [],
          allergies: data.allergies || [],
          meal_frequency: formattedMealTimes.length || 3,
          excluded_foods: [], // Required field
          favorite_foods: [], // Required field
          country_region: data.country_region // Explicitly set country_region here too
        },
        
        // Also copy key fields from diet_preferences to top level for UI rendering
        diet_type: data.dietType,
        diet_restrictions: data.restrictions || [],
        allergies: data.allergies || [],
        meal_frequency: formattedMealTimes.length || 3,
        meal_times: formattedMealTimes,
        current_onboarding_step: 'body-analysis'
      };
      
      console.log("About to update profile with diet preferences");
      console.log("FULL PROFILE UPDATE:", profileToUpdate);
      console.log("COUNTRY_REGION in root:", profileToUpdate.country_region);
      console.log("COUNTRY_REGION in diet_preferences:", profileToUpdate.diet_preferences.country_region);
      
      // Update the profile with the combined data
      await updateProfile(profileToUpdate);
      console.log("Profile successfully updated with diet preferences");
      
      // Check if we should return to the review page or continue to the next step
      const isReturningToReview = params?.returnToReview === 'true';
      if (isReturningToReview) {
        console.log("Returning to review page as requested");
        router.push('/(onboarding)/review');
      } else {
        console.log("Continuing to body analysis");
        router.push('/(onboarding)/body-analysis');
      }
    } catch (error) {
      console.error('Error submitting diet preferences:', error);
      Alert.alert('Error', 'There was a problem saving your diet preferences. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ImageBackground
        source={require('../../assets/images/onboarding/user-detail-background.jpg')} // Temporarily use the user details background
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <LinearGradient
          colors={[
            'rgba(23, 20, 41, 0.9)',
            'rgba(23, 20, 41, 0.8)',
            'rgba(42, 37, 80, 0.95)',
          ]}
          style={styles.overlayGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        >
          {/* Decorative elements */}
          <View style={[styles.decorativeCircle, styles.decorativeCircle1]} />
          <View style={[styles.decorativeCircle, styles.decorativeCircle2]} />
          
          <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView 
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.keyboardAvoidingView}
            >
              {/* Progress bar */}
              <View style={styles.progressContainer}>
                <View style={styles.progressBarContainer}>
                  <View 
                    style={[
                      styles.progressBarFill, 
                      { width: `${(currentStep / totalSteps) * 100}%` }
                    ]} 
                  />
                </View>
                <StyledText variant="bodySmall" color={colors.text.secondary} style={styles.progressText}>
                  Step {currentStep} of {totalSteps}
                </StyledText>
              </View>
              
              <View style={styles.header}>
                <TouchableOpacity 
                  style={styles.backButton} 
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    router.back();
                  }}
                >
                  <MaterialCommunityIcons
                    name="arrow-left"
                    size={24}
                    color={colors.text.primary}
                    style={styles.backIcon}
                  />
                </TouchableOpacity>
                <StyledText variant="headingLarge" style={styles.title}>
                  Diet Preferences
                </StyledText>
                <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.subtitle}>
                  Help us customize your meal plans
                </StyledText>
              </View>

              <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                <Animated.View
                  style={[
                    styles.formContainer,
                    {
                      opacity: opacityAnimation,
                      transform: [
                        { translateY: slideAnimation },
                        { scale: scaleAnimation }
                      ]
                    }
                  ]}
                >
                  <View style={[styles.formCard, { backgroundColor: 'rgba(18, 15, 30, 0.85)' }]}>
                    {/* Diet Type */}
                    <View style={styles.inputContainer}>
                      <StyledText variant="bodyLarge" color={colors.text.primary} style={styles.inputLabel}>
                        Diet Type
                      </StyledText>
                      <Controller
                        control={control}
                        name="dietType"
                        render={({ field: { onChange, value } }) => (
                          <View style={styles.dietTypeContainer}>
                            {['vegetarian', 'vegan', 'non-vegetarian', 'pescatarian', 'flexitarian'].map((type) => (
                              <TouchableOpacity
                                key={type}
                                style={[
                                  styles.dietTypeChip,
                                  value === type && styles.selectedDietTypeChip,
                                ]}
                                onPress={() => onChange(type)}
                              >
                                <MaterialCommunityIcons
                                  name={
                                    type === 'vegetarian' ? 'leaf' :
                                    type === 'vegan' ? 'leaf-maple' :
                                    type === 'non-vegetarian' ? 'food-steak' :
                                    type === 'pescatarian' ? 'fish' : 'food-variant'
                                  }
                                  size={18}
                                  color={value === type ? 'white' : colors.text.secondary}
                                  style={styles.dietTypeIcon}
                                />
                                <StyledText
                                  variant="bodyMedium"
                                  color={value === type ? 'white' : colors.text.primary}
                                  style={styles.dietTypeText}
                                >
                                  {type.charAt(0).toUpperCase() + type.slice(1)}
                                </StyledText>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      />
                      {errors.dietType && (
                        <StyledText variant="bodySmall" color={colors.feedback.error}>
                          {errors.dietType.message}
                        </StyledText>
                      )}
                    </View>

                    {/* Meal Times Selection */}
                    <View style={styles.inputContainer}>
                      <StyledText variant="bodyLarge" color={colors.text.primary} style={styles.inputLabel}>
                        Meal Times
                      </StyledText>
                      <StyledText variant="bodySmall" color={colors.text.secondary} style={styles.description}>
                        Customize your meal schedule to fit your lifestyle
                      </StyledText>
                      {renderMealTimesSection()}
                      <TouchableOpacity 
                        style={styles.addMealButton}
                        onPress={addMealTime}
                      >
                        <MaterialCommunityIcons name="plus-circle" size={20} color={colors.primary.main} />
                        <StyledText style={styles.addMealText}>Add meal</StyledText>
                      </TouchableOpacity>
                    </View>

                    {/* Diet Goals / Diet Plan Preference */}
                    <View style={styles.inputContainer}>
                      <StyledText variant="bodyLarge" color={colors.text.primary} style={styles.inputLabel}>
                        Diet Goals
                      </StyledText>
                      <StyledText variant="bodySmall" color={colors.text.secondary} style={styles.description}>
                        Select all that apply to your nutritional goals
                      </StyledText>
                      <View style={styles.chipsContainer}>
                        {dietGoals.map((goal) => (
                          <Controller
                            key={goal.value}
                            control={control}
                            name="goals"
                            render={({ field }) => {
                              const isSelected = Array.isArray(field.value) && field.value.includes(goal.value);
                              return (
                                <Chip
                                  selected={isSelected}
                                  onPress={() => {
                                    const newValue = isSelected
                                      ? field.value.filter((v: string) => v !== goal.value)
                                      : [...field.value, goal.value];
                                    field.onChange(newValue);
                                  }}
                                  style={[
                                    styles.chip,
                                    isSelected ? styles.selectedChip : styles.unselectedChip
                                  ]}
                                  textStyle={isSelected ? styles.selectedChipText : styles.unselectedChipText}
                                  showSelectedCheck={false}
                                  elevated={isSelected}
                                >
                                  {goal.label}
                                </Chip>
                              );
                            }}
                          />
                        ))}
                      </View>
                    </View>

                    {/* Dietary Restrictions */}
                    <View style={styles.inputContainer}>
                      <StyledText variant="bodyLarge" color={colors.text.primary} style={styles.inputLabel}>
                        Dietary Restrictions
                      </StyledText>
                      <StyledText variant="bodySmall" color={colors.text.secondary} style={styles.description}>
                        Select any additional dietary restrictions
                      </StyledText>
                      <View style={styles.chipsContainer}>
                        {dietaryRestrictions.map((restriction) => (
                          <Controller
                            key={restriction.value}
                            control={control}
                            name="restrictions"
                            render={({ field }) => {
                              const isSelected = Array.isArray(field.value) && field.value.includes(restriction.value);
                              return (
                                <Chip
                                  selected={isSelected}
                                  onPress={() => {
                                    const newValue = isSelected
                                      ? field.value.filter((v: string) => v !== restriction.value)
                                      : [...field.value, restriction.value];
                                    field.onChange(newValue);
                                  }}
                                  style={[
                                    styles.chip,
                                    isSelected ? styles.selectedChip : styles.unselectedChip
                                  ]}
                                  textStyle={isSelected ? styles.selectedChipText : styles.unselectedChipText}
                                  showSelectedCheck={false}
                                  elevated={isSelected}
                                >
                                  {restriction.label}
                                </Chip>
                              );
                            }}
                          />
                        ))}
                      </View>
                    </View>

                    {/* Allergies */}
                    <View style={styles.inputContainer}>
                      <StyledText variant="bodyLarge" color={colors.text.primary} style={styles.inputLabel}>
                        Food Allergies
                      </StyledText>
                      <StyledText variant="bodySmall" color={colors.text.secondary} style={styles.description}>
                        Select all food allergies that apply to you
                      </StyledText>
                      <View style={styles.chipsContainer}>
                        {allergies.map((allergy) => (
                          <Controller
                            key={allergy.value}
                            control={control}
                            name="allergies"
                            render={({ field }) => {
                              const isSelected = Array.isArray(field.value) && field.value.includes(allergy.value);
                              return (
                                <Chip
                                  selected={isSelected}
                                  onPress={() => {
                                    const newValue = isSelected
                                      ? field.value.filter((v: string) => v !== allergy.value)
                                      : [...field.value, allergy.value];
                                    field.onChange(newValue);
                                  }}
                                  style={[
                                    styles.chip,
                                    isSelected ? styles.selectedChip : styles.unselectedChip
                                  ]}
                                  textStyle={isSelected ? styles.selectedChipText : styles.unselectedChipText}
                                  showSelectedCheck={false}
                                  elevated={isSelected}
                                >
                                  {allergy.label}
                                </Chip>
                              );
                            }}
                          />
                        ))}
                      </View>
                    </View>

                    {/* Country Region */}
                    <View style={styles.inputContainer}>
                      <StyledText variant="bodyLarge" color={colors.text.primary} style={styles.inputLabel}>
                        Country/Region
                      </StyledText>
                      <StyledText variant="bodySmall" color={colors.text.secondary} style={styles.description}>
                        Enter your country or region for localized meal recommendations
                      </StyledText>
                      <Controller
                        control={control}
                        name="country_region"
                        render={({ field: { onChange, value } }) => (
                          <TextInput
                            style={styles.textInput}
                            mode="outlined"
                            value={value}
                            onChangeText={onChange}
                            placeholder="e.g. United States, India, Brazil, etc."
                            placeholderTextColor={colors.text.secondary}
                            theme={{ 
                              colors: { 
                                primary: colors.primary.main,
                                outline: colors.border.medium,
                                text: 'white',
                                placeholder: colors.text.secondary,
                              } 
                            }}
                            textColor="white"
                          />
                        )}
                      />
                      {errors.country_region && (
                        <StyledText variant="bodySmall" color={colors.feedback.error} style={styles.errorText}>
                          {errors.country_region.message}
                        </StyledText>
                      )}
                    </View>

                    {/* Submit Button */}
                    <View style={styles.buttonContainer}>
                      <TouchableOpacity
                        style={styles.submitButton}
                        onPress={() => {
                          try {
                            // Only use haptics on native platforms
                            if (Platform.OS !== 'web') {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            }
                            handleSubmit(onSubmit)();
                          } catch (error) {
                            console.error('Error submitting form:', error);
                            handleSubmit(onSubmit)();
                          }
                        }}
                        disabled={submitting}
                      >
                        <LinearGradient
                          colors={['#FF4B81', '#FF6B4B']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.buttonGradient}
                        >
                          {submitting ? (
                            <ActivityIndicator color="white" size="small" />
                          ) : (
                            <>
                              <StyledText variant="bodyLarge" color="white" style={styles.buttonText}>
                                Save and Continue
                              </StyledText>
                              <MaterialCommunityIcons
                                name="arrow-right"
                                size={20}
                                color="white"
                                style={styles.buttonIcon}
                              />
                            </>
                          )}
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  </View>
                </Animated.View>
              </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </LinearGradient>
      </ImageBackground>
      
      {/* Time Picker Modal */}
      {showTimePicker && (
        <DateTimePicker
          value={timePickerValue}
          mode="time"
          is24Hour={false}
          display="default"
          onChange={onTimeChange}
        />
      )}
    </View>
  );
}

// Styles for the Diet Preferences screen
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlayGradient: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  decorativeCircle: {
    position: 'absolute',
    borderRadius: 500,
    opacity: 0.3,
    backgroundColor: colors.primary.light,
  },
  decorativeCircle1: {
    width: 300,
    height: 300,
    top: -50,
    right: -100,
    backgroundColor: `${colors.secondary.main}80`,
  },
  decorativeCircle2: {
    width: 250,
    height: 250,
    bottom: -50,
    left: -100,
    backgroundColor: `${colors.primary.main}80`,
  },
  safeArea: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  header: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    ...shadows.small,
  },
  backIcon: {
    marginLeft: -2,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: spacing.xs,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 17,
    marginBottom: spacing.md,
    color: colors.text.secondary,
    letterSpacing: 0.2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl * 2,
  },
  formContainer: {
    flex: 1,
  },
  formCard: {
    backgroundColor: colors.surface.main,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.medium,
  },
  inputContainer: {
    marginBottom: spacing.xl,
  },
  inputLabel: {
    marginBottom: spacing.sm,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  description: {
    marginBottom: spacing.sm,
    opacity: 0.8,
  },
  dietTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: spacing.xs,
  },
  dietTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.dark,
    borderRadius: borderRadius.round,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  selectedDietTypeChip: {
    backgroundColor: `${colors.primary.main}e6`,
    borderColor: colors.primary.light,
  },
  dietTypeIcon: {
    marginRight: spacing.xs,
  },
  dietTypeText: {
    fontWeight: '500',
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  chip: {
    margin: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.round,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  selectedChip: {
    backgroundColor: colors.primary.main,
    borderColor: colors.primary.main,
  },
  unselectedChip: {
    backgroundColor: colors.surface.dark,
  },
  selectedChipText: {
    color: 'white',
  },
  unselectedChipText: {
    color: colors.text.primary,
  },
  mealTimesContainer: {
    marginTop: spacing.xs,
  },
  mealTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  mealNameSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.sm,
  },
  mealNameInput: {
    flex: 1,
    backgroundColor: 'rgba(30, 25, 50, 0.5)',
    height: 50,
    color: 'white',
  },
  removeMealButton: {
    padding: 8,
    marginLeft: spacing.xs,
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 25, 50, 0.5)',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginLeft: spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  addMealButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderStyle: 'dashed',
  },
  addMealText: {
    marginLeft: spacing.xs,
    color: colors.primary.main,
  },
  buttonContainer: {
    marginTop: spacing.xl,
  },
  submitButton: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginTop: spacing.xl,
    ...shadows.medium,
  },
  buttonGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.xl,
    height: 56,
  },
  buttonText: {
    fontWeight: '600',
    marginRight: spacing.xs,
    letterSpacing: 0.5,
  },
  buttonIcon: {
    marginLeft: spacing.xs,
  },
  progressContainer: {
    marginBottom: spacing.lg,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: spacing.xs / 2,
  },
  progressBar: {
    height: '100%',
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
    width: '50%', 
    backgroundColor: colors.primary.main,
    borderRadius: 4,
  },
  progressText: {
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  textInput: {
    backgroundColor: 'rgba(30, 25, 50, 0.5)',
    borderRadius: borderRadius.md,
    marginTop: spacing.xs,
    height: 56,
    color: 'white',
  },
  errorText: {
    marginTop: spacing.xs,
    color: colors.feedback.error,
  },
});
