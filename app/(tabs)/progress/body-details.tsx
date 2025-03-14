import React from 'react';
import { View, StyleSheet, ScrollView, Image } from 'react-native';
import { Text, Button, Card, Divider, useTheme, Surface } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useProfile } from '../../../contexts/ProfileContext';
import BodyAnalysisCard from '../../../components/progress/BodyAnalysisCard';

export default function BodyDetailsScreen() {
  const theme = useTheme();
  const { profile } = useProfile();
  const bodyAnalysis = profile?.body_analysis;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="auto" />

      <View style={styles.header}>
        <Button 
          icon="arrow-left" 
          onPress={() => router.back()}
          contentStyle={styles.backButton}
        >
          Back to Progress
        </Button>
        <Text variant="titleLarge" style={styles.title}>Body Analysis</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <BodyAnalysisCard bodyAnalysis={bodyAnalysis} showFullDetails={true} />
        
        {bodyAnalysis && (
          <>
            {/* Additional Information about Body Measurements */}
            {bodyAnalysis.measurements && (
              <Card style={styles.card}>
                <Card.Title title="Body Measurements" />
                <Card.Content>
                  <View style={styles.measurementsContainer}>
                    {bodyAnalysis.measurements.chest && (
                      <View style={styles.measurementItem}>
                        <Text variant="bodyMedium" style={styles.measurementLabel}>Chest</Text>
                        <Text variant="bodyLarge" style={styles.measurementValue}>
                          {bodyAnalysis.measurements.chest} cm
                        </Text>
                      </View>
                    )}
                    
                    {bodyAnalysis.measurements.waist && (
                      <View style={styles.measurementItem}>
                        <Text variant="bodyMedium" style={styles.measurementLabel}>Waist</Text>
                        <Text variant="bodyLarge" style={styles.measurementValue}>
                          {bodyAnalysis.measurements.waist} cm
                        </Text>
                      </View>
                    )}
                    
                    {bodyAnalysis.measurements.hips && (
                      <View style={styles.measurementItem}>
                        <Text variant="bodyMedium" style={styles.measurementLabel}>Hips</Text>
                        <Text variant="bodyLarge" style={styles.measurementValue}>
                          {bodyAnalysis.measurements.hips} cm
                        </Text>
                      </View>
                    )}
                    
                    {bodyAnalysis.measurements.arms && (
                      <View style={styles.measurementItem}>
                        <Text variant="bodyMedium" style={styles.measurementLabel}>Arms</Text>
                        <Text variant="bodyLarge" style={styles.measurementValue}>
                          {bodyAnalysis.measurements.arms} cm
                        </Text>
                      </View>
                    )}
                    
                    {bodyAnalysis.measurements.legs && (
                      <View style={styles.measurementItem}>
                        <Text variant="bodyMedium" style={styles.measurementLabel}>Legs</Text>
                        <Text variant="bodyLarge" style={styles.measurementValue}>
                          {bodyAnalysis.measurements.legs} cm
                        </Text>
                      </View>
                    )}
                  </View>
                </Card.Content>
              </Card>
            )}
            
            {/* Posture Analysis */}
            {bodyAnalysis.posture && (
              <Card style={styles.card}>
                <Card.Title title="Posture Analysis" />
                <Card.Content>
                  {bodyAnalysis.posture.alignment && (
                    <View style={styles.postureSection}>
                      <Text variant="bodyMedium" style={styles.sectionLabel}>Alignment</Text>
                      <Text variant="bodyMedium" style={styles.postureText}>
                        {bodyAnalysis.posture.alignment}
                      </Text>
                    </View>
                  )}
                  
                  {bodyAnalysis.posture.issues && bodyAnalysis.posture.issues.length > 0 && (
                    <View style={styles.postureSection}>
                      <Text variant="bodyMedium" style={styles.sectionLabel}>Issues</Text>
                      <View style={styles.issuesList}>
                        {bodyAnalysis.posture.issues.map((issue, index) => (
                          <Text key={index} variant="bodyMedium" style={styles.issueItem}>
                            • {issue}
                          </Text>
                        ))}
                      </View>
                    </View>
                  )}
                  
                  {bodyAnalysis.posture.recommendations && bodyAnalysis.posture.recommendations.length > 0 && (
                    <View style={styles.postureSection}>
                      <Text variant="bodyMedium" style={styles.sectionLabel}>Recommendations</Text>
                      <View style={styles.recommendationsList}>
                        {bodyAnalysis.posture.recommendations.map((rec, index) => (
                          <Text key={index} variant="bodyMedium" style={styles.recommendationItem}>
                            • {rec}
                          </Text>
                        ))}
                      </View>
                    </View>
                  )}
                </Card.Content>
              </Card>
            )}
            
            {/* Body Proportions */}
            {bodyAnalysis.bodyProportions && (
              <Card style={styles.card}>
                <Card.Title title="Body Proportions" />
                <Card.Content>
                  <View style={styles.proportionsContainer}>
                    {bodyAnalysis.bodyProportions.shoulders && (
                      <View style={styles.proportionItem}>
                        <Text variant="bodyMedium" style={styles.proportionLabel}>Shoulders</Text>
                        <Text variant="bodyMedium">{bodyAnalysis.bodyProportions.shoulders}</Text>
                      </View>
                    )}
                    
                    {bodyAnalysis.bodyProportions.torso && (
                      <View style={styles.proportionItem}>
                        <Text variant="bodyMedium" style={styles.proportionLabel}>Torso</Text>
                        <Text variant="bodyMedium">{bodyAnalysis.bodyProportions.torso}</Text>
                      </View>
                    )}
                    
                    {bodyAnalysis.bodyProportions.arms && (
                      <View style={styles.proportionItem}>
                        <Text variant="bodyMedium" style={styles.proportionLabel}>Arms</Text>
                        <Text variant="bodyMedium">{bodyAnalysis.bodyProportions.arms}</Text>
                      </View>
                    )}
                    
                    {bodyAnalysis.bodyProportions.legs && (
                      <View style={styles.proportionItem}>
                        <Text variant="bodyMedium" style={styles.proportionLabel}>Legs</Text>
                        <Text variant="bodyMedium">{bodyAnalysis.bodyProportions.legs}</Text>
                      </View>
                    )}
                  </View>
                </Card.Content>
              </Card>
            )}
            
            {/* Update Body Analysis Button */}
            <Button 
              mode="contained" 
              icon="camera"
              onPress={() => router.push('/(onboarding)/body-analysis?returnToProgress=true')}
              style={styles.updateButton}
            >
              Update Body Analysis
            </Button>
            
            <Text variant="bodySmall" style={styles.disclaimer}>
              Disclaimer: All measurements and analyses are approximate and based on AI-assisted processing of provided images. 
              These should not be considered medical advice. Consult with a healthcare professional for medical guidance.
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    elevation: 2,
  },
  backButton: {
    marginRight: 8,
  },
  title: {
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
    marginRight: 40, // To center the title accounting for back button
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    marginVertical: 8,
    elevation: 2,
  },
  measurementsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  measurementItem: {
    width: '48%',
    marginVertical: 8,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
  },
  measurementLabel: {
    opacity: 0.7,
    marginBottom: 4,
  },
  measurementValue: {
    fontWeight: 'bold',
  },
  postureSection: {
    marginVertical: 12,
  },
  sectionLabel: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  postureText: {
    lineHeight: 22,
  },
  issuesList: {
    marginLeft: 16,
  },
  issueItem: {
    marginVertical: 4,
    lineHeight: 22,
  },
  recommendationsList: {
    marginLeft: 16,
  },
  recommendationItem: {
    marginVertical: 4,
    lineHeight: 22,
  },
  proportionsContainer: {
    marginVertical: 8,
  },
  proportionItem: {
    marginVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 8,
  },
  proportionLabel: {
    fontWeight: 'bold',
  },
  updateButton: {
    marginVertical: 16,
  },
  disclaimer: {
    fontStyle: 'italic',
    opacity: 0.7,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
}); 