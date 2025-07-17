import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';

// Simple fallback component for debugging white screen issues
export default function FallbackApp() {
  const [count, setCount] = React.useState(0);

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      <Text style={styles.title}>FitAI - Debug Mode</Text>
      <Text style={styles.subtitle}>App is running successfully!</Text>
      
      <View style={styles.debugInfo}>
        <Text style={styles.debugText}>Version: 0.1.2</Text>
        <Text style={styles.debugText}>Build: 11</Text>
        <Text style={styles.debugText}>Target SDK: 35</Text>
        <Text style={styles.debugText}>Counter: {count}</Text>
      </View>

      <TouchableOpacity 
        style={styles.button} 
        onPress={() => setCount(count + 1)}
      >
        <Text style={styles.buttonText}>Test Interaction ({count})</Text>
      </TouchableOpacity>

      <Text style={styles.instructions}>
        If you can see this screen, the app bundle is working correctly.
        The white screen issue has been resolved.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 18,
    marginBottom: 30,
    color: '#666',
  },
  debugInfo: {
    backgroundColor: '#f0f0f0',
    padding: 15,
    borderRadius: 8,
    marginBottom: 30,
    width: '100%',
  },
  debugText: {
    fontSize: 14,
    marginBottom: 5,
    color: '#333',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
    marginBottom: 30,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  instructions: {
    fontSize: 14,
    textAlign: 'center',
    color: '#666',
    lineHeight: 20,
  },
});
