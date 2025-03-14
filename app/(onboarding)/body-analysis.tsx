import React, { useState } from 'react';
import { 
  View, 
  StyleSheet, 
  Image, 
  ScrollView, 
  Alert, 
  Dimensions, 
  TouchableOpacity, 
  Platform,
  ImageBackground 
} from 'react-native';
import { 
  Button, 
  Card, 
  Chip, 
  ActivityIndicator, 
  IconButton, 
  ProgressBar,
  useTheme 
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
import { colors, spacing, borderRadius, shadows } from '../../theme/theme';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

// Get screen dimensions for responsive sizing
const { width, height } = Dimensions.get('window');

/**
 * Body Analysis Screen
 * Part of the onboarding flow - allows users to upload photos for AI body analysis
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
  
  // Create user details from params and profile
  const userDetails: UserPhysicalDetails = {
    age: params?.age ? parseInt(params.age) : 30, // Default if not available
    gender: params?.gender || 'male', // Default if not available
    height: params?.height ? parseInt(params.height) : profile?.height || 175, // in cm
    weight: getUserWeight(profile) || 70, // in kg
    fitnessGoal: (params?.fitnessGoal || profile?.fitness_goal || 'build_muscle') as "weight loss" | "muscle gain" | "improved fitness" | "maintenance",
  };
  
  // Function to pick image from gallery
  const pickImage = async (type: 'front' | 'side' | 'back') => {
    try {
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
      }
    } catch (err) {
      console.error('Error picking image:', err);
      Alert.alert('Error', 'There was a problem picking your image. Please try again.');
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
    if (photos.length === 0) {
      setError('Please upload at least one photo for analysis');
      return;
    }

    setIsAnalyzing(true);
    setAnalyzeProgress(0);
    setError(null);

    try {
      // Start progress animation
      const timer = setInterval(() => {
        setAnalyzeProgress((prevProgress) => {
          const newProgress = prevProgress + 10;
          return newProgress > 90 ? 90 : newProgress;
        });
      }, 500);

      // Invoke the body analysis service
      const analysisResult = await bodyAnalysisService.analyzeBodyComposition(photos, userDetails);
      
      clearInterval(timer);
      setAnalyzeProgress(100);
      
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
          bodyType: analysisResult.bodyType,
          analysisText: analysisResult.analysisText,
          body_fat_percentage: analysisResult.bodyFatEstimate,
          bodyProportions: analysisResult.bodyProportions,
          posture: analysisResult.posture,
          recommendedFocusAreas: analysisResult.recommendedFocusAreas || analysisResult.recommendations,
        }
      });
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
          bodyType: fallbackData.bodyType,
          analysisText: fallbackData.analysisText,
          body_fat_percentage: fallbackData.bodyFatPercentage,
          bodyProportions: fallbackData.bodyProportions,
          posture: fallbackData.posture,
          recommendedFocusAreas: fallbackData.recommendedFocusAreas,
        }
      });
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
        bodyType: fallbackAnalysis.bodyType,
        analysisText: fallbackAnalysis.recommendations.join('\n'),  // Convert recommendations to analysis text
        // Add recommended focus areas from recommendations
        recommendedFocusAreas: fallbackAnalysis.recommendations,
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
    router.push('/review');
    
    // Mark that the user has moved to the next step
    await updateProfile({
      current_onboarding_step: 'review'
    });
  };
  
  // Generate fallback analysis for development or when API fails
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
                For personalized workout recommendations
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

              {/* Photo Upload Section */}
              <View style={styles.photoSection}>
                {/* Front Photo */}
                <View style={styles.photoContainer}>
                  <View style={styles.photoLabelContainer}>
                    <MaterialCommunityIcons 
                      name="human-male" 
                      size={18} 
                      color={colors.text.secondary}
                      style={{marginRight: spacing.xs}}
                    />
                    <StyledText variant="bodyMedium" color={colors.text.secondary}>
                      Front View
                    </StyledText>
                  </View>
                  <View style={styles.photoFrame}>
                    {photos.find(p => p.type === 'front') ? (
                      <Image 
                        source={{ uri: photos.find(p => p.type === 'front')?.uri }} 
                        style={styles.photo} 
                      />
                    ) : (
                      <View style={styles.photoPlaceholder}>
                        <MaterialCommunityIcons
                          name="camera-plus-outline"
                          size={40}
                          color={colors.text.muted}
                        />
                        <StyledText variant="bodySmall" color={colors.text.muted} style={{marginTop: spacing.xs}}>
                          Tap to add photo
                        </StyledText>
                      </View>
                    )}
                  </View>
                  <View style={styles.photoActions}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.cameraButton]}
                      onPress={() => takePhoto('front')}
                    >
                      <MaterialCommunityIcons name="camera" size={20} color={colors.text.primary} />
                      <StyledText variant="bodyMedium" color={colors.text.primary} style={{marginLeft: spacing.xs}}>
                        Camera
                      </StyledText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.galleryButton]}
                      onPress={() => pickImage('front')}
                    >
                      <MaterialCommunityIcons name="image-multiple" size={20} color={colors.text.primary} />
                      <StyledText variant="bodyMedium" color={colors.text.primary} style={{marginLeft: spacing.xs}}>
                        Gallery
                      </StyledText>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Side Photo */}
                <View style={styles.photoContainer}>
                  <View style={styles.photoLabelContainer}>
                    <MaterialCommunityIcons 
                      name="human-male-height-variant" 
                      size={18} 
                      color={colors.text.secondary}
                      style={{marginRight: spacing.xs}}
                    />
                    <StyledText variant="bodyMedium" color={colors.text.secondary}>
                      Side View
                    </StyledText>
                  </View>
                  <View style={styles.photoFrame}>
                    {photos.find(p => p.type === 'side') ? (
                      <Image 
                        source={{ uri: photos.find(p => p.type === 'side')?.uri }} 
                        style={styles.photo} 
                      />
                    ) : (
                      <View style={styles.photoPlaceholder}>
                        <MaterialCommunityIcons
                          name="camera-plus-outline"
                          size={40}
                          color={colors.text.muted}
                        />
                        <StyledText variant="bodySmall" color={colors.text.muted} style={{marginTop: spacing.xs}}>
                          Tap to add photo
                        </StyledText>
                      </View>
                    )}
                  </View>
                  <View style={styles.photoActions}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.cameraButton]}
                      onPress={() => takePhoto('side')}
                    >
                      <MaterialCommunityIcons name="camera" size={20} color={colors.text.primary} />
                      <StyledText variant="bodyMedium" color={colors.text.primary} style={{marginLeft: spacing.xs}}>
                        Camera
                      </StyledText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.galleryButton]}
                      onPress={() => pickImage('side')}
                    >
                      <MaterialCommunityIcons name="image-multiple" size={20} color={colors.text.primary} />
                      <StyledText variant="bodyMedium" color={colors.text.primary} style={{marginLeft: spacing.xs}}>
                        Gallery
                      </StyledText>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Back Photo */}
                <View style={styles.photoContainer}>
                  <View style={styles.photoLabelContainer}>
                    <MaterialCommunityIcons 
                      name="human-male-height" 
                      size={18} 
                      color={colors.text.secondary}
                      style={{marginRight: spacing.xs}}
                    />
                    <StyledText variant="bodyMedium" color={colors.text.secondary}>
                      Back View
                    </StyledText>
                  </View>
                  <View style={styles.photoFrame}>
                    {photos.find(p => p.type === 'back') ? (
                      <Image 
                        source={{ uri: photos.find(p => p.type === 'back')?.uri }} 
                        style={styles.photo} 
                      />
                    ) : (
                      <View style={styles.photoPlaceholder}>
                        <MaterialCommunityIcons
                          name="camera-plus-outline"
                          size={40}
                          color={colors.text.muted}
                        />
                        <StyledText variant="bodySmall" color={colors.text.muted} style={{marginTop: spacing.xs}}>
                          Tap to add photo
                        </StyledText>
                      </View>
                    )}
                  </View>
                  <View style={styles.photoActions}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.cameraButton]}
                      onPress={() => takePhoto('back')}
                    >
                      <MaterialCommunityIcons name="camera" size={20} color={colors.text.primary} />
                      <StyledText variant="bodyMedium" color={colors.text.primary} style={{marginLeft: spacing.xs}}>
                        Camera
                      </StyledText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.galleryButton]}
                      onPress={() => pickImage('back')}
                    >
                      <MaterialCommunityIcons name="image-multiple" size={20} color={colors.text.primary} />
                      <StyledText variant="bodyMedium" color={colors.text.primary} style={{marginLeft: spacing.xs}}>
                        Gallery
                      </StyledText>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Analysis Progress */}
              {isAnalyzing && (
                <View style={styles.analysisProgressContainer}>
                  <View style={styles.progressTextContainer}>
                    <MaterialCommunityIcons name="chart-bar" size={20} color={colors.primary.main} />
                    <StyledText variant="bodyMedium" color={colors.text.primary} style={styles.progressText}>
                      Analyzing your body composition...
                    </StyledText>
                  </View>
                  <ProgressBar 
                    progress={analyzeProgress / 100} 
                    color={colors.primary.main} 
                    style={styles.progressBar} 
                  />
                </View>
              )}

              {/* Error Message */}
              {error && (
                <View style={styles.errorContainer}>
                  <MaterialCommunityIcons name="alert-circle-outline" size={20} color={colors.feedback.error} style={{marginRight: spacing.sm}} />
                  <StyledText variant="bodyMedium" color={colors.feedback.error}>
                    {error}
                  </StyledText>
                </View>
              )}

              {/* Actions */}
              <View style={styles.actionsContainer}>
                <TouchableOpacity
                  onPress={skipAnalysis}
                  style={styles.skipButton}
                >
                  <StyledText variant="bodyMedium" color={colors.text.secondary}>
                    Skip for now
                  </StyledText>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={analyzeUserPhotos}
                  disabled={photos.length === 0 || isAnalyzing}
                  style={[styles.analyzeButton, photos.length === 0 || isAnalyzing ? styles.disabledButton : {}]}
                >
                  <View style={styles.analyzeButtonContent}>
                    {isAnalyzing ? (
                      <ActivityIndicator size="small" color={colors.surface.light} style={{marginRight: spacing.sm}} />
                    ) : (
                      <MaterialCommunityIcons name="clipboard-check-outline" size={20} color={colors.surface.light} style={{marginRight: spacing.sm}} />
                    )}
                    <StyledText variant="bodyMedium" style={{color: colors.surface.light, fontWeight: 'bold'}}>
                      {isAnalyzing ? 'Analyzing...' : 'Analyze Photos'}
                    </StyledText>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Privacy Notice */}
              <View style={styles.privacyNotice}>
                <View style={styles.privacyHeader}>
                  <MaterialCommunityIcons name="shield-check-outline" size={20} color={colors.text.muted} />
                  <StyledText variant="bodyMedium" color={colors.text.muted} style={{marginLeft: spacing.xs, fontWeight: 'bold'}}>
                    Privacy Protection
                  </StyledText>
                </View>
                <StyledText variant="bodySmall" color={colors.text.muted} style={styles.privacyText}>
                  Your photos are processed securely and not stored permanently. They are used only to generate your body analysis results.
                </StyledText>
              </View>
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
  headerContainer: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    marginBottom: spacing.md,
  },
  headerContent: {
    flex: 1,
    justifyContent: 'center',
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
  instructionText: {
    marginBottom: spacing.md,
    lineHeight: 22,
  },
  photoSection: {
    marginBottom: spacing.lg,
  },
  photoContainer: {
    marginBottom: spacing.md,
  },
  photoLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  photoFrame: {
    width: '100%',
    height: 200,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface.dark,
    marginVertical: spacing.sm,
    ...shadows.small,
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border.medium,
    borderRadius: borderRadius.md,
  },
  photo: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  photoActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface.main,
    ...shadows.small,
  },
  cameraButton: {
    marginRight: spacing.xs,
  },
  galleryButton: {
    marginLeft: spacing.xs,
  },
  analysisProgressContainer: {
    marginVertical: spacing.md,
  },
  progressTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  progressText: {
    marginLeft: spacing.sm,
  },
  progressBar: {
    height: 8,
    borderRadius: borderRadius.xs,
  },
  errorContainer: {
    marginVertical: spacing.md,
    padding: spacing.md,
    backgroundColor: 'rgba(248, 113, 113, 0.1)', // Light red background
    borderRadius: borderRadius.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.feedback.error,
  },
  actionsContainer: {
    marginTop: spacing.lg,
    flexDirection: 'column',
    gap: spacing.md,
  },
  skipButton: {
    borderColor: colors.border.medium,
  },
  analyzeButton: {
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary.main,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  analyzeButtonContent: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  privacyNotice: {
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.surface.dark,
    borderRadius: borderRadius.sm,
  },
  privacyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  privacyText: {
    textAlign: 'center',
  },
  decorativeCircle: {
    position: 'absolute',
    borderRadius: 150,
    opacity: 0.2,
  },
  decorativeCircle1: {
    top: -50,
    right: -50,
    width: 200,
    height: 200,
    backgroundColor: colors.primary.light,
  },
  decorativeCircle2: {
    bottom: 100,
    left: -100,
    width: 300,
    height: 300,
    backgroundColor: colors.secondary.light,
  },
  decorativeCircle3: {
    bottom: -50,
    right: -50,
    width: 200,
    height: 200,
    backgroundColor: colors.primary.light,
  },
});
