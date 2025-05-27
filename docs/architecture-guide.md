# FitAI Architecture Guide

## Overview

This document provides a comprehensive overview of the FitAI application's architecture, explaining the directory structure, key components, data flow, and how different parts of the application interact. This guide is intended for developers who need to understand the application's structure for maintenance, enhancements, or migration to different systems.

## Directory Structure

```
fitness/
├── app/                     # Main application screens using Expo Router
│   ├── (auth)/              # Authentication screens
│   ├── (dev)/               # Developer tools and debug screens
│   ├── (onboarding)/        # Onboarding flow screens
│   └── (tabs)/              # Main app tabs (Home, Workout, Nutrition, Progress, Profile)
├── assets/                  # Static assets (images, fonts, etc.)
├── components/              # Reusable UI components
│   ├── home/                # Components for Home screen
│   ├── nutrition/           # Components for Nutrition tab
│   ├── onboarding/          # Components for onboarding flow
│   ├── progress/            # Components for Progress tab
│   ├── ui/                  # Generic UI components (buttons, cards, etc.)
│   └── workout/             # Components for Workout tab
├── constants/               # Application constants and configuration
├── contexts/                # React Context providers
├── docs/                    # Documentation files
├── hooks/                   # Custom React hooks
├── lib/                     # Core libraries and integrations
├── services/                # Backend services and API integrations
│   ├── ai/                  # AI service integrations (Gemini)
│   └── api/                 # API service functions
├── stores/                  # State management stores
├── supabase/                # Supabase-specific configuration
├── theme/                   # Theme and styling definitions
├── types/                   # TypeScript type definitions
└── utils/                   # Utility functions and helpers
```

## Core Architecture Components

### 1. Navigation (Expo Router)

The application uses Expo Router for navigation, which provides a file-system based routing approach:

- `app/(tabs)/` - Main tabs accessible after login and onboarding
- `app/(auth)/` - Authentication screens (login, signup, forgot password)
- `app/(onboarding)/` - Onboarding flow screens for new users
- `app/(dev)/` - Developer tools and debug screens

Navigation between screens is primarily handled through the `router` object imported from `expo-router`:

```typescript
import { router } from 'expo-router';

// Navigate to a route
router.push('/(tabs)/home');

// Replace the current screen
router.replace('/(tabs)/');

// Go back to the previous screen
router.back();
```

### 2. Context System

FitAI uses React Context for global state management. The key contexts are:

#### AuthContext

Located in `contexts/AuthContext.tsx`, this handles:
- User authentication state
- Login, signup, and logout functionality
- Session management and persistence
- Token refresh and storage

Usage:
```typescript
const { user, signIn, signOut, loading } = useAuth();
```

#### ProfileContext

Located in `contexts/ProfileContext.tsx`, this manages:
- User profile data
- Profile synchronization between local and server storage
- Profile updates and refreshing
- Onboarding state tracking

Usage:
```typescript
const { profile, updateProfile, refreshProfile } = useProfile();
```

### 3. Database Integration (Supabase)

The application uses Supabase as its backend database. The core integration is in `lib/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../constants/api';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export default supabase;
```

Key Supabase tables:
- `profiles` - User profile information
- `workout_completions` - Records of completed workouts
- `meal_completions` - Records of completed meals
- `workouts` - Workout plans and templates
- `meal_plans` - Meal plans and recipes
- `progress` - User progress tracking data

### 4. Data Synchronization

The application uses a dual-storage approach for data persistence:

1. **Server Storage (Supabase)**: Primary source of truth for all user data.
2. **Local Storage (AsyncStorage)**: Cache for offline access and performance.

The synchronization flow is managed in `ProfileContext.tsx`:

1. When the app loads, it tries to load data from AsyncStorage first for immediate display.
2. It then fetches the latest data from Supabase and updates both state and AsyncStorage.
3. When updates are made, data is saved to Supabase first, then to AsyncStorage.
4. The `synchronizeProfileData` utility ensures consistency between nested objects and root properties.

### 5. AI Integration (Gemini)

FitAI uses Google's Gemini API for AI-powered features:

- Located in `services/ai/geminiService.ts`
- Used for workout generation, diet planning, and body analysis
- Configuration in `constants/api.ts`

#### Workout Generator Architecture

The application uses a sophisticated multi-layered approach for generating personalized workout plans:

