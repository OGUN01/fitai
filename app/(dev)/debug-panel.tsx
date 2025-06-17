import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Button, Card, Title, Text, Divider, useTheme, ActivityIndicator, Checkbox } from 'react-native-paper';
import { useProfile } from '../../contexts/ProfileContext';
import { useAuth } from '../../contexts/AuthContext';
import { migrateProfileData, validateProfileConsistency, fixWorkoutPreferences } from '../../utils/profileMigration';
import { synchronizeProfileData } from '../../utils/profileSynchronizer';
import { runDatabaseSyncTest, SyncTestResult } from '../../utils/databaseSyncTest';
import { runSimpleDatabaseTest, SimpleDatabaseTestResult, getDatabaseStats, testAuthStatus } from '../../utils/simpleDatabaseTest';
import { runDatabaseOptimization, analyzeDatabasePerformance, optimizeDatabaseIndexes, testQueryPerformance } from '../../utils/databaseOptimizer';
import { enhancedSignOut, checkAuthStatus, sendEmailVerification } from '../../utils/authEnhancements';
import { getSyncStatusForUI, forceSyncNow, OfflineManager } from '../../utils/offlineEnhancements';
import { migrateProfile } from '../../utils/profileMigration';
import { pydanticWorkoutGenerator } from '../../services/ai';
import { UserFitnessPreferences, WorkoutPlan } from '../../services/ai/workoutGenerator';
import { StructuredWorkoutGenerator } from '../../services/ai/structuredWorkoutGenerator';
import { PydanticWorkoutGenerator } from '../../services/ai/pydanticWorkoutGenerator';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Debug Panel Component
 * Provides developer tools for debugging and fixing profile data issues
 */
