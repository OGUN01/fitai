import { z } from 'zod';

// User details validation schema
export const userDetailsSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters').max(50, 'Name cannot exceed 50 characters'),
  age: z.coerce.number().int().min(13, 'You must be at least 13 years old').max(120, 'Age cannot exceed 120'),
  gender: z.enum(['male', 'female', 'non-binary', 'prefer-not-to-say']),
  height: z.coerce.number().positive('Height must be a positive number'),
  heightUnit: z.enum(['cm', 'ft']),
  currentWeight: z.coerce.number().positive('Weight must be a positive number'),
  targetWeight: z.coerce.number().positive('Target weight must be a positive number'),
  weightUnit: z.enum(['kg', 'lbs']),
  fitnessGoal: z.enum(['weight-loss', 'muscle-gain', 'improved-fitness', 'maintenance']),
  activityLevel: z.enum(['sedentary', 'lightly-active', 'moderately-active', 'very-active']),
});

// Diet preferences validation schema
export const dietPreferencesSchema = z.object({
  dietType: z.enum(['vegetarian', 'vegan', 'non-vegetarian', 'pescatarian', 'flexitarian']),
  dietPlanPreference: z.enum(['balanced', 'high-protein', 'low-carb', 'keto', 'mediterranean']),
  allergies: z.array(z.string()).optional(),
  otherAllergies: z.string().optional(),
  mealFrequency: z.coerce.number().int().min(1, 'Must have at least 1 meal').max(8, 'Cannot exceed 8 meals'),
  mealTimes: z.array(z.string()),
  countryRegion: z.string().min(2, 'Please specify your country/region'),
  waterIntakeGoal: z.coerce.number().positive('Water intake goal must be a positive number'),
  waterIntakeUnit: z.enum(['l', 'oz']),
});

// Workout preferences validation schema
export const workoutPreferencesSchema = z.object({
  fitnessLevel: z.enum(['beginner', 'intermediate', 'advanced']),
  workoutLocation: z.enum(['home', 'gym', 'outdoors', 'mix']),
  availableEquipment: z.array(z.string()).optional(),
  workoutFrequency: z.coerce.number().int().min(1, 'At least 1 day per week').max(7, 'Maximum 7 days per week'),
  workoutDuration: z.coerce.number().int().min(10, 'At least 10 minutes').max(180, 'Maximum 3 hours'),
  preferredWorkoutTimes: z.array(z.string()),
  focusAreas: z.array(z.enum(['upper-body', 'lower-body', 'core', 'cardio', 'full-body', 'flexibility'])),
  exercisesToAvoid: z.string().optional(),
});

// Login validation schema
export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

// Signup validation schema
export const signupSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  confirmPassword: z.string().min(8, 'Password must be at least 8 characters'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

// Workout tracking validation schema
export const workoutTrackingSchema = z.object({
  exerciseId: z.string(),
  sets: z.array(
    z.object({
      weight: z.coerce.number().optional(),
      reps: z.coerce.number().int().min(1, 'At least 1 rep required'),
      duration: z.coerce.number().optional(),
      completed: z.boolean(),
    })
  ),
});

// Meal tracking validation schema
export const mealTrackingSchema = z.object({
  mealId: z.string(),
  consumed: z.boolean(),
  rating: z.number().min(1).max(5).optional(),
  notes: z.string().optional(),
});