1. **Pydantic-Style Generator** (`services/ai/pydanticWorkoutGenerator.ts`):
   - Implements a strongly-typed workout generation system using Zod schemas
   - Ensures consistent output format with comprehensive validation
   - Uses Gemini 2.0 Flash as the primary model for generation
   - Handles markdown code blocks and extracts valid JSON from responses
   - Robustly sanitizes exercise data, particularly the "reps" field format
   - Includes clear fallback progression with detailed error logging
   - Supports country/region-specific exercise recommendations

2. **Reliable Generator** (`services/ai/reliableWorkoutGenerator.ts`):
   - Orchestrates multiple generation methods in sequence
   - Follows a clear fallback flow:
     1. PydanticWorkoutGenerator primary method (direct generation)
     2. PydanticWorkoutGenerator backup method (step-by-step generation)
     3. StructuredWorkoutGenerator with its own fallbacks
     4. EnhancedWorkoutGenerator as final fallback
   - Ensures successful workout plan generation despite API limitations
   - Preserves all user preferences throughout the fallback chain

3. **Generation Process Flow**:
   - User preferences (including fitness level, available equipment, focus areas, etc.)
   - Primary generation attempt with structured prompts
   - JSON extraction and validation against Zod schema
   - Automatic retries for rate limits with exponential backoff
   - Graceful degradation to simpler methods if needed
   - All methods respect user preferences for personalized results

4. **Error Handling Strategy**:
   - Retry logic with exponential backoff for rate limits
   - Intelligent JSON extraction from various response formats
   - Field validation and auto-sanitization for exercise parameters
   - Path-specific error reporting for empty exercise arrays
   - Detailed logging for troubleshooting and monitoring
   - Graceful degradation to simpler generation methods

#### Meal Plan Generator Architecture

The application uses a sophisticated multi-layered approach for generating personalized meal plans:

1. **Pydantic-Style Generator** (`services/ai/pydanticMealPlanGenerator.ts`):
   - Implements a strongly-typed meal plan generation system using Zod schemas
   - Ensures consistent output format with comprehensive validation
   - Uses Gemini 2.0 Flash as the primary model for generation
   - Handles markdown code blocks and extracts valid JSON from responses
   - Creates completely unique meals for each day of the week through enhanced prompting
   - Enforces meal diversity requirements in both initial generation and fallbacks
   - Implements intelligent naming algorithms for fallback-generated meals
   - Supports region-specific authentic cuisine recommendations
   - Includes robust validation for nutrition data and recipe completeness

2. **Reliable Generator** (`services/ai/reliableMealPlanGenerator.ts`):
   - Orchestrates multiple generation methods in sequence
   - Follows a clear fallback flow:
     1. PydanticMealPlanGenerator primary method (direct generation)
     2. PydanticMealPlanGenerator backup method (step-by-step generation)
     3. StructuredMealPlanGenerator with its own fallbacks
     4. Enhanced fallback systems that ensure unique meals across all days
   - Ensures successful meal plan generation despite API limitations
   - Preserves all user dietary preferences throughout the fallback chain
   - Maintains recipe uniqueness across days even when using fallbacks

3. **Generation Process Flow**:
   - User preferences (including diet type, allergies, restrictions, calorie targets)
   - Primary generation attempt with structured prompts emphasizing meal uniqueness
   - JSON extraction and validation against Zod schema
   - Automatic retries for rate limits with exponential backoff
   - Graceful degradation to simpler methods if needed
   - Enhanced variation algorithms when fallbacks must create additional days
   - All methods respect user preferences for personalized results

4. **Error Handling Strategy**:
   - Retry logic with exponential backoff for rate limits
   - Intelligent JSON extraction from various response formats
   - Field validation and auto-sanitization for nutritional parameters
   - Detailed logging for troubleshooting and monitoring
   - Graceful degradation to simpler generation methods
   - Preservation of authentic recipe names even when using fallbacks

## Database Schema

### Profiles Table Structure

The `profiles` table is the core of user data storage:

1. **Scalar Fields**:
   - `id` (primary key, matches auth.users.id)
   - `has_completed_onboarding` (boolean)
   - `current_onboarding_step` (string)
   - `height_cm` (number)
   - `weight_kg` (number)
   - `target_weight_kg` (number)
   - `streak_days` (number)

2. **JSONB Fields**:
   - `diet_preferences` - Contains all diet related data
   - `workout_preferences` - Contains all workout related data
   - `body_analysis` - Contains all body-related data
   - `workout_plan` - Contains the current workout plan
   - `meal_plans` - Contains the current meal plans

### Field Duplication Strategy

To optimize for both query performance and flexibility:

1. Critical data is stored both at root level (scalar fields) and in JSONB objects.
2. Root-level properties are used for direct database queries.
3. JSONB fields store complete objects including additional properties.
4. The `synchronizeProfileData` utility ensures consistency between both locations.

