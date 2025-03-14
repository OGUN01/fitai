// Screen routes for Expo Router
export const ROUTES = {
  // Auth routes
  AUTH: {
    LOGIN: '/(auth)/login',
    SIGNUP: '/(auth)/signup',
    FORGOT_PASSWORD: '/(auth)/forgot-password',
  },
  
  // Onboarding routes
  ONBOARDING: {
    USER_DETAILS: '/(onboarding)/user-details',
    DIET_PREFERENCES: '/(onboarding)/diet-preferences',
    BODY_ANALYSIS: '/(onboarding)/body-analysis',
    WORKOUT_PREFERENCES: '/(onboarding)/workout-preferences',
    REVIEW: '/(onboarding)/review',
  },
  
  // Main app tabs
  TABS: {
    HOME: '/(tabs)/home',
    WORKOUT: {
      INDEX: '/(tabs)/workout',
      DETAIL: '/(tabs)/workout/[id]',
      HISTORY: '/(tabs)/workout/history',
    },
    NUTRITION: {
      INDEX: '/(tabs)/nutrition',
      MEAL_PLAN: '/(tabs)/nutrition/meal-plan',
      WATER_TRACKER: '/(tabs)/nutrition/water-tracker',
    },
    PROGRESS: {
      INDEX: '/(tabs)/progress',
      BODY_METRICS: '/(tabs)/progress/body-metrics',
      ACHIEVEMENTS: '/(tabs)/progress/achievements',
    },
    PROFILE: {
      INDEX: '/(tabs)/profile',
      SETTINGS: '/(tabs)/profile/settings',
      PREFERENCES: '/(tabs)/profile/preferences',
    },
  },
};

// Tab configuration
export const TAB_CONFIG = {
  HOME: {
    title: 'Home',
    icon: 'home',
  },
  WORKOUT: {
    title: 'Workout',
    icon: 'dumbbell',
  },
  NUTRITION: {
    title: 'Nutrition',
    icon: 'food-apple',
  },
  PROGRESS: {
    title: 'Progress',
    icon: 'chart-line',
  },
  PROFILE: {
    title: 'Profile',
    icon: 'account',
  },
};

// Screen transition animations
export const SCREEN_ANIMATIONS = {
  SLIDE_HORIZONTAL: {
    gestureDirection: 'horizontal',
    cardStyleInterpolator: ({ current, layouts }) => {
      return {
        cardStyle: {
          transform: [
            {
              translateX: current.progress.interpolate({
                inputRange: [0, 1],
                outputRange: [layouts.screen.width, 0],
              }),
            },
          ],
        },
      };
    },
  },
  SLIDE_VERTICAL: {
    gestureDirection: 'vertical',
    cardStyleInterpolator: ({ current, layouts }) => {
      return {
        cardStyle: {
          transform: [
            {
              translateY: current.progress.interpolate({
                inputRange: [0, 1],
                outputRange: [layouts.screen.height, 0],
              }),
            },
          ],
        },
      };
    },
  },
  FADE: {
    cardStyleInterpolator: ({ current }) => {
      return {
        cardStyle: {
          opacity: current.progress,
        },
      };
    },
  },
};
