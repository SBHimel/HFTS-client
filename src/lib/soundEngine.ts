/**
 * Web Audio API Sound Engine for HFTS Horizon
 * Pure client-side synthesis: zero external audio files, zero latency.
 * Default: Sound ON with graceful 2s auto-activation & user-gesture fallback.
 * Strictly respects manual user mute choice.
 */

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let compressor: DynamicsCompressorNode | null = null;

let isMuted = false; // Sound ON by default
let userManuallyMuted = false; // Never override user's manual mute
let lastBurstTime = 0;
let lastLaunchTime = 0;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;

  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();

      // Master Compressor for cinematic depth and clipping prevention
      compressor = audioCtx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-14, audioCtx.currentTime);
      compressor.knee.setValueAtTime(24, audioCtx.currentTime);
      compressor.ratio.setValueAtTime(6, audioCtx.currentTime);
      compressor.attack.setValueAtTime(0.003, audioCtx.currentTime);
      compressor.release.setValueAtTime(0.2, audioCtx.currentTime);

      // Master Gain
      masterGain = audioCtx.createGain();
      masterGain.gain.setValueAtTime(isMuted ? 0 : 1, audioCtx.currentTime);

      masterGain.connect(compressor);
      compressor.connect(audioCtx.destination);
    }
  }

  if (audioCtx && audioCtx.state === "suspended" && !isMuted && !userManuallyMuted) {
    audioCtx.resume().catch(() => {});
  }

  return audioCtx;
}

export function isSoundEnabled(): boolean {
  return !isMuted;
}

export function setSoundEnabled(enabled: boolean): boolean {
  isMuted = !enabled;
  if (!enabled) {
    userManuallyMuted = true;
    if (masterGain && audioCtx) {
      masterGain.gain.setValueAtTime(0, audioCtx.currentTime);
    }
  } else {
    userManuallyMuted = false;
    const ctx = getAudioContext();
    if (masterGain && ctx) {
      masterGain.gain.setValueAtTime(1, ctx.currentTime);
    }
  }
  return !isMuted;
}

export function toggleSound(): boolean {
  return setSoundEnabled(isMuted);
}

/**
 * Setup audio auto-start:
 * 1. Attempt activation 2 seconds after page load.
 * 2. If browser blocks autoplay, resume on first user interaction.
 * 3. Never unmute if user manually muted.
 */
