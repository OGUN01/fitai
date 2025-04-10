#!/usr/bin/env node

/**
 * This script runs before the EAS build to fix the Flipper integration issue.
 */
 
console.log('Running EAS pre-build hook...');

// Execute the same fix script we use locally
require('../fix-android-build.js');

console.log('EAS pre-build hook completed.'); 