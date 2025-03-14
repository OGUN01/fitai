/**
 * JSON Utilities for AI Services
 * 
 * This file contains utility functions for parsing and handling JSON from LLM responses.
 * Extracted to avoid circular dependencies between services.
 */

/**
 * Parse JSON from LLM responses with enhanced error handling and repair strategies
 */
export function parseJsonFromLLM(text: string): any {
  // First try to extract JSON with a code block pattern
  let match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (!match) {
    // Try to find any JSON-like structure
    match = text.match(/(\{[\s\S]*\})/);
  }
  
  if (match && match[1]) {
    try {
      let jsonContent = match[1];
      
      // PHASE 1: Basic cleanup
      // Fix trailing commas in arrays and objects
      jsonContent = jsonContent.replace(/,\s*([\]\}])/g, '$1');
      
      // Fix missing quotes around property names
      jsonContent = jsonContent.replace(/(\{|,)\s*([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
      
      // PHASE 2: Handle workout-specific format issues
      // Fix ranges like "10-12" in numeric fields - convert to strings
      jsonContent = jsonContent.replace(/"(sets|reps)":\s*(\d+)-(\d+)/g, '"$1": "$2-$3"');
      
      // Fix "reps": 10 per leg -> "reps": "10 per leg"
      jsonContent = jsonContent.replace(/"reps":\s*(\d+)(\s+per\s+[^",\}]+)/g, '"reps": "$1$2"');
      
      // Fix "reps": AMRAP or similar text values
      jsonContent = jsonContent.replace(/"reps":\s*([A-Za-z][^",\}]*)/g, '"reps": "$1"');
      
      // Fix "reps": 10-12 per leg or similar ranges with text
      jsonContent = jsonContent.replace(/"reps":\s*(\d+)-(\d+)([^",\}]*)/g, '"reps": "$1-$2$3"');
      
      // Try parsing after cleanup
      try {
        return JSON.parse(jsonContent);
      } catch (error) {
        console.error('Initial parsing failed, trying more aggressive cleanup:', error);
        
        // PHASE 3: More aggressive cleanup for major issues
        // Strip all newlines and excess whitespace
        jsonContent = jsonContent.replace(/\s+/g, ' ').trim();
        
        // Apply all previous fixes again on the compressed string
        jsonContent = jsonContent.replace(/,\s*([\]\}])/g, '$1');
        jsonContent = jsonContent.replace(/(\{|,)\s*([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
        jsonContent = jsonContent.replace(/"(sets|reps)":\s*(\d+)-(\d+)/g, '"$1": "$2-$3"');
        jsonContent = jsonContent.replace(/"reps":\s*(\d+)(\s+per\s+[^",\}]+)/g, '"reps": "$1$2"');
        jsonContent = jsonContent.replace(/"reps":\s*([A-Za-z][^",\}]*)/g, '"reps": "$1"');
        jsonContent = jsonContent.replace(/"reps":\s*(\d+)-(\d+)([^",\}]*)/g, '"reps": "$1-$2$3"');
        
        return JSON.parse(jsonContent);
      }
    } catch (error) {
      // If JSON parsing after cleanup still fails, try JSON repair techniques
      try {
        const repairedJson = attemptJsonRepair(match[1]);
        if (repairedJson) return repairedJson;
      } catch (repairError) {
        console.error('JSON repair failed:', repairError);
      }
      
      throw new Error(`Failed to parse JSON: ${error.message}`);
    }
  } else {
    try {
      // Last resort: try to parse the entire text as JSON
      return JSON.parse(text);
    } catch (error) {
      throw new Error('No valid JSON structure found in the response');
    }
  }
}

/**
 * Attempt to repair broken JSON using pattern recognition
 */
function attemptJsonRepair(text: string): any | null {
  const cleaned = text
    // Remove any markdown syntax
    .replace(/```json|```/g, '')
    // Ensure property names are double-quoted
    .replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3')
    // Replace single quotes with double quotes
    .replace(/'/g, '"')
    // Fix trailing commas in objects and arrays
    .replace(/,(\s*[}\]])/g, '$1')
    // Insert missing commas
    .replace(/([}\]])\s*([{[])/g, '$1,$2')
    // Remove non-JSON text
    .replace(/[^\[\]{}:,\"0-9.\-+Eefalsetrunull\s]/g, '')
    // Remove extra whitespace
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (error) {
    return null;
  }
} 