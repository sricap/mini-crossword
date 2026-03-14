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
- **Black cells:** Provide an easy interface for the creator to pick out black cells. **Space bar** or **Shift+click** toggles a cell black/white (diagonally symmetric). Just a click (without Shift) should allow the user to type a letter. See below.
- **White cells:** Let the user type a letter to fill out the grid. Move cursor to next cell after displaying the typed letter (must work on mobile as well as desktop; use both keyboard and input change events as needed). Allow the cell to be made empty using backspace, delete. Allow overwriting. Only allow letters A–Z. 
- **Symmetry:** Ensure that the grid is diagonally symmetric in its white abd black square pattern. This is normally the case for any standard crossword.
- **Validation:** Minimum 3 letter words
### Clues & answers
- **Clues:** One clue per word (across/down). Numbering auto from grid. Fill out the answers to the clue based on what letters were filled in the grid.
- **Answers:** Stored per word. All Upper Case.
- **Order:** How are across/down clues ordered? The standard way. i.e., 
    = across clues are numbered starting from the top left corner and scanning each row from left to right for the start of a new word.
    = down cluses are also numbers based on such a scan of cells.
- **Order for Acrostic Mode:**  For Acrostic mode, only the across words are numbered because the Down words are the same as Across words, and have no clues associated with them.
    = **Reset the clue numbering** to only number Across words, each time **Acrostic mode is turned ON**. Reset it to include Down clues and numbers when **Acrostic mode is turned OFF**.
### Data & persistence
- **Save session:** Save intermediate creator draft (grid, clues, title, etc.) in the browser (e.g. localStorage) so the creator can resume later without DB.
- **Save puzzle:** Save the Creator's final version into a database, as detailed in that section. When puzzle is saved, if the title or Creator name has changed, refresh the left pane to show the new title in place of the old one.

### Acrostic Mode
An Acrostic is a puzzle where the horizontal and vertical words are the same. It is a square NxN grid with N words of the same length (N), often with no black squares.

- **Acrostic:** Provide a checkbox "Acrostic" to the creator. If checked:
    = eliminate the down clues (since they are the same as across clues)
    = only number the Across clues, in sequence

### Puzzle Title
- Provide a text box of length 25 characters (make it wide enough) for the creator to type a puzzle name

### Puzzle Blurb
- Provide a text area to allow 3-4 sentences to be typed as optional instructions for the puzzle. For example, if the puzzle is themed, this is where the author would call it out. It should be displayed in the solver mode under the title.

### UI/UX for creator
- Layout: single page
- **Desktop:** Left pane with puzzle list; main panel with grid, clues, and actions. At the **top** of the list, show **"New..."**. Clicking it or any other puzzle opens the save-confirm modal as below.
- **Mobile (narrow viewport):** Hide the left pane. Show a **top bar** with: **Home** (icon only, left), a **dropdown** containing "New..." and all puzzles (same behavior as pane), and **Solve a puzzle** (icon only, right). Main content is the same grid, clues, and actions.
- **Save modal:** "Save current puzzle to the database?" with **No** and **Yes**. **No** = switch without saving. **Yes** = save then switch. Shown when choosing "New..." or another puzzle.
- **Labels:** Use "Name your creation" (not "Puzzle title (max 25)"); "Acrostic (same words across and down)" (short); "Creator" (not "Creator name (for DB, max 50)"); "Puzzle blurb (optional)" (not "3–4 sentences"). Under Grid, hint: "Space or Shift+click a cell to toggle black/white (diagonally symmetric). Click to type." (omit A–Z/Backspace/arrows detail.)
- **Icons:** Use icons for navigation and actions (Home, Solve, Check, Reveal all, Save, etc.) on both mobile and desktop; keep tooltips/aria-labels for accessibility.
- **Excluded from Creator:** Do not include these buttons: Load from image, Copy link (encoded), Export as JPG.

---

## 3. Solver Interface

### Goals
- View the puzzle grid and clues; type answers in cells; check answers and reveal as needed; resume later from saved progress.

### Flow
- **Puzzle List Page:** Solver will see a list of puzzles from the database as the default view (when "Solve" is picked in the main page). They should click on a puzzle link to load that puzzle.
- **Puzzle Page:** Solver will get to this from above.

### Puzzle list page details
- Do not show a "Choose a puzzle" heading. Show only the hint text (e.g. "Click a puzzle title to play.").
- Show the title, grid size, whether acrostic (check mark or 'x'), author, and date created as a table.
- The title is clickable and leads to the puzzle page.
- Allow sorting by each column (Title, Grid size, Acrostic, Author, Date created) via a clickable column header (sort / reverse sort indicator).
- Do not provide a filter by author (or other fields) on the puzzle list.

### Puzzle Page details

### Grid
- The grid should look exactly like the empty grid that the Creator page, with clue numbers.  No "cell border" within the grid square.
- Each white cell is one **text input** (one letter). User types in cells; input is uppercase. 
- The look-and-feel of the grid is similar to the Creator view.


### Input and Transitions    
- When a letter is typed, move to the next letter square in that word (must work on **mobile** as well as desktop—advance focus on input change, not only on key events).
- If the last letter of a word is typed, move to the next row. Cycle to the first row after the last one.
- One letter per cell; same cell shares its letter for across and down.


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

