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
// Branch Operations (Phase 3 Support)
// ===========================================

/**
 * GitHub Branch data structure
 */
export interface GitHubBranch {
  name: string;
  sha: string;
  protected: boolean;
}

/**
 * GitHub File commit result
 */
export interface GitHubFileCommitResult {
  path: string;
  sha: string;
  commitSha: string;
  commitUrl: string;
}

/**
 * Gets information about a branch
 *
 * @param input.owner - Repository owner
 * @param input.repo - Repository name
 * @param input.branch - Branch name
 * @returns Branch information including SHA
 *
 * API: GET /repos/{owner}/{repo}/branches/{branch}
 */
export async function getBranch(input: {
  owner: string;
  repo: string;
  branch: string;
}): Promise<GitHubBranch> {
  console.log(`[GitHub Tool] getBranch: ${input.owner}/${input.repo}/${input.branch}`);

  const url = `${GITHUB_API_BASE}/repos/${input.owner}/${input.repo}/branches/${input.branch}`;

  interface BranchResponse {
    name: string;
    commit: { sha: string };
    protected: boolean;
  }

  const data = await githubFetch<BranchResponse>(url);

  return {
    name: data.name,
    sha: data.commit.sha,
    protected: data.protected,
  };
}

/**
 * Creates a new branch from a reference
 *
 * @param input.owner - Repository owner
 * @param input.repo - Repository name
 * @param input.branch - New branch name
 * @param input.fromBranch - Source branch to create from (defaults to 'main')
 * @returns Created branch information
 *
 * API: POST /repos/{owner}/{repo}/git/refs
 */
export async function createBranch(input: {
  owner: string;
  repo: string;
  branch: string;
  fromBranch?: string;
}): Promise<GitHubBranch> {
  const sourceBranch = input.fromBranch || 'main';
  console.log(`[GitHub Tool] createBranch: ${input.owner}/${input.repo}/${input.branch} from ${sourceBranch}`);

  // First, get the SHA of the source branch
  const sourceInfo = await getBranch({
    owner: input.owner,
    repo: input.repo,
    branch: sourceBranch,
  });

  // Create the new branch reference
  const url = `${GITHUB_API_BASE}/repos/${input.owner}/${input.repo}/git/refs`;

  interface RefResponse {
    ref: string;
    object: { sha: string };
  }

  const data = await githubFetch<RefResponse>(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ref: `refs/heads/${input.branch}`,
        sha: sourceInfo.sha,
      }),
    },
    true // Requires authentication
  );

  console.log(`[GitHub Tool] Branch created: ${input.branch} at ${data.object.sha}`);
  return {
    name: input.branch,
    sha: data.object.sha,
    protected: false,
  };
}

/**
 * Creates or updates a file in the repository
 * This creates a commit with the file change
 *
 * @param input.owner - Repository owner
 * @param input.repo - Repository name
 * @param input.path - File path in the repository
 * @param input.content - File content (will be base64 encoded)
 * @param input.message - Commit message
 * @param input.branch - Target branch
 * @param input.sha - File SHA (required for updates, omit for new files)
 * @returns Commit result
 *
 * API: PUT /repos/{owner}/{repo}/contents/{path}
 */
export async function createOrUpdateFile(input: {
  owner: string;
  repo: string;
  path: string;
  content: string;
  message: string;
  branch: string;
  sha?: string;
}): Promise<GitHubFileCommitResult> {
  console.log(`[GitHub Tool] createOrUpdateFile: ${input.owner}/${input.repo}/${input.path}`);
  console.log(`[GitHub Tool] Branch: ${input.branch}, Message: ${input.message}`);
  console.log(`[GitHub Tool] Content length: ${input.content.length} chars`);

  const url = `${GITHUB_API_BASE}/repos/${input.owner}/${input.repo}/contents/${input.path}`;

  // Base64 encode the content
  const encodedContent = Buffer.from(input.content).toString('base64');

  interface FileCommitResponse {
    content: {
      path: string;
      sha: string;
    };
    commit: {
      sha: string;
      html_url: string;
    };
  }

  const requestBody: Record<string, string> = {
    message: input.message,
    content: encodedContent,
    branch: input.branch,
  };

  // Include SHA for updates (required by GitHub API)
  if (input.sha) {
    requestBody.sha = input.sha;
  }

  const data = await githubFetch<FileCommitResponse>(
    url,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    },
    true // Requires authentication
  );

  console.log(`[GitHub Tool] File committed: ${data.commit.sha}`);
  return {
    path: data.content.path,
    sha: data.content.sha,
    commitSha: data.commit.sha,
    commitUrl: data.commit.html_url,
  };
}

/**
 * Gets the SHA of a file (needed for updates)
 *
 * @param input.owner - Repository owner
 * @param input.repo - Repository name
 * @param input.path - File path
 * @param input.branch - Branch name
 * @returns File SHA or null if file doesn't exist
 */
