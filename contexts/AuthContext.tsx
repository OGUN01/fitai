import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback, useRef } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Session, User } from '@supabase/supabase-js';
import supabase, { auth } from '../lib/supabase';
import { router } from 'expo-router';

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
  const safeSetSession = useCallback((data: Session | null) => {
    if (isMounted.current) setSession(data);
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
        
        // Get current session
        const { data: sessionData } = await supabase.auth.getSession();
        safeSetSession(sessionData.session);
        safeSetUser(sessionData.session?.user ?? null);
        
        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          (_event, session) => {
            safeSetSession(session);
            safeSetUser(session?.user ?? null);
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
        safeSetSession(data.session);
        safeSetUser(data.session.user);
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
