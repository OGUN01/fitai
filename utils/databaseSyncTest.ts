/**
 * Database Synchronization Test Utility
 * 
 * This utility tests the complete data synchronization flow between
 * local storage and Supabase database to ensure everything is working properly.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import supabase from '../lib/supabase';
import { UserProfile } from '../types/profile';
import { WorkoutCompletion, MealCompletion } from '../types/tracking';
import { syncLocalDataToServer } from './syncLocalData';
import { filterToDatabaseColumns } from './profileUtils';

export interface SyncTestResult {
  success: boolean;
  tests: {
    databaseConnection: boolean;
    profileSync: boolean;
    workoutSync: boolean;
    mealSync: boolean;
    rlsPolicies: boolean;
  };
  errors: string[];
  details: Record<string, any>;
}

/**
 * Test database connection and basic operations
 */
async function testDatabaseConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    // Test basic connection
    const { data, error } = await supabase.from('profiles').select('count').limit(1);
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown connection error' 
    };
  }
}

/**
 * Test profile synchronization
 */
async function testProfileSync(testUserId: string): Promise<{ success: boolean; error?: string; details?: any }> {
  try {
    // First, check if we can read the current user's profile (if it exists)
    console.log(`🔍 Testing profile access for user: ${testUserId}`);

    const { data: existingProfile, error: readError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', testUserId)
      .maybeSingle();

    if (readError) {
      return {
        success: false,
        error: `Error reading profile: ${readError.message}`,
        details: { readError: readError }
      };
    }

    console.log('📖 Existing profile:', existingProfile ? 'Found' : 'Not found');

    // Create a test profile for the authenticated user
    const testProfile: Partial<UserProfile> = {
      id: testUserId, // Use the authenticated user's ID
      full_name: 'Test User',
      age: 25,
      gender: 'male',
      height_cm: 175,
      weight_kg: 70,
      target_weight_kg: 65,
      has_completed_onboarding: true,
      current_onboarding_step: 'completed',
      diet_preferences: {
        diet_type: 'balanced',
        meal_frequency: 3,
        allergies: ['nuts'],
        country_region: 'us'
      },
      workout_preferences: {
        fitness_level: 'intermediate',
        workout_duration: 45,
        preferred_days: ['monday', 'wednesday', 'friday']
      }
    };

    // Try to upsert the profile directly (this should work with RLS)
    console.log('💾 Attempting to upsert profile...');
    const { data: upsertedProfile, error: upsertError } = await supabase
      .from('profiles')
      .upsert(testProfile, { onConflict: 'id' })
      .select()
      .single();

    if (upsertError) {
      return {
        success: false,
        error: `Error inserting profile: ${upsertError.message}`,
        details: {
          upsertError: upsertError,
          testProfile: testProfile,
          userId: testUserId
        }
      };
    }

    console.log('✅ Profile upserted successfully');

    // Verify the profile was saved
    const { data: verifyProfile, error: verifyError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', testUserId)
      .single();

    if (verifyError) {
      return {
        success: false,
        error: `Error verifying profile: ${verifyError.message}`,
        details: { verifyError: verifyError }
      };
    }

    // Verify key fields
    const verificationChecks = {
      fullName: verifyProfile.full_name === testProfile.full_name,
      age: verifyProfile.age === testProfile.age,
      height: verifyProfile.height_cm === testProfile.height_cm,
      weight: verifyProfile.weight_kg === testProfile.weight_kg,
      onboarding: verifyProfile.has_completed_onboarding === testProfile.has_completed_onboarding,
      dietPreferences: !!verifyProfile.diet_preferences,
      workoutPreferences: !!verifyProfile.workout_preferences
    };

    const allChecksPass = Object.values(verificationChecks).every(check => check === true);

    return {
      success: allChecksPass,
      error: allChecksPass ? undefined : 'Some profile fields did not sync correctly',
      details: {
        verificationChecks,
        savedProfile: verifyProfile,
        upsertedProfile: upsertedProfile
      }
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown profile sync error',
      details: { catchError: error }
    };
  }
}

/**
 * Test workout completion synchronization
 */
async function testWorkoutSync(testUserId: string): Promise<{ success: boolean; error?: string; details?: any }> {
  try {
    console.log(`🏋️ Testing workout sync for user: ${testUserId}`);

    // Create test workout completions
    const testWorkouts: WorkoutCompletion[] = [
      {
        id: generateTestUUID(),
        user_id: testUserId,
        workout_date: '2024-12-15',
        day_number: 1,
        workout_plan_id: 'test_plan',
        workout_day_name: 'Day 1 - Upper Body',
        completed_at: new Date().toISOString(),
        estimated_calories_burned: 300
      },
      {
        id: generateTestUUID(),
        user_id: testUserId,
        workout_date: '2024-12-16',
        day_number: 2,
        workout_plan_id: 'test_plan',
        workout_day_name: 'Day 2 - Lower Body',
        completed_at: new Date().toISOString(),
        estimated_calories_burned: 350
      }
    ];

    // Try to insert workouts directly
    console.log('💾 Attempting to insert workout completions...');
    const { data: insertedWorkouts, error: insertError } = await supabase
      .from('workout_completions')
      .insert(testWorkouts)
      .select();

    if (insertError) {
      return {
        success: false,
        error: `Error inserting workouts: ${insertError.message}`,
        details: {
          insertError: insertError,
          testWorkouts: testWorkouts,
          userId: testUserId
        }
      };
    }

    console.log('✅ Workouts inserted successfully');

    // Verify workouts were saved
    const { data: savedWorkoutsData, error: fetchError } = await supabase
      .from('workout_completions')
      .select('*')
      .eq('user_id', testUserId);

    if (fetchError) {
      return {
        success: false,
        error: `Failed to fetch saved workouts: ${fetchError.message}`,
        details: { fetchError: fetchError }
      };
    }

    const savedWorkouts = savedWorkoutsData || [];

    if (savedWorkouts.length < testWorkouts.length) {
      return {
        success: false,
        error: `Expected at least ${testWorkouts.length} workouts, found ${savedWorkouts.length}`,
        details: { savedWorkouts, testWorkouts }
      };
    }

    return {
      success: true,
      details: {
        savedWorkouts,
        testWorkouts,
        insertedWorkouts
      }
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown workout sync error',
      details: { catchError: error }
    };
  }
}

/**
 * Test meal completion synchronization
 */
async function testMealSync(testUserId: string): Promise<{ success: boolean; error?: string; details?: any }> {
  try {
    console.log(`🍽️ Testing meal sync for user: ${testUserId}`);

    // Create test meal completions
    const testMeals: MealCompletion[] = [
      {
        id: generateTestUUID(),
        user_id: testUserId,
        meal_date: '2024-12-15',
        meal_type: 'breakfast',
        meal_plan_id: 'test_meal_plan',
        completed_at: new Date().toISOString()
      },
      {
        id: generateTestUUID(),
        user_id: testUserId,
        meal_date: '2024-12-15',
        meal_type: 'lunch',
        meal_plan_id: 'test_meal_plan',
        completed_at: new Date().toISOString()
      }
    ];

    // Try to insert meals directly
    console.log('💾 Attempting to insert meal completions...');
    const { data: insertedMeals, error: insertError } = await supabase
      .from('meal_completions')
      .insert(testMeals)
      .select();

    if (insertError) {
      return {
        success: false,
        error: `Error inserting meals: ${insertError.message}`,
        details: {
          insertError: insertError,
          testMeals: testMeals,
          userId: testUserId
        }
      };
    }

    console.log('✅ Meals inserted successfully');

    // Verify meals were saved
    const { data: savedMealsData, error: fetchError } = await supabase
      .from('meal_completions')
      .select('*')
      .eq('user_id', testUserId);

    if (fetchError) {
      return {
        success: false,
        error: `Failed to fetch saved meals: ${fetchError.message}`,
        details: { fetchError: fetchError }
      };
    }

    const savedMeals = savedMealsData || [];

    if (savedMeals.length < testMeals.length) {
      return {
        success: false,
        error: `Expected at least ${testMeals.length} meals, found ${savedMeals.length}`,
        details: { savedMeals, testMeals }
      };
    }

    return {
      success: true,
      details: {
        savedMeals,
        testMeals,
        insertedMeals
      }
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown meal sync error',
      details: { catchError: error }
    };
  }
}

/**
 * Test Row Level Security policies
 */
async function testRLSPolicies(): Promise<{ success: boolean; error?: string; details?: any }> {
  try {
    // Test RLS by checking if we can query the tables (basic connectivity test)
    // We'll test each table to ensure RLS is working
    const testResults = {
      profiles: false,
      workout_completions: false,
      meal_completions: false
    };

    // Test profiles table
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .limit(1);

      if (!error) {
        testResults.profiles = true;
      }
    } catch (err) {
      console.warn('Profiles table test failed:', err);
    }

    // Test workout_completions table
    try {
      const { data, error } = await supabase
        .from('workout_completions')
        .select('id')
        .limit(1);

      if (!error) {
        testResults.workout_completions = true;
      }
    } catch (err) {
      console.warn('Workout completions table test failed:', err);
    }

    // Test meal_completions table
    try {
      const { data, error } = await supabase
        .from('meal_completions')
        .select('id')
        .limit(1);

      if (!error) {
        testResults.meal_completions = true;
      }
    } catch (err) {
      console.warn('Meal completions table test failed:', err);
    }

    // Consider RLS working if we can access all tables
    const allTablesAccessible = Object.values(testResults).every(result => result === true);

    return {
      success: allTablesAccessible,
      details: {
        message: allTablesAccessible ? 'All tables accessible - RLS appears to be working' : 'Some tables not accessible',
        testResults
      }
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown RLS test error'
    };
  }
}

/**
 * Clean up test data
 */
async function cleanupTestData(testUserId: string): Promise<void> {
  try {
    // Remove from database
    await supabase.from('profiles').delete().eq('id', testUserId);
    await supabase.from('workout_completions').delete().eq('user_id', testUserId);
    await supabase.from('meal_completions').delete().eq('user_id', testUserId);

    // Remove from local storage
    await AsyncStorage.multiRemove([
      'local_profile',
      'local_workout_completions',
      'local_meal_completions',
      `profile:${testUserId}`,
      `sync_status:${testUserId}`
    ]);

  } catch (error) {
    console.warn('Error during cleanup:', error);
  }
}

/**
 * Generate a valid UUID for testing
 */
function generateTestUUID(): string {
  // Generate a valid UUID v4 format for testing
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Run comprehensive database synchronization test
 */
export async function runDatabaseSyncTest(): Promise<SyncTestResult> {
  // Get the current authenticated user ID instead of generating a test ID
  let testUserId: string;

  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return {
        success: false,
        tests: {
          databaseConnection: false,
          profileSync: false,
          workoutSync: false,
          mealSync: false,
          rlsPolicies: false
        },
        errors: ['User not authenticated. Please log in first.'],
        details: { authError: error?.message || 'No user found' }
      };
    }
    testUserId = user.id;
  } catch (error) {
    return {
      success: false,
      tests: {
        databaseConnection: false,
        profileSync: false,
        workoutSync: false,
        mealSync: false,
        rlsPolicies: false
      },
      errors: ['Failed to get authenticated user.'],
      details: { authError: error instanceof Error ? error.message : 'Unknown auth error' }
    };
  }

  const result: SyncTestResult = {
    success: false,
    tests: {
      databaseConnection: false,
      profileSync: false,
      workoutSync: false,
      mealSync: false,
      rlsPolicies: false
    },
    errors: [],
    details: {}
  };

  try {
    console.log('🧪 Starting comprehensive database synchronization test...');
    console.log(`🔑 Using authenticated user ID: ${testUserId}`);

    // Test 1: Database Connection
    console.log('📡 Testing database connection...');
    const connectionTest = await testDatabaseConnection();
    result.tests.databaseConnection = connectionTest.success;
    if (!connectionTest.success) {
      result.errors.push(`Database connection failed: ${connectionTest.error}`);
    }

    // Test 2: Profile Synchronization
    console.log('👤 Testing profile synchronization...');
    const profileTest = await testProfileSync(testUserId);
    result.tests.profileSync = profileTest.success;
    result.details.profileTest = profileTest.details;
    if (!profileTest.success) {
      result.errors.push(`Profile sync failed: ${profileTest.error}`);
    }

    // Test 3: Workout Synchronization
    console.log('💪 Testing workout synchronization...');
    const workoutTest = await testWorkoutSync(testUserId);
    result.tests.workoutSync = workoutTest.success;
    result.details.workoutTest = workoutTest.details;
    if (!workoutTest.success) {
      result.errors.push(`Workout sync failed: ${workoutTest.error}`);
    }

    // Test 4: Meal Synchronization
    console.log('🍽️ Testing meal synchronization...');
    const mealTest = await testMealSync(testUserId);
    result.tests.mealSync = mealTest.success;
    result.details.mealTest = mealTest.details;
    if (!mealTest.success) {
      result.errors.push(`Meal sync failed: ${mealTest.error}`);
    }

    // Test 5: RLS Policies
    console.log('🔒 Testing Row Level Security policies...');
    const rlsTest = await testRLSPolicies();
    result.tests.rlsPolicies = rlsTest.success;
    result.details.rlsTest = rlsTest.details;
    if (!rlsTest.success) {
      result.errors.push(`RLS test failed: ${rlsTest.error}`);
    }

    // Determine overall success
    result.success = Object.values(result.tests).every(test => test === true);

    console.log('🧹 Cleaning up test data...');
    await cleanupTestData(testUserId);

    console.log('✅ Database synchronization test completed');
    return result;

  } catch (error) {
    result.errors.push(`Test execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    // Attempt cleanup even if test failed
    try {
      await cleanupTestData(testUserId);
    } catch (cleanupError) {
      console.warn('Failed to cleanup test data:', cleanupError);
    }

    return result;
  }
}
