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

// Define the workout preferences type based on our Gemini API implementation
interface WorkoutPreferences {
  fitnessLevel: string;
  workoutLocation: string;
  availableEquipment: string[];
  exerciseFrequency: number;
  timePerSession: number;
  focusAreas: string[];
  injuries?: string;
}

interface Props {
  onSubmit: (preferences: WorkoutPreferences) => void;
  isLoading: boolean;
}

export default function WorkoutGeneratorForm({ onSubmit, isLoading }: Props) {
  // Initialize with default values
  const [preferences, setPreferences] = useState<WorkoutPreferences>({
    fitnessLevel: "beginner",
    workoutLocation: "home",
    availableEquipment: ["bodyweight"],
    exerciseFrequency: 3,
    timePerSession: 30,
    focusAreas: ["full body"],
    injuries: "",
  });

  // Helper to update a single field
  const updateField = (field: keyof WorkoutPreferences, value: any) => {
    setPreferences(prev => ({ ...prev, [field]: value }));
  };

  // Helper for multi-select options (equipment, focus areas)
  const toggleArrayItem = (field: "availableEquipment" | "focusAreas", item: string) => {
    setPreferences(prev => {
      const currentArray = prev[field];
      if (currentArray.includes(item)) {
        return { ...prev, [field]: currentArray.filter(i => i !== item) };
      } else {
        return { ...prev, [field]: [...currentArray, item] };
      }
    });
  };

  return (
    <View style={styles.container}>
      {/* Fitness Level */}
      <View style={styles.field}>
        <Text style={styles.label}>Fitness Level</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={preferences.fitnessLevel}
            onValueChange={(value) => updateField("fitnessLevel", value)}
            style={styles.picker}
          >
            <Picker.Item label="Beginner" value="beginner" />
            <Picker.Item label="Intermediate" value="intermediate" />
            <Picker.Item label="Advanced" value="advanced" />
          </Picker>
        </View>
      </View>

      {/* Workout Location */}
      <View style={styles.field}>
        <Text style={styles.label}>Workout Location</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={preferences.workoutLocation}
            onValueChange={(value) => updateField("workoutLocation", value)}
            style={styles.picker}
          >
            <Picker.Item label="Home" value="home" />
            <Picker.Item label="Gym" value="gym" />
            <Picker.Item label="Outdoors" value="outdoors" />
          </Picker>
        </View>
      </View>

      {/* Available Equipment */}
      <View style={styles.field}>
        <Text style={styles.label}>Available Equipment</Text>
        <View style={styles.checkboxContainer}>
          {["bodyweight", "dumbbells", "barbell", "kettlebell", "resistance bands", "pullup bar", "bench", "cable machine"].map(item => (
            <TouchableOpacity
              key={item}
              style={styles.checkboxRow}
              onPress={() => toggleArrayItem("availableEquipment", item)}
            >
              <View style={[
                styles.checkbox,
                preferences.availableEquipment.includes(item) && styles.checkboxChecked
              ]} />
              <Text style={styles.checkboxLabel}>{item.charAt(0).toUpperCase() + item.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Exercise Frequency */}
      <View style={styles.field}>
        <Text style={styles.label}>Exercise Frequency (days per week)</Text>
        <TextInput
          style={styles.input}
          value={preferences.exerciseFrequency.toString()}
          onChangeText={(text) => {
            const value = parseInt(text) || 0;
            updateField("exerciseFrequency", value);
          }}
          keyboardType="number-pad"
          maxLength={1}
        />
      </View>

      {/* Time Per Session */}
      <View style={styles.field}>
        <Text style={styles.label}>Time Per Session (minutes)</Text>
        <TextInput
          style={styles.input}
          value={preferences.timePerSession.toString()}
          onChangeText={(text) => {
            const value = parseInt(text) || 0;
            updateField("timePerSession", value);
          }}
          keyboardType="number-pad"
          maxLength={3}
        />
      </View>

      {/* Focus Areas */}
      <View style={styles.field}>
        <Text style={styles.label}>Focus Areas</Text>
        <View style={styles.checkboxContainer}>
          {["upper body", "lower body", "core", "full body", "cardio", "flexibility"].map(item => (
            <TouchableOpacity
              key={item}
              style={styles.checkboxRow}
              onPress={() => toggleArrayItem("focusAreas", item)}
            >
              <View style={[
                styles.checkbox,
                preferences.focusAreas.includes(item) && styles.checkboxChecked
              ]} />
              <Text style={styles.checkboxLabel}>{item.charAt(0).toUpperCase() + item.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Injuries */}
      <View style={styles.field}>
        <Text style={styles.label}>Injuries or Limitations (if any)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={preferences.injuries}
          onChangeText={(text) => updateField("injuries", text)}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        style={[
          styles.submitButton,
          isLoading && styles.submitButtonDisabled
        ]}
        onPress={() => onSubmit(preferences)}
        disabled={isLoading}
      >
        <Text style={styles.submitButtonText}>
          {isLoading ? "Generating..." : "Generate Workout Plan"}
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
  textArea: {
    minHeight: 80,
  },
  checkboxContainer: {
    marginTop: 8,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    marginRight: 8,
  },
  checkboxChecked: {
    backgroundColor: "#f59e0b",
    borderColor: "#f59e0b",
  },
  checkboxLabel: {
    fontSize: 16,
    color: "#334155",
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
