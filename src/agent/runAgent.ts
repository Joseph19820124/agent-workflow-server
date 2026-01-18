/**
 * ===========================================
 * Agent Main Loop
 * ===========================================
 *
 * RESPONSIBILITIES:
 * - Orchestrate the Agent decision-making cycle
 * - Load appropriate Agent Skills based on context
 * - Execute tool calls as directed by Claude
 * - Manage conversation state and termination conditions
 *
 * INPUT:
 * - Context from external trigger (e.g., GitHubContext)
 *
 * OUTPUT:
 * - Side effects via Tools (PRs, comments, file changes)
 * - Completion status
 *
 * ARCHITECTURE POSITION:
 * Route → [THIS: Agent] → Skills → Tools
 *
 * KEY CONCEPT:
 * Agent = Decision & Control Plane
 * - Understands goals
 * - Judges current state
 * - Decides whether/when to load Skills
 * - Decides whether to call Tools
 * - Judges if task is complete
 *
 * Agent does NOT directly execute any business actions.
 */

import Anthropic from '@anthropic-ai/sdk';
import { getBasePrompt } from './prompt';
import { selectSkills, loadSkillContent, Skill } from './skillPolicy';
import * as githubTool from '../tools/github';
import * as fsTool from '../tools/fs';
import * as httpTool from '../tools/http';

// Initialize Anthropic client
const anthropic = new Anthropic();

// ===========================================
// Types
// ===========================================

/**
 * Generic context passed from trigger routes
 */
export interface AgentContext {
  eventType: string;
  action: string;
  repository: {
    owner: string;
    name: string;
    fullName: string;
  };
  issue?: {
    number: number;
    title: string;
    body: string;
    labels: string[];
  };
  pullRequest?: {
    number: number;
    title: string;
    body: string;
    headBranch: string;
    baseBranch: string;
  };
  sender: {
    login: string;
  };
  deliveryId: string;
}

/**
 * Message in the conversation history
 */
interface Message {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Tool call request from Claude
 */
interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/**
 * Result of Agent execution
 */
export interface AgentResult {
  success: boolean;
  completedSteps: string[];
  error?: string;
}

// ===========================================
// Tool Registry
// ===========================================

/**
 * Generic tool function type
 * Using 'any' here to allow flexible tool signatures while maintaining
 * runtime type safety through the tool definitions schema validation.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ToolFunction = (input: any) => Promise<unknown>;

/**
 * Maps tool names to their implementations
 *
 * Tools are pure execution interfaces - they contain
 * no decision logic, no business judgment.
 */
const toolRegistry: Record<string, ToolFunction> = {
  // GitHub Tools
  'github.getIssue': githubTool.getIssue,
  'github.createComment': githubTool.createComment,
  'github.createPullRequest': githubTool.createPullRequest,
  'github.getFileContent': githubTool.getFileContent,
  'github.listFiles': githubTool.listFiles,

  // File System Tools
  'fs.readFile': fsTool.readFile,
  'fs.writeFile': fsTool.writeFile,
  'fs.listDirectory': fsTool.listDirectory,

  // HTTP Tools
  'http.get': httpTool.get,
  'http.post': httpTool.post,
};

/**
 * Tool definitions for Claude API
 * These describe what tools are available and their parameters
 */
const toolDefinitions = [
  {
    name: 'github.getIssue',
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
  {
    name: 'github.createComment',
    description: 'Create a comment on an issue or PR',
    input_schema: {
      type: 'object',
      properties: {
        owner: { type: 'string' },
        repo: { type: 'string' },
        issueNumber: { type: 'number' },
        body: { type: 'string', description: 'Comment content' },
      },
      required: ['owner', 'repo', 'issueNumber', 'body'],
    },
  },
  {
    name: 'github.createPullRequest',
    description: 'Create a new pull request',
    input_schema: {
      type: 'object',
      properties: {
        owner: { type: 'string' },
        repo: { type: 'string' },
        title: { type: 'string' },
        body: { type: 'string' },
        head: { type: 'string', description: 'Branch with changes' },
        base: { type: 'string', description: 'Target branch' },
      },
      required: ['owner', 'repo', 'title', 'head', 'base'],
    },
  },
  {
    name: 'github.getFileContent',
    description: 'Get content of a file from repository',
    input_schema: {
      type: 'object',
      properties: {
        owner: { type: 'string' },
        repo: { type: 'string' },
        path: { type: 'string', description: 'File path in repo' },
        ref: { type: 'string', description: 'Branch or commit SHA' },
      },
      required: ['owner', 'repo', 'path'],
    },
  },
  {
    name: 'github.listFiles',
    description: 'List files in a directory',
    input_schema: {
      type: 'object',
      properties: {
        owner: { type: 'string' },
        repo: { type: 'string' },
        path: { type: 'string' },
      },
      required: ['owner', 'repo'],
    },
  },
  {
    name: 'fs.readFile',
    description: 'Read a local file',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' },
      },
      required: ['path'],
    },
  },
  {
    name: 'fs.writeFile',
    description: 'Write content to a local file',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        content: { type: 'string' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'fs.listDirectory',
    description: 'List files in a local directory',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
      },
      required: ['path'],
    },
  },
  {
    name: 'http.get',
    description: 'Make an HTTP GET request',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        headers: { type: 'object' },
      },
      required: ['url'],
    },
  },
  {
    name: 'http.post',
    description: 'Make an HTTP POST request',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        body: { type: 'object' },
        headers: { type: 'object' },
      },
      required: ['url'],
    },
  },
];

