import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Get the last message timestamp from query params (if provided)
    const lastMessageId = request.nextUrl.searchParams.get('lastMessageId');
    
    // Get total count
    const totalCount = await prisma.message.count();
    
    // Get the latest message
    const latestMessage = await prisma.message.findFirst({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      totalCount,
      latestMessageId: latestMessage?.id || null,
      latestMessageCreatedAt: latestMessage?.createdAt || null,
      hasNewMessages: lastMessageId ? latestMessage?.id !== lastMessageId : totalCount > 0,
    });
  } catch (error: any) {
    console.error('Error checking messages:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check messages' },
      { status: 500 }
    );
  }
}

