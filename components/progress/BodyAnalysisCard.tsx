import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Card, Text, Divider, Button, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BodyAnalysis } from '../../types/profile';
import { router } from 'expo-router';
import StyledText from '../ui/StyledText';
import { colors, spacing, borderRadius, shadows } from '../../theme/theme';

interface BodyAnalysisCardProps {
  bodyAnalysis: BodyAnalysis | undefined;
  showFullDetails?: boolean;
}

/**
 * Component to display body analysis data in the Progress tab
 */
export default function BodyAnalysisCard({ bodyAnalysis, showFullDetails = false }: BodyAnalysisCardProps) {
  const theme = useTheme();

  // Helper function to get the correct value with units
  const getValueWithUnit = (value: number | undefined, unit: string, defaultText: string = 'Not provided') => {
    return value ? `${value} ${unit}` : defaultText;
  };

  // If no body analysis data exists
  if (!bodyAnalysis) {
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <MaterialCommunityIcons name="human-male-height" size={24} color={colors.primary.main} />
          <StyledText variant="headingSmall" style={styles.cardTitle}>
            Body Analysis
          </StyledText>
        </View>
        
        <StyledText variant="bodyMedium" color={colors.text.secondary} style={styles.noDataText}>
          No body analysis data available. Complete the body analysis during onboarding to see your results here.
        </StyledText>
        
        <TouchableOpacity 
          style={styles.buttonContainer}
          onPress={() => router.push('/(onboarding)/body-analysis?returnToProgress=true')}
        >
          <LinearGradient 
            colors={[colors.primary.main, colors.primary.dark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.buttonGradient}
          >
            <StyledText variant="bodyMedium" color={colors.text.primary} style={styles.buttonText}>
              Complete Body Analysis
            </StyledText>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }

  // Extract relevant body data
  const height = bodyAnalysis.height_cm || bodyAnalysis.height || 173;
  const weight = bodyAnalysis.weight_kg || bodyAnalysis.weight || 85;
  const bodyFat = bodyAnalysis.body_fat_percentage || 28;
  const bodyType = bodyAnalysis.body_type || bodyAnalysis.bodyType || 'Endomorph with mesomorph tendencies';
  
  // Get the analysis text if available
  const analysisText = bodyAnalysis.analysis_text || bodyAnalysis.analysisText;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <MaterialCommunityIcons name="human-male-height" size={24} color={colors.primary.main} />
        <StyledText variant="headingSmall" style={styles.cardTitle}>
          Body Analysis
        </StyledText>
      </View>
      
      <LinearGradient
        colors={[colors.secondary.light, colors.secondary.dark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.dataContainer}
      >
        <View style={styles.bodyStatsGrid}>
          <View style={styles.bodyStatItem}>
            <MaterialCommunityIcons name="human-male-height" size={24} color={colors.text.primary} />
            <StyledText variant="bodySmall" color={colors.text.primary} style={styles.statLabel}>
              Height
            </StyledText>
            <StyledText variant="bodyLarge" color={colors.text.primary} style={styles.statValue}>
              {getValueWithUnit(height, 'cm')}
            </StyledText>
          </View>
          
          <View style={styles.bodyStatItem}>
            <MaterialCommunityIcons name="scale" size={24} color={colors.text.primary} />
            <StyledText variant="bodySmall" color={colors.text.primary} style={styles.statLabel}>
              Weight
            </StyledText>
            <StyledText variant="bodyLarge" color={colors.text.primary} style={styles.statValue}>
              {getValueWithUnit(weight, 'kg')}
            </StyledText>
          </View>
          
          <View style={styles.bodyStatItem}>
            <MaterialCommunityIcons name="percent" size={24} color={colors.text.primary} />
            <StyledText variant="bodySmall" color={colors.text.primary} style={styles.statLabel}>
              Body Fat
            </StyledText>
            <StyledText variant="bodyLarge" color={colors.text.primary} style={styles.statValue}>
              {getValueWithUnit(bodyFat, '%')}
            </StyledText>
          </View>
          
          <View style={styles.bodyStatItem}>
            <MaterialCommunityIcons name="human" size={24} color={colors.text.primary} />
            <StyledText variant="bodySmall" color={colors.text.primary} style={styles.statLabel}>
              Body Type
            </StyledText>
            <StyledText variant="bodyLarge" color={colors.text.primary} style={styles.statValue}>
              {bodyType || 'Not provided'}
            </StyledText>
          </View>
        </View>
      </LinearGradient>
      
      {/* Analysis Text Section */}
      {analysisText && showFullDetails && (
        <LinearGradient
          colors={[colors.surface.main, colors.background.primary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.analysisSection}
        >
          <View style={styles.analysisTitleRow}>
            <MaterialCommunityIcons name="file-document-outline" size={22} color={colors.primary.main} />
            <StyledText variant="headingSmall" style={styles.sectionTitle}>
              Analysis
            </StyledText>
          </View>
          <View style={styles.analysisTextContainer}>
            <StyledText variant="bodyMedium" style={styles.analysisText}>
              {analysisText}
            </StyledText>
          </View>
        </LinearGradient>
      )}
      
      {!showFullDetails && (
        <View style={styles.viewDetailsButtonWrapper}>
          <TouchableOpacity 
            style={styles.buttonContainer}
            onPress={() => router.push('/(tabs)/progress/body-details')}
          >
            <LinearGradient 
              colors={[colors.primary.main, colors.primary.dark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.buttonGradient}
            >
              <StyledText variant="bodyMedium" color={colors.text.primary} style={styles.buttonText}>
                View Full Details
              </StyledText>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface.main,
    borderRadius: borderRadius.lg,
    marginVertical: spacing.md,
    marginBottom: spacing.xxl,
    padding: spacing.md,
    ...shadows.medium,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  cardTitle: {
    marginLeft: spacing.sm,
    color: colors.text.primary,
  },
  noDataText: {
    textAlign: 'center',
    marginVertical: spacing.md,
  },
  buttonContainer: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  buttonGradient: {
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    fontWeight: 'bold',
  },
  dataContainer: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  bodyStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  bodyStatItem: {
    alignItems: 'center',
    width: '25%',
  },
  statLabel: {
    marginVertical: spacing.xs,
  },
  statValue: {
    fontWeight: 'bold',
  },
  sectionTitle: {
    marginVertical: spacing.sm,
    color: colors.text.primary,
  },
  focusAreasContainer: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  focusAreaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  focusAreaText: {
    marginLeft: spacing.sm,
  },
  viewDetailsButtonWrapper: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  analysisSection: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginVertical: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary.main,
  },
  analysisTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  analysisTextContainer: {
    paddingHorizontal: spacing.md,
  },
  analysisText: {
    lineHeight: 26,
    textAlign: 'left',
    letterSpacing: 0.5,
    color: colors.text.primary,
    fontSize: 15,
  },
  quoteIcon: {
    display: 'none',
  },
  endQuote: {
    display: 'none',
  },
});