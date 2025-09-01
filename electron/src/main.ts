import { app, BrowserWindow } from 'electron'
import path from 'node:path'

function createWindow(): void {
  const isPackaged = app.isPackaged
  const preloadPath = isPackaged
    ? path.join(__dirname, 'preload.js')
    : undefined

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: preloadPath
    }
  })

  const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'
  win.loadURL(devServerUrl)
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})


