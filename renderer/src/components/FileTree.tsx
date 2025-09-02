import React, { useState, useEffect, useCallback } from 'react'

// Browser-compatible path utilities
const pathUtils = {
  basename: (filePath: string, ext?: string): string => {
    const name = filePath.split('/').pop() || ''
    return ext ? name.replace(new RegExp(`\\${ext}$`), '') : name
  },
  dirname: (filePath: string): string => {
    const parts = filePath.split('/')
    return parts.slice(0, -1).join('/')
  },
  join: (...paths: string[]): string => {
    return paths.filter(Boolean).join('/').replace(/\/+/g, '/')
  },
  relative: (from: string, to: string): string => {
    const fromParts = from.split('/')
    const toParts = to.split('/')
    
    // Find common base
    let commonLength = 0
    for (let i = 0; i < Math.min(fromParts.length, toParts.length); i++) {
      if (fromParts[i] === toParts[i]) {
        commonLength++
      } else {
        break
      }
    }
    
    const relativeParts = toParts.slice(commonLength)
    return relativeParts.join('/')
  },
  sep: '/'
}

interface FileTreeProps {
  vaultPath: string | null
  onFileSelect: (filePath: string) => void
  className?: string
}

interface FileNode {
  name: string
  path: string
  isDirectory: boolean
  children?: FileNode[]
}

/**
 * FileTree component for displaying and managing markdown files in a vault.
 * 
 * @param props - Component props
 * @returns JSX.Element
 */
