import AsyncStorage from '@react-native-async-storage/async-storage';
import supabase from '../lib/supabase';
import { synchronizationEngine } from './synchronizationEngine';
import { forceResync } from './syncManager';

// Define types for integrity check results
export interface IntegrityCheckResult {
  success: boolean;
  timestamp: number;
  issues: DataIssue[];
  repairedCount: number;
}

export interface DataIssue {
  type: 'missing_local' | 'missing_server' | 'mismatch' | 'corruption' | 'schema_incompatibility';
  dataType: string;
  itemId?: string;
  description: string;
  autoRepairable: boolean;
  repaired: boolean;
}

/**
 * Performs a comprehensive integrity check on data across local storage and Supabase
 * Detects and attempts to repair issues automatically
 */
export async function verifyDataIntegrity(
  userId: string
): Promise<IntegrityCheckResult> {
  console.log('🔍 Starting comprehensive data integrity check...');
  
  const result: IntegrityCheckResult = {
    success: true,
    timestamp: Date.now(),
    issues: [],
    repairedCount: 0
  };
  
  try {
    // 1. Check onboarding status consistency
    await checkOnboardingConsistency(userId, result);
    
    // 2. Check workout data integrity
    await checkWorkoutData(userId, result);
    
    // 3. Check meal data integrity
    await checkMealData(userId, result);
    
    // 4. Check profile data
    await checkProfileData(userId, result);
    
    // 5. Check JSON fields in profile (body measurements, nutrition)
    await checkProfileJsonFields(userId, result);
    
    // Update success flag if issues were found
    if (result.issues.length > 0) {
      result.success = false;
    }
    
    console.log(`✅ Data integrity check completed with ${result.issues.length} issues found, ${result.repairedCount} repaired`);
    return result;
  } catch (error) {
    console.error('❌ Error during data integrity check:', error);
    
    // Add a general corruption issue
    result.issues.push({
      type: 'corruption',
      dataType: 'general',
      description: `Error during integrity check: ${error instanceof Error ? error.message : 'Unknown error'}`,
      autoRepairable: false,
      repaired: false
    });
    
    result.success = false;
    return result;
  }
}

/**
 * Check the consistency of onboarding status between local storage and server
 */
