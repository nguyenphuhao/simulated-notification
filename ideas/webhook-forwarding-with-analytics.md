# Webhook Forwarding với Request Replay & Performance Analytics

## Tổng quan

Nhóm tính năng tích hợp gồm 3 phần chính:
1. **Webhook Forwarding**: Forward requests đến server thật và capture cả request + response
2. **Request Replay & Testing**: Replay requests đã capture để test lại
3. **Performance Analytics**: Phân tích performance từ captured data

## Mối quan hệ giữa các tính năng

```
1. Webhook Forwarding
   ↓
   Capture Request + Response + Timing
   ↓
   Save to Database
   ↓
2. Performance Analytics
   ↓
   Analyze captured data
   ↓
   Generate metrics & insights
   ↓
3. Request Replay & Testing
   ↓
   Replay từ captured requests
   ↓
   Compare với original responses
```

## Database Schema

### 1. ForwardConfig Model

```prisma
model ForwardConfig {
  id            String   @id @default(cuid())
  
  // Proxy path (what client sends)
  proxyPath     String   // "/api/proxy/snowplow/track" hoặc "/api/proxy/snowplow/*"
  method        String   // "POST", "GET", "PUT", "DELETE", "PATCH"
  
  // Target configuration
  targetUrl     String   // "https://real-server.com/api/endpoint" hoặc "https://real-server.com/api/:path"
  pathRewrite   String?  // Pattern để rewrite path (optional), e.g., "/track" để remove proxy prefix
  
  // Headers transformation (optional)
  addHeaders    String?  // JSON: {"Authorization": "Bearer xxx", "X-Custom-Header": "value"}
  removeHeaders String?  // JSON array: ["X-Forwarded-For", "X-Real-IP"]
  
  // Options
  enabled       Boolean  @default(true)
  timeout       Int      @default(30000) // milliseconds
  retryCount    Int      @default(0)     // Number of retries on failure
  retryDelay    Int      @default(1000)  // Delay between retries (milliseconds)
  
  // Metadata
  name          String?  // Human-readable name, e.g., "Snowplow Event Tracking"
  description   String?  // Description of what this forward config does
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  // Relations
  forwardedMessages Message[] // Messages that used this config
  
  @@unique([proxyPath, method])
  @@index([proxyPath])
  @@index([method])
  @@index([enabled])
  @@map("forward_configs")
}
```

### 2. Update Message Model

```prisma
model Message {
  // ... existing fields ...
  
  // Forwarding fields
  forwarded        Boolean   @default(false)
  forwardConfigId  String?  // Reference to ForwardConfig
  forwardConfig    ForwardConfig? @relation(fields: [forwardConfigId], references: [id])
  forwardTarget    String?   // Actual URL that was forwarded to
  forwardStatus    String?   // "SUCCESS", "FAILED", "TIMEOUT", "ERROR"
  forwardError     String?   // Error message if forward failed
  
  // Performance fields
  responseTime     Int?      // Response time in milliseconds
  responseSize     Int?      // Response body size in bytes
  requestSize      Int?      // Request body size in bytes
  responseHeaders  String?   // JSON string of response headers
  
  // Replay fields
  replayCount      Int       @default(0)
  lastReplayedAt   DateTime?
  lastReplayStatus String?   // "SUCCESS", "FAILED"
  
  @@index([forwarded])
  @@index([forwardConfigId])
  @@index([forwardStatus])
  @@index([responseTime])
}
```

### 3. ReplayHistory Model (Optional - để track replay history)

```prisma
model ReplayHistory {
  id            String   @id @default(cuid())
  messageId     String
  message       Message  @relation(fields: [messageId], references: [id], onDelete: Cascade)
  
  // Replay details
  replayedAt    DateTime @default(now())
  targetUrl    String   // URL that was replayed to
  statusCode   Int?     // Response status code
  responseTime Int?     // Response time in milliseconds
  success      Boolean  // Whether replay was successful
  
  // Comparison với original
  originalStatusCode Int?
  originalResponseTime Int?
  responseDiff String?  // JSON diff between original and replay response
  
  // Error info
  errorMessage String?
  
  createdAt     DateTime @default(now())
  
  @@index([messageId])
  @@index([replayedAt])
  @@map("replay_histories")
}
```