## Key Data Flows

### Authentication Flow

1. User enters credentials in Login screen
2. `AuthContext.signIn()` calls Supabase auth API
3. On success, session is stored and user is redirected to main app
4. `AuthContext` sets up listeners for session changes
5. When token expires, Supabase automatically refreshes it

### Onboarding Flow

1. New user completes signup
2. `checkAndRouteUser()` in ProfileContext checks if onboarding is completed
3. If not completed, user is routed to the current onboarding step
4. As user completes each step, `updateProfile()` saves progress
5. On final step, `completeOnboarding()` is called, setting `has_completed_onboarding: true`
6. User is then redirected to main app

### Workout Completion Flow

1. User completes a workout in the Workout tab
2. `markWorkoutComplete()` is called from `trackingService.ts`
3. Completion record is saved to `workout_completions` table
4. Service calculates estimated calories burned based on user data
5. `getWorkoutStats()` is called to update streak and stats
6. User profile is updated with new streak information
7. Home tab shows updated completion status

### Meal Tracking Flow

1. User logs a meal in the Nutrition tab
2. `markMealComplete()` is called from `trackingService.ts`
3. Completion record is saved to `meal_completions` table
4. `getMealStats()` is called to update meal statistics
5. Home tab shows updated meal completion status

## Component Design Patterns

### 1. Component Composition

The application uses component composition extensively:

```tsx
// Example from nutrition tab
<MealCard>
  <MealHeader title={meal.title} time={meal.time} />
  <MealContent>
    <MealImage source={meal.image} />
    <MealDescription text={meal.description} />
  </MealContent>
  <MealActions onComplete={handleComplete} />
</MealCard>
```

### 2. Custom Hooks for Logic Separation

Custom hooks are used to separate business logic from presentation:

```tsx
// hooks/useWorkoutProgress.ts
export function useWorkoutProgress(userId: string) {
  const [stats, setStats] = useState<WorkoutStats | null>(null);
  
  useEffect(() => {
    async function loadStats() {
      const workoutStats = await getWorkoutStats(userId);
      setStats(workoutStats);
    }
    
    loadStats();
  }, [userId]);
  
  return stats;
}

// Usage in component
const workoutStats = useWorkoutProgress(user.id);
```

### 3. Conditional Rendering with Fallbacks

Components handle loading, error, and empty states:

```tsx
// Example pattern used throughout the app
{loading ? (
  <LoadingIndicator />
) : error ? (
  <ErrorMessage message={error} onRetry={handleRetry} />
) : !data || data.length === 0 ? (
  <EmptyState message="No data available" />
) : (
  <DataDisplay data={data} />
)}
```

## Utility Functions

The application includes several important utility functions:

### Profile Data Management

- `synchronizeProfileData` - Ensures data consistency between nested objects and root properties
- `deepMerge` - Merges nested objects with proper handling of arrays and objects
- `processUnitConversions` - Converts between imperial and metric units
- `sanitizeForDatabase` - Filters properties to only include valid database columns

### Progress Calculation

- `getWorkoutStats` - Calculates workout completion statistics
- `getMealStats` - Calculates meal completion statistics
- `calculateDayStreak` - Determines the current streak of consecutive days with activity

### Unit Conversions

- `feetToCm` - Converts height from feet/inches to centimeters
- `cmToFeet` - Converts height from centimeters to feet/inches
- `lbsToKg` - Converts weight from pounds to kilograms
- `kgToLbs` - Converts weight from kilograms to pounds

### AI Utilities

- `extractJsonFromText` - Extracts JSON data from text responses containing code blocks or raw JSON
- `extractAndPreprocessJson` - Extracts and validates JSON, ensuring it meets minimum requirements
- `ensureMinimumRequirements` - Adds default values for missing required fields in workout plans
- `retryWithExponentialBackoff` - Implements retry logic for handling API rate limits

## Error Handling Strategy

The application uses a multi-layer error handling approach:

1. **Try/Catch Blocks** - Used in all async operations
2. **Error States** - Components track error states for display
3. **Fallback Data** - Default values provided when data is missing
4. **Logging** - Comprehensive logging for debugging
5. **Retry Mechanisms** - Critical operations include retry logic

Example error handling pattern:

```typescript
try {
  const result = await apiCall();
  setData(result);
  setError(null);
} catch (err) {
  console.error('Error in operation:', err);
  setError('Failed to load data. Please try again.');
  // Provide fallback data if available
  setData(fallbackData);
} finally {
  setLoading(false);
}
```

## Key Files for System Migration

