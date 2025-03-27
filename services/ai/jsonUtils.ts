/**
 * JSON Utilities for AI Services
 * 
 * This file contains utility functions for parsing and handling JSON from LLM responses.
 * Extracted to avoid circular dependencies between services.
 */

/**
 * Parse JSON from LLM responses with enhanced error handling and repair strategies
 */
export function parseJsonFromLLM(text: any): any {
  if (typeof text !== 'string') {
    // Handle case where input might be a response object from Gemini
    if (text && typeof text === 'object') {
      try {
        // Try to get text content from a response object
        if (typeof text.response?.text === 'function') {
          text = text.response.text();
        } else if (typeof text.text === 'function') {
          text = text.text();
        } else {
          console.warn("parseJsonFromLLM received non-string input:", typeof text);
          throw new Error('Invalid input: could not extract text from object');
        }
      } catch (error) {
        console.error("Error extracting text from response object:", error);
        throw new Error('Invalid input: failed to extract text from object');
      }
    } else {
      console.warn("parseJsonFromLLM received non-string input:", typeof text);
      throw new Error('Invalid input: expected string but got ' + typeof text);
    }
  }

  // CRITICAL FIX: Pre-emptively remove all control characters that can cause parsing errors
  // This addresses the "SyntaxError: Bad control character in string literal in JSON at position 22"
  text = text.replace(/[\x00-\x1F\x7F-\x9F]/g, ' ');

  // First try to extract JSON with a code block pattern
  let match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (!match) {
    // Try to find any JSON-like structure
    match = text.match(/(\{[\s\S]*\})/);
  }
  
  const originalText = text; // Save original for fallback attempts
  
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
      
      // Fix malformed arrays and objects with our enhanced function
      jsonContent = fixMalformedArraysAndObjects(jsonContent);

      // Try parsing after cleanup
      try {
        return JSON.parse(jsonContent);
      } catch (error) {
        console.error('Initial parsing failed, trying more aggressive cleanup:', error);
        
        // PHASE 3: More aggressive cleanup for major issues
        // Strip all newlines and excess whitespace first
        jsonContent = jsonContent.replace(/\s+/g, ' ').trim();
        
        // Apply all previous fixes again on the compressed string
        jsonContent = jsonContent.replace(/,\s*([\]\}])/g, '$1');
        jsonContent = jsonContent.replace(/(\{|,)\s*([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
        jsonContent = jsonContent.replace(/"(sets|reps)":\s*(\d+)-(\d+)/g, '"$1": "$2-$3"');
        jsonContent = jsonContent.replace(/"reps":\s*(\d+)(\s+per\s+[^",\}]+)/g, '"reps": "$1$2"');
        jsonContent = jsonContent.replace(/"reps":\s*([A-Za-z][^",\}]*)/g, '"reps": "$1"');
        jsonContent = jsonContent.replace(/"reps":\s*(\d+)-(\d+)([^",\}]*)/g, '"reps": "$1-$2$3"');
        
        // Apply enhanced fixes
        jsonContent = fixMalformedArraysAndObjects(jsonContent);
        
        try {
          return JSON.parse(jsonContent);
        } catch (secondError) {
          // PHASE 4: Apply advanced repair strategies using attemptJsonRepair
          const repairedJson = attemptJsonRepair(jsonContent);
          if (repairedJson) {
            console.log("JSON repaired successfully using advanced repair strategies");
            return repairedJson;
          }
          
          // PHASE 5: Final desperate attempt - try to eliminate all problematic characters
          try {
            // Remove all non-JSON structure characters
            const sanitized = jsonContent
              .replace(/[^\{\}\[\]:,\-\d\.\w"]/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
              
            // Fix potential syntax issues after sanitization
            const fixedSanitized = fixMalformedArraysAndObjects(sanitized);
            
            return JSON.parse(fixedSanitized);
          } catch (thirdError) {
            // If we get here, we really tried everything and failed
            // Fall through to the final fallback
          }
        }
      }
    } catch (error) {
      // Try one last approach - attempt to construct a partial object from what we can extract
      try {
        // Try to find and extract any valid key-value pairs
        const keyValueRegex = /"([^"]+)":\s*("[^"]*"|null|true|false|-?\d+(?:\.\d+)?|\{[^}]*\}|\[[^\]]*\])/g;
        const matches = [...originalText.matchAll(keyValueRegex)];
        
        if (matches.length > 0) {
          const partialObject: Record<string, any> = {};
          
          matches.forEach(match => {
            try {
              const key = match[1];
              let value: any = match[2];
              
              // Try to parse the value if it's an object or array
              if (value.startsWith('{') || value.startsWith('[')) {
                try {
                  value = JSON.parse(value);
                } catch {
                  // If we can't parse it as JSON, keep it as a string
                }
              } else if (value.startsWith('"') && value.endsWith('"')) {
                // Handle string values
                value = value.slice(1, -1);
              } else if (['true', 'false', 'null'].includes(value)) {
                // Convert string 'true'/'false'/'null' to actual boolean/null values
                if (value === 'true') value = true;
                else if (value === 'false') value = false;
                else value = null;
              } else {
                // Handle numeric values
                value = Number(value);
              }
              
              partialObject[key] = value;
            } catch {}
          });
          
          if (Object.keys(partialObject).length > 0) {
            console.warn("Created a partial object from extractable key-value pairs");
            return partialObject;
          }
        }
      } catch {}
      
      throw new Error(`Failed to parse JSON: ${error.message}`);
    }
  } else {
    try {
      // Last resort: try to parse the entire text as JSON
      return JSON.parse(text);
    } catch (error) {
      // One final attempt - try our repair methods on the full text
      const repairedFull = attemptJsonRepair(text);
      if (repairedFull) return repairedFull;
      
      throw new Error('No valid JSON structure found in the response');
    }
  }
}

/**
 * Fix common issues with malformed arrays and objects
 */
function fixMalformedArraysAndObjects(jsonContent: string): string {
  // NEW: Remove control characters that cause parsing errors
  jsonContent = jsonContent.replace(/[\x00-\x1F\x7F-\x9F]/g, ' ');
  
  // NEW: Fix escaped quotes in wrong places
  jsonContent = jsonContent.replace(/\\"/g, '"').replace(/""/g, '"');
  
  // Fix unquoted string values inside arrays
  jsonContent = jsonContent.replace(/\[([^\]]*)\]/g, (match, contents) => {
    // For each array content, properly quote unquoted strings
    return '[' + contents.replace(/(?<!("|true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)),/g, '",') + ']';
  });
  
  // Fix array items that are not properly quoted - add quotes to unquoted strings
  jsonContent = jsonContent.replace(/\[\s*([^"[\]{}0-9true,false,null][^,\]]*?)(?=,|\])/g, (match, value) => {
    if (['true', 'false', 'null'].includes(value.trim())) {
      return match;
    }
    return '[ "' + value.trim() + '"';
  });
  
  // Fix missing quotes around string values (non-numeric, non-boolean, non-null values)
  jsonContent = jsonContent.replace(/"([^"]+)":\s*([^"{}\[\],\d][^{},\[\]]*?)(?=,|\})/g, (match, prop, value) => {
    // Skip booleans and null
    if (['true', 'false', 'null'].includes(value.trim())) {
      return match;
    }
    return `"${prop}": "${value.trim()}"`;
  });

  // Fix various specific issues with JSON object structures
  // Double commas
  jsonContent = jsonContent.replace(/,\s*,/g, ',');
  
  // Missing colon after property name
  jsonContent = jsonContent.replace(/"([^"]+)"\s+(["{[])/g, '"$1": $2');
  jsonContent = jsonContent.replace(/"([^"]+)"\s+([^",:{}\[\]])/g, '"$1": "$2"');
  
  // Extra commas at the end of a property value list
  jsonContent = jsonContent.replace(/,(\s*})/g, '$1');
  jsonContent = jsonContent.replace(/,(\s*\])/g, '$1');
  
  // Property name with no value (property:,)
  jsonContent = jsonContent.replace(/"([^"]+)":\s*,/g, '"$1": null,');
  
  // Fix property names without quotes
  jsonContent = jsonContent.replace(/([{,])\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
  
  // Fix cases where opening braces/brackets are missing their closing counterparts
  const openBraces = (jsonContent.match(/\{/g) || []).length;
  const closeBraces = (jsonContent.match(/\}/g) || []).length;
  if (openBraces > closeBraces) {
    jsonContent = jsonContent + '}'.repeat(openBraces - closeBraces);
  }
  
  const openBrackets = (jsonContent.match(/\[/g) || []).length;
  const closeBrackets = (jsonContent.match(/\]/g) || []).length;
  if (openBrackets > closeBrackets) {
    jsonContent = jsonContent + ']'.repeat(openBrackets - closeBrackets);
  }
  
  // Fix common string escape issues
  jsonContent = jsonContent.replace(/([^\\])\\([^"\\\/bfnrtu])/g, '$1\\\\$2'); // Fix incorrect escapes
  
  return jsonContent;
}

/**
 * Attempt to repair broken JSON using pattern recognition and advanced repair strategies
 */
function attemptJsonRepair(text: string): any | null {
  // First try a gentle regex-based repair
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
    // Fix unquoted string values (non-numeric, non-boolean, non-null)
    .replace(/"([^"]+)":\s*([^"{}\[\],\d][^{},\[\]]*?)(?=,|\})/g, '"$1": "$2"')
    // Remove backslash escape sequences before normal characters that don't need escaping
    .replace(/\\([^"\\\/bfnrtu])/g, '$1')
    // Fix common JSON.stringify artifacts (like escaped quotes inside already quoted strings)
    .replace(/"\\"/g, '"')
    // Trim whitespace
    .trim();
  
  try {
    return JSON.parse(cleaned);
  } catch (firstError) {
    console.log("First repair attempt failed, trying advanced techniques");
    
    // NEW: Completely remove all control characters
    const noControlChars = text.replace(/[\x00-\x1F\x7F-\x9F]/g, ' ');
    try {
      return JSON.parse(noControlChars);
    } catch (controlError) {
      console.log("Control character removal didn't work");
    }
    
    // If that didn't work, try a more aggressive approach
    try {
      // Apply our enhanced fixMalformedArraysAndObjects function
      const enhancedFixed = fixMalformedArraysAndObjects(cleaned);
      try {
        return JSON.parse(enhancedFixed);
      } catch (enhancedError) {
        console.log("Enhanced fixes didn't work, trying structure extraction");
      }
      
      // Try to extract just the JSON part - looking for balanced braces
      let depth = 0;
      let start = -1;
      let end = -1;
      
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === '{' && start === -1) {
          start = i;
        }
        
        if (char === '{') depth++;
        if (char === '}') depth--;
        
        if (depth === 0 && start !== -1) {
          end = i + 1;
          break;
        }
      }
      
      if (start !== -1 && end !== -1) {
        const jsonPart = text.substring(start, end);
        // Now apply all our fixes to this extracted part
        const fixedJson = fixMalformedArraysAndObjects(jsonPart);
        
        try {
          return JSON.parse(fixedJson);
        } catch (structureError) {
          console.log("Structure extraction failed, trying bracket balancing");
          
          // Try a more aggressive approach - try to balance all brackets and braces
          const balancedJson = balanceBrackets(fixedJson);
          try {
            return JSON.parse(balancedJson);
          } catch (balanceError) {
            console.log("Bracket balancing failed, trying key-value extraction");
          }
        }
      }
    } catch (error) {
      console.error("Structure-based repair failed:", error);
    }
    
    // One last attempt - try to manually construct an object from key patterns
    try {
      // Try to construct an object from scratch by finding all key-value pairs
      // This regex handles more complex nested structures
      const keyValuePattern = /"([^"]+)":\s*("[^"]*"|{[^}]*}|\[[^\]]*\]|null|true|false|-?\d+(?:\.\d+)?|[^,{}[\]]+)/g;
      
      // Use a more compatible approach instead of matchAll
      const obj: Record<string, any> = {};
      let match;
      while ((match = keyValuePattern.exec(text)) !== null) {
        const key = match[1];
        const value = match[2];
        try {
          // Try to parse the value if it's not a simple string
          if (value.startsWith('"') && value.endsWith('"')) {
            obj[key] = value.substring(1, value.length - 1);
          } else if (value === 'null') {
            obj[key] = null;
          } else if (value === 'true') {
            obj[key] = true;
          } else if (value === 'false') {
            obj[key] = false;
          } else if (!isNaN(Number(value))) {
            obj[key] = Number(value);
          } else {
            try {
              obj[key] = JSON.parse(value);
            } catch {
              obj[key] = value;
            }
          }
        } catch (e) {
          obj[key] = value;
        }
      }
      
      if (Object.keys(obj).length > 0) {
        console.log("Successfully constructed object from key-value pairs");
        return obj;
      }
    } catch (finalError) {
      console.error("All JSON repair attempts failed:", finalError);
    }
    
    // Final desperate attempt - try to extract any valid JSON subset
    try {
      // Look for objects/arrays in the string
      const objectMatch = text.match(/({[^{}]*})/);
      if (objectMatch) {
        try {
          return JSON.parse(objectMatch[1]);
        } catch {}
      }
      
      const arrayMatch = text.match(/(\[[^\[\]]*\])/);
      if (arrayMatch) {
        try {
          return JSON.parse(arrayMatch[1]);
        } catch {}
      }
    } catch {}
    
    return null;
  }
}

