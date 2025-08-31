# obsidian‑lite — PRD（面向开发团队的详细规范）

**目标**：交付一款“Obsidian-like”的桌面笔记应用（本地优先），原生支持：

* 思维导图（mindmap）视图
* 笔记关系图（全局 graph）交互
* 笔记向量化（embedding）与语义检索/相关笔记建议

**愿景**：离线优先、隐私优先、可扩展到本地/私有模型与云同步。MVP 目标在 5 个 Sprint（见里程碑）。

---

## 1. 范围（MVP vs 非 MVP）

### MVP（必须实现）

* 本地 Markdown Vault（文件夹）浏览、打开、编辑（CodeMirror 6）
* 双向链接解析（`[[link]]`）与反向链接面板
* 全局笔记关系图（cytoscape.js）——可视化笔记之间的显式链接
* 单文档思维导图（markmap 渲染）——只读
* 本地 Python 语义引擎（FastAPI stub）与启动/健康检查
* 基本向量化 pipeline stub：`POST /index`、`POST /search`（返回模拟结果）

### 非 MVP（后续迭代）

* 可编辑可视化 mindmap（双向同步）
* 实时协作（CRDT 并发）与云同步
* 本地完整 embedding + LanceDB/Chroma 真实现（可以做 PoC 后上）

---

## 2. 非功能性要求

* **跨平台**：支持 Windows / macOS / Linux
* **安全**：本地 FastAPI 仅绑定 `127.0.0.1`; 不默认开放网络
* **隐私**：默认不上传笔记到任何云端
* **性能**：1000+ 笔记仍能流畅展示基本 graph（依靠抽样/分页）
* **可维护性**：模块化（renderer / main / python）严格分界

---

## 3. 系统架构概览

* **Electron 主进程（main）**：负责窗口、文件系统访问（fs/chokidar）、启动/监控 Python 子进程、有限 IPC
* **Renderer（React + Vite）**：UI 层（编辑器、视图、图表）
* **Python 服务（FastAPI）**：语义/向量化服务（embedding、向量库接口、search、index）
* **本地持久化**：笔记以 Markdown 文件存储（用户选择 Vault 文件夹）；索引与元数据存放 SQLite；向量存储（向量 DB，本地模式）

---

## 4. API Spec（本地 FastAPI，所有路径基于 `http://127.0.0.1:8000`）

> 设计原则：接口简单、幂等、返回带 `request_id` 与 `duration_ms` 字段用于调试。

### 4.1 `GET /health`

* **描述**：Python 服务健康检查与模型加载状态
* **响应 200**:

```json
{ "request_id":"<uuid>", "duration_ms": 12, "status":"ok", "model_loaded": false }
```

### 4.2 `POST /index` — 单文件增量索引

* **用途**：把前端保存的单个 note 的文本内容发送给后端做 chunk + embed + 存储（MVP stub 可返回模拟结果）
* **请求 body**:

```json
{ "path":"/absolute/path/to/note.md", "content":"#标题...\n正文...", "modified_at":"2025-09-01T12:00:00Z" }
```

* **响应 200**:

```json
{ "request_id":"<uuid>", "indexed_chunks": 5, "chunks": [{"chunk_id":"c1","start":0,"end":120}], "duration_ms": 213 }
```

* **错误码**：400（bad request），500（internal error）

### 4.3 `POST /index/reindex` — 全量或批量重建索引

* **请求 body**:

```json
{ "paths": ["/vault/*.md"], "mode":"full" }  
// mode 可选: incremental | full
```

* **响应**：批量任务 id 或统计：`{ indexed_count: 123 }`

### 4.4 `POST /search/semantic` — 语义检索

* **请求**:

```json
{ "q":"如何做技术面分析","top_k":10 }
```

* **响应**:

```json
{ "request_id":"<uuid>", "duration_ms": 123, "results": [{"note_id":"/vault/a.md","chunk_id":"c1","score":0.95,"snippet":"..."}]}
```

### 4.5 `POST /search/fulltext` — 精确/全文检索（可选）

* **请求**：`{ "q":"字符串", "path_filters": [] }`
* **响应**：类似 semantic，但返回匹配行/ctx

### 4.6 `GET /graph` — 返回关系图（nodes/edges）

* **参数**：可加 `?limit=500&min_degree=1` 分页/滤波
* **响应**:

```json
{ "nodes": [{"id":"note1","label":"Note 1","type":"note"}], "edges":[{"source":"note1","target":"note2","type":"link"}] }
```

### 4.7 `GET /note?path=...` — 返回 note 内容与元数据

* **响应**: `{ path, title, headings: [...], backlinks: [...], modified_at }`