## Implementation

### 1. Forward Service

**File:** `src/lib/forward-service.ts`

```typescript
import { prisma } from './prisma';
import { MessageCategory } from './types';

export interface ForwardResult {
  success: boolean;
  statusCode?: number;
  responseBody?: string;
  responseHeaders?: Record<string, string>;
  responseTime?: number;
  error?: string;
}

export interface ForwardConfig {
  id: string;
  proxyPath: string;
  method: string;
  targetUrl: string;
  pathRewrite?: string;
  addHeaders?: Record<string, string>;
  removeHeaders?: string[];
  timeout: number;
  retryCount: number;
  retryDelay: number;
}

/**
 * Find matching forward config for a proxy path
 */
export async function findForwardConfig(
  proxyPath: string,
  method: string
): Promise<ForwardConfig | null> {
  // First try exact match
  let config = await prisma.forwardConfig.findFirst({
    where: {
      proxyPath: proxyPath,
      method: method.toUpperCase(),
      enabled: true,
    },
  });

  if (config) {
    return mapToForwardConfig(config);
  }

  // Try pattern match (wildcard)
  // Find configs with wildcard patterns
  const allConfigs = await prisma.forwardConfig.findMany({
    where: {
      method: method.toUpperCase(),
      enabled: true,
    },
  });

  for (const cfg of allConfigs) {
    if (matchPathPattern(cfg.proxyPath, proxyPath)) {
      return mapToForwardConfig(cfg);
    }
  }

  return null;
}

/**
 * Match proxy path với pattern (support wildcard *)
 */
function matchPathPattern(pattern: string, path: string): boolean {
  // Convert pattern to regex
  // e.g., "/api/proxy/snowplow/*" -> "/api/proxy/snowplow/.*"
  const regexPattern = pattern
    .replace(/\*/g, '.*')
    .replace(/\//g, '\\/');
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(path);
}

/**
 * Build target URL from config and proxy path
 */
export function buildTargetUrl(
  config: ForwardConfig,
  proxyPath: string
): string {
  let targetUrl = config.targetUrl;

  // Apply path rewrite if needed
  if (config.pathRewrite) {
    // Extract path part from proxy path
    // e.g., "/api/proxy/snowplow/track" -> "/track"
    const pathMatch = proxyPath.match(/\/api\/proxy\/[^/]+(.+)$/);
    if (pathMatch) {
      const extractedPath = pathMatch[1];
      targetUrl = targetUrl.replace('*', extractedPath);
    }
  }

  return targetUrl;
}

/**
 * Forward request to target server
 */
export async function forwardRequest(
  targetUrl: string,
  method: string,
  headers: Record<string, string>,
  body: string | null,
  config: ForwardConfig
): Promise<ForwardResult> {
  const startTime = Date.now();

  // Prepare headers
  const forwardHeaders = { ...headers };

  // Remove headers if specified
  if (config.removeHeaders) {
    const headersToRemove = JSON.parse(config.removeHeaders);
    headersToRemove.forEach((h: string) => {
      delete forwardHeaders[h.toLowerCase()];
    });
  }

  // Add headers if specified
  if (config.addHeaders) {
    const headersToAdd = JSON.parse(config.addHeaders);
    Object.assign(forwardHeaders, headersToAdd);
  }

  // Remove proxy-specific headers
  delete forwardHeaders['x-forward-target'];
  delete forwardHeaders['host'];

  let lastError: Error | null = null;

  // Retry logic
  for (let attempt = 0; attempt <= config.retryCount; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        config.timeout
      );

      const response = await fetch(targetUrl, {
        method,
        headers: forwardHeaders,
        body: body || undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseTime = Date.now() - startTime;
      const responseBody = await response.text();
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      return {
        success: response.ok,
        statusCode: response.status,
        responseBody,
        responseHeaders,
        responseTime,
      };
    } catch (error: any) {
      lastError = error;

      // Don't retry on abort (timeout)
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: 'Request timeout',
          responseTime: Date.now() - startTime,
        };
      }

      // Wait before retry (except last attempt)
      if (attempt < config.retryCount) {
        await new Promise((resolve) =>
          setTimeout(resolve, config.retryDelay)
        );
      }
    }
  }

  return {
    success: false,
    error: lastError?.message || 'Unknown error',
    responseTime: Date.now() - startTime,
  };
}

function mapToForwardConfig(dbConfig: any): ForwardConfig {
  return {
    id: dbConfig.id,
    proxyPath: dbConfig.proxyPath,
    method: dbConfig.method,
    targetUrl: dbConfig.targetUrl,
    pathRewrite: dbConfig.pathRewrite || undefined,
    addHeaders: dbConfig.addHeaders
      ? JSON.parse(dbConfig.addHeaders)
      : undefined,
    removeHeaders: dbConfig.removeHeaders
      ? JSON.parse(dbConfig.removeHeaders)
      : undefined,
    timeout: dbConfig.timeout,
    retryCount: dbConfig.retryCount,
    retryDelay: dbConfig.retryDelay,
  };
}
```

