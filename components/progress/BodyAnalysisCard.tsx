import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Card, Text, Divider, Button, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BodyAnalysis } from '../../types/profile';
import { router } from 'expo-router';

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
      <Card style={styles.card} mode="outlined">
        <LinearGradient
          colors={['#ffffff', '#f8f8f8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cardGradient}
        >
          <Card.Content>
            <View style={styles.cardHeaderRow}>
              <MaterialCommunityIcons name="human-male-height" size={24} color={theme.colors.primary} />
              <Text variant="titleLarge" style={styles.cardTitle}>Body Analysis</Text>
            </View>
            
            <Text variant="bodyMedium" style={styles.noDataText}>
              No body analysis data available. Complete the body analysis during onboarding to see your results here.
            </Text>
            
            <TouchableOpacity 
              style={styles.buttonContainer}
              onPress={() => router.push('/(onboarding)/body-analysis?returnToProgress=true')}
            >
              <LinearGradient 
                colors={[theme.colors.primary, theme.colors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buttonGradient}
              >
                <Text style={styles.buttonText}>Complete Body Analysis</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Card.Content>
        </LinearGradient>
      </Card>
    );
  }

  // Extract relevant body data
  const height = bodyAnalysis.height_cm || bodyAnalysis.height;
  const weight = bodyAnalysis.weight_kg || bodyAnalysis.weight;
  const bodyFat = bodyAnalysis.body_fat_percentage;
  const bodyType = bodyAnalysis.bodyType;
  const recommendedFocusAreas = bodyAnalysis.recommendedFocusAreas;

  return (
    <Card style={styles.card} mode="outlined">
      <LinearGradient
        colors={['#ffffff', '#f8f8f8']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.cardGradient}
      >
        <Card.Content>
          <View style={styles.cardHeaderRow}>
            <MaterialCommunityIcons name="human-male-height" size={24} color={theme.colors.primary} />
            <Text variant="titleLarge" style={styles.cardTitle}>Body Analysis</Text>
          </View>
          
          <LinearGradient
            colors={[theme.colors.primaryContainer, theme.colors.secondaryContainer]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.dataContainer}
          >
            <View style={styles.bodyStatsGrid}>
              <View style={styles.bodyStatItem}>
                <MaterialCommunityIcons name="human-male-height" size={24} color={theme.colors.primary} />
                <Text style={styles.statLabel}>Height</Text>
                <Text style={styles.statValue}>{getValueWithUnit(height, 'cm')}</Text>
              </View>
              
              <View style={styles.bodyStatItem}>
                <MaterialCommunityIcons name="scale" size={24} color={theme.colors.primary} />
                <Text style={styles.statLabel}>Weight</Text>
                <Text style={styles.statValue}>{getValueWithUnit(weight, 'kg')}</Text>
              </View>
              
              <View style={styles.bodyStatItem}>
                <MaterialCommunityIcons name="percent" size={24} color={theme.colors.primary} />
                <Text style={styles.statLabel}>Body Fat</Text>
                <Text style={styles.statValue}>{getValueWithUnit(bodyFat, '%')}</Text>
              </View>
              
              <View style={styles.bodyStatItem}>
                <MaterialCommunityIcons name="human" size={24} color={theme.colors.primary} />
                <Text style={styles.statLabel}>Body Type</Text>
                <Text style={styles.statValue}>{bodyType || 'Not provided'}</Text>
              </View>
            </View>
          </LinearGradient>
          
          {showFullDetails && recommendedFocusAreas && (
            <>
              <Text variant="titleMedium" style={styles.sectionTitle}>Recommended Focus Areas</Text>
              <LinearGradient
                colors={[theme.colors.primaryContainer, theme.colors.secondaryContainer]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.focusAreasContainer}
              >
                {recommendedFocusAreas.map((area, index) => (
                  <View key={index} style={styles.focusAreaItem}>
                    <MaterialCommunityIcons name="target" size={20} color={theme.colors.primary} />
                    <Text style={styles.focusAreaText}>{area}</Text>
                  </View>
                ))}
              </LinearGradient>
            </>
          )}
          
          {!showFullDetails && (
            <TouchableOpacity 
              style={styles.buttonContainer}
              onPress={() => router.push('/(tabs)/progress/body-details')}
            >
              <LinearGradient 
                colors={[theme.colors.primary, theme.colors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buttonGradient}
              >
                <Text style={styles.buttonText}>View Full Details</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </Card.Content>
      </LinearGradient>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginVertical: 8,
    elevation: 2,
  },
  cardGradient: {
    borderRadius: 8,
    padding: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    marginLeft: 8,
  },
  noDataText: {
    textAlign: 'center',
    marginVertical: 16,
    opacity: 0.7,
  },
  buttonContainer: {
    padding: 16,
    borderRadius: 8,
    overflow: 'hidden',
  },
  buttonGradient: {
    padding: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  dataContainer: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  bodyStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bodyStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  focusAreasContainer: {
    padding: 16,
    borderRadius: 8,
  },
  focusAreaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  focusAreaText: {
    fontSize: 16,
    marginLeft: 8,
  },
});