async function checkOnboardingConsistency(
  userId: string, 
  result: IntegrityCheckResult
): Promise<void> {
  try {
    // Get local profile
    const localProfileJson = await AsyncStorage.getItem('local_profile');
    const localProfile = localProfileJson ? JSON.parse(localProfileJson) : null;
    
    // Get onboarding status from separate storage
    const onboardingStatusJson = await AsyncStorage.getItem('onboarding_status');
    const onboardingStatus = onboardingStatusJson ? JSON.parse(onboardingStatusJson) : null;
    
    // Get server profile
    const { data: serverProfile, error } = await supabase
      .from('profiles')
      .select('has_completed_onboarding, current_onboarding_step')
      .eq('id', userId)
      .single();
    
    if (error) {
      result.issues.push({
        type: 'missing_server',
        dataType: 'profile',
        description: 'Could not fetch server profile for onboarding check',
        autoRepairable: false,
        repaired: false
      });
      return;
    }
    
    // Check for inconsistencies
    if (localProfile && serverProfile) {
      // Local says completed but server doesn't
      if (localProfile.has_completed_local_onboarding === true && 
          serverProfile.has_completed_onboarding === false) {
        
        result.issues.push({
          type: 'mismatch',
          dataType: 'onboarding',
          description: 'Local storage shows onboarding complete but server does not',
          autoRepairable: true,
          repaired: false
        });
        
        // Attempt to repair
        try {
          await supabase
            .from('profiles')
            .update({
              has_completed_onboarding: true,
              current_onboarding_step: 'completed'
            })
            .eq('id', userId);
          
          result.issues[result.issues.length - 1].repaired = true;
          result.repairedCount++;
        } catch (repairError) {
          console.error('Error repairing onboarding status:', repairError);
        }
      }
      
      // Server says completed but local doesn't
      if (serverProfile.has_completed_onboarding === true && 
          localProfile.has_completed_local_onboarding === false) {
        
        result.issues.push({
          type: 'mismatch',
          dataType: 'onboarding',
          description: 'Server shows onboarding complete but local does not',
          autoRepairable: true,
          repaired: false
        });
        
        // Attempt to repair
        try {
          localProfile.has_completed_local_onboarding = true;
          localProfile.current_onboarding_step = 'completed';
          await AsyncStorage.setItem('local_profile', JSON.stringify(localProfile));
          
          // Also update the separate onboarding status storage
          await AsyncStorage.setItem('onboarding_status', JSON.stringify({
            completed: true,
            timestamp: Date.now(),
            version: 1,
            step: 'completed'
          }));
          
          result.issues[result.issues.length - 1].repaired = true;
          result.repairedCount++;
        } catch (repairError) {
          console.error('Error repairing local onboarding status:', repairError);
        }
      }
    }
    
    // Missing local profile but server exists
    if (!localProfile && serverProfile) {
      result.issues.push({
        type: 'missing_local',
        dataType: 'profile',
        description: 'Local profile is missing but server profile exists',
        autoRepairable: true,
        repaired: false
      });
      
      // Attempt to repair
      try {
        const newLocalProfile = {
          id: userId,
          has_completed_local_onboarding: serverProfile.has_completed_onboarding,
          current_onboarding_step: serverProfile.current_onboarding_step
        };
        
        await AsyncStorage.setItem('local_profile', JSON.stringify(newLocalProfile));
        
        result.issues[result.issues.length - 1].repaired = true;
        result.repairedCount++;
      } catch (repairError) {
        console.error('Error creating local profile:', repairError);
      }
    }
  } catch (error) {
    console.error('Error checking onboarding consistency:', error);
    result.issues.push({
      type: 'corruption',
      dataType: 'onboarding',
      description: `Error checking onboarding consistency: ${error instanceof Error ? error.message : 'Unknown error'}`,
      autoRepairable: false,
      repaired: false
    });
  }
}

/**
 * Check workout data integrity
 */
async function checkWorkoutData(
  userId: string, 
  result: IntegrityCheckResult
): Promise<void> {
  try {
    // Get local workouts
    const workoutsJson = await AsyncStorage.getItem('completed_workouts');
    const localWorkouts = workoutsJson ? JSON.parse(workoutsJson) : [];
    
    // Get server workouts
    const { data: serverWorkouts, error } = await supabase
      .from('workout_completions')
      .select('*')
      .eq('user_id', userId);
    
    if (error) {
      result.issues.push({
        type: 'missing_server',
        dataType: 'workouts',
        description: 'Could not fetch workout data from server',
        autoRepairable: false,
        repaired: false
      });
      return;
    }
    
    // Create a map of server workouts by ID
    const serverWorkoutMap = (serverWorkouts || []).reduce((acc, workout) => {
      acc[workout.id] = workout;
      return acc;
    }, {} as Record<string, any>);
    
    // Check for local workouts without server IDs
    const workoutsWithoutServerId = localWorkouts.filter(w => !w.server_id);
    if (workoutsWithoutServerId.length > 0) {
      result.issues.push({
        type: 'missing_server',
        dataType: 'workouts',
        description: `${workoutsWithoutServerId.length} local workouts are not synced to the server`,
        autoRepairable: true,
        repaired: false
      });
      
      // These will be handled by the synchronization system
      // No immediate repair needed
    }
    
    // Check for server workouts not in local storage
    const localWorkoutIds = new Set(localWorkouts.map(w => w.server_id).filter(Boolean));
    const missingLocalWorkouts = (serverWorkouts || []).filter(w => !localWorkoutIds.has(w.id));
    
    if (missingLocalWorkouts.length > 0) {
      result.issues.push({
        type: 'missing_local',
        dataType: 'workouts',
        description: `${missingLocalWorkouts.length} server workouts are not in local storage`,
        autoRepairable: true,
        repaired: false
      });
      
      // Attempt to repair by adding server workouts to local storage
      try {
        // Transform server workouts to local format
        const workoutsToAdd = missingLocalWorkouts.map(workout => ({
          id: workout.id, // Use server ID as local ID for these restored items
          server_id: workout.id,
          workout_id: workout.workout_id,
          date: workout.workout_date,
          time_spent: workout.time_spent,
          completed_at: workout.completed_at,
          // Add any other fields needed in local format
        }));
        
        // Add to local workouts
        const updatedLocalWorkouts = [...localWorkouts, ...workoutsToAdd];
        await AsyncStorage.setItem('completed_workouts', JSON.stringify(updatedLocalWorkouts));
        
        result.issues[result.issues.length - 1].repaired = true;
        result.repairedCount++;
      } catch (repairError) {
        console.error('Error repairing workout data:', repairError);
      }
    }
  } catch (error) {
    console.error('Error checking workout data integrity:', error);
    result.issues.push({
      type: 'corruption',
      dataType: 'workouts',
      description: `Error checking workout data: ${error instanceof Error ? error.message : 'Unknown error'}`,
      autoRepairable: false,
      repaired: false
    });
  }
}

