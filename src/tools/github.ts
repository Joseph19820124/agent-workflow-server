/**
 * ===========================================
 * GitHub Tools (Execution Layer)
 * ===========================================
 *
 * RESPONSIBILITIES:
 * - Provide concrete GitHub API operations
 * - Handle authentication and rate limiting
 * - Return typed responses
 *
 * INPUT:
 * - Typed parameters for each operation
 *
 * OUTPUT:
 * - GitHub API responses (typed)
 *
 * ARCHITECTURE POSITION:
 * Agent → Skills → [THIS: Tools]
 *
 * KEY CONCEPT:
 * Tools are PURE EXECUTION interfaces.
 * - No decision logic
 * - No business judgment
 * - Just execute and return results
 *
 * The Agent decides WHAT to do.
 * Tools execute HOW to do it.
 */

// ===========================================
// Types
// ===========================================

/**
 * GitHub Issue data structure
 */
export interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  labels: Array<{ name: string; color: string }>;
  user: { login: string };
  created_at: string;
  updated_at: string;
}

/**
 * GitHub Pull Request data structure
 */
export interface GitHubPullRequest {
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed' | 'merged';
  head: { ref: string; sha: string };
  base: { ref: string };
  user: { login: string };
  html_url: string;
}

/**
 * GitHub Comment data structure
 */
export interface GitHubComment {
  id: number;
  body: string;
  user: { login: string };
  created_at: string;
}

/**
 * GitHub File content structure
 */
export interface GitHubFileContent {
  name: string;
  path: string;
  content: string; // Base64 decoded
  sha: string;
  size: number;
}

/**
 * GitHub Directory entry
 */
export interface GitHubDirectoryEntry {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size: number;
}

// ===========================================
// Configuration
// ===========================================

/**
 * Gets GitHub token from environment
 * Returns undefined if not set (allows read-only operations on public repos)
 */
function getGitHubToken(): string | undefined {
  return process.env.GITHUB_TOKEN || undefined;
}

/**
 * Gets GitHub token or throws if not set (for write operations)
 */
function requireGitHubToken(): string {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN environment variable is required for this operation');
  }
  return token;
}

/**
 * Base URL for GitHub API
 */
const GITHUB_API_BASE = 'https://api.github.com';

/**
 * Common headers for GitHub API requests
 */
function getHeaders(requireAuth: boolean = false): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Agent-Workflow-Server',
  };

  const token = requireAuth ? requireGitHubToken() : getGitHubToken();
  if (token) {
    headers['Authorization'] = `token ${token}`;
  }

  return headers;
}

/**
 * Makes a GitHub API request with error handling
 */
async function githubFetch<T>(
  url: string,
  options: RequestInit = {},
  requireAuth: boolean = false
): Promise<T> {
  const headers = {
    ...getHeaders(requireAuth),
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`GitHub API error (${response.status}): ${errorBody}`);
  }

  return response.json() as Promise<T>;
}

// ===========================================
// Issue Operations
// ===========================================

/**
 * Gets details of a GitHub issue
 *
 * @param input.owner - Repository owner
 * @param input.repo - Repository name
 * @param input.issueNumber - Issue number
 * @returns Issue details
 *
 * API: GET /repos/{owner}/{repo}/issues/{issue_number}
 */
export async function getIssue(input: {
  owner: string;
  repo: string;
  issueNumber: number;
}): Promise<GitHubIssue> {
  console.log(`[GitHub Tool] getIssue: ${input.owner}/${input.repo}#${input.issueNumber}`);

  const url = `${GITHUB_API_BASE}/repos/${input.owner}/${input.repo}/issues/${input.issueNumber}`;
  const data = await githubFetch<GitHubIssue>(url);

  return {
    number: data.number,
    title: data.title,
    body: data.body || '',
    state: data.state,
    labels: data.labels || [],
    user: data.user,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

// ===========================================
// Comment Operations
// ===========================================

/**
 * Creates a comment on an issue or pull request
 *
 * @param input.owner - Repository owner
 * @param input.repo - Repository name
 * @param input.issueNumber - Issue or PR number
 * @param input.body - Comment content (Markdown supported)
 * @returns Created comment
 *
 * API: POST /repos/{owner}/{repo}/issues/{issue_number}/comments
 */
export async function createComment(input: {
  owner: string;
  repo: string;
  issueNumber: number;
  body: string;
}): Promise<GitHubComment> {
  console.log(
    `[GitHub Tool] createComment: ${input.owner}/${input.repo}#${input.issueNumber}`
  );
  console.log(`[GitHub Tool] Comment body (${input.body.length} chars)`);

  const url = `${GITHUB_API_BASE}/repos/${input.owner}/${input.repo}/issues/${input.issueNumber}/comments`;
  const data = await githubFetch<GitHubComment>(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: input.body }),
    },
    true // Requires authentication
  );

  console.log(`[GitHub Tool] Comment created: ${data.id}`);
  return {
    id: data.id,
    body: data.body,
    user: data.user,
    created_at: data.created_at,
  };
}

// ===========================================
// Pull Request Operations
// ===========================================

