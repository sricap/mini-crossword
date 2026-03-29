import { useState, useEffect, useRef, useCallback } from 'react'
import { IconHint } from './Icons'
import { fetchAiHints } from './api/aiHint'

function clamp(n, lo, hi) {
  return Math.min(Math.max(n, lo), hi)
}

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
  const [panelPosition, setPanelPosition] = useState(null)
  const [dragging, setDragging] = useState(false)
  const wrapRef = useRef(null)
  const popoverRef = useRef(null)
  const dragOffsetRef = useRef({ x: 0, y: 0 })
  const dragHandleRef = useRef(null)
  const activePointerIdRef = useRef(null)

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
    if (!open) {
      setPanelPosition(null)
      setDragging(false)
    }
  }, [open])

  useEffect(() => {
    if (!dragging) return
    const onMove = (e) => {
      const el = popoverRef.current
      if (!el) return
      const w = el.offsetWidth
      const h = el.offsetHeight
      const { x: ox, y: oy } = dragOffsetRef.current
      const maxL = Math.max(8, window.innerWidth - w - 8)
      const maxT = Math.max(8, window.innerHeight - h - 8)
      setPanelPosition({
        left: clamp(e.clientX - ox, 8, maxL),
        top: clamp(e.clientY - oy, 8, maxT),
      })
    }
    const onUp = () => {
      setDragging(false)
      const h = dragHandleRef.current
      const id = activePointerIdRef.current
      if (h != null && id != null && typeof h.releasePointerCapture === 'function') {
        try {
          h.releasePointerCapture(id)
        } catch {
          /* ignore */
        }
      }
      activePointerIdRef.current = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      onUp()
    }
  }, [dragging])

  const onDragHandlePointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const el = popoverRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    dragOffsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    setPanelPosition({ left: rect.left, top: rect.top })
    dragHandleRef.current = e.currentTarget
    activePointerIdRef.current = e.pointerId
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    setDragging(true)
    e.preventDefault()
  }

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
            onPointerDown={(e) => {
              e.preventDefault()
              setOpen(false)
            }}
          />
          <div
            ref={popoverRef}
            className={`ai-hint-popover${panelPosition ? ' ai-hint-popover--placed' : ''}`}
            role="dialog"
            aria-labelledby="ai-hint-popover-title"
            style={
              panelPosition
                ? {
                    position: 'fixed',
                    left: panelPosition.left,
                    top: panelPosition.top,
                    transform: 'none',
                    right: 'auto',
                    marginRight: 0,
                  }
                : undefined
            }
          >
            <div className="ai-hint-popover-inner">
              <h3
                id="ai-hint-popover-title"
                className="ai-hint-popover-title ai-hint-popover-drag-handle"
                onPointerDown={onDragHandlePointerDown}
                aria-grabbed={dragging}
                title="Drag to move"
              >
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
