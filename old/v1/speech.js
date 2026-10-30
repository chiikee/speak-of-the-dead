// --- SPEECH RECOGNITION (startup flow unchanged from the working version) ---
let recognition = null;
let isSpeechActive = false;
let streamState = new Map(); // per phrase: how much of its transcript has already been used for shots
let prevFinal = { ja: '', index: -1 }; // last finished phrase this session (for Android's repeats)

function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    $('stt-support-badge').textContent = 'NO STT';
    $('stt-support-badge').className = 'shrink-0 px-2 py-0.5 rounded text-[9px] font-arcade bg-red-950 text-red-400 border border-red-700';
    $('mic-status-text').textContent = 'This browser has no speech service, so the built-in engine is selected.';
    setEngine('local');
    return;
  }

  recognition = new SpeechRecognition();
  // Keep listening across pauses, so there's no gap where words get lost while restarting.
  // (Android's habit of repeating earlier phrases in continuous mode is handled in onresult.)
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'ja-JP';
  recognition.maxAlternatives = 3;

  recognition.onstart = () => {
    isSpeechActive = true;
    streamState = new Map();
    prevFinal = { ja: '', index: -1 };
    $('mic-dot').className = 'w-3 h-3 shrink-0 rounded-full bg-green-500 animate-pulse';
    $('mic-status-text').textContent = 'Japanese speech recognition is on. Speak now!';
    $('mic-ping').style.opacity = '1';
    footerStatus('Speech recognition is listening. Say something!');
  };

  recognition.onerror = (event) => {
    console.warn('Speech Recognition error:', event.error);
    if (event.error !== 'no-speech' && event.error !== 'aborted') {
      footerStatus(`Speech recognition error: ${event.error}${event.message ? ' (' + event.message + ')' : ''}`);
    }
    // Brave, Opera and similar browsers have the API but no speech service behind it
    if ((event.error === 'network' || event.error === 'service-not-allowed') && speechEngine === 'browser') {
      fallbackToBuiltIn();
    }
    if (event.error === 'not-allowed') {
      $('mic-status-text').textContent = 'Microphone permission denied. Use the keyboard bar.';
      $('chk-keyboard-fallback').checked = true;
      toggleKeyboardFallbackContainer(true);
    }
  };

  recognition.onend = () => {
    isSpeechActive = false;
    if (isGameRunning && !isPaused && speechEngine === 'browser') {
      setTimeout(() => { safeStartRecognition(); }, 100);
    } else {
      $('mic-dot').className = 'w-3 h-3 shrink-0 rounded-full bg-yellow-500';
      $('mic-ping').style.opacity = '0';
    }
  };

  recognition.onresult = (event) => {
    let banner = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const res = event.results[i];
      const alts = [];
      for (let j = 0; j < res.length; j++) alts.push(res[j].transcript);
      banner = alts[0] || banner;

      const ja = normJa(alts[0] || '');

      // Android in continuous mode sometimes starts a new result with the previous phrase again
      // ("やばい" then "やばいねこ"). Skip the repeated part so old words don't fire twice.
      // An exact repeat only counts once it's final, since saying the same word again is legit.
      let skipTo = 0, waitForMore = false;
      if (IS_ANDROID && prevFinal.ja && i > prevFinal.index) {
        if (ja === prevFinal.ja) waitForMore = !res.isFinal;
        else if (ja.startsWith(prevFinal.ja)) skipTo = prevFinal.ja.length;
      }
      if (res.isFinal) prevFinal = { ja, index: i };

      if (!isGameRunning || isPaused || waitForMore) continue;
      targetSlowdownTimer = 25;
      let st = streamState.get(i);
      if (!st) { st = { pos: 0, shots: 0 }; streamState.set(i, st); }
      st.pos = Math.max(st.pos, skipTo);
      if (st.pos > ja.length) st.pos = ja.length;           // transcript was revised shorter
      while (shootNextInStream(ja, st, res.isFinal, true)) {} // one shot per word said, even back to back
      if (res.isFinal && st.shots === 0 && skipTo === 0 && tryShoot(alts, true)) st.shots++; // romaji/alternatives fallback
      st.pos = Math.max(st.pos, ja.length - 10);           // forget old speech that matched nothing
    }
    updateSpeechBanner(banner);
  };
}

function safeStartRecognition() {
  if (recognition && !isSpeechActive) {
    try { recognition.start(); } catch (e) { footerStatus(`Couldn’t start speech recognition: ${e.message}`); }
  }
}