export async function getFileSha(input: {
  owner: string;
  repo: string;
  path: string;
  branch?: string;
}): Promise<string | null> {
  console.log(`[GitHub Tool] getFileSha: ${input.owner}/${input.repo}/${input.path}`);

  try {
    const file = await getFileContent({
      owner: input.owner,
      repo: input.repo,
      path: input.path,
      ref: input.branch,
    });
    return file.sha;
  } catch (error) {
    // File doesn't exist
    console.log(`[GitHub Tool] File not found, will create new`);
    return null;
  }
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

// ===========================================
// Pull Request Operations (Code Review Support)
// ===========================================

/**
 * PR file change information
 */
export interface GitHubPullRequestFile {
  sha: string;
  filename: string;
  status: 'added' | 'removed' | 'modified' | 'renamed' | 'copied' | 'changed' | 'unchanged';
  additions: number;
  deletions: number;
  changes: number;
  patch?: string; // Diff patch (may be missing for large files)
}

/**
 * PR review result
 */
export interface GitHubPullRequestReview {
  id: number;
  user: { login: string };
  body: string;
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'PENDING';
  html_url: string;
  submitted_at: string;
}

/**
 * Gets details of a pull request
 *
 * @param input.owner - Repository owner
 * @param input.repo - Repository name
 * @param input.pullNumber - Pull request number
 * @returns Pull request details
 *
 * API: GET /repos/{owner}/{repo}/pulls/{pull_number}
 */
export async function getPullRequest(input: {
  owner: string;
  repo: string;
  pullNumber: number;
}): Promise<GitHubPullRequest> {
  console.log(`[GitHub Tool] getPullRequest: ${input.owner}/${input.repo}#${input.pullNumber}`);

  const url = `${GITHUB_API_BASE}/repos/${input.owner}/${input.repo}/pulls/${input.pullNumber}`;
  const data = await githubFetch<GitHubPullRequest>(url);

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

/**
 * Lists files changed in a pull request
 *
 * @param input.owner - Repository owner
 * @param input.repo - Repository name
 * @param input.pullNumber - Pull request number
 * @returns Array of changed files with diff patches
 *
 * API: GET /repos/{owner}/{repo}/pulls/{pull_number}/files
 */
export async function listPullRequestFiles(input: {
  owner: string;
  repo: string;
  pullNumber: number;
}): Promise<GitHubPullRequestFile[]> {
  console.log(`[GitHub Tool] listPullRequestFiles: ${input.owner}/${input.repo}#${input.pullNumber}`);

  const url = `${GITHUB_API_BASE}/repos/${input.owner}/${input.repo}/pulls/${input.pullNumber}/files`;
  const data = await githubFetch<GitHubPullRequestFile[]>(url);

  console.log(`[GitHub Tool] Found ${data.length} changed files`);
  return data.map((file) => ({
    sha: file.sha,
    filename: file.filename,
    status: file.status,
    additions: file.additions,
    deletions: file.deletions,
    changes: file.changes,
    patch: file.patch,
  }));
}

/**
 * Creates a review on a pull request
 *
 * @param input.owner - Repository owner
 * @param input.repo - Repository name
 * @param input.pullNumber - Pull request number
 * @param input.body - Review comment body
 * @param input.event - Review action: APPROVE, REQUEST_CHANGES, or COMMENT
 * @returns Created review
 *
 * API: POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews
 */
export async function createPullRequestReview(input: {
  owner: string;
  repo: string;
  pullNumber: number;
  body: string;
  event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';
}): Promise<GitHubPullRequestReview> {
  console.log(`[GitHub Tool] createPullRequestReview: ${input.owner}/${input.repo}#${input.pullNumber}`);
  console.log(`[GitHub Tool] Review event: ${input.event}`);

  const url = `${GITHUB_API_BASE}/repos/${input.owner}/${input.repo}/pulls/${input.pullNumber}/reviews`;
  const data = await githubFetch<GitHubPullRequestReview>(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        body: input.body,
        event: input.event,
      }),
    },
    true // Requires authentication
  );

  console.log(`[GitHub Tool] Review created: ${data.id}, state: ${data.state}`);
  return {
    id: data.id,
    user: data.user,
    body: data.body || '',
    state: data.state,
    html_url: data.html_url,
    submitted_at: data.submitted_at,
  };
}

/**
 * Gets the diff of a pull request as plain text
 *
 * @param input.owner - Repository owner
 * @param input.repo - Repository name
 * @param input.pullNumber - Pull request number
 * @returns Diff content as string
 *
 * API: GET /repos/{owner}/{repo}/pulls/{pull_number} with Accept: application/vnd.github.diff
 */
export async function getPullRequestDiff(input: {
  owner: string;
  repo: string;
  pullNumber: number;
}): Promise<string> {
  console.log(`[GitHub Tool] getPullRequestDiff: ${input.owner}/${input.repo}#${input.pullNumber}`);

  const url = `${GITHUB_API_BASE}/repos/${input.owner}/${input.repo}/pulls/${input.pullNumber}`;

  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.diff',
    'User-Agent': 'Agent-Workflow-Server',
  };

  const token = getGitHubToken();
  if (token) {
    headers['Authorization'] = `token ${token}`;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`GitHub API error (${response.status}): ${errorBody}`);
  }

  const diff = await response.text();
  console.log(`[GitHub Tool] Diff size: ${diff.length} chars`);
  return diff;
}
