import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  KeyboardAvoidingView, 
  Platform, 
  Dimensions,
  TouchableOpacity,
  ImageBackground,
  Image,
  Animated,
  Alert
} from 'react-native';
import { TextInput, Button, SegmentedButtons, useTheme, IconButton } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { userDetailsSchema } from '../../constants/validation';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { z } from 'zod';
import { useProfile } from '../../contexts/ProfileContext';
import { useAuth } from '../../contexts/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import StyledText from '../../components/ui/StyledText';
import { colors, spacing, borderRadius, shadows } from '../../theme/theme';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';

// Get screen dimensions for responsive sizing
const { width, height } = Dimensions.get('window');

type UserDetailsFormData = z.infer<typeof userDetailsSchema>;

export default function UserDetailsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { updateProfile, profile } = useProfile();
  const { user } = useAuth();
  
  // Animation values
  const [animatedScale] = useState(new Animated.Value(0.95));
  
  // Get URL params including returnToReview
  const params = useLocalSearchParams<{
    returnToReview?: string;
  }>();
  
  // Log params for debugging using useEffect instead of useState
  useEffect(() => {
    console.log('User details params:', params);
    console.log('returnToReview value:', params?.returnToReview);
    
    // Entrance animation
    Animated.spring(animatedScale, {
      toValue: 1,
      tension: 50,
      friction: 7,
      useNativeDriver: true
    }).start();
  }, [params]);
  
  const { control, handleSubmit, formState: { errors }, setValue, watch } = useForm<UserDetailsFormData>({
    resolver: zodResolver(userDetailsSchema),
    defaultValues: {
      fullName: profile?.full_name || '',
      age: undefined,
      gender: 'prefer-not-to-say',
      // @ts-ignore - Property exists at runtime but not in TypeScript definition
      height: profile?.height || undefined,
      heightUnit: 'cm',
      // @ts-ignore - Property exists at runtime but not in TypeScript definition
      currentWeight: profile?.current_weight || undefined,
      // @ts-ignore - Property exists at runtime but not in TypeScript definition
      targetWeight: profile?.target_weight || undefined,
      weightUnit: 'kg',
      fitnessGoal: 'improved-fitness',
      activityLevel: 'moderately-active',
    }
  });

  // Update form with current profile values when component mounts or profile changes
  useEffect(() => {
    if (profile) {
      console.log("Updating user details form with latest profile values");
      
      // Extract values from profile with appropriate fallbacks
      const fullName = profile.full_name || '';
      const age = profile.age || undefined;
      // @ts-ignore - Property issues, but they exist at runtime
      const height = profile.height_cm || profile.height || undefined;
      // @ts-ignore - Property issues, but they exist at runtime
      const currentWeight = profile.weight_kg || profile.current_weight || undefined;
      // @ts-ignore - Property issues, but they exist at runtime
      const targetWeight = profile.target_weight_kg || profile.target_weight || undefined;
      const gender = profile.gender || 'prefer-not-to-say';
      // @ts-ignore - Property exists at runtime but not in TypeScript definition
      const fitnessGoal = profile.fitness_goal || 'improved-fitness';
      const activityLevel = profile.activity_level || 'moderately-active';
      
      // Log the values we're setting
      console.log("Setting user details form with:", {
        fullName,
        age,
        height,
        currentWeight,
        targetWeight,
        gender,
        fitnessGoal,
        activityLevel
      });
      
      // Set form values
      setValue('fullName', fullName);
      if (age) setValue('age', age);
      if (height) setValue('height', height);
      if (currentWeight) setValue('currentWeight', currentWeight);
      if (targetWeight) setValue('targetWeight', targetWeight);
      setValue('gender', gender as any);
      setValue('fitnessGoal', fitnessGoal as any);
      setValue('activityLevel', activityLevel as any);
    }
  }, [profile, setValue]);

  // Watch values for the form
  const heightUnit = watch('heightUnit');
  const weightUnit = watch('weightUnit');

  // Function to handle selecting options
  const handleOptionSelection = (onChange: (...event: any[]) => void, value: any) => {
    onChange(value);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const onSubmit = (data: UserDetailsFormData) => {
    console.log('Form submitted:', data);
    
    // Convert height from feet to cm if needed
    let heightInCm = data.height;
    let originalHeight = data.height;
    let heightUnit = data.heightUnit;
    if (data.heightUnit === 'ft') {
      // Convert feet to cm (1 foot = 30.48 cm)
      heightInCm = data.height * 30.48;
    }
    
    // Convert weight from lb to kg if needed
    let weightInKg = data.currentWeight;
    let originalWeight = data.currentWeight;
    let targetWeightInKg = data.targetWeight;
    let originalTargetWeight = data.targetWeight;
    let weightUnit = data.weightUnit;
    if (data.weightUnit === 'lbs') {
      // Convert pounds to kg (1 lb = 0.45359237 kg)
      weightInKg = data.currentWeight * 0.45359237;
      targetWeightInKg = data.targetWeight * 0.45359237;
    }
    
    // Transform the form data to match the profile database schema
    const profileData = {
      // Basic profile information
      full_name: data.fullName,
      age: data.age,
      gender: data.gender,
      
      // Always store standardized metric values in the primary columns
      height_cm: heightInCm,      // Store in cm for consistency
      weight_kg: weightInKg,      // Store in kg for consistency
      target_weight_kg: targetWeightInKg, // Store in kg for consistency
      
      // Store units and other details in the body_analysis JSONB column
      body_analysis: {
        // Include values in both original and converted formats
        original_height: originalHeight,
        original_weight: originalWeight,
        original_target_weight: originalTargetWeight,
        height_cm: heightInCm,
        weight_kg: weightInKg,
        target_weight_kg: targetWeightInKg,
        height_unit: heightUnit,
        weight_unit: weightUnit
      } as any, // Use type assertion to bypass TypeScript check since Supabase will accept this JSON
      
      // Fitness goals - use the columns that actually exist in the database
      weight_goal: data.fitnessGoal, // This is the correct column in the database
      fitness_goals: [data.fitnessGoal], // This is also a valid column as array type
      
      // Activity level - stored as a direct column
      activity_level: data.activityLevel,
      
      // Track onboarding progress
      current_onboarding_step: 'diet-preferences'
    };
    
    try {
      // Update the profile context with the properly mapped data
      updateProfile(profileData);
      
      // Navigate based on return param or to the next screen
      if (params?.returnToReview === 'true') {
        console.log("Returning to review page as requested");
        router.push('/review');
      } else {
        router.push('/diet-preferences');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update your profile. Please try again.');
    }
  };

  const activityLevels = [
    { 
      value: 'sedentary', 
      title: 'Sedentary', 
      description: 'Little to no exercise',
      icon: 'sofa' 
    },
    { 
      value: 'lightly-active', 
      title: 'Lightly Active', 
      description: 'Light exercise 1-3 days/week',
      icon: 'walk' 
    },
    { 
      value: 'moderately-active', 
      title: 'Moderately Active', 
      description: 'Moderate exercise 3-5 days/week',
      icon: 'bike' 
    },
    { 
      value: 'very-active', 
      title: 'Very Active', 
      description: 'Hard exercise 6-7 days/week',
      icon: 'run' 
    },
    { 
      value: 'extremely-active', 
      title: 'Extremely Active', 
      description: 'Very hard exercise & physical job',
      icon: 'weight-lifter' 
    },
  ];

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Background Image */}
      <ImageBackground 
        source={require('../../assets/images/onboarding/user-detail-background.jpg')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <LinearGradient
          colors={['rgba(23, 20, 41, 0.8)', 'rgba(42, 37, 80, 0.9)']}
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
              style={styles.keyboardAvoid}
            >
              <View style={styles.header}>
                <TouchableOpacity
                  style={styles.backButton} 
                  onPress={() => router.back()}
                  accessibilityLabel="Go back"
                >
                  <MaterialCommunityIcons
                    name="arrow-left"
                    size={24}
                    color={colors.text.primary}
                    style={styles.backIcon}
                  />
                </TouchableOpacity>
                
                <StyledText variant="headingLarge" style={styles.title}>
                  About You
                </StyledText>
                <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.subtitle}>
                  Help us create your perfect fitness journey
                </StyledText>
              </View>

              {/* Progress Bar */}
              <View style={styles.progressContainer}>
                <View style={styles.progressBarContainer}>
                  <View style={styles.progressBar}>
                    <View style={styles.progressBarFill} />
                  </View>
                </View>
                <StyledText variant="bodySmall" color={colors.text.secondary} style={styles.progressText}>
                  Step 1 of 4
                </StyledText>
              </View>

              <ScrollView 
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                {/* Form Card - Wrapped with Animated for entrance animation */}
                <Animated.View 
                  style={[
                    styles.formCard,
                    { transform: [{ scale: animatedScale }] }
                  ]}
                >
                  <View style={[styles.blurContainer, { backgroundColor: 'rgba(0, 0, 0, 0.7)' }]}>
                    {/* Full Name */}
                    <View style={styles.inputContainer}>
                      <StyledText variant="bodyLarge" color={colors.text.primary} style={styles.inputLabel}>
                        Full Name
                      </StyledText>
                      <Controller
                        control={control}
                        name="fullName"
                        render={({ field: { onChange, onBlur, value } }) => (
                          <TextInput
                            style={styles.textInput}
                            mode="outlined"
                            placeholder="Enter your name"
                            value={value}
                            onChangeText={onChange}
                            onBlur={onBlur}
                            error={!!errors.fullName}
                            textColor="white"
                            theme={{ 
                              colors: { 
                                primary: colors.primary.main,
                                outline: colors.border.medium,
                                background: 'rgba(20, 15, 38, 0.5)',
                                text: 'white',
                                placeholder: colors.text.secondary,
                                surface: 'transparent',
                              } 
                            }}
                          />
                        )}
                      />
                      {errors.fullName && (
                        <StyledText variant="bodySmall" color={colors.feedback.error} style={styles.errorText}>
                          {errors.fullName.message}
                        </StyledText>
                      )}
                    </View>

                    {/* Age */}
                    <View style={styles.inputContainer}>
                      <StyledText variant="bodyLarge" color={colors.text.primary} style={styles.inputLabel}>
                        Age
                      </StyledText>
                      <Controller
                        control={control}
                        name="age"
                        render={({ field: { onChange, onBlur, value } }) => (
                          <TextInput
                            style={styles.textInput}
                            mode="outlined"
                            placeholder="Enter your age"
                            value={value ? String(value) : ''}
                            onChangeText={(text) => {
                              // Convert to number and only accept positive integers
                              const numberValue = text ? parseInt(text.replace(/[^0-9]/g, '')) : undefined;
                              onChange(numberValue);
                            }}
                            onBlur={onBlur}
                            error={!!errors.age}
                            keyboardType="number-pad"
                            textColor="white"
                            theme={{ 
                              colors: { 
                                primary: colors.primary.main,
                                outline: colors.border.medium,
                                background: 'rgba(20, 15, 38, 0.5)',
                                text: 'white',
                                placeholder: colors.text.secondary,
                                surface: 'transparent',
                              } 
                            }}
                          />
                        )}
                      />
                      {errors.age && (
                        <StyledText variant="bodySmall" color={colors.feedback.error} style={styles.errorText}>
                          {errors.age.message}
                        </StyledText>
                      )}
                    </View>

                    {/* Gender */}
                    <View style={styles.inputContainer}>
                      <StyledText variant="bodyLarge" color={colors.text.primary} style={styles.inputLabel}>
                        Gender
                      </StyledText>
                      <Controller
                        control={control}
                        name="gender"
                        render={({ field: { onChange, value } }) => (
                          <View style={styles.genderOptionsContainer}>
                            {[
                              { value: 'male', label: 'Male', icon: 'gender-male' },
                              { value: 'female', label: 'Female', icon: 'gender-female' },
                              { value: 'non-binary', label: 'Non-binary', icon: 'gender-non-binary' },
                              { value: 'prefer-not-to-say', label: 'Prefer not to say', icon: 'account-question' },
                            ].map((option) => (
                              <TouchableOpacity
                                key={option.value}
                                style={[
                                  styles.genderOption,
                                  value === option.value && styles.selectedGenderOption,
                                ]}
                                onPress={() => handleOptionSelection(onChange, option.value)}
                              >
                                <MaterialCommunityIcons
                                  name={option.icon}
                                  size={20}
                                  color={value === option.value ? 'white' : colors.text.secondary}
                                  style={styles.genderIcon}
                                />
                                <StyledText
                                  variant="bodyMedium"
                                  color={value === option.value ? 'white' : colors.text.primary}
                                  style={styles.genderOptionLabel}
                                >
                                  {option.label}
                                </StyledText>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      />
                    </View>

                    {/* Height */}
                    <View style={styles.inputContainer}>
                      <StyledText variant="bodyLarge" color={colors.text.primary} style={styles.inputLabel}>
                        Height
                      </StyledText>
                      <View style={styles.measurementContainer}>
                        <Controller
                          control={control}
                          name="height"
                          render={({ field: { onChange, onBlur, value } }) => (
                            <TextInput
                              style={styles.measurementInput}
                              mode="outlined"
                              placeholder={heightUnit === 'cm' ? '175' : '5.9'}
                              value={value ? value.toString() : ''}
                              onChangeText={(text) => onChange(parseFloat(text) || '')}
                              onBlur={onBlur}
                              keyboardType="numeric"
                              error={!!errors.height}
                              textColor="white"
                              theme={{ 
                                colors: { 
                                  primary: colors.primary.main,
                                  outline: colors.border.medium,
                                  background: 'rgba(20, 15, 38, 0.5)',
                                  text: 'white',
                                  placeholder: colors.text.secondary,
                                  surface: 'transparent',
                                } 
                              }}
                            />
                          )}
                        />
                        <Controller
                          control={control}
                          name="heightUnit"
                          render={({ field: { onChange, value } }) => (
                            <SegmentedButtons
                              value={value}
                              onValueChange={onChange}
                              buttons={[
                                { value: 'cm', label: 'cm' },
                                { value: 'ft', label: 'ft' },
                              ]}
                              style={styles.unitSelector}
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
                      </View>
                      {errors.height && (
                        <StyledText variant="bodySmall" color={colors.feedback.error} style={styles.errorText}>
                          {errors.height.message}
                        </StyledText>
                      )}
                    </View>

                    {/* Current Weight */}
                    <View style={styles.inputContainer}>
                      <StyledText variant="bodyLarge" color={colors.text.primary} style={styles.inputLabel}>
                        Current Weight
                      </StyledText>
                      <View style={styles.measurementContainer}>
                        <Controller
                          control={control}
                          name="currentWeight"
                          render={({ field: { onChange, onBlur, value } }) => (
                            <TextInput
                              style={styles.measurementInput}
                              mode="outlined"
                              placeholder={weightUnit === 'kg' ? '70' : '154'}
                              value={value ? value.toString() : ''}
                              onChangeText={(text) => onChange(parseFloat(text) || '')}
                              onBlur={onBlur}
                              keyboardType="numeric"
                              error={!!errors.currentWeight}
                              textColor="white"
                              theme={{ 
                                colors: { 
                                  primary: colors.primary.main,
                                  outline: colors.border.medium,
                                  background: 'rgba(20, 15, 38, 0.5)',
                                  text: 'white',
                                  placeholder: colors.text.secondary,
                                  surface: 'transparent',
                                } 
                              }}
                            />
                          )}
                        />
                        <Controller
                          control={control}
                          name="weightUnit"
                          render={({ field: { onChange, value } }) => (
                            <SegmentedButtons
                              value={value}
                              onValueChange={onChange}
                              buttons={[
                                { value: 'kg', label: 'kg' },
                                { value: 'lb', label: 'lb' },
                              ]}
                              style={styles.unitSelector}
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
                      </View>
                      {errors.currentWeight && (
                        <StyledText variant="bodySmall" color={colors.feedback.error} style={styles.errorText}>
                          {errors.currentWeight.message}
                        </StyledText>
                      )}
                    </View>

                    {/* Target Weight */}
                    <View style={styles.inputContainer}>
                      <StyledText variant="bodyLarge" color={colors.text.primary} style={styles.inputLabel}>
                        Target Weight
                      </StyledText>
                      <View style={styles.measurementContainer}>
                        <Controller
                          control={control}
                          name="targetWeight"
                          render={({ field: { onChange, onBlur, value } }) => (
                            <TextInput
                              style={styles.measurementInput}
                              mode="outlined"
                              placeholder={weightUnit === 'kg' ? '65' : '143'}
                              value={value ? value.toString() : ''}
                              onChangeText={(text) => onChange(parseFloat(text) || '')}
                              onBlur={onBlur}
                              keyboardType="numeric"
                              error={!!errors.targetWeight}
                              textColor="white"
                              theme={{ 
                                colors: { 
                                  primary: colors.primary.main,
                                  outline: colors.border.medium,
                                  background: 'rgba(20, 15, 38, 0.5)',
                                  text: 'white',
                                  placeholder: colors.text.secondary,
                                  surface: 'transparent',
                                } 
                              }}
                            />
                          )}
                        />
                        <Controller
                          control={control}
                          name="weightUnit"
                          render={({ field: { onChange, value } }) => (
                            <SegmentedButtons
                              value={value}
                              onValueChange={onChange}
                              buttons={[
                                { value: 'kg', label: 'kg' },
                                { value: 'lb', label: 'lb' },
                              ]}
                              style={styles.unitSelector}
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
                      </View>
                      {errors.targetWeight && (
                        <StyledText variant="bodySmall" color={colors.feedback.error} style={styles.errorText}>
                          {errors.targetWeight.message}
                        </StyledText>
                      )}
                    </View>

                    {/* Fitness Goal */}
                    <View style={styles.inputContainer}>
                      <StyledText variant="bodyLarge" color={colors.text.primary} style={styles.inputLabel}>
                        Fitness Goal
                      </StyledText>
                      <Controller
                        control={control}
                        name="fitnessGoal"
                        render={({ field: { onChange, value } }) => (
                          <View style={styles.fitnessGoalContainer}>
                            {[
                              { value: 'weight-loss', label: 'Weight Loss', icon: 'scale-bathroom' },
                              { value: 'muscle-gain', label: 'Muscle Gain', icon: 'arm-flex' },
                              { value: 'improved-fitness', label: 'Improved Fitness', icon: 'heart-pulse' },
                              { value: 'endurance', label: 'Endurance', icon: 'run-fast' },
                            ].map((goal) => (
                              <TouchableOpacity
                                key={goal.value}
                                style={[
                                  styles.fitnessGoalOption,
                                  value === goal.value && styles.selectedFitnessGoalOption,
                                ]}
                                onPress={() => handleOptionSelection(onChange, goal.value)}
                              >
                                <LinearGradient
                                  colors={value === goal.value ? 
                                    [colors.primary.main, colors.secondary.main] : 
                                    ['rgba(60, 55, 90, 0.4)', 'rgba(50, 45, 80, 0.4)']}
                                  start={{ x: 0, y: 0 }}
                                  end={{ x: 1, y: 1 }}
                                  style={styles.fitnessGoalGradient}
                                >
                                  <MaterialCommunityIcons
                                    name={goal.icon}
                                    size={28}
                                    color={value === goal.value ? 'white' : colors.text.secondary}
                                    style={styles.fitnessGoalIcon}
                                  />
                                  <StyledText
                                    variant="bodyMedium"
                                    color={value === goal.value ? 'white' : colors.text.primary}
                                    style={styles.fitnessGoalLabel}
                                  >
                                    {goal.label}
                                  </StyledText>
                                </LinearGradient>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      />
                    </View>

                    {/* Activity Level */}
                    <View style={styles.inputContainer}>
                      <StyledText variant="bodyLarge" color={colors.text.primary} style={styles.inputLabel}>
                        Activity Level
                      </StyledText>
                      <Controller
                        control={control}
                        name="activityLevel"
                        render={({ field: { onChange, value } }) => (
                          <View style={styles.activityLevelContainer}>
                            {activityLevels.map((activity) => (
                              <TouchableOpacity
                                key={activity.value}
                                style={[
                                  styles.activityOption,
                                  value === activity.value && styles.selectedActivityOption,
                                ]}
                                onPress={() => handleOptionSelection(onChange, activity.value)}
                              >
                                <View style={styles.activityIconContainer}>
                                  <MaterialCommunityIcons
                                    name={activity.icon}
                                    size={24}
                                    color={value === activity.value ? 'white' : colors.text.secondary}
                                  />
                                </View>
                                <View style={styles.activityTextContainer}>
                                  <StyledText
                                    variant="bodyMedium"
                                    color={value === activity.value ? 'white' : colors.text.primary}
                                    style={styles.activityTitle}
                                  >
                                    {activity.title}
                                  </StyledText>
                                  <StyledText
                                    variant="bodySmall"
                                    color={value === activity.value ? 'white' : colors.text.secondary}
                                    style={styles.activityDescription}
                                  >
                                    {activity.description}
                                  </StyledText>
                                </View>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      />
                    </View>

                    {/* Submit Button */}
                    <TouchableOpacity
                      onPress={handleSubmit(onSubmit)}
                      activeOpacity={0.8}
                      style={styles.submitButtonContainer}
                    >
                      <LinearGradient
                        colors={[colors.primary.main, colors.secondary.main]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.submitButton}
                      >
                        <StyledText variant="bodyLarge" color="white" style={styles.buttonLabel}>
                          Save and Continue
                        </StyledText>
                        <MaterialCommunityIcons 
                          name="arrow-right" 
                          size={20} 
                          color="white" 
                          style={styles.buttonIcon}
                        />
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </LinearGradient>
      </ImageBackground>
    </View>
  );
}

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
  keyboardAvoid: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
    ...shadows.small,
  },
  backIcon: {
    marginLeft: -1, // Visual alignment
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: spacing.xs,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 17,
    marginBottom: spacing.md,
    color: colors.text.secondary,
    letterSpacing: 0.2,
  },
  progressContainer: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  progressBar: {
    height: '100%',
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
    width: '25%', // 1 of 4 steps
    backgroundColor: colors.primary.main,
    borderRadius: 4,
  },
  progressText: {
    textAlign: 'right',
    fontSize: 13,
    letterSpacing: 0.2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl * 1.5,
  },
  formCard: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...shadows.large,
    elevation: 8,
  },
  blurContainer: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    padding: spacing.lg + 4,
    marginBottom: spacing.lg,
    backgroundColor: 'rgba(20, 15, 38, 0.85)', 
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    ...shadows.large,
  },
  inputContainer: {
    marginBottom: spacing.lg,
  },
  inputLabel: {
    marginBottom: spacing.sm,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  textInput: {
    backgroundColor: 'rgba(30, 25, 50, 0.5)',
    borderRadius: borderRadius.md,
    fontSize: 16,
    height: 56,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  errorText: {
    marginTop: spacing.xs,
    letterSpacing: 0.2,
  },
  genderOptionsContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  genderOption: {
    flex: 1,
    paddingVertical: spacing.md + 2,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(60, 55, 90, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.small,
  },
  selectedGenderOption: {
    backgroundColor: `${colors.primary.main}e6`,
    borderColor: colors.primary.light,
  },
  genderIcon: {
    marginBottom: spacing.xs,
    opacity: 0.9,
  },
  genderOptionLabel: {
    fontSize: 16,
    color: 'white',
  },
  measurementContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  measurementInput: {
    flex: 1,
    backgroundColor: 'rgba(30, 25, 50, 0.5)',
    borderRadius: borderRadius.md,
    fontSize: 16,
    height: 56,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  unitSelector: {
    minWidth: 110,
    height: 56,
  },
  fitnessGoalContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  fitnessGoalOption: {
    width: '48%',
    marginBottom: spacing.sm,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...shadows.medium,
  },
  selectedFitnessGoalOption: {
    borderWidth: 2,
    borderColor: colors.primary.main,
    transform: [{scale: 1.02}],
  },
  fitnessGoalGradient: {
    paddingVertical: spacing.lg + 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fitnessGoalIcon: {
    marginBottom: spacing.sm,
  },
  fitnessGoalLabel: {
    fontSize: 16,
    color: 'white',
  },
  activityLevelContainer: {
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  activityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md + 4,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(60, 55, 90, 0.5)',
    marginBottom: spacing.sm,
    ...shadows.small,
  },
  selectedActivityOption: {
    backgroundColor: `${colors.primary.main}e6`,
    borderColor: colors.primary.light,
  },
  activityIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    ...shadows.small,
  },
  activityTextContainer: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    color: 'white',
  },
  activityDescription: {
    fontSize: 14,
    color: 'white',
  },
  submitButton: {
    marginTop: spacing.xl,
    borderRadius: borderRadius.lg,
    height: 56,
    ...shadows.medium,
  },
  submitButtonContainer: {
    paddingHorizontal: spacing.md,
  },
  buttonLabel: {
    fontSize: 16,
    color: 'white',
  },
  buttonIcon: {
    marginLeft: spacing.sm,
  },
});
