import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, SafeAreaView } from 'react-native';
import { Text, Button, Card, RadioButton, Divider } from 'react-native-paper';
import { testWorkoutFallbackChainE2E, testFirstFallback } from '../../services/ai/testUtils';
import { parseJsonFromLLM } from '../../services/ai/advancedFallbacks';
import gemini from '../../lib/gemini';
import { StatusBar } from 'expo-status-bar';
import { UserFitnessPreferences } from '../../services/ai/workoutGenerator';

// Test preferences for workout generation
const testPreferences: UserFitnessPreferences = {
  fitnessLevel: "intermediate",
  workoutLocation: "home",
  availableEquipment: ["Dumbbells", "Resistance bands"],
  exerciseFrequency: 3,
  timePerSession: 30,
  focusAreas: ["upper-body", "core"],
  injuries: ""
};

export default function DebugScreen() {
  const [testMode, setTestMode] = useState<string>('fallback-chain');
  const [testResult, setTestResult] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  const runFallbackTest = async () => {
    setIsLoading(true);
    setTestResult('Running test...');
    
    try {
      // Run the selected test
      if (testMode === 'fallback-chain') {
        console.log('Running full fallback chain test...');
        const result = await testWorkoutFallbackChainE2E();
        setTestResult(JSON.stringify(result, null, 2));
      } else if (testMode === 'first-fallback') {
        console.log('Running first fallback test...');
        const result = await testFirstFallback(testPreferences);
        setTestResult(JSON.stringify(result, null, 2));
      } else if (testMode === 'parser-test') {
        console.log('Running JSON parser test...');
        await runJsonParserTest();
      } else if (testMode === 'comprehensive') {
        console.log('Running comprehensive system test...');
        await runComprehensiveTest();
      }
    } catch (error) {
      console.error('Test failed:', error);
      setTestResult(`Test failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Test the JSON parser with various input formats
  const runJsonParserTest = async () => {
    const testResults = [];
    
    // Test case 1: Well-formatted JSON
    try {
      const wellFormatted = '{"name": "Test", "value": 123}';
      const result1 = parseJsonFromLLM(wellFormatted);
      testResults.push({
        name: "Well-formatted JSON",
        input: wellFormatted,
        output: result1,
        success: true
      });
    } catch (error) {
      testResults.push({
        name: "Well-formatted JSON",
        input: '{"name": "Test", "value": 123}',
        error: error.message,
        success: false
      });
    }
    
    // Test case 2: JSON in markdown code block
    try {
      const markdownJSON = "```json\n{\"name\": \"Test\", \"value\": 123}\n```";
      const result2 = parseJsonFromLLM(markdownJSON);
      testResults.push({
        name: "JSON in markdown",
        input: markdownJSON,
        output: result2,
        success: true
      });
    } catch (error) {
      testResults.push({
        name: "JSON in markdown",
        input: "```json\n{\"name\": \"Test\", \"value\": 123}\n```",
        error: error.message,
        success: false
      });
    }
    
    // Test case 3: JSON with errors (missing quotes)
    try {
      const brokenJSON = "{name: \"Test\", value: 123}";
      const result3 = parseJsonFromLLM(brokenJSON);
      testResults.push({
        name: "JSON with errors",
        input: brokenJSON,
        output: result3,
        success: true,
        notes: "Successfully repaired missing quotes"
      });
    } catch (error) {
      testResults.push({
        name: "JSON with errors",
        input: "{name: \"Test\", value: 123}",
        error: error.message,
        success: false
      });
    }
    
    // Test case 4: JSON with trailing commas
    try {
      const trailingCommaJSON = "{\"name\": \"Test\", \"array\": [1, 2, 3,], \"object\": {\"a\": 1, \"b\": 2,}}";
      const result4 = parseJsonFromLLM(trailingCommaJSON);
      testResults.push({
        name: "JSON with trailing commas",
        input: trailingCommaJSON,
        output: result4,
        success: true,
        notes: "Successfully repaired trailing commas"
      });
    } catch (error) {
      testResults.push({
        name: "JSON with trailing commas",
        input: trailingCommaJSON,
        error: error.message,
        success: false
      });
    }
    
    // Test case 5: Text with embedded JSON
    try {
      const embeddedJSONText = "Here is your workout plan:\n{\"name\": \"Monday Workout\", \"exercises\": [\"Squats\", \"Pushups\"]}";
      const result5 = parseJsonFromLLM(embeddedJSONText);
      testResults.push({
        name: "Text with embedded JSON",
        input: embeddedJSONText,
        output: result5,
        success: true,
        notes: "Successfully extracted JSON from text"
      });
    } catch (error) {
      testResults.push({
        name: "Text with embedded JSON",
        input: embeddedJSONText,
        error: error.message,
        success: false
      });
    }
    
    setTestResult(JSON.stringify(testResults, null, 2));
  };
  
  // Comprehensive test for all system components
  const runComprehensiveTest = async () => {
    try {
      const results = {
        stage1: null,
        stage2: null,
        stage3: null,
        stage4: null,
        summary: {}
      };
      
      // Stage 1: Test JSON parsing with various input formats
      console.log("STAGE 1: Testing JSON parser...");
      try {
        const wellFormatted = '{"name": "Test", "value": 123}';
        const markdownJSON = "```json\n{\"name\": \"Test\", \"value\": 123}\n```";
        const brokenJSON = "{name: \"Test\", value: 123}";
        
        const result1 = parseJsonFromLLM(wellFormatted);
        const result2 = parseJsonFromLLM(markdownJSON);
        const result3 = parseJsonFromLLM(brokenJSON);
        
        results.stage1 = {
          wellFormatted: result1,
          markdownJSON: result2,
          brokenJSON: result3,
          status: "PASSED"
        };
        console.log("✅ JSON parser tests PASSED");
      } catch (error) {
        results.stage1 = {
          error: error.message,
          status: "FAILED"
        };
        console.log("❌ JSON parser tests FAILED:", error.message);
      }
      
      // Stage 2: Test primary prompt generation
      console.log("STAGE 2: Testing primary prompt generation...");
      try {
        const result = await gemini.generatePlanWithPrimaryPrompt(testPreferences);
        results.stage2 = {
          status: "PASSED",
          weeklyScheduleDays: result.weeklySchedule?.length,
          exercisesCount: result.weeklySchedule?.reduce((sum, day) => sum + day.exercises.length, 0)
        };
        console.log("✅ Primary prompt generation PASSED");
      } catch (error) {
        results.stage2 = {
          error: error.message,
          status: "FAILED"
        };
        console.log("❌ Primary prompt generation FAILED:", error.message);
      }
      
      // Stage 3: Test alternative prompt generation
      console.log("STAGE 3: Testing alternative prompt generation...");
      try {
        const result = await gemini.generatePlanWithAlternativePrompt(testPreferences);
        results.stage3 = {
          status: "PASSED",
          weeklyScheduleDays: result.weeklySchedule?.length,
          exercisesCount: result.weeklySchedule?.reduce((sum, day) => sum + day.exercises.length, 0)
        };
        console.log("✅ Alternative prompt generation PASSED");
      } catch (error) {
        results.stage3 = {
          error: error.message,
          status: "FAILED"
        };
        console.log("❌ Alternative prompt generation FAILED:", error.message);
      }
      
      // Stage 4: Test fallback chain
      console.log("STAGE 4: Testing fallback chain...");
      try {
        const result = await testWorkoutFallbackChainE2E();
        const isFallback = 'isFallback' in result;
        results.stage4 = {
          status: "PASSED",
          isFallback: isFallback,
          reason: isFallback ? result.message : "Not a fallback",
          weeklyScheduleDays: result.weeklySchedule?.length
        };
        console.log("✅ Fallback chain test PASSED");
      } catch (error) {
        results.stage4 = {
          error: error.message,
          status: "FAILED"
        };
        console.log("❌ Fallback chain test FAILED:", error.message);
      }
      
      // Generate summary
      const passedTests = Object.values(results).filter(r => r?.status === "PASSED").length;
      results.summary = {
        testsRun: 4,
        testsPassed: passedTests,
        systemStatus: passedTests === 4 ? "FULLY OPERATIONAL" : 
                     passedTests >= 3 ? "OPERATIONAL WITH ISSUES" : 
                     passedTests >= 2 ? "PARTIALLY OPERATIONAL" : 
                     "SYSTEM FAILURE"
      };
      
      setTestResult(JSON.stringify(results, null, 2));
    } catch (error) {
      console.error("Comprehensive test failed:", error);
      setTestResult(`Comprehensive test failed: ${error.message}`);
    }
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <ScrollView>
        <Card style={styles.card}>
          <Card.Title title="Workout Plan Generation Testing" />
          <Card.Content>
            <Text variant="bodyMedium">Select a test mode:</Text>
            
            <RadioButton.Group onValueChange={value => setTestMode(value)} value={testMode}>
              <View style={styles.radioItem}>
                <RadioButton value="fallback-chain" />
                <Text>Full Fallback Chain Test</Text>
              </View>
              
              <View style={styles.radioItem}>
                <RadioButton value="first-fallback" />
                <Text>First Fallback Only</Text>
              </View>
              
              <View style={styles.radioItem}>
                <RadioButton value="parser-test" />
                <Text>JSON Parser Test</Text>
              </View>
              
              <View style={styles.radioItem}>
                <RadioButton value="comprehensive" />
                <Text>Comprehensive System Test</Text>
              </View>
            </RadioButton.Group>
            
            <Button 
              mode="contained" 
              onPress={runFallbackTest}
              loading={isLoading}
              disabled={isLoading}
              style={styles.button}
            >
              Run Test
            </Button>
            
            <Divider style={styles.divider} />
            
            <Text variant="titleMedium">Test Results:</Text>
            {testResult ? (
              <Card style={styles.resultCard}>
                <Card.Content>
                  <ScrollView style={styles.resultScroll}>
                    <Text style={styles.resultText}>{testResult}</Text>
                  </ScrollView>
                </Card.Content>
              </Card>
            ) : (
              <Text>Run a test to see results</Text>
            )}
          </Card.Content>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  card: {
    margin: 16,
  },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  button: {
    marginTop: 16,
  },
  divider: {
    marginVertical: 16,
  },
  resultCard: {
    marginTop: 8,
    backgroundColor: '#f0f0f0',
  },
  resultScroll: {
    maxHeight: 500,
  },
  resultText: {
    fontFamily: 'monospace',
  },
}); 