### 2. Update Proxy Route

**File:** `src/app/api/proxy/[...path]/route.ts`

Thêm logic forwarding sau khi check mock endpoints:

```typescript
// After mock endpoint check, before regular logging:

// Check for forward config
const forwardConfig = await findForwardConfig(fullPath, method);

if (forwardConfig) {
  const targetUrl = buildTargetUrl(forwardConfig, fullPath);
  
  // Forward request
  const forwardResult = await forwardRequest(
    targetUrl,
    method,
    headers,
    body,
    forwardConfig
  );

  // Calculate sizes
  const requestSize = body ? Buffer.byteLength(body, 'utf8') : 0;
  const responseSize = forwardResult.responseBody
    ? Buffer.byteLength(forwardResult.responseBody, 'utf8')
    : 0;

  // Save to database
  const savedMessage = await prisma.message.create({
    data: {
      category: MessageCategory.GENERAL, // hoặc categorize như bình thường
      provider: null,
      sourceUrl: fullPath,
      method,
      headers: JSON.stringify(headers),
      body: body || null,
      queryParams: Object.keys(queryParams).length > 0 ? JSON.stringify(queryParams) : null,
      ipAddress,
      userAgent,
      
      // Forwarding fields
      forwarded: true,
      forwardConfigId: forwardConfig.id,
      forwardTarget: targetUrl,
      forwardStatus: forwardResult.success ? 'SUCCESS' : 'FAILED',
      forwardError: forwardResult.error || null,
      
      // Performance fields
      statusCode: forwardResult.statusCode || null,
      responseBody: forwardResult.responseBody || null,
      responseHeaders: forwardResult.responseHeaders
        ? JSON.stringify(forwardResult.responseHeaders)
        : null,
      responseTime: forwardResult.responseTime || null,
      responseSize: responseSize || null,
      requestSize: requestSize || null,
      
      createdAt: new Date(),
    },
  });

  // Broadcast new message
  try {
    const { broadcastNewMessage } = await import('@/lib/sse-manager');
    broadcastNewMessage(savedMessage.id);
  } catch (err) {
    console.error('[PROXY] Error broadcasting new message:', err);
  }

  // Return real response to client
  return NextResponse.json(
    forwardResult.responseBody ? JSON.parse(forwardResult.responseBody) : forwardResult.responseBody,
    {
      status: forwardResult.statusCode || 200,
      headers: {
        ...getCorsHeaders(request),
        ...forwardResult.responseHeaders,
      },
    }
  );
}

// Continue with regular logging if no forward config...
```

### 3. Forward Config API

**File:** `src/app/api/forward-configs/route.ts`

```typescript
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
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

**File:** `src/app/api/forward-configs/[id]/route.ts`

```typescript
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
        ...(body.addHeaders && {
          addHeaders: JSON.stringify(body.addHeaders),
        }),
        ...(body.removeHeaders && {
          removeHeaders: JSON.stringify(body.removeHeaders),
        }),
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
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

### 4. Request Replay Service

**File:** `src/lib/replay-service.ts`

