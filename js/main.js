// ═══════════════════════════════════════════════════════════
// MAIN — App initialization, event binding, screen wiring
// ═══════════════════════════════════════════════════════════

(function() {
  'use strict';

  // ── Wait for DOM ──
  document.addEventListener('DOMContentLoaded', () => {
    init();
  });

  function init() {
    // Initialize starfield background
    UI.initStarfield();

    // Load global settings
    const settings = GlobalSettings.load();
    document.getElementById('sfx-toggle').checked = settings.sfxEnabled;
    document.getElementById('bgm-toggle').checked = settings.bgmEnabled;

    // Bind all event listeners
    bindLandingEvents();
    bindSettingsModalEvents();
    bindGameSetupEvents();
    bindTutorialEvents();
    bindGameEvents();
    bindResultEvents();
    bindXAIEvents();
    bindDebugPanel();

    // Apply audio settings
    GlobalSettings.apply();

    // Initialize Lucide icons
    if (window.lucide) {
      window.lucide.createIcons();
    }

    // Check for saved session recovery
    checkSessionRecovery();
  }

  // ═══ Landing Page ═══
  function bindLandingEvents() {
    document.getElementById('btn-new-game').addEventListener('click', () => {
      AudioManager.unlock();
      AudioManager.sfx.buttonClick();
      UI.showScreen('game-setup');
    });

    document.getElementById('btn-tutorial').addEventListener('click', () => {
      AudioManager.unlock();
      AudioManager.sfx.buttonClick();
      Tutorial.init();
      UI.showScreen('tutorial');
    });
  }

  // ═══ Global Settings Modal ═══
  function bindSettingsModalEvents() {
    const modal = document.getElementById('settings-modal');

    document.getElementById('global-settings-btn').addEventListener('click', () => {
      AudioManager.unlock();
      modal.classList.add('active');
    });

    document.getElementById('settings-close-btn').addEventListener('click', () => {
      AudioManager.sfx.buttonClick();
      modal.classList.remove('active');
    });

    // Close on overlay click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });

    // SFX toggle
    document.getElementById('sfx-toggle').addEventListener('change', (e) => {
      GlobalSettings.setSFX(e.target.checked);
      if (e.target.checked) AudioManager.sfx.buttonClick();
    });

    // BGM toggle
    document.getElementById('bgm-toggle').addEventListener('change', (e) => {
      AudioManager.unlock();
      GlobalSettings.setBGM(e.target.checked);
    });
  }

  // ═══ Game Setup ═══
  function bindGameSetupEvents() {
    // AI Level selection
    document.querySelectorAll('.ai-option').forEach(option => {
      option.addEventListener('click', () => {
        AudioManager.sfx.buttonClick();
        document.querySelectorAll('.ai-option').forEach(o => o.classList.remove('selected'));
        option.classList.add('selected');
        GameSetup.setAILevel(option.dataset.level);
      });
    });

    // Timer toggle
    const timerToggle = document.getElementById('timer-toggle');
    const timerContainer = document.getElementById('timer-slider-container');
    const timerSlider = document.getElementById('timer-slider');
    const timerValue = document.getElementById('timer-value');

    timerToggle.addEventListener('change', () => {
      GameSetup.setTimerEnabled(timerToggle.checked);
      timerContainer.classList.toggle('enabled', timerToggle.checked);
    });

    timerSlider.addEventListener('input', () => {
      const val = timerSlider.value;
      timerValue.textContent = val + 's';
      GameSetup.setTimerSeconds(val);
    });

    // Card Removal selection
    document.querySelectorAll('.removal-option').forEach(option => {
      option.addEventListener('click', () => {
        AudioManager.sfx.buttonClick();
        document.querySelectorAll('.removal-option').forEach(o => o.classList.remove('selected'));
        option.classList.add('selected');
        GameSetup.setCardRemoval(parseInt(option.dataset.count));
      });
    });

    // Start Game button
    document.getElementById('btn-start-game').addEventListener('click', () => {
      AudioManager.sfx.buttonClick();
      startNewGame();
    });

    // Back button
    document.getElementById('btn-back-to-landing').addEventListener('click', () => {
      AudioManager.sfx.buttonClick();
      UI.showScreen('landing');
    });
  }

  // ═══ Start New Game ═══
  function startNewGame() {
    const config = GameSetup.get();

    // Show game screen and clear log first so background is visible
    UI.showScreen('game');
    UI.clearLog();

    // Trigger holographic countdown overlay before actual gameplay starts
    UI.showCountdown(() => {
      // Initialize game
      Game.init(config);

      // Track logged events to avoid duplicate AI log entries
      let lastLoggedEventCount = 0;
      // Track last state for session-save diffing (avoid saving on timer-only ticks)
      let lastSavedPhase = null;
      let lastSavedTurn = null;
      let lastSavedDeckLen = -1;

      // Set up state change listener
      Game.onStateChange((gameState) => {
        UI.renderGameState(gameState);

        // Auto-show result on game over
        if (gameState.phase === 'gameover') {
          clearSession();
          setTimeout(() => {
            UI.renderGameState(gameState);
          }, 500);
        }

        // Log new guess entries (both player and AI) from the logger
        const fullLog = GameLogger.getLog();
        for (let i = lastLoggedEventCount; i < fullLog.length; i++) {
          const entry = fullLog[i];
          if (entry.action === 'guess') {
            UI.addLogEntry(entry.actor, entry.guess.position, entry.guess.number, entry.guess.color, entry.result === 'correct');
          }
        }
        lastLoggedEventCount = fullLog.length;

        // Save session on important state changes (not timer-only ticks)
        if (
          gameState.phase !== lastSavedPhase ||
          gameState.currentTurn !== lastSavedTurn ||
          gameState.deck.length !== lastSavedDeckLen
        ) {
          lastSavedPhase = gameState.phase;
          lastSavedTurn = gameState.currentTurn;
          lastSavedDeckLen = gameState.deck.length;
          if (gameState.phase !== 'gameover') {
            saveSession(gameState, config);
          }
        }
      });

      // Start BGM
      if (GlobalSettings.get().bgmEnabled) {
        AudioManager.startBGM();
      }
    });
  }

  // ── Card Draw Overlay ──
  function showDrawOverlay(tile) {
    const overlay = document.getElementById('draw-overlay');
    const container = document.getElementById('draw-overlay-card-container');
    const confirmBtn = document.getElementById('btn-draw-confirm');
    if (!overlay || !container || !confirmBtn) return;

    container.innerHTML = '';
    
    const tileEl = document.createElement('div');
    tileEl.className = `tile ${tile.joker ? 'joker ' + tile.color : tile.color}`;
    
    const inner = document.createElement('div');
    inner.className = 'tile-inner flipped';
    
    const front = document.createElement('div');
    front.className = 'tile-front';
    front.textContent = tile.joker ? '★' : tile.number;
    
    const back = document.createElement('div');
    back.className = 'tile-back';
    
    inner.appendChild(front);
    inner.appendChild(back);
    tileEl.appendChild(inner);
    container.appendChild(tileEl);

    overlay.classList.remove('hidden');
    overlay.getBoundingClientRect();
    overlay.classList.add('active');

    // Hide confirm button — auto-dismiss handles it
    confirmBtn.style.display = 'none';

    let autoDismissTimer = null;

    const handleConfirm = () => {
      // Clear auto-dismiss if user somehow triggers early
      if (autoDismissTimer) {
        clearTimeout(autoDismissTimer);
        autoDismissTimer = null;
      }

      AudioManager.sfx.buttonClick();
      
      const fromRect = tileEl.getBoundingClientRect();
      
      overlay.classList.remove('active');
      overlay.classList.add('hidden');
      confirmBtn.style.display = '';
      
      // Place the card in the game state (automatically renders)
      const gameState = Game.getState();
      UI.renderGameState(gameState);
      
      const targetArea = document.getElementById('player-drawn-card-area');
      const targetEl = targetArea ? targetArea.querySelector('.tile') : null;
      
      if (targetEl) {
        const toRect = targetEl.getBoundingClientRect();
        
        // Clone for floating animation
        const clone = tileEl.cloneNode(true);
        clone.style.position = 'fixed';
        clone.style.top = fromRect.top + 'px';
        clone.style.left = fromRect.left + 'px';
        clone.style.width = fromRect.width + 'px';
        clone.style.height = fromRect.height + 'px';
        clone.style.margin = '0';
        clone.style.zIndex = '9999';
        clone.style.transition = 'all 0.6s cubic-bezier(0.25, 0.8, 0.25, 1)';
        
        document.body.appendChild(clone);
        targetEl.style.visibility = 'hidden';
        
        clone.getBoundingClientRect();
        
        clone.style.top = toRect.top + 'px';
        clone.style.left = toRect.left + 'px';
        clone.style.width = toRect.width + 'px';
        clone.style.height = toRect.height + 'px';
        
        clone.addEventListener('transitionend', () => {
          clone.remove();
          targetEl.style.visibility = 'visible';
        }, { once: true });
      }
      
      confirmBtn.removeEventListener('click', handleConfirm);
    };

    confirmBtn.addEventListener('click', handleConfirm);

    // Auto-dismiss after 1.2 seconds
    autoDismissTimer = setTimeout(() => {
      autoDismissTimer = null;
      handleConfirm();
    }, 1200);
  }

  // ═══ Game Board Events ═══
  function bindGameEvents() {
    // Deck click to draw
    document.getElementById('deck-pile').addEventListener('click', () => {
      const state = Game.getState();
      if (state && state.currentTurn === 'player' && state.phase === 'draw' && state.deck.length > 0) {
        AudioManager.sfx.buttonClick();
        
        // Player draws
        const success = Game.playerDraw();
        if (success) {
          const newState = Game.getState();
          const drawnTile = newState.drawnTile;
          if (drawnTile) {
            showDrawOverlay(drawnTile);
          }
        }
      }
    });

    // Surrender button click
    const surrenderBtn = document.getElementById('btn-surrender');
    const exitModal = document.getElementById('exit-modal');
    
    if (surrenderBtn && exitModal) {
      surrenderBtn.addEventListener('click', () => {
        AudioManager.sfx.buttonClick();
        exitModal.classList.add('active');
      });
    }

    // Modal Exit Confirm/Cancel
    const btnExitConfirm = document.getElementById('btn-exit-confirm');
    const btnExitCancel = document.getElementById('btn-exit-cancel');

    if (btnExitConfirm) {
      btnExitConfirm.addEventListener('click', () => {
        AudioManager.sfx.buttonClick();
        exitModal.classList.remove('active');
        AudioManager.stopBGM();
        Game.destroy();
        clearSession();
        UI.showScreen('landing');
      });
    }

    if (btnExitCancel) {
      btnExitCancel.addEventListener('click', () => {
        AudioManager.sfx.buttonClick();
        exitModal.classList.remove('active');
      });
    }
  }

  // ═══ Tutorial Events ═══
  function bindTutorialEvents() {
    document.getElementById('btn-tutorial-next').addEventListener('click', () => {
      Tutorial.nextStep();
    });

    document.getElementById('btn-tutorial-prev').addEventListener('click', () => {
      Tutorial.prevStep();
    });

    document.getElementById('btn-tutorial-back').addEventListener('click', () => {
      AudioManager.sfx.buttonClick();
      UI.showScreen('landing');
    });
  }

  // ═══ Result Screen Events ═══
  function bindResultEvents() {
    document.getElementById('btn-play-again').addEventListener('click', () => {
      AudioManager.sfx.buttonClick();
      AudioManager.stopBGM();
      Game.destroy();
      clearSession();
      UI.showScreen('game-setup');
    });

    document.getElementById('btn-back-home').addEventListener('click', () => {
      AudioManager.sfx.buttonClick();
      AudioManager.stopBGM();
      Game.destroy();
      clearSession();
      UI.showScreen('landing');
    });

    document.getElementById('btn-xai-replay').addEventListener('click', () => {
      AudioManager.sfx.buttonClick();
      XAIReplay.init();
      UI.showScreen('xai');
    });
  }

  // ═══ XAI Replay Events ═══
  function bindXAIEvents() {
    document.getElementById('btn-xai-prev').addEventListener('click', () => {
      XAIReplay.prevTurn();
    });

    document.getElementById('btn-xai-next').addEventListener('click', () => {
      XAIReplay.nextTurn();
    });

    document.getElementById('btn-xai-back').addEventListener('click', () => {
      AudioManager.sfx.buttonClick();
      UI.showScreen('result');
    });
  }

  // ═══ Session Save / Recovery ═══
  function saveSession(gameState, config) {
    try {
      const sessionData = {
        schemaVersion: 1,
        config: config,
        gameState: gameState,
        savedAt: Date.now()
      };
      localStorage.setItem('davinci_session', JSON.stringify(sessionData));
    } catch (e) {
      // Storage full or unavailable — silently ignore
    }
  }

  function clearSession() {
    try {
      localStorage.removeItem('davinci_session');
    } catch (e) {
      // Ignore
    }
  }

  function checkSessionRecovery() {
    try {
      const raw = localStorage.getItem('davinci_session');
      if (!raw) return;

      const session = JSON.parse(raw);
      if (!session || session.schemaVersion !== 1 || !session.config || !session.gameState) {
        clearSession();
        return;
      }

      // Don't offer recovery for finished games
      if (session.gameState.phase === 'gameover') {
        clearSession();
        return;
      }

      // Show recovery overlay
      showRecoveryDialog(session);
    } catch (e) {
      clearSession();
    }
  }

  function showRecoveryDialog(session) {
    const overlay = document.createElement('div');
    overlay.id = 'session-recovery-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:10000;';

    const panel = document.createElement('div');
    panel.style.cssText = 'background:#1a1a2e;border:1px solid rgba(0,229,255,0.3);border-radius:12px;padding:24px 32px;max-width:360px;text-align:center;color:#e0e0e0;font-family:inherit;';

    const title = document.createElement('div');
    title.textContent = '🚀 พบเซสชันที่ค้างอยู่';
    title.style.cssText = 'font-size:1.1rem;font-weight:bold;margin-bottom:8px;color:#00e5ff;';

    const desc = document.createElement('div');
    const savedDate = new Date(session.savedAt);
    desc.textContent = `บันทึกเมื่อ ${savedDate.toLocaleString('th-TH')}`;
    desc.style.cssText = 'font-size:0.85rem;margin-bottom:16px;color:#aaa;';

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:12px;justify-content:center;';

    const resumeBtn = document.createElement('button');
    resumeBtn.className = 'btn btn-primary btn-3d-yellow btn-sm';
    resumeBtn.textContent = '▶ เล่นต่อ';
    resumeBtn.addEventListener('click', () => {
      overlay.remove();
      // Resume the game with saved config
      startNewGame();
    });

    const discardBtn = document.createElement('button');
    discardBtn.className = 'btn btn-secondary btn-3d-orange btn-sm';
    discardBtn.textContent = '✕ เริ่มใหม่';
    discardBtn.addEventListener('click', () => {
      clearSession();
      overlay.remove();
    });

    btnRow.appendChild(resumeBtn);
    btnRow.appendChild(discardBtn);
    panel.appendChild(title);
    panel.appendChild(desc);
    panel.appendChild(btnRow);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
  }

  // ═══ Developer Debug Panel ═══
  let debugClickTimes = [];
  let debugPanelVisible = false;

  function bindDebugPanel() {
    // Track clicks on the cockpit header title
    const titleEl = document.querySelector('.cockpit-header .cockpit-title') ||
                    document.querySelector('.cockpit-title') ||
                    document.getElementById('cockpit-title');
    if (!titleEl) return;

    titleEl.addEventListener('click', () => {
      const now = Date.now();
      debugClickTimes.push(now);
      // Keep only clicks within last 3 seconds
      debugClickTimes = debugClickTimes.filter(t => now - t <= 3000);
      if (debugClickTimes.length >= 5) {
        debugClickTimes = [];
        toggleDebugPanel();
      }
    });
  }

  function toggleDebugPanel() {
    let panel = document.getElementById('debug-panel');

    if (panel) {
      debugPanelVisible = !debugPanelVisible;
      panel.style.display = debugPanelVisible ? 'flex' : 'none';
      return;
    }

    // Create debug panel
    debugPanelVisible = true;
    panel = document.createElement('div');
    panel.id = 'debug-panel';
    panel.className = 'debug-panel';
    panel.style.cssText = 'position:fixed;bottom:0;left:0;width:100%;background:rgba(0,0,0,0.88);color:#0f0;font-family:monospace;font-size:13px;padding:10px 16px;display:flex;gap:12px;align-items:center;z-index:9999;border-top:1px solid rgba(0,255,0,0.3);';

    const label = document.createElement('span');
    label.textContent = '🛠 DEBUG';
    label.style.cssText = 'color:#ff0;font-weight:bold;margin-right:8px;';
    panel.appendChild(label);

    // [Toggle X-Ray] — show/hide AI card numbers
    const xrayBtn = document.createElement('button');
    xrayBtn.textContent = '[Toggle X-Ray]';
    xrayBtn.style.cssText = 'background:none;border:1px solid #0f0;color:#0f0;font-family:monospace;padding:4px 8px;cursor:pointer;border-radius:4px;';
    let xrayOn = false;
    xrayBtn.addEventListener('click', () => {
      xrayOn = !xrayOn;
      const aiCards = document.querySelectorAll('#ai-cards .tile');
      aiCards.forEach(card => {
        const inner = card.querySelector('.tile-inner');
        if (inner) {
          if (xrayOn) {
            inner.classList.add('flipped');
            card.style.opacity = '0.85';
          } else {
            // Only un-flip if not revealed
            if (!card.classList.contains('revealed')) {
              inner.classList.remove('flipped');
            }
            card.style.opacity = '';
          }
        }
      });
    });
    panel.appendChild(xrayBtn);

    // [Drain Deck]
    const drainBtn = document.createElement('button');
    drainBtn.textContent = '[Drain Deck]';
    drainBtn.style.cssText = 'background:none;border:1px solid #0f0;color:#0f0;font-family:monospace;padding:4px 8px;cursor:pointer;border-radius:4px;';
    drainBtn.addEventListener('click', () => {
      const st = Game.getState();
      if (st && st.deck) {
        st.deck.length = 0;
        const current = Game.getState();
        if (current) UI.renderGameState(current);
      }
    });
    panel.appendChild(drainBtn);

    // [Skip Turn]
    const skipBtn = document.createElement('button');
    skipBtn.textContent = '[Skip Turn]';
    skipBtn.style.cssText = 'background:none;border:1px solid #0f0;color:#0f0;font-family:monospace;padding:4px 8px;cursor:pointer;border-radius:4px;';
    skipBtn.addEventListener('click', () => {
      const st = Game.getState();
      if (st && st.currentTurn === 'player') {
        Game.playerPass();
      }
    });
    panel.appendChild(skipBtn);

    document.body.appendChild(panel);
  }

})();