When migrating this application to a new system, these files are critical:

1. **`constants/api.ts`** - Contains API endpoints and keys
2. **`lib/supabase.ts`** - Supabase client configuration
3. **`contexts/AuthContext.tsx`** - Authentication logic
4. **`contexts/ProfileContext.tsx`** - Profile data management
5. **`services/trackingService.ts`** - Workout and meal tracking
6. **`utils/profileSynchronizer.ts`** - Data synchronization utilities

## Cross-Platform Considerations

The application is designed to work on multiple platforms:

1. **iOS/Android Differences**:
   - Platform-specific time picker implementations
   - Different keyboard behavior handling
   - Native component adaptations

2. **Web Compatibility**:
   - Web-friendly animations with graceful degradation
   - Touch vs. click event handling
   - Responsive layouts for various screen sizes

## Performance Optimizations

The application includes several performance optimizations:

1. **Memoization** - React.memo and useMemo for expensive components and calculations
2. **Local Caching** - AsyncStorage for offline access and reduced API calls
3. **Lazy Loading** - Components and screens loaded only when needed
4. **Debouncing** - Input handlers debounced to reduce unnecessary processing
5. **Image Optimization** - Proper sizing and caching of images

## Testing Approach

The application can be tested using:

1. **Unit Tests** - For utility functions and hooks
2. **Component Tests** - For UI components
3. **Integration Tests** - For flows like authentication and onboarding
4. **E2E Tests** - For critical user journeys

## Debugging Tools

The application includes built-in debugging tools:

1. **Debug Panel** - Located at `app/(dev)/debug-panel.tsx`
2. **Profile Inspector** - For examining profile data structure
3. **Logging System** - Comprehensive logging for tracking data flow
4. **Data Migration Utilities** - For fixing data inconsistencies

## Hidden Test Features

The application includes several hidden testing features that are conditionally rendered based on development mode:

1. **Test Menu Access**:
   - Test buttons and debug menus are conditionally rendered using the `__DEV__` flag
   - Hidden from end users in production builds
   - Visible only in development mode or when manually enabled
   - Located primarily in the Workout and Nutrition tabs

2. **Test Generation Utilities**:
   - In the Nutrition tab, test generation buttons are available at the bottom of the screen
   - Test buttons for alternative meal plan generation approaches are hidden behind the `__DEV__` flag
   - Workout tab has similar test buttons for trying different workout generation methods
   - These provide a way to test fallback generation systems without modifying code

3. **Debug Controls Container**:
   - Located at the bottom of key screens with the `styles.debugContainer` styling
   - Includes buttons for logging data structures, forcing regeneration, and testing edge cases
   - All wrapped in conditional rendering: `{__DEV__ && (<View>...</View>)}`
   - Can be temporarily enabled in production for troubleshooting by adding a special flag

4. **Developer Access Pattern**:
   - To access test features in development builds:
     - Run the app in development mode (`npm run start`)
     - Test features will be automatically visible
   - To access test features in production (for emergency troubleshooting):
     - Add `enableDebugMode` flag to profile (via debug panel or direct database edit)
     - This reveals the normally hidden test UI components

These testing features are essential for developers to verify the correct functioning of complex systems like AI generation, while keeping the UI clean for end users.

## Data Persistence Safeguards

The application implements several safeguards to ensure critical user data is always preserved and properly displayed:

### Field Preservation Mechanisms

To ensure that important fields like `full_name` are never lost during database operations:

1. **Enhanced Sanitization Process**:
   ```typescript
   function sanitizeForDatabase(data: Record<string, any>): Record<string, any> {
     // Get the filtered data using the database columns
     const filteredData = filterToDatabaseColumns(data);
     
     // Ensure critical fields are always included
     if (data.full_name) {
       filteredData.full_name = data.full_name;
     }
     
     // Additional logging for verification
     console.log('SANITIZE: Preserving critical fields in database update');
     
     return filteredData;
   }
   ```

2. **Explicit Column Inclusion**:
   The `DATABASE_COLUMNS` array explicitly includes all critical fields to ensure they're never filtered out:
   ```typescript
   export const DATABASE_COLUMNS = [
     'id',
     'username',
     'full_name',
     'height_cm',
     'weight_kg',
     // ... other columns
   ];
   ```

3. **Multi-level Fallback Strategy**:
   When displaying user data, multiple fallback paths ensure data is shown even if the primary source is missing:
   ```typescript
   // Example of user name display with fallbacks
   const userName = profile?.full_name || user?.email?.split('@')[0] || 'User';
   
   // Example of first name extraction with fallback
   const firstName = profile?.full_name ? profile.full_name.split(' ')[0] : 'User';
   ```

