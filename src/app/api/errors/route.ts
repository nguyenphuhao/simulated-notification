import { NextRequest, NextResponse } from 'next/server';
import { getErrorLogs, getUniqueSources, getErrorLogStats } from '@/app/errors/actions';
import { ErrorLevel } from '@/app/errors/actions';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const page = Number(searchParams.get('page')) || 1;
  const search = searchParams.get('search') || undefined;
  const level = searchParams.get('level') as ErrorLevel | undefined;
  const source = searchParams.get('source') || undefined;

  try {
    const [result, uniqueSources, stats] = await Promise.all([
      getErrorLogs({
        page,
        limit: 20,
        search,
        level,
        source,
      }),
      getUniqueSources(),
      getErrorLogStats(),
    ]);

    return NextResponse.json({
      logs: result.data,
      meta: result.meta,
      uniqueSources,
      stats,
    });
  } catch (error: any) {
    console.error('Error fetching error logs via API:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch error logs' },
      { status: 500 }
    );
  }
}