/**
 * Creates a new pull request
 *
 * @param input.owner - Repository owner
 * @param input.repo - Repository name
 * @param input.title - PR title
 * @param input.body - PR description (Markdown supported)
 * @param input.head - Branch containing changes
 * @param input.base - Target branch (e.g., 'main')
 * @returns Created pull request
 *
 * API: POST /repos/{owner}/{repo}/pulls
 */
export async function createPullRequest(input: {
  owner: string;
  repo: string;
  title: string;
  body?: string;
  head: string;
  base: string;
}): Promise<GitHubPullRequest> {
  console.log(`[GitHub Tool] createPullRequest: ${input.owner}/${input.repo}`);
  console.log(`[GitHub Tool] PR: ${input.head} → ${input.base}`);
  console.log(`[GitHub Tool] Title: ${input.title}`);

  const url = `${GITHUB_API_BASE}/repos/${input.owner}/${input.repo}/pulls`;
  const data = await githubFetch<GitHubPullRequest>(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: input.title,
        body: input.body || '',
        head: input.head,
        base: input.base,
      }),
    },
    true // Requires authentication
  );

  console.log(`[GitHub Tool] PR created: ${data.html_url}`);
  return {
    number: data.number,
    title: data.title,
    body: data.body || '',
    state: data.state,
    head: data.head,
    base: data.base,
    user: data.user,
    html_url: data.html_url,
  };
}

// ===========================================
// File Operations
// ===========================================

/**
 * Gets the content of a file from a repository
 *
 * @param input.owner - Repository owner
 * @param input.repo - Repository name
 * @param input.path - File path within repository
 * @param input.ref - Branch, tag, or commit SHA (optional, defaults to default branch)
 * @returns File content (decoded from base64)
 *
 * API: GET /repos/{owner}/{repo}/contents/{path}
 */
export async function getFileContent(input: {
  owner: string;
  repo: string;
  path: string;
  ref?: string;
}): Promise<GitHubFileContent> {
  console.log(`[GitHub Tool] getFileContent: ${input.owner}/${input.repo}/${input.path}`);
  if (input.ref) {
    console.log(`[GitHub Tool] Ref: ${input.ref}`);
  }

  const url = new URL(`${GITHUB_API_BASE}/repos/${input.owner}/${input.repo}/contents/${input.path}`);
  if (input.ref) {
    url.searchParams.set('ref', input.ref);
  }

  interface GitHubContentResponse {
    name: string;
    path: string;
    sha: string;
    size: number;
    content?: string;
    encoding?: string;
    type: string;
  }

  const data = await githubFetch<GitHubContentResponse>(url.toString());

  // Handle directory response
  if (data.type === 'dir' || Array.isArray(data)) {
    throw new Error(`Path "${input.path}" is a directory, not a file. Use listFiles instead.`);
  }

  // Decode base64 content
  let content = '';
  if (data.content && data.encoding === 'base64') {
    content = Buffer.from(data.content, 'base64').toString('utf8');
  } else if (data.content) {
    content = data.content;
  }

  return {
    name: data.name,
    path: data.path,
    content,
    sha: data.sha,
    size: data.size,
  };
}

/**
 * Lists files in a repository directory
 *
 * @param input.owner - Repository owner
 * @param input.repo - Repository name
 * @param input.path - Directory path (optional, defaults to root)
 * @returns Array of directory entries
 *
 * API: GET /repos/{owner}/{repo}/contents/{path}
 */
export async function listFiles(input: {
  owner: string;
  repo: string;
  path?: string;
}): Promise<GitHubDirectoryEntry[]> {
  const dirPath = input.path || '';
  console.log(`[GitHub Tool] listFiles: ${input.owner}/${input.repo}/${dirPath}`);

  const url = `${GITHUB_API_BASE}/repos/${input.owner}/${input.repo}/contents/${dirPath}`;

  interface GitHubContentItem {
    name: string;
    path: string;
    type: 'file' | 'dir' | 'symlink' | 'submodule';
    size: number;
  }

  const data = await githubFetch<GitHubContentItem | GitHubContentItem[]>(url);

  // Handle single file response (when path points to a file)
  if (!Array.isArray(data)) {
    return [{
      name: data.name,
      path: data.path,
      type: data.type === 'file' ? 'file' : 'dir',
      size: data.size,
    }];
  }

  return data.map((item) => ({
    name: item.name,
    path: item.path,
    type: item.type === 'file' ? 'file' : 'dir',
    size: item.size,
  }));
}

// ===========================================
// Utility Functions
// ===========================================

/**
 * Validates that required GitHub credentials are configured
 *
 * @returns true if credentials are valid
 * @throws Error if credentials are missing
 */
export function validateCredentials(): boolean {
  requireGitHubToken(); // Throws if not set
  return true;
}

/**
 * Gets the current rate limit status
 *
 * @returns Rate limit information
 *
 * API: GET /rate_limit
 */
export async function getRateLimit(): Promise<{
  limit: number;
  remaining: number;
  reset: Date;
}> {
  console.log('[GitHub Tool] getRateLimit');

  interface RateLimitResponse {
    rate: {
      limit: number;
      remaining: number;
      reset: number;
    };
  }

  const url = `${GITHUB_API_BASE}/rate_limit`;
  const data = await githubFetch<RateLimitResponse>(url);

  return {
    limit: data.rate.limit,
    remaining: data.rate.remaining,
    reset: new Date(data.rate.reset * 1000),
  };
}
