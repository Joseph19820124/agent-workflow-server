# tools/ 目录代码解析

本文档详细解释 `src/tools/` 目录下三个工具文件的每个方法和关键部分。

---

## 整体定位

```
Agent → Skills → [THIS: Tools]
```

Tools 是**纯执行层**：
- 没有决策逻辑
- 没有业务判断
- 只执行并返回结果

Agent 决定 **WHAT** to do，Tools 执行 **HOW** to do it。

---

## 文件概览

| 文件 | 作用 | 实现状态 | 安全机制 |
|------|------|---------|---------|
| `github.ts` | GitHub API | ✅ 完整 | Token 认证 |
| `fs.ts` | 本地文件系统 | ⚠️ Stub | 路径沙箱 |
| `http.ts` | HTTP 请求 | ⚠️ Stub | URL 验证（待完善） |

---

## 1. github.ts - GitHub API 工具

这是唯一完整实现的工具文件，提供与 GitHub API 交互的所有功能。

### 1.1 配置函数

```typescript
// 获取 Token（可选，用于公开仓库的读操作）
function getGitHubToken(): string | undefined {
  return process.env.GITHUB_TOKEN || undefined;
}

// 获取 Token（必需，用于写操作）
function requireGitHubToken(): string {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN environment variable is required');
  }
  return token;
}

// 获取请求头
function getHeaders(requireAuth: boolean): Record<string, string> {
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Agent-Workflow-Server',
  };

  const token = requireAuth ? requireGitHubToken() : getGitHubToken();
  if (token) {
    headers['Authorization'] = `token ${token}`;
  }

  return headers;
}

// 通用请求函数（带错误处理）
async function githubFetch<T>(url, options, requireAuth): Promise<T>
```

### 1.2 Issue 操作

| 函数 | API | 作用 |
|------|-----|------|
| `getIssue()` | `GET /repos/{owner}/{repo}/issues/{number}` | 获取 Issue 详情 |

```typescript
export async function getIssue(input: {
  owner: string;
  repo: string;
  issueNumber: number;
}): Promise<GitHubIssue>
```

**返回数据**：

```typescript
interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  labels: Array<{ name: string; color: string }>;
  user: { login: string };
  created_at: string;
  updated_at: string;
}
```

### 1.3 Comment 操作

| 函数 | API | 作用 |
|------|-----|------|
| `createComment()` | `POST /repos/{owner}/{repo}/issues/{number}/comments` | 创建评论 |

```typescript
export async function createComment(input: {
  owner: string;
  repo: string;
  issueNumber: number;
  body: string;  // 支持 Markdown
}): Promise<GitHubComment>
```

### 1.4 Pull Request 操作

| 函数 | API | 作用 |
|------|-----|------|
| `createPullRequest()` | `POST /repos/{owner}/{repo}/pulls` | 创建 PR |

```typescript
export async function createPullRequest(input: {
  owner: string;
  repo: string;
  title: string;
  body?: string;
  head: string;   // 源分支（包含修改）
  base: string;   // 目标分支（如 main）
}): Promise<GitHubPullRequest>
```

### 1.5 文件操作

| 函数 | API | 作用 |
|------|-----|------|
| `getFileContent()` | `GET /repos/{owner}/{repo}/contents/{path}` | 获取文件内容 |
| `listFiles()` | `GET /repos/{owner}/{repo}/contents/{path}` | 列出目录内容 |
| `getFileSha()` | 内部调用 `getFileContent` | 获取文件 SHA |
| `createOrUpdateFile()` | `PUT /repos/{owner}/{repo}/contents/{path}` | 创建/更新文件 |

**文件内容获取**：

```typescript
export async function getFileContent(input: {
  owner: string;
  repo: string;
  path: string;
  ref?: string;  // 分支/tag/commit SHA
}): Promise<GitHubFileContent>
```

**创建或更新文件**：

```typescript
export async function createOrUpdateFile(input: {
  owner: string;
  repo: string;
  path: string;
  content: string;   // 会被 Base64 编码
  message: string;   // Commit message
  branch: string;
  sha?: string;      // 更新已有文件时必需
}): Promise<GitHubFileCommitResult>
```

