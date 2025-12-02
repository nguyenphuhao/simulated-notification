import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { categorizeRequest } from '@/lib/message-categorizer';
import { checkAndPurge } from '@/lib/auto-purge';
import { logApiError } from '@/lib/error-logger';
import { findMatchingMockEndpoint } from '@/lib/path-matcher';
import { executeMockResponse } from '@/lib/mock-executor';
import { MessageCategory } from '@/lib/types';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleProxyRequest(request, params, 'GET');
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  console.log(`[PROXY] POST request received: /${params.path.join('/')}`);
  return handleProxyRequest(request, params, 'POST');
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleProxyRequest(request, params, 'PUT');
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleProxyRequest(request, params, 'DELETE');
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleProxyRequest(request, params, 'PATCH');
}

export async function OPTIONS(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  // Handle CORS preflight request
  const origin = request.headers.get('origin');
  const requestedHeaders = request.headers.get('access-control-request-headers');
  
  console.log(`[PROXY] OPTIONS preflight: origin=${origin}, requestedHeaders=${requestedHeaders}`);
  
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': requestedHeaders || 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400',
      'Allow': 'DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT',
    },
  });
}

function getCorsHeaders(request: NextRequest) {
  const origin = request.headers.get('origin');
  // Include all common headers that might be requested
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin',
    'Access-Control-Allow-Credentials': 'true',
  };
}

