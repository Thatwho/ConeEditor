import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
import { getNoteInfo, formatApiError } from '../lib/api';
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
export function BacklinksPanel({ currentFilePath, vaultPath, onNavigateToNote, className = '' }) {
    const [noteInfo, setNoteInfo] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const loadNoteInfo = useCallback(async (filePath) => {
        setLoading(true);
        setError(null);
        try {
            const info = await getNoteInfo(filePath, vaultPath || undefined);
            setNoteInfo(info);
        }
        catch (err) {
            console.error('Failed to load note info:', err);
            setError(formatApiError(err));
            setNoteInfo(null);
        }
        finally {
            setLoading(false);
        }
    }, [vaultPath]);
    useEffect(() => {
        if (currentFilePath) {
            loadNoteInfo(currentFilePath);
        }
        else {
            setNoteInfo(null);
            setError(null);
        }
    }, [currentFilePath, loadNoteInfo]);
    const handleBacklinkClick = useCallback((notePath) => {
        onNavigateToNote?.(notePath);
    }, [onNavigateToNote]);
    const formatDate = (dateString) => {
        try {
            return new Date(dateString).toLocaleString();
        }
        catch {
            return dateString;
        }
    };
    if (!currentFilePath) {
        return (_jsx("div", { className: `backlinks-panel ${className}`, style: {
                padding: '16px',
                backgroundColor: '#f8f9fa',
                height: '100%',
                borderLeft: '1px solid #e9ecef'
            }, children: _jsx("div", { style: {
                    color: '#666',
                    fontSize: '14px',
                    textAlign: 'center',
                    marginTop: '40px'
                }, children: "Select a note to view backlinks and metadata" }) }));
    }
    return (_jsxs("div", { className: `backlinks-panel ${className}`, style: {
            padding: '16px',
            backgroundColor: '#f8f9fa',
            height: '100%',
            borderLeft: '1px solid #e9ecef',
            overflow: 'auto'
        }, children: [_jsx("div", { style: {
                    fontSize: '16px',
                    fontWeight: 600,
                    marginBottom: '16px',
                    color: '#2c3e50',
                    borderBottom: '1px solid #e9ecef',
                    paddingBottom: '8px'
                }, children: "Note Information" }), loading && (_jsx("div", { style: {
                    color: '#666',
                    fontSize: '14px',
                    textAlign: 'center',
                    padding: '20px'
                }, children: "Loading note information..." })), error && (_jsxs("div", { style: {
                    color: '#e74c3c',
                    fontSize: '14px',
                    backgroundColor: '#fdf2f2',
                    padding: '12px',
                    borderRadius: '4px',
                    border: '1px solid #fecaca',
                    marginBottom: '16px'
                }, children: [_jsx("strong", { children: "Error:" }), " ", error] })), noteInfo && (_jsxs("div", { children: [_jsxs("div", { style: { marginBottom: '24px' }, children: [_jsx("h3", { style: {
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    margin: '0 0 12px 0',
                                    color: '#495057'
                                }, children: "Metadata" }), _jsxs("div", { style: { fontSize: '13px', color: '#666', lineHeight: '1.6' }, children: [_jsxs("div", { children: [_jsx("strong", { children: "Title:" }), " ", noteInfo.title] }), _jsxs("div", { children: [_jsx("strong", { children: "Words:" }), " ", noteInfo.word_count.toLocaleString()] }), _jsxs("div", { children: [_jsx("strong", { children: "Modified:" }), " ", formatDate(noteInfo.modified_at)] }), _jsxs("div", { children: [_jsx("strong", { children: "Created:" }), " ", formatDate(noteInfo.created_at)] })] })] }), noteInfo.headings.length > 0 && (_jsxs("div", { style: { marginBottom: '24px' }, children: [_jsxs("h3", { style: {
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    margin: '0 0 12px 0',
                                    color: '#495057'
                                }, children: ["Headings (", noteInfo.headings.length, ")"] }), _jsx("div", { style: { fontSize: '13px' }, children: noteInfo.headings.map((heading, index) => (_jsxs("div", { style: {
                                        paddingLeft: `${(heading.level - 1) * 12}px`,
                                        marginBottom: '4px',
                                        color: '#666'
                                    }, children: [_jsx("span", { style: { color: '#999' }, children: '#'.repeat(heading.level) }), ' ', heading.heading] }, index))) })] })), _jsxs("div", { children: [_jsxs("h3", { style: {
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    margin: '0 0 12px 0',
                                    color: '#495057'
                                }, children: ["Backlinks (", noteInfo.backlinks.length, ")"] }), noteInfo.backlinks.length === 0 ? (_jsx("div", { style: {
                                    color: '#999',
                                    fontSize: '13px',
                                    fontStyle: 'italic'
                                }, children: "No backlinks found. Notes that link to this one will appear here." })) : (_jsx("div", { children: noteInfo.backlinks.map((backlink, index) => (_jsxs("div", { style: {
                                        padding: '8px',
                                        backgroundColor: 'white',
                                        border: '1px solid #e9ecef',
                                        borderRadius: '4px',
                                        marginBottom: '8px',
                                        cursor: 'pointer'
                                    }, onMouseEnter: (e) => e.currentTarget.style.backgroundColor = '#f8f9fa', onMouseLeave: (e) => e.currentTarget.style.backgroundColor = 'white', onClick: () => handleBacklinkClick(backlink.src_path), children: [_jsx("div", { style: {
                                                fontSize: '13px',
                                                fontWeight: 500,
                                                color: '#2c3e50',
                                                marginBottom: '4px'
                                            }, children: backlink.src_title || backlink.src_path.split('/').pop() }), _jsxs("div", { style: {
                                                fontSize: '12px',
                                                color: '#666',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center'
                                            }, children: [_jsxs("span", { children: ["\"", backlink.link_text, "\""] }), backlink.occurrences > 1 && (_jsxs("span", { style: {
                                                        backgroundColor: '#e3f2fd',
                                                        color: '#1976d2',
                                                        padding: '2px 6px',
                                                        borderRadius: '10px',
                                                        fontSize: '11px'
                                                    }, children: [backlink.occurrences, "\u00D7"] }))] })] }, index))) }))] })] }))] }));
}
