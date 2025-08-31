# 概要（简短回顾）

* **Electron (main.ts)**：窗口管理、原生对话、Vault 文件系统监控（chokidar）、启动/监控 Python 服务、暴露安全 IPC（preload.ts）。
* **Renderer (React + TypeScript + Vite)**：UI 层（编辑器、文件树、Graph、Backlinks、Search、Settings）。
* **Python 服务 (FastAPI)**：负责向量化、向量库、索引管理、`/health`, `/index`, `/search`, `/graph` 等 HTTP 接口，持久化 SQLite（元数据/links/chunks），向量库可用 Chroma/Lance（可配置）。
* 通信方式：Renderer -> Python 使用 HTTP (127.0.0.1:8000)；Renderer 与主进程通过 contextBridge/IPC 做本地能力调用。

## Sprint 0 — 基础工程与 CI（项目上手 / 骨架）

**目标**
建立 monorepo、TypeScript + Electron + Vite + Python 项目骨架、CI 基础与代码风格配置。

**交付物**

* monorepo（根 + renderer + python）放到版本控制（可 clone 即跑）
* Electron 主/渲染端 TypeScript 基础（`npm run dev` 可打开 Electron 指向 Vite dev server）
* Python FastAPI stub 可本地运行（`uvicorn python.server:app`）
* GitHub Actions CI skeleton（lint / build / python tests）
* ESLint/Prettier 与 black + isort 配置、初始 README

**具体任务（可直接拆 Issue）**

1. 初始化 monorepo（推荐 pnpm workspace 或 npm 子目录方案）；编写根级 scripts。
2. 用 TypeScript 编写 Electron 主进程（`main.ts`），配置 `tsconfig`，配置 ESLint for TS。
3. Renderer 使用 Vite + React + TypeScript；创建 `src/main.tsx`、`App.tsx`。
4. 编写安全的 preload（`preload.ts`）并为暴露 API 定义 TypeScript 类型声明（`preload.d.ts`）。
5. Python 子项目：建立 venv 指引，FastAPI stub 实现 `/health`, `/index`, `/search`。
6. CI：GH Actions 包括 node lint/build, python black/flake8 检查和 pytest 単元测试。
7. 编写 CONTRIBUTING.md，说明如何本地开发与代码提交规范。

**接口/文件约定**

* 根 README 说明所需版本与常用命令：

  * `pnpm install` / `npm install`
  * `pnpm dev` 启动（renderer dev + electron）
  * `python -m venv .venv && .venv/bin/pip install -r python/requirements.txt && uvicorn python.server:app --reload`

**验收标准（DoD）**

* 克隆仓库后，按 README 能在开发者机器上成功启动 Electron 开发环境（窗口弹出并显示 React App），并能运行 Python stub。
* CI 至少能通过 lint 检查。

**风险 & 缓解**

* Node/Electron/TS 版本不一致 → 在 `package.json` 指定 engines，或使用 devcontainer。
* Python 依赖冲突 → 强制使用 virtualenv 并在 README 明确步骤。


## Sprint 1 — Vault（文件 I/O）与编辑器（CodeMirror）

**目标**
实现 Vault 打开、文件树、CodeMirror 编辑器、保存机制与文件变更监听（chokidar），并实现 renderer 与 main 的安全 IPC（打开目录/文件）。

**交付物**

* 打开/切换 Vault（本地目录）功能
* 左侧文件树 UI，显示 `.md` 列表，支持新建/重命名/删除
* 编辑器组件（TypeScript），基于 CodeMirror 6，支持 Markdown、保存 debounce、快捷键
* 主进程使用 chokidar 监听 Vault 变化并向 renderer 发 `file-changed` 事件

**具体任务**

1. 预加载（preload）API 类型定义：

   * `openVault(): Promise<string | null>`
   * `readFile(path: string): Promise<string>`
   * `writeFile(path: string, content: string): Promise<void>`
