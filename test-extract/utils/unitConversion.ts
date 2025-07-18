/**
 * Unit conversion utilities for height and weight
 */

/**
 * Convert height between centimeters and feet/inches
 * @param value The height value to convert
 * @param fromUnit The unit to convert from ('cm' or 'ft')
 * @param toUnit The unit to convert to ('cm' or 'ft')
 * @returns The converted height value
 */
export function convertHeight(value: number, fromUnit: 'cm' | 'ft', toUnit: 'cm' | 'ft'): number {
  // Same unit, no conversion needed
  if (fromUnit === toUnit) return value;
  
  // Convert feet to cm
  if (fromUnit === 'ft' && toUnit === 'cm') {
    return value * 30.48;
  }
  
  // Convert cm to feet
  if (fromUnit === 'cm' && toUnit === 'ft') {
    return value / 30.48;
  }
  
  return value;
}

/**
 * Convert weight between kilograms and pounds
 * @param value The weight value to convert
 * @param fromUnit The unit to convert from ('kg' or 'lbs')
 * @param toUnit The unit to convert to ('kg' or 'lbs')
 * @returns The converted weight value
 */
export function convertWeight(value: number, fromUnit: 'kg' | 'lbs', toUnit: 'kg' | 'lbs'): number {
  // Same unit, no conversion needed
  if (fromUnit === toUnit) return value;
  
  // Convert pounds to kg
  if (fromUnit === 'lbs' && toUnit === 'kg') {
    return value * 0.45359237;
  }
  
  // Convert kg to pounds
  if (fromUnit === 'kg' && toUnit === 'lbs') {
    return value * 2.20462262;
  }
  
  return value;
}

/**
 * Format height display based on the unit
 * @param value Height value
 * @param unit Unit ('cm' or 'ft')
 * @returns Formatted height string
 */
export function formatHeight(value: number, unit: 'cm' | 'ft'): string {
  if (unit === 'cm') {
    return `${Math.round(value)} cm`;
  } else {
    const feet = Math.floor(value);
    const inches = Math.round((value - feet) * 12);
    return `${feet}'${inches}"`;
  }
}

/**
 * Format weight display based on the unit
 * @param value Weight value
 * @param unit Unit ('kg' or 'lbs') 
 * @returns Formatted weight string
 */
export function formatWeight(value: number, unit: 'kg' | 'lbs'): string {
  if (unit === 'kg') {
    return `${Math.round(value)} kg`;
  } else {
    return `${Math.round(value)} lbs`;
  }
}
