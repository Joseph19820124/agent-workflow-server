# skillPolicy.ts 代码解析

本文档详细解释 `src/agent/skillPolicy.ts` 中的每个方法和关键部分。

---

## 整体定位

```
Agent → [THIS: Skill Policy] → Skills → Tools
```

这个文件负责**决定 Agent 应该加载哪些 Skills**，类似于一个"能力调度器"。

---

## 1. 类型定义

### `Skill` - 技能元数据

```typescript
export interface Skill {
  name: string;        // 唯一标识符，如 "bugfix-skill"
  description: string; // 人类可读的描述
  path: string;        // 技能目录路径（相对于 skills/）
  triggers: SkillTrigger[]; // 触发条件列表
  priority: number;    // 优先级（越高越先被选中）
}
```

### `SkillTrigger` - 触发条件

```typescript
interface SkillTrigger {
  type: 'event_type' | 'label' | 'keyword' | 'path_pattern';
  value: string | string[];
}
```

| 类型 | 说明 | 示例 |
|-----|------|------|
| `event_type` | GitHub 事件类型 | `pull_request`, `issues` |
| `label` | Issue/PR 标签 | `bug`, `security` |
| `keyword` | 标题/正文关键词 | `error`, `crash` |
| `path_pattern` | 文件路径模式 | `*.ts`（未实现） |

---

## 2. `skillRegistry` - 技能注册表

```typescript
const skillRegistry: Skill[] = [
  {
    name: 'bugfix-skill',
    description: 'Handles bug fix workflows: analyze, fix, and PR',
    path: 'bugfix-skill',
    triggers: [
      { type: 'label', value: ['bug', 'bugfix', 'fix'] },
      { type: 'keyword', value: ['bug', 'error', 'crash', 'broken', 'fix'] },
    ],
    priority: 10,
  },
  {
    name: 'code-review-skill',
    // ...
    priority: 8,
  },
  {
    name: 'security-skill',
    // ...
    priority: 15,  // 安全问题优先级最高
  },
];
```

**作用**：定义所有可用的 Skills 及其触发规则

**文件结构对应**：

```
src/skills/
├── bugfix-skill/
│   ├── SKILL.md      # 技能指令
│   └── examples.md   # 示例
├── code-review-skill/
│   └── ...
└── security-skill/
    └── ...
```

---

## 3. `selectSkills()` - 技能选择（核心）

```typescript
export function selectSkills(context: AgentContext, maxSkills = 3): Skill[] {
  const matchingSkills: Array<{ skill: Skill; score: number }> = [];

  // 1. 遍历所有技能，计算匹配分数
  for (const skill of skillRegistry) {
    const score = evaluateSkillMatch(skill, context);
    if (score > 0) {
      matchingSkills.push({ skill, score: score * skill.priority });
    }
  }

  // 2. 按分数降序排序
  matchingSkills.sort((a, b) => b.score - a.score);

  // 3. 返回前 N 个
  return matchingSkills.slice(0, maxSkills).map((m) => m.skill);
}
```

### 选择流程示例

```
输入: GitHub Issue (labels: ["bug"], title: "Login crash")
         ↓
┌─────────────────────────────────────────────┐
│  遍历 skillRegistry                          │
├─────────────────────────────────────────────┤
│  bugfix-skill:                              │
│    - label "bug" 匹配 → +1                  │
│    - keyword "crash" 匹配 → +0.5            │
│    - 原始分数: 1.5                           │
│    - 最终分数: 1.5 × 10 (priority) = 15     │
├─────────────────────────────────────────────┤
│  security-skill:                            │
│    - 无匹配 → 0                             │
├─────────────────────────────────────────────┤
│  code-review-skill:                         │
│    - 无匹配 → 0                             │
└─────────────────────────────────────────────┘
         ↓
输出: [bugfix-skill]
```

---

## 4. `evaluateSkillMatch()` - 计算匹配分数

```typescript
function evaluateSkillMatch(skill: Skill, context: AgentContext): number {
  let score = 0;

  for (const trigger of skill.triggers) {
    const triggerScore = evaluateTrigger(trigger, context);
    score += triggerScore;
  }

  return score;
}
```

**作用**：遍历技能的所有触发条件，累加分数

---

## 5. `evaluateTrigger()` - 评估单个触发条件

