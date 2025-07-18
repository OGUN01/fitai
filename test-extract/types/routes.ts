/**
 * Route definitions for the app
 */

// Define tab routes
export type TabsRoutes = {
  "/(tabs)": undefined;
  "/(tabs)/index": undefined;
  "/(tabs)/home": undefined;
  "/(tabs)/workout": undefined;
  "/(tabs)/nutrition": undefined;
  "/(tabs)/progress": undefined;
  "/(tabs)/profile": undefined;
  "/(tabs)/settings": undefined;
};

// Define settings routes
export type SettingsRoutes = {
  "/(settings)/notifications": undefined;
  "/(settings)/profile": undefined;
  "/(settings)/account": undefined;
  "/(settings)/about": undefined;
  "/(settings)/privacy": undefined;
  "/(settings)/units": undefined;
  "/(settings)/theme": undefined;
};

// Define onboarding routes
export type OnboardingRoutes = {
  "/(onboarding)/welcome": undefined;
  "/(onboarding)/personal-info": undefined;
  "/(onboarding)/body-metrics": undefined;
  "/(onboarding)/fitness-goals": undefined;
  "/(onboarding)/workout-preferences": undefined;
  "/(onboarding)/diet-preferences": undefined;
  "/(onboarding)/review": undefined;
  "/(onboarding)/completed": undefined;
};

// Define auth routes
export type AuthRoutes = {
  "/(auth)/login": undefined;
  "/(auth)/signup": undefined;
  "/(auth)/forgot-password": undefined;
  "/(auth)/reset-password": undefined;
};

// Define dev routes
export type DevRoutes = {
  "/(dev)/test-fallbacks": undefined;
  "/test-fallbacks": undefined;
  "/test-workout": undefined;
};

// Combine all route types
export type AppRoutes = 
  & TabsRoutes
  & SettingsRoutes
  & OnboardingRoutes
  & AuthRoutes
  & DevRoutes
  & {
    "/": undefined;
    "/index": undefined;
    "/login": undefined;
    "/signup": undefined;
  };

// Declare the module to augment global types
declare global {
  namespace ReactNavigation {
    interface RootParamList extends AppRoutes {}
  }
} 