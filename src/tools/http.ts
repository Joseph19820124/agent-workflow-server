/**
 * ===========================================
 * HTTP Tools (Execution Layer)
 * ===========================================
 *
 * RESPONSIBILITIES:
 * - Provide HTTP client operations for external API calls
 * - Handle request/response formatting
 * - Manage timeouts and retries
 *
 * INPUT:
 * - URL, headers, body for HTTP requests
 *
 * OUTPUT:
 * - HTTP response data
 *
 * ARCHITECTURE POSITION:
 * Agent → Skills → [THIS: Tools]
 *
 * SECURITY NOTE:
 * Consider implementing URL allowlists to prevent
 * unauthorized external requests (SSRF protection).
 *
 * TODO: Implement URL validation and allowlisting
 */

// ===========================================
// Types
// ===========================================

/**
 * HTTP request headers
 */
export type HttpHeaders = Record<string, string>;

/**
 * HTTP response structure
 */
export interface HttpResponse<T = unknown> {
  status: number;
  statusText: string;
  headers: HttpHeaders;
  data: T;
  url: string;
  duration: number; // milliseconds
}

/**
 * HTTP error response
 */
export interface HttpError {
  status: number;
  statusText: string;
  message: string;
  url: string;
}

// ===========================================
// Configuration
// ===========================================

/**
 * Default timeout for HTTP requests (milliseconds)
 */
const DEFAULT_TIMEOUT = 30000;

/**
 * Default headers added to all requests
 */
const DEFAULT_HEADERS: HttpHeaders = {
  'User-Agent': 'AgentWorkflowServer/1.0',
  Accept: 'application/json',
};

/**
 * Validates that a URL is allowed for external requests
 *
 * Security: Prevents SSRF attacks by checking against allowlist.
 *
 * @param url - URL to validate
 * @returns true if URL is allowed
 * @throws Error if URL is not allowed
 *
 * TODO: Implement real URL validation with allowlist
 */
function validateUrl(url: string): boolean {
  // STUB: Allow all URLs in development
  // TODO: Implement proper URL validation
  //
  // Real implementation:
  // const allowedDomains = process.env.ALLOWED_DOMAINS?.split(',') || [];
  // const parsedUrl = new URL(url);
  // if (!allowedDomains.includes(parsedUrl.hostname)) {
  //   throw new Error(`Domain not allowed: ${parsedUrl.hostname}`);
  // }

  console.log(`[HTTP Tool] Validating URL: ${url}`);

  // Basic validation
  try {
    new URL(url);
    return true;
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }
}

// ===========================================
// HTTP Methods
// ===========================================

/**
 * Makes an HTTP GET request
 *
 * @param input.url - Request URL
 * @param input.headers - Additional headers (optional)
 * @param input.timeout - Request timeout in ms (optional)
 * @returns HTTP response
 *
 * TODO: Implement real HTTP request using fetch or axios
 */
export async function get<T = unknown>(input: {
  url: string;
  headers?: HttpHeaders;
  timeout?: number;
}): Promise<HttpResponse<T>> {
  console.log(`[HTTP Tool] GET: ${input.url}`);

  validateUrl(input.url);

  const startTime = Date.now();

  // STUB: Return mock response
  // TODO: Replace with real HTTP call
  //
  // Real implementation:
  // const controller = new AbortController();
  // const timeoutId = setTimeout(
  //   () => controller.abort(),
  //   input.timeout || DEFAULT_TIMEOUT
  // );
  //
  // try {
  //   const response = await fetch(input.url, {
  //     method: 'GET',
  //     headers: { ...DEFAULT_HEADERS, ...input.headers },
  //     signal: controller.signal,
  //   });
  //
  //   const data = await response.json();
  //   return {
  //     status: response.status,
  //     statusText: response.statusText,
  //     headers: Object.fromEntries(response.headers.entries()),
  //     data,
  //     url: input.url,
  //     duration: Date.now() - startTime,
  //   };
  // } finally {
  //   clearTimeout(timeoutId);
  // }

  console.log(`[HTTP Tool] Headers:`, input.headers || 'none');

  return {
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'application/json' },
    data: { mock: true, url: input.url } as T,
    url: input.url,
    duration: Date.now() - startTime,
  };
}

/**
 * Makes an HTTP POST request
 *
 * @param input.url - Request URL
 * @param input.body - Request body (will be JSON stringified)
 * @param input.headers - Additional headers (optional)
 * @param input.timeout - Request timeout in ms (optional)
 * @returns HTTP response
 *
 * TODO: Implement real HTTP request using fetch or axios
 */