/**
 * Helper function to balance brackets and braces in malformed JSON
 */
function balanceBrackets(text: string): string {
  const stack: string[] = [];
  let result = text;
  
  // Find missing closing brackets/braces
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '{' || char === '[') {
      stack.push(char);
    } else if (char === '}') {
      if (stack.length === 0 || stack[stack.length - 1] !== '{') {
        // Unmatched closing brace - ignore or handle specially
      } else {
        stack.pop();
      }
    } else if (char === ']') {
      if (stack.length === 0 || stack[stack.length - 1] !== '[') {
        // Unmatched closing bracket - ignore or handle specially
      } else {
        stack.pop();
      }
    }
  }
  
  // Add missing closing brackets/braces
  while (stack.length > 0) {
    const opener = stack.pop();
    if (opener === '{') {
      result += '}';
    } else if (opener === '[') {
      result += ']';
    }
  }
  
  return result;
}

/**
 * Utility function to extract and process a meal plan from various sources
 * 
 * This function attempts to parse a meal plan from various types of inputs:
 * 1. Direct JSON object
 * 2. String that contains JSON
 * 3. Raw LLM output that might contain markdown or other text
 * 
 * It uses a series of repair strategies for handling malformed JSON from LLM responses.
 */
export function extractMealPlanFromLLMResponse(response: any): any {
  try {
    console.log("🧩 [JSON] Starting meal plan extraction process");
    
    // If the response is already a valid object, return it
    if (response && typeof response === 'object' && !Array.isArray(response)) {
      console.log("✅ [JSON] Response is already a valid object");
      return response;
    }
    
    // Handle Google Gemini API response format
    if (response && response.candidates && Array.isArray(response.candidates) && response.candidates.length > 0) {
      const content = response.candidates[0].content;
      if (content && content.parts && Array.isArray(content.parts) && content.parts.length > 0) {
        console.log("✅ [JSON] Extracting from Gemini API response format");
        return parseJsonFromLLM(content.parts[0].text);
      }
    }
    
    // If the response is a string, try to parse it as JSON
    let parsedPlan = null;
    if (typeof response === 'string') {
      console.log("🔍 [JSON] Attempting to parse string response");
      parsedPlan = parseJsonFromLLM(response);
      console.log("✅ [JSON] Successfully parsed string response");
    } else if (response && response.text && typeof response.text === 'string') {
      console.log("🔍 [JSON] Extracting from text property");
      parsedPlan = parseJsonFromLLM(response.text);
      console.log("✅ [JSON] Successfully extracted from text property");
    } else if (typeof response?.response?.text === 'function') {
      // Handle Gemini API direct response
      console.log("🔍 [JSON] Extracting from Gemini direct response");
      parsedPlan = parseJsonFromLLM(response.response.text());
      console.log("✅ [JSON] Successfully extracted from Gemini direct response");
    }
    
    // NEW: Special handling for meal plans - extract real recipes even from malformed JSON
    if (parsedPlan) {
      console.log("🧐 [JSON] Checking for real recipes in parsed plan");
      
      // Check if parsed plan contains real recipes
      if (containsRealRecipes(parsedPlan)) {
        console.log("✅ [JSON] Plan contains real recipes, using as is");
        return parsedPlan;
      } else {
        console.log("⚠️ [JSON] No real recipes found in parsed JSON, attempting content extraction");
        
        // Try to extract recipe content from any text in the response
        const extractedPlan = extractMealContentFromText(
          typeof response === 'string' ? response : 
          typeof response?.text === 'string' ? response.text :
          typeof response?.response?.text === 'function' ? response.response.text() :
          JSON.stringify(parsedPlan)
        );
        
        if (extractedPlan) {
          console.log("✅ [JSON] Successfully extracted meal content from text");
          return extractedPlan;
        }
      }
    }
    
    // If we still don't have a valid response, return null
    console.log("⚠️ [JSON] Could not extract valid meal plan");
    return null;
  } catch (error) {
    console.error("❌ [JSON] Failed to extract meal plan from LLM response", error);
    return null;
  }
}

