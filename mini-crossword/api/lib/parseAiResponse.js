/**
 * Extract JSON string array from model output; fallback line split with junk stripping.
 */

function sanitizeStringList(arr) {
  return arr
    .filter((x) => typeof x === 'string')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20)
}

/** Strip markdown fences and outer noise */
function stripFences(t) {
  let s = t.trim()
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  return s.trim()
}

/**
 * Remove leading/trailing JSON-ish punctuation from a single line (fallback parser).
 */
function cleanSuggestionLine(line) {
  let s = String(line).trim()
  // Leading: spaces, [, ", ', commas
  s = s.replace(/^[\s\["',]+/, '')
  // Trailing: ", ",  ], commas, spaces
  s = s.replace(/[",\s\]]+$/g, '')
  s = s.replace(/^["']|["']$/g, '')
  return s.trim()
}

function tryParseJsonArray(s) {
  // Trailing commas before ] break JSON.parse — fix common LLM mistake
  const fixTrailingCommas = (json) => json.replace(/,\s*\]/g, ']').replace(/,\s*\}/g, '}')

  // Try whole string
  try {
    const parsed = JSON.parse(fixTrailingCommas(s))
    if (Array.isArray(parsed)) return sanitizeStringList(parsed)
  } catch {
    /* continue */
  }

  // First balanced [...] block (multiline)
  const start = s.indexOf('[')
  if (start >= 0) {
    let depth = 0
    for (let i = start; i < s.length; i++) {
      const c = s[i]
      if (c === '[') depth++
      else if (c === ']') {
        depth--
        if (depth === 0) {
          const slice = s.slice(start, i + 1)
          try {
            const parsed = JSON.parse(fixTrailingCommas(slice))
            if (Array.isArray(parsed)) return sanitizeStringList(parsed)
          } catch {
            /* continue */
          }
          break
        }
      }
    }
  }

  return null
}

export function parseSuggestionArray(rawText) {
  if (!rawText || typeof rawText !== 'string') return []

  const t = stripFences(rawText)

  const fromJson = tryParseJsonArray(t)
  if (fromJson && fromJson.length > 0) return fromJson

  // Fallback: lines or comma-separated chunks (model often breaks JSON mid-stream)
  const lines = t.split(/\r?\n/).flatMap((line) => {
    // Split on "," only when it looks like between JSON strings (rough)
    if (line.includes('","')) return line.split('","').map((p) => p.trim())
    return [line]
  })

  const out = []
  for (const line of lines) {
    const cleaned = cleanSuggestionLine(line)
    if (!cleaned) continue
    // Drop lines that are only punctuation
    if (/^[\[\]{}\s"',]+$/u.test(cleaned)) continue
    out.push(cleaned)
    if (out.length >= 20) break
  }

  return out
}
