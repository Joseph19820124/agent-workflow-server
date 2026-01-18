/**
 * ===========================================
 * Skill Selection Policy
 * ===========================================
 *
 * RESPONSIBILITIES:
 * - Define available Skills and their metadata
 * - Determine which Skills to load based on context
 * - Load Skill content (SKILL.md, examples.md) from filesystem
 *
 * INPUT:
 * - AgentContext from trigger
 *
 * OUTPUT:
 * - List of Skills to load
 * - Loaded Skill content strings
 *
 * ARCHITECTURE POSITION:
 * Agent → [THIS: Skill Loader] → Skills → Tools
 *
 * KEY CONCEPT:
 * Skills are NOT Tools. Skills are "capability packages" that teach
 * the Agent how to approach a class of tasks. They contain:
 * - Instructions / policies
 * - Few-shot examples
 * - Behavioral constraints (do / don't)
 * - Optional tool usage guidance
 */

import * as fs from 'fs';
import * as path from 'path';
import { AgentContext } from './runAgent';

// ===========================================
// Types
// ===========================================

/**
 * Metadata for an Agent Skill
 */
export interface Skill {
  /** Unique identifier for the skill */
  name: string;

  /** Human-readable description */
  description: string;

  /** Path to skill directory (relative to skills/) */
  path: string;

  /** Conditions for when this skill should be loaded */
  triggers: SkillTrigger[];

  /** Priority for selection (higher = selected first when multiple match) */
  priority: number;
}

/**
 * Condition that triggers skill loading
 */
interface SkillTrigger {
  /** Type of trigger condition */
  type: 'event_type' | 'label' | 'keyword' | 'path_pattern';

  /** Value to match against */
  value: string | string[];
}

// ===========================================
// Skill Registry
// ===========================================

/**
 * Registry of all available Skills
 *
 * Each skill defines:
 * - name: unique identifier
 * - description: what the skill does
 * - path: directory containing SKILL.md and examples.md
 * - triggers: conditions that activate this skill
 * - priority: selection order when multiple skills match
 *
 * TODO: Consider loading this from a config file or database
 */
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
    description: 'Reviews code changes and provides feedback',
    path: 'code-review-skill',
    triggers: [
      { type: 'event_type', value: 'pull_request' },
      { type: 'label', value: ['review', 'needs-review'] },
    ],
    priority: 8,
  },
  {
    name: 'security-skill',
    description: 'Analyzes code for security vulnerabilities',
    path: 'security-skill',
    triggers: [
      { type: 'label', value: ['security', 'vulnerability', 'cve'] },
      { type: 'keyword', value: ['security', 'vulnerability', 'exploit', 'cve'] },
    ],
    priority: 15, // High priority - security issues should be flagged first
  },
];

// ===========================================
// Skill Selection Logic
// ===========================================

/**
 * Selects appropriate Skills based on the given context
 *
 * Selection algorithm:
 * 1. Evaluate each skill's triggers against context
 * 2. Collect all matching skills
 * 3. Sort by priority (descending)
 * 4. Return top N skills (default: 3)
 *
 * @param context - Agent context from trigger
 * @param maxSkills - Maximum number of skills to return (default: 3)
 * @returns Array of matching Skills, sorted by priority
 */
export function selectSkills(context: AgentContext, maxSkills = 3): Skill[] {
  console.log('[SkillPolicy] Evaluating skills for context');

  const matchingSkills: Array<{ skill: Skill; score: number }> = [];

  for (const skill of skillRegistry) {
    const score = evaluateSkillMatch(skill, context);
    if (score > 0) {
      matchingSkills.push({ skill, score: score * skill.priority });
      console.log(`[SkillPolicy] Skill "${skill.name}" matched with score ${score}`);
    }
  }

  // Sort by score (descending) and return top N
  matchingSkills.sort((a, b) => b.score - a.score);
  const selected = matchingSkills.slice(0, maxSkills).map((m) => m.skill);

  console.log(
    '[SkillPolicy] Selected skills:',
    selected.map((s) => s.name)
  );
  return selected;
}

