# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FitAI is a cross-platform fitness application built with React Native and Expo, featuring AI-powered workout and meal plan generation using Google Gemini 2.5 Flash with structured output.

## Key Commands

### Development
```bash
# Start development server
npm start

# Run on specific platforms
npx expo run:android
npx expo run:ios
npx expo start --web
```

### Testing
```bash
# Run all structured output tests
npm run test:structured

# Test specific features
npm run test:workout    # Test workout generation
npm run test:meal       # Test meal plan generation
npm run test:compare    # Compare old vs new implementations
```

### Build & Deployment
```bash
# Build for production (using EAS)
eas build --platform android --profile production
eas build --platform ios --profile production

# Submit to stores
eas submit --platform android
eas submit --platform ios
```

## Architecture & Key Patterns

### File-Based Routing (Expo Router)
- **app/**: Contains all screens with file-based routing
- **(tabs)**: Main app tabs - home, workout, nutrition, progress, profile, settings
- **(auth)**: Authentication screens - login, signup, forgot-password
- **(onboarding)**: User preference collection flow
- **_layout.tsx**: Layout files define navigation structure

### Core Services Architecture
- **services/ai/**: AI generators using Google Gemini 2.5 Flash
  - `WorkoutGenerator.ts`: Generates workouts using structured output
  - `MealPlanGenerator.ts`: Generates meal plans using structured output
  - Both use `responseSchema` for guaranteed JSON structure
- **services/database/**: Supabase database operations
  - Each service handles specific data synchronization
  - Includes optimistic updates and error handling
- **contexts/**: Global state management
  - `AuthContext`: Authentication state and methods
  - `UserContext`: User profile and preferences
  - `WorkoutContext`: Active workout management

### Structured Output Implementation
The app uses Google Gemini's structured output feature for 100% reliable AI generation:
- Schemas defined with Google's `SchemaType` system
- No JSON parsing or repair needed
- Complete user profile integration from onboarding
- Located in `services/ai/generators/`

### Authentication Flow
1. Google OAuth via expo-auth-session
2. Supabase handles session management
3. OAuth callback at `/auth/callback`
4. Automatic profile creation on first login

### Database Schema
- **profiles**: User profiles with fitness preferences
- **workouts**: Generated and completed workouts
- **meals**: Generated meal plans
- **progress**: User progress tracking
- **water_tracking**: Daily water intake
- Real-time sync via Supabase

## Environment Variables

Required in `.env` or EAS secrets:
```
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
EXPO_PUBLIC_GEMINI_API_KEY
```

## Development Guidelines

### When modifying AI services:
- Always use structured output with `responseSchema`
- Include all user preferences from onboarding
- Test with `npm run test:structured`

### When working with navigation:
- Use Expo Router's file-based routing
- Protected routes handled via `_layout.tsx` files
- Navigation state managed by AuthContext

### When adding new features:
- Follow existing patterns in services/
- Add proper TypeScript types in types/
- Update relevant contexts if needed
- Consider offline support and sync

### Platform-specific considerations:
- Android: Production ready with Google Login
- iOS: Development ready, needs Apple Developer account for production
- Web: Full OAuth support, some native features unavailable

## Common Issues & Solutions

### White screen on production build:
- Check bundle size optimization in metro.config.js
- Verify all assets are properly included
- Check for missing environment variables

### AI generation failures:
- Structured output eliminates most failures
- Check Gemini API quota if issues persist
- Fallback system will handle edge cases

### Database sync issues:
- Check Supabase connection and auth
- Verify RLS policies on Supabase dashboard
- Use offline-first approach with eventual sync