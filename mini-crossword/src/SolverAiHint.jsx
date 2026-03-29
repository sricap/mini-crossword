import { useState, useEffect, useRef, useCallback } from 'react'
import { IconHint } from './Icons'
import { fetchAiHints } from './api/aiHint'

export function SolverAiHintControl({
  clueKey,
  clueText,
  blurb,
  lengthSpec,
  gridWordLength,
  disabled,
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const wrapRef = useRef(null)

  const runFetch = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const list = await fetchAiHints({
        clueText,
        blurb,
        lengthSpec,
        gridWordLength,
        clueKey,
      })
      setSuggestions(list)
    } catch (e) {
      setSuggestions([])
      setError(e instanceof Error ? e.message : 'Could not get hints.')
    } finally {
      setLoading(false)
    }
  }, [clueText, blurb, lengthSpec, gridWordLength, clueKey])

  useEffect(() => {
    if (!open) return
    const onDocDown = (e) => {
      if (!wrapRef.current || wrapRef.current.contains(e.target)) return
      setOpen(false)
    }
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const onButtonClick = () => {
    if (disabled || !String(clueText || '').trim()) return
    if (open) {
      setOpen(false)
      return
    }
    setOpen(true)
    void runFetch()
  }

  return (
    <div className={`solver-ai-hint-wrap${open ? ' solver-ai-hint-wrap--open' : ''}`} ref={wrapRef}>
      <button
        type="button"
        className="ai-hint-icon-btn"
        onClick={onButtonClick}
        title="AI hint (Gemini)"
        aria-label="AI hint for this clue"
        aria-expanded={open}
        disabled={disabled || !String(clueText || '').trim()}
      >
        <span className="ai-hint-icon" aria-hidden>
          <IconHint size={14} />
        </span>
      </button>
      {open && (
        <>
          <div
            className="ai-hint-popover-backdrop"
            aria-hidden
            onMouseDown={(e) => {
              e.preventDefault()
              setOpen(false)
            }}
          />
          <div
            className="ai-hint-popover"
            role="dialog"
            aria-labelledby="ai-hint-popover-title"
          >
            <div className="ai-hint-popover-inner">
              <h3 id="ai-hint-popover-title" className="ai-hint-popover-title">
                AI recommends…
              </h3>
              {loading && <p className="ai-hint-popover-status">Thinking…</p>}
              {!loading && error && <p className="ai-hint-popover-error">{error}</p>}
              {!loading && !error && suggestions.length === 0 && (
                <p className="ai-hint-popover-status">No suggestions returned.</p>
              )}
              {!loading && !error && suggestions.length > 0 && (
                <ul className="ai-hint-suggestions">
                  {suggestions.map((s, i) => (
                    <li key={`${i}-${s}`}>{s}</li>
                  ))}
                </ul>
              )}
              {!loading && (
                <button type="button" className="ai-hint-refresh" onClick={() => void runFetch()}>
                  Refresh
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
