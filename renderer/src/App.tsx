import React, { useState, useCallback } from 'react'
import { FileTree } from './components/FileTree'
import { Editor } from './components/Editor'
import { BacklinksPanel } from './components/BacklinksPanel'

/**
 * Main application component that orchestrates the file tree and editor.
 * 
 * @returns JSX.Element
 */
export function App(): JSX.Element {
  const [vaultPath, setVaultPath] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [editorContent, setEditorContent] = useState('')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  const handleOpenVault = useCallback(async () => {
    try {
      const selectedVault = await window.electronAPI.openVault()
      if (selectedVault) {
        setVaultPath(selectedVault)
        setSelectedFile(null) // Clear selected file when changing vault
      }
    } catch (error) {
      console.error('Failed to open vault:', error)
      alert(`Failed to open vault: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }, [])

  const handleCreateVault = useCallback(async () => {
    try {
      const newVault = await window.electronAPI.createVault()
      if (newVault) {
        setVaultPath(newVault)
        setSelectedFile(null) // Clear selected file when changing vault
      }
    } catch (error) {
      console.error('Failed to create vault:', error)
      alert(`Failed to create vault: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }, [])

  const handleFileSelect = useCallback((filePath: string) => {
    if (hasUnsavedChanges) {
      const userChoice = confirm(
        'You have unsaved changes. Are you sure you want to open another file? Your changes will be lost.'
      )
      if (!userChoice) return
    }
    
    setSelectedFile(filePath)
    setHasUnsavedChanges(false)
  }, [hasUnsavedChanges])

  const handleEditorContentChange = useCallback((content: string, hasChanges: boolean) => {
    setEditorContent(content)
    setHasUnsavedChanges(hasChanges)
  }, [])

  const handleEditorSave = useCallback((content: string) => {
    setEditorContent(content)
    setHasUnsavedChanges(false)
  }, [])

  return (
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Header */}
      <header style={{
        padding: '12px 16px',
        backgroundColor: '#2c3e50',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #34495e'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h1 style={{ 
            margin: 0, 
            fontSize: '18px', 
            fontWeight: 600 
          }}>
            ConeEditor
          </h1>
          
          {vaultPath && (
            <span style={{ 
              fontSize: '14px', 
              color: '#bdc3c7',
              maxWidth: '300px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              📁 {vaultPath}
            </span>
          )}
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={handleOpenVault}
            style={{
              padding: '8px 16px',
              backgroundColor: '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500
            }}
            className="hover:bg-blue-600"
          >
            {vaultPath ? 'Open Vault' : 'Open Vault'}
          </button>
          
          {!vaultPath && (
            <button
              onClick={handleCreateVault}
              style={{
                padding: '8px 16px',
                backgroundColor: '#27ae60',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500
              }}
              className="hover:bg-green-600"
            >
              Create New Vault
            </button>
          )}
          
          {hasUnsavedChanges && (
            <div style={{
              padding: '8px 12px',
              backgroundColor: '#e67e22',
              color: 'white',
              borderRadius: '4px',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span>●</span>
              <span>Unsaved changes</span>
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <div style={{ 
        flex: 1, 
        display: 'flex',
        overflow: 'hidden'
      }}>
        {vaultPath ? (
          <>
            {/* File tree sidebar */}
            <div style={{
              width: '300px',
              backgroundColor: '#f8f9fa',
              borderRight: '1px solid #e9ecef',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <div style={{
                padding: '12px 16px',
                backgroundColor: '#e9ecef',
                borderBottom: '1px solid #dee2e6',
                fontSize: '14px',
                fontWeight: 600,
                color: '#495057'
              }}>
                Files
              </div>
              
              <FileTree
                vaultPath={vaultPath}
                onFileSelect={handleFileSelect}
                className="flex-1"
              />
            </div>

            {/* Editor area */}
            <div style={{ 
              flex: 1,
              display: 'flex',
              flexDirection: 'column'
            }}>
              <Editor
                filePath={selectedFile}
                vaultPath={vaultPath}
                onSave={handleEditorSave}
                onContentChange={handleEditorContentChange}
                className="flex-1"
              />
            </div>

            {/* Backlinks panel */}
            <div style={{
              width: '300px',
              backgroundColor: '#f8f9fa',
              borderLeft: '1px solid #e9ecef'
            }}>
              <BacklinksPanel
                currentFilePath={selectedFile}
                vaultPath={vaultPath}
                onNavigateToNote={handleFileSelect}
                className="h-full"
              />
            </div>
          </>
        ) : (
          /* Welcome screen */
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f8f9fa'
          }}>
            <div style={{
              textAlign: 'center',
              maxWidth: '400px',
              padding: '40px'
            }}>
              <div style={{
                fontSize: '48px',
                marginBottom: '24px'
              }}>
                📝
              </div>
              
              <h2 style={{
                fontSize: '24px',
                fontWeight: 600,
                color: '#2c3e50',
                marginBottom: '12px'
              }}>
                Welcome to ConeEditor
              </h2>
              
              <p style={{
                fontSize: '16px',
                color: '#7f8c8d',
                marginBottom: '32px',
                lineHeight: '1.5'
              }}>
                A modern Markdown editor built with Electron, React, and CodeMirror. 
                Get started by opening an existing vault or creating a new one.
              </p>
              
              <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={handleOpenVault}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#3498db',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    fontWeight: 500,
                    boxShadow: '0 2px 4px rgba(52, 152, 219, 0.3)',
                    minWidth: '180px'
                  }}
                  className="hover:bg-blue-600"
                >
                  📁 Open Vault
                </button>
                
                <button
                  onClick={handleCreateVault}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#27ae60',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    fontWeight: 500,
                    boxShadow: '0 2px 4px rgba(39, 174, 96, 0.3)',
                    minWidth: '180px'
                  }}
                  className="hover:bg-green-600"
                >
                  ➕ Create New Vault
                </button>
              </div>
              
              <div style={{
                marginTop: '24px',
                fontSize: '14px',
                color: '#95a5a6'
              }}>
                <p>Features:</p>
                <ul style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: '8px 0',
                  lineHeight: '1.6'
                }}>
                  <li>📁 Open existing vaults or create new ones</li>
                  <li>🌳 File tree with search and management</li>
                  <li>✏️ CodeMirror 6 with Markdown support</li>
                  <li>💾 Auto-save with debounce (1.2s)</li>
                  <li>🔍 Real-time file watching</li>
                  <li>⌨️ Keyboard shortcuts (Ctrl/Cmd+S)</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Status bar */}
      <footer style={{
        padding: '6px 16px',
        backgroundColor: '#34495e',
        color: '#bdc3c7',
        fontSize: '12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTop: '1px solid #2c3e50'
      }}>
        <div>
          {selectedFile ? (
            <span>
              📄 {selectedFile.split('/').pop()} 
              {hasUnsavedChanges && ' (modified)'}
            </span>
          ) : (
            <span>Ready</span>
          )}
        </div>
        
        <div style={{ display: 'flex', gap: '16px' }}>
          {vaultPath && (
            <span>
              Vault: {vaultPath.split('/').pop()}
            </span>
          )}
          <span>ConeEditor v0.0.1</span>
        </div>
      </footer>
    </div>
  )
}


