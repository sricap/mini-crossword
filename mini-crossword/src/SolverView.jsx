import { useState, useCallback, useEffect, useMemo } from 'react'
import {
  getWordsFromGrid,
  encodePuzzle,
  decodePuzzle,
  wordKey,
  isPuzzleComplete,
  getIncorrectCells,
} from './utils/puzzle'
import { listPuzzles, getPuzzle } from './api/db'

const STORAGE_KEY_PROGRESS = 'mini-crossword-solver-progress'

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatTimeForMessage(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m === 0) return `${s} second${s !== 1 ? 's' : ''}`
  if (s === 0) return `${m} minute${m !== 1 ? 's' : ''}`
  return `${m} minute${m !== 1 ? 's' : ''} ${s} second${s !== 1 ? 's' : ''}`
}

function SolverView({ puzzle, initialFill, onBack }) {
  const [fill, setFill] = useState(initialFill)
  const [incorrectCells, setIncorrectCells] = useState(new Set())
  const [showCompletion, setShowCompletion] = useState(false)
  const [saveStatus, setSaveStatus] = useState('')
  const [loadError, setLoadError] = useState('')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [paused, setPaused] = useState(false)
  const [modalMessage, setModalMessage] = useState(null)

  const { words, numberAt } = getWordsFromGrid(puzzle.grid)
  const acrossWords = words.filter((w) => w.direction === 'across')
  const downWords = words.filter((w) => w.direction === 'down')
  const rows = puzzle.grid.length
  const cols = puzzle.grid[0].length

  useEffect(() => {
    if (paused) return
    const id = setInterval(() => setElapsedSeconds((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [paused])

  const solverCellOrder = useMemo(() => {
    const list = []
    for (const w of acrossWords) {
      for (let i = 0; i < w.length; i++)
        list.push([w.startRow, w.startCol + i])
    }
    if (list.length === 0) {
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
          if (!puzzle.grid[r][c]) list.push([r, c])
    }
    return list
  }, [acrossWords, rows, cols, puzzle.grid])

  const focusSolverCell = useCallback((index) => {
    const el = document.querySelector(`.solver-cell-input[data-solver-index="${index}"]`)
    if (el) el.focus()
  }, [])

  const setCell = useCallback((r, c, value) => {
    const letter = (value.slice(-1) || '').toUpperCase()
    setFill((prev) => {
      const next = prev.map((row, i) =>
        row.map((cell, j) => (i === r && j === c ? letter : cell))
      )
      return next
    })
    setIncorrectCells(new Set())
    setShowCompletion(false)
  }, [])

  const check = useCallback(() => {
    const wrong = getIncorrectCells(puzzle, fill)
    setIncorrectCells(wrong)
    const complete = wrong.size === 0 && isPuzzleComplete(puzzle, fill)
    if (complete) {
      setShowCompletion(true)
      setModalMessage(`Congratulations! You solved it in ${formatTimeForMessage(elapsedSeconds)}!`)
    } else {
      setModalMessage('Aw, snap! At least one square does not have the right letter. Try again!')
      setPaused(true)
    }
  }, [puzzle, fill, elapsedSeconds])

  const revealWord = useCallback((w) => {
    const key = wordKey(w.number, w.direction)
    const answer = (puzzle.answers[key] || '').toUpperCase()
    setFill((prev) => {
      const next = prev.map((row) => row.slice())
      if (w.direction === 'across') {
        for (let i = 0; i < w.length; i++)
          next[w.startRow][w.startCol + i] = answer[i] || ''
      } else {
        for (let i = 0; i < w.length; i++)
          next[w.startRow + i][w.startCol] = answer[i] || ''
      }
      return next
    })
    setIncorrectCells(new Set())
    setShowCompletion(false)
  }, [puzzle])

  const revealAll = useCallback(() => {
    const next = fill.map((row) => row.slice())
    for (const w of words) {
      const key = wordKey(w.number, w.direction)
      const answer = (puzzle.answers[key] || '').toUpperCase()
      if (w.direction === 'across') {
        for (let i = 0; i < w.length; i++)
          next[w.startRow][w.startCol + i] = answer[i] || ''
      } else {
        for (let i = 0; i < w.length; i++)
          next[w.startRow + i][w.startCol] = answer[i] || ''
      }
    }
    setFill(next)
    setIncorrectCells(new Set())
    setShowCompletion(true)
  }, [puzzle, words, fill])

  const saveProgress = useCallback(() => {
    const encoded = encodePuzzle(puzzle)
    try {
      localStorage.setItem(
        STORAGE_KEY_PROGRESS,
        JSON.stringify({ encoded, fill })
      )
      setSaveStatus('Progress saved.')
      setLoadError('')
      setTimeout(() => setSaveStatus(''), 2000)
    } catch {
      setSaveStatus('Failed to save.')
    }
  }, [puzzle, fill])

  const handleSolverKeyDown = useCallback(
    (e, r, c) => {
      const idx = solverCellOrder.findIndex(([rr, cc]) => rr === r && cc === c)
      if (idx < 0) return
      const key = e.key
      if (key.length === 1 && /^[a-zA-Z]$/.test(key)) {
        e.preventDefault()
        setCell(r, c, key)
        const nextIdx = idx < solverCellOrder.length - 1 ? idx + 1 : 0
        focusSolverCell(nextIdx)
      } else if (key === 'Backspace' || key === 'Delete') {
        e.preventDefault()
        setCell(r, c, '')
        const prevIdx = idx > 0 ? idx - 1 : solverCellOrder.length - 1
        focusSolverCell(prevIdx)
      }
    },
    [solverCellOrder, setCell, focusSolverCell]
  )

  const acrostic = Boolean(puzzle.acrostic)

  return (
    <div className={`solver-view ${paused ? 'solver-paused' : ''}`}>
      {paused && (
        <div className="solver-pause-overlay" aria-hidden="true" />
      )}
      {modalMessage && (
        <div className="solver-modal-overlay" onClick={() => { setModalMessage(null); setPaused(false); }}>
          <div className="solver-modal" onClick={(e) => e.stopPropagation()}>
            <p>{modalMessage}</p>
            <button type="button" onClick={() => { setModalMessage(null); setPaused(false); }}>OK</button>
          </div>
        </div>
      )}
      <header className="header solver-header">
        <button type="button" className="nav-link" onClick={onBack}>
          ← Home
        </button>
        <h1>{puzzle.title ? `${puzzle.title} — Solver` : 'Mini Crossword — Solver'}</h1>
        <div className="solver-timer">
          <span className="timer-display">{formatTime(elapsedSeconds)}</span>
          <button type="button" className="timer-pause-btn" onClick={() => setPaused((p) => !p)}>
            {paused ? 'Resume' : 'Pause'}
          </button>
        </div>
      </header>

      <div className="solver-layout">
        <section className="section">
          <div className="grid-wrap solver-grid-wrap">
            <div
              className="grid solver-grid"
              style={{ '--rows': rows, '--cols': cols }}
            >
              {puzzle.grid.map((row, r) =>
                row.map((black, c) => {
                  const num = acrostic
                    ? (acrossWords.some((w) => w.startRow === r && w.startCol === c) ? numberAt(r, c) : null)
                    : numberAt(r, c)
                  if (black) {
                    return (
                      <div key={`${r}-${c}`} className="cell black" />
                    )
                  }
                  const isWrong = incorrectCells.has(`${r},${c}`)
                  const solverIdx = solverCellOrder.findIndex(([rr, cc]) => rr === r && cc === c)
                  return (
                    <div
                      key={`${r}-${c}`}
                      className={`cell white solver-cell ${isWrong ? 'incorrect' : ''}`}
                    >
                      {num != null && <span className="cell-num">{num}</span>}
                      <input
                        type="text"
                        maxLength={1}
                        value={fill[r][c]}
                        data-solver-index={solverIdx}
                        className="solver-input solver-cell-input"
                        onChange={(e) => setCell(r, c, e.target.value)}
                        onKeyDown={(e) => handleSolverKeyDown(e, r, c)}
                      />
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </section>

        <section className="section solver-clues">
          <h2>Clues</h2>
          <div className="clues-grid">
            <div className="clues-column">
              <h3>Across</h3>
              {acrossWords.map((w) => {
                const key = wordKey(w.number, 'across')
                return (
                  <div key={key} className="clue-row solver-clue-row">
                    <span className="clue-num">{w.number}.</span>
                    <span className="clue-text">{puzzle.clues[key] || '—'}</span>
                    <button
                      type="button"
                      className="reveal-word-btn"
                      onClick={() => revealWord(w)}
                    >
                      Reveal
                    </button>
                  </div>
                )
              })}
            </div>
            {!acrostic && (
              <div className="clues-column">
                <h3>Down</h3>
                {downWords.map((w) => {
                  const key = wordKey(w.number, 'down')
                  return (
                    <div key={key} className="clue-row solver-clue-row">
                      <span className="clue-num">{w.number}.</span>
                      <span className="clue-text">{puzzle.clues[key] || '—'}</span>
                      <button
                        type="button"
                        className="reveal-word-btn"
                        onClick={() => revealWord(w)}
                      >
                        Reveal
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="section actions">
        <button type="button" onClick={check}>
          Check
        </button>
        <button type="button" onClick={revealAll}>
          Reveal all
        </button>
        <button type="button" onClick={saveProgress}>
          Save progress
        </button>
        {saveStatus && <span className="status">{saveStatus}</span>}
        {loadError && <span className="error">{loadError}</span>}
      </section>
    </div>
  )
}

function formatListDate(isoString) {
  if (!isoString) return '—'
  try {
    const d = new Date(isoString)
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return '—'
  }
}

function SolverLanding({ onLoaded, onBack, loadError: propLoadError = '', onClearLoadError }) {
  const [loadError, setLoadError] = useState('')
  const [puzzleList, setPuzzleList] = useState([])
  const [listLoadError, setListLoadError] = useState('')

  useEffect(() => {
    listPuzzles().then(({ data, error }) => {
      if (error) {
        setListLoadError('Could not load puzzles.')
        return
      }
      setPuzzleList(data || [])
      setListLoadError('')
    })
  }, [])

  const loadFromDbId = useCallback((id) => {
    setLoadError('')
    if (onClearLoadError) onClearLoadError()
    getPuzzle(id).then(({ data, error }) => {
      if (error) {
        setLoadError('Could not load this puzzle.')
        return
      }
      onLoaded(data, null)
      window.history.replaceState(null, '', `${window.location.pathname}?id=${id}`)
    })
  }, [onLoaded, onClearLoadError])

  const loadSaved = useCallback(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PROGRESS)
      if (!raw) {
        setLoadError('No saved progress found.')
        return
      }
      const { encoded, fill: savedFill } = JSON.parse(raw)
      const p = decodePuzzle(encoded)
      if (!p) {
        setLoadError('Could not load saved puzzle.')
        return
      }
      const rows = p.grid.length
      const cols = p.grid[0].length
      const fill =
        Array.isArray(savedFill) &&
        savedFill.length === rows &&
        savedFill[0]?.length === cols
          ? savedFill
          : null
      setLoadError('')
      onLoaded(p, fill)
    } catch {
      setLoadError('Could not load saved progress.')
    }
  }, [onLoaded])

  const displayError = propLoadError || loadError

  return (
    <div className="solver-view">
      <header className="header solver-header">
        <button type="button" className="nav-link" onClick={onBack}>
          ← Home
        </button>
        <h1>Mini Crossword — Solver</h1>
      </header>
      <section className="section">
        <h2>Choose a puzzle</h2>
        <p className="hint">
          Click a puzzle title to play, or load saved progress.
        </p>
        {listLoadError && <span className="error">{listLoadError}</span>}
        {puzzleList.length > 0 && (
          <div className="puzzle-list-page">
            <ul className="puzzle-list-detail">
              {puzzleList.map((p) => (
                <li key={p.id} className="puzzle-list-item">
                  <button
                    type="button"
                    className="puzzle-list-title-btn"
                    onClick={() => loadFromDbId(p.id)}
                  >
                    {p.title || 'Untitled'}
                  </button>
                  <span className="puzzle-list-meta">
                    {[p.rows && p.cols ? `${p.rows}×${p.cols}` : null, p.creator || 'Anonymous', formatListDate(p.created_at)].filter(Boolean).join(' · ')}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <button type="button" onClick={loadSaved} className="load-saved-btn">
          Load saved progress
        </button>
        {displayError && (
          <span className="error">
            {displayError}
            {onClearLoadError && (
              <button type="button" className="error-dismiss" onClick={onClearLoadError} aria-label="Dismiss">
                ×
              </button>
            )}
          </span>
        )}
      </section>
    </div>
  )
}

export { SolverView, SolverLanding }
