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
    .filter((t) => t !== null && t > 0)
    .sort((a, b) => a - b);

  if (responseTimes.length === 0) {
    return {
      totalRequests: messages.length,
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

