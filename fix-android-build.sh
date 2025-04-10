#!/bin/bash

# This script helps prepare the Android project for building with EAS

echo "===== ANDROID BUILD HELPER SCRIPT ====="

# Make sure we're in the project root
cd "$(dirname "$0")"
echo "Current directory: $(pwd)"

# Check if android directory exists
if [ ! -d "./android" ]; then
  echo "ERROR: android directory does not exist!"
  exit 1
fi

# Make sure gradlew is executable
cd android
echo "Making gradlew executable"
chmod +x ./gradlew

# Test gradle wrapper
echo "Testing gradle wrapper"
./gradlew -v

# Return to project root
cd ..

echo "===== ANDROID BUILD HELPER COMPLETED =====" 