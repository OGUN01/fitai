import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useProfile } from './ProfileContext';
import { 
  getCurrentStreak, 
  getStreakData, 
  repairStreakData, 
  recordWorkoutCompletion, 
  recordMealCompletion,
  processActivityCompletion
} from '../utils/streakManager';
import { EventRegister } from 'react-native-event-listeners';
import { format } from 'date-fns';

interface StreakContextType {
  currentStreak: number;
  bestStreak: number;
  loading: boolean;
  error: string | null;
  refreshStreak: () => Promise<number>;
  syncStreakData: () => Promise<void>;
  isRestDay: () => boolean;
  recordWorkout: () => Promise<number>;
  recordMeal: (mealType?: 'breakfast' | 'lunch' | 'dinner') => Promise<number>;
  recordWater: () => Promise<number>;
}

// Create the context with default values
const StreakContext = createContext<StreakContextType>({
  currentStreak: 0,
  bestStreak: 0,
  loading: false,
  error: null,
  refreshStreak: async () => 0,
  syncStreakData: async () => {},
  isRestDay: () => false,
  recordWorkout: async () => 0,
  recordMeal: async () => 0,
  recordWater: async () => 0,
});

// Custom hook to use the streak context
export const useStreak = () => useContext(StreakContext);

// Streak provider component
export const StreakProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { profile, updateProfile } = useProfile();
  const [currentStreak, setCurrentStreak] = useState<number>(0);
  const [bestStreak, setBestStreak] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Helper function to check if today is a rest day
  const isRestDay = useCallback(() => {
    if (!profile?.workout_preferences?.preferred_days) return true; // Default to rest day if no preferences
    
    // Get current day name
    const currentDayName = format(new Date(), 'EEEE').toLowerCase();
    
    // Check if today is in the preferred workout days
    const preferredDays = profile.workout_preferences.preferred_days || [];
    const normalizedPreferredDays = preferredDays.map((day: string) => 
      typeof day === 'string' ? day.toLowerCase() : ''
    );
    
    // If today is not in preferred days, it's a rest day
    return !normalizedPreferredDays.includes(currentDayName);
  }, [profile?.workout_preferences?.preferred_days]);

  // Function to refresh the streak from the most authoritative source
  const refreshStreak = useCallback(async (): Promise<number> => {
    setLoading(true);
    setError(null);
    
    try {
      // Check if today is a rest day
      const restDay = isRestDay();
      console.log(`[StreakContext] Refreshing streak data (rest day: ${restDay})`);
      
      // Get current streak from streakManager (most authoritative source)
      const streak = await getCurrentStreak(restDay);
      console.log(`[StreakContext] Current streak from streakManager: ${streak}`);
      
      // Update state
      setCurrentStreak(streak);
      
      // If profile exists, update best streak value
      if (profile) {
        const streakData = await getStreakData();
        const existingBestStreak = profile.workout_tracking?.longestStreak || 0;
        const newBestStreak = Math.max(streak, existingBestStreak);
        
        if (newBestStreak !== existingBestStreak) {
          console.log(`[StreakContext] Updating best streak from ${existingBestStreak} to ${newBestStreak}`);
          setBestStreak(newBestStreak);
        } else {
          setBestStreak(existingBestStreak);
        }
      }
      
      return streak;
    } catch (error) {
      console.error('[StreakContext] Error refreshing streak:', error);
      setError('Failed to refresh streak data');
      return 0;
    } finally {
      setLoading(false);
    }
  }, [isRestDay, profile]);

  // Function to synchronize streak data between different sources
  const syncStreakData = useCallback(async (): Promise<void> => {
    if (!profile) return;

    try {
      console.log('[StreakContext] Synchronizing streak data across sources');
      setLoading(true);

      // 1. Repair any inconsistencies in streak data (local storage vs server)
      await repairStreakData(user?.id || null);

      // 2. Get the current streak from the most authoritative source
      const restDay = isRestDay();
      const currentStreak = await getCurrentStreak(restDay);

      // 3. Update profile with the current streak if needed
      const existingServerStreak = profile.workout_tracking?.streak ?? 0;
      if (existingServerStreak !== currentStreak) {
        console.log(`[StreakContext] Updating profile workout_tracking.streak from ${existingServerStreak} to ${currentStreak}`);

        try {
          await updateProfile({
            workout_tracking: {
              ...(profile.workout_tracking || {}),
              streak: currentStreak,
              longestStreak: Math.max(
                currentStreak,
                profile.workout_tracking?.longestStreak || 0
              ),
            }
          });
        } catch (updateError: any) {
          // If network error, don't throw - just log and continue with local state
          if (updateError.message?.includes('Failed to fetch') || updateError.message?.includes('ERR_TUNNEL_CONNECTION_FAILED')) {
            console.warn('[StreakContext] Network error updating profile, continuing with local state');
          } else {
            throw updateError;
          }
        }
      }
      
      // 4. Emit event to update other parts of the app
      EventRegister.emit('streakUpdated', { streak: currentStreak });
      
      // 5. Update local state
      setCurrentStreak(currentStreak);
      setBestStreak(
        Math.max(
          currentStreak, 
          profile.workout_tracking?.longestStreak || 0
        )
      );
      
      console.log('[StreakContext] Streak synchronization complete');
    } catch (error) {
      console.error('[StreakContext] Error synchronizing streak data:', error);
      setError('Failed to synchronize streak data');
    } finally {
      setLoading(false);
    }
  }, [user, profile, isRestDay, updateProfile]);

  // Record a workout completion
  const recordWorkout = useCallback(async (): Promise<number> => {
    try {
      setLoading(true);
      const restDay = isRestDay();
      
      // Record workout completion and get updated streak
      const newStreak = await recordWorkoutCompletion(user?.id || null, restDay);
      console.log(`[StreakContext] Recorded workout completion. New streak: ${newStreak}`);
      
      // Update state
      setCurrentStreak(newStreak);
      
      // Update best streak if needed
      if (newStreak > bestStreak) {
        setBestStreak(newStreak);
      }
      
      // Emit event to update other parts of the app
      EventRegister.emit('streakUpdated', { streak: newStreak });
      
      // Trigger synchronization
      await syncStreakData();
      
      return newStreak;
    } catch (error) {
      console.error('[StreakContext] Error recording workout:', error);
      setError('Failed to record workout completion');
      return currentStreak;
    } finally {
      setLoading(false);
    }
  }, [user, isRestDay, bestStreak, currentStreak, syncStreakData]);

  // Record a meal completion
  const recordMeal = useCallback(async (mealType: 'breakfast' | 'lunch' | 'dinner' = 'breakfast'): Promise<number> => {
    try {
      setLoading(true);
      const restDay = isRestDay();

      // Record meal completion and get updated streak
      const newStreak = await recordMealCompletion(user?.id || null, restDay, mealType);
      console.log(`[StreakContext] Recorded ${mealType} completion. New streak: ${newStreak}`);

      // Update state
      setCurrentStreak(newStreak);

      // Update best streak if needed
      if (newStreak > bestStreak) {
        setBestStreak(newStreak);
      }

      // Emit event to update other parts of the app
      EventRegister.emit('streakUpdated', { streak: newStreak });

      // Trigger synchronization
      await syncStreakData();

      return newStreak;
    } catch (error) {
      console.error('[StreakContext] Error recording meal:', error);
      setError('Failed to record meal completion');
      return currentStreak;
    } finally {
      setLoading(false);
    }
  }, [user, isRestDay, bestStreak, currentStreak, syncStreakData]);

  // Record a water tracking completion
  const recordWater = useCallback(async (): Promise<number> => {
    try {
      setLoading(true);
      const restDay = isRestDay();
      
      // Record water completion and get updated streak
      const newStreak = await processActivityCompletion(user?.id || null, 'water', true, restDay);
      console.log(`[StreakContext] Recorded water tracking. New streak: ${newStreak}`);
      
      // Update state
      setCurrentStreak(newStreak);
      
      // Update best streak if needed
      if (newStreak > bestStreak) {
        setBestStreak(newStreak);
      }
      
      // Emit event to update other parts of the app
      EventRegister.emit('streakUpdated', { streak: newStreak });
      
      // Trigger synchronization
      await syncStreakData();
      
      return newStreak;
    } catch (error) {
      console.error('[StreakContext] Error recording water intake:', error);
      setError('Failed to record water tracking');
      return currentStreak;
    } finally {
      setLoading(false);
    }
  }, [user, isRestDay, bestStreak, currentStreak, syncStreakData]);

  // Listen for streakUpdated events
  useEffect(() => {
    const streakUpdatedListener = EventRegister.addEventListener(
      'streakUpdated',
      async (data: { streak: number }) => {
        console.log('[StreakContext] Received streakUpdated event:', data);
        
        if (data && typeof data.streak === 'number') {
          // Update our local state
          setCurrentStreak(data.streak);
          
          // Update best streak if needed
          if (data.streak > bestStreak) {
            setBestStreak(data.streak);
          }
        }
      }
    );
    
    return () => {
      EventRegister.removeEventListener(streakUpdatedListener as string);
    };
  }, [bestStreak]);

  // Synchronize on initial load and when profile changes
  useEffect(() => {
    if (profile) {
      // Initialize streak data from profile
      const profileStreak = profile.streak || 0;
      const profileBestStreak = profile.workout_tracking?.longestStreak || 0;

      setCurrentStreak(profileStreak);
      setBestStreak(profileBestStreak);

      // Then refresh from the authoritative source
      refreshStreak().then(() => {
        // After refreshing, synchronize with all sources
        // Use setTimeout to prevent infinite loop
        setTimeout(() => {
          syncStreakData();
        }, 100);
      });
    }
  }, [profile?.id, profile?.workout_tracking?.streak, profile?.workout_tracking?.longestStreak, refreshStreak]); // Remove syncStreakData from dependencies

  const value = {
    currentStreak,
    bestStreak,
    loading,
    error,
    refreshStreak,
    syncStreakData,
    isRestDay,
    recordWorkout,
    recordMeal,
    recordWater
  };

  return (
    <StreakContext.Provider value={value}>
      {children}
    </StreakContext.Provider>
  );
}; 