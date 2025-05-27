import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle, TextStyle } from 'react-native';
import StyledText from './ui/StyledText';
import { colors } from '../theme/theme';

interface ProgressBarProps {
  step: number;
  totalSteps: number;
  label?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ step, totalSteps, label = true }) => {
  const progress = Math.min(Math.max(step / totalSteps, 0), 1);
  
  return (
    <View style={styles.container}>
      <View style={styles.progressContainer}>
        <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
      </View>
      {label && (
        <StyledText style={styles.progressText}>
          Step {step} of {totalSteps}
        </StyledText>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: 10,
  } as ViewStyle,
  progressContainer: {
    height: 8,
    backgroundColor: colors.background.secondary,
    borderRadius: 4,
    overflow: 'hidden',
  } as ViewStyle,
  progressBar: {
    height: '100%',
    backgroundColor: colors.primary.main,
    borderRadius: 4,
  } as ViewStyle,
  progressText: {
    marginTop: 5,
    fontSize: 12,
    textAlign: 'right',
    color: colors.text.secondary,
  } as TextStyle,
});
