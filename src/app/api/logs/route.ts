import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkAndPurge } from '@/lib/auto-purge';
import { MessageCategory } from '@/lib/types';
import { getLogs, getUniqueLogSources, getUniqueLogLevels } from '@/app/logs/actions';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = Number(searchParams.get('page')) || 1;
    const levelParam = searchParams.get('level');
    const level = levelParam && levelParam !== 'all'
      ? levelParam.split(',').filter(Boolean)
      : undefined;
    const sourceParam = searchParams.get('source');
    const source = sourceParam && sourceParam !== 'all'
      ? sourceParam.split(',').filter(Boolean)
      : undefined;
    const search = searchParams.get('search') || undefined;
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const startDate = startDateParam ? new Date(startDateParam) : undefined;
    const endDate = endDateParam ? new Date(endDateParam) : undefined;

    const [result, uniqueSources, uniqueLevels] = await Promise.all([
      getLogs({
        page,
        limit: 50,
        search,
        level,
        source,
        startDate,
        endDate,
      }),
      getUniqueLogSources(),
      getUniqueLogLevels(),
    ]);

    return NextResponse.json({
      logs: result.data,
      meta: result.meta,
      uniqueSources,
      uniqueLevels,
    });
  } catch (error: any) {
    console.error('Error fetching logs:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch logs' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

    // Get IP address and user agent
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      'unknown';

    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Parse log data from body
    let logData: any = null;
    let logLevel = 'INFO';
    let logMessage = body || 'No message';
    let logSource = 'unknown';
    let logTags: string[] = [];

    if (body) {
      try {
        logData = JSON.parse(body);
        logLevel = logData.level || logData.severity || 'INFO';
        logMessage = logData.message || logData.msg || logData.text || JSON.stringify(logData);
        logSource = logData.source || logData.service || logData.app || 'unknown';
        logTags = logData.tags || logData.labels || [];
      } catch (e) {
        // Not JSON, use body as message
        logMessage = body;
      }
    }

    // Save log to database as a message with LOG category
    // We'll use a special category or store in the existing structure
    // For now, we'll use GENERAL category but mark it as a log via sourceUrl
    const savedLog = await prisma.message.create({
      data: {
        category: MessageCategory.GENERAL,
        provider: logSource,
        sourceUrl: '/api/logs',
        method: 'POST',
        headers: JSON.stringify(headers),
        body: body || null,
        queryParams: Object.keys(queryParams).length > 0 ? JSON.stringify(queryParams) : null,
        ipAddress,
        userAgent,
        createdAt: new Date(),
      },
    });

    console.log(`[LOGS] Saved log: ${savedLog.id} - Level: ${logLevel} - Source: ${logSource}`);

    // Broadcast new log event via SSE
    try {
      const { broadcastNewMessage } = await import('@/lib/sse-manager');
      broadcastNewMessage(savedLog.id);
    } catch (err) {
      console.error('[LOGS] Error broadcasting new log:', err);
    }

    // Check and purge if needed
    await checkAndPurge(MessageCategory.GENERAL).catch((err) => {
      console.error('Error purging logs:', err);
    });

    // Return success response
    return NextResponse.json(
      {
        success: true,
        id: savedLog.id,
        message: 'Log saved successfully',
      },
      { 
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    );
  } catch (error: any) {
    console.error('[LOGS] Error handling log request:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to save log',
      },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}