4. **Comprehensive Logging**:
   Detailed logging throughout the synchronization process helps identify and troubleshoot issues:
   ```typescript
   console.log('SANITIZE: Final filtered data includes full_name:', filteredData.full_name);
   console.log('FETCH PROFILE: Profile found with full_name:', data.full_name);
   ```

### Data Display Improvements

Several improvements ensure data is properly displayed throughout the application:

1. **Personalized Greetings**:
   The home screen displays personalized greetings using the user's first name:
   ```typescript
   const firstName = profile?.full_name ? profile.full_name.split(' ')[0] : 'User';
   return <Text>Good {getTimeOfDay()}, {firstName}</Text>;
   ```

2. **Enhanced Progress Calculation**:
   Weight goal progress percentage is calculated with improved accuracy:
   ```typescript
   function calculateProgressPercentage(profile: UserProfile): number {
     if (!profile) return 0;
     
     const currentWeight = profile?.weight_kg || profile?.current_weight_kg;
     const startWeight = profile?.starting_weight_kg || profile?.initial_weight_kg;
     const targetWeight = profile?.target_weight_kg;
     
     if (!currentWeight || !startWeight || !targetWeight) return 0;
     
     // Different calculation based on weight loss vs. weight gain
     const isWeightLoss = startWeight > targetWeight;
     
     if (isWeightLoss) {
       const totalToLose = startWeight - targetWeight;
       const lostSoFar = startWeight - currentWeight;
       return Math.min(100, Math.max(0, (lostSoFar / totalToLose) * 100));
     } else {
       const totalToGain = targetWeight - startWeight;
       const gainedSoFar = currentWeight - startWeight;
       return Math.min(100, Math.max(0, (gainedSoFar / totalToGain) * 100));
     }
   }
   ```

3. **Measurement Formatting**:
   Measurements are properly formatted with appropriate rounding:
   ```typescript
   // Weight with proper rounding
   const displayWeight = profile?.weight_kg 
     ? `${Math.round(profile.weight_kg)} kg` 
     : 'Not set';
   
   // Height with proper rounding
   const displayHeight = profile?.height_cm 
     ? `${Math.round(profile.height_cm)} cm` 
     : 'Not set';
   ```

These improvements collectively ensure that user data is properly persisted, synchronized, and displayed throughout the application, enhancing both data integrity and user experience.

## Notification System Architecture

The FitAI application implements a sophisticated notification system that provides timely reminders for workouts, meals, and water consumption while respecting user preferences and activity patterns.

### 1. Core Components

#### Notification Service (`services/notifications/index.ts`)

This is the central module that manages all notification functionality:

- **Initialization**: Sets up notification handlers and permissions
- **Scheduling**: Creates and manages notification schedules based on user preferences
- **Cancellation**: Provides methods to cancel specific or all notifications
- **User Preference Management**: Reads and applies user-defined notification settings
- **Activity Tracking**: Monitors user activity to send context-appropriate reminders

#### Initialization Module (`services/notifications/init.ts`)

A dedicated module that ensures notifications are properly initialized when the app starts:

```typescript
/**
 * Notification Service Initialization
 * This file automatically initializes the notification service when imported
 */

import NotificationService from './index';

/**
 * Initialize all notification services
 * This function sets up notifications and handles any errors that occur
 */
export async function initializeNotifications() {
  try {
    await NotificationService.setupNotifications();
    console.log('Notification service initialized successfully');
  } catch (error) {
    console.error('Failed to initialize notification service:', error);
  }
}

// Auto-initialize when this module is imported
initializeNotifications();

export default initializeNotifications;
```

This module is imported in the app's entry points (`app/index.tsx` and `app/_layout.tsx`) to ensure notification setup occurs at startup.

### 2. Notification Types

The system manages three primary notification types:

#### Workout Reminders

- Scheduled based on user's preferred workout times from onboarding
- Customized based on workout frequency and schedule
- Adjustable through profile settings
- Contains motivational messaging and workout information

#### Meal Reminders

- Scheduled according to user-specified meal times
- Customized for breakfast, lunch, and dinner
- Adaptable based on meal frequency preferences
- Includes meal plan information when available

#### Water Reminders

- Sent hourly during active hours (before 9 PM)
- Only triggered if the user hasn't logged water in the past hour
- Directly integrated with the water tracking system
- Intelligently adapts to user's hydration patterns

### 3. Integration with User Activity

The notification system is tightly integrated with user activity tracking:

#### Water Tracking Integration

