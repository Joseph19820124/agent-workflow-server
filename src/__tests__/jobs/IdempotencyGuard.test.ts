/**
 * IdempotencyGuard Tests
 */

import { IdempotencyGuard } from '../../jobs/IdempotencyGuard';

describe('IdempotencyGuard', () => {
  let guard: IdempotencyGuard;

  beforeEach(() => {
    // Create fresh guard for each test
    guard = new IdempotencyGuard({
      ttl: 1000, // 1 second for testing
      maxAttempts: 3,
      retryDelay: 100, // 100ms for testing
    });
  });

  describe('isDuplicate', () => {
    it('should return false for new job', async () => {
      const jobId = `job-${Date.now()}-1`;
      const result = await guard.isDuplicate(jobId);

      expect(result).toBe(false);
    });

    it('should return true for completed job', async () => {
      const jobId = `job-${Date.now()}-2`;

      // First call - not duplicate
      await guard.isDuplicate(jobId);

      // Mark as complete
      await guard.markComplete(jobId);

      // Second call - should be duplicate
      const result = await guard.isDuplicate(jobId);

      expect(result).toBe(true);
    });

    it('should return true for currently processing job', async () => {
      const jobId = `job-${Date.now()}-3`;

      // First call starts processing
      await guard.isDuplicate(jobId);

      // Second call while still processing
      const result = await guard.isDuplicate(jobId);

      expect(result).toBe(true);
    });
  });

  describe('markComplete', () => {
    it('should mark job as completed', async () => {
      const jobId = `job-${Date.now()}-4`;

      await guard.isDuplicate(jobId);
      await guard.markComplete(jobId);

      const status = await guard.getStatus(jobId);

      expect(status).toBeDefined();
      expect(status?.status).toBe('completed');
      expect(status?.completedAt).toBeDefined();
    });
  });

  describe('markFailed', () => {
    it('should mark job as failed with error', async () => {
      const jobId = `job-${Date.now()}-5`;
      const error = new Error('Test error message');

      await guard.isDuplicate(jobId);
      await guard.markFailed(jobId, error);

      const status = await guard.getStatus(jobId);

      expect(status).toBeDefined();
      expect(status?.status).toBe('failed');
      expect(status?.error).toBe('Test error message');
    });

    it('should allow retry after failure within max attempts', async () => {
      const jobId = `job-${Date.now()}-6`;

      // First attempt
      await guard.isDuplicate(jobId);
      await guard.markFailed(jobId, new Error('First failure'));

      // Wait for retry delay
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Second attempt should be allowed
      const result = await guard.isDuplicate(jobId);

      expect(result).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('should return undefined for unknown job', async () => {
      const status = await guard.getStatus('non-existent-job');

      expect(status).toBeUndefined();
    });

    it('should return job record for known job', async () => {
      const jobId = `job-${Date.now()}-7`;

      await guard.isDuplicate(jobId);

      const status = await guard.getStatus(jobId);

      expect(status).toBeDefined();
      expect(status?.id).toBe(jobId);
      expect(status?.status).toBe('processing');
      expect(status?.attempts).toBe(1);
      expect(status?.createdAt).toBeInstanceOf(Date);
      expect(status?.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('getStats', () => {
    it('should return job statistics', async () => {
      const guard = new IdempotencyGuard();

      const stats = await guard.getStats();

      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('pending');
      expect(stats).toHaveProperty('processing');
      expect(stats).toHaveProperty('completed');
      expect(stats).toHaveProperty('failed');
      expect(typeof stats.total).toBe('number');
    });

    it('should count jobs correctly', async () => {
      const guard = new IdempotencyGuard();

      // Create some jobs
      const jobId1 = `stats-job-${Date.now()}-1`;
      const jobId2 = `stats-job-${Date.now()}-2`;

      await guard.isDuplicate(jobId1);
      await guard.markComplete(jobId1);

      await guard.isDuplicate(jobId2);

      const stats = await guard.getStats();

      expect(stats.completed).toBeGreaterThanOrEqual(1);
      expect(stats.processing).toBeGreaterThanOrEqual(1);
    });
  });

  describe('cleanup', () => {
    it('should remove old records', async () => {
      const guard = new IdempotencyGuard({
        ttl: 50, // 50ms TTL for testing
        maxAttempts: 3,
        retryDelay: 100,
      });

      const jobId = `cleanup-job-${Date.now()}`;
      await guard.isDuplicate(jobId);
      await guard.markComplete(jobId);

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 100));

      const cleaned = await guard.cleanup();

      expect(cleaned).toBeGreaterThanOrEqual(1);

      // Job should no longer exist
      const status = await guard.getStatus(jobId);
      expect(status).toBeUndefined();
    });
  });

  describe('configuration', () => {
    it('should use default config when not provided', () => {
      const guard = new IdempotencyGuard();

      // Guard should be created successfully
      expect(guard).toBeDefined();
    });

    it('should accept partial config', () => {
      const guard = new IdempotencyGuard({
        maxAttempts: 5,
      });

      expect(guard).toBeDefined();
    });
  });

  describe('retry logic', () => {
    it('should not allow retry during cooldown period', async () => {
      const guard = new IdempotencyGuard({
        ttl: 10000,
        maxAttempts: 3,
        retryDelay: 1000, // 1 second delay
      });

      const jobId = `retry-job-${Date.now()}`;

      // First attempt
      await guard.isDuplicate(jobId);
      await guard.markFailed(jobId, new Error('Failure'));

      // Immediate retry should be blocked (within cooldown)
      const result = await guard.isDuplicate(jobId);

      expect(result).toBe(true);
    });

    it('should not allow retry after max attempts exceeded', async () => {
      const guard = new IdempotencyGuard({
        ttl: 10000,
        maxAttempts: 2,
        retryDelay: 10, // Short delay for testing
      });

      const jobId = `max-retry-job-${Date.now()}`;

      // First attempt
      await guard.isDuplicate(jobId);
      await guard.markFailed(jobId, new Error('Failure 1'));

      await new Promise((resolve) => setTimeout(resolve, 20));

      // Second attempt
      await guard.isDuplicate(jobId);
      await guard.markFailed(jobId, new Error('Failure 2'));

      await new Promise((resolve) => setTimeout(resolve, 20));

      // Third attempt should be blocked (max 2 attempts)
      const result = await guard.isDuplicate(jobId);

      expect(result).toBe(true);
    });
  });
});
