# 测试指南

本文档提供手动测试 Agent Workflow Server 的详细步骤。

## 前置条件

### 1. 环境配置

确保 `.env` 文件已配置：

```bash
cp .env.example .env
```

编辑 `.env` 填入：

```bash
OPENROUTER_API_KEY=sk-or-v1-your-key-here
OPENROUTER_MODEL=anthropic/claude-sonnet-4  # 可选
```

### 2. 安装依赖

```bash
npm install
```

### 3. 启动服务

```bash
npm run dev
```

成功启动后会看到：

```
🚀 Agent Workflow Server running on port 3000
📍 Health check: http://localhost:3000/health
🔗 GitHub webhooks: http://localhost:3000/webhooks/github
```

---

## 测试场景

### 场景 1: 健康检查

**目的**: 验证服务是否正常运行

```bash
curl http://localhost:3000/health
```

**预期响应**:

```json
{
  "status": "ok",
  "timestamp": "2026-01-18T14:00:00.000Z",
  "version": "1.0.0"
}
```

---

### 场景 2: 查看支持的事件类型

**目的**: 确认支持的 GitHub webhook 事件

```bash
curl http://localhost:3000/webhooks/github/events
```

**预期响应**:

```json
{
  "supportedEvents": ["issues", "pull_request", "issue_comment", "push"],
  "description": "GitHub webhook events that trigger Agent workflows"
}
```

---

### 场景 3: Bug Issue 触发 (bugfix-skill)

**目的**: 验证 Agent 能正确选择 bugfix-skill 并执行分析

```bash
curl -X POST http://localhost:3000/webhooks/github \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: issues" \
  -H "X-GitHub-Delivery: test-bug-$(date +%s)" \
  -d '{
    "action": "opened",
    "issue": {
      "number": 42,
      "title": "Bug: Application crashes on startup",
      "body": "When I run npm start, the app crashes with error: Cannot read property of undefined",
      "labels": [{"name": "bug", "color": "d73a4a"}]
    },
    "repository": {
      "name": "my-app",
      "full_name": "myorg/my-app",
      "owner": {"login": "myorg"}
    },
    "sender": {"login": "developer"}
  }'
```

**预期响应**:

```json
{
  "status": "accepted",
  "deliveryId": "test-bug-1234567890",
  "message": "Webhook received, Agent processing started"
}
```

**服务器日志预期输出**:

```
[GitHub] Received event: issues, delivery: test-bug-xxx
[SkillPolicy] Skill "bugfix-skill" matched with score X
[Agent] Selected skills: [ 'bugfix-skill' ]
[Agent] Calling OpenRouter API
[Agent] Model: anthropic/claude-sonnet-4
[Agent] Executing tool: github_getIssue
...
[Agent] Task completed
```

---

### 场景 4: Pull Request 触发 (code-review-skill)

**目的**: 验证 PR 事件能触发 code-review-skill（注：该 skill 尚未实现，会加载失败但不会崩溃）

```bash
curl -X POST http://localhost:3000/webhooks/github \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: pull_request" \
  -H "X-GitHub-Delivery: test-pr-$(date +%s)" \
  -d '{
    "action": "opened",
    "pull_request": {
      "number": 123,
      "title": "feat: add user authentication",
      "body": "This PR adds JWT-based authentication",
      "head": {"ref": "feature/auth", "sha": "abc123"},
      "base": {"ref": "main"}
    },
    "repository": {
      "name": "my-app",
      "full_name": "myorg/my-app",
      "owner": {"login": "myorg"}
    },
    "sender": {"login": "developer"}
  }'
```

**服务器日志预期输出**:

```
[SkillPolicy] Skill "code-review-skill" matched with score X
[SkillPolicy] Could not load SKILL.md for code-review-skill  # 预期的警告
```

---

### 场景 5: 安全相关 Issue (security-skill)

**目的**: 验证安全关键词能触发 security-skill

```bash
curl -X POST http://localhost:3000/webhooks/github \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: issues" \
  -H "X-GitHub-Delivery: test-security-$(date +%s)" \
  -d '{
    "action": "opened",
    "issue": {
      "number": 99,
      "title": "Security vulnerability in authentication",
      "body": "Found a potential SQL injection in the login endpoint. CVE pending.",
      "labels": [{"name": "security", "color": "ff0000"}]
    },
    "repository": {
      "name": "my-app",
      "full_name": "myorg/my-app",
      "owner": {"login": "myorg"}
    },
    "sender": {"login": "security-researcher"}
  }'
```