```typescript
import { prisma } from './prisma';
import { forwardRequest, buildTargetUrl, findForwardConfig } from './forward-service';

export interface ReplayOptions {
  messageId: string;
  targetUrl?: string; // Optional: override target URL
  modifyHeaders?: Record<string, string>; // Optional: modify headers
  modifyBody?: any; // Optional: modify body
}

export interface ReplayResult {
  success: boolean;
  statusCode?: number;
  responseBody?: string;
  responseTime?: number;
  error?: string;
  comparison?: {
    statusCodeMatch: boolean;
    responseTimeDiff?: number;
    responseBodyDiff?: string;
  };
}

/**
 * Replay a captured request
 */
export async function replayRequest(
  options: ReplayOptions
): Promise<ReplayResult> {
  // Load original message
  const message = await prisma.message.findUnique({
    where: { id: options.messageId },
  });

  if (!message) {
    throw new Error('Message not found');
  }

  if (!message.forwarded) {
    throw new Error('Message was not forwarded, cannot replay');
  }

  // Get forward config (if still exists)
  let forwardConfig = null;
  if (message.forwardConfigId) {
    forwardConfig = await prisma.forwardConfig.findUnique({
      where: { id: message.forwardConfigId },
    });
  }

  // Determine target URL
  let targetUrl = options.targetUrl || message.forwardTarget;
  if (!targetUrl && forwardConfig) {
    targetUrl = buildTargetUrl(forwardConfig, message.sourceUrl);
  }

  if (!targetUrl) {
    throw new Error('Cannot determine target URL for replay');
  }

  // Parse original request data
  const headers = message.headers ? JSON.parse(message.headers) : {};
  const body = options.modifyBody || (message.body ? JSON.parse(message.body) : null);

  // Modify headers if specified
  if (options.modifyHeaders) {
    Object.assign(headers, options.modifyHeaders);
  }

  // Use forward config if available
  const config = forwardConfig || {
    id: '',
    proxyPath: message.sourceUrl,
    method: message.method,
    targetUrl: targetUrl,
    timeout: 30000,
    retryCount: 0,
    retryDelay: 1000,
  };

  // Forward request
  const startTime = Date.now();
  const result = await forwardRequest(
    targetUrl,
    message.method,
    headers,
    body ? JSON.stringify(body) : null,
    config
  );

  const responseTime = Date.now() - startTime;

  // Compare with original
  const comparison = {
    statusCodeMatch: result.statusCode === message.statusCode,
    responseTimeDiff: result.responseTime
      ? result.responseTime - (message.responseTime || 0)
      : undefined,
    responseBodyDiff: compareResponses(
      message.responseBody,
      result.responseBody
    ),
  };

  // Save replay history
  await prisma.replayHistory.create({
    data: {
      messageId: message.id,
      targetUrl: targetUrl,
      statusCode: result.statusCode || null,
      responseTime: result.responseTime || null,
      success: result.success,
      errorMessage: result.error || null,
      originalStatusCode: message.statusCode || null,
      originalResponseTime: message.responseTime || null,
      responseDiff: comparison.responseBodyDiff || null,
    },
  });

  // Update message replay count
  await prisma.message.update({
    where: { id: message.id },
    data: {
      replayCount: { increment: 1 },
      lastReplayedAt: new Date(),
      lastReplayStatus: result.success ? 'SUCCESS' : 'FAILED',
    },
  });

  return {
    ...result,
    responseTime,
    comparison,
  };
}

/**
 * Compare two response bodies
 */
function compareResponses(
  original: string | null,
  replayed: string | undefined
): string | undefined {
  if (!original || !replayed) {
    return undefined;
  }

  try {
    const orig = JSON.parse(original);
    const replay = JSON.parse(replayed);
    
    // Simple diff (could use a library like deep-diff)
    const diff: any = {};
    
    // Compare keys
    const allKeys = new Set([...Object.keys(orig), ...Object.keys(replay)]);
    for (const key of allKeys) {
      if (orig[key] !== replay[key]) {
        diff[key] = {
          original: orig[key],
          replayed: replay[key],
        };
      }
    }
    
    return Object.keys(diff).length > 0 ? JSON.stringify(diff) : undefined;
  } catch (e) {
    // Not JSON, compare as strings
    return original !== replayed ? 'Response body differs' : undefined;
  }
}
```

