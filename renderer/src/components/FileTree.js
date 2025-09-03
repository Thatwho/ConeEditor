import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
// Browser-compatible path utilities
const pathUtils = {
    basename: (filePath, ext) => {
        const name = filePath.split('/').pop() || '';
        return ext ? name.replace(new RegExp(`\\${ext}$`), '') : name;
    },
    dirname: (filePath) => {
        const parts = filePath.split('/');
        return parts.slice(0, -1).join('/');
    },
    join: (...paths) => {
        return paths.filter(Boolean).join('/').replace(/\/+/g, '/');
    },
    relative: (from, to) => {
        const fromParts = from.split('/');
        const toParts = to.split('/');
        // Find common base
        let commonLength = 0;
        for (let i = 0; i < Math.min(fromParts.length, toParts.length); i++) {
            if (fromParts[i] === toParts[i]) {
                commonLength++;
            }
            else {
                break;
            }
        }
        const relativeParts = toParts.slice(commonLength);
        return relativeParts.join('/');
    },
    sep: '/'
};
/**
 * FileTree component for displaying and managing markdown files in a vault.
 *
 * @param props - Component props
 * @returns JSX.Element
 */
export function FileTree({ vaultPath, onFileSelect, className = '' }) {
    const [files, setFiles] = useState([]);
    const [filteredFiles, setFilteredFiles] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [expandedDirs, setExpandedDirs] = useState(new Set());
    const [editingFile, setEditingFile] = useState(null);
    const [editingValue, setEditingValue] = useState('');
    // Load files when vault path changes
    const loadFiles = useCallback(async () => {
        if (!vaultPath) {
            setFiles([]);
            setFilteredFiles([]);
            return;
        }
        setLoading(true);
        try {
            const fileList = await window.electronAPI.getVaultFiles(vaultPath);
            setFiles(fileList);
            setFilteredFiles(fileList);
        }
        catch (error) {
            console.error('Failed to load files:', error);
            setFiles([]);
            setFilteredFiles([]);
        }
        finally {
            setLoading(false);
        }
    }, [vaultPath]);
    useEffect(() => {
        loadFiles();
    }, [loadFiles]);
    // Filter files based on search term
    useEffect(() => {
        if (!searchTerm.trim()) {
            setFilteredFiles(files);
        }
        else {
            const filtered = files.filter(file => pathUtils.basename(file).toLowerCase().includes(searchTerm.toLowerCase()));
            setFilteredFiles(filtered);
        }
    }, [files, searchTerm]);
    // Set up file change listeners
    useEffect(() => {
        const unsubscribeCreated = window.electronAPI.onFileCreated(() => {
            loadFiles();
        });
        const unsubscribeDeleted = window.electronAPI.onFileDeleted(() => {
            loadFiles();
        });
        return () => {
            unsubscribeCreated();
            unsubscribeDeleted();
        };
    }, [loadFiles]);
    // Build tree structure from flat file list
    const buildFileTree = (fileList) => {
        if (!vaultPath)
            return [];
        const tree = [];
        const nodeMap = new Map();
        // Add root node
        const rootNode = {
            name: pathUtils.basename(vaultPath),
            path: vaultPath,
            isDirectory: true,
            children: []
        };
        nodeMap.set(vaultPath, rootNode);
        tree.push(rootNode);
        fileList.forEach(filePath => {
            const relativePath = pathUtils.relative(vaultPath, filePath);
            const parts = relativePath.split(pathUtils.sep);
            let currentPath = vaultPath;
            // Create directory nodes
            for (let i = 0; i < parts.length - 1; i++) {
                const dirName = parts[i];
                const dirPath = pathUtils.join(currentPath, dirName);
                if (!nodeMap.has(dirPath)) {
                    const dirNode = {
                        name: dirName,
                        path: dirPath,
                        isDirectory: true,
                        children: []
                    };
                    nodeMap.set(dirPath, dirNode);
                    const parentNode = nodeMap.get(currentPath);
                    if (parentNode && parentNode.children) {
                        parentNode.children.push(dirNode);
                    }
                }
                currentPath = dirPath;
            }
            // Create file node
            const fileName = parts[parts.length - 1];
            const fileNode = {
                name: fileName,
                path: filePath,
                isDirectory: false
            };
            const parentNode = nodeMap.get(currentPath);
            if (parentNode && parentNode.children) {
                parentNode.children.push(fileNode);
            }
        });
        // Sort children
        const sortNodes = (nodes) => {
            nodes.sort((a, b) => {
                if (a.isDirectory && !b.isDirectory)
                    return -1;
                if (!a.isDirectory && b.isDirectory)
                    return 1;
                return a.name.localeCompare(b.name);
            });
            nodes.forEach(node => {
                if (node.children) {
                    sortNodes(node.children);
                }
            });
        };
        tree.forEach(node => {
            if (node.children) {
                sortNodes(node.children);
            }
        });
        return tree;
    };
    const handleFileClick = (filePath) => {
        if (editingFile)
            return;
        onFileSelect(filePath);
    };
    const handleCreateFile = async () => {
        if (!vaultPath)
            return;
        const fileName = prompt('Enter file name (with .md extension):');
        if (!fileName)
            return;
        const normalizedName = fileName.endsWith('.md') ? fileName : `${fileName}.md`;
        const filePath = pathUtils.join(vaultPath, normalizedName);
        try {
            await window.electronAPI.createFile(filePath);
            await loadFiles();
        }
        catch (error) {
            alert(`Failed to create file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };
    const handleDeleteFile = async (filePath) => {
        if (!confirm(`Are you sure you want to delete ${pathUtils.basename(filePath)}?`))
            return;
        try {
            await window.electronAPI.deleteFile(filePath);
            await loadFiles();
        }
        catch (error) {
            alert(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };
    const startRename = (filePath) => {
        setEditingFile(filePath);
        setEditingValue(pathUtils.basename(filePath, '.md'));
    };
    const handleRename = async () => {
        if (!editingFile || !vaultPath)
            return;
        const newName = editingValue.endsWith('.md') ? editingValue : `${editingValue}.md`;
        const newPath = pathUtils.join(pathUtils.dirname(editingFile), newName);
        if (newPath === editingFile) {
            setEditingFile(null);
            return;
        }
        try {
            await window.electronAPI.renameFile(editingFile, newPath);
            await loadFiles();
        }
        catch (error) {
            alert(`Failed to rename file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        finally {
            setEditingFile(null);
            setEditingValue('');
        }
    };
    const cancelRename = () => {
        setEditingFile(null);
        setEditingValue('');
    };
    const toggleDirectory = (dirPath) => {
        const newExpanded = new Set(expandedDirs);
        if (newExpanded.has(dirPath)) {
            newExpanded.delete(dirPath);
        }
        else {
            newExpanded.add(dirPath);
        }
        setExpandedDirs(newExpanded);
    };
    const renderNode = (node, depth = 0) => {
        const isExpanded = expandedDirs.has(node.path);
        const isEditing = editingFile === node.path;
        return (_jsxs("div", { children: [_jsxs("div", { style: {
                        paddingLeft: `${depth * 16}px`,
                        display: 'flex',
                        alignItems: 'center',
                        padding: '4px 8px',
                        cursor: 'pointer',
                        borderRadius: '4px',
                        minHeight: '28px'
                    }, className: "hover:bg-gray-100", children: [node.isDirectory && (_jsx("span", { onClick: () => toggleDirectory(node.path), style: { marginRight: '4px', fontSize: '12px' }, children: isExpanded ? '▼' : '▶' })), isEditing ? (_jsx("div", { style: { display: 'flex', alignItems: 'center', flex: 1 }, children: _jsx("input", { type: "text", value: editingValue, onChange: (e) => setEditingValue(e.target.value), onKeyDown: (e) => {
                                    if (e.key === 'Enter')
                                        handleRename();
                                    if (e.key === 'Escape')
                                        cancelRename();
                                }, onBlur: handleRename, style: {
                                    flex: 1,
                                    padding: '2px 4px',
                                    border: '1px solid #ccc',
                                    borderRadius: '2px',
                                    fontSize: '14px'
                                }, autoFocus: true }) })) : (_jsxs(_Fragment, { children: [_jsxs("span", { onClick: () => {
                                        if (node.isDirectory) {
                                            toggleDirectory(node.path);
                                        }
                                        else {
                                            handleFileClick(node.path);
                                        }
                                    }, style: {
                                        flex: 1,
                                        fontSize: '14px',
                                        color: node.isDirectory ? '#666' : '#333'
                                    }, children: [node.isDirectory ? '📁' : '📄', " ", node.name] }), !node.isDirectory && (_jsxs("div", { style: { marginLeft: '8px', display: 'flex', gap: '4px' }, children: [_jsx("button", { onClick: (e) => {
                                                e.stopPropagation();
                                                startRename(node.path);
                                            }, style: {
                                                padding: '2px 4px',
                                                fontSize: '12px',
                                                border: 'none',
                                                backgroundColor: 'transparent',
                                                cursor: 'pointer',
                                                borderRadius: '2px'
                                            }, className: "hover:bg-gray-200", title: "Rename", children: "\u270F\uFE0F" }), _jsx("button", { onClick: (e) => {
                                                e.stopPropagation();
                                                handleDeleteFile(node.path);
                                            }, style: {
                                                padding: '2px 4px',
                                                fontSize: '12px',
                                                border: 'none',
                                                backgroundColor: 'transparent',
                                                cursor: 'pointer',
                                                borderRadius: '2px'
                                            }, className: "hover:bg-red-100", title: "Delete", children: "\uD83D\uDDD1\uFE0F" })] }))] }))] }), node.isDirectory && isExpanded && node.children && (_jsx("div", { children: node.children.map(child => renderNode(child, depth + 1)) }))] }, node.path));
    };
    if (!vaultPath) {
        return (_jsx("div", { className: `file-tree ${className}`, style: { padding: '16px' }, children: _jsx("p", { style: { color: '#666', fontSize: '14px' }, children: "No vault selected" }) }));
    }
    const fileTree = buildFileTree(filteredFiles);
    return (_jsxs("div", { className: `file-tree ${className}`, style: { padding: '8px', height: '100%', overflow: 'auto' }, children: [_jsx("div", { style: { marginBottom: '12px' }, children: _jsxs("div", { style: { display: 'flex', gap: '8px', marginBottom: '8px' }, children: [_jsx("input", { type: "text", placeholder: "Search files...", value: searchTerm, onChange: (e) => setSearchTerm(e.target.value), style: {
                                flex: 1,
                                padding: '6px 8px',
                                border: '1px solid #ccc',
                                borderRadius: '4px',
                                fontSize: '14px'
                            } }), _jsx("button", { onClick: handleCreateFile, style: {
                                padding: '6px 12px',
                                backgroundColor: '#007acc',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '14px'
                            }, className: "hover:bg-blue-600", title: "Create new file", children: "\u2795" })] }) }), loading ? (_jsx("div", { style: { color: '#666', fontSize: '14px' }, children: "Loading files..." })) : (_jsxs("div", { children: [fileTree.map(node => renderNode(node)), filteredFiles.length === 0 && searchTerm && (_jsx("div", { style: { color: '#666', fontSize: '14px', textAlign: 'center', marginTop: '20px' }, children: "No files match your search" }))] }))] }));
}
