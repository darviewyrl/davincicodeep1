// ═══════════════════════════════════════════════════════════
// EVALUATOR — Post-game player performance analysis
// 4 dimensions: Accuracy, Deduction, Risk, Efficiency
// ═══════════════════════════════════════════════════════════

const Evaluator = (() => {

  /**
   * Evaluate the player's performance from the game log
   * @returns {Object} evaluation with scores, stars, and tips
   */
  function evaluate() {
    const playerGuesses = GameLogger.getPlayerGuesses();
    const allGuesses = GameLogger.getGuesses();
    const aiGuesses = GameLogger.getAIGuesses();
    const totalTurns = GameLogger.getTurnCount();

    if (playerGuesses.length === 0) {
      return getDefaultEval();
    }

    // ── 1. Accuracy ──
    const correctGuesses = playerGuesses.filter(g => g.result === 'correct').length;
    const accuracy = playerGuesses.length > 0 ? correctGuesses / playerGuesses.length : 0;

    // ── 2. Deduction Quality ──
    // How often did player guess the optimal (most certain) position?
    let deductionScore = 0;
    let deductionCount = 0;
    const deductionDetails = [];

    playerGuesses.forEach(g => {
      if (g.optimalGuess) {
        deductionCount++;
        const guessedOptimalPos = g.guess.position === g.optimalGuess.position;
        const optimalWasCertain = g.optimalGuess.isCertain;

        if (guessedOptimalPos) {
          deductionScore += 1;
        } else if (g.result === 'correct') {
          deductionScore += 0.7; // Correct but not optimal position
        } else if (optimalWasCertain) {
          // Missed a certain guess
          deductionDetails.push({
            turn: g.turn,
            type: 'missed_certain',
            message: `เทิร์น ${g.turn}: มีตำแหน่งที่แน่ใจ 100% แต่เลือกตำแหน่งอื่น`
          });
          deductionScore += 0;
        } else {
          deductionScore += 0.3;
        }
      }
    });

    const deduction = deductionCount > 0 ? deductionScore / deductionCount : 0.5;

    // ── 3. Risk Management ──
    // Did the player guess when info was too limited?
    let riskScore = 0;
    let riskCount = 0;
    const riskDetails = [];

    playerGuesses.forEach(g => {
      riskCount++;
      if (g.probabilitySnapshot) {
        const posSnapshot = g.probabilitySnapshot[g.guess.position];
        if (posSnapshot) {
          const optionCount = posSnapshot.length;
          if (optionCount === 1) {
            riskScore += 1; // Guaranteed — good risk management
          } else if (optionCount <= 3) {
            riskScore += 0.7; // Reasonable risk
          } else if (optionCount <= 5) {
            riskScore += 0.4;
            if (g.result === 'wrong') {
              riskDetails.push({
                turn: g.turn,
                type: 'high_risk',
                message: `เทิร์น ${g.turn}: เดาตอนมี ${optionCount} ตัวเลือก — เสี่ยงเกินไป`
              });
            }
          } else {
            riskScore += 0.1;
            riskDetails.push({
              turn: g.turn,
              type: 'very_high_risk',
              message: `เทิร์น ${g.turn}: เดาตอนมี ${optionCount} ตัวเลือก — เสี่ยงมาก ลองรอข้อมูลเพิ่ม`
            });
          }
        } else {
          riskScore += 0.5;
        }
      } else {
        riskScore += 0.5;
      }
    });

    const risk = riskCount > 0 ? riskScore / riskCount : 0.5;

    // ── 4. Efficiency ──
    // Compare player's turn count vs expected
    const aiCorrectGuesses = aiGuesses.filter(g => g.result === 'correct').length;
    const expectedTurns = Math.max(4, 8); // Baseline
    const efficiency = Math.min(1, expectedTurns / Math.max(totalTurns, 1));

    // ── Star Rating (1-5) ──
    const overall = (accuracy * 0.3 + deduction * 0.3 + risk * 0.2 + efficiency * 0.2);
    const stars = Math.max(1, Math.min(5, Math.round(overall * 5)));

    // ── Generate Tips ──
    const tips = generateTips(accuracy, deduction, risk, efficiency, deductionDetails, riskDetails);

    return {
      accuracy: { score: accuracy, percent: Math.round(accuracy * 100), correct: correctGuesses, total: playerGuesses.length },
      deduction: { score: deduction, percent: Math.round(deduction * 100), details: deductionDetails },
      risk: { score: risk, percent: Math.round(risk * 100), details: riskDetails },
      efficiency: { score: efficiency, percent: Math.round(efficiency * 100), turns: totalTurns },
      overall,
      stars,
      tips
    };
  }

  function generateTips(accuracy, deduction, risk, efficiency, deductionDetails, riskDetails) {
    const tips = [];

    // Accuracy tips
    if (accuracy < 0.4) {
      tips.push({
        icon: '🎯',
        text: 'ลองสังเกตไพ่ที่เปิดแล้วให้มากขึ้น — ข้อมูลเหล่านี้ช่วยตัดตัวเลือกที่เป็นไปไม่ได้ออก'
      });
    } else if (accuracy >= 0.7) {
      tips.push({
        icon: '🎯',
        text: 'ความแม่นยำในการทายดีมาก! ลองท้าทายตัวเองด้วยระดับที่ยากขึ้น'
      });
    }

    // Deduction tips
    if (deduction < 0.4) {
      tips.push({
        icon: '🧩',
        text: 'ลองใช้ "การตัดทิ้ง" (Elimination) — ดูว่าไพ่ตัวไหนเปิดแล้ว แล้วตำแหน่งที่เหลือต้องเป็นตัวไหนบ้าง'
      });

      if (deductionDetails.some(d => d.type === 'missed_certain')) {
        tips.push({
          icon: '💡',
          text: 'บางเทิร์นมีคำตอบที่แน่ใจ 100% แต่คุณเลือกตำแหน่งอื่น — ลองดู "AI คิดยังไง" เพื่อเรียนรู้วิธีหาคำตอบที่แน่นอน'
        });
      }
    }

    // Risk tips
    if (risk < 0.4) {
      tips.push({
        icon: '♟️',
        text: 'คุณมักเดาตอนที่มีตัวเลือกเยอะเกินไป — ลองรอให้มีข้อมูลมากขึ้นก่อนเดา จะเพิ่มโอกาสถูกได้มาก'
      });
    }

    // Efficiency tips
    if (efficiency < 0.4) {
      tips.push({
        icon: '⚡',
        text: 'ลองเดาต่อเมื่อทายถูก (ถ้ามั่นใจ) แทนที่จะหยุดทุกครั้ง — จะช่วยจบเกมเร็วขึ้น'
      });
    }

    // Default tip if no issues
    if (tips.length === 0) {
      tips.push({
        icon: '✨',
        text: 'เล่นได้ดีมาก! ลองเพิ่มความท้าทายด้วยการเปิด Timer หรือ Card Removal ดูนะ'
      });
    }

    return tips;
  }

  function getDefaultEval() {
    return {
      accuracy: { score: 0, percent: 0, correct: 0, total: 0 },
      deduction: { score: 0, percent: 0, details: [] },
      risk: { score: 0, percent: 0, details: [] },
      efficiency: { score: 0, percent: 0, turns: 0 },
      overall: 0,
      stars: 1,
      tips: [{ icon: '🤔', text: 'ไม่มีข้อมูลเพียงพอสำหรับการประเมิน ลองเล่นใหม่อีกครั้ง' }]
    };
  }

  return { evaluate };
})();