### 4.8 `POST /export` — 导出笔记/图（可选）

* 请求：`{ format: "pdf" | "md" | "json", paths: [...] }`

---

## 5. IPC（Electron 主进程 ↔ Renderer）

* `dialog:openFile` — 打开文件选择对话框，返回 path
* `python:health` — 触发主进程对 Python `/health` 的调用并返回结果
* `index:file` — 渲染进程请求主进程或直接 Python 做 index（建议由 renderer 直接 http 请求 Python，以便 main 仅做进程管理）
* 事件 `python-exited` — 主进程发给 renderer 通知 Python 子进程终止

注意：建议 renderer 直接调用 Python HTTP API（127.0.0.1:8000），Electron main 负责 spawn/monitor；IPC 仅用于本地权限/对话框之类的原生操作。

---

## 6. 数据模型与持久化方案

### 6.1 Markdown files

* Vault: 用户选择一个本地目录，笔记以 `.md` 文件保存，文件名即 note id（也支持 frontmatter 中的 `id` 字段覆盖）。

### 6.2 SQLite schema（主表）

* 用途：存储元数据、加速全文/元搜索、记录 chunk 映射。建议使用 `wal` 模式，避免锁竞用。

```sql
-- notes: 核心笔记记录
CREATE TABLE notes (
  note_id TEXT PRIMARY KEY,    -- 使用绝对 path 或 UUID
  path TEXT UNIQUE NOT NULL,
  title TEXT,
  created_at TIMESTAMP,
  modified_at TIMESTAMP,
  word_count INTEGER,
  metadata JSON
);

-- headings: 每个 note 的标题索引（便于目录/导航）
CREATE TABLE headings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  note_id TEXT REFERENCES notes(note_id),
  heading TEXT,
  level INTEGER,
  start_offset INTEGER
);

-- links: 显式链接（来自 [[link]] 或 markdown link）
CREATE TABLE links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  src_note TEXT REFERENCES notes(note_id),
  dst_note TEXT,
  link_text TEXT,
  occurrences INTEGER DEFAULT 1
);

-- chunks: 文本切片（与向量库的 chunk_id 对应）
CREATE TABLE chunks (
  chunk_id TEXT PRIMARY KEY,
  note_id TEXT REFERENCES notes(note_id),
  heading_id INTEGER REFERENCES headings(id),
  start_offset INTEGER,
  end_offset INTEGER,
  text TEXT,
  created_at TIMESTAMP
);

-- optional: vector_meta: 记录向量存储中 chunk 的指针/版本
CREATE TABLE vector_meta (
  chunk_id TEXT PRIMARY KEY REFERENCES chunks(chunk_id),
  vector_id TEXT,
  vector_backend TEXT,  -- e.g., chroma, lancedb
  created_at TIMESTAMP
);

-- indices
CREATE INDEX idx_notes_modified ON notes(modified_at);
CREATE INDEX idx_links_src ON links(src_note);
CREATE INDEX idx_chunks_note ON chunks(note_id);
```

### 6.3 向量 schema（向量库）

* **后端选择（MVP）**：Chroma local / LanceDB local
* **向量记录**：在向量库中存储 `vector`（float32\[]）与 `metadata`： `{chunk_id, note_id, snippet, created_at}`。
* **查询**：支持 top-k 相似度检索，返回 `chunk_id`，然后用 SQLite JOIN 获取 note path/heading。

示例（Chroma 风格 的 record）：

```json
{
  "id": "chunk:1234",
  "embedding": [0.0123, -0.234, ...],
  "metadata": {"chunk_id":"c1234","note_id":"/vault/a.md","snippet":"..."}
}
```

---

## 7. remark 插件伪代码（解析 `[[wiki-link]]` 并在 AST 中注入数据）

```js
// remark-wikilink-pseudo.js
module.exports = function remarkWikilink() {
  return (tree, file) => {
    // 遍历 tree 的 text 节点
    visit(tree, 'text', (node, index, parent) => {
      const parts = parseWikilinks(node.value) // e.g. returns [{raw:'[[Foo]]', target:'Foo'}]
      if (!parts.length) return
      // replace node with sequence: text / wikilink nodes
      const newNodes = []
      let pos = 0
      for (const p of parts) {
        if (p.start > pos) newNodes.push({type:'text', value: node.value.slice(pos, p.start)})
        newNodes.push({
          type: 'wikilink',
          data: { hName: 'a', hProperties: { 'data-wikilink': p.target }, target: p.target },
          value: p.raw
        })
        pos = p.end
      }
      if (pos < node.value.length) newNodes.push({type:'text', value: node.value.slice(pos)})
      parent.children.splice(index, 1, ...newNodes)
    })
  }
}
```

