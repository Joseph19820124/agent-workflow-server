# runAgent.ts 代码解析

本文档详细解释 `src/agent/runAgent.ts` 中的每个方法和关键部分。

---

## 整体架构

```
GitHub Webhook
     ↓
AgentContext (结构化数据)
     ↓
buildContextMessage() → Markdown 消息
     ↓
runAgent() 主循环
     ↓
     ├── selectSkills() → 选择相关 Skills
     ├── loadSkillContent() → 加载 Skill 内容
     ├── callLLM() → 调用 LLM
     └── toolRegistry[name]() → 执行工具
            ↓
      GitHub API / 文件系统 / HTTP
```

---

## 1. `getOpenRouterClient()` - 获取 API 客户端

```typescript
let _openrouter: OpenAI | null = null;

function getOpenRouterClient(): OpenAI {
  if (!_openrouter) {
    _openrouter = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY,
      defaultHeaders: {
        'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
        'X-Title': 'Agent Workflow Server',
      },
    });
  }
  return _openrouter;
}
```

**作用**：创建并缓存 OpenRouter API 客户端

**关键点**：
- 使用**单例模式**（`_openrouter` 变量缓存）
- 虽然用的是 `openai` 包，但 `baseURL` 指向 OpenRouter
- OpenRouter 提供 OpenAI 兼容的 API，所以可以用 `openai` 包调用

---

## 2. `getModel()` - 获取模型名称

```typescript
function getModel(): string {
  return process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4';
}
```

**作用**：返回要使用的 LLM 模型

**关键点**：
- 从环境变量读取，支持灵活切换模型
- 默认使用 Claude Sonnet 4

---

## 3. `toolRegistry` - 工具注册表

```typescript
const toolRegistry: Record<string, ToolFunction> = {
  'github_getIssue': githubTool.getIssue,
  'github_createComment': githubTool.createComment,
  'github_createPullRequest': githubTool.createPullRequest,
  // ... 更多工具
};
```

**作用**：工具名称 → 实际函数的映射表

**关键点**：
- Agent 说 "我要调用 `github_getIssue`"
- 代码通过这个表找到对应的函数执行
- 类似于一个**函数路由器**

```
LLM 返回: { name: "github_getIssue", input: {...} }
         ↓
toolRegistry["github_getIssue"]  →  githubTool.getIssue(input)
```

---

## 4. `toolDefinitions` - 工具定义（Schema）

```typescript
const toolDefinitions = [
  {
    name: 'github_getIssue',
    description: 'Get details of a GitHub issue',
    input_schema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner' },
        repo: { type: 'string', description: 'Repository name' },
        issueNumber: { type: 'number', description: 'Issue number' },
      },
      required: ['owner', 'repo', 'issueNumber'],
    },
  },
  // ... 更多工具定义
];
```

**作用**：告诉 LLM "你有哪些工具可以用"

**关键点**：
- `name`：工具名称
- `description`：LLM 靠这个理解工具用途
- `input_schema`：JSON Schema，定义参数格式

**LLM 看到的是这些定义，不是实际代码**。它根据 description 决定何时调用哪个工具。

---

## 5. `convertToolsToOpenAI()` - 格式转换

```typescript
function convertToolsToOpenAI(tools: typeof toolDefinitions): OpenAI.ChatCompletionTool[] {
  return tools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
    },
  }));
}
```

**作用**：把自定义格式转换为 OpenAI API 需要的格式

**转换前后对比**：
```
自定义格式:                    OpenAI 格式:
{                             {
  name: "xxx",         →        type: "function",
  description: "xxx",           function: {
  input_schema: {...}             name: "xxx",
}                                 description: "xxx",
                                  parameters: {...}
                                }
                              }
```

---

## 6. `callLLM()` - 调用大语言模型

```typescript
async function callLLM(
  systemPrompt: string,
  messages: OpenAI.ChatCompletionMessageParam[],
  tools: typeof toolDefinitions
): Promise<{
  content: string;
  toolCalls: ToolCall[];
  finishReason: string;
}>
```

**作用**：向 OpenRouter 发送请求，获取 LLM 响应

### 输入参数

| 参数 | 说明 |
|-----|------|
| `systemPrompt` | 系统提示词（包含 Skills 内容） |
| `messages` | 对话历史 |
| `tools` | 可用工具定义 |

### 输出字段

| 字段 | 说明 |
|-----|------|
| `content` | LLM 的文字回复 |
| `toolCalls` | LLM 想要调用的工具列表 |
| `finishReason` | 结束原因（`stop` 或 `tool_calls`） |

### 核心逻辑

```typescript
const response = await client.chat.completions.create({
  model: model,
  max_tokens: 2048,
  messages: [
    { role: 'system', content: systemPrompt },
    ...messages,
  ],
  tools: openaiTools,
  tool_choice: 'auto',  // 让 LLM 自己决定是否调用工具
});
```

