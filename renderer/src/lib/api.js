/**
 * API client for communicating with the Python FastAPI backend.
 *
 * This module provides typed functions for making HTTP requests to the
 * ConeEditor Python service running on localhost:8000.
 */
const API_BASE_URL = 'http://127.0.0.1:8000';
/**
 * Generic API request function with error handling.
 */
async function apiRequest(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const response = await fetch(url, {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        ...options
    });
    if (!response.ok) {
        const errorText = await response.text();
        let errorDetail;
        try {
            const errorJson = JSON.parse(errorText);
            errorDetail = errorJson.detail || errorText;
        }
        catch {
            errorDetail = errorText;
        }
        throw new Error(`API Error ${response.status}: ${errorDetail}`);
    }
    return response.json();
}
/**
 * Check the health status of the Python service.
 */
export async function checkHealth() {
    return apiRequest('/health');
}
/**
 * Index a note by sending its content to the Python backend.
 */
export async function indexNote(request) {
    // Prefer local TS-only indexing during Sprints 0-3
    try {
        const local = await window.electronAPI.indexNoteLocal(request.path);
        return {
            request_id: 'local-ts',
            duration_ms: 0,
            indexed_chunks: local.indexed_chunks,
            chunks: local.chunks,
            headings_count: local.headings_count,
            links_count: local.links_count,
            note_id: local.note_id
        };
    }
    catch {
        // Fallback to Python API if available
        return apiRequest('/index', {
            method: 'POST',
            body: JSON.stringify(request)
        });
    }
}
/**
 * Perform semantic search (returns empty results for now).
 */
export async function searchSemantic(request) {
    return apiRequest('/search/semantic', {
        method: 'POST',
        body: JSON.stringify(request)
    });
}
/**
 * Get note information including backlinks and headings.
 */
export async function getNoteInfo(notePath, _vaultPath) {
    try {
        const local = await window.electronAPI.getNoteInfoLocal(notePath);
        return {
            note_id: local.note_id,
            path: local.path,
            title: local.title,
            created_at: local.created_at,
            modified_at: local.modified_at,
            word_count: local.word_count,
            headings: local.headings,
            backlinks: local.backlinks
        };
    }
    catch {
        const encodedPath = encodeURIComponent(notePath);
        return apiRequest(`/note?path=${encodedPath}`);
    }
}
/**
 * Get graph data for visualization.
 */
export async function getGraphData(limit = 500, minDegree = 0, _vaultPath) {
    try {
        const local = await window.electronAPI.getGraphLocal(limit, minDegree);
        return {
            request_id: 'local-ts',
            duration_ms: 0,
            nodes: local.nodes,
            edges: local.edges
        };
    }
    catch {
        return apiRequest(`/graph?limit=${limit}&min_degree=${minDegree}`);
    }
}
/**
 * Check if the Python service is running and accessible.
 */
export async function isPythonServiceRunning() {
    try {
        await checkHealth();
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Utility function to format API error messages for display.
 */
export function formatApiError(error) {
    if (error instanceof Error) {
        let message = error.message;
        // Try to parse FastAPI error detail if it's JSON
        try {
            // Extract detail from error message if it contains JSON
            const jsonMatch = message.match(/API Error \d+: (.+)/);
            if (jsonMatch) {
                const detail = jsonMatch[1];
                try {
                    const parsed = JSON.parse(detail);
                    if (typeof parsed === 'object' && parsed !== null) {
                        message = typeof parsed.detail === 'object'
                            ? JSON.stringify(parsed.detail)
                            : String(parsed.detail || parsed.message || detail);
                    }
                }
                catch {
                    // If not JSON, use as is
                }
            }
        }
        catch {
            // If parsing fails, use original message
        }
        return message;
    }
    return 'Unknown API error occurred';
}
