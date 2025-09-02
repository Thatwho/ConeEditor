"""
Database initialization script for ConeEditor.

This script creates the SQLite database schema required for indexing
notes, headings, links, and chunks. It should be run once when setting
up the application or when schema updates are needed.

The schema follows the specification in the Product Requirements Document.
"""

import sqlite3
import os
from pathlib import Path


def get_db_path(vault_path: str = None) -> str:
    """Get the database file path for a specific vault."""
    if vault_path:
        # Store database in the vault directory
        return os.path.join(vault_path, ".cone_editor.db")
    else:
        # Fallback to script directory for development/testing
        return os.path.join(os.path.dirname(__file__), "cone_editor.db")


def create_schema(db_path: str) -> None:
    """Create the database schema."""
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Enable WAL mode for better concurrency
        cursor.execute("PRAGMA journal_mode=WAL")
        
        # Create notes table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS notes (
                note_id TEXT PRIMARY KEY,
                path TEXT UNIQUE NOT NULL,
                title TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                word_count INTEGER DEFAULT 0,
                metadata JSON
            )
        """)
        
        # Create headings table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS headings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                note_id TEXT NOT NULL,
                heading TEXT NOT NULL,
                level INTEGER NOT NULL,
                start_offset INTEGER NOT NULL,
                FOREIGN KEY (note_id) REFERENCES notes(note_id) ON DELETE CASCADE
            )
        """)
        
        # Create links table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS links (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                src_note TEXT NOT NULL,
                dst_note TEXT NOT NULL,
                link_text TEXT,
                occurrences INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (src_note) REFERENCES notes(note_id) ON DELETE CASCADE
            )
        """)
        
        # Create chunks table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS chunks (
                chunk_id TEXT PRIMARY KEY,
                note_id TEXT NOT NULL,
                heading_id INTEGER,
                start_offset INTEGER NOT NULL,
                end_offset INTEGER NOT NULL,
                text TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (note_id) REFERENCES notes(note_id) ON DELETE CASCADE,
                FOREIGN KEY (heading_id) REFERENCES headings(id) ON DELETE SET NULL
            )
        """)
        
        # Create vector_meta table (optional, for future vector storage)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS vector_meta (
                chunk_id TEXT PRIMARY KEY,
                vector_id TEXT,
                vector_backend TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (chunk_id) REFERENCES chunks(chunk_id) ON DELETE CASCADE
            )
        """)
        
        # Create indices for performance
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_notes_modified ON notes(modified_at)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_notes_path ON notes(path)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_headings_note ON headings(note_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_links_src ON links(src_note)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_links_dst ON links(dst_note)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_chunks_note ON chunks(note_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_chunks_heading ON chunks(heading_id)")
        
        conn.commit()
        print(f"Database schema created successfully at: {db_path}")
        
    except sqlite3.Error as e:
        print(f"Error creating database schema: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()


def initialize_database(vault_path: str = None) -> str:
    """Initialize the database and return the path."""
    db_path = get_db_path(vault_path)
    
    # Create directory if it doesn't exist
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    
    # Create schema
    create_schema(db_path)
    
    return db_path


def reset_database() -> str:
    """Reset the database by dropping all tables and recreating them."""
    db_path = get_db_path()
    
    if os.path.exists(db_path):
        os.remove(db_path)
        print(f"Removed existing database: {db_path}")
    
    return initialize_database()


def check_database_exists() -> bool:
    """Check if the database file exists."""
    return os.path.exists(get_db_path())


def get_database_info() -> dict:
    """Get information about the database."""
    db_path = get_db_path()
    
    if not os.path.exists(db_path):
        return {"exists": False, "path": db_path}
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Get table counts
        cursor.execute("SELECT COUNT(*) FROM notes")
        notes_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM headings")
        headings_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM links")
        links_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM chunks")
        chunks_count = cursor.fetchone()[0]
        
        # Get database size
        db_size = os.path.getsize(db_path)
        
        return {
            "exists": True,
            "path": db_path,
            "size_bytes": db_size,
            "tables": {
                "notes": notes_count,
                "headings": headings_count,
                "links": links_count,
                "chunks": chunks_count
            }
        }
        
    except sqlite3.Error as e:
        return {"exists": True, "path": db_path, "error": str(e)}
    finally:
        conn.close()


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        command = sys.argv[1]
        
        if command == "init":
            db_path = initialize_database()
            print(f"Database initialized: {db_path}")
            
        elif command == "reset":
            db_path = reset_database()
            print(f"Database reset: {db_path}")
            
        elif command == "info":
            info = get_database_info()
            print("Database Information:")
            for key, value in info.items():
                print(f"  {key}: {value}")
                
        else:
            print("Usage: python db_init.py [init|reset|info]")
            sys.exit(1)
    else:
        # Default: initialize if not exists
        if not check_database_exists():
            initialize_database()
        else:
            print(f"Database already exists at: {get_db_path()}")
