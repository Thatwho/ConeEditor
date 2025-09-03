import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import { fileURLToPath } from 'node:url'
import chokidar, { FSWatcher } from 'chokidar'
import { initVaultDb, indexNoteInDb, getNoteInfoFromDb, getGraphDataFromDb } from './db.js'

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function createWindow(): Promise<void> {
  const isPackaged = app.isPackaged
  const preloadPath = path.join(__dirname, 'preload.cjs')
  
  console.log('Current __dirname:', __dirname)
  console.log('Preload path:', preloadPath)
  
  try {
    await fs.access(preloadPath)
    console.log('Preload file exists: true')
  } catch {
    console.log('Preload file exists: false')
  }

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // Open DevTools in development for debugging
  if (!isPackaged) {
    win.webContents.openDevTools()
  }

  const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'
  win.loadURL(devServerUrl)
}

app.whenReady().then(async () => {
  await createWindow()

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) await createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// Global state for file watching
let currentWatcher: FSWatcher | null = null
let currentVaultPath: string | null = null

// IPC Handlers
ipcMain.handle('open-vault', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Select Vault Directory'
  })
  
  if (result.canceled || result.filePaths.length === 0) {
    return null
  }
  
  const vaultPath = result.filePaths[0]
  
  // Stop watching previous vault if any
  if (currentWatcher) {
    await currentWatcher.close()
  }
  
  // Start watching the new vault
  currentVaultPath = vaultPath
  initVaultDb(vaultPath)
  startFileWatcher(vaultPath)
  
  return vaultPath
})

ipcMain.handle('create-vault', async () => {
  const result = await dialog.showSaveDialog({
    title: 'Create New Vault',
    buttonLabel: 'Create Vault',
    defaultPath: 'My Vault',
    properties: ['createDirectory']
  })
  
  if (result.canceled || !result.filePath) {
    return null
  }
  
  const vaultPath = result.filePath
  
  try {
    // Create the vault directory
    await fs.mkdir(vaultPath, { recursive: true })
    
    // Create a welcome markdown file
    const welcomeFile = path.join(vaultPath, 'Welcome.md')
    const welcomeContent = `# Welcome to Your Vault

This is your new ConeEditor vault! 

## Getting Started

- Create new markdown files using the ➕ button in the file tree
- Edit files by clicking on them
- Files are automatically saved as you type
- Use the search box to find files quickly

## Tips

- All \`.md\` files in this directory will appear in the file tree
- You can organize files in subdirectories
- External changes to files are automatically detected

Happy writing! ✨
`
    
    await fs.writeFile(welcomeFile, welcomeContent, 'utf-8')
    
    // Stop watching previous vault if any
    if (currentWatcher) {
      await currentWatcher.close()
    }
    
    // Start watching the new vault
    currentVaultPath = vaultPath
    initVaultDb(vaultPath)
    startFileWatcher(vaultPath)
    
    return vaultPath
  } catch (error) {
    throw new Error(`Failed to create vault: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
})

ipcMain.handle('read-file', async (_event, filePath: string) => {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return content
  } catch (error) {
    throw new Error(`Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
})

ipcMain.handle('write-file', async (_event, filePath: string, content: string) => {
  try {
    await fs.writeFile(filePath, content, 'utf-8')
    if (currentVaultPath) {
      indexNoteInDb({ path: filePath, content, modified_at: new Date().toISOString() })
    }
  } catch (error) {
    throw new Error(`Failed to write file: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
})

ipcMain.handle('get-vault-files', async (_event, vaultPath: string) => {
  try {
    const files: string[] = []
    
    async function scanDirectory(dirPath: string): Promise<void> {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)
        
        if (entry.isDirectory()) {
          // Skip hidden directories and node_modules
          if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await scanDirectory(fullPath)
          }
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          files.push(fullPath)
        }
      }
    }
    
    await scanDirectory(vaultPath)
    return files.sort()
  } catch (error) {
    throw new Error(`Failed to get vault files: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
})

// Local metadata APIs for renderer
ipcMain.handle('meta:get-note-info', async (_event, filePath: string) => {
  try {
    return getNoteInfoFromDb(filePath)
  } catch (error) {
    throw new Error(`Failed to get note info: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
})

ipcMain.handle('meta:index-note', async (_event, filePath: string) => {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return indexNoteInDb({ path: filePath, content, modified_at: new Date().toISOString() })
  } catch (error) {
    throw new Error(`Failed to index note: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
})

ipcMain.handle('meta:get-graph', async (_event, limit: number = 500, minDegree: number = 0) => {
  try {
    return getGraphDataFromDb(limit, minDegree)
  } catch (error) {
    throw new Error(`Failed to get graph: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
})

ipcMain.handle('create-file', async (_event, filePath: string) => {
  try {
    // Ensure directory exists
    const dir = path.dirname(filePath)
    await fs.mkdir(dir, { recursive: true })
    
    // Create empty file if it doesn't exist
    try {
      await fs.access(filePath)
    } catch {
      await fs.writeFile(filePath, '', 'utf-8')
    }
  } catch (error) {
    throw new Error(`Failed to create file: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
})

ipcMain.handle('delete-file', async (_event, filePath: string) => {
  try {
    await fs.unlink(filePath)
  } catch (error) {
    throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
})

ipcMain.handle('rename-file', async (_event, oldPath: string, newPath: string) => {
  try {
    // Ensure target directory exists
    const dir = path.dirname(newPath)
    await fs.mkdir(dir, { recursive: true })
    
    await fs.rename(oldPath, newPath)
  } catch (error) {
    throw new Error(`Failed to rename file: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
})

function startFileWatcher(vaultPath: string) {
  currentWatcher = chokidar.watch(vaultPath, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
    ignoreInitial: true
  })
  
  currentWatcher
    .on('change', async (filePath: string) => {
      if (filePath.endsWith('.md')) {
        try {
          const stats = await fs.stat(filePath)
          BrowserWindow.getAllWindows().forEach(win => {
            win.webContents.send('file-changed', { path: filePath, stats })
          })
        } catch (error) {
          console.error('Error getting file stats:', error)
          BrowserWindow.getAllWindows().forEach(win => {
            win.webContents.send('file-changed', { path: filePath })
          })
        }
      }
    })
    .on('add', (filePath: string) => {
      if (filePath.endsWith('.md')) {
        BrowserWindow.getAllWindows().forEach(win => {
          win.webContents.send('file-created', { path: filePath })
        })
      }
    })
    .on('unlink', (filePath: string) => {
      if (filePath.endsWith('.md')) {
        BrowserWindow.getAllWindows().forEach(win => {
          win.webContents.send('file-deleted', { path: filePath })
        })
      }
    })
    .on('error', (error: unknown) => {
      console.error('File watcher error:', error)
    })
}

// Clean up on app quit
app.on('before-quit', async () => {
  if (currentWatcher) {
    await currentWatcher.close()
  }
})


