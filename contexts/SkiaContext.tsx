import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { Platform } from 'react-native';

interface SkiaContextType {
  isSkiaLoaded: boolean;
  setSkiaLoaded: (loaded: boolean) => void;
  skiaError: string | null;
}

const SkiaContext = createContext<SkiaContextType | undefined>(undefined);

export const SkiaProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isSkiaLoaded, setSkiaLoadedState] = useState(false);
  const [skiaError, setSkiaError] = useState<string | null>(null);

  const setSkiaLoaded = (loaded: boolean) => {
    console.log(`[SkiaContext] Setting isSkiaLoaded to: ${loaded}`);
    setSkiaLoadedState(loaded);
    if (loaded) {
      setSkiaError(null);
    }
  };

  // Auto-detect Skia availability on native platforms
  useEffect(() => {
    if (Platform.OS !== 'web') {
      // On native platforms, try to detect Skia availability
      const checkSkiaAvailability = async () => {
        try {
          // Import Skia dynamically to check if it's available
          const { Skia } = await import('@shopify/react-native-skia');

          if (Skia && typeof Skia.Paint === 'function') {
            console.log('[SkiaContext] Skia detected on native platform');
            setSkiaLoaded(true);
          } else {
            console.warn('[SkiaContext] Skia not properly loaded on native platform');
            setSkiaError('Skia not properly loaded');
          }
        } catch (error) {
          console.error('[SkiaContext] Error loading Skia on native platform:', error);
          setSkiaError(`Failed to load Skia: ${error}`);
        }
      };

      // Small delay to ensure the app is fully initialized
      const timeout = setTimeout(checkSkiaAvailability, 100);
      return () => clearTimeout(timeout);
    }
  }, []);

  return (
    <SkiaContext.Provider value={{ isSkiaLoaded, setSkiaLoaded, skiaError }}>
      {children}
    </SkiaContext.Provider>
  );
};

export const useSkiaContext = () => {
  const context = useContext(SkiaContext);
  if (context === undefined) {
    // This error means a component is trying to use the context
    // but it's not wrapped in SkiaProvider.
    console.error("useSkiaContext must be used within a SkiaProvider. Ensure SkiaProvider is at the root of your app layout.");
    throw new Error('useSkiaContext must be used within a SkiaProvider');
  }
  return context;
};