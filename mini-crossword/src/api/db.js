import { createClient } from '@supabase/supabase-js'

const LIST_LIMIT = 100
const CREATOR_MAX_LEN = 50

function getClient() {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

/**
 * Normalize puzzle from DB row to app shape (add id, creator, dates; ensure clues/answers objects).
 */
function rowToPuzzle(row) {
  if (!row) return null
  return {
    id: row.id,
    title: row.title != null ? String(row.title).slice(0, 25) : '',
    creator: row.creator != null ? String(row.creator).slice(0, CREATOR_MAX_LEN) : '',
    created_at: row.created_at,
    updated_at: row.updated_at,
    rows: row.rows,
    cols: row.cols,
    grid: Array.isArray(row.grid) ? row.grid : [],
    clues: row.clues && typeof row.clues === 'object' ? row.clues : {},
    answers: row.answers && typeof row.answers === 'object'
      ? Object.fromEntries(
          Object.entries(row.answers).map(([k, v]) => [
            k,
            typeof v === 'string' ? v.toUpperCase() : v,
          ])
        )
      : {},
    acrostic: Boolean(row.acrostic),
  }
}

/**
 * List puzzles for creator left pane and solver list.
 * Returns { id, title, creator, created_at, updated_at, rows, cols }[], order: updated_at desc.
 */
export async function listPuzzles() {
  const supabase = getClient()
  if (!supabase) return { data: [], error: new Error('Supabase not configured') }
  const { data, error } = await supabase
    .from('puzzles')
    .select('id, title, creator, created_at, updated_at, rows, cols')
    .order('updated_at', { ascending: false })
    .limit(LIST_LIMIT)
  if (error) return { data: [], error }
  return { data: data || [], error: null }
}

/**
 * Get full puzzle by ID for creator (edit) or solver (play).
 */
export async function getPuzzle(id) {
  const supabase = getClient()
  if (!supabase) return { data: null, error: new Error('Supabase not configured') }
  const { data, error } = await supabase.from('puzzles').select('*').eq('id', id).single()
  if (error) return { data: null, error }
  return { data: rowToPuzzle(data), error: null }
}

/**
 * Create a new puzzle. Payload: { title, creator?, rows, cols, grid, clues, answers, acrostic }.
 * Returns { data: puzzle with id }, or { data: null, error }.
 */
export async function createPuzzle(payload) {
  const supabase = getClient()
  // #region agent log
  const _logA={location:'db.js:createPuzzle',message:'getClient result',data:{clientIsNull:!supabase,hasUrl:!!import.meta.env.VITE_SUPABASE_URL,hasKey:!!import.meta.env.VITE_SUPABASE_ANON_KEY},hypothesisId:'A'};console.log('[debug]',_logA);fetch('http://127.0.0.1:7242/ingest/d7d9864e-0ba4-41cc-8345-b48e79c76a56',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({..._logA,timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  if (!supabase) return { data: null, error: new Error('Supabase not configured') }
  const creator = payload.creator != null ? String(payload.creator).slice(0, CREATOR_MAX_LEN) : ''
  const row = {
    title: (payload.title != null ? String(payload.title) : '').slice(0, 25),
    creator,
    rows: payload.rows,
    cols: payload.cols,
    grid: payload.grid,
    clues: payload.clues || {},
    answers: payload.answers || {},
    acrostic: Boolean(payload.acrostic),
  }
  const { data, error } = await supabase.from('puzzles').insert(row).select().single()
  // #region agent log
  const _logE={location:'db.js:createPuzzle',message:'insert result',data:{hasError:!!error,errorMessage:error?.message,errorCode:error?.code,errorDetails:error?.details},hypothesisId:'C,D,E'};console.log('[debug]',_logE);fetch('http://127.0.0.1:7242/ingest/d7d9864e-0ba4-41cc-8345-b48e79c76a56',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({..._logE,timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  if (error) return { data: null, error }
  return { data: rowToPuzzle(data), error: null }
}

/**
 * Update existing puzzle by ID.
 */
export async function updatePuzzle(id, payload) {
  const supabase = getClient()
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/d7d9864e-0ba4-41cc-8345-b48e79c76a56',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'db.js:updatePuzzle',message:'getClient result',data:{clientIsNull:!supabase},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  if (!supabase) return { error: new Error('Supabase not configured') }
  const update = {
    updated_at: new Date().toISOString(),
    title: (payload.title != null ? String(payload.title) : '').slice(0, 25),
    creator: payload.creator != null ? String(payload.creator).slice(0, CREATOR_MAX_LEN) : '',
    rows: payload.rows,
    cols: payload.cols,
    grid: payload.grid,
    clues: payload.clues || {},
    answers: payload.answers || {},
    acrostic: Boolean(payload.acrostic),
  }
  const { error } = await supabase.from('puzzles').update(update).eq('id', id)
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/d7d9864e-0ba4-41cc-8345-b48e79c76a56',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'db.js:updatePuzzle',message:'update result',data:{hasError:!!error,errorMessage:error?.message,errorCode:error?.code},timestamp:Date.now(),hypothesisId:'C,D,E'})}).catch(()=>{});
  // #endregion
  return { error }
}

export function isDbConfigured() {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
}
