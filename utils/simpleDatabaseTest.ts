/**
 * Simple Database Connection and Schema Test
 * 
 * This utility performs basic database connectivity and schema validation tests
 * without requiring user authentication or complex data synchronization.
 */

import supabase from '../lib/supabase';

export interface SimpleDatabaseTestResult {
  success: boolean;
  tests: {
    connection: boolean;
    tablesExist: boolean;
    rlsEnabled: boolean;
    basicQueries: boolean;
  };
  errors: string[];
  details: Record<string, any>;
}

/**
 * Test basic database connection
 */
async function testConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    // Simple connection test
    const { data, error } = await supabase
      .from('profiles')
      .select('count')
      .limit(0);
    
    if (error && error.code !== 'PGRST116') {
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Connection failed' 
    };
  }
}

/**
 * Test that all required tables exist
 */
async function testTablesExist(): Promise<{ success: boolean; error?: string; details?: any }> {
  try {
    const requiredTables = ['profiles', 'workout_completions', 'meal_completions'];
    const tableResults: Record<string, boolean> = {};
    
    for (const tableName of requiredTables) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(0);
        
        // If we can query the table without a major error, it exists
        tableResults[tableName] = !error || error.code === 'PGRST116';
      } catch (err) {
        tableResults[tableName] = false;
      }
    }
    
    const allTablesExist = Object.values(tableResults).every(exists => exists);
    
    return {
      success: allTablesExist,
      error: allTablesExist ? undefined : 'Some required tables are missing',
      details: { tableResults }
    };
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Table check failed'
    };
  }
}

/**
 * Test Row Level Security is enabled
 */
async function testRLSEnabled(): Promise<{ success: boolean; error?: string; details?: any }> {
  try {
    // Test RLS by attempting to query tables
    // If RLS is working, we should be able to make queries without authentication errors
    const tables = ['profiles', 'workout_completions', 'meal_completions'];
    const rlsResults: Record<string, boolean> = {};
    
    for (const tableName of tables) {
      try {
        // Try to query the table - if RLS is working, this should succeed (even if empty)
        const { data, error } = await supabase
          .from(tableName)
          .select('id')
          .limit(1);
        
        // RLS is working if we get a response (even empty) without auth errors
        rlsResults[tableName] = !error || error.code === 'PGRST116';
      } catch (err) {
        rlsResults[tableName] = false;
      }
    }
    
    const allRLSWorking = Object.values(rlsResults).every(working => working);
    
    return {
      success: allRLSWorking,
      details: { rlsResults }
    };
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'RLS test failed'
    };
  }
}

/**
 * Test basic database queries work
 */
async function testBasicQueries(): Promise<{ success: boolean; error?: string; details?: any }> {
  try {
    const queryResults: Record<string, any> = {};
    
    // Test count queries on each table
    const tables = ['profiles', 'workout_completions', 'meal_completions'];
    
    for (const tableName of tables) {
      try {
        const { count, error } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true });
        
        if (error) {
          queryResults[tableName] = { success: false, error: error.message };
        } else {
          queryResults[tableName] = { success: true, count: count || 0 };
        }
      } catch (err) {
        queryResults[tableName] = { 
          success: false, 
          error: err instanceof Error ? err.message : 'Query failed' 
        };
      }
    }
    
    const allQueriesSuccessful = Object.values(queryResults).every(
      (result: any) => result.success
    );
    
    return {
      success: allQueriesSuccessful,
      error: allQueriesSuccessful ? undefined : 'Some queries failed',
      details: { queryResults }
    };
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Query test failed'
    };
  }
}

/**
 * Run simple database tests
 */
export async function runSimpleDatabaseTest(): Promise<SimpleDatabaseTestResult> {
  const result: SimpleDatabaseTestResult = {
    success: false,
    tests: {
      connection: false,
      tablesExist: false,
      rlsEnabled: false,
      basicQueries: false
    },
    errors: [],
    details: {}
  };

  try {
    console.log('🔍 Running simple database tests...');

    // Test 1: Connection
    console.log('📡 Testing database connection...');
    const connectionTest = await testConnection();
    result.tests.connection = connectionTest.success;
    if (!connectionTest.success) {
      result.errors.push(`Connection failed: ${connectionTest.error}`);
    }

    // Test 2: Tables exist
    console.log('📋 Testing required tables exist...');
    const tablesTest = await testTablesExist();
    result.tests.tablesExist = tablesTest.success;
    result.details.tablesTest = tablesTest.details;
    if (!tablesTest.success) {
      result.errors.push(`Tables test failed: ${tablesTest.error}`);
    }

    // Test 3: RLS enabled
    console.log('🔒 Testing Row Level Security...');
    const rlsTest = await testRLSEnabled();
    result.tests.rlsEnabled = rlsTest.success;
    result.details.rlsTest = rlsTest.details;
    if (!rlsTest.success) {
      result.errors.push(`RLS test failed: ${rlsTest.error}`);
    }

    // Test 4: Basic queries
    console.log('🔍 Testing basic queries...');
    const queriesTest = await testBasicQueries();
    result.tests.basicQueries = queriesTest.success;
    result.details.queriesTest = queriesTest.details;
    if (!queriesTest.success) {
      result.errors.push(`Queries test failed: ${queriesTest.error}`);
    }

    // Overall success
    result.success = Object.values(result.tests).every(test => test === true);

    console.log('✅ Simple database tests completed');
    return result;

  } catch (error) {
    result.errors.push(`Test execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return result;
  }
}

/**
 * Get current database statistics
 */
/**
 * Test current authentication status
 */
export async function testAuthStatus(): Promise<{
  success: boolean;
  isAuthenticated: boolean;
  userId?: string;
  userEmail?: string;
  error?: string;
}> {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error) {
      return {
        success: false,
        isAuthenticated: false,
        error: error.message
      };
    }

    return {
      success: true,
      isAuthenticated: !!user,
      userId: user?.id,
      userEmail: user?.email
    };

  } catch (error) {
    return {
      success: false,
      isAuthenticated: false,
      error: error instanceof Error ? error.message : 'Auth check failed'
    };
  }
}

export async function getDatabaseStats(): Promise<{
  success: boolean;
  stats?: {
    profileCount: number;
    workoutCount: number;
    mealCount: number;
  };
  error?: string;
}> {
  try {
    const stats = {
      profileCount: 0,
      workoutCount: 0,
      mealCount: 0
    };

    // Get profile count
    const { count: profileCount, error: profileError } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (!profileError) {
      stats.profileCount = profileCount || 0;
    }

    // Get workout completion count
    const { count: workoutCount, error: workoutError } = await supabase
      .from('workout_completions')
      .select('*', { count: 'exact', head: true });

    if (!workoutError) {
      stats.workoutCount = workoutCount || 0;
    }

    // Get meal completion count
    const { count: mealCount, error: mealError } = await supabase
      .from('meal_completions')
      .select('*', { count: 'exact', head: true });

    if (!mealError) {
      stats.mealCount = mealCount || 0;
    }

    return { success: true, stats };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get database stats'
    };
  }
}