// ===========================================
// Claude API Integration
// ===========================================

/**
 * Calls Claude API with messages and tools
 *
 * @param systemPrompt - System instructions including loaded Skills
 * @param messages - Conversation history (Anthropic format)
 * @param tools - Available tool definitions
 * @returns Claude's response with potential tool calls
 */
async function callClaude(
  systemPrompt: string,
  messages: Anthropic.MessageParam[],
  tools: typeof toolDefinitions
): Promise<{
  content: string;
  toolCalls: ToolCall[];
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens';
  rawContentBlocks: Anthropic.ContentBlock[];
}> {
  console.log('[Agent] Calling Claude API');
  console.log('[Agent] System prompt length:', systemPrompt.length);
  console.log('[Agent] Messages:', messages.length);
  console.log('[Agent] Available tools:', tools.length);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: systemPrompt,
    messages: messages,
    tools: tools as Anthropic.Tool[],
  });

  // Extract text content and tool calls from response
  let textContent = '';
  const toolCalls: ToolCall[] = [];

  for (const block of response.content) {
    if (block.type === 'text') {
      textContent += block.text;
    } else if (block.type === 'tool_use') {
      toolCalls.push({
        id: block.id,
        name: block.name,
        input: block.input as Record<string, unknown>,
      });
    }
  }

  console.log('[Agent] Response stop_reason:', response.stop_reason);
  console.log('[Agent] Tool calls:', toolCalls.length);

  return {
    content: textContent,
    toolCalls,
    stopReason: response.stop_reason as 'end_turn' | 'tool_use' | 'max_tokens',
    rawContentBlocks: response.content,
  };
}

// ===========================================
// Main Agent Loop
// ===========================================

/**
 * Main Agent execution function
 *
 * Flow:
 * 1. Build initial context message from trigger
 * 2. Select appropriate Skills based on context
 * 3. Load Skill content into system prompt
 * 4. Enter Agent loop:
 *    a. Call Claude with current state
 *    b. If tool calls requested, execute them
 *    c. Add results to conversation
 *    d. Repeat until task complete or max iterations
 *
 * @param context - Trigger context (e.g., GitHub issue)
 * @returns Agent execution result
 */