When a user logs water consumption, the system updates the notification service:

```typescript
// Save water tracking data to profile
const saveWaterData = async (newWaterData: WaterTracking) => {
  if (!profile) return;

  try {
    // Create a new object for workout_tracking
    const newWorkoutTracking = {
      ...(typeof profile.workout_tracking === 'object' && 
         !Array.isArray(profile.workout_tracking) ? 
         profile.workout_tracking : {}),
      water_tracking: newWaterData
    };
    
    // Update the profile
    await updateProfile({
      workout_tracking: newWorkoutTracking
    });
    
    // Notify the notification service about the water log
    await NotificationService.updateLastWaterLogTime();
  } catch (error) {
    console.error('Error saving water tracking data:', error);
  }
};
```

This ensures that water reminders are only sent when the user hasn't logged water recently, preventing notification fatigue.

#### Workout Completion Integration

When workouts are completed, the notification system is updated to avoid sending redundant reminders.

#### Meal Logging Integration

Meal completion is tracked to ensure meal reminders are contextually appropriate.

### 4. User Preference Management

The system respects user preferences for notifications:

- **Profile Settings**: Users can enable/disable specific notification types
- **Time Preferences**: Notification timing is based on user-specified schedules
- **Frequency Control**: Notifications are paced to avoid overwhelming the user
- **Quiet Hours**: No notifications are sent during late evening hours (after 9 PM)

### 5. Technical Implementation Details

#### Initialization Flow

1. App starts and imports the notification initialization module
2. `initializeNotifications()` runs automatically
3. The function calls `NotificationService.setupNotifications()`
4. The service checks for permissions and requests them if needed
5. Once permissions are granted, notification schedules are created
6. The system registers notification handlers for received notifications
7. Error handling ensures the app continues to function even if notification setup fails

#### Cross-Platform Considerations

The notification system is designed to work consistently across platforms:

- Uses Expo's notification API for cross-platform compatibility
- Handles platform-specific permission models
- Adapts notification styling to match platform conventions
- Implements proper icon and sound support for each platform

#### Error Handling Strategy

The system implements robust error handling:

- Graceful permission denial handling
- Recovery from initialization failures
- Fallback to default schedules when user preferences are unavailable
- Comprehensive logging for debugging notification issues
- Automatic retry mechanisms for critical operations

### 6. Debugging Facilities

For developers, the notification system includes several debugging features:

- Detailed console logging of notification events
- Test buttons in development builds for triggering specific notifications
- Debug flags for enabling verbose logging
- Error reporting with actionable context

### 7. Future Enhancements

The notification architecture is designed to support future enhancements:

- Rich media notifications with exercise demonstrations
- Progress-based notification content
- AI-powered adaptive notification timing
- Custom notification sounds and appearance
- Deep linking to relevant app sections from notifications

This comprehensive notification system enhances user engagement while respecting user preferences and activity patterns, creating a supportive but non-intrusive experience that encourages consistent fitness and nutrition habits.

## Local Mode Architecture

The application now supports full functionality without requiring user authentication:

### Local Profile Management

1. **Storage Strategy**:
   - Primary storage: AsyncStorage for local profiles
   - Key pattern: `profile_local` for storing non-authenticated user data
   - Comprehensive CRUD operations in ProfileContext for local profiles

2. **Implementation Details**:
   ```typescript
   // ProfileContext.tsx
   // Create a local profile for non-authenticated users
   const createLocalProfile = async () => {
     const localProfileId = `local_${Date.now()}`;
     const newProfile = {
       id: localProfileId,
       has_completed_local_onboarding: false,
       current_step: 'user-details',
       // Default properties for new local profiles
     };
     
     await AsyncStorage.setItem('profile_local', JSON.stringify(newProfile));
     setProfile(newProfile);
   };
   ```

3. **Synchronization Mechanism**:
   - Local profiles are synchronized within AsyncStorage only
   - All profile updates use the same updateProfile method, but bypass Supabase
   - Local data is preserved until explicitly cleared or user authenticates

### Enhanced Data Repair Systems