### 5. Performance Analytics Service

**File:** `src/lib/performance-analytics.ts`

```typescript
import { prisma } from './prisma';

export interface PerformanceMetrics {
  totalRequests: number;
  successRate: number;
  averageResponseTime: number;
  p50: number; // Median
  p95: number;
  p99: number;
  minResponseTime: number;
  maxResponseTime: number;
  errorRate: number;
  totalBytesTransferred: number;
}

export interface EndpointPerformance {
  endpoint: string;
  method: string;
  metrics: PerformanceMetrics;
  requestCount: number;
}

/**
 * Get performance metrics for forwarded requests
 */
export async function getPerformanceMetrics(
  filters: {
    startDate?: Date;
    endDate?: Date;
    endpoint?: string;
    method?: string;
  } = {}
): Promise<PerformanceMetrics> {
  const where: any = {
    forwarded: true,
    responseTime: { not: null },
  };

  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) {
      where.createdAt.gte = filters.startDate;
    }
    if (filters.endDate) {
      where.createdAt.lte = filters.endDate;
    }
  }

  if (filters.endpoint) {
    where.sourceUrl = { contains: filters.endpoint };
  }

  if (filters.method) {
    where.method = filters.method;
  }

  const messages = await prisma.message.findMany({
    where,
    select: {
      statusCode: true,
      responseTime: true,
      responseSize: true,
      requestSize: true,
      forwardStatus: true,
    },
  });

  if (messages.length === 0) {
    return {
      totalRequests: 0,
      successRate: 0,
      averageResponseTime: 0,
      p50: 0,
      p95: 0,
      p99: 0,
      minResponseTime: 0,
      maxResponseTime: 0,
      errorRate: 0,
      totalBytesTransferred: 0,
    };
  }

  const responseTimes = messages
    .map((m) => m.responseTime!)
    .filter((t) => t !== null)
    .sort((a, b) => a - b);

  const successful = messages.filter(
    (m) => m.forwardStatus === 'SUCCESS' && m.statusCode && m.statusCode < 400
  ).length;

  const errors = messages.filter(
    (m) => m.forwardStatus === 'FAILED' || (m.statusCode && m.statusCode >= 400)
  ).length;

  const totalBytes = messages.reduce(
    (sum, m) => sum + (m.responseSize || 0) + (m.requestSize || 0),
    0
  );

  return {
    totalRequests: messages.length,
    successRate: (successful / messages.length) * 100,
    averageResponseTime:
      responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
    p50: percentile(responseTimes, 50),
    p95: percentile(responseTimes, 95),
    p99: percentile(responseTimes, 99),
    minResponseTime: Math.min(...responseTimes),
    maxResponseTime: Math.max(...responseTimes),
    errorRate: (errors / messages.length) * 100,
    totalBytesTransferred: totalBytes,
  };
}

/**
 * Get performance by endpoint
 */
export async function getEndpointPerformance(
  filters: {
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  } = {}
): Promise<EndpointPerformance[]> {
  const where: any = {
    forwarded: true,
    responseTime: { not: null },
  };

  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) {
      where.createdAt.gte = filters.startDate;
    }
    if (filters.endDate) {
      where.createdAt.lte = filters.endDate;
    }
  }

  // Group by endpoint and method
  const messages = await prisma.message.findMany({
    where,
    select: {
      sourceUrl: true,
      method: true,
      statusCode: true,
      responseTime: true,
      responseSize: true,
      requestSize: true,
      forwardStatus: true,
    },
  });

  // Group by endpoint + method
  const grouped = new Map<string, typeof messages>();
  for (const msg of messages) {
    const key = `${msg.method} ${msg.sourceUrl}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(msg);
  }

  // Calculate metrics for each endpoint
  const results: EndpointPerformance[] = [];
  for (const [key, endpointMessages] of grouped.entries()) {
    const [method, endpoint] = key.split(' ', 2);
    const metrics = await getPerformanceMetrics({
      endpoint,
      method,
      startDate: filters.startDate,
      endDate: filters.endDate,
    });

    results.push({
      endpoint,
      method,
      metrics,
      requestCount: endpointMessages.length,
    });
  }

  // Sort by request count (descending)
  results.sort((a, b) => b.requestCount - a.requestCount);

  return results.slice(0, filters.limit || 50);
}