/**
 * Check meal data integrity
 */
async function checkMealData(
  userId: string, 
  result: IntegrityCheckResult
): Promise<void> {
  try {
    // Get local meals
    const mealsJson = await AsyncStorage.getItem('meals');
    const localMeals = mealsJson ? JSON.parse(mealsJson) : [];
    
    // Get server meals
    const { data: serverMeals, error } = await supabase
      .from('meal_completions')
      .select('*')
      .eq('user_id', userId);
    
    if (error) {
      result.issues.push({
        type: 'missing_server',
        dataType: 'meals',
        description: 'Could not fetch meal data from server',
        autoRepairable: false,
        repaired: false
      });
      return;
    }
    
    // Create a map of server meals by ID
    const serverMealMap = (serverMeals || []).reduce((acc, meal) => {
      acc[meal.id] = meal;
      return acc;
    }, {} as Record<string, any>);
    
    // Check for local meals without server IDs
    const mealsWithoutServerId = localMeals.filter(m => !m.server_id);
    if (mealsWithoutServerId.length > 0) {
      result.issues.push({
        type: 'missing_server',
        dataType: 'meals',
        description: `${mealsWithoutServerId.length} local meals are not synced to the server`,
        autoRepairable: true,
        repaired: false
      });
      
      // These will be handled by the synchronization system
      // No immediate repair needed
    }
    
    // Check for server meals not in local storage
    const localMealIds = new Set(localMeals.map(m => m.server_id).filter(Boolean));
    const missingLocalMeals = (serverMeals || []).filter(m => !localMealIds.has(m.id));
    
    if (missingLocalMeals.length > 0) {
      result.issues.push({
        type: 'missing_local',
        dataType: 'meals',
        description: `${missingLocalMeals.length} server meals are not in local storage`,
        autoRepairable: true,
        repaired: false
      });
      
      // Attempt to repair by adding server meals to local storage
      try {
        // Transform server meals to local format
        const mealsToAdd = missingLocalMeals.map(meal => ({
          id: meal.id, // Use server ID as local ID for these restored items
          server_id: meal.id,
          meal_type: meal.meal_type,
          date: meal.meal_date,
          meal_plan_id: meal.meal_plan_id,
          completed_at: meal.completed_at,
          // Add any other fields needed in local format
        }));
        
        // Add to local meals
        const updatedLocalMeals = [...localMeals, ...mealsToAdd];
        await AsyncStorage.setItem('meals', JSON.stringify(updatedLocalMeals));
        
        result.issues[result.issues.length - 1].repaired = true;
        result.repairedCount++;
      } catch (repairError) {
        console.error('Error repairing meal data:', repairError);
      }
    }
  } catch (error) {
    console.error('Error checking meal data integrity:', error);
    result.issues.push({
      type: 'corruption',
      dataType: 'meals',
      description: `Error checking meal data: ${error instanceof Error ? error.message : 'Unknown error'}`,
      autoRepairable: false,
      repaired: false
    });
  }
}

