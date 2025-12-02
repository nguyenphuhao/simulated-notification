import { NextRequest, NextResponse } from 'next/server';
import { getMockRequests } from '@/app/mocks/actions';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = Number(searchParams.get('page')) || 1;
    const limit = Number(searchParams.get('limit')) || 20;

    const result = await getMockRequests({
      mockEndpointId: params.id,
      page,
      limit,
    });

    return NextResponse.json({
      requests: result.data,
      meta: result.meta,
    });
  } catch (error: any) {
    console.error('Error fetching mock requests:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch mock requests' },
      { status: 500 }
    );
  }
}

