// ═══════════════════════════════════════════════════════════
// AI MODULE — Easy / Medium / Hard
// Each level implements makeGuess(gameState) → { position, number, color, thought }
// ═══════════════════════════════════════════════════════════

const AI = (() => {

  // ── Helpers ──

  /**
   * Get all possible values for a given face-down tile position
   * given what we know: which tiles are revealed, which are in our hand, etc.
   */
  function getPossibleValues(position, opponentTiles, knownTiles, allRemainingValues) {
    const tile = opponentTiles[position];
    if (tile.revealed) return [];

    // The tile must fit the sorting order
    const leftBound = findLeftBound(position, opponentTiles);
    const rightBound = findRightBound(position, opponentTiles);

    return allRemainingValues.filter(v => {
      // Must be within bounds
      if (leftBound !== null) {
        if (compareTile(v, leftBound) <= 0) return false;
      }
      if (rightBound !== null) {
        if (compareTile(v, rightBound) >= 0) return false;
      }
      return true;
    });
  }

  /**
   * Compare two tile values for sorting
   * Returns negative if a < b, positive if a > b, 0 if equal
   * Sorting: by number first, then black < white. Joker: black joker = -1, white joker = 12
   */
  function compareTile(a, b) {
    const aSort = getSortValue(a);
    const bSort = getSortValue(b);
    if (aSort !== bSort) return aSort - bSort;
    return 0;
  }

  function getSortValue(tile) {
    if (tile.joker) {
      // Black joker can go anywhere, treated as chosen position
      // For sorting comparison, joker has a special sort value
      return tile.color === 'black' ? tile.sortValue ?? -0.5 : tile.sortValue ?? 24.5;
    }
    // Number * 2 + (white = 1, black = 0) to enforce black < white for same number
    return tile.number * 2 + (tile.color === 'white' ? 1 : 0);
  }

  function findLeftBound(position, tiles) {
    for (let i = position - 1; i >= 0; i--) {
      if (tiles[i].revealed || tiles[i].knownValue) {
        return tiles[i].knownValue || tiles[i];
      }
    }
    return null;
  }

  function findRightBound(position, tiles) {
    for (let i = position + 1; i < tiles.length; i++) {
      if (tiles[i].revealed || tiles[i].knownValue) {
        return tiles[i].knownValue || tiles[i];
      }
    }
    return null;
  }

  function getRemainingValues(gameState) {
    const used = new Set();

    // Player tiles (AI can see its own tiles)
    gameState.aiTiles.forEach(t => {
      if (!t.joker) used.add(`${t.color}-${t.number}`);
      else used.add(`joker-${t.color}`);
    });

    // Revealed opponent tiles
    gameState.playerTiles.forEach(t => {
      if (t.revealed) {
        if (!t.joker) used.add(`${t.color}-${t.number}`);
        else used.add(`joker-${t.color}`);
      }
    });

    // Removed cards
    if (gameState.removedCards) {
      gameState.removedCards.forEach(t => {
        if (!t.joker) used.add(`${t.color}-${t.number}`);
        else used.add(`joker-${t.color}`);
      });
    }

    // Build remaining
    const remaining = [];
    for (let num = 0; num <= 11; num++) {
      for (const color of ['black', 'white']) {
        const key = `${color}-${num}`;
        if (!used.has(key)) {
          remaining.push({ number: num, color, joker: false });
        }
      }
    }
    // Jokers
    if (!used.has('joker-black')) remaining.push({ joker: true, color: 'black', number: -1 });
    if (!used.has('joker-white')) remaining.push({ joker: true, color: 'white', number: -1 });

    return remaining;
  }

  // ═══ EASY AI — Random ═══
  function easyGuess(gameState) {
    const unrevealed = gameState.playerTiles
      .map((t, i) => ({ ...t, position: i }))
      .filter(t => !t.revealed);

    if (unrevealed.length === 0) return null;

    // Pick random position
    const target = unrevealed[Math.floor(Math.random() * unrevealed.length)];

    // Pick random possible value (not even smart about it)
    const remaining = getRemainingValues(gameState);
    if (remaining.length === 0) return null;

    const guessValue = remaining[Math.floor(Math.random() * remaining.length)];

    return {
      position: target.position,
      number: guessValue.joker ? 'joker' : guessValue.number,
      color: guessValue.color,
      thought: {
        method: 'random',
        reasoning: 'สุ่มเลือกตำแหน่งและตัวเลขแบบไม่คิดอะไร',
        probabilities: null
      }
    };
  }

  // ═══ MEDIUM AI — Elimination ═══
  function mediumGuess(gameState) {
    const remaining = getRemainingValues(gameState);
    const unrevealed = gameState.playerTiles
      .map((t, i) => ({ ...t, position: i }))
      .filter(t => !t.revealed);

    if (unrevealed.length === 0 || remaining.length === 0) return null;

    // For each position, find possible values based on ordering constraints
    let bestPos = -1;
    let bestGuess = null;
    let fewestOptions = Infinity;
    let positionAnalysis = {};

    unrevealed.forEach(target => {
      const possible = getPossibleValues(
        target.position,
        gameState.playerTiles,
        [],
        remaining
      );

      positionAnalysis[target.position] = possible;

      if (possible.length > 0 && possible.length < fewestOptions) {
        fewestOptions = possible.length;
        bestPos = target.position;
        // Pick the most likely (first in list for medium)
        bestGuess = possible[Math.floor(Math.random() * possible.length)];
      }
    });

    if (bestGuess === null) {
      return easyGuess(gameState); // Fallback
    }

    return {
      position: bestPos,
      number: bestGuess.joker ? 'joker' : bestGuess.number,
      color: bestGuess.color,
      thought: {
        method: 'elimination',
        reasoning: `ตำแหน่งที่ ${bestPos + 1} มีตัวเลือกเหลือน้อยที่สุด (${fewestOptions} ตัวเลือก) จึงเลือกตำแหน่งนี้`,
        probabilities: positionAnalysis,
        selectedPosition: bestPos,
        optionCount: fewestOptions
      }
    };
  }

  // ═══ HARD AI — Probability Model ═══
  function hardGuess(gameState) {
    const remaining = getRemainingValues(gameState);
    const unrevealed = gameState.playerTiles
      .map((t, i) => ({ ...t, position: i }))
      .filter(t => !t.revealed);

    if (unrevealed.length === 0 || remaining.length === 0) return null;

    // Calculate probability distribution for each position
    let positionProbabilities = {};
    let bestPos = -1;
    let bestGuess = null;
    let bestProb = 0;

    unrevealed.forEach(target => {
      const possible = getPossibleValues(
        target.position,
        gameState.playerTiles,
        [],
        remaining
      );

      if (possible.length === 0) return;

      // Calculate probabilities
      const probs = {};
      const total = possible.length;
      possible.forEach(v => {
        const key = v.joker ? `joker-${v.color}` : `${v.color}-${v.number}`;
        probs[key] = {
          value: v,
          probability: 1 / total,
          display: v.joker ? `Joker ${v.color === 'black' ? 'ดำ' : 'ขาว'}` : `${v.number} ${v.color === 'black' ? 'ดำ' : 'ขาว'}`
        };
      });

      positionProbabilities[target.position] = {
        possible,
        probabilities: probs,
        totalOptions: total,
        certainty: total === 1 ? 1 : 1 / total
      };

      // Strategy: pick the position with highest certainty (fewest options)
      if (total === 1 || (1 / total) > bestProb) {
        bestProb = total === 1 ? 1 : 1 / total;
        bestPos = target.position;
        if (total === 1) {
          bestGuess = possible[0]; // Certain!
        } else {
          // Pick the one with highest implied probability
          bestGuess = possible[0];
        }
      }
    });

    if (bestGuess === null) {
      return easyGuess(gameState);
    }

    const posData = positionProbabilities[bestPos];
    const certaintyPercent = (bestProb * 100).toFixed(0);

    return {
      position: bestPos,
      number: bestGuess.joker ? 'joker' : bestGuess.number,
      color: bestGuess.color,
      thought: {
        method: 'probability',
        reasoning: bestProb === 1
          ? `ตำแหน่งที่ ${bestPos + 1} มีคำตอบเดียวที่เป็นไปได้ ดังนั้นทายได้แน่นอน 100%`
          : `ตำแหน่งที่ ${bestPos + 1} มี ${posData.totalOptions} ตัวเลือก (ความมั่นใจ ${certaintyPercent}%) เลือกค่าที่น่าจะเป็นไปได้มากที่สุด`,
        probabilities: positionProbabilities,
        selectedPosition: bestPos,
        certainty: bestProb,
        allPositionData: positionProbabilities
      }
    };
  }

  // ── Whether AI should continue guessing after a correct guess ──
  function shouldContinueGuessing(level, gameState, consecutiveCorrect) {
    switch (level) {
      case 'easy':
        return false; // Easy always stops
      case 'medium':
        return consecutiveCorrect < 2 && Math.random() > 0.5;
      case 'hard':
        // Check if there's another certain guess
        const nextGuess = hardGuess(gameState);
        if (nextGuess && nextGuess.thought.certainty === 1) {
          return true; // Continue if we're certain
        }
        return consecutiveCorrect < 3 && Math.random() > 0.3;
      default:
        return false;
    }
  }

  // ── Public API ──
  return {
    makeGuess(gameState) {
      const level = gameState.aiLevel || 'easy';
      switch (level) {
        case 'easy': return easyGuess(gameState);
        case 'medium': return mediumGuess(gameState);
        case 'hard': return hardGuess(gameState);
        default: return easyGuess(gameState);
      }
    },

    shouldContinueGuessing,
    getRemainingValues,
    getPossibleValues,
    getSortValue,
    compareTile
  };
})();
