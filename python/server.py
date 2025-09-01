from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Dict, Any


class IndexReq(BaseModel):
    path: str
    content: str
    modified_at: str


class SearchReq(BaseModel):
    q: str
    top_k: int = 10


app = FastAPI(title="ConeEditor Python Service", version="0.0.1")


@app.get("/health")
def health() -> Dict[str, Any]:
    return {"status": "ok", "model_loaded": False}


@app.post("/index")
def index(req: IndexReq) -> Dict[str, Any]:
    # Stub implementation: echo back minimal indexing result
    return {"indexed_chunks": [], "note_path": req.path}


@app.post("/search")
def search(req: SearchReq) -> List[Dict[str, Any]]:
    # Stub implementation: return empty list
    return []


