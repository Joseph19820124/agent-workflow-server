/**
 * ===========================================
 * GitHub Webhook Route Handler
 * ===========================================
 *
 * RESPONSIBILITIES:
 * - Receive GitHub webhook events (issues, PRs, comments)
 * - Validate webhook signatures (security)
 * - Parse event payload into typed context
 * - Delegate to Agent for decision-making
 *
 * INPUT:
 * - GitHub webhook POST requests with event payload
 * - Headers: X-GitHub-Event, X-Hub-Signature-256
 *
 * OUTPUT:
 * - Acknowledgment response to GitHub (202 Accepted)
 * - Triggers async Agent workflow
 *
 * ARCHITECTURE POSITION:
 * External Trigger → [THIS] → Agent → Skills → Tools
 */

import { Router, Request, Response } from 'express';
import { runAgent } from '../agent/runAgent';
import { IdempotencyGuard } from '../jobs/IdempotencyGuard';

export const githubRouter = Router();

// ===========================================
// Types
// ===========================================

/**
 * Supported GitHub webhook event types
 */
type GitHubEventType = 'issues' | 'pull_request' | 'issue_comment' | 'push';

/**
 * Parsed context from GitHub webhook
 */
interface GitHubContext {
  eventType: GitHubEventType;
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

// ===========================================
// Webhook Signature Validation (Stub)
// ===========================================

/**
 * Validates GitHub webhook signature using HMAC-SHA256
 *
 * @param payload - Raw request body
 * @param signature - X-Hub-Signature-256 header value
 * @returns true if signature is valid
 *
 * TODO: Implement real signature validation
 * Use crypto.timingSafeEqual with HMAC-SHA256
 */
function validateWebhookSignature(
  _payload: string,
  _signature: string | undefined
): boolean {
  // STUB: Always returns true in development
  // TODO: Implement real validation using GITHUB_WEBHOOK_SECRET
  //
  // Real implementation:
  // const hmac = crypto.createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET!);
  // const digest = 'sha256=' + hmac.update(payload).digest('hex');
  // return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));

  console.log('[GitHub] Webhook signature validation (stub - always passes)');
  return true;
}

// ===========================================
// Payload Parser
// ===========================================

/**
 * Parses raw GitHub webhook payload into typed GitHubContext
 *
 * @param eventType - GitHub event type from header
 * @param payload - Webhook JSON payload
 * @param deliveryId - Unique delivery ID for idempotency
 * @returns Parsed GitHubContext
 */
function parseGitHubPayload(
  eventType: string,
  payload: Record<string, unknown>,
  deliveryId: string
): GitHubContext {
  const repo = payload.repository as Record<string, unknown>;
  const sender = payload.sender as Record<string, unknown>;

  const context: GitHubContext = {
    eventType: eventType as GitHubEventType,
    action: payload.action as string,
    repository: {
      owner: (repo?.owner as Record<string, unknown>)?.login as string,
      name: repo?.name as string,
      fullName: repo?.full_name as string,
    },
    sender: {
      login: sender?.login as string,
    },
    deliveryId,
  };

  // Parse issue if present
  if (payload.issue) {
    const issue = payload.issue as Record<string, unknown>;
    context.issue = {
      number: issue.number as number,
      title: issue.title as string,
      body: issue.body as string,
      labels: ((issue.labels as Array<Record<string, unknown>>) || []).map(
        (l) => l.name as string
      ),
    };
  }

  // Parse pull request if present
  if (payload.pull_request) {
    const pr = payload.pull_request as Record<string, unknown>;
    const head = pr.head as Record<string, unknown>;
    const base = pr.base as Record<string, unknown>;
    context.pullRequest = {
      number: pr.number as number,
      title: pr.title as string,
      body: pr.body as string,
      headBranch: head?.ref as string,
      baseBranch: base?.ref as string,
    };
  }

  return context;
}

// ===========================================
// Route Handler
// ===========================================

/**
 * Main webhook endpoint for GitHub events
 *
 * Flow:
 * 1. Validate signature
 * 2. Check idempotency (prevent duplicate processing)
 * 3. Parse payload
 * 4. Delegate to Agent (async)
 * 5. Return 202 Accepted
 */
githubRouter.post('/', async (req: Request, res: Response) => {
  const eventType = req.headers['x-github-event'] as string;
  const signature = req.headers['x-hub-signature-256'] as string;
  const deliveryId = req.headers['x-github-delivery'] as string;

  console.log(`[GitHub] Received event: ${eventType}, delivery: ${deliveryId}`);

  // Step 1: Validate webhook signature
  if (!validateWebhookSignature(JSON.stringify(req.body), signature)) {
    console.error('[GitHub] Invalid webhook signature');
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  // Step 2: Check idempotency
  const guard = new IdempotencyGuard();
  if (await guard.isDuplicate(deliveryId)) {
    console.log(`[GitHub] Duplicate delivery ignored: ${deliveryId}`);
    res.status(200).json({ status: 'duplicate', deliveryId });
    return;
  }

  // Step 3: Parse payload into typed context
  const context = parseGitHubPayload(eventType, req.body, deliveryId);

  // Step 4: Acknowledge immediately, process async
  res.status(202).json({
    status: 'accepted',
    deliveryId,
    message: 'Webhook received, Agent processing started',
  });

  // Step 5: Run Agent asynchronously
  try {
    await runAgent(context);
    await guard.markComplete(deliveryId);
    console.log(`[GitHub] Agent completed for delivery: ${deliveryId}`);
  } catch (error) {
    console.error(`[GitHub] Agent failed for delivery: ${deliveryId}`, error);
    await guard.markFailed(deliveryId, error as Error);
  }
});

/**
 * Supported events endpoint (for documentation)
 */
githubRouter.get('/events', (_req: Request, res: Response) => {
  res.json({
    supportedEvents: ['issues', 'pull_request', 'issue_comment', 'push'],
    description: 'GitHub webhook events that trigger Agent workflows',
  });
});
