import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  createEmptyGrid,
  toggleCellSymmetrically,
  getWordsFromGrid,
  validateGrid,
  encodePuzzle,
  decodePuzzle,
  wordKey,
  createEmptyFill,
  getAnswersFromLetters,
  buildLettersFromAnswers,
} from './utils/puzzle'
import { listPuzzles, getPuzzle, createPuzzle, updatePuzzle } from './api/db'
import { SolverView, SolverLanding } from './SolverView'
import './App.css'

const DEFAULT_SIZE = 5
const STORAGE_KEY = 'mini-crossword-draft'
const STORAGE_KEY_PROGRESS = 'mini-crossword-solver-progress'

function App() {
  const [mode, setMode] = useState('home')
  const [solverPuzzle, setSolverPuzzle] = useState(null)
  const [solverFill, setSolverFill] = useState(null)
  const [solverLoadError, setSolverLoadError] = useState('')

  const [rows, setRows] = useState(DEFAULT_SIZE)
  const [cols, setCols] = useState(DEFAULT_SIZE)
  const [grid, setGrid] = useState(() => createEmptyGrid(DEFAULT_SIZE, DEFAULT_SIZE))
  const [letters, setLetters] = useState(() => createEmptyFill(DEFAULT_SIZE, DEFAULT_SIZE))
  const [clues, setClues] = useState({})
  const [title, setTitle] = useState('')
  const [blurb, setBlurb] = useState('')
  const [isAcrostic, setIsAcrostic] = useState(false)
  const [copyStatus, setCopyStatus] = useState('')
  const [loadError, setLoadError] = useState('')

  const [puzzleId, setPuzzleId] = useState(null)
  const [creatorName, setCreatorName] = useState('')
  const [puzzleList, setPuzzleList] = useState([])
  const [listLoadError, setListLoadError] = useState('')
  const [dbSaveStatus, setDbSaveStatus] = useState('')
  const [saveConfirmPending, setSaveConfirmPending] = useState(null)

  const { words, numberAt } = getWordsFromGrid(grid)
  const validation = validateGrid(grid)

  const handleResize = useCallback((newRows, newCols) => {
    const effectiveCols = isAcrostic ? newRows : newCols
    setRows(newRows)
    setCols(effectiveCols)
    setGrid(createEmptyGrid(newRows, effectiveCols))
    setLetters(createEmptyFill(newRows, effectiveCols))
    setClues({})
  }, [isAcrostic])

  const handleToggleBlack = useCallback((e, r, c) => {
    if (!e.shiftKey) return
    e.preventDefault()
    setGrid((prev) => toggleCellSymmetrically(prev, r, c))
  }, [])

  const setClue = useCallback((key, value) => {
    setClues((prev) => ({ ...prev, [key]: value }))
  }, [])

  const setLetter = useCallback((r, c, letter) => {
    const L = (letter || '').toUpperCase().slice(0, 1)
    if (L && !/^[A-Z]$/.test(L)) return
    setLetters((prev) => {
      const next = prev.map((row, i) =>
        row.map((cell, j) => (i === r && j === c ? L : cell))
      )
      return next
    })
  }, [])

  const whiteCellOrder = useMemo(() => {
    const list = []
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        if (!grid[r][c]) list.push([r, c])
    return list
  }, [rows, cols, grid])

  const focusCell = useCallback((index) => {
    const el = document.querySelector(`.creator-cell-input[data-index="${index}"]`)
    if (el) el.focus()
  }, [])

  const handleCreatorKeyDown = useCallback(
    (e, r, c) => {
      const idx = whiteCellOrder.findIndex(([rr, cc]) => rr === r && cc === c)
      if (idx < 0) return
      const key = e.key
      if (key.length === 1 && /^[a-zA-Z]$/.test(key)) {
        e.preventDefault()
        setLetter(r, c, key)
        if (idx < whiteCellOrder.length - 1) focusCell(idx + 1)
      } else if (key === 'Backspace' || key === 'Delete') {
        e.preventDefault()
        setLetter(r, c, '')
        if (idx > 0) focusCell(idx - 1)
      } else if (key === 'ArrowRight' || key === 'ArrowDown') {
        e.preventDefault()
        if (idx < whiteCellOrder.length - 1) focusCell(idx + 1)
      } else if (key === 'ArrowLeft' || key === 'ArrowUp') {
        e.preventDefault()
        if (idx > 0) focusCell(idx - 1)
      }
    },
    [whiteCellOrder, setLetter, focusCell]
  )

  const answersFromLetters = useMemo(
    () => getAnswersFromLetters(grid, letters, words),
    [grid, letters, words]
  )

  const saveToBrowser = useCallback(() => {
    const payload = { rows, cols, grid, clues, answers: answersFromLetters, title, blurb, acrostic: isAcrostic }
    localStorage.setItem(STORAGE_KEY, encodePuzzle(payload))
    setLoadError('')
  }, [rows, cols, grid, clues, answersFromLetters, title, blurb, isAcrostic])

  const loadFromBrowser = useCallback(() => {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      setLoadError('No saved puzzle found.')
      return
    }
    const p = decodePuzzle(raw)
    if (!p) {
      setLoadError('Could not load saved puzzle.')
      return
    }
    const { words: loadWords } = getWordsFromGrid(p.grid)
    setRows(p.rows)
    setCols(p.cols)
    setGrid(p.grid)
    setLetters(buildLettersFromAnswers(p.rows, p.cols, p.grid, p.answers || {}, loadWords))
    setClues(p.clues || {})
    setTitle(p.title || '')
    setBlurb(p.blurb != null ? String(p.blurb) : '')
    setIsAcrostic(Boolean(p.acrostic))
    setLoadError('')
  }, [])

  const copyLinkById = useCallback(() => {
    if (!puzzleId) return
    const url = `${window.location.origin}${window.location.pathname}?id=${puzzleId}`
    navigator.clipboard.writeText(url).then(
      () => {
        setCopyStatus('Link copied (by ID).')
        setTimeout(() => setCopyStatus(''), 2000)
      },
      () => {
        setCopyStatus('Failed to copy.')
        setTimeout(() => setCopyStatus(''), 2000)
      }
    )
  }, [puzzleId])

  const saveToDb = useCallback(async () => {
    // #region agent log
    const _logB={location:'App.jsx:saveToDb',message:'saveToDb entry',data:{validationValid:validation.valid,puzzleId:!!puzzleId,isUpdate:!!puzzleId},hypothesisId:'B'};console.log('[debug]',_logB);fetch('http://127.0.0.1:7242/ingest/d7d9864e-0ba4-41cc-8345-b48e79c76a56',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({..._logB,timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (!validation.valid) return false
    setLoadError('')
    setDbSaveStatus('')
    const payload = {
      rows,
      cols,
      grid,
      clues,
      answers: answersFromLetters,
      title: title || '',
      blurb: blurb != null ? String(blurb) : '',
      acrostic: isAcrostic,
      creator: (creatorName || '').trim().slice(0, 50) || undefined,
    }
    if (puzzleId) {
      const { error } = await updatePuzzle(puzzleId, payload)
      // #region agent log
      const _logC={location:'App.jsx:saveToDb',message:'updatePuzzle result',data:{hasError:!!error,errorMessage:error?.message,errorCode:error?.code},hypothesisId:'C'};console.log('[debug]',_logC);fetch('http://127.0.0.1:7242/ingest/d7d9864e-0ba4-41cc-8345-b48e79c76a56',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({..._logC,timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      if (error) {
        const msg = error?.message || 'Could not save. Check connection and try again.'
        setLoadError(msg)
        console.error('[save] updatePuzzle error:', error?.message, error?.code, error?.details)
        return false
      }
      setDbSaveStatus('Saved.')
      setTimeout(() => setDbSaveStatus(''), 3000)
      listPuzzles().then(({ data: list }) => setPuzzleList(list || []))
      return true
    } else {
      const { data, error } = await createPuzzle(payload)
      // #region agent log
      const _logD={location:'App.jsx:saveToDb',message:'createPuzzle result',data:{hasError:!!error,errorMessage:error?.message,errorCode:error?.code,supabaseDetails:error?.details},hypothesisId:'C'};console.log('[debug]',_logD);fetch('http://127.0.0.1:7242/ingest/d7d9864e-0ba4-41cc-8345-b48e79c76a56',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({..._logD,timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      if (error) {
        const msg = error?.message || 'Could not save. Check connection and try again.'
        setLoadError(msg)
        console.error('[save] createPuzzle error:', error?.message, error?.code, error?.details)
        return false
      }
      setPuzzleId(data.id)
      setDbSaveStatus('Saved.')
      setTimeout(() => setDbSaveStatus(''), 3000)
      window.history.replaceState(null, '', `${window.location.pathname}?edit=${data.id}`)
      listPuzzles().then(({ data: list }) => setPuzzleList(list || []))
      return true
    }
  }, [puzzleId, rows, cols, grid, clues, answersFromLetters, title, blurb, isAcrostic, creatorName, validation.valid])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const encoded = params.get('puzzle')
    const id = params.get('id')
    const editId = params.get('edit')

    if (encoded) {
      const p = decodePuzzle(encoded)
      if (p) {
        setMode('solver')
        setSolverPuzzle(p)
        setSolverLoadError('')
        try {
          const raw = localStorage.getItem(STORAGE_KEY_PROGRESS)
          if (raw) {
            const { encoded: savedEncoded, fill: savedFill } = JSON.parse(raw)
            if (savedEncoded === encoded) {
              const R = p.grid.length
              const C = p.grid[0].length
              if (Array.isArray(savedFill) && savedFill.length === R && savedFill[0]?.length === C) {
                setSolverFill(savedFill)
                return
              }
            }
          }
        } catch (_) {}
        setSolverFill(createEmptyFill(p.grid.length, p.grid[0].length))
      }
      return
    }

    if (id) {
      setMode('solver')
      getPuzzle(id).then(({ data, error }) => {
        if (error) {
          setSolverLoadError('Could not load this puzzle.')
          return
        }
        setSolverLoadError('')
        setSolverPuzzle(data)
        setSolverFill(createEmptyFill(data.grid.length, data.grid[0].length))
      })
      return
    }

    if (editId) {
      setMode('creator')
      getPuzzle(editId).then(({ data, error }) => {
        if (error) {
          setLoadError('Could not load this puzzle.')
          return
        }
        const { words } = getWordsFromGrid(data.grid)
        setRows(data.rows)
        setCols(data.cols)
        setGrid(data.grid)
        setLetters(buildLettersFromAnswers(data.rows, data.cols, data.grid, data.answers || {}, words))
        setClues(data.clues || {})
        setTitle(data.title || '')
        setBlurb(data.blurb != null ? String(data.blurb) : '')
        setIsAcrostic(Boolean(data.acrostic))
        setPuzzleId(data.id)
        setCreatorName(data.creator || '')
        setLoadError('')
      })
    }
  }, [])

  const goToHome = useCallback(() => {
    setMode('home')
    setSolverPuzzle(null)
    setSolverFill(null)
  }, [])

  const goToCreator = useCallback(() => {
    setMode('creator')
    setSolverPuzzle(null)
    setSolverFill(null)
    setPuzzleId(null)
    setSolverLoadError('')
  }, [])

  useEffect(() => {
    if (mode !== 'creator') return
    listPuzzles().then(({ data, error }) => {
      if (error) {
        setListLoadError(error?.message || 'Could not load puzzles.')
        return
      }
      setPuzzleList(data || [])
      setListLoadError('')
    })
  }, [mode])

  const startNewPuzzle = useCallback(() => {
    setPuzzleId(null)
    setRows(DEFAULT_SIZE)
    setCols(DEFAULT_SIZE)
    setGrid(createEmptyGrid(DEFAULT_SIZE, DEFAULT_SIZE))
    setLetters(createEmptyFill(DEFAULT_SIZE, DEFAULT_SIZE))
    setClues({})
    setTitle('')
    setBlurb('')
    setIsAcrostic(false)
    setLoadError('')
    window.history.replaceState(null, '', window.location.pathname)
  }, [])

  const loadPuzzleForEdit = useCallback((id) => {
    setLoadError('')
    getPuzzle(id).then(({ data, error }) => {
      if (error) {
        setLoadError('Could not load this puzzle.')
        return
      }
      const { words } = getWordsFromGrid(data.grid)
      setRows(data.rows)
      setCols(data.cols)
      setGrid(data.grid)
      setLetters(buildLettersFromAnswers(data.rows, data.cols, data.grid, data.answers || {}, words))
      setClues(data.clues || {})
      setTitle(data.title || '')
      setBlurb(data.blurb != null ? String(data.blurb) : '')
      setIsAcrostic(Boolean(data.acrostic))
      setPuzzleId(data.id)
      setCreatorName(data.creator || '')
      setLoadError('')
      window.history.replaceState(null, '', `${window.location.pathname}?edit=${id}`)
    })
  }, [])

  const handleNewPuzzle = useCallback(() => {
    setSaveConfirmPending('new')
  }, [])

  const handleSaveConfirmNo = useCallback(() => {
    const pending = saveConfirmPending
    setSaveConfirmPending(null)
    if (pending === 'new') {
      startNewPuzzle()
    } else if (typeof pending === 'string') {
      loadPuzzleForEdit(pending)
    }
  }, [saveConfirmPending, startNewPuzzle, loadPuzzleForEdit])

  const handleSaveConfirmYes = useCallback(async () => {
    const pending = saveConfirmPending
    const ok = await saveToDb()
    if (ok) {
      setSaveConfirmPending(null)
      if (pending === 'new') {
        startNewPuzzle()
      } else if (typeof pending === 'string') {
        loadPuzzleForEdit(pending)
      }
    }
  }, [saveConfirmPending, saveToDb, startNewPuzzle, loadPuzzleForEdit])

  const handlePuzzleSelect = useCallback((id) => {
    if (id === puzzleId) return
    setSaveConfirmPending(id)
  }, [puzzleId])

  const acrossWords = words.filter((w) => w.direction === 'across')
  const downWords = words.filter((w) => w.direction === 'down')

  const goToSolver = useCallback(() => {
    setMode('solver')
    setSolverPuzzle(null)
    setSolverFill(null)
  }, [])

  const onSolverLoaded = useCallback((puzzle, fill) => {
    setSolverPuzzle(puzzle)
    setSolverFill(
      fill ?? createEmptyFill(puzzle.grid.length, puzzle.grid[0].length)
    )
  }, [])

  if (mode === 'home') {
    return (
      <div className="app home-app">
        <header className="header home-header">
          <h1>Mini Crossword</h1>
          <p className="home-prompt">Create or solve a puzzle?</p>
        </header>
        <section className="section home-actions">
          <button type="button" className="home-btn" onClick={goToCreator}>
            Create
          </button>
          <button type="button" className="home-btn" onClick={goToSolver}>
            Solve
          </button>
        </section>
      </div>
    )
  }

  if (mode === 'solver') {
    if (solverPuzzle) {
      return (
        <div className="app">
          <SolverView
            puzzle={solverPuzzle}
            initialFill={solverFill}
            onBack={goToHome}
          />
        </div>
      )
    }
    return (
      <div className="app">
        <SolverLanding
          onLoaded={onSolverLoaded}
          onBack={goToHome}
          loadError={solverLoadError}
          onClearLoadError={() => setSolverLoadError('')}
        />
      </div>
    )
  }

  return (
    <div className="app">
      {saveConfirmPending != null && (
        <div className="creator-save-modal-overlay" onClick={() => setSaveConfirmPending(null)}>
          <div className="creator-save-modal" onClick={(e) => e.stopPropagation()}>
            <p className="creator-save-modal-message">Save current puzzle to the database?</p>
            <div className="creator-save-modal-buttons">
              <button type="button" onClick={handleSaveConfirmNo}>
                No
              </button>
              <button type="button" onClick={handleSaveConfirmYes}>
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="header">
        <button type="button" className="nav-link" onClick={goToHome}>
          ← Home
        </button>
        <button type="button" className="nav-link" onClick={goToSolver}>
          Solve a puzzle →
        </button>
        <h1>Mini Crossword — Creator</h1>
      </header>

      <div className="creator-layout">
        <aside className="creator-pane">
          <h2>Puzzles</h2>
          {listLoadError && <p className="error">{listLoadError}</p>}
          <ul className="puzzle-list">
            <li>
              <button
                type="button"
                className="puzzle-list-btn puzzle-list-btn-new"
                onClick={handleNewPuzzle}
              >
                New...
              </button>
            </li>
            {puzzleList.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={`puzzle-list-btn ${puzzleId === p.id ? 'active' : ''}`}
                  onClick={() => handlePuzzleSelect(p.id)}
                >
                  {p.title || 'Untitled'} {p.creator ? `— ${p.creator}` : ''}
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <main className="creator-main">
      <section className="section">
        <label className="title-row">
          Puzzle title (max 25):{' '}
          <input
            type="text"
            maxLength={25}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Puzzle name"
            className="title-input"
          />
        </label>
        <label className="acrostic-row">
          <input
            type="checkbox"
            checked={isAcrostic}
            onChange={(e) => {
              const checked = e.target.checked
              setIsAcrostic(checked)
              if (checked) {
                setCols(rows)
                setGrid(createEmptyGrid(rows, rows))
                setLetters(createEmptyFill(rows, rows))
                setClues({})
              }
            }}
          />
          Acrostic (same words across and down; hide down clues)
        </label>
        <label className="creator-name-row">
          Creator name (for DB, max 50):{' '}
          <input
            type="text"
            maxLength={50}
            value={creatorName}
            onChange={(e) => setCreatorName(e.target.value)}
            placeholder="Anonymous"
            className="creator-name-input"
          />
        </label>
        <label className="creator-blurb-row">
          Puzzle blurb (optional, 3–4 sentences):{' '}
          <textarea
            value={blurb}
            onChange={(e) => setBlurb(e.target.value)}
            placeholder="Theme or instructions for solvers…"
            className="creator-blurb-input"
            rows={4}
          />
        </label>
      </section>

      <section className="section">
        <h2>Grid</h2>
        <div className="size-row">
          <label>
            Rows:{' '}
            <input
              type="number"
              min={3}
              max={15}
              value={rows}
              onChange={(e) => handleResize(Number(e.target.value) || rows, cols)}
            />
          </label>
          <label>
            Cols:{' '}
            <input
              type="number"
              min={3}
              max={15}
              value={cols}
              onChange={(e) => handleResize(rows, Number(e.target.value) || cols)}
              disabled={isAcrostic}
              title={isAcrostic ? 'Acrostic uses same value as rows' : ''}
            />
          </label>
        </div>
        <p className="hint">
          Shift+click a cell to toggle black/white (diagonally symmetric). Click to type; A–Z only; Backspace/Delete clears; arrows move.
        </p>
        {!validation.valid && (
          <p className="validation-error">
            All words must be at least 3 letters. Short words: {validation.invalidWords.map((w) => `${w.number} ${w.direction}`).join(', ')}
          </p>
        )}
        <div className="grid-wrap">
          <div
            className="grid"
            style={{
              '--rows': rows,
              '--cols': cols,
            }}
          >
            {grid.map((row, r) =>
              row.map((black, c) => {
                const num = isAcrostic
                  ? (acrossWords.some((w) => w.startRow === r && w.startCol === c) ? numberAt(r, c) : null)
                  : numberAt(r, c)
                const whiteIndex = whiteCellOrder.findIndex(([rr, cc]) => rr === r && cc === c)
                if (black) {
                  return (
                    <div
                      key={`${r}-${c}`}
                      className="cell black"
                      onClick={(e) => handleToggleBlack(e, r, c)}
                    />
                  )
                }
                return (
                  <div
                    key={`${r}-${c}`}
                    className="cell white creator-cell"
                    onClick={(e) => {
                      if (e.shiftKey) handleToggleBlack(e, r, c)
                      else e.currentTarget.querySelector('.creator-cell-input')?.focus()
                    }}
                  >
                    {num != null && <span className="cell-num">{num}</span>}
                    <input
                      type="text"
                      maxLength={1}
                      value={letters[r][c]}
                      data-index={whiteIndex}
                      className="creator-cell-input"
                      onKeyDown={(e) => handleCreatorKeyDown(e, r, c)}
                      onChange={() => {}}
                    />
                  </div>
                )
              })
            )}
          </div>
        </div>
      </section>

      <section className="section">
        <h2>Clues & answers</h2>
        <p className="hint">Answers are filled from the letters in the grid (read-only).</p>
        <div className="clues-grid">
          <div className="clues-column">
            <h3>Across</h3>
            {acrossWords.map((w) => {
              const key = wordKey(w.number, 'across')
              return (
                <div key={key} className="clue-row">
                  <span className="clue-num">{w.number}.</span>
                  <input
                    type="text"
                    placeholder="Clue"
                    value={clues[key] ?? ''}
                    onChange={(e) => setClue(key, e.target.value)}
                  />
                  <span className="answer-readonly" title="From grid">
                    {answersFromLetters[key] || '—'}
                  </span>
                  <span className="answer-len">({w.length})</span>
                </div>
              )
            })}
          </div>
          {!isAcrostic && (
            <div className="clues-column">
              <h3>Down</h3>
              {downWords.map((w) => {
                const key = wordKey(w.number, 'down')
                return (
                  <div key={key} className="clue-row">
                    <span className="clue-num">{w.number}.</span>
                    <input
                      type="text"
                      placeholder="Clue"
                      value={clues[key] ?? ''}
                      onChange={(e) => setClue(key, e.target.value)}
                    />
                    <span className="answer-readonly" title="From grid">
                      {answersFromLetters[key] || '—'}
                    </span>
                    <span className="answer-len">({w.length})</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      <section className="section actions">
        <button type="button" onClick={saveToDb} disabled={!validation.valid}>
          Save to database
        </button>
        {dbSaveStatus && <span className="status">{dbSaveStatus}</span>}
        <button type="button" onClick={saveToBrowser}>
          Save to browser
        </button>
        <button type="button" onClick={loadFromBrowser}>
          Load saved
        </button>
        {puzzleId && (
          <button type="button" onClick={copyLinkById}>
            Copy link (by ID)
          </button>
        )}
        {copyStatus && <span className="status">{copyStatus}</span>}
        {loadError && <span className="error">{loadError}</span>}
      </section>

        </main>
      </div>
    </div>
  )
}

export default App
