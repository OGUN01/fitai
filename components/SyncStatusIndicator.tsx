import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Animated, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSyncInProgress, getSyncDiagnostics } from '../utils/syncLocalData';
import { useAuth } from '../contexts/AuthContext';

// Time to consider sync as stalled (in ms)
const SYNC_STALL_THRESHOLD = 15000;
// Time to show the "Last synced" message before hiding it (in ms)
const SYNC_MESSAGE_DURATION = 5000;

const SyncStatusIndicator = () => {
  const [syncStatus, setSyncStatus] = useState<'idle' | 'in-progress' | 'error' | 'stalled'>('idle');
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [errorInfo, setErrorInfo] = useState<any>(null);
  const { user } = useAuth();
  // Add a ref to track when we last showed the sync message
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSuccessfulSyncRef = useRef<string | null>(null);
  // Add animation for smooth appearance/disappearance
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Clean up timer when component unmounts
  useEffect(() => {
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  // Handle fade-in/fade-out animations
  useEffect(() => {
    if (syncStatus === 'in-progress' || syncStatus === 'error' || syncStatus === 'stalled' || lastSync) {
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [syncStatus, lastSync, opacityAnim]);

  useEffect(() => {
    const checkSyncStatus = async () => {
      if (!user) {
        setSyncStatus('idle');
        setLastSync(null);
        return;
      }

      try {
        // Check if sync is in progress
        const inProgress = await isSyncInProgress();
        
        if (inProgress) {
          // Get sync start time to check for stalled sync
          const syncStartJson = await AsyncStorage.getItem('sync_in_progress_since');
          if (syncStartJson) {
            const startTime = new Date(JSON.parse(syncStartJson)).getTime();
            const now = Date.now();
            
            if (now - startTime > SYNC_STALL_THRESHOLD) {
              setSyncStatus('stalled');
              return;
            }
          }
          
          setSyncStatus('in-progress');
          // Clear any existing hide timer while sync is in progress
          if (hideTimerRef.current) {
            clearTimeout(hideTimerRef.current);
            hideTimerRef.current = null;
          }
          return;
        }
        
        // Check for sync errors
        const lastSyncErrorJson = await AsyncStorage.getItem('last_sync_error');
        if (lastSyncErrorJson) {
          const errorData = JSON.parse(lastSyncErrorJson);
          setSyncStatus('error');
          setErrorInfo(errorData);
          return;
        }
        
        // Get last successful sync
        const userSyncStatus = await AsyncStorage.getItem(`sync_status:${user.id}`);
        if (userSyncStatus) {
          const statusData = JSON.parse(userSyncStatus);
          if (statusData.timestamp) {
            // Only update if it's a new sync (different from what we're already showing)
            if (statusData.timestamp !== lastSuccessfulSyncRef.current) {
              lastSuccessfulSyncRef.current = statusData.timestamp;
              setLastSync(statusData.timestamp);
              
              // Set a timer to hide the "Last synced" message after a delay
              if (hideTimerRef.current) {
                clearTimeout(hideTimerRef.current);
              }
              
              hideTimerRef.current = setTimeout(() => {
                setLastSync(null);
                hideTimerRef.current = null;
              }, SYNC_MESSAGE_DURATION);
            }
          }
        }
        
        setSyncStatus('idle');
      } catch (error) {
        console.error('Error checking sync status:', error);
      }
    };

    checkSyncStatus();
    const interval = setInterval(checkSyncStatus, 1000);
    
    return () => clearInterval(interval);
  }, [user]);

  const resetSyncError = async () => {
    await AsyncStorage.removeItem('last_sync_error');
    await AsyncStorage.removeItem('sync_in_progress');
    setSyncStatus('idle');
    setErrorInfo(null);
  };

  const clearStalledSync = async () => {
    await AsyncStorage.removeItem('sync_in_progress');
    await AsyncStorage.removeItem('sync_in_progress_since');
    setSyncStatus('idle');
  };

  const viewDiagnostics = async () => {
    const diagnostics = await getSyncDiagnostics();
    console.log('Sync diagnostics:', diagnostics);
    // In a real app, you might show this in a modal or send to a logging service
    Alert.alert('Sync Info', 'Sync diagnostics logged to console');
  };

  // Render based on state
  const renderContent = () => {
    if (syncStatus === 'idle' && !lastSync) return null;
    
    if (syncStatus === 'idle' && lastSync) {
      return (
        <TouchableOpacity style={styles.container} onPress={viewDiagnostics}>
          <Text style={styles.text}>Last synced: {new Date(lastSync).toLocaleTimeString()}</Text>
        </TouchableOpacity>
      );
    }

    if (syncStatus === 'in-progress') {
      return (
        <View style={styles.container}>
          <ActivityIndicator size="small" color="#0066CC" />
          <Text style={styles.text}>Syncing data...</Text>
        </View>
      );
    }

    if (syncStatus === 'error') {
      return (
        <TouchableOpacity style={[styles.container, styles.errorContainer]} onPress={resetSyncError}>
          <Text style={styles.errorText}>Sync error: {errorInfo?.message || 'Unknown error'}</Text>
          <Text style={styles.smallText}>Tap to dismiss</Text>
        </TouchableOpacity>
      );
    }

    if (syncStatus === 'stalled') {
      return (
        <TouchableOpacity style={[styles.container, styles.stalledContainer]} onPress={clearStalledSync}>
          <Text style={styles.errorText}>Sync appears to be stalled</Text>
          <Text style={styles.smallText}>Tap to reset</Text>
        </TouchableOpacity>
      );
    }

    return null;
  };

  // Use Animated view for smooth transitions
  return (
    <Animated.View style={{ opacity: opacityAnim, zIndex: 1000, position: 'absolute', top: 50, left: 0, right: 0 }}>
      {renderContent()}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    backgroundColor: '#f0f9ff',
    margin: 0,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  text: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
  },
  errorContainer: {
    backgroundColor: '#fff0f0',
    borderLeftWidth: 4,
    borderLeftColor: '#cc0000',
  },
  stalledContainer: {
    backgroundColor: '#fffbe5',
    borderLeftWidth: 4,
    borderLeftColor: '#e6a700',
  },
  errorText: {
    fontSize: 14,
    color: '#cc0000',
    marginLeft: 8,
  },
  smallText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  }
});

export default SyncStatusIndicator; 