import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
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
// Comment out react-i18next if not needed in your app
// import { useTranslation } from 'react-i18next';
import { Image } from 'react-native'; // Use regular Image instead of expo-image
import { z } from 'zod'; // Add proper zod import
// Comment out context imports if they don't exist yet
// import { useProfile } from '../../context/ProfileContext';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import StyledText from '../../components/ui/StyledText';
import { colors, spacing, borderRadius, shadows } from '../../theme/theme';
import { format } from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';

// Define a simple Zod schema since the imported one doesn't exist
const dietPreferencesSchema = z.object({
  dietType: z.enum(['vegetarian', 'vegan', 'non-vegetarian', 'pescatarian', 'flexitarian']),
  dietPlanPreference: z.enum(['balanced', 'high-protein', 'low-carb', 'low-fat', 'keto']).default('balanced'),
  allergies: z.array(z.string()).default([]),
  otherAllergies: z.string().optional().nullable(),
  mealFrequency: z.number().min(1).max(6).default(3),
  mealTimes: z.array(z.string()).length(3).default(['8:00 AM', '1:00 PM', '7:00 PM']),
  countryRegion: z.string().default('United States'),
  waterIntakeGoal: z.number().min(500).max(5000).default(2000),
  waterIntakeUnit: z.enum(['ml', 'l', 'oz']).default('l'),
});

// Define the DietPreferences type for the API
type DietPreferences = {
  diet_type: "vegetarian" | "vegan" | "non-vegetarian" | "pescatarian" | "flexitarian";
  allergies: string[];
  meal_frequency: number;
  excluded_foods: string[];
  favorite_foods: string[];
  meal_count: number;
  dietary_restrictions: string[];
};

// Mock useProfile hook if not available
const useProfile = () => {
  const [profile, setProfile] = useState(null);
  const updateProfile = async (data) => {
    console.log('Updating profile with:', data);
    setProfile({ ...profile, ...data });
    return true;
  };
  return { profile, updateProfile };
};

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