```typescript
function evaluateTrigger(trigger: SkillTrigger, context: AgentContext): number {
  switch (trigger.type) {
    case 'event_type': {
      // 事件类型完全匹配 → 2分
      return values.includes(context.eventType) ? 2 : 0;
    }

    case 'label': {
      // 标签匹配数量 → 每个1分
      const labels = context.issue?.labels || [];
      const matchCount = labels.filter(l =>
        values.some(v => l.toLowerCase().includes(v.toLowerCase()))
      ).length;
      return matchCount;
    }

    case 'keyword': {
      // 关键词匹配 → 每个0.5分（较弱信号）
      const textToSearch = [
        context.issue?.title,
        context.issue?.body,
        // ...
      ].join(' ').toLowerCase();

      const matchCount = values.filter(v =>
        textToSearch.includes(v.toLowerCase())
      ).length;
      return matchCount * 0.5;
    }

    case 'path_pattern': {
      // TODO: 未实现
      return 0;
    }
  }
}
```

### 分数权重设计

| 触发类型 | 单次匹配分数 | 原因 |
|---------|------------|------|
| `event_type` | 2 | 精确匹配，强信号 |
| `label` | 1 | 用户明确标记 |
| `keyword` | 0.5 | 模糊匹配，较弱信号 |

---

## 6. `loadSkillContent()` - 加载技能内容

```typescript
export async function loadSkillContent(skill: Skill): Promise<string> {
  const skillDir = path.join(__dirname, '..', 'skills', skill.path);
  const skillMdPath = path.join(skillDir, 'SKILL.md');
  const examplesPath = path.join(skillDir, 'examples.md');

  let content = `# Skill: ${skill.name}\n\n`;
  content += `> ${skill.description}\n\n`;

  // 加载主文件 SKILL.md（必需）
  try {
    const skillMd = await readFileAsync(skillMdPath);
    content += skillMd;
  } catch (error) {
    content += `*SKILL.md not found*\n`;
  }

  // 加载示例 examples.md（可选）
  try {
    const examples = await readFileAsync(examplesPath);
    content += `\n\n## Examples\n\n${examples}`;
  } catch {
    // 跳过，不报错
  }

  return content;
}
```

### 输出示例

```markdown
# Skill: bugfix-skill

> Handles bug fix workflows: analyze, fix, and PR

[SKILL.md 内容...]

## Examples

[examples.md 内容...]
```

这个字符串会被拼接到 Agent 的 System Prompt 中。

---

## 7. 辅助函数

### `readFileAsync()` - 读取文件

```typescript
async function readFileAsync(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
}
```

把 Node.js 的回调式 `fs.readFile` 包装成 Promise。

### `listAvailableSkills()` - 列出所有技能

```typescript
export function listAvailableSkills() {
  return skillRegistry.map((s) => ({
    name: s.name,
    description: s.description,
    priority: s.priority,
  }));
}
```

返回所有注册技能的基本信息。

### `getSkillByName()` - 按名称获取技能

```typescript
export function getSkillByName(name: string): Skill | undefined {
  return skillRegistry.find((s) => s.name === name);
}
```

根据名称查找特定技能。

---

## 完整流程图

```
GitHub Webhook 到达
       ↓
AgentContext { eventType: "issues", labels: ["bug"], title: "..." }
       ↓
selectSkills(context)
       ↓
┌──────────────────────────────────────────┐
│  对每个 Skill 调用 evaluateSkillMatch()   │
│       ↓                                  │
│  对每个 Trigger 调用 evaluateTrigger()    │
│       ↓                                  │
│  累加分数 × priority                      │
│       ↓                                  │
│  排序，取 top 3                           │
└──────────────────────────────────────────┘
       ↓
[bugfix-skill, ...]
       ↓
loadSkillContent(skill)
       ↓
读取 SKILL.md + examples.md
       ↓
拼接到 System Prompt
       ↓
Agent 开始执行
```

---

## 关键概念

### Skills vs Tools

| | Skills | Tools |
|--|--------|-------|
| 是什么 | 能力包/知识包 | 执行函数 |
| 包含 | 指令、示例、约束 | 具体代码实现 |
| 作用 | 教 Agent **怎么思考** | 让 Agent **执行动作** |
| 文件 | SKILL.md, examples.md | github.ts, fs.ts |

### Priority 优先级

```typescript
security-skill:  priority = 15  // 最高，安全问题优先
bugfix-skill:    priority = 10  // 中等
code-review:     priority = 8   // 较低
```

当多个 Skills 同时匹配时，高优先级的 Skill 会被优先选中。

### maxSkills 限制

```typescript
selectSkills(context, maxSkills = 3)
```

默认最多加载 3 个 Skills，避免 System Prompt 过长。
