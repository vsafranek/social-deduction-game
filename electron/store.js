// electron/store.js
const { app } = require('electron');

// Default settings values
const defaultSettings = {
  fullscreen: true,
  alwaysOnTop: false
};

// Store instance (initialized asynchronously)
let store = null;
let storePromise = null;

/**
 * Initialize store instance
 * @returns {Promise} Promise that resolves when store is ready
 */
async function initStore() {
  if (store) {
    return store;
  }
  
  if (storePromise) {
    return storePromise;
  }
  
  storePromise = (async () => {
    const Store = (await import('electron-store')).default;
    store = new Store({
      defaults: defaultSettings,
      name: 'config'
    });
    return store;
  })();
  
  return storePromise;
}

/**
 * Load all settings
 * @returns {Object} All settings
 */
function getSettings() {
  if (!store) {
    // If store not initialized, return defaults
    console.warn("⚠️ Store not initialized, returning default settings");
    return { ...defaultSettings };
  }
  const settings = store.store;
  console.log("📋 Reading settings from store:", settings);
  return settings;
}

/**
 * Save all settings
 * @param {Object} settings - Settings to save
 */
async function setSettings(settings) {
  await initStore();
  store.set(settings);
}

/**
 * Load specific setting
 * @param {string} key - Setting key
 * @returns {*} Setting value or undefined
 */
function getSetting(key) {
  if (!store) {
    // If store not initialized, return default for that key
    return defaultSettings[key];
  }
  return store.get(key);
}

/**
 * Save specific setting
 * @param {string} key - Setting key
 * @param {*} value - Value to save
 */
async function setSetting(key, value) {
  await initStore();
  const oldValue = store.get(key);
  store.set(key, value);
  const newValue = store.get(key);
  console.log(`💾 Saved setting: ${key} = ${value} (was: ${oldValue}, now: ${newValue})`);
  console.log("📋 Current settings:", store.store);
  
  // Verify the value was saved correctly
  if (newValue !== value) {
    console.warn(`⚠️ Warning: Setting ${key} value mismatch! Expected: ${value}, Got: ${newValue}`);
  }
}

/**
 * Get path to settings file
 * @returns {string} File path
 */
function getPath() {
  if (!store) {
    return null;
  }
  return store.path;
}

// Initialize store on module load
initStore().catch((error) => {
  console.error('Error initializing store:', error);
});

module.exports = {
  getSettings,
  setSettings,
  getSetting,
  setSetting,
  getPath,
  defaultSettings,
  initStore
};