**服务器日志预期输出**:

```
[SkillPolicy] Skill "security-skill" matched with score X
[SkillPolicy] Skill "bugfix-skill" matched with score X
[Agent] Selected skills: [ 'security-skill', 'bugfix-skill' ]  # security 优先级更高
```

---

### 场景 6: 幂等性测试

**目的**: 验证相同 delivery ID 不会重复处理

```bash
# 第一次请求
curl -X POST http://localhost:3000/webhooks/github \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: issues" \
  -H "X-GitHub-Delivery: duplicate-test-001" \
  -d '{
    "action": "opened",
    "issue": {"number": 1, "title": "Test", "body": "Test", "labels": []},
    "repository": {"name": "repo", "full_name": "owner/repo", "owner": {"login": "owner"}},
    "sender": {"login": "user"}
  }'

# 等待处理完成
sleep 5

# 第二次请求（相同 delivery ID）
curl -X POST http://localhost:3000/webhooks/github \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: issues" \
  -H "X-GitHub-Delivery: duplicate-test-001" \
  -d '{
    "action": "opened",
    "issue": {"number": 1, "title": "Test", "body": "Test", "labels": []},
    "repository": {"name": "repo", "full_name": "owner/repo", "owner": {"login": "owner"}},
    "sender": {"login": "user"}
  }'
```

**第二次请求预期响应**:

```json
{
  "status": "duplicate",
  "deliveryId": "duplicate-test-001"
}
```

---

### 场景 7: 无匹配 Skill 的事件

**目的**: 验证没有匹配 skill 时的行为

```bash
curl -X POST http://localhost:3000/webhooks/github \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: push" \
  -H "X-GitHub-Delivery: test-push-$(date +%s)" \
  -d '{
    "action": "pushed",
    "repository": {
      "name": "my-app",
      "full_name": "myorg/my-app",
      "owner": {"login": "myorg"}
    },
    "sender": {"login": "developer"}
  }'
```

**服务器日志预期输出**:

```
[SkillPolicy] Selected skills: []
[Agent] Selected skills: []
```

---

## 单元测试

### 运行所有测试

```bash
npm test
```

### 运行特定测试文件

```bash
# GitHub 工具测试
npx jest src/__tests__/tools/github.test.ts

# Skill 策略测试
npx jest src/__tests__/agent/skillPolicy.test.ts

# 幂等性测试
npx jest src/__tests__/jobs/IdempotencyGuard.test.ts
```

### 运行匹配模式的测试

```bash
# 只运行包含 "bugfix" 的测试
npx jest --testNamePattern="bugfix"

# 只运行 tool 相关测试
npx jest --testPathPattern="tools"
```

### 查看测试覆盖率

```bash
npx jest --coverage
```

---

## 常见问题排查

### 问题 1: 服务启动失败

**错误**: `Error: Missing credentials`

**解决**: 确保 `.env` 文件存在且包含有效的 `OPENROUTER_API_KEY`

### 问题 2: API 调用失败

**错误**: `400 Provider returned error`

**可能原因**:
- API Key 无效或过期
- 模型名称错误
- 请求格式问题

**排查**:
```bash
# 测试 API Key 是否有效
curl https://openrouter.ai/api/v1/models \
  -H "Authorization: Bearer $OPENROUTER_API_KEY"
```

### 问题 3: 端口被占用

**错误**: `EADDRINUSE: address already in use :::3000`

**解决**:
```bash
# 杀掉占用端口的进程
lsof -ti:3000 | xargs kill -9
```

### 问题 4: Skill 加载失败

**警告**: `Could not load SKILL.md for xxx-skill`

**原因**: 该 skill 在 `skillRegistry` 中注册但没有实际的 SKILL.md 文件

**状态**: 这是预期行为，`code-review-skill` 和 `security-skill` 尚未实现

---

## 测试检查清单

- [ ] 健康检查正常返回
- [ ] Bug issue 能触发 bugfix-skill
- [ ] Agent 能调用 OpenRouter API
- [ ] Tool 能正确执行并返回结果
- [ ] 幂等性保护正常工作
- [ ] PR 事件能触发 code-review-skill（加载警告预期）
- [ ] 安全 issue 优先匹配 security-skill
- [ ] 所有单元测试通过 (76 tests)
