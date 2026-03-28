const MIN_WORD_LENGTH = 3;

/**
 * Create empty grid (all white). Grid is row-major: grid[row][col], true = black.
 */
export function createEmptyGrid(rows, cols) {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => false)
  );
}

/**
 * Toggle cell (r, c) with diagonal symmetry: also toggle (c, r).
 */
export function toggleCellSymmetrically(grid, r, c) {
  const rows = grid.length;
  const cols = grid[0].length;
  const next = grid.map((row, i) =>
    row.map((black, j) => {
      if ((i === r && j === c) || (i === c && j === r)) return !black;
      return black;
    })
  );
  return next;
}

/**
 * Get all words from grid with standard numbering.
 * Returns { words: [{ number, direction, startRow, startCol, length }], numberAt: (r,c) => number | null }
 */
export function getWordsFromGrid(grid) {
  const rows = grid.length;
  const cols = grid[0].length;
  const numberAt = (r, c) => {
    if (r < 0 || r >= rows || c < 0 || c >= cols || grid[r][c]) return null;
    return startsAcross(r, c) || startsDown(r, c) ? num[r][c] : null;
  };

  const startsAcross = (r, c) => {
    if (grid[r][c]) return false;
    return c === 0 || grid[r][c - 1];
  };
  const startsDown = (r, c) => {
    if (grid[r][c]) return false;
    return r === 0 || grid[r - 1][c];
  };

  const words = [];
  const num = Array.from({ length: rows }, () => Array(cols).fill(null));
  let nextNum = 1;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c]) continue;
      const isStartAcross = startsAcross(r, c);
      const isStartDown = startsDown(r, c);
      if (!isStartAcross && !isStartDown) continue;

      if (num[r][c] == null) num[r][c] = nextNum++;

      if (isStartAcross) {
        let len = 0;
        while (c + len < cols && !grid[r][c + len]) len++;
        words.push({
          number: num[r][c],
          direction: 'across',
          startRow: r,
          startCol: c,
          length: len,
        });
      }
      if (isStartDown) {
        let len = 0;
        while (r + len < rows && !grid[r + len][c]) len++;
        words.push({
          number: num[r][c],
          direction: 'down',
          startRow: r,
          startCol: c,
          length: len,
        });
      }
    }
  }

  return { words, numberAt };
}

/**
 * Validate: all words must have length >= MIN_WORD_LENGTH.
 */
export function validateGrid(grid) {
  const { words } = getWordsFromGrid(grid);
  const invalid = words.filter((w) => w.length < MIN_WORD_LENGTH);
  return {
    valid: invalid.length === 0,
    invalidWords: invalid,
  };
}

/**
 * Encode puzzle for URL or storage. Answers stored uppercase.
 */
export function encodePuzzle(puzzle) {
  const payload = {
    rows: puzzle.rows,
    cols: puzzle.cols,
    grid: puzzle.grid,
    clues: puzzle.clues || {},
    answers: Object.fromEntries(
      Object.entries(puzzle.answers || {}).map(([k, v]) => [
        k,
        typeof v === 'string' ? v.toUpperCase() : v,
      ])
    ),
    title: puzzle.title != null ? String(puzzle.title).slice(0, 25) : '',
    acrostic: Boolean(puzzle.acrostic),
    blurb: puzzle.blurb != null ? String(puzzle.blurb) : '',
    phraseLens: puzzle.phraseLens && typeof puzzle.phraseLens === 'object' ? puzzle.phraseLens : {},
  };
  return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
}

/**
 * Decode puzzle from string (URL or localStorage).
 */
export function decodePuzzle(encoded) {
  try {
    const json = decodeURIComponent(escape(atob(encoded)));
    const p = JSON.parse(json);
    if (!p.rows || !p.cols || !Array.isArray(p.grid)) return null;
    return {
      rows: p.rows,
      cols: p.cols,
      grid: p.grid,
      clues: p.clues || {},
      answers: Object.fromEntries(
        Object.entries(p.answers || {}).map(([k, v]) => [
          k,
          typeof v === 'string' ? v.toUpperCase() : v,
        ])
      ),
      title: p.title != null ? String(p.title).slice(0, 25) : '',
      acrostic: Boolean(p.acrostic),
      blurb: p.blurb != null ? String(p.blurb) : '',
      phraseLens:
        p.phraseLens && typeof p.phraseLens === 'object' ? p.phraseLens : {},
    };
  } catch {
    return null;
  }
}

export function wordKey(number, direction) {
  return `${number}-${direction}`;
}

/** For acrostic mode: map each across word key to clue numbers 1…n (continuous). */
export function getAcrosticAcrossDisplayNumbers(acrossWords) {
  const sorted = [...acrossWords].sort(
    (a, b) =>
      a.startRow !== b.startRow ? a.startRow - b.startRow : a.startCol - b.startCol
  );
  const map = new Map();
  sorted.forEach((w, i) => {
    map.set(wordKey(w.number, 'across'), i + 1);
  });
  return map;
}

