import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
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
  validatePhraseLensAgainstWordLength,
  getAcrosticAcrossDisplayNumbers,
} from './utils/puzzle'
import { listPuzzles, getPuzzle, createPuzzle, updatePuzzle } from './api/db'
import { SolverView, SolverLanding } from './SolverView'
import { IconHome, IconCreate, IconSolve, IconSave, IconLink } from './Icons'
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
  const [phraseLens, setPhraseLens] = useState({})
  const [phraseLensErrors, setPhraseLensErrors] = useState({})
  const creatorLastTapRef = useRef({ time: 0, r: -1, c: -1 })

  const { words, numberAt } = getWordsFromGrid(grid)
  const validation = validateGrid(grid)

  const handleResize = useCallback((newRows, newCols) => {
    const effectiveCols = isAcrostic ? newRows : newCols
    setRows(newRows)
    setCols(effectiveCols)
    setGrid(createEmptyGrid(newRows, effectiveCols))
    setLetters(createEmptyFill(newRows, effectiveCols))
    setClues({})
    setPhraseLens({})
    setPhraseLensErrors({})
  }, [isAcrostic])

  const handleToggleBlack = useCallback((e, r, c) => {
    const isShiftClick = e.shiftKey
    const isSpaceKey = e.key === ' '
    const isBlackCellClick = e.type === 'click' && e.target?.closest?.('.cell.black')
    if (!isShiftClick && !isSpaceKey && !isBlackCellClick) return
    e.preventDefault()
    setGrid((prev) => toggleCellSymmetrically(prev, r, c))
  }, [])

  const setClue = useCallback((key, value) => {
    setClues((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handlePhraseLensChange = useCallback((key, value) => {
    setPhraseLens((prev) => ({ ...prev, [key]: value }))
    setPhraseLensErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }, [])

  const handlePhraseLensBlur = useCallback((key, wordLength, raw) => {
    const text = (raw ?? '').trim()
    if (!text) {
      setPhraseLens((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
      setPhraseLensErrors((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
      return
    }
    const result = validatePhraseLensAgainstWordLength(text, wordLength)
    if (!result.valid) {
      window.alert(result.message)
      setPhraseLensErrors((prev) => ({ ...prev, [key]: result.message }))
      return
    }
    setPhraseLensErrors((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
    setPhraseLens((prev) => ({ ...prev, [key]: result.normalized }))
  }, [])

  const handleWhiteCellTouchEnd = useCallback((e, r, c) => {
    const now = Date.now()
    const prev = creatorLastTapRef.current
    if (prev.r === r && prev.c === c && now - prev.time < 450) {
      e.preventDefault()
      creatorLastTapRef.current = { time: 0, r: -1, c: -1 }
      setGrid((g) => toggleCellSymmetrically(g, r, c))
      return
    }
    creatorLastTapRef.current = { time: now, r, c }
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
    if (!el) return
    el.focus()
    const len = (el.value || '').length
    requestAnimationFrame(() => {
      try {
        el.setSelectionRange(len, len)
      } catch (_) {
        /* ignore */
      }
    })
  }, [])

  const snapCreatorCaretToEnd = useCallback((e) => {
    const el = e.currentTarget
    const place = () => {
      const len = (el.value || '').length
      try {
        el.setSelectionRange(len, len)
      } catch (_) {
        /* ignore */
      }
    }
    requestAnimationFrame(() => {
      place()
      requestAnimationFrame(place)
    })
  }, [])

  const handleCreatorKeyDown = useCallback(
    (e, r, c) => {
      const idx = whiteCellOrder.findIndex(([rr, cc]) => rr === r && cc === c)
      if (idx < 0) return
      const key = e.key
      if (key === ' ') {
        e.preventDefault()
        handleToggleBlack(e, r, c)
      } else if (key.length === 1 && /^[a-zA-Z]$/.test(key)) {
        e.preventDefault()
        setLetter(r, c, key)
        if (idx < whiteCellOrder.length - 1) focusCell(idx + 1)
      } else if (key === 'Backspace' || key === 'Delete') {
        e.preventDefault()
        const cur = (letters[r][c] || '').trim()
        if (cur) {
          setLetter(r, c, '')
          focusCell(idx)
        } else if (idx > 0) {
          focusCell(idx - 1)
        }
      } else if (key === 'ArrowRight') {
        e.preventDefault()
        if (c < cols - 1 && !grid[r][c + 1]) {
          const j = whiteCellOrder.findIndex(([rr, cc]) => rr === r && cc === c + 1)
          if (j >= 0) focusCell(j)
        }
      } else if (key === 'ArrowLeft') {
        e.preventDefault()
        if (c > 0 && !grid[r][c - 1]) {
          const j = whiteCellOrder.findIndex(([rr, cc]) => rr === r && cc === c - 1)
          if (j >= 0) focusCell(j)
        }
      } else if (key === 'ArrowDown') {
        e.preventDefault()
        if (r < rows - 1 && !grid[r + 1][c]) {
          const j = whiteCellOrder.findIndex(([rr, cc]) => rr === r + 1 && cc === c)
          if (j >= 0) focusCell(j)
        }
      } else if (key === 'ArrowUp') {
        e.preventDefault()
        if (r > 0 && !grid[r - 1][c]) {
          const j = whiteCellOrder.findIndex(([rr, cc]) => rr === r - 1 && cc === c)
          if (j >= 0) focusCell(j)
        }
      }
    },
    [whiteCellOrder, letters, rows, cols, grid, setLetter, focusCell, handleToggleBlack]
  )

  const handleCreatorCellChange = useCallback(
    (e, r, c, whiteIndex) => {
      const raw = (e.target.value || '').toUpperCase().replace(/[^A-Z]/g, '').slice(-1)
      setLetter(r, c, raw)
      if (raw.length === 1 && whiteIndex < whiteCellOrder.length - 1) {
        setTimeout(() => focusCell(whiteIndex + 1), 0)
      }
    },
    [whiteCellOrder.length, setLetter, focusCell]
  )

  const answersFromLetters = useMemo(
    () => getAnswersFromLetters(grid, letters, words),
    [grid, letters, words]
  )

  const saveToBrowser = useCallback(() => {
    const payload = {
      rows,
      cols,
      grid,
      clues,
      answers: answersFromLetters,
      title,
      blurb,
      acrostic: isAcrostic,
      phraseLens,
    }
    localStorage.setItem(STORAGE_KEY, encodePuzzle(payload))
    setLoadError('')
  }, [rows, cols, grid, clues, answersFromLetters, title, blurb, isAcrostic, phraseLens])

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
    setPhraseLens(p.phraseLens && typeof p.phraseLens === 'object' ? p.phraseLens : {})
    setPhraseLensErrors({})
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
      phraseLens,
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
  }, [
    puzzleId,
    rows,
    cols,
    grid,
    clues,
    answersFromLetters,
    title,
    blurb,
    isAcrostic,
    creatorName,
    validation.valid,
    phraseLens,
  ])

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
        setPhraseLens(
          data.phraseLens && typeof data.phraseLens === 'object' ? data.phraseLens : {}
        )
        setPhraseLensErrors({})
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
    setPhraseLens({})
    setPhraseLensErrors({})
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
      setPhraseLens(
        data.phraseLens && typeof data.phraseLens === 'object' ? data.phraseLens : {}
      )
      setPhraseLensErrors({})
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
  const acrosticDisplayNums = useMemo(
    () => (isAcrostic ? getAcrosticAcrossDisplayNumbers(acrossWords) : null),
    [isAcrostic, acrossWords]
  )

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
          <button type="button" className="home-btn action-btn-icon" onClick={goToCreator} title="Create" aria-label="Create">
            <IconCreate size={22} />
            <span>Create</span>
          </button>
          <button type="button" className="home-btn action-btn-icon" onClick={goToSolver} title="Solve a puzzle" aria-label="Solve a puzzle">
            <IconSolve size={22} />
            <span>Solve</span>
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

      <header className="header creator-header creator-header-mobile-only">
        <div className="creator-header-mobile">
          <button type="button" className="nav-link nav-link-icon" onClick={goToHome} title="Home" aria-label="Home">
            <IconHome size={22} />
          </button>
          <select
            className="creator-mobile-dropdown"
            value={puzzleId || 'new'}
            onChange={(e) => {
              const v = e.target.value
              if (v === 'new') handleNewPuzzle()
              else handlePuzzleSelect(v)
            }}
            aria-label="Select puzzle"
          >
            <option value="new">New...</option>
            {puzzleList.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title || 'Untitled'}
                {p.creator ? ` — ${p.creator}` : ''}
              </option>
            ))}
          </select>
          <button type="button" className="nav-link nav-link-icon" onClick={goToSolver} title="Solve a puzzle" aria-label="Solve a puzzle">
            <IconSolve size={22} />
          </button>
        </div>
      </header>

      <div className="creator-layout">
        <div className="creator-left">
          <div className="creator-left-header">
            <button type="button" className="nav-link nav-link-icon" onClick={goToHome} title="Home" aria-label="Home">
              <IconHome size={20} />
            </button>
            <button type="button" className="nav-link nav-link-icon" onClick={goToSolver} title="Solve a puzzle" aria-label="Solve a puzzle">
              <IconSolve size={20} />
            </button>
          </div>
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
        </div>
        <main className="creator-main">
          <h1 className="creator-main-title">Create away...</h1>
      <section className="section">
        <label className="title-row">
          Name your creation:{' '}
          <input
            type="text"
            maxLength={25}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Puzzle name"
            className="title-input"
          />
        </label>
        <label className="creator-name-row">
          Creator:{' '}
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
          Puzzle blurb (optional):{' '}
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
        <label className="acrostic-row grid-acrostic-row">
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
          Acrostic (same words across and down)
        </label>
        <div className="size-row">
          <label>
            Rows:{' '}
            <span className="size-stepper">
              <button type="button" className="size-step-btn" onClick={() => handleResize(Math.max(3, rows - 1), cols)} aria-label="Decrease rows">−</button>
              <input
                type="number"
                min={3}
                max={15}
                value={rows}
                onChange={(e) => handleResize(Number(e.target.value) || rows, cols)}
                className="size-input"
                aria-label="Rows"
              />
              <button type="button" className="size-step-btn" onClick={() => handleResize(Math.min(15, rows + 1), cols)} aria-label="Increase rows">+</button>
            </span>
          </label>
          <label>
            Cols:{' '}
            <span className="size-stepper">
              <button type="button" className="size-step-btn" onClick={() => handleResize(rows, Math.max(3, cols - 1))} aria-label="Decrease columns" disabled={isAcrostic}>−</button>
              <input
                type="number"
                min={3}
                max={15}
                value={cols}
                onChange={(e) => handleResize(rows, Number(e.target.value) || cols)}
                className="size-input"
                disabled={isAcrostic}
                title={isAcrostic ? 'Acrostic uses same value as rows' : ''}
                aria-label="Columns"
              />
              <button type="button" className="size-step-btn" onClick={() => handleResize(rows, Math.min(15, cols + 1))} aria-label="Increase columns" disabled={isAcrostic}>+</button>
            </span>
          </label>
        </div>
        <p className="hint">
          Double-tap a white cell to toggle black/white (diagonally symmetric). Shift+click or Space also toggle. Click to type.
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
                const wAcross = acrossWords.find((x) => x.startRow === r && x.startCol === c)
                const num = isAcrostic
                  ? wAcross && acrosticDisplayNums
                    ? acrosticDisplayNums.get(wordKey(wAcross.number, 'across'))
                    : null
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
                    onTouchEnd={(e) => handleWhiteCellTouchEnd(e, r, c)}
                    onDoubleClick={(e) => {
                      e.preventDefault()
                      setGrid((g) => toggleCellSymmetrically(g, r, c))
                    }}
                    onClick={(e) => {
                      if (e.shiftKey) handleToggleBlack(e, r, c)
                      else e.currentTarget.querySelector('.creator-cell-input')?.focus()
                    }}
                  >
                    {num != null && <span className="cell-num">{num}</span>}
                    <input
                      type="text"
                      inputMode="text"
                      maxLength={1}
                      value={letters[r][c]}
                      data-index={whiteIndex}
                      className="creator-cell-input"
                      onKeyDown={(e) => handleCreatorKeyDown(e, r, c)}
                      onChange={(e) => handleCreatorCellChange(e, r, c, whiteIndex)}
                      onFocus={snapCreatorCaretToEnd}
                      onClick={snapCreatorCaretToEnd}
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
              const clueNum =
                isAcrostic && acrosticDisplayNums
                  ? acrosticDisplayNums.get(key)
                  : w.number
              const lenVal = phraseLens[key] ?? String(w.length)
              const err = phraseLensErrors[key]
              const phraseLenCh = Math.max(1, lenVal.length || 1)
              return (
                <div key={key} className="clue-row">
                  <span className="clue-num">{clueNum}.</span>
                  <input
                    type="text"
                    className="clue-text-input"
                    placeholder="Clue"
                    value={clues[key] ?? ''}
                    onChange={(e) => setClue(key, e.target.value)}
                  />
                  <span className="answer-readonly" title="From grid">
                    {answersFromLetters[key] || '—'}
                  </span>
                  <span className="answer-len-wrap" title={err || undefined}>
                    (
                    <input
                      type="text"
                      inputMode="numeric"
                      size={phraseLenCh}
                      className={`answer-len-input ${err ? 'answer-len-input-invalid' : ''}`}
                      style={{
                        width: `${phraseLenCh}ch`,
                        minWidth: `${phraseLenCh}ch`,
                        maxWidth: `${phraseLenCh}ch`,
                        flexGrow: 0,
                        flexShrink: 0,
                      }}
                      value={lenVal}
                      onChange={(e) => handlePhraseLensChange(key, e.target.value)}
                      onBlur={(e) => handlePhraseLensBlur(key, w.length, e.target.value)}
                      aria-label={`Answer length breakdown for clue ${clueNum}`}
                    />
                    )
                  </span>
                </div>
              )
            })}
          </div>
          {!isAcrostic && (
            <div className="clues-column">
              <h3>Down</h3>
              {downWords.map((w) => {
                const key = wordKey(w.number, 'down')
                const lenVal = phraseLens[key] ?? String(w.length)
                const err = phraseLensErrors[key]
                const phraseLenCh = Math.max(1, lenVal.length || 1)
                return (
                  <div key={key} className="clue-row">
                    <span className="clue-num">{w.number}.</span>
                    <input
                      type="text"
                      className="clue-text-input"
                      placeholder="Clue"
                      value={clues[key] ?? ''}
                      onChange={(e) => setClue(key, e.target.value)}
                    />
                    <span className="answer-readonly" title="From grid">
                      {answersFromLetters[key] || '—'}
                    </span>
                    <span className="answer-len-wrap" title={err || undefined}>
                      (
                      <input
                        type="text"
                        inputMode="numeric"
                        size={phraseLenCh}
                        className={`answer-len-input ${err ? 'answer-len-input-invalid' : ''}`}
                        style={{
                          width: `${phraseLenCh}ch`,
                          minWidth: `${phraseLenCh}ch`,
                          maxWidth: `${phraseLenCh}ch`,
                          flexGrow: 0,
                          flexShrink: 0,
                        }}
                        value={lenVal}
                        onChange={(e) => handlePhraseLensChange(key, e.target.value)}
                        onBlur={(e) => handlePhraseLensBlur(key, w.length, e.target.value)}
                        aria-label={`Answer length breakdown for clue ${w.number} down`}
                      />
                      )
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      <section className="section actions">
        <button type="button" className="action-btn-icon" onClick={saveToDb} disabled={!validation.valid} title="Save to database" aria-label="Save to database">
          <IconSave size={18} />
          <span className="action-btn-label">Save to database</span>
        </button>
        {dbSaveStatus && <span className="status">{dbSaveStatus}</span>}
        <button type="button" className="action-btn-icon" onClick={saveToBrowser} title="Save to browser" aria-label="Save to browser">
          <IconSave size={18} />
          <span className="action-btn-label">Save to browser</span>
        </button>
        <button type="button" className="action-btn-icon" onClick={loadFromBrowser} title="Load saved" aria-label="Load saved">
          <IconSave size={18} />
          <span className="action-btn-label">Load saved</span>
        </button>
        {puzzleId && (
          <button type="button" className="action-btn-icon" onClick={copyLinkById} title="Copy link (by ID)" aria-label="Copy link (by ID)">
            <IconLink size={18} />
            <span className="action-btn-label">Copy link</span>
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
