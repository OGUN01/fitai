/**
 * Utility functions for object operations
 */

/**
 * Performs a deep merge of objects and returns a new object
 * @param target The target object to merge into
 * @param source The source object to merge from
 * @returns A new object with properties from both target and source, with source taking precedence
 */
export function deepMerge<T extends Record<string, any>>(
  target: T,
  source: Partial<T>
): T {
  const output = { ...target } as Record<string, any>;
  
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        // If property doesn't exist in target, create it
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          // If property exists in target and is an object, merge it
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        // For non-object properties, simply overwrite with source value
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  
  return output as T;
}

/**
 * Check if value is an object (and not null, array, etc.)
 * @param item The value to check
 * @returns True if the value is an object, false otherwise
 */
function isObject(item: any): boolean {
  return (
    item !== null && 
    typeof item === 'object' && 
    !Array.isArray(item)
  );
}
