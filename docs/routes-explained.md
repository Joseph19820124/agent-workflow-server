# routes/ 目录代码解析

本文档详细解释 `src/routes/github.ts` 的每个方法和关键部分。

---

## 整体定位

```
External Trigger → [THIS: Route] → Agent → Skills → Tools
```

这是整个系统的**入口点**，负责接收 GitHub Webhook 并启动 Agent。

---

## GitHub Webhook 工作原理

```
GitHub 仓库发生事件（Issue 创建、PR 提交等）
       ↓
GitHub 发送 HTTP POST 到你的服务器
       ↓
POST /github
Headers:
  - X-GitHub-Event: issues
  - X-Hub-Signature-256: sha256=xxx
  - X-GitHub-Delivery: uuid-xxx
Body: { action: "opened", issue: {...}, repository: {...} }
       ↓
你的服务器处理并返回 202 Accepted
```

---

## 1. 类型定义

### `GitHubEventType` - 支持的事件类型

```typescript
type GitHubEventType = 'issues' | 'pull_request' | 'issue_comment' | 'push';
```

| 事件类型 | 触发场景 |
|---------|---------|
| `issues` | Issue 创建、编辑、关闭、标签变更 |
| `pull_request` | PR 创建、合并、关闭 |
| `issue_comment` | Issue 或 PR 下的评论 |
| `push` | 代码推送 |

### `GitHubContext` - 解析后的上下文

```typescript
interface GitHubContext {
  eventType: GitHubEventType;
  action: string;           // 如 "opened", "closed", "labeled"
  repository: {
    owner: string;          // 仓库所有者
    name: string;           // 仓库名
    fullName: string;       // "owner/repo"
  };
  issue?: {                 // Issue 事件时存在
    number: number;
    title: string;
    body: string;
    labels: string[];
  };
  pullRequest?: {           // PR 事件时存在
    number: number;
    title: string;
    body: string;
    headBranch: string;     // 源分支
    baseBranch: string;     // 目标分支
  };
  sender: {
    login: string;          // 触发者用户名
  };
  deliveryId: string;       // 唯一标识，用于幂等性
}
```

---

## 2. `validateWebhookSignature()` - 签名验证

```typescript
function validateWebhookSignature(
  _payload: string,
  _signature: string | undefined
): boolean {
  // STUB: 当前总是返回 true
  // TODO: 实现真实的 HMAC-SHA256 验证
  return true;
}
```

### 真实实现应该是

```typescript
import crypto from 'crypto';

function validateWebhookSignature(payload: string, signature: string): boolean {
  const secret = process.env.GITHUB_WEBHOOK_SECRET!;
  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}
```

### 安全目的

- 确保请求真的来自 GitHub
- 防止伪造攻击（有人冒充 GitHub 发送恶意请求）
- `GITHUB_WEBHOOK_SECRET` 在 GitHub 仓库设置中配置

---

## 3. `parseGitHubPayload()` - 解析 Payload

```typescript
function parseGitHubPayload(
  eventType: string,
  payload: Record<string, unknown>,
  deliveryId: string
): GitHubContext
```

**作用**：把 GitHub 的原始 JSON 转换为类型化的 `GitHubContext`

### 转换示例

**GitHub 原始 Payload**：

```json
{
  "action": "opened",
  "issue": {
    "number": 123,
    "title": "Bug: Login fails",
    "body": "When I click login...",
    "labels": [{ "name": "bug" }]
  },
  "repository": {
    "name": "my-repo",
    "full_name": "owner/my-repo",
    "owner": { "login": "owner" }
  },
  "sender": { "login": "reporter" }
}
```

**转换后的 GitHubContext**：

```typescript
{
  eventType: "issues",
  action: "opened",
  repository: {
    owner: "owner",
    name: "my-repo",
    fullName: "owner/my-repo"
  },
  issue: {
    number: 123,
    title: "Bug: Login fails",
    body: "When I click login...",
    labels: ["bug"]
  },
  sender: { login: "reporter" },
  deliveryId: "uuid-xxx"
}
```

### 解析逻辑

```typescript
// 基础信息（所有事件都有）
const context: GitHubContext = {
  eventType: eventType as GitHubEventType,
  action: payload.action as string,
  repository: { ... },
  sender: { ... },
  deliveryId,
};

// Issue 信息（仅 issues/issue_comment 事件）
if (payload.issue) {
  context.issue = {
    number: issue.number,
    title: issue.title,
    body: issue.body,
    labels: issue.labels.map(l => l.name),
  };
}

// PR 信息（仅 pull_request 事件）
if (payload.pull_request) {
  context.pullRequest = {
    number: pr.number,
    title: pr.title,
    body: pr.body,
    headBranch: pr.head.ref,
    baseBranch: pr.base.ref,
  };
}
```

---

## 4. 主路由处理器 `POST /`

