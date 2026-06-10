// ═══════════════════════════════════════════════════════════
// UI MODULE — DOM rendering, animations, game board display
// ═══════════════════════════════════════════════════════════

const UI = (() => {

  let lastState = null;

  // ── Screen Navigation ──
  function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const screen = document.getElementById(`${screenId}-screen`);
    if (screen) screen.classList.add('active');
    
    // Initialize landing mascots when navigating to landing
    if (screenId === 'landing') {
      initLandingMascots();
    }
    
    // Compile icons
    setTimeout(() => {
      if (window.lucide) {
        window.lucide.createIcons();
      }
    }, 50);
  }

  // ── Landing Page Mascots ──
  function initLandingMascots() {
    const alienEl = document.getElementById('landing-alien-mascot');
    const astroEl = document.getElementById('landing-astronaut-mascot');
    if (alienEl) alienEl.innerHTML = getAlienSVG('happy');
    if (astroEl) astroEl.innerHTML = getAstronautSVG();
  }

  // ── Starfield ──
  function initStarfield() {
    const starfield = document.getElementById('starfield');
    if (!starfield) return;
    starfield.innerHTML = '';

    const count = Math.min(120, Math.floor(window.innerWidth * window.innerHeight / 6000));

    for (let i = 0; i < count; i++) {
      const star = document.createElement('div');
      star.className = 'star';
      const size = Math.random() * 2.5 + 0.5;
      star.style.width = size + 'px';
      star.style.height = size + 'px';
      star.style.left = Math.random() * 100 + '%';
      star.style.top = Math.random() * 100 + '%';
      star.style.setProperty('--duration', (Math.random() * 4 + 2) + 's');
      star.style.setProperty('--max-opacity', (Math.random() * 0.6 + 0.2).toFixed(2));
      star.style.animationDelay = (Math.random() * 5) + 's';
      starfield.appendChild(star);
    }

    // Occasional shooting stars
    setInterval(() => {
      if (Math.random() > 0.7) {
        const shootingStar = document.createElement('div');
        shootingStar.className = 'shooting-star';
        shootingStar.style.left = Math.random() * 70 + '%';
        shootingStar.style.top = Math.random() * 50 + '%';
        starfield.appendChild(shootingStar);
        setTimeout(() => shootingStar.remove(), 1600);
      }
    }, 3000);
  }

  // ── Card Insertion FLIP Animation ──
  function animateCardInsertion(fromEl, toEl, callback) {
    if (!fromEl || !toEl) {
      if (callback) callback();
      return;
    }
    const fromRect = fromEl.getBoundingClientRect();
    const toRect = toEl.getBoundingClientRect();

    const clone = fromEl.cloneNode(true);
    clone.style.position = 'fixed';
    clone.style.top = fromRect.top + 'px';
    clone.style.left = fromRect.left + 'px';
    clone.style.width = fromRect.width + 'px';
    clone.style.height = fromRect.height + 'px';
    clone.style.margin = '0';
    clone.style.zIndex = '9999';
    clone.style.transition = 'all 0.6s cubic-bezier(0.25, 0.8, 0.25, 1)';
    
    const inner = clone.querySelector('.tile-inner');
    if (inner) {
      inner.style.transition = 'none'; // prevent reflipping mid-flight
    }

    document.body.appendChild(clone);

    fromEl.style.visibility = 'hidden';
    toEl.style.visibility = 'hidden';

    // Force reflow
    clone.getBoundingClientRect();

    clone.style.top = toRect.top + 'px';
    clone.style.left = toRect.left + 'px';
    clone.style.width = toRect.width + 'px';
    clone.style.height = toRect.height + 'px';
    
    if (inner && fromEl.classList.contains('revealed') !== toEl.classList.contains('revealed')) {
      inner.classList.add('flipped');
    }

    clone.addEventListener('transitionend', () => {
      clone.remove();
      fromEl.style.visibility = 'visible';
      toEl.style.visibility = 'visible';
      if (callback) callback();
    }, { once: true });
  }

  // ── Timer-Only Tick Detection ──
  function isOnlyTimerTick(oldState, newState) {
    // Compare all important fields; if only timer fields changed, return true
    if (oldState.phase !== newState.phase) return false;
    if (oldState.currentTurn !== newState.currentTurn) return false;
    if (oldState.winner !== newState.winner) return false;
    if (oldState.lastGuessResult !== newState.lastGuessResult) return false;
    if (oldState.consecutiveCorrect !== newState.consecutiveCorrect) return false;
    if (oldState.turnNumber !== newState.turnNumber) return false;

    // Drawn tile presence changed
    const oldHasDrawn = !!oldState.drawnTile;
    const newHasDrawn = !!newState.drawnTile;
    if (oldHasDrawn !== newHasDrawn) return false;
    if (oldHasDrawn && newHasDrawn && oldState.drawnTile.id !== newState.drawnTile.id) return false;

    // Tile counts changed (draw/reveal)
    if (oldState.playerTiles.length !== newState.playerTiles.length) return false;
    if (oldState.aiTiles.length !== newState.aiTiles.length) return false;
    if (oldState.deck.length !== newState.deck.length) return false;

    // Check revealed status changes
    for (let i = 0; i < newState.playerTiles.length; i++) {
      if (oldState.playerTiles[i].revealed !== newState.playerTiles[i].revealed) return false;
    }
    for (let i = 0; i < newState.aiTiles.length; i++) {
      if (oldState.aiTiles[i].revealed !== newState.aiTiles[i].revealed) return false;
    }

    // If we got here, only timer fields (totalGameSeconds, timerRemaining, jokerTimerRemaining) differ
    return true;
  }

  // ── Render Game Board ──
  function renderGameState(gameState) {
    // Check if player tile was just inserted
    const prevDrawn = lastState && lastState.drawnTile;
    const currentDrawn = gameState.drawnTile;
    
    if (prevDrawn && !currentDrawn && lastState.currentTurn === 'player') {
      const targetIndex = gameState.playerTiles.findIndex(t => t.id === prevDrawn.id);
      if (targetIndex >= 0) {
        renderAICards(gameState);
        renderPlayerCards(gameState, { hideIndex: targetIndex });
        renderDeck(gameState);
        renderTurnIndicator(gameState);
        renderTimer(gameState);
        renderActionPanel(gameState);
        renderConsoleCenterControls(gameState);
        renderTotalGameTimer(gameState);
        renderMascots(gameState);
        
        const oldDrawnEl = renderDrawnCard(prevDrawn, lastState);
        const targetEl = document.querySelector(`#player-cards .tile[data-index="${targetIndex}"]`);
        
        if (oldDrawnEl && targetEl) {
          animateCardInsertion(oldDrawnEl, targetEl, () => {
            renderPlayerCards(gameState);
            lastState = JSON.parse(JSON.stringify(gameState));
          });
          return;
        }
      }
    }

    // Fast path: if only timer fields changed, skip full re-render
    if (lastState && isOnlyTimerTick(lastState, gameState)) {
      renderTotalGameTimer(gameState);
      renderTimer(gameState);
      if (gameState.phase === 'joker_placement') {
        renderConsoleCenterControls(gameState);
      }
      lastState = JSON.parse(JSON.stringify(gameState));
      return;
    }

    renderAICards(gameState);
    renderPlayerCards(gameState);
    renderDeck(gameState);
    renderTurnIndicator(gameState);
    renderTimer(gameState);
    renderActionPanel(gameState);
    renderConsoleCenterControls(gameState);
    renderTotalGameTimer(gameState);
    renderMascots(gameState);

    lastState = JSON.parse(JSON.stringify(gameState));

    // Refresh Lucide Icons for dynamic content
    setTimeout(() => {
      if (window.lucide) {
        window.lucide.createIcons();
      }
    }, 20);
  }

  function renderTotalGameTimer(gameState) {
    const el = document.getElementById('total-game-timer');
    if (!el) return;
    const secs = gameState.totalGameSeconds || 0;
    const mm = String(Math.floor(secs / 60)).padStart(2, '0');
    const ss = String(secs % 60).padStart(2, '0');
    el.textContent = `${mm}:${ss}`;
  }

  function getCardLayout(isJokerPlacement = false) {
    const screenWidth = window.innerWidth;
    let cardWidth = 58;
    let gap = 10;

    if (screenWidth <= 380) {
      cardWidth = 36;
      gap = isJokerPlacement ? 16 : 6;
    } else if (screenWidth <= 480) {
      cardWidth = 42;
      gap = isJokerPlacement ? 20 : 6;
    } else if (screenWidth <= 768) {
      cardWidth = 48;
      gap = isJokerPlacement ? 24 : 8;
    } else {
      gap = isJokerPlacement ? 34 : 10;
    }

    return { cardWidth, gap };
  }

  function renderAICards(gameState) {
    const container = document.getElementById('ai-cards');
    if (!container) return;
    container.innerHTML = '';

    const { cardWidth, gap } = getCardLayout();
    const N = gameState.aiTiles.length;
    const S = cardWidth + gap;

    gameState.aiTiles.forEach((tile, i) => {
      const el = createTileElement(tile, i, 'ai', gameState);
      const offset = (i - (N - 1) / 2) * S - cardWidth / 2;
      el.style.left = `calc(50% + ${offset}px)`;
      container.appendChild(el);
    });
  }

  function renderPlayerCards(gameState, options = {}) {
    const container = document.getElementById('player-cards');
    if (!container) return;
    container.innerHTML = '';

    const isJokerPlacement = gameState.phase === 'joker_placement';
    const { cardWidth, gap } = getCardLayout(isJokerPlacement);
    const N = gameState.playerTiles.length;
    const S = cardWidth + gap;

    gameState.playerTiles.forEach((tile, i) => {
      const el = createTileElement(tile, i, 'player', gameState);
      const center = (i - (N - 1) / 2) * S;
      const offset = center - cardWidth / 2;
      el.style.left = `calc(50% + ${offset}px)`;
      
      if (options.hideIndex === i) {
        el.style.visibility = 'hidden';
      }
      container.appendChild(el);
    });

    // Render drop zones for Joker placement
    if (isJokerPlacement) {
      const dzWidth = Math.round(cardWidth * 0.5);
      const firstCardCenter = (0 - (N - 1) / 2) * S;
      
      for (let i = 0; i <= N; i++) {
        const dzCenter = firstCardCenter + i * S - S / 2;
        const dzOffset = dzCenter - dzWidth / 2;
        
        const dz = document.createElement('div');
        dz.className = 'joker-drop-zone';
        dz.style.width = dzWidth + 'px';
        dz.style.height = Math.round(cardWidth * 84 / 58) + 'px';
        dz.style.left = `calc(50% + ${dzOffset}px)`;
        dz.dataset.index = i;
        
        dz.addEventListener('click', () => {
          Game.placeJoker(i);
        });
        
        container.appendChild(dz);
      }
    }

    // Handle drawn card area
    const drawnArea = document.getElementById('player-drawn-card-area');
    if (drawnArea) {
      drawnArea.innerHTML = '';
      if (gameState.drawnTile && gameState.currentTurn === 'player' && !isJokerPlacement) {
        drawnArea.classList.add('has-card');
        const drawnEl = createTileElement(gameState.drawnTile, 0, 'player_drawn', gameState);
        drawnArea.appendChild(drawnEl);
      } else {
        drawnArea.classList.remove('has-card');
      }
    }
  }

  function renderDrawnCard(tile, gameState) {
    const drawnArea = document.getElementById('player-drawn-card-area');
    if (!drawnArea) return null;
    drawnArea.innerHTML = '';
    drawnArea.classList.add('has-card');
    const drawnEl = createTileElement(tile, 0, 'player_drawn', gameState);
    drawnArea.appendChild(drawnEl);
    return drawnEl;
  }

  function createTileElement(tile, index, owner, gameState) {
    const el = document.createElement('div');
    el.className = 'tile';
    el.dataset.index = index;
    el.dataset.owner = owner;

    // Apply layout sizes dynamically
    const { cardWidth } = getCardLayout(gameState ? gameState.phase === 'joker_placement' : false);
    el.style.width = cardWidth + 'px';
    el.style.height = Math.round(cardWidth * 84 / 58) + 'px';

    // Determine card type class
    if (tile.joker) {
      el.classList.add('joker');
      el.classList.add(tile.color); // black or white Joker
    } else if (tile.color === 'black') {
      el.classList.add('black');
    } else {
      el.classList.add('white');
    }

    const inner = document.createElement('div');
    inner.className = 'tile-inner';

    const front = document.createElement('div');
    front.className = 'tile-front';
    front.textContent = tile.joker ? '★' : tile.number;

    // Player cards secret/revealed indicators
    if (owner === 'player') {
      const statusIndicator = document.createElement('div');
      statusIndicator.className = tile.revealed ? 'player-card-status revealed' : 'player-card-status secret';
      statusIndicator.innerHTML = tile.revealed ? '<i data-lucide="eye"></i>' : '<i data-lucide="lock"></i>';
      front.appendChild(statusIndicator);
      
      if (tile.revealed) {
        el.classList.add('revealed-to-opp');
      } else {
        el.classList.add('secret-to-opp');
      }
    }

    const back = document.createElement('div');
    back.className = 'tile-back';

    inner.appendChild(front);
    inner.appendChild(back);
    el.appendChild(inner);

    // Show/hide logic
    if (tile.revealed) {
      inner.classList.add('flipped');
      el.classList.add('revealed');
    } else if (owner === 'player' || owner === 'player_drawn') {
      inner.classList.add('flipped');
    }

    // AI cards selectable during player guess phase
    if (owner === 'ai' && !tile.revealed && gameState && gameState.currentTurn === 'player' && gameState.phase === 'guess') {
      el.classList.add('selectable');
      el.addEventListener('click', () => {
        showGuessPanel(index);
      });
    }

    return el;
  }

  function renderDeck(gameState) {
    const deckCount = document.getElementById('deck-count');
    const deckPile = document.getElementById('deck-pile');

    if (deckCount) deckCount.textContent = gameState.deck.length;

    if (deckPile) {
      deckPile.classList.toggle('empty', gameState.deck.length === 0);
    }
  }

  function renderTurnIndicator(gameState) {
    const indicator = document.getElementById('turn-indicator');
    const turnNumEl = document.getElementById('game-turn-number');
    const aiDiffText = document.getElementById('ai-difficulty-text');
    const aiDiffIcon = document.getElementById('ai-difficulty-icon');
    const aiStarsRow = document.getElementById('ai-stars-row');

    if (turnNumEl) {
      turnNumEl.textContent = String(gameState.turnNumber || 1).padStart(2, '0');
    }

    if (aiDiffText && aiStarsRow) {
      let levelText = 'ระดับง่าย';
      let stars = 1;
      let iconName = 'smile';
      
      if (gameState.aiLevel === 'medium') {
        levelText = 'ระดับกลาง';
        stars = 2;
        iconName = 'brain';
      } else if (gameState.aiLevel === 'hard') {
        levelText = 'ระดับยาก';
        stars = 3;
        iconName = 'bot';
      }
      
      aiDiffText.textContent = levelText;
      if (aiDiffIcon) {
        aiDiffIcon.innerHTML = `<i data-lucide="${iconName}"></i>`;
      }
      
      aiStarsRow.innerHTML = '';
      for (let i = 1; i <= 3; i++) {
        const star = document.createElement('i');
        star.setAttribute('data-lucide', 'star');
        star.className = `star-icon ${i <= stars ? 'active' : ''}`;
        aiStarsRow.appendChild(star);
      }
    }

    if (!indicator) return;

    indicator.classList.remove('player-turn', 'ai-turn');

    if (gameState.phase === 'gameover') {
      indicator.textContent = gameState.winner === 'player' ? 'คุณชนะ! 🎉' : 'AI ชนะ! 💀';
      indicator.classList.add(gameState.winner === 'player' ? 'player-turn' : 'ai-turn');
    } else if (gameState.currentTurn === 'player') {
      indicator.classList.add('player-turn');
      switch (gameState.phase) {
        case 'draw': indicator.textContent = 'ดึงการ์ดกองกลาง'; break;
        case 'guess': indicator.textContent = 'เลือกการ์ด AI แล้วทาย'; break;
        case 'decide': indicator.textContent = 'ทายถูก! ทายต่อหรือหยุด'; break;
      }
    } else {
      indicator.classList.add('ai-turn');
      indicator.textContent = 'AI กำลังคิด...';
    }
  }

  function renderTimer(gameState) {
    const section = document.getElementById('timer-bar-section');
    const bar = document.getElementById('timer-bar');
    const text = document.getElementById('timer-text');

    if (!section || !bar || !text) return;

    if (!gameState.timerEnabled) {
      section.classList.add('hidden');
      return;
    }

    section.classList.remove('hidden');

    if (gameState.currentTurn === 'player' && (gameState.phase === 'guess' || gameState.phase === 'decide')) {
      const percent = (gameState.timerRemaining / gameState.timerTotal) * 100;
      bar.style.width = percent + '%';

      bar.classList.remove('warning', 'danger');
      if (percent <= 20) {
        bar.classList.add('danger');
      } else if (percent <= 50) {
        bar.classList.add('warning');
      }

      text.textContent = `${gameState.timerRemaining} วินาที`;
    } else {
      bar.style.width = '100%';
      bar.classList.remove('warning', 'danger');
      text.textContent = '';
    }
  }

  function renderActionPanel(gameState) {
    const panel = document.getElementById('action-panel');
    const actionText = document.getElementById('action-text');
    if (!panel || !actionText) return;

    panel.innerHTML = '';

    if (gameState.phase === 'gameover') {
      const text = document.createElement('div');
      text.className = 'action-text';
      text.textContent = gameState.winner === 'player' ? '🎉 ยินดีด้วย! คุณกู้คืนรหัสลับสำเร็จแล้ว!' : '💀 ห้องควบคุมเสียหาย! AI เป็นฝ่ายชนะรอบนี้';
      panel.appendChild(text);

      const btn = document.createElement('button');
      btn.className = 'btn btn-primary btn-3d-yellow';
      btn.innerHTML = '<i data-lucide="bar-chart-3"></i> ดูผลประเมิน';
      btn.addEventListener('click', () => {
        showResultScreen();
      });
      panel.appendChild(btn);
      return;
    }

    if (gameState.currentTurn === 'ai') {
      const text = document.createElement('div');
      text.className = 'action-text';
      text.innerHTML = '🤖 AI กำลังคำนวณความเป็นไปได้ของการ์ดคุณ<span class="thinking-dots">...</span>';
      panel.appendChild(text);
      return;
    }

    const text = document.createElement('div');
    text.className = 'action-text';

    switch (gameState.phase) {
      case 'draw':
        text.innerHTML = gameState.deck.length > 0
          ? '👆 กดที่ <strong>กองการ์ดโฮโลแกรมตรงกลาง</strong> เพื่อดึงการ์ดขึ้นมือ'
          : '⚠️ กองการ์ดหมดระบบแล้ว — กำลังข้ามไปช่วงเวลาถอดรหัส';
        break;
      case 'guess':
        text.textContent = '🎯 กดเลือกการ์ดของ AI ด้านบน เพื่อป้อนคำตอบกลางบอร์ด';
        break;
      case 'decide':
        text.textContent = '✅ ถอดรหัสถูก! ต้องการเสี่ยงทายใบต่อไป หรือ พอแค่นี้?';
        break;
      case 'joker_placement':
        text.textContent = '👾 วางตำแหน่งการ์ด Joker ของคุณ บนแถบช่องสีม่วง!';
        break;
    }
    panel.appendChild(text);
  }

  // ── Guess Panel Custom (rendered inside center console) ──
  let selectedColor = 'black';
  let selectedNumber = 0;

  function showGuessPanel(position) {
    const container = document.getElementById('console-center-controls');
    if (!container) return;

    selectedColor = 'black';
    selectedNumber = 0;

    function renderPanel() {
      container.innerHTML = '';
      
      const guessPanel = document.createElement('div');
      guessPanel.className = 'guess-panel-custom';

      const title = document.createElement('div');
      title.className = 'guess-title';
      title.innerHTML = `🎯 ทายไพ่ตำแหน่งที่ <span class="highlight">${position + 1}</span>`;
      guessPanel.appendChild(title);

      // Color Selector Buttons
      const colorRow = document.createElement('div');
      colorRow.className = 'guess-color-row';
      
      const colors = [
        { value: 'black', label: '⚫ สีดำ', class: 'color-btn-black' },
        { value: 'white', label: '⚪ สีขาว', class: 'color-btn-white' }
      ];
      
      colors.forEach(c => {
        const btn = document.createElement('button');
        btn.className = `btn btn-secondary btn-sm color-select-btn ${c.class} ${selectedColor === c.value ? 'selected' : ''}`;
        btn.innerHTML = c.label;
        btn.addEventListener('click', () => {
          AudioManager.sfx.buttonClick();
          selectedColor = c.value;
          renderPanel();
        });
        colorRow.appendChild(btn);
      });
      guessPanel.appendChild(colorRow);

      // Number Grid Buttons
      const numberGrid = document.createElement('div');
      numberGrid.className = 'guess-number-grid';

      for (let i = 0; i <= 11; i++) {
        const btn = document.createElement('button');
        btn.className = `num-btn ${selectedNumber === i ? 'selected' : ''}`;
        btn.textContent = i;
        btn.addEventListener('click', () => {
          AudioManager.sfx.buttonClick();
          selectedNumber = i;
          renderPanel();
        });
        numberGrid.appendChild(btn);
      }
      
      // Joker Button
      const jokerBtn = document.createElement('button');
      jokerBtn.className = `joker-btn ${selectedNumber === 'joker' ? 'selected' : ''}`;
      jokerBtn.innerHTML = '★ Joker';
      jokerBtn.addEventListener('click', () => {
        AudioManager.sfx.buttonClick();
        selectedNumber = 'joker';
        renderPanel();
      });
      numberGrid.appendChild(jokerBtn);
      guessPanel.appendChild(numberGrid);

      // Action Buttons Row
      const actionRow = document.createElement('div');
      actionRow.className = 'guess-actions';

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'btn btn-secondary btn-3d-orange btn-sm';
      cancelBtn.innerHTML = '<i data-lucide="x"></i> ยกเลิก';
      cancelBtn.addEventListener('click', () => {
        AudioManager.sfx.buttonClick();
        const st = Game.getState();
        if (st) {
          renderConsoleCenterControls(st);
          renderActionPanel(st);
        }
      });

      const confirmBtn = document.createElement('button');
      confirmBtn.className = 'btn btn-accent btn-3d-yellow btn-sm';
      confirmBtn.innerHTML = '<i data-lucide="check"></i> ยืนยัน';
      confirmBtn.addEventListener('click', () => {
        AudioManager.sfx.buttonClick();
        const result = Game.playerGuess(position, selectedNumber, selectedColor);

        if (result) {
          addLogEntry('player', position, selectedNumber, selectedColor, result.correct);

          // Flash animation
          const aiCards = document.querySelectorAll('#ai-cards .tile');
          if (aiCards[position]) {
            aiCards[position].classList.add(result.correct ? 'correct-flash' : 'wrong-flash');
            setTimeout(() => {
              aiCards[position].classList.remove('correct-flash', 'wrong-flash');
            }, 600);
          }
        }
      });

      actionRow.appendChild(cancelBtn);
      actionRow.appendChild(confirmBtn);
      guessPanel.appendChild(actionRow);

      container.appendChild(guessPanel);
      if (window.lucide) window.lucide.createIcons();
    }

    renderPanel();
  }

  // ── Center Console Controller Update ──
  function renderConsoleCenterControls(gameState) {
    const container = document.getElementById('console-center-controls');
    if (!container) return;
    container.innerHTML = '';

    if (gameState.phase === 'gameover') {
      container.innerHTML = `
        <div class="console-turn-title">ภารกิจเสร็จสิ้น</div>
        <div class="console-turn-sub">${gameState.winner === 'player' ? 'ชนะการถอดรหัส! 🎉' : 'ระบบควบคุมล้มเหลว... 💀'}</div>
      `;
      return;
    }

    if (gameState.currentTurn === 'ai') {
      container.innerHTML = `
        <div class="console-turn-title ai-thinking">AI กำลังวิเคราะห์</div>
        <div class="console-turn-sub">โปรดเตรียมการป้องกันรหัสผ่าน...</div>
        <div class="thinking-spinner"></div>
      `;
      return;
    }

    // Player turn
    switch (gameState.phase) {
      case 'draw': {
        container.innerHTML = `
          <div class="console-turn-title player-turn">เทิร์นของคุณ</div>
          <div class="console-turn-sub blink-text">👆 กรุณาดึงการ์ดจากกองกลาง</div>
        `;
        break;
      }
      case 'guess': {
        container.innerHTML = `
          <div class="console-turn-title player-turn">เทิร์นของคุณ</div>
          <div class="console-turn-sub">🎯 เลือกการ์ด AI ด้านบนเพื่อเดารหัส</div>
        `;
        break;
      }
      case 'decide': {
        container.innerHTML = `
          <div class="console-turn-title correct">ถอดรหัสถูกต้อง!</div>
          <div class="console-turn-sub">ต้องการเสี่ยงทายใบต่อไป หรือ หยุด?</div>
          <div class="center-guess-buttons">
            <button id="btn-center-continue" class="btn btn-primary btn-3d-yellow btn-sm">
              <i data-lucide="target"></i> ทายต่อ
            </button>
            <button id="btn-center-pass" class="btn btn-secondary btn-3d-blue btn-sm">
              <i data-lucide="square"></i> หยุด (เก็บการ์ด)
            </button>
          </div>
        `;
        
        // Wire up buttons
        setTimeout(() => {
          const btnCont = document.getElementById('btn-center-continue');
          const btnPass = document.getElementById('btn-center-pass');
          if (btnCont) {
            btnCont.addEventListener('click', () => {
              AudioManager.sfx.buttonClick();
              Game.playerContinue();
            });
          }
          if (btnPass) {
            btnPass.addEventListener('click', () => {
              AudioManager.sfx.buttonClick();
              Game.playerPass();
            });
          }
          if (window.lucide) window.lucide.createIcons();
        }, 10);
        break;
      }
      case 'joker_placement': {
        const remaining = gameState.jokerTimerRemaining ?? 5;
        const percent = (remaining / 5) * 100;
        container.innerHTML = `
          <div class="console-turn-title text-purple">วางตำแหน่ง Joker</div>
          <div class="console-turn-sub">คลิกช่องว่างสีม่วงบนมือเพื่อวาง (เหลือ ${remaining} วินาที)</div>
          <div class="joker-timer-bar-container">
            <div class="joker-timer-bar" style="width: ${percent}%"></div>
          </div>
        `;
        break;
      }
    }
  }

  // ── Start Game Countdown Overlay ──
  function showCountdown(callback) {
    const overlay = document.getElementById('game-countdown-overlay');
    const numEl = document.getElementById('countdown-number');
    if (!overlay || !numEl) {
      if (callback) callback();
      return;
    }

    overlay.classList.remove('hidden');
    // Force reflow
    overlay.getBoundingClientRect();
    overlay.classList.add('active');

    const steps = [
      { text: '3' },
      { text: '2' },
      { text: '1' },
      { text: "Let's Go!", isLetsGo: true }
    ];

    let currentStep = 0;

    function runStep() {
      if (currentStep >= steps.length) {
        overlay.classList.remove('active');
        setTimeout(() => {
          overlay.classList.add('hidden');
          if (callback) callback();
        }, 300);
        return;
      }

      const step = steps[currentStep];
      numEl.textContent = step.text;
      numEl.classList.remove('animate', 'lets-go');
      if (step.isLetsGo) {
        numEl.classList.add('lets-go');
      }

      // Play tick sound or let's go tone
      if (AudioManager.unlock) AudioManager.unlock();
      if (step.isLetsGo) {
        AudioManager.sfx.turnStart();
      } else {
        AudioManager.sfx.timerWarning();
      }

      // Force restart of animation
      setTimeout(() => {
        numEl.classList.add('animate');
      }, 10);

      currentStep++;
      setTimeout(runStep, 800);
    }

    runStep();
  }

  // ── Game Log ──
  function addLogEntry(actor, position, number, color, correct) {
    const log = document.getElementById('game-log');
    if (!log) return;

    const entry = document.createElement('div');
    entry.className = 'log-entry';

    const colorName = color === 'black' ? 'ดำ' : 'ขาว';
    const numDisplay = number === 'joker'
      ? `Joker สี${colorName}`
      : `หมายเลข ${number} สี${colorName}`;

    entry.innerHTML = `
      <span class="log-actor ${actor}">${actor === 'player' ? '👨‍🚀 คุณ' : '👽 AI'}</span>
      ทายตำแหน่ง ${position + 1} = ${numDisplay}
      <span class="${correct ? 'log-correct' : 'log-wrong'}">${correct ? '✅' : '❌'}</span>
    `;

    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
  }

  function clearLog() {
    const log = document.getElementById('game-log');
    if (log) {
      log.innerHTML = '<div class="log-entry" style="color: var(--text-muted); font-style: italic;">ระบบยานอวกาศออนไลน์! ดึงการ์ดเพื่อเริ่มเล่น</div>';
    }
  }

  // ── Mascot Rendering ──
  function renderMascots(gameState) {
    const alienContainer = document.getElementById('alien-mascot-container');
    const dialogBubble = document.getElementById('alien-dialog-bubble');
    const astronautContainer = document.getElementById('astronaut-mascot-container');

    if (!alienContainer || !dialogBubble || !astronautContainer) return;

    let state = 'normal';
    let dialogText = "ยินดีต้อนรับเจ้ามนุษย์! ลองทายรหัสฉันให้ถูกสิ 👽";

    if (gameState.phase === 'gameover') {
      if (gameState.winner === 'player') {
        state = 'shocked';
        dialogText = "พ่ายแพ้แล้ว... ยินดีด้วย เจ้ามนุษย์! วิทยาการวิเคราะห์รหัสของเธอยอดเยี่ยมมาก 🏆";
      } else {
        state = 'happy';
        dialogText = "ฮ่าๆ! วิทยาการของฉันเหนือกว่า เจ้าพ่ายแพ้แล้ว มนุษย์น้อย! 👽";
      }
    } else if (gameState.currentTurn === 'ai') {
      state = 'thinking';
      dialogText = "ขอฉันคำนวณความเป็นไปได้ของการ์ดเธอก่อนนะ... 🧠";
    } else { // Player turn
      if (gameState.phase === 'draw') {
        state = 'normal';
        dialogText = "ดึงการ์ดขึ้นมาเลย! ดวงชะตาของคุณจะนำพาเลขอะไรขึ้นมา? 🃏";
      } else if (gameState.phase === 'guess') {
        state = 'normal';
        dialogText = "ทายรหัสการ์ดของฉันเลยสิ! มั่นใจแค่ไหนกันเชียว? 🤔";
      } else if (gameState.phase === 'decide') {
        state = 'shocked';
        dialogText = "เอ๊ะ! ทายถูกได้ยังไงกัน?! จะเสี่ยงทายใบอื่นต่อ หรือพอแค่นี้? 😱";
      } else if (gameState.phase === 'joker_placement') {
        state = 'thinking';
        dialogText = "โอ๊ะ! คุณจั่วได้ Joker หรอ? วางไว้ตรงไหนดีน้า... 👾";
      }
    }

    alienContainer.innerHTML = getAlienSVG(state);
    dialogBubble.textContent = dialogText;
    astronautContainer.innerHTML = getAstronautSVG();
  }

  function getAlienSVG(state) {
    let faceColor = "#00e5ff";
    let bodyColor = "#4dd0e1";
    let leftEyeRx = "8", leftEyeRy = "11", leftEyeCy = "45";
    let rightEyeRx = "8", rightEyeRy = "11", rightEyeCy = "45";
    let leftPupilCx = "36", leftPupilCy = "41", leftPupilR = "3";
    let rightPupilCx = "64", rightPupilCy = "41", rightPupilR = "3";
    
    let blush = `<circle cx="28" cy="52" r="3" fill="#ff4081" opacity="0.4" />
                 <circle cx="72" cy="52" r="3" fill="#ff4081" opacity="0.4" />`;
                 
    let mouth = `<path d="M46 54 Q50 58 54 54" stroke="#111" stroke-width="2.5" fill="none" stroke-linecap="round" />`;
    let arms = `
      <path d="M38 68 C28 72, 28 80, 32 80" stroke="${bodyColor}" stroke-width="5" stroke-linecap="round" fill="none" />
      <path d="M62 68 C72 72, 72 80, 68 80" stroke="${bodyColor}" stroke-width="5" stroke-linecap="round" fill="none" />
    `;
    
    if (state === 'thinking') {
      leftEyeRy = "6"; leftEyeCy = "46";
      rightEyeRy = "6"; rightEyeCy = "46";
      mouth = `<path d="M46 54 L54 54" stroke="#111" stroke-width="2.5" stroke-linecap="round" />`;
      arms = `
        <path d="M38 68 C28 72, 28 80, 32 80" stroke="${bodyColor}" stroke-width="5" stroke-linecap="round" fill="none" />
        <path d="M62 68 Q58 60 52 56" stroke="${bodyColor}" stroke-width="5" stroke-linecap="round" fill="none" />
      `;
      blush = '';
    } else if (state === 'shocked') {
      leftEyeRx = "9"; leftEyeRy = "9";
      rightEyeRx = "9"; rightEyeRy = "9";
      leftPupilR = "1.5"; rightPupilR = "1.5";
      mouth = `<circle cx="50" cy="55" r="4.5" fill="#111" />`;
      arms = `
        <path d="M38 68 C25 65, 20 50, 22 45" stroke="${bodyColor}" stroke-width="5" stroke-linecap="round" fill="none" />
        <path d="M62 68 C75 65, 80 50, 78 45" stroke="${bodyColor}" stroke-width="5" stroke-linecap="round" fill="none" />
      `;
    } else if (state === 'happy') {
      mouth = `<path d="M44 51 Q50 61 56 51 Z" fill="#111" />`;
      arms = `
        <path d="M38 68 C30 60, 25 45, 30 38" stroke="${bodyColor}" stroke-width="5" stroke-linecap="round" fill="none" />
        <path d="M62 68 C70 60, 75 45, 70 38" stroke="${bodyColor}" stroke-width="5" stroke-linecap="round" fill="none" />
      `;
    }

    return `
      <svg viewBox="0 0 100 100" width="100%" height="100%" class="alien-svg">
        <!-- Glow pedestal -->
        <ellipse cx="50" cy="85" rx="35" ry="8" fill="rgba(0, 229, 255, 0.15)" stroke="rgba(0, 229, 255, 0.6)" stroke-width="1.5" />
        <ellipse cx="50" cy="85" rx="20" ry="4" fill="rgba(0, 229, 255, 0.35)" />
        <ellipse cx="50" cy="85" rx="10" ry="1.5" fill="rgba(255, 255, 255, 0.6)" />

        <!-- Body -->
        <path d="M42 65 C42 55, 58 55, 58 65 L55 81 C55 83, 45 83, 45 81 Z" fill="${bodyColor}" />
        <rect x="47" y="68" width="6" height="2" rx="1" fill="#fff" opacity="0.8" />
        <circle cx="50" cy="74" r="1.5" fill="#ffb300" />

        <!-- Arms -->
        ${arms}

        <!-- Head -->
        <ellipse cx="50" cy="45" rx="28" ry="22" fill="${faceColor}" />

        <!-- Cheeks Blush -->
        ${blush}

        <!-- Antennas -->
        <path d="M38 27 L32 12" stroke="${faceColor}" stroke-width="3.5" stroke-linecap="round" />
        <circle cx="32" cy="12" r="5" fill="#ffeb3b" />
        
        <path d="M62 27 L68 12" stroke="${faceColor}" stroke-width="3.5" stroke-linecap="round" />
        <circle cx="68" cy="12" r="5" fill="#ffeb3b" />

        <!-- Eyes -->
        <ellipse cx="36" cy="${leftEyeCy}" rx="${leftEyeRx}" ry="${leftEyeRy}" fill="#111" />
        <ellipse cx="64" cy="${rightEyeCy}" rx="${rightEyeRx}" ry="${rightEyeRy}" fill="#111" />
        
        <!-- Pupils -->
        <circle cx="${leftPupilCx}" cy="${leftPupilCy}" r="${leftPupilR}" fill="#fff" />
        <circle cx="${rightPupilCx}" cy="${rightPupilCy}" r="${rightPupilR}" fill="#fff" />

        <!-- Mouth -->
        ${mouth}
      </svg>
    `;
  }

  function getAstronautSVG() {
    return `
      <svg viewBox="0 0 100 100" width="100%" height="100%" class="astronaut-svg">
        <!-- Helmet -->
        <circle cx="50" cy="40" r="23" fill="#fff" stroke="#90a4ae" stroke-width="2.5" />
        
        <!-- Visor -->
        <path d="M32 40 C32 30, 68 30, 68 40 C68 50, 32 50, 32 40 Z" fill="url(#visor-grad)" />
        <path d="M37 36 L63 36" stroke="rgba(255,255,255,0.4)" stroke-width="2.5" stroke-linecap="round" />
        <circle cx="28" cy="40" r="3" fill="#ffb300" />
        <circle cx="72" cy="40" r="3" fill="#ffb300" />
        
        <!-- Suit Collar -->
        <ellipse cx="50" cy="62" rx="18" ry="4" fill="#37474f" />

        <!-- Body -->
        <path d="M30 64 C30 54, 70 54, 70 64 L65 85 C65 87, 35 87, 35 85 Z" fill="#eceff1" stroke="#b0bec5" stroke-width="2.5" />
        
        <!-- Chest Panel -->
        <rect x="42" y="66" width="16" height="12" rx="2" fill="#455a64" />
        <circle cx="47" cy="72" r="2.2" fill="#00e5ff" />
        <circle cx="53" cy="72" r="2.2" fill="#ff1744" />
        
        <!-- Arms -->
        <path d="M25 64 Q15 72 20 85" stroke="#eceff1" stroke-width="7" stroke-linecap="round" fill="none" />
        <path d="M75 64 Q85 72 80 85" stroke="#eceff1" stroke-width="7" stroke-linecap="round" fill="none" />

        <defs>
          <radialGradient id="visor-grad" cx="50%" cy="30%" r="70%">
            <stop offset="0%" stop-color="#00e5ff" />
            <stop offset="60%" stop-color="#006064" />
            <stop offset="100%" stop-color="#070c24" />
          </radialGradient>
        </defs>
      </svg>
    `;
  }

  // ── Result Screen ──
  function showResultScreen() {
    const evaluation = Evaluator.evaluate();
    const winner = Game.getWinner();

    // Title
    const title = document.getElementById('result-title');
    if (title) {
      title.innerHTML = winner === 'player'
        ? '<i data-lucide="award" class="icon-inline"></i> คุณกู้คืนยานสำเร็จ! (ชนะ)'
        : '<i data-lucide="alert-triangle" class="icon-inline"></i> ระบบยานล้มเหลว! (แพ้)';
      title.className = `result-title ${winner === 'player' ? 'win' : 'lose'}`;
    }

    // Stars
    const starsEl = document.getElementById('result-stars');
    if (starsEl) {
      let stars = '';
      for (let i = 0; i < 5; i++) {
        stars += i < evaluation.stars ? '★' : '☆';
      }
      starsEl.textContent = stars;
    }

    // Evaluation bars
    const metricsEl = document.getElementById('eval-metrics');
    if (metricsEl) {
      const metrics = [
        { name: '🎯 ความแม่นยำ', value: evaluation.accuracy.percent, detail: `${evaluation.accuracy.correct}/${evaluation.accuracy.total}` },
        { name: '🧩 คุณภาพการอนุมาน', value: evaluation.deduction.percent, detail: `${evaluation.deduction.percent}%` },
        { name: '♟️ การจัดการความเสี่ยง', value: evaluation.risk.percent, detail: `${evaluation.risk.percent}%` },
        { name: '⚡ ประสิทธิภาพการบิน', value: evaluation.efficiency.percent, detail: `${evaluation.efficiency.turns} เทิร์น` }
      ];

      metricsEl.innerHTML = metrics.map(m => `
        <div class="eval-metric">
          <div class="eval-metric-header">
            <span class="eval-metric-name">${m.name}</span>
            <span class="eval-metric-value">${m.detail}</span>
          </div>
          <div class="eval-bar">
            <div class="eval-bar-fill" style="width: 0%" data-target="${m.value}"></div>
          </div>
        </div>
      `).join('');

      // Animate bars after a short delay
      setTimeout(() => {
        document.querySelectorAll('.eval-bar-fill').forEach(bar => {
          bar.style.width = bar.dataset.target + '%';
        });
      }, 300);
    }

    // Feedback tips
    const feedbackList = document.getElementById('feedback-list');
    if (feedbackList) {
      feedbackList.innerHTML = evaluation.tips.map(tip => `
        <div class="feedback-item">
          <span class="tip-icon">${tip.icon}</span>
          ${tip.text}
        </div>
      `).join('');
    }

    showScreen('result');
  }

  // ── Idle Talk Bubble System ──
  let idleTimer = null;
  const idleTalks = [
    "เอ้อออ... ยังไม่เล่นอีกเหรอ? แหม! ฝันใช้ทำอะไรอยู่นะ 😴",
    "ฉันเบื่อรอคุณอยู่! กดอะไรสักอย่างเถอะ 👽",
    "รู้มั้ย... การ์ดของเธอปลอดภัยกับฉันนะ 😏",
    "โอ้ย~ เดาเมื่อไรล่ะ! โลกของพวกเธอหยุดหมุนแล้วหรอ? ฮ่าๆ 🤭",
    "พวกเราเดินทางไกลมากนะ ที่จะมาแข่งกับมนุษย์ 🚀"
  ];

  function startIdleTimer() {
    clearIdleTimer();
    idleTimer = setTimeout(() => {
      const bubble = document.getElementById('alien-dialog-bubble');
      if (bubble) {
        const randomTalk = idleTalks[Math.floor(Math.random() * idleTalks.length)];
        bubble.textContent = randomTalk;
        bubble.classList.remove('idle-talk');
        bubble.getBoundingClientRect();
        bubble.classList.add('idle-talk');
      }
    }, 7000);
  }

  function clearIdleTimer() {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  }

  // ── Mobile Bottom Sheet Guess Panel ──
  let mobileSelectedColor = 'black';
  let mobileSelectedNumber = 0;

  function showMobileGuessSheet(position) {
    const sheet = document.getElementById('mobile-guess-sheet');
    const titleEl = document.getElementById('mobile-guess-title');
    const colorRow = document.getElementById('mobile-guess-color-row');
    const numberGrid = document.getElementById('mobile-guess-number-grid');
    const cancelBtn = document.getElementById('btn-mobile-guess-cancel');
    const confirmBtn = document.getElementById('btn-mobile-guess-confirm');
    const backdrop = sheet ? sheet.querySelector('.mobile-guess-backdrop') : null;

    if (!sheet) return;

    mobileSelectedColor = 'black';
    mobileSelectedNumber = 0;

    titleEl.innerHTML = `🎯 ทายไพ่ตำแหน่งที่ <span class="highlight">${position + 1}</span>`;

    function renderMobilePanel() {
      // Color buttons
      colorRow.innerHTML = '';
      [{ value: 'black', label: '⚫ สีดำ', cls: 'black' }, { value: 'white', label: '⚪ สีขาว', cls: 'white' }].forEach(c => {
        const btn = document.createElement('button');
        btn.className = `mobile-color-btn ${c.cls} ${mobileSelectedColor === c.value ? 'selected' : ''}`;
        btn.textContent = c.label;
        btn.addEventListener('click', () => {
          AudioManager.sfx.buttonClick();
          mobileSelectedColor = c.value;
          renderMobilePanel();
        });
        colorRow.appendChild(btn);
      });

      // Number grid
      numberGrid.innerHTML = '';
      for (let i = 0; i <= 11; i++) {
        const btn = document.createElement('button');
        btn.className = `num-btn ${mobileSelectedNumber === i ? 'selected' : ''}`;
        btn.textContent = i;
        btn.addEventListener('click', () => {
          AudioManager.sfx.buttonClick();
          mobileSelectedNumber = i;
          renderMobilePanel();
        });
        numberGrid.appendChild(btn);
      }
      // Joker button
      const jBtn = document.createElement('button');
      jBtn.className = `joker-btn ${mobileSelectedNumber === 'joker' ? 'selected' : ''}`;
      jBtn.innerHTML = '★ Joker';
      jBtn.addEventListener('click', () => {
        AudioManager.sfx.buttonClick();
        mobileSelectedNumber = 'joker';
        renderMobilePanel();
      });
      numberGrid.appendChild(jBtn);
    }

    renderMobilePanel();

    // Show sheet
    sheet.classList.remove('hidden');

    // Wire up actions
    const handleCancel = () => {
      AudioManager.sfx.buttonClick();
      sheet.classList.add('hidden');
      cleanup();
    };

    const handleConfirm = () => {
      AudioManager.sfx.buttonClick();
      sheet.classList.add('hidden');
      const result = Game.playerGuess(position, mobileSelectedNumber, mobileSelectedColor);
      if (result) {
        addLogEntry('player', position, mobileSelectedNumber, mobileSelectedColor, result.correct);
        const aiCards = document.querySelectorAll('#ai-cards .tile');
        if (aiCards[position]) {
          aiCards[position].classList.add(result.correct ? 'correct-flash' : 'wrong-flash');
          setTimeout(() => {
            aiCards[position].classList.remove('correct-flash', 'wrong-flash');
          }, 600);
        }
      }
      cleanup();
    };

    const handleBackdrop = () => handleCancel();

    function cleanup() {
      cancelBtn.removeEventListener('click', handleCancel);
      confirmBtn.removeEventListener('click', handleConfirm);
      if (backdrop) backdrop.removeEventListener('click', handleBackdrop);
    }

    cancelBtn.addEventListener('click', handleCancel);
    confirmBtn.addEventListener('click', handleConfirm);
    if (backdrop) backdrop.addEventListener('click', handleBackdrop);
  }

  // ── Penalty Reveal Overlay ──
  function showPenaltyOverlay() {
    const overlay = document.getElementById('penalty-reveal-overlay');
    if (overlay) overlay.classList.remove('hidden');
  }

  function hidePenaltyOverlay() {
    const overlay = document.getElementById('penalty-reveal-overlay');
    if (overlay) overlay.classList.add('hidden');
  }

  // ── Public API ──
  return {
    showScreen,
    initStarfield,
    initLandingMascots,
    renderGameState,
    showGuessPanel,
    showMobileGuessSheet,
    showCountdown,
    addLogEntry,
    clearLog,
    showResultScreen,
    showPenaltyOverlay,
    hidePenaltyOverlay,
    startIdleTimer,
    clearIdleTimer
  };
})();
