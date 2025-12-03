/**
 * SSE Manager - Manages Server-Sent Events connections for real-time updates
 * This allows event-driven broadcasting instead of polling
 */

interface Connection {
  controller: ReadableStreamDefaultController;
  lastMessageId: string | null;
}

// Store active SSE connections
const connections = new Set<Connection>();

/**
 * Add a new SSE connection
 */
export function addConnection(controller: ReadableStreamDefaultController, lastMessageId: string | null = null): Connection {
  const connection: Connection = {
    controller,
    lastMessageId,
  };
  connections.add(connection);
  return connection;
}

/**
 * Remove an SSE connection
 */
export function removeConnection(connection: Connection) {
  connections.delete(connection);
}

/**
 * Broadcast new message event to all connected clients
 * This is called immediately when a new message is created
 */
export function broadcastNewMessage(messageId: string) {
  if (connections.size === 0) {
    return; // No active connections
  }

  const message = JSON.stringify({
    type: 'new_message',
    hasNewMessages: true,
    latestMessageId: messageId,
    timestamp: new Date().toISOString(),
  });

  const encodedMessage = new TextEncoder().encode(`data: ${message}\n\n`);

  // Broadcast to all connections
  const connectionsToRemove: Connection[] = [];
  
  connections.forEach((connection) => {
    try {
      // Only notify if this is a new message (different from last known)
      if (!connection.lastMessageId || connection.lastMessageId !== messageId) {
        connection.controller.enqueue(encodedMessage);
        connection.lastMessageId = messageId;
      }
    } catch (error) {
      // Connection closed or error, mark for removal
      connectionsToRemove.push(connection);
    }
  });

  // Clean up closed connections
  connectionsToRemove.forEach((conn) => removeConnection(conn));
}

/**
 * Send heartbeat to keep connections alive
 */
export function sendHeartbeat() {
  if (connections.size === 0) {
    return;
  }

  const heartbeat = JSON.stringify({
    type: 'heartbeat',
    timestamp: new Date().toISOString(),
  });

  const encodedHeartbeat = new TextEncoder().encode(`data: ${heartbeat}\n\n`);

  const connectionsToRemove: Connection[] = [];

  connections.forEach((connection) => {
    try {
      connection.controller.enqueue(encodedHeartbeat);
    } catch (error) {
      connectionsToRemove.push(connection);
    }
  });

  connectionsToRemove.forEach((conn) => removeConnection(conn));
}

/**
 * Get the number of active connections (for monitoring/debugging)
 */
export function getConnectionCount(): number {
  return connections.size;
}