/**
 * Check profile data integrity
 */
async function checkProfileData(
  userId: string, 
  result: IntegrityCheckResult
): Promise<void> {
  try {
    // Get local profile
    const localProfileJson = await AsyncStorage.getItem('local_profile');
    const localProfile = localProfileJson ? JSON.parse(localProfileJson) : null;
    
    // Get server profile
    const { data: serverProfile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) {
      result.issues.push({
        type: 'missing_server',
        dataType: 'profile',
        description: 'Could not fetch server profile data',
        autoRepairable: false,
        repaired: false
      });
      return;
    }
    
    // Check for missing local profile
    if (!localProfile && serverProfile) {
      result.issues.push({
        type: 'missing_local',
        dataType: 'profile',
        description: 'Local profile is missing but server profile exists',
        autoRepairable: true,
        repaired: false
      });
      
      // Attempt to repair by creating local profile from server
      try {
        const newLocalProfile = {
          ...serverProfile,
          has_completed_local_onboarding: serverProfile.has_completed_onboarding
        };
        
        await AsyncStorage.setItem('local_profile', JSON.stringify(newLocalProfile));
        
        result.issues[result.issues.length - 1].repaired = true;
        result.repairedCount++;
      } catch (repairError) {
        console.error('Error creating local profile:', repairError);
      }
    }
    
    // Check for missing server profile
    if (localProfile && !serverProfile) {
      result.issues.push({
        type: 'missing_server',
        dataType: 'profile',
        description: 'Server profile is missing but local profile exists',
        autoRepairable: true,
        repaired: false
      });
      
      // Attempt to repair by creating server profile from local
      try {
        const { error: createError } = await supabase
          .from('profiles')
          .upsert({
            id: userId,
            has_completed_onboarding: localProfile.has_completed_local_onboarding,
            current_onboarding_step: localProfile.current_onboarding_step,
            // Add other fields as needed
          });
        
        if (!createError) {
          result.issues[result.issues.length - 1].repaired = true;
          result.repairedCount++;
        }
      } catch (repairError) {
        console.error('Error creating server profile:', repairError);
      }
    }
    
    // Check for incompatible data between local and server profiles
    if (localProfile && serverProfile) {
      const criticalFields = [
        'has_completed_onboarding',
        'current_onboarding_step',
        'diet_type',
        'fitness_level',
        'workout_days_per_week'
      ];
      
      const mismatches = criticalFields.filter(field => {
        const localValue = field === 'has_completed_onboarding' 
          ? localProfile.has_completed_local_onboarding 
          : localProfile[field];
        const serverValue = serverProfile[field];
        
        return localValue !== undefined && 
               serverValue !== undefined && 
               JSON.stringify(localValue) !== JSON.stringify(serverValue);
      });
      
      if (mismatches.length > 0) {
        result.issues.push({
          type: 'mismatch',
          dataType: 'profile',
          description: `Mismatches in ${mismatches.length} critical profile fields: ${mismatches.join(', ')}`,
          autoRepairable: true,
          repaired: false
        });
        
        // Attempt to repair by using the newer data
        try {
          const localUpdatedAt = new Date(localProfile.updated_at || 0).getTime();
          const serverUpdatedAt = new Date(serverProfile.updated_at || 0).getTime();
          
          if (serverUpdatedAt > localUpdatedAt) {
            // Server is newer, update local
            const updatedLocalProfile = {
              ...localProfile,
              ...serverProfile,
              has_completed_local_onboarding: serverProfile.has_completed_onboarding
            };
            
            await AsyncStorage.setItem('local_profile', JSON.stringify(updatedLocalProfile));
          } else {
            // Local is newer, update server
            const updatedServerProfile = {
              ...serverProfile,
              ...mismatches.reduce((acc, field) => {
                if (field === 'has_completed_onboarding') {
                  acc[field] = localProfile.has_completed_local_onboarding;
                } else {
                  acc[field] = localProfile[field];
                }
                return acc;
              }, {} as Record<string, any>),
              updated_at: new Date().toISOString()
            };
            
            await supabase
              .from('profiles')
              .update(updatedServerProfile)
              .eq('id', userId);
          }
          
          result.issues[result.issues.length - 1].repaired = true;
          result.repairedCount++;
        } catch (repairError) {
          console.error('Error repairing profile mismatches:', repairError);
        }
      }
    }
  } catch (error) {
    console.error('Error checking profile data integrity:', error);
    result.issues.push({
      type: 'corruption',
      dataType: 'profile',
      description: `Error checking profile data: ${error instanceof Error ? error.message : 'Unknown error'}`,
      autoRepairable: false,
      repaired: false
    });
  }
}

