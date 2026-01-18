# Agent Workflow Server

基于 **Agent Skills + Claude Agent** 的工作流引擎，用于替代或增强 n8n，支持 **外部触发器 → Agent → Skills → Tools → 返回结果** 的完整链路。

## ✨ 核心特性

- 🧠 **Agent-driven workflow** - 动态决策，而非静态 DAG
- 🧩 **Agent Skills** - 可加载的能力模块（技能 ≠ API）
- 🔌 **Claude Tool Calling** - MCP 兼容
- ♻️ **Job + Step 幂等** - 防止重复处理
- 🚀 **易部署** - Railway / Fly.io / Docker

## 🏗️ 架构

```
External Trigger (GitHub Webhook)
        │
        ▼
┌────────────────────────────┐
│     Agent Server           │
│                            │
│  routes/github.ts          │  ← 外部触发器
│        │                   │
│        ▼                   │
│   Agent (Claude)           │  ← 决策 / 规划
│        │                   │
│        ▼                   │
│   Skills Loader            │  ← 加载能力模块
│        │                   │
│        ▼                   │
│   Tools (GitHub/FS/HTTP)   │  ← 执行动作
└────────────────────────────┘
```

### 三层架构

| 层级 | 职责 | 示例 |
|-----|------|-----|
| **Agent** | 决策与控制面 | 判断任务类型、选择 Skill、调用 Tool |
| **Skills** | 可加载能力模块 | bugfix-skill、code-review-skill |
| **Tools** | 纯执行接口 | GitHub API、文件系统、HTTP |

## 📁 项目结构

```
agent-workflow-server/
├── src/
│   ├── server.ts              # Express 入口
│   ├── routes/
│   │   └── github.ts          # GitHub Webhook 处理
│   ├── agent/
│   │   ├── runAgent.ts        # Agent 主循环
│   │   ├── prompt.ts          # 基础 Prompt
│   │   └── skillPolicy.ts     # Skill 选择策略
│   ├── skills/
│   │   └── bugfix-skill/
│   │       ├── SKILL.md       # 技能指令
│   │       └── examples.md    # Few-shot 示例
│   ├── tools/
│   │   ├── github.ts          # GitHub API
│   │   ├── fs.ts              # 文件系统
│   │   └── http.ts            # HTTP 客户端
│   └── jobs/
│       └── IdempotencyGuard.ts
├── package.json
├── tsconfig.json
└── .env.example
```

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 填入:
# - OPENROUTER_API_KEY
# - GITHUB_TOKEN
# - GITHUB_WEBHOOK_SECRET
```

### 开发模式

```bash
npm run dev
```

### 生产构建

```bash
npm run build
npm start
```

## 🐳 Docker 部署

### 本地构建运行

```bash
# 构建镜像
docker build -t agent-workflow-server .

# 运行容器
docker run -d --name agent-server -p 3000:3000 \
  -e OPENROUTER_API_KEY=sk-or-v1-xxx \
  -e GITHUB_TOKEN=ghp_xxx \
  agent-workflow-server
```

### Railway 部署

项目已部署至 Railway：

| 项目 | 信息 |
|------|------|
| 线上地址 | https://agent-workflow-server-production.up.railway.app |
| Health Check | https://agent-workflow-server-production.up.railway.app/health |
| Webhook URL | https://agent-workflow-server-production.up.railway.app/webhooks/github |

**部署步骤**:

```bash
# 安装 Railway CLI
npm install -g @railway/cli

# 登录
railway login

# 初始化项目
railway init

# 设置环境变量
railway variables --set "OPENROUTER_API_KEY=sk-or-v1-xxx" \
                  --set "OPENROUTER_MODEL=anthropic/claude-sonnet-4" \
                  --set "NODE_ENV=production"

# 部署
railway up

# 生成公开域名
railway domain
```

> **注意**: 本项目使用长时间运行的 Agent 循环（最多 10 次迭代），不适合部署到 Vercel 等 Serverless 平台（超时限制）。推荐使用 Railway、Render、Fly.io 等容器平台。

## 🧪 测试

```bash
# 运行所有测试
npm test

# 运行单个测试文件
npx jest src/__tests__/tools/github.test.ts

# 运行匹配模式的测试
npx jest --testNamePattern="should select bugfix"
```

## 📡 API 端点

| 端点 | 方法 | 描述 |
|-----|------|-----|
| `/health` | GET | 健康检查 |
| `/webhooks/github` | POST | GitHub Webhook 接收 |
| `/webhooks/github/events` | GET | 支持的事件类型 |

### 测试 Webhook

```bash
curl -X POST http://localhost:3000/webhooks/github \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: issues" \
  -H "X-GitHub-Delivery: test-123" \
  -d '{"action":"opened","issue":{"number":1,"title":"Bug","body":"desc","labels":[{"name":"bug"}]},"repository":{"name":"repo","full_name":"owner/repo","owner":{"login":"owner"}},"sender":{"login":"user"}}'
```

## 🧩 添加新 Skill

1. 创建目录 `src/skills/<skill-name>/`
2. 添加 `SKILL.md`（指令、规则、约束）
3. 添加 `examples.md`（few-shot 示例）
4. 在 `src/agent/skillPolicy.ts` 的 `skillRegistry` 中注册

```typescript
{
  name: 'my-skill',
  description: 'My custom skill',
  path: 'my-skill',
  triggers: [
    { type: 'label', value: ['my-label'] },
    { type: 'keyword', value: ['keyword1', 'keyword2'] },
  ],
  priority: 10,
}
```

## 📋 TODO

### ✅ 已完成

- [x] `bugfix-skill` - Bug 修复技能（完整实现三个阶段）
  - Phase 1: 理解 Bug（读取 Issue、分析代码）
  - Phase 2: 设计修复方案
  - Phase 3: 实现并提交（创建分支、提交修复、创建 PR）

### 🚧 待实现

- [ ] `code-review-skill` - 代码审查技能（已注册触发器，待实现 SKILL.md）
- [ ] `security-skill` - 安全漏洞分析技能（已注册触发器，待实现 SKILL.md）

## 📜 License

MIT
