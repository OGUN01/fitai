import React, { useState } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator 
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import gemini from "../../lib/gemini";

// Import form components
import WorkoutGeneratorForm from "./components/WorkoutGeneratorForm";
import MealPlanGeneratorForm from "./components/MealPlanGeneratorForm";
import BodyAnalysisForm from "./components/BodyAnalysisForm";
import ProgressAnalysisForm from "./components/ProgressAnalysisForm";
import MotivationalQuoteForm from "./components/MotivationalQuoteForm";
import FitnessTipForm from "./components/FitnessTipForm";

// Service types - will be used to determine which form to show
type ServiceType = 
  | "workoutGenerator" 
  | "mealPlanGenerator" 
  | "bodyAnalysis" 
  | "progressAnalysis" 
  | "motivationalQuote"
  | "fitnessTip";

export default function AITestHarness() {
  // State to track the currently selected service
  const [selectedService, setSelectedService] = useState<ServiceType | null>(null);
  // State to track if a test is currently running
  const [isLoading, setIsLoading] = useState(false);
  // State to store the test results
  const [testResults, setTestResults] = useState<any>(null);
  // State to store any errors
  const [error, setError] = useState<string | null>(null);
  
  // Handler for service selection
  const selectService = (service: ServiceType) => {
    setSelectedService(service);
    // Reset results and errors when switching services
    setTestResults(null);
    setError(null);
  };

  // Handle form submissions for each service type
  const handleSubmit = async (serviceType: ServiceType, formData: any) => {
    setIsLoading(true);
    setError(null);
    setTestResults(null);

    try {
      let result;

      switch (serviceType) {
        case "workoutGenerator":
          result = await gemini.generateWorkoutPlan(formData);
          break;
        case "mealPlanGenerator":
          result = await gemini.generateMealPlan(formData);
          break;
        case "bodyAnalysis":
          result = await gemini.analyzeBodyComposition(formData);
          break;
        case "progressAnalysis":
          // For progress analysis, we need to format the data as expected by the API
          result = await gemini.generateContent(
            `Analyze the following fitness progress data and provide insights, recommendations, and projections:
            - Fitness Goal: ${formData.fitnessGoal}
            - Starting Weight: ${formData.startingWeight}kg
            - Current Weight: ${formData.currentWeight}kg
            - Target Weight: ${formData.targetWeight}kg
            - Weeks Active: ${formData.weeksActive}
            - Workout Completion Rate: ${formData.workoutCompletionRate}%
            - Diet Adherence Rate: ${formData.dietAdherenceRate}%
            ${formData.recentChallenges ? `- Recent Challenges: ${formData.recentChallenges}` : ''}
            ${formData.keyAchievements ? `- Key Achievements: ${formData.keyAchievements}` : ''}
            
            Format the response as JSON with the following structure:
            {
              "progressSummary": "Summary of progress made",
              "keyInsights": ["Insight 1", "Insight 2"],
              "recommendations": ["Recommendation 1", "Recommendation 2"],
              "projections": {
                "timeToGoal": "Estimated time to reach goal",
                "nextMilestone": "Next achievement to aim for"
              }
            }`
          );
          // Try to parse the result as JSON
          try {
            result = JSON.parse(result);
          } catch (parseError) {
            // If parsing fails, return the raw text with a specific format
            result = {
              rawText: result,
              note: "Response could not be parsed as JSON"
            };
          }
          break;
        case "motivationalQuote":
          result = await gemini.generateMotivationalQuote(formData);
          break;
        case "fitnessTip":
          result = await gemini.generateFitnessTip(formData);
          break;
        default:
          throw new Error("Unknown service type");
      }

      setTestResults(result);
    } catch (err: any) {
      console.error(`Error testing ${serviceType}:`, err);
      setError(err.message || "An unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  // Render the appropriate form based on selected service
  const renderForm = () => {
    if (!selectedService) return null;

    switch (selectedService) {
      case "workoutGenerator":
        return (
          <WorkoutGeneratorForm
            onSubmit={(data) => handleSubmit("workoutGenerator", data)}
            isLoading={isLoading}
          />
        );
      case "mealPlanGenerator":
        return (
          <MealPlanGeneratorForm
            onSubmit={(data) => handleSubmit("mealPlanGenerator", data)}
            isLoading={isLoading}
          />
        );
      case "bodyAnalysis":
        return (
          <BodyAnalysisForm
            onSubmit={(data) => handleSubmit("bodyAnalysis", data)}
            isLoading={isLoading}
          />
        );
      case "progressAnalysis":
        return (
          <ProgressAnalysisForm
            onSubmit={(data) => handleSubmit("progressAnalysis", data)}
            isLoading={isLoading}
          />
        );
      case "motivationalQuote":
        return (
          <MotivationalQuoteForm
            onSubmit={(data) => handleSubmit("motivationalQuote", data)}
            isLoading={isLoading}
          />
        );
      case "fitnessTip":
        return (
          <FitnessTipForm
            onSubmit={(data) => handleSubmit("fitnessTip", data)}
            isLoading={isLoading}
          />
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <Text style={styles.title}>AI Services Test Harness</Text>
        <Text style={styles.description}>
          Select an AI service to test with different parameters and view the results.
        </Text>
        
        {/* Service selection buttons */}
        <View style={styles.serviceButtons}>
          <ServiceButton 
            title="Workout Generator" 
            isSelected={selectedService === "workoutGenerator"}
            onPress={() => selectService("workoutGenerator")}
          />
          <ServiceButton 
            title="Meal Plan Generator" 
            isSelected={selectedService === "mealPlanGenerator"}
            onPress={() => selectService("mealPlanGenerator")}
          />
          <ServiceButton 
            title="Body Analysis" 
            isSelected={selectedService === "bodyAnalysis"}
            onPress={() => selectService("bodyAnalysis")}
          />
          <ServiceButton 
            title="Progress Analysis" 
            isSelected={selectedService === "progressAnalysis"}
            onPress={() => selectService("progressAnalysis")}
          />
          <ServiceButton 
            title="Motivational Quote" 
            isSelected={selectedService === "motivationalQuote"}
            onPress={() => selectService("motivationalQuote")}
          />
          <ServiceButton 
            title="Fitness Tip" 
            isSelected={selectedService === "fitnessTip"}
            onPress={() => selectService("fitnessTip")}
          />
        </View>
        
        {/* Conditional form rendering based on selected service */}
        {selectedService && (
          <View style={styles.formContainer}>
            <Text style={styles.sectionTitle}>
              Test Parameters for {getServiceTitle(selectedService)}
            </Text>
            
            {renderForm()}
          </View>
        )}
        
        {/* Test results section */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#f59e0b" />
            <Text style={styles.loadingText}>
              Testing {selectedService && getServiceTitle(selectedService)}...
            </Text>
          </View>
        )}
        
        {testResults && (
          <View style={styles.resultsContainer}>
            <Text style={styles.sectionTitle}>Test Results</Text>
            <View style={styles.resultBox}>
              <ScrollView style={styles.resultScrollView}>
                <Text style={styles.resultText}>
                  {JSON.stringify(testResults, null, 2)}
                </Text>
              </ScrollView>
            </View>
          </View>
        )}
        
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>Error</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// Helper to get user-friendly service titles
function getServiceTitle(serviceType: ServiceType): string {
  switch (serviceType) {
    case "workoutGenerator": return "Workout Generator";
    case "mealPlanGenerator": return "Meal Plan Generator";
    case "bodyAnalysis": return "Body Analysis";
    case "progressAnalysis": return "Progress Analysis";
    case "motivationalQuote": return "Motivational Quote";
    case "fitnessTip": return "Fitness Tip";
    default: return "Unknown Service";
  }
}

// Service button component
function ServiceButton({ 
  title, 
  isSelected, 
  onPress 
}: { 
  title: string; 
  isSelected: boolean; 
  onPress: () => void; 
}) {
  return (
    <TouchableOpacity
      style={[
        styles.serviceButton,
        isSelected && styles.selectedServiceButton,
      ]}
      onPress={onPress}
    >
      <Text 
        style={[
          styles.serviceButtonText,
          isSelected && styles.selectedServiceButtonText,
        ]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: "#666",
    marginBottom: 24,
  },
  serviceButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 24,
  },
  serviceButton: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
  },
  selectedServiceButton: {
    backgroundColor: "#f59e0b",
  },
  serviceButtonText: {
    color: "#334155",
    fontWeight: "500",
  },
  selectedServiceButtonText: {
    color: "#fff",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
  },
  formContainer: {
    marginBottom: 24,
  },
  loadingContainer: {
    alignItems: "center",
    marginVertical: 24,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 16,
    color: "#334155",
  },
  resultsContainer: {
    marginBottom: 24,
  },
  resultBox: {
    backgroundColor: "#f1f5f9",
    padding: 16,
    borderRadius: 8,
    maxHeight: 400,
  },
  resultScrollView: {
    flexGrow: 1,
  },
  resultText: {
    fontFamily: "monospace",
    fontSize: 14,
  },
  errorContainer: {
    backgroundColor: "#fee2e2",
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#b91c1c",
    marginBottom: 8,
  },
  errorText: {
    color: "#b91c1c",
  },
});
