from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import uuid
import time
from datetime import datetime

from database import DatabaseManager


class IndexReq(BaseModel):
    path: str
    content: str
    modified_at: str
    vault_path: Optional[str] = None


class SearchReq(BaseModel):
    q: str
    top_k: int = 10


class NoteInfoResponse(BaseModel):
    note_id: str
    path: str
    title: str
    created_at: str
    modified_at: str
    word_count: int
    headings: List[Dict[str, Any]]
    backlinks: List[Dict[str, Any]]


app = FastAPI(title="ConeEditor Python Service", version="0.0.1")

# Add CORS middleware to allow requests from Electron renderer
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],  # Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global database managers for different vaults
vault_databases = {}

def get_database_manager(vault_path: str = None) -> DatabaseManager:
    """Get or create a database manager for the specified vault."""
    if vault_path is None:
        # Use default database for backward compatibility
        vault_path = "default"
    
    if vault_path not in vault_databases:
        vault_databases[vault_path] = DatabaseManager(vault_path if vault_path != "default" else None)
    
    return vault_databases[vault_path]


@app.get("/health")
def health() -> Dict[str, Any]:
    """Health check endpoint with model loading status."""
    start_time = time.time()
    request_id = str(uuid.uuid4())
    
    try:
        # Check database connection (use default database for health check)
        test_db = get_database_manager()
        conn = test_db.get_connection()
        conn.close()
        
        duration_ms = int((time.time() - start_time) * 1000)
        
        return {
            "request_id": request_id,
            "duration_ms": duration_ms,
            "status": "ok",
            "model_loaded": False  # Will be True when we implement embedding models
        }
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        return {
            "request_id": request_id,
            "duration_ms": duration_ms,
            "status": "error",
            "error": str(e),
            "model_loaded": False
        }


@app.post("/index")
def index_note(req: IndexReq) -> Dict[str, Any]:
    """Index a note by parsing markdown and storing in SQLite."""
    start_time = time.time()
    request_id = str(uuid.uuid4())
    
    try:
        # Get the appropriate database manager for this vault
        db = get_database_manager(req.vault_path)
        
        # Upsert note
        note_id = db.upsert_note(req.path, req.content, req.modified_at)
        
        # Index headings
        headings = db.index_headings(note_id, req.content)
        
        # Index links
        links = db.index_links(note_id, req.content)
        
        # Create chunks
        chunks = db.create_chunks(note_id, req.content, headings)
        
        duration_ms = int((time.time() - start_time) * 1000)
        
        return {
            "request_id": request_id,
            "duration_ms": duration_ms,
            "indexed_chunks": len(chunks),
            "chunks": chunks,
            "headings_count": len(headings),
            "links_count": len(links),
            "note_id": note_id
        }
        
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        raise HTTPException(
            status_code=500,
            detail={
                "request_id": request_id,
                "duration_ms": duration_ms,
                "error": str(e)
            }
        )


@app.post("/search/semantic")
def search_semantic(req: SearchReq) -> Dict[str, Any]:
    """Semantic search endpoint (stub implementation)."""
    start_time = time.time()
    request_id = str(uuid.uuid4())
    
    # TODO: Implement semantic search in Sprint 4
    duration_ms = int((time.time() - start_time) * 1000)
    
    return {
        "request_id": request_id,
        "duration_ms": duration_ms,
        "results": []  # Empty results for now
    }


@app.get("/note")
def get_note_info(path: str, vault_path: Optional[str] = None) -> NoteInfoResponse:
    """Get note information and metadata."""
    start_time = time.time()
    
    try:
        db = get_database_manager(vault_path)
        note_info = db.get_note_info(path)
        if not note_info:
            raise HTTPException(status_code=404, detail=f"Note not found: {path}")
        
        return NoteInfoResponse(**note_info)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/graph")
def get_graph(limit: int = 500, min_degree: int = 0, vault_path: Optional[str] = None) -> Dict[str, Any]:
    """Get graph data for visualization (basic implementation)."""
    start_time = time.time()
    request_id = str(uuid.uuid4())
    
    try:
        db = get_database_manager(vault_path)
        conn = db.get_connection()
        cursor = conn.cursor()
        
        # Get nodes (notes)
        cursor.execute("""
            SELECT note_id, title, path, word_count 
            FROM notes 
            ORDER BY modified_at DESC 
            LIMIT ?
        """, (limit,))
        
        nodes = []
        for row in cursor.fetchall():
            nodes.append({
                "id": row["note_id"],
                "label": row["title"] or row["path"],
                "type": "note",
                "path": row["path"],
                "word_count": row["word_count"]
            })
        
        # Get edges (links)
        cursor.execute("""
            SELECT src_note, dst_note, link_text, occurrences
            FROM links
            WHERE occurrences >= ?
        """, (min_degree,))
        
        edges = []
        for row in cursor.fetchall():
            edges.append({
                "source": row["src_note"],
                "target": row["dst_note"],
                "type": "link",
                "label": row["link_text"],
                "weight": row["occurrences"]
            })
        
        conn.close()
        
        duration_ms = int((time.time() - start_time) * 1000)
        
        return {
            "request_id": request_id,
            "duration_ms": duration_ms,
            "nodes": nodes,
            "edges": edges
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Legacy endpoint for compatibility
@app.post("/search")
def search_legacy(req: SearchReq) -> List[Dict[str, Any]]:
    """Legacy search endpoint (redirects to semantic search)."""
    result = search_semantic(req)
    return result.get("results", [])