export async function post<T = unknown>(input: {
  url: string;
  body?: Record<string, unknown>;
  headers?: HttpHeaders;
  timeout?: number;
}): Promise<HttpResponse<T>> {
  console.log(`[HTTP Tool] POST: ${input.url}`);

  validateUrl(input.url);

  const startTime = Date.now();

  // STUB: Return mock response
  // TODO: Replace with real HTTP call
  //
  // Real implementation:
  // const controller = new AbortController();
  // const timeoutId = setTimeout(
  //   () => controller.abort(),
  //   input.timeout || DEFAULT_TIMEOUT
  // );
  //
  // try {
  //   const response = await fetch(input.url, {
  //     method: 'POST',
  //     headers: {
  //       ...DEFAULT_HEADERS,
  //       'Content-Type': 'application/json',
  //       ...input.headers,
  //     },
  //     body: JSON.stringify(input.body),
  //     signal: controller.signal,
  //   });
  //
  //   const data = await response.json();
  //   return {
  //     status: response.status,
  //     statusText: response.statusText,
  //     headers: Object.fromEntries(response.headers.entries()),
  //     data,
  //     url: input.url,
  //     duration: Date.now() - startTime,
  //   };
  // } finally {
  //   clearTimeout(timeoutId);
  // }

  console.log(`[HTTP Tool] Body:`, input.body || 'none');

  return {
    status: 201,
    statusText: 'Created',
    headers: { 'content-type': 'application/json' },
    data: { mock: true, url: input.url, received: input.body } as T,
    url: input.url,
    duration: Date.now() - startTime,
  };
}

/**
 * Makes an HTTP PUT request
 *
 * @param input.url - Request URL
 * @param input.body - Request body (will be JSON stringified)
 * @param input.headers - Additional headers (optional)
 * @param input.timeout - Request timeout in ms (optional)
 * @returns HTTP response
 *
 * TODO: Implement real HTTP request using fetch or axios
 */
export async function put<T = unknown>(input: {
  url: string;
  body?: Record<string, unknown>;
  headers?: HttpHeaders;
  timeout?: number;
}): Promise<HttpResponse<T>> {
  console.log(`[HTTP Tool] PUT: ${input.url}`);

  validateUrl(input.url);

  const startTime = Date.now();

  // STUB: Return mock response
  console.log(`[HTTP Tool] Body:`, input.body || 'none');

  return {
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'application/json' },
    data: { mock: true, url: input.url, updated: input.body } as T,
    url: input.url,
    duration: Date.now() - startTime,
  };
}

/**
 * Makes an HTTP DELETE request
 *
 * @param input.url - Request URL
 * @param input.headers - Additional headers (optional)
 * @param input.timeout - Request timeout in ms (optional)
 * @returns HTTP response
 *
 * TODO: Implement real HTTP request using fetch or axios
 */
export async function del<T = unknown>(input: {
  url: string;
  headers?: HttpHeaders;
  timeout?: number;
}): Promise<HttpResponse<T>> {
  console.log(`[HTTP Tool] DELETE: ${input.url}`);

  validateUrl(input.url);

  const startTime = Date.now();

  // STUB: Return mock response
  return {
    status: 204,
    statusText: 'No Content',
    headers: {},
    data: {} as T,
    url: input.url,
    duration: Date.now() - startTime,
  };
}

/**
 * Makes an HTTP PATCH request
 *
 * @param input.url - Request URL
 * @param input.body - Request body (will be JSON stringified)
 * @param input.headers - Additional headers (optional)
 * @param input.timeout - Request timeout in ms (optional)
 * @returns HTTP response
 *
 * TODO: Implement real HTTP request using fetch or axios
 */
export async function patch<T = unknown>(input: {
  url: string;
  body?: Record<string, unknown>;
  headers?: HttpHeaders;
  timeout?: number;
}): Promise<HttpResponse<T>> {
  console.log(`[HTTP Tool] PATCH: ${input.url}`);

  validateUrl(input.url);

  const startTime = Date.now();

  // STUB: Return mock response
  console.log(`[HTTP Tool] Body:`, input.body || 'none');

  return {
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'application/json' },
    data: { mock: true, url: input.url, patched: input.body } as T,
    url: input.url,
    duration: Date.now() - startTime,
  };
}

// ===========================================
// Utility Functions
// ===========================================

/**
 * Checks if an HTTP response indicates success (2xx status)
 *
 * @param response - HTTP response to check
 * @returns true if status is 2xx
 */
export function isSuccess(response: HttpResponse): boolean {
  return response.status >= 200 && response.status < 300;
}

/**
 * Checks if an HTTP response indicates a client error (4xx status)
 *
 * @param response - HTTP response to check
 * @returns true if status is 4xx
 */
export function isClientError(response: HttpResponse): boolean {
  return response.status >= 400 && response.status < 500;
}

/**
 * Checks if an HTTP response indicates a server error (5xx status)
 *
 * @param response - HTTP response to check
 * @returns true if status is 5xx
 */
export function isServerError(response: HttpResponse): boolean {
  return response.status >= 500 && response.status < 600;
}
