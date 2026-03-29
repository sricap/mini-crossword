/**
 * Build the full user message sent to the LLM (safe to log; no secrets).
 */

const MAX_CLUE_LEN = 400
const MAX_BLURB_LEN = 2000

/**
 * @param {string} lengthSpecRaw - e.g. "5" or "3,2" from phrase_lens
 * @param {number} gridWordLength - white squares in entry from grid
 * @returns {{ kind: 'single', letters: number } | { kind: 'phrase', wordLengths: number[], phraseWordCount: number, totalLetters: number }}
 */
export function interpretLengthSpec(lengthSpecRaw, gridWordLength) {
  const raw = String(lengthSpecRaw ?? '').trim()
  if (!raw) {
    return { kind: 'single', letters: gridWordLength }
  }
  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean)
  const nums = []
  for (const p of parts) {
    if (!/^\d+$/.test(p)) {
      return { kind: 'single', letters: gridWordLength }
    }
    const n = parseInt(p, 10)
    if (n <= 0) return { kind: 'single', letters: gridWordLength }
    nums.push(n)
  }
  if (nums.length === 1) {
    return { kind: 'single', letters: nums[0] }
  }
  const sum = nums.reduce((a, b) => a + b, 0)
  if (sum !== gridWordLength) {
    return { kind: 'single', letters: gridWordLength }
  }
  return {
    kind: 'phrase',
    wordLengths: nums,
    phraseWordCount: nums.length,
    totalLetters: sum,
  }
}

function truncate(s, max) {
  if (!s) return ''
  const t = String(s).trim()
  return t.length <= max ? t : t.slice(0, max) + '…'
}

/**
 * @param {{ clueText: string, blurb: string, lengthSpec: string, gridWordLength: number }} p
 * @returns {string}
 */
export function buildAiHintUserPrompt(p) {
  const clueText = truncate(p.clueText, MAX_CLUE_LEN)
  const blurb = truncate(p.blurb || '', MAX_BLURB_LEN)
  const spec = interpretLengthSpec(p.lengthSpec, p.gridWordLength)

  const blurbBlock = blurb
    ? `Puzzle note from the setter (use this to interpret the clue):\n"${blurb}"\n\n`
    : ''

  const tailInstruction = `Reply with ONLY a valid JSON array of strings — no markdown, no code fences, no explanation. Each string is one candidate answer matching the length rules. Use UPPERCASE letters only. For multi-word phrases, separate words with a single space (e.g. "CHEF HAT"). Include at most 12 suggestions.`

  if (spec.kind === 'single') {
    const n = spec.letters
    const clueLine = `Solve the crossword clue: "${clueText}". The answer is ${n} letters (one word).`
    if (blurb) {
      return `${blurbBlock}${clueLine} Following the puzzle note, suggest synonyms or anagrams (or other interpretations consistent with the note) that could fit as a ${n}-letter answer. ${tailInstruction}`
    }
    return `${blurbBlock}${clueLine} Treat this as a typical definition/synonym-style clue. Show synonyms or near-synonyms that could work as a ${n}-letter answer. ${tailInstruction}`
  }

  const { wordLengths, phraseWordCount, totalLetters } = spec
  const partsDesc = wordLengths
    .map((len, i) => `word ${i + 1} has ${len} letters`)
    .join('; ')
  const clueLine = `Solve the crossword clue: "${clueText}". The answer is a phrase of ${phraseWordCount} words (${partsDesc}; ${totalLetters} letters in total ignoring spaces).`

  if (blurb) {
    return `${blurbBlock}${clueLine} Following the puzzle note, suggest plausible ${phraseWordCount}-word phrases (with those per-word lengths) that fit the clue — e.g. synonyms, anagrams, or other wordplay allowed by the note. ${tailInstruction}`
  }

  return `${blurbBlock}${clueLine} Treat this as a typical definition/synonym-style clue. Suggest plausible ${phraseWordCount}-word phrases matching those lengths. ${tailInstruction}`
}
