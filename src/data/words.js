// ============================================================
// Word Database — helpers for loading and selecting words
// ============================================================

import wordsData from './words.json' assert { type: 'json' };

/**
 * Get all words flattened across all tiers and categories.
 */
export function loadWords() {
  const allWords = [];
  for (const tierKey of Object.keys(wordsData.tiers)) {
    const tier = wordsData.tiers[tierKey];
    for (const category of Object.keys(tier.categories)) {
      for (const word of tier.categories[category]) {
        allWords.push({ word, tier: parseInt(tierKey, 10), category });
      }
    }
  }
  return allWords;
}

/**
 * Pick a random word from the given difficulty tier.
 * @param {number} tier — 1, 2, or 3
 * @returns {{ word: string, tier: number, category: string }}
 */
export function getRandomWord(tier) {
  const allWords = loadWords();
  const filtered = allWords.filter(w => w.tier === tier);
  if (filtered.length === 0) return null;
  const idx = Math.floor(Math.random() * filtered.length);
  return filtered[idx];
}

/**
 * Get list of available categories for a given tier.
 * @param {number} tier
 * @returns {string[]}
 */
export function getWordCategories(tier) {
  const tierData = wordsData.tiers[String(tier)];
  if (!tierData) return [];
  return Object.keys(tierData.categories);
}

/**
 * Get the full set of Cyrillic distractor letters.
 */
export function getDistractorLetters() {
  return wordsData.distractorLetters;
}

export { wordsData };
