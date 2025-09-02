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
    }
  }
}

export {}


