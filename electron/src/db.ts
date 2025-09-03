import path from 'node:path'
import fs from 'node:fs'
import Database from 'better-sqlite3'

export interface InitResult {
  dbPath: string
}

export interface IndexNoteRequest {
  path: string
  content: string
  modified_at: string
}

export interface IndexChunkInfo {
  chunk_id: string
  start: number
  end: number
  text: string
}

export interface IndexNoteResponse {
  note_id: string
  indexed_chunks: number
  chunks: IndexChunkInfo[]
  headings_count: number
  links_count: number
}

export interface NoteInfoResponse {
  note_id: string
  path: string
  title: string
  created_at: string
  modified_at: string
  word_count: number
  headings: Array<{ heading: string; level: number; start_offset: number }>
  backlinks: Array<{ src_note: string; src_title: string; src_path: string; link_text: string; occurrences: number }>
}

export interface GraphDataResponse {
  nodes: Array<{ id: string; label: string; type: string; path: string; word_count: number }>
  edges: Array<{ source: string; target: string; type: string; label: string; weight: number }>
}

let currentDb: Database.Database | null = null
let currentVaultPath: string | null = null

export function initVaultDb(vaultPath: string): InitResult {
  currentVaultPath = vaultPath
  const coneDir = path.join(vaultPath, '.cone')
  const dbPath = path.join(coneDir, 'meta.db')
  fs.mkdirSync(coneDir, { recursive: true })

  const firstCreate = !fs.existsSync(dbPath)
  currentDb?.close()
  currentDb = new Database(dbPath)
  currentDb.pragma('journal_mode = WAL')

  const createSQL = `
CREATE TABLE IF NOT EXISTS notes (
  note_id TEXT PRIMARY KEY,
  path TEXT UNIQUE NOT NULL,
  title TEXT,
  created_at TEXT,
  modified_at TEXT,
  word_count INTEGER,
  metadata TEXT
);

CREATE TABLE IF NOT EXISTS headings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  note_id TEXT REFERENCES notes(note_id),
  heading TEXT,
  level INTEGER,
  start_offset INTEGER
);

CREATE TABLE IF NOT EXISTS links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  src_note TEXT REFERENCES notes(note_id),
  dst_note TEXT,
  link_text TEXT,
  occurrences INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS chunks (
  chunk_id TEXT PRIMARY KEY,
  note_id TEXT REFERENCES notes(note_id),
  heading_id INTEGER,
  start_offset INTEGER,
  end_offset INTEGER,
  text TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS vector_meta (
  chunk_id TEXT PRIMARY KEY REFERENCES chunks(chunk_id),
  vector_id TEXT,
  vector_backend TEXT,
  created_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_notes_modified ON notes(modified_at);
CREATE INDEX IF NOT EXISTS idx_links_src ON links(src_note);
CREATE INDEX IF NOT EXISTS idx_chunks_note ON chunks(note_id);
`

  currentDb.exec(createSQL)

  return { dbPath }
}

function ensureDb(): Database.Database {
  if (!currentDb) throw new Error('Database not initialized. Open or create a vault first.')
  return currentDb
}

// Simple parsers
const WIKILINK_REGEX = /\[\[([^\]|]+)(\|([^\]]+))?\]\]/g

function extractWikilinks(text: string): Array<{ target: string; alias?: string; start: number; end: number }>{
  const result: Array<{ target: string; alias?: string; start: number; end: number }> = []
  WIKILINK_REGEX.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = WIKILINK_REGEX.exec(text)) !== null) {
    const raw = match[0]
    const target = match[1]?.trim() || ''
    const alias = match[3]?.trim()
    result.push({ target, alias, start: match.index, end: match.index + raw.length })
  }
  return result
}

function extractHeadings(text: string): Array<{ heading: string; level: number; start_offset: number }>{
  const lines = text.split(/\n/)
  const headings: Array<{ heading: string; level: number; start_offset: number }> = []
  let offset = 0
  for (const line of lines) {
    const m = line.match(/^(#{1,6})\s+(.*)$/)
    if (m) {
      const level = m[1].length
      const heading = m[2].trim()
      headings.push({ heading, level, start_offset: offset })
    }
    offset += line.length + 1
  }
  return headings
}

function computeTitle(notePath: string, headings: Array<{ heading: string; level: number }>): string {
  const h1 = headings.find(h => h.level === 1)
  if (h1) return h1.heading
  return path.basename(notePath).replace(/\.md$/i, '')
}

function sha1(input: string): string {
  // Simple, non-crypto placeholder for deterministic id in this context
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i)
    hash |= 0
  }
  return `c${Math.abs(hash)}`
}

function chunkText(text: string): Array<{ start: number; end: number; text: string }>{
  const chunks: Array<{ start: number; end: number; text: string }> = []
  const maxSize = 800
  let start = 0
  while (start < text.length) {
    let end = Math.min(start + maxSize, text.length)
    // Try to break on paragraph boundary
    const slice = text.slice(start, end)
    const lastBreak = slice.lastIndexOf('\n\n')
    if (lastBreak > 200) {
      end = start + lastBreak + 2
    }
    chunks.push({ start, end, text: text.slice(start, end) })
    start = end
  }
  if (chunks.length === 0) {
    chunks.push({ start: 0, end: text.length, text })
  }
  return chunks
}

