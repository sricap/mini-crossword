# Mini Crossword Webapp — Product Spec

Use this file to capture product requirements, instructions, and decisions for the mini crossword webapp. Add or edit sections as you refine the product.

---

## 1. Overview

**Product:** Mini Crossword Webapp  
**Interfaces:** Creator (build puzzles) | Solver (play puzzles)

*Describe the product in one or two sentences:*
A webapp where users can design small crosswords (e.g. 5×5) or "acrostics" and share them for others to solve in the browser.

---

## 2. Creator Interface (current focus)

### Goals
- What should a creator be able to do?
Goal is to provide both a creator and solve interface for puzzles created by or uploaded as image to this app. Additional Goal is to put all created puzzles in to a repository (database), so that creators can load/edit/re-save the puzzle and solvers can discover all available puzzles and solve what they wish.

- What’s the primary workflow?

When the app is launched, take the user to a browser URL and ask whether to Create or Solve. 
 - Launch the Creator Page if Create is chosen
 - Launch the Solver Page with a list of puzzles available

### Grid
- **Size:** 5x5 default. Prompt the creator to override the size and use that. If the mode is "Acrostic", disable the Column counter and display the same value as the Row counter (since an Acrostic has have the same number rows and columns)
- **Black cells:** Provide an easy interface for the creator to pick out black cells. Shift+click. Just a click without Shift should allow user to type a letter. See below. 
- **White cells:** Let the user type a letter to fill out the grid. Move cursor to next cell after displaying the typed letter. Allow the cell to be made empty using backspace, delete. Allow overwriting it with another letter. Only allow letters A-Z. 
- **Symmetry:** Ensure that the grid is diagonally symmetric in its white abd black square pattern. This is normally the case for any standard crossword.
- **Validation:** Minimum 3 letter words
### Clues & answers
- **Clues:** One clue per word (across/down). Numbering auto from grid. Fill out the answers to the clue based on what letters were filled in the grid.
- **Answers:** Stored per word. All Upper Case.
- **Order:** How are across/down clues ordered? The standard way. i.e., 
    = across clues are numbered starting from the top left corner and scanning each row from left to right for the start of a new word.
    = down cluses are also numbers based on such a scan of cells.
    = be sure to number only across clues for *Acrostic* mode
### Data & persistence
- **Save session:** Save intermediate creator draft (grid, clues, title, etc.) in the browser (e.g. localStorage) so the creator can resume later without DB.
- **Save puzzle:** Save the Creator's final version into a database, as detailed in that section.
- **Export For Solver:** Export puzzle as a URL that loads the title, grid and clues for a solving session. 
- **Export For Creator:** Provide an option to export the creator page as a JPG. Use the title of the Puzzle as the file name to export to, with .JPG extension.
- **Load from Image:** Allow users to upload a JPG or PNG exported by above, for creators. Parse it to auto-fill into a new Creator view that can be edited and exported for solvers.

### Acrostic Mode
An Acrostic is a puzzle where the horizontal and vertical words are the same. It is a square NxN grid with N words of the same length (N), often with no black squares.

- **Acrostic:** Provide a checkbox "Acrostic" to the creator. If checked:
    = eliminate the down clues (since they are the same as across clues)
    = only number the Across clues, in sequence

### Puzzle Title
- Provide a text box of length 25 characters (make it wide enough) for the creator to type a puzzle name

### UI/UX for creator
- Layout: single page
- Left Pane: List of all the puzzles available in the database, with hyperlinks.
- Main Panel: Creator view with grid, clues, and buttons to load/save/export.

---

## 3. Solver Interface

### Goals
- View the puzzle grid and clues; type answers in cells; check answers and reveal as needed; resume later from saved progress.

