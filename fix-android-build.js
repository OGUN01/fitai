#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('Applying Android build fixes...');

// Get the root directory
const rootDir = process.cwd();
const androidAppBuildGradlePath = path.join(rootDir, 'android', 'app', 'build.gradle');
const androidGradlePropertiesPath = path.join(rootDir, 'android', 'gradle.properties');
const appJsonPath = path.join(rootDir, 'app.json');

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

    // Add dependency conflict resolution
    try {
      buildGradleContent = fs.readFileSync(androidAppBuildGradlePath, 'utf8');
      
      if (!buildGradleContent.includes('Resolution strategy for dependency conflicts')) {
        console.log('Adding dependency conflict resolution...');
        
        const dependenciesBlock = buildGradleContent.match(/dependencies\s*\{[\s\S]*?\}/);
        if (dependenciesBlock) {
          const fixedDependenciesBlock = dependenciesBlock[0].replace(
            /dependencies\s*\{/,
            `dependencies {
    // Resolution strategy for dependency conflicts
    configurations.all {
        resolutionStrategy {
            force "com.facebook.react:react-android:\${reactAndroidLibs.versions.react.get()}"
            force "com.facebook.react:react-native:\${reactAndroidLibs.versions.react.get()}"
            force "androidx.swiperefreshlayout:swiperefreshlayout:1.1.0"
            force "androidx.appcompat:appcompat:1.6.1"
        }
    }`
          );
          
          buildGradleContent = buildGradleContent.replace(dependenciesBlock[0], fixedDependenciesBlock);
          fs.writeFileSync(androidAppBuildGradlePath, buildGradleContent);
          console.log('Successfully added dependency conflict resolution');
        }
      } else {
        console.log('Dependency conflict resolution already exists');
      }
    } catch (depError) {
      console.error('Error adding dependency conflict resolution:', depError);
    }

    // Fix package ID mismatch
    try {
      // Get correct package ID from app.json
      if (fs.existsSync(appJsonPath)) {
        console.log('Checking package ID consistency...');
        const appJsonContent = fs.readFileSync(appJsonPath, 'utf8');
        const appJson = JSON.parse(appJsonContent);
        const correctPackageId = appJson.expo?.android?.package;
        
        if (correctPackageId) {
          console.log(`Correct package ID from app.json: ${correctPackageId}`);
          
          // Update build.gradle with latest content
          buildGradleContent = fs.readFileSync(androidAppBuildGradlePath, 'utf8');
          
          // Update namespace and applicationId in build.gradle
          const namespaceRegex = /namespace ['"]([^'"]+)['"]/;
          const applicationIdRegex = /applicationId ['"]([^'"]+)['"]/;
          
          if (namespaceRegex.test(buildGradleContent) && applicationIdRegex.test(buildGradleContent)) {
            buildGradleContent = buildGradleContent.replace(
              namespaceRegex,
              `namespace '${correctPackageId}'`
            );
            
            buildGradleContent = buildGradleContent.replace(
              applicationIdRegex,
              `applicationId '${correctPackageId}'`
            );
            
            fs.writeFileSync(androidAppBuildGradlePath, buildGradleContent);
            console.log('Successfully synchronized package ID in build.gradle');
          } else {
            console.log('Could not find namespace or applicationId in build.gradle');
          }
        } else {
          console.log('Could not find android.package in app.json');
        }
      } else {
        console.log('app.json not found, skipping package ID check');
      }
    } catch (packageError) {
      console.error('Error updating package ID:', packageError);
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

// Fix for buildToolsVersion and SDK versions
try {
  if (fs.existsSync(path.join(rootDir, 'android', 'build.gradle'))) {
    console.log('Checking Android SDK versions...');
    const rootBuildGradleContent = fs.readFileSync(path.join(rootDir, 'android', 'build.gradle'), 'utf8');
    
    // Check buildToolsVersion
    const buildToolsRegex = /buildToolsVersion\s*=\s*findProperty\('android\.buildToolsVersion'\)\s*\?\:\s*['"]([^'"]+)['"]/;
    const buildToolsMatch = rootBuildGradleContent.match(buildToolsRegex);
    
    if (buildToolsMatch && buildToolsMatch[1] === '35.0.0') {
      console.log('Fixing buildToolsVersion to a valid version...');
      const fixedBuildGradle = rootBuildGradleContent.replace(
        buildToolsRegex,
        "buildToolsVersion = findProperty('android.buildToolsVersion') ?: '34.0.0'"
      );
      
      fs.writeFileSync(path.join(rootDir, 'android', 'build.gradle'), fixedBuildGradle);
      console.log('Successfully updated buildToolsVersion to 34.0.0');
    } else {
      console.log('buildToolsVersion is already set to a valid version');
    }
    
    // Check compileSdkVersion
    const compileSdkRegex = /compileSdkVersion\s*=\s*Integer\.parseInt\(findProperty\('android\.compileSdkVersion'\)\s*\?\:\s*['"]([^'"]+)['"]\)/;
    const compileSdkMatch = rootBuildGradleContent.match(compileSdkRegex);
    
    if (compileSdkMatch && parseInt(compileSdkMatch[1]) > 34) {
      console.log('Fixing compileSdkVersion to a valid version...');
      const fixedBuildGradle = rootBuildGradleContent.replace(
        compileSdkRegex,
        "compileSdkVersion = Integer.parseInt(findProperty('android.compileSdkVersion') ?: '34')"
      );
      
      fs.writeFileSync(path.join(rootDir, 'android', 'build.gradle'), fixedBuildGradle);
      console.log('Successfully updated compileSdkVersion to 34');
    } else {
      console.log('compileSdkVersion is already set to a valid version');
    }
  } else {
    console.error('android/build.gradle not found');
  }
} catch (sdkError) {
  console.error('Error checking/updating SDK versions:', sdkError);
}

console.log('Android build fixes applied'); 