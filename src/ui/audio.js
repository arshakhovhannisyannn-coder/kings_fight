// Procedural sound: a tiny Web Audio synth (oscillators, noise, envelopes, filters). No audio files.
// The AudioContext is created lazily on the first user gesture (autoplay policy), so nothing plays before a click.

const vol = { master: 0.8, music: 0.5, sfx: 0.8, muted: false };
let ctx = null, masterG = null, musicG = null, sfxG = null, noiseBuf = null;
let wantedMusic = null, musicMode = null, musicTimer = null, drone = null;
let nextStepTime = 0, stepIndex = 0, melodyPos = 0, melodyLeft = 0;
const lastPlayed = new Map();

function ensure() {
  if (ctx) return true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  try {
    ctx = new AC();
  } catch { return false; }
  masterG = ctx.createGain(); musicG = ctx.createGain(); sfxG = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  musicG.connect(masterG); sfxG.connect(masterG); masterG.connect(comp); comp.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  applyVolumes();
  return true;
}
function applyVolumes() {
  if (!ctx) return;
  const t = ctx.currentTime;
  masterG.gain.setTargetAtTime(vol.muted ? 0 : vol.master, t, 0.03);
  sfxG.gain.setTargetAtTime(vol.sfx, t, 0.03);
  musicG.gain.setTargetAtTime(vol.music * 0.5, t, 0.2);
}

/** One enveloped oscillator note. */
function tone({ type = 'sine', f = 440, f2 = null, t = 0, dur = 0.1, gain = 0.2, attack = 0.005, out = sfxG, lp = 0, vib = 0 }) {
  const t0 = ctx.currentTime + t;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t0);
  if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  let node = o, lfo = null;
  if (lp) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; fl.Q.value = 1.5; o.connect(fl); node = fl; }
  if (vib) { lfo = ctx.createOscillator(); const lg = ctx.createGain(); lfo.frequency.value = 5.2; lg.gain.value = vib; lfo.connect(lg); lg.connect(o.detune); lfo.start(t0); lfo.stop(t0 + dur + 0.05); }
  node.connect(g); g.connect(out);
  o.start(t0); o.stop(t0 + dur + 0.05);
  o.onended = () => { g.disconnect(); };
}
/** Filtered noise burst. */
function noise({ t = 0, dur = 0.1, gain = 0.2, type = 'lowpass', f = 1000, f2 = null, q = 1, out = sfxG }) {
  const t0 = ctx.currentTime + t;
  const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; s.loop = true;
  fl.type = type; fl.Q.value = q;
  fl.frequency.setValueAtTime(f, t0);
  if (f2) fl.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(fl); fl.connect(g); g.connect(out);
  s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.05);
  s.onended = () => { g.disconnect(); };
}

