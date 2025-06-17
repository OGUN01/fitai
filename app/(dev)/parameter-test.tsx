/**
 * Parameter Validation Test Screen
 * 
 * This screen helps test and verify that ALL onboarding parameters
 * are being properly passed to AI generation systems.
 */

import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, Card, Button, useTheme, Divider } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useProfile } from '../../contexts/ProfileContext';
import { logParameterValidation, validateWorkoutParameters, validateMealParameters } from '../../utils/parameterValidation';
import StyledText from '../../components/ui/StyledText';

export default function ParameterTestScreen() {
  const theme = useTheme();
  const { profile } = useProfile();
  
  const [validationResults, setValidationResults] = React.useState<any>(null);

  const runValidation = () => {
    console.log('🔍 Running parameter validation test...');
    const results = logParameterValidation(profile);
    setValidationResults(results);
  };

  const renderParameterCheck = (parameterName: string, hasValue: boolean, value: any) => (
    <View key={parameterName} style={styles.parameterRow}>
      <Text style={[styles.parameterName, { color: theme.colors.onSurface }]}>
        {parameterName}
      </Text>
      <View style={styles.parameterStatus}>
        <Text style={[
          styles.statusText,
          { color: hasValue ? theme.colors.primary : theme.colors.error }
        ]}>
          {hasValue ? '✅' : '❌'}
        </Text>
        <Text style={[styles.valueText, { color: theme.colors.onSurfaceVariant }]}>
          {hasValue ? (typeof value === 'object' ? JSON.stringify(value) : String(value)) : 'Missing'}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView style={styles.scrollView}>
        <StyledText variant="headlineMedium" style={styles.title}>
          Parameter Validation Test
        </StyledText>
        
        <StyledText variant="bodyMedium" style={[styles.description, { color: theme.colors.onSurfaceVariant }]}>
          This screen validates that ALL onboarding parameters are being properly passed to AI generation systems.
        </StyledText>

        <Button 
          mode="contained" 
          onPress={runValidation}
          style={styles.testButton}
        >
          Run Parameter Validation Test
        </Button>

        {validationResults && (
          <>
            <Card style={styles.resultCard}>
              <Card.Title title="Workout Parameters" />
              <Card.Content>
                <StyledText variant="bodyMedium" style={[
                  styles.validationSummary,
                  { color: validationResults.workout.isValid ? theme.colors.primary : theme.colors.error }
                ]}>
                  {validationResults.workout.isValid ? '✅ All parameters present' : `❌ ${validationResults.workout.missingParameters.length} parameters missing`}
                </StyledText>
                
                {!validationResults.workout.isValid && (
                  <StyledText variant="bodySmall" style={[styles.missingParams, { color: theme.colors.error }]}>
                    Missing: {validationResults.workout.missingParameters.join(', ')}
                  </StyledText>
                )}

                <Divider style={styles.divider} />
                
                {Object.entries(validationResults.workout.parameterCheck).map(([param, hasValue]) =>
                  renderParameterCheck(param, hasValue as boolean, profile?.[param as keyof typeof profile])
                )}
              </Card.Content>
            </Card>

            <Card style={styles.resultCard}>
              <Card.Title title="Meal Parameters" />
              <Card.Content>
                <StyledText variant="bodyMedium" style={[
                  styles.validationSummary,
                  { color: validationResults.meal.isValid ? theme.colors.primary : theme.colors.error }
                ]}>
                  {validationResults.meal.isValid ? '✅ All parameters present' : `❌ ${validationResults.meal.missingParameters.length} parameters missing`}
                </StyledText>
                
                {!validationResults.meal.isValid && (
                  <StyledText variant="bodySmall" style={[styles.missingParams, { color: theme.colors.error }]}>
                    Missing: {validationResults.meal.missingParameters.join(', ')}
                  </StyledText>
                )}

                <Divider style={styles.divider} />
                
                {Object.entries(validationResults.meal.parameterCheck).map(([param, hasValue]) =>
                  renderParameterCheck(param, hasValue as boolean, profile?.[param as keyof typeof profile])
                )}
              </Card.Content>
            </Card>

            <Card style={styles.resultCard}>
              <Card.Title title="Overall Summary" />
              <Card.Content>
                <StyledText variant="bodyMedium">
                  Workout Parameters: {Object.values(validationResults.workout.parameterCheck).filter(Boolean).length}/{Object.keys(validationResults.workout.parameterCheck).length} present
                </StyledText>
                <StyledText variant="bodyMedium">
                  Meal Parameters: {Object.values(validationResults.meal.parameterCheck).filter(Boolean).length}/{Object.keys(validationResults.meal.parameterCheck).length} present
                </StyledText>
              </Card.Content>
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  title: {
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    textAlign: 'center',
    marginBottom: 24,
  },
  testButton: {
    marginBottom: 24,
  },
  resultCard: {
    marginBottom: 16,
  },
  validationSummary: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  missingParams: {
    marginBottom: 16,
  },
  divider: {
    marginVertical: 8,
  },
  parameterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  parameterName: {
    flex: 1,
    fontSize: 14,
  },
  parameterStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusText: {
    marginRight: 8,
    fontSize: 16,
  },
  valueText: {
    fontSize: 12,
    flex: 1,
  },
});