/**
 * Calculate percentile
 */
function percentile(sortedArray: number[], percentile: number): number {
  if (sortedArray.length === 0) return 0;
  const index = (percentile / 100) * (sortedArray.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
}
```

## UI Components

### 1. Forward Configs Management Page

**File:** `src/app/forward-configs/page.tsx`

- List all forward configs
- Create/Edit/Delete configs
- Enable/Disable configs
- Test connection button

### 2. Forward Config Form

**File:** `src/app/forward-configs/new/page.tsx` và `src/app/forward-configs/[id]/edit/page.tsx`

- Form fields:
  - Name (optional)
  - Description (optional)
  - Proxy Path (required) - với pattern examples
  - Method (required) - dropdown
  - Target URL (required)
  - Path Rewrite (optional)
  - Add Headers (JSON editor)
  - Remove Headers (array input)
  - Timeout (number input)
  - Retry Count (number input)
  - Retry Delay (number input)
  - Enabled (toggle)

### 3. Request Replay UI

**File:** `src/app/messages/[id]/replay/page.tsx`

- Show original request details
- Show original response
- Replay button
- Options to modify request before replay
- Show replay result
- Compare với original response
- Show replay history

### 4. Performance Analytics Dashboard

**File:** `src/app/analytics/page.tsx`

- Overall metrics cards
- Response time chart (line chart)
- Success rate chart
- Top endpoints table
- Error rate over time
- Filters (date range, endpoint, method)

## Migration Steps

1. **Create migration:**
   ```bash
   yarn prisma migrate dev --name add_forward_config_and_analytics
   ```

2. **Implement forward service:**
   - Create `src/lib/forward-service.ts`
   - Create `src/lib/replay-service.ts`
   - Create `src/lib/performance-analytics.ts`

3. **Update proxy route:**
   - Add forward logic to `src/app/api/proxy/[...path]/route.ts`

4. **Create APIs:**
   - `src/app/api/forward-configs/route.ts`
   - `src/app/api/forward-configs/[id]/route.ts`
   - `src/app/api/messages/[id]/replay/route.ts`
   - `src/app/api/analytics/route.ts`

5. **Create UI:**
   - Forward configs management pages
   - Replay UI
   - Analytics dashboard

6. **Update sidebar:**
   - Add "Forward Configs" menu item
   - Add "Analytics" menu item

## Use Cases

### Use Case 1: Development Testing
1. Developer configures forward config cho staging API
2. Client app sends requests to proxy
3. Proxy forwards to staging và captures response
4. Developer xem cả request và response trong UI
5. Developer có thể replay để test lại

### Use Case 2: Performance Monitoring
1. Forward config enabled cho production API
2. All requests được forward và logged
3. Analytics dashboard shows performance metrics
4. Identify slow endpoints
5. Track performance over time

### Use Case 3: Debugging Production Issues
1. User reports issue với specific request
2. Admin tìm request trong messages
3. Admin replays request để reproduce issue
4. Compare responses để find differences
5. Fix issue và verify với replay

### Use Case 4: API Migration
1. Forward config points to old API
2. Gradually migrate to new API
3. Compare responses từ old vs new
4. Ensure compatibility before full migration

## Benefits

1. **Complete Request/Response Capture**: See cả request và response từ real server
2. **Performance Insights**: Track response times, error rates, throughput
3. **Easy Testing**: Replay requests without modifying client code
4. **Debugging**: Compare responses to find issues
5. **Monitoring**: Real-time performance monitoring
6. **Flexible Configuration**: Easy to add/modify forward rules

## Future Enhancements

1. **Request Modification**: Modify request before replay (headers, body, query params)
2. **Batch Replay**: Replay multiple requests at once
3. **Scheduled Replay**: Schedule automatic replay tests
4. **Alerting**: Alert when performance degrades or errors spike
5. **Export/Import**: Export forward configs để share với team
6. **Request Templates**: Save common replay scenarios
7. **Response Diff Visualization**: Visual diff viewer cho responses
8. **Performance Baselines**: Set performance baselines và track deviations

