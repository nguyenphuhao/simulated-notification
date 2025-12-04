import { NextRequest, NextResponse } from 'next/server';
import { replayRequest } from '@/lib/replay-service';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json().catch(() => ({}));

    const result = await replayRequest({
      messageId: params.id,
      targetUrl: body.targetUrl,
      modifyHeaders: body.modifyHeaders,
      modifyBody: body.modifyBody,
    });

    return NextResponse.json({ data: result });
  } catch (error: any) {
    console.error('[REPLAY] Error replaying request:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to replay request' },
      { status: 500 }
    );
  }
}

