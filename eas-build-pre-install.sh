#!/bin/bash

# Print current directory for debugging
echo "Current directory: $(pwd)"

# Navigate to android directory
echo "Navigating to android directory..."
cd android || { echo "ERROR: Failed to navigate to android directory"; exit 1; }

# Check for gradle wrapper files
echo "Checking gradle wrapper files..."
if [ -f "./gradlew" ] && [ -d "./gradle/wrapper" ]; then
  echo "Gradle wrapper found, making gradlew executable"
  chmod +x ./gradlew
  
  # Verify the file is executable
  if [ -x "./gradlew" ]; then
    echo "gradlew is now executable"
  else
    echo "WARNING: gradlew could not be made executable, trying with sudo"
    sudo chmod +x ./gradlew
  fi
else
  echo "gradlew not found or gradle/wrapper directory missing"
  
  # Check if gradle/wrapper exists but gradlew is missing
  if [ -d "./gradle/wrapper" ] && [ -f "./gradle/wrapper/gradle-wrapper.jar" ]; then
    echo "Attempting to generate gradlew using gradle wrapper jar"
    java -cp "./gradle/wrapper/gradle-wrapper.jar" org.gradle.wrapper.GradleWrapperMain wrapper || echo "Failed to generate wrapper with Java"
  else
    echo "ERROR: gradle/wrapper or gradle-wrapper.jar is missing"
    echo "Attempting to install Gradle wrapper..."
    
    # Try using gradle command if it exists
    if command -v gradle >/dev/null 2>&1; then
      echo "Gradle command found, generating wrapper"
      gradle wrapper || echo "Failed to generate wrapper with gradle command"
    else
      echo "WARNING: gradle command not available"
    fi
  fi
  
  # Check again if gradlew was generated
  if [ -f "./gradlew" ]; then
    echo "gradlew was successfully generated"
    chmod +x ./gradlew
  else
    echo "ERROR: Could not generate gradlew"
    echo "Creating minimal gradlew script as fallback..."
    
    # Create a minimal gradlew script as last resort
    cat > gradlew << 'EOL'
#!/bin/sh
exec java -cp ./gradle/wrapper/gradle-wrapper.jar org.gradle.wrapper.GradleWrapperMain "$@"
EOL
    chmod +x ./gradlew
    echo "Created minimal gradlew script"
  fi
fi

# Verify the environment
echo "Verifying environment..."
echo "Java version:"
java -version || echo "Java not found or not in PATH"

echo "Gradle wrapper version:"
./gradlew --version || echo "Failed to run gradle wrapper version check"

# Return to project root
echo "Returning to project root..."
cd .. || { echo "ERROR: Failed to navigate back to project root"; exit 1; }

echo "Pre-install script completed" 