export async function runAgent(context: AgentContext): Promise<AgentResult> {
  console.log('[Agent] Starting agent run');
  console.log('[Agent] Context:', JSON.stringify(context, null, 2));

  const completedSteps: string[] = [];

  try {
    // Step 1: Select appropriate Skills for this context
    const selectedSkills: Skill[] = selectSkills(context);
    console.log(
      '[Agent] Selected skills:',
      selectedSkills.map((s) => s.name)
    );
    completedSteps.push(`Selected ${selectedSkills.length} skills`);

    // Step 2: Load Skill content
    const skillContents = await Promise.all(
      selectedSkills.map((skill) => loadSkillContent(skill))
    );
    completedSteps.push('Loaded skill content');

    // Step 3: Build system prompt with base + skills
    const basePrompt = getBasePrompt();
    const skillSection = skillContents.join('\n\n---\n\n');
    const systemPrompt = `${basePrompt}\n\n## Loaded Skills\n\n${skillSection}`;

    // Step 4: Build initial user message from context
    const initialMessage = buildContextMessage(context);
    const messages: Anthropic.MessageParam[] = [
      { role: 'user', content: initialMessage },
    ];

    // Step 5: Agent loop
    const MAX_ITERATIONS = 10;
    let iteration = 0;

    while (iteration < MAX_ITERATIONS) {
      iteration++;
      console.log(`[Agent] Iteration ${iteration}/${MAX_ITERATIONS}`);

      // Call Claude
      const response = await callClaude(systemPrompt, messages, toolDefinitions);

      // Add assistant response to history (with raw content blocks for tool_use)
      messages.push({
        role: 'assistant',
        content: response.rawContentBlocks,
      });

      // Check if we're done
      if (response.stopReason === 'end_turn' && response.toolCalls.length === 0) {
        console.log('[Agent] Task completed');
        console.log('[Agent] Final response:', response.content);
        completedSteps.push('Task completed');
        break;
      }

      // Execute tool calls if any
      if (response.toolCalls.length > 0) {
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const toolCall of response.toolCalls) {
          console.log(`[Agent] Executing tool: ${toolCall.name}`);
          completedSteps.push(`Executed tool: ${toolCall.name}`);

          const toolFn = toolRegistry[toolCall.name];
          if (!toolFn) {
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolCall.id,
              content: `Error: Unknown tool "${toolCall.name}"`,
              is_error: true,
            });
            continue;
          }

          try {
            const toolResult = await toolFn(toolCall.input);
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolCall.id,
              content: JSON.stringify(toolResult, null, 2),
            });
          } catch (error) {
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolCall.id,
              content: `Error: ${(error as Error).message}`,
              is_error: true,
            });
          }
        }

        // Add tool results as user message
        messages.push({
          role: 'user',
          content: toolResults,
        });
      }
    }

    if (iteration >= MAX_ITERATIONS) {
      console.warn('[Agent] Max iterations reached');
      completedSteps.push('Max iterations reached');
    }

    return {
      success: true,
      completedSteps,
    };
  } catch (error) {
    console.error('[Agent] Error:', error);
    return {
      success: false,
      completedSteps,
      error: (error as Error).message,
    };
  }
}

/**
 * Builds the initial context message for Claude
 *
 * @param context - Trigger context
 * @returns Formatted message string
 */
function buildContextMessage(context: AgentContext): string {
  let message = `# New ${context.eventType} Event\n\n`;
  message += `**Repository:** ${context.repository.fullName}\n`;
  message += `**Action:** ${context.action}\n`;
  message += `**Triggered by:** ${context.sender.login}\n\n`;

  if (context.issue) {
    message += `## Issue #${context.issue.number}\n`;
    message += `**Title:** ${context.issue.title}\n`;
    message += `**Labels:** ${context.issue.labels.join(', ') || 'none'}\n\n`;
    message += `### Description\n${context.issue.body || 'No description provided.'}\n`;
  }

  if (context.pullRequest) {
    message += `## Pull Request #${context.pullRequest.number}\n`;
    message += `**Title:** ${context.pullRequest.title}\n`;
    message += `**Branch:** ${context.pullRequest.headBranch} → ${context.pullRequest.baseBranch}\n\n`;
    message += `### Description\n${context.pullRequest.body || 'No description provided.'}\n`;
  }

  message += `\n---\n\nPlease analyze this event and take appropriate action based on your loaded skills.`;

  return message;
}