---

## 7. `runAgent()` - 主循环（核心）

这是整个文件最重要的函数，分步骤解释：

### Step 1: 选择 Skills

```typescript
const selectedSkills: Skill[] = selectSkills(context);
```

根据触发事件（如 Issue 的 labels）选择相关的 Skills。

### Step 2: 加载 Skill 内容

```typescript
const skillContents = await Promise.all(
  selectedSkills.map((skill) => loadSkillContent(skill))
);
```

读取 `SKILL.md` 和 `examples.md` 文件内容。

### Step 3: 构建 System Prompt

```typescript
const systemPrompt = `${basePrompt}\n\n## Loaded Skills\n\n${skillSection}`;
```

把基础提示词 + Skill 内容组合成完整的系统提示。

### Step 4: 构建初始消息

```typescript
const initialMessage = buildContextMessage(context);
const messages = [{ role: 'user', content: initialMessage }];
```

把 GitHub 事件转换为 LLM 能理解的消息格式。

### Step 5: Agent 循环

```typescript
while (iteration < MAX_ITERATIONS) {
  iteration++;

  // 5a. 调用 LLM
  const response = await callLLM(systemPrompt, messages, toolDefinitions);

  // 5b. 把 LLM 回复加入历史
  messages.push({ role: 'assistant', content: response.content, ... });

  // 5c. 检查是否完成
  if (response.finishReason === 'stop' && response.toolCalls.length === 0) {
    break;  // 任务完成，退出循环
  }

  // 5d. 执行工具调用
  for (const toolCall of response.toolCalls) {
    const toolFn = toolRegistry[toolCall.name];
    const toolResult = await toolFn(toolCall.input);

    // 5e. 把工具结果加入历史
    messages.push({
      role: 'tool',
      tool_call_id: toolCall.id,
      content: JSON.stringify(toolResult),
    });
  }
}
```

### 循环流程图

```
┌─────────────────────────────────────────────────────────┐
│                     Agent 循环                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   ┌──────────┐                                          │
│   │ 调用 LLM │ ←──────────────────────────────┐        │
│   └────┬─────┘                                │        │
│        ↓                                      │        │
│   ┌──────────────┐                            │        │
│   │ LLM 返回响应 │                            │        │
│   └────┬─────────┘                            │        │
│        ↓                                      │        │
│   ┌──────────────────┐    是                  │        │
│   │ 有 tool_calls？   │───────→ 执行工具 ─────┘        │
│   └────┬─────────────┘         ↓                       │
│        │ 否                    结果加入 messages        │
│        ↓                                               │
│   ┌──────────┐                                         │
│   │ 任务完成 │                                          │
│   └──────────┘                                         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 8. `buildContextMessage()` - 构建上下文消息

```typescript
function buildContextMessage(context: AgentContext): string {
  let message = `# New ${context.eventType} Event\n\n`;
  message += `**Repository:** ${context.repository.fullName}\n`;
  // ...

  if (context.issue) {
    message += `## Issue #${context.issue.number}\n`;
    message += `**Title:** ${context.issue.title}\n`;
    // ...
  }

  return message;
}
```

**作用**：把结构化的 GitHub 事件数据转换为 Markdown 格式的消息

**输入**：`AgentContext` 对象（包含 repo、issue、PR 等信息）

**输出**：格式化的 Markdown 字符串，例如：

```markdown
# New issues Event

**Repository:** owner/repo-name
**Action:** opened
**Triggered by:** username

## Issue #123
**Title:** Fix the login bug
**Labels:** bug, priority-high

### Description
The login button doesn't work when...
```

---

## 关键概念总结

### MAX_ITERATIONS

```typescript
const MAX_ITERATIONS = 15;
```

Agent 循环的最大迭代次数限制，防止无限循环，避免无限消耗 API 调用和资源。

### 消息角色

| 角色 | 说明 |
|-----|------|
| `system` | 系统提示词，定义 Agent 行为 |
| `user` | 用户输入（这里是 GitHub 事件） |
| `assistant` | LLM 的回复 |
| `tool` | 工具执行结果 |

### 工具调用流程

```
1. LLM 决定调用工具 → 返回 tool_calls
2. 代码执行工具 → 通过 toolRegistry 找到函数
3. 结果返回给 LLM → 添加 role: 'tool' 消息
4. LLM 继续处理 → 可能调用更多工具或完成任务
```

---

## 没有使用的 Agent SDK

本项目是**完全手写的 Agent Loop**，没有使用任何现成的 Agent SDK：

| SDK | 状态 |
|-----|------|
| OpenAI Agents SDK | 未使用 |
| Google ADK | 未使用 |
| Anthropic Claude Agent SDK | 未使用 |
| LangChain / LlamaIndex | 未使用 |

`openai` 包只是用来发 HTTP 请求到 OpenRouter（因为 OpenRouter 提供 OpenAI 兼容的 API 格式）。
