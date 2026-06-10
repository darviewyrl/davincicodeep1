// ═══════════════════════════════════════════════════════════
// GLOBAL SETTINGS — Persistent audio preferences via LocalStorage
// ═══════════════════════════════════════════════════════════

const GlobalSettings = (() => {
  const STORAGE_KEY = 'davinci_global_settings';

  const defaults = {
    sfxEnabled: true,
    bgmEnabled: true
  };

  function load() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return { ...defaults, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Failed to load settings:', e);
    }
    return { ...defaults };
  }

  function save(settings) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn('Failed to save settings:', e);
    }
  }

  let current = load();

  // Apply current settings to AudioManager
  function apply() {
    AudioManager.setSFXEnabled(current.sfxEnabled);
    AudioManager.setBGMEnabled(current.bgmEnabled);
  }

  return {
    get() {
      return { ...current };
    },

    setSFX(enabled) {
      current.sfxEnabled = enabled;
      save(current);
      apply();
    },

    setBGM(enabled) {
      current.bgmEnabled = enabled;
      save(current);
      apply();
    },

    apply,
    load() {
      current = load();
      return { ...current };
    }
  };
})();
