import { NextRequest, NextResponse } from 'next/server';
import {
  getMockEndpoints,
  createMockEndpoint,
} from '@/app/mocks/actions';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = Number(searchParams.get('page')) || 1;
    const limit = Number(searchParams.get('limit')) || 20;
    const search = searchParams.get('search') || undefined;
    const method = searchParams.get('method') || undefined;
    const isActiveParam = searchParams.get('isActive');
    const isActive =
      isActiveParam === 'true'
        ? true
        : isActiveParam === 'false'
        ? false
        : undefined;

    const result = await getMockEndpoints({
      page,
      limit,
      search,
      method,
      isActive,
    });

    return NextResponse.json({
      endpoints: result.data,
      meta: result.meta,
    });
  } catch (error: any) {
    console.error('Error fetching mock endpoints:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch mock endpoints' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.path || !body.method || !body.responseBody) {
      return NextResponse.json(
        { error: 'Missing required fields: path, method, responseBody' },
        { status: 400 }
      );
    }

    const result = await createMockEndpoint({
      path: body.path,
      method: body.method,
      name: body.name,
      description: body.description,
      responseCode: body.responseCode || 200,
      responseBody: body.responseBody,
      responseHeaders: body.responseHeaders,
      isActive: body.isActive !== undefined ? body.isActive : true,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('Error creating mock endpoint:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create mock endpoint' },
      { status: 500 }
    );
  }
}

