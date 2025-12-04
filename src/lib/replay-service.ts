import { prisma } from './prisma';
import { forwardRequest, buildTargetUrl, findForwardConfig, ForwardConfig } from './forward-service';

export interface ReplayOptions {
  messageId: string;
  targetUrl?: string; // Optional: override target URL
  modifyHeaders?: Record<string, string>; // Optional: modify headers
  modifyBody?: any; // Optional: modify body
}

export interface ReplayResult {
  success: boolean;
  statusCode?: number;
  responseBody?: string;
  responseTime?: number;
  error?: string;
  comparison?: {
    statusCodeMatch: boolean;
    responseTimeDiff?: number;
    responseBodyDiff?: string;
  };
}

/**
 * Replay a captured request
 */
export async function replayRequest(
  options: ReplayOptions
): Promise<ReplayResult> {
  // Load original message
  const message = await prisma.message.findUnique({
    where: { id: options.messageId },
  });

  if (!message) {
    throw new Error('Message not found');
  }

  if (!message.forwarded) {
    throw new Error('Message was not forwarded, cannot replay');
  }

  // Get forward config (if still exists)
  let forwardConfig: ForwardConfig | null = null;
  if (message.forwardConfigId) {
    const dbConfig = await prisma.forwardConfig.findUnique({
      where: { id: message.forwardConfigId },
    });
    if (dbConfig) {
      forwardConfig = {
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
        timeout: dbConfig.timeout,
        retryCount: dbConfig.retryCount,
        retryDelay: dbConfig.retryDelay,
      };
    }
  }

  // Determine target URL
  let targetUrl = options.targetUrl || message.forwardTarget || null;
  if (!targetUrl && forwardConfig) {
    targetUrl = buildTargetUrl(forwardConfig, message.sourceUrl);
  }

  if (!targetUrl) {
    throw new Error('Cannot determine target URL for replay');
  }

  // Parse original request data
  const headers = message.headers ? JSON.parse(message.headers) : {};
  let body = options.modifyBody || (message.body ? JSON.parse(message.body) : null);

  // Modify headers if specified
  if (options.modifyHeaders) {
    Object.assign(headers, options.modifyHeaders);
  }

  // Use forward config if available
  const config: ForwardConfig = forwardConfig || {
    id: '',
    proxyPath: message.sourceUrl,
    method: message.method,
    targetUrl: targetUrl,
    timeout: 30000,
    retryCount: 0,
    retryDelay: 1000,
  };

  // Forward request
  const startTime = Date.now();
  const result = await forwardRequest(
    targetUrl,
    message.method,
    headers,
    body ? JSON.stringify(body) : null,
    config
  );

  const responseTime = Date.now() - startTime;

  // Compare with original
  const comparison = {
    statusCodeMatch: result.statusCode === message.statusCode,
    responseTimeDiff: result.responseTime
      ? result.responseTime - (message.responseTime || 0)
      : undefined,
    responseBodyDiff: compareResponses(
      message.responseBody,
      result.responseBody
    ),
  };

  // Save replay history
  await prisma.replayHistory.create({
    data: {
      messageId: message.id,
      targetUrl: targetUrl,
      statusCode: result.statusCode || null,
      responseTime: result.responseTime || null,
      success: result.success,
      errorMessage: result.error || null,
      originalStatusCode: message.statusCode || null,
      originalResponseTime: message.responseTime || null,
      responseDiff: comparison.responseBodyDiff || null,
    },
  });

  // Update message replay count
  await prisma.message.update({
    where: { id: message.id },
    data: {
      replayCount: { increment: 1 },
      lastReplayedAt: new Date(),
      lastReplayStatus: result.success ? 'SUCCESS' : 'FAILED',
    },
  });

  return {
    ...result,
    responseTime,
    comparison,
  };
}

/**
 * Compare two response bodies
 */
function compareResponses(
  original: string | null,
  replayed: string | undefined
): string | undefined {
  if (!original || !replayed) {
    return undefined;
  }

  try {
    const orig = JSON.parse(original);
    const replay = JSON.parse(replayed);
    
    // Simple diff (could use a library like deep-diff)
    const diff: any = {};
    
    // Compare keys
    const allKeys = new Set([...Object.keys(orig), ...Object.keys(replay)]);
    for (const key of allKeys) {
      if (JSON.stringify(orig[key]) !== JSON.stringify(replay[key])) {
        diff[key] = {
          original: orig[key],
          replayed: replay[key],
        };
      }
    }
    
    return Object.keys(diff).length > 0 ? JSON.stringify(diff) : undefined;
  } catch (e) {
    // Not JSON, compare as strings
    return original !== replayed ? 'Response body differs' : undefined;
  }
}

