import { checkRateLimit } from './lib/rateLimit.js'
import { buildAiHintUserPrompt } from './lib/aiHintPrompt.js'
import { describeGeminiFailure } from './lib/geminiErrors.js'
import { parseSuggestionArray } from './lib/parseAiResponse.js'

const RATE_WINDOW_MS = Number(process.env.AI_HINT_RATE_LIMIT_WINDOW_MS) || 60_000
const RATE_MAX = Number(process.env.AI_HINT_RATE_LIMIT_MAX) || 20

function getClientIp(req) {
  const xf = req.headers['x-forwarded-for']
  if (typeof xf === 'string' && xf.length > 0) {
    return xf.split(',')[0].trim().slice(0, 64) || 'unknown'
  }
  if (Array.isArray(xf) && xf[0]) return String(xf[0]).trim().slice(0, 64)
  return (req.socket && req.socket.remoteAddress) || 'unknown'
}

function readJsonBodyStream(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8')
        resolve(raw ? JSON.parse(raw) : {})
      } catch {
        resolve(null)
      }
    })
    req.on('error', reject)
  })
}

async function readJsonBody(req) {
  if (req.body != null && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body
  }
  return readJsonBodyStream(req)
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.statusCode = 204
    return res.end()
  }

  if (req.method !== 'POST') {
    res.statusCode = 405
    return res.end(JSON.stringify({ error: 'Method not allowed' }))
  }

  const clientIp = getClientIp(req)
  const rl = checkRateLimit(clientIp, RATE_MAX, RATE_WINDOW_MS)
  if (!rl.ok) {
    console.warn('[ai-hint] rate limited', { ip: clientIp, retryAfterMs: rl.retryAfterMs })
    res.statusCode = 429
    res.setHeader('Retry-After', String(Math.ceil(rl.retryAfterMs / 1000) || 1))
    return res.end(
      JSON.stringify({
        error: 'Too many AI hint requests. Try again shortly.',
        retryAfterMs: rl.retryAfterMs,
      })
    )
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey || !String(apiKey).trim()) {
    console.error('[ai-hint] GEMINI_API_KEY is not configured')
    res.statusCode = 503
    return res.end(JSON.stringify({ error: 'AI hints are not configured on this deployment.' }))
  }

  const body = await readJsonBody(req)
  if (body === null) {
    res.statusCode = 400
    return res.end(JSON.stringify({ error: 'Invalid JSON body' }))
  }

  const clueText = typeof body.clueText === 'string' ? body.clueText : ''
  const blurb = typeof body.blurb === 'string' ? body.blurb : ''
  const lengthSpec = typeof body.lengthSpec === 'string' ? body.lengthSpec : ''
  const gridWordLength = Number(body.gridWordLength)
  const clueKey = typeof body.clueKey === 'string' ? body.clueKey : ''

  if (!clueText.trim()) {
    res.statusCode = 400
    return res.end(JSON.stringify({ error: 'clueText is required' }))
  }
  if (!Number.isFinite(gridWordLength) || gridWordLength < 1 || gridWordLength > 50) {
    res.statusCode = 400
    return res.end(JSON.stringify({ error: 'gridWordLength is invalid' }))
  }

  const userPrompt = buildAiHintUserPrompt({
    clueText,
    blurb,
    lengthSpec,
    gridWordLength,
  })

  // Full prompt logging (no API keys — key is only in headers below)
  console.log('[ai-hint] full user prompt:', userPrompt)
  console.log('[ai-hint] meta:', { clueKey, ip: clientIp, gridWordLength, lengthSpec: lengthSpec || '(default)' })

  const model = (process.env.GEMINI_MODEL || 'gemini-2.0-flash').trim()
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

  let geminiRes
  try {
    geminiRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: 1024,
        },
      }),
    })
  } catch (err) {
    console.error('[ai-hint] fetch error:', err && err.message)
    res.statusCode = 502
    return res.end(JSON.stringify({ error: 'Could not reach the language model.' }))
  }

  const geminiJson = await geminiRes.json().catch(() => ({}))

  if (!geminiRes.ok) {
    const { message, httpStatus } = describeGeminiFailure(geminiRes.status, geminiJson)
    const errObj = geminiJson && typeof geminiJson === 'object' ? geminiJson.error : null
    console.error(
      '[ai-hint] Gemini error',
      geminiRes.status,
      errObj && typeof errObj.status === 'string' ? errObj.status : '',
      JSON.stringify(geminiJson).slice(0, 800)
    )
    res.statusCode = httpStatus
    return res.end(JSON.stringify({ error: message }))
  }

  const text =
    geminiJson?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || ''
  const suggestions = parseSuggestionArray(text)

  console.log('[ai-hint] raw model text length:', text.length, 'parsed count:', suggestions.length)

  res.statusCode = 200
  return res.end(JSON.stringify({ suggestions }))
}
