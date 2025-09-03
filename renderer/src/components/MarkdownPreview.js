import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useEffect, useRef } from 'react';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import rehypeSanitize from 'rehype-sanitize';
import remarkWikilink, { extractWikilinks } from '../lib/remark-wikilink';
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
export function MarkdownPreview({ content, onWikilinkClick, className = '' }) {
    const containerRef = useRef(null);
    const { html, wikilinks } = useMemo(() => {
        try {
            // Process markdown with wikilink plugin
            const processor = unified()
                .use(remarkParse)
                .use(remarkWikilink)
                .use(remarkRehype)
                .use(rehypeSanitize)
                .use(rehypeStringify);
            const htmlResult = processor.processSync(content).toString();
            const wikilinkList = extractWikilinks(content);
            return { html: htmlResult, wikilinks: wikilinkList };
        }
        catch (error) {
            console.error('Error processing markdown:', error);
            return { html: `<pre>Error processing markdown: ${error}</pre>`, wikilinks: [] };
        }
    }, [content]);
    // Event delegation for wikilink clicks
    useEffect(() => {
        const container = containerRef.current;
        if (!container || !onWikilinkClick)
            return;
        const handleClick = (event) => {
            const target = event.target;
            if (target.tagName === 'A' && target.hasAttribute('data-wikilink')) {
                event.preventDefault();
                const wikilinkTarget = target.getAttribute('data-wikilink');
                if (wikilinkTarget) {
                    onWikilinkClick(wikilinkTarget);
                }
            }
        };
        container.addEventListener('click', handleClick);
        return () => container.removeEventListener('click', handleClick);
    }, [onWikilinkClick]);
    return (_jsxs("div", { className: `markdown-preview ${className}`, children: [_jsx("div", { ref: containerRef, style: {
                    padding: '16px',
                    lineHeight: '1.6',
                    color: '#333'
                }, dangerouslySetInnerHTML: { __html: html } }), process.env.NODE_ENV === 'development' && wikilinks.length > 0 && (_jsxs("div", { style: {
                    marginTop: '16px',
                    padding: '12px',
                    backgroundColor: '#f8f9fa',
                    border: '1px solid #e9ecef',
                    borderRadius: '4px',
                    fontSize: '12px'
                }, children: [_jsx("strong", { children: "Detected Wikilinks:" }), ' ', wikilinks.join(', ')] })), _jsx("style", { children: `
        .markdown-preview a[data-wikilink] {
          color: #007acc;
          text-decoration: none;
          font-weight: 500;
          border-bottom: 1px dashed #007acc;
        }
        
        .markdown-preview a[data-wikilink]:hover {
          background-color: #e3f2fd;
          text-decoration: none;
        }
        
        .markdown-preview h1 {
          font-size: 1.8em;
          margin: 1em 0 0.5em 0;
          color: #2c3e50;
        }
        
        .markdown-preview h2 {
          font-size: 1.5em;
          margin: 1em 0 0.5em 0;
          color: #34495e;
        }
        
        .markdown-preview h3 {
          font-size: 1.2em;
          margin: 1em 0 0.5em 0;
          color: #7f8c8d;
        }
        
        .markdown-preview p {
          margin: 0.8em 0;
        }
        
        .markdown-preview ul, .markdown-preview ol {
          margin: 0.8em 0;
          padding-left: 2em;
        }
        
        .markdown-preview blockquote {
          margin: 1em 0;
          padding: 0.5em 1em;
          border-left: 4px solid #ddd;
          background-color: #f9f9f9;
          font-style: italic;
        }
        
        .markdown-preview code {
          background-color: #f1f3f4;
          padding: 2px 4px;
          border-radius: 3px;
          font-family: Monaco, Menlo, "Ubuntu Mono", monospace;
          font-size: 0.9em;
        }
        
        .markdown-preview pre {
          background-color: #f8f9fa;
          padding: 1em;
          border-radius: 4px;
          overflow-x: auto;
          border: 1px solid #e9ecef;
        }
        
        .markdown-preview pre code {
          background: none;
          padding: 0;
        }
      ` })] }));
}
