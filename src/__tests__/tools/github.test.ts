/**
 * GitHub Tools Tests
 */

import * as githubTool from '../../tools/github';

describe('GitHub Tools', () => {
  describe('getIssue', () => {
    it('should return issue data with correct structure', async () => {
      const result = await githubTool.getIssue({
        owner: 'test-owner',
        repo: 'test-repo',
        issueNumber: 123,
      });

      expect(result).toHaveProperty('number', 123);
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('body');
      expect(result).toHaveProperty('state');
      expect(result).toHaveProperty('labels');
      expect(result).toHaveProperty('user');
      expect(Array.isArray(result.labels)).toBe(true);
    });
  });

  describe('createComment', () => {
    it('should return created comment with body', async () => {
      const commentBody = 'Test comment content';
      const result = await githubTool.createComment({
        owner: 'test-owner',
        repo: 'test-repo',
        issueNumber: 123,
        body: commentBody,
      });

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('body', commentBody);
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('created_at');
    });
  });

  describe('createPullRequest', () => {
    it('should return created PR with correct branches', async () => {
      const result = await githubTool.createPullRequest({
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'fix: test fix',
        body: 'Test PR body',
        head: 'feature-branch',
        base: 'main',
      });

      expect(result).toHaveProperty('number');
      expect(result).toHaveProperty('title', 'fix: test fix');
      expect(result).toHaveProperty('state', 'open');
      expect(result.head.ref).toBe('feature-branch');
      expect(result.base.ref).toBe('main');
      expect(result).toHaveProperty('html_url');
    });
  });

  describe('getFileContent', () => {
    it('should return file content with metadata', async () => {
      const result = await githubTool.getFileContent({
        owner: 'test-owner',
        repo: 'test-repo',
        path: 'src/index.ts',
      });

      expect(result).toHaveProperty('name', 'index.ts');
      expect(result).toHaveProperty('path', 'src/index.ts');
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('sha');
      expect(result).toHaveProperty('size');
      expect(typeof result.content).toBe('string');
    });

    it('should accept optional ref parameter', async () => {
      const result = await githubTool.getFileContent({
        owner: 'test-owner',
        repo: 'test-repo',
        path: 'src/index.ts',
        ref: 'develop',
      });

      expect(result).toHaveProperty('content');
    });
  });

  describe('listFiles', () => {
    it('should return array of directory entries', async () => {
      const result = await githubTool.listFiles({
        owner: 'test-owner',
        repo: 'test-repo',
      });

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);

      const entry = result[0];
      expect(entry).toHaveProperty('name');
      expect(entry).toHaveProperty('path');
      expect(entry).toHaveProperty('type');
      expect(['file', 'dir']).toContain(entry.type);
    });

    it('should accept optional path parameter', async () => {
      const result = await githubTool.listFiles({
        owner: 'test-owner',
        repo: 'test-repo',
        path: 'src',
      });

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('validateCredentials', () => {
    it('should return true when GITHUB_TOKEN is set', () => {
      process.env.GITHUB_TOKEN = 'test-token';
      expect(githubTool.validateCredentials()).toBe(true);
    });

    it('should throw error when GITHUB_TOKEN is not set', () => {
      delete process.env.GITHUB_TOKEN;
      expect(() => githubTool.validateCredentials()).toThrow(
        'GITHUB_TOKEN environment variable is not set'
      );
    });
  });

  describe('getRateLimit', () => {
    it('should return rate limit info', async () => {
      const result = await githubTool.getRateLimit();

      expect(result).toHaveProperty('limit');
      expect(result).toHaveProperty('remaining');
      expect(result).toHaveProperty('reset');
      expect(result.reset instanceof Date).toBe(true);
    });
  });
});
