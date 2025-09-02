# Vault数据库架构说明

## 问题与解决方案

### 原始问题
在Sprint 2的初始实现中，存在一个设计缺陷：
- 所有vault共享同一个SQLite数据库文件
- 数据库固定存储在`python/cone_editor.db`
- 这会导致不同vault的笔记数据混合在一起

### 解决方案
现在每个vault都有自己独立的SQLite数据库：

```
vault1/
├── note1.md
├── note2.md
└── .cone_editor.db    # vault1专用数据库

vault2/
├── note3.md
├── note4.md
└── .cone_editor.db    # vault2专用数据库
```

## 技术实现

### 1. 数据库路径管理

**Python端 (`db_init.py`)**:
```python
def get_db_path(vault_path: str = None) -> str:
    """Get the database file path for a specific vault."""
    if vault_path:
        # Store database in the vault directory
        return os.path.join(vault_path, ".cone_editor.db")
    else:
        # Fallback to script directory for development/testing
        return os.path.join(os.path.dirname(__file__), "cone_editor.db")
```

### 2. 数据库管理器

**Python端 (`database.py`)**:
```python
class DatabaseManager:
    def __init__(self, vault_path: str = None):
        self.vault_path = vault_path
        self.db_path = get_db_path(vault_path)
        # 如果数据库不存在则自动创建
        if not Path(self.db_path).exists():
            initialize_database(vault_path)
```

### 3. API接口更新

**所有相关API端点现在都支持vault_path参数**:

- `POST /index` - 接收`vault_path`字段
- `GET /note?path=...&vault_path=...` - 获取特定vault的笔记信息  
- `GET /graph?vault_path=...` - 获取特定vault的图数据

### 4. 前端集成

**TypeScript API客户端**:
```typescript
export interface IndexRequest {
  path: string
  content: string
  modified_at: string
  vault_path?: string  // 新增vault路径
}
```

**React组件更新**:
- `Editor`组件：传递`vaultPath`到indexing API
- `BacklinksPanel`组件：使用`vaultPath`获取backlinks
- `App`组件：将当前vault路径传递给子组件

## 数据库文件说明

### 文件命名
- **文件名**: `.cone_editor.db`
- **位置**: 每个vault的根目录
- **隐藏**: 以`.`开头，在文件系统中默认隐藏

### 创建时机
数据库在以下情况自动创建：
1. **首次保存文件**: 当用户在vault中保存第一个markdown文件时
2. **API调用**: 当Python服务收到该vault的第一个请求时
3. **手动初始化**: 通过`python db_init.py init /path/to/vault`

### 数据库内容
每个vault的数据库包含：
- **notes表**: 该vault中的所有笔记
- **headings表**: 所有笔记的标题结构
- **links表**: vault内的wikilink关系  
- **chunks表**: 用于未来语义搜索的文本块
- **vector_meta表**: 向量存储元数据（未来使用）

## 用户体验

### 创建新Vault时
1. 用户选择或创建vault目录
2. 应用开始监听该目录的文件变化
3. 当用户第一次保存markdown文件时：
   - 自动在vault根目录创建`.cone_editor.db`
   - 初始化完整的数据库schema
   - 开始索引该文件的内容

### 切换Vault时
1. 应用切换到新的vault目录
2. Python服务自动切换到对应的数据库
3. Backlinks面板显示新vault的链接关系
4. 所有功能都基于当前vault的数据

### 多Vault管理
- 每个vault完全独立，互不影响
- 可以同时使用多个vault（通过打开多个应用实例）
- 删除vault时，对应的`.cone_editor.db`也会被删除

## 开发测试

### 数据库检查工具
```bash
# 检查特定vault的数据库
cd python
python db_init.py info /path/to/vault

# 重置特定vault的数据库
python db_init.py reset /path/to/vault
```

### 手动数据库访问
```bash
# 直接访问vault的数据库
sqlite3 /path/to/vault/.cone_editor.db

# 查看表结构
.tables
.schema notes
```

## 迁移说明

### 从共享数据库迁移
如果之前使用了共享数据库模式：
1. 备份原数据库：`python/cone_editor.db`
2. 为每个vault创建独立数据库
3. 根据文件路径将数据迁移到对应vault的数据库

### 兼容性
- 新架构向前兼容
- 未指定vault_path时使用默认数据库（开发模式）
- 现有API调用不会中断

## 性能优化

### 数据库大小
- 每个vault的数据库只包含该vault的数据
- 减少了查询时的数据量
- 提高了索引和搜索性能

### 并发访问
- 不同vault可以并发访问各自的数据库
- 避免了多vault间的锁竞争
- 支持多用户/多应用实例同时使用

## 安全性

### 数据隔离
- 不同vault的数据完全隔离
- 防止意外的跨vault数据泄露
- 支持不同vault使用不同的访问权限

### 备份策略
- 每个vault可以独立备份
- 包含`.cone_editor.db`的完整vault备份保持数据一致性
- 支持选择性备份特定vault

## 总结

通过这个架构改进：
✅ **数据隔离**: 每个vault拥有独立的数据库  
✅ **自动创建**: 用户无需手动创建数据库  
✅ **透明切换**: 切换vault时自动切换数据库  
✅ **性能优化**: 减少数据量，提高查询性能  
✅ **易于备份**: vault目录包含所有相关数据  
✅ **开发友好**: 提供调试和管理工具  

这个设计确保了每个vault都是一个完整、独立的笔记系统，符合用户对"vault"概念的期望。
