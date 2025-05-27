import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert, TouchableOpacity, ActivityIndicator, Dimensions, Animated as RNAnimated } from 'react-native';
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
import Svg, { Path, Circle, Defs, LinearGradient as SvgLinearGradient, Stop, G, ClipPath, Rect } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

// Update the EditProfileSchema to include unit fields and water intake
const editProfileSchema = z.object({
  full_name: z.string().min(2, 'Name must have at least 2 characters').optional(),
  height: z.number().positive('Height must be positive').optional(),
  heightUnit: z.enum(['cm', 'ft']).optional(),
  weight: z.number().positive('Weight must be positive').optional(),
  weightUnit: z.enum(['kg', 'lbs']).optional(),
  target_weight: z.number().positive('Target weight must be positive').optional(),
  target_weight_unit: z.enum(['kg', 'lbs']).optional(),
  fitness_goal: z.enum(['weight-loss', 'muscle-gain', 'improved-fitness']).optional(),
  water_intake_goal: z.number().min(0.1).max(10),
  water_intake_unit: z.enum(['l', 'oz']),
});

type EditProfileFormData = z.infer<typeof editProfileSchema>;

// Enhanced water bottle fill SVG component with wave animation
const WaterBottleFill = ({ fillPercentage, color1 = '#36D1DC', color2 = '#5B86E5' }: { fillPercentage: number, color1?: string, color2?: string }) => {
  const height = 100;
  const width = 45;
  const cornerRadius = 5;
  const neckWidth = 18;
  const neckHeight = 15;
  
  // Ensure the fill height is correctly calculated
  // Use max to ensure we don't go below 0, and min to ensure we don't exceed bottle height
  const actualFillPercentage = Math.max(0, Math.min(100, fillPercentage));
  const bottleBodyHeight = height - neckHeight;
  const fillHeight = (bottleBodyHeight * actualFillPercentage) / 100;
  
  console.log(`WaterBottleFill rendering. fillPercentage: ${fillPercentage}, actualFillPercentage: ${actualFillPercentage}, fillHeight: ${fillHeight}`);
  
  // Different color stops based on water level - use more vibrant colors
  const waterColor1 = fillPercentage < 30 ? '#FF4040' : '#00B4FF';
  const waterColor2 = fillPercentage < 30 ? '#FF0000' : '#0070FF';

  return (
    <View style={{ height, width }}>
      <Svg height={height} width={width} viewBox={`0 0 ${width} ${height}`}>
        {/* Bottle fill - this is the actual water, SOLID COLORS */}
        {fillPercentage > 0 && (
          <Path
            d={`
              M${cornerRadius + 1},${height - fillHeight}
              L${cornerRadius + 1},${height - cornerRadius - 1}
              Q${cornerRadius + 1},${height - 1} ${cornerRadius * 2 + 1},${height - 1}
              L${width - cornerRadius * 2 - 1},${height - 1}
              Q${width - cornerRadius - 1},${height - 1} ${width - cornerRadius - 1},${height - cornerRadius - 1}
              L${width - cornerRadius - 1},${height - fillHeight}
              Z
            `}
            fill={waterColor1}
          />
        )}
        
        {/* Bottle outline - draw after water to ensure outline is visible */}
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
          fill="rgba(255, 255, 255, 0.05)"
          stroke="rgba(255, 255, 255, 0.5)"
          strokeWidth="1"
        />
        
        {/* Wave on top of water - add after water fill */}
        {fillPercentage > 5 && (
          <Path
            d={`
              M${cornerRadius + 1},${height - fillHeight}
              Q${width * 0.25},${height - fillHeight - 3}
              ${width * 0.5},${height - fillHeight}
              Q${width * 0.75},${height - fillHeight + 3}
              ${width - cornerRadius - 1},${height - fillHeight}
            `}
            stroke="#FFFFFF"
            strokeWidth="2"
            fill="none"
          />
        )}
        
        {/* Debug rectangle to verify SVG positioning */}
        <Rect
          x={cornerRadius}
          y={height - fillHeight - 5}
          width={5}
          height={5}
          fill="yellow"
        />
      </Svg>
    </View>
  );
};

