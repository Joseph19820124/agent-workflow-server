/**
 * ===========================================
 * Idempotency Guard
 * ===========================================
 *
 * RESPONSIBILITIES:
 * - Prevent duplicate processing of the same event
 * - Track job execution status
 * - Enable safe retries without side effects
 *
 * INPUT:
 * - Unique job/delivery identifiers
 *
 * OUTPUT:
 * - Duplicate detection results
 * - Job status updates
 *
 * ARCHITECTURE POSITION:
 * Route → [THIS: Guard] → Agent → Skills → Tools
 *
 * KEY CONCEPT:
 * Idempotency ensures that processing the same event multiple times
 * (due to retries, webhook redelivery, etc.) produces the same result
 * as processing it once.
 *
 * This is critical for:
 * - Webhook handlers (GitHub can redeliver)
 * - Crash recovery (restart mid-processing)
 * - Network issues (timeout with successful server action)
 */

// ===========================================
// Types
// ===========================================

/**
 * Status of a job in the idempotency store
 */
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Job record stored in the idempotency store
 */
export interface JobRecord {
  /** Unique identifier (e.g., GitHub delivery ID) */
  id: string;

  /** Current status */
  status: JobStatus;

  /** When the job was first seen */
  createdAt: Date;

  /** When the job was last updated */
  updatedAt: Date;

  /** When the job completed (if applicable) */
  completedAt?: Date;

  /** Error message if failed */
  error?: string;

  /** Number of processing attempts */
  attempts: number;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Configuration for the IdempotencyGuard
 */
export interface IdempotencyConfig {
  /** Time-to-live for job records (milliseconds) */
  ttl: number;

  /** Maximum number of retry attempts */
  maxAttempts: number;

  /** Minimum time between retries (milliseconds) */
  retryDelay: number;
}

// ===========================================
// In-Memory Store (Stub)
// ===========================================

/**
 * Simple in-memory store for development
 *
 * TODO: Replace with persistent storage (Redis, PostgreSQL, etc.)
 * for production use.
 */
const jobStore = new Map<string, JobRecord>();

// ===========================================
// IdempotencyGuard Class
// ===========================================

/**
 * Guards against duplicate job processing
 *
 * Usage:
 * ```typescript
 * const guard = new IdempotencyGuard();
 *
 * // Check before processing
 * if (await guard.isDuplicate(deliveryId)) {
 *   return; // Already processed
 * }
 *
 * // Process the job
 * await processJob();
 *
 * // Mark as complete
 * await guard.markComplete(deliveryId);
 * ```
 */
export class IdempotencyGuard {
  private config: IdempotencyConfig;

  /**
   * Creates a new IdempotencyGuard
   *
   * @param config - Optional configuration overrides
   */
  constructor(config?: Partial<IdempotencyConfig>) {
    this.config = {
      ttl: 24 * 60 * 60 * 1000, // 24 hours default
      maxAttempts: 3,
      retryDelay: 5000, // 5 seconds
      ...config,
    };
  }

  /**
   * Checks if a job has already been processed or is being processed
   *
   * @param jobId - Unique job identifier
   * @returns true if this is a duplicate (should skip processing)
   *
   * Logic:
   * - If no record exists: not a duplicate, create pending record
   * - If status is 'completed': duplicate, skip
   * - If status is 'processing': duplicate (in progress), skip
   * - If status is 'pending': not a duplicate, can retry
   * - If status is 'failed': check if retries allowed
   */
  async isDuplicate(jobId: string): Promise<boolean> {
    console.log(`[IdempotencyGuard] Checking job: ${jobId}`);

    // STUB: Using in-memory store
    // TODO: Replace with database query
    //
    // Real implementation (PostgreSQL):
    // const result = await db.query(
    //   'SELECT * FROM jobs WHERE id = $1',
    //   [jobId]
    // );
    // const record = result.rows[0];

    const record = jobStore.get(jobId);

    if (!record) {
      // First time seeing this job - create record and allow processing
      await this.createRecord(jobId);
      return false;
    }

    // Already completed - definitely a duplicate
    if (record.status === 'completed') {
      console.log(`[IdempotencyGuard] Job ${jobId} already completed`);
      return true;
    }

    // Currently being processed by another worker
    if (record.status === 'processing') {
      console.log(`[IdempotencyGuard] Job ${jobId} is currently processing`);
      return true;
    }

    // Failed - check if we can retry
    if (record.status === 'failed') {
      if (record.attempts >= this.config.maxAttempts) {
        console.log(`[IdempotencyGuard] Job ${jobId} exceeded max attempts`);
        return true;
      }

      // Allow retry after delay
      const timeSinceLastAttempt = Date.now() - record.updatedAt.getTime();
      if (timeSinceLastAttempt < this.config.retryDelay) {
        console.log(`[IdempotencyGuard] Job ${jobId} in retry cooldown`);
        return true;
      }

      // Allow retry
      await this.markProcessing(jobId);
      return false;
    }

    // Pending - can proceed
    await this.markProcessing(jobId);
    return false;
  }

