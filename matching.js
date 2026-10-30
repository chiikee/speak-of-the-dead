// --- TEXT NORMALIZATION & MATCHING ---
function kataToHira(s) {
  return s.replace(/[\u30A1-\u30F6]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}
function hiraToKata(s) {
  return s.replace(/[\u3041-\u3096]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
}
function normJa(s) {
  return kataToHira(s.normalize('NFKC').toLowerCase())
    .replace(/[\s、。，．,.!?！？「」『』()（）・ー〜~\-…"'“”‘’]/g, '');
}
function normRomaji(s) {
  return s.normalize('NFKC').toLowerCase()
    .replace(/[^a-z]/g, '')
    .replace(/shi/g, 'si').replace(/chi/g, 'ti').replace(/tsu/g, 'tu')
    .replace(/fu/g, 'hu').replace(/ji/g, 'zi')
    .replace(/([aeiou])\1+/g, '$1');
}
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}
const HAS_KANJI = /[\u3400-\u9fff]/;
const HAS_JA = /[\u3040-\u30ff\u3400-\u9fff\uff66-\uff9f]/;

function buildCandidate(text) {
  return {
    ja: normJa(text),
    joined: normRomaji(text),
    tokens: text.normalize('NFKC').toLowerCase().split(/[\s,.!?、。]+/).map(normRomaji).filter(Boolean)
  };
}

function matchesZombie(z, c) {
  if (z.single) {
    // Single kana: the whole utterance must be that sound (or a common transcription of it)
    const s = c.ja.replace(/[っぁぃぅぇぉ]+$/, '');
    if (s && (z.jaSet.has(s) || [...s].every((ch) => ch === z.target))) return true;
    for (const t of c.tokens) if (z.roSet.has(t)) return true;
    return false;
  }
  for (const j of z.jaSet) {
    if ((j.length >= 2 || HAS_KANJI.test(j)) && c.ja.includes(j)) return true;
  }
  for (const r of z.roSet) {
    if (c.joined === r || c.tokens.includes(r)) return true;
    if (r.length >= 4 && c.joined.includes(r)) return true;
    if (r.length >= 5) {
      const tol = r.length >= 10 ? 2 : 1;
      if (levenshtein(c.joined, r) <= tol) return true;
      for (const t of c.tokens) if (levenshtein(t, r) <= tol) return true;
    }
  }
  return false;
}
