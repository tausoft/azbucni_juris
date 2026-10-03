// ============================================================
// i18n — Centralized Translation Dictionary
// Default language: sr_cyr (Serbian Cyrillic)
// ============================================================

const translations = {
  menu: {
    title: { sr_cyr: 'АЗБУЧНИ ЈУРИШ', sr_lat: 'AZBUČNI JURIŠ', en: 'ALPHABET RAID' },
    startButton: { sr_cyr: 'ПОЧНИ', sr_lat: 'POČNI', en: 'START' },
  },
  theme: {
    selectTitle: { sr_cyr: 'Изабери хероја', sr_lat: 'Izaberi heroja', en: 'Choose your hero' },
    knightLabel: { sr_cyr: 'Витез', sr_lat: 'Vitez', en: 'Knight' },
    princessLabel: { sr_cyr: 'Принцеза', sr_lat: 'Prinčezа', en: 'Princess' },
  },
  hud: {
    targetWord: { sr_cyr: 'Реч', sr_lat: 'Reč', en: 'Word' },
    score: { sr_cyr: 'Бодови', sr_lat: 'Bodovi', en: 'Score' },
    lives: { sr_cyr: 'Животи', sr_lat: 'Životi', en: 'Lives' },
    progress: { sr_cyr: 'Напредак', sr_lat: 'Napredak', en: 'Progress' },
  },
  wordComplete: {
    win: { sr_cyr: 'Честитам! Реч је завршена!', sr_lat: 'Čestitam! Reč je završena!', en: 'Congratulations! Word complete!' },
    nextButton: { sr_cyr: 'НАРЕДНА', sr_lat: 'NAREDNA', en: 'NEXT' },
  },
  gameOver: {
    lose: { sr_cyr: 'Игра је завршена. Покушај опет!', sr_lat: 'Igra je završena. Pokušaj opet!', en: 'Game over. Try again!' },
    retryButton: { sr_cyr: 'ПОНОВО', sr_lat: 'PONOVO', en: 'RETRY' },
  },
  language: {
    switchLang: { sr_cyr: 'Језик', sr_lat: 'Jezik', en: 'Language' },
  },
  game: {
    pause: { sr_cyr: 'ПАУЗА', sr_lat: 'PAUZA', en: 'PAUSE' },
  },
};

// Current language state (default: Serbian Cyrillic)
let currentLanguage = 'sr_cyr';

/**
 * Translation lookup: takes a dot-notation key, returns localized string.
 * Example: t('menu.title') → 'АЗБУЧНИ ЈУРИШ'
 */
export function t(key) {
  const parts = key.split('.');
  let obj = translations;
  for (const part of parts) {
    if (obj == null || typeof obj !== 'object') return key;
    obj = obj[part];
  }
  if (typeof obj === 'object' && obj[currentLanguage] !== undefined) {
    return obj[currentLanguage];
  }
  return key;
}

/**
 * Set the active language.
 * @param {'sr_cyr' | 'sr_lat' | 'en'} lang
 */
export function setLanguage(lang) {
  if (availableLanguages.includes(lang)) {
    currentLanguage = lang;
    return true;
  }
  return false;
}

/**
 * Get the active language.
 */
export function getLanguage() {
  return currentLanguage;
}

/**
 * Get list of available language keys.
 */
export function getAvailableLanguages() {
  return [...availableLanguages];
}

// Available languages list
const availableLanguages = ['sr_cyr', 'sr_lat', 'en'];

export { translations, availableLanguages };
