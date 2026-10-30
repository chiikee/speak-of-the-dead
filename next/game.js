const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const IS_TOUCH = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
const IS_ANDROID = /Android/i.test(navigator.userAgent);

if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
  };
}


// --- DIFFICULTY ---
// baseSpeed: z units per frame (zombies spawn at 1400). spawnInterval/minInterval: frames at 60fps.
// minOnScreen: if fewer zombies than this are alive, the next one spawns immediately.
const DIFFICULTY_SETTINGS = {
  EASY:   { baseSpeed: 1.3, spawnInterval: 180, minInterval: 100, minOnScreen: 2 },
  NORMAL: { baseSpeed: 1.9, spawnInterval: 130, minInterval: 70,  minOnScreen: 3 },
  HARD:   { baseSpeed: 2.7, spawnInterval: 95,  minInterval: 45,  minOnScreen: 4 }
};
let currentDifficulty = 'EASY';

function setDifficulty(diff) {
  currentDifficulty = diff;
  const btns = { EASY: 'btn-diff-easy', NORMAL: 'btn-diff-normal', HARD: 'btn-diff-hard' };
  Object.keys(btns).forEach(d => {
    const btn = $(btns[d]);
    btn.className = 'py-2 rounded border transition-all ' + (d === diff ? 'btn-diff-active' : 'btn-diff-inactive');
    btn.setAttribute('aria-pressed', d === diff);
  });
}


// --- CANVAS & PROJECTION ---
const canvas = $('gameCanvas');
const ctx = canvas.getContext('2d');
let W = 1, H = 1;
const Z_FAR = 700;          // spawn depth: start scale D_NEAR / (Z_FAR + D_NEAR), about a fifth of full size
const Z_SPEED = Z_FAR / 1400; // speeds were tuned for a 1400-deep lane; keeps the walk time the same

function resizeCanvas() {
  const container = $('game-area');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = Math.max(1, container.clientWidth);
  H = Math.max(1, container.clientHeight);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (!isGameRunning || isPaused) render();
}

function unit() { return clamp(Math.min(W, H * 1.1) / 700, 0.55, 1.5); }

// Pinhole-camera perspective: zombies start tiny at the vanishing point and loom
// larger and faster as they close in, ending up filling the screen in front of you.
const D_NEAR = 160;          // depth (in z units) where a zombie reaches the player
function project(z, xn) {
  const horizonY = H * 0.35;
  const nearFeetY = H * 1.12; // at the player, feet are below the bottom edge
  const zc = clamp(z, 0, Z_FAR);
  const scale = D_NEAR / (zc + D_NEAR);
  // drift toward the centre (toward you) as they approach
  const xEff = xn * (0.35 + 0.65 * (zc / Z_FAR));
  return {
    x: W / 2 + xEff * W * 1.6 * scale,
    y: horizonY + (nearFeetY - horizonY) * scale,
    scale
  };
}
function bodyBase() { return Math.min(H, W * 1.2) * 0.9; }

// --- GAME STATE ---
let isGameRunning = false;
let isPaused = false;
let pausedBy = null;
let score = 0, combo = 1, playerHp = 100, totalKills = 0;
let wordsSpokenCount = 0, criticalShoutsCount = 0, maxCombo = 1;
let gameStartTime = 0, pausedTotal = 0, pauseStartedAt = 0;

let zombies = [], particleEffects = [], floatingTexts = [], mangaTexts = [];
let spawnTimer = 0, spawnInterval = 320, waveDifficulty = 1;
let targetSlowdownTimer = 0, screenShakeTimer = 0;
let nextBossAt = 8, nextRushAt = 10;
let isYabaiRushActive = false;
let loopToken = 0, lastTime = 0;

