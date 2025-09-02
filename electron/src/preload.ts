const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Vault and file operations
  openVault: () => ipcRenderer.invoke('open-vault'),
  createVault: () => ipcRenderer.invoke('create-vault'),
  readFile: (path: string) => ipcRenderer.invoke('read-file', path),
  writeFile: (path: string, content: string) => ipcRenderer.invoke('write-file', path, content),
  getVaultFiles: (vaultPath: string) => ipcRenderer.invoke('get-vault-files', vaultPath),
  
  // File operations for tree management
  createFile: (path: string) => ipcRenderer.invoke('create-file', path),
  deleteFile: (path: string) => ipcRenderer.invoke('delete-file', path),
  renameFile: (oldPath: string, newPath: string) => ipcRenderer.invoke('rename-file', oldPath, newPath),
  
  // Event listeners for file changes
  onFileChanged: (callback: (event: { path: string; stats?: any }) => void) => {
    const listener = (_event: any, data: { path: string; stats?: any }) => callback(data)
    ipcRenderer.on('file-changed', listener)
    return () => ipcRenderer.removeListener('file-changed', listener)
  },
  onFileCreated: (callback: (event: { path: string }) => void) => {
    const listener = (_event: any, data: { path: string }) => callback(data)
    ipcRenderer.on('file-created', listener)
    return () => ipcRenderer.removeListener('file-created', listener)
  },
  onFileDeleted: (callback: (event: { path: string }) => void) => {
    const listener = (_event: any, data: { path: string }) => callback(data)
    ipcRenderer.on('file-deleted', listener)
    return () => ipcRenderer.removeListener('file-deleted', listener)
  }
})


