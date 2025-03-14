/**
 * Test Fallback Chain Script
 * 
 * This script runs an end-to-end test of the workout generator's fallback chain
 * to verify that the system can recover from failures in the primary generator.
 * 
 * Usage:
 * npx ts-node scripts/test-fallback-chain.ts
 */

import { testWorkoutFallbackChainE2E } from '../services/ai/testUtils';

console.log("Starting fallback chain test...");

// Run the test
testWorkoutFallbackChainE2E()
  .then(result => {
    console.log("Test completed successfully!");
    process.exit(0);
  })
  .catch(error => {
    console.error("Test failed:", error);
    process.exit(1);
  }); 