import React from 'react';
import { View, StyleSheet } from 'react-native';
import TestWorkoutGenerator from '../components/TestWorkoutGenerator';

/**
 * Test page for the workout plan generator
 * 
 * This page allows testing the StructuredWorkoutGenerator with the 
 * correct API key configuration.
 */
export default function TestWorkoutPage() {
  return (
    <View style={styles.container}>
      <TestWorkoutGenerator />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#ffffff',
  },
});
