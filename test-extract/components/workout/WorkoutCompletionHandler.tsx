import React, { useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useProfile } from '../../contexts/ProfileContext';
import { useStreak } from '../../contexts/StreakContext';
import { EventRegister } from 'react-native-event-listeners';

/**
 * This component handles workout completion events and updates the streak
 * It doesn't render anything visible - it just listens for events
 */
export default function WorkoutCompletionHandler() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { recordWorkout, isRestDay, currentStreak } = useStreak();
  
  useEffect(() => {
    // Set up event listener for workout completion
    const workoutCompletedListener = EventRegister.addEventListener(
      'workoutCompleted',
      async (workoutData: any) => {
        console.log('🏋️‍♂️ Workout completed, updating streak...');
        try {
          // Check if today is a rest day
          const restDay = isRestDay();
          console.log(`Today is ${restDay ? 'a REST day' : 'a WORKOUT day'}`);
          
          // If it's a rest day, this shouldn't be called, but we'll handle it anyway
          if (restDay) {
            console.warn('⚠️ Workout was completed on a rest day! This should not happen.');
          }
          
          // Record the completion and get updated streak using the StreakContext
          const newStreak = await recordWorkout();
          console.log(`✅ Streak updated after workout completion: ${newStreak} day(s) (rest day: ${restDay})`);
          
          // Emit an event with the updated streak so UI can update
          EventRegister.emit('streakUpdated', { streak: newStreak });
        } catch (error) {
          console.error('Error updating streak after workout completion:', error);
        }
      }
    );
    
    // Cleanup listener on unmount
    return () => {
      EventRegister.removeEventListener(workoutCompletedListener as string);
    };
  }, [user, profile, recordWorkout, isRestDay]);
  
  // This component doesn't render anything
  return null;
}
