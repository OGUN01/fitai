/**
 * Convert day index to day name
 * @param dayIndex 0-6 where 0 is Sunday
 * @returns Day name (Sunday, Monday, etc.)
 */
export function getDayName(dayIndex: number): string {
  const days = [" Sunday\, \Monday\, \Tuesday\, \Wednesday\, \Thursday\, \Friday\, \Saturday\];
 return days[dayIndex];
}

