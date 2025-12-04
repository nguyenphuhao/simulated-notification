import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const config = await prisma.forwardConfig.findUnique({
      where: { id: params.id },
    });

    if (!config) {
      return NextResponse.json(
        { error: 'Forward config not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: config });
  } catch (error: any) {
    console.error('[FORWARD_CONFIGS] Error fetching config:', error);
    return NextResponse.json(
      { error: error.message },
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

    const config = await prisma.forwardConfig.update({
      where: { id: params.id },
      data: {
        ...(body.proxyPath && { proxyPath: body.proxyPath }),
        ...(body.method && { method: body.method.toUpperCase() }),
        ...(body.targetUrl && { targetUrl: body.targetUrl }),
        ...(body.pathRewrite !== undefined && { pathRewrite: body.pathRewrite }),
        ...(body.addHeaders !== undefined && {
          addHeaders: body.addHeaders ? JSON.stringify(body.addHeaders) : null,
        }),
        ...(body.removeHeaders !== undefined && {
          removeHeaders: body.removeHeaders ? JSON.stringify(body.removeHeaders) : null,
        }),
        ...(body.extractTokenFrom !== undefined && { extractTokenFrom: body.extractTokenFrom || null }),
        ...(body.tokenPath !== undefined && { tokenPath: body.tokenPath || null }),
        ...(body.tokenHeaderName !== undefined && { tokenHeaderName: body.tokenHeaderName || null }),
        ...(body.nextForwardConfigId !== undefined && { nextForwardConfigId: body.nextForwardConfigId || null }),
        ...(body.enabled !== undefined && { enabled: body.enabled }),
        ...(body.timeout !== undefined && { timeout: body.timeout }),
        ...(body.retryCount !== undefined && { retryCount: body.retryCount }),
        ...(body.retryDelay !== undefined && { retryDelay: body.retryDelay }),
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
      },
    });

    return NextResponse.json({ data: config });
  } catch (error: any) {
    console.error('[FORWARD_CONFIGS] Error updating config:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.forwardConfig.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[FORWARD_CONFIGS] Error deleting config:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

