import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { categorizeRequest } from '@/lib/message-categorizer';
import { checkAndPurge } from '@/lib/auto-purge';
import { logApiError } from '@/lib/error-logger';

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

    // Categorize request
    const { category, provider } = categorizeRequest(fullPath, headers, parsedBody);

    // Get IP address
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      'unknown';

    // Get user agent
    const userAgent = request.headers.get('user-agent') || 'unknown';

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