1. **Meal Plan Validation and Repair**:
   - The application now implements sophisticated data repair for incomplete meal plans:
   
   ```typescript
   // Enhanced validateAndRepairMealPlan function
   const validateAndRepairMealPlan = (plan: any): MealPlan => {
     // Find days with complete meal sets to use as templates
     const completeDays = plan.weeklyPlan.filter(d => 
       d.meals && Array.isArray(d.meals) && d.meals.length >= 3
     );
     
     if (completeDays.length > 0) {
       const templateDay = completeDays[0];
       
       // Check each day and ensure it has a complete set of meals
       for (const dayPlan of plan.weeklyPlan) {
         if (!dayPlan.meals || !Array.isArray(dayPlan.meals) || dayPlan.meals.length < 3) {
           // Initialize meals array if needed
           if (!dayPlan.meals) {
             dayPlan.meals = [];
           }
           
           // Get existing meal types to avoid duplicates
           const existingMealTypes = new Set(dayPlan.meals.map(m => m.meal.toLowerCase()));
           
           // Add missing meal types from the template day
           templateDay.meals.forEach(templateMeal => {
             if (!existingMealTypes.has(templateMeal.meal.toLowerCase())) {
               // Create a variation of the template meal
               const newMeal = {
                 meal: templateMeal.meal,
                 time: templateMeal.time,
                 recipe: {
                   name: `${templateMeal.recipe.name} ${dayPlan.day} Variation`,
                   ingredients: [...templateMeal.recipe.ingredients],
                   instructions: [...templateMeal.recipe.instructions],
                   nutrition: {...templateMeal.recipe.nutrition}
                 }
               };
               
               // Add to the day's meals
               dayPlan.meals.push(newMeal);
             }
           });
           
           // Update daily nutrition
           dayPlan.dailyNutrition = {
             calories: dayPlan.meals.reduce((sum, meal) => sum + (meal.recipe?.nutrition?.calories || 0), 0),
             protein: dayPlan.meals.reduce((sum, meal) => sum + (meal.recipe?.nutrition?.protein || 0), 0),
             carbs: dayPlan.meals.reduce((sum, meal) => sum + (meal.recipe?.nutrition?.carbs || 0), 0),
             fats: dayPlan.meals.reduce((sum, meal) => sum + (meal.recipe?.nutrition?.fats || 0), 0)
           };
         }
       }
     }
     
     return {
       id: plan.id || 'generated_meal_plan_' + Date.now(),
       weeklyPlan: plan.weeklyPlan,
       // Other properties...
     };
   };
   ```

2. **Workout Generation Preferences Mapping**:
   - Fixed compatibility issues between profile data and AI generation requirements:
   
   ```typescript
   // User preferences mapping in WorkoutScreen
   const userPreferences = {
     // Core preferences from scalar fields
     fitnessLevel: (profile?.fitness_level || "beginner") as "beginner" | "intermediate" | "advanced",
     exerciseFrequency: profile?.workout_days_per_week || 3,
     timePerSession: profile?.workout_duration_minutes || 30,
     
     // Location and equipment from workout_preferences JSONB
     workoutLocation: (profile?.workout_preferences?.workout_location || "home") as "home" | "gym" | "outdoors" | "anywhere",
     availableEquipment: Array.isArray(profile?.workout_preferences?.equipment_available) ? 
       profile?.workout_preferences?.equipment_available : 
       ['bodyweight'],
       
     // Fitness goals or focus areas
     focusAreas: Array.isArray(profile?.workout_preferences?.focus_areas) ? 
       profile?.workout_preferences?.focus_areas : 
       Array.isArray(profile?.fitness_goals) ? 
         profile?.fitness_goals : 
         ['full-body'],
         
     // Add additional fields required by the generator
     exercisesToAvoid: profile?.workout_preferences?.exercises_to_avoid?.join(', ') || '',
     country_region: profile?.country_region || '',
     gender: profile?.gender || "neutral",
     age: profile?.age || undefined,
     weight: profile?.weight_kg || undefined,
     height: profile?.height_cm || undefined
   };
   ```

3. **Navigation Protection with Fallbacks**:
   - Enhanced navigation guards to handle both authenticated and non-authenticated states:
   
   ```typescript
   // NavigationGuard in _layout.tsx
   export function NavigationGuard() {
     const { user } = useAuth();
     const { profile } = useProfile();
     const segments = useSegments();
     const router = useRouter();
     
     React.useEffect(() => {
       const inAuthGroup = segments[0] === '(auth)';
       const inOnboardingGroup = segments[0] === '(onboarding)';
       
       // Check if there's a local profile (non-authenticated mode)
       const hasLocalProfile = !user && profile && profile.id && profile.id.startsWith('local_');
       const localOnboardingComplete = hasLocalProfile && profile.has_completed_local_onboarding;
       
       // If user is not authenticated and no local profile, go to login
       if (!user && !hasLocalProfile && !inAuthGroup) {
         router.replace('/(auth)/login');
         return;
       }
       
       // Local profile exists but onboarding not complete
       if (hasLocalProfile && !localOnboardingComplete && !inOnboardingGroup) {
         const currentStep = profile.current_step || 'user-details';
         router.replace(`/(onboarding)/${currentStep}`);
         return;
       }
       
       // Authenticated user with onboarding not complete
       if (user && profile && !profile.has_completed_onboarding && !inOnboardingGroup) {
         const currentStep = profile.current_onboarding_step || 'user-details';
         router.replace(`/(onboarding)/${currentStep}`);
         return;
       }
       
       // Onboarding or auth screens when they should be in main app
       if ((user || localOnboardingComplete) && (inAuthGroup || inOnboardingGroup)) {
         router.replace('/(tabs)');
         return;
       }
     }, [user, profile, segments]);
     
     return null;
   }
   ```

