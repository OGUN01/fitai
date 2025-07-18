import { verifyDataIntegrity, performDeepDataRecovery } from './dataIntegrityChecker';
import { runDiagnosticReport, performSystemRecovery, getSystemHealth } from './systemIntegration';
import { synchronizeAllData, getSyncStatus, isSyncInProgress } from './syncManager';
import supabase from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Main diagnostic function that runs all tests
 */
async function runAllDiagnostics() {
  console.log('🔍 STARTING COMPREHENSIVE DIAGNOSTIC TESTS');
  console.log('==========================================');
  
  // Initialize integrity result variable
  let integrityResult = {
    issues: [],
    success: true,
    repairedCount: 0
  };
  
  try {
    // Step 1: Get current user ID (if logged in)
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user.id;
    
    console.log(`User Status: ${userId ? 'Logged In' : 'Not Logged In'}`);
    if (!userId) {
      console.log('⚠️ WARNING: Some tests require a logged-in user. Running limited diagnostics.');
    }
    
    // Step 2: Run system health check
    console.log('\n📊 SYSTEM HEALTH CHECK');
    console.log('---------------------');
    const healthStatus = await getSystemHealth();
    console.log('System Status:', healthStatus.status);
    console.log('Last Updated:', new Date(healthStatus.lastUpdated).toLocaleString());
    console.log('Recovery Attempts:', healthStatus.recoveryAttempts);
    console.log('Issues:', healthStatus.issues.length > 0 ? healthStatus.issues.length : 'None');
    if (healthStatus.issues.length > 0) {
      console.log('Recent Issues:');
      healthStatus.issues.slice(0, 3).forEach((issue, index) => {
        console.log(`${index + 1}. [${issue.severity}] ${issue.component}: ${issue.description}`);
      });
    }
    
    // Step 3: Check local storage statistics
    console.log('\n💾 LOCAL STORAGE STATISTICS');
    console.log('--------------------------');
    const keys = await AsyncStorage.getAllKeys();
    console.log('Total Items:', keys.length);
    console.log('Keys Found:');
    keys.slice(0, 10).forEach(key => console.log(`- ${key}`));
    if (keys.length > 10) console.log(`...and ${keys.length - 10} more`);
    
    try {
      const onboardingStatus = await AsyncStorage.getItem('onboarding_status');
      console.log('\nOnboarding Status:', onboardingStatus ? JSON.parse(onboardingStatus) : 'Not Found');
      
      const localProfile = await AsyncStorage.getItem('local_profile');
      console.log('Local Profile:', localProfile ? 'Found' : 'Not Found');
      
      const completedWorkouts = await AsyncStorage.getItem('completed_workouts');
      const workouts = completedWorkouts ? JSON.parse(completedWorkouts) : [];
      console.log('Saved Workouts:', workouts.length);
      
      const mealsData = await AsyncStorage.getItem('meals');
      const meals = mealsData ? JSON.parse(mealsData) : [];
      console.log('Saved Meals:', meals.length);
    } catch (error) {
      console.error('Error reading local storage:', error);
    }
    
    // Step 4: Run data integrity check (if logged in)
    if (userId) {
      console.log('\n🧪 DATA INTEGRITY TEST');
      console.log('---------------------');
      console.log('Running verification...');
      const integrityResult = await verifyDataIntegrity(userId);
      console.log('Test Result:', integrityResult.success ? 'PASSED ✅' : 'FAILED ❌');
      console.log('Issues Found:', integrityResult.issues.length);
      console.log('Issues Repaired:', integrityResult.repairedCount);
      
      if (integrityResult.issues.length > 0) {
        console.log('\nDetected Issues:');
        integrityResult.issues.forEach((issue, index) => {
          console.log(`${index + 1}. [${issue.type}] ${issue.dataType}: ${issue.description} (${issue.repaired ? 'Repaired' : 'Unrepaired'})`);
        });
      }
    }
    
    // Step 5: Check sync status
    console.log('\n🔄 SYNCHRONIZATION STATUS');
    console.log('------------------------');
    const syncStatus = await getSyncStatus();
    const syncInProgress = await isSyncInProgress();
    console.log('Sync In Progress:', syncInProgress);
    console.log('Last Sync:', syncStatus.lastSync ? new Date(syncStatus.lastSync).toLocaleString() : 'Never');
    console.log('Sync Results:', syncStatus.syncResults ? 'Available' : 'Not Available');
    
    if (syncStatus.syncResults) {
      Object.entries(syncStatus.syncResults).forEach(([dataType, result]) => {
        console.log(`- ${dataType}: ${result.success ? 'Success' : 'Failed'}, Items: ${result.syncedItems}, Conflicts: ${result.conflicts}`);
      });
    }
    
    // Step 6: Run full diagnostic report
    console.log('\n📝 FULL DIAGNOSTIC REPORT');
    console.log('------------------------');
    const diagnosticReport = await runDiagnosticReport(userId);
    console.log('System Health:', diagnosticReport.systemHealth.status);
    console.log('Storage Stats:', `${diagnosticReport.localStorageStats.keys} keys, ~${Math.round(diagnosticReport.localStorageStats.estimatedSize / 1024)} KB`);
    
    if (diagnosticReport.recommendedActions.length > 0) {
      console.log('\nRecommended Actions:');
      diagnosticReport.recommendedActions.forEach((action, index) => {
        console.log(`${index + 1}. ${action}`);
      });
    } else {
      console.log('No recommended actions.');
    }
    
    // Step 7: If user is logged in and issues were found, run quick sync test
    if (userId && (integrityResult.issues.length > 0 || diagnosticReport.recommendedActions.length > 0)) {
      console.log('\n🔄 RUNNING QUICK SYNC TEST');
      console.log('------------------------');
      const syncStartTime = Date.now();
      const syncResult = await synchronizeAllData(userId);
      const syncDuration = Date.now() - syncStartTime;
      
      console.log('Sync Result:', syncResult ? 'Success ✅' : 'Failed ❌');
      console.log('Sync Duration:', `${syncDuration}ms`);
      
      // Check sync status again
      const newSyncStatus = await getSyncStatus();
      console.log('Updated Sync Results:');
      if (newSyncStatus.syncResults) {
        Object.entries(newSyncStatus.syncResults).forEach(([dataType, result]) => {
          console.log(`- ${dataType}: ${result.success ? 'Success' : 'Failed'}, Items: ${result.syncedItems}, Conflicts: ${result.conflicts}`);
        });
      }
    }
    
    // Integrity check was already run earlier if user is logged in
    
    console.log('\n✅ DIAGNOSTIC TESTS COMPLETED');
    console.log('============================');
    console.log('Summary: All diagnostic tests have been completed.');
    
    if (userId && diagnosticReport.recommendedActions.length > 0) {
      console.log('\nWould you like to run system recovery? (This would require user confirmation in a real app)');
    }
    
  } catch (error) {
    console.error('❌ ERROR RUNNING DIAGNOSTICS:', error);
  }
}

// Run all diagnostics
runAllDiagnostics();

// Export function for external use
export { runAllDiagnostics };