  /**
   * Creates a new job record in pending status
   *
   * @param jobId - Unique job identifier
   * @param metadata - Optional metadata to store with the job
   */
  private async createRecord(
    jobId: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    console.log(`[IdempotencyGuard] Creating record for job: ${jobId}`);

    const record: JobRecord = {
      id: jobId,
      status: 'processing',
      createdAt: new Date(),
      updatedAt: new Date(),
      attempts: 1,
      metadata,
    };

    // STUB: Using in-memory store
    // TODO: Replace with database insert
    //
    // Real implementation (PostgreSQL):
    // await db.query(
    //   `INSERT INTO jobs (id, status, created_at, updated_at, attempts, metadata)
    //    VALUES ($1, $2, $3, $4, $5, $6)`,
    //   [jobId, 'processing', new Date(), new Date(), 1, metadata]
    // );

    jobStore.set(jobId, record);
  }

  /**
   * Marks a job as currently processing
   *
   * @param jobId - Unique job identifier
   */
  private async markProcessing(jobId: string): Promise<void> {
    console.log(`[IdempotencyGuard] Marking job as processing: ${jobId}`);

    const record = jobStore.get(jobId);
    if (record) {
      record.status = 'processing';
      record.updatedAt = new Date();
      record.attempts += 1;

      // STUB: Using in-memory store
      // TODO: Replace with database update
      jobStore.set(jobId, record);
    }
  }

  /**
   * Marks a job as successfully completed
   *
   * @param jobId - Unique job identifier
   */
  async markComplete(jobId: string): Promise<void> {
    console.log(`[IdempotencyGuard] Marking job as complete: ${jobId}`);

    const record = jobStore.get(jobId);
    if (record) {
      record.status = 'completed';
      record.updatedAt = new Date();
      record.completedAt = new Date();

      // STUB: Using in-memory store
      // TODO: Replace with database update
      //
      // Real implementation (PostgreSQL):
      // await db.query(
      //   `UPDATE jobs
      //    SET status = 'completed', updated_at = $2, completed_at = $2
      //    WHERE id = $1`,
      //   [jobId, new Date()]
      // );

      jobStore.set(jobId, record);
    }
  }

  /**
   * Marks a job as failed
   *
   * @param jobId - Unique job identifier
   * @param error - Error that caused the failure
   */
  async markFailed(jobId: string, error: Error): Promise<void> {
    console.log(`[IdempotencyGuard] Marking job as failed: ${jobId}`);
    console.log(`[IdempotencyGuard] Error: ${error.message}`);

    const record = jobStore.get(jobId);
    if (record) {
      record.status = 'failed';
      record.updatedAt = new Date();
      record.error = error.message;

      // STUB: Using in-memory store
      // TODO: Replace with database update
      jobStore.set(jobId, record);
    }
  }

  /**
   * Gets the current status of a job
   *
   * @param jobId - Unique job identifier
   * @returns Job record or undefined if not found
   */
  async getStatus(jobId: string): Promise<JobRecord | undefined> {
    console.log(`[IdempotencyGuard] Getting status for job: ${jobId}`);

    // STUB: Using in-memory store
    // TODO: Replace with database query
    return jobStore.get(jobId);
  }

  /**
   * Cleans up old job records based on TTL
   *
   * Should be called periodically (e.g., via cron job)
   *
   * @returns Number of records cleaned up
   */
  async cleanup(): Promise<number> {
    console.log('[IdempotencyGuard] Running cleanup');

    const cutoff = Date.now() - this.config.ttl;
    let cleaned = 0;

    // STUB: Using in-memory store
    // TODO: Replace with database delete
    //
    // Real implementation (PostgreSQL):
    // const result = await db.query(
    //   'DELETE FROM jobs WHERE created_at < $1',
    //   [new Date(cutoff)]
    // );
    // return result.rowCount;

    for (const [id, record] of jobStore.entries()) {
      if (record.createdAt.getTime() < cutoff) {
        jobStore.delete(id);
        cleaned++;
      }
    }

    console.log(`[IdempotencyGuard] Cleaned up ${cleaned} old records`);
    return cleaned;
  }

  /**
   * Gets statistics about job processing
   *
   * @returns Job statistics
   */
  async getStats(): Promise<{
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    // STUB: Using in-memory store
    // TODO: Replace with database aggregation

    const stats = {
      total: 0,
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    };

    for (const record of jobStore.values()) {
      stats.total++;
      stats[record.status]++;
    }

    return stats;
  }
}

// ===========================================
// Singleton Instance
// ===========================================

/**
 * Default IdempotencyGuard instance
 *
 * Use this for simple cases. For custom configuration,
 * create a new IdempotencyGuard instance.
 */
export const defaultGuard = new IdempotencyGuard();
