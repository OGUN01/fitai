import React from 'react';
import { View, StyleSheet, StatusBar, SafeAreaView } from 'react-native';
import { Stack } from 'expo-router';
import DiagnosticPanel from '../components/diagnostic/DiagnosticPanel';

/**
 * Diagnostic screen for testing data persistence and synchronization
 */
export default function DiagnosticsScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <Stack.Screen
        options={{
          title: 'System Diagnostics',
          headerTitleStyle: { fontWeight: 'bold' },
          headerShadowVisible: false,
        }}
      />
      
      <View style={styles.content}>
        <DiagnosticPanel />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
  },
});
