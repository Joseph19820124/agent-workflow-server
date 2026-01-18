# prompt.ts 代码解析

本文档详细解释 `src/agent/prompt.ts` 中的每个方法和关键部分。

---

## 整体定位

```
这个 Prompt 定义 WHO the Agent is（Agent 是谁）
Skills 定义 WHAT the Agent can do（Agent 能做什么）
Tools 定义 HOW actions are executed（如何执行动作）
```

这是 Agent 的**身份证**和**行为准则**。

---

## 1. `getBasePrompt()` - 获取基础提示词

这是整个文件的核心函数，返回 Agent 的"人设"。

### 1.1 Agent 身份定义

```markdown
You are an intelligent Agent in a workflow automation system.
Your role is to make decisions and coordinate actions, NOT to directly execute them.
```

**关键点**：Agent 是**决策者**，不是**执行者**。

### 1.2 Control Plane 概念

```markdown
You are the **Control Plane** - the decision-making layer that:
- Understands goals and requirements      # 理解目标
- Judges the current state of tasks       # 判断状态
- Decides whether and when to use Skills  # 决定用哪个 Skill
- Decides whether to invoke Tools         # 决定调用哪个 Tool
- Determines when tasks are complete      # 判断是否完成
```

类比：

```
Agent = 大脑（决策）
Skills = 知识/经验（指导）
Tools = 手脚（执行）
```

### 1.3 架构理解

```
You (Agent) → Skills (Knowledge) → Tools (Execution)
```

| 层级 | 角色 | 职责 |
|-----|------|------|
| Agent | 决策层 | 思考、判断、选择 |
| Skills | 知识层 | 提供方法论、示例 |
| Tools | 执行层 | 具体动作（API 调用等） |

### 1.4 核心原则（Core Principles）

```markdown
1. Think before acting    # 先思考再行动
2. Minimal intervention   # 最小干预原则
3. Skill-guided behavior  # 遵循 Skill 指导
4. Clear communication    # 清晰沟通
5. Error awareness        # 错误感知
```

### 1.5 决策框架（Decision Framework）

```
1. Understand → 理解任务目标
2. Assess    → 评估可用资源（Skills、Tools）
3. Plan      → 规划步骤
4. Execute   → 执行（调用 Tools）
5. Verify    → 验证结果
6. Report    → 报告总结
```

这是一个标准的 **UAPEVR 决策循环**。

### 1.6 约束条件（Constraints）

```markdown
- Only use Tools that are explicitly available
- Follow the "Do NOT" sections in loaded Skills strictly
- If uncertain, prefer to ask for clarification
- Never modify code outside the scope
- Always respect repository conventions
```

**作用**：防止 Agent 做出越界行为。

---

## 2. `getContextPrompt()` - 获取上下文提示词

根据不同的触发场景，提供额外的上下文指导。

```typescript
export function getContextPrompt(contextType: string): string {
  const contextPrompts: Record<string, string> = {
    github_issue: `...`,
    github_pull_request: `...`,
    github_issue_comment: `...`,
  };

  return contextPrompts[contextType] || '';
}
```

### 2.1 GitHub Issue 上下文

```markdown
## GitHub Issue Context

You are responding to a GitHub issue. Consider:
- Is this a bug report, feature request, or question?
- What information is provided vs. missing?
- What labels are attached?
- Who is the reporter?

Your actions may include:
- Asking clarifying questions via comments
- Proposing solutions
- Creating pull requests with fixes
- Closing invalid issues with explanation
```

**作用**：告诉 Agent "你现在处理的是一个 Issue"

### 2.2 GitHub PR 上下文

```markdown
## GitHub Pull Request Context

You are responding to a pull request. Consider:
- What changes are being proposed?
- Does it follow repository conventions?
- Are there any potential issues or improvements?
- Is it ready for review or needs work?
```

**作用**：告诉 Agent "你现在处理的是一个 PR"

### 2.3 GitHub Comment 上下文

```markdown
## GitHub Comment Context

You are responding to a comment on an issue or PR. Consider:
- Is this a response to your previous action?
- Is there new information or a follow-up request?
- Does this change the task scope?
```

**作用**：告诉 Agent "这是一个评论回复"

---

## 3. `buildSystemPrompt()` - 组合完整提示词

```typescript
export function buildSystemPrompt(contextType: string): string {
  const base = getBasePrompt();
  const context = getContextPrompt(contextType);

  return `${base}\n${context}`;
}
```

**作用**：把基础 Prompt + 上下文 Prompt 组合起来。

```
┌─────────────────────────────┐
│       Base Prompt           │  ← getBasePrompt()
│  (Agent 身份、原则、约束)     │
├─────────────────────────────┤
│     Context Prompt          │  ← getContextPrompt()
│  (Issue/PR/Comment 指导)    │
├─────────────────────────────┤
│     Loaded Skills           │  ← 在 runAgent.ts 中拼接
│  (SKILL.md + examples.md)   │
└─────────────────────────────┘
```

---

## 完整 System Prompt 组装流程

在 `runAgent.ts` 中：

```typescript
// Step 3: Build system prompt with base + skills
const basePrompt = getBasePrompt();                    // ← 调用这里
const skillSection = skillContents.join('\n\n---\n\n');
const systemPrompt = `${basePrompt}\n\n## Loaded Skills\n\n${skillSection}`;
```

### 最终结构

```markdown
# Agent Workflow Engine

You are an intelligent Agent...

## Your Identity
...

## Core Principles
...

## Constraints
...

---

## Loaded Skills

# Skill: bugfix-skill
> Handles bug fix workflows...

[SKILL.md 内容]

## Examples
[examples.md 内容]
```

---

## 设计原理

| 设计决策 | 原因 |
|---------|------|
| 分离 Base 和 Context | 复用基础身份，按场景添加上下文 |
| 明确 "决策者" 角色 | 防止 Agent 直接执行危险操作 |
| 提供决策框架 | 引导 Agent 有条理地思考 |
| 设置约束条件 | 安全边界，防止越界 |
| Skills 动态加载 | 按需加载，避免 prompt 过长 |

---

## 函数调用关系

```
runAgent.ts
    │
    ├── getBasePrompt()          ← prompt.ts
    │       │
    │       └── 返回 Agent 身份 + 原则 + 约束
    │
    ├── loadSkillContent()       ← skillPolicy.ts
    │       │
    │       └── 返回 SKILL.md + examples.md 内容
    │
    └── 拼接成完整 systemPrompt
            │
            └── 传给 callLLM()
```

---

## 关键概念总结

### Agent 的三层架构

```
┌─────────────────────────────────────────┐
│              Agent (决策层)              │
│  - 理解目标                              │
│  - 选择策略                              │
│  - 协调执行                              │
├─────────────────────────────────────────┤
│              Skills (知识层)             │
│  - 提供方法论                            │
│  - 给出示例                              │
│  - 定义约束                              │
├─────────────────────────────────────────┤
│              Tools (执行层)              │
│  - GitHub API 调用                       │
│  - 文件读写                              │
│  - HTTP 请求                             │
└─────────────────────────────────────────┘
```

### Prompt 的作用

| 组成部分 | 作用 |
|---------|------|
| Base Prompt | 定义 Agent 是谁、怎么思考 |
| Context Prompt | 告诉 Agent 当前场景是什么 |
| Skill Content | 教 Agent 怎么处理特定任务 |

三者组合，让 Agent 在特定场景下，用正确的方法，做出正确的决策。
