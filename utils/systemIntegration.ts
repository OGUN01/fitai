import AsyncStorage from '@react-native-async-storage/async-storage';
import { verifyDataIntegrity, performDeepDataRecovery } from './dataIntegrityChecker';
import { synchronizeAllData, isSyncInProgress, getSyncStatus } from './syncManager';
import { repairOnboardingStatus } from './onboardingPersistence';

// Status storage key
const SYSTEM_STARTUP_KEY = 'system_startup_info';
const SYSTEM_HEALTH_KEY = 'system_health_status';

// Define the startup info structure
interface SystemStartupInfo {
  lastStartup: number;
  startupCount: number;
  lastChecks: {
    integrity: number | null;
    sync: number | null;
    onboarding: number | null;
  };
  appVersion: string;
}

// Define system health structure
interface SystemHealthStatus {
  status: 'healthy' | 'warning' | 'critical';
  lastUpdated: number;
  issues: Array<{
    component: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
    timestamp: number;
  }>;
  recoveryAttempts: number;
}

/**
 * Record app startup and perform necessary system checks
 * This should be called when the app starts
 */
export async function recordAppStartup(
  userId: string | null,
  appVersion: string
): Promise<void> {
  try {
    console.log('📱 Recording app startup...');
    
    // Get current startup info
    const startupInfo = await getStartupInfo();
    
    // Update startup info
    const updatedInfo: SystemStartupInfo = {
      lastStartup: Date.now(),
      startupCount: startupInfo.startupCount + 1,
      lastChecks: startupInfo.lastChecks,
      appVersion
    };
    
    // Save updated info
    await AsyncStorage.setItem(SYSTEM_STARTUP_KEY, JSON.stringify(updatedInfo));
    
    // Determine if we need to run checks
    const shouldRunIntegrityCheck = needsIntegrityCheck(startupInfo);
    const shouldFixOnboarding = needsOnboardingCheck(startupInfo);
    const shouldSyncData = needsDataSync(startupInfo);
    
    // Get system health
    const healthStatus = await getSystemHealth();
    
    // If system is critical, attempt recovery first
    if (healthStatus.status === 'critical' && userId) {
      console.log('⚠️ System health is critical, attempting recovery...');
      await performDeepDataRecovery(userId);
      
      // Update health status
      await updateSystemHealth({
        status: 'warning',
        lastUpdated: Date.now(),
        issues: [...healthStatus.issues, {
          component: 'system',
          severity: 'high',
          description: 'Automatic recovery was performed due to critical system health',
          timestamp: Date.now()
        }],
        recoveryAttempts: healthStatus.recoveryAttempts + 1
      });
      
      return;
    }
    
    // Run necessary checks
    if (shouldFixOnboarding) {
      console.log('🔍 Running onboarding state repair...');
      await repairOnboardingStatus();
      
      // Update last check time
      updatedInfo.lastChecks.onboarding = Date.now();
      await AsyncStorage.setItem(SYSTEM_STARTUP_KEY, JSON.stringify(updatedInfo));
    }
    
    if (shouldRunIntegrityCheck && userId) {
      console.log('🔍 Running data integrity check...');
      const integrityResult = await verifyDataIntegrity(userId);
      
      // Update last check time
      updatedInfo.lastChecks.integrity = Date.now();
      await AsyncStorage.setItem(SYSTEM_STARTUP_KEY, JSON.stringify(updatedInfo));
      
      // Update system health based on integrity check
      if (!integrityResult.success) {
        const severity = integrityResult.issues.length > 5 ? 'critical' : 'warning';
        
        await updateSystemHealth({
          status: severity === 'critical' ? 'critical' : healthStatus.status,
          lastUpdated: Date.now(),
          issues: [
            ...healthStatus.issues,
            {
              component: 'data_integrity',
              severity: integrityResult.issues.length > 5 ? 'high' : 'medium',
              description: `Data integrity check found ${integrityResult.issues.length} issues, repaired ${integrityResult.repairedCount}`,
              timestamp: Date.now()
            }
          ],
          recoveryAttempts: healthStatus.recoveryAttempts
        });
      }
    }
    
    // Check if data sync is needed and not already in progress
    if (shouldSyncData && userId && !(await isSyncInProgress())) {
      console.log('🔄 Running background data synchronization...');
      
      // Run sync in background
      synchronizeAllData(userId).then(success => {
        // Update last check time when sync completes
        getStartupInfo().then(currentInfo => {
          const updatedInfo = {
            ...currentInfo,
            lastChecks: {
              ...currentInfo.lastChecks,
              sync: Date.now()
            }
          };
          AsyncStorage.setItem(SYSTEM_STARTUP_KEY, JSON.stringify(updatedInfo));
        });
        
        // Update system health if sync failed
        if (!success) {
          getSystemHealth().then(health => {
            updateSystemHealth({
              ...health,
              status: health.status === 'healthy' ? 'warning' : health.status,
              lastUpdated: Date.now(),
              issues: [
                ...health.issues,
                {
                  component: 'data_sync',
                  severity: 'medium',
                  description: 'Background data synchronization failed',
                  timestamp: Date.now()
                }
              ]
            });
          });
        }
      });
    }
  } catch (error) {
    console.error('❌ Error in app startup process:', error);
    
    // Update system health to warning
    const healthStatus = await getSystemHealth();
    await updateSystemHealth({
      status: healthStatus.status === 'critical' ? 'critical' : 'warning',
      lastUpdated: Date.now(),
      issues: [
        ...healthStatus.issues,
        {
          component: 'system',
          severity: 'medium',
          description: `Error during app startup: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: Date.now()
        }
      ],
      recoveryAttempts: healthStatus.recoveryAttempts
    });
  }
}

/**
 * Get startup info, or create default if none exists
 */
async function getStartupInfo(): Promise<SystemStartupInfo> {
  try {
    const infoJson = await AsyncStorage.getItem(SYSTEM_STARTUP_KEY);
    if (infoJson) {
      return JSON.parse(infoJson);
    }
    return {
      lastStartup: 0,
      startupCount: 0,
      lastChecks: {
        integrity: null,
        sync: null,
        onboarding: null
      },
      appVersion: '1.0.0'
    };
  } catch (error) {
    console.error('Error getting startup info:', error);
    return {
      lastStartup: 0,
      startupCount: 0,
      lastChecks: {
        integrity: null,
        sync: null,
        onboarding: null
      },
      appVersion: '1.0.0'
    };
  }
}

/**
 * Get system health status, or create default if none exists
 */
export async function getSystemHealth(): Promise<SystemHealthStatus> {
  try {
    const healthJson = await AsyncStorage.getItem(SYSTEM_HEALTH_KEY);
    if (healthJson) {
      return JSON.parse(healthJson);
    }
    return {
      status: 'healthy',
      lastUpdated: Date.now(),
      issues: [],
      recoveryAttempts: 0
    };
  } catch (error) {
    console.error('Error getting system health:', error);
    return {
      status: 'healthy',
      lastUpdated: Date.now(),
      issues: [],
      recoveryAttempts: 0
    };
  }
}

/**
 * Update system health status
 */
async function updateSystemHealth(health: SystemHealthStatus): Promise<void> {
  try {
    // Limit issues array to most recent 20 issues
    if (health.issues.length > 20) {
      health.issues = health.issues
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 20);
    }
    
    await AsyncStorage.setItem(SYSTEM_HEALTH_KEY, JSON.stringify(health));
  } catch (error) {
    console.error('Error updating system health:', error);
  }
}

/**
 * Determine if data integrity check is needed
 */
function needsIntegrityCheck(info: SystemStartupInfo): boolean {
  // Run integrity check if never run before
  if (!info.lastChecks.integrity) {
    return true;
  }
  
  // Run every 10 startups
  if (info.startupCount % 10 === 0) {
    return true;
  }
  
  // Run if it's been more than 7 days since last check
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  if (Date.now() - info.lastChecks.integrity > oneWeek) {
    return true;
  }
  
  // Run if app version changed
  const currentVersion = info.appVersion;
  // This would ideally get the current app version from a config
  const newVersion = '1.0.0';
  if (currentVersion !== newVersion) {
    return true;
  }
  
  return false;
}

/**
 * Determine if onboarding check is needed
 */
function needsOnboardingCheck(info: SystemStartupInfo): boolean {
  // Always run on startup - it's lightweight and critical
  return true;
}

/**
 * Determine if data sync is needed
 */
function needsDataSync(info: SystemStartupInfo): boolean {
  // Run sync if never run before
  if (!info.lastChecks.sync) {
    return true;
  }
  
  // Run if it's been more than 24 hours since last sync
  const oneDay = 24 * 60 * 60 * 1000;
  if (Date.now() - info.lastChecks.sync > oneDay) {
    return true;
  }
  
  return false;
}

/**
 * Run a diagnostic report to collect information about system health
 */
export async function runDiagnosticReport(
  userId: string | null
): Promise<{
  systemHealth: SystemHealthStatus;
  startupInfo: SystemStartupInfo;
  syncStatus: any;
  localStorageStats: { keys: number; estimatedSize: number };
  recommendedActions: string[];
}> {
  try {
    // Get system information
    const healthStatus = await getSystemHealth();
    const startupInfo = await getStartupInfo();
    const syncStatus = await getSyncStatus();
    
    // Get storage stats
    const keys = await AsyncStorage.getAllKeys();
    let totalSize = 0;
    
    for (const key of keys.slice(0, 20)) { // Only sample first 20 keys to avoid performance issues
      try {
        const item = await AsyncStorage.getItem(key);
        if (item) {
          totalSize += item.length * 2; // Rough estimate, 2 bytes per character
        }
      } catch (e) {
        console.warn(`Could not get size for key ${key}:`, e);
      }
    }
    
    // Estimate total size based on average
    const avgSize = keys.length > 0 ? totalSize / Math.min(keys.length, 20) : 0;
    const estimatedTotalSize = avgSize * keys.length;
    
    // Generate recommendations
    const recommendations: string[] = [];
    
    if (healthStatus.status !== 'healthy') {
      recommendations.push('Run a full system recovery to fix existing issues');
    }
    
    if (!startupInfo.lastChecks.integrity || 
        (Date.now() - (startupInfo.lastChecks.integrity || 0)) > 7 * 24 * 60 * 60 * 1000) {
      recommendations.push('Run a data integrity check');
    }
    
    if (!startupInfo.lastChecks.sync || 
        (Date.now() - (startupInfo.lastChecks.sync || 0)) > 24 * 60 * 60 * 1000) {
      recommendations.push('Synchronize data with the server');
    }
    
    if (estimatedTotalSize > 5 * 1024 * 1024) { // If over 5MB
      recommendations.push('Consider clearing old data to reduce storage usage');
    }
    
    if (healthStatus.recoveryAttempts > 3) {
      recommendations.push('Consider reinstalling the app if issues persist');
    }
    
    return {
      systemHealth: healthStatus,
      startupInfo,
      syncStatus,
      localStorageStats: {
        keys: keys.length,
        estimatedSize: estimatedTotalSize
      },
      recommendedActions: recommendations
    };
  } catch (error) {
    console.error('Error running diagnostic report:', error);
    throw error;
  }
}

/**
 * Perform a system recovery
 */
export async function performSystemRecovery(
  userId: string | null
): Promise<{ success: boolean; message: string }> {
  try {
    console.log('🔄 Starting system recovery...');
    
    if (!userId) {
      return {
        success: false,
        message: 'User ID is required for system recovery'
      };
    }
    
    // 1. Repair onboarding status
    await repairOnboardingStatus();
    
    // 2. Run data integrity check
    const integrityResult = await verifyDataIntegrity(userId);
    
    // 3. If integrity check found serious issues, perform deep recovery
    if (!integrityResult.success && integrityResult.issues.length > 3) {
      const recoveryResult = await performDeepDataRecovery(userId);
      
      if (!recoveryResult.success) {
        return recoveryResult;
      }
    }
    
    // 4. Run synchronization
    const syncSuccess = await synchronizeAllData(userId);
    
    // 5. Update system health
    await updateSystemHealth({
      status: 'healthy',
      lastUpdated: Date.now(),
      issues: [],
      recoveryAttempts: (await getSystemHealth()).recoveryAttempts + 1
    });
    
    // 6. Update startup info
    const startupInfo = await getStartupInfo();
    await AsyncStorage.setItem(SYSTEM_STARTUP_KEY, JSON.stringify({
      ...startupInfo,
      lastChecks: {
        integrity: Date.now(),
        sync: Date.now(),
        onboarding: Date.now()
      }
    }));
    
    return {
      success: true,
      message: syncSuccess 
        ? 'System recovery completed successfully' 
        : 'System recovery completed, but data synchronization had some issues'
    };
  } catch (error) {
    console.error('Error during system recovery:', error);
    return {
      success: false,
      message: `System recovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}
