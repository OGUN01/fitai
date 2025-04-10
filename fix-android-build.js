#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('Applying Android build fixes...');

// Get the root directory
const rootDir = process.cwd();
const androidAppBuildGradlePath = path.join(rootDir, 'android', 'app', 'build.gradle');
const androidGradlePropertiesPath = path.join(rootDir, 'android', 'gradle.properties');

// Fix app/build.gradle - Add Flipper integration fix
try {
  if (fs.existsSync(androidAppBuildGradlePath)) {
    let buildGradleContent = fs.readFileSync(androidAppBuildGradlePath, 'utf8');
    
    // Check if fix is already applied
    if (!buildGradleContent.includes('Fix for Flipper integration issue')) {
      console.log('Adding Flipper integration fix to app/build.gradle');
      
      // Find the dependencies block
      const dependenciesBlock = buildGradleContent.match(/dependencies\s*\{[\s\S]*?\}/);
      if (dependenciesBlock) {
        const fixedDependenciesBlock = dependenciesBlock[0].replace(
          /}$/,
          `    
    // Fix for Flipper integration issue
    def enableFlipperIntegration = (System.getenv("FLIPPER_DISABLE") ?: "0") == "0"
    if (enableFlipperIntegration) {
        try {
            configurations.all {
                resolutionStrategy.dependencySubstitution {
                    substitute(module("com.facebook.react:flipper-integration"))
                        .using(module("com.facebook.react:flipper-integration:\${reactAndroidLibs.versions.react.get()}"))
                }
            }
        } catch (Exception e) {
            logger.error("Error configuring Flipper integration: " + e.getMessage())
        }
    }
}`
        );
        
        buildGradleContent = buildGradleContent.replace(dependenciesBlock[0], fixedDependenciesBlock);
        fs.writeFileSync(androidAppBuildGradlePath, buildGradleContent);
        console.log('Successfully updated app/build.gradle');
      } else {
        console.error('Could not find dependencies block in app/build.gradle');
      }
    } else {
      console.log('Flipper integration fix already applied in app/build.gradle');
    }
  } else {
    console.error('android/app/build.gradle not found');
  }
} catch (error) {
  console.error('Error updating app/build.gradle:', error);
}

// Fix gradle.properties - Disable Flipper for release builds
try {
  if (fs.existsSync(androidGradlePropertiesPath)) {
    let gradlePropertiesContent = fs.readFileSync(androidGradlePropertiesPath, 'utf8');
    
    // Check if the property is already added
    if (!gradlePropertiesContent.includes('reactNativeFlipperEnabled=false')) {
      console.log('Adding Flipper disable property to gradle.properties');
      gradlePropertiesContent += '\n\n# Disable Flipper for production builds (this will be overridden by FLIPPER_DISABLE env var if set)\nreactNativeFlipperEnabled=false\n';
      fs.writeFileSync(androidGradlePropertiesPath, gradlePropertiesContent);
      console.log('Successfully updated gradle.properties');
    } else {
      console.log('Flipper disable property already set in gradle.properties');
    }
  } else {
    console.error('android/gradle.properties not found');
  }
} catch (error) {
  console.error('Error updating gradle.properties:', error);
}

console.log('Android build fixes applied'); 