// --- ENTITIES ---
class Zombie {
  constructor(data, isBoss = false) {
    this.kana = data.kana;
    this.romaji = data.romaji;
    this.isBoss = isBoss;
    this.hp = isBoss ? 3 : 1;
    this.maxHp = this.hp;
    this.z = Z_FAR;
    this.xn = (Math.random() - 0.5) * 0.7;
    const d = DIFFICULTY_SETTINGS[currentDifficulty].baseSpeed;
    // Zombies also get faster as the waves go on (up to +60%)
    const ramp = Math.min(1.6, 1 + (waveDifficulty - 1) * 0.05);
    this.speed = (0.7 + Math.random() * 0.5) * d * ramp * Z_SPEED * (isBoss ? 0.6 : 1.0);
    this.limbAngle = Math.random() * Math.PI;
    this.hitFlash = 0;

    this.target = normJa(data.kana);
    this.single = this.target.length === 1;
    this.jaSet = new Set();
    this.roSet = new Set();
    // English words (YABAI_EN) also go in jaSet, so the streaming matcher fires once per repeat
    const english = !HAS_JA.test(data.kana);
    const r0 = english ? '' : normRomaji(data.romaji); // there the small line is the Japanese
    if (r0) this.roSet.add(r0);
    for (const f of [data.kana, ...(data.alts || [])]) {
      if (!HAS_JA.test(f)) {
        const r = normRomaji(f); if (r) this.roSet.add(r);
        if (english) { const n = normJa(f); if (n) this.jaSet.add(n); }
      } else { const n = normJa(f); if (n) this.jaSet.add(n); }
    }
  }

  update(dt) {
    const slow = targetSlowdownTimer > 0 ? 0.6 : 1.0; // speaking gives a small slow-down, not a near freeze
    this.z -= this.speed * slow * dt;
    this.limbAngle += 0.08 * slow * dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;
  }

  size(scale) { return (this.isBoss ? 1.25 : 1) * scale * bodyBase(); }

  headPos() {
    const p = project(this.z, this.xn);
    return { x: p.x, y: p.y - this.size(p.scale) * 0.83 };
  }

