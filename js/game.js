// ═══════════════════════════════════════════════════════════
// GAME ENGINE — Core game logic, state, and turn system
// ═══════════════════════════════════════════════════════════

const Game = (() => {
  let state = null;
  let timerInterval = null;
  let timerRemaining = 0;
  let onStateChange = null; // callback

  // Total Timer & Joker Placement Timer
  let totalGameSeconds = 0;
  let totalTimerInterval = null;
  let jokerTimerInterval = null;
  let jokerTimerRemaining = 0;

  // ── Create all tiles ──
  function createAllTiles() {
    const tiles = [];
    for (let num = 0; num <= 11; num++) {
      tiles.push({ number: num, color: 'black', joker: false, revealed: false, id: `b${num}` });
      tiles.push({ number: num, color: 'white', joker: false, revealed: false, id: `w${num}` });
    }
    // Jokers
    tiles.push({ number: -1, color: 'black', joker: true, revealed: false, id: 'jb' });
    tiles.push({ number: -1, color: 'white', joker: true, revealed: false, id: 'jw' });
    return tiles;
  }

  // ── Shuffle array (Fisher-Yates) ──
  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ── Sort tiles for hand ──
  function sortTiles(tiles) {
    return tiles.sort((a, b) => {
      const aVal = AI.getSortValue(a);
      const bVal = AI.getSortValue(b);
      return aVal - bVal;
    });
  }

  // ── Find correct insert position for a new tile in a sorted hand ──
  function findInsertPosition(hand, newTile) {
    const newVal = AI.getSortValue(newTile);
    for (let i = 0; i < hand.length; i++) {
      if (AI.getSortValue(hand[i]) > newVal) {
        return i;
      }
    }
    return hand.length;
  }

  // ── Initialize new game ──
  function init(config) {
    GameLogger.reset();

    let allTiles = createAllTiles();
    allTiles = shuffle(allTiles);

    // Card removal
    const removedCards = [];
    if (config.cardRemoval > 0) {
      for (let i = 0; i < config.cardRemoval; i++) {
        removedCards.push(allTiles.pop());
      }
    }

    // Deal 4 tiles each
    const playerHand = sortTiles(allTiles.splice(0, 4));
    const aiHand = sortTiles(allTiles.splice(0, 4));

    // Assign joker sort values based on placement
    assignJokerSortValues(playerHand);
    assignJokerSortValues(aiHand);

    state = {
      playerTiles: playerHand,
      aiTiles: aiHand,
      deck: allTiles,
      removedCards: removedCards,
      currentTurn: 'player', // 'player' | 'ai'
      phase: 'draw',         // 'draw' | 'guess' | 'result' | 'gameover' | 'penalty_reveal' | 'joker_placement'
      drawnTile: null,
      aiLevel: config.aiLevel || 'easy',
      timerEnabled: config.timerEnabled || false,
      timerSeconds: config.timerSeconds || 15,
      consecutiveCorrect: 0,
      turnNumber: 0,
      winner: null,
      lastGuessResult: null,
      gameStartTime: Date.now()
    };

    totalGameSeconds = 0;
    startTotalTimer();

    notify();
    return state;
  }

  function assignJokerSortValues(hand) {
    hand.forEach((tile, i) => {
      if (tile.joker) {
        // Joker keeps its current position in sort
        if (i === 0) {
          tile.sortValue = hand.length > 1 ? AI.getSortValue(hand[1]) - 0.5 : 0;
        } else if (i === hand.length - 1) {
          tile.sortValue = AI.getSortValue(hand[i - 1]) + 0.5;
        } else {
          tile.sortValue = (AI.getSortValue(hand[i - 1]) + AI.getSortValue(hand[i + 1])) / 2;
        }
      }
    });
  }

  // ── Get safe state for AI (hides player's numbers) ──
  function getGameStateForAI() {
    return {
      playerTiles: state.playerTiles.map(t => ({
        ...t,
        // AI can't see unrevealed player tiles
        number: t.revealed ? t.number : undefined,
        color: t.revealed ? t.color : undefined,
        joker: t.revealed ? t.joker : undefined,
        sortValue: t.revealed ? (t.sortValue || AI.getSortValue(t)) : undefined
      })),
      aiTiles: state.aiTiles,
      deck: state.deck,
      removedCards: state.removedCards,
      aiLevel: state.aiLevel,
      turnNumber: state.turnNumber
    };
  }

  // ── Get state for evaluation (visible to both) ──
  function getFullState() {
    return { ...state };
  }

  // ── Player draws from deck ──
  function playerDraw() {
    if (state.phase !== 'draw' || state.currentTurn !== 'player') return false;
    if (state.deck.length === 0) {
      // No cards to draw, skip to guess with no drawn card
      state.phase = 'guess';
      state.drawnTile = null;
      notify();
      return true;
    }

    const tile = state.deck.pop();
    state.drawnTile = tile;
    state.phase = 'guess';
    state.turnNumber = GameLogger.nextTurn();

    GameLogger.record({
      turn: state.turnNumber,
      actor: 'player',
      action: 'draw',
      drew: { number: tile.number, color: tile.color, joker: tile.joker }
    });

    AudioManager.sfx.drawCard();
    notify();

    if (state.timerEnabled) {
      startTimer();
    }

    return true;
  }

  // ── Player makes a guess ──
  function playerGuess(position, number, color) {
    if (state.phase !== 'guess' || state.currentTurn !== 'player') return null;

    const targetTile = state.aiTiles[position];
    if (!targetTile || targetTile.revealed) return null;

    const isJokerGuess = number === 'joker';
    let correct = false;

    if (isJokerGuess) {
      correct = targetTile.joker && targetTile.color === color;
    } else {
      correct = !targetTile.joker && targetTile.number === number && targetTile.color === color;
    }

    // Calculate optimal guess for evaluation
    const remaining = AI.getRemainingValues({
      aiTiles: state.playerTiles,
      playerTiles: state.aiTiles,
      removedCards: state.removedCards
    });
    const optimalData = calculateOptimalGuess(state.aiTiles, remaining);

    GameLogger.record({
      turn: state.turnNumber,
      actor: 'player',
      action: 'guess',
      guess: { position, number, color },
      result: correct ? 'correct' : 'wrong',
      knownTiles: getRevealedTiles(),
      optimalGuess: optimalData,
      probabilitySnapshot: calculateProbabilitySnapshot(state.aiTiles, remaining)
    });

    if (correct) {
      targetTile.revealed = true;
      state.consecutiveCorrect++;
      state.lastGuessResult = 'correct';
      AudioManager.sfx.guessCorrect();

      // Check win condition
      if (state.aiTiles.every(t => t.revealed)) {
        state.phase = 'gameover';
        state.winner = 'player';
        clearTimer();
        stopTotalTimer();
        AudioManager.sfx.gameWin();
        notify();
        return { correct: true, gameOver: true, winner: 'player' };
      }

      // Player can continue guessing or pass
      state.phase = 'decide'; // continue or pass
      clearTimer();
      notify();
      return { correct: true, gameOver: false };
    } else {
      // Wrong — reveal drawn tile
      state.lastGuessResult = 'wrong';
      state.consecutiveCorrect = 0;
      AudioManager.sfx.guessWrong();

      if (state.drawnTile) {
        state.drawnTile.revealed = true;
        if (state.drawnTile.joker) {
          // Trigger manual placement phase
          state.phase = 'joker_placement';
          state.jokerPlacementReason = 'wrong';
          clearTimer();
          notify();
          return { correct: false, gameOver: false };
        }
        const insertPos = findInsertPosition(state.playerTiles, state.drawnTile);
        state.playerTiles.splice(insertPos, 0, state.drawnTile);
        assignJokerSortValues(state.playerTiles);
      } else {
        // No drawn card (deck was empty) — enter penalty_reveal phase
        state.phase = 'penalty_reveal';
        clearTimer();
        notify();
        return { correct: false, gameOver: false };
      }
      state.drawnTile = null;

      // Check if player lost (all tiles revealed)
      if (state.playerTiles.every(t => t.revealed)) {
        state.phase = 'gameover';
        state.winner = 'ai';
        clearTimer();
        stopTotalTimer();
        AudioManager.sfx.gameLose();
        notify();
        return { correct: false, gameOver: true, winner: 'ai' };
      }

      clearTimer();
      endTurn();
      return { correct: false, gameOver: false };
    }
  }

  // ── Player decides to continue guessing ──
  function playerContinue() {
    if (state.phase !== 'decide') return;
    state.phase = 'guess';

    if (state.timerEnabled) startTimer();

    notify();
  }

  // ── Player passes (stops guessing) ──
  function playerPass() {
    if (state.phase !== 'decide' && state.phase !== 'guess') return;

    GameLogger.record({
      turn: state.turnNumber,
      actor: 'player',
      action: 'pass'
    });

    // Place drawn tile face-down
    if (state.drawnTile) {
      if (state.drawnTile.joker) {
        // Trigger manual placement phase
        state.phase = 'joker_placement';
        state.jokerPlacementReason = 'pass';
        clearTimer();
        notify();
        return;
      }
      state.drawnTile.revealed = false;
      const insertPos = findInsertPosition(state.playerTiles, state.drawnTile);
      state.playerTiles.splice(insertPos, 0, state.drawnTile);
      assignJokerSortValues(state.playerTiles);
      state.drawnTile = null;
      AudioManager.sfx.cardPlace();
    }

    state.consecutiveCorrect = 0;
    clearTimer();
    endTurn();
  }

  // ── End current turn, switch to other player ──
  function endTurn() {
    state.currentTurn = state.currentTurn === 'player' ? 'ai' : 'player';
    state.phase = 'draw';
    state.lastGuessResult = null;

    // When switching to player and deck is empty, auto-skip draw phase
    if (state.currentTurn === 'player' && state.deck.length === 0) {
      state.phase = 'guess';
    }

    notify();

    if (state.currentTurn === 'ai') {
      // AI takes its turn after a randomized delay
      const delayMs = getRandomAIDelay();
      setTimeout(() => aiTurn(), delayMs);
    } else {
      AudioManager.sfx.turnStart();
    }
  }

  // ── AI Delays ──
  function getRandomAIDelay() {
    return Math.floor(Math.random() * 3200) + 800; // 0.8s to 4.0s
  }

  // ── AI Turn ──
  async function aiTurn() {
    if (state.currentTurn !== 'ai' || state.phase !== 'draw') return;

    // 1. AI draws
    if (state.deck.length > 0) {
      const tile = state.deck.pop();
      state.drawnTile = tile;
      state.turnNumber = GameLogger.nextTurn();

      GameLogger.record({
        turn: state.turnNumber,
        actor: 'ai',
        action: 'draw',
        drew: { number: tile.number, color: tile.color, joker: tile.joker }
      });

      AudioManager.sfx.drawCard();
      state.phase = 'guess';
      notify();

      const drawDelay = getRandomAIDelay();
      await delay(drawDelay);
    } else {
      state.phase = 'guess';
      state.turnNumber = GameLogger.nextTurn();
    }

    // 2. AI guesses
    await aiGuessLoop();
  }

  async function aiGuessLoop() {
    let consecutiveCorrect = 0;

    while (true) {
      const thinkDelay = getRandomAIDelay();
      await delay(thinkDelay);

      const gameStateForAI = getGameStateForAI();
      const guess = AI.makeGuess({
        ...gameStateForAI,
        playerTiles: state.playerTiles.map(t => ({
          revealed: t.revealed,
          number: t.revealed ? t.number : undefined,
          color: t.revealed ? t.color : undefined,
          joker: t.revealed ? t.joker : undefined,
          // For sorting bounds
          knownValue: t.revealed ? t : undefined
        })),
        aiTiles: state.aiTiles,
        removedCards: state.removedCards,
        aiLevel: state.aiLevel
      });

      if (!guess) {
        // No valid guess
        break;
      }

      const targetTile = state.playerTiles[guess.position];
      if (!targetTile || targetTile.revealed) break;

      const isJokerGuess = guess.number === 'joker';
      let correct = false;

      if (isJokerGuess) {
        correct = targetTile.joker && targetTile.color === guess.color;
      } else {
        correct = !targetTile.joker && targetTile.number === guess.number && targetTile.color === guess.color;
      }

      GameLogger.record({
        turn: state.turnNumber,
        actor: 'ai',
        action: 'guess',
        guess: {
          position: guess.position,
          number: guess.number,
          color: guess.color
        },
        result: correct ? 'correct' : 'wrong',
        knownTiles: getRevealedTiles(),
        aiThought: guess.thought,
        probabilitySnapshot: guess.thought.probabilities || null
      });

      state.lastGuessResult = correct ? 'correct' : 'wrong';
      notify();

      const resultDelay = getRandomAIDelay();
      await delay(resultDelay);

      if (correct) {
        targetTile.revealed = true;
        consecutiveCorrect++;
        AudioManager.sfx.guessCorrect();
        notify();

        // Check win
        if (state.playerTiles.every(t => t.revealed)) {
          state.phase = 'gameover';
          state.winner = 'ai';
          AudioManager.sfx.gameLose();
          notify();
          return;
        }

        // Decide if AI continues
        const shouldCont = AI.shouldContinueGuessing(
          state.aiLevel,
          { ...gameStateForAI, playerTiles: state.playerTiles },
          consecutiveCorrect
        );

        if (!shouldCont) break;

        const decideDelay = getRandomAIDelay();
        await delay(decideDelay);
      } else {
        // Wrong — reveal AI's drawn tile
        AudioManager.sfx.guessWrong();

        if (state.drawnTile) {
          state.drawnTile.revealed = true;
          if (state.drawnTile.joker) {
            // Random placement for Joker
            const randIdx = Math.floor(Math.random() * (state.aiTiles.length + 1));
            insertJokerAt(state.aiTiles, state.drawnTile, randIdx);
          } else {
            const insertPos = findInsertPosition(state.aiTiles, state.drawnTile);
            state.aiTiles.splice(insertPos, 0, state.drawnTile);
          }
          assignJokerSortValues(state.aiTiles);
        } else {
          // No drawn card (deck was empty) — AI must reveal one of its own unrevealed cards as penalty
          const unrevealedAI = state.aiTiles
            .map((t, i) => ({ tile: t, index: i }))
            .filter(x => !x.tile.revealed);
          if (unrevealedAI.length > 0) {
            const pick = unrevealedAI[Math.floor(Math.random() * unrevealedAI.length)];
            state.aiTiles[pick.index].revealed = true;
          }
        }
        state.drawnTile = null;

        // Check if AI lost
        if (state.aiTiles.every(t => t.revealed)) {
          state.phase = 'gameover';
          state.winner = 'player';
          AudioManager.sfx.gameWin();
          notify();
          return;
        }

        notify();
        const postWrongDelay = getRandomAIDelay();
        await delay(postWrongDelay);
        break;
      }
    }

    // AI passes — place drawn tile
    if (state.drawnTile) {
      state.drawnTile.revealed = false;
      if (state.drawnTile.joker) {
        // Random placement for Joker
        const randIdx = Math.floor(Math.random() * (state.aiTiles.length + 1));
        insertJokerAt(state.aiTiles, state.drawnTile, randIdx);
      } else {
        const insertPos = findInsertPosition(state.aiTiles, state.drawnTile);
        state.aiTiles.splice(insertPos, 0, state.drawnTile);
      }
      assignJokerSortValues(state.aiTiles);
      state.drawnTile = null;
      AudioManager.sfx.cardPlace();
    }

    // Switch to player
    state.currentTurn = 'player';
    state.phase = 'draw';
    state.lastGuessResult = null;
    AudioManager.sfx.turnStart();
    notify();
  }

  // ── Timer ──
  function startTimer() {
    clearTimer();
    timerRemaining = state.timerSeconds;
    notify();

    timerInterval = setInterval(() => {
      timerRemaining--;
      notify();

      if (timerRemaining <= 5) {
        AudioManager.sfx.timerWarning();
      }

      if (timerRemaining <= 0) {
        clearTimer();
        AudioManager.sfx.timerExpired();

        GameLogger.record({
          turn: state.turnNumber,
          actor: 'player',
          action: 'timeout'
        });

        // Timeout = treat as wrong guess, reveal drawn tile
        if (state.drawnTile) {
          state.drawnTile.revealed = true;
          const insertPos = findInsertPosition(state.playerTiles, state.drawnTile);
          state.playerTiles.splice(insertPos, 0, state.drawnTile);
          assignJokerSortValues(state.playerTiles);
          state.drawnTile = null;
        }

        state.consecutiveCorrect = 0;
        endTurn();
      }
    }, 1000);
  }

  function clearTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  // ── Total Game Timer ──
  function startTotalTimer() {
    stopTotalTimer();
    totalTimerInterval = setInterval(() => {
      totalGameSeconds++;
      notify();
    }, 1000);
  }

  function stopTotalTimer() {
    if (totalTimerInterval) {
      clearInterval(totalTimerInterval);
      totalTimerInterval = null;
    }
  }

  // ── Joker Placement Timer ──
  function startJokerTimer() {
    clearJokerTimer();
    jokerTimerRemaining = 5;
    notify();

    jokerTimerInterval = setInterval(() => {
      jokerTimerRemaining--;
      notify();

      if (jokerTimerRemaining <= 0) {
        clearJokerTimer();
        autoPlaceJoker();
      }
    }, 1000);
  }

  function clearJokerTimer() {
    if (jokerTimerInterval) {
      clearInterval(jokerTimerInterval);
      jokerTimerInterval = null;
    }
  }

  function autoPlaceJoker() {
    const maxIndex = state.playerTiles.length;
    const randomIndex = Math.floor(Math.random() * (maxIndex + 1));
    placeJoker(randomIndex);
  }

  function placeJoker(index) {
    if (state.phase !== 'joker_placement') return;
    clearJokerTimer();

    const tile = state.drawnTile;
    if (!tile) return;

    tile.revealed = (state.jokerPlacementReason === 'wrong');
    
    insertJokerAt(state.playerTiles, tile, index);
    assignJokerSortValues(state.playerTiles);

    state.drawnTile = null;
    AudioManager.sfx.cardPlace();

    const reason = state.jokerPlacementReason;
    state.jokerPlacementReason = null;

    if (reason === 'wrong' && state.playerTiles.every(t => t.revealed)) {
      state.phase = 'gameover';
      state.winner = 'ai';
      stopTotalTimer();
      AudioManager.sfx.gameLose();
      notify();
      return;
    }

    state.phase = 'draw';
    endTurn();
  }

  // ── Penalty Reveal — player reveals one of their own cards when no drawn card ──
  function penaltyReveal(index) {
    if (state.phase !== 'penalty_reveal' || state.currentTurn !== 'player') return;

    const tile = state.playerTiles[index];
    if (!tile || tile.revealed) return;

    tile.revealed = true;

    // Check if player lost (all tiles revealed)
    if (state.playerTiles.every(t => t.revealed)) {
      state.phase = 'gameover';
      state.winner = 'ai';
      stopTotalTimer();
      AudioManager.sfx.gameLose();
      notify();
      return;
    }

    endTurn();
  }

  function insertJokerAt(hand, jokerTile, index) {
    let val;
    if (hand.length === 0) {
      val = 5;
    } else if (index === 0) {
      val = AI.getSortValue(hand[0]) - 0.5;
    } else if (index >= hand.length) {
      val = AI.getSortValue(hand[hand.length - 1]) + 0.5;
    } else {
      val = (AI.getSortValue(hand[index - 1]) + AI.getSortValue(hand[index])) / 2;
    }
    jokerTile.sortValue = val;
    hand.splice(index, 0, jokerTile);
  }

  // ── Helpers ──

  function delay(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  function getRevealedTiles() {
    return [
      ...state.playerTiles.filter(t => t.revealed).map(t => ({ ...t, owner: 'player' })),
      ...state.aiTiles.filter(t => t.revealed).map(t => ({ ...t, owner: 'ai' }))
    ];
  }

  function calculateOptimalGuess(opponentTiles, remaining) {
    // Find the position with fewest possibilities
    let bestPos = -1;
    let bestCount = Infinity;
    let bestOptions = null;

    opponentTiles.forEach((tile, i) => {
      if (tile.revealed) return;
      const possible = AI.getPossibleValues(i, opponentTiles, [], remaining);
      if (possible.length < bestCount && possible.length > 0) {
        bestCount = possible.length;
        bestPos = i;
        bestOptions = possible;
      }
    });

    return bestPos >= 0 ? {
      position: bestPos,
      optionCount: bestCount,
      options: bestOptions,
      isCertain: bestCount === 1
    } : null;
  }

  function calculateProbabilitySnapshot(opponentTiles, remaining) {
    const snapshot = {};
    opponentTiles.forEach((tile, i) => {
      if (tile.revealed) return;
      const possible = AI.getPossibleValues(i, opponentTiles, [], remaining);
      snapshot[i] = possible.map(v => ({
        ...v,
        probability: 1 / possible.length
      }));
    });
    return snapshot;
  }

  function notify() {
    if (onStateChange) {
      onStateChange({
        ...state,
        timerRemaining,
        timerTotal: state ? state.timerSeconds : 0,
        jokerTimerRemaining,
        jokerTimerTotal: 5,
        totalGameSeconds
      });
    }
  }

  // ── Public API ──
  return {
    init,
    playerDraw,
    playerGuess,
    playerContinue,
    playerPass,
    placeJoker,
    penaltyReveal,
    getFullState,
    getRevealedTiles: () => state ? getRevealedTiles() : [],

    onStateChange(callback) {
      onStateChange = callback;
    },

    getState() {
      return state ? { ...state, timerRemaining, totalGameSeconds, jokerTimerRemaining } : null;
    },

    isGameOver() {
      return state && state.phase === 'gameover';
    },

    getWinner() {
      return state ? state.winner : null;
    },

    destroy() {
      clearTimer();
      stopTotalTimer();
      clearJokerTimer();
      state = null;
    }
  };
})();
