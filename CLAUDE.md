# Speak of the Dead

Browser zombie shooter for practising Japanese kana. Zombies walk toward the player carrying a kana/word; saying it (speech recognition) or typing it shoots them. Static site on GitHub Pages, no build step, no backend.

## Files
- `index.html`: markup only (menus, HUD, modals). Inline `onclick` handlers call global functions.
- `utilities.css` (generated, see CSS) and `style.css` (hand-written: fonts, CRT, neon, buttons).
- JS, plain classic `<script>` tags sharing one global scope (not ES modules), loaded in this order:
  - `game.js`: `$`/`clamp`/`IS_*` helpers, difficulty, canvas + projection, game state, entities, pause, shooting, spawning, render loop, HUD/flow, kana chart.
  - `audio.js`: Web Audio sound effects, mic volume analyzer (shout meter).
  - `matching.js`: `normJa`, `normRomaji`, `matchesZombie`.
  - `banks.js`: `SINGLE_ALTS`, `KANA_BANKS`, `setKanaMode`.
  - `speech.js`: browser recognition, engine switching, fuzzy matching, Vosk.
  - `main.js`: event wiring and startup; must stay last.
  Top-level code may only use things from files loaded earlier (e.g. `KANA_BANKS` calls `kataToHira`); function bodies can use anything.
- `model.tar.gz`: Vosk Japanese model (vosk-model-small-ja-0.22, folder renamed `model`, ~50 MB). Pushed with plain git, NOT Git LFS (Pages can't serve LFS files).
- `next/`: in-progress copy of the page (index.html, CSS, JS) for trying changes without touching the root page. Loads the model from `../model.tar.gz`; otherwise the same as the root page for now.
- `stt-test.html`: standalone page for testing the browser's speech recognition on phones.
- `build-css.py`: generates the CSS utilities (see CSS).

## How it works
- Canvas game loop is time-based (`dt`), so speed is the same at 60 and 120 Hz. One loop per game (`loopToken`).
- Perspective camera: `project(z, xn)` with `D_NEAR`; zombies spawn at `Z_FAR` and loom toward the player. Effects use the same projection.
- Matching: `normJa` (NFKC, katakana→hiragana, strip punctuation/ー) and `normRomaji` (Hepburn/Kunrei merged, long vowels collapsed). Word banks in `KANA_BANKS` list kana plus accepted `alts` (kanji, English, common misrecognitions in `SINGLE_ALTS`).
- `shootNextInStream` walks a transcript and fires once per occurrence, so "やばいやばいやばい" = 3 shots. Single kana wait if the text could still become a longer on-screen word.
- Built-in engines also get `fuzzyRomajiShot` (near misses, 1 slip per 4 letters; never for single kana).
- Critical shout: mic peak ≥ 0.65 within ~1 s of a voice hit = double damage, +500.
- Difficulty in `DIFFICULTY_SETTINGS` (speed, spawn interval, `minOnScreen`); ramps every 4 kills.

## Speech engines
- `browser` (default): Web Speech API, `ja-JP`, continuous + interim. Best accuracy; Chrome/Edge/Safari only, needs internet.
- `local`: Vosk via `vosk-browser@0.0.8` from jsDelivr; model loaded from `model.tar.gz` next to the page. Optional grammar mode limits it to the current mode's words.
- Auto: no Speech API, or Brave (`navigator.brave`) → Vosk. A `network`/`service-not-allowed` error mid-game → `fallbackToBuiltIn()`.

## Hard-won rules (don't undo)
- **Android + browser engine: never open a second mic stream.** Speech recognition then hears only silence ("no match"). Confirmed on Pixel 9 Pro with `stt-test.html`. So the shout meter is off there and the VOL meter is hidden (not "OFF").
- **Android continuous mode can repeat the previous phrase** at the start of a new result. `prevFinal` guard in `onresult` skips the repeated prefix; exact repeats only count when final.
- Start browser recognition directly inside the Start click; don't await anything first.
- Mic only works on https or localhost. Test phones via GitHub Pages or a tunnel.
- Whisper, Moonshine (Transformers.js) and ReazonSpeech (sherpa-onnx; HF Space files return 401) were tried and dropped. Don't re-add without a new reason.
- iPhone and iPad do NOT have the Android mic conflict: friends played the shared-mic version with continuous mode on iPhones with no problems, and iPad was tested directly (both 2026-10-30). So iOS/iPadOS keep the shout meter; the rule stays Android-only. (iPad Safari reports itself as a Mac; detect via `navigator.maxTouchPoints > 1` if ever needed.)

## CSS
Tailwind's CDN was replaced by precompiled utilities in `utilities.css` (CDN warned it isn't for production). Only classes already used have CSS. After adding new Tailwind classes, run `python3 build-css.py index.html *.js > u.css && mv u.css utilities.css`; it exits with an error listing any class it can't map.

## Conventions
- UI text uses typographic punctuation (’ “ ”); code keeps straight quotes.
- Romaji shows long vowels doubled (raamen, koohii); matching ignores the difference.
- Keep the dark arcade look and the existing fonts.

## Testing
- `npx serve` in the repo, open the "On Your Network" address. Phones need https for the mic.
- `node --check <file>.js` for syntax.

## Next tasks
1. Optional: a critical-hit alternative where the shout meter is off.