### 1.6 Branch 操作

| 函数 | API | 作用 |
|------|-----|------|
| `getBranch()` | `GET /repos/{owner}/{repo}/branches/{branch}` | 获取分支信息 |
| `createBranch()` | `POST /repos/{owner}/{repo}/git/refs` | 创建新分支 |

```typescript
export async function createBranch(input: {
  owner: string;
  repo: string;
  branch: string;      // 新分支名
  fromBranch?: string; // 源分支，默认 'main'
}): Promise<GitHubBranch>
```

### 1.7 工具函数

| 函数 | 作用 |
|------|------|
| `validateCredentials()` | 验证 Token 是否配置 |
| `getRateLimit()` | 获取 API 限流状态 |

### 完整工作流示例

```
Agent 要修复一个 Bug:

1. getIssue()           → 获取 Issue 详情
2. getFileContent()     → 读取相关代码
3. createBranch()       → 创建修复分支 fix/issue-123
4. getFileSha()         → 获取文件 SHA（更新需要）
5. createOrUpdateFile() → 提交修复代码
6. createPullRequest()  → 创建 PR
7. createComment()      → 在 Issue 下评论 "已创建 PR #456"
```

---

## 2. fs.ts - 文件系统工具

提供本地文件系统操作，目前为 Stub 实现。

### 2.1 安全机制

```typescript
// 获取工作空间根目录
function getWorkspaceRoot(): string {
  return process.env.WORKSPACE_ROOT || '/tmp/agent-workspace';
}

// 安全路径解析（防止路径穿越攻击）
function resolveSafePath(inputPath: string): string {
  const workspaceRoot = getWorkspaceRoot();
  const resolved = path.resolve(workspaceRoot, inputPath);

  // 安全检查：确保路径在工作空间内
  if (!resolved.startsWith(workspaceRoot)) {
    throw new Error(`Path traversal detected: ${inputPath}`);
  }

  return resolved;
}
```

**安全设计**：所有操作都被限制在 `WORKSPACE_ROOT` 目录内，防止访问系统敏感文件。

### 2.2 文件操作

| 函数 | 作用 | 状态 |
|------|------|------|
| `readFile()` | 读取文件内容 | Stub |
| `writeFile()` | 写入文件内容 | Stub |
| `listDirectory()` | 列出目录内容 | Stub |
| `exists()` | 检查路径是否存在 | Stub |
| `deleteFile()` | 删除文件 | Stub |
| `createDirectory()` | 创建目录 | Stub |

### 2.3 类型定义

```typescript
interface FileReadResult {
  path: string;
  content: string;
  size: number;
  encoding: string;
}

interface FileWriteResult {
  path: string;
  size: number;
  success: boolean;
}

interface DirectoryEntry {
  name: string;
  path: string;
  type: 'file' | 'directory' | 'symlink';
  size: number;
  modified: Date;
}
```

### 2.4 Stub 实现说明

```typescript
export async function readFile(input: {
  path: string;
  encoding?: string;
}): Promise<FileReadResult> {
  const safePath = resolveSafePath(input.path);

  // STUB: 返回 Mock 数据
  // TODO: 替换为真实实现
  //
  // 真实实现:
  // const content = await fs.promises.readFile(safePath, { encoding });
  // const stats = await fs.promises.stat(safePath);
  // return { path: safePath, content, size: stats.size, encoding };

  return {
    path: safePath,
    content: `// Mock file content...`,
    size: 50,
    encoding,
  };
}
```

**为什么是 Stub？**
- 项目主要通过 GitHub API 操作文件
- 本地文件操作需要更严格的安全审查
- 留作未来扩展

---

## 3. http.ts - HTTP 客户端工具

提供通用 HTTP 请求能力，目前为 Stub 实现。

### 3.1 安全机制

```typescript
function validateUrl(url: string): boolean {
  // TODO: 实现 URL 白名单，防止 SSRF 攻击
  // const allowedDomains = process.env.ALLOWED_DOMAINS?.split(',');
  // const parsedUrl = new URL(url);
  // if (!allowedDomains.includes(parsedUrl.hostname)) {
  //   throw new Error(`Domain not allowed: ${parsedUrl.hostname}`);
  // }

  // 当前只做基本格式验证
  try {
    new URL(url);
    return true;
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }
}
```

### 3.2 配置

```typescript
const DEFAULT_TIMEOUT = 30000; // 30秒

