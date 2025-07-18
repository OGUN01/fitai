import React, { useState } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput,
  TouchableOpacity,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import Slider from "@react-native-community/slider";

// Define the user progress type for motivational quotes
interface UserProgress {
  fitnessGoal: string;
  weeksActive: number;
  recentMilestone?: string;
  mood?: string;
}

interface Props {
  onSubmit: (progress: UserProgress) => void;
  isLoading: boolean;
}

export default function MotivationalQuoteForm({ onSubmit, isLoading }: Props) {
  // Initialize with default values
  const [progress, setProgress] = useState<UserProgress>({
    fitnessGoal: "weight loss",
    weeksActive: 4,
    recentMilestone: "",
    mood: "motivated",
  });

  // Helper to update a single field
  const updateField = (field: keyof UserProgress, value: any) => {
    setProgress(prev => ({ ...prev, [field]: value }));
  };

  return (
    <View style={styles.container}>
      {/* Fitness Goal */}
      <View style={styles.field}>
        <Text style={styles.label}>Fitness Goal</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={progress.fitnessGoal}
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

      {/* Weeks Active */}
      <View style={styles.field}>
        <Text style={styles.label}>Weeks Active: {progress.weeksActive}</Text>
        <Slider
          style={styles.slider}
          minimumValue={1}
          maximumValue={52}
          step={1}
          value={progress.weeksActive}
          onValueChange={(value) => updateField("weeksActive", value)}
          minimumTrackTintColor="#f59e0b"
          maximumTrackTintColor="#cbd5e1"
          thumbTintColor="#f59e0b"
        />
        <View style={styles.sliderLabels}>
          <Text style={styles.sliderLabel}>1 week</Text>
          <Text style={styles.sliderLabel}>52 weeks</Text>
        </View>
      </View>

      {/* Recent Milestone */}
      <View style={styles.field}>
        <Text style={styles.label}>Recent Milestone (if any)</Text>
        <TextInput
          style={styles.input}
          value={progress.recentMilestone}
          onChangeText={(text) => updateField("recentMilestone", text)}
          placeholder="E.g., lost 5kg, ran 5km, lifted personal best"
        />
      </View>

      {/* Current Mood */}
      <View style={styles.field}>
        <Text style={styles.label}>Current Mood</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={progress.mood}
            onValueChange={(value) => updateField("mood", value)}
            style={styles.picker}
          >
            <Picker.Item label="Motivated" value="motivated" />
            <Picker.Item label="Tired" value="tired" />
            <Picker.Item label="Discouraged" value="discouraged" />
            <Picker.Item label="Excited" value="excited" />
            <Picker.Item label="Frustrated" value="frustrated" />
            <Picker.Item label="Neutral" value="neutral" />
          </Picker>
        </View>
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        style={[
          styles.submitButton,
          isLoading && styles.submitButtonDisabled
        ]}
        onPress={() => onSubmit(progress)}
        disabled={isLoading}
      >
        <Text style={styles.submitButtonText}>
          {isLoading ? "Generating..." : "Generate Motivational Quote"}
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
