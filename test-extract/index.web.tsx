import '@expo/metro-runtime'; // Ensures metro-runtime is loaded for web
import { App } from 'expo-router/build/qualified-entry';
import { renderRootComponent } from 'expo-router/build/renderRootComponent';
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
// import { SkiaProvider } from './contexts/SkiaContext'; // No longer needed here
import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';

const RootAppWrapper = () => {
  const [isSkiaReadyForApp, setIsSkiaReadyForApp] = React.useState(false);
  const [skiaError, setSkiaError] = React.useState(false);
  const [loadingTimeout, setLoadingTimeout] = React.useState(false);

  React.useEffect(() => {
    console.log('[Skia Web] Attempting to load CanvasKit WASM...');

    // Set a timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      console.warn('[Skia Web] Loading timeout reached, proceeding without Skia');
      setLoadingTimeout(true);
      setIsSkiaReadyForApp(true); // Proceed anyway
    }, 15000); // 15 second timeout

    LoadSkiaWeb({
      locateFile: (file) => `/${file}` // Ensure it looks for canvaskit.wasm in the public root
    })
      .then(() => {
        clearTimeout(timeout);
        console.log('[Skia Web] CanvasKit WASM loaded successfully via LoadSkiaWeb.');
        setIsSkiaReadyForApp(true); // Skia is loaded, App can now render
      })
      .catch(err => {
        clearTimeout(timeout);
        console.error('[Skia Web] Failed to load CanvasKit WASM:', err);
        setSkiaError(true);
        setIsSkiaReadyForApp(true); // Proceed anyway, app should handle missing Skia gracefully
      });
  }, []);

  if (!isSkiaReadyForApp) {
    // Show a proper loading screen instead of null
    return (
      <View style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 20
      }}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{
          marginTop: 20,
          fontSize: 18,
          fontWeight: '600',
          textAlign: 'center'
        }}>
          Loading FitAI...
        </Text>
        <Text style={{
          marginTop: 10,
          fontSize: 14,
          color: '#666',
          textAlign: 'center'
        }}>
          Initializing graphics engine
        </Text>
      </View>
    );
  }

  // Show warning if there were issues but continue
  if (skiaError || loadingTimeout) {
    console.warn('[Skia Web] Running in fallback mode due to Skia loading issues');
  }

  // Skia WASM is loaded (or we're proceeding without it), now render the App.
  // SkiaProvider is now handled by app/_layout.tsx
  console.log('[Skia Web] Rendering main app.');
  return <App />;
};

renderRootComponent(RootAppWrapper); 