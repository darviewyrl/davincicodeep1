// ═══════════════════════════════════════════════════════════
// XAI REPLAY — Explainable AI visualization
// Timeline overview + per-turn drill-down with probability bars
// ═══════════════════════════════════════════════════════════

const XAIReplay = (() => {
  let currentTurnIndex = -1;
  let aiTurnsLog = [];

  function init() {
    const log = GameLogger.getLog();
    // Get all guess entries (both player and AI)
    aiTurnsLog = log.filter(e => e.action === 'guess');
    currentTurnIndex = -1;
    renderTimeline();
  }

  function renderTimeline() {
    const container = document.getElementById('xai-timeline');
    if (!container) return;

    container.innerHTML = '';

    aiTurnsLog.forEach((entry, i) => {
      const dot = document.createElement('div');
      dot.className = 'xai-turn-dot';
      dot.classList.add(entry.actor === 'ai' ? 'ai-dot' : 'player-dot');
      dot.classList.add(entry.result === 'correct' ? 'correct' : 'wrong');
      if (i === currentTurnIndex) dot.classList.add('selected');

      dot.textContent = `T${entry.turn}`;
      dot.title = `${entry.actor === 'ai' ? 'AI' : 'คุณ'} — ${entry.result === 'correct' ? 'ถูก ✅' : 'ผิด ❌'}`;
      dot.addEventListener('click', () => selectTurn(i));

      container.appendChild(dot);
    });
  }

  function selectTurn(index) {
    if (index < 0 || index >= aiTurnsLog.length) return;
    currentTurnIndex = index;
    renderTimeline();
    renderDetail(aiTurnsLog[index]);
  }

  function renderDetail(entry) {
    const container = document.getElementById('xai-detail-content');
    if (!container) return;

    const isAI = entry.actor === 'ai';
    const guessDisplay = entry.guess.number === 'joker'
      ? `Joker ${entry.guess.color === 'black' ? 'ดำ' : 'ขาว'}`
      : `${entry.guess.number} ${entry.guess.color === 'black' ? 'ดำ' : 'ขาว'}`;

    let html = `
      <h4 class="xai-detail-title">
        ${isAI ? '<i data-lucide="bot" class="icon-inline"></i> AI' : '<i data-lucide="user" class="icon-inline"></i> คุณ'} — เทิร์นที่ ${entry.turn}
      </h4>
      <p style="margin-bottom: var(--space-md); color: var(--text-secondary);">
        ทาย: ตำแหน่งที่ <strong style="color:var(--primary)">${entry.guess.position + 1}</strong> = 
        <strong style="color:${entry.result === 'correct' ? 'var(--correct)' : 'var(--wrong)'}">${guessDisplay}</strong>
        ${entry.result === 'correct' ? ' ✅ ถูก!' : ' ❌ ผิด!'}
      </p>
    `;

    // Show AI thought process if available
    if (isAI && entry.aiThought) {
      const thought = entry.aiThought;

      // Reasoning
      html += `
        <div class="xai-reasoning">
          <strong>💭 AI คิดว่า:</strong><br>
          ${thought.reasoning}
        </div>
      `;

      // Probability bars
      if (thought.probabilities && thought.allPositionData) {
        html += `<h4 style="margin-top:var(--space-lg); margin-bottom:var(--space-md); color:var(--accent); font-family:var(--font-title); font-size:0.9rem;">
          📊 ความน่าจะเป็นแต่ละตำแหน่ง
        </h4>`;

        const posData = thought.allPositionData;
        Object.keys(posData).forEach(pos => {
          const data = posData[pos];
          const isSelected = parseInt(pos) === entry.guess.position;

          html += `<div style="margin-bottom:var(--space-md); padding:var(--space-sm); ${isSelected ? 'background:rgba(255,215,0,0.05); border-radius:var(--radius-sm); border:1px solid rgba(255,215,0,0.15);' : ''}">
            <div style="font-size:0.8rem; color:${isSelected ? 'var(--accent)' : 'var(--text-muted)'}; margin-bottom:4px;">
              ตำแหน่งที่ ${parseInt(pos) + 1} ${isSelected ? '← เลือก!' : ''} (${data.totalOptions} ตัวเลือก)
            </div>`;

          // Show up to 5 probability bars per position
          if (data.probabilities) {
            const entries = Object.values(data.probabilities).slice(0, 5);
            entries.forEach(p => {
              const percent = Math.round(p.probability * 100);
              const isChosen = isSelected &&
                ((entry.guess.number === 'joker' && p.value.joker && p.value.color === entry.guess.color) ||
                 (entry.guess.number !== 'joker' && !p.value.joker && p.value.number === entry.guess.number && p.value.color === entry.guess.color));

              html += `<div class="xai-probability-bar">
                <span class="xai-prob-label">${p.display}</span>
                <div class="xai-prob-bar">
                  <div class="xai-prob-fill ${isChosen ? 'chosen' : ''}" style="width:${percent}%"></div>
                </div>
                <span class="xai-prob-percent">${percent}%</span>
              </div>`;
            });
          }

          html += `</div>`;
        });
      }
    }

    // For player turns, show what AI would have done
    if (!isAI && entry.optimalGuess) {
      const opt = entry.optimalGuess;
      html += `
        <div class="xai-reasoning" style="margin-top:var(--space-lg);">
          <strong>💡 คำแนะนำ:</strong><br>
          ตำแหน่งที่ดีที่สุดคือตำแหน่ง ${opt.position + 1} (${opt.optionCount} ตัวเลือก${opt.isCertain ? ' — แน่ใจ 100%!' : ''})
        </div>
      `;

      // Show probability snapshot for player
      if (entry.probabilitySnapshot) {
        html += `<h4 style="margin-top:var(--space-lg); margin-bottom:var(--space-md); color:var(--accent); font-family:var(--font-title); font-size:0.9rem;">
          📊 ความน่าจะเป็น ณ ตอนนั้น
        </h4>`;

        Object.keys(entry.probabilitySnapshot).forEach(pos => {
          const probs = entry.probabilitySnapshot[pos];
          const isGuessed = parseInt(pos) === entry.guess.position;

          html += `<div style="margin-bottom:var(--space-md); padding:var(--space-sm); ${isGuessed ? 'background:rgba(79,195,247,0.05); border-radius:var(--radius-sm); border:1px solid rgba(79,195,247,0.15);' : ''}">
            <div style="font-size:0.8rem; color:${isGuessed ? 'var(--primary)' : 'var(--text-muted)'}; margin-bottom:4px;">
              ตำแหน่งที่ ${parseInt(pos) + 1} ${isGuessed ? '← คุณเลือก' : ''} (${probs.length} ตัวเลือก)
            </div>`;

          probs.slice(0, 5).forEach(p => {
            const percent = Math.round(p.probability * 100);
            const display = p.joker ? `Joker ${p.color === 'black' ? 'ดำ' : 'ขาว'}` : `${p.number} ${p.color === 'black' ? 'ดำ' : 'ขาว'}`;

            html += `<div class="xai-probability-bar">
              <span class="xai-prob-label">${display}</span>
              <div class="xai-prob-bar">
                <div class="xai-prob-fill" style="width:${percent}%"></div>
              </div>
              <span class="xai-prob-percent">${percent}%</span>
            </div>`;
          });

          html += `</div>`;
        });
      }
    }

    container.innerHTML = html;
    
    // Refresh Lucide icons
    setTimeout(() => {
      if (window.lucide) {
        window.lucide.createIcons();
      }
    }, 10);
  }

  function nextTurn() {
    if (currentTurnIndex < aiTurnsLog.length - 1) {
      selectTurn(currentTurnIndex + 1);
    }
  }

  function prevTurn() {
    if (currentTurnIndex > 0) {
      selectTurn(currentTurnIndex - 1);
    }
  }

  return {
    init,
    selectTurn,
    nextTurn,
    prevTurn
  };
})();
