import { useState, useCallback, useEffect, useMemo } from 'react'
import {
  getWordsFromGrid,
  encodePuzzle,
  decodePuzzle,
  wordKey,
  isPuzzleComplete,
  isGridFull,
  getIncorrectCells,
  getAcrosticAcrossDisplayNumbers,
} from './utils/puzzle'
import { listPuzzles, getPuzzle } from './api/db'
import { IconBack, IconCheck, IconRevealAll, IconSave } from './Icons'

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
    if (paused || showCompletion) return
    const id = setInterval(() => setElapsedSeconds((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [paused, showCompletion])

  useEffect(() => {
    if (showCompletion) return
    if (isPuzzleComplete(puzzle, fill)) {
      setShowCompletion(true)
      setPaused(true)
      setModalMessage(`Congratulations! You solved it in ${formatTimeForMessage(elapsedSeconds)}!`)
      return
    }
    if (isGridFull(puzzle, fill)) {
      setIncorrectCells(getIncorrectCells(puzzle, fill))
      setPaused(true)
      setModalMessage('Aw, snap! At least one square does not have the right letter. Try again!')
    }
  }, [puzzle, fill, elapsedSeconds, showCompletion])

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

  const snapSolverCaretToEnd = useCallback((e) => {
    const el = e.currentTarget
    const len = (el.value || '').length
    requestAnimationFrame(() => {
      try {
        el.setSelectionRange(len, len)
      } catch (_) {
        /* ignore */
      }
    })
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
      setPaused(true)
      setModalMessage(`Congratulations! You solved it in ${formatTimeForMessage(elapsedSeconds)}!`)
    } else {
      setModalMessage('Aw, snap! At least one square does not have the right letter. Try again!')
      setPaused(true)
    }
  }, [puzzle, fill, elapsedSeconds])

  const revealWord = useCallback((w) => {
    const key = wordKey(w.number, w.direction)
    const answer = (puzzle.answers[key] || '').toUpperCase()
    const next = fill.map((row) => row.slice())
    if (w.direction === 'across') {
      for (let i = 0; i < w.length; i++)
        next[w.startRow][w.startCol + i] = answer[i] || ''
    } else {
      for (let i = 0; i < w.length; i++)
        next[w.startRow + i][w.startCol] = answer[i] || ''
    }
    setFill(next)
    setIncorrectCells(new Set())
    if (isPuzzleComplete(puzzle, next)) {
      setShowCompletion(true)
      setPaused(true)
      setModalMessage(`Congratulations! You solved it in ${formatTimeForMessage(elapsedSeconds)}!`)
    } else {
      setShowCompletion(false)
    }
  }, [puzzle, fill, elapsedSeconds])

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
    setPaused(true)
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
      if (showCompletion) return
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
        const cur = (fill[r][c] || '').trim()
        if (cur) {
          setCell(r, c, '')
          focusSolverCell(idx)
        } else if (idx > 0) {
          focusSolverCell(idx - 1)
        }
      } else if (key === 'ArrowRight') {
        e.preventDefault()
        if (c < cols - 1 && !puzzle.grid[r][c + 1]) {
          const j = solverCellOrder.findIndex(([rr, cc]) => rr === r && cc === c + 1)
          if (j >= 0) focusSolverCell(j)
        }
      } else if (key === 'ArrowLeft') {
        e.preventDefault()
        if (c > 0 && !puzzle.grid[r][c - 1]) {
          const j = solverCellOrder.findIndex(([rr, cc]) => rr === r && cc === c - 1)
          if (j >= 0) focusSolverCell(j)
        }
      } else if (key === 'ArrowDown') {
        e.preventDefault()
        if (r < rows - 1 && !puzzle.grid[r + 1][c]) {
          const j = solverCellOrder.findIndex(([rr, cc]) => rr === r + 1 && cc === c)
          if (j >= 0) focusSolverCell(j)
        }
      } else if (key === 'ArrowUp') {
        e.preventDefault()
        if (r > 0 && !puzzle.grid[r - 1][c]) {
          const j = solverCellOrder.findIndex(([rr, cc]) => rr === r - 1 && cc === c)
          if (j >= 0) focusSolverCell(j)
        }
      }
    },
    [showCompletion, solverCellOrder, rows, cols, puzzle.grid, fill, setCell, focusSolverCell]
  )

  const acrostic = Boolean(puzzle.acrostic)
  const acrosticDisplayNums = useMemo(
    () => (acrostic ? getAcrosticAcrossDisplayNumbers(acrossWords) : null),
    [acrostic, acrossWords]
  )

  const showPauseOverlay = paused && !showCompletion

  return (
    <div className={`solver-view ${showPauseOverlay ? 'solver-paused' : ''}`}>
      {showPauseOverlay && (
        <div className="solver-pause-overlay" aria-hidden="true" />
      )}
      {modalMessage && (
        <div className="solver-modal-overlay" onClick={() => { setModalMessage(null); if (!showCompletion) setPaused(false); }}>
          <div className="solver-modal" onClick={(e) => e.stopPropagation()}>
            <p>{modalMessage}</p>
            <button type="button" onClick={() => { setModalMessage(null); if (!showCompletion) setPaused(false); }}>OK</button>
          </div>
        </div>
      )}
      <header className="header solver-header">
        <button type="button" className="nav-link nav-link-icon" onClick={onBack} title="Home" aria-label="Home">
          <IconBack size={22} />
        </button>
        <h1>{puzzle.title ? `${puzzle.title} — Solver` : 'Mini Crossword — Solver'}</h1>
        <div className="solver-timer">
          <span className="timer-display">{formatTime(elapsedSeconds)}</span>
          {!showCompletion && (
            <button type="button" className="timer-pause-btn" onClick={() => setPaused((p) => !p)}>
              {paused ? 'Resume' : 'Pause'}
            </button>
          )}
        </div>
      </header>

      {puzzle.blurb && (
        <p className="puzzle-blurb">{puzzle.blurb}</p>
      )}

      <div className="solver-layout">
        <section className="section">
          <div className="grid-wrap solver-grid-wrap">
            <div
              className="grid solver-grid"
              style={{ '--rows': rows, '--cols': cols }}
            >
              {puzzle.grid.map((row, r) =>
                row.map((black, c) => {
                  const wAcross = acrossWords.find((x) => x.startRow === r && x.startCol === c)
                  const num = acrostic
                    ? wAcross && acrosticDisplayNums
                      ? acrosticDisplayNums.get(wordKey(wAcross.number, 'across'))
                      : null
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
                        inputMode="text"
                        maxLength={1}
                        value={fill[r][c]}
                        data-solver-index={solverIdx}
                        className="solver-input solver-cell-input"
                        onChange={(e) => {
                          const v = e.target.value
                          setCell(r, c, v)
                          const letter = (v.slice(-1) || '').toUpperCase()
                          if (letter && /^[A-Z]$/.test(letter) && solverIdx >= 0 && solverIdx < solverCellOrder.length - 1) {
                            setTimeout(() => focusSolverCell(solverIdx + 1), 0)
                          }
                        }}
                        onKeyDown={(e) => handleSolverKeyDown(e, r, c)}
                        onFocus={snapSolverCaretToEnd}
                        onClick={snapSolverCaretToEnd}
                        readOnly={showCompletion}
                        aria-readonly={showCompletion}
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
                const clueNum =
                  acrostic && acrosticDisplayNums ? acrosticDisplayNums.get(key) : w.number
                const lenDisplay =
                  puzzle.phraseLens && typeof puzzle.phraseLens === 'object' && puzzle.phraseLens[key] != null
                    ? String(puzzle.phraseLens[key])
                    : String(w.length)
                return (
                  <div key={key} className="clue-row solver-clue-row">
                    <span className="clue-num">{clueNum}.</span>
                    <span className="clue-text">{puzzle.clues[key] || '—'}</span>
                    <span className="answer-len-wrap">
                      (<span className="answer-len-display">{lenDisplay}</span>)
                    </span>
                    <button
                      type="button"
                      className="reveal-word-icon-btn"
                      onClick={() => revealWord(w)}
                      title="Reveal Word"
                      aria-label="Reveal Word"
                      disabled={showCompletion}
                    >
                      <span className="reveal-icon" aria-hidden>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M9 18h6" />
                          <path d="M10 22h4" />
                          <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.91 3.5A4.65 4.65 0 0 1 8.91 14" />
                        </svg>
                      </span>
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
                  const lenDisplay =
                    puzzle.phraseLens && typeof puzzle.phraseLens === 'object' && puzzle.phraseLens[key] != null
                      ? String(puzzle.phraseLens[key])
                      : String(w.length)
                    return (
                    <div key={key} className="clue-row solver-clue-row">
                      <span className="clue-num">{w.number}.</span>
                      <span className="clue-text">{puzzle.clues[key] || '—'}</span>
                      <span className="answer-len-wrap">
                        (<span className="answer-len-display">{lenDisplay}</span>)
                      </span>
                      <button
                        type="button"
                        className="reveal-word-icon-btn"
                        onClick={() => revealWord(w)}
                        title="Reveal Word"
                        aria-label="Reveal Word"
                        disabled={showCompletion}
                      >
                        <span className="reveal-icon" aria-hidden>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M9 18h6" />
                          <path d="M10 22h4" />
                          <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.91 3.5A4.65 4.65 0 0 1 8.91 14" />
                        </svg>
                      </span>
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
        {!showCompletion && (
          <>
            <button type="button" className="action-btn-icon" onClick={check} title="Check" aria-label="Check">
              <IconCheck size={18} />
              <span className="action-btn-label">Check</span>
            </button>
            <button type="button" className="action-btn-icon" onClick={revealAll} title="Reveal all" aria-label="Reveal all">
              <IconRevealAll size={18} />
              <span className="action-btn-label">Reveal all</span>
            </button>
            <button type="button" className="action-btn-icon" onClick={saveProgress} title="Save progress" aria-label="Save progress">
              <IconSave size={18} />
              <span className="action-btn-label">Save progress</span>
            </button>
          </>
        )}
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

function sortPuzzles(list, sortKey, sortAsc) {
  const arr = [...list]
  arr.sort((a, b) => {
    let va, vb
    switch (sortKey) {
      case 'title':
        va = (a.title || 'Untitled').toLowerCase()
        vb = (b.title || 'Untitled').toLowerCase()
        return sortAsc ? (va < vb ? -1 : va > vb ? 1 : 0) : (vb < va ? -1 : vb > va ? 1 : 0)
      case 'gridSize':
        va = (a.rows || 0) * 100 + (a.cols || 0)
        vb = (b.rows || 0) * 100 + (b.cols || 0)
        return sortAsc ? va - vb : vb - va
      case 'acrostic':
        va = a.acrostic ? 1 : 0
        vb = b.acrostic ? 1 : 0
        return sortAsc ? va - vb : vb - va
      case 'author':
        va = (a.creator || 'Anonymous').toLowerCase()
        vb = (b.creator || 'Anonymous').toLowerCase()
        return sortAsc ? (va < vb ? -1 : va > vb ? 1 : 0) : (vb < va ? -1 : vb > va ? 1 : 0)
      case 'date':
        va = new Date(a.created_at || 0).getTime()
        vb = new Date(b.created_at || 0).getTime()
        return sortAsc ? va - vb : vb - va
      default:
        return 0
    }
  })
  return arr
}

function SolverLanding({ onLoaded, onBack, loadError: propLoadError = '', onClearLoadError }) {
  const [loadError, setLoadError] = useState('')
  const [puzzleList, setPuzzleList] = useState([])
  const [listLoadError, setListLoadError] = useState('')
  const [sortKey, setSortKey] = useState('date')
  const [sortAsc, setSortAsc] = useState(false)

  useEffect(() => {
    listPuzzles().then(({ data, error }) => {
      if (error) {
        setListLoadError(error?.message || 'Could not load puzzles.')
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

  const displayError = propLoadError || loadError

  const sortedList = useMemo(
    () => sortPuzzles(puzzleList, sortKey, sortAsc),
    [puzzleList, sortKey, sortAsc]
  )

  const toggleSort = useCallback((key) => {
    setSortKey(key)
    setSortAsc((prev) => (key === sortKey ? !prev : true))
  }, [sortKey])

  return (
    <div className="solver-view">
      <header className="header solver-header">
        <button type="button" className="nav-link nav-link-icon" onClick={onBack} title="Home" aria-label="Home">
          <IconBack size={22} />
        </button>
        <h1>Mini Crossword — Solver</h1>
      </header>
      <section className="section">
        <p className="hint">
          Click a puzzle title to play.
        </p>
        {listLoadError && <span className="error">{listLoadError}</span>}
        {puzzleList.length > 0 && (
          <div className="puzzle-list-page">
            <table className="puzzle-list-table">
              <thead>
                <tr>
                  <th>
                    <button type="button" className="sortable-th" onClick={() => toggleSort('title')}>
                      Title {sortKey === 'title' && (sortAsc ? '↑' : '↓')}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="sortable-th" onClick={() => toggleSort('gridSize')}>
                      Grid size {sortKey === 'gridSize' && (sortAsc ? '↑' : '↓')}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="sortable-th" onClick={() => toggleSort('acrostic')}>
                      Acrostic {sortKey === 'acrostic' && (sortAsc ? '↑' : '↓')}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="sortable-th" onClick={() => toggleSort('author')}>
                      Author {sortKey === 'author' && (sortAsc ? '↑' : '↓')}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="sortable-th" onClick={() => toggleSort('date')}>
                      Date created {sortKey === 'date' && (sortAsc ? '↑' : '↓')}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedList.length === 0 ? (
                  <tr><td colSpan={5} className="puzzle-list-empty">No puzzles.</td></tr>
                ) : sortedList.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <button
                        type="button"
                        className="puzzle-list-title-btn"
                        onClick={() => loadFromDbId(p.id)}
                      >
                        {p.title || 'Untitled'}
                      </button>
                    </td>
                    <td>{p.rows != null && p.cols != null ? `${p.rows}×${p.cols}` : '—'}</td>
                    <td>{p.acrostic ? '✓' : '—'}</td>
                    <td>{p.creator || 'Anonymous'}</td>
                    <td>{formatListDate(p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
