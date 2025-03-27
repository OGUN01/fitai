import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback, useRef } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Session, User } from '@supabase/supabase-js';
import supabase, { auth } from '../lib/supabase';
import { router } from 'expo-router';
import { verifyOnboardingCompletion } from '../utils/profileMigration';

// Auth session storage keys
const AUTH_SESSION_KEY = 'auth-session';
const AUTH_USER_KEY = 'auth-user';

// Define types for auth context
type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<any>;
  signOut: () => Promise<void>;
};

// Create the auth context with default values
const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
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
  const [loading, setLoading] = useState(true);
  const isMounted = useRef(true);
  
  // Safe setState functions that only update state if component is mounted
  const safeSetSession = useCallback(async (data: Session | null) => {
    if (isMounted.current) {
      setSession(data);
      
      // Also store in secure storage for persistence
      if (data) {
        try {
          await SecureStore.setItemAsync(AUTH_SESSION_KEY, JSON.stringify(data));
          await SecureStore.setItemAsync(AUTH_USER_KEY, JSON.stringify(data.user));
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
          const storedSession = await SecureStore.getItemAsync(AUTH_SESSION_KEY);
          const storedUser = await SecureStore.getItemAsync(AUTH_USER_KEY);
          
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
              await SecureStore.deleteItemAsync(AUTH_SESSION_KEY);
              await SecureStore.deleteItemAsync(AUTH_USER_KEY);
              safeSetSession(null);
              safeSetUser(null);
              console.log('No valid session found after refresh attempt');
            }
          } catch (refreshError) {
            console.error('Error refreshing session:', refreshError);
            // Clear invalid session
            await SecureStore.deleteItemAsync(AUTH_SESSION_KEY);
            await SecureStore.deleteItemAsync(AUTH_USER_KEY);
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
              await SecureStore.deleteItemAsync(AUTH_SESSION_KEY);
              await SecureStore.deleteItemAsync(AUTH_USER_KEY);
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
      
      // Call the auth signIn function
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;
      
      // Update state with the session and user
      if (data && data.session) {
        await safeSetSession(data.session);
        safeSetUser(data.session.user);
        
        // Verify and fix onboarding status before redirecting the user
        // This prevents onboarding from repeating on different devices
        if (data.session.user) {
          console.log("Verifying onboarding completion status...");
          try {
            const verificationResult = await verifyOnboardingCompletion(data.session.user.id);
            if (verificationResult.success) {
              console.log("Onboarding verification result:", verificationResult.message);
              if (verificationResult.wasFixed) {
                console.log("Fixed onboarding status during login!");
              }
            } else {
              console.error("Error verifying onboarding status:", verificationResult.message);
            }
          } catch (verificationError) {
            console.error("Exception during onboarding verification:", verificationError);
            // Continue with login despite verification error
          }
        }
        
        console.log("Sign-in successful, redirecting to app");
        router.replace('/(tabs)/');
      } else {
        throw new Error('Invalid response from authentication server');
      }
    } catch (error: any) {
      console.error('Error signing in:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      console.log("Starting sign-up process for:", email);
      setLoading(true);
      
      // Call Supabase signUp directly
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      
      if (error) throw error;
      
      console.log("Sign-up successful, user can now sign in");
      return data;
      // We don't automatically sign in after signup
      // User will need to log in after registration
    } catch (error: any) {
      console.error('Error signing up:', error);
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
      await SecureStore.deleteItemAsync(AUTH_SESSION_KEY);
      await SecureStore.deleteItemAsync(AUTH_USER_KEY);
      
      // Then clear the local state
      safeSetSession(null);
      safeSetUser(null);
      
      console.log('AuthContext: Signout successful');
    } catch (error) {
      console.error('AuthContext: Error signing out:', error);
      throw error;
    }
  };

  const value = {
    session,
    user,
    loading,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
