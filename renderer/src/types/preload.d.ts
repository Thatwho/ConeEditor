declare global {
  interface Window {
    electronAPI: {
      // Vault and file operations
      openVault(): Promise<string | null>
      createVault(): Promise<string | null>
      readFile(path: string): Promise<string>
      writeFile(path: string, content: string): Promise<void>
      getVaultFiles(vaultPath: string): Promise<string[]>
      
      // File operations for tree management
      createFile(path: string): Promise<void>
      deleteFile(path: string): Promise<void>
      renameFile(oldPath: string, newPath: string): Promise<void>
      
      // Event listeners for file changes
      onFileChanged(callback: (event: { path: string; stats?: any }) => void): () => void
      onFileCreated(callback: (event: { path: string }) => void): () => void
      onFileDeleted(callback: (event: { path: string }) => void): () => void

      // Local metadata APIs (TS-only indexing)
      indexNoteLocal(path: string): Promise<{
        note_id: string
        indexed_chunks: number
        chunks: Array<{ chunk_id: string; start: number; end: number; text: string }>
        headings_count: number
        links_count: number
      }>
      getNoteInfoLocal(path: string): Promise<{
        note_id: string
        path: string
        title: string
        created_at: string
        modified_at: string
        word_count: number
        headings: Array<{ heading: string; level: number; start_offset: number }>
        backlinks: Array<{ src_note: string; src_title: string; src_path: string; link_text: string; occurrences: number }>
      }>
      getGraphLocal(limit: number, minDegree: number): Promise<{
        nodes: Array<{ id: string; label: string; type: string; path: string; word_count: number }>
        edges: Array<{ source: string; target: string; type: string; label: string; weight: number }>
      }>
    }
  }
}

export {}


