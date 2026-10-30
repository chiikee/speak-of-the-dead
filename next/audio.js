// --- SOUND ENGINE ---
class WebAudioSoundEngine {
  constructor() { this.ctx = null; this.noise = null; }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      const size = Math.floor(this.ctx.sampleRate * 0.15);
      this.noise = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < size; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  tone(type, f0, f1, vol, dur, start = 0, linear = false) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime + start;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, now);
    if (linear) osc.frequency.linearRampToValueAtTime(f1, now + dur);
    else osc.frequency.exponentialRampToValueAtTime(f1, now + dur);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + dur);
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.start(now); osc.stop(now + dur);
  }

  playGunshot(isCritical = false) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(isCritical ? 3000 : 1500, now);
    filter.frequency.exponentialRampToValueAtTime(100, now + 0.12);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(isCritical ? 1.0 : 0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.14);
    src.connect(filter); filter.connect(gain); gain.connect(this.ctx.destination);
    src.start(now);
    this.tone('triangle', isCritical ? 220 : 150, 30, 0.8, 0.15);
  }

  playZombieGroan() { this.tone('sawtooth', 60 + Math.random() * 30, 45 + Math.random() * 20, 0.15, 0.4, 0, true); }
  playZombieDeath() { this.tone('square', 180, 40, 0.3, 0.25); }
  playDamage() { this.tone('sawtooth', 120, 30, 0.5, 0.3, 0, true); }
  playBossAlert() { for (let i = 0; i < 3; i++) this.tone('sine', 440 + i * 110, 440 + i * 110, 0.2, 0.08, i * 0.1); }
}
const soundEngine = new WebAudioSoundEngine();


// --- MIC VOLUME ANALYZER (same approach as before, but only set up once) ---
let micVolume = 0;
let micPeak = 0; // decaying peak, so a shout still counts when the transcript arrives a moment later
const SHOUT_THRESHOLD = 0.65;
let audioContext = null;
let analyser = null;
let microphone = null;
let micInitStarted = false;
let micStream = null;

// Release the shout meter's microphone (Android can't share the mic with speech recognition)
function stopMicVolumeAnalyzer() {
  if (micStream) micStream.getTracks().forEach((t) => t.stop());
  if (audioContext) { try { audioContext.close(); } catch (e) {} }
  micStream = null; audioContext = null; analyser = null; microphone = null;
  micInitStarted = false;
  micVolume = 0; micPeak = 0;
  // Hide the meter rather than showing "off", which could read as "the mic isn't working"
  $('mic-volume-wrap').classList.add('hidden');
}

async function initMicVolumeAnalyzer() {
  if (micInitStarted) return;
  micInitStarted = true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    micStream = stream;
    $('mic-volume-wrap').classList.remove('hidden');
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    microphone = audioContext.createMediaStreamSource(stream);
    analyser.fftSize = 256;
    microphone.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const volBar = $('mic-volume-bar');
    const volLbl = $('lbl-mic-vol');
    let wasLoud = null;

    function checkVolume() {
      if (!analyser) return;
      if (audioContext.state === 'suspended') audioContext.resume();
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
      micVolume = Math.min(1.0, (sum / dataArray.length) / 128);
      micPeak = Math.max(micVolume, micPeak * (speechEngine !== 'browser' ? 0.996 : 0.99));

      const pct = Math.floor(micVolume * 100);
      volBar.style.width = `${pct}%`;
      volLbl.textContent = `${pct}%`;
      const loud = micVolume >= SHOUT_THRESHOLD;
      if (loud !== wasLoud) {
        volBar.className = loud ? 'bg-red-500 h-full animate-pulse' : 'bg-gradient-to-r from-blue-500 via-green-500 to-red-500 h-full';
        volLbl.className = loud ? 'text-red-400 font-bold' : 'text-purple-400';
        wasLoud = loud;
      }
      requestAnimationFrame(checkVolume);
    }
    checkVolume();
  } catch (err) {
    micInitStarted = false; // allow another try next game
    console.warn('Microphone volume analyzer initialization failed:', err);
  }
}