> 插件输出的 `wikilink` 节点应带 `data.target` 与 `alias`（如果存在 `[[Target|Alias]]`），方便后续索引器读取 AST 并写入 `links` 表。

---

## 8. 前端路由 & 组件树

### 路由（React-router 风格）

* `/` — Dashboard（Recent notes, quick search）
* `/vault` — Vault 浏览（file tree）
* `/note/:noteId` — 单笔记视图（编辑器 + preview + backlinks）
* `/graph` — 全局笔记关系图（cytoscape）
* `/search` — 搜索结果页（全文 + 语义）
* `/mindmap/:noteId` — 单文档思维导图视图（markmap）
* `/settings` — 应用设置（Vault、Python path、模型设置）

### 主要组件（按职责）

```
App
├─ Shell (TopBar, LeftSidebar, RightPanel)
│  ├─ TopBar (global search, python status, settings)
│  ├─ LeftSidebar (FileTree, QuickTags)
│  └─ RightPanel (BacklinksPanel, RelatedPanel)
├─ Routes
│  ├─ Dashboard
│  ├─ VaultView (FileTree + preview)
│  ├─ NoteView
│  │  ├─ Editor (CodeMirrorWrapper)
│  │  ├─ Preview (Markdown render)
│  │  ├─ BacklinksPanel
│  │  └─ RelatedPanel (semantic results)
│  ├─ GraphView (CytoscapeGraph)
│  ├─ SearchView
│  └─ MindmapView
└─ Modals
   ├─ OpenVaultDialog
   └─ SettingsModal
```

### 关键小组件与职责

* **Editor (CodeMirrorWrapper)**：提供 save debounce、onChange、export AST 接口
* **BacklinksPanel**：显示 explicit links + semantic related (合并并排序)
* **RelatedPanel**：展示 `/search/semantic` 结果并支持聚合到 note 层
* **CytoscapeGraph**：节点聚合、度数筛选、点击打开对应 note
* **PythonStatus**：显示/刷新 Python 服务健康与模型加载状态

---

## 9. 开发约定与接口契约

* **编码风格**：ESLint + Prettier，Python 使用 black + isort
* **API contracts**：每个 HTTP 接口必须返回 `request_id` 与 `duration_ms`；错误请返回标准 JSON `{ error: { code, message } }`
* **日志**：Python 写日志到 stdout（Electron main 订阅并写入文件），并在 Electron 的 `DevTools` 控制台可查看

---

## 10. 测试 & 验收标准（MVP）

* 编辑器能打开并保存本地 MD 文件（手动测试）
* 触发保存后，能调用 `POST /index` 并返回 `indexed_chunks`（stub-ok）
* 打开 `/graph` 能看到基于现有链接的可交互图（节点点击能打开 note）
* 打开单文档 /mindmap 能渲染 markmap（只读）
* Python stub 健康接口返回 200 且 Electron 中能展示状态

---

## 11. 部署、打包与运维注意事项

* 打包 Python：推荐将 Python 服务打包为可执行（PyInstaller）并随 Electron 分发；注意 Windows 的杀毒/签名问题。
* 更新策略：前端使用自动更新（electron-updater），Python 可执行作为随应用版本发布或单独升级

---

## 12. 风险与缓解（摘要）

1. **向量化体积与 CPU 资源占用** — PO C: 在第一阶段用 stub；缓解：提供按需索引和保留策略（只索引指定目录或 date range）。
2. **大图渲染卡顿** — 缓解：构建抽样/分层呈现，延迟加载子图节点。
3. **跨平台 Python 打包复杂** — 缓解：早期提供“开发者模式”与“内置执行文件”两种安装包；文档里明确列出依赖。

---

## 13. 里程碑（高层，2 周 sprint）

* Sprint 0：项目搭建、选型确认（Electron）
* Sprint 1：文件浏览、CodeMirror 编辑器、保存与本地事件监听
* Sprint 2：remark 插件实现、SQLite 索引、反向链接 UI
* Sprint 3：关系图（cytoscape）、mindmap 只读渲染
* Sprint 4：Python stub 融合、`/index` 与 `/search` 集成
* Sprint 5：打包试验、QA、Release

## 14. 下一步（建议的立即工作项）

1. 团队确认技术栈（Electron vs Tauri，建议 Electron 先行）
2. 由我把 `remark` 插件的完整实现（JS）和 `POST /index` 的 Node 客户端示例写出来
3. 规划第一个 Sprint 的任务卡（Jira/Notion），并开始实现 Sprint 1
