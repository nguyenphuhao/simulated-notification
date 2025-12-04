import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const enabled = searchParams.get('enabled');

    const configs = await prisma.forwardConfig.findMany({
      where: enabled !== null ? { enabled: enabled === 'true' } : undefined,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ data: configs });
  } catch (error: any) {
    console.error('[FORWARD_CONFIGS] Error fetching configs:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.proxyPath || !body.method || !body.targetUrl) {
      return NextResponse.json(
        { error: 'Missing required fields: proxyPath, method, targetUrl' },
        { status: 400 }
      );
    }

    // Check for duplicate
    const existing = await prisma.forwardConfig.findFirst({
      where: {
        proxyPath: body.proxyPath,
        method: body.method.toUpperCase(),
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Forward config already exists for this path and method' },
        { status: 409 }
      );
    }

    const config = await prisma.forwardConfig.create({
      data: {
        proxyPath: body.proxyPath,
        method: body.method.toUpperCase(),
        targetUrl: body.targetUrl,
        pathRewrite: body.pathRewrite || null,
        addHeaders: body.addHeaders ? JSON.stringify(body.addHeaders) : null,
        removeHeaders: body.removeHeaders
          ? JSON.stringify(body.removeHeaders)
          : null,
        extractTokenFrom: body.extractTokenFrom || null,
        tokenPath: body.tokenPath || null,
        tokenHeaderName: body.tokenHeaderName || null,
        nextForwardConfigId: body.nextForwardConfigId || null,
        enabled: body.enabled !== undefined ? body.enabled : true,
        timeout: body.timeout || 30000,
        retryCount: body.retryCount || 0,
        retryDelay: body.retryDelay || 1000,
        name: body.name || null,
        description: body.description || null,
      },
    });

    return NextResponse.json({ data: config }, { status: 201 });
  } catch (error: any) {
    console.error('[FORWARD_CONFIGS] Error creating config:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

