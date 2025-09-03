import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useCallback } from 'react';
import { FileTree } from './components/FileTree';
import { Editor } from './components/Editor';
import { BacklinksPanel } from './components/BacklinksPanel';
/**
 * Main application component that orchestrates the file tree and editor.
 *
 * @returns JSX.Element
 */
export function App() {
    const [vaultPath, setVaultPath] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [editorContent, setEditorContent] = useState('');
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const handleOpenVault = useCallback(async () => {
        try {
            const selectedVault = await window.electronAPI.openVault();
            if (selectedVault) {
                setVaultPath(selectedVault);
                setSelectedFile(null); // Clear selected file when changing vault
            }
        }
        catch (error) {
            console.error('Failed to open vault:', error);
            alert(`Failed to open vault: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }, []);
    const handleCreateVault = useCallback(async () => {
        try {
            const newVault = await window.electronAPI.createVault();
            if (newVault) {
                setVaultPath(newVault);
                setSelectedFile(null); // Clear selected file when changing vault
            }
        }
        catch (error) {
            console.error('Failed to create vault:', error);
            alert(`Failed to create vault: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }, []);
    const handleFileSelect = useCallback((filePath) => {
        if (hasUnsavedChanges) {
            const userChoice = confirm('You have unsaved changes. Are you sure you want to open another file? Your changes will be lost.');
            if (!userChoice)
                return;
        }
        setSelectedFile(filePath);
        setHasUnsavedChanges(false);
    }, [hasUnsavedChanges]);
    const handleEditorContentChange = useCallback((content, hasChanges) => {
        setEditorContent(content);
        setHasUnsavedChanges(hasChanges);
    }, []);
    const handleEditorSave = useCallback((content) => {
        setEditorContent(content);
        setHasUnsavedChanges(false);
    }, []);
    return (_jsxs("div", { style: {
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }, children: [_jsxs("header", { style: {
                    padding: '12px 16px',
                    backgroundColor: '#2c3e50',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid #34495e'
                }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '16px' }, children: [_jsx("h1", { style: {
                                    margin: 0,
                                    fontSize: '18px',
                                    fontWeight: 600
                                }, children: "ConeEditor" }), vaultPath && (_jsxs("span", { style: {
                                    fontSize: '14px',
                                    color: '#bdc3c7',
                                    maxWidth: '300px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                }, children: ["\uD83D\uDCC1 ", vaultPath] }))] }), _jsxs("div", { style: { display: 'flex', gap: '12px' }, children: [_jsx("button", { onClick: handleOpenVault, style: {
                                    padding: '8px 16px',
                                    backgroundColor: '#3498db',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: 500
                                }, className: "hover:bg-blue-600", children: vaultPath ? 'Open Vault' : 'Open Vault' }), !vaultPath && (_jsx("button", { onClick: handleCreateVault, style: {
                                    padding: '8px 16px',
                                    backgroundColor: '#27ae60',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: 500
                                }, className: "hover:bg-green-600", children: "Create New Vault" })), hasUnsavedChanges && (_jsxs("div", { style: {
                                    padding: '8px 12px',
                                    backgroundColor: '#e67e22',
                                    color: 'white',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }, children: [_jsx("span", { children: "\u25CF" }), _jsx("span", { children: "Unsaved changes" })] }))] })] }), _jsx("div", { style: {
                    flex: 1,
                    display: 'flex',
                    overflow: 'hidden'
                }, children: vaultPath ? (_jsxs(_Fragment, { children: [_jsxs("div", { style: {
                                width: '300px',
                                backgroundColor: '#f8f9fa',
                                borderRight: '1px solid #e9ecef',
                                display: 'flex',
                                flexDirection: 'column'
                            }, children: [_jsx("div", { style: {
                                        padding: '12px 16px',
                                        backgroundColor: '#e9ecef',
                                        borderBottom: '1px solid #dee2e6',
                                        fontSize: '14px',
                                        fontWeight: 600,
                                        color: '#495057'
                                    }, children: "Files" }), _jsx(FileTree, { vaultPath: vaultPath, onFileSelect: handleFileSelect, className: "flex-1" })] }), _jsx("div", { style: {
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'column'
                            }, children: _jsx(Editor, { filePath: selectedFile, vaultPath: vaultPath, onSave: handleEditorSave, onContentChange: handleEditorContentChange, className: "flex-1" }) }), _jsx("div", { style: {
                                width: '300px',
                                backgroundColor: '#f8f9fa',
                                borderLeft: '1px solid #e9ecef'
                            }, children: _jsx(BacklinksPanel, { currentFilePath: selectedFile, vaultPath: vaultPath, onNavigateToNote: handleFileSelect, className: "h-full" }) })] })) : (
                /* Welcome screen */
                _jsx("div", { style: {
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#f8f9fa'
                    }, children: _jsxs("div", { style: {
                            textAlign: 'center',
                            maxWidth: '400px',
                            padding: '40px'
                        }, children: [_jsx("div", { style: {
                                    fontSize: '48px',
                                    marginBottom: '24px'
                                }, children: "\uD83D\uDCDD" }), _jsx("h2", { style: {
                                    fontSize: '24px',
                                    fontWeight: 600,
                                    color: '#2c3e50',
                                    marginBottom: '12px'
                                }, children: "Welcome to ConeEditor" }), _jsx("p", { style: {
                                    fontSize: '16px',
                                    color: '#7f8c8d',
                                    marginBottom: '32px',
                                    lineHeight: '1.5'
                                }, children: "A modern Markdown editor built with Electron, React, and CodeMirror. Get started by opening an existing vault or creating a new one." }), _jsxs("div", { style: { display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }, children: [_jsx("button", { onClick: handleOpenVault, style: {
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
                                        }, className: "hover:bg-blue-600", children: "\uD83D\uDCC1 Open Vault" }), _jsx("button", { onClick: handleCreateVault, style: {
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
                                        }, className: "hover:bg-green-600", children: "\u2795 Create New Vault" })] }), _jsxs("div", { style: {
                                    marginTop: '24px',
                                    fontSize: '14px',
                                    color: '#95a5a6'
                                }, children: [_jsx("p", { children: "Features:" }), _jsxs("ul", { style: {
                                            listStyle: 'none',
                                            padding: 0,
                                            margin: '8px 0',
                                            lineHeight: '1.6'
                                        }, children: [_jsx("li", { children: "\uD83D\uDCC1 Open existing vaults or create new ones" }), _jsx("li", { children: "\uD83C\uDF33 File tree with search and management" }), _jsx("li", { children: "\u270F\uFE0F CodeMirror 6 with Markdown support" }), _jsx("li", { children: "\uD83D\uDCBE Auto-save with debounce (1.2s)" }), _jsx("li", { children: "\uD83D\uDD0D Real-time file watching" }), _jsx("li", { children: "\u2328\uFE0F Keyboard shortcuts (Ctrl/Cmd+S)" })] })] })] }) })) }), _jsxs("footer", { style: {
                    padding: '6px 16px',
                    backgroundColor: '#34495e',
                    color: '#bdc3c7',
                    fontSize: '12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderTop: '1px solid #2c3e50'
                }, children: [_jsx("div", { children: selectedFile ? (_jsxs("span", { children: ["\uD83D\uDCC4 ", selectedFile.split('/').pop(), hasUnsavedChanges && ' (modified)'] })) : (_jsx("span", { children: "Ready" })) }), _jsxs("div", { style: { display: 'flex', gap: '16px' }, children: [vaultPath && (_jsxs("span", { children: ["Vault: ", vaultPath.split('/').pop()] })), _jsx("span", { children: "ConeEditor v0.0.1" })] })] })] }));
}
