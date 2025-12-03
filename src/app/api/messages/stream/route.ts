import { NextRequest } from 'next/server';
import { addConnection, removeConnection, sendHeartbeat } from '@/lib/sse-manager';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const lastMessageId = searchParams.get('lastMessageId') || null;

  // Create a ReadableStream for SSE
  const stream = new ReadableStream({
    start(controller) {
      // Add connection to manager
      const connection = addConnection(controller, lastMessageId);

      // Send initial connection message
      const initMessage = JSON.stringify({
        type: 'connected',
        timestamp: new Date().toISOString(),
      });
      controller.enqueue(new TextEncoder().encode(`data: ${initMessage}\n\n`));

      // Send periodic heartbeat to keep connection alive
      const heartbeatInterval = setInterval(() => {
        try {
          sendHeartbeat();
        } catch (error) {
          // Connection closed
          clearInterval(heartbeatInterval);
          removeConnection(connection);
        }
      }, 30000); // Every 30 seconds

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeatInterval);
        removeConnection(connection);
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable buffering in nginx
    },
  });
}

