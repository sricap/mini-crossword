/**
 * User-facing explanations aligned with Gemini API troubleshooting:
 * https://ai.google.dev/gemini-api/docs/troubleshooting
 */

const RATE_LIMITS_URL = 'https://ai.google.dev/gemini-api/docs/rate-limits'
const AI_STUDIO_KEYS_URL = 'https://aistudio.google.com/app/apikey'

/** @param {string} msg */
function sanitizeForwardedMessage(msg) {
  if (!msg || typeof msg !== 'string') return ''
  let s = msg.trim().replace(/\s+/g, ' ')
  // Strip verbose GCP consumer hints (keep message readable)
  s = s.replace(/\[reason:\s*"[^"]*"\]/gi, '')
  s = s.replace(/consumer\s*'project_number:\d+'/gi, 'your Google Cloud project')
  s = s.replace(/project_number:\d+/gi, 'your project')
  if (s.length > 220) s = `${s.slice(0, 217)}…`
  return s
}

/** Messages keyed by Gemini `error.status` (gRPC-style string in JSON body). */
const BY_ERROR_STATUS = {
  INVALID_ARGUMENT:
    'The model rejected the request (invalid argument). If this keeps happening, try another clue or contact support.',
  FAILED_PRECONDITION:
    'Gemini may be unavailable on the free tier in your region, or billing may be required. Open Google AI Studio and enable billing for your project if needed.',
  PERMISSION_DENIED:
    'The API key is missing permission or is invalid. Check GEMINI_API_KEY in your host settings and create or fix a key in Google AI Studio.',
  NOT_FOUND:
    'Model or resource was not found. Confirm GEMINI_MODEL matches a model id supported for the Gemini API (see Google’s models page).',
  RESOURCE_EXHAUSTED: `Usage or rate limit exceeded (too many requests per minute/day or tokens). Wait and try again, review limits at ${RATE_LIMITS_URL}, or request a higher quota in Google AI / AI Studio.`,
  INTERNAL:
    'Google’s service hit an internal error. Your prompt may be too long—try again later, shorten context, or switch to another model (e.g. Flash).',
  UNAVAILABLE:
    'The Gemini service is temporarily overloaded or unavailable. Wait a moment and retry, or try another model.',
  DEADLINE_EXCEEDED:
    'The request timed out before the model finished. Retry, or shorten the prompt if the clue or note is very long.',
}

/**
 * @param {number} httpStatus
 * @param {unknown} body Parsed JSON response body from generateContent
 * @returns {{ message: string, httpStatus: number }}
 */
export function describeGeminiFailure(httpStatus, body) {
  const err =
    body && typeof body === 'object' && body.error && typeof body.error === 'object' ? body.error : null
  const statusStr = typeof err?.status === 'string' ? err.status.trim() : ''
  const rawMessage = typeof err?.message === 'string' ? err.message : ''
  const message = sanitizeForwardedMessage(rawMessage)

  if (/leaked|reported as leaked|use another API key/i.test(rawMessage)) {
    return {
      message:
        'This API key was reported as leaked and is blocked. Create a new key in Google AI Studio and update your deployment settings.',
      httpStatus: 403,
    }
  }

  if (statusStr && BY_ERROR_STATUS[statusStr]) {
    return { message: BY_ERROR_STATUS[statusStr], httpStatus: mapHttpForStatus(statusStr, httpStatus) }
  }

  // Quota / rate limit: often 429 or message text without a clean `status` in older responses
  if (
    httpStatus === 429 ||
    /RESOURCE_EXHAUSTED|RATE_LIMIT_EXCEEDED|quota exceeded|exceeded your (current )?quota|rate limit|Generate ?Content API requests/i.test(
      rawMessage
    )
  ) {
    return { message: BY_ERROR_STATUS.RESOURCE_EXHAUSTED, httpStatus: 429 }
  }

  if (httpStatus === 403 || /API key not valid|API_KEY_INVALID|permission denied/i.test(rawMessage)) {
    return { message: BY_ERROR_STATUS.PERMISSION_DENIED, httpStatus: 403 }
  }

  if (httpStatus === 400 && /FAILED_PRECONDITION|billing|free tier.*not available|country/i.test(rawMessage)) {
    return { message: BY_ERROR_STATUS.FAILED_PRECONDITION, httpStatus: 502 }
  }

  if (httpStatus === 404 || /not found|NOT_FOUND/i.test(rawMessage)) {
    return { message: BY_ERROR_STATUS.NOT_FOUND, httpStatus: 502 }
  }

  if (httpStatus === 503 || /UNAVAILABLE|overloaded/i.test(rawMessage)) {
    return { message: BY_ERROR_STATUS.UNAVAILABLE, httpStatus: 503 }
  }

  if (httpStatus === 504 || /DEADLINE_EXCEEDED|deadline|timeout/i.test(rawMessage)) {
    return { message: BY_ERROR_STATUS.DEADLINE_EXCEEDED, httpStatus: 504 }
  }

  if (message) {
    return {
      message: `The language model returned an error (${httpStatus}): ${message}`,
      httpStatus: 502,
    }
  }

  return {
    message: `The language model returned an error (HTTP ${httpStatus}). See Gemini troubleshooting: https://ai.google.dev/gemini-api/docs/troubleshooting`,
    httpStatus: 502,
  }
}

/** @param {string} statusStr */
function mapHttpForStatus(statusStr, fallbackHttp) {
  switch (statusStr) {
    case 'RESOURCE_EXHAUSTED':
      return 429
    case 'UNAVAILABLE':
      return 503
    case 'DEADLINE_EXCEEDED':
      return 504
    case 'PERMISSION_DENIED':
      return 403
    case 'INVALID_ARGUMENT':
    case 'FAILED_PRECONDITION':
    case 'NOT_FOUND':
      return 502
    case 'INTERNAL':
      return 502
    default:
      return fallbackHttp >= 400 ? fallbackHttp : 502
  }
}

export { RATE_LIMITS_URL, AI_STUDIO_KEYS_URL }