// Status line in the footer, visible during play
function footerStatus(msg) {
  console.log('[speech]', msg);
  $('speech-transcript-display').textContent = `⚙ ${msg}`;
}

function updateSpeechBanner(text) {
  if (text && text.trim()) $('speech-transcript-display').textContent = `“${text.trim()}”`;
}

// --- BUILT-IN SPEECH ENGINES -------------------------------------------------------------
// 'browser' = Web Speech API (Chrome/Edge/Safari), 'local' = Vosk running in the page.
let speechEngine = 'browser';

function setEngine(engine) {
  speechEngine = engine;
  [['browser', 'btn-engine-browser'], ['local', 'btn-engine-local']].forEach(([e, id]) => {
    $(id).className = 'py-2 px-1 rounded border transition-all ' + (e === engine ? 'btn-mode-active' : 'btn-mode-inactive');
    $(id).setAttribute('aria-pressed', e === engine);
  });
  $('local-options').classList.toggle('hidden', engine !== 'local');
  if (engine !== 'browser' && recognition && isSpeechActive) { try { recognition.stop(); } catch (e) {} }
  if (engine === 'browser' && localCapture) { // free the mic for the browser engine
    localCapture.stream.getTracks().forEach((t) => t.stop());
    try { localCapture.ac.close(); } catch (e) {}
    localCapture = null;
  }
  updateEngineNote();
}

function updateEngineNote() {
  const note = $('engine-note');
  if (speechEngine === 'browser') {
    note.textContent = (window.SpeechRecognition || window.webkitSpeechRecognition)
      ? 'Uses your browser’s speech service: the most accurate, but only in Chrome, Edge and usually Safari, and it needs internet. If it isn’t available, the game switches to Vosk.'
      : 'This browser has no speech service. Choose Vosk to play with your voice.';
  } else {
    note.textContent = 'Vosk runs inside the page, so it works in any modern browser and offline. Quick to load and reacts while you talk, but less accurate. ' +
      (localReady ? 'Loaded ✓' : `Downloads ${LOCAL_MODEL_SIZE} when you press Start.`);
  }
}

function showProgress(prefix, loaded, total, label) {
  $(prefix + '-progress-wrap').classList.remove('hidden');
  const pct = total ? Math.floor((loaded / total) * 100) : 0;
  $(prefix + '-progress-bar').style.width = pct + '%';
  const text = label ||
    (total ? `Downloading model… ${(loaded / 1048576).toFixed(0)} / ${(total / 1048576).toFixed(0)} MB`
           : `Downloading model… ${(loaded / 1048576).toFixed(0)} MB`);
  $(prefix + '-progress-label').textContent = text;
  if (isGameRunning) footerStatus(text); // visible when switching engines mid-game
}
function showLocalProgress(loaded, total, label) { showProgress('local', loaded, total, label); }

async function handleStartClick() {
  const needsLoad = speechEngine === 'local' && !localReady;
  if (needsLoad) {
    const btn = $('btn-start');
    btn.disabled = true;
    btn.classList.add('opacity-60');
    try {
      await loadLocalModel();
    } catch (err) {
      btn.disabled = false;
      btn.classList.remove('opacity-60');
      return; // the progress label explains what went wrong
    }
    btn.disabled = false;
    btn.classList.remove('opacity-60');
  }
  startGame();
}

// When the browser engine turns out to have no service (Brave, Opera…), switch to Vosk mid-game
function fallbackToBuiltIn() {
  if (speechEngine !== 'browser') return;
  setEngine('local');
  footerStatus('Your browser’s speech service isn’t available here. Switching to the built-in engine…');
  loadLocalModel()
    .then(() => { if (isGameRunning) return startLocalCapture(); })
    .catch((err) => footerStatus(`Built-in engine failed: ${(err && err.message) || err}`));
}

