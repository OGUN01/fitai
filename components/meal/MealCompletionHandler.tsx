import React, { useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useProfile } from '../../contexts/ProfileContext';
import { useStreak } from '../../contexts/StreakContext';
import { EventRegister } from 'react-native-event-listeners';

/**
 * This component handles meal completion events and updates the streak
 * It doesn't render anything visible - it just listens for events
 */
export default function MealCompletionHandler() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { recordMeal, isRestDay, currentStreak } = useStreak();
  
  useEffect(() => {
    // Set up event listener for meal completion
    const mealCompletedListener = EventRegister.addEventListener(
      'mealCompleted',
      async (mealData: any) => {
        console.log('🍲 Meal completed, updating streak...', mealData);
        try {
          // Check if today is a rest day
          const restDay = isRestDay();
          console.log(`Today is ${restDay ? 'a REST day' : 'a WORKOUT day'}`);

          // Extract meal type from the event data
          const mealType = mealData?.mealType?.toLowerCase() as 'breakfast' | 'lunch' | 'dinner';
          console.log(`Recording completion for meal type: ${mealType}`);

          // Record the completion and get updated streak using the StreakContext
          const newStreak = await recordMeal(mealType || 'breakfast');
          console.log(`✅ Streak updated after ${mealType} completion: ${newStreak} day(s) (rest day: ${restDay})`);

          // Emit an event with the updated streak so UI can update
          EventRegister.emit('streakUpdated', { streak: newStreak });
        } catch (error) {
          console.error('Error updating streak after meal completion:', error);
        }
      }
    );
    
    // Cleanup listener on unmount
    return () => {
      EventRegister.removeEventListener(mealCompletedListener as string);
    };
  }, [user, profile, recordMeal, isRestDay]);
  
  // This component doesn't render anything
  return null;
} 