const DEFAULT_HEADERS = {
  'User-Agent': 'AgentWorkflowServer/1.0',
  'Accept': 'application/json',
};
```

### 3.3 HTTP 方法

| 函数 | HTTP Method | 典型用途 | 状态 |
|------|-------------|---------|------|
| `get()` | GET | 获取资源 | Stub |
| `post()` | POST | 创建资源 | Stub |
| `put()` | PUT | 替换资源 | Stub |
| `patch()` | PATCH | 部分更新 | Stub |
| `del()` | DELETE | 删除资源 | Stub |

### 3.4 响应类型

```typescript
interface HttpResponse<T> {
  status: number;      // HTTP 状态码 (200, 404, 500...)
  statusText: string;  // 状态文本 (OK, Not Found...)
  headers: HttpHeaders;
  data: T;             // 响应数据（泛型）
  url: string;         // 请求 URL
  duration: number;    // 请求耗时(毫秒)
}
```

### 3.5 工具函数

```typescript
// 判断是否成功 (2xx)
export function isSuccess(response: HttpResponse): boolean {
  return response.status >= 200 && response.status < 300;
}

// 判断是否客户端错误 (4xx)
export function isClientError(response: HttpResponse): boolean {
  return response.status >= 400 && response.status < 500;
}

// 判断是否服务器错误 (5xx)
export function isServerError(response: HttpResponse): boolean {
  return response.status >= 500 && response.status < 600;
}
```

---

## 在 runAgent.ts 中的注册

```typescript
const toolRegistry: Record<string, ToolFunction> = {
  // GitHub Tools - 读操作
  'github_getIssue': githubTool.getIssue,
  'github_getFileContent': githubTool.getFileContent,
  'github_listFiles': githubTool.listFiles,
  'github_getBranch': githubTool.getBranch,
  'github_getFileSha': githubTool.getFileSha,

  // GitHub Tools - 写操作
  'github_createComment': githubTool.createComment,
  'github_createBranch': githubTool.createBranch,
  'github_createOrUpdateFile': githubTool.createOrUpdateFile,
  'github_createPullRequest': githubTool.createPullRequest,

  // File System Tools
  'fs_readFile': fsTool.readFile,
  'fs_writeFile': fsTool.writeFile,
  'fs_listDirectory': fsTool.listDirectory,

  // HTTP Tools
  'http_get': httpTool.get,
  'http_post': httpTool.post,
};
```

---

## 数据流

```
Agent 决定调用工具
       ↓
toolRegistry["github_getIssue"]
       ↓
github.ts → getIssue()
       ↓
GitHub API (https://api.github.com)
       ↓
返回 GitHubIssue 对象
       ↓
JSON.stringify() 加入 messages
       ↓
LLM 继续决策
```

---

## 安全考虑

### GitHub Tools

- Token 通过环境变量注入，不硬编码
- 读操作允许无 Token（公开仓库）
- 写操作强制要求 Token

### File System Tools

- 所有路径被限制在 `WORKSPACE_ROOT`
- 路径穿越检测（`../` 攻击防护）
- 危险操作（delete）有警告日志

### HTTP Tools

- URL 格式验证
- TODO: URL 白名单（防止 SSRF）
- 请求超时限制（30秒）

---

## 扩展指南

### 添加新 GitHub 工具

1. 在 `github.ts` 添加函数
2. 在 `runAgent.ts` 的 `toolRegistry` 注册
3. 在 `runAgent.ts` 的 `toolDefinitions` 添加 schema

### 实现 fs.ts / http.ts

1. 将 Stub 替换为真实实现
2. 添加适当的错误处理
3. 完善安全机制（白名单等）