/**
 * Parse phrase length text (comma-separated positive integers, e.g. "3,2").
 */
export function parsePhraseLensText(text) {
  const raw = (text || '').trim();
  if (!raw) return { ok: false, sum: 0, normalized: '' };
  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return { ok: false, sum: 0, normalized: '' };
  const nums = [];
  for (const p of parts) {
    if (!/^\d+$/.test(p)) return { ok: false, sum: 0, normalized: raw };
    const n = parseInt(p, 10);
    if (n <= 0) return { ok: false, sum: 0, normalized: raw };
    nums.push(n);
  }
  const sum = nums.reduce((a, b) => a + b, 0);
  return { ok: true, sum, normalized: nums.join(',') };
}

/**
 * Check phrase lengths sum to word length (white squares in that entry).
 */
export function validatePhraseLensAgainstWordLength(text, wordLength) {
  const p = parsePhraseLensText(text);
  if (!p.ok) {
    return {
      valid: false,
      message: 'Use comma-separated whole numbers (e.g. 3,2).',
    };
  }
  if (p.sum !== wordLength) {
    return {
      valid: false,
      message: `Those lengths add to ${p.sum}, but this answer has ${wordLength} letters.`,
    };
  }
  return { valid: true, normalized: p.normalized };
}

/**
 * Build answers object from letters grid (for creator save/export).
 */
export function getAnswersFromLetters(grid, letters, words) {
  const ans = {};
  for (const w of words) {
    const key = wordKey(w.number, w.direction);
    let word = '';
    if (w.direction === 'across') {
      for (let i = 0; i < w.length; i++)
        word += (letters[w.startRow][w.startCol + i] || '').toUpperCase();
    } else {
      for (let i = 0; i < w.length; i++)
        word += (letters[w.startRow + i][w.startCol] || '').toUpperCase();
    }
    ans[key] = word;
  }
  return ans;
}

/**
 * Build 2D letters array from puzzle answers (for creator load).
 */
export function buildLettersFromAnswers(rows, cols, grid, answers, words) {
  const letters = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => '')
  );
  for (const w of words) {
    const key = wordKey(w.number, w.direction);
    const word = (answers[key] || '').toUpperCase();
    if (w.direction === 'across') {
      for (let i = 0; i < w.length; i++)
        letters[w.startRow][w.startCol + i] = word[i] || '';
    } else {
      for (let i = 0; i < w.length; i++)
        letters[w.startRow + i][w.startCol] = word[i] || '';
    }
  }
  return letters;
}

/**
 * Create empty fill grid (user's letters). Same dimensions as puzzle grid.
 */
export function createEmptyFill(rows, cols) {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => '')
  );
}

/**
 * Get the correct letter at (r, c) from puzzle answers.
 */
export function getCorrectLetterAt(puzzle, words, r, c) {
  const w =
    words.find(
      (x) =>
        x.direction === 'across' &&
        x.startRow === r &&
        x.startCol <= c &&
        c < x.startCol + x.length
    ) ||
    words.find(
      (x) =>
        x.direction === 'down' &&
        x.startCol === c &&
        x.startRow <= r &&
        r < x.startRow + x.length
    );
  if (!w) return '';
  const key = wordKey(w.number, w.direction);
  const ans = puzzle.answers[key] || '';
  const idx = w.direction === 'across' ? c - w.startCol : r - w.startRow;
  return (ans[idx] || '').toUpperCase();
}

/**
 * Check if every white cell has at least one letter (grid is full).
 */
export function isGridFull(puzzle, fill) {
  const rows = puzzle.grid.length;
  const cols = puzzle.grid[0].length;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (puzzle.grid[r][c]) continue;
      if (!(fill[r][c] || '').trim()) return false;
    }
  }
  return true;
}

/**
 * Check if fill is complete and correct.
 */
export function isPuzzleComplete(puzzle, fill) {
  const { words } = getWordsFromGrid(puzzle.grid);
  const rows = puzzle.grid.length;
  const cols = puzzle.grid[0].length;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (puzzle.grid[r][c]) continue;
      const correct = getCorrectLetterAt(puzzle, words, r, c);
      const user = (fill[r][c] || '').toUpperCase().trim();
      if (user !== correct) return false;
    }
  }
  return true;
}

/**
 * Get set of (r,c) cells that are incorrect. Returns Set of "r,c" strings.
 */
export function getIncorrectCells(puzzle, fill) {
  const { words } = getWordsFromGrid(puzzle.grid);
  const rows = puzzle.grid.length;
  const cols = puzzle.grid[0].length;
  const wrong = new Set();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (puzzle.grid[r][c]) continue;
      const correct = getCorrectLetterAt(puzzle, words, r, c);
      const user = (fill[r][c] || '').toUpperCase().trim();
      if (user !== correct) wrong.add(`${r},${c}`);
    }
  }
  return wrong;
}
