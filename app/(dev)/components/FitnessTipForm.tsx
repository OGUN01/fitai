import React, { useState } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput,
  TouchableOpacity,
} from "react-native";
import { Picker } from "@react-native-picker/picker";

// Define the user profile type for fitness tips
interface UserProfile {
  fitnessLevel: string;
  fitnessGoal: string;
  workoutFocus?: string;
  recentChallenges?: string;
}

interface Props {
  onSubmit: (profile: UserProfile) => void;
  isLoading: boolean;
}

export default function FitnessTipForm({ onSubmit, isLoading }: Props) {
  // Initialize with default values
  const [profile, setProfile] = useState<UserProfile>({
    fitnessLevel: "beginner",
    fitnessGoal: "weight loss",
    workoutFocus: "general fitness",
    recentChallenges: "",
  });

  // Helper to update a single field
  const updateField = (field: keyof UserProfile, value: any) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  return (
    <View style={styles.container}>
      {/* Fitness Level */}
      <View style={styles.field}>
        <Text style={styles.label}>Fitness Level</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={profile.fitnessLevel}
            onValueChange={(value) => updateField("fitnessLevel", value)}
            style={styles.picker}
          >
            <Picker.Item label="Beginner" value="beginner" />
            <Picker.Item label="Intermediate" value="intermediate" />
            <Picker.Item label="Advanced" value="advanced" />
          </Picker>
        </View>
      </View>

      {/* Fitness Goal */}
      <View style={styles.field}>
        <Text style={styles.label}>Fitness Goal</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={profile.fitnessGoal}
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

      {/* Workout Focus */}
      <View style={styles.field}>
        <Text style={styles.label}>Workout Focus</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={profile.workoutFocus}
            onValueChange={(value) => updateField("workoutFocus", value)}
            style={styles.picker}
          >
            <Picker.Item label="General Fitness" value="general fitness" />
            <Picker.Item label="Strength Training" value="strength training" />
            <Picker.Item label="Cardio" value="cardio" />
            <Picker.Item label="Flexibility" value="flexibility" />
            <Picker.Item label="Sports Performance" value="sports performance" />
            <Picker.Item label="Core Strength" value="core strength" />
          </Picker>
        </View>
      </View>

      {/* Recent Challenges */}
      <View style={styles.field}>
        <Text style={styles.label}>Recent Challenges (if any)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={profile.recentChallenges}
          onChangeText={(text) => updateField("recentChallenges", text)}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          placeholder="E.g., muscle soreness, lack of motivation, time constraints"
        />
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        style={[
          styles.submitButton,
          isLoading && styles.submitButtonDisabled
        ]}
        onPress={() => onSubmit(profile)}
        disabled={isLoading}
      >
        <Text style={styles.submitButtonText}>
          {isLoading ? "Generating..." : "Generate Fitness Tip"}
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
