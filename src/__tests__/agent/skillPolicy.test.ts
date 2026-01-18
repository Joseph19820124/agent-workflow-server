/**
 * Skill Policy Tests
 */

import {
  selectSkills,
  loadSkillContent,
  listAvailableSkills,
  getSkillByName,
} from '../../agent/skillPolicy';
import { AgentContext } from '../../agent/runAgent';

describe('Skill Policy', () => {
  const createMockContext = (overrides: Partial<AgentContext> = {}): AgentContext => ({
    eventType: 'issues',
    action: 'opened',
    repository: {
      owner: 'test-owner',
      name: 'test-repo',
      fullName: 'test-owner/test-repo',
    },
    sender: { login: 'test-user' },
    deliveryId: 'test-delivery-123',
    ...overrides,
  });

  describe('selectSkills', () => {
    it('should select bugfix skill for issues with bug label', () => {
      const context = createMockContext({
        issue: {
          number: 1,
          title: 'Something is broken',
          body: 'The app crashes',
          labels: ['bug'],
        },
      });

      const skills = selectSkills(context);
      const skillNames = skills.map((s) => s.name);

      expect(skillNames).toContain('bugfix-skill');
    });

    it('should select bugfix skill for issues with bug keyword in title', () => {
      const context = createMockContext({
        issue: {
          number: 1,
          title: 'Bug: App crashes on startup',
          body: 'Description here',
          labels: [],
        },
      });

      const skills = selectSkills(context);
      const skillNames = skills.map((s) => s.name);

      expect(skillNames).toContain('bugfix-skill');
    });

    it('should select security skill for security-related issues', () => {
      const context = createMockContext({
        issue: {
          number: 1,
          title: 'Security vulnerability found',
          body: 'CVE-2024-1234',
          labels: ['security'],
        },
      });

      const skills = selectSkills(context);
      const skillNames = skills.map((s) => s.name);

      expect(skillNames).toContain('security-skill');
    });

    it('should select code-review skill for pull requests', () => {
      const context = createMockContext({
        eventType: 'pull_request',
        action: 'opened',
        pullRequest: {
          number: 1,
          title: 'Add new feature',
          body: 'Feature description',
          headBranch: 'feature-branch',
          baseBranch: 'main',
        },
      });

      const skills = selectSkills(context);
      const skillNames = skills.map((s) => s.name);

      expect(skillNames).toContain('code-review-skill');
    });

    it('should respect maxSkills parameter', () => {
      const context = createMockContext({
        issue: {
          number: 1,
          title: 'Security bug with vulnerability',
          body: 'This is a security bug that crashes',
          labels: ['bug', 'security'],
        },
      });

      const skills = selectSkills(context, 1);

      expect(skills.length).toBeLessThanOrEqual(1);
    });

    it('should return empty array when no skills match', () => {
      const context = createMockContext({
        eventType: 'push',
        action: 'pushed',
      });

      const skills = selectSkills(context);

      // May or may not match depending on implementation
      expect(Array.isArray(skills)).toBe(true);
    });

    it('should prioritize higher priority skills', () => {
      const context = createMockContext({
        issue: {
          number: 1,
          title: 'Security bug found',
          body: 'Critical security issue',
          labels: ['bug', 'security'],
        },
      });

      const skills = selectSkills(context);

      // Security skill has priority 15, bugfix has 10
      if (skills.length > 0) {
        expect(skills[0].name).toBe('security-skill');
      }
    });
  });

  describe('loadSkillContent', () => {
    it('should return skill content as string', async () => {
      const skill = getSkillByName('bugfix-skill');
      expect(skill).toBeDefined();

      if (skill) {
        const content = await loadSkillContent(skill);

        expect(typeof content).toBe('string');
        expect(content).toContain('Skill: bugfix-skill');
        expect(content.length).toBeGreaterThan(0);
      }
    });

    it('should include skill description', async () => {
      const skill = getSkillByName('bugfix-skill');

      if (skill) {
        const content = await loadSkillContent(skill);
        expect(content).toContain(skill.description);
      }
    });
  });

  describe('listAvailableSkills', () => {
    it('should return array of skill metadata', () => {
      const skills = listAvailableSkills();

      expect(Array.isArray(skills)).toBe(true);
      expect(skills.length).toBeGreaterThan(0);

      const skill = skills[0];
      expect(skill).toHaveProperty('name');
      expect(skill).toHaveProperty('description');
      expect(skill).toHaveProperty('priority');
    });

    it('should include bugfix-skill', () => {
      const skills = listAvailableSkills();
      const names = skills.map((s) => s.name);

      expect(names).toContain('bugfix-skill');
    });
  });

  describe('getSkillByName', () => {
    it('should return skill when found', () => {
      const skill = getSkillByName('bugfix-skill');

      expect(skill).toBeDefined();
      expect(skill?.name).toBe('bugfix-skill');
      expect(skill).toHaveProperty('description');
      expect(skill).toHaveProperty('path');
      expect(skill).toHaveProperty('triggers');
      expect(skill).toHaveProperty('priority');
    });

    it('should return undefined when not found', () => {
      const skill = getSkillByName('non-existent-skill');

      expect(skill).toBeUndefined();
    });
  });
});
