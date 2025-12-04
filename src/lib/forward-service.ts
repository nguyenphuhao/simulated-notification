import { prisma } from './prisma';

export interface ForwardResult {
  success: boolean;
  statusCode?: number;
  responseBody?: string;
  responseHeaders?: Record<string, string>;
  responseTime?: number;
  error?: string;
}

export interface ForwardConfig {
  id: string;
  proxyPath: string;
  method: string;
  targetUrl: string;
  pathRewrite?: string;
  addHeaders?: Record<string, string>;
  removeHeaders?: string[];
  extractTokenFrom?: string; // "body" | "headers"
  tokenPath?: string; // JSON path like "$.token"
  tokenHeaderName?: string; // Header name to add token to
  nextForwardConfigId?: string; // ID of next forward config to chain to
  timeout: number;
  retryCount: number;
  retryDelay: number;
}

/**
 * Find matching forward config for a proxy path
 */
export async function findForwardConfig(
  proxyPath: string,
  method: string
): Promise<ForwardConfig | null> {
  const upperMethod = method.toUpperCase();
  console.log(`[FORWARD_SERVICE] Looking for config: ${upperMethod} ${proxyPath}`);
  
  // First try exact match
  const configs = await prisma.forwardConfig.findMany({
    where: {
      enabled: true,
    },
  });
  
  console.log(`[FORWARD_SERVICE] Found ${configs.length} enabled configs total`);
  configs.forEach(cfg => {
    console.log(`[FORWARD_SERVICE] Config: ${cfg.method} ${cfg.proxyPath} (enabled: ${cfg.enabled})`);
  });
  
  let config = await prisma.forwardConfig.findFirst({
    where: {
      proxyPath: proxyPath,
      method: upperMethod,
      enabled: true,
    },
  });

  if (config) {
    console.log(`[FORWARD_SERVICE] Found exact match: ${config.id}`);
    return mapToForwardConfig(config);
  }
  
  console.log(`[FORWARD_SERVICE] No exact match found for ${upperMethod} ${proxyPath}`);

  // Try pattern match (wildcard)
  // Find configs with wildcard patterns
  const allConfigs = await prisma.forwardConfig.findMany({
    where: {
      method: upperMethod,
      enabled: true,
    },
  });

  console.log(`[FORWARD_SERVICE] Checking ${allConfigs.length} configs for pattern match`);

  for (const cfg of allConfigs) {
    console.log(`[FORWARD_SERVICE] Checking pattern: ${cfg.proxyPath} against ${proxyPath}`);
    if (matchPathPattern(cfg.proxyPath, proxyPath)) {
      console.log(`[FORWARD_SERVICE] Found pattern match: ${cfg.id}`);
      return mapToForwardConfig(cfg);
    }
  }

  console.log(`[FORWARD_SERVICE] No matching config found`);
  return null;
}

/**
 * Match proxy path với pattern (support wildcard *)
 */
