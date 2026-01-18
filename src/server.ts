/**
 * ===========================================
 * Agent Workflow Server - Entry Point
 * ===========================================
 *
 * RESPONSIBILITIES:
 * - Initialize Express server
 * - Register external trigger routes (GitHub webhooks, Cron, Slack)
 * - Load environment configuration
 * - Start the HTTP listener
 *
 * ARCHITECTURE POSITION:
 * This is the outermost layer that receives external triggers
 * and delegates to the Agent for decision-making.
 */

import express, { Application, Request, Response } from 'express';
import dotenv from 'dotenv';
import { githubRouter } from './routes/github';

// Load environment variables
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3000;

// ===========================================
// Middleware
// ===========================================
app.use(express.json());

// ===========================================
// Health Check
// ===========================================
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// ===========================================
// External Trigger Routes
// ===========================================

// GitHub webhook triggers (issues, PRs, etc.)
app.use('/webhooks/github', githubRouter);

// TODO: Add more trigger routes as needed
// app.use('/webhooks/slack', slackRouter);
// app.use('/cron', cronRouter);

// ===========================================
// Error Handler
// ===========================================
app.use((err: Error, _req: Request, res: Response, _next: unknown) => {
  console.error('[Server Error]', err.message);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// ===========================================
// Start Server
// ===========================================
app.listen(PORT, () => {
  console.log(`🚀 Agent Workflow Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 GitHub webhooks: http://localhost:${PORT}/webhooks/github`);
});

export { app };
