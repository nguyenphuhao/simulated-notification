import { prisma } from './prisma';

export type ErrorLevel = 'ERROR' | 'WARN' | 'INFO';

export interface ErrorLogContext {
  [key: string]: any;
}

export interface LogErrorParams {
  level?: ErrorLevel;
  source: string;
  message: string;
  error?: Error | unknown;
  context?: ErrorLogContext;
  request?: {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    body?: any;
    ipAddress?: string;
    userAgent?: string;
  };
  response?: {
    statusCode?: number;
  };
}

/**
 * Log error to database
 */
export async function logError(params: LogErrorParams): Promise<void> {
  try {
    const {
      level = 'ERROR',
      source,
      message,
      error,
      context,
      request,
      response,
    } = params;

    // Extract stack trace from error
    let stack: string | null = null;
    if (error instanceof Error) {
      stack = error.stack || null;
    } else if (error) {
      stack = String(error);
    }

    // Prepare context JSON
    let contextJson: string | null = null;
    if (context) {
      try {
        contextJson = JSON.stringify(context);
      } catch (e) {
        contextJson = String(context);
      }
    }

    // Prepare request headers JSON
    let requestHeadersJson: string | null = null;
    if (request?.headers) {
      try {
        requestHeadersJson = JSON.stringify(request.headers);
      } catch (e) {
        requestHeadersJson = String(request.headers);
      }
    }

    // Prepare request body JSON
    let requestBodyJson: string | null = null;
    if (request?.body) {
      try {
        requestBodyJson = typeof request.body === 'string' 
          ? request.body 
          : JSON.stringify(request.body);
      } catch (e) {
        requestBodyJson = String(request.body);
      }
    }

    await prisma.errorLog.create({
      data: {
        level,
        source,
        message,
        stack,
        context: contextJson,
        requestUrl: request?.url || null,
        requestMethod: request?.method || null,
        requestHeaders: requestHeadersJson,
        requestBody: requestBodyJson,
        responseStatus: response?.statusCode || null,
        ipAddress: request?.ipAddress || null,
        userAgent: request?.userAgent || null,
        createdAt: new Date(),
      },
    });
  } catch (logError) {
    // Fallback to console if database logging fails
    console.error('[ERROR_LOGGER] Failed to log error to database:', logError);
    console.error('[ERROR_LOGGER] Original error:', params);
  }
}

/**
 * Helper to log errors from API routes
 */
export async function logApiError(
  source: string,
  error: Error | unknown,
  request?: {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    body?: any;
    ipAddress?: string;
    userAgent?: string;
  },
  context?: ErrorLogContext
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  await logError({
    level: 'ERROR',
    source,
    message,
    error,
    context,
    request,
  });
}

