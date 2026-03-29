/**
 * Simple sliding-window rate limiter (per serverless instance).
 * For heavy traffic, replace with Redis / Vercel KV (see DEPLOY_VERCEL.md).
 */

const buckets = new Map()

export function checkRateLimit(ip, maxRequests, windowMs) {
  const now = Date.now()
  let hits = buckets.get(ip)
  if (!hits) {
    hits = []
    buckets.set(ip, hits)
  }
  const windowStart = now - windowMs
  const recent = hits.filter((t) => t > windowStart)
  if (recent.length >= maxRequests) {
    buckets.set(ip, recent)
    return { ok: false, remaining: 0, retryAfterMs: recent[0] + windowMs - now }
  }
  recent.push(now)
  buckets.set(ip, recent)
  return { ok: true, remaining: maxRequests - recent.length, retryAfterMs: 0 }
}
