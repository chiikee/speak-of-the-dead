// Shown small under Start, so a stale cached copy can be spotted.
const APP_VERSION = 'v3-next';
$('app-version').textContent = APP_VERSION;

// --- EVENTS ---
$('btn-start').addEventListener('click', handleStartClick);
$('btn-restart').addEventListener('click', handleStartClick);
$('btn-main-menu').addEventListener('click', returnToMainMenu);

$('chk-keyboard-fallback').addEventListener('change', (e) => toggleKeyboardFallbackContainer(e.target.checked));

const typeInput = $('type-shooter-input');
const typeBtn = $('btn-type-shoot');

function handleTypeShoot() {
  const val = typeInput.value.trim();
  if (!val) return;
  typeInput.value = '';
  // Kana typed back to back (やばいやばい), then space-separated romaji (yabai yabai)
  const st = { pos: 0, shots: 0 };
  const ja = normJa(val);
  while (shootNextInStream(ja, st, true, false)) {}
  let hit = st.shots > 0;
  if (!hit) for (const tok of val.split(/\s+/)) if (tryShoot([tok], false)) hit = true;
  if (!hit && isGameRunning && !isPaused) {
    typeInput.classList.remove('input-miss');
    void typeInput.offsetWidth;
    typeInput.classList.add('input-miss');
  }
}
typeBtn.addEventListener('pointerdown', (e) => e.preventDefault()); // keep phone keyboard open
typeBtn.addEventListener('click', handleTypeShoot);
typeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); handleTypeShoot(); }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && isGameRunning && !isPaused) togglePause('user');
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!$('settings-modal').classList.contains('hidden')) return toggleSettings();
  if (!isGameRunning) return;
  if (!$('cheatsheet-modal').classList.contains('hidden')) toggleCheatSheet();
  else togglePause('user');
});

if (window.ResizeObserver) new ResizeObserver(resizeCanvas).observe($('game-area'));
window.addEventListener('resize', resizeCanvas);

window.addEventListener('load', () => {
  setKanaMode('H_BASIC');
  setDifficulty('EASY');
  buildCharts();
  resizeCanvas();
  initSpeechRecognition();
  if (recognition) setEngine('browser');
  // Brave exposes the speech API but blocks the service behind it
  if (recognition && navigator.brave) {
    setEngine('local');
    $('mic-status-text').textContent = 'Brave blocks the browser speech service, so the built-in engine is selected.';
  }
  render();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!isGameRunning) render(); });
});
