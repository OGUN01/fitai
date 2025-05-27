import { router as expoRouter } from 'expo-router';

/**
 * Replace the current route with another route
 * @param route - Route name to replace with
 * @param params - Route parameters (optional)
 */
export function replace(route: string, params?: Record<string, any>): ReturnType<typeof expoRouter.replace> {
  console.log(`🚦 [Router] Replacing route to: ${route}`, params);
  return expoRouter.replace(route as any, params);
}

/**
 * Push a new route onto the stack
 * @param route - Route name to push
 * @param params - Route parameters (optional)
 */
export function push(route: string, params?: Record<string, any>): ReturnType<typeof expoRouter.push> {
  console.log(`🚦 [Router] Pushing route: ${route}`, params);
  return expoRouter.push(route as any, params);
}

/**
 * Navigate to a route (prefers push)
 * @param route - Route name to navigate to
 * @param params - Route parameters (optional)
 */
export function navigate(route: string, params?: Record<string, any>): ReturnType<typeof expoRouter.navigate> {
  console.log(`🚦 [Router] Navigating to route: ${route}`, params);
  return expoRouter.navigate(route as any, params);
}

export default {
  replace,
  push,
  navigate,
  back: expoRouter.back,
}; 