  draw() {
    const p = project(this.z, this.xn);
    const scale = p.scale;
    const h = this.size(scale);              // full body height in px
    const u = unit();
    const s = Math.sin(this.limbAngle);
    const flash = this.hitFlash > 0;
    const skin = flash ? '#ffffff' : (this.isBoss ? '#7e22ce' : '#4ade80');
    const shirt = flash ? '#ffffff' : (this.isBoss ? '#3b0764' : '#365314');
    const pants = flash ? '#ffffff' : (this.isBoss ? '#1e1b4b' : '#1f2937');
    const limb = this.isBoss ? '#6b21a8' : '#22c55e';

    ctx.save();
    // Distant zombies fade out of the fog
    ctx.globalAlpha = clamp(0.25 + scale * 2.2, 0, 1);
    ctx.translate(p.x, p.y);

    // Shadow on the ground
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(0, 0, h * 0.17, h * 0.035, 0, 0, Math.PI * 2);
    ctx.fill();

    const bob = -Math.abs(s) * h * 0.02;
    ctx.translate(0, bob);
    ctx.rotate(s * 0.05);                    // shambling side-to-side sway
    ctx.strokeStyle = '#000';
    ctx.lineWidth = Math.max(1, h * 0.012);

    // Legs: stepping toward the camera, the lifted foot rises and shortens
    const liftL = Math.max(0, s) * h * 0.06;
    const liftR = Math.max(0, -s) * h * 0.06;
    ctx.fillStyle = pants;
    ctx.fillRect(-h * 0.11, -h * 0.4, h * 0.095, h * 0.4 - liftL);
    ctx.strokeRect(-h * 0.11, -h * 0.4, h * 0.095, h * 0.4 - liftL);
    ctx.fillRect(h * 0.015, -h * 0.4, h * 0.095, h * 0.4 - liftR);
    ctx.strokeRect(h * 0.015, -h * 0.4, h * 0.095, h * 0.4 - liftR);

    // Torso
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.moveTo(-h * 0.17, -h * 0.72);
    ctx.lineTo(h * 0.17, -h * 0.72);
    ctx.lineTo(h * 0.14, -h * 0.38);
    ctx.lineTo(-h * 0.14, -h * 0.38);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // torn shirt hem
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.moveTo(-h * 0.06, -h * 0.38);
    ctx.lineTo(-h * 0.02, -h * 0.45);
    ctx.lineTo(h * 0.03, -h * 0.38);
    ctx.closePath();
    ctx.fill();

    // Head
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(0, -h * 0.83, h * 0.125, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Glowing eyes + mouth
    ctx.save();
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = h * 0.04;
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(-h * 0.045, -h * 0.85, h * 0.02, 0, Math.PI * 2);
    ctx.arc(h * 0.045, -h * 0.85, h * 0.02, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.775, h * 0.04, h * (0.015 + Math.abs(s) * 0.015), 0, 0, Math.PI * 2);
    ctx.fill();

    // Arms reaching out at you: foreshortened, hands closer to the camera so drawn bigger
    const reach = s * h * 0.03;
    ctx.strokeStyle = limb;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(2, h * 0.06);
    ctx.beginPath();
    ctx.moveTo(-h * 0.15, -h * 0.68);
    ctx.lineTo(-h * 0.1, -h * 0.6 + reach);
    ctx.moveTo(h * 0.15, -h * 0.68);
    ctx.lineTo(h * 0.1, -h * 0.6 - reach);
    ctx.stroke();
    ctx.fillStyle = skin;
    ctx.lineWidth = Math.max(1, h * 0.012);
    ctx.strokeStyle = '#000';
    ctx.beginPath();
    ctx.arc(-h * 0.1, -h * 0.6 + reach, h * 0.05, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.arc(h * 0.1, -h * 0.6 - reach, h * 0.05, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  // Name tag size and natural spot on the torso (like Typing of the Dead). The words are what the player reads, so they
  // only grow a little as the zombie closes in instead of shrinking into the distance.
  labelBox() {
    const p = project(this.z, this.xn);
    const scale = p.scale;
    const h = this.size(scale);
    const u = unit();
    const grow = 0.6 + 0.4 * Math.min(1, scale);
    const kanaFs = Math.round(Math.max(24, 42 * grow * u));
    const roFs = Math.round(Math.max(16, 24 * grow * u));
    ctx.font = `bold ${kanaFs}px "Kosugi Maru", "Hiragino Sans", sans-serif`;
    const kanaW = ctx.measureText(this.kana).width;
    ctx.font = `bold ${roFs}px "Share Tech Mono", monospace`;
    const roW = ctx.measureText(this.romaji).width;
    const pad = Math.max(7, 11 * grow * u);
    const tw = Math.max(kanaW, roW) + pad * 2;
    const th = kanaFs + roFs + pad * 1.2;
    const tx = clamp(p.x, tw / 2 + 4, W - tw / 2 - 4);
    const torsoY = p.y - h * 0.55; // ignores the walking bob so the text holds still
    const ty = clamp(torsoY, th / 2 + 10, H - th / 2 - 4);
    return { kanaFs, roFs, pad, tw, th, tx, ty };
  }

  drawLabel(box) {
    const { kanaFs, roFs, pad, tw, th, tx, ty } = box;
    const slowed = targetSlowdownTimer > 0;
    ctx.fillStyle = slowed ? 'rgba(8,145,178,0.9)' : 'rgba(0,0,0,0.85)';
    ctx.strokeStyle = this.isBoss ? '#facc15' : (slowed ? '#38bdf8' : '#dc2626');
    ctx.lineWidth = this.isBoss ? 2.5 : 1.5;
    ctx.beginPath();
    ctx.roundRect(tx - tw / 2, ty - th / 2, tw, th, 6);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${kanaFs}px "Kosugi Maru", "Hiragino Sans", sans-serif`;
    ctx.fillStyle = this.isBoss ? '#fef08a' : '#ffffff';
    ctx.fillText(this.kana, tx, ty - th / 2 + pad * 0.6 + kanaFs / 2);
    ctx.font = `bold ${roFs}px "Share Tech Mono", monospace`;
    ctx.fillStyle = '#facc15';
    ctx.fillText(this.romaji, tx, ty + th / 2 - pad * 0.6 - roFs / 2);

    if (this.isBoss) {
      const bw = tw * 0.8, bh = 4;
      const bx = tx - bw / 2, by = ty - th / 2 - bh - 4;
      ctx.fillStyle = '#450a0a';
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(bx, by, bw * (this.hp / this.maxHp), bh);
    }
  }
}

class Particle {
  constructor(x, y, color) {
    this.x = x; this.y = y;
    this.vx = (Math.random() - 0.5) * 8;
    this.vy = (Math.random() - 0.5) * 8 - 2;
    this.color = color;
    this.alpha = 1.0;
    this.size = (Math.random() * 4 + 2) * unit();
  }
  update(dt) { this.x += this.vx * dt; this.y += this.vy * dt; this.vy += 0.15 * dt; this.alpha -= 0.04 * dt; }
  draw() {
    ctx.globalAlpha = Math.max(0, this.alpha);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

class FloatingText {
  constructor(text, x, y, color) { this.text = text; this.x = x; this.y = y; this.color = color; this.alpha = 1.0; }
  update(dt) { this.y -= 1.2 * dt; this.alpha -= 0.02 * dt; }
  draw() {
    const fs = clamp(Math.floor((W - 24) / this.text.length), 8, 16);
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.alpha);
    ctx.font = `bold ${fs}px "Press Start 2P", monospace`;
    ctx.fillStyle = this.color;
    ctx.textAlign = 'center';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 4;
    const half = ctx.measureText(this.text).width / 2;
    ctx.fillText(this.text, clamp(this.x, half + 6, W - half - 6), this.y);
    ctx.restore();
  }
}

class MangaActionText {
  constructor(text, x, y, isYabai = false) {
    this.text = text; this.x = x; this.y = y; this.isYabai = isYabai;
    this.scale = isYabai ? 1.6 : 1.2;
    this.alpha = 1.0;
    this.rot = (Math.random() - 0.5) * 0.4;
  }
  update(dt) { this.scale += 0.03 * dt; this.alpha -= 0.025 * dt; this.y -= 1.5 * dt; }
  draw() {
    const fs = 30 * unit();
    ctx.save();
    ctx.font = `900 ${fs}px "Kosugi Maru", "Press Start 2P", sans-serif`;
    const maxScale = (W * 0.95) / Math.max(1, ctx.measureText(this.text).width);
    const s = Math.min(this.scale, maxScale);
    ctx.translate(clamp(this.x, 40, W - 40), this.y);
    ctx.rotate(this.rot);
    ctx.scale(s, s);
    ctx.globalAlpha = Math.max(0, this.alpha);
    ctx.textAlign = 'center';
    ctx.lineWidth = 6;
    ctx.strokeStyle = this.isYabai ? '#facc15' : '#000';
    ctx.strokeText(this.text, 0, 0);
    ctx.fillStyle = this.isYabai ? '#ef4444' : '#ffffff';
    ctx.fillText(this.text, 0, 0);
    ctx.restore();
  }
}

function createBloodSplat(x, y, color = '#dc2626') {
  for (let i = 0; i < 18; i++) particleEffects.push(new Particle(x, y, color));
}

function triggerMuzzleFlash() {
  const flash = $('muzzle-flash');
  flash.style.opacity = '1';
  setTimeout(() => { flash.style.opacity = '0'; }, 60);
}

function triggerDamageFlash() {
  const flash = $('damage-flash');
  flash.style.opacity = '1';
  setTimeout(() => { flash.style.opacity = '0'; }, 150);
}

// --- PAUSE & CHART ---
function togglePause(by = 'user') {
  if (!isGameRunning) return;
  isPaused = !isPaused;
  const pauseOverlay = $('pause-overlay');
  if (isPaused) {
    pausedBy = by;
    pauseStartedAt = Date.now();
    if (by !== 'chart') pauseOverlay.classList.remove('hidden');
  } else {
    pausedBy = null;
    pausedTotal += Date.now() - pauseStartedAt;
    pauseOverlay.classList.add('hidden');
    // The game loop keeps running while paused, so no new loop is started here.
    // Recognition may have ended during the pause, so restart it (this runs inside the click).
    if (speechEngine === 'browser') safeStartRecognition();
  }
}

function toggleCheatSheet() {
  const modal = $('cheatsheet-modal');
  const opening = modal.classList.contains('hidden');
  modal.classList.toggle('hidden');
  if (opening) {
    if (isGameRunning && !isPaused) togglePause('chart');
  } else if (isPaused && pausedBy === 'chart') {
    togglePause();
  }
}

// --- SHOOTING ---
function tryShoot(texts, fromVoice) {
  if (!isGameRunning || isPaused || zombies.length === 0) return false;
  const cands = texts.filter((t) => t && t.trim()).map(buildCandidate);
  if (!cands.length) return false;
  const ordered = [...zombies].sort((a, b) => a.z - b.z); // closest first
  for (const z of ordered) {
    for (const c of cands) {
      if (matchesZombie(z, c)) { executeShot(z, fromVoice); return true; }
    }
  }
  return false;
}

// Streaming matcher: walks through the transcript and fires once per occurrence,
// so “やばいやばいやばい” shoots three times instead of once.
const SMALL_KANA = /^[っぁぃぅぇぉゃゅょ]+/;

function shootNextInStream(ja, st, isFinal, fromVoice) {
  if (!isGameRunning || isPaused || zombies.length === 0) return false;
  const rest = ja.slice(st.pos);
  if (!rest) return false;
  const ordered = [...zombies].sort((a, b) => a.z - b.z); // closest zombie wins ties
  let best = null;

  // Words and phrases: earliest occurrence in the unused part of the transcript
  for (const z of ordered) {
    if (z.single) continue;
    for (const f of z.jaSet) {
      if (!(f.length >= 2 || HAS_KANJI.test(f))) continue;
      const idx = rest.indexOf(f);
      if (idx >= 0 && (!best || idx < best.idx)) best = { z, idx, len: f.length };
    }
  }

  // Single kana: earliest character that is a target sound
  const limit = best ? best.idx : rest.length;
  for (let p = 0; p < limit; p++) {
    const ch = rest[p];
    if (SMALL_KANA.test(ch)) continue;
    // Hold off while this could still be the start of a longer word that’s on screen
    const tail = rest.slice(p);
    const couldBeWord = !isFinal && ordered.some((z) => !z.single &&
      [...z.jaSet].some((f) => f.length > tail.length && f.startsWith(tail)));
    if (couldBeWord) break;
    const z = ordered.find((zz) => zz.single && zz.jaSet.has(ch));
    if (z) {
      const small = (rest.slice(p + 1).match(SMALL_KANA) || [''])[0].length;
      best = { z, idx: p, len: 1 + small };
      break;
    }
  }

  if (!best) return false;
  st.pos += best.idx + best.len;
  st.shots++;
  executeShot(best.z, fromVoice);
  return true;
}

function executeShot(zombie, fromVoice) {
  wordsSpokenCount++;

  const isCritical = fromVoice && micPeak >= SHOUT_THRESHOLD;
  if (isCritical) { criticalShoutsCount++; micPeak = 0; }

  soundEngine.playGunshot(isCritical);
  triggerMuzzleFlash();

  zombie.hp -= isCritical ? 2 : 1;
  zombie.hitFlash = 6;

  const { x, y } = zombie.headPos();
  createBloodSplat(x, y, isCritical ? '#f43f5e' : '#dc2626');

  if (isYabaiMode() || zombie.romaji === 'yabai') {
    screenShakeTimer = 15;
    mangaTexts.push(new MangaActionText(yabaiItem().kana.replace(/!*$/, '!!!'), x, y - 40, true));
  } else if (isCritical) {
    mangaTexts.push(new MangaActionText('ドカン!', x, y - 30, false));
    floatingTexts.push(new FloatingText('CRITICAL SHOUT! +500', x, y - 50, '#c026d3'));
  }

  if (zombie.hp <= 0) {
    soundEngine.playZombieDeath();
    zombies = zombies.filter((z) => z !== zombie);
    combo++;
    if (combo > maxCombo) maxCombo = combo;
    totalKills++;

    if (isYabaiMode() && totalKills >= nextRushAt && !isYabaiRushActive) {
      triggerYabaiRush();
    }

    const pts = ((zombie.isBoss ? 1000 : 200) + (isCritical ? 500 : 0)) * combo;
    score += pts;
    floatingTexts.push(new FloatingText(`+${pts}`, x, y, '#facc15'));
    updateHUD();
  } else {
    floatingTexts.push(new FloatingText('HIT!', x, y, '#38bdf8'));
  }
}

function triggerYabaiRush() {
  isYabaiRushActive = true;
  nextRushAt = totalKills + 15; // next rush only after 15 more kills
  screenShakeTimer = 35;
  soundEngine.playBossAlert();

  const token = loopToken;
  const hordeSize = 8;
  for (let i = 0; i < hordeSize; i++) {
    setTimeout(() => {
      if (i === hordeSize - 1) isYabaiRushActive = false;
      if (token !== loopToken || !isGameRunning) return;
      const zb = new Zombie(yabaiItem(), false);
      zb.xn = (Math.random() - 0.5) * 0.85;
      zb.z = Z_FAR * (0.79 + Math.random() * 0.21);
      zb.speed *= 1.35;
      zombies.push(zb);
      soundEngine.playZombieGroan();
    }, i * 150);
  }

  mangaTexts.push(new MangaActionText('😱 YABAI RUSH!! 😱', W / 2, H * 0.4, true));
  floatingTexts.push(new FloatingText('YABAI HORDE INCOMING!!', W / 2, H * 0.25, '#ef4444'));
}

// --- SPAWNING & UPDATE ---
function spawnZombie() {
  let pool;
  switch (currentKanaMode) {
    case 'H_BASIC': pool = KANA_BANKS.H_BASIC; break;
    case 'H_WORDS': pool = KANA_BANKS.H_WORDS; break;
    case 'K_BASIC': pool = KANA_BANKS.K_BASIC; break;
    case 'K_WORDS': pool = KANA_BANKS.K_WORDS; break;
    case 'YABAI':
    case 'YABAI_EN':
      pool = (isYabaiRushActive || Math.random() < 0.4) ? [yabaiItem()] : yabaiBank();
      break;
    default:
      pool = [].concat(KANA_BANKS.H_BASIC, KANA_BANKS.H_WORDS, KANA_BANKS.K_BASIC, KANA_BANKS.K_WORDS);
  }

  if (!isYabaiMode() && totalKills >= nextBossAt && !zombies.some((z) => z.isBoss)) {
    nextBossAt = totalKills + 8; // a new boss every 8 kills
    const item = KANA_BANKS.BOSS_PHRASES[Math.floor(Math.random() * KANA_BANKS.BOSS_PHRASES.length)];
    zombies.push(new Zombie(item, true));
    soundEngine.playBossAlert();
    floatingTexts.push(new FloatingText('WARNING: BOSS APPROACHING!', W / 2, H * 0.3, '#c026d3'));
  } else {
    zombies.push(new Zombie(pool[Math.floor(Math.random() * pool.length)], false));
  }
  soundEngine.playZombieGroan();
}

function updateGameLogic(dt) {
  targetSlowdownTimer = Math.max(0, targetSlowdownTimer - dt);
  screenShakeTimer = Math.max(0, screenShakeTimer - dt);

  waveDifficulty = 1 + Math.floor(totalKills / 4);
  const cfg = DIFFICULTY_SETTINGS[currentDifficulty];
  spawnTimer += dt;
  // Never leave the field empty: top up straight away when below the minimum
  const tooFew = zombies.length < cfg.minOnScreen;
  if (spawnTimer >= spawnInterval || (tooFew && spawnTimer >= 20)) {
    spawnTimer = 0;
    spawnInterval = Math.max(cfg.minInterval, cfg.spawnInterval - (waveDifficulty - 1) * 10);
    spawnZombie();
  }

  for (let i = zombies.length - 1; i >= 0; i--) {
    const z = zombies[i];
    z.update(dt);
    if (z.z <= 0) {
      playerHp -= z.isBoss ? 35 : 15;
      combo = 1;
      zombies.splice(i, 1);
      soundEngine.playDamage();
      triggerDamageFlash();
      if (playerHp <= 0) {
        playerHp = 0;
        updateHUD();
        gameOver();
        return;
      }
      updateHUD();
    }
  }

  for (const list of [mangaTexts, particleEffects, floatingTexts]) {
    for (let i = list.length - 1; i >= 0; i--) {
      list[i].update(dt);
      if (list[i].alpha <= 0) list.splice(i, 1);
    }
  }
}


// --- RENDER ---
function render() {
  const horizonY = H * 0.35;
  const u = unit();

  ctx.fillStyle = '#08070c';
  ctx.fillRect(0, 0, W, H);

  const sky = ctx.createLinearGradient(0, 0, 0, horizonY);
  sky.addColorStop(0, '#020205');
  sky.addColorStop(1, '#2e1065');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, horizonY);

  ctx.save();
  ctx.shadowColor = '#dc2626';
  ctx.shadowBlur = 30;
  ctx.fillStyle = '#991b1b';
  ctx.beginPath();
  ctx.arc(W * 0.8, horizonY * 0.5, 40 * u, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const ground = ctx.createLinearGradient(0, horizonY, 0, H);
  ground.addColorStop(0, '#090514');
  ground.addColorStop(1, '#1e0826');
  ctx.fillStyle = ground;
  ctx.fillRect(0, horizonY, W, H - horizonY);

  // Ground grid drawn with the same camera as the zombies
  ctx.strokeStyle = 'rgba(217,70,239,0.18)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = -8; i <= 8; i++) {
    ctx.moveTo(W / 2, horizonY);             // all lines meet at the vanishing point
    ctx.lineTo(W / 2 + i * W * 0.22, H * 1.12);
  }
  for (let d = 0; d <= Z_FAR; d += Z_FAR / 10) {
    const y = project(d, 0).y;
    if (y > H) continue;
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
  }
  ctx.stroke();

  // Fog at the horizon
  const fog = ctx.createLinearGradient(0, horizonY - 10, 0, horizonY + H * 0.12);
  fog.addColorStop(0, 'rgba(46,16,101,0.55)');
  fog.addColorStop(1, 'rgba(46,16,101,0)');
  ctx.fillStyle = fog;
  ctx.fillRect(0, horizonY - 10, W, H * 0.12 + 10);

  zombies.sort((a, b) => b.z - a.z);

  ctx.save();
  if (screenShakeTimer > 0) {
    ctx.translate((Math.random() - 0.5) * screenShakeTimer * 0.8, (Math.random() - 0.5) * screenShakeTimer * 0.8);
  }
  zombies.forEach((z) => z.draw());
  // Labels overlap on purpose: drawn far-to-near, the nearest covers the ones behind until it's shot
  zombies.forEach((z) => z.drawLabel(z.labelBox()));
  particleEffects.forEach((p) => p.draw());
  mangaTexts.forEach((m) => m.draw());
  floatingTexts.forEach((f) => f.draw());
  ctx.restore();
}

// One loop per game; dt keeps speed the same on 60Hz and 120Hz screens
function startLoop() {
  const token = ++loopToken;
  lastTime = performance.now();
  function gameLoop(now) {
    if (token !== loopToken) return;
    const dt = clamp((now - lastTime) / 16.667, 0, 3);
    lastTime = now;
    if (isGameRunning && !isPaused) updateGameLogic(dt);
    render();
    if (isGameRunning) requestAnimationFrame(gameLoop);
  }
  requestAnimationFrame(gameLoop);
}

// --- HUD & FLOW ---
function updateHUD() {
  $('hud-score').textContent = String(score).padStart(6, '0');
  $('hud-combo').textContent = `x${combo}`;
  $('hud-hp-val').textContent = `${Math.max(0, playerHp)}%`;
  $('hud-hp-bar').style.width = `${Math.max(0, playerHp)}%`;
}

function returnToMainMenu() {
  isGameRunning = false;
  isPaused = false;
  pausedBy = null;
  loopToken++;
  zombies = []; particleEffects = []; floatingTexts = []; mangaTexts = [];
  $('pause-overlay').classList.add('hidden');
  $('gameover-overlay').classList.add('hidden');
  $('menu-overlay').classList.remove('hidden');
  $('hud-stats').classList.add('hidden');
  render();
}

function startGame() {
  soundEngine.init();
  // On Android the browser's speech recognition hears only silence if the page also opens the
  // mic (confirmed on a Pixel 9 Pro), so the shout meter stays off there with the browser engine.
  const shareMic = !(IS_ANDROID && speechEngine === 'browser');
  if (shareMic) initMicVolumeAnalyzer(); else stopMicVolumeAnalyzer();
  resizeCanvas();

  isGameRunning = true;
  isPaused = false;
  pausedBy = null;
  isYabaiRushActive = false;
  score = 0; combo = 1; playerHp = 100; totalKills = 0;
  wordsSpokenCount = 0; criticalShoutsCount = 0; maxCombo = 1;
  waveDifficulty = 1; targetSlowdownTimer = 0; screenShakeTimer = 0;
  nextBossAt = 8; nextRushAt = 10;
  spawnTimer = 0;
  spawnInterval = DIFFICULTY_SETTINGS[currentDifficulty].spawnInterval;
  zombies = []; particleEffects = []; floatingTexts = []; mangaTexts = [];
  gameStartTime = Date.now();
  pausedTotal = 0;

  $('menu-overlay').classList.add('hidden');
  $('gameover-overlay').classList.add('hidden');
  $('pause-overlay').classList.add('hidden');
  $('hud-stats').classList.remove('hidden');

  updateHUD();
  if (speechEngine === 'browser') {
    safeStartRecognition();
  } else if (isEnglishMode()) {
    useKeyboardInstead();
  } else {
    startLocalCapture().catch((err) => footerStatus(`Microphone error: ${err.name || ''} ${err.message || err}`));
  }

  spawnZombie();
  spawnZombie();
  zombies[1].z = Z_FAR * 0.82;

  startLoop();

  if ($('chk-keyboard-fallback').checked && !IS_TOUCH) $('type-shooter-input').focus();
}

function gameOver() {
  isGameRunning = false;
  isPaused = false;

  const elapsedMinutes = Math.max(0.1, (Date.now() - gameStartTime - pausedTotal) / 60000);
  $('go-score').textContent = score;
  $('go-kills').textContent = totalKills;
  $('go-wpm').textContent = Math.floor(wordsSpokenCount / elapsedMinutes);
  $('go-combo').textContent = `x${maxCombo}`;
  $('go-shouts').textContent = criticalShoutsCount;
  $('gameover-overlay').classList.remove('hidden');
}

function toggleKeyboardFallbackContainer(show) {
  $('keyboard-input-container').classList.toggle('hidden', !show);
}

// --- KANA CHART ---
function buildCharts() {
  const rows = [
    ['あいうえお', 'a i u e o'], ['かきくけこ', 'ka ki ku ke ko'], ['さしすせそ', 'sa shi su se so'],
    ['たちつてと', 'ta chi tsu te to'], ['なにぬねの', 'na ni nu ne no'], ['はひふへほ', 'ha hi fu he ho'],
    ['まみむめも', 'ma mi mu me mo'], ['や_ゆ_よ', 'ya _ yu _ yo'], ['らりるれろ', 'ra ri ru re ro'],
    ['わ___を', 'wa _ _ _ wo'], ['ん____', 'n _ _ _ _'],
    ['がぎぐげご', 'ga gi gu ge go'], ['ざじずぜぞ', 'za ji zu ze zo'], ['だぢづでど', 'da ji zu de do'],
    ['ばびぶべぼ', 'ba bi bu be bo'], ['ぱぴぷぺぽ', 'pa pi pu pe po']
  ];
  const fill = (el, toScript, color) => {
    const html = [];
    rows.forEach(([kana, ro], r) => {
      const romaji = ro.split(' ');
      if (r === 11) html.push('<div class="col-span-5 text-[10px] text-gray-500 font-arcade pt-2 text-left">DAKUTEN ゛ ゜</div>');
      [...kana].forEach((k, i) => {
        if (k === '_') { html.push('<div></div>'); return; }
        html.push(`<div class="p-1 bg-zinc-900 rounded"><span class="text-lg ${color} block">${toScript(k)}</span><span class="text-[10px] text-gray-400">${romaji[i]}</span></div>`);
      });
    });
    el.innerHTML = html.join('');
  };
  fill($('chart-hira'), (k) => k, 'text-yellow-300');
  fill($('chart-kata'), hiraToKata, 'text-cyan-300');
}