export function setupAutoPlay(): () => void {
  if (typeof window === "undefined") return () => {};

  // Attempt auto-activation after 2 seconds
  const autoTimer = setTimeout(() => {
    if (!userManuallyMuted && !isMuted) {
      const ctx = getAudioContext();
      if (ctx && ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
    }
  }, 2000);

  // Fallback on first user interaction if autoplay was blocked
  const onUserInteraction = () => {
    if (!userManuallyMuted && !isMuted) {
      const ctx = getAudioContext();
      if (ctx && ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
    }
  };

  window.addEventListener("pointerdown", onUserInteraction, { once: true, passive: true });
  window.addEventListener("keydown", onUserInteraction, { once: true, passive: true });

  return () => {
    clearTimeout(autoTimer);
    window.removeEventListener("pointerdown", onUserInteraction);
    window.removeEventListener("keydown", onUserInteraction);
  };
}

/**
 * Crisp, pleasant whoosh for firework launch
 * Soft ascending filtered noise + gentle sine undertone
 */
export function playLaunchSound(): void {
  if (isMuted || userManuallyMuted) return;
  const ctx = getAudioContext();
  if (!ctx || !masterGain || ctx.state !== "running") return;

  const now = ctx.currentTime;
  // Throttle rapid launch sounds (min 70ms between launches)
  if (now - lastLaunchTime < 0.07) return;
  lastLaunchTime = now;

  try {
    // 1. Filtered air-whoosh noise
    const bufferSize = Math.floor(ctx.sampleRate * 0.22);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * 0.6;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(320, now);
    filter.frequency.exponentialRampToValueAtTime(850, now + 0.2);
    filter.Q.setValueAtTime(3.0, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.005, now);
    noiseGain.gain.linearRampToValueAtTime(0.038, now + 0.05);
    noiseGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.22);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(masterGain);

    noise.start(now);
    noise.stop(now + 0.23);

    // 2. Subtle melodic whistle overtone
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();

    osc.type = "sine";
    const startFreq = 260 + Math.random() * 40;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(startFreq * 2.2, now + 0.2);

    oscGain.gain.setValueAtTime(0.002, now);
    oscGain.gain.linearRampToValueAtTime(0.02, now + 0.06);
    oscGain.gain.exponentialRampToValueAtTime(0.0002, now + 0.2);

    osc.connect(oscGain);
    oscGain.connect(masterGain);

    osc.start(now);
    osc.stop(now + 0.21);
  } catch (_e) {
    // Audio context error ignore
  }
}

/**
 * Crisp, cinematic firework explosion
 * Punchy low-end thump + crisp resonant shell pop + soft glitter tail
 */
export function playBurstSound(): void {
  if (isMuted || userManuallyMuted) return;
  const ctx = getAudioContext();
  if (!ctx || !masterGain || ctx.state !== "running") return;

  const now = ctx.currentTime;
  // Limit concurrent explosion sounds to avoid cacophony
  if (now - lastBurstTime < 0.055) return;
  lastBurstTime = now;

  try {
    const pitchVariation = 0.9 + Math.random() * 0.2; // subtle pitch variance

    // 1. Deep cinematic low-end boom
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();

    subOsc.type = "sine";
    subOsc.frequency.setValueAtTime(105 * pitchVariation, now);
    subOsc.frequency.exponentialRampToValueAtTime(30, now + 0.32);

    subGain.gain.setValueAtTime(0.001, now);
    subGain.gain.linearRampToValueAtTime(0.075, now + 0.015);
    subGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.32);

    subOsc.connect(subGain);
    subGain.connect(masterGain);

    subOsc.start(now);
    subOsc.stop(now + 0.33);

    // 2. Crisp shell crack / resonant mid-pop
    const popOsc = ctx.createOscillator();
    const popGain = ctx.createGain();

    popOsc.type = "triangle";
    popOsc.frequency.setValueAtTime(220 * pitchVariation, now);
    popOsc.frequency.exponentialRampToValueAtTime(65, now + 0.12);

    popGain.gain.setValueAtTime(0.045, now);
    popGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.12);

    popOsc.connect(popGain);
    popGain.connect(masterGain);

    popOsc.start(now);
    popOsc.stop(now + 0.13);

    // 3. Gentle sparkling crackle tail
    const crackleLength = Math.floor(ctx.sampleRate * 0.28);
    const crackleBuffer = ctx.createBuffer(1, crackleLength, ctx.sampleRate);
    const data = crackleBuffer.getChannelData(0);
    for (let i = 0; i < crackleLength; i++) {
      // Sporadic pleasant crackles rather than harsh continuous hiss
      data[i] = Math.random() > 0.88 ? (Math.random() * 2 - 1) * 0.5 : 0;
    }

    const crackleSource = ctx.createBufferSource();
    crackleSource.buffer = crackleBuffer;

    const crackleFilter = ctx.createBiquadFilter();
    crackleFilter.type = "highpass";
    crackleFilter.frequency.setValueAtTime(1400, now);

    const crackleGain = ctx.createGain();
    crackleGain.gain.setValueAtTime(0.025, now);
    crackleGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.28);

    crackleSource.connect(crackleFilter);
    crackleFilter.connect(crackleGain);
    crackleGain.connect(masterGain);

    crackleSource.start(now + 0.02);
    crackleSource.stop(now + 0.3);
  } catch (_e) {
    // Ignore audio error
  }
}

/**
 * Gentle ethereal harmonic chord for sky lantern release
 */
export function playLanternReleaseSound(): void {
  if (isMuted || userManuallyMuted) return;
  const ctx = getAudioContext();
  if (!ctx || !masterGain || ctx.state !== "running") return;

  try {
    const now = ctx.currentTime;
    const frequencies = [440, 660, 880]; // A4, E5, A5 ethereal chord

    frequencies.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.04);

      gain.gain.setValueAtTime(0.001, now + idx * 0.04);
      gain.gain.linearRampToValueAtTime(0.035, now + idx * 0.04 + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0003, now + 1.2);

      osc.connect(gain);
      gain.connect(masterGain!);

      osc.start(now + idx * 0.04);
      osc.stop(now + 1.25);
    });
  } catch (_e) {
    // Ignore
  }
}

/**
 * Soft chime for lantern spark reaction
 */
export function playSparkSound(): void {
  if (isMuted || userManuallyMuted) return;
  const ctx = getAudioContext();
  if (!ctx || !masterGain || ctx.state !== "running") return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(988, now); // B5
    osc.frequency.exponentialRampToValueAtTime(1318, now + 0.18); // E6

    gain.gain.setValueAtTime(0.005, now);
    gain.gain.linearRampToValueAtTime(0.035, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.22);

    osc.connect(gain);
    gain.connect(masterGain!);

    osc.start(now);
    osc.stop(now + 0.23);
  } catch (_e) {
    // Ignore
  }
}