function matchPathPattern(pattern: string, path: string): boolean {
  // Convert pattern to regex
  // e.g., "/api/proxy/snowplow/*" -> "/api/proxy/snowplow/.*"
  const regexPattern = pattern
    .replace(/\*/g, '.*')
    .replace(/\//g, '\\/');
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(path);
}

/**
 * Build target URL from config and proxy path
 */
export function buildTargetUrl(
  config: ForwardConfig,
  proxyPath: string
): string {
  let targetUrl = config.targetUrl;

  // Apply path rewrite if needed
  if (config.pathRewrite) {
    // Extract path part from proxy path
    // e.g., "/api/proxy/snowplow/track" -> "/track"
    const pathMatch = proxyPath.match(/\/api\/proxy\/[^/]+(.+)$/);
    if (pathMatch) {
      const extractedPath = pathMatch[1];
      targetUrl = targetUrl.replace('*', extractedPath);
    }
  } else if (targetUrl.includes('*')) {
    // If no pathRewrite but targetUrl has *, replace it with extracted path
    const pathMatch = proxyPath.match(/\/api\/proxy\/[^/]+(.+)$/);
    if (pathMatch) {
      const extractedPath = pathMatch[1];
      targetUrl = targetUrl.replace('*', extractedPath);
    }
  }

  return targetUrl;
}

/**
 * Auto-detect token from response body by searching common token field names
 */
function autoDetectTokenFromBody(responseBody: string): string | null {
  try {
    const body = JSON.parse(responseBody);
    
    // Common token field names (in order of priority)
    const tokenFields = [
      'token',
      'accessToken',
      'access_token',
      'authToken',
      'auth_token',
      'bearerToken',
      'bearer_token',
      'apiToken',
      'api_token',
      'jwt',
      'jwtToken',
    ];
    
    // Try direct fields first
    for (const field of tokenFields) {
      if (body[field] && typeof body[field] === 'string' && body[field].length > 0) {
        console.log(`[FORWARD_SERVICE] Auto-detected token from body field: ${field}`);
        return String(body[field]);
      }
    }
    
    // Try nested in common objects
    const nestedPaths = ['data', 'result', 'response', 'auth', 'payload'];
    for (const path of nestedPaths) {
      if (body[path] && typeof body[path] === 'object') {
        for (const field of tokenFields) {
          if (body[path][field] && typeof body[path][field] === 'string' && body[path][field].length > 0) {
            console.log(`[FORWARD_SERVICE] Auto-detected token from body.${path}.${field}`);
            return String(body[path][field]);
          }
        }
      }
    }
    
    return null;
  } catch (e) {
    // Not JSON or parse error
    return null;
  }
}

/**
 * Auto-detect token from response headers by searching common header names
 */
function autoDetectTokenFromHeaders(responseHeaders: Record<string, string>): string | null {
  const commonHeaders = [
    'authorization',
    'x-auth-token',
    'x-access-token',
    'x-api-key',
    'x-authorization',
    'x-bearer-token',
    'authorization-token',
  ];
  
  for (const headerName of commonHeaders) {
    const value = responseHeaders[headerName] || responseHeaders[headerName.toLowerCase()];
    if (value && typeof value === 'string' && value.length > 0) {
      console.log(`[FORWARD_SERVICE] Auto-detected token from header: ${headerName}`);
      // Remove "Bearer " prefix if present
      return value.replace(/^Bearer\s+/i, '');
    }
  }
  
  return null;
}

/**
 * Extract token from response body or headers
 * Supports both manual path specification and auto-detection
 * When extractTokenFrom = "auto", searches both body and headers
 */
function extractToken(
  responseBody: string,
  responseHeaders: Record<string, string>,
  config: ForwardConfig
): string | null {
  if (!config.extractTokenFrom) {
    return null;
  }

  // Auto-detect: search in both body and headers
  if (config.extractTokenFrom === 'auto') {
    console.log('[FORWARD_SERVICE] Auto-detecting token from both body and headers');
    
    // Try headers first (usually more reliable)
    const headerToken = autoDetectTokenFromHeaders(responseHeaders);
    if (headerToken) {
      console.log('[FORWARD_SERVICE] Token found in headers via auto-detect');
      return headerToken;
    }
    
    // Then try body
    const bodyToken = autoDetectTokenFromBody(responseBody);
    if (bodyToken) {
      console.log('[FORWARD_SERVICE] Token found in body via auto-detect');
      return bodyToken;
    }
    
    console.log('[FORWARD_SERVICE] Token not found in either body or headers');
    return null;
  }

  if (config.extractTokenFrom === 'headers') {
    // If tokenPath is specified, use it
    if (config.tokenPath) {
      const headerName = config.tokenPath;
      const token = responseHeaders[headerName] || responseHeaders[headerName.toLowerCase()] || null;
      if (token) {
        // Remove "Bearer " prefix if present, we'll add it back when forwarding
        return token.replace(/^Bearer\s+/i, '');
      }
      return null;
    }
    
    // Auto-detect if tokenPath is not specified
    console.log('[FORWARD_SERVICE] Token path not specified, attempting auto-detection from headers');
    return autoDetectTokenFromHeaders(responseHeaders);
  }

  if (config.extractTokenFrom === 'body') {
    // If tokenPath is specified, use it
    if (config.tokenPath) {
      try {
        const body = JSON.parse(responseBody);
        // Simple JSON path extraction (supports $.token or $.data.accessToken)
        const path = config.tokenPath.replace(/^\$\./, '').split('.');
        let value = body;
        for (const key of path) {
          value = value?.[key];
          if (value === undefined || value === null) break;
        }
        return value ? String(value) : null;
      } catch (e) {
        console.error('[FORWARD_SERVICE] Error extracting token from body:', e);
        return null;
      }
    }
    
    // Auto-detect if tokenPath is not specified
    console.log('[FORWARD_SERVICE] Token path not specified, attempting auto-detection from body');
    return autoDetectTokenFromBody(responseBody);
  }

  return null;
}

/**
 * Forward request to target server
 * Supports internal path detection and chaining
 */
export async function forwardRequest(
  targetUrl: string,
  method: string,
  headers: Record<string, string>,
  body: string | null,
  config: ForwardConfig,
  depth: number = 0,
  maxDepth: number = 5
): Promise<ForwardResult> {
  // Prevent infinite loops
  if (depth >= maxDepth) {
    return {
      success: false,
      error: `Maximum forwarding depth (${maxDepth}) exceeded`,
      responseTime: 0,
    };
  }

  // Check if targetUrl is an internal proxy path
  if (targetUrl.startsWith('/api/proxy/')) {
    console.log(`[FORWARD_SERVICE] Detected internal path, forwarding to next layer (depth: ${depth + 1})`);
    
    // Extract path from targetUrl
    const internalPath = targetUrl;
    
    // Find next forward config
    const nextConfig = await findForwardConfig(internalPath, method);
    
    if (nextConfig) {
      console.log(`[FORWARD_SERVICE] Found next forward config: ${nextConfig.id}`);
      
      // Build next target URL
      const nextTargetUrl = buildTargetUrl(nextConfig, internalPath);
      
      // Prepare headers for next forward
      const nextHeaders: Record<string, string> = { ...headers };
      
      // Apply header transformations from next config
      if (nextConfig.removeHeaders && Array.isArray(nextConfig.removeHeaders)) {
        nextConfig.removeHeaders.forEach((h: string) => {
          delete nextHeaders[h];
          delete nextHeaders[h.toLowerCase()];
        });
      }
      
      if (nextConfig.addHeaders && typeof nextConfig.addHeaders === 'object') {
        Object.assign(nextHeaders, nextConfig.addHeaders);
      }
      
      // Recursively forward to next config
      return forwardRequest(
        nextTargetUrl,
        method,
        nextHeaders,
        body,
        nextConfig,
        depth + 1,
        maxDepth
      );
    } else {
      // No matching forward config, treat as regular URL
      console.log(`[FORWARD_SERVICE] No forward config found for internal path, treating as regular URL`);
    }
  }
  const startTime = Date.now();

  // Prepare headers
  const forwardHeaders: Record<string, string> = { ...headers };

  // Remove headers if specified
  if (config.removeHeaders && Array.isArray(config.removeHeaders) && config.removeHeaders.length > 0) {
    config.removeHeaders.forEach((h: string) => {
      const lowerKey = h.toLowerCase();
      // Try both original case and lowercase
      delete forwardHeaders[h];
      delete forwardHeaders[lowerKey];
    });
  }

  // Add headers if specified
  if (config.addHeaders && typeof config.addHeaders === 'object') {
    Object.assign(forwardHeaders, config.addHeaders);
  }

  // Remove proxy-specific headers
  delete forwardHeaders['x-forward-target'];
  delete forwardHeaders['host'];

  let lastError: Error | null = null;

  // Retry logic
  for (let attempt = 0; attempt <= config.retryCount; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        config.timeout
      );

      const response = await fetch(targetUrl, {
        method,
        headers: forwardHeaders,
        body: body || undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseTime = Date.now() - startTime;
      const responseBody = await response.text();
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      const forwardResult: ForwardResult = {
        success: response.ok,
        statusCode: response.status,
        responseBody,
        responseHeaders,
        responseTime,
      };

      // If this config has token extraction and next forward config, chain forward
      if (config.extractTokenFrom && config.nextForwardConfigId && forwardResult.success && forwardResult.responseBody) {
        console.log(`[FORWARD_SERVICE] Extracting token and chaining to next forward config`);
        
        // Extract token from response
        const token = extractToken(
          forwardResult.responseBody,
          forwardResult.responseHeaders || {},
          config
        );

        if (token) {
          console.log(`[FORWARD_SERVICE] Token extracted successfully, forwarding to next config`);
          
          // Find next forward config
          const nextConfigDb = await prisma.forwardConfig.findUnique({
            where: { id: config.nextForwardConfigId },
          });

          if (nextConfigDb && nextConfigDb.enabled && depth < maxDepth) {
            const nextConfig = mapToForwardConfig(nextConfigDb);
            
            // Prepare headers with extracted token
            const nextHeaders: Record<string, string> = { ...headers };
            
            // Apply header transformations from next config
            if (nextConfig.removeHeaders && Array.isArray(nextConfig.removeHeaders)) {
              nextConfig.removeHeaders.forEach((h: string) => {
                delete nextHeaders[h];
                delete nextHeaders[h.toLowerCase()];
              });
            }
            
            if (nextConfig.addHeaders && typeof nextConfig.addHeaders === 'object') {
              Object.assign(nextHeaders, nextConfig.addHeaders);
            }
            
            // Add extracted token to headers
            const tokenHeaderName = config.tokenHeaderName || 'Authorization';
            const tokenPrefix = tokenHeaderName.toLowerCase() === 'authorization' ? 'Bearer ' : '';
            nextHeaders[tokenHeaderName] = `${tokenPrefix}${token}`;
            
            // Build target URL for next forward
            // If nextConfig has internal proxy path, use it; otherwise use targetUrl directly
            let nextTargetUrl = nextConfig.targetUrl;
            
            // If targetUrl contains *, we need to extract path from original request
            // For chaining, we'll use the proxyPath of nextConfig if it's an internal path
            if (nextConfig.targetUrl.includes('*')) {
              // Try to extract path from current targetUrl if it's an internal path
              if (targetUrl.startsWith('/api/proxy/')) {
                const pathMatch = targetUrl.match(/\/api\/proxy\/[^/]+(.+)$/);
                if (pathMatch) {
                  const extractedPath = pathMatch[1];
                  nextTargetUrl = nextConfig.targetUrl.replace('*', extractedPath);
                }
              } else {
                // If current targetUrl is external, use nextConfig's proxyPath to extract path
                const pathMatch = nextConfig.proxyPath.match(/\/api\/proxy\/[^/]+(.+)$/);
                if (pathMatch) {
                  const extractedPath = pathMatch[1];
                  nextTargetUrl = nextConfig.targetUrl.replace('*', extractedPath);
                }
              }
            }
            
            console.log(`[FORWARD_SERVICE] Chaining forward to: ${nextTargetUrl} with token in ${tokenHeaderName}`);
            
            // Forward to next config recursively
            return forwardRequest(
              nextTargetUrl,
              method,
              nextHeaders,
              body,
              nextConfig,
              depth + 1,
              maxDepth
            );
          } else {
            console.log(`[FORWARD_SERVICE] Next forward config not found or disabled`);
          }
        } else {
          console.log(`[FORWARD_SERVICE] Failed to extract token from response`);
        }
      }

      return forwardResult;
    } catch (error: any) {
      lastError = error;

      // Don't retry on abort (timeout)
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: 'Request timeout',
          responseTime: Date.now() - startTime,
        };
      }

      // Wait before retry (except last attempt)
      if (attempt < config.retryCount) {
        await new Promise((resolve) =>
          setTimeout(resolve, config.retryDelay)
        );
      }
    }
  }

  return {
    success: false,
    error: lastError?.message || 'Unknown error',
    responseTime: Date.now() - startTime,
  };
}

function mapToForwardConfig(dbConfig: any): ForwardConfig {
  return {
    id: dbConfig.id,
    proxyPath: dbConfig.proxyPath,
    method: dbConfig.method,
    targetUrl: dbConfig.targetUrl,
    pathRewrite: dbConfig.pathRewrite || undefined,
    addHeaders: dbConfig.addHeaders
      ? JSON.parse(dbConfig.addHeaders)
      : undefined,
    removeHeaders: dbConfig.removeHeaders
      ? JSON.parse(dbConfig.removeHeaders)
      : undefined,
    extractTokenFrom: dbConfig.extractTokenFrom || undefined,
    tokenPath: dbConfig.tokenPath || undefined,
    tokenHeaderName: dbConfig.tokenHeaderName || undefined,
    nextForwardConfigId: dbConfig.nextForwardConfigId || undefined,
    timeout: dbConfig.timeout,
    retryCount: dbConfig.retryCount,
    retryDelay: dbConfig.retryDelay,
  };
}

