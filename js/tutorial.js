// ═══════════════════════════════════════════════════════════
// TUTORIAL — Step-by-step interactive tutorial
// ═══════════════════════════════════════════════════════════

const Tutorial = (() => {
  let currentStep = 1;
  const totalSteps = 5;

  function init() {
    currentStep = 1;
    updateUI();
  }

  function nextStep() {
    if (currentStep < totalSteps) {
      currentStep++;
      AudioManager.sfx.buttonClick();
      updateUI();
    } else {
      // Tutorial complete, go back to landing
      AudioManager.sfx.buttonClick();
      UI.showScreen('landing');
    }
  }

  function prevStep() {
    if (currentStep > 1) {
      currentStep--;
      AudioManager.sfx.buttonClick();
      updateUI();
    }
  }

  function updateUI() {
    // Update step visibility
    document.querySelectorAll('.tutorial-step').forEach(step => {
      const stepNum = parseInt(step.dataset.step);
      step.classList.toggle('active', stepNum === currentStep);
    });

    // Update progress dots
    document.querySelectorAll('.progress-dot').forEach(dot => {
      const stepNum = parseInt(dot.dataset.step);
      dot.classList.remove('active', 'completed');
      if (stepNum === currentStep) {
        dot.classList.add('active');
      } else if (stepNum < currentStep) {
        dot.classList.add('completed');
      }
    });

    // Update buttons
    const prevBtn = document.getElementById('btn-tutorial-prev');
    const nextBtn = document.getElementById('btn-tutorial-next');

    if (prevBtn) prevBtn.disabled = currentStep === 1;
    if (nextBtn) {
      nextBtn.innerHTML = currentStep === totalSteps 
        ? '<i data-lucide="check"></i> เข้าใจแล้ว!' 
        : 'ถัดไป <i data-lucide="arrow-right"></i>';
    }

    // Refresh Lucide icons
    setTimeout(() => {
      if (window.lucide) {
        window.lucide.createIcons();
      }
    }, 10);
  }

  return {
    init,
    nextStep,
    prevStep,
    getCurrentStep: () => currentStep
  };
})();