/**
 * Check if a parsed plan contains real recipes or just placeholders
 */
function containsRealRecipes(plan: any): boolean {
  if (!plan) return false;
  
  try {
    // Check for weeklyPlan structure
    if (plan.weeklyPlan && Array.isArray(plan.weeklyPlan) && plan.weeklyPlan.length > 0) {
      // Check first day's first meal
      const firstDay = plan.weeklyPlan[0];
      if (firstDay && firstDay.meals && Array.isArray(firstDay.meals) && firstDay.meals.length > 0) {
        const firstMeal = firstDay.meals[0];
        if (firstMeal && firstMeal.recipe && firstMeal.recipe.name) {
          const recipeName = firstMeal.recipe.name;
          // Check if it's not a placeholder
          return (
            recipeName !== 'Recipe Name' && 
            !recipeName.includes('Placeholder') &&
            !recipeName.includes('Template') &&
            !recipeName.includes('Example')
          );
        }
      }
    }
    
    // Check for days array structure
    if (plan.days && Array.isArray(plan.days) && plan.days.length > 0) {
      const firstDay = plan.days[0];
      if (firstDay && firstDay.meals && Array.isArray(firstDay.meals) && firstDay.meals.length > 0) {
        const firstMeal = firstDay.meals[0];
        if (firstMeal && firstMeal.recipe && firstMeal.recipe.name) {
          const recipeName = firstMeal.recipe.name;
          return (
            recipeName !== 'Recipe Name' && 
            !recipeName.includes('Placeholder') &&
            !recipeName.includes('Template') &&
            !recipeName.includes('Example')
          );
        }
      }
    }
    
    // Check for direct meals array
    if (plan.meals && Array.isArray(plan.meals) && plan.meals.length > 0) {
      const firstMeal = plan.meals[0];
      if (firstMeal && firstMeal.recipe && firstMeal.recipe.name) {
        const recipeName = firstMeal.recipe.name;
        return (
          recipeName !== 'Recipe Name' && 
          !recipeName.includes('Placeholder') &&
          !recipeName.includes('Template') &&
          !recipeName.includes('Example')
        );
      }
    }
    
    // Check for day keys at top level (Monday, Tuesday, etc.)
    const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    for (const day of dayNames) {
      if (plan[day] && plan[day].meals && Array.isArray(plan[day].meals) && plan[day].meals.length > 0) {
        const firstMeal = plan[day].meals[0];
        if (firstMeal && firstMeal.recipe && firstMeal.recipe.name) {
          const recipeName = firstMeal.recipe.name;
          return (
            recipeName !== 'Recipe Name' && 
            !recipeName.includes('Placeholder') &&
            !recipeName.includes('Template') &&
            !recipeName.includes('Example')
          );
        }
      }
    }
    
    return false;
  } catch (error) {
    console.error("Error checking for real recipes:", error);
    return false;
  }
}

