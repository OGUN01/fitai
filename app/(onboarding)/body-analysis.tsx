import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  Image, 
  ScrollView, 
  Alert, 
  Dimensions, 
  TouchableOpacity, 
  Platform,
  ImageBackground,
  Animated
} from 'react-native';
import { 
  Button, 
  Card, 
  Chip, 
  ActivityIndicator, 
  IconButton, 
  ProgressBar,
  useTheme,
  Divider 
} from 'react-native-paper';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { bodyAnalysisService, BodyPhoto, UserPhysicalDetails, BodyAnalysisResult, FallbackBodyAnalysis } from '../../services/ai';
import { useProfile } from '../../contexts/ProfileContext';
import { BodyAnalysis } from '../../types/profile';
import { getUserWeight } from '../../utils/profileHelpers';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import StyledText from '../../components/ui/StyledText';
import { colors, spacing, borderRadius, shadows, gradients } from '../../theme/theme';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import SafeBlurView from '../../components/ui/SafeBlurView';

// Get screen dimensions for responsive sizing
const { width, height } = Dimensions.get('window');

/**
 * Body Analysis Screen
 * Part of the onboarding flow - allows users to upload photos for AI body analysis
 * Redesigned with premium UI elements and animations
 */
export default function BodyAnalysisScreen() {
  const params = useLocalSearchParams<{
    age: string;
    gender: string;
    height: string;
    weight: string;
    fitnessGoal: string;
    returnToReview?: string;
    returnToProgress?: string;
  }>();
  
  // Get profile context
  const { profile, updateProfile } = useProfile();
  const theme = useTheme();
  
  // State for tracking photos
  const [photos, setPhotos] = useState<BodyPhoto[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<BodyAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analyzeProgress, setAnalyzeProgress] = useState(0);
  const [showResults, setShowResults] = useState(false);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Create user details from params and profile
  const userDetails: UserPhysicalDetails = {
    age: params?.age ? parseInt(params.age) : 30, // Default if not available
    gender: params?.gender || 'male', // Default if not available
    height: params?.height ? parseInt(params.height) : profile?.height_cm || 175, // in cm
    weight: getUserWeight(profile) || 70, // in kg
    fitnessGoal: (params?.fitnessGoal || profile?.weight_goal || 'build_muscle') as "weight loss" | "muscle gain" | "improved fitness" | "maintenance",
  };

  useEffect(() => {
    // Animate entry
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      })
    ]).start();

    // Setup pulsing animation for the main CTA button
    const setupPulseAnimation = () => {
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      ]).start(() => {
        if (photos.length > 0 && !isAnalyzing) {
          setupPulseAnimation();
        }
      });
    };

    if (photos.length > 0 && !isAnalyzing) {
      setupPulseAnimation();
    }
  }, [fadeAnim, scaleAnim, pulseAnim, photos, isAnalyzing]);
  
  // Function to pick image from gallery
  const pickImage = async (type: 'front' | 'side' | 'back') => {
    try {
      // Provide haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert('Permission required', 'You need to grant permission to access your photos for body analysis.');
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.7,
      });
      
      if (!result.canceled) {
        // Add the picked image to photos array
        const newPhotos = [...photos];
        const existingIndex = newPhotos.findIndex(p => p.type === type);
        
        if (existingIndex >= 0) {
          // Replace existing photo of this type
          newPhotos[existingIndex] = { uri: result.assets[0].uri, type };
        } else {
          // Add new photo
          newPhotos.push({ uri: result.assets[0].uri, type });
        }
        
        setPhotos(newPhotos);
        
        // Success haptic feedback
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err) {
      console.error('Error picking image:', err);
      Alert.alert('Error', 'There was a problem picking your image. Please try again.');
      // Error haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };
  
  // Function to take a photo with camera
  const takePhoto = async (type: 'front' | 'side' | 'back') => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert('Permission required', 'You need to grant permission to use your camera for body analysis.');
        return;
      }
      
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.7,
      });
      
      if (!result.canceled) {
        // Add the taken photo to photos array
        const newPhotos = [...photos];
        const existingIndex = newPhotos.findIndex(p => p.type === type);
        
        if (existingIndex >= 0) {
          // Replace existing photo of this type
          newPhotos[existingIndex] = { uri: result.assets[0].uri, type };
        } else {
          // Add new photo
          newPhotos.push({ uri: result.assets[0].uri, type });
        }
        
        setPhotos(newPhotos);
      }
    } catch (err) {
      console.error('Error taking photo:', err);
      Alert.alert('Error', 'There was a problem taking your photo. Please try again.');
    }
  };
  
  // Function to analyze body photos
  const analyzeUserPhotos = async () => {
    try {
      setIsAnalyzing(true);
      setError('');
      setAnalyzeProgress(0);
      
      // Validate we have enough photos
      if (photos.length === 0) {
        setError('Please upload at least one photo for analysis');
        return;
      }
      
      // Start progress animation
      const timer = setInterval(() => {
        setAnalyzeProgress((prevProgress) => {
          const newProgress = prevProgress + 10;
          return newProgress > 90 ? 90 : newProgress;
        });
      }, 500);
      
      // Call the body analysis service
      const analysisResult = await bodyAnalysisService.analyzeBodyComposition(photos, userDetails);
      
      clearInterval(timer);
      setAnalyzeProgress(100);
      
      // Success! Process results
      // Convert to expected result format
      const formattedResult: BodyAnalysisResult = {
        bodyFatEstimate: analysisResult.bodyFatEstimate || 15,
        bodyType: analysisResult.bodyType || 'Average',
        analysisText: analysisResult.analysisText || 'Your body composition is within normal ranges.',
        bodyProportions: analysisResult.bodyProportions,
        posture: analysisResult.posture,
        recommendedFocusAreas: analysisResult.recommendedFocusAreas || [],
        recommendations: analysisResult.recommendations || [],
      };
      
      setResult(formattedResult);
      
      // Update user profile with the analysis results
      await updateProfile({
        weight_kg: userDetails.weight,
        body_analysis: {
          body_type: analysisResult.bodyType,
          analysis_text: analysisResult.analysisText,
          body_fat_percentage: analysisResult.bodyFatEstimate,
          body_proportions: analysisResult.bodyProportions,
          posture: analysisResult.posture,
          recommended_focus_areas: analysisResult.recommendedFocusAreas || analysisResult.recommendations,
        }
      });
      
      // Show results instead of navigating
      setShowResults(true);
    } catch (err) {
      setError('Failed to analyze photos. Please try again later.');
      console.error('Body analysis error:', err);
      
      // Use fallback data for demonstration or development
      const fallbackData = generateFallbackAnalysis();
      
      // Create properly formatted result for state
      const formattedFallback: BodyAnalysisResult = {
        bodyFatEstimate: fallbackData.bodyFatPercentage,
        bodyType: fallbackData.bodyType,
        analysisText: fallbackData.analysisText,
        bodyProportions: fallbackData.bodyProportions,
        posture: fallbackData.posture,
        recommendedFocusAreas: fallbackData.recommendedFocusAreas,
        recommendations: fallbackData.posture.recommendations,
      };
      
      setResult(formattedFallback);
      
      // Still update the profile with fallback data for demo purposes
      await updateProfile({
        weight_kg: fallbackData.leanMassKg,
        body_analysis: {
          body_type: fallbackData.bodyType,
          analysis_text: fallbackData.analysisText,
          body_fat_percentage: fallbackData.bodyFatPercentage,
          body_proportions: fallbackData.bodyProportions,
          posture: fallbackData.posture,
          recommended_focus_areas: fallbackData.recommendedFocusAreas,
        }
      });
      
      // Show results instead of navigating
      setShowResults(true);
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  // Function to handle analysis failure with a fallback
  const handleAnalysisFailure = async () => {
    try {
      // Generate fallback body analysis based on user data
      const fallbackAnalysis = {
        bodyFatPercentage: userDetails.weight ? Math.round(22) : 22,
        leanMassKg: userDetails.weight || 70,
        bodyType: 'Mesomorph', // Default value
        recommendations: [
          'Focus on balanced strength training',
          'Incorporate regular cardio sessions',
          'Ensure proper nutrition to support your goals'
        ]
      };
      
      // Create body analysis object to save to profile
      const bodyAnalysis: BodyAnalysis = {
        weight_kg: fallbackAnalysis.leanMassKg,
        body_type: fallbackAnalysis.bodyType,
        analysis_text: fallbackAnalysis.recommendations.join('\n'),  // Convert recommendations to analysis text
        // Add recommended focus areas from recommendations
        recommended_focus_areas: fallbackAnalysis.recommendations,
      };
      
      // Update profile with fallback body analysis
      await updateProfile({
        body_analysis: bodyAnalysis,
        has_completed_onboarding: true,
      });
      
      Alert.alert(
        'Fallback Analysis Used',
        'We had trouble analyzing your photos, so we used your provided information to estimate your body composition. You can retake your analysis later for more accurate results.',
        [{ text: 'OK' }]
      );
    } catch (fallbackErr) {
      console.error('Fallback analysis failed:', fallbackErr);
      Alert.alert(
        'Analysis Failed',
        'We were unable to complete your body analysis. You can continue without it and try again later.',
        [{ text: 'OK' }]
      );
    }
  };
  
  // Function to skip analysis and continue
  const skipAnalysis = async () => {
    // Proceed to next step in onboarding
    if (params?.returnToReview === 'true') {
      router.push('/(onboarding)/review');
    } else if (params?.returnToProgress === 'true') {
      router.push('/(tabs)/progress');
    } else {
      router.push('/(onboarding)/review');
    }
  };
  
  // Function to generate fallback analysis
  const generateFallbackAnalysis = () => {
    return {
      bodyFatPercentage: 15,
      leanMassKg: 56,
      bodyType: 'Mesomorph',
      analysisText: 'You have a balanced physique with potential for muscle development and maintaining moderate body fat levels.',
      bodyProportions: {
        shoulders: 'Average width, good proportions',
        torso: 'Well-proportioned',
        arms: 'Good symmetry and proportion',
        legs: 'Well-developed with good potential for strength',
      },
      posture: {
        alignment: 'Mostly aligned',
        issues: ['Slight forward head position'],
        recommendations: ['Core strengthening exercises', 'Stretching tight chest muscles'],
      },
      recommendedFocusAreas: ['Core stabilization', 'Upper back strength', 'Shoulder mobility'],
    };
  };
  
  // Add a function to handle navigation to the next screen
  const navigateToNextScreen = () => {
    // Update the profile to set current_onboarding_step to workout-preferences
    updateProfile({
      current_onboarding_step: 'workout-preferences'
    }).then(() => {
      if (params?.returnToReview === 'true') {
        router.push('/(onboarding)/review');
      } else if (params?.returnToProgress === 'true') {
        router.push('/(tabs)/progress');
      } else {
        // Navigate to workout preferences as the next step in onboarding
        router.push('/(onboarding)/workout-preferences');
      }
    }).catch(error => {
      console.error('Error updating onboarding step:', error);
      // Still try to navigate even if update fails
      router.push('/(onboarding)/workout-preferences');
    });
  };
  
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
            
            <View style={styles.headerContent}>
              <StyledText variant="headingLarge" style={styles.title}>
                Body Analysis
              </StyledText>
              <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.subtitle}>
                Upload photos for personalized body analysis
              </StyledText>
            </View>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.formCard}>
              <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.instructionText}>
                For the most accurate analysis, please upload three photos: front view, side view, and back view.
                Wear form-fitting clothes and ensure your full body is visible.
              </StyledText>

              {/* Interactive body visualization - Premium design */}
              <View style={styles.bodyVisualizationContainer}>
                {/* Front View Silhouette */}
                <TouchableOpacity 
                  style={[
                    styles.silhouetteContainer, 
                    styles.frontSilhouetteContainer,
                    photos.find(p => p.type === 'front') ? styles.activeSilhouetteContainer : {}
                  ]}
                  onPress={() => pickImage('front')}
                >
                  <View style={styles.silhouetteImageWrapper}>
                    <Image 
                      source={require('../../assets/images/onboarding/front.png')} 
                      style={styles.silhouetteImage} 
                    />
                    {photos.find(p => p.type === 'front') && (
                      <View style={styles.checkmarkOverlay}>
                        <MaterialCommunityIcons 
                          name="check-circle" 
                          size={32} 
                          color={colors.accent.green} 
                        />
                      </View>
                    )}
                  </View>
                  <View style={styles.silhouetteLabel}>
                    <StyledText variant="bodyMedium" style={styles.silhouetteText}>
                      Front
                    </StyledText>
                  </View>
                </TouchableOpacity>

                {/* Side View Silhouette */}
                <TouchableOpacity 
                  style={[
                    styles.silhouetteContainer, 
                    styles.sideSilhouetteContainer,
                    photos.find(p => p.type === 'side') ? styles.activeSilhouetteContainer : {}
                  ]}
                  onPress={() => pickImage('side')}
                >
                  <View style={styles.silhouetteImageWrapper}>
                    <Image 
                      source={require('../../assets/images/onboarding/side.png')} 
                      style={styles.silhouetteImage} 
                    />
                    {photos.find(p => p.type === 'side') && (
                      <View style={styles.checkmarkOverlay}>
                        <MaterialCommunityIcons 
                          name="check-circle" 
                          size={32} 
                          color={colors.accent.green} 
                        />
                      </View>
                    )}
                  </View>
                  <View style={styles.silhouetteLabel}>
                    <StyledText variant="bodyMedium" style={styles.silhouetteText}>
                      Side
                    </StyledText>
                  </View>
                </TouchableOpacity>

                {/* Back View Silhouette */}
                <TouchableOpacity 
                  style={[
                    styles.silhouetteContainer, 
                    styles.backSilhouetteContainer,
                    photos.find(p => p.type === 'back') ? styles.activeSilhouetteContainer : {}
                  ]}
                  onPress={() => pickImage('back')}
                >
                  <View style={styles.silhouetteImageWrapper}>
                    <Image 
                      source={require('../../assets/images/onboarding/back.png')} 
                      style={styles.silhouetteImage} 
                    />
                    {photos.find(p => p.type === 'back') && (
                      <View style={styles.checkmarkOverlay}>
                        <MaterialCommunityIcons 
                          name="check-circle" 
                          size={32} 
                          color={colors.accent.green} 
                        />
                      </View>
                    )}
                  </View>
                  <View style={styles.silhouetteLabel}>
                    <StyledText variant="bodyMedium" style={styles.silhouetteText}>
                      Back
                    </StyledText>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Photo Thumbnails */}
              <View style={styles.thumbnailsContainer}>
                {photos.map((photo, index) => (
                  <View key={`thumb-${index}`} style={styles.thumbnailWrapper}>
                    <Image source={{ uri: photo.uri }} style={styles.thumbnail} />
                    <View style={styles.thumbnailLabel}>
                      <StyledText variant="bodySmall" style={styles.thumbnailText}>
                        {photo.type.charAt(0).toUpperCase() + photo.type.slice(1)}
                      </StyledText>
                    </View>
                    <TouchableOpacity 
                      style={styles.removePhotoButton}
                      onPress={() => {
                        const newPhotos = photos.filter((_, i) => i !== index);
                        setPhotos(newPhotos);
                      }}
                    >
                      <MaterialCommunityIcons name="close-circle" size={22} color={colors.feedback.error} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              {/* Upload Options with Premium Design */}
              <View style={styles.uploadOptionsContainer}>
                <TouchableOpacity
                  style={styles.uploadOption}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    Alert.alert(
                      'Select Photo Type',
                      'Which view would you like to capture?',
                      [
                        { text: 'Front View', onPress: () => takePhoto('front') },
                        { text: 'Side View', onPress: () => takePhoto('side') },
                        { text: 'Back View', onPress: () => takePhoto('back') },
                        { text: 'Cancel', style: 'cancel' }
                      ]
                    );
                  }}
                >
                  <LinearGradient 
                    colors={[colors.secondary.light, colors.secondary.dark]}
                    style={styles.uploadOptionGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <SafeBlurView intensity={20} style={styles.uploadOptionBlur}>
                      <MaterialCommunityIcons name="camera" size={24} color={colors.text.primary} />
                      <StyledText variant="bodyMedium" style={styles.uploadOptionText}>Camera</StyledText>
                    </SafeBlurView>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.uploadOption}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    Alert.alert(
                      'Select Photo Type',
                      'Which view would you like to upload?',
                      [
                        { text: 'Front View', onPress: () => pickImage('front') },
                        { text: 'Side View', onPress: () => pickImage('side') },
                        { text: 'Back View', onPress: () => pickImage('back') },
                        { text: 'Cancel', style: 'cancel' }
                      ]
                    );
                  }}
                >
                  <LinearGradient 
                    colors={[colors.primary.light, colors.primary.dark]}
                    style={styles.uploadOptionGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <SafeBlurView intensity={20} style={styles.uploadOptionBlur}>
                      <MaterialCommunityIcons name="image-multiple" size={24} color={colors.text.primary} />
                      <StyledText variant="bodyMedium" style={styles.uploadOptionText}>Gallery</StyledText>
                    </SafeBlurView>
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              {/* Analysis Progress */}
              {isAnalyzing && (
                <View style={styles.analysisProgressContainer}>
                  <View style={styles.progressTextContainer}>
                    <ActivityIndicator size="small" color={colors.primary.main} />
                    <StyledText variant="bodyMedium" style={styles.progressText}>Analyzing your photos...</StyledText>
                  </View>
                  <ProgressBar
                    progress={analyzeProgress / 100}
                    color={colors.primary.main}
                    style={styles.progressBar}
                  />
                </View>
              )}

              {/* Error Display */}
              {error && (
                <View style={styles.errorContainer}>
                  <MaterialCommunityIcons name="alert" size={24} color={colors.feedback.error} />
                  <StyledText variant="bodyMedium" color={colors.feedback.error} style={{ marginLeft: spacing.sm }}>
                    {error}
                  </StyledText>
                </View>
              )}

              {/* Action Buttons - Premium Design */}
              <View style={styles.actionsContainer}>
                <Animated.View style={{
                  transform: [{ scale: pulseAnim }],
                  width: '100%',
                }}>
                  <TouchableOpacity
                    style={[
                      styles.analyzeButton,
                      photos.length === 0 && styles.disabledButton
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                      analyzeUserPhotos();
                    }}
                    disabled={photos.length === 0 || isAnalyzing}
                  >
                    <LinearGradient
                      colors={[colors.primary.main, colors.primary.dark]}
                      style={styles.buttonGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <View style={styles.analyzeButtonContent}>
                        <MaterialCommunityIcons name="account-search" size={24} color={colors.text.primary} style={{ marginRight: spacing.sm }} />
                        <StyledText variant="bodyLarge" style={{ color: colors.text.primary, fontWeight: 'bold' }}>
                          Analyze My Body
                        </StyledText>
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                </Animated.View>
                
                <TouchableOpacity
                  style={styles.skipButton}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    skipAnalysis();
                  }}
                  disabled={isAnalyzing}
                >
                  <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.skipText}>
                    Skip for now
                  </StyledText>
                </TouchableOpacity>
              </View>

              {/* Privacy Notice - Enhanced Design */}
              <View style={styles.privacyNotice}>
                <SafeBlurView intensity={10} style={styles.privacyBlur}>
                  <View style={styles.privacyHeader}>
                    <MaterialCommunityIcons name="shield-lock" size={20} color={colors.accent.lavender} style={{ marginRight: spacing.sm }} />
                    <StyledText variant="bodyMedium" color={colors.accent.lavender} style={{ fontWeight: 'bold' }}>
                      Privacy Notice
                    </StyledText>
                  </View>
                  <StyledText variant="bodySmall" color={colors.text.secondary} style={styles.privacyText}>
                    Your photos are processed securely and privately. They are not stored on our servers beyond the analysis period and are never shared with third parties.
                  </StyledText>
                </SafeBlurView>
              </View>

              {/* Analysis Results Section - Only shown after analysis completes */}
              {showResults && result && (
                <View style={styles.resultsContainer}>
                  <SafeBlurView intensity={15} style={styles.resultsCard}>
                    <StyledText variant="headingSmall" color={colors.primary.main} style={styles.resultsTitle}>
                      Analysis Results
                    </StyledText>
                    
                    {/* Body Type */}
                    <View style={styles.resultSection}>
                      <StyledText variant="bodyMedium" color={colors.text.primary} style={styles.resultLabel}>
                        Body Type:
                      </StyledText>
                      <StyledText variant="bodyLarge" color={colors.text.primary} style={styles.resultValue}>
                        {result.bodyType}
                      </StyledText>
                    </View>
                    
                    {/* Body Fat */}
                    <View style={styles.resultSection}>
                      <StyledText variant="bodyMedium" color={colors.text.primary} style={styles.resultLabel}>
                        Estimated Body Fat:
                      </StyledText>
                      <StyledText variant="bodyLarge" color={colors.text.primary} style={styles.resultValue}>
                        {result.bodyFatEstimate}%
                      </StyledText>
                    </View>
                    
                    {/* Analysis Summary */}
                    <View style={styles.resultSection}>
                      <StyledText variant="bodyMedium" color={colors.text.primary} style={styles.resultLabel}>
                        Analysis:
                      </StyledText>
                      <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.resultText}>
                        {result.analysisText}
                      </StyledText>
                    </View>
                    
                    {/* Recommended Focus Areas */}
                    {result.recommendedFocusAreas && result.recommendedFocusAreas.length > 0 && (
                      <View style={styles.resultSection}>
                        <StyledText variant="bodyMedium" color={colors.text.primary} style={styles.resultLabel}>
                          Recommended Focus Areas:
                        </StyledText>
                        <View style={styles.focusAreasContainer}>
                          {result.recommendedFocusAreas.map((area, index) => (
                            <View key={`focus-${index}`} style={styles.focusAreaChip}>
                              <StyledText variant="bodySmall" color={colors.text.primary}>
                                {area}
                              </StyledText>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}
                    
                    {/* Next Button */}
                    <TouchableOpacity
                      style={styles.nextButton}
                      onPress={navigateToNextScreen}
                    >
                      <LinearGradient
                        colors={[colors.primary.main, colors.primary.dark]}
                        style={styles.buttonGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                      >
                        <View style={styles.nextButtonContent}>
                          <StyledText variant="bodyLarge" style={{ color: colors.text.primary, fontWeight: 'bold' }}>
                            Continue
                          </StyledText>
                          <MaterialCommunityIcons 
                            name="arrow-right" 
                            size={20} 
                            color={colors.text.primary} 
                            style={{ marginLeft: spacing.sm }} 
                          />
                        </View>
                      </LinearGradient>
                    </TouchableOpacity>
                  </SafeBlurView>
                </View>
              )}
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
    paddingBottom: spacing.xl * 2,
  },
  formCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: borderRadius.lg,
    ...shadows.medium,
    overflow: 'hidden',
  },
  instructionText: {
    marginBottom: spacing.lg,
    textAlign: 'center',
    lineHeight: 22,
  },
  bodyVisualizationContainer: {
    width: '100%',
    height: 220,
    position: 'relative',
    marginBottom: spacing.xl,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  silhouetteContainer: {
    width: 100,
    height: 180,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    ...shadows.medium,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  frontSilhouetteContainer: {
    transform: [{ translateY: -10 }],
  },
  sideSilhouetteContainer: {
    transform: [{ translateY: 10 }],
  },
  backSilhouetteContainer: {
    transform: [{ translateY: -10 }],
  },
  activeSilhouetteContainer: {
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
    borderColor: 'rgba(74, 222, 128, 0.3)',
  },
  silhouetteImageWrapper: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  silhouetteImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  checkmarkOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  silhouetteLabel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: spacing.xs,
    alignItems: 'center',
  },
  silhouetteText: {
    color: colors.text.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  thumbnailsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  thumbnailWrapper: {
    width: width * 0.25,
    height: width * 0.25,
    margin: spacing.xs,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    ...shadows.small,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.md,
  },
  thumbnailLabel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: spacing.xs,
    alignItems: 'center',
  },
  thumbnailText: {
    color: colors.text.primary,
    fontSize: 10,
    fontWeight: 'bold',
  },
  removePhotoButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 15,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  uploadOptionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.xs,
  },
  uploadOption: {
    flex: 1,
    height: 60,
    marginHorizontal: spacing.xs,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    ...shadows.medium,
  },
  uploadOptionGradient: {
    flex: 1,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  uploadOptionBlur: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
  },
  uploadOptionText: {
    color: colors.text.primary,
    fontWeight: 'bold',
    marginLeft: spacing.xs,
  },
  analysisProgressContainer: {
    marginVertical: spacing.md,
  },
  progressTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  progressText: {
    marginLeft: spacing.sm,
    color: colors.text.secondary,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  actionsContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  analyzeButton: {
    width: '100%',
    height: 56,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    marginBottom: spacing.md,
    ...shadows.medium,
  },
  buttonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.md,
  },
  analyzeButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    ...shadows.small,
  },
  skipText: {
    textDecorationLine: 'underline',
    opacity: 0.8,
  },
  disabledButton: {
    opacity: 0.5,
  },
  privacyNotice: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginTop: spacing.md,
  },
  privacyBlur: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  privacyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  privacyText: {
    lineHeight: 18,
    fontSize: 12,
    opacity: 0.8,
  },
  resultsContainer: {
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  resultsCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  resultsTitle: {
    textAlign: 'center',
    marginBottom: spacing.md,
    fontWeight: 'bold',
  },
  resultSection: {
    marginBottom: spacing.md,
  },
  resultLabel: {
    fontWeight: 'bold',
    marginBottom: spacing.xs,
  },
  resultValue: {
    fontWeight: 'bold',
  },
  resultText: {
    lineHeight: 22,
  },
  focusAreasContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.xs,
  },
  focusAreaChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  nextButton: {
    marginTop: spacing.md,
    width: '100%',
    height: 50,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  nextButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
});
