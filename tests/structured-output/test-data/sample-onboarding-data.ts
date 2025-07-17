/**
 * Sample Onboarding Data for Testing
 * 
 * This represents real user data from the onboarding process
 * that will be used to generate personalized workouts and meal plans
 */

export interface TestUserProfile {
  // Basic Info
  name: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  
  // Physical Measurements
  height_cm: number;
  weight_kg: number;
  target_weight_kg: number;
  
  // Fitness Preferences
  fitnessLevel: 'beginner' | 'intermediate' | 'advanced';
  fitnessGoals: string[];
  workoutFrequency: number; // days per week
  workoutDuration: number; // minutes per session
  availableEquipment: string[];
  preferredWorkoutTypes: string[];
  
  // Diet Preferences
  dietType: 'omnivore' | 'vegetarian' | 'vegan' | 'keto' | 'paleo';
  allergies: string[];
  cuisinePreferences: string[];
  mealFrequency: number; // meals per day
  calorieTarget: number;
  countryRegion: string;
  
  // Lifestyle
  activityLevel: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active';
  sleepHours: number;
  stressLevel: 'low' | 'medium' | 'high';
  waterIntakeGoal: number; // ml per day
}

// Test User 1: Beginner Indian Vegetarian
export const testUser1: TestUserProfile = {
  name: "Priya Sharma",
  age: 28,
  gender: "female",
  height_cm: 165,
  weight_kg: 70,
  target_weight_kg: 60,
  fitnessLevel: "beginner",
  fitnessGoals: ["weight_loss", "general_fitness", "strength_building"],
  workoutFrequency: 4,
  workoutDuration: 45,
  availableEquipment: ["dumbbells", "yoga_mat", "resistance_bands"],
  preferredWorkoutTypes: ["strength_training", "yoga", "cardio"],
  dietType: "vegetarian",
  allergies: ["nuts"],
  cuisinePreferences: ["indian", "mediterranean"],
  mealFrequency: 3,
  calorieTarget: 1800,
  countryRegion: "India",
  activityLevel: "lightly_active",
  sleepHours: 7,
  stressLevel: "medium",
  waterIntakeGoal: 2500
};

// Test User 2: Advanced American Omnivore
export const testUser2: TestUserProfile = {
  name: "Mike Johnson",
  age: 35,
  gender: "male",
  height_cm: 180,
  weight_kg: 85,
  target_weight_kg: 80,
  fitnessLevel: "advanced",
  fitnessGoals: ["muscle_building", "strength_building", "athletic_performance"],
  workoutFrequency: 6,
  workoutDuration: 75,
  availableEquipment: ["full_gym", "barbell", "dumbbells", "pull_up_bar"],
  preferredWorkoutTypes: ["strength_training", "powerlifting", "hiit"],
  dietType: "omnivore",
  allergies: [],
  cuisinePreferences: ["american", "mexican", "asian"],
  mealFrequency: 5,
  calorieTarget: 2800,
  countryRegion: "United States",
  activityLevel: "very_active",
  sleepHours: 8,
  stressLevel: "low",
  waterIntakeGoal: 3500
};

// Test User 3: Intermediate Vegan European
export const testUser3: TestUserProfile = {
  name: "Emma Mueller",
  age: 24,
  gender: "female",
  height_cm: 170,
  weight_kg: 58,
  target_weight_kg: 62,
  fitnessLevel: "intermediate",
  fitnessGoals: ["muscle_building", "general_fitness", "endurance"],
  workoutFrequency: 5,
  workoutDuration: 60,
  availableEquipment: ["dumbbells", "kettlebells", "yoga_mat", "resistance_bands"],
  preferredWorkoutTypes: ["strength_training", "functional_training", "pilates"],
  dietType: "vegan",
  allergies: ["gluten"],
  cuisinePreferences: ["mediterranean", "european", "asian"],
  mealFrequency: 4,
  calorieTarget: 2200,
  countryRegion: "Germany",
  activityLevel: "moderately_active",
  sleepHours: 7.5,
  stressLevel: "low",
  waterIntakeGoal: 2800
};

export const allTestUsers = [testUser1, testUser2, testUser3];
