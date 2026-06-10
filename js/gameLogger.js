// ═══════════════════════════════════════════════════════════
// GAME LOGGER — Records every game event for evaluation & XAI
// ═══════════════════════════════════════════════════════════

const GameLogger = (() => {
  let log = [];
  let turnCounter = 0;

  function reset() {
    log = [];
    turnCounter = 0;
  }

  function nextTurn() {
    turnCounter++;
    return turnCounter;
  }

  /**
   * Record a turn event
   * @param {Object} entry
   * @param {number} entry.turn - Turn number
   * @param {string} entry.actor - 'player' | 'ai'
   * @param {string} entry.action - 'draw' | 'guess' | 'pass' | 'timeout'
   * @param {Object} [entry.drew] - { number, color } of drawn tile
   * @param {Object} [entry.guess] - { position, number, color } of guess
   * @param {string} [entry.result] - 'correct' | 'wrong' | null
   * @param {Array}  [entry.knownTiles] - tiles revealed at this point
   * @param {Object} [entry.optimalGuess] - what the best guess would be
   * @param {Object} [entry.aiThought] - AI's thought process (for XAI)
   * @param {Object} [entry.probabilitySnapshot] - probability data snapshot
   */
  function record(entry) {
    log.push({
      ...entry,
      timestamp: Date.now()
    });
  }

  function getLog() {
    return [...log];
  }

  function getPlayerTurns() {
    return log.filter(e => e.actor === 'player');
  }

  function getAITurns() {
    return log.filter(e => e.actor === 'ai');
  }

  function getGuesses() {
    return log.filter(e => e.action === 'guess');
  }

  function getPlayerGuesses() {
    return log.filter(e => e.actor === 'player' && e.action === 'guess');
  }

  function getAIGuesses() {
    return log.filter(e => e.actor === 'ai' && e.action === 'guess');
  }

  function getTurnCount() {
    return turnCounter;
  }

  return {
    reset,
    nextTurn,
    record,
    getLog,
    getPlayerTurns,
    getAITurns,
    getGuesses,
    getPlayerGuesses,
    getAIGuesses,
    getTurnCount
  };
})();
