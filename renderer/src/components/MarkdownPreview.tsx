import React, { useMemo } from 'react'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import remarkWikilink, { extractWikilinks } from '../lib/remark-wikilink'

interface MarkdownPreviewProps {
  content: string
  onWikilinkClick?: (target: string) => void
  className?: string
}

/**
 * MarkdownPreview component renders markdown content with wikilink support.
 * 
 * This component processes markdown text through the remark pipeline including
 * the custom wikilink plugin to render [[Target]] and [[Target|Alias]] links
 * as clickable elements.
 * 
 * @param props - Component props
 * @returns JSX.Element
 */
export function MarkdownPreview({ 
  content, 
  onWikilinkClick,
  className = '' 
}: MarkdownPreviewProps): JSX.Element {
  
  const { html, wikilinks } = useMemo(() => {
    try {
      // Process markdown with wikilink plugin
      const processor = unified()
        .use(remarkParse)
        .use(remarkWikilink)
        .use(remarkRehype, {
          handlers: {
            // Custom handler for wikilink nodes
            wikilink: (h, node: any) => {
              const target = node.data.target
              const alias = node.data.alias
              const displayText = alias || target
              
              return h(node, 'a', {
                'data-wikilink': target,
                href: '#',
                className: 'wikilink',
                onClick: (e: Event) => {
                  e.preventDefault()
                  onWikilinkClick?.(target)
                }
              }, displayText)
            }
          }
        })
        .use(rehypeStringify)
      
      const htmlResult = processor.processSync(content).toString()
      const wikilinkList = extractWikilinks(content)
      
      return { html: htmlResult, wikilinks: wikilinkList }
    } catch (error) {
      console.error('Error processing markdown:', error)
      return { html: `<pre>Error processing markdown: ${error}</pre>`, wikilinks: [] }
    }
  }, [content, onWikilinkClick])

  return (
    <div className={`markdown-preview ${className}`}>
      <div 
        style={{
          padding: '16px',
          lineHeight: '1.6',
          color: '#333'
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      
      {/* Debug info for development */}
      {process.env.NODE_ENV === 'development' && wikilinks.length > 0 && (
        <div style={{
          marginTop: '16px',
          padding: '12px',
          backgroundColor: '#f8f9fa',
          border: '1px solid #e9ecef',
          borderRadius: '4px',
          fontSize: '12px'
        }}>
          <strong>Detected Wikilinks:</strong>{' '}
          {wikilinks.join(', ')}
        </div>
      )}
      
      <style jsx>{`
        .markdown-preview :global(.wikilink) {
          color: #007acc;
          text-decoration: none;
          font-weight: 500;
          border-bottom: 1px dashed #007acc;
        }
        
        .markdown-preview :global(.wikilink:hover) {
          background-color: #e3f2fd;
          text-decoration: none;
        }
        
        .markdown-preview :global(h1) {
          font-size: 1.8em;
          margin: 1em 0 0.5em 0;
          color: #2c3e50;
        }
        
        .markdown-preview :global(h2) {
          font-size: 1.5em;
          margin: 1em 0 0.5em 0;
          color: #34495e;
        }
        
        .markdown-preview :global(h3) {
          font-size: 1.2em;
          margin: 1em 0 0.5em 0;
          color: #7f8c8d;
        }
        
        .markdown-preview :global(p) {
          margin: 0.8em 0;
        }
        
        .markdown-preview :global(ul, ol) {
          margin: 0.8em 0;
          padding-left: 2em;
        }
        
        .markdown-preview :global(blockquote) {
          margin: 1em 0;
          padding: 0.5em 1em;
          border-left: 4px solid #ddd;
          background-color: #f9f9f9;
          font-style: italic;
        }
        
        .markdown-preview :global(code) {
          background-color: #f1f3f4;
          padding: 2px 4px;
          border-radius: 3px;
          font-family: Monaco, Menlo, "Ubuntu Mono", monospace;
          font-size: 0.9em;
        }
        
        .markdown-preview :global(pre) {
          background-color: #f8f9fa;
          padding: 1em;
          border-radius: 4px;
          overflow-x: auto;
          border: 1px solid #e9ecef;
        }
        
        .markdown-preview :global(pre code) {
          background: none;
          padding: 0;
        }
      `}</style>
    </div>
  )
}