```typescript
githubRouter.post('/', async (req: Request, res: Response) => {
  // 从 Headers 提取信息
  const eventType = req.headers['x-github-event'];
  const signature = req.headers['x-hub-signature-256'];
  const deliveryId = req.headers['x-github-delivery'];

  // Step 1: 验证签名
  if (!validateWebhookSignature(...)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Step 2: 幂等性检查
  const guard = new IdempotencyGuard();
  if (await guard.isDuplicate(deliveryId)) {
    return res.status(200).json({ status: 'duplicate' });
  }

  // Step 3: 解析 Payload
  const context = parseGitHubPayload(eventType, req.body, deliveryId);

  // Step 4: 立即返回 202（异步处理）
  res.status(202).json({
    status: 'accepted',
    deliveryId,
    message: 'Webhook received, Agent processing started',
  });

  // Step 5: 异步运行 Agent
  try {
    await runAgent(context);
    await guard.markComplete(deliveryId);
  } catch (error) {
    await guard.markFailed(deliveryId, error);
  }
});
```

### 处理流程图

```
┌─────────────────────────────────────────────────────────┐
│                 GitHub Webhook 请求                      │
│                                                         │
│  POST /github                                           │
│  Headers: X-GitHub-Event, X-Hub-Signature-256           │
│  Body: { action, issue, repository, ... }               │
└────────────────────────┬────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│  Step 1: 验证签名                                        │
│  validateWebhookSignature()                             │
│                                                         │
│  失败 → 401 Unauthorized                                │
└────────────────────────┬────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│  Step 2: 幂等性检查                                      │
│  guard.isDuplicate(deliveryId)                          │
│                                                         │
│  重复 → 200 { status: "duplicate" }                     │
└────────────────────────┬────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│  Step 3: 解析 Payload                                    │
│  parseGitHubPayload() → GitHubContext                   │
└────────────────────────┬────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│  Step 4: 立即返回 202 Accepted                           │
│  （GitHub 要求 10 秒内响应，否则会重试）                   │
└────────────────────────┬────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│  Step 5: 异步运行 Agent                                  │
│  runAgent(context)                                      │
│                                                         │
│  完成 → guard.markComplete()                            │
│  失败 → guard.markFailed()                              │
└─────────────────────────────────────────────────────────┘
```

---

## 5. `GET /events` - 文档端点

```typescript
githubRouter.get('/events', (_req, res) => {
  res.json({
    supportedEvents: ['issues', 'pull_request', 'issue_comment', 'push'],
    description: 'GitHub webhook events that trigger Agent workflows',
  });
});
```

**作用**：提供 API 文档，告诉调用者支持哪些事件类型。

**访问方式**：`GET /github/events`

---

## 关键设计决策

### 为什么返回 202 而不是 200？

| 状态码 | 含义 | 适用场景 |
|-------|------|---------|
| 200 | 处理完成 | 同步处理，立即返回结果 |
| 202 | 已接受，异步处理 | 异步处理，稍后完成 |

Agent 处理可能需要几秒到几分钟，不能让 GitHub 等待。GitHub 要求 10 秒内响应，否则会认为请求失败并重试。

### 为什么需要幂等性检查？

GitHub 会在以下情况重发 Webhook：
1. 你的服务器没有及时响应
2. 网络问题导致 GitHub 没收到响应
3. GitHub 自身的重试机制

**没有幂等性检查的后果**：
- 同一个 Issue 可能被处理多次
- 重复评论
- 重复创建 PR

### 为什么先返回再处理？

```typescript
// Step 4: 先返回
res.status(202).json({ status: 'accepted' });

// Step 5: 再处理（异步）
await runAgent(context);
```

这种模式叫 **"Fire and Forget"**：
1. 快速响应 GitHub（满足 10 秒要求）
2. 后台异步处理（不阻塞响应）
3. 即使处理失败，也不影响 GitHub 的记录

---

## HTTP Headers 说明

| Header | 说明 | 示例 |
|--------|------|------|
| `X-GitHub-Event` | 事件类型 | `issues`, `pull_request` |
| `X-Hub-Signature-256` | HMAC-SHA256 签名 | `sha256=abc123...` |
| `X-GitHub-Delivery` | 唯一投递 ID | `72d3162e-cc78-11e3-81ab-4c9367dc0958` |

---

## 与其他模块的关系

```
github.ts (routes)
    │
    ├── 验证签名 (内部函数)
    │
    ├── 幂等性检查
    │   └── IdempotencyGuard (jobs/)
    │
    └── 启动 Agent
        └── runAgent() (agent/runAgent.ts)
            │
            ├── selectSkills() (agent/skillPolicy.ts)
            ├── loadSkillContent() (agent/skillPolicy.ts)
            ├── getBasePrompt() (agent/prompt.ts)
            └── toolRegistry (tools/*.ts)
```

---

## 扩展指南

### 添加新的事件类型支持

1. 在 `GitHubEventType` 添加类型
2. 在 `parseGitHubPayload()` 添加解析逻辑
3. 在 `skillPolicy.ts` 添加对应的 Skill 触发规则

### 实现真实签名验证

```typescript
import crypto from 'crypto';

function validateWebhookSignature(payload: string, signature: string): boolean {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret || !signature) return false;

  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');

  // 使用 timingSafeEqual 防止时序攻击
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(digest)
  );
}
```
