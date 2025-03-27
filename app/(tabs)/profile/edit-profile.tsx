import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text, Button, TextInput, useTheme, Surface, Avatar, SegmentedButtons, HelperText } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useProfile } from '../../../contexts/ProfileContext';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, interpolate, Extrapolate } from 'react-native-reanimated';
import Slider from '@react-native-community/slider';
import { colors, spacing, borderRadius, shadows, gradients } from '../../../theme/theme';
import Svg, { Path, Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { TextInput as RNTextInput } from 'react-native';

// Update the EditProfileSchema to include unit fields and water intake
const editProfileSchema = z.object({
  full_name: z.string().min(2, 'Name must have at least 2 characters').optional(),
  height: z.number().positive('Height must be positive').optional(),
  heightUnit: z.enum(['cm', 'ft']).optional(),
  weight: z.number().positive('Weight must be positive').optional(),
  weightUnit: z.enum(['kg', 'lbs']).optional(),
  target_weight: z.number().positive('Target weight must be positive').optional(),
  fitness_goal: z.enum(['weight-loss', 'muscle-gain', 'improved-fitness']).optional(),
  water_intake_goal: z.number().min(0.1).max(10),
  water_intake_unit: z.enum(['l', 'oz']),
});

type EditProfileFormData = z.infer<typeof editProfileSchema>;

// Water bottle fill icon SVG component
const WaterBottleFill = ({ fillPercentage }: { fillPercentage: number }) => {
  const height = 100;
  const width = 45;
  const cornerRadius = 5;
  const neckWidth = 18;
  const neckHeight = 15;
  const fillHeight = (height - neckHeight) * (fillPercentage / 100);

  return (
    <Svg height={height} width={width} viewBox={`0 0 ${width} ${height}`}>
      <Defs>
        <SvgLinearGradient id="waterGradient" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#36D1DC" stopOpacity="1" />
          <Stop offset="1" stopColor="#5B86E5" stopOpacity="1" />
        </SvgLinearGradient>
      </Defs>
      
      {/* Bottle outline */}
      <Path
        d={`
          M${(width - neckWidth) / 2},0
          L${(width - neckWidth) / 2},${neckHeight}
          Q${cornerRadius},${neckHeight} ${cornerRadius},${neckHeight + cornerRadius}
          L${cornerRadius},${height - cornerRadius}
          Q${cornerRadius},${height} ${cornerRadius * 2},${height}
          L${width - cornerRadius * 2},${height}
          Q${width - cornerRadius},${height} ${width - cornerRadius},${height - cornerRadius}
          L${width - cornerRadius},${neckHeight + cornerRadius}
          Q${width - cornerRadius},${neckHeight} ${width - neckWidth - (width - neckWidth) / 2},${neckHeight}
          L${width - neckWidth - (width - neckWidth) / 2},0
          Z
        `}
        fill="rgba(255, 255, 255, 0.1)"
        stroke="rgba(255, 255, 255, 0.2)"
        strokeWidth="1"
      />
      
      {/* Water fill */}
      {fillPercentage > 0 && (
        <Path
          d={`
            M${cornerRadius + 2},${height - fillHeight}
            L${cornerRadius + 2},${height - cornerRadius - 2}
            Q${cornerRadius + 2},${height - 2} ${cornerRadius * 2 + 2},${height - 2}
            L${width - cornerRadius * 2 - 2},${height - 2}
            Q${width - cornerRadius - 2},${height - 2} ${width - cornerRadius - 2},${height - cornerRadius - 2}
            L${width - cornerRadius - 2},${height - fillHeight}
            Z
          `}
          fill="url(#waterGradient)"
        />
      )}
    </Svg>
  );
};

export default function EditProfileScreen() {
  const theme = useTheme();
  const { profile, updateProfile } = useProfile();
  const [saving, setSaving] = useState(false);
  const [sliderValue, setSliderValue] = useState(profile?.water_intake_goal || 3.5);
  
  // Animation values
  const headerAnimation = useSharedValue(0);
  const waterBottleAnimation = useSharedValue(0);

  useEffect(() => {
    // Trigger animations when component mounts
    headerAnimation.value = withSpring(1, { damping: 15 });
    waterBottleAnimation.value = withSpring(1, { damping: 12 });
  }, []);

  const { control, handleSubmit, formState: { errors }, watch, setValue } = useForm<EditProfileFormData>({
    resolver: zodResolver(editProfileSchema),
    defaultValues: {
      full_name: profile?.full_name || '',
      height: profile?.height_cm !== undefined ? profile.height_cm :
              profile?.body_analysis?.height_cm ||
              profile?.body_analysis?.original_height || undefined,
      heightUnit: (profile?.body_analysis?.height_unit as any) || 'cm',
      weight: profile?.weight_kg !== undefined ? profile.weight_kg :
              profile?.body_analysis?.weight_kg ||
              profile?.body_analysis?.original_weight || undefined,
      weightUnit: (profile?.body_analysis?.weight_unit as any) || 'kg',
      target_weight: profile?.target_weight_kg !== undefined ? profile.target_weight_kg :
                     profile?.body_analysis?.target_weight_kg ||
                     profile?.body_analysis?.original_target_weight || undefined,
      fitness_goal: (profile?.weight_goal as any) || 'improved-fitness',
      water_intake_goal: profile?.water_intake_goal || 3.5,
      water_intake_unit: (profile?.water_intake_unit as 'l' | 'oz') || 'l',
    }
  });

  // Watch values for unit conversions
  const heightUnit = watch('heightUnit');
  const weightUnit = watch('weightUnit');
  const waterIntakeUnit = watch('water_intake_unit');
  const waterIntakeGoal = watch('water_intake_goal');

  // Update slider when water intake changes from form
  useEffect(() => {
    if (waterIntakeGoal !== undefined) {
      setSliderValue(waterIntakeGoal);
    }
  }, [waterIntakeGoal]);

  // Animated styles
  const headerAnimStyle = useAnimatedStyle(() => {
    return {
      opacity: headerAnimation.value,
      transform: [
        { translateY: interpolate(headerAnimation.value, [0, 1], [-20, 0], Extrapolate.CLAMP) }
      ]
    };
  });

  const waterBottleAnimStyle = useAnimatedStyle(() => {
    return {
      opacity: waterBottleAnimation.value,
      transform: [
        { scale: interpolate(waterBottleAnimation.value, [0, 1], [0.8, 1], Extrapolate.CLAMP) }
      ]
    };
  });

  const onSubmit = async (data: EditProfileFormData) => {
    try {
      setSaving(true);

      // Convert height from feet to cm if needed
      let heightInCm = data.height;
      let originalHeight = data.height;
      if (data.heightUnit === 'ft' && data.height) {
        // Convert feet to cm (1 foot = 30.48 cm)
        heightInCm = data.height * 30.48;
      }

      // Convert weight from lb to kg if needed
      let weightInKg = data.weight;
      let originalWeight = data.weight;
      let targetWeightInKg = data.target_weight;
      let originalTargetWeight = data.target_weight;
      if (data.weightUnit === 'lbs') {
        // Convert pounds to kg (1 lb = 0.45359237 kg)
        if (data.weight) {
          weightInKg = data.weight * 0.45359237;
        }
        if (data.target_weight) {
          targetWeightInKg = data.target_weight * 0.45359237;
        }
      }

      // Create the profile updates object with only valid database columns
      const profileUpdates = {
        full_name: data.full_name,

        // Always store standardized metric values in the primary columns
        height_cm: heightInCm, // Valid column
        weight_kg: weightInKg, // Valid column
        target_weight_kg: targetWeightInKg, // Valid column

        // Store the fitness goal in correct columns
        weight_goal: data.fitness_goal, // Valid column
        fitness_goals: [data.fitness_goal], // Valid column

        // Store water intake goal
        water_intake_goal: data.water_intake_goal,
        water_intake_unit: data.water_intake_unit,

        // Store the original values and units in body_analysis
        body_analysis: {
          ...(profile?.body_analysis || {}),
          height_unit: data.heightUnit,
          weight_unit: data.weightUnit,
          original_height: originalHeight,
          original_weight: originalWeight,
          original_target_weight: originalTargetWeight,
          height_cm: heightInCm,
          weight_kg: weightInKg,
          target_weight_kg: targetWeightInKg,
        },
      };

      await updateProfile(profileUpdates);
      
      // Show success message
      Alert.alert('Success', 'Profile updated successfully');
      
      // Navigate back
      router.back();
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <StatusBar style="light" />
        
        {/* Premium Gradient Header */}
        <LinearGradient
          colors={['#FF2E93', '#FF6EB5', '#D30069']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.header}
        >
          <Animated.View style={[styles.headerContent, headerAnimStyle]}>
            <TouchableOpacity 
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
            </TouchableOpacity>
            <Text variant="headlineSmall" style={styles.headerTitle}>Edit Profile</Text>
          </Animated.View>
        </LinearGradient>

        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.avatarContainer}>
            <Avatar.Text
              size={80}
              label={profile?.full_name?.split(' ').map(n => n[0]).join('') || 'U'}
              style={styles.avatar}
              color="white"
            />
          </View>

          {/* Main Form Container */}
          <Surface style={styles.formContainer} elevation={1}>
            {/* Full Name */}
            <Controller
              control={control}
              name="full_name"
              render={({ field: { onChange, onBlur, value } }) => (
                <View style={styles.inputContainer}>
                  <TextInput
                    label="Full Name"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    mode="outlined"
                    style={[styles.input, { color: 'white' }]}
                    outlineColor="rgba(255,255,255,0.5)"
                    activeOutlineColor="#FF2E93"
                    theme={{ 
                      colors: { 
                        text: 'white', 
                        placeholder: 'white',
                        primary: '#FF2E93'
                      }
                    }}
                    placeholderTextColor="white"
                    error={!!errors.full_name}
                    left={<TextInput.Icon icon="account" color="#FF6EB5" />}
                    render={props => 
                      <RNTextInput 
                        {...props} 
                        style={[props.style, { color: 'white', fontSize: 18, fontWeight: '600' }]} 
                      />
                    }
                  />
                  {errors.full_name && (
                    <HelperText type="error">{errors.full_name.message}</HelperText>
                  )}
                </View>
              )}
            />

            {/* Height with units */}
            <Controller
              control={control}
              name="height"
              render={({ field: { onChange, onBlur, value } }) => (
                <View style={styles.inputContainer}>
                  <Text variant="bodyMedium" style={styles.label}>Height</Text>
                  <View style={styles.unitInputContainer}>
                    <TextInput
                      value={value?.toString() || ''}
                      onChangeText={(text) => onChange(text ? parseFloat(text) : undefined)}
                      onBlur={onBlur}
                      mode="outlined"
                      keyboardType="numeric"
                      style={[styles.unitInput, { color: 'white' }]}
                      outlineColor="rgba(255,255,255,0.5)"
                      activeOutlineColor="#FF2E93"
                      theme={{ 
                        colors: { 
                          text: 'white', 
                          placeholder: 'white',
                          primary: '#FF2E93'
                        }
                      }}
                      placeholderTextColor="white"
                      placeholder={heightUnit === 'cm' ? '175' : '5.9'}
                      error={!!errors.height}
                      left={<TextInput.Icon icon="human-male-height" color="#FF6EB5" />}
                      render={props => 
                        <RNTextInput 
                          {...props} 
                          style={[props.style, { color: 'white', fontSize: 18, fontWeight: '600' }]} 
                        />
                      }
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
                          theme={{ colors: { primary: '#FF2E93', secondaryContainer: 'rgba(255,255,255,0.2)' } }}
                        />
                      )}
                    />
                  </View>
                  {errors.height && (
                    <HelperText type="error">{errors.height.message}</HelperText>
                  )}
                </View>
              )}
            />

            {/* Current Weight with units */}
            <Controller
              control={control}
              name="weight"
              render={({ field: { onChange, onBlur, value } }) => (
                <View style={styles.inputContainer}>
                  <Text variant="bodyMedium" style={styles.label}>Current Weight</Text>
                  <View style={styles.unitInputContainer}>
                    <TextInput
                      value={value?.toString() || ''}
                      onChangeText={(text) => onChange(text ? parseFloat(text) : undefined)}
                      onBlur={onBlur}
                      mode="outlined"
                      keyboardType="numeric"
                      style={[styles.unitInput, { color: 'white' }]}
                      outlineColor="rgba(255,255,255,0.5)"
                      activeOutlineColor="#FF2E93"
                      theme={{ 
                        colors: { 
                          text: 'white', 
                          placeholder: 'white',
                          primary: '#FF2E93'
                        }
                      }}
                      placeholderTextColor="white"
                      placeholder={weightUnit === 'kg' ? '70' : '154'}
                      error={!!errors.weight}
                      left={<TextInput.Icon icon="weight" color="#FF6EB5" />}
                      render={props => 
                        <RNTextInput 
                          {...props} 
                          style={[props.style, { color: 'white', fontSize: 18, fontWeight: '600' }]} 
                        />
                      }
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
                            { value: 'lbs', label: 'lbs' },
                          ]}
                          style={styles.unitSelector}
                          theme={{ colors: { primary: '#FF2E93', secondaryContainer: 'rgba(255,255,255,0.2)' } }}
                        />
                      )}
                    />
                  </View>
                  {errors.weight && (
                    <HelperText type="error">{errors.weight.message}</HelperText>
                  )}
                </View>
              )}
            />

            {/* Target Weight with units */}
            <Controller
              control={control}
              name="target_weight"
              render={({ field: { onChange, onBlur, value } }) => (
                <View style={styles.inputContainer}>
                  <Text variant="bodyMedium" style={styles.label}>Target Weight</Text>
                  <View style={styles.unitInputContainer}>
                    <TextInput
                      value={value?.toString() || ''}
                      onChangeText={(text) => onChange(text ? parseFloat(text) : undefined)}
                      onBlur={onBlur}
                      mode="outlined"
                      keyboardType="numeric"
                      style={[styles.unitInput, { color: 'white' }]}
                      outlineColor="rgba(255,255,255,0.5)"
                      activeOutlineColor="#FF2E93"
                      theme={{ 
                        colors: { 
                          text: 'white', 
                          placeholder: 'white',
                          primary: '#FF2E93'
                        }
                      }}
                      placeholderTextColor="white"
                      placeholder={weightUnit === 'kg' ? '65' : '143'}
                      error={!!errors.target_weight}
                      left={<TextInput.Icon icon="target" color="#FF6EB5" />}
                      render={props => 
                        <RNTextInput 
                          {...props} 
                          style={[props.style, { color: 'white', fontSize: 18, fontWeight: '600' }]} 
                        />
                      }
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
                            { value: 'lbs', label: 'lbs' },
                          ]}
                          style={styles.unitSelector}
                          theme={{ colors: { primary: '#FF2E93', secondaryContainer: 'rgba(255,255,255,0.2)' } }}
                        />
                      )}
                    />
                  </View>
                  {errors.target_weight && (
                    <HelperText type="error">{errors.target_weight.message}</HelperText>
                  )}
                </View>
              )}
            />

            {/* Fitness Goal */}
            <View style={styles.inputContainer}>
              <Text variant="bodyMedium" style={styles.label}>Fitness Goal</Text>
              <Controller
                control={control}
                name="fitness_goal"
                render={({ field: { onChange, value } }) => (
                  <View style={styles.goalContainer}>
                    <TouchableOpacity 
                      style={[
                        styles.goalOption, 
                        value === 'weight-loss' && styles.goalOptionSelected
                      ]}
                      onPress={() => onChange('weight-loss')}
                    >
                      <FontAwesome5 
                        name="weight" 
                        size={24} 
                        color={value === 'weight-loss' ? 'white' : colors.secondary.main} 
                      />
                      <Text 
                        style={[
                          styles.goalText, 
                          value === 'weight-loss' && styles.goalTextSelected
                        ]}
                      >
                        Weight Loss
                      </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={[
                        styles.goalOption, 
                        value === 'muscle-gain' && styles.goalOptionSelected
                      ]}
                      onPress={() => onChange('muscle-gain')}
                    >
                      <FontAwesome5 
                        name="dumbbell" 
                        size={24} 
                        color={value === 'muscle-gain' ? 'white' : colors.secondary.main} 
                      />
                      <Text 
                        style={[
                          styles.goalText, 
                          value === 'muscle-gain' && styles.goalTextSelected
                        ]}
                      >
                        Muscle Gain
                      </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={[
                        styles.goalOption, 
                        value === 'improved-fitness' && styles.goalOptionSelected
                      ]}
                      onPress={() => onChange('improved-fitness')}
                    >
                      <FontAwesome5 
                        name="running" 
                        size={24} 
                        color={value === 'improved-fitness' ? 'white' : colors.secondary.main} 
                      />
                      <Text 
                        style={[
                          styles.goalText, 
                          value === 'improved-fitness' && styles.goalTextSelected
                        ]}
                      >
                        Fitness
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              />
            </View>

            {/* Water Intake Goal - Enhanced UI */}
            <View style={[styles.inputContainer, styles.waterIntakeContainer]}>
              <LinearGradient
                colors={['rgba(54, 209, 220, 0.2)', 'rgba(91, 134, 229, 0.2)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.waterIntakeGradient}
              />
              
              <View style={styles.waterIntakeHeader}>
                <MaterialCommunityIcons name="water" size={28} color="#36D1DC" />
                <Text style={styles.waterIntakeTitle}>
                  Daily Water Goal
                </Text>
              </View>
              
              <View style={styles.waterIntakeContent}>
                <Animated.View style={[styles.waterBottleContainer, waterBottleAnimStyle]}>
                  <WaterBottleFill fillPercentage={Math.min((sliderValue / 10) * 100, 100)} />
                </Animated.View>
                
                <View style={styles.waterIntakeControls}>
                  <Controller
                    control={control}
                    name="water_intake_goal"
                    render={({ field: { onChange, value } }) => (
                      <>
                        <Text style={styles.waterValueText}>
                          {sliderValue.toFixed(1)}
                          <Text style={styles.waterUnitText}>
                            {waterIntakeUnit === 'l' ? 'L' : 'oz'}
                          </Text>
                        </Text>
                        
                        <Slider
                          style={styles.slider}
                          minimumValue={0.5}
                          maximumValue={10}
                          value={sliderValue}
                          step={0.1}
                          minimumTrackTintColor="#36D1DC"
                          maximumTrackTintColor="rgba(255,255,255,0.4)"
                          thumbTintColor="#5B86E5"
                          onValueChange={(val) => {
                            setSliderValue(val);
                            onChange(val);
                          }}
                        />
                        
                        <View style={styles.sliderLabels}>
                          <Text style={styles.sliderLabel}>0.5L</Text>
                          <Text style={styles.sliderLabel}>10L</Text>
                        </View>
                      </>
                    )}
                  />
                  
                  <View style={styles.unitSelectorContainer}>
                    <Text style={styles.unitSelectorLabel}>Preferred Unit:</Text>
                    <Controller
                      control={control}
                      name="water_intake_unit"
                      render={({ field: { onChange, value } }) => (
                        <SegmentedButtons
                          value={value}
                          onValueChange={(val: string) => {
                            // Explicitly cast the value to our enum type
                            const newValue = val as 'l' | 'oz';
                            onChange(newValue);
                            // Convert value when units change
                            if (newValue === 'oz' && waterIntakeUnit === 'l') {
                              // Convert L to oz (1L = 33.814 oz)
                              setValue('water_intake_goal', parseFloat((waterIntakeGoal * 33.814).toFixed(1)));
                              setSliderValue(parseFloat((waterIntakeGoal * 33.814).toFixed(1)));
                            } else if (newValue === 'l' && waterIntakeUnit === 'oz') {
                              // Convert oz to L (1 oz = 0.0295735 L)
                              setValue('water_intake_goal', parseFloat((waterIntakeGoal * 0.0295735).toFixed(1)));
                              setSliderValue(parseFloat((waterIntakeGoal * 0.0295735).toFixed(1)));
                            }
                          }}
                          buttons={[
                            { value: 'l', label: 'Liters' },
                            { value: 'oz', label: 'Ounces' },
                          ]}
                          style={styles.waterUnitSelector}
                          theme={{ colors: { primary: '#36D1DC', secondaryContainer: 'rgba(255,255,255,0.2)' } }}
                        />
                      )}
                    />
                  </View>
                </View>
              </View>
              
              {errors.water_intake_goal && (
                <HelperText type="error" style={styles.waterError}>
                  {errors.water_intake_goal.message}
                </HelperText>
              )}
            </View>

            {/* Action Buttons */}
            <View style={styles.buttonsContainer}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={[styles.button, styles.cancelButton]}
                disabled={saving}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={handleSubmit(onSubmit)}
                style={[styles.button, styles.saveButton]}
                disabled={saving}
              >
                <LinearGradient
                  colors={['#FF2E93', '#FF6EB5', '#D30069']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[StyleSheet.absoluteFill, { borderRadius: 30 }]}
                />
                {saving ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </Surface>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  header: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    ...shadows.medium,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    color: 'white',
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  avatarContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  avatar: {
    backgroundColor: colors.primary.main,
  },
  formContainer: {
    padding: 24,
    borderRadius: 16,
    backgroundColor: 'rgba(20, 20, 35, 0.95)', // Much darker for better contrast with white text
    ...shadows.medium,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)', // Brighter border for aesthetic appeal
    shadowColor: colors.primary.main,
    shadowOpacity: 0.2,
    shadowRadius: 20,
  },
  inputContainer: {
    marginBottom: 24,
  },
  input: {
    backgroundColor: 'rgba(20, 20, 35, 0.9)', // Darker background for better text contrast
    borderRadius: 12,
    height: 56,
    color: 'white', // Ensuring text is white
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)', // More visible border
    fontSize: 18, // Larger text
  },
  label: {
    marginBottom: 8,
    color: 'white', // Ensuring label text is white
    fontWeight: '700', // Bolder
    fontSize: 16, // Larger text
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  unitInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  unitInput: {
    flex: 1,
    backgroundColor: 'rgba(20, 20, 35, 0.9)', // Darker background for better text contrast
    borderRadius: 12,
    height: 56,
    color: 'white', // Ensuring text is white
    borderWidth: 1, // Add border
    borderColor: 'rgba(255, 255, 255, 0.2)', // More visible border
    fontSize: 18, // Larger text
  },
  unitSelector: {
    minWidth: 100,
    backgroundColor: 'rgba(69, 71, 112, 0.9)', // Brighter for better contrast
  },
  goalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12, // Increased gap for better spacing
  },
  goalOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    backgroundColor: 'rgba(20, 20, 35, 0.9)', // Darker for better contrast
    borderRadius: 12,
    gap: 8,
    borderWidth: 1.5, // Thicker border
    borderColor: 'rgba(255, 255, 255, 0.25)', // Brighter border
    ...shadows.small, // Added shadow for depth
  },
  goalOptionSelected: {
    backgroundColor: '#36BFFA', // Brighter and more vibrant
    borderColor: '#7DD3FB', // Highlight border when selected
  },
  goalText: {
    color: 'white', // White text for visibility
    fontSize: 15, // Larger
    fontWeight: '600', // Bolder
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  goalTextSelected: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16, // Even larger when selected
  },
  waterIntakeContainer: {
    position: 'relative',
    padding: 24, // More padding for spaciousness
    marginBottom: 30,
    borderRadius: 16,
    borderWidth: 2, // Thicker border
    borderColor: 'rgba(91, 134, 229, 0.5)', // Brighter border
    overflow: 'hidden',
    ...shadows.medium, // Added shadow for depth
  },
  waterIntakeGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    opacity: 0.95, // Increased opacity for more vibrant gradient
  },
  waterIntakeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24, // Increased spacing
  },
  waterIntakeTitle: {
    color: 'white', // Changed to white for visibility
    fontWeight: 'bold',
    marginLeft: 10,
    fontSize: 20, // Larger
    textShadowColor: 'rgba(54, 209, 220, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  waterIntakeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  waterBottleContainer: {
    width: '30%',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10, // Added margin for spacing
  },
  waterIntakeControls: {
    width: '65%',
    alignItems: 'center',
  },
  waterValueText: {
    fontSize: 40, // Much larger for emphasis
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 15, // More space
    textShadowColor: 'rgba(54, 209, 220, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  waterUnitText: {
    fontSize: 24, // Adjusted for better proportion
    marginLeft: 4,
    color: 'white', // Pure white for visibility
    opacity: 1, // Fully opaque
  },
  slider: {
    width: '100%',
    height: 50, // Taller slider for easier interaction
  },
  sliderLabels: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    marginTop: 0,
  },
  sliderLabel: {
    color: 'white',
    fontSize: 14, // Larger
    fontWeight: '600',
    opacity: 1, // Fully visible
  },
  unitSelectorContainer: {
    marginTop: 20, // Increased space
    width: '100%',
  },
  unitSelectorLabel: {
    color: 'white', // Changed to white
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  waterUnitSelector: {
    marginTop: 4,
    backgroundColor: 'rgba(54, 209, 220, 0.1)', // Subtle background
  },
  waterError: {
    color: colors.feedback.error,
    marginTop: 8,
    fontWeight: '500',
    textAlign: 'center',
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 30, // More space
    gap: 20, // More gap between buttons
  },
  button: {
    flex: 1,
    height: 60, // Even taller buttons
    borderRadius: 30, // Fully rounded corners
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...shadows.medium,
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)', // More visible
    borderWidth: 2, // Thicker border
    borderColor: 'rgba(255, 255, 255, 0.3)', // Brighter border
  },
  cancelButtonText: {
    color: 'white', // White text
    fontWeight: '600',
    fontSize: 18, // Larger text
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  saveButton: {
    backgroundColor: 'transparent', // Let gradient show through
    ...shadows.large, // Enhanced shadow
  },
  saveButtonText: {
    color: 'white',
    fontWeight: '700', // Bolder
    fontSize: 18, // Larger text
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