/**
 * Check JSON fields in profile (body measurements, nutrition tracking)
 */
async function checkProfileJsonFields(
  userId: string, 
  result: IntegrityCheckResult
): Promise<void> {
  try {
    // Get server profile with JSON fields
    const { data: serverProfile, error } = await supabase
      .from('profiles')
      .select('body_analysis, meal_tracking')
      .eq('id', userId)
      .single();
    
    if (error) {
      result.issues.push({
        type: 'missing_server',
        dataType: 'profile_json',
        description: 'Could not fetch profile JSON fields from server',
        autoRepairable: false,
        repaired: false
      });
      return;
    }
    
    // Check body measurements
    const measurementsJson = await AsyncStorage.getItem('body_measurements');
    const localMeasurements = measurementsJson ? JSON.parse(measurementsJson) : [];
    const serverMeasurements = serverProfile?.body_analysis || [];
    
    // If server has measurements but local doesn't
    if (Array.isArray(serverMeasurements) && serverMeasurements.length > 0 && localMeasurements.length === 0) {
      result.issues.push({
        type: 'missing_local',
        dataType: 'body_measurements',
        description: 'Server has body measurements but local storage does not',
        autoRepairable: true,
        repaired: false
      });
      
      // Attempt to repair
      try {
        await AsyncStorage.setItem('body_measurements', JSON.stringify(serverMeasurements));
        result.issues[result.issues.length - 1].repaired = true;
        result.repairedCount++;
      } catch (repairError) {
        console.error('Error repairing body measurements:', repairError);
      }
    }
    
    // If local has measurements but server doesn't or has fewer
    if (localMeasurements.length > 0 && 
        (!Array.isArray(serverMeasurements) || localMeasurements.length > serverMeasurements.length)) {
      result.issues.push({
        type: 'missing_server',
        dataType: 'body_measurements',
        description: 'Local has more body measurements than server',
        autoRepairable: true,
        repaired: false
      });
      
      // This will be handled by the synchronization system
      // We won't attempt immediate repair
    }
    
    // Check nutrition tracking
    const nutritionJson = await AsyncStorage.getItem('nutrition_tracking');
    const localNutrition = nutritionJson ? JSON.parse(nutritionJson) : [];
    const serverNutrition = serverProfile?.meal_tracking || [];
    
    // If server has nutrition data but local doesn't
    if (Array.isArray(serverNutrition) && serverNutrition.length > 0 && localNutrition.length === 0) {
      result.issues.push({
        type: 'missing_local',
        dataType: 'nutrition_tracking',
        description: 'Server has nutrition data but local storage does not',
        autoRepairable: true,
        repaired: false
      });
      
      // Attempt to repair
      try {
        await AsyncStorage.setItem('nutrition_tracking', JSON.stringify(serverNutrition));
        result.issues[result.issues.length - 1].repaired = true;
        result.repairedCount++;
      } catch (repairError) {
        console.error('Error repairing nutrition data:', repairError);
      }
    }
    
    // If local has nutrition data but server doesn't or has fewer
    if (localNutrition.length > 0 && 
        (!Array.isArray(serverNutrition) || localNutrition.length > serverNutrition.length)) {
      result.issues.push({
        type: 'missing_server',
        dataType: 'nutrition_tracking',
        description: 'Local has more nutrition data than server',
        autoRepairable: true,
        repaired: false
      });
      
      // This will be handled by the synchronization system
      // We won't attempt immediate repair
    }
  } catch (error) {
    console.error('Error checking profile JSON fields:', error);
    result.issues.push({
      type: 'corruption',
      dataType: 'profile_json',
      description: `Error checking profile JSON fields: ${error instanceof Error ? error.message : 'Unknown error'}`,
      autoRepairable: false,
      repaired: false
    });
  }
}