These enhancements ensure the application works seamlessly for both authenticated and non-authenticated users, with robust data handling and repair mechanisms to maintain a high-quality user experience in all scenarios.

## July 2025: Latest Stability and Fixes

### Progress Tab Infinite Loop Fix
- The Progress tab now uses two separate effects: one for syncing streak data (triggered only by profile changes), and another for updating analytics (triggered only by streak value changes). This prevents mutual triggering and infinite loops.
- A `contextReady` state ensures that effects only run when both Auth and Profile contexts are fully loaded.
- All effect dependencies are robust and context-aware, preventing unnecessary re-renders or data fetches.

### General App Health
- All major flows (onboarding, home, workout, nutrition, progress, profile) are stable and reliable, as confirmed by recent logs and user testing.
- No infinite loops, redundant state updates, or unhandled errors in any tab.
- Data synchronization and persistence are robust across local and server storage.

### Notification System (Web Handling)
- Notification permissions are gracefully handled on web: if denied, the app logs the status and continues without crashing or blocking other features.
- All notification-related errors are caught and do not affect core app functionality.

### Local Mode and Offline Support
- The app now fully supports local/offline mode: users can complete onboarding, generate AI-powered plans, and track progress without authentication.
- All AI features (workout, meal, body analysis) work seamlessly in local mode.
- Data is reliably persisted in AsyncStorage and synchronized with the UI.

### Debug/Developer Tools
- Hidden debug panels and test buttons are available in development mode (`__DEV__` flag) or when `enableDebugMode` is set in the profile.
- Debug panel is accessible at `app/(dev)/debug-panel.tsx` and provides raw profile inspection, data repair, and validation tools.
- Test buttons for AI generation and data repair are present in Nutrition and Workout tabs, hidden from end users in production.

### TypeScript Issues and Workarounds
- Some runtime-only properties are not present in TypeScript definitions; `@ts-ignore` is used as a temporary workaround.
- Plan in place to improve type definitions and remove `@ts-ignore` as soon as possible.

### Nutrition Tab Meal Completion Persistence Fix
- Removed problematic refs and duplicate hooks that caused unreliable meal completion status in the Nutrition tab.
- Implemented a new pattern: a single `useFocusEffect` (with empty dependency array) and a primary `useEffect` (with correct dependencies) to reliably reload meal completion data.
- Internal concurrency guards in `loadCompletedMeals` prevent redundant or concurrent execution.

### Known Issues
- Rare React Native text rendering error during profile loading, before UI is fully rendered. Extensive type checking and string conversions have not fully resolved it; ongoing investigation continues.
- All other known issues have been addressed or have robust workarounds in place.

## July 2025: Data Sync Utility and Type Safety Fixes

### Enhanced Data Synchronization Utility

- Introduced `utils/syncLocalDataToSupabase.ts` as the robust utility for syncing local (offline) and Supabase (online) data on login.
- The utility merges workout and meal completions by id and recency, and synchronizes workout_plan and meal_plans using updated_at timestamps.
- Uses a type guard (`isUserProfile`) to ensure remoteProfile is always typed as UserProfile, preventing 'never' linter errors.
- All property accesses on remoteProfile are now type-safe and guarded by null checks.
- Linter errors regarding 'never' type for remoteProfile property access have been resolved.
- Both offline (local) and online (Supabase) user flows are now robustly supported, with reliable data migration and sync on login.
- The sync utility is now the single source of truth for merging and updating completions and plans on login.
- Codebase now uses explicit type guards and null checks to prevent TypeScript 'never' errors in all sync and profile logic.

## Conclusion

This architecture guide provides a comprehensive overview of the FitAI application's structure and design patterns. By understanding these components and how they interact, developers can effectively maintain, enhance, or migrate the application as needed.

For specific implementation details, refer to the individual files and components mentioned in this guide. The application's modular design allows for flexible modifications while maintaining a consistent user experience. 