/**
 * Evaluates how well a skill matches the given context
 *
 * @param skill - Skill to evaluate
 * @param context - Current context
 * @returns Match score (0 = no match, higher = better match)
 */
function evaluateSkillMatch(skill: Skill, context: AgentContext): number {
  let score = 0;

  for (const trigger of skill.triggers) {
    const triggerScore = evaluateTrigger(trigger, context);
    score += triggerScore;
  }

  return score;
}

/**
 * Evaluates a single trigger condition against context
 *
 * @param trigger - Trigger condition
 * @param context - Current context
 * @returns Score for this trigger (0 = no match)
 */
function evaluateTrigger(trigger: SkillTrigger, context: AgentContext): number {
  switch (trigger.type) {
    case 'event_type': {
      const values = Array.isArray(trigger.value) ? trigger.value : [trigger.value];
      return values.includes(context.eventType) ? 2 : 0;
    }

    case 'label': {
      const values = Array.isArray(trigger.value) ? trigger.value : [trigger.value];
      const labels = context.issue?.labels || [];
      const matchCount = labels.filter((l) =>
        values.some((v) => l.toLowerCase().includes(v.toLowerCase()))
      ).length;
      return matchCount;
    }

    case 'keyword': {
      const values = Array.isArray(trigger.value) ? trigger.value : [trigger.value];
      const textToSearch = [
        context.issue?.title || '',
        context.issue?.body || '',
        context.pullRequest?.title || '',
        context.pullRequest?.body || '',
      ]
        .join(' ')
        .toLowerCase();

      const matchCount = values.filter((v) =>
        textToSearch.includes(v.toLowerCase())
      ).length;
      return matchCount * 0.5; // Keywords are weaker signals
    }

    case 'path_pattern': {
      // TODO: Implement path pattern matching for file-based triggers
      return 0;
    }

    default:
      return 0;
  }
}

// ===========================================
// Skill Content Loading
// ===========================================

/**
 * Loads the content of a Skill from filesystem
 *
 * Reads:
 * - SKILL.md: Main skill instructions
 * - examples.md: Few-shot examples (optional)
 *
 * @param skill - Skill to load
 * @returns Concatenated skill content as string
 *
 * TODO: Add caching for loaded skills
 * TODO: Support loading from remote sources (git, S3)
 */
export async function loadSkillContent(skill: Skill): Promise<string> {
  console.log(`[SkillPolicy] Loading skill content: ${skill.name}`);

  const skillDir = path.join(__dirname, '..', 'skills', skill.path);
  const skillMdPath = path.join(skillDir, 'SKILL.md');
  const examplesPath = path.join(skillDir, 'examples.md');

  let content = `# Skill: ${skill.name}\n\n`;
  content += `> ${skill.description}\n\n`;

  // Load main SKILL.md
  try {
    const skillMd = await readFileAsync(skillMdPath);
    content += skillMd;
  } catch (error) {
    console.warn(`[SkillPolicy] Could not load SKILL.md for ${skill.name}:`, error);
    content += `*SKILL.md not found*\n`;
  }

  // Load examples.md (optional)
  try {
    const examples = await readFileAsync(examplesPath);
    content += `\n\n## Examples\n\n${examples}`;
  } catch {
    // Examples are optional, silently skip if not found
    console.log(`[SkillPolicy] No examples.md for ${skill.name}`);
  }

  return content;
}

/**
 * Helper to read file as promise
 *
 * @param filePath - Path to file
 * @returns File contents as string
 */
async function readFileAsync(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
}

/**
 * Lists all available skills in the registry
 *
 * @returns Array of skill metadata
 */
export function listAvailableSkills(): Array<{
  name: string;
  description: string;
  priority: number;
}> {
  return skillRegistry.map((s) => ({
    name: s.name,
    description: s.description,
    priority: s.priority,
  }));
}

/**
 * Gets a specific skill by name
 *
 * @param name - Skill name
 * @returns Skill if found, undefined otherwise
 */
export function getSkillByName(name: string): Skill | undefined {
  return skillRegistry.find((s) => s.name === name);
}