async function handleProxyRequest(
  request: NextRequest,
  params: { path: string[] },
  method: string
) {
  const fullPath = '/' + params.path.join('/');
  console.log(`[PROXY] Handling ${method} request: ${fullPath}`);
  
  try {
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());

    // Get headers
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    // Get body
    let body: string | null = null;
    try {
      body = await request.text();
    } catch (e) {
      // No body
    }

    let parsedBody: any = null;
    if (body) {
      try {
        parsedBody = JSON.parse(body);
      } catch (e) {
        // Not JSON, keep as string
      }
    }

    // Get IP address and user agent (needed for both mock and regular logging)
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      'unknown';

    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Check for matching mock endpoint FIRST
    const activeMockEndpoints = await prisma.mockEndpoint.findMany({
      where: { isActive: true },
      select: {
        id: true,
        path: true,
        method: true,
        responseCode: true,
        responseBody: true,
        responseHeaders: true,
      },
    });

    console.log(`[PROXY] Checking ${activeMockEndpoints.length} active mock endpoints`);
    console.log(`[PROXY] Looking for match: ${method} ${fullPath}`);
    activeMockEndpoints.forEach((ep) => {
      console.log(`[PROXY] Available mock: ${ep.method} ${ep.path}`);
    });

    const mockMatch = findMatchingMockEndpoint(
      activeMockEndpoints,
      fullPath,
      method
    );

    if (mockMatch) {
      console.log(`[PROXY] Mock endpoint matched: ${mockMatch.method} ${mockMatch.path}`);
      // Find the full mock endpoint record
      const mockEndpoint = activeMockEndpoints.find(
        (ep) => ep.path === mockMatch.path && ep.method === mockMatch.method
      );

      if (mockEndpoint) {
        console.log(
          `[PROXY] Mock endpoint matched: ${mockMatch.method} ${mockMatch.path}`
        );

        try {
          // Execute mock response
          const mockContext = {
            request: {
              method,
              path: fullPath,
              headers,
              body: parsedBody,
              queryParams,
              pathParams: mockMatch.params,
            },
            utils: {
              random: (min: number, max: number) =>
                Math.floor(Math.random() * (max - min + 1)) + min,
              uuid: () => crypto.randomUUID(),
              timestamp: () => Date.now(),
              date: (format?: string) => {
                const now = new Date();
                if (!format) return now.toISOString();
                const year = now.getFullYear();
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const day = String(now.getDate()).padStart(2, '0');
                const hours = String(now.getHours()).padStart(2, '0');
                const minutes = String(now.getMinutes()).padStart(2, '0');
                const seconds = String(now.getSeconds()).padStart(2, '0');
                return format
                  .replace('YYYY', String(year))
                  .replace('MM', month)
                  .replace('DD', day)
                  .replace('HH', hours)
                  .replace('mm', minutes)
                  .replace('ss', seconds);
              },
              
              // Array utilities
              map: (array: any[], fn: (value: any, index: number, array: any[]) => any) => {
                if (!Array.isArray(array)) return [];
                return array.map(fn);
              },
              filter: (array: any[], fn: (value: any, index: number, array: any[]) => boolean) => {
                if (!Array.isArray(array)) return [];
                return array.filter(fn);
              },
              find: (array: any[], fn: (value: any, index: number, array: any[]) => boolean) => {
                if (!Array.isArray(array)) return undefined;
                return array.find(fn);
              },
              findIndex: (array: any[], fn: (value: any, index: number, array: any[]) => boolean) => {
                if (!Array.isArray(array)) return -1;
                return array.findIndex(fn);
              },
              reduce: (array: any[], fn: (accumulator: any, value: any, index: number, array: any[]) => any, initial: any) => {
                if (!Array.isArray(array)) return initial;
                return array.reduce(fn, initial);
              },
              some: (array: any[], fn: (value: any, index: number, array: any[]) => boolean) => {
                if (!Array.isArray(array)) return false;
                return array.some(fn);
              },
              every: (array: any[], fn: (value: any, index: number, array: any[]) => boolean) => {
                if (!Array.isArray(array)) return true;
                return array.every(fn);
              },
              sort: (array: any[], compareFn?: (a: any, b: any) => number) => {
                if (!Array.isArray(array)) return [];
                return [...array].sort(compareFn);
              },
              
              // Object utilities
              keys: (obj: object) => {
                if (!obj || typeof obj !== 'object') return [];
                return Object.keys(obj);
              },
              values: (obj: object) => {
                if (!obj || typeof obj !== 'object') return [];
                return Object.values(obj);
              },
              entries: (obj: object) => {
                if (!obj || typeof obj !== 'object') return [];
                return Object.entries(obj);
              },
              
              // String utilities
              includes: (str: string, search: string) => {
                if (typeof str !== 'string') return false;
                return str.includes(search);
              },
              startsWith: (str: string, search: string) => {
                if (typeof str !== 'string') return false;
                return str.startsWith(search);
              },
              endsWith: (str: string, search: string) => {
                if (typeof str !== 'string') return false;
                return str.endsWith(search);
              },
              
              // Request processing helpers
              getQueryParam: (key: string, defaultValue?: string) => {
                return queryParams[key] || defaultValue;
              },
              getPathParam: (key: string) => {
                return mockMatch.params[key];
              },
              getHeader: (key: string) => {
                const lowerKey = key.toLowerCase();
                return headers[lowerKey];
              },
              parseBody: () => {
                return parsedBody;
              },
            },
          };

          const mockResponse = executeMockResponse(
            mockEndpoint.responseBody,
            mockContext
          );

          // Parse response headers if provided
          let responseHeaders: Record<string, string> = {};
          if (mockEndpoint.responseHeaders) {
            try {
              responseHeaders = JSON.parse(mockEndpoint.responseHeaders);
            } catch (e) {
              console.warn('Failed to parse mock response headers:', e);
            }
          }

          // Merge mock response headers with default headers
          const finalHeaders = {
            ...getCorsHeaders(request),
            'Content-Type': 'application/json',
            ...responseHeaders,
            ...mockResponse.headers,
          };

          // Prepare response body
          const responseBody =
            typeof mockResponse.body === 'string'
              ? mockResponse.body
              : JSON.stringify(mockResponse.body);

          // Log request to MockRequest table
          await prisma.mockRequest.create({
            data: {
              mockEndpointId: mockEndpoint.id,
              headers: JSON.stringify(headers),
              body: body || null,
              queryParams:
                Object.keys(queryParams).length > 0
                  ? JSON.stringify(queryParams)
                  : null,
              pathParams:
                Object.keys(mockMatch.params).length > 0
                  ? JSON.stringify(mockMatch.params)
                  : null,
              responseCode: mockResponse.statusCode,
              responseBody,
              responseHeaders:
                Object.keys(finalHeaders).length > 0
                  ? JSON.stringify(finalHeaders)
                  : null,
              ipAddress,
              userAgent,
            },
          });

          // Also log to Message table with MOCK_API category
          const savedMockMessage = await prisma.message.create({
            data: {
              category: MessageCategory.MOCK_API,
              provider: null,
              sourceUrl: fullPath,
              method,
              headers: JSON.stringify(headers),
              body: body || null,
              queryParams: Object.keys(queryParams).length > 0 ? JSON.stringify(queryParams) : null,
              statusCode: mockResponse.statusCode,
              responseBody,
              ipAddress,
              userAgent,
              createdAt: new Date(),
            },
          });

          console.log(`[PROXY] Saved mock message: ${savedMockMessage.id} - ${method} ${fullPath} - Category: MOCK_API`);

          // Check and purge if needed
          await checkAndPurge(MessageCategory.MOCK_API).catch((err) => {
            console.error('Error purging MOCK_API messages:', err);
          });

          console.log(
            `[PROXY] Mock response returned: ${mockResponse.statusCode}`
          );

          // Return mock response
          return NextResponse.json(
            mockResponse.body,
            {
              status: mockResponse.statusCode,
              headers: finalHeaders,
            }
          );
        } catch (mockError: any) {
          console.error('[PROXY] Error executing mock:', mockError);
          // Fall through to regular logging if mock execution fails
        }
      }
    }

    // No mock match or mock execution failed - continue with regular logging
    // Categorize request
    const { category, provider } = categorizeRequest(fullPath, headers, parsedBody);

    // Save to database
    const savedMessage = await prisma.message.create({
      data: {
        category,
        provider: provider || null,
        sourceUrl: fullPath,
        method,
        headers: JSON.stringify(headers),
        body: body || null,
        queryParams: Object.keys(queryParams).length > 0 ? JSON.stringify(queryParams) : null,
        ipAddress,
        userAgent,
        createdAt: new Date(),
      },
    });

    console.log(`[PROXY] Saved message: ${savedMessage.id} - ${method} ${fullPath} - Category: ${category}`);

    // Check and purge if needed
    await checkAndPurge(category).catch((err) => {
      console.error('Error purging messages:', err);
    });

    // Return success response with CORS headers
    return NextResponse.json(
      {
        success: true,
        category,
        provider,
        message: 'Request logged successfully',
      },
      { 
        status: 200,
        headers: getCorsHeaders(request),
      }
    );
  } catch (error: any) {
    console.error(`[PROXY] Error handling ${method} request to ${fullPath}:`, error);
    console.error('Error stack:', error.stack);
    
    // Log error to database
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });
    
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      'unknown';
    
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    await logApiError(
      `API_PROXY_${method}`,
      error,
      {
        url: fullPath,
        method,
        headers,
        ipAddress,
        userAgent,
      },
      {
        path: params.path,
        queryParams: Object.fromEntries(new URL(request.url).searchParams.entries()),
      }
    ).catch((logErr) => {
      console.error('Failed to log error:', logErr);
    });
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to process request',
      },
      { 
        status: 500,
        headers: getCorsHeaders(request),
      }
    );
  }
}

