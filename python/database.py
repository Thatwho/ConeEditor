"""
Database utilities for ConeEditor.

This module provides async database operations for managing notes, headings,
links, and chunks in the SQLite database.
"""

import sqlite3
import json
import hashlib
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path
import re

from db_init import get_db_path, initialize_database


class DatabaseManager:
    """Manages database operations for ConeEditor."""
    
    def __init__(self, vault_path: str = None):
        self.vault_path = vault_path
        self.db_path = get_db_path(vault_path)
        # Initialize database if it doesn't exist
        if not Path(self.db_path).exists():
            initialize_database(vault_path)
    
    def get_connection(self) -> sqlite3.Connection:
        """Get a database connection."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row  # Enable dict-like access
        return conn
    
    def upsert_note(self, path: str, content: str, modified_at: str) -> str:
        """Insert or update a note in the database."""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            # Use path as note_id (normalized)
            note_id = path
            
            # Extract title from content (first heading or filename)
            title = self._extract_title(content, path)
            
            # Count words
            word_count = len(re.findall(r'\w+', content))
            
            # Upsert note
            cursor.execute("""
                INSERT OR REPLACE INTO notes 
                (note_id, path, title, modified_at, word_count, metadata)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (note_id, path, title, modified_at, word_count, "{}"))
            
            conn.commit()
            return note_id
            
        except sqlite3.Error as e:
            conn.rollback()
            raise Exception(f"Failed to upsert note: {e}")
        finally:
            conn.close()
    
    def index_headings(self, note_id: str, content: str) -> List[Dict[str, Any]]:
        """Extract and index headings from markdown content."""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            # Delete existing headings for this note
            cursor.execute("DELETE FROM headings WHERE note_id = ?", (note_id,))
            
            headings = []
            lines = content.split('\n')
            current_offset = 0
            
            for line in lines:
                line_start = current_offset
                current_offset += len(line) + 1  # +1 for newline
                
                # Match markdown headings
                heading_match = re.match(r'^(#{1,6})\s+(.+)$', line.strip())
                if heading_match:
                    level = len(heading_match.group(1))
                    heading_text = heading_match.group(2).strip()
                    
                    cursor.execute("""
                        INSERT INTO headings (note_id, heading, level, start_offset)
                        VALUES (?, ?, ?, ?)
                    """, (note_id, heading_text, level, line_start))
                    
                    heading_id = cursor.lastrowid
                    headings.append({
                        "id": heading_id,
                        "heading": heading_text,
                        "level": level,
                        "start_offset": line_start
                    })
            
            conn.commit()
            return headings
            
        except sqlite3.Error as e:
            conn.rollback()
            raise Exception(f"Failed to index headings: {e}")
        finally:
            conn.close()
    
    def index_links(self, note_id: str, content: str) -> List[Dict[str, Any]]:
        """Extract and index wikilinks from markdown content."""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            # Delete existing links for this note
            cursor.execute("DELETE FROM links WHERE src_note = ?", (note_id,))
            
            # Extract wikilinks using regex
            wikilink_pattern = r'\[\[([^\]|]+)(\|([^\]]+))?\]\]'
            links = []
            link_counts = {}
            
            for match in re.finditer(wikilink_pattern, content):
                target = match.group(1).strip()
                alias = match.group(3).strip() if match.group(3) else None
                link_text = alias or target
                
                # Normalize the target - try to resolve to actual note path
                normalized_target = self._resolve_link_target(target)
                
                # Count occurrences
                if normalized_target in link_counts:
                    link_counts[normalized_target] += 1
                else:
                    link_counts[normalized_target] = 1
                    links.append({
                        "target": normalized_target,
                        "link_text": link_text
                    })
            
            # Insert links into database
            for link in links:
                cursor.execute("""
                    INSERT INTO links (src_note, dst_note, link_text, occurrences)
                    VALUES (?, ?, ?, ?)
                """, (note_id, link["target"], link["link_text"], link_counts[link["target"]]))
            
            conn.commit()
            return links
            
        except sqlite3.Error as e:
            conn.rollback()
            raise Exception(f"Failed to index links: {e}")
        finally:
            conn.close()
    
    def _resolve_link_target(self, target: str) -> str:
        """Resolve a wikilink target to the best matching note path or title."""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            # First, try exact matches on path, title, filename, or stem
            cursor.execute("""
                SELECT path, title FROM notes 
                WHERE path = ? OR title = ? OR 
                      path LIKE '%/' || ? OR path LIKE '%/' || ? || '.md'
                ORDER BY 
                    CASE 
                        WHEN title = ? THEN 1
                        WHEN path = ? THEN 2
                        WHEN path LIKE '%/' || ? || '.md' THEN 3
                        ELSE 4
                    END
                LIMIT 1
            """, (target, target, target, target, target, target, target))
            
            result = cursor.fetchone()
            if result:
                return result["path"]
            
            # If no exact match, return the original target
            # This allows for forward references to notes that don't exist yet
            return target
            
        except sqlite3.Error:
            # If query fails, return original target
            return target
        finally:
            conn.close()
    
    def create_chunks(self, note_id: str, content: str, headings: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Create text chunks from content."""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            # Delete existing chunks for this note
            cursor.execute("DELETE FROM chunks WHERE note_id = ?", (note_id,))
            
            chunks = []
            
            # Simple chunking strategy: split by double newlines or max length
            max_chunk_size = 1000
            paragraphs = content.split('\n\n')
            
            current_chunk = ""
            start_offset = 0
            current_offset = 0
            
            for paragraph in paragraphs:
                # If adding this paragraph would exceed max size, save current chunk
                if current_chunk and len(current_chunk) + len(paragraph) > max_chunk_size:
                    chunk_id = self._generate_chunk_id(note_id, start_offset)
                    
                    # Find associated heading
                    heading_id = self._find_heading_for_chunk(headings, start_offset)
                    
                    cursor.execute("""
                        INSERT INTO chunks (chunk_id, note_id, heading_id, start_offset, end_offset, text)
                        VALUES (?, ?, ?, ?, ?, ?)
                    """, (chunk_id, note_id, heading_id, start_offset, current_offset, current_chunk))
                    
                    chunks.append({
                        "chunk_id": chunk_id,
                        "start": start_offset,
                        "end": current_offset,
                        "text": current_chunk[:100] + "..." if len(current_chunk) > 100 else current_chunk
                    })
                    
                    # Start new chunk
                    current_chunk = paragraph
                    start_offset = current_offset
                else:
                    if current_chunk:
                        current_chunk += "\n\n" + paragraph
                    else:
                        current_chunk = paragraph
                        start_offset = current_offset
                
                current_offset += len(paragraph) + 2  # +2 for double newline
            
            # Save final chunk if any
            if current_chunk.strip():
                chunk_id = self._generate_chunk_id(note_id, start_offset)
                heading_id = self._find_heading_for_chunk(headings, start_offset)
                
                cursor.execute("""
                    INSERT INTO chunks (chunk_id, note_id, heading_id, start_offset, end_offset, text)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (chunk_id, note_id, heading_id, start_offset, current_offset, current_chunk))
                
                chunks.append({
                    "chunk_id": chunk_id,
                    "start": start_offset,
                    "end": current_offset,
                    "text": current_chunk[:100] + "..." if len(current_chunk) > 100 else current_chunk
                })
            
            conn.commit()
            return chunks
            
        except sqlite3.Error as e:
            conn.rollback()
            raise Exception(f"Failed to create chunks: {e}")
        finally:
            conn.close()
    
    def get_backlinks(self, note_path: str) -> List[Dict[str, Any]]:
        """Get backlinks pointing to a note."""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            # Get the note info to find its title and normalized identifiers
            cursor.execute("SELECT title, path FROM notes WHERE path = ?", (note_path,))
            note_row = cursor.fetchone()
            
            if not note_row:
                return []
            
            note_title = note_row["title"]
            note_filename = Path(note_path).name
            note_stem = Path(note_path).stem
            
            # Create a list of possible targets this note could be referenced as
            possible_targets = [note_path, note_title, note_filename, note_stem]
            # Remove duplicates and None values
            possible_targets = list(set(filter(None, possible_targets)))
            
            # Build the WHERE clause dynamically
            placeholders = ", ".join("?" * len(possible_targets))
            
            cursor.execute(f"""
                SELECT l.src_note, l.link_text, l.occurrences, n.title, n.path
                FROM links l
                LEFT JOIN notes n ON l.src_note = n.note_id
                WHERE l.dst_note IN ({placeholders})
                ORDER BY l.occurrences DESC, n.modified_at DESC
            """, possible_targets)
            
            backlinks = []
            for row in cursor.fetchall():
                backlinks.append({
                    "src_note": row["src_note"],
                    "src_title": row["title"],
                    "src_path": row["path"],
                    "link_text": row["link_text"],
                    "occurrences": row["occurrences"]
                })
            
            return backlinks
            
        except sqlite3.Error as e:
            raise Exception(f"Failed to get backlinks: {e}")
        finally:
            conn.close()
    
    def get_note_info(self, note_path: str) -> Optional[Dict[str, Any]]:
        """Get note information and metadata."""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                SELECT * FROM notes WHERE path = ? OR note_id = ?
            """, (note_path, note_path))
            
            row = cursor.fetchone()
            if not row:
                return None
            
            # Get headings
            cursor.execute("""
                SELECT heading, level, start_offset 
                FROM headings 
                WHERE note_id = ? 
                ORDER BY start_offset
            """, (row["note_id"],))
            
            headings = [dict(h) for h in cursor.fetchall()]
            
            # Get backlinks
            backlinks = self.get_backlinks(note_path)
            
            return {
                "note_id": row["note_id"],
                "path": row["path"],
                "title": row["title"],
                "created_at": row["created_at"],
                "modified_at": row["modified_at"],
                "word_count": row["word_count"],
                "headings": headings,
                "backlinks": backlinks
            }
            
        except sqlite3.Error as e:
            raise Exception(f"Failed to get note info: {e}")
        finally:
            conn.close()
    
    def _extract_title(self, content: str, path: str) -> str:
        """Extract title from content or use filename."""
        # Try to find first heading
        lines = content.split('\n')
        for line in lines:
            heading_match = re.match(r'^#\s+(.+)$', line.strip())
            if heading_match:
                return heading_match.group(1).strip()
        
        # Fallback to filename
        return Path(path).stem
    
    def _generate_chunk_id(self, note_id: str, start_offset: int) -> str:
        """Generate a unique chunk ID."""
        content = f"{note_id}:{start_offset}"
        return hashlib.sha1(content.encode()).hexdigest()[:16]
    
    def _find_heading_for_chunk(self, headings: List[Dict[str, Any]], chunk_start: int) -> Optional[int]:
        """Find the most relevant heading for a chunk."""
        best_heading = None
        best_distance = float('inf')
        
        for heading in headings:
            distance = abs(heading["start_offset"] - chunk_start)
            if distance < best_distance and heading["start_offset"] <= chunk_start:
                best_heading = heading
                best_distance = distance
        
        return best_heading["id"] if best_heading else None
