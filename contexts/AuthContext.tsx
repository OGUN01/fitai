import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import supabase, { auth } from '../lib/supabase';
import { router } from 'expo-router';
import { verifyOnboardingCompletion } from '../utils/profileMigration';
import { syncLocalDataToServer, repairDatabaseSync } from '../utils/syncLocalData';
import { migrateLocalToCloud as migrateFunc, getTotalLocalSyncItems as getItemsFunc } from '../utils/dataSynchronizer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SecureStorage } from '../utils/secureStorage';
import { repairOnboardingStatus } from '../utils/onboardingPersistence';

// Auth session storage keys
const AUTH_SESSION_KEY = 'auth-session';
const AUTH_USER_KEY = 'auth-user';

// Define profile type
type UserProfile = {
  id: string;
  first_name?: string;
  last_name?: string;
  has_completed_onboarding: boolean;
  current_onboarding_step: string;
  [key: string]: any;
};

// Define types for auth context
type AuthContextType = {
  session: Session | null;
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<any>;
  signUp: (email: string, password: string) => Promise<any>;
  signOut: () => Promise<void>;
};

// Create the auth context with default values
const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  userProfile: null,
  loading: true,
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
});

// Custom hook for using the auth context
export const useAuth = () => {
  return useContext(AuthContext);
};

