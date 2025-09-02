import React, { useEffect, useRef, useState, useCallback } from 'react'
import { EditorView, keymap } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap, indentWithTab } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'
import { search, searchKeymap } from '@codemirror/search'
import { autocompletion } from '@codemirror/autocomplete'
import { linter, lintKeymap } from '@codemirror/lint'
// import { languages } from '@codemirror/language-data' // Not needed for basic markdown

interface EditorProps {
  filePath: string | null
  vaultPath?: string | null
  onSave?: (content: string) => void
  onContentChange?: (content: string, hasUnsavedChanges: boolean) => void
  className?: string
}

/**
 * CodeMirror-based Markdown editor with auto-save and syntax highlighting.
 * 
 * @param props - Component props
 * @returns JSX.Element
 */
export function Editor({ 
  filePath, 
  vaultPath,
  onSave,
  onContentChange,
  className = ''
}: EditorProps): JSX.Element {
  const editorRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const [content, setContent] = useState('')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const fileStatsRef = useRef<any>(null)

  // Load file content
  const loadFile = useCallback(async () => {
    if (!filePath) {
      setContent('')
      return
    }

    try {
      const fileContent = await window.electronAPI.readFile(filePath)
      setContent(fileContent)
      setHasUnsavedChanges(false)
      setLastSaved(new Date())
      
      // Update editor content if view exists
      if (viewRef.current) {
        const transaction = viewRef.current.state.update({
          changes: {
            from: 0,
            to: viewRef.current.state.doc.length,
            insert: fileContent
          }
        })
        viewRef.current.dispatch(transaction)
      }
    } catch (error) {
      console.error('Failed to load file:', error)
      alert(`Failed to load file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }, [filePath])

  // Save file content
  const saveFile = useCallback(async (contentToSave?: string) => {
    if (!filePath) return
    
    const saveContent = contentToSave ?? viewRef.current?.state.doc.toString() ?? content
    
    setIsSaving(true)
    try {
      await window.electronAPI.writeFile(filePath, saveContent)
      setHasUnsavedChanges(false)
      setLastSaved(new Date())
      onSave?.(saveContent)
      
      // Call POST /index to update the search index
      try {
        const { indexNote } = await import('../lib/api')
        const indexResult = await indexNote({
          path: filePath,
          content: saveContent,
          modified_at: new Date().toISOString(),
          vault_path: vaultPath || undefined
        })
        console.log('Note indexed successfully:', indexResult)
      } catch (error) {
        console.warn('Failed to index note (Python service may not be running):', error)
      }
    } catch (error) {
      console.error('Failed to save file:', error)
      alert(`Failed to save file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsSaving(false)
    }
  }, [filePath, content, onSave])

  // Debounced auto-save
  const debouncedSave = useCallback((content: string) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }
    
    debounceTimeoutRef.current = setTimeout(() => {
      saveFile(content)
    }, 1200) // 1200ms delay as specified
  }, [saveFile])

  // Handle content changes
  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent)
    setHasUnsavedChanges(true)
    onContentChange?.(newContent, true)
    debouncedSave(newContent)
  }, [onContentChange, debouncedSave])

  // Manual save with Ctrl/Cmd+S
  const handleManualSave = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
      debounceTimeoutRef.current = null
    }
    saveFile()
  }, [saveFile])

  // Initialize CodeMirror
  useEffect(() => {
    if (!editorRef.current) return

    const saveKeymap = keymap.of([
      {
        key: 'Mod-s',
        preventDefault: true,
        run: () => {
          handleManualSave()
          return true
        }
      }
    ])

    const state = EditorState.create({
      doc: content,
      extensions: [
        // Basic setup
        EditorView.lineWrapping,
        EditorView.theme({
          '&': { height: '100%' },
          '.cm-scroller': { fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace' },
          '.cm-content': { padding: '16px', minHeight: '100%' },
          '.cm-focused': { outline: 'none' }
        }),
        
        // Language support
        markdown(),
        
        // Theme (could be made configurable)
        // oneDark,
        
        // Features
        search(),
        autocompletion(),
        
        // Keymaps
        keymap.of([
          ...defaultKeymap,
          ...searchKeymap,
          ...lintKeymap,
          indentWithTab
        ]),
        saveKeymap,
        
        // Update listener
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const newContent = update.state.doc.toString()
            handleContentChange(newContent)
          }
        })
      ]
    })

    const view = new EditorView({
      state,
      parent: editorRef.current
    })

    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, []) // Only run once on mount

  // Load file when filePath changes
  useEffect(() => {
    loadFile()
  }, [loadFile])

  // Set up file change listener
  useEffect(() => {
    if (!filePath) return

    const unsubscribe = window.electronAPI.onFileChanged((event) => {
      if (event.path === filePath) {
        // Check if we have unsaved changes
        if (hasUnsavedChanges) {
          const userChoice = confirm(
            `The file "${filePath}" has been modified externally. You have unsaved changes. ` +
            'Do you want to reload the file? (Your changes will be lost)'
          )
          if (userChoice) {
            loadFile()
          }
        } else {
          // Auto-reload if no unsaved changes
          loadFile()
        }
      }
    })

    return unsubscribe
  }, [filePath, hasUnsavedChanges, loadFile])

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
    }
  }, [])

  // Handle keyboard shortcuts globally
  useEffect(() => {
    const handleGlobalKeydown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault()
        handleManualSave()
      }
    }

    document.addEventListener('keydown', handleGlobalKeydown)
    return () => document.removeEventListener('keydown', handleGlobalKeydown)
  }, [handleManualSave])

  if (!filePath) {
    return (
      <div className={`editor ${className}`} style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        height: '100%',
        backgroundColor: '#fafafa',
        color: '#666'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>No file selected</h3>
          <p style={{ margin: 0, fontSize: '14px' }}>Choose a file from the sidebar to start editing</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`editor ${className}`} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Status bar */}
      <div style={{
        padding: '8px 16px',
        backgroundColor: '#f5f5f5',
        borderBottom: '1px solid #ddd',
        fontSize: '12px',
        color: '#666',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <span style={{ fontWeight: 'bold' }}>{filePath.split('/').pop()}</span>
          {hasUnsavedChanges && <span style={{ color: '#ff6b00', marginLeft: '8px' }}>● Unsaved</span>}
          {isSaving && <span style={{ color: '#007acc', marginLeft: '8px' }}>Saving...</span>}
        </div>
        
        <div style={{ display: 'flex', gap: '16px' }}>
          {lastSaved && (
            <span>Last saved: {lastSaved.toLocaleTimeString()}</span>
          )}
          <button
            onClick={handleManualSave}
            disabled={isSaving || !hasUnsavedChanges}
            style={{
              padding: '4px 8px',
              fontSize: '12px',
              border: '1px solid #ccc',
              borderRadius: '3px',
              backgroundColor: hasUnsavedChanges ? '#007acc' : '#f0f0f0',
              color: hasUnsavedChanges ? 'white' : '#666',
              cursor: hasUnsavedChanges ? 'pointer' : 'not-allowed'
            }}
          >
            Save (Ctrl+S)
          </button>
        </div>
      </div>
      
      {/* Editor container */}
      <div 
        ref={editorRef} 
        style={{ 
          flex: 1, 
          overflow: 'hidden',
          backgroundColor: 'white'
        }} 
      />
    </div>
  )
}
