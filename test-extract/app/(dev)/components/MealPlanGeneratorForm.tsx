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

// Define the meal plan preferences type based on our Gemini API implementation
interface MealPlanPreferences {
  dietType: string;
  dietPlanPreference: string;
  allergies?: string[];
  mealFrequency: number;
  countryRegion: string;
  fitnessGoal: string;
}

interface Props {
  onSubmit: (preferences: MealPlanPreferences) => void;
  isLoading: boolean;
}

export default function MealPlanGeneratorForm({ onSubmit, isLoading }: Props) {
  // Initialize with default values
  const [preferences, setPreferences] = useState<MealPlanPreferences>({
    dietType: "omnivore",
    dietPlanPreference: "balanced",
    allergies: [],
    mealFrequency: 3,
    countryRegion: "United States",
    fitnessGoal: "weight loss",
  });

  // Helper to update a single field
  const updateField = (field: keyof MealPlanPreferences, value: any) => {
    setPreferences(prev => ({ ...prev, [field]: value }));
  };

  // Helper for allergies multi-select
  const toggleAllergy = (item: string) => {
    setPreferences(prev => {
      const currentAllergies = prev.allergies || [];
      if (currentAllergies.includes(item)) {
        return { ...prev, allergies: currentAllergies.filter(i => i !== item) };
      } else {
        return { ...prev, allergies: [...currentAllergies, item] };
      }
    });
  };

  return (
    <View style={styles.container}>
      {/* Diet Type */}
      <View style={styles.field}>
        <Text style={styles.label}>Diet Type</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={preferences.dietType}
            onValueChange={(value) => updateField("dietType", value)}
            style={styles.picker}
          >
            <Picker.Item label="Omnivore (All foods)" value="omnivore" />
            <Picker.Item label="Vegetarian" value="vegetarian" />
            <Picker.Item label="Vegan" value="vegan" />
            <Picker.Item label="Pescatarian" value="pescatarian" />
            <Picker.Item label="Flexitarian" value="flexitarian" />
          </Picker>
        </View>
      </View>

      {/* Diet Plan Preference */}
      <View style={styles.field}>
        <Text style={styles.label}>Diet Plan Preference</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={preferences.dietPlanPreference}
            onValueChange={(value) => updateField("dietPlanPreference", value)}
            style={styles.picker}
          >
            <Picker.Item label="Balanced" value="balanced" />
            <Picker.Item label="High-protein" value="high-protein" />
            <Picker.Item label="Low-carb" value="low-carb" />
            <Picker.Item label="Keto" value="keto" />
            <Picker.Item label="Mediterranean" value="mediterranean" />
          </Picker>
        </View>
      </View>

      {/* Allergies */}
      <View style={styles.field}>
        <Text style={styles.label}>Allergies/Intolerances</Text>
        <View style={styles.checkboxContainer}>
          {["dairy", "nuts", "gluten", "shellfish", "eggs", "soy"].map(item => (
            <TouchableOpacity
              key={item}
              style={styles.checkboxRow}
              onPress={() => toggleAllergy(item)}
            >
              <View style={[
                styles.checkbox,
                (preferences.allergies || []).includes(item) && styles.checkboxChecked
              ]} />
              <Text style={styles.checkboxLabel}>{item.charAt(0).toUpperCase() + item.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Meal Frequency */}
      <View style={styles.field}>
        <Text style={styles.label}>Meal Frequency (meals per day)</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={preferences.mealFrequency.toString()}
            onValueChange={(value) => updateField("mealFrequency", parseInt(value))}
            style={styles.picker}
          >
            <Picker.Item label="2 meals" value="2" />
            <Picker.Item label="3 meals" value="3" />
            <Picker.Item label="4 meals" value="4" />
            <Picker.Item label="5 meals" value="5" />
            <Picker.Item label="6 meals" value="6" />
          </Picker>
        </View>
      </View>

      {/* Country/Region */}
      <View style={styles.field}>
        <Text style={styles.label}>Country/Region</Text>
        <TextInput
          style={styles.input}
          value={preferences.countryRegion}
          onChangeText={(text) => updateField("countryRegion", text)}
        />
      </View>

      {/* Fitness Goal */}
      <View style={styles.field}>
        <Text style={styles.label}>Fitness Goal</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={preferences.fitnessGoal}
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
          {isLoading ? "Generating..." : "Generate Meal Plan"}
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
