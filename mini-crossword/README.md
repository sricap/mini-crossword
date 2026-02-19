# Mini Crossword

A small webapp to create and solve mini crosswords. Built from [SPEC.md](../SPEC.md).

## Creator interface

- **Grid:** 5×5 default; override size with Rows/Cols inputs. Click a cell to toggle black/white; grid is **diagonally symmetric**.
- **Words:** Auto-numbered in standard order (row-by-row, left-to-right for starts). Minimum word length: 3 letters.
- **Clues & answers:** One clue and one answer per word; answers stored in **uppercase**.
- **Save:** "Save to browser" stores the puzzle in `localStorage`.
- **Load:** "Load saved" restores from `localStorage`. Opening a URL with `?puzzle=...` loads that puzzle in the solver.
- **Copy link:** Encodes the puzzle in the URL and copies it; opening that link opens the solver.
- **Export:** "Export as image" downloads a PNG of the grid with numbers and letters.
- **Solve a puzzle →** switches to the solver (paste link or load saved progress).

## Solver interface

- **Load a puzzle:** Paste a link (from Creator's "Copy link") or the encoded string, then "Load puzzle". Or use "Load saved progress" to restore the last puzzle and your fill.
- **Grid:** Each white cell is a one-letter input; type answers (uppercase). Clue numbers match the creator.
- **Check:** Highlights incorrect letters in red. Shows a completion message when all answers are correct.
- **Reveal:** Each clue has a "Reveal" button to fill in that word's answer. **Reveal all** fills the entire grid.
- **Save progress:** Saves the current puzzle and your fill to the browser (one slot). **← Create** returns to the creator.

## Run locally

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

## Build

```bash
npm run build
```

Output is in `dist/` (static site).