/**
 * Extract meal plan content from raw text, even when JSON structure is invalid
 */
function extractMealContentFromText(text: string): any | null {
  if (!text) return null;
  
  try {
    console.log("🔍 [JSON] Attempting to extract meal content from text");
    
    // First, try to find recipe names using common patterns
    const recipeExtractor = /([A-Z][A-Za-z\s'-]{3,40})(?:\s*-\s*(?:recipe|ingredients|instructions|steps)|\s*:\s*(?:ingredients|instructions)|\s*\n\s*Ingredients|\s*\n\s*Instructions)/gi;
    const recipeMatches = Array.from(text.matchAll(recipeExtractor)).map(match => match[1].trim());
    
    // Look for meal types followed by recipe names
    const mealTypeExtractor = /(breakfast|lunch|dinner|snack|morning\s+snack|afternoon\s+snack|evening\s+snack)\s*[":-]\s*([A-Z][A-Za-z\s'-]{3,40})/gi;
    const mealTypeMatches = Array.from(text.matchAll(mealTypeExtractor)).map(match => ({
      mealType: match[1].trim(),
      recipeName: match[2].trim()
    }));
    
    // Combine results, removing duplicates
    const allRecipes = new Set([
      ...recipeMatches,
      ...mealTypeMatches.map(m => m.recipeName)
    ]);
    
    // If we found recipes, build a structured meal plan
    if (allRecipes.size > 0 || mealTypeMatches.length > 0) {
      console.log(`✅ [JSON] Found ${allRecipes.size} recipes and ${mealTypeMatches.length} meal-recipe pairs`);
      
      // Extract additional data where possible (e.g., ingredients)
      const recipes = Array.from(allRecipes).map(recipeName => {
        // Try to find ingredients for this recipe
        const ingredientsPattern = new RegExp(`${escapeRegExp(recipeName)}(?:.*?\\n.*?)?(?:ingredients|ingredient list):?\\s*([\\s\\S]*?)(?:instructions|directions|steps|preparation|method|$)`, 'i');
        const ingredientsMatch = text.match(ingredientsPattern);
        
        let ingredients: string[] = [];
        if (ingredientsMatch && ingredientsMatch[1]) {
          // Extract ingredients - look for bullet points, numbers, or line breaks
          const ingredientsText = ingredientsMatch[1].trim();
          ingredients = ingredientsText
            .split(/[\n•\-*#]/)
            .map(i => i.trim())
            .filter(i => i.length > 2 && !/^instructions|directions|steps|preparation|method$/i.test(i));
        }
        
        // Try to find instructions
        const instructionsPattern = new RegExp(`${escapeRegExp(recipeName)}(?:.*?\\n.*?)?(?:instructions|directions|steps|preparation|method):?\\s*([\\s\\S]*?)(?:nutrition|calories|end of recipe|${recipeName}|$)`, 'i');
        const instructionsMatch = text.match(instructionsPattern);
        
        let instructions: string[] = [];
        if (instructionsMatch && instructionsMatch[1]) {
          // Extract instructions - look for bullet points, numbers, or line breaks
          const instructionsText = instructionsMatch[1].trim();
          instructions = instructionsText
            .split(/[\n•\-*#]|\d+\./)
            .map(i => i.trim())
            .filter(i => i.length > 5);
        }
        
        return {
          name: recipeName,
          ingredients: ingredients.length > 0 ? ingredients : ["Fresh ingredients", "Seasonings", "Oil"],
          instructions: instructions.length > 0 ? instructions : ["Prepare ingredients", "Cook according to traditional method", "Serve hot"],
          nutrition: { calories: 400, protein: 20, carbs: 40, fats: 15 }
        };
      });
      
      // Organize into meals by type if we have meal-recipe pairs
      const mealsByType: Record<string, any[]> = {};
      
      if (mealTypeMatches.length > 0) {
        mealTypeMatches.forEach(match => {
          const { mealType, recipeName } = match;
          const normalizedType = mealType.toLowerCase().trim();
          
          if (!mealsByType[normalizedType]) {
            mealsByType[normalizedType] = [];
          }
          
          // Find the full recipe details from our extracted recipes
          const recipeDetails = recipes.find(r => r.name === recipeName) || {
            name: recipeName,
            ingredients: ["Fresh ingredients", "Seasonings", "Oil"],
            instructions: ["Prepare ingredients", "Cook according to traditional method", "Serve hot"],
            nutrition: { calories: 400, protein: 20, carbs: 40, fats: 15 }
          };
          
          mealsByType[normalizedType].push(recipeDetails);
        });
      } else {
        // If we don't have meal types, distribute recipes across meal types
        const defaultMealTypes = ['breakfast', 'lunch', 'dinner'];
        recipes.forEach((recipe, index) => {
          const mealType = defaultMealTypes[index % defaultMealTypes.length];
          
          if (!mealsByType[mealType]) {
            mealsByType[mealType] = [];
          }
          
          mealsByType[mealType].push(recipe);
        });
      }
      
      // Create a structured meal plan
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const weeklyPlan = days.map(day => {
        const meals = [];
        
        // Add each meal type we found
        Object.entries(mealsByType).forEach(([mealType, mealRecipes]) => {
          // Choose a recipe for this day (cycling through available recipes)
          const dayIndex = days.indexOf(day);
          const recipeIndex = dayIndex % mealRecipes.length;
          const recipe = mealRecipes[recipeIndex];
          
          // Format meal type name properly
          let formattedMealType = mealType.charAt(0).toUpperCase() + mealType.slice(1);
          
          // Determine meal time based on type
          let mealTime = "8:00 AM";
          if (mealType.includes('lunch')) {
            mealTime = "1:00 PM";
          } else if (mealType.includes('dinner')) {
            mealTime = "7:00 PM";
          } else if (mealType.includes('morning')) {
            mealTime = "10:30 AM";
          } else if (mealType.includes('afternoon')) {
            mealTime = "3:30 PM";
          } else if (mealType.includes('evening')) {
            mealTime = "9:00 PM";
          } else if (mealType.includes('snack')) {
            mealTime = "3:30 PM";
          }
          
          meals.push({
            meal: formattedMealType,
            time: mealTime,
            recipe: recipe
          });
        });
        
        // Calculate daily nutrition totals
        const dailyNutrition = {
          calories: meals.reduce((sum, meal) => sum + (meal.recipe.nutrition?.calories || 0), 0),
          protein: meals.reduce((sum, meal) => sum + (meal.recipe.nutrition?.protein || 0), 0),
          carbs: meals.reduce((sum, meal) => sum + (meal.recipe.nutrition?.carbs || 0), 0),
          fats: meals.reduce((sum, meal) => sum + (meal.recipe.nutrition?.fats || 0), 0)
        };
        
        return {
          day,
          meals,
          dailyNutrition
        };
      });
      
      // Gather all ingredients for shopping list
      const allIngredients = recipes.flatMap(recipe => recipe.ingredients || []);
      
      // Group ingredients by category (simple version)
      const shoppingList = {
        protein: allIngredients.filter(i => isProteinIngredient(i)),
        produce: allIngredients.filter(i => isProduceIngredient(i)),
        grains: allIngredients.filter(i => isGrainIngredient(i)),
        dairy: allIngredients.filter(i => isDairyIngredient(i)),
        other: allIngredients.filter(i => 
          !isProteinIngredient(i) && 
          !isProduceIngredient(i) && 
          !isGrainIngredient(i) && 
          !isDairyIngredient(i)
        )
      };
      
      return {
        id: 'extracted_meal_plan_' + Date.now(),
        weeklyPlan,
        shoppingList,
        mealPrepTips: [
          "Prepare ingredients in advance for quick cooking",
          "Store cut vegetables in airtight containers",
          "Cook grains and proteins in batches"
        ],
        batchCookingRecommendations: [
          "Double recipes and freeze portions",
          "Prepare base sauces that can be used in multiple dishes"
        ]
      };
    }
    
    return null;
  } catch (error) {
    console.error("Error extracting meal content from text:", error);
    return null;
  }
}

/**
 * Helper function to escape special characters in a string for use in a regex pattern
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Helpers to categorize ingredients
 */
function isProteinIngredient(ingredient: string): boolean {
  const proteins = ['chicken', 'beef', 'pork', 'fish', 'shrimp', 'tofu', 'tempeh', 'paneer', 'eggs', 
                   'lentils', 'beans', 'dal', 'legumes', 'chickpeas', 'protein'];
  return proteins.some(p => ingredient.toLowerCase().includes(p));
}

function isProduceIngredient(ingredient: string): boolean {
  const produce = ['vegetable', 'vegetables', 'veggie', 'veggies', 'fruit', 'fruits', 'leafy greens',
                   'tomato', 'tomatoes', 'potato', 'potatoes', 'onion', 'onions', 'carrot', 'carrots',
                   'spinach', 'greens', 'broccoli', 'cauliflower', 'pepper', 'peppers', 'zucchini',
                   'eggplant', 'cucumber', 'lettuce', 'cabbage', 'produce'];
  return produce.some(p => ingredient.toLowerCase().includes(p));
}

function isGrainIngredient(ingredient: string): boolean {
  const grains = ['rice', 'wheat', 'flour', 'pasta', 'noodles', 'bread', 'chapati', 'roti', 'naan', 'cereal',
                 'oats', 'quinoa', 'barley', 'millet', 'corn', 'maize', 'grains'];
  return grains.some(p => ingredient.toLowerCase().includes(p));
}

function isDairyIngredient(ingredient: string): boolean {
  const dairy = ['milk', 'cheese', 'yogurt', 'curd', 'cream', 'butter', 'ghee', 'paneer', 'dairy'];
  return dairy.some(p => ingredient.toLowerCase().includes(p));
}