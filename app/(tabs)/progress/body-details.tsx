import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Image, TouchableOpacity } from 'react-native';
import { Text, Button, Card, Divider, useTheme, Surface, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../../contexts/AuthContext';
import { useProfile } from '../../../contexts/ProfileContext';
import BodyAnalysisCard from '../../../components/progress/BodyAnalysisCard';
import StyledText from '../../../components/ui/StyledText';
import { colors, spacing, borderRadius, shadows } from '../../../theme/theme';
import { useFocusEffect } from '@react-navigation/native';

/**
 * Body Analysis Details Screen
 */
export default function BodyAnalysisDetailsScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const { profile, refreshProfile } = useProfile();
  const [loading, setLoading] = useState(true);

  // Log profile data for debugging
  useEffect(() => {
    if (profile) {
      console.log('Body Analysis Screen - Profile Data:', JSON.stringify(profile, null, 2));
      console.log('Body Analysis Data:', JSON.stringify(profile.body_analysis || {}, null, 2));
    }
  }, [profile]);

  // Refresh profile data when component mounts or screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      const loadData = async () => {
        setLoading(true);
        try {
          await refreshProfile(true); // Force refresh to ensure we have the latest data
        } catch (error) {
          console.error('Error refreshing profile:', error);
        } finally {
          setLoading(false);
        }
      };
      
      loadData();
    }, [])
  );

  // Function to render posture analysis section
  const renderPostureAnalysis = () => {
    const postureData = profile?.body_analysis?.posture || {};
    const alignment = (postureData as any).alignment || 'Not analyzed';
    const recommendations = (postureData as any).recommendations || ['Maintain proper posture'];

    return (
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="human-handsup" size={24} color={colors.primary.main} />
          <StyledText variant="headingSmall" style={styles.sectionTitle}>
            Posture Analysis
          </StyledText>
        </View>

        <View style={styles.infoRow}>
          <StyledText variant="bodyMedium" style={styles.infoLabel}>Alignment</StyledText>
          <StyledText variant="bodyMedium" style={styles.infoValue}>{alignment}</StyledText>
        </View>

        <StyledText variant="bodyMedium" style={styles.subSectionTitle}>Recommendations</StyledText>
        {recommendations.map((rec, index) => (
          <View key={index} style={styles.recommendationItem}>
            <View style={styles.bullet} />
            <StyledText variant="bodyMedium" style={styles.recommendationText}>{rec}</StyledText>
          </View>
        ))}
      </View>
    );
  };

  // Function to render recommended focus areas
  const renderRecommendedFocusAreas = () => {
    // Check both snake_case and camelCase properties, but prioritize the one with data
    const recommendedAreas = 
      (profile?.body_analysis?.recommended_focus_areas?.length ? profile.body_analysis.recommended_focus_areas : 
       profile?.body_analysis?.recommendedFocusAreas?.length ? profile.body_analysis.recommendedFocusAreas : []);
    
    // If no focus areas, don't render this section at all
    if (recommendedAreas.length === 0) {
      return null;
    }
    
    return (
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="target" size={24} color={colors.primary.main} />
          <StyledText variant="headingSmall" style={styles.sectionTitle}>
            Recommended Focus Areas
          </StyledText>
        </View>

        <View style={styles.focusAreasContainer}>
          {recommendedAreas.map((area, index) => {
            // Return different gradient styles based on index for visual variety
            if (index % 5 === 0) {
              return (
                <LinearGradient
                  key={index}
                  colors={[colors.primary.light, colors.primary.main]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.focusAreaCard}
                >
                  <View style={styles.focusAreaIconContainer}>
                    <MaterialCommunityIcons name="check-circle" size={24} color={colors.text.primary} />
                  </View>
                  <View style={styles.focusAreaTextContainer}>
                    <StyledText variant="bodyLarge" color={colors.text.primary} style={styles.focusAreaText}>
                      {area}
                    </StyledText>
                  </View>
                </LinearGradient>
              );
            } else if (index % 5 === 1) {
              return (
                <LinearGradient
                  key={index}
                  colors={[colors.secondary.light, colors.secondary.main]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.focusAreaCard}
                >
                  <View style={styles.focusAreaIconContainer}>
                    <MaterialCommunityIcons name="check-circle" size={24} color={colors.text.primary} />
                  </View>
                  <View style={styles.focusAreaTextContainer}>
                    <StyledText variant="bodyLarge" color={colors.text.primary} style={styles.focusAreaText}>
                      {area}
                    </StyledText>
                  </View>
                </LinearGradient>
              );
            } else if (index % 5 === 2) {
              return (
                <LinearGradient
                  key={index}
                  colors={['#3a7bd5', '#00d2ff']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.focusAreaCard}
                >
                  <View style={styles.focusAreaIconContainer}>
                    <MaterialCommunityIcons name="check-circle" size={24} color={colors.text.primary} />
                  </View>
                  <View style={styles.focusAreaTextContainer}>
                    <StyledText variant="bodyLarge" color={colors.text.primary} style={styles.focusAreaText}>
                      {area}
                    </StyledText>
                  </View>
                </LinearGradient>
              );
            } else if (index % 5 === 3) {
              return (
                <LinearGradient
                  key={index}
                  colors={['#ff758c', '#ff7eb3']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.focusAreaCard}
                >
                  <View style={styles.focusAreaIconContainer}>
                    <MaterialCommunityIcons name="check-circle" size={24} color={colors.text.primary} />
                  </View>
                  <View style={styles.focusAreaTextContainer}>
                    <StyledText variant="bodyLarge" color={colors.text.primary} style={styles.focusAreaText}>
                      {area}
                    </StyledText>
                  </View>
                </LinearGradient>
              );
            } else {
              return (
                <LinearGradient
                  key={index}
                  colors={['#4facfe', '#00f2fe']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.focusAreaCard}
                >
                  <View style={styles.focusAreaIconContainer}>
                    <MaterialCommunityIcons name="check-circle" size={24} color={colors.text.primary} />
                  </View>
                  <View style={styles.focusAreaTextContainer}>
                    <StyledText variant="bodyLarge" color={colors.text.primary} style={styles.focusAreaText}>
                      {area}
                    </StyledText>
                  </View>
                </LinearGradient>
              );
            }
          })}
        </View>
      </View>
    );
  };

  // Function to render body measurements
  const renderBodyMeasurements = () => {
    const measurements = (profile?.body_analysis as any)?.measurements || {};
    
    // Common measurements that might be in the database
    const measurementItems = [
      { key: 'chest', label: 'Chest', icon: 'human-male' as const, unit: 'cm' },
      { key: 'waist', label: 'Waist', icon: 'human-male' as const, unit: 'cm' },
      { key: 'hips', label: 'Hips', icon: 'human-male' as const, unit: 'cm' },
      { key: 'arms', label: 'Arms', icon: 'arm-flex' as const, unit: 'cm' },
      { key: 'thighs', label: 'Thighs', icon: 'human-male' as const, unit: 'cm' },
      { key: 'calves', label: 'Calves', icon: 'human-male' as const, unit: 'cm' },
      { key: 'shoulders', label: 'Shoulders', icon: 'human-male' as const, unit: 'cm' },
    ];

    return (
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="tape-measure" size={24} color={colors.primary.main} />
          <StyledText variant="headingSmall" style={styles.sectionTitle}>
            Body Measurements
          </StyledText>
        </View>

        {measurementItems.map((item) => (
          measurements[item.key] ? (
            <View key={item.key} style={styles.infoRow}>
              <View style={styles.infoLabelContainer}>
                <MaterialCommunityIcons name={item.icon} size={20} color={colors.text.secondary} />
                <StyledText variant="bodyMedium" style={styles.infoLabel}>{item.label}</StyledText>
              </View>
              <StyledText variant="bodyMedium" style={styles.infoValue}>
                {measurements[item.key]} {item.unit}
              </StyledText>
            </View>
          ) : null
        ))}

        {Object.keys(measurements).length === 0 && (
          <StyledText variant="bodyMedium" style={styles.noDataText}>
            No measurement data available
          </StyledText>
        )}
      </View>
    );
  };

  // Function to render BMI and other calculations
  const renderCalculations = () => {
    const bodyAnalysis = profile?.body_analysis || {};
    const bmi = (bodyAnalysis as any).bmi;
    const bmiCategory = (bodyAnalysis as any).bmiCategory || 'Not calculated';
    const bmr = (bodyAnalysis as any).bmr;
    const tdee = (bodyAnalysis as any).tdee;

    // If no health metrics are available, don't render this section at all
    if (!bmi && !bmr && !tdee) {
      return null;
    }

    return (
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="calculator" size={24} color={colors.primary.main} />
          <StyledText variant="headingSmall" style={styles.sectionTitle}>
            Health Metrics
          </StyledText>
        </View>

        <View style={styles.healthMetricsGrid}>
          {bmi && (
            <View style={styles.metricCard}>
              <LinearGradient
                colors={[colors.primary.light, colors.primary.main]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.metricCardGradient}
              >
                <View style={styles.metricIconContainer}>
                  <MaterialCommunityIcons name="scale-bathroom" size={28} color={colors.text.primary} />
                </View>
                <StyledText variant="bodyMedium" color={colors.text.primary} style={styles.metricLabel}>BMI</StyledText>
                <StyledText variant="headingLarge" color={colors.text.primary} style={styles.metricValue}>{bmi}</StyledText>
                <View style={[styles.categoryPill, getBMICategoryStyle(bmiCategory)]}>
                  <StyledText variant="bodySmall" color={colors.text.primary} style={styles.categoryText}>
                    {bmiCategory}
                  </StyledText>
                </View>
              </LinearGradient>
            </View>
          )}

          {bmr && (
            <View style={styles.metricCard}>
              <LinearGradient
                colors={[colors.secondary.light, colors.secondary.main]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.metricCardGradient}
              >
                <View style={styles.metricIconContainer}>
                  <MaterialCommunityIcons name="fire" size={28} color={colors.text.primary} />
                </View>
                <StyledText variant="bodyMedium" color={colors.text.primary} style={styles.metricLabel}>BMR</StyledText>
                <View style={styles.metricValueContainer}>
                  <StyledText variant="headingLarge" color={colors.text.primary} style={styles.metricValue}>{bmr}</StyledText>
                  <StyledText variant="bodySmall" color={colors.text.primary} style={styles.metricUnit}>cal/day</StyledText>
                </View>
              </LinearGradient>
            </View>
          )}

          {tdee && (
            <View style={styles.metricCard}>
              <LinearGradient
                colors={['#3a7bd5', '#00d2ff']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.metricCardGradient}
              >
                <View style={styles.metricIconContainer}>
                  <MaterialCommunityIcons name="lightning-bolt" size={28} color={colors.text.primary} />
                </View>
                <StyledText variant="bodyMedium" color={colors.text.primary} style={styles.metricLabel}>TDEE</StyledText>
                <View style={styles.metricValueContainer}>
                  <StyledText variant="headingLarge" color={colors.text.primary} style={styles.metricValue}>{tdee}</StyledText>
                  <StyledText variant="bodySmall" color={colors.text.primary} style={styles.metricUnit}>cal/day</StyledText>
                </View>
              </LinearGradient>
            </View>
          )}
        </View>
        
        <View style={styles.metricsInfoContainer}>
          <MaterialCommunityIcons name="information-outline" size={16} color={colors.text.secondary} />
          <StyledText variant="bodySmall" style={styles.metricsInfoText}>
            BMI = Body Mass Index, BMR = Basal Metabolic Rate, TDEE = Total Daily Energy Expenditure
          </StyledText>
        </View>
      </View>
    );
  };

  // Helper function to get BMI category style
  const getBMICategoryStyle = (category: string) => {
    switch (category.toLowerCase()) {
      case 'underweight':
        return { backgroundColor: '#FFD700' }; // Gold
      case 'normal':
      case 'healthy':
        return { backgroundColor: '#4CAF50' }; // Green
      case 'overweight':
        return { backgroundColor: '#FF9800' }; // Orange
      case 'obese':
        return { backgroundColor: '#F44336' }; // Red
      default:
        return { backgroundColor: colors.primary.main }; // Default
    }
  };

  // Function to render analysis text separately
  const renderAnalysisText = () => {
    const analysisText = profile?.body_analysis?.analysis_text || profile?.body_analysis?.analysisText;
    
    if (!analysisText) {
      return null;
    }
    
    // Split text into paragraphs for better readability
    const paragraphs = analysisText.split('. ').filter(p => p.trim().length > 0);
    
    return (
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="file-document-outline" size={24} color={colors.primary.main} />
          <StyledText variant="headingSmall" style={styles.sectionTitle}>
            Analysis
          </StyledText>
        </View>
        
        <View style={styles.analysisContainer}>
          {paragraphs.map((paragraph, index) => (
            <View key={index} style={styles.paragraphContainer}>
              <MaterialCommunityIcons 
                name="circle-small" 
                size={16} 
                color={colors.primary.main} 
                style={styles.bulletIcon} 
              />
              <StyledText variant="bodyMedium" style={styles.paragraphText}>
                {paragraph + (paragraph.endsWith('.') ? '' : '.')}
              </StyledText>
            </View>
          ))}
        </View>
      </View>
    );
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
        
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <MaterialCommunityIcons
                name="arrow-left"
                size={24}
                color={colors.text.primary}
              />
              <StyledText variant="bodyMedium" color={colors.text.primary} style={styles.backText}>
                Back to Progress
              </StyledText>
            </TouchableOpacity>
            <StyledText variant="headingLarge" style={styles.title}>
              Body Analysis
            </StyledText>
            
            {/* Update Body Analysis Button moved to the top */}
            <TouchableOpacity
              style={styles.updateButtonTop}
              onPress={() => router.push('/(onboarding)/body-analysis?returnToProgress=true')}
            >
              <LinearGradient 
                colors={[colors.primary.main, colors.primary.dark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buttonGradient}
              >
                <MaterialCommunityIcons name="camera" size={20} color={colors.text.primary} style={styles.buttonIcon} />
                <StyledText variant="bodyMedium" color={colors.text.primary} style={styles.buttonText}>
                  Update
                </StyledText>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary.main} />
                <StyledText variant="bodyMedium" style={styles.loadingText}>
                  Loading body analysis data...
                </StyledText>
              </View>
            ) : (
              <>
                {/* Main body analysis card with stats - passing false for showFullDetails to hide analysis there */}
                <BodyAnalysisCard bodyAnalysis={profile?.body_analysis} showFullDetails={false} />
                
                {/* Render analysis text in its own section with better formatting */}
                {renderAnalysisText()}
                
                {/* Render focus areas */}
                {renderRecommendedFocusAreas()}
                
                {/* Conditionally render other sections */}
                {profile?.body_analysis?.posture && renderPostureAnalysis()}
                
                {/* Don't render body measurements if no data is available */}
                {(profile?.body_analysis as any)?.measurements && 
                Object.keys((profile?.body_analysis as any)?.measurements).length > 0 && 
                renderBodyMeasurements()}
                
                {/* Only render calculations if there are metrics to show */}
                {renderCalculations()}
                
                <StyledText variant="bodySmall" color={colors.text.secondary} style={styles.disclaimer}>
                  Disclaimer: All measurements and analyses are approximate and based on AI-assisted processing of provided images. 
                  These should not be considered medical advice. Consult with a healthcare professional for medical guidance.
                </StyledText>
              </>
            )}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    paddingTop: spacing.lg,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  backText: {
    marginLeft: spacing.xs,
  },
  title: {
    fontWeight: 'bold',
    color: colors.text.primary,
    flex: 1,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
    paddingBottom: 120,
  },
  sectionCard: {
    backgroundColor: colors.surface.main,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    ...shadows.medium,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    marginLeft: spacing.sm,
    color: colors.text.primary,
  },
  subSectionTitle: {
    fontWeight: 'bold',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.light,
  },
  infoLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoLabel: {
    color: colors.text.secondary,
    marginLeft: spacing.xs,
  },
  infoValue: {
    color: colors.text.primary,
    fontWeight: '500',
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xs,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary.main,
    marginRight: spacing.sm,
  },
  recommendationText: {
    flex: 1,
  },
  focusAreasContainer: {
    marginTop: spacing.md,
  },
  focusAreaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  focusAreaIconContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  focusAreaTextContainer: {
    flex: 1,
  },
  focusAreaText: {
    fontWeight: '600',
  },
  noDataText: {
    textAlign: 'center',
    marginVertical: spacing.md,
    fontStyle: 'italic',
  },
  updateButtonTop: {
    position: 'absolute',
    top: 0,
    right: 0,
    padding: spacing.xs,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    alignSelf: 'center',
    marginTop: 2,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
  },
  buttonIcon: {
    marginRight: spacing.sm,
  },
  buttonText: {
    fontWeight: 'bold',
  },
  disclaimer: {
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  healthMetricsGrid: {
    marginTop: spacing.md,
  },
  metricCard: {
    marginBottom: spacing.md,
  },
  metricCardGradient: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  metricIconContainer: {
    marginBottom: spacing.md,
  },
  metricLabel: {
    marginBottom: spacing.xs,
  },
  metricValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricValue: {
    marginRight: spacing.sm,
  },
  metricUnit: {
    fontSize: 12,
  },
  categoryPill: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: spacing.xs,
  },
  categoryText: {
    fontWeight: 'bold',
  },
  metricsInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  metricsInfoText: {
    marginLeft: spacing.sm,
  },
  analysisContainer: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  paragraphContainer: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    alignItems: 'flex-start',
  },
  bulletIcon: {
    marginTop: 4,
    marginRight: spacing.xs,
  },
  paragraphText: {
    flex: 1,
    lineHeight: 24,
    letterSpacing: 0.3,
    color: colors.text.primary,
  },
  bulletPoint: {
    display: 'none', // Hide old bullet point
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
  },
}); 