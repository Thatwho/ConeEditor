import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState, useCallback } from 'react';
import { EditorView, keymap } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { defaultKeymap, indentWithTab } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { search, searchKeymap } from '@codemirror/search';
import { autocompletion } from '@codemirror/autocomplete';
import { lintKeymap } from '@codemirror/lint';
/**
 * CodeMirror-based Markdown editor with auto-save and syntax highlighting.
 *
 * @param props - Component props
 * @returns JSX.Element
 */
export function Editor({ filePath, vaultPath, onSave, onContentChange, className = '' }) {
    const editorRef = useRef(null);
    const viewRef = useRef(null);
    const [content, setContent] = useState('');
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState(null);
    const debounceTimeoutRef = useRef(null);
    const fileStatsRef = useRef(null);
    // Load file content
    const loadFile = useCallback(async () => {
        if (!filePath) {
            setContent('');
            return;
        }
        try {
            const fileContent = await window.electronAPI.readFile(filePath);
            setContent(fileContent);
            setHasUnsavedChanges(false);
            setLastSaved(new Date());
            // Update editor content if view exists
            if (viewRef.current) {
                const transaction = viewRef.current.state.update({
                    changes: {
                        from: 0,
                        to: viewRef.current.state.doc.length,
                        insert: fileContent
                    }
                });
                viewRef.current.dispatch(transaction);
            }
        }
        catch (error) {
            console.error('Failed to load file:', error);
            alert(`Failed to load file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }, [filePath]);
    // Save file content
    const saveFile = useCallback(async (contentToSave) => {
        if (!filePath)
            return;
        const saveContent = contentToSave ?? viewRef.current?.state.doc.toString() ?? content;
        setIsSaving(true);
        try {
            await window.electronAPI.writeFile(filePath, saveContent);
            setHasUnsavedChanges(false);
            setLastSaved(new Date());
            onSave?.(saveContent);
            // Index locally in SQLite (TS-only during Sprints 0-3)
            try {
                const indexResult = await window.electronAPI.indexNoteLocal(filePath);
                console.log('Note indexed successfully:', indexResult);
            }
            catch (error) {
                console.warn('Failed to index note locally:', error);
            }
        }
        catch (error) {
            console.error('Failed to save file:', error);
            alert(`Failed to save file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        finally {
            setIsSaving(false);
        }
    }, [filePath, content, onSave]);
    // Debounced auto-save
    const debouncedSave = useCallback((content) => {
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }
        debounceTimeoutRef.current = setTimeout(() => {
            saveFile(content);
        }, 1200); // 1200ms delay as specified
    }, [saveFile]);
    // Handle content changes
    const handleContentChange = useCallback((newContent) => {
        setContent(newContent);
        setHasUnsavedChanges(true);
        onContentChange?.(newContent, true);
        debouncedSave(newContent);
    }, [onContentChange, debouncedSave]);
    // Manual save with Ctrl/Cmd+S
    const handleManualSave = useCallback(() => {
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
            debounceTimeoutRef.current = null;
        }
        saveFile();
    }, [saveFile]);
    // Initialize CodeMirror when a file is selected and the container is mounted
    useEffect(() => {
        if (!editorRef.current || viewRef.current)
            return;
        const saveKeymap = keymap.of([
            {
                key: 'Mod-s',
                preventDefault: true,
                run: () => {
                    handleManualSave();
                    return true;
                }
            }
        ]);
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
                        const newContent = update.state.doc.toString();
                        handleContentChange(newContent);
                    }
                })
            ]
        });
        const view = new EditorView({
            state,
            parent: editorRef.current
        });
        viewRef.current = view;
        return () => {
            view.destroy();
            viewRef.current = null;
        };
    }, [filePath]);
    // Load file when filePath changes
    useEffect(() => {
        loadFile();
    }, [loadFile]);
    // Set up file change listener
    useEffect(() => {
        if (!filePath)
            return;
        const unsubscribe = window.electronAPI.onFileChanged((event) => {
            if (event.path === filePath) {
                // Check if we have unsaved changes
                if (hasUnsavedChanges) {
                    const userChoice = confirm(`The file "${filePath}" has been modified externally. You have unsaved changes. ` +
                        'Do you want to reload the file? (Your changes will be lost)');
                    if (userChoice) {
                        loadFile();
                    }
                }
                else {
                    // Auto-reload if no unsaved changes
                    loadFile();
                }
            }
        });
        return unsubscribe;
    }, [filePath, hasUnsavedChanges, loadFile]);
    // Cleanup debounce on unmount
    useEffect(() => {
        return () => {
            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
            }
        };
    }, []);
    // Handle keyboard shortcuts globally
    useEffect(() => {
        const handleGlobalKeydown = (event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 's') {
                event.preventDefault();
                handleManualSave();
            }
        };
        document.addEventListener('keydown', handleGlobalKeydown);
        return () => document.removeEventListener('keydown', handleGlobalKeydown);
    }, [handleManualSave]);
    if (!filePath) {
        return (_jsx("div", { className: `editor ${className}`, style: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                backgroundColor: '#fafafa',
                color: '#666'
            }, children: _jsxs("div", { style: { textAlign: 'center' }, children: [_jsx("h3", { style: { margin: '0 0 8px 0', fontSize: '18px' }, children: "No file selected" }), _jsx("p", { style: { margin: 0, fontSize: '14px' }, children: "Choose a file from the sidebar to start editing" })] }) }));
    }
    return (_jsxs("div", { className: `editor ${className}`, style: { height: '100%', display: 'flex', flexDirection: 'column' }, children: [_jsxs("div", { style: {
                    padding: '8px 16px',
                    backgroundColor: '#f5f5f5',
                    borderBottom: '1px solid #ddd',
                    fontSize: '12px',
                    color: '#666',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }, children: [_jsxs("div", { children: [_jsx("span", { style: { fontWeight: 'bold' }, children: filePath.split('/').pop() }), hasUnsavedChanges && _jsx("span", { style: { color: '#ff6b00', marginLeft: '8px' }, children: "\u25CF Unsaved" }), isSaving && _jsx("span", { style: { color: '#007acc', marginLeft: '8px' }, children: "Saving..." })] }), _jsxs("div", { style: { display: 'flex', gap: '16px' }, children: [lastSaved && (_jsxs("span", { children: ["Last saved: ", lastSaved.toLocaleTimeString()] })), _jsx("button", { onClick: handleManualSave, disabled: isSaving || !hasUnsavedChanges, style: {
                                    padding: '4px 8px',
                                    fontSize: '12px',
                                    border: '1px solid #ccc',
                                    borderRadius: '3px',
                                    backgroundColor: hasUnsavedChanges ? '#007acc' : '#f0f0f0',
                                    color: hasUnsavedChanges ? 'white' : '#666',
                                    cursor: hasUnsavedChanges ? 'pointer' : 'not-allowed'
                                }, children: "Save (Ctrl+S)" })] })] }), _jsx("div", { ref: editorRef, style: {
                    flex: 1,
                    overflow: 'hidden',
                    backgroundColor: 'white'
                } })] }));
}
