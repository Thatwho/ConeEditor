# ConeNote — Electron + React 最小可运行 Demo 代码骨架

下面是一个**最小可运行的 Electron + React（Vite）Demo 代码骨架**，包含：

* 项目文件树
* Electron 主进程（`main.js`）、预加载脚本（`preload.js`）
* Renderer（React + Vite）示例，内含 CodeMirror 编辑器和 Cytoscape 关系图组件
* 启动本地 Python 语义引擎的示例（`python/server.py`，FastAPI stub）
* README（运行说明）

> 你可以将下列文件逐个创建到本地，然后按照 README 执行。文件内容都以代码块给出，直接拷贝粘贴即可。

---

## 项目结构（建议）

```
ConeNote/
├── package.json            # root: electron 启动脚本 & helper
├── main.js                 # electron 主进程
├── preload.js              # electron preload，暴露有限 API
├── python/
│   ├── server.py           # FastAPI stub
│   └── requirements.txt
└── renderer/               # React (Vite) 前端
    ├── package.json
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── components/
        │   ├── Editor.jsx
        │   └── CytoscapeGraph.jsx
        └── styles.css
```

---

## 1) 根目录：`package.json`

```json
{
  "name": "ConeNote",
  "version": "0.1.0",
  "main": "main.js",
  "private": true,
  "scripts": {
    "postinstall": "cd renderer && npm install",
    "dev": "concurrently \"npm:dev:renderer\" \"wait-on http://localhost:5173 && electron .\"",
    "dev:renderer": "cd renderer && npm run dev",
    "start": "electron .",
    "build": "cd renderer && npm run build"
  },
  "dependencies": {
    "chokidar": "^3.5.3"
  },
  "devDependencies": {
    "electron": "^26.0.0",
    "concurrently": "^7.6.0",
    "wait-on": "^7.0.1"
  }
}
```

> 说明：`postinstall` 用于自动安装 renderer 依赖；`dev` 使用 `concurrently` 与 `wait-on` 组合在本地开发时先启动 Vite，再打开 Electron 指向 dev server。

---

## 2) Electron 主进程：`main.js`

```js
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow = null;
let pythonProc = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  const devUrl = 'http://localhost:5173';
  // 在生产时你会 loadFile 打包后的 index.html
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startPythonServer() {
  if (pythonProc) return;

  const PY = process.env.PYTHON || 'python';
  const script = path.join(__dirname, 'python', 'server.py');

  pythonProc = spawn(PY, [script], { stdio: ['ignore', 'pipe', 'pipe'] });

  pythonProc.stdout.on('data', data => {
    console.log('[py]', data.toString());
  });
  pythonProc.stderr.on('data', data => {
    console.error('[py err]', data.toString());
  });
  pythonProc.on('exit', (code) => {
    console.log('python exited', code);
    pythonProc = null;
    if (mainWindow) mainWindow.webContents.send('python-exited', { code });
  });
}

function stopPythonServer() {
  if (!pythonProc) return;
  pythonProc.kill();
  pythonProc = null;
}

app.whenReady().then(() => {
  createWindow();
  startPythonServer();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  stopPythonServer();
  if (process.platform !== 'darwin') app.quit();
});

// 简单的 IPC 示例：renderer 可以请求打开文件对话框
ipcMain.handle('dialog:openFile', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openFile'] });
  if (canceled) return null;
  return filePaths[0];
});

ipcMain.handle('python:health', async () => {
  // 可扩展：发 HTTP 请求到 127.0.0.1:8000/health
  const http = require('http');
  const options = { hostname: '127.0.0.1', port: 8000, path: '/health', method: 'GET', timeout: 1000 };
  return new Promise((resolve) => {
    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve({ ok: false }); }
      });
    });
    req.on('error', () => resolve({ ok: false }));
    req.end();
  });
});
```

---

## 3) Preload（`preload.js`）

```js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  pythonHealth: () => ipcRenderer.invoke('python:health'),
  onPythonExited: (cb) => ipcRenderer.on('python-exited', (_, arg) => cb(arg)),
});
```

> 说明：这里仅暴露有限的方法给渲染进程，避免不安全的 nodeIntegration。

---

## 4) Renderer（React + Vite）

### `renderer/package.json`

```json
{
  "name": "renderer",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "axios": "^1.4.0",
    "cytoscape": "^3.27.2",
    "@uiw/react-codemirror": "^4.3.0",
    "@codemirror/lang-markdown": "^0.19.0"
  },
  "devDependencies": {
    "vite": "^5.0.0"
  }
}
```

---

### `renderer/index.html`

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ConeNote</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

---

### `renderer/src/main.jsx`

```jsx
import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

createRoot(document.getElementById('root')).render(<App />)
```

---

### `renderer/src/App.jsx`