// Average down to the 16 kHz audio the speech models expect
function downsampleTo16k(buf, rate) {
  if (rate === 16000) return buf;
  const ratio = rate / 16000;
  const out = new Float32Array(Math.floor(buf.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const a = Math.floor(i * ratio), b = Math.min(buf.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = a; j < b; j++) sum += buf[j];
    out[i] = sum / Math.max(1, b - a);
  }
  return out;
}

// --- Forgiving matching for the built-in engines ---
// Turns what was heard into romaji and allows near misses, so a misheard “やばえ” still hits ヤバい.
const KANA_ROMAJI = (() => {
  const rows = {
    'あいうえお': 'a i u e o', 'かきくけこ': 'ka ki ku ke ko', 'さしすせそ': 'sa shi su se so',
    'たちつてと': 'ta chi tsu te to', 'なにぬねの': 'na ni nu ne no', 'はひふへほ': 'ha hi fu he ho',
    'まみむめも': 'ma mi mu me mo', 'やゆよ': 'ya yu yo', 'らりるれろ': 'ra ri ru re ro', 'わをん': 'wa o n',
    'がぎぐげご': 'ga gi gu ge go', 'ざじずぜぞ': 'za ji zu ze zo', 'だぢづでど': 'da ji zu de do',
    'ばびぶべぼ': 'ba bi bu be bo', 'ぱぴぷぺぽ': 'pa pi pu pe po', 'ぁぃぅぇぉ': 'a i u e o', 'ゔ': 'vu'
  };
  const map = {};
  for (const k in rows) { const r = rows[k].split(' '); [...k].forEach((c, i) => { map[c] = r[i]; }); }
  return map;
})();

function kanaToRomaji(hira) {
  const chars = [...hira];
  let out = '';
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (c === 'っ') { // double the next consonant
      const next = KANA_ROMAJI[chars[i + 1]] || '';
      out += next.startsWith('ch') ? 't' : (next[0] && !'aiueo'.includes(next[0]) ? next[0] : '');
      continue;
    }
    let r = KANA_ROMAJI[c];
    if (r === undefined) { out += c; continue; }
    const small = { 'ゃ': 'a', 'ゅ': 'u', 'ょ': 'o' }[chars[i + 1]];
    if (small && r.endsWith('i') && r.length > 1) { // きゃ → kya, しゃ → sha
      const stem = r.slice(0, -1);
      r = (['sh', 'ch', 'j'].includes(stem) ? stem : stem + 'y') + small;
      i++;
    }
    out += r;
  }
  return out;
}

// Smallest edit distance between pat and any part of text
function substringDistance(text, pat) {
  let prev = new Array(text.length + 1).fill(0);
  for (let i = 1; i <= pat.length; i++) {
    const cur = [i];
    for (let j = 1; j <= text.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (pat[i - 1] === text[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return Math.min(...prev);
}

function fuzzyRomajiShot(text) {
  if (!isGameRunning || isPaused || !zombies.length) return false;
  const heard = normRomaji(kanaToRomaji(normJa(text)));
  if (heard.length < 3) return false;
  let best = null;
  for (const z of [...zombies].sort((a, b) => a.z - b.z)) {
    if (z.single) continue;
    for (const r of z.roSet) {
      if (r.length < 4) continue;
      const tol = Math.floor(r.length / 4); // 1 slip for yabai, 2 for tasukete
      const d = substringDistance(heard, r);
      if (d <= tol && (!best || d < best.d)) best = { z, d };
    }
  }
  if (!best) return false;
  executeShot(best.z, true);
  return true;
}

// Shared handling of a finished utterance from a built-in engine
function shootFromFinalText(text, st) {
  const ja = normJa(text);
  if (st.pos > ja.length) st.pos = ja.length;
  while (shootNextInStream(ja, st, true, true)) {}
  if (st.shots === 0 && !tryShoot([text], true) && fuzzyRomajiShot(text)) st.shots++;
}

// --- VOSK (vosk-browser 0.0.8, Apache-2.0) ---
// Shares the root folder's model.tar.gz, so there's only one copy.
const VOSK_SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/vosk-browser@0.0.8/dist/vosk.js';
const VOSK_MODEL_URL = '../../model.tar.gz';
const LOCAL_MODEL_SIZE = 'about 50 MB';

let voskModel = null;
let localReady = false;
let localLoading = null;
let localCapture = null;
let voskStream = { pos: 0, shots: 0 };

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (window.Vosk) return resolve();
    const el = document.createElement('script');
    el.src = src;
    el.onload = resolve;
    el.onerror = () => reject(new Error('the Vosk library didn’t load (are you online?)'));
    document.head.appendChild(el);
  });
}

async function fetchWithProgress(url) {
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(resp.status === 404
      ? `${url} wasn’t found next to this page (see the setup notes)`
      : `the model download failed (HTTP ${resp.status})`);
  }
  const total = Number(resp.headers.get('content-length')) || 0;
  if (!resp.body || !resp.body.getReader) return resp.blob();
  const reader = resp.body.getReader();
  const parts = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    loaded += value.length;
    showLocalProgress(loaded, total);
  }
  return new Blob(parts);
}

