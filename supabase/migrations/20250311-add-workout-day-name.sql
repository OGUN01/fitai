-- Add workout_day_name column to workout_completions table
ALTER TABLE workout_completions ADD COLUMN IF NOT EXISTS workout_day_name TEXT;

-- Simple update to populate existing records with day names based on day number
-- This doesn't require any function calls or complex logic
UPDATE workout_completions 
SET workout_day_name = 
  CASE 
    -- 3-day workout pattern (most common)
    WHEN day_number = 1 THEN 'Monday'
    WHEN day_number = 2 THEN 'Wednesday'
    WHEN day_number = 3 THEN 'Friday'
    -- 4-day workout pattern
    WHEN day_number = 4 THEN 'Saturday'
    -- 5-day workout pattern
    WHEN day_number = 5 THEN 'Sunday'
    -- Any other day number
    ELSE 'Day ' || day_number::TEXT
  END
WHERE workout_day_name IS NULL;

-- Optional index for faster lookups by workout day name
CREATE INDEX IF NOT EXISTS idx_workout_completions_day_name ON workout_completions(workout_day_name);