const SFX = {
  click: () => tone({ type: 'triangle', f: 620, f2: 480, dur: 0.06, gain: 0.12 }),
  hover: () => tone({ f: 900, dur: 0.035, gain: 0.03 }),
  pick: () => tone({ type: 'triangle', f: 480, f2: 720, dur: 0.08, gain: 0.14 }),
  place: () => { tone({ f: 170, f2: 70, dur: 0.14, gain: 0.3 }); noise({ dur: 0.09, gain: 0.12, f: 900 }); },
  invalid: () => { tone({ type: 'sawtooth', f: 190, f2: 130, dur: 0.16, gain: 0.08, lp: 900 }); },
  tick: () => tone({ type: 'square', f: 1040, dur: 0.035, gain: 0.05, lp: 3000 }),
  ready: () => { tone({ type: 'triangle', f: 523, dur: 0.1, gain: 0.14 }); tone({ type: 'triangle', f: 784, t: 0.09, dur: 0.16, gain: 0.14 }); },
  drum: () => { tone({ f: 120, f2: 48, dur: 0.32, gain: 0.5 }); noise({ dur: 0.12, gain: 0.16, f: 500 }); },
  flip: () => { noise({ dur: 0.07, gain: 0.1, type: 'highpass', f: 2500 }); tone({ type: 'triangle', f: 880, f2: 1320, t: 0.03, dur: 0.07, gain: 0.07 }); },
  step: () => noise({ dur: 0.05, gain: 0.035, f: 320 }),
  sword: () => { noise({ dur: 0.07, gain: 0.12, type: 'bandpass', f: 3400, q: 3 }); tone({ type: 'triangle', f: 1900, f2: 1500, dur: 0.09, gain: 0.05 }); },
  arrow: () => noise({ dur: 0.13, gain: 0.1, type: 'bandpass', f: 2600, f2: 700, q: 4 }),
  stone: () => { noise({ dur: 0.1, gain: 0.09, type: 'bandpass', f: 1200, f2: 400, q: 3 }); },
  bolt: () => tone({ type: 'sawtooth', f: 760, f2: 220, dur: 0.11, gain: 0.07, lp: 2400 }),
  cannon: () => { tone({ f: 95, f2: 38, dur: 0.4, gain: 0.5 }); noise({ dur: 0.3, gain: 0.25, f: 700, f2: 150 }); },
  fire: () => { noise({ dur: 0.55, gain: 0.22, f: 350, f2: 2400 }); tone({ type: 'sawtooth', f: 90, f2: 180, dur: 0.4, gain: 0.08, lp: 600 }); },
  heal: () => [660, 880, 1109, 1320].forEach((f, i) => tone({ f, t: i * 0.06, dur: 0.28, gain: 0.07 })),
  horn: () => { tone({ type: 'sawtooth', f: 220, dur: 0.3, gain: 0.14, lp: 1100, attack: 0.04 }); tone({ type: 'sawtooth', f: 330, t: 0.26, dur: 0.5, gain: 0.16, lp: 1300, attack: 0.04, vib: 10 }); },
  shield: () => { tone({ type: 'triangle', f: 1250, dur: 0.18, gain: 0.1 }); tone({ f: 1870, dur: 0.22, gain: 0.06 }); },
  death: () => tone({ type: 'triangle', f: 320, f2: 80, dur: 0.24, gain: 0.12 }),
  rumble: () => { noise({ dur: 1.0, gain: 0.4, f: 220, f2: 60 }); tone({ f: 60, f2: 30, dur: 0.9, gain: 0.45 }); },
  coin: () => { tone({ f: 1320, dur: 0.07, gain: 0.08 }); tone({ f: 1980, t: 0.06, dur: 0.14, gain: 0.08 }); },
  star: () => { tone({ type: 'triangle', f: 988, dur: 0.12, gain: 0.12 }); tone({ f: 1480, t: 0.05, dur: 0.25, gain: 0.08 }); },
  win: () => [294, 370, 440, 587, 740].forEach((f, i) => tone({ type: 'sawtooth', f, t: i * 0.13, dur: i === 4 ? 0.9 : 0.22, gain: 0.13, lp: 1800, attack: 0.02, vib: i === 4 ? 8 : 0 })),
  lose: () => [392, 370, 311, 294].forEach((f, i) => tone({ type: 'sawtooth', f, t: i * 0.28, dur: i === 3 ? 1.0 : 0.34, gain: 0.11, lp: 900, attack: 0.05, vib: 6 })),
};

