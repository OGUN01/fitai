import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  KeyboardAvoidingView, 
  Platform, 
  Dimensions,
  TouchableOpacity,
  ImageBackground 
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

// Get screen dimensions for responsive sizing
const { width, height } = Dimensions.get('window');

// Define the type based on the Zod schema
type UserDetailsFormData = z.infer<typeof userDetailsSchema>;

export default function UserDetailsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { updateProfile, profile } = useProfile();
  const { user } = useAuth();
  
  // Get URL params including returnToReview
  const params = useLocalSearchParams<{
    returnToReview?: string;
  }>();
  
  // Log params for debugging using useEffect instead of useState
  useEffect(() => {
    console.log('User details params:', params);
    console.log('returnToReview value:', params?.returnToReview);
  }, [params]);
  
  const { control, handleSubmit, formState: { errors }, setValue, watch } = useForm<UserDetailsFormData>({
    resolver: zodResolver(userDetailsSchema),
    defaultValues: {
      fullName: profile?.full_name || '',
      age: undefined,
      gender: 'prefer-not-to-say',
      height: profile?.height || undefined,
      heightUnit: 'cm',
      currentWeight: profile?.current_weight || undefined,
      targetWeight: profile?.target_weight || undefined,
      weightUnit: 'kg',
      fitnessGoal: 'improved-fitness',
      activityLevel: 'moderately-active',
    }
  });

  // Watch values for the form
  const heightUnit = watch('heightUnit');
  const weightUnit = watch('weightUnit');

  const onSubmit = (data: UserDetailsFormData) => {
    console.log('Form submitted:', data);
    
    // Update the profile context with the form data
    updateProfile(data);
    
    // Navigate based on return param or to the next screen
    if (params?.returnToReview === 'true') {
      router.back();
    } else {
      router.push('/diet-preferences');
    }
  };

  // Age options for selection
  const ageRanges = [
    { label: '<18', value: 16 },
    { label: '18-24', value: 21 },
    { label: '25-34', value: 30 },
    { label: '35-44', value: 40 },
    { label: '45-54', value: 50 },
    { label: '55-64', value: 60 },
    { label: '65+', value: 70 }
  ];

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient
        colors={[colors.background.primary, colors.background.secondary]}
        style={styles.background}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      >
        {/* Decorative elements */}
        <View style={[styles.decorativeCircle, styles.decorativeCircle1]} />
        <View style={[styles.decorativeCircle, styles.decorativeCircle2]} />
        <View style={[styles.decorativeCircle, styles.decorativeCircle3]} />
        
        <SafeAreaView style={styles.safeArea}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardAvoid}
          >
            <ScrollView 
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Header with back button */}
              <View style={styles.headerContainer}>
                <TouchableOpacity
                  style={styles.backButton} 
                  onPress={() => router.back()}
                  accessibilityLabel="Go back"
                >
                  <MaterialCommunityIcons
                    name="arrow-left"
                    size={24}
                    color={colors.text.primary}
                  />
                </TouchableOpacity>
                
                <View style={styles.header}>
                  <StyledText variant="headingLarge" style={styles.title}>
                    Your Profile Details
                  </StyledText>
                  <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.subtitle}>
                    Tell us about yourself so we can personalize your fitness journey
                  </StyledText>
                </View>
              </View>

              {/* Form Card */}
              <View style={styles.formCard}>
                {/* Full Name */}
                <View style={styles.inputContainer}>
                  <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.inputLabel}>
                    Full Name
                  </StyledText>
                  <Controller
                    control={control}
                    name="fullName"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        style={styles.input}
                        mode="outlined"
                        placeholder="Your name"
                        error={!!errors.fullName}
                        outlineColor={colors.border.medium}
                        activeOutlineColor={colors.primary.main}
                        textColor={colors.text.primary}
                        left={<TextInput.Icon icon="account" color={colors.text.secondary} />}
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
                  {errors.fullName && (
                    <StyledText variant="bodySmall" color={colors.feedback.error}>
                      {errors.fullName.message}
                    </StyledText>
                  )}
                </View>

                {/* Age */}
                <View style={styles.inputContainer}>
                  <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.inputLabel}>
                    Age
                  </StyledText>
                  <Controller
                    control={control}
                    name="age"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        value={value ? value.toString() : ''}
                        onChangeText={text => onChange(text ? parseInt(text, 10) : undefined)}
                        onBlur={onBlur}
                        style={styles.input}
                        mode="outlined"
                        keyboardType="numeric"
                        placeholder="Your age"
                        error={!!errors.age}
                        outlineColor={colors.border.medium}
                        activeOutlineColor={colors.primary.main}
                        textColor={colors.text.primary}
                        left={<TextInput.Icon icon="calendar" color={colors.text.secondary} />}
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
                  {errors.age && (
                    <StyledText variant="bodySmall" color={colors.feedback.error}>
                      {errors.age.message}
                    </StyledText>
                  )}
                </View>

                {/* Gender */}
                <View style={styles.inputContainer}>
                  <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.inputLabel}>
                    Gender
                  </StyledText>
                  <Controller
                    control={control}
                    name="gender"
                    render={({ field: { onChange, value } }) => (
                      <SegmentedButtons
                        value={value}
                        onValueChange={onChange}
                        buttons={[
                          { value: 'male', label: 'Male' },
                          { value: 'female', label: 'Female' },
                          { value: 'prefer-not-to-say', label: 'Prefer not to say' }
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
                  {errors.gender && (
                    <StyledText variant="bodySmall" color={colors.feedback.error}>
                      {errors.gender.message}
                    </StyledText>
                  )}
                </View>

                {/* Height with unit toggle */}
                <View style={styles.inputContainer}>
                  <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.inputLabel}>
                    Height
                  </StyledText>
                  <View style={styles.unitInputRow}>
                    <Controller
                      control={control}
                      name="height"
                      render={({ field: { onChange, onBlur, value } }) => (
                        <TextInput
                          value={value ? value.toString() : ''}
                          onChangeText={text => onChange(text ? parseFloat(text) : undefined)}
                          onBlur={onBlur}
                          style={[styles.input, { flex: 1 }]}
                          mode="outlined"
                          keyboardType="numeric"
                          placeholder={heightUnit === 'cm' ? "Height in cm" : "Height in inches"}
                          error={!!errors.height}
                          outlineColor={colors.border.medium}
                          activeOutlineColor={colors.primary.main}
                          textColor={colors.text.primary}
                          left={<TextInput.Icon icon="ruler" color={colors.text.secondary} />}
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
                    <Controller
                      control={control}
                      name="heightUnit"
                      render={({ field: { onChange, value } }) => (
                        <SegmentedButtons
                          value={value}
                          onValueChange={onChange}
                          buttons={[
                            { value: 'cm', label: 'cm' },
                            { value: 'in', label: 'in' }
                          ]}
                          style={styles.unitToggle}
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
                    <StyledText variant="bodySmall" color={colors.feedback.error}>
                      {errors.height.message}
                    </StyledText>
                  )}
                </View>

                {/* Current Weight with unit toggle */}
                <View style={styles.inputContainer}>
                  <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.inputLabel}>
                    Current Weight
                  </StyledText>
                  <View style={styles.unitInputRow}>
                    <Controller
                      control={control}
                      name="currentWeight"
                      render={({ field: { onChange, onBlur, value } }) => (
                        <TextInput
                          value={value ? value.toString() : ''}
                          onChangeText={text => onChange(text ? parseFloat(text) : undefined)}
                          onBlur={onBlur}
                          style={[styles.input, { flex: 1 }]}
                          mode="outlined"
                          keyboardType="numeric"
                          placeholder={weightUnit === 'kg' ? "Weight in kg" : "Weight in lbs"}
                          error={!!errors.currentWeight}
                          outlineColor={colors.border.medium}
                          activeOutlineColor={colors.primary.main}
                          textColor={colors.text.primary}
                          left={<TextInput.Icon icon="weight" color={colors.text.secondary} />}
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
                    <Controller
                      control={control}
                      name="weightUnit"
                      render={({ field: { onChange, value } }) => (
                        <SegmentedButtons
                          value={value}
                          onValueChange={onChange}
                          buttons={[
                            { value: 'kg', label: 'kg' },
                            { value: 'lb', label: 'lb' }
                          ]}
                          style={styles.unitToggle}
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
                    <StyledText variant="bodySmall" color={colors.feedback.error}>
                      {errors.currentWeight.message}
                    </StyledText>
                  )}
                </View>

                {/* Target Weight */}
                <View style={styles.inputContainer}>
                  <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.inputLabel}>
                    Target Weight ({weightUnit})
                  </StyledText>
                  <Controller
                    control={control}
                    name="targetWeight"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        value={value ? value.toString() : ''}
                        onChangeText={text => onChange(text ? parseFloat(text) : undefined)}
                        onBlur={onBlur}
                        style={styles.input}
                        mode="outlined"
                        keyboardType="numeric"
                        placeholder="Your target weight"
                        error={!!errors.targetWeight}
                        outlineColor={colors.border.medium}
                        activeOutlineColor={colors.primary.main}
                        textColor={colors.text.primary}
                        left={<TextInput.Icon icon="weight" color={colors.text.secondary} />}
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
                  {errors.targetWeight && (
                    <StyledText variant="bodySmall" color={colors.feedback.error}>
                      {errors.targetWeight.message}
                    </StyledText>
                  )}
                </View>

                {/* Fitness Goal */}
                <View style={styles.inputContainer}>
                  <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.inputLabel}>
                    Fitness Goal
                  </StyledText>
                  <Controller
                    control={control}
                    name="fitnessGoal"
                    render={({ field: { onChange, value } }) => (
                      <View style={styles.goalsContainer}>
                        <TouchableOpacity 
                          style={[styles.goalCard, value === 'weight-loss' && styles.selectedGoalCard]}
                          onPress={() => onChange('weight-loss')}
                        >
                          <MaterialCommunityIcons name="weight-lifter" size={30} color={value === 'weight-loss' ? colors.primary.main : colors.text.secondary} />
                          <StyledText 
                            variant="bodyMedium" 
                            color={value === 'weight-loss' ? colors.primary.main : colors.text.primary}
                            style={styles.goalText}
                          >
                            Weight Loss
                          </StyledText>
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                          style={[styles.goalCard, value === 'muscle-gain' && styles.selectedGoalCard]}
                          onPress={() => onChange('muscle-gain')}
                        >
                          <MaterialCommunityIcons name="arm-flex" size={30} color={value === 'muscle-gain' ? colors.primary.main : colors.text.secondary} />
                          <StyledText 
                            variant="bodyMedium" 
                            color={value === 'muscle-gain' ? colors.primary.main : colors.text.primary}
                            style={styles.goalText}
                          >
                            Muscle Gain
                          </StyledText>
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                          style={[styles.goalCard, value === 'improved-fitness' && styles.selectedGoalCard]}
                          onPress={() => onChange('improved-fitness')}
                        >
                          <MaterialCommunityIcons name="heart-pulse" size={30} color={value === 'improved-fitness' ? colors.primary.main : colors.text.secondary} />
                          <StyledText 
                            variant="bodyMedium" 
                            color={value === 'improved-fitness' ? colors.primary.main : colors.text.primary}
                            style={styles.goalText}
                          >
                            Overall Fitness
                          </StyledText>
                        </TouchableOpacity>
                      </View>
                    )}
                  />
                </View>

                {/* Activity Level */}
                <View style={styles.inputContainer}>
                  <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.inputLabel}>
                    Activity Level
                  </StyledText>
                  <Controller
                    control={control}
                    name="activityLevel"
                    render={({ field: { onChange, value } }) => (
                      <View style={styles.activityLevelContainer}>
                        {[
                          { value: 'sedentary', label: 'Sedentary', icon: 'sofa', description: 'Little to no exercise' },
                          { value: 'lightly-active', label: 'Lightly Active', icon: 'walk', description: 'Light exercise 1-3 days/week' },
                          { value: 'moderately-active', label: 'Moderately Active', icon: 'run', description: 'Moderate exercise 3-5 days/week' },
                          { value: 'very-active', label: 'Very Active', icon: 'run-fast', description: 'Hard exercise 6-7 days/week' },
                          { value: 'extremely-active', label: 'Extremely Active', icon: 'bike', description: 'Physical job & intense training' }
                        ].map((option) => (
                          <TouchableOpacity 
                            key={option.value}
                            style={[styles.activityOption, value === option.value && styles.selectedActivityOption]}
                            onPress={() => onChange(option.value)}
                          >
                            <View style={styles.activityIconContainer}>
                              <MaterialCommunityIcons 
                                name={option.icon} 
                                size={24} 
                                color={value === option.value ? colors.surface.light : colors.text.secondary}
                              />
                            </View>
                            <View style={styles.activityTextContainer}>
                              <StyledText 
                                variant="bodyMedium" 
                                color={value === option.value ? colors.surface.light : colors.text.primary}
                              >
                                {option.label}
                              </StyledText>
                              <StyledText 
                                variant="bodySmall" 
                                color={value === option.value ? colors.surface.light : colors.text.secondary}
                              >
                                {option.description}
                              </StyledText>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  />
                </View>

                {/* Primary Button */}
                <Button
                  mode="contained"
                  onPress={handleSubmit(onSubmit)}
                  style={styles.button}
                  contentStyle={styles.buttonContent}
                  buttonColor={colors.primary.main}
                  labelStyle={styles.buttonLabel}
                  icon={({ size, color }) => (
                    <MaterialCommunityIcons name="arrow-right" size={size} color={color} />
                  )}
                >
                  Save and Continue
                </Button>
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
  keyboardAvoid: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xxl,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.xl,
    paddingBottom: spacing.lg,
  },
  backButton: {
    marginRight: spacing.md,
  },
  header: {
    flex: 1,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: spacing.xs,
  },
  subtitle: {
    marginBottom: spacing.md,
  },
  formCard: {
    backgroundColor: colors.surface.light,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
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
  unitInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  unitToggle: {
    width: 100,
  },
  segmentedButtons: {
    marginTop: spacing.xs,
  },
  button: {
    marginTop: spacing.md,
    borderRadius: borderRadius.round,
  },
  buttonContent: {
    paddingVertical: spacing.sm,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  decorativeCircle: {
    position: 'absolute',
    borderRadius: borderRadius.round,
    opacity: 0.1,
  },
  decorativeCircle1: {
    width: width * 0.4,
    height: width * 0.4,
    backgroundColor: colors.accent.lavender,
    top: -width * 0.1,
    right: -width * 0.1,
  },
  decorativeCircle2: {
    width: width * 0.3,
    height: width * 0.3,
    backgroundColor: colors.primary.main,
    bottom: height * 0.3,
    left: -width * 0.15,
  },
  decorativeCircle3: {
    width: width * 0.2,
    height: width * 0.2,
    backgroundColor: colors.accent.lavender,
    bottom: height * 0.5,
    right: -width * 0.1,
  },
  goalsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  goalCard: {
    backgroundColor: colors.surface.dark,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedGoalCard: {
    backgroundColor: colors.primary.main,
  },
  goalText: {
    marginTop: spacing.xs,
  },
  activityLevelContainer: {
    flexDirection: 'column',
    gap: spacing.md,
  },
  activityOption: {
    backgroundColor: colors.surface.dark,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedActivityOption: {
    backgroundColor: colors.primary.main,
  },
  activityIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface.dark,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  activityTextContainer: {
    flex: 1,
  },
});