```jsx
import React, { useEffect, useState } from 'react'
import Editor from './components/Editor'
import CytoscapeGraph from './components/CytoscapeGraph'

export default function App() {
  const [health, setHealth] = useState(null)

  useEffect(() => {
    async function check() {
      if (window.electronAPI && window.electronAPI.pythonHealth) {
        const res = await window.electronAPI.pythonHealth()
        setHealth(res)
      }
    }
    check()
  }, [])

  return (
    <div className="app-root">
      <aside className="left-panel">
        <Editor />
      </aside>
      <main className="main-panel">
        <div className="toolbar">Python: {health ? JSON.stringify(health) : 'unknown'}</div>
        <CytoscapeGraph />
      </main>
    </div>
  )
}
```

---

### `renderer/src/components/Editor.jsx`（CodeMirror 的最小集成）

```jsx
import React, { useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'

export default function Editor(){
  const [value, setValue] = useState('# Hello\n\nThis is a demo note.')

  return (
    <div style={{height: '100%', padding: 8}}>
      <CodeMirror
        value={value}
        height="100%"
        extensions={[markdown()]}
        onChange={(v) => setValue(v)}
      />
    </div>
  )
}
```

---

### `renderer/src/components/CytoscapeGraph.jsx`（最小关系图）

```jsx
import React, { useEffect, useRef } from 'react'
import cytoscape from 'cytoscape'

export default function CytoscapeGraph(){
  const ref = useRef(null)
  const cyRef = useRef(null)

  useEffect(() => {
    if (!ref.current) return
    cyRef.current = cytoscape({
      container: ref.current,
      elements: [
        { data: { id: 'a', label: 'Note A' } },
        { data: { id: 'b', label: 'Note B' } },
        { data: { id: 'ab', source: 'a', target: 'b' } }
      ],
      style: [
        { selector: 'node', style: { 'label': 'data(label)', 'text-valign': 'center', 'background-color': '#1976d2', 'color': '#fff' } },
        { selector: 'edge', style: { 'width': 2, 'line-color': '#ccc' } }
      ],
      layout: { name: 'dagre' }
    })

    return () => { cyRef.current && cyRef.current.destroy() }
  }, [])

  return <div ref={ref} style={{width: '100%', height: '100%'}} />
}
```

> 注意：上例使用了 `dagre` 布局名，但没有安装 dagre 扩展。如果要更好布局，请安装 `cytoscape-dagre` 并在组件中注册。

---

### `renderer/src/styles.css`

```css
html,body,#root { height: 100%; margin: 0; }
.app-root { display: flex; height: 100vh; }
.left-panel { width: 38%; border-right: 1px solid #eee; }
.main-panel { flex: 1; display: flex; flex-direction: column; }
.toolbar { padding: 8px; border-bottom: 1px solid #eee }
```

---

## 5) Python FastAPI stub (`python/server.py`)

```python
from fastapi import FastAPI
from pydantic import BaseModel
from typing import Any

app = FastAPI()

@app.get('/health')
def health():
    return {"status": "ok", "model_loaded": False}

class IndexReq(BaseModel):
    path: str
    content: str

@app.post('/index')
def index(req: IndexReq):
    # 这里仅做 stub：实际会做 chunk -> embed -> 存向量库
    return {"indexed_chunks": 1}

@app.post('/search')
def search(body: dict):
    q = body.get('q', '')
    # stub 返回一个示例
    return {"results": [{"note_id": "demo.md", "score": 0.95, "snippet": "示例匹配片段"}]}

if __name__ == '__main__':
    import uvicorn
    uvicorn.run('server:app', host='127.0.0.1', port=8000, reload=False)
```

### `python/requirements.txt`

```
fastapi
uvicorn
```

> 真实项目中你会把 sentence-transformers、chromadb、lancedb 等依赖加入到 requirements 并在 server 中初始化模型/向量库。

---

## 6) README（快速上手）

```
# 开发依赖
- Node (>=18)
- Python (>=3.9) for local semantic stub

# 安装
1. 在根目录运行 `npm install`（会触发 renderer 子目录安装）
2. 进入 python 文件夹并安装： `pip install -r python/requirements.txt` 或使用虚拟环境

# 本地开发
- 启动开发模式（会同时启动 Vite dev server 与 Electron）：
  npm run dev

# 或者手动分两步：
1) 在根目录 `npm run dev:renderer`（或进入 renderer 并运行 `npm run dev`）
2) 另开一个终端运行 `npm start` 启动 Electron

# 打包（简要）
- 先打包 renderer（`cd renderer && npm run build`），再使用 electron-builder / electron-forge 打包主进程（此处未提供完整打包脚本）。

```

## 7) 后续可扩展提示（实现要点）

* **文件监听**：在主进程用 `chokidar` 监听 Vault（笔记目录），变更时通知 renderer 或直接调用 Python 索引接口 `POST /index`。
* **IPC 设计**：仅暴露必要 API（打开文件、python health、触发索引、获取关系图数据）。避免把 nodeIntegration 打开。
* **Python 子进程**：生产环境建议把 Python 打包成可执行（PyInstaller）并签名；Electron 启动时 spawn 可执行文件并监控其 stdout/stderr。
* **向量化**：在 Python 侧实现 chunk -> embed -> store（Chroma / Lance / Milvus），并确保索引存在时返回 `chunk_id -> note_id` 供前端聚合显示。
