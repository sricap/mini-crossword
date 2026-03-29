/**
 * Client → Vercel serverless `/api/ai-hint` (Gemini). No secrets in the browser.
 * Optional VITE_AI_HINT_ORIGIN for local dev (e.g. http://127.0.0.1:3000) when Vite proxies or you call a deployed API.
 */

export function aiHintEndpoint() {
  const o = import.meta.env.VITE_AI_HINT_ORIGIN
  if (o) return `${String(o).replace(/\/$/, '')}/api/ai-hint`
  return '/api/ai-hint'
}

export async function fetchAiHints({ clueText, blurb, lengthSpec, gridWordLength, clueKey }) {
  const res = await fetch(aiHintEndpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clueText,
      blurb: blurb ?? '',
      lengthSpec: lengthSpec ?? '',
      gridWordLength,
      clueKey: clueKey ?? '',
    }),
  })
  let data = {}
  try {
    data = await res.json()
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    const msg = typeof data.error === 'string' ? data.error : `Request failed (${res.status})`
    throw new Error(msg)
  }
  return Array.isArray(data.suggestions) ? data.suggestions : []
}
