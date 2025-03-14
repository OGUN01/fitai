-- Add columns for diet preferences
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS diet_preferences JSONB;

-- Add individual fields
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS diet_type TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS diet_plan_preference TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS allergies TEXT[];
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS other_allergies TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS meal_frequency INTEGER;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS meal_times TEXT[];
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country_region TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS water_intake_goal NUMERIC;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS water_intake_unit TEXT;

-- Body analysis fields
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS height_cm NUMERIC;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS weight_kg NUMERIC;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS body_fat_percentage NUMERIC;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS target_weight_kg NUMERIC;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS body_analysis JSONB;

-- Workout preferences
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS workout_preferences JSONB;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_workouts TEXT[];
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS workout_days_per_week INTEGER;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS workout_duration_minutes INTEGER;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS fitness_level TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS fitness_goals TEXT[];
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS workout_plan JSONB;

-- Nutrition plans
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS meal_plans JSONB;

-- Create workout tracking table
CREATE TABLE IF NOT EXISTS workout_completions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  workout_date DATE NOT NULL,
  day_number INT NOT NULL,
  workout_plan_id TEXT NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  estimated_calories_burned INT,
  UNIQUE(user_id, workout_date)
);

-- Create meal tracking table
CREATE TABLE IF NOT EXISTS meal_completions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  meal_date DATE NOT NULL,
  meal_type TEXT NOT NULL,
  meal_plan_id TEXT NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, meal_date, meal_type)
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS workout_completions_user_id_idx ON workout_completions(user_id);
CREATE INDEX IF NOT EXISTS workout_completions_date_idx ON workout_completions(workout_date);
CREATE INDEX IF NOT EXISTS meal_completions_user_id_idx ON meal_completions(user_id);
CREATE INDEX IF NOT EXISTS meal_completions_date_idx ON meal_completions(meal_date);

-- Additional columns for tracking workout and meal completion
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS workout_tracking JSONB DEFAULT '[]'::jsonb;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS meal_tracking JSONB DEFAULT '[]'::jsonb;