export default function DietPreferencesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { profile, updateProfile } = useProfile();
  const [selectedAllergens, setSelectedAllergens] = useState<string[]>([]);
  const [showBreakfastPicker, setShowBreakfastPicker] = useState(false);
  const [showLunchPicker, setShowLunchPicker] = useState(false);
  const [showDinnerPicker, setShowDinnerPicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [currentMeal, setCurrentMeal] = useState<'breakfast' | 'lunch' | 'dinner'>('breakfast');
  const [breakfastTime, setBreakfastTime] = useState('8:00 AM');
  const [lunchTime, setLunchTime] = useState('1:00 PM');
  const [dinnerTime, setDinnerTime] = useState('7:00 PM');
  const [submitting, setSubmitting] = useState(false);

  // Get URL params including returnToReview
  const params = useLocalSearchParams<{
    returnToReview?: string;
  }>();

  // Log params for debugging using useEffect
  useEffect(() => {
    console.log('Diet preferences params:', params);
    console.log('returnToReview value:', params?.returnToReview);
  }, [params]);

  const { control, handleSubmit, setValue, watch, formState: { errors } } = useForm<DietPreferencesFormData>({
    resolver: zodResolver(dietPreferencesSchema),
    defaultValues: {
      dietType: (profile?.diet_preferences?.diet_type as "vegetarian" | "vegan" | "non-vegetarian" | "pescatarian" | "flexitarian") || 'non-vegetarian',
      dietPlanPreference: 'balanced',
      allergies: profile?.diet_preferences?.allergies || [],
      otherAllergies: '',
      mealFrequency: profile?.diet_preferences?.meal_frequency || 3,
      mealTimes: ['8:00 AM', '1:00 PM', '7:00 PM'],
      countryRegion: 'United States',
      waterIntakeGoal: 2000,
      waterIntakeUnit: 'l'
    }
  });

  // Set form values from profile if available
  useEffect(() => {
    if (profile) {
      // If we have diet preferences in the profile
      if (profile.diet_preferences) {
        // Set diet type
        const validDietType = profile.diet_preferences.diet_type as "vegetarian" | "vegan" | "non-vegetarian" | "pescatarian" | "flexitarian";
        setValue('dietType', validDietType);
        
        // Set meal frequency
        setValue('mealFrequency', profile.diet_preferences.meal_frequency || 3);
        
        // Set allergies and update selected allergens state
        if (profile.diet_preferences.allergies && profile.diet_preferences.allergies.length > 0) {
          setValue('allergies', profile.diet_preferences.allergies);
          setSelectedAllergens(profile.diet_preferences.allergies);
        }
        
        // Update local state for meal times
        if (profile.diet_preferences.favorite_foods) {
          // Use sample meal times or defaults
          const breakfast = '8:00 AM';
          const lunch = '1:00 PM';
          const dinner = '7:00 PM';
          
          setBreakfastTime(breakfast);
          setLunchTime(lunch);
          setDinnerTime(dinner);
        }
      }
    }
  }, [profile, setValue]);

  // Set form values initially
  useEffect(() => {
    // Set meal times based on local state
    const updateMealTimes = () => {
      const mealTimes = [breakfastTime, lunchTime, dinnerTime];
      setValue('mealTimes', mealTimes);
    };
    
    updateMealTimes();
  }, [breakfastTime, lunchTime, dinnerTime, setValue]);

  // Set initial form values and handle platform differences
  useEffect(() => {
    // Initialize meal times in the form
    setValue('mealTimes', [breakfastTime, lunchTime, dinnerTime]);

    // Handle platform-specific setup
    if (Platform.OS === 'web') {
      // Set up any web-specific initial values or behavior
      console.log('Running on web platform, using web-specific time pickers');
    } else {
      // Set up any mobile-specific initial values or behavior
      console.log('Running on mobile platform, using native time pickers');
    }
  }, []);

  // Cast dietType to proper enum type
  useEffect(() => {
    const dietType = watch('dietType');
    if (dietType) {
      setValue('dietType', dietType as "vegetarian" | "vegan" | "non-vegetarian" | "pescatarian" | "flexitarian");
    }
  }, [watch, setValue]);

  // Function to handle time picker for any meal time
  const onTimeChange = (event: any, selectedDate: Date | undefined, mealType: 'breakfast' | 'lunch' | 'dinner') => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }
    
    if (selectedDate) {
      const formattedTime = format(selectedDate, 'h:mm a');
      
      // Update the appropriate meal time based on meal type
      if (mealType === 'breakfast') {
        setBreakfastTime(formattedTime);
        setShowBreakfastPicker(false);
      } else if (mealType === 'lunch') {
        setLunchTime(formattedTime);
        setShowLunchPicker(false);
      } else if (mealType === 'dinner') {
        setDinnerTime(formattedTime);
        setShowDinnerPicker(false);
      }
      
      // Update the form mealTimes array
      const updatedMealTimes = [...watch('mealTimes')];
      if (mealType === 'breakfast') {
        updatedMealTimes[0] = formattedTime;
      } else if (mealType === 'lunch') {
        updatedMealTimes[1] = formattedTime;
      } else if (mealType === 'dinner') {
        updatedMealTimes[2] = formattedTime;
      }
      setValue('mealTimes', updatedMealTimes);
    }
  };

  // Component that renders the time picker based on platform
  const renderTimePicker = () => {
    if (Platform.OS === 'web') {
      // For web platform, use a simple text input instead of the native time picker
      return (
        <View style={styles.mealTimesContainer}>
          <View style={styles.mealTimeRow}>
            <StyledText variant="bodyMedium" style={styles.mealTimeLabel}>Breakfast</StyledText>
            <TextInput
              mode="outlined"
              value={breakfastTime}
              onChangeText={(text) => {
                setBreakfastTime(text);
                const updatedMealTimes = [...watch('mealTimes')];
                updatedMealTimes[0] = text;
                setValue('mealTimes', updatedMealTimes);
              }}
              style={styles.webTimeInput}
            />
          </View>
          
          <View style={styles.mealTimeRow}>
            <StyledText variant="bodyMedium" style={styles.mealTimeLabel}>Lunch</StyledText>
            <TextInput
              mode="outlined"
              value={lunchTime}
              onChangeText={(text) => {
                setLunchTime(text);
                const updatedMealTimes = [...watch('mealTimes')];
                updatedMealTimes[1] = text;
                setValue('mealTimes', updatedMealTimes);
              }}
              style={styles.webTimeInput}
            />
          </View>
          
          <View style={styles.mealTimeRow}>
            <StyledText variant="bodyMedium" style={styles.mealTimeLabel}>Dinner</StyledText>
            <TextInput
              mode="outlined"
              value={dinnerTime}
              onChangeText={(text) => {
                setDinnerTime(text);
                const updatedMealTimes = [...watch('mealTimes')];
                updatedMealTimes[2] = text;
                setValue('mealTimes', updatedMealTimes);
              }}
              style={styles.webTimeInput}
            />
          </View>
        </View>
      );
    }
    
    return (
      // Native time picker for mobile platforms
      <View style={styles.mealTimesContainer}>
        {/* Breakfast time */}
        <View style={styles.mealTimeRow}>
          <StyledText variant="bodyMedium" style={styles.mealTimeLabel}>Breakfast</StyledText>
          <TouchableOpacity
            style={styles.timeButton}
            onPress={() => {
              setCurrentMeal('breakfast');
              setShowTimePicker(true);
            }}
          >
            <StyledText>{breakfastTime}</StyledText>
            <MaterialCommunityIcons name="clock-outline" size={20} color={colors.primary.main} />
          </TouchableOpacity>
        </View>
        
        {/* Lunch time */}
        <View style={styles.mealTimeRow}>
          <StyledText variant="bodyMedium" style={styles.mealTimeLabel}>Lunch</StyledText>
          <TouchableOpacity
            style={styles.timeButton}
            onPress={() => {
              setCurrentMeal('lunch');
              setShowTimePicker(true);
            }}
          >
            <StyledText>{lunchTime}</StyledText>
            <MaterialCommunityIcons name="clock-outline" size={20} color={colors.primary.main} />
          </TouchableOpacity>
        </View>
        
        {/* Dinner time */}
        <View style={styles.mealTimeRow}>
          <StyledText variant="bodyMedium" style={styles.mealTimeLabel}>Dinner</StyledText>
          <TouchableOpacity
            style={styles.timeButton}
            onPress={() => {
              setCurrentMeal('dinner');
              setShowTimePicker(true);
            }}
          >
            <StyledText>{dinnerTime}</StyledText>
            <MaterialCommunityIcons name="clock-outline" size={20} color={colors.primary.main} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Handle form submission
  const onSubmit = async (data: DietPreferencesFormData) => {
    try {
      setSubmitting(true);
      console.log('Form submitted with data:', data);
      
      // Ensure meal times are properly set
      const mealTimesData = [...data.mealTimes];
      if (mealTimesData.length < 3) {
        // If somehow we don't have 3 meal times, use the state values
        mealTimesData[0] = breakfastTime;
        mealTimesData[1] = lunchTime;
        mealTimesData[2] = dinnerTime;
      }
      
      // Create diet preferences object with proper mapping
      const dietPreferences: DietPreferences = {
        diet_type: data.dietType,
        allergies: data.allergies || [],
        meal_frequency: data.mealFrequency || 3,
        excluded_foods: [], // Default empty array
        favorite_foods: mealTimesData, // Store meal times in favorite_foods for now
        meal_count: data.mealFrequency, // Use mealFrequency as meal_count
        dietary_restrictions: [
          ...data.allergies,
          ...(data.otherAllergies ? [data.otherAllergies] : [])
        ].filter(Boolean)
      };
      
      console.log('Saving diet preferences:', dietPreferences);
      
      // Update profile with diet preferences
      await updateProfile({
        diet_preferences: dietPreferences,
        // Also store essential fields at root level for easier access
        diet_type: data.dietType,
        allergies: data.allergies,
        current_onboarding_step: 'body-analysis'
      });
      
      console.log('Profile updated with diet preferences');
      
      // Navigate to next screen or back to review if coming from there
      if (params?.returnToReview === 'true') {
        router.push('/(onboarding)/review');
      } else {
        router.push('/(onboarding)/body-analysis');
      }
    } catch (error) {
      console.error('Error saving diet preferences:', error);
    } finally {
      setSubmitting(false);
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
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardAvoidingView}
          >
            <View style={styles.header}>
              <TouchableOpacity 
                style={styles.backButton} 
                onPress={() => router.back()}
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
              <View style={styles.formCard}>
                {/* Diet Type */}
                <View style={styles.inputContainer}>
                  <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.inputLabel}>
                    Diet Type
                  </StyledText>
                  <Controller
                    control={control}
                    name="dietType"
                    render={({ field: { onChange, value } }) => (
                      <SegmentedButtons
                        value={value}
                        onValueChange={onChange}
                        buttons={[
                          { value: 'vegetarian', label: 'Vegetarian' },
                          { value: 'vegan', label: 'Vegan' },
                          { value: 'non-vegetarian', label: 'Non-Veg' },
                          { value: 'pescatarian', label: 'Pescatarian' },
                          { value: 'flexitarian', label: 'Flexitarian' },
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
                  {errors.dietType && (
                    <StyledText variant="bodySmall" color={colors.feedback.error}>
                      {errors.dietType.message}
                    </StyledText>
                  )}
                </View>

                {/* Diet Plan Preference */}
                <View style={styles.inputContainer}>
                  <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.inputLabel}>
                    Diet Plan Preference
                  </StyledText>
                  <Controller
                    control={control}
                    name="dietPlanPreference"
                    render={({ field: { onChange, value } }) => (
                      <View style={styles.dietPlanCards}>
                        <TouchableOpacity
                          style={[
                            styles.dietPlanCard,
                            value === 'balanced' && styles.selectedDietPlanCard,
                          ]}
                          onPress={() => onChange('balanced')}
                        >
                          <StyledText
                            variant="bodyMedium"
                            style={value === 'balanced' ? {...styles.dietPlanLabel, ...styles.selectedDietPlanLabel} : styles.dietPlanLabel}
                          >
                            Balanced
                          </StyledText>
                          <StyledText
                            variant="bodySmall"
                            style={value === 'balanced' ? {...styles.dietPlanDescription, ...styles.selectedDietPlanDescription} : styles.dietPlanDescription}
                          >
                            Nutritionally balanced meals
                          </StyledText>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.dietPlanCard,
                            value === 'high-protein' && styles.selectedDietPlanCard,
                          ]}
                          onPress={() => onChange('high-protein')}
                        >
                          <StyledText
                            variant="bodyMedium"
                            style={value === 'high-protein' ? {...styles.dietPlanLabel, ...styles.selectedDietPlanLabel} : styles.dietPlanLabel}
                          >
                            High-Protein
                          </StyledText>
                          <StyledText
                            variant="bodySmall"
                            style={value === 'high-protein' ? {...styles.dietPlanDescription, ...styles.selectedDietPlanDescription} : styles.dietPlanDescription}
                          >
                            Meals with high protein content
                          </StyledText>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.dietPlanCard,
                            value === 'low-carb' && styles.selectedDietPlanCard,
                          ]}
                          onPress={() => onChange('low-carb')}
                        >
                          <StyledText
                            variant="bodyMedium"
                            style={value === 'low-carb' ? {...styles.dietPlanLabel, ...styles.selectedDietPlanLabel} : styles.dietPlanLabel}
                          >
                            Low-Carb
                          </StyledText>
                          <StyledText
                            variant="bodySmall"
                            style={value === 'low-carb' ? {...styles.dietPlanDescription, ...styles.selectedDietPlanDescription} : styles.dietPlanDescription}
                          >
                            Meals with low carbohydrate content
                          </StyledText>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.dietPlanCard,
                            value === 'keto' && styles.selectedDietPlanCard,
                          ]}
                          onPress={() => onChange('keto')}
                        >
                          <StyledText
                            variant="bodyMedium"
                            style={value === 'keto' ? {...styles.dietPlanLabel, ...styles.selectedDietPlanLabel} : styles.dietPlanLabel}
                          >
                            Keto
                          </StyledText>
                          <StyledText
                            variant="bodySmall"
                            style={value === 'keto' ? {...styles.dietPlanDescription, ...styles.selectedDietPlanDescription} : styles.dietPlanDescription}
                          >
                            Meals with high fat and low carbohydrate content
                          </StyledText>
                        </TouchableOpacity>
                      </View>
                    )}
                  />
                  {errors.dietPlanPreference && (
                    <StyledText variant="bodySmall" style={styles.errorText}>
                      {errors.dietPlanPreference.message}
                    </StyledText>
                  )}
                </View>

                {/* Food Allergies */}
                <View style={styles.inputContainer}>
                  <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.inputLabel}>
                    Food Allergies
                  </StyledText>
                  <Controller
                    control={control}
                    name="allergies"
                    render={({ field: { value } }) => (
                      <View style={styles.allergensContainer}>
                        {commonAllergens.map((allergen) => (
                          <TouchableOpacity
                            key={allergen}
                            style={[
                              styles.allergenChip,
                              selectedAllergens.includes(allergen) && styles.selectedAllergenChip
                            ]}
                            onPress={() => toggleAllergen(allergen)}
                          >
                            <StyledText
                              variant="bodySmall"
                              style={
                                selectedAllergens.includes(allergen)
                                  ? {...styles.allergenLabel, ...styles.selectedAllergenLabel}
                                  : styles.allergenLabel
                              }
                            >
                              {allergen}
                            </StyledText>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  />
                </View>

                {/* Meal Frequency */}
                <View style={styles.inputContainer}>
                  <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.inputLabel}>
                    How many meals per day?
                  </StyledText>
                  <Controller
                    control={control}
                    name="mealFrequency"
                    render={({ field: { onChange, value } }) => (
                      <SegmentedButtons
                        value={value.toString()}
                        onValueChange={(val) => onChange(parseInt(val, 10))}
                        buttons={[
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
                  {errors.mealFrequency && (
                    <StyledText variant="bodySmall" color={colors.feedback.error}>
                      {errors.mealFrequency.message}
                    </StyledText>
                  )}
                </View>

                {/* Country/Region */}
                <Controller
                  control={control}
                  name="countryRegion"
                  render={({ field: { onChange, value } }) => (
                    <View style={styles.inputWrapper}>
                      <TextInput
                        style={styles.textInput}
                        placeholder="Country or Region"
                        placeholderTextColor={colors.text.secondary}
                        value={value}
                        onChangeText={onChange}
                      />
                    </View>
                  )}
                />

                {/* Meal Times */}
                {showTimePicker && Platform.OS !== 'web' && (
                  <DateTimePicker
                    value={new Date()}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, selectedDate) => {
                      onTimeChange(event, selectedDate, currentMeal);
                    }}
                  />
                )}
                {renderTimePicker()}

                {/* Water Intake Goal */}
                <Controller
                  control={control}
                  name="waterIntakeGoal"
                  render={({ field: { onChange, value } }) => (
                    <View style={styles.inputContainer}>
                      <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.inputLabel}>
                        Daily Water Intake Goal
                      </StyledText>
                      <View style={styles.waterIntakeRow}>
                        <TextInput
                          style={[styles.textInput, styles.waterIntakeInput]}
                          keyboardType="numeric"
                          value={value ? value.toString() : "2000"}
                          onChangeText={(text) => onChange(parseInt(text) || 2000)}
                        />
                        
                        <Controller
                          control={control}
                          name="waterIntakeUnit"
                          render={({ field: { onChange, value } }) => (
                            <View style={styles.unitSelector}>
                              {['ml', 'l', 'oz'].map((unit) => (
                                <TouchableOpacity
                                  key={unit}
                                  style={[
                                    styles.unitButton,
                                    value === unit && styles.selectedUnitButton
                                  ]}
                                  onPress={() => onChange(unit)}
                                >
                                  <StyledText
                                    variant="bodySmall"
                                    style={value === unit ? {...styles.unitText, ...styles.selectedUnitText} : styles.unitText}
                                  >
                                    {unit}
                                  </StyledText>
                                </TouchableOpacity>
                              ))}
                            </View>
                          )}
                        />
                      </View>
                    </View>
                  )}
                />

                {/* Other Allergies */}
                <View style={styles.inputContainer}>
                  <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.inputLabel}>
                    Other Allergies (optional)
                  </StyledText>
                  <Controller
                    control={control}
                    name="otherAllergies"
                    render={({ field: { onChange, value } }) => (
                      <TextInput
                        style={styles.textInput}
                        placeholder="Other allergies or food sensitivities"
                        placeholderTextColor={colors.text.secondary}
                        value={value}
                        onChangeText={onChange}
                      />
                    )}
                  />
                </View>

                {/* Submit Button */}
                <View style={styles.buttonContainer}>
                  <Button
                    mode="contained"
                    onPress={handleSubmit(onSubmit)}
                    style={[styles.button, styles.primaryButton]}
                    labelStyle={styles.buttonLabel}
                    loading={submitting}
                    disabled={submitting}
                  >
                    {submitting ? 'Saving...' : 'Save and Continue'}
                  </Button>
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
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
  keyboardAvoidingView: {
    flex: 1,
  },
  header: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
  },
  backButton: {
    marginBottom: spacing.md,
  },
  headerText: {
    marginBottom: spacing.md,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 100, // Add extra padding for bottom
  },
  sectionTitle: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  formSection: {
    marginBottom: spacing.xl,
  },
  inputLabel: {
    marginBottom: spacing.xs,
  },
  dietTypeButtons: {
    marginBottom: spacing.md,
  },
  allergensLabel: {
    marginBottom: spacing.xs,
  },
  allergensContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.sm,
  },
  allergenChip: {
    margin: spacing.xs / 2, // Using xs/2 instead of xxs which doesn't exist
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  otherAllergiesInput: {
    marginTop: spacing.sm,
  },
  mealFrequencyContainer: {
    marginVertical: spacing.md,
  },
  sliderLabelsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  mealTimesContainer: {
    marginVertical: spacing.md,
  },
  mealTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: spacing.xs,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.light,
  },
  mealTypeLabel: {
    flex: 1,
  },
  mealTimeLabel: {
    flex: 1,
  },
  timePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    backgroundColor: colors.surface.light,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface.dark,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    flex: 2,
  },
  timePickerText: {
    marginRight: spacing.sm,
  },
  waterIntakeContainer: {
    marginVertical: spacing.md,
  },
  waterIntakeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  waterIntakeInput: {
    flex: 2,
    marginRight: spacing.md,
  },
  waterUnitSelector: {
    flex: 1,
  },
  submitButton: {
    marginVertical: spacing.xl,
    marginBottom: spacing.xxl,
  },
  buttonContent: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingIndicator: {
    marginRight: spacing.sm,
  },
  formErrorText: {
    color: colors.feedback.error,
    marginBottom: spacing.sm,
  },
  inputWrapper: {
    marginVertical: spacing.sm,
  },
  webTimeInput: {
    backgroundColor: colors.surface.dark,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderColor: colors.border.medium,
    borderWidth: 1,
    flex: 1,
  },
});