/**
 * Perform deep data recovery in case of severe issues
 * This is a more aggressive repair process that creates a new synchronization baseline
 */
export async function performDeepDataRecovery(
  userId: string
): Promise<{ success: boolean; message: string }> {
  try {
    console.log('🔄 Starting deep data recovery process...');
    
    // 1. Create backup of current state
    const allKeys = await AsyncStorage.getAllKeys();
    const backupData: Record<string, any> = {};
    
    for (const key of allKeys) {
      try {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          backupData[key] = value;
        }
      } catch (e) {
        console.warn(`Could not backup key ${key}:`, e);
      }
    }
    
    // Save backup
    const backupKey = `data_recovery_backup_${Date.now()}`;
    await AsyncStorage.setItem(backupKey, JSON.stringify(backupData));
    
    // 2. Reset synchronization metadata
    await forceResync();
    
    // 3. Rebuild local data from server
    // 3.1. Get profile
    const { data: serverProfile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (profileError) {
      return {
        success: false,
        message: 'Could not fetch profile from server for recovery'
      };
    }
    
    // 3.2. Save profile locally
    await AsyncStorage.setItem('local_profile', JSON.stringify({
      ...serverProfile,
      has_completed_local_onboarding: serverProfile.has_completed_onboarding
    }));
    
    // 3.3. Update onboarding status
    await AsyncStorage.setItem('onboarding_status', JSON.stringify({
      completed: serverProfile.has_completed_onboarding,
      timestamp: Date.now(),
      version: 1,
      step: serverProfile.current_onboarding_step
    }));
    
    // 3.4. Get workout data
    const { data: workouts, error: workoutsError } = await supabase
      .from('workout_completions')
      .select('*')
      .eq('user_id', userId);
    
    if (!workoutsError && workouts) {
      // Convert server format to local format
      const localWorkouts = workouts.map(workout => ({
        id: workout.id,
        server_id: workout.id,
        workout_id: workout.workout_id,
        date: workout.workout_date,
        time_spent: workout.time_spent,
        completed_at: workout.completed_at,
        // Add any other fields needed
      }));
      
      await AsyncStorage.setItem('completed_workouts', JSON.stringify(localWorkouts));
    }
    
    // 3.5. Get meal data
    const { data: meals, error: mealsError } = await supabase
      .from('meal_completions')
      .select('*')
      .eq('user_id', userId);
    
    if (!mealsError && meals) {
      // Convert server format to local format
      const localMeals = meals.map(meal => ({
        id: meal.id,
        server_id: meal.id,
        meal_type: meal.meal_type,
        date: meal.meal_date,
        meal_plan_id: meal.meal_plan_id,
        completed_at: meal.completed_at,
        // Add any other fields needed
      }));
      
      await AsyncStorage.setItem('meals', JSON.stringify(localMeals));
    }
    
    // 3.6. Get JSON fields from profile
    if (serverProfile.body_analysis) {
      await AsyncStorage.setItem('body_measurements', JSON.stringify(serverProfile.body_analysis));
    }
    
    if (serverProfile.meal_tracking) {
      await AsyncStorage.setItem('nutrition_tracking', JSON.stringify(serverProfile.meal_tracking));
    }
    
    // 4. Run a verification check
    const verificationResult = await verifyDataIntegrity(userId);
    
    if (verificationResult.issues.length === 0) {
      return {
        success: true,
        message: 'Deep data recovery completed successfully. All data is now consistent.'
      };
    } else {
      return {
        success: true,
        message: `Deep data recovery completed with ${verificationResult.issues.length} remaining issues that couldn't be fixed automatically.`
      };
    }
  } catch (error) {
    console.error('Error during deep data recovery:', error);
    return {
      success: false,
      message: `Deep data recovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}