### Flow
- **Puzzle List Page:** Solver will see a list of puzzles from the database as the default view (when "Solve" is picked in the main page). They can click on a puzzle link to load that puzzle. This will update the URL accordingly, to a link that can directly load the puzzle if copy/pasted to another browser session.
- **Puzzle Page:** Solver will get to this from above. They can also get to this from a **link** derived from a creator link (open URL with `?puzzle=...` from creator's "Copy link").

### Active clue transitions
- **Start:** The puzzle starts with an **"active clue"**, which starts with the 1 Across. The "active word" is also 1 Across, but in the grid.
- **Highlights:**
    = The "active clue" should become **bold** font.
    = The "active word" row (for across) or column (for down) cells background should become LIGHT BLUE
    = The "active cell" (where the cursor is) background should become YELLOW.
- **Transitions:**
    = When user types a letter in the active cell, the active cell becomes the next letter of the word. 
    = If the active cell was the last letter in that word, the next across or down clue becomes the active one.
    = If the active cell was the last letter in the last across/down clue, the next active word flips to the first down/across.
    = Be sure to transition the **highlights** for cell, row/column, and clue, every time the user clicks a new cell or types a letter in the current cell, forcing a transition.
    = **Space Bar** will transition the active word from row to column (across to down) or column to row (down to across). The active cell will not change.

### Grid & input
- Show grid with clue numbers; each white cell is one **text input** (one letter). User types in cells; input is uppercase.
- The look-and-feel of the grid is similar to the Creator view. Squares with numbers where a word starts. 
    = For Acrostic mode, only the across words are numbered because the down words are the same and have no clues associated with them.
    = **Reset the clue numbering** each time Acrostic mode is turned on/off.
- When a letter is typed, moved to the next letter square in that word.
- If the last letter of a word is typed, move to the next row. Cycle to the first row after the last one.
- One letter per cell; same cell shares its letter for across and down.

### Timer
- Show a timer with hours:minutes:seconds that ticks every second the solver page is open.
- Provide a pause button to pause the timer. Grey out or blur out the screen when the timer is paused.
- Unpausing should resume the timer and resume solving mode.

### Check & reveal
- **Completion:** When all letters are filled, display a banner with the "success message" or "not-there-yet message" (see below) and pause the timer. Resume progress when user dismisses the message:
    = **success message:** "Congratulations! You solved it in 'X'!". 'X' should the actual minutes and seconds the user took to solve. examples "...in 13 seconds!" or "...in 1 minute 10 seconds!".
    = **not-there-yet message:** "Aw, snap! At least one square does not have the right letter. Try again!"
- **Check Square:** Button "Check Square" compares the letter in the selected/active square to the correct letter.
    = If wrong, it **highlights the incorrect letter** by changing the letter colors to RED.
    = If correct, it **highlights the correct letter** by changing the letter colors to BLUE
- **Reveal word:** For each clue there is a "Reveal" control that fills in the **correct answer** for that word only. The revealed letters should be in GREEN, to indicated that they were revealed and not solved.

### Progress & completion
- **Save progress:** Solver **saves progress in the browser** (localStorage): current puzzle + user's fill. One "saved game" slot; loading "saved" restores that puzzle and fill.
- **Completion:** When every cell matches the correct answer, show a **completion message** (e.g. "Congratulations! You finished the puzzle."). No timer.

### UI/UX for solver
### Layout
- *Title* on top 
- *Grid* below Title
- *Clues* below Grid, Across Clues on left. Down Clues on right. *Acrostic* will have only Across Clues. *Reveal* button next to each clue.
- *Action Buttons*: All other buttons at the bottom. eg., Check Square, Home, Save Progress, Pause/Resume Timer.

## 4. Database
This section details where and how the puzzles are stored, for retrieval by Creators and Solvers.

### What to store
- **Key:** Unique puzzle ID, generated by the system when a new puzzle is saved to DB by Creator (e.g. UUID). Used in URLs and for load/update.
- **Fields/Columns:** Puzzle Title, Creator (see below), Date of Creation, Date last updated, plus the full puzzle payload needed for Creator and Solver: grid (rows, cols, black/white), clues, answers, acrostic flag. Store enough to reconstruct the same data as the current in-memory puzzle (grid, clues, answers, title, acrostic).
- **Tables & Schema:** Let AI decide this and store the details of the schema in a DB_SPEC.md file for human inspection and editing.

### Creator field
- **Creator** is a display label only (no user accounts in v1). When saving a puzzle (new or update), the app prompts for or displays a **Creator name** (short text, e.g. max 50 chars). Stored with the puzzle and shown in puzzle lists. Optional: allow blank and display as "Anonymous" in lists.

### Operations (what the app must do with the DB)
- **List puzzles:** Return all puzzles (for Creator left pane and Solver puzzle list). Include at least: id, title, creator, date created, date last updated. Order: e.g. last updated descending. Pagination or a reasonable limit (e.g. 100) can be decided in DB_SPEC.
- **Get puzzle by ID:** Return full puzzle (grid, clues, answers, title, acrostic, creator, dates) for loading in Creator (edit) or Solver (play).
- **Create puzzle:** Insert new row; system generates ID; set created_at and updated_at; return ID (and optionally full row) so the app can switch to "editing this puzzle" and use ID in URLs.
- **Update puzzle:** Update existing row by ID (grid, clues, answers, title, acrostic, creator if provided, updated_at). Only allowed when the current puzzle was loaded from DB (has an id). Creator UI: "Save" when id present = update; "Save" when no id = create.
- **Delete puzzle:** Out of scope for v1; no delete from DB. (Add later if needed.)

### URLs and links
- **Solver – load from list:** When solver clicks a puzzle in the list, open the puzzle at a URL that identifies it by DB id, e.g. `?id=<uuid>` or `?puzzle=<uuid>`. The app then fetches the full puzzle from the DB and displays the solver view. The URL is shareable (opening it in a new session loads the puzzle from DB).
- **Creator – edit from list:** When creator clicks a puzzle in the left pane, open the creator view for that puzzle, e.g. `?edit=<id>`. App fetches puzzle by id and fills grid, clues, title, acrostic. "Save" then performs update, not create.
- **Copy link (Creator):** Can remain as today (encoded payload in `?puzzle=...`) for backward compatibility and for sharing without requiring DB. Optionally also offer "Copy link to puzzle" that uses the DB id URL (e.g. `?id=...`) so the solver loads from DB. Specify which behavior is default; the other can be "Copy link (encoded)" vs "Copy link (by ID)" if both are supported.

### Errors and offline
- **Save failure:** If save (create or update) fails (network or server error), show a clear message (e.g. "Could not save. Check connection and try again.") and leave the creator view unchanged so the user can retry.
- **Load failure:** If list or get-by-id fails, show a message (e.g. "Could not load puzzles." / "Could not load this puzzle.") and allow retry or going back.
- **Encoded link without DB:** Links with `?puzzle=<encoded>` (no id) continue to work without hitting the DB: decode payload and show solver (or creator) as today. So the app supports both: load by ID from DB, and load by encoded payload from URL.

### Security and permissions (v1)
- No authentication. Anyone can create and update puzzles. Supabase anonymous access or open RLS can allow inserts/updates; or use a single service role for the app. Document in DB_SPEC that v1 has no per-user permissions and that delete is out of scope.

---

## 5. Technical preferences

- **Stack:** React
- **Styling:** CSS. Keep it as simple as possible
- **Hosting:** Static site
- **Browser support:** Chrome & Safari
- **Database:** Supabase


---

## Out of scope (for now)

- Things you explicitly don’t want in v1 (e.g. user accounts, mobile app, themes).

---

## Changelog

| Date      | Ver | Change |
|-----------|-----|--------|
| 2026-02-01| 0.1 | Initial spec; no db; local run |
| 2026-02-18| 1.0 | save puzzle to db |
| 2026-02-xx| 1.1 | Github + deployed to gcp |



---

*Edit this file as you go. The build can use it as the single source of truth for product behavior.*
