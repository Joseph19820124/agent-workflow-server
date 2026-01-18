/**
 * Agent Prompt Tests
 */

import {
  getBasePrompt,
  getContextPrompt,
  buildSystemPrompt,
} from '../../agent/prompt';

describe('Agent Prompt', () => {
  describe('getBasePrompt', () => {
    it('should return non-empty string', () => {
      const prompt = getBasePrompt();

      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
    });

    it('should contain agent identity section', () => {
      const prompt = getBasePrompt();

      expect(prompt).toContain('Agent');
      expect(prompt).toContain('Control Plane');
    });

    it('should explain skills concept', () => {
      const prompt = getBasePrompt();

      expect(prompt).toContain('Skills');
      expect(prompt).toContain('Tools');
    });

    it('should include core principles', () => {
      const prompt = getBasePrompt();

      expect(prompt).toContain('Principles');
    });

    it('should include decision framework', () => {
      const prompt = getBasePrompt();

      expect(prompt).toContain('Decision');
    });

    it('should include constraints section', () => {
      const prompt = getBasePrompt();

      expect(prompt).toContain('Constraints');
    });
  });

  describe('getContextPrompt', () => {
    it('should return github_issue context prompt', () => {
      const prompt = getContextPrompt('github_issue');

      expect(typeof prompt).toBe('string');
      expect(prompt).toContain('Issue');
    });

    it('should return github_pull_request context prompt', () => {
      const prompt = getContextPrompt('github_pull_request');

      expect(typeof prompt).toBe('string');
      expect(prompt).toContain('Pull Request');
    });

    it('should return github_issue_comment context prompt', () => {
      const prompt = getContextPrompt('github_issue_comment');

      expect(typeof prompt).toBe('string');
      expect(prompt).toContain('Comment');
    });

    it('should return empty string for unknown context', () => {
      const prompt = getContextPrompt('unknown_context');

      expect(prompt).toBe('');
    });
  });

  describe('buildSystemPrompt', () => {
    it('should combine base and context prompts', () => {
      const prompt = buildSystemPrompt('github_issue');
      const basePrompt = getBasePrompt();
      const contextPrompt = getContextPrompt('github_issue');

      expect(prompt).toContain('Agent');
      expect(prompt.length).toBeGreaterThanOrEqual(
        basePrompt.length + contextPrompt.length
      );
    });

    it('should work with unknown context type', () => {
      const prompt = buildSystemPrompt('unknown');
      const basePrompt = getBasePrompt();

      expect(prompt).toContain(basePrompt);
    });
  });
});
