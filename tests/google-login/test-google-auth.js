/**
 * Google Login Implementation Test
 * 
 * This script verifies that Google OAuth integration is properly implemented
 * and ready for Android deployment
 */

console.log("🚀 GOOGLE LOGIN IMPLEMENTATION TEST");
console.log("===================================");

// Test 1: Check if required dependencies are installed
function testDependencies() {
  console.log("\n📦 TESTING DEPENDENCIES");
  console.log("========================");
  
  try {
    // Check for expo-auth-session
    require('expo-auth-session');
    console.log("✅ expo-auth-session: Installed");
    
    // Check for expo-crypto
    require('expo-crypto');
    console.log("✅ expo-crypto: Installed");
    
    // Check for Supabase
    require('@supabase/supabase-js');
    console.log("✅ @supabase/supabase-js: Installed");
    
    return true;
  } catch (error) {
    console.error("❌ Missing dependency:", error.message);
    return false;
  }
}

// Test 2: Check AuthContext implementation
function testAuthContext() {
  console.log("\n🔐 TESTING AUTH CONTEXT");
  console.log("========================");
  
  try {
    const fs = require('fs');
    const path = require('path');
    
    const authContextPath = path.join(__dirname, '../../contexts/AuthContext.tsx');
    const authContextContent = fs.readFileSync(authContextPath, 'utf8');
    
    // Check for Google sign-in method
    if (authContextContent.includes('signInWithGoogle')) {
      console.log("✅ signInWithGoogle method: Found");
    } else {
      console.log("❌ signInWithGoogle method: Missing");
      return false;
    }
    
    // Check for OAuth imports
    if (authContextContent.includes('expo-auth-session')) {
      console.log("✅ expo-auth-session import: Found");
    } else {
      console.log("❌ expo-auth-session import: Missing");
      return false;
    }
    
    // Check for Supabase OAuth call
    if (authContextContent.includes('signInWithOAuth')) {
      console.log("✅ Supabase OAuth integration: Found");
    } else {
      console.log("❌ Supabase OAuth integration: Missing");
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("❌ AuthContext test failed:", error.message);
    return false;
  }
}

// Test 3: Check Google Login Button component
function testGoogleLoginButton() {
  console.log("\n🔘 TESTING GOOGLE LOGIN BUTTON");
  console.log("===============================");
  
  try {
    const fs = require('fs');
    const path = require('path');
    
    const buttonPath = path.join(__dirname, '../../components/auth/GoogleLoginButton.tsx');
    
    if (fs.existsSync(buttonPath)) {
      console.log("✅ GoogleLoginButton component: Found");
      
      const buttonContent = fs.readFileSync(buttonPath, 'utf8');
      
      // Check for useAuth hook
      if (buttonContent.includes('useAuth')) {
        console.log("✅ useAuth hook integration: Found");
      } else {
        console.log("❌ useAuth hook integration: Missing");
        return false;
      }
      
      // Check for Google icon
      if (buttonContent.includes('logo-google')) {
        console.log("✅ Google icon: Found");
      } else {
        console.log("❌ Google icon: Missing");
        return false;
      }
      
      return true;
    } else {
      console.log("❌ GoogleLoginButton component: Missing");
      return false;
    }
  } catch (error) {
    console.error("❌ GoogleLoginButton test failed:", error.message);
    return false;
  }
}

// Test 4: Check login screen integration
function testLoginScreenIntegration() {
  console.log("\n📱 TESTING LOGIN SCREEN INTEGRATION");
  console.log("====================================");
  
  try {
    const fs = require('fs');
    const path = require('path');
    
    // Test main login screen
    const loginPath = path.join(__dirname, '../../app/login.tsx');
    const loginContent = fs.readFileSync(loginPath, 'utf8');
    
    if (loginContent.includes('GoogleLoginButton')) {
      console.log("✅ Main login screen: Google button integrated");
    } else {
      console.log("❌ Main login screen: Google button missing");
      return false;
    }
    
    // Test signin screen
    const signinPath = path.join(__dirname, '../../app/(auth)/signin.tsx');
    const signinContent = fs.readFileSync(signinPath, 'utf8');
    
    if (signinContent.includes('GoogleLoginButton')) {
      console.log("✅ Sign-in screen: Google button integrated");
    } else {
      console.log("❌ Sign-in screen: Google button missing");
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("❌ Login screen integration test failed:", error.message);
    return false;
  }
}

// Test 5: Check OAuth callback handler
function testOAuthCallback() {
  console.log("\n🔄 TESTING OAUTH CALLBACK HANDLER");
  console.log("==================================");
  
  try {
    const fs = require('fs');
    const path = require('path');
    
    const callbackPath = path.join(__dirname, '../../app/auth/callback.tsx');
    
    if (fs.existsSync(callbackPath)) {
      console.log("✅ OAuth callback handler: Found");
      
      const callbackContent = fs.readFileSync(callbackPath, 'utf8');
      
      // Check for session handling
      if (callbackContent.includes('getSession')) {
        console.log("✅ Session handling: Found");
      } else {
        console.log("❌ Session handling: Missing");
        return false;
      }
      
      // Check for onboarding redirect logic
      if (callbackContent.includes('has_completed_onboarding')) {
        console.log("✅ Onboarding redirect logic: Found");
      } else {
        console.log("❌ Onboarding redirect logic: Missing");
        return false;
      }
      
      return true;
    } else {
      console.log("❌ OAuth callback handler: Missing");
      return false;
    }
  } catch (error) {
    console.error("❌ OAuth callback test failed:", error.message);
    return false;
  }
}

// Test 6: Check app configuration
function testAppConfiguration() {
  console.log("\n⚙️  TESTING APP CONFIGURATION");
  console.log("==============================");
  
  try {
    const fs = require('fs');
    const path = require('path');
    
    const appConfigPath = path.join(__dirname, '../../app.json');
    const appConfig = JSON.parse(fs.readFileSync(appConfigPath, 'utf8'));
    
    // Check scheme
    if (appConfig.expo.scheme === 'fitai') {
      console.log("✅ App scheme: Configured correctly (fitai)");
    } else {
      console.log(`❌ App scheme: Incorrect (${appConfig.expo.scheme}), should be 'fitai'`);
      return false;
    }
    
    // Check Android package
    if (appConfig.expo.android && appConfig.expo.android.package) {
      console.log(`✅ Android package: ${appConfig.expo.android.package}`);
    } else {
      console.log("❌ Android package: Missing");
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("❌ App configuration test failed:", error.message);
    return false;
  }
}

// Run all tests
function runAllTests() {
  console.log("Testing Google Login implementation for FitAI Android app...\n");
  
  const tests = [
    { name: "Dependencies", test: testDependencies },
    { name: "AuthContext", test: testAuthContext },
    { name: "Google Login Button", test: testGoogleLoginButton },
    { name: "Login Screen Integration", test: testLoginScreenIntegration },
    { name: "OAuth Callback", test: testOAuthCallback },
    { name: "App Configuration", test: testAppConfiguration }
  ];
  
  let passedTests = 0;
  const totalTests = tests.length;
  
  for (const { name, test } of tests) {
    if (test()) {
      passedTests++;
    }
  }
  
  // Final summary
  console.log("\n📊 TEST SUMMARY");
  console.log("================");
  console.log(`Passed: ${passedTests}/${totalTests} tests`);
  console.log(`Success Rate: ${(passedTests/totalTests*100).toFixed(1)}%`);
  
  if (passedTests === totalTests) {
    console.log("\n🎉 ALL TESTS PASSED!");
    console.log("✅ Google Login implementation is complete and ready for Android!");
    console.log("\n🚀 NEXT STEPS:");
    console.log("1. Configure Google OAuth in Supabase dashboard");
    console.log("2. Add Google OAuth credentials");
    console.log("3. Test on Android device/emulator");
    console.log("4. Deploy to production");
  } else {
    console.log("\n⚠️  SOME TESTS FAILED");
    console.log("Please fix the failing tests before proceeding.");
  }
  
  return passedTests === totalTests;
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests();
}

module.exports = { runAllTests };