export default function DebugPanel() {
  const theme = useTheme();
  const { user } = useAuth();
  const { profile, refreshProfile } = useProfile();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<{
    isConsistent: boolean;
    discrepancies: string[];
  } | null>(null);
  const [syncTestResult, setSyncTestResult] = useState<SyncTestResult | null>(null);
  const [syncTestLoading, setSyncTestLoading] = useState(false);
  const [simpleTestResult, setSimpleTestResult] = useState<SimpleDatabaseTestResult | null>(null);
  const [optimizationResult, setOptimizationResult] = useState<any>(null);
  const [optimizationLoading, setOptimizationLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [simpleTestLoading, setSimpleTestLoading] = useState(false);
  const [authTestResult, setAuthTestResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  // States for workout generation testing
  const [workoutPlans, setWorkoutPlans] = useState<{
    pydanticPrimary: any | null;
    pydanticBackup: any | null;
    structured: any | null;
  }>({
    pydanticPrimary: null,
    pydanticBackup: null,
    structured: null
  });
  const [generationLoading, setGenerationLoading] = useState({
    pydanticPrimary: false,
    pydanticBackup: false,
    structured: false
  });

  // Add this state variable inside the DebugPanel component
  const [skipApiCalls, setSkipApiCalls] = useState<boolean>(() => {
    // Initialize from localStorage if available
    return localStorage.getItem('skipApiCalls') === 'true';
  });

  // Add a handler to toggle API calls
  const handleToggleApiCalls = (checked: boolean) => {
    setSkipApiCalls(checked);
    localStorage.setItem('skipApiCalls', checked ? 'true' : 'false');
  };

  // Add error boundary effect
  useEffect(() => {
    // This helps catch uncaught errors in the component
    const errorHandler = (error: ErrorEvent) => {
      console.error("Debug panel caught error:", error);
      setError(`Uncaught error: ${error.message}`);
      return true; // Prevent default handling
    };

    // Add global error handler
    window.addEventListener('error', errorHandler);
    
    return () => {
      window.removeEventListener('error', errorHandler);
    };
  }, []);

  // Safe render for profile data
  const safeRenderProfileData = () => {
    try {
      return JSON.stringify(profile, null, 2);
    } catch (err) {
      return `Error rendering profile data: ${err instanceof Error ? err.message : 'Unknown error'}`;
    }
  };

  // Safely refresh profile
  const handleRefreshProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      await refreshProfile(true);
    } catch (err) {
      console.error("Error refreshing profile:", err);
      setError(`Error refreshing profile: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // Fix profile data
  const handleFixProfileData = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to use this feature');
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const migrationResult = await migrateProfileData(user.id);
      setResult(migrationResult.message || 'Profile data fixed successfully');
      
      if (migrationResult.success) {
        // Refresh profile after successful migration
        await refreshProfile();
        Alert.alert('Success', 'Profile data has been fixed');
      } else {
        Alert.alert('Error', migrationResult.message || 'Failed to fix profile data');
      }
    } catch (error) {
      console.error('Error fixing profile data:', error);
      setResult(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      Alert.alert('Error', 'An error occurred while fixing profile data');
    } finally {
      setLoading(false);
    }
  };

  // Validate profile data consistency
  const handleValidateProfileData = () => {
    if (!profile) {
      Alert.alert('Error', 'No profile data available');
      return;
    }

    const result = validateProfileConsistency(profile);
    setValidationResult(result);

    if (result.isConsistent) {
      Alert.alert('Validation Result', 'Profile data is consistent');
    } else {
      Alert.alert('Validation Result', `Found ${result.discrepancies.length} inconsistencies`);
    }
  };

  // Test database synchronization
  const handleTestDatabaseSync = async () => {
    setSyncTestLoading(true);
    setSyncTestResult(null);
    setError(null);

    try {
      console.log('🧪 Starting comprehensive database synchronization test...');
      const result = await runDatabaseSyncTest();
      setSyncTestResult(result);

      if (result.success) {
        Alert.alert(
          'Database Sync Test - SUCCESS ✅',
          'All synchronization tests passed! Your database is properly configured and working.'
        );
      } else {
        Alert.alert(
          'Database Sync Test - ISSUES FOUND ⚠️',
          `Found ${result.errors.length} issues. Check the detailed results below.`
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(`Database sync test failed: ${errorMessage}`);
      Alert.alert('Test Error', `Failed to run database sync test: ${errorMessage}`);
    } finally {
      setSyncTestLoading(false);
    }
  };

  // Test simple database connectivity
  const handleTestSimpleDatabase = async () => {
    setSimpleTestLoading(true);
    setSimpleTestResult(null);
    setError(null);

    try {
      console.log('🔍 Starting simple database connectivity test...');
      const result = await runSimpleDatabaseTest();
      setSimpleTestResult(result);

      if (result.success) {
        Alert.alert(
          'Database Test - SUCCESS ✅',
          'Database is connected and properly configured!'
        );
      } else {
        Alert.alert(
          'Database Test - ISSUES FOUND ⚠️',
          `Found ${result.errors.length} issues. Check the detailed results below.`
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(`Simple database test failed: ${errorMessage}`);
      Alert.alert('Test Error', `Failed to run database test: ${errorMessage}`);
    } finally {
      setSimpleTestLoading(false);
    }
  };

  // Test authentication status
  const handleTestAuth = async () => {
    setAuthTestResult(null);
    setError(null);

    try {
      console.log('🔑 Testing authentication status...');
      const result = await testAuthStatus();
      setAuthTestResult(result);

      if (result.success && result.isAuthenticated) {
        Alert.alert(
          'Authentication Test - SUCCESS ✅',
          `Authenticated as: ${result.userEmail}\nUser ID: ${result.userId}`
        );
      } else if (result.success && !result.isAuthenticated) {
        Alert.alert(
          'Authentication Test - NOT LOGGED IN ⚠️',
          'You are not currently authenticated. Please log in first.'
        );
      } else {
        Alert.alert(
          'Authentication Test - ERROR ❌',
          `Auth test failed: ${result.error}`
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(`Auth test failed: ${errorMessage}`);
      Alert.alert('Test Error', `Failed to test authentication: ${errorMessage}`);
    }
  };

  // Fix profile data inconsistencies
  const handleFixProfile = async () => {
    setError(null);

    try {
      console.log('🔧 Fixing profile data inconsistencies...');

      if (!profile) {
        Alert.alert('Error', 'No profile found. Please complete onboarding first.');
        return;
      }

      const migrationResult = await migrateProfile(profile);

      if (migrationResult.success) {
        Alert.alert(
          'Profile Fixed ✅',
          'Profile data inconsistencies have been resolved. Please refresh the validation.'
        );

        // Refresh the profile
        if (refreshProfile) {
          await refreshProfile();
        }
      } else {
        Alert.alert(
          'Fix Failed ❌',
          `Failed to fix profile: ${migrationResult.message}`
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(`Profile fix failed: ${errorMessage}`);
      Alert.alert('Error', `Failed to fix profile: ${errorMessage}`);
    }
  };

  // Fix workout preferences specifically
  const handleFixWorkoutPreferences = async () => {
    setError(null);

    try {
      console.log('🏋️ Fixing workout preferences specifically...');

      if (!profile) {
        Alert.alert('Error', 'No profile found. Please complete onboarding first.');
        return;
      }

      const fixResult = await fixWorkoutPreferences(profile);

      if (fixResult.success) {
        Alert.alert(
          'Workout Preferences Fixed ✅',
          'Workout preferences inconsistencies have been resolved. Please refresh the validation.'
        );

        // Refresh the profile
        if (refreshProfile) {
          await refreshProfile();
        }
      } else {
        Alert.alert(
          'Fix Failed ❌',
          `Failed to fix workout preferences: ${fixResult.message}`
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(`Workout preferences fix failed: ${errorMessage}`);
      Alert.alert('Error', `Failed to fix workout preferences: ${errorMessage}`);
    }
  };

  // Run database optimization
  const handleDatabaseOptimization = async () => {
    setOptimizationLoading(true);
    setOptimizationResult(null);
    setError(null);

    try {
      console.log('🔧 Running database optimization...');
      const result = await runDatabaseOptimization();
      setOptimizationResult(result);

      if (result.success) {
        Alert.alert(
          'Database Optimization Complete ✅',
          'Database analysis completed. Check the results below for recommendations.'
        );
      } else {
        Alert.alert(
          'Optimization Failed ❌',
          `Database optimization failed: ${result.error}`
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(`Database optimization failed: ${errorMessage}`);
      Alert.alert('Error', `Failed to run database optimization: ${errorMessage}`);
    } finally {
      setOptimizationLoading(false);
    }
  };

  // Check sync status
  const handleCheckSyncStatus = async () => {
    try {
      console.log('📊 Checking sync status...');
      const status = await getSyncStatusForUI();
      setSyncStatus(status);

      Alert.alert(
        'Sync Status',
        `Online: ${status.isOnline ? 'Yes' : 'No'}\nPending Items: ${status.pendingSyncItems}\nConflicts: ${status.conflictsDetected}`
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(`Failed to check sync status: ${errorMessage}`);
    }
  };

  // Force sync now
  const handleForceSync = async () => {
    try {
      console.log('🔄 Forcing sync...');
      await forceSyncNow();
      Alert.alert('Sync Complete ✅', 'Forced sync completed successfully.');

      // Refresh sync status
      await handleCheckSyncStatus();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(`Force sync failed: ${errorMessage}`);
      Alert.alert('Error', `Failed to force sync: ${errorMessage}`);
    }
  };

  // Clear streak data
  const handleClearStreakData = async () => {
    Alert.alert(
      'Clear Streak Data',
      'This will reset your streak to 0 and clear all activity history. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('streak_data');
              Alert.alert('Success ✅', 'Streak data cleared successfully. Restart the app to see changes.');
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              Alert.alert('Error', `Failed to clear streak data: ${errorMessage}`);
            }
          }
        }
      ]
    );
  };

  // Convert profile data to user fitness preferences for workout generation
  const getUserFitnessPreferences = (): UserFitnessPreferences => {
    // Get exercises to avoid, ensuring it's a string
    const exercisesToAvoid = profile?.workout_preferences?.exercises_to_avoid || '';
    const exercisesToAvoidStr = typeof exercisesToAvoid === 'string' 
      ? exercisesToAvoid 
      : Array.isArray(exercisesToAvoid) ? exercisesToAvoid.join(', ') : '';
    
    return {
      fitnessLevel: (profile?.workout_preferences?.fitness_level || 'beginner') as 'beginner' | 'intermediate' | 'advanced',
      workoutLocation: (profile?.workout_preferences?.workout_location || 'home') as 'home' | 'gym' | 'outdoors' | 'anywhere',
      availableEquipment: profile?.workout_preferences?.equipment || [],
      exerciseFrequency: profile?.workout_days_per_week || 3,
      timePerSession: profile?.workout_preferences?.workout_duration || 30,
      focusAreas: profile?.fitness_goals || ['full-body'],
      exercisesToAvoid: exercisesToAvoidStr
    };
  };

  // Test Pydantic Primary Generation (function calling only)
  const testPydanticPrimaryGenerator = async () => {
    if (!profile) {
      Alert.alert('Error', 'No profile data available');
      return;
    }

    setGenerationLoading({...generationLoading, pydanticPrimary: true});
    try {
      const preferences = getUserFitnessPreferences();
      
      console.log("📋 [DEBUG] Starting Pydantic Primary generation test (function calling only)");
      
      // Create an instance to access the primary generation method
      const generator = new PydanticWorkoutGenerator();
      
      // Access the private method via dynamic property access
      // Note: this is for testing purposes only
      const primaryGenerationMethod = (generator as any).primaryGeneration.bind(generator);
      if (!primaryGenerationMethod) {
        throw new Error("Could not access primary generation method");
      }
      
      const workoutPlan = await primaryGenerationMethod(preferences);
      
      setWorkoutPlans({...workoutPlans, pydanticPrimary: workoutPlan});
      Alert.alert('Success', 'Pydantic primary generation worked successfully');
    } catch (error) {
      console.error('Error in pydantic primary generation:', error);
      
      // Check for rate limit errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isRateLimit = errorMessage.includes('429') || 
                          errorMessage.includes('Resource has been exhausted') || 
                          errorMessage.includes('Too Many Requests');
      
      if (isRateLimit) {
        Alert.alert(
          'API Rate Limit Error',
          'Hit Google API rate limits. Please wait a few minutes before trying again.'
        );
      } else {
        Alert.alert('Primary Generation Error', `Failed: ${errorMessage}`);
      }
    } finally {
      setGenerationLoading({...generationLoading, pydanticPrimary: false});
    }
  };

  // Test Pydantic Backup Generation
  const testPydanticBackupGenerator = async () => {
    if (!profile) {
      Alert.alert('Error', 'No profile data available');
      return;
    }

    setGenerationLoading({...generationLoading, pydanticBackup: true});
    try {
      const preferences = getUserFitnessPreferences();
      
      console.log("📋 [DEBUG] Starting Pydantic Backup generation test (simplified approach)");
      
      // Create an instance to access the backup generation method
      const generator = new PydanticWorkoutGenerator();
      
      // Access the private method via dynamic property access
      const backupGenerationMethod = (generator as any).backupGeneration.bind(generator);
      if (!backupGenerationMethod) {
        throw new Error("Could not access backup generation method");
      }
      
      const workoutPlan = await backupGenerationMethod(preferences);
      
      setWorkoutPlans({...workoutPlans, pydanticBackup: workoutPlan});
      Alert.alert('Success', 'Pydantic backup generation worked successfully');
    } catch (error) {
      console.error('Error in pydantic backup generation:', error);
      
      // Check for rate limit errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isRateLimit = errorMessage.includes('429') || 
                          errorMessage.includes('Resource has been exhausted') || 
                          errorMessage.includes('Too Many Requests');
      
      if (isRateLimit) {
        Alert.alert(
          'API Rate Limit Error',
          'Hit Google API rate limits. Please wait a few minutes before trying again.'
        );
      } else {
        Alert.alert('Backup Generation Error', `Failed: ${errorMessage}`);
      }
    } finally {
      setGenerationLoading({...generationLoading, pydanticBackup: false});
    }
  };

  // Update the testPydanticGenerator to test the full flow
  const testPydanticGenerator = async () => {
    if (!profile) {
      Alert.alert('Error', 'No profile data available');
      return;
    }

    setGenerationLoading({...generationLoading, pydanticPrimary: true});
    try {
      const preferences = getUserFitnessPreferences();
      
      // Display a message about potential API limits
      console.log("📋 [DEBUG] Starting Pydantic workout generator test (complete flow with fallbacks)");
      
      const workoutPlan = await pydanticWorkoutGenerator.generateWorkoutPlan(preferences);
      
      setWorkoutPlans({...workoutPlans, pydanticPrimary: workoutPlan});
      Alert.alert('Success', 'Pydantic workout plan generated successfully');
    } catch (error) {
      console.error('Error generating pydantic workout plan:', error);
      
      // More informative error message for API limits
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isRateLimit = errorMessage.includes('429') || 
                          errorMessage.includes('Resource has been exhausted') || 
                          errorMessage.includes('Too Many Requests');
      
      if (isRateLimit) {
        Alert.alert(
          'API Rate Limit Error',
          'Hit Google API rate limits. Please wait a few minutes before trying again.'
        );
      } else {
        Alert.alert('Error', `Failed to generate workout plan: ${errorMessage}`);
      }
    } finally {
      setGenerationLoading({...generationLoading, pydanticPrimary: false});
    }
  };

  // Test Structured workout generator
  const testStructuredGenerator = async () => {
    if (!profile) {
      Alert.alert('Error', 'No profile data available');
      return;
    }

    setGenerationLoading({...generationLoading, structured: true});
    try {
      const preferences = getUserFitnessPreferences();
      const generator = new StructuredWorkoutGenerator();
      const workoutPlan = await generator.generateWorkoutPlanWithFallback(preferences);
      
      setWorkoutPlans({...workoutPlans, structured: workoutPlan});
      Alert.alert('Success', 'Structured workout plan generated successfully');
    } catch (error) {
      console.error('Error generating structured workout plan:', error);
      Alert.alert('Error', `Failed to generate workout plan: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setGenerationLoading({...generationLoading, structured: false});
    }
  };

  // Add a function to test fallback plan directly
  const testFallbackGenerator = async () => {
    if (!profile) {
      Alert.alert('Error', 'No profile data available');
      return;
    }

    setGenerationLoading({...generationLoading, pydanticPrimary: true});
    try {
      const preferences = getUserFitnessPreferences();
      
      // Get the fallback plan directly
      console.log("📋 [DEBUG] Using fallback plan directly (no API calls)");
      const workoutPlan = pydanticWorkoutGenerator.createFallbackPlan(preferences);
      
      setWorkoutPlans({...workoutPlans, pydanticPrimary: workoutPlan});
      Alert.alert('Success', 'Fallback workout plan generated successfully');
    } catch (error) {
      console.error('Error generating fallback workout plan:', error);
      Alert.alert('Error', `Failed to generate fallback plan: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setGenerationLoading({...generationLoading, pydanticPrimary: false});
    }
  };

  // Format for display
  const formatWorkoutPlan = (plan: any) => {
    try {
      return JSON.stringify(plan, null, 2);
    } catch (err) {
      return `Error rendering workout plan: ${err instanceof Error ? err.message : 'Unknown error'}`;
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Title>Profile Data Utilities</Title>
          <Text>Tools to fix profile data inconsistencies</Text>
          
          <View style={styles.buttonContainer}>
            <Button 
              mode="contained" 
              onPress={handleFixProfileData}
              loading={loading}
              disabled={loading}
              style={styles.button}
            >
              Fix Profile Data
            </Button>

            <Button
              mode="outlined"
              onPress={handleValidateProfileData}
              disabled={loading || !profile}
              style={styles.button}
            >
              Validate Profile Data
            </Button>

            <Button
              mode="contained"
              onPress={handleFixProfile}
              disabled={!profile}
              style={[styles.button, { backgroundColor: '#9C27B0' }]}
            >
              Fix Profile Data Issues
            </Button>

            <Button
              mode="contained"
              onPress={handleFixWorkoutPreferences}
              disabled={!profile}
              style={[styles.button, { backgroundColor: '#FF5722' }]}
            >
              Fix Workout Preferences Only
            </Button>

            <Button
              mode="contained"
              onPress={handleTestAuth}
              style={[styles.button, { backgroundColor: '#FF9800' }]}
            >
              Check Authentication Status
            </Button>

            <Button
              mode="contained"
              onPress={handleTestSimpleDatabase}
              loading={simpleTestLoading}
              disabled={simpleTestLoading}
              style={[styles.button, { backgroundColor: '#4CAF50' }]}
            >
              Test Database Connection
            </Button>

            <Button
              mode="contained"
              onPress={handleTestDatabaseSync}
              loading={syncTestLoading}
              disabled={syncTestLoading}
              style={[styles.button, { backgroundColor: '#2196F3' }]}
            >
              Test Full Database Sync
            </Button>

            <Button
              mode="contained"
              onPress={handleDatabaseOptimization}
              loading={optimizationLoading}
              disabled={optimizationLoading}
              style={[styles.button, { backgroundColor: '#9932CC' }]}
            >
              {optimizationLoading ? 'Analyzing...' : 'Database Optimization'}
            </Button>

            <Button
              mode="outlined"
              onPress={handleCheckSyncStatus}
              style={[styles.button, { borderColor: '#FF6B35' }]}
            >
              Check Sync Status
            </Button>

            <Button
              mode="contained"
              onPress={handleForceSync}
              style={[styles.button, { backgroundColor: '#FF6B35' }]}
            >
              Force Sync Now
            </Button>

            <Button
              mode="outlined"
              onPress={handleClearStreakData}
              style={[styles.button, { borderColor: '#f44336', marginTop: 8 }]}
            >
              🔥 Clear Streak Data
            </Button>

          </View>

          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={styles.loadingText}>Processing...</Text>
            </View>
          )}

          {result && (
            <View style={styles.resultContainer}>
              <Text style={styles.resultTitle}>Result:</Text>
              <Text style={styles.resultText}>{result}</Text>
            </View>
          )}

          {validationResult && (
            <View style={styles.validationContainer}>
              <Text style={styles.resultTitle}>Validation Result:</Text>
              <Text style={[
                styles.validationStatus, 
                { color: validationResult.isConsistent ? 'green' : 'red' }
              ]}>
                {validationResult.isConsistent ? 'Consistent ✓' : 'Inconsistent ✗'}
              </Text>

              {validationResult.discrepancies.length > 0 && (
                <>
                  <Text style={styles.discrepanciesTitle}>Discrepancies Found:</Text>
                  {validationResult.discrepancies.map((item, index) => (
                    <Text key={index} style={styles.discrepancyItem}>• {item}</Text>
                  ))}
                </>
              )}
            </View>
          )}

          {authTestResult && (
            <View style={styles.validationContainer}>
              <Text style={styles.resultTitle}>Authentication Status:</Text>
              <Text style={[
                styles.validationStatus,
                { color: authTestResult.isAuthenticated ? 'green' : 'orange' }
              ]}>
                {authTestResult.isAuthenticated ? 'Authenticated ✅' : 'Not Authenticated ⚠️'}
              </Text>

              {authTestResult.isAuthenticated && (
                <>
                  <Text style={styles.discrepanciesTitle}>User Details:</Text>
                  <Text style={styles.discrepancyItem}>
                    📧 Email: {authTestResult.userEmail || 'N/A'}
                  </Text>
                  <Text style={styles.discrepancyItem}>
                    🆔 User ID: {authTestResult.userId || 'N/A'}
                  </Text>
                </>
              )}

              {authTestResult.error && (
                <>
                  <Text style={styles.discrepanciesTitle}>Error:</Text>
                  <Text style={[styles.discrepancyItem, {color: 'red'}]}>• {authTestResult.error}</Text>
                </>
              )}
            </View>
          )}

          {simpleTestResult && (
            <View style={styles.validationContainer}>
              <Text style={styles.resultTitle}>Database Connection Test Results:</Text>
              <Text style={[
                styles.validationStatus,
                { color: simpleTestResult.success ? 'green' : 'red' }
              ]}>
                {simpleTestResult.success ? 'All Tests Passed ✅' : 'Issues Found ⚠️'}
              </Text>

              <Text style={styles.discrepanciesTitle}>Test Results:</Text>
              <Text style={styles.discrepancyItem}>
                📡 Database Connection: {simpleTestResult.tests.connection ? '✅' : '❌'}
              </Text>
              <Text style={styles.discrepancyItem}>
                📋 Required Tables: {simpleTestResult.tests.tablesExist ? '✅' : '❌'}
              </Text>
              <Text style={styles.discrepancyItem}>
                🔒 Row Level Security: {simpleTestResult.tests.rlsEnabled ? '✅' : '❌'}
              </Text>
              <Text style={styles.discrepancyItem}>
                🔍 Basic Queries: {simpleTestResult.tests.basicQueries ? '✅' : '❌'}
              </Text>

              {simpleTestResult.errors.length > 0 && (
                <>
                  <Text style={styles.discrepanciesTitle}>Errors Found:</Text>
                  {simpleTestResult.errors.map((error, index) => (
                    <Text key={index} style={[styles.discrepancyItem, {color: 'red'}]}>• {error}</Text>
                  ))}
                </>
              )}
            </View>
          )}

          {syncTestResult && (
            <View style={styles.validationContainer}>
              <Text style={styles.resultTitle}>Database Sync Test Results:</Text>
              <Text style={[
                styles.validationStatus,
                { color: syncTestResult.success ? 'green' : 'red' }
              ]}>
                {syncTestResult.success ? 'All Tests Passed ✅' : 'Issues Found ⚠️'}
              </Text>

              <Text style={styles.discrepanciesTitle}>Test Results:</Text>
              <Text style={styles.discrepancyItem}>
                📡 Database Connection: {syncTestResult.tests.databaseConnection ? '✅' : '❌'}
              </Text>
              <Text style={styles.discrepancyItem}>
                👤 Profile Sync: {syncTestResult.tests.profileSync ? '✅' : '❌'}
              </Text>
              <Text style={styles.discrepancyItem}>
                💪 Workout Sync: {syncTestResult.tests.workoutSync ? '✅' : '❌'}
              </Text>
              <Text style={styles.discrepancyItem}>
                🍽️ Meal Sync: {syncTestResult.tests.mealSync ? '✅' : '❌'}
              </Text>
              <Text style={styles.discrepancyItem}>
                🔒 RLS Policies: {syncTestResult.tests.rlsPolicies ? '✅' : '❌'}
              </Text>

              {syncTestResult.errors.length > 0 && (
                <>
                  <Text style={styles.discrepanciesTitle}>Errors Found:</Text>
                  {syncTestResult.errors.map((error, index) => (
                    <Text key={index} style={[styles.discrepancyItem, {color: 'red'}]}>• {error}</Text>
                  ))}
                </>
              )}
            </View>
          )}

          {optimizationResult && (
            <View style={styles.validationContainer}>
              <Text style={styles.resultTitle}>Database Optimization Results:</Text>
              <Text style={[
                styles.validationStatus,
                { color: optimizationResult.success ? 'green' : 'red' }
              ]}>
                {optimizationResult.success ? 'Analysis Complete ✅' : 'Analysis Failed ❌'}
              </Text>

              {optimizationResult.success && optimizationResult.results.performance && (
                <>
                  <Text style={styles.discrepanciesTitle}>📊 Performance Analysis:</Text>
                  {Object.entries(optimizationResult.results.performance.tableStats).map(([table, stats]: [string, any]) => (
                    <Text key={table} style={styles.discrepancyItem}>
                      {table}: {stats.rowCount} rows
                    </Text>
                  ))}

                  <Text style={styles.discrepanciesTitle}>💡 Recommendations:</Text>
                  {optimizationResult.results.performance.recommendations.map((rec: string, index: number) => (
                    <Text key={index} style={[styles.discrepancyItem, { fontSize: 12 }]}>
                      • {rec}
                    </Text>
                  ))}
                </>
              )}

              {optimizationResult.success && optimizationResult.results.queryPerformance && (
                <>
                  <Text style={styles.discrepanciesTitle}>⚡ Query Performance:</Text>
                  <Text style={styles.discrepancyItem}>
                    Average response time: {optimizationResult.results.queryPerformance.details?.avgTime?.toFixed(2)}ms
                  </Text>
                </>
              )}

              {!optimizationResult.success && (
                <Text style={[styles.discrepancyItem, {color: 'red'}]}>
                  Error: {optimizationResult.error}
                </Text>
              )}
            </View>
          )}

          {syncStatus && (
            <View style={styles.validationContainer}>
              <Text style={styles.resultTitle}>Sync Status:</Text>
              <Text style={styles.discrepancyItem}>
                🌐 Online: {syncStatus.isOnline ? '✅ Yes' : '❌ No'}
              </Text>
              <Text style={styles.discrepancyItem}>
                📋 Pending Items: {syncStatus.pendingSyncItems}
              </Text>
              <Text style={styles.discrepancyItem}>
                ⚠️ Conflicts: {syncStatus.conflictsDetected}
              </Text>
              <Text style={styles.discrepancyItem}>
                🔄 Sync in Progress: {syncStatus.syncInProgress ? 'Yes' : 'No'}
              </Text>
              {syncStatus.lastSyncTime && (
                <Text style={styles.discrepancyItem}>
                  🕒 Last Sync: {new Date(syncStatus.lastSyncTime).toLocaleString()}
                </Text>
              )}
            </View>
          )}

          {error && (
            <View style={styles.resultContainer}>
              <Text style={[styles.resultText, {color: 'red'}]}>{error}</Text>
            </View>
          )}
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Title>Profile Data Inspector</Title>
          <Text>Current profile data in memory</Text>
          
          <Divider style={styles.divider} />
          
          <ScrollView style={styles.jsonContainer}>
            <Text selectable={true}>
              {safeRenderProfileData()}
            </Text>
          </ScrollView>
        </Card.Content>
      </Card>

      {/* Add a new card specifically for workout preferences debugging */}
      <Card style={styles.card}>
        <Card.Content>
          <Title>Workout Preferences Debug</Title>
          <Divider style={styles.divider} />
          
          <Text style={styles.label}>Workout Days Per Week:</Text>
          <Text style={styles.value}>{profile?.workout_days_per_week || 'Not set'}</Text>
          
          <Text style={styles.label}>Workout Preferences Days Per Week:</Text>
          <Text style={styles.value}>{(profile?.workout_preferences as any)?.days_per_week || 'Not set'}</Text>
          
          <Text style={styles.label}>Workout Frequency (Onboarding):</Text>
          <Text style={styles.value}>{(profile?.workout_preferences as any)?.workoutFrequency || 'Not set'}</Text>
          
          <Text style={styles.label}>Fitness Goals:</Text>
          <Text style={styles.value}>{Array.isArray(profile?.fitness_goals) ? profile?.fitness_goals.join(', ') : 'Not set'}</Text>
          
          <Text style={styles.label}>Focus Areas:</Text>
          <Text style={styles.value}>{Array.isArray(profile?.workout_preferences?.focus_areas) ? profile?.workout_preferences?.focus_areas.join(', ') : 'Not set'}</Text>
          
          <Text style={styles.label}>Preferred Workouts:</Text>
          <Text style={styles.value}>{Array.isArray((profile as any)?.preferred_workouts) ? (profile as any)?.preferred_workouts.join(', ') : 'Not set'}</Text>
          
          <Text style={styles.label}>Workout Location:</Text>
          <Text style={styles.value}>{profile?.workout_preferences?.workout_location || 'Not set'}</Text>
          
          <Text style={styles.label}>Equipment:</Text>
          <Text style={styles.value}>{Array.isArray(profile?.workout_preferences?.equipment) ? profile?.workout_preferences?.equipment.join(', ') : 'Not set'}</Text>
          
          <Button 
            mode="contained" 
            onPress={handleRefreshProfile}
            disabled={loading}
            style={styles.button}
          >
            Refresh Profile Data
          </Button>
        </Card.Content>
      </Card>

      {/* Updated Card for Workout Generation Testing */}
      <Card style={styles.card}>
        <Card.Content>
          <Title>Workout Generator Testing</Title>
          <Text>Test different workout generation approaches</Text>
          
          <Divider style={styles.divider} />
          
          <View style={styles.apiToggleContainer}>
            <Checkbox
              status={skipApiCalls ? 'checked' : 'unchecked'}
              onPress={() => handleToggleApiCalls(!skipApiCalls)}
            />
            <Text style={styles.apiToggleText}>Skip API calls (use when rate limited)</Text>
          </View>
          
          <Title style={styles.sectionTitle}>Pydantic Generator Testing</Title>
          <View style={styles.buttonContainer}>
            <Button 
              mode="contained" 
              onPress={testPydanticGenerator}
              loading={generationLoading.pydanticPrimary}
              disabled={generationLoading.pydanticPrimary || generationLoading.pydanticBackup || generationLoading.structured || !profile}
              style={styles.button}
            >
              Test Complete Flow
            </Button>
          </View>
          
          <View style={styles.buttonContainer}>
            <Button 
              mode="contained" 
              onPress={testPydanticPrimaryGenerator}
              loading={generationLoading.pydanticPrimary}
              disabled={generationLoading.pydanticPrimary || generationLoading.pydanticBackup || generationLoading.structured || !profile}
              style={styles.button}
            >
              Test Primary Only
            </Button>

            <Button 
              mode="contained" 
              onPress={testPydanticBackupGenerator}
              loading={generationLoading.pydanticBackup}
              disabled={generationLoading.pydanticPrimary || generationLoading.pydanticBackup || generationLoading.structured || !profile}
              style={styles.button}
            >
              Test Backup Only
            </Button>
          </View>
          
          <Divider style={styles.divider} />
          <Title style={styles.sectionTitle}>Other Generators</Title>
          
          <View style={styles.buttonContainer}>
            <Button 
              mode="outlined" 
              onPress={testStructuredGenerator}
              loading={generationLoading.structured}
              disabled={generationLoading.pydanticPrimary || generationLoading.pydanticBackup || generationLoading.structured || !profile}
              style={styles.button}
            >
              Test Structured Generator
            </Button>
          </View>
          
          <Button 
            mode="outlined"
            onPress={testFallbackGenerator}
            disabled={generationLoading.pydanticPrimary || generationLoading.pydanticBackup || generationLoading.structured || !profile}
            style={[styles.button, { marginTop: 8 }]}
          >
            Test Fallback Plan (No API)
          </Button>
          
          {(generationLoading.pydanticPrimary || generationLoading.pydanticBackup || generationLoading.structured) && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={styles.loadingText}>Generating workout plan...</Text>
            </View>
          )}
          
          {workoutPlans.pydanticPrimary && (
            <View style={styles.workoutResultContainer}>
              <Text style={styles.resultTitle}>Pydantic Generator Result:</Text>
              <ScrollView style={styles.jsonContainer}>
                <Text selectable={true}>
                  {formatWorkoutPlan(workoutPlans.pydanticPrimary)}
                </Text>
              </ScrollView>
            </View>
          )}
          
          {workoutPlans.pydanticBackup && (
            <View style={styles.workoutResultContainer}>
              <Text style={styles.resultTitle}>Pydantic Backup Result:</Text>
              <ScrollView style={styles.jsonContainer}>
                <Text selectable={true}>
                  {formatWorkoutPlan(workoutPlans.pydanticBackup)}
                </Text>
              </ScrollView>
            </View>
          )}
          
          {workoutPlans.structured && (
            <View style={styles.workoutResultContainer}>
              <Text style={styles.resultTitle}>Structured Generator Result:</Text>
              <ScrollView style={styles.jsonContainer}>
                <Text selectable={true}>
                  {formatWorkoutPlan(workoutPlans.structured)}
                </Text>
              </ScrollView>
            </View>
          )}
        </Card.Content>
      </Card>

      {/* Notification Testing Card */}
      <Card style={styles.card}>
        <Card.Content>
          <Title>Notification System Testing</Title>
          <Text>Test and debug notification functionality</Text>

          <View style={styles.buttonContainer}>
            <Button
              mode="outlined"
              onPress={() => router.push('/(dev)/test-notifications')}
              style={styles.button}
            >
              Open Notification Tester
            </Button>
          </View>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  card: {
    marginBottom: 16,
  },
  buttonContainer: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    marginVertical: 8,
    flex: 1,
    marginHorizontal: 4,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  loadingText: {
    marginLeft: 8,
  },
  resultContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
  },
  resultTitle: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  resultText: {
    fontSize: 14,
  },
  divider: {
    marginVertical: 16,
  },
  jsonContainer: {
    maxHeight: 300,
    backgroundColor: '#f0f0f0',
    padding: 8,
    borderRadius: 4,
  },
  validationContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
  },
  validationStatus: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 8,
  },
  discrepanciesTitle: {
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 4,
  },
  discrepancyItem: {
    fontSize: 14,
    marginLeft: 8,
    marginBottom: 4,
  },
  label: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  value: {
    marginBottom: 8,
  },
  workoutResultContainer: {
    marginTop: 16,
  },
  apiToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  apiToggleText: {
    marginLeft: 8,
  },
  sectionTitle: {
    fontSize: 16,
    marginTop: 12,
    marginBottom: 8,
  },
}); 