2. main.ts：实现对应 ipc handler（使用 `fs.promises` + chokidar），外部改动时通过 `webContents.send('file-changed', { path })` 通知渲染进程。
3. Renderer：实现 FileTree 组件（包含搜索/过滤），点击文件通过 exposed API 读取并加载编辑器。
4. Editor：集成 CodeMirror 6（TS），保存策略：

   * 自动保存：编辑静止 1200ms 后 debounce 保存
   * 手动保存：Ctrl/Cmd+S
   * 保存后调用 `POST /index`（初期为 stub）
5. 外部修改处理：当 chokidar 通知外部文件改动，若 Editor 有未保存更改则显示冲突提示；否则自动刷新内容。

**验收标准**

* 能选择 Vault 并显示所有 `.md`
* 点击文件在 Editor 中打开并能编辑
* 保存写回磁盘并触发 `file-changed`
* 外部修改文件能触发刷新或冲突提示

**测试要点**

* Editor 保存 debounce 单元测试
* 集成测试：外部编辑 -> chokidar -> renderer 刷新
* E2E：打开 vault -> 编辑 -> 保存 -> 验证磁盘内容变化

**风险 & 缓解**

* 并发写造成冲突：在写入前检查文件 modified time，若不一致提示用户合并或覆盖。
* chokidar 在不同平台差异：使用稳定配置并在 Windows/macOS/Linux 做烟雾测试。

## Sprint 2 — Markdown AST、remark 插件与索引入门（SQLite）

**目标**
实现 Markdown AST 解析（unified + remark + 自定义 wikilink 插件）、建立 SQLite 元数据索引（notes、headings、links、chunks）。实现增量索引接口（Renderer 保存后调用 Python `/index`，Python 写入 SQLite）。

**交付物**

* 完整的 `remark-wikilink` 插件（TypeScript），可用于前端实时解析、高亮与提取链接列表
* Python `/index` 最小实现：接收 `path, content, modified_at`，解析并写入 SQLite（notes、headings、links、chunks；chunks 可先为文本切片）
* 前端 BacklinksPanel：保存后显示 `links` 表中显式反链

**具体任务**

1. 实现 remark 插件（TS）：

   * 支持 `[[Target|Alias]]`、`[[Target]]` 及普通 markdown link
   * 输出 AST 节点类型 `wikilink`，带 `data.target`、`data.alias`
   * 导出工具函数：`extractWikilinks(markdownText)`（用于索引前的检查）
2. Python：初始化 SQLite schema（参考 PRD），实现 `POST /index`：

   * 使用 Python 的 markdown 库或 regex 提取 headings 与 wikilinks（与 TS 插件解析保持一致）
   * upsert 到 notes、headings、links、chunks 表
   * 返回 `indexed_chunks` 与 chunk 列表
3. Renderer：实现 BacklinksPanel，调用 `/note?path=...` 或 `/graph` 获取并显示反链
4. 编写 DB migration / init 脚本 `python/db_init.py`

**验收标准**

* remark 插件通过单元测试（不同链接语法）
* 保存后触发 `POST /index` 且 SQLite 表得到正确写入
* BacklinksPanel 能显示显式链接数据
* DB 可用 sqlite3 客户端检查

**测试要点**

* remark 单元测试（多种语法）
* Python 集成测试：POST /index 后在 DB 中能查到对应记录

**风险 & 缓解**

* TS 与 Python 解析不一致 → 采用统一的语法测试样例，增加回归测试；或把解析逻辑尽量统一（例如在 Python 也用 markdown-it-py 的同类语法库）。

---

## Sprint 3 — Graph 视图（cytoscape）与 Mindmap（markmap）只读

**目标**
实现全局笔记关系图（cytoscape）及单文档思维导图（markmap）只读视图，支持交互（节点点击打开 note、按筛选聚合显示等）。

**交付物**

* Python `/graph` endpoint（返回 nodes/edges，基于 links 表生成）
* Renderer 的 CytoscapeGraph 组件：

  * 布局、样式、点选处理
  * 度数筛选滑块、搜索与高亮
  * 节点聚合/折叠（按标签或度数）
* MindmapView：将当前文档渲染为 markmap（只读）

**具体任务**

1. 实现 Python `/graph?limit=&min_degree=`：

   * 从 links/notes 表查询生成 nodes（含 meta）与 edges
   * 支持 filter 参数（limit、min\_degree、center 等）
2. Renderer 集成 cytoscape 与 cytoscape-dagre（或 cose）：

   * 初始渲染网络（可加载最多 N 个节点）
   * 实现“展开节点”功能（点击后通过 `/graph?center=nodeId&depth=1` 加载邻居）
3. Mindmap：增加路由 `/mindmap/:noteId`，将笔记 headings 转为 markmap 输入并渲染
4. UI：节点 tooltip 显示摘要/modified\_at，点击跳转到对应 note

**验收标准**

* Graph 页面能基于数据库显示节点和边
* 点击节点能打开对应笔记
* Mindmap 页面正确渲染当前笔记的层级结构

**测试要点**

* `/graph` API 单元/集成测试
* 手工验证：Graph 在 500 节点下能基本交互
* Mindmap 渲染边界 case（深度、空标题）

**风险 & 缓解**

* 大图性能 → 服务器端聚合与客户端懒加载，增加分页/聚合接口
* markmap 对某些 Markdown 结构不能很好转换 → 在渲染前做预处理（清洗无效 heading）

## Sprint 4 — Python 语义引擎：Embedding Pipeline（PoC）

**目标**
实现 Python 端最小可运行的 embedding pipeline PoC：chunk 切片、embedding（本地或 Mock）、本地向量存储（Chroma 或内存实现），实现 `/search/semantic` 的端到端流程。

**交付物**

* Python `/index` 扩展：切片 -> 生成 embedding -> 存入向量后端（Chroma 或内存）
* Python `/search/semantic`：query -> embed -> top-k 检索 -> 返回 chunk -> 聚合到 note 层
* 支持通过配置选择 embedding 模式（MOCK / LOCAL / OPENAI）

**具体任务**

1. 决定 embedding 模式（在 `python/config.py`）：

   * `MOCK`：用于开发/CI（根据文本生成确定性向量）
   * `LOCAL`：sentence-transformers（文档说明需 CPU/GPU 等）
   * `OPENAI`：可选非默认实现
2. 实现 chunker：

   * 基本规则：按空行分段，或按最大字符数（例如 800-1000 字符）切片，并保留前后上下文片段
   * chunk\_id 使用 `sha1(note_path + start_offset)`
3. 向量存储整合：

   * PoC 可用 Chroma 本地或小型内存索引（持久化选项）
   * 每条向量记录带 metadata `{chunk_id, note_id, snippet, created_at}`
4. API 行为：

   * `POST /index` 返回 `indexed_chunks`、chunk\_id 列表
   * `POST /search/semantic` 接收 `{q, top_k}` 返回 `[{note_id, chunk_id, score, snippet}]`
5. `/health` 返回 `model_loaded` 状态

**验收标准**

* 调用 `/index` 后创建 chunks 与向量记录
* `/search/semantic` 返回合理结果（MOCK 模式可预测）
* 前端 RelatedPanel 能展示语义检索结果并跳转笔记

**测试要点**

* 集成测试：index -> search 返回可预期结果（在 MOCK 模式）
* 加载测试：索引 N 篇笔记后检索有效且稳定

**风险 & 缓解**

* 本地模型资源占用大 → 首先使用 MOCK 或小模型，给出安装说明与可选 Docker 镜像
* Chroma 安装/依赖问题 → 在 README 里提供可复制安装步骤或使用内存备选方案

## Sprint 5 — UI：Related Notes / Backlinks 合并、排序与 UX

**目标**
在 UI 中合并显式反链与语义相关笔记（实现排序、去重与聚合），在编辑器侧显示相关笔记建议，并实现快速插入 `[[note]]` 的功能。

**交付物**

* RightPanel（编辑器右侧）显示：

  * 显式反链（来自 links 表）
  * 语义相关笔记（来自 `/search/semantic`），合并、去重并排序（带原因说明）
* UX 动作：

  * 点击跳转到 Editor 中对应 snippet
  * 一键插入引用（在光标处插入 `[[note]]`）
  * Pin / Ignore 建议（保存用户偏好）
* 可选：后端聚合端点 `/note/related?path=...&top_k=...` 返回合并结果（或由前端合并）

**具体任务**

1. 合并算法设计：

   * 将 semantic chunk 结果映射到 note 后按 note 聚合（取 max 或加权平均）
   * 对出现在显式链接中的 note 提供 score boost（如 +0.2）
2. 实现 RightPanel UI：按 note 列出 top snippet、score、显示“来源（显式/语义）”
3. Editor 集成：选中文本或在按钮触发时显示 inline suggestions，支持快速插入
4. 本地记录用户反馈（接受/忽略）以便未来改进排序

**验收标准**

* Panel 正确展示合并与排序后的建议
* 点击建议能跳转到 Editor 的对应位置
* 插入引用功能工作（在光标处插入正确格式）

**测试要点**

* 单元测试：合并算法对合成数据的排序正确性
* UI 集成测试：插入行为、跳转行为

**风险 & 缓解**

* 语义匹配质量不足 → 提供用户开关，允许关闭语义建议


## Sprint 6 — 打包 Python 与 Electron 的进程管理 / 健康监控

**目标**
实现将 Python 服务打包成可随应用分发的形态或提供明确的安装方案；完善 Electron 中的进程管理、健康检查、日志收集与错误展示；准备基础的发行构建。

**交付物**

* 打包方案文档（Windows / macOS / Linux）
* 示例 Python 打包方法（PyInstaller 单文件或 embeddable wheel + wrapper）
* Electron 主进程增强：

  * 能启动打包后的 Python 可执行
  * 健康检查轮询与自动重启策略（带 backoff）
  * 将 Python stdout/stderr 写入应用日志文件并在 UI 可查看
* 打包脚本骨架（先是 renderer build，然后 electron-builder / electron-forge 配置示例）

**具体任务**

1. 选定打包策略：

   * A: 用 PyInstaller 把 python 服务打成单文件并随应用打包（用户体验最好）
   * B: 要求系统 Python，并在安装时安装依赖（用户体验差但实现简单）
2. main.ts 中实现 spawn/monitor：

   * spawn 可执行并监听 stdout/stderr
   * 实现 `python-exited` 事件到 renderer（带退出 code）
   * health poll（GET /health），若连续失败则尝试重启（限制重试次数）
3. 日志与错误展示：

   * 写日志到应用 data 目录（log rotate）
   * UI 提供打开日志窗口或导出日志功能
4. electron-builder 配置基础（用于生成安装包）

**验收标准**

* 打包的 demo 能在目标 OS 启动并自动启动 Python 服务
* UI 能显示 Python 健康状态，并展示日志
* 能进行重启与停止操作

**风险 & 缓解**

* PyInstaller 打包可能触发杀毒软件 → 建议签名、发布 checksum 与说明
* 跨平台差异 → 在 Windows/macOS/Linux 上做烟雾测试

## Sprint 7 — 测试、性能与文档（候选发布）

**目标**
补全测试用例、自动化回归、性能调优（Graph + 索引体量）、完成用户文档与设置界面，准备发布候选版本。

**交付物**

* 单元/集成/端到端测试覆盖关键模块（Editor、remark 插件、Python indexer）
* 性能优化：

  * 客户端图渲染虚拟化与分层加载
  * 数据库关键查询索引（SQLite 索引）
  * 向量库持久化与查找优化
* 完整用户文档（Getting Started、Vault 迁移、Troubleshooting、FAQ）
* Release Candidate 构建（Windows/macOS/Linux）

**具体任务**

1. 测试：

   * TS：Jest/React Testing Library 覆盖 Editor、remark 插件
   * Python：pytest 覆盖 index/search
   * E2E：Playwright 脚本打开应用并完成典型流程（打开 vault、编辑、索引、查看 graph）
2. 性能调优：

   * 在 DB 层确保创建必要索引（如 `notes.modified_at`, `chunks.note_id`）
   * Graph 客户端实现分页与懒加载
3. 完善 Settings UI（模型选择、Python 路径覆盖、索引控制）
4. 文档与发行流程：生成发行说明、已知问题列表、安装引导

**验收标准**

* 所有关键测试通过
* 应能在指定规模（例如 5k 笔记，取决于你们的目标）下保持可接受的交互性能（团队需定义阈值）
* 文档齐全并能指导用户完成安装与常见问题解决

**风险 & 缓解**

* 平台特有 bug → 安排平台测试时间并列出修复计划
* 最后关头的集成问题 → 预留回滚与快速修复流程

## 横向并行支持项（整个迭代周期持续进行）

* **安全与隐私审查**：确保 Python 仅监听 `127.0.0.1`、默认不上传数据；文档中说明任何外发/云功能必须显式授权。
* **代码质量**：ESLint + Prettier + Husky pre-commit 钩子；Python 使用 black + isort + flake8。
* **分支策略**：`main`（release-ready）、`develop`（集成）、`feat/*`、`hotfix/*`；写 PR 模板与审核 checklist。
* **PR Checklist**：实现功能 + 单元测试 + lint 通过 + 文档更新 + reviewer 批注。

## 关键接口与示例（可直接复制）

### preload.ts（类型安全示例）

```ts
// preload.ts （暴露最小 API，注释为中文）
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  openVault: () => ipcRenderer.invoke('dialog:openVault'),
  readFile: (path: string) => ipcRenderer.invoke('fs:readFile', path),
  writeFile: (path: string, content: string) => ipcRenderer.invoke('fs:writeFile', path, content),
  onFileChanged: (cb: (arg: { path: string }) => void) =>
    ipcRenderer.on('file-changed', (_, arg) => cb(arg)),
  pythonHealth: () => ipcRenderer.invoke('python:health')
})
```

### Python Pydantic 模型（示例）

```python
# python/schemas.py
from pydantic import BaseModel

class IndexReq(BaseModel):
    path: str
    content: str
    modified_at: str

class SearchReq(BaseModel):
    q: str
    top_k: int = 10
```

### SQLite 初始化脚本（简化示例）

（完整 schema 已在 PRD）

```sql
CREATE TABLE IF NOT EXISTS notes (
  note_id TEXT PRIMARY KEY,
  path TEXT UNIQUE NOT NULL,
  title TEXT,
  created_at TIMESTAMP,
  modified_at TIMESTAMP,
  word_count INTEGER,
  metadata JSON
);

CREATE TABLE IF NOT EXISTS links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  src_note TEXT,
  dst_note TEXT,
  link_text TEXT,
  occurrences INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS chunks (
  chunk_id TEXT PRIMARY KEY,
  note_id TEXT,
  start_offset INTEGER,
  end_offset INTEGER,
  text TEXT,
  created_at TIMESTAMP
);
```

## Definition of Done（项目/功能级）

一个功能完成需满足：

1. 按设计实现并通过相应单元/集成测试
2. PR 通过至少 1 次代码审查
3. 更新对应 API / DB schema / UX 文档
4. 本地或自动化 E2E 验证通过
5. CI 无严重告警

