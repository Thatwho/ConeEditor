import React, { useState, useEffect, useCallback } from 'react'
import { getNoteInfo, formatApiError } from '../lib/api'
import type { NoteInfo } from '../lib/api'

interface BacklinksPanelProps {
  currentFilePath: string | null
  vaultPath?: string | null
  onNavigateToNote?: (notePath: string) => void
  className?: string
}

/**
 * BacklinksPanel component displays backlinks and related information for the current note.
 * 
 * Shows:
 * - Backlinks pointing to the current note
 * - Note metadata (word count, last modified)
 * - Headings structure
 * 
 * @param props - Component props
 * @returns JSX.Element
 */
export function BacklinksPanel({ 
  currentFilePath, 
  vaultPath,
  onNavigateToNote,
  className = '' 
}: BacklinksPanelProps): JSX.Element {
  const [noteInfo, setNoteInfo] = useState<NoteInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadNoteInfo = useCallback(async (filePath: string) => {
    setLoading(true)
    setError(null)
    
    try {
      const info = await getNoteInfo(filePath, vaultPath || undefined)
      setNoteInfo(info)
    } catch (err) {
      console.error('Failed to load note info:', err)
      setError(formatApiError(err))
      setNoteInfo(null)
    } finally {
      setLoading(false)
    }
  }, [vaultPath])

  useEffect(() => {
    if (currentFilePath) {
      loadNoteInfo(currentFilePath)
    } else {
      setNoteInfo(null)
      setError(null)
    }
  }, [currentFilePath, loadNoteInfo])

  const handleBacklinkClick = useCallback((notePath: string) => {
    onNavigateToNote?.(notePath)
  }, [onNavigateToNote])

  const formatDate = (dateString: string): string => {
    try {
      return new Date(dateString).toLocaleString()
    } catch {
      return dateString
    }
  }

  if (!currentFilePath) {
    return (
      <div className={`backlinks-panel ${className}`} style={{
        padding: '16px',
        backgroundColor: '#f8f9fa',
        height: '100%',
        borderLeft: '1px solid #e9ecef'
      }}>
        <div style={{
          color: '#666',
          fontSize: '14px',
          textAlign: 'center',
          marginTop: '40px'
        }}>
          Select a note to view backlinks and metadata
        </div>
      </div>
    )
  }

  return (
    <div className={`backlinks-panel ${className}`} style={{
      padding: '16px',
      backgroundColor: '#f8f9fa',
      height: '100%',
      borderLeft: '1px solid #e9ecef',
      overflow: 'auto'
    }}>
      <div style={{
        fontSize: '16px',
        fontWeight: 600,
        marginBottom: '16px',
        color: '#2c3e50',
        borderBottom: '1px solid #e9ecef',
        paddingBottom: '8px'
      }}>
        Note Information
      </div>

      {loading && (
        <div style={{
          color: '#666',
          fontSize: '14px',
          textAlign: 'center',
          padding: '20px'
        }}>
          Loading note information...
        </div>
      )}

      {error && (
        <div style={{
          color: '#e74c3c',
          fontSize: '14px',
          backgroundColor: '#fdf2f2',
          padding: '12px',
          borderRadius: '4px',
          border: '1px solid #fecaca',
          marginBottom: '16px'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {noteInfo && (
        <div>
          {/* Note Metadata */}
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{
              fontSize: '14px',
              fontWeight: 600,
              margin: '0 0 12px 0',
              color: '#495057'
            }}>
              Metadata
            </h3>
            
            <div style={{ fontSize: '13px', color: '#666', lineHeight: '1.6' }}>
              <div><strong>Title:</strong> {noteInfo.title}</div>
              <div><strong>Words:</strong> {noteInfo.word_count.toLocaleString()}</div>
              <div><strong>Modified:</strong> {formatDate(noteInfo.modified_at)}</div>
              <div><strong>Created:</strong> {formatDate(noteInfo.created_at)}</div>
            </div>
          </div>

          {/* Headings */}
          {noteInfo.headings.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{
                fontSize: '14px',
                fontWeight: 600,
                margin: '0 0 12px 0',
                color: '#495057'
              }}>
                Headings ({noteInfo.headings.length})
              </h3>
              
              <div style={{ fontSize: '13px' }}>
                {noteInfo.headings.map((heading, index) => (
                  <div
                    key={index}
                    style={{
                      paddingLeft: `${(heading.level - 1) * 12}px`,
                      marginBottom: '4px',
                      color: '#666'
                    }}
                  >
                    <span style={{ color: '#999' }}>
                      {'#'.repeat(heading.level)}
                    </span>
                    {' '}
                    {heading.heading}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Backlinks */}
          <div>
            <h3 style={{
              fontSize: '14px',
              fontWeight: 600,
              margin: '0 0 12px 0',
              color: '#495057'
            }}>
              Backlinks ({noteInfo.backlinks.length})
            </h3>
            
            {noteInfo.backlinks.length === 0 ? (
              <div style={{
                color: '#999',
                fontSize: '13px',
                fontStyle: 'italic'
              }}>
                No backlinks found. Notes that link to this one will appear here.
              </div>
            ) : (
              <div>
                {noteInfo.backlinks.map((backlink, index) => (
                  <div
                    key={index}
                    style={{
                      padding: '8px',
                      backgroundColor: 'white',
                      border: '1px solid #e9ecef',
                      borderRadius: '4px',
                      marginBottom: '8px',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                    onClick={() => handleBacklinkClick(backlink.src_path)}
                  >
                    <div style={{
                      fontSize: '13px',
                      fontWeight: 500,
                      color: '#2c3e50',
                      marginBottom: '4px'
                    }}>
                      {backlink.src_title || backlink.src_path.split('/').pop()}
                    </div>
                    
                    <div style={{
                      fontSize: '12px',
                      color: '#666',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <span>"{backlink.link_text}"</span>
                      {backlink.occurrences > 1 && (
                        <span style={{
                          backgroundColor: '#e3f2fd',
                          color: '#1976d2',
                          padding: '2px 6px',
                          borderRadius: '10px',
                          fontSize: '11px'
                        }}>
                          {backlink.occurrences}×
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
