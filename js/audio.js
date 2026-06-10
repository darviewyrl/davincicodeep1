// ═══════════════════════════════════════════════════════════
// AUDIO MANAGER — SFX + BGM
// Generates SFX using Web Audio API, plays BGM from online MP3
// ═══════════════════════════════════════════════════════════

const AudioManager = (() => {
  let audioCtx = null;
  let bgmAudio = null;
  let sfxEnabled = true;
  let bgmEnabled = true;
  let bgmPlaying = false;

  function getCtx() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  // ── SFX Generators ──

  function playTone(freq, duration, type = 'sine', volume = 0.15) {
    if (!sfxEnabled) return;
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  }

  function playNoise(duration, volume = 0.08) {
    if (!sfxEnabled) return;
    const ctx = getCtx();
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.5;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2000, ctx.currentTime);
    filter.Q.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start(ctx.currentTime);
  }

  const sfx = {
    drawCard() {
      playNoise(0.1, 0.06);
      setTimeout(() => playTone(800, 0.08, 'sine', 0.1), 50);
    },

    cardPlace() {
      playTone(600, 0.1, 'sine', 0.08);
      setTimeout(() => playTone(900, 0.06, 'sine', 0.06), 60);
    },

    guessCorrect() {
      playTone(523, 0.15, 'sine', 0.12);
      setTimeout(() => playTone(659, 0.15, 'sine', 0.12), 100);
      setTimeout(() => playTone(784, 0.25, 'sine', 0.15), 200);
    },

    guessWrong() {
      playTone(350, 0.15, 'sawtooth', 0.08);
      setTimeout(() => playTone(250, 0.2, 'sawtooth', 0.06), 120);
    },

    flipCard() {
      playNoise(0.05, 0.04);
      playTone(1200, 0.05, 'sine', 0.06);
    },

    buttonClick() {
      playTone(1000, 0.05, 'sine', 0.06);
    },

    gameWin() {
      const notes = [523, 659, 784, 1047];
      notes.forEach((f, i) => {
        setTimeout(() => playTone(f, 0.3, 'sine', 0.12), i * 150);
      });
    },

    gameLose() {
      const notes = [440, 392, 349, 261];
      notes.forEach((f, i) => {
        setTimeout(() => playTone(f, 0.35, 'sine', 0.1), i * 200);
      });
    },

    timerWarning() {
      playTone(880, 0.1, 'square', 0.05);
    },

    timerExpired() {
      playTone(440, 0.15, 'sawtooth', 0.08);
      setTimeout(() => playTone(330, 0.3, 'sawtooth', 0.06), 100);
    },

    turnStart() {
      playTone(660, 0.08, 'sine', 0.06);
    }
  };

  // ── BGM ──

  function startBGM() {
    if (!bgmEnabled || bgmPlaying) return;
    
    // Unlock AudioContext for other sounds
    getCtx();

    if (!bgmAudio) {
      // High-quality chill lofi track
      bgmAudio = new Audio('https://assets.codepen.io/256024/chill.mp3');
      bgmAudio.loop = true;
      bgmAudio.volume = 0.15; // Soft volume
    }

    bgmAudio.play().then(() => {
      bgmPlaying = true;
    }).catch(e => {
      console.warn("Failed to play BGM automatically:", e);
      // Wait for user interaction or reload
    });
  }

  function stopBGM() {
    if (!bgmPlaying || !bgmAudio) return;
    
    // Fade out
    let vol = bgmAudio.volume;
    const fade = setInterval(() => {
      if (vol > 0.01) {
        vol -= 0.02;
        bgmAudio.volume = Math.max(0, vol);
      } else {
        clearInterval(fade);
        bgmAudio.pause();
        bgmAudio.volume = 0.15; // Reset volume
        bgmPlaying = false;
      }
    }, 50);
  }

  // ── Public API ──

  return {
    sfx,
    startBGM,
    stopBGM,

    setSFXEnabled(enabled) {
      sfxEnabled = enabled;
    },

    setBGMEnabled(enabled) {
      bgmEnabled = enabled;
      if (enabled) {
        startBGM();
      } else {
        stopBGM();
      }
    },

    isSFXEnabled() { return sfxEnabled; },
    isBGMEnabled() { return bgmEnabled; },

    unlock() {
      getCtx();
    }
  };
})();
