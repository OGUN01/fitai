// Collection of motivational fitness quotes
export const motivationalQuotes = [
  "Your body can stand almost anything. It's your mind that you have to convince.",
  "The only bad workout is the one that didn't happen.",
  "Strength does not come from the body. It comes from the will.",
  "Fitness is not about being better than someone else. It's about being better than you used to be.",
  "The hard days are what make you stronger.",
  "Don't wish for it, work for it.",
  "You don't have to be extreme, just consistent.",
  "Rome wasn't built in a day, and neither was your body.",
  "Sweat is just fat crying.",
  "Your health is an investment, not an expense.",
  "The difference between try and triumph is a little umph.",
  "Strive for progress, not perfection.",
  "The clock is ticking. Are you becoming the person you want to be?",
  "You're only one workout away from a good mood.",
  "What seems impossible today will one day become your warm-up.",
  "The pain you feel today will be the strength you feel tomorrow.",
  "Don't stop when you're tired. Stop when you're done.",
  "Exercise is king. Nutrition is queen. Put them together and you've got a kingdom.",
  "No matter how slow you go, you're still lapping everyone on the couch.",
  "Wake up with determination. Go to bed with satisfaction.",
  "The body achieves what the mind believes.",
  "Fall in love with taking care of your body.",
  "Motivation is what gets you started. Habit is what keeps you going.",
  "Take care of your body. It's the only place you have to live.",
  "The greatest wealth is health.",
  "Your body keeps an accurate journal regardless of what you write down.",
  "If it doesn't challenge you, it doesn't change you.",
  "Results happen over time, not overnight. Work hard, stay consistent, and be patient.",
  "Sore today, strong tomorrow.",
  "Every champion was once a contender who refused to give up."
];

/**
 * Get a random motivational quote from the collection
 */
export const getRandomQuote = (): string => {
  const randomIndex = Math.floor(Math.random() * motivationalQuotes.length);
  return motivationalQuotes[randomIndex];
};

/**
 * Get the next quote from the collection based on the current quote
 * @param currentQuote - The currently displayed quote
 * @returns A different quote from the collection
 */
export const getNextQuote = (currentQuote: string): string => {
  // Filter out the current quote to ensure we get a different one
  const remainingQuotes = motivationalQuotes.filter(quote => quote !== currentQuote);
  
  // If somehow all quotes were filtered out (should never happen with 30 quotes)
  if (remainingQuotes.length === 0) {
    return motivationalQuotes[0];
  }
  
  // Get a random quote from the remaining ones
  const randomIndex = Math.floor(Math.random() * remainingQuotes.length);
  return remainingQuotes[randomIndex];
};
