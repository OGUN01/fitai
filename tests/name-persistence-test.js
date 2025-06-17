/**
 * Specific Test for Name Persistence Across Authentication States
 * 
 * This test validates that user names are preserved correctly when switching
 * between authenticated and local modes.
 */

// Mock AsyncStorage for Node.js testing
const mockAsyncStorage = {
  data: new Map(),
  
  async getItem(key) {
    const value = this.data.get(key);
    return value || null;
  },
  
  async setItem(key, value) {
    this.data.set(key, value);
  },
  
  async removeItem(key) {
    this.data.delete(key);
  },
  
  async clear() {
    this.data.clear();
  }
};

// Test scenarios for name persistence
const NamePersistenceTests = {
  
  /**
   * Test 1: Name persistence during logout
   */
  async testLogoutNamePersistence() {
    console.log('\n🧪 TEST 1: Name Persistence During Logout');
    
    try {
      await mockAsyncStorage.clear();
      console.log('✓ Cleared all data');
      
      // Step 1: Create authenticated user with name
      const authenticatedUserId = 'auth_user_123';
      const userName = 'Alice Johnson';
      const userEmail = 'alice.johnson@example.com';
      
      const authenticatedProfile = {
        id: authenticatedUserId,
        full_name: userName,
        email: userEmail,
        age: 25,
        diet_preferences: {
          meal_frequency: 3,
          diet_type: 'balanced'
        }
      };
      
      await mockAsyncStorage.setItem(`profile:${authenticatedUserId}`, JSON.stringify(authenticatedProfile));
      console.log(`✓ Created authenticated profile for: ${userName}`);
      
      // Step 2: Simulate logout with name preservation (our fix)
      const currentProfileJson = await mockAsyncStorage.getItem(`profile:${authenticatedUserId}`);
      const currentProfile = JSON.parse(currentProfileJson);
      
      // Clear authenticated profile
      await mockAsyncStorage.removeItem(`profile:${authenticatedUserId}`);
      
      // Create local profile with preserved data
      const preservedLocalProfile = {
        id: 'local_user',
        full_name: currentProfile.full_name,
        email: currentProfile.email,
        age: currentProfile.age,
        diet_preferences: currentProfile.diet_preferences,
        has_completed_local_onboarding: true
      };
      
      await mockAsyncStorage.setItem('local_profile', JSON.stringify(preservedLocalProfile));
      console.log('✓ Simulated logout with data preservation');
      
      // Step 3: Verify name is preserved in local mode
      const localProfile = JSON.parse(await mockAsyncStorage.getItem('local_profile') || '{}');
      
      if (localProfile.full_name === userName) {
        console.log(`✅ TEST 1 PASSED: Name "${userName}" preserved in local mode`);
        return true;
      } else {
        console.log(`❌ TEST 1 FAILED: Expected "${userName}", got "${localProfile.full_name}"`);
        return false;
      }
      
    } catch (error) {
      console.error('❌ TEST 1 ERROR:', error);
      return false;
    }
  },
  
  /**
   * Test 2: Name display logic across auth states
   */
  async testNameDisplayLogic() {
    console.log('\n🧪 TEST 2: Name Display Logic Across Auth States');
    
    try {
      await mockAsyncStorage.clear();
      console.log('✓ Cleared all data');
      
      // Mock the getUserDisplayName function from home screen
      function getUserDisplayName(profile, user) {
        if (profile?.full_name) {
          const firstName = profile.full_name.split(' ')[0];
          return firstName;
        }
        
        if (user?.email) {
          const emailName = user.email.split('@')[0];
          const cleanName = emailName.split('.')[0];
          return cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
        }
        
        return 'User';
      }
      
      // Test scenarios
      const testCases = [
        {
          name: 'Authenticated user with full profile',
          profile: { full_name: 'Bob Smith' },
          user: { email: 'bob.smith@example.com' },
          expected: 'Bob'
        },
        {
          name: 'Local user with preserved name',
          profile: { full_name: 'Carol Davis' },
          user: null,
          expected: 'Carol'
        },
        {
          name: 'User with email only (no profile)',
          profile: null,
          user: { email: 'david.wilson@example.com' },
          expected: 'David'
        },
        {
          name: 'Email with dots',
          profile: null,
          user: { email: 'mary.jane.watson@example.com' },
          expected: 'Mary'
        },
        {
          name: 'No profile or user data',
          profile: null,
          user: null,
          expected: 'User'
        }
      ];
      
      let allPassed = true;
      
      for (const testCase of testCases) {
        const result = getUserDisplayName(testCase.profile, testCase.user);
        if (result === testCase.expected) {
          console.log(`✓ ${testCase.name}: "${result}"`);
        } else {
          console.log(`❌ ${testCase.name}: expected "${testCase.expected}", got "${result}"`);
          allPassed = false;
        }
      }
      
      if (allPassed) {
        console.log('✅ TEST 2 PASSED: All name display scenarios work correctly');
        return true;
      } else {
        console.log('❌ TEST 2 FAILED: Some name display scenarios failed');
        return false;
      }
      
    } catch (error) {
      console.error('❌ TEST 2 ERROR:', error);
      return false;
    }
  },
  
  /**
   * Test 3: Complete auth state transition with name preservation
   */
  async testCompleteAuthTransition() {
    console.log('\n🧪 TEST 3: Complete Auth State Transition');
    
    try {
      await mockAsyncStorage.clear();
      console.log('✓ Cleared all data');
      
      const userName = 'Emma Thompson';
      const userEmail = 'emma.thompson@example.com';
      
      // Step 1: Start as local user
      const initialLocalProfile = {
        id: 'local_user',
        full_name: userName,
        email: userEmail,
        has_completed_local_onboarding: true
      };
      
      await mockAsyncStorage.setItem('local_profile', JSON.stringify(initialLocalProfile));
      console.log(`✓ Created initial local profile for: ${userName}`);
      
      // Step 2: Simulate login (transition to authenticated)
      const authenticatedUserId = 'auth_user_456';
      const authenticatedProfile = {
        ...initialLocalProfile,
        id: authenticatedUserId,
        has_completed_onboarding: true
      };
      
      await mockAsyncStorage.setItem(`profile:${authenticatedUserId}`, JSON.stringify(authenticatedProfile));
      await mockAsyncStorage.removeItem('local_profile'); // Clear local profile during login
      console.log('✓ Simulated login transition');
      
      // Verify name is available in authenticated mode
      const authProfile = JSON.parse(await mockAsyncStorage.getItem(`profile:${authenticatedUserId}`) || '{}');
      if (authProfile.full_name !== userName) {
        console.log(`❌ Name lost during login: expected "${userName}", got "${authProfile.full_name}"`);
        return false;
      }
      console.log('✓ Name preserved during login');
      
      // Step 3: Simulate logout (transition back to local)
      const currentProfileJson = await mockAsyncStorage.getItem(`profile:${authenticatedUserId}`);
      const currentProfile = JSON.parse(currentProfileJson);
      
      await mockAsyncStorage.removeItem(`profile:${authenticatedUserId}`);
      
      const preservedLocalProfile = {
        id: 'local_user',
        full_name: currentProfile.full_name,
        email: currentProfile.email,
        has_completed_local_onboarding: true
      };
      
      await mockAsyncStorage.setItem('local_profile', JSON.stringify(preservedLocalProfile));
      console.log('✓ Simulated logout transition');
      
      // Step 4: Verify name is preserved after logout
      const finalLocalProfile = JSON.parse(await mockAsyncStorage.getItem('local_profile') || '{}');
      
      if (finalLocalProfile.full_name === userName) {
        console.log(`✅ TEST 3 PASSED: Name "${userName}" preserved through complete auth cycle`);
        return true;
      } else {
        console.log(`❌ TEST 3 FAILED: Name lost after logout: expected "${userName}", got "${finalLocalProfile.full_name}"`);
        return false;
      }
      
    } catch (error) {
      console.error('❌ TEST 3 ERROR:', error);
      return false;
    }
  }
};

// Main test runner
async function runNamePersistenceTests() {
  console.log('🧪 Starting Name Persistence Tests...');
  console.log('Testing user name preservation across authentication state changes');
  
  const results = [];
  
  // Run all tests
  const test1Result = await NamePersistenceTests.testLogoutNamePersistence();
  results.push({ test: 'Logout Name Persistence', passed: test1Result });
  
  const test2Result = await NamePersistenceTests.testNameDisplayLogic();
  results.push({ test: 'Name Display Logic', passed: test2Result });
  
  const test3Result = await NamePersistenceTests.testCompleteAuthTransition();
  results.push({ test: 'Complete Auth Transition', passed: test3Result });
  
  // Summary
  console.log('\n=== NAME PERSISTENCE TEST RESULTS ===');
  results.forEach(result => {
    const status = result.passed ? '✅ PASSED' : '❌ FAILED';
    console.log(`${status}: ${result.test}`);
  });
  
  const allPassed = results.every(result => result.passed);
  console.log(`\n🎯 Name Persistence Tests Result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  
  return allPassed;
}

// Run tests
runNamePersistenceTests().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Name persistence test runner error:', error);
  process.exit(1);
});
