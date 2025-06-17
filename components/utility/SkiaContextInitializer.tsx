import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { useSkiaContext } from '../../contexts/SkiaContext';

const SkiaContextInitializer: React.FC = () => {
  const { setSkiaLoaded, isSkiaLoaded } = useSkiaContext();

  useEffect(() => {
    if (Platform.OS === 'web') {
      // On web, we need to wait for CanvasKit WASM to load
      // Check if it's already loaded by index.web.tsx
      const checkWebSkiaAvailability = async () => {
        try {
          const { Skia } = await import('@shopify/react-native-skia');

          if (Skia && typeof Skia.Paint === 'function') {
            console.log('[SkiaContextInitializer Web] Skia detected and working');
            setSkiaLoaded(true);
          } else {
            console.warn('[SkiaContextInitializer Web] Skia not ready yet, will retry');
            // Retry after a short delay
            setTimeout(checkWebSkiaAvailability, 1000);
          }
        } catch (error) {
          console.error('[SkiaContextInitializer Web] Error checking Skia:', error);
          // Retry after a longer delay
          setTimeout(checkWebSkiaAvailability, 2000);
        }
      };

      checkWebSkiaAvailability();
    }
    // For native platforms, the SkiaProvider handles detection automatically
  }, [setSkiaLoaded]);

  // Log the current state for debugging
  useEffect(() => {
    console.log(`[SkiaContextInitializer] Current Skia state: ${isSkiaLoaded ? 'LOADED' : 'NOT LOADED'} on ${Platform.OS}`);
  }, [isSkiaLoaded]);

  return null; // This component does not render anything visible
};

export default SkiaContextInitializer;