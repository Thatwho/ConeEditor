/**
 * API client for communicating with the Python FastAPI backend.
 * 
 * This module provides typed functions for making HTTP requests to the
 * ConeEditor Python service running on localhost:8000.
 */

const API_BASE_URL = 'http://127.0.0.1:8000'

export interface IndexRequest {
  path: string
  content: string
  modified_at: string
  vault_path?: string
}

export interface IndexResponse {
  request_id: string
  duration_ms: number
  indexed_chunks: number
  chunks: Array<{
    chunk_id: string
    start: number
    end: number
    text: string
  }>
  headings_count: number
  links_count: number
  note_id: string
}

export interface SearchRequest {
  q: string
  top_k?: number
}

export interface SearchResponse {
  request_id: string
  duration_ms: number
  results: Array<{
    note_id: string
    chunk_id: string
    score: number
    snippet: string
  }>
}

export interface NoteInfo {
  note_id: string
  path: string
  title: string
  created_at: string
  modified_at: string
  word_count: number
  headings: Array<{
    heading: string
    level: number
    start_offset: number
  }>
  backlinks: Array<{
    src_note: string
    src_title: string
    src_path: string
    link_text: string
    occurrences: number
  }>
}

export interface GraphData {
  request_id: string
  duration_ms: number
  nodes: Array<{
    id: string
    label: string
    type: string
    path: string
    word_count: number
  }>
  edges: Array<{
    source: string
    target: string
    type: string
    label: string
    weight: number
  }>
}

export interface HealthResponse {
  request_id: string
  duration_ms: number
  status: string
  model_loaded: boolean
  error?: string
}

/**
 * Generic API request function with error handling.
 */
async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`
  
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    let errorDetail: string
    
    try {
      const errorJson = JSON.parse(errorText)
      errorDetail = errorJson.detail || errorText
    } catch {
      errorDetail = errorText
    }
    
    throw new Error(`API Error ${response.status}: ${errorDetail}`)
  }
  
  return response.json()
}

/**
 * Check the health status of the Python service.
 */
export async function checkHealth(): Promise<HealthResponse> {
  return apiRequest<HealthResponse>('/health')
}

/**
 * Index a note by sending its content to the Python backend.
 */
export async function indexNote(request: IndexRequest): Promise<IndexResponse> {
  return apiRequest<IndexResponse>('/index', {
    method: 'POST',
    body: JSON.stringify(request)
  })
}

/**
 * Perform semantic search (returns empty results for now).
 */
export async function searchSemantic(request: SearchRequest): Promise<SearchResponse> {
  return apiRequest<SearchResponse>('/search/semantic', {
    method: 'POST',
    body: JSON.stringify(request)
  })
}

/**
 * Get note information including backlinks and headings.
 */
export async function getNoteInfo(notePath: string, vaultPath?: string): Promise<NoteInfo> {
  const encodedPath = encodeURIComponent(notePath)
  const vaultParam = vaultPath ? `&vault_path=${encodeURIComponent(vaultPath)}` : ''
  return apiRequest<NoteInfo>(`/note?path=${encodedPath}${vaultParam}`)
}

/**
 * Get graph data for visualization.
 */
export async function getGraphData(limit = 500, minDegree = 0, vaultPath?: string): Promise<GraphData> {
  const vaultParam = vaultPath ? `&vault_path=${encodeURIComponent(vaultPath)}` : ''
  return apiRequest<GraphData>(`/graph?limit=${limit}&min_degree=${minDegree}${vaultParam}`)
}

/**
 * Check if the Python service is running and accessible.
 */
export async function isPythonServiceRunning(): Promise<boolean> {
  try {
    await checkHealth()
    return true
  } catch {
    return false
  }
}

/**
 * Utility function to format API error messages for display.
 */
export function formatApiError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return 'Unknown API error occurred'
}
