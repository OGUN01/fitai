import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { verifyDataIntegrity, performDeepDataRecovery } from '../../utils/dataIntegrityChecker';
import { runDiagnosticReport, performSystemRecovery, getSystemHealth } from '../../utils/systemIntegration';
import { synchronizeAllData, getSyncStatus, isSyncInProgress } from '../../utils/syncManager';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Diagnostic panel for testing data persistence and synchronization
 */
export default function DiagnosticPanel() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [syncRunning, setSyncRunning] = useState(false);
  const [healingRunning, setHealingRunning] = useState(false);
  const [systemHealth, setSystemHealth] = useState<any>(null);

  // Check system health on load
  useEffect(() => {
    checkSystemHealth();
  }, []);

  // Check system health
  const checkSystemHealth = async () => {
    try {
      const health = await getSystemHealth();
      setSystemHealth(health);
    } catch (error) {
      logResult(`Error checking health: ${error}`);
    }
  };

  // Helper to add log messages
  const logResult = (message: string) => {
    setResults(prev => [message, ...prev]);
  };

  // Run all diagnostic tests
  const runDiagnostics = async () => {
    setLoading(true);
    logResult('🔍 Starting diagnostic tests...');
    
    try {
      // Check if user is logged in
      if (!user) {
        logResult('⚠️ WARNING: Some tests require a logged-in user');
      }
      
      logResult(`User Status: ${user ? 'Logged In' : 'Not Logged In'}`);

      // Check local storage
      logResult('📦 Checking local storage...');
      const keys = await AsyncStorage.getAllKeys();
      logResult(`Found ${keys.length} items in storage`);
      
      // Sample key values
      let localChecks = '';
      try {
        const onboardingStatus = await AsyncStorage.getItem('onboarding_status');
        localChecks += `Onboarding Status: ${onboardingStatus ? 'Found' : 'Not Found'}\n`;
        
        const localProfile = await AsyncStorage.getItem('local_profile');
        localChecks += `Local Profile: ${localProfile ? 'Found' : 'Not Found'}\n`;
        
        const completedWorkouts = await AsyncStorage.getItem('completed_workouts');
        const workouts = completedWorkouts ? JSON.parse(completedWorkouts) : [];
        localChecks += `Saved Workouts: ${workouts.length}\n`;
        
        const mealsData = await AsyncStorage.getItem('meals');
        const meals = mealsData ? JSON.parse(mealsData) : [];
        localChecks += `Saved Meals: ${meals.length}`;
        
        logResult(localChecks);
      } catch (error) {
        logResult(`Error reading storage: ${error}`);
      }
      
      // Run data integrity test
      if (user) {
        logResult('🧪 Running data integrity test...');
        const integrityResult = await verifyDataIntegrity(user.id);
        logResult(`Integrity: ${integrityResult.success ? 'PASSED ✅' : 'FAILED ❌'}`);
        logResult(`Found ${integrityResult.issues.length} issues, repaired ${integrityResult.repairedCount}`);
        
        if (integrityResult.issues.length > 0) {
          const issueList = integrityResult.issues
            .map(issue => `[${issue.type}] ${issue.dataType}: ${issue.description}`)
            .join('\n');
          logResult(`Issues:\n${issueList}`);
        }
      }
      
      // Check sync status
      logResult('🔄 Checking sync status...');
      const syncStatus = await getSyncStatus();
      const syncInProgress = await isSyncInProgress();
      logResult(`Sync in progress: ${syncInProgress}`);
      logResult(`Last sync: ${syncStatus.lastSync ? new Date(syncStatus.lastSync).toLocaleString() : 'Never'}`);
      
      // Run diagnostic report
      if (user) {
        logResult('📝 Running full diagnostic report...');
        const report = await runDiagnosticReport(user.id);
        logResult(`System health: ${report.systemHealth.status}`);
        logResult(`Storage: ~${Math.round(report.localStorageStats.estimatedSize / 1024)} KB`);
        
        if (report.recommendedActions.length > 0) {
          const actions = report.recommendedActions.join('\n');
          logResult(`Recommended actions:\n${actions}`);
        } else {
          logResult('No recommended actions needed.');
        }
      }
      
      logResult('✅ Diagnostic tests completed');
      
    } catch (error) {
      logResult(`❌ Error running diagnostics: ${error}`);
    } finally {
      setLoading(false);
      checkSystemHealth();
    }
  };

  // Run data synchronization
  const runSync = async () => {
    if (!user) {
      logResult('❌ Must be logged in to sync data');
      return;
    }
    
    setSyncRunning(true);
    logResult('🔄 Starting data synchronization...');
    
    try {
      const startTime = Date.now();
      const success = await synchronizeAllData(user.id);
      const duration = Date.now() - startTime;
      
      logResult(`Sync result: ${success ? 'Success ✅' : 'Failed ❌'}`);
      logResult(`Duration: ${duration}ms`);
      
      // Check updated sync status
      const syncStatus = await getSyncStatus();
      if (syncStatus.syncResults) {
        let results = '';
        Object.entries(syncStatus.syncResults).forEach(([dataType, result]) => {
          results += `${dataType}: ${result.syncedItems} items, ${result.conflicts} conflicts\n`;
        });
        logResult(`Sync details:\n${results}`);
      }
    } catch (error) {
      logResult(`❌ Error during sync: ${error}`);
    } finally {
      setSyncRunning(false);
      checkSystemHealth();
    }
  };

  // Run system self-healing
  const runSelfHealing = async () => {
    if (!user) {
      logResult('❌ Must be logged in for system recovery');
      return;
    }
    
    setHealingRunning(true);
    logResult('🔧 Starting system recovery...');
    
    try {
      const result = await performSystemRecovery(user.id);
      logResult(`Recovery result: ${result.success ? 'Success ✅' : 'Failed ❌'}`);
      logResult(`Details: ${result.message}`);
    } catch (error) {
      logResult(`❌ Error during recovery: ${error}`);
    } finally {
      setHealingRunning(false);
      checkSystemHealth();
    }
  };

  // Clear diagnostic logs
  const clearLogs = () => {
    setResults([]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Data Integrity Diagnostics</Text>
        {systemHealth && (
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>
              Status: {systemHealth.status.toUpperCase()}
            </Text>
          </View>
        )}
      </View>
      
      <View style={styles.controls}>
        <TouchableOpacity 
          style={[styles.button, loading && styles.disabledButton]}
          onPress={runDiagnostics}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.buttonText}>Run Diagnostics</Text>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, syncRunning && styles.disabledButton]}
          onPress={runSync}
          disabled={syncRunning || !user}
        >
          {syncRunning ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.buttonText}>Test Sync</Text>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, healingRunning && styles.disabledButton, 
            styles.warningButton]}
          onPress={runSelfHealing}
          disabled={healingRunning || !user}
        >
          {healingRunning ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.buttonText}>Self-Heal</Text>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, styles.dangerButton]}
          onPress={clearLogs}
        >
          <Text style={styles.buttonText}>Clear Logs</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.logContainer}>
        {results.map((result, index) => (
          <Text key={index} style={styles.logText}>
            {result}
          </Text>
        ))}
        {results.length === 0 && (
          <Text style={styles.emptyText}>
            No diagnostic results yet. Press "Run Diagnostics" to start.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#4CAF50',
  },
  statusText: {
    color: 'white',
    fontWeight: 'bold',
  },
  controls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  button: {
    minWidth: '48%',
    backgroundColor: '#5D5FEF',
    padding: 12,
    borderRadius: 8,
    marginVertical: 6,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.7,
  },
  warningButton: {
    backgroundColor: '#FF9800',
  },
  dangerButton: {
    backgroundColor: '#F44336',
  },
  logContainer: {
    flex: 1,
    backgroundColor: '#263238',
    padding: 16,
    borderRadius: 8,
  },
  logText: {
    color: '#e0e0e0',
    fontFamily: 'monospace',
    marginBottom: 4,
    fontSize: 14,
  },
  emptyText: {
    color: '#90A4AE',
    textAlign: 'center',
    marginTop: 24,
    fontStyle: 'italic',
  },
});
