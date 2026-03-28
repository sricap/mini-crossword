# Bugs

Use this file to track known bugs and their status.

---

## Format

For each bug, add a row to the table below (or a section). Update **Status** as you fix: `Open` → `Fixed` → note the commit or version if useful.

---

## Log

| # | Date       | Description                            | Steps to reproduce                  | Status   | Notes |
|---|------------|----------------------------------------|-------------------------------------|----------|-------|
| 1 | Mar 13, 26 | Row/Col counter should not be editable | Click on Row/Col count and type     |  - | - |
| 2 |            | Remove Load from Img, Parse Img, Copy link, Export to JPG |           |        |       |

---

## Resolved — 2026-03-28

Commits: **`4f0e021`** (phrase lens, acrostic, mobile grid), **`16f9cba`** (navigation, backspace, phrase UI, solver lengths).

| # | Date | Description of Fix |
|---|------|---------------------|
| 1 | 2026-03-28 | Space bar toggles black/white: `handleToggleBlack` now treats Space like a toggle, not only Shift+click. |
| 2 | 2026-03-28 | Mobile: double-tap a white cell toggles symmetric black/white; hint text updated; Shift+click and Space unchanged where supported. |
| 3 | 2026-03-28 | Acrostic checkbox moved into the **Grid** section above Rows/Cols. |
| 4 | 2026-03-28 | Rows/Cols: narrow value + **− / +** steppers so mobile can change size reliably. |
| 5 | 2026-03-28 | Acrostic mode: across clues and grid numbers run **1…n** with no gaps. |
| 6 | 2026-03-28 | Phrase / answer length hints: editable `( )` per clue; comma-separated counts must sum to word length (blur validation, alert + invalid styling); stored as `phraseLens` / DB **`phrase_lens`** (see `DB_SPEC.md` migration). |
| 7 | 2026-03-28 | Phrase length input no longer stretches full row: **`clue-text-input`** on clue field only; phrase field uses `ch` width, `size`, and `max-content` wrapper. |
| 8 | 2026-03-28 | Solver: length hint is read-only `(…)` from `phrase_lens`, not an editable input. |
| 9 | 2026-03-28 | Backspace clears the current letter and **stays** in the cell; moves to previous cell only when already empty (creator + solver). |
| 10 | 2026-03-28 | Caret placed **after** the letter on focus/click (including double `requestAnimationFrame`). |
| 11 | 2026-03-28 | Arrow keys: **Up/Down** = vertically adjacent white cell; **Left/Right** = horizontally adjacent white cell (creator + solver). |

---

## Template (copy for new bugs)

```
| # | Date       | Description | Steps to reproduce | Status | Notes |
|---|------------|-------------|--------------------|--------|-------|
|   | YYYY-MM-DD |             |                    | Open   |       |
```

---

*Add new bugs at the bottom of the table or as new sections.*