### Timer
- Show a timer with hours:minutes:seconds that ticks every second the solver page is open.
- Provide a pause button to pause the timer. Grey out or blur the screen when the timer is **manually** paused.
- Unpausing should resume the timer and resume solving mode.
- Timer should permanently stop when the grid is solved (by Check or by completion after Reveal). Do **not** blur the screen when the puzzle is completed (e.g. after "Reveal all" or after the last word is revealed and the grid is correct).

### Check & reveal
- **Completion:** Whenever the grid is **fully filled and all answers are correct**, show the **completion popup** with the **success message** and stop the timer. This must happen (1) when the user **clicks "Check"** and the grid is correct, (2) when the user **types the last letter** and the grid becomes correct (auto-check on each fill change), and (3) when the user **reveals a word** and that was the last missing piece (grid full and correct). When the user **clicks "Check"** and at least one letter is wrong, show the **not-there-yet message** in the same popup style; they can dismiss and keep solving.
    = **success message:** "Congratulations! You solved it in 'X'!". 'X' should be the actual minutes and seconds the user took to solve. examples "...in 13 seconds!" or "...in 1 minute 10 seconds!".
    = **not-there-yet message:** "Aw, snap! At least one square does not have the right letter. Try again!"
    = After the success message is shown and dismissed, the puzzle is considered finished (only Home clickable; no further edits).
- **Reveal all:** Clicking "Reveal all" fills in all answers and stops the timer. Do **not** blur the screen. The puzzle is then considered solved: only the **Home** button remains clickable; other action buttons (Check, Reveal all, Save progress, Pause/Resume) are disabled or hidden.
- **Reveal word:** For each clue there is a "Reveal Control" that fills in the **correct answer** for that word only. The revealed letters should be in GREEN, to indicate that they were revealed and not solved.
- **Reveal Control:** Provide a small clickable "reveal" icon next to the clue, that will reveal the answer when clicked. When the mouse hovers over it, show the tool tip "Reveal Word".
- **After revealing a word:** Run a check to see if the puzzle is solved.
    = **a/** If the grid is not full (one or more empty squares), simply continue.
    = **b/** If the grid is full (no empty squares), treat as completion: show the success message, stop the timer, and consider the puzzle solved (only Home clickable), as in the Completion section.

### Progress & completion
- **Save progress:** Solver **saves progress in the browser** (localStorage): current puzzle + user's fill. One "saved game" slot; loading "saved" restores that puzzle and fill.
- **Completion:** When every cell matches the correct answer, show a **completion message** (e.g. "Congratulations! You finished the puzzle."). No timer.

### UI/UX for solver
### Layout
- *Title* on top 
- *Puzzle Blurb* below that
- *Grid* below that
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
NOTE: There should be no "load saved progress" button below the table of puzzles.
- **Creator – edit from list:** When creator clicks a puzzle in the left pane, open the creator view for that puzzle, e.g. `?edit=<id>`. App fetches puzzle by id and fills grid, clues, title, acrostic. "Save" then performs update, not create.
- **Copy link (Creator):** Do not offer "Copy link (encoded)". Creator may offer "Copy link (by ID)" that uses the DB id URL (e.g. `?id=...`) so the solver loads from DB.

### Errors and offline
- **Save failure:** If save (create or update) fails (network or server error), show a clear message (e.g. "Could not save. Check connection and try again.") and leave the creator view unchanged so the user can retry.
- **Load failure:** If list or get-by-id fails, show a message (e.g. "Could not load puzzles." / "Could not load this puzzle.") and allow retry or going back.
- **Encoded link without DB:** Links with `?puzzle=<encoded>` (no id) continue to work without hitting the DB: decode payload and show solver (or creator) as today. So the app supports both: load by ID from DB, and load by encoded payload from URL.

### Security and permissions (v1)
- No authentication. Anyone can create and update puzzles. Supabase anonymous access or open RLS can allow inserts/updates; or use a single service role for the app. Document in DB_SPEC that v1 has no per-user permissions and that delete is out of scope.

---

## 5. Mobile and responsive

- **Creator:** Typing in grid cells must work on mobile (soft keyboard); use both key and input-change handling so the cursor advances to the next cell. Space bar toggles current cell black/white (same as Shift+click). On narrow viewports, replace the left pane with a top-bar dropdown for puzzle list; Home and Solve use icons.
- **Solver:** Cursor must move to the next cell after typing on mobile; advance focus on input change when a letter is entered.
- **Icons:** Use icons for primary actions (Home, Solve, Check, Reveal all, Save, etc.) on mobile and web, with accessible labels.

## 6. Technical preferences

- **Stack:** React
- **Styling:** CSS. Keep it as simple as possible
- **Hosting:** Static site
- **Browser support:** Chrome & Safari (and mobile browsers)
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
| 2026-02-xx| 1.1 | Project now on Github |
| 2026-03-06| 1.2 | Project deployed on Vercel |
| 2026-03-13| 1.2 | Various fixes and UI clean-ups |



---

*Edit this file as you go. The build can use it as the single source of truth for product behavior.*