function loadLocalModel() {
  if (localReady) return Promise.resolve();
  if (localLoading) return localLoading;
  localLoading = (async () => {
    try {
      showLocalProgress(0, 0, 'Loading the speech engine…');
      await loadScript(VOSK_SCRIPT_URL);
      const blob = await fetchWithProgress(VOSK_MODEL_URL);
      showLocalProgress(1, 1, 'Unpacking the model…');
      try {
        voskModel = await Vosk.createModel(URL.createObjectURL(blob));
      } catch (e) {
        voskModel = await Vosk.createModel(new URL(VOSK_MODEL_URL, location.href).href);
      }
      try { voskModel.setLogLevel(-1); } catch (e) {}
      localReady = true;
      showLocalProgress(1, 1, 'Ready ✓');
      updateEngineNote();
    } catch (err) {
      showLocalProgress(0, 0, `Couldn’t load the speech engine: ${(err && err.message) || err}`);
      throw err;
    } finally {
      localLoading = null;
    }
  })();
  return localLoading;
}

// Words of the current mode in every spelling, so Vosk can listen only for them
function buildVoskGrammar() {
  let items;
  switch (currentKanaMode) {
    case 'H_BASIC': items = KANA_BANKS.H_BASIC; break;
    case 'H_WORDS': items = KANA_BANKS.H_WORDS; break;
    case 'K_BASIC': items = KANA_BANKS.K_BASIC; break;
    case 'K_WORDS': items = KANA_BANKS.K_WORDS; break;
    case 'YABAI': items = KANA_BANKS.YABAI_EXCLAMATIONS; break;
    default: items = [].concat(KANA_BANKS.H_BASIC, KANA_BANKS.H_WORDS, KANA_BANKS.K_BASIC, KANA_BANKS.K_WORDS);
  }
  if (currentKanaMode !== 'YABAI') items = items.concat(KANA_BANKS.BOSS_PHRASES);
  const words = new Set();
  for (const it of items) {
    for (const f of [it.kana, ...(it.alts || [])]) {
      if (/^[\x00-\x7f]+$/.test(f)) continue;
      words.add(f);
      words.add(kataToHira(f));
      words.add(hiraToKata(f));
    }
  }
  words.add('[unk]');
  return [...words];
}

function voskKey() { return $('chk-vosk-grammar').checked ? 'grammar:' + currentKanaMode : 'free'; }

function makeVoskRecognizer(sampleRate) {
  const rec = $('chk-vosk-grammar').checked
    ? new voskModel.KaldiRecognizer(sampleRate, JSON.stringify(buildVoskGrammar()))
    : new voskModel.KaldiRecognizer(sampleRate);
  rec.on('partialresult', (m) => onVoskText(m && m.result && m.result.partial, false));
  rec.on('result', (m) => onVoskText(m && m.result && m.result.text, true));
  return rec;
}

// Partial results grow while you talk; shots fire as soon as a word appears in them
function onVoskText(text, isFinal) {
  text = (text || '').trim();
  if (text) updateSpeechBanner(text);
  if (text && isGameRunning && !isPaused) {
    targetSlowdownTimer = 25;
    if (isFinal) {
      shootFromFinalText(text, voskStream);
    } else {
      const ja = normJa(text);
      if (voskStream.pos > ja.length) voskStream.pos = ja.length;
      while (shootNextInStream(ja, voskStream, false, true)) {}
      voskStream.pos = Math.max(voskStream.pos, ja.length - 10);
    }
  }
  if (isFinal) voskStream = { pos: 0, shots: 0 };
}

async function startLocalCapture() {
  if (!localCapture) {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 }
    });
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    document.addEventListener('pointerdown', () => { if (ac.state === 'suspended') ac.resume(); });
    const src = ac.createMediaStreamSource(stream);
    const node = ac.createScriptProcessor(4096, 1, 1);
    localCapture = { ac, stream, src, node, rec: null, key: '' };
    node.onaudioprocess = (ev) => {
      if (speechEngine !== 'local' || !localCapture.rec || !isGameRunning || isPaused) return;
      try { localCapture.rec.acceptWaveform(ev.inputBuffer); } catch (err) { console.warn('Vosk:', err); }
    };
    src.connect(node);
    node.connect(ac.destination); // a ScriptProcessor only runs when connected; its output stays silent
  }
  const key = voskKey();
  if (!localCapture.rec || localCapture.key !== key) {
    if (localCapture.rec) { try { localCapture.rec.remove(); } catch (e) {} }
    localCapture.rec = makeVoskRecognizer(localCapture.ac.sampleRate);
    localCapture.key = key;
  }
  voskStream = { pos: 0, shots: 0 };
  $('mic-ping').style.opacity = '1';
  footerStatus('Vosk is listening. Say something!');
}
