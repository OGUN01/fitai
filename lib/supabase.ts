import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../constants/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Create a custom storage provider using AsyncStorage
const customStorageProvider = {
  getItem: (key: string) => {
    return AsyncStorage.getItem(key);
  },
  setItem: (key: string, value: string) => {
    return AsyncStorage.setItem(key, value);
  },
  removeItem: (key: string) => {
    return AsyncStorage.removeItem(key);
  },
};

// Create a single supabase client for the entire app
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false, // Set to false in React Native
    storage: customStorageProvider,
  },
});

export default supabase;

// Auth functions
export const auth = {
  /**
   * Sign up a new user
   */
  signUp: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    
    if (error) throw error;
    return data.user;
  },
  
  /**
   * Sign in a user
   */
  signIn: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) throw error;
    return data.session.user;
  },
  
  /**
   * Sign out the current user
   */
  signOut: async () => {
    console.log('Supabase: Starting signOut process');
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      console.log('Supabase: SignOut successful');
    } catch (err) {
      console.error('Supabase signOut error:', err);
      throw err;
    }
  },
  
  /**
   * Reset password
   */
  resetPassword: async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'fitnessapp://reset-password',
    });
    
    if (error) throw error;
  },
  
  /**
   * Get the current session
   */
  getSession: async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },
  
  /**
   * Get the current user
   */
  getUser: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    return data.user;
  },
};

// Database functions
export const db = {
  /**
   * Get user profile
   */
  getUserProfile: async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId);

    if (error) throw error;
    return data && data.length > 0 ? data[0] : null;
  },
  
  /**
   * Create or update user profile
   */
  upsertUserProfile: async (profile: any) => {
    const { data, error } = await supabase
      .from('profiles')
      .upsert(profile)
      .select();
    
    if (error) throw error;
    return data;
  },
  
  /**
   * Get user preferences
   */
  getUserPreferences: async (userId: string) => {
    const { data, error } = await supabase
      .from('preferences')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;
    return data && data.length > 0 ? data[0] : null;
  },
  
  /**
   * Get user workouts
   */
  getUserWorkouts: async (userId: string) => {
    const { data, error } = await supabase
      .from('workouts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },
  
  /**
   * Get user meal plans
   */
  getUserMealPlans: async (userId: string) => {
    const { data, error } = await supabase
      .from('meal_plans')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },
  
  /**
   * Get user progress data
   */
  getUserProgress: async (userId: string) => {
    const { data, error } = await supabase
      .from('progress')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });
    
    if (error) throw error;
    return data;
  },
};