export function FileTree({ vaultPath, onFileSelect, className = '' }: FileTreeProps): JSX.Element {
  const [files, setFiles] = useState<string[]>([])
  const [filteredFiles, setFilteredFiles] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set())
  const [editingFile, setEditingFile] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')

  // Load files when vault path changes
  const loadFiles = useCallback(async () => {
    if (!vaultPath) {
      setFiles([])
      setFilteredFiles([])
      return
    }

    setLoading(true)
    try {
      const fileList = await window.electronAPI.getVaultFiles(vaultPath)
      setFiles(fileList)
      setFilteredFiles(fileList)
    } catch (error) {
      console.error('Failed to load files:', error)
      setFiles([])
      setFilteredFiles([])
    } finally {
      setLoading(false)
    }
  }, [vaultPath])

  useEffect(() => {
    loadFiles()
  }, [loadFiles])

  // Filter files based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredFiles(files)
    } else {
      const filtered = files.filter(file =>
        pathUtils.basename(file).toLowerCase().includes(searchTerm.toLowerCase())
      )
      setFilteredFiles(filtered)
    }
  }, [files, searchTerm])

  // Set up file change listeners
  useEffect(() => {
    const unsubscribeCreated = window.electronAPI.onFileCreated(() => {
      loadFiles()
    })
    
    const unsubscribeDeleted = window.electronAPI.onFileDeleted(() => {
      loadFiles()
    })

    return () => {
      unsubscribeCreated()
      unsubscribeDeleted()
    }
  }, [loadFiles])

  // Build tree structure from flat file list
  const buildFileTree = (fileList: string[]): FileNode[] => {
    if (!vaultPath) return []
    
    const tree: FileNode[] = []
    const nodeMap = new Map<string, FileNode>()

    // Add root node
    const rootNode: FileNode = {
      name: pathUtils.basename(vaultPath),
      path: vaultPath,
      isDirectory: true,
      children: []
    }
    nodeMap.set(vaultPath, rootNode)
    tree.push(rootNode)

    fileList.forEach(filePath => {
      const relativePath = pathUtils.relative(vaultPath, filePath)
      const parts = relativePath.split(pathUtils.sep)
      let currentPath = vaultPath

      // Create directory nodes
      for (let i = 0; i < parts.length - 1; i++) {
        const dirName = parts[i]
        const dirPath = pathUtils.join(currentPath, dirName)
        
        if (!nodeMap.has(dirPath)) {
          const dirNode: FileNode = {
            name: dirName,
            path: dirPath,
            isDirectory: true,
            children: []
          }
          nodeMap.set(dirPath, dirNode)
          
          const parentNode = nodeMap.get(currentPath)
          if (parentNode && parentNode.children) {
            parentNode.children.push(dirNode)
          }
        }
        currentPath = dirPath
      }

      // Create file node
      const fileName = parts[parts.length - 1]
      const fileNode: FileNode = {
        name: fileName,
        path: filePath,
        isDirectory: false
      }
      
      const parentNode = nodeMap.get(currentPath)
      if (parentNode && parentNode.children) {
        parentNode.children.push(fileNode)
      }
    })

    // Sort children
    const sortNodes = (nodes: FileNode[]) => {
      nodes.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1
        if (!a.isDirectory && b.isDirectory) return 1
        return a.name.localeCompare(b.name)
      })
      nodes.forEach(node => {
        if (node.children) {
          sortNodes(node.children)
        }
      })
    }

    tree.forEach(node => {
      if (node.children) {
        sortNodes(node.children)
      }
    })

    return tree
  }

  const handleFileClick = (filePath: string) => {
    if (editingFile) return
    onFileSelect(filePath)
  }

  const handleCreateFile = async () => {
    if (!vaultPath) return

    const fileName = prompt('Enter file name (with .md extension):')
    if (!fileName) return

    const normalizedName = fileName.endsWith('.md') ? fileName : `${fileName}.md`
    const filePath = pathUtils.join(vaultPath, normalizedName)

    try {
      await window.electronAPI.createFile(filePath)
      await loadFiles()
    } catch (error) {
      alert(`Failed to create file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleDeleteFile = async (filePath: string) => {
    if (!confirm(`Are you sure you want to delete ${pathUtils.basename(filePath)}?`)) return

    try {
      await window.electronAPI.deleteFile(filePath)
      await loadFiles()
    } catch (error) {
      alert(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const startRename = (filePath: string) => {
    setEditingFile(filePath)
    setEditingValue(pathUtils.basename(filePath, '.md'))
  }

  const handleRename = async () => {
    if (!editingFile || !vaultPath) return

    const newName = editingValue.endsWith('.md') ? editingValue : `${editingValue}.md`
    const newPath = pathUtils.join(pathUtils.dirname(editingFile), newName)

    if (newPath === editingFile) {
      setEditingFile(null)
      return
    }

    try {
      await window.electronAPI.renameFile(editingFile, newPath)
      await loadFiles()
    } catch (error) {
      alert(`Failed to rename file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setEditingFile(null)
      setEditingValue('')
    }
  }

  const cancelRename = () => {
    setEditingFile(null)
    setEditingValue('')
  }

  const toggleDirectory = (dirPath: string) => {
    const newExpanded = new Set(expandedDirs)
    if (newExpanded.has(dirPath)) {
      newExpanded.delete(dirPath)
    } else {
      newExpanded.add(dirPath)
    }
    setExpandedDirs(newExpanded)
  }

  const renderNode = (node: FileNode, depth: number = 0): JSX.Element => {
    const isExpanded = expandedDirs.has(node.path)
    const isEditing = editingFile === node.path

    return (
      <div key={node.path}>
        <div
          style={{
            paddingLeft: `${depth * 16}px`,
            display: 'flex',
            alignItems: 'center',
            padding: '4px 8px',
            cursor: 'pointer',
            borderRadius: '4px',
            minHeight: '28px'
          }}
          className="hover:bg-gray-100"
        >
          {node.isDirectory && (
            <span
              onClick={() => toggleDirectory(node.path)}
              style={{ marginRight: '4px', fontSize: '12px' }}
            >
              {isExpanded ? '▼' : '▶'}
            </span>
          )}
          
          {isEditing ? (
            <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <input
                type="text"
                value={editingValue}
                onChange={(e) => setEditingValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRename()
                  if (e.key === 'Escape') cancelRename()
                }}
                onBlur={handleRename}
                style={{
                  flex: 1,
                  padding: '2px 4px',
                  border: '1px solid #ccc',
                  borderRadius: '2px',
                  fontSize: '14px'
                }}
                autoFocus
              />
            </div>
          ) : (
            <>
              <span
                onClick={() => {
                  if (node.isDirectory) {
                    toggleDirectory(node.path)
                  } else {
                    handleFileClick(node.path)
                  }
                }}
                style={{
                  flex: 1,
                  fontSize: '14px',
                  color: node.isDirectory ? '#666' : '#333'
                }}
              >
                {node.isDirectory ? '📁' : '📄'} {node.name}
              </span>
              
              {!node.isDirectory && (
                <div style={{ marginLeft: '8px', display: 'flex', gap: '4px' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      startRename(node.path)
                    }}
                    style={{
                      padding: '2px 4px',
                      fontSize: '12px',
                      border: 'none',
                      backgroundColor: 'transparent',
                      cursor: 'pointer',
                      borderRadius: '2px'
                    }}
                    className="hover:bg-gray-200"
                    title="Rename"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteFile(node.path)
                    }}
                    style={{
                      padding: '2px 4px',
                      fontSize: '12px',
                      border: 'none',
                      backgroundColor: 'transparent',
                      cursor: 'pointer',
                      borderRadius: '2px'
                    }}
                    className="hover:bg-red-100"
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              )}
            </>
          )}
        </div>
        
        {node.isDirectory && isExpanded && node.children && (
          <div>
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  if (!vaultPath) {
    return (
      <div className={`file-tree ${className}`} style={{ padding: '16px' }}>
        <p style={{ color: '#666', fontSize: '14px' }}>No vault selected</p>
      </div>
    )
  }

  const fileTree = buildFileTree(filteredFiles)

  return (
    <div className={`file-tree ${className}`} style={{ padding: '8px', height: '100%', overflow: 'auto' }}>
      <div style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <input
            type="text"
            placeholder="Search files..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              flex: 1,
              padding: '6px 8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '14px'
            }}
          />
          <button
            onClick={handleCreateFile}
            style={{
              padding: '6px 12px',
              backgroundColor: '#007acc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
            className="hover:bg-blue-600"
            title="Create new file"
          >
            ➕
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ color: '#666', fontSize: '14px' }}>Loading files...</div>
      ) : (
        <div>
          {fileTree.map(node => renderNode(node))}
          {filteredFiles.length === 0 && searchTerm && (
            <div style={{ color: '#666', fontSize: '14px', textAlign: 'center', marginTop: '20px' }}>
              No files match your search
            </div>
          )}
        </div>
      )}
    </div>
  )
}