// Custom Slider Thumb component
const SliderThumb = ({ 
  value, 
  maximumValue, 
  animatedColor 
}: { 
  value: number; 
  maximumValue: number; 
  animatedColor: any; // Using any for RNAnimated.AnimatedInterpolation
}) => {
  return (
    <RNAnimated.View
      style={{
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: animatedColor,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
      }}
    >
      <View
        style={{
          width: 12,
          height: 12,
          borderRadius: 6,
          backgroundColor: 'white',
        }}
      />
    </RNAnimated.View>
  );
};

// Create a custom segmented buttons component
const CustomSegmentedButtons = ({ 
  value, 
  onValueChange, 
  buttons, 
  style 
}: { 
  value: string, 
  onValueChange: (value: string) => void, 
  buttons: Array<{value: string, label: string}>,
  style?: any 
}) => {
  return (
    <View style={[{
      flexDirection: 'row',
      borderRadius: 8,
      overflow: 'hidden',
      backgroundColor: 'rgba(32, 32, 60, 0.9)',
    }, style]}>
      {buttons.map((button) => (
        <TouchableOpacity
          key={button.value}
          style={{
            flex: 1,
            padding: 10,
            alignItems: 'center',
            backgroundColor: value === button.value ? '#5B86E5' : 'transparent',
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.2)',
          }}
          onPress={() => onValueChange(button.value)}
        >
          <Text style={{
            color: value === button.value ? '#fff' : 'rgba(255, 255, 255, 0.7)',
            fontWeight: value === button.value ? 'bold' : 'normal',
          }}>
            {button.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

export default function EditProfileScreen() {
  const theme = useTheme();
  const { profile, updateProfile } = useProfile();
  const [saving, setSaving] = useState(false);
  const [sliderValue, setSliderValue] = useState(profile?.water_intake_goal || 3.5);
  const [prevSliderValue, setPrevSliderValue] = useState(profile?.water_intake_goal || 3.5);
  
  // Enhanced animation values
  const headerAnimation = useSharedValue(0);
  const waterBottleAnimation = useSharedValue(0);
  const sliderAnimation = useSharedValue(0);
  
  // Color animation for the water
  const waterColorAnimation = useRef(new RNAnimated.Value(sliderValue / 10)).current;
  const animatedColor = waterColorAnimation.interpolate({
    inputRange: [0, 0.3, 0.6, 1],
    outputRange: ['#FF7373', '#36D1DC', '#5B86E5', '#4D6BE5'],
  });
  
  // Update color animation when slider changes
  useEffect(() => {
    RNAnimated.timing(waterColorAnimation, {
      toValue: sliderValue / 10,
      duration: 300,
      useNativeDriver: false,
    }).start();
    
    // Add haptic feedback for significant changes
    if (Math.abs(sliderValue - prevSliderValue) > 0.5) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    // Animate bottle on significant changes
    if (Math.abs(sliderValue - prevSliderValue) > 1) {
      waterBottleAnimation.value = 0;
      setTimeout(() => {
        waterBottleAnimation.value = withSpring(1, { damping: 8, stiffness: 80 });
      }, 50);
    }
    
    // Update previous value
    setPrevSliderValue(sliderValue);
  }, [sliderValue]);

  useEffect(() => {
    // Trigger animations when component mounts
    headerAnimation.value = withSpring(1, { damping: 15 });
    waterBottleAnimation.value = withSpring(1, { damping: 12 });
    sliderAnimation.value = withSpring(1, { damping: 10, stiffness: 60 });
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
      target_weight_unit: ((profile?.body_analysis as any)?.target_weight_unit) || 'kg',
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
  
  const sliderAnimStyle = useAnimatedStyle(() => {
    return {
      opacity: sliderAnimation.value,
      transform: [
        { scaleX: interpolate(sliderAnimation.value, [0, 1], [0.9, 1], Extrapolate.CLAMP) }
      ]
    };
  });

  // Calculate water goal as percentage for bottle fill
  const waterFillPercentage = (sliderValue / 10) * 100;

  // Custom functions for slider
  const handleSliderValueChange = (value: number) => {
    console.log(`Slider value changed to: ${value.toFixed(1)}`);
    
    // Update both states immediately without requestAnimationFrame
    setSliderValue(value);
    setValue('water_intake_goal', value);
    
    // Update previous value for haptic feedback
    setPrevSliderValue(sliderValue);
  };
  
  const handleSliderComplete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

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
      
      if (data.weightUnit === 'lbs' && data.weight) {
        // Convert pounds to kg (1 lb = 0.45359237 kg)
        weightInKg = data.weight * 0.45359237;
      }
      
      if (data.target_weight_unit === 'lbs' && data.target_weight) {
        // Convert pounds to kg (1 lb = 0.45359237 kg)
        targetWeightInKg = data.target_weight * 0.45359237;
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
        fitness_goals: data.fitness_goal ? [data.fitness_goal] : [], // Make sure it's a string array

        // Store water intake goal
        water_intake_goal: data.water_intake_goal,
        water_intake_unit: data.water_intake_unit,

        // Store the original values and units in body_analysis
        body_analysis: {
          ...(profile?.body_analysis || {}),
          height_unit: data.heightUnit,
          weight_unit: data.weightUnit,
          target_weight_unit: data.target_weight_unit,
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

  // Render the waterGoalContainer 
  const renderWaterGoalSection = () => (
    <View style={styles.inputContainer}>
      <Text style={styles.inputLabel}>Daily Water Goal</Text>
      <LinearGradient
        colors={['rgba(30,35,60,0.9)', 'rgba(20,25,45,0.95)']}
        style={styles.waterGoalContainer}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        <Animated.View style={[styles.waterBottleContainer, waterBottleAnimStyle]}>
          <WaterBottleFill 
            fillPercentage={waterFillPercentage} 
            color1={waterFillPercentage < 30 ? '#FF9B9B' : '#36D1DC'}
            color2={waterFillPercentage < 30 ? '#FF7373' : '#5B86E5'}
          />
        </Animated.View>
        
        <View style={styles.waterGoalContent}>
          <View style={styles.waterValueContainer}>
            <RNAnimated.Text 
              style={[
                styles.waterGoalValue,
                { color: animatedColor }
              ]}
            >
              {sliderValue.toFixed(1)}
              <Text style={styles.waterGoalUnit}>L</Text>
            </RNAnimated.Text>
            
            <View style={styles.waterGoalMessage}>
              {sliderValue < 2.5 ? (
                <Text style={styles.waterStatusText}>Not enough water</Text>
              ) : sliderValue >= 2.5 && sliderValue < 4 ? (
                <Text style={[styles.waterStatusText, { color: '#36D1DC' }]}>Good hydration</Text>
              ) : (
                <Text style={[styles.waterStatusText, { color: '#5B86E5' }]}>Excellent hydration!</Text>
              )}
            </View>
          </View>
          
          <Controller
            control={control}
            name="water_intake_goal"
            render={({ field: { onChange, value } }) => (
              <Animated.View style={[styles.sliderContainer, sliderAnimStyle]}>
                <View style={styles.sliderTrack}>
                  <LinearGradient
                    colors={['#36D1DC', '#5B86E5']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.sliderTrackGradient}
                  />
                </View>
                
                <Slider
                  style={styles.waterSlider}
                  minimumValue={0.5}
                  maximumValue={10}
                  value={value}
                  onValueChange={handleSliderValueChange}
                  onSlidingComplete={handleSliderComplete}
                  minimumTrackTintColor="#36D1DC"
                  maximumTrackTintColor="rgba(255,255,255,0.15)"
                  thumbTintColor="#5B86E5"
                />
              </Animated.View>
            )}
          />
          
          <View style={styles.waterGoalRange}>
            <Text style={styles.waterGoalRangeText}>0.5<Text style={styles.waterGoalUnitSmall}>L</Text></Text>
            <Text style={styles.waterGoalRangeText}>10<Text style={styles.waterGoalUnitSmall}>L</Text></Text>
          </View>
          
          {/* Water milestone indicators */}
          <View style={styles.milestoneContainer}>
            {[2.5, 5, 7.5].map((milestone) => (
              <View 
                key={milestone}
                style={[
                  styles.milestone,
                  {
                    left: `${((milestone - 0.5) / 9.5) * 100}%`,
                    backgroundColor: sliderValue >= milestone 
                      ? (sliderValue >= 7.5 ? '#5B86E5' : 
                         sliderValue >= 5 ? '#4AAAE0' : '#36D1DC')
                      : 'rgba(255,255,255,0.3)'
                  }
                ]}
              />
            ))}
          </View>
        </View>
      </LinearGradient>
    </View>
  );

  // Handle navigation
  const handleBack = () => {
    router.back();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />
      
      {/* Premium gradient background */}
      <LinearGradient
        colors={['#1a1b4b', '#162339']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />

      {/* Header */}
      <Animated.View style={[styles.header, headerAnimStyle]}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={{ width: 24 }} /> {/* Spacer for alignment */}
      </Animated.View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Profile Form */}
          <View style={styles.formContainer}>
            {/* Name Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <Controller
                control={control}
                name="full_name"
                render={({ field: { onChange, value } }) => (
                  <View>
                    <TextInput
                      mode="outlined"
                      outlineColor="rgba(255, 255, 255, 0.3)"
                      activeOutlineColor="#5B86E5"
                      style={styles.textInput}
                      onChangeText={onChange}
                      value={value}
                      placeholder="Enter your name"
                      placeholderTextColor="rgba(255, 255, 255, 0.5)"
                      textColor="#ffffff"
                      theme={{
                        colors: {
                          text: '#ffffff',
                          placeholder: 'rgba(255, 255, 255, 0.5)',
                          background: 'rgba(32, 32, 60, 0.9)'
                        }
                      }}
                    />
                  </View>
                )}
              />
              {errors.full_name && (
                <HelperText type="error" visible={true}>
                  {errors.full_name.message}
                </HelperText>
              )}
            </View>

            {/* Height Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Height</Text>
              <View style={styles.measurementContainer}>
                <Controller
                  control={control}
                  name="height"
                  render={({ field: { onChange, value } }) => (
                    <View>
                      <TextInput
                        mode="outlined"
                        outlineColor="rgba(255, 255, 255, 0.3)"
                        activeOutlineColor="#5B86E5"
                        style={[styles.textInput, styles.measurementInput]}
                        onChangeText={(text) => onChange(text ? parseFloat(text) : '')}
                        value={value?.toString() || ''}
                        keyboardType="numeric"
                        placeholder="Enter height"
                        placeholderTextColor="rgba(255, 255, 255, 0.5)"
                        textColor="#ffffff"
                        theme={{
                          colors: {
                            text: '#ffffff',
                            placeholder: 'rgba(255, 255, 255, 0.5)',
                            background: 'rgba(32, 32, 60, 0.9)'
                          }
                        }}
                      />
                    </View>
                  )}
                />
                <Controller
                  control={control}
                  name="heightUnit"
                  render={({ field: { onChange, value } }) => (
                    <View>
                      <CustomSegmentedButtons
                        value={value || 'cm'}
                        onValueChange={onChange}
                        buttons={[
                          { value: 'cm', label: 'cm' },
                          { value: 'ft', label: 'ft' }
                        ]}
                        style={styles.unitSelector}
                      />
                    </View>
                  )}
                />
              </View>
            </View>

            {/* Weight Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Current Weight</Text>
              <View style={styles.measurementContainer}>
                <Controller
                  control={control}
                  name="weight"
                  render={({ field: { onChange, value } }) => (
                    <View>
                      <TextInput
                        mode="outlined"
                        outlineColor="rgba(255, 255, 255, 0.3)"
                        activeOutlineColor="#5B86E5"
                        style={[styles.textInput, styles.measurementInput]}
                        onChangeText={(text) => onChange(text ? parseFloat(text) : '')}
                        value={value?.toString() || ''}
                        keyboardType="numeric"
                        placeholder="Enter weight"
                        placeholderTextColor="rgba(255, 255, 255, 0.5)"
                        textColor="#ffffff"
                        theme={{
                          colors: {
                            text: '#ffffff',
                            placeholder: 'rgba(255, 255, 255, 0.5)',
                            background: 'rgba(32, 32, 60, 0.9)'
                          }
                        }}
                      />
                    </View>
                  )}
                />
                <Controller
                  control={control}
                  name="weightUnit"
                  render={({ field: { onChange, value } }) => (
                    <View>
                      <CustomSegmentedButtons
                        value={value || 'kg'}
                        onValueChange={onChange}
                        buttons={[
                          { value: 'kg', label: 'kg' },
                          { value: 'lbs', label: 'lbs' }
                        ]}
                        style={styles.unitSelector}
                      />
                    </View>
                  )}
                />
              </View>
            </View>

            {/* Target Weight Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Target Weight</Text>
              <View style={styles.measurementContainer}>
                <Controller
                  control={control}
                  name="target_weight"
                  render={({ field: { onChange, value } }) => (
                    <View>
                      <TextInput
                        mode="outlined"
                        outlineColor="rgba(255, 255, 255, 0.3)"
                        activeOutlineColor="#5B86E5"
                        style={[styles.textInput, styles.measurementInput]}
                        onChangeText={(text) => onChange(text ? parseFloat(text) : '')}
                        value={value?.toString() || ''}
                        keyboardType="numeric"
                        placeholder="Enter target weight"
                        placeholderTextColor="rgba(255, 255, 255, 0.5)"
                        textColor="#ffffff"
                        theme={{
                          colors: {
                            text: '#ffffff',
                            placeholder: 'rgba(255, 255, 255, 0.5)',
                            background: 'rgba(32, 32, 60, 0.9)'
                          }
                        }}
                      />
                    </View>
                  )}
                />
                <Controller
                  control={control}
                  name="target_weight_unit"
                  render={({ field: { onChange, value } }) => (
                    <View>
                      <CustomSegmentedButtons
                        value={value || 'kg'}
                        onValueChange={onChange}
                        buttons={[
                          { value: 'kg', label: 'kg' },
                          { value: 'lbs', label: 'lbs' }
                        ]}
                        style={styles.unitSelector}
                      />
                    </View>
                  )}
                />
              </View>
            </View>

            {/* Fitness Goal */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Fitness Goal</Text>
              <Controller
                control={control}
                name="fitness_goal"
                render={({ field: { onChange, value } }) => (
                  <View style={styles.fitnessGoalContainer}>
                    <TouchableOpacity
                      style={styles.goalOption}
                      onPress={() => onChange('weight-loss')}
                    >
                      <LinearGradient
                        colors={value === 'weight-loss' 
                          ? ['rgba(255,145,144,0.6)', 'rgba(255,145,144,0.3)'] 
                          : ['rgba(40, 40, 70, 0.8)', 'rgba(30, 30, 50, 0.95)']}
                        style={[StyleSheet.absoluteFill, styles.goalGradient]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                      />
                      <View style={styles.goalIconContainer}>
                        <FontAwesome5 name="weight" size={24} color={value === 'weight-loss' ? '#fff' : 'rgba(255,255,255,0.7)'} />
                      </View>
                      <Text style={[styles.goalText, value === 'weight-loss' && styles.goalTextSelected]}>Weight Loss</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={styles.goalOption}
                      onPress={() => onChange('muscle-gain')}
                    >
                      <LinearGradient
                        colors={value === 'muscle-gain' 
                          ? ['rgba(94,114,235,0.6)', 'rgba(94,114,235,0.3)'] 
                          : ['rgba(40, 40, 70, 0.8)', 'rgba(30, 30, 50, 0.95)']}
                        style={[StyleSheet.absoluteFill, styles.goalGradient]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                      />
                      <View style={styles.goalIconContainer}>
                        <MaterialCommunityIcons name="arm-flex" size={24} color={value === 'muscle-gain' ? '#fff' : 'rgba(255,255,255,0.7)'} />
                      </View>
                      <Text style={[styles.goalText, value === 'muscle-gain' && styles.goalTextSelected]}>Muscle Gain</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={styles.goalOption}
                      onPress={() => onChange('improved-fitness')}
                    >
                      <LinearGradient
                        colors={value === 'improved-fitness' 
                          ? ['rgba(64,223,217,0.6)', 'rgba(64,223,217,0.3)'] 
                          : ['rgba(40, 40, 70, 0.8)', 'rgba(30, 30, 50, 0.95)']}
                        style={[StyleSheet.absoluteFill, styles.goalGradient]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                      />
                      <View style={styles.goalIconContainer}>
                        <MaterialCommunityIcons name="run" size={24} color={value === 'improved-fitness' ? '#fff' : 'rgba(255,255,255,0.7)'} />
                      </View>
                      <Text style={[styles.goalText, value === 'improved-fitness' && styles.goalTextSelected]}>Improved Fitness</Text>
                    </TouchableOpacity>
                  </View>
                )}
              />
            </View>

            {/* Water Goal with animated slider */}
            {renderWaterGoalSection()}

            {/* Water Intake Unit */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Water Intake Unit</Text>
              <Controller
                control={control}
                name="water_intake_unit"
                render={({ field: { onChange, value } }) => (
                  <View style={{ marginTop: 16 }}>
                    <CustomSegmentedButtons
                      value={value}
                      onValueChange={onChange}
                      buttons={[
                        { value: 'l', label: 'Liters' },
                        { value: 'oz', label: 'Ounces' }
                      ]}
                      style={{ width: '100%' }}
                    />
                  </View>
                )}
              />
            </View>

            {/* Save Button - now inside the ScrollView */}
            <View style={styles.saveButtonWrapper}>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSubmit(onSubmit)}
                disabled={saving}
              >
                <LinearGradient
                  colors={['#5B86E5', '#36D1DC']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.saveButtonGradient}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save Changes</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121232',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  formContainer: {
    gap: 24,
  },
  textInput: {
    backgroundColor: 'rgba(32, 32, 60, 0.9)',
    color: '#fff',
    fontSize: 16,
    height: 50,
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  measurementContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  measurementInput: {
    flex: 1,
  },
  unitSelector: {
    width: 120,
    backgroundColor: 'rgba(69, 71, 112, 0.9)',
  },
  fitnessGoalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  goalOption: {
    flex: 1,
    height: 110,
    backgroundColor: 'transparent',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
      },
      android: {
        elevation: 5,
      },
      web: {
        boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
      }
    }),
  },
  goalGradient: {
    borderRadius: 12,
  },
  goalIconContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 24,
  },
  goalText: {
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 8,
    fontSize: 14,
    textAlign: 'center',
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
  },
  goalTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  waterGoalContainer: {
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  waterBottleContainer: {
    width: 80,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 5,
  },
  waterGoalContent: {
    flex: 1,
    marginLeft: 15,
  },
  waterValueContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  waterGoalValue: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  waterGoalUnit: {
    fontSize: 18,
    fontWeight: 'normal',
    marginLeft: 2,
    opacity: 0.8,
  },
  waterGoalUnitSmall: {
    fontSize: 10,
    marginLeft: 1,
    opacity: 0.7,
  },
  waterGoalMessage: {
    backgroundColor: 'rgba(0,0,0,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 5,
  },
  waterStatusText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '500',
  },
  sliderContainer: {
    width: '100%',
    height: 40,
    justifyContent: 'center',
    position: 'relative',
  },
  sliderTrack: {
    position: 'absolute',
    height: 6,
    width: '100%',
    top: 17, // Center in the parent container
    borderRadius: 3,
    overflow: 'hidden',
  },
  sliderTrackGradient: {
    height: '100%',
    width: '100%',
  },
  waterSlider: {
    width: '100%',
    height: 40,
    position: 'absolute',
  },
  waterGoalRange: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 4,
  },
  waterGoalRangeText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
  },
  milestoneContainer: {
    position: 'relative',
    width: '100%',
    height: 12,
    marginTop: -12,
  },
  milestone: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    top: 3,
    marginLeft: -3,
  },
  saveButtonWrapper: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 40,
  },
  saveButton: {
    height: 50,
    width: '100%',
    borderRadius: 25,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  saveButtonGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