// Provider component that wraps the app and makes auth available
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const isMounted = useRef(true);
  
  // Safe setState functions that only update state if component is mounted
  const safeSetSession = useCallback(async (data: Session | null) => {
    if (isMounted.current) {
      setSession(data);
      
      // Also store in secure storage for persistence
      if (data) {
        try {
          await SecureStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(data));
          await SecureStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
        } catch (error) {
          console.error('Error saving session to secure storage:', error);
        }
      }
    }
  }, []);
  
  const safeSetUser = useCallback((data: User | null) => {
    if (isMounted.current) setUser(data);
  }, []);
  
  const safeSetLoading = useCallback((isLoading: boolean) => {
    if (isMounted.current) setLoading(isLoading);
  }, []);

  // Initialize auth state
  useEffect(() => {
    // Check for existing session
    const initializeAuth = async () => {
      try {
        safeSetLoading(true);
        
        // Try to restore session from secure storage first (faster startup)
        try {
          const storedSession = await SecureStorage.getItem(AUTH_SESSION_KEY);
          const storedUser = await SecureStorage.getItem(AUTH_USER_KEY);
          
          if (storedSession && storedUser) {
            const sessionData = JSON.parse(storedSession);
            const userData = JSON.parse(storedUser);
            
            // Only temporarily set these while we verify with Supabase
            if (isMounted.current) {
              setSession(sessionData);
              setUser(userData);
            }
            
            console.log('Restored session from secure storage');
          }
        } catch (storageError) {
          console.error('Error reading session from secure storage:', storageError);
        }
        
        // Get current session from Supabase (the source of truth)
        const { data: sessionData } = await supabase.auth.getSession();
        
        if (sessionData.session) {
          await safeSetSession(sessionData.session);
          safeSetUser(sessionData.session?.user ?? null);
          console.log('Session restored from Supabase');
        } else if (session) {
          // If we have a session in state but Supabase doesn't recognize it,
          // try to refresh the session
          try {
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
            
            if (refreshError) {
              throw refreshError;
            }
            
            if (refreshData.session) {
              await safeSetSession(refreshData.session);
              safeSetUser(refreshData.session.user);
              console.log('Session refreshed successfully');
            } else {
              // No valid session, clear storage
              await SecureStorage.deleteItem(AUTH_SESSION_KEY);
              await SecureStorage.deleteItem(AUTH_USER_KEY);
              safeSetSession(null);
              safeSetUser(null);
              console.log('No valid session found after refresh attempt');
            }
          } catch (refreshError) {
            console.error('Error refreshing session:', refreshError);
            // Clear invalid session
            await SecureStorage.deleteItem(AUTH_SESSION_KEY);
            await SecureStorage.deleteItem(AUTH_USER_KEY);
            safeSetSession(null);
            safeSetUser(null);
          }
        }
        
        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event, newSession) => {
            console.log('Auth state changed:', event);
            if (newSession) {
              await safeSetSession(newSession);
              safeSetUser(newSession.user);
            } else if (event === 'SIGNED_OUT') {
              // Clear session on sign out
              await SecureStorage.deleteItem(AUTH_SESSION_KEY);
              await SecureStorage.deleteItem(AUTH_USER_KEY);
              safeSetSession(null);
              safeSetUser(null);
            }
          }
        );
        
        return () => {
          subscription.unsubscribe();
        };
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        safeSetLoading(false);
      }
    };
    
    initializeAuth();
    
    // Cleanup function
    return () => {
      isMounted.current = false;
    };
  }, [safeSetLoading, safeSetSession, safeSetUser]);

  // Auth functions
  const signIn = async (email: string, password: string) => {
    try {
      console.log("Starting sign-in process for:", email);
      setLoading(true);
      
      // Clear any previous authentication errors
      await AsyncStorage.removeItem('auth_error');
      
      // Call Supabase signIn
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        // Store authentication error for UI to display
        await AsyncStorage.setItem('auth_error', JSON.stringify({
          message: error.message === "Invalid login credentials" 
            ? "Email or password is incorrect" 
            : error.message,
          timestamp: new Date().toISOString()
        }));
        setLoading(false);
        throw error;
      }
      
      // Clear any previous login errors
      await AsyncStorage.removeItem('auth_error');
      
      // Save session and user info securely
      await SecureStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(data.session));
      await SecureStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
      
      // Update state
      safeSetSession(data.session);
      safeSetUser(data.user);
      
      // If user has local data, we need to check for onboarding
      // and sync local data to server
      if (data.session && data.user) {
        try {
          const localProfile = await AsyncStorage.getItem('local_profile');
          
          // Check if user has completed onboarding locally
          if (localProfile) {
            console.log("Local profile found, will attempt to sync with server");
            
            // Set sync in progress flag with timestamp
            const syncTimestamp = Date.now();
            await AsyncStorage.setItem('sync_in_progress', 'true');
            await AsyncStorage.setItem('sync_in_progress_since', JSON.stringify(syncTimestamp));
            
            // If we have a local profile, mark onboarding as complete
            // This is to prevent weird state where user has to repeat onboarding
            // after logging in on a new device
            console.log("Marking onboarding as complete due to local profile");
            const { error: updateError } = await supabase
              .from('profiles')
              .update({ 
                has_completed_onboarding: true,
                current_onboarding_step: 'completed' 
              })
              .eq('id', data.user.id);
              
            if (updateError) {
              console.error("Error updating onboarding status:", updateError);
            } else {
              console.log("Successfully marked onboarding as complete");
            }
            
            // Sync all local data with priority to local changes
            try {
              console.log("Starting data sync to server");
              
              const syncResult = await syncLocalDataToServer(data.user.id);
              console.log("Sync result:", syncResult);
              
              if (syncResult.success) {
                console.log("Sync completed successfully");
                
                // Store successful sync status
                await AsyncStorage.setItem(`sync_status:${data.user.id}`, JSON.stringify({
                  timestamp: new Date().toISOString(),
                  status: 'success'
                }));
              } else {
                console.error("Sync failed:", syncResult.error);
                
                // If there was a specific error about meal_completions or workout_completions
                // with a NULL constraint violation, we need to fix that
                if (syncResult.error && (
                  syncResult.error.includes("workout_completions") || 
                  syncResult.error.includes("meal_completions") ||
                  syncResult.error.includes("violates not-null") ||
                  syncResult.error.includes("null value")
                )) {
                  console.log("Detected ID/NULL issues in sync, attempting repair");
                  try {
                    const repairResult = await repairDatabaseSync(data.user.id);
                    console.log("Repair result:", repairResult);
                    
                    if (repairResult.success) {
                      // If repair was successful, record the success
                      await AsyncStorage.setItem('sync_repair_result', JSON.stringify({
                        timestamp: new Date().toISOString(),
                        message: `Repaired ${repairResult.repairs.workouts} workouts and ${repairResult.repairs.meals} meals`,
                        success: true
                      }));
                    } else {
                      // If repair failed, record the error
                      await AsyncStorage.setItem('sync_repair_result', JSON.stringify({
                        timestamp: new Date().toISOString(),
                        message: repairResult.message,
                        success: false
                      }));
                    }
                  } catch (repairError) {
                    console.error("Error attempting repair:", repairError);
                  }
                }
                
                // Store sync error for later display
                await AsyncStorage.setItem('last_sync_error', JSON.stringify({
                  message: syncResult.error,
                  timestamp: new Date().toISOString(),
                  syncId: syncResult.syncId
                }));
              }
            } catch (syncError: any) {
              console.error("Error during sync process:", syncError);
              // Store the error
              await AsyncStorage.setItem('sync_error', JSON.stringify({
                message: syncError.message || "Unknown sync error",
                timestamp: new Date().toISOString()
              }));
            } finally {
              // Always clear the in-progress flag
              await AsyncStorage.removeItem('sync_in_progress');
              
              // Mark as recently synced so ProfileContext uses the cached version 
              // regardless of success/failure to prevent flickering
              await AsyncStorage.setItem(`recently_synced:${data.user.id}`, 'true');
              
              // Get the merged profile with local data priority
              const cachedMergedProfile = await AsyncStorage.getItem(`profile:${data.user.id}`);
              
              if (cachedMergedProfile) {
                console.log("Using cached merged profile from sync");
                setUserProfile(JSON.parse(cachedMergedProfile));
              } else {
                // Refresh user profile after sync - but this is a fallback
                await fetchUserProfile(data.user.id);
              }
            }
          } else {
            // No local profile, just fetch from server
            console.log("No local profile found, fetching from server");
            await fetchUserProfile(data.user.id);
          }
        } catch (profileError) {
          console.error("Error handling profile:", profileError);
          // Continue with sign in process despite profile errors
          await fetchUserProfile(data.user.id);
        }
      }
      
      // Verify and fix onboarding status if needed
      await verifyAndFixOnboardingStatus();
      
      // Enhanced data synchronization
      // This ensures that any local data is properly synced to Supabase
      console.log("🔄 Starting enhanced data synchronization process");
      try {
        // Check if there's local data to sync
        const { total, breakdown } = await getItemsFunc(data.user.id);
        
        if (total > 0) {
          console.log(`📊 Found ${total} local items to sync with Supabase: `, breakdown);
          
          // Use our enhanced migration utility for reliable data transfer
          const migrationSuccess = await migrateFunc(data.user.id);
          
          if (migrationSuccess) {
            console.log("✅ Successfully synchronized local data with Supabase");
          } else {
            console.warn("⚠️ Some items failed to synchronize during login");
            // Fall back to traditional sync method
            await syncLocalDataToServer(data.user.id);
          }
        } else {
          console.log("ℹ️ No local data to synchronize");
        }
      } catch (syncError) {
        console.error("❌ Error during data synchronization:", syncError);
        // Continue with sign in process despite synchronization errors
      }
      
      console.log("✅ Sign in process completed");
      // Let the component handle navigation instead of doing it here
      // router.replace("/(tabs)" as any);
      return data; // Return the authentication data
    } catch (error) {
      console.error("Sign in process failed:", error);
      
      // Store the error for the UI to display if not already stored
      try {
        const existingError = await AsyncStorage.getItem('auth_error');
        if (!existingError) {
          await AsyncStorage.setItem('auth_error', JSON.stringify({
            message: (error as Error).message || "Sign in failed",
            timestamp: new Date().toISOString()
          }));
        }
      } catch (storageError) {
        console.error("Error storing auth error:", storageError);
      }
      
      setLoading(false);
      throw error; // Re-throw the error for the UI to handle
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      console.log("✉️ Starting enhanced sign-up process for:", email);
      setLoading(true);
      
      // Call Supabase signUp directly
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      
      if (error) throw error;
      
      // If signup was successful and user is confirmed immediately
      if (data?.user && !data.user.identities?.[0]?.identity_data?.email_confirmed_at) {
        console.log("🔄 New user created, preparing to migrate local data to cloud");
        
        // Check if there's local data to migrate
        const { total, breakdown } = await getItemsFunc(data.user.id);
        
        if (total > 0) {
          console.log(`📊 Found ${total} local items to migrate: `, breakdown);
          
          try {
            // Use our enhanced migration utility
            const migrationSuccess = await migrateFunc(data.user.id);
            
            if (migrationSuccess) {
              console.log("✅ Successfully migrated local data to new user account");
            } else {
              console.warn("⚠️ Some items failed to migrate during signup");
            }
          } catch (migrationError) {
            console.error("❌ Error during data migration:", migrationError);
            // Continue with signup process despite migration errors
          }
        } else {
          console.log("ℹ️ No local data to migrate for new user");
        }
      }
      
      console.log("✅ Sign-up successful, user can now sign in");
      return data;
      // We don't automatically sign in after signup
      // User will need to log in after registration
    } catch (error: any) {
      console.error('❌ Error signing up:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      console.log('AuthContext: Starting signOut process');
      
      // Sign out from Supabase first
      await supabase.auth.signOut();
      
      // Clear secure storage
      await SecureStorage.deleteItem(AUTH_SESSION_KEY);
      await SecureStorage.deleteItem(AUTH_USER_KEY);
      
      // Then clear the local state
      safeSetSession(null);
      safeSetUser(null);
      
      console.log('AuthContext: Signout successful');
    } catch (error) {
      console.error('AuthContext: Error signing out:', error);
      throw error;
    }
  };

  // Fetch user profile from Supabase
  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
        
      if (error) throw error;
      
      setUserProfile(data);
      return data;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  };
  
  // Verify and fix onboarding status if needed - enhanced reliability
  const verifyAndFixOnboardingStatus = async () => {
    if (!user) return;
    
    try {
      console.log("🔍 Verifying onboarding completion status with enhanced reliability...");
      
      // First use our new reliable utility to check and repair onboarding status
      await repairOnboardingStatus();
      
      // Then, for backward compatibility, also use the existing verification
      const verificationResult = await verifyOnboardingCompletion(user.id);
      
      if (verificationResult.success) {
        console.log("✓ Traditional onboarding verification result:", verificationResult.message);
        if (verificationResult.wasFixed) {
          console.log("🔧 Fixed onboarding status during traditional verification");
        }
      } else {
        console.error("⚠️ Error in traditional onboarding verification:", verificationResult.message);
      }
      
      // Sync onboarding status between local and server if needed
      try {
        // Get user profile from Supabase to check server-side status
        const { data: profileData } = await supabase
          .from('profiles')
          .select('has_completed_onboarding, current_onboarding_step')
          .eq('id', user.id)
          .single();
        
        if (profileData) {
          // Get local profile to compare
          const localProfileJson = await AsyncStorage.getItem('local_profile');
          const localProfile = localProfileJson ? JSON.parse(localProfileJson) : null;
          
          // If local shows completed but server doesn't, update server
          if (localProfile?.has_completed_local_onboarding === true && 
              profileData.has_completed_onboarding === false) {
            console.log("🔄 Syncing onboarding completion status to server");
            await supabase
              .from('profiles')
              .update({
                has_completed_onboarding: true,
                current_onboarding_step: 'completed'
              })
              .eq('id', user.id);
          }
        }
      } catch (syncError) {
        console.error("❌ Error syncing onboarding status:", syncError);
      }
    } catch (verificationError) {
      console.error("❌ Exception during enhanced onboarding verification:", verificationError);
    }
  };

  const value = {
    session,
    user,
    userProfile,
    loading,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
