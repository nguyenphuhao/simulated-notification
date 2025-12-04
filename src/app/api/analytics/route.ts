import { NextRequest, NextResponse } from 'next/server';
import { getPerformanceMetrics, getEndpointPerformance } from '@/lib/performance-analytics';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'overall'; // 'overall' or 'endpoints'
    
    const startDate = searchParams.get('startDate')
      ? new Date(searchParams.get('startDate')!)
      : undefined;
    const endDate = searchParams.get('endDate')
      ? new Date(searchParams.get('endDate')!)
      : undefined;
    const endpoint = searchParams.get('endpoint') || undefined;
    const method = searchParams.get('method') || undefined;
    const limit = searchParams.get('limit')
      ? parseInt(searchParams.get('limit')!)
      : undefined;

    if (type === 'endpoints') {
      const endpoints = await getEndpointPerformance({
        startDate,
        endDate,
        limit,
      });
      return NextResponse.json({ data: endpoints });
    } else {
      const metrics = await getPerformanceMetrics({
        startDate,
        endDate,
        endpoint,
        method,
      });
      return NextResponse.json({ data: metrics });
    }
  } catch (error: any) {
    console.error('[ANALYTICS] Error fetching analytics:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

