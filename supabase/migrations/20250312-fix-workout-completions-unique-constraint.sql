-- Drop the existing constraint
ALTER TABLE workout_completions DROP CONSTRAINT IF EXISTS workout_completions_user_id_workout_date_key;

-- Add a new constraint that includes workout_day_name
ALTER TABLE workout_completions 
  ADD CONSTRAINT workout_completions_user_id_workout_date_day_name_key 
  UNIQUE(user_id, workout_date, workout_day_name);

-- Ensure workout_day_name column exists and has a value
-- This makes sure all existing records have a day name before we add it to the constraint
UPDATE workout_completions 
SET workout_day_name = 
  CASE 
    WHEN workout_day_name IS NOT NULL THEN workout_day_name
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
WHERE 1=1; 