import React, { useState } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput,
  TouchableOpacity,
  ScrollView
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import Slider from "@react-native-community/slider";

// Define the progress data type
interface ProgressData {
  fitnessGoal: string;
  startingWeight: number;
  currentWeight: number;
  targetWeight: number;
  weeksActive: number;
  workoutCompletionRate: number; // 0-100%
  dietAdherenceRate: number; // 0-100%
  recentChallenges?: string;
  keyAchievements?: string;
}

interface Props {
  onSubmit: (data: ProgressData) => void;
  isLoading: boolean;
}

export default function ProgressAnalysisForm({ onSubmit, isLoading }: Props) {
  // Initialize with default values
  const [progressData, setProgressData] = useState<ProgressData>({
    fitnessGoal: "weight loss",
    startingWeight: 80,
    currentWeight: 77,
    targetWeight: 70,
    weeksActive: 4,
    workoutCompletionRate: 80,
    dietAdherenceRate: 70,
    recentChallenges: "",
    keyAchievements: "",
  });

  // Helper to update a single field
  const updateField = (field: keyof ProgressData, value: any) => {
    setProgressData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <View style={styles.container}>
      {/* Fitness Goal */}
      <View style={styles.field}>
        <Text style={styles.label}>Fitness Goal</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={progressData.fitnessGoal}
            onValueChange={(value) => updateField("fitnessGoal", value)}
            style={styles.picker}
          >
            <Picker.Item label="Weight Loss" value="weight loss" />
            <Picker.Item label="Muscle Gain" value="muscle gain" />
            <Picker.Item label="Improved Fitness" value="improved fitness" />
            <Picker.Item label="Maintenance" value="maintenance" />
          </Picker>
        </View>
      </View>

      {/* Weight Fields */}
      <View style={styles.fieldRow}>
        <View style={[styles.field, { flex: 1, marginRight: 8 }]}>
          <Text style={styles.label}>Starting Weight (kg)</Text>
          <TextInput
            style={styles.input}
            value={progressData.startingWeight.toString()}
            onChangeText={(text) => {
              const value = parseFloat(text) || 0;
              updateField("startingWeight", value);
            }}
            keyboardType="numeric"
          />
        </View>
        
        <View style={[styles.field, { flex: 1, marginLeft: 8 }]}>
          <Text style={styles.label}>Current Weight (kg)</Text>
          <TextInput
            style={styles.input}
            value={progressData.currentWeight.toString()}
            onChangeText={(text) => {
              const value = parseFloat(text) || 0;
              updateField("currentWeight", value);
            }}
            keyboardType="numeric"
          />
        </View>
      </View>

      {/* Target Weight */}
      <View style={styles.field}>
        <Text style={styles.label}>Target Weight (kg)</Text>
        <TextInput
          style={styles.input}
          value={progressData.targetWeight.toString()}
          onChangeText={(text) => {
            const value = parseFloat(text) || 0;
            updateField("targetWeight", value);
          }}
          keyboardType="numeric"
        />
      </View>

      {/* Weeks Active */}
      <View style={styles.field}>
        <Text style={styles.label}>Weeks Active: {progressData.weeksActive}</Text>
        <Slider
          style={styles.slider}
          minimumValue={1}
          maximumValue={26}
          step={1}
          value={progressData.weeksActive}
          onValueChange={(value) => updateField("weeksActive", value)}
          minimumTrackTintColor="#f59e0b"
          maximumTrackTintColor="#cbd5e1"
          thumbTintColor="#f59e0b"
        />
        <View style={styles.sliderLabels}>
          <Text style={styles.sliderLabel}>1 week</Text>
          <Text style={styles.sliderLabel}>26 weeks</Text>
        </View>
      </View>

      {/* Workout Completion Rate */}
      <View style={styles.field}>
        <Text style={styles.label}>Workout Completion Rate: {progressData.workoutCompletionRate}%</Text>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={100}
          step={5}
          value={progressData.workoutCompletionRate}
          onValueChange={(value) => updateField("workoutCompletionRate", value)}
          minimumTrackTintColor="#f59e0b"
          maximumTrackTintColor="#cbd5e1"
          thumbTintColor="#f59e0b"
        />
        <View style={styles.sliderLabels}>
          <Text style={styles.sliderLabel}>0%</Text>
          <Text style={styles.sliderLabel}>100%</Text>
        </View>
      </View>

      {/* Diet Adherence Rate */}
      <View style={styles.field}>
        <Text style={styles.label}>Diet Adherence Rate: {progressData.dietAdherenceRate}%</Text>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={100}
          step={5}
          value={progressData.dietAdherenceRate}
          onValueChange={(value) => updateField("dietAdherenceRate", value)}
          minimumTrackTintColor="#f59e0b"
          maximumTrackTintColor="#cbd5e1"
          thumbTintColor="#f59e0b"
        />
        <View style={styles.sliderLabels}>
          <Text style={styles.sliderLabel}>0%</Text>
          <Text style={styles.sliderLabel}>100%</Text>
        </View>
      </View>

      {/* Recent Challenges */}
      <View style={styles.field}>
        <Text style={styles.label}>Recent Challenges (if any)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={progressData.recentChallenges}
          onChangeText={(text) => updateField("recentChallenges", text)}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          placeholder="E.g., missed workouts due to travel, plateau in weight loss"
        />
      </View>

      {/* Key Achievements */}
      <View style={styles.field}>
        <Text style={styles.label}>Key Achievements</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={progressData.keyAchievements}
          onChangeText={(text) => updateField("keyAchievements", text)}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          placeholder="E.g., ran 5k without stopping, increased squat weight by 10kg"
        />
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        style={[
          styles.submitButton,
          isLoading && styles.submitButtonDisabled
        ]}
        onPress={() => onSubmit(progressData)}
        disabled={isLoading}
      >
        <Text style={styles.submitButtonText}>
          {isLoading ? "Analyzing..." : "Analyze Progress"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
    marginBottom: 16,
  },
  fieldRow: {
    flexDirection: "row",
    marginBottom: 12,
  },
  field: {
    marginBottom: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 8,
    color: "#334155",
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    overflow: "hidden",
  },
  picker: {
    height: 50,
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
  },
  textArea: {
    minHeight: 80,
  },
  slider: {
    width: "100%",
    height: 40,
  },
  sliderLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: -8,
  },
  sliderLabel: {
    fontSize: 12,
    color: "#64748b",
  },
  submitButton: {
    backgroundColor: "#f59e0b",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  submitButtonDisabled: {
    backgroundColor: "#fcd34d",
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