// ---- music: duduk-like reed over a drone and a dhol-like drum, in a mode with an augmented second ----
const SCALE = [0, 1, 4, 5, 7, 8, 10];                    // D  Eb  F#  G  A  Bb  C
const degFreq = (deg, base) => base * 2 ** ((SCALE[((deg % 7) + 7) % 7] + 12 * Math.floor(deg / 7)) / 12);
const R = null;                                           // rest
const TUNES = {
  // [scale degree, length in steps]
  menu: { step: 0.42, base: 293.66, drum: [1, 0, 0, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 0, 0],
    notes: [[4, 3], [5, 1], [4, 2], [3, 2], [2, 4], [1, 2], [2, 2], [0, 6], [R, 2], [2, 3], [3, 1], [4, 2], [6, 2], [5, 4], [4, 2], [3, 2], [4, 6], [R, 2],
      [7, 3], [6, 1], [5, 2], [4, 2], [5, 2], [3, 2], [2, 2], [1, 2], [0, 8], [R, 4]] },
  battle: { step: 0.2, base: 293.66, drum: [1, 0, 0, 2, 2, 0, 1, 0, 2, 0, 2, 0],
    notes: [[0, 2], [2, 1], [3, 1], [4, 2], [3, 1], [2, 1], [1, 2], [0, 2], [R, 2], [4, 2], [5, 1], [4, 1], [3, 2], [2, 2], [4, 4], [R, 2],
      [7, 2], [6, 1], [5, 1], [4, 2], [5, 1], [4, 1], [3, 1], [2, 1], [1, 1], [2, 1], [0, 4], [R, 2],
      [2, 2], [4, 2], [5, 2], [4, 1], [3, 1], [2, 2], [1, 1], [0, 1], [-1, 2], [0, 6], [R, 4]] },
};
function duduk(freq, t, dur) {
  const t0 = ctx.currentTime + t;
  const o = ctx.createOscillator(), o2 = ctx.createOscillator(), fl = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
  o.type = 'sawtooth'; o2.type = 'square'; o.frequency.value = freq; o2.frequency.value = freq; o2.detune.value = 4;
  fl.type = 'lowpass'; fl.frequency.value = 950; fl.Q.value = 2.5;
  lfo.frequency.value = 5; lg.gain.value = 9; lfo.connect(lg); lg.connect(o.detune); lg.connect(o2.detune);
  const g2 = ctx.createGain(); g2.gain.value = 0.35;
  o.connect(fl); o2.connect(g2); g2.connect(fl); fl.connect(g); g.connect(musicG);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(0.13, t0 + Math.min(0.09, dur * 0.4));
  g.gain.setValueAtTime(0.13, t0 + Math.max(0.09, dur - 0.08));
  g.gain.linearRampToValueAtTime(0.0001, t0 + dur + 0.06);
  for (const n of [o, o2, lfo]) { n.start(t0); n.stop(t0 + dur + 0.1); }
  o.onended = () => g.disconnect();
}
function startDrone() {
  if (drone) return;
  const g = ctx.createGain(); g.gain.value = 0; g.connect(musicG);
  const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 500; fl.connect(g);
  const oscs = [73.42, 146.83, 220].map((f, i) => { const o = ctx.createOscillator(); o.type = i ? 'sawtooth' : 'sine'; o.frequency.value = f; const og = ctx.createGain(); og.gain.value = i ? 0.035 : 0.12; o.connect(og); og.connect(fl); o.start(); return o; });
  g.gain.setTargetAtTime(1, ctx.currentTime, 0.8);
  drone = { g, oscs };
}
function stopDrone() {
  if (!drone) return;
  const d = drone; drone = null;
  d.g.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
  setTimeout(() => { d.oscs.forEach(o => { try { o.stop(); } catch { /* already stopped */ } }); d.g.disconnect(); }, 900);
}
function schedule() {
  if (!ctx || !musicMode || ctx.state !== 'running') return;
  const tune = TUNES[musicMode];
  if (nextStepTime < ctx.currentTime) nextStepTime = ctx.currentTime + 0.05;
  while (nextStepTime < ctx.currentTime + 0.35) {
    const t = nextStepTime - ctx.currentTime;
    const d = tune.drum[stepIndex % tune.drum.length];
    if (d === 1) { tone({ f: 105, f2: 52, t, dur: 0.22, gain: 0.3, out: musicG }); }
    else if (d === 2) noise({ t, dur: 0.05, gain: 0.07, type: 'bandpass', f: 1800, q: 2, out: musicG });
    if (melodyLeft <= 0) {
      const [deg, len] = tune.notes[melodyPos % tune.notes.length];
      melodyPos++; melodyLeft = len;
      if (deg !== R) duduk(degFreq(deg, tune.base), t, len * tune.step * 0.94);
    }
    melodyLeft--; stepIndex++;
    nextStepTime += tune.step;
  }
}
function switchMusic() {
  if (!ctx) return;
  if (wantedMusic === musicMode) return;
  const to = wantedMusic;
  // crossfade: fade the bus out, switch the pattern, fade back in
  musicG.gain.setTargetAtTime(0, ctx.currentTime, 0.12);
  musicMode = null;
  setTimeout(() => {
    if (wantedMusic !== to || !ctx) return;
    musicMode = to; stepIndex = 0; melodyPos = 0; melodyLeft = 0; nextStepTime = 0;
    if (to) { startDrone(); musicG.gain.setTargetAtTime(vol.music * 0.5, ctx.currentTime, 0.4); } else stopDrone();
  }, 450);
  if (!musicTimer) musicTimer = setInterval(schedule, 100);
}

export const audio = {
  /** Read volumes from the profile settings. */
  configure(s) {
    vol.master = s.volMaster ?? 0.8; vol.music = s.volMusic ?? 0.5; vol.sfx = s.volSfx ?? 0.8; vol.muted = !!s.muted;
    applyVolumes();
  },
  /** Call from a user gesture: creates/resumes the AudioContext and starts the wanted music. */
  unlock() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();
    switchMusic();
  },
  get ready() { return !!ctx && ctx.state === 'running'; },
  get muted() { return vol.muted; },
  sfx(name) {
    if (!ctx || ctx.state !== 'running' || vol.muted || !SFX[name]) return;
    const now = performance.now();
    if (now - (lastPlayed.get(name) || 0) < 45) return; // do not stack the same sound
    lastPlayed.set(name, now);
    try { SFX[name](); } catch (e) { console.warn('sfx failed', name, e); }
  },
  /** 'menu' | 'battle' | null */
  music(mode) { wantedMusic = mode; switchMusic(); },
  names: Object.keys(SFX),
};
