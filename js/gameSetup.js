// ═══════════════════════════════════════════════════════════
// GAME SETUP — Per-game configuration (Custom Game)
// ═══════════════════════════════════════════════════════════

const GameSetup = (() => {
  const defaults = {
    aiLevel: 'easy',       // 'easy' | 'medium' | 'hard'
    timerEnabled: false,
    timerSeconds: 15,      // 5-30
    cardRemoval: 0         // 0, 2, 4, 6
  };

  let current = { ...defaults };

  return {
    get() {
      return { ...current };
    },

    setAILevel(level) {
      if (['easy', 'medium', 'hard'].includes(level)) {
        current.aiLevel = level;
      }
    },

    setTimerEnabled(enabled) {
      current.timerEnabled = !!enabled;
    },

    setTimerSeconds(seconds) {
      current.timerSeconds = Math.max(5, Math.min(30, parseInt(seconds) || 15));
    },

    setCardRemoval(count) {
      if ([0, 2, 4, 6].includes(parseInt(count))) {
        current.cardRemoval = parseInt(count);
      }
    },

    reset() {
      current = { ...defaults };
    }
  };
})();
