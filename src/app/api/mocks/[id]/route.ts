import { NextRequest, NextResponse } from 'next/server';
import {
  getMockEndpointById,
  updateMockEndpoint,
  deleteMockEndpoint,
  toggleMockEndpointActive,
} from '@/app/mocks/actions';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const endpoint = await getMockEndpointById(params.id);
    return NextResponse.json(endpoint);
  } catch (error: any) {
    console.error('Error fetching mock endpoint:', error);
    if (error.message?.includes('not found')) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: error.message || 'Failed to fetch mock endpoint' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    const result = await updateMockEndpoint(params.id, {
      path: body.path,
      method: body.method,
      name: body.name,
      description: body.description,
      responseCode: body.responseCode,
      responseBody: body.responseBody,
      responseHeaders: body.responseHeaders,
      isActive: body.isActive,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error updating mock endpoint:', error);
    if (error.message?.includes('not found')) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: error.message || 'Failed to update mock endpoint' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await deleteMockEndpoint(params.id);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error deleting mock endpoint:', error);
    if (error.message?.includes('not found')) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: error.message || 'Failed to delete mock endpoint' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    // Handle toggle active
    if (body.action === 'toggle-active') {
      const result = await toggleMockEndpointActive(params.id);
      return NextResponse.json(result);
    }

    // Handle other PATCH operations
    const result = await updateMockEndpoint(params.id, body);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error patching mock endpoint:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update mock endpoint' },
      { status: 500 }
    );
  }
}