export function indexNoteInDb(req: IndexNoteRequest): IndexNoteResponse {
  const db = ensureDb()
  const noteId = req.path // use absolute path as id
  const headings = extractHeadings(req.content)
  const title = computeTitle(req.path, headings)
  const wordCount = req.content.trim().split(/\s+/).filter(Boolean).length
  const createdAt = new Date().toISOString()

  const tx = db.transaction(() => {
    // notes upsert
    db.prepare(
      `INSERT INTO notes (note_id, path, title, created_at, modified_at, word_count, metadata)
       VALUES (?, ?, ?, ?, ?, ?, NULL)
       ON CONFLICT(note_id) DO UPDATE SET
         path = excluded.path,
         title = excluded.title,
         modified_at = excluded.modified_at,
         word_count = excluded.word_count`
    ).run(noteId, req.path, title, createdAt, req.modified_at, wordCount)

    // clear existing headings/links/chunks for this note (simple strategy)
    db.prepare('DELETE FROM headings WHERE note_id = ?').run(noteId)
    db.prepare('DELETE FROM links WHERE src_note = ?').run(noteId)
    db.prepare('DELETE FROM chunks WHERE note_id = ?').run(noteId)

    // insert headings
    const insertHeading = db.prepare(
      'INSERT INTO headings (note_id, heading, level, start_offset) VALUES (?, ?, ?, ?)'
    )
    for (const h of headings) insertHeading.run(noteId, h.heading, h.level, h.start_offset)

    // links
    const links = extractWikilinks(req.content)
    const occurrencesMap = new Map<string, number>()
    for (const l of links) occurrencesMap.set(l.target, (occurrencesMap.get(l.target) || 0) + 1)
    const insertLink = db.prepare(
      'INSERT INTO links (src_note, dst_note, link_text, occurrences) VALUES (?, ?, ?, ?)'
    )
    for (const [target, occ] of occurrencesMap) {
      insertLink.run(noteId, target, target, occ)
    }

    // chunks
    const chunks = chunkText(req.content)
    const insertChunk = db.prepare(
      'INSERT INTO chunks (chunk_id, note_id, heading_id, start_offset, end_offset, text, created_at) VALUES (?, ?, NULL, ?, ?, ?, ?)'
    )
    const now = new Date().toISOString()
    for (const ch of chunks) {
      const chunkId = sha1(`${noteId}:${ch.start}`)
      insertChunk.run(chunkId, noteId, ch.start, ch.end, ch.text, now)
    }
  })

  tx()

  const chunks = chunkText(req.content).map(ch => ({
    chunk_id: sha1(`${req.path}:${ch.start}`),
    start: ch.start,
    end: ch.end,
    text: ch.text
  }))

  return {
    note_id: noteId,
    indexed_chunks: chunks.length,
    chunks,
    headings_count: headings.length,
    links_count: extractWikilinks(req.content).length
  }
}

export function getNoteInfoFromDb(notePath: string): NoteInfoResponse {
  const db = ensureDb()
  const noteId = notePath
  const noteRow = db.prepare('SELECT note_id, path, title, created_at, modified_at, word_count FROM notes WHERE note_id = ?').get(noteId) as any
  if (!noteRow) {
    return {
      note_id: noteId,
      path: notePath,
      title: path.basename(notePath).replace(/\.md$/i, ''),
      created_at: '',
      modified_at: '',
      word_count: 0,
      headings: [],
      backlinks: []
    }
  }

  const headings = db.prepare('SELECT heading, level, start_offset FROM headings WHERE note_id = ? ORDER BY start_offset ASC').all(noteId) as any[]

  const backlinks = db.prepare(
    `SELECT l.src_note, n.title as src_title, n.path as src_path, l.link_text, l.occurrences
     FROM links l
     LEFT JOIN notes n ON n.note_id = l.src_note
     WHERE l.dst_note = ?
     ORDER BY n.title COLLATE NOCASE`
  ).all(noteId) as any[]

  return {
    note_id: noteRow.note_id,
    path: noteRow.path,
    title: noteRow.title,
    created_at: noteRow.created_at || '',
    modified_at: noteRow.modified_at || '',
    word_count: noteRow.word_count || 0,
    headings: headings.map(h => ({ heading: h.heading, level: Number(h.level), start_offset: Number(h.start_offset) })),
    backlinks: backlinks.map(b => ({ src_note: b.src_note, src_title: b.src_title || '', src_path: b.src_path || b.src_note, link_text: b.link_text, occurrences: Number(b.occurrences) }))
  }
}

export function getGraphDataFromDb(limit = 500, minDegree = 0): GraphDataResponse {
  const db = ensureDb()
  const nodes = db.prepare('SELECT note_id as id, title as label, path, word_count FROM notes LIMIT ?').all(limit) as any[]
  const edges = db.prepare('SELECT src_note as source, dst_note as target, link_text as label, occurrences as weight FROM links LIMIT ?').all(limit * 2) as any[]

  // Degree filter
  if (minDegree > 0) {
    const degreeMap = new Map<string, number>()
    for (const e of edges) {
      degreeMap.set(e.source, (degreeMap.get(e.source) || 0) + 1)
      degreeMap.set(e.target, (degreeMap.get(e.target) || 0) + 1)
    }
    const allowed = new Set(Array.from(degreeMap.entries()).filter(([, d]) => d >= minDegree).map(([id]) => id))
    const filteredNodes = nodes.filter(n => allowed.has(n.id))
    const filteredEdges = edges.filter(e => allowed.has(e.source) && allowed.has(e.target))
    return {
      nodes: filteredNodes.map(n => ({ id: n.id, label: n.label || path.basename(n.path), type: 'note', path: n.path, word_count: Number(n.word_count || 0) })),
      edges: filteredEdges.map(e => ({ source: e.source, target: e.target, type: 'link', label: e.label, weight: Number(e.weight || 1) }))
    }
  }

  return {
    nodes: nodes.map(n => ({ id: n.id, label: n.label || path.basename(n.path), type: 'note', path: n.path, word_count: Number(n.word_count || 0) })),
    edges: edges.map(e => ({ source: e.source, target: e.target, type: 'link', label: e.label, weight: Number(e.weight || 1) }))
  }
}


