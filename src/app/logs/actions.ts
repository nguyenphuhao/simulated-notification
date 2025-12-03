'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export interface LogListParams {
  page?: number;
  limit?: number;
  search?: string;
  level?: string | string[];
  source?: string | string[];
  startDate?: Date;
  endDate?: Date;
  orderBy?: string;
  order?: 'asc' | 'desc';
}

export interface LogListResult {
  data: any[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Parse log level from body
function parseLogLevel(body: string | null): string {
  if (!body) return 'INFO';
  try {
    const parsed = JSON.parse(body);
    return parsed.level || parsed.severity || 'INFO';
  } catch {
    return 'INFO';
  }
}

// Parse log message from body
function parseLogMessage(body: string | null): string {
  if (!body) return 'No message';
  try {
    const parsed = JSON.parse(body);
    return parsed.message || parsed.msg || parsed.text || JSON.stringify(parsed);
  } catch {
    return body;
  }
}

// Parse log source from body or provider
function parseLogSource(body: string | null, provider: string | null): string {
  if (!body) return provider || 'unknown';
  try {
    const parsed = JSON.parse(body);
    return parsed.source || parsed.service || parsed.app || provider || 'unknown';
  } catch {
    return provider || 'unknown';
  }
}

// Parse log tags from body
function parseLogTags(body: string | null): string[] {
  if (!body) return [];
  try {
    const parsed = JSON.parse(body);
    return parsed.tags || parsed.labels || [];
  } catch {
    return [];
  }
}

export async function getLogs(params: LogListParams = {}): Promise<LogListResult> {
  const {
    page = 1,
    limit = 20,
    search,
    level,
    source,
    orderBy = 'createdAt',
    order = 'desc',
  } = params;

  try {
    const where: any = {
      sourceUrl: '/api/logs', // Only get logs from /api/logs endpoint
    };

    if (source) {
      if (Array.isArray(source)) {
        where.provider = { in: source };
      } else {
        where.provider = source;
      }
    }

    // Date range filter
    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) {
        where.createdAt.gte = params.startDate;
      }
      if (params.endDate) {
        const endDate = new Date(params.endDate);
        endDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = endDate;
      }
    }

    // Search in body (log message)
    if (search) {
      where.body = { contains: search, mode: 'insensitive' };
    }

    const [data, total] = await Promise.all([
      prisma.message.findMany({
        where,
        orderBy: { [orderBy]: order },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.message.count({ where }),
    ]);

    // Enrich logs with parsed data
    const enrichedLogs = data.map((log) => {
      const logLevel = parseLogLevel(log.body);
      const logMessage = parseLogMessage(log.body);
      const logSource = parseLogSource(log.body, log.provider);
      const logTags = parseLogTags(log.body);

      return {
        ...log,
        logLevel,
        logMessage,
        logSource,
        logTags,
      };
    });

    // Filter by level if specified (client-side filtering after parsing)
    let filteredLogs = enrichedLogs;
    if (level) {
      const levels = Array.isArray(level) ? level : [level];
      filteredLogs = enrichedLogs.filter((log) => levels.includes(log.logLevel));
    }

    // Recalculate total if filtered by level
    let finalTotal = total;
    if (level) {
      finalTotal = filteredLogs.length;
      // If we filtered, we need to get the correct count
      // For now, we'll use the filtered count, but this isn't perfect for pagination
      // A better approach would be to filter at DB level, but that requires parsing JSON
    }

    return {
      data: filteredLogs,
      meta: {
        page,
        limit,
        total: finalTotal,
        totalPages: Math.ceil(finalTotal / limit),
      },
    };
  } catch (error: any) {
    console.error('Error fetching logs:', error);
    throw new Error(error.message || 'Failed to fetch logs');
  }
}

export async function getLogById(id: string) {
  try {
    const log = await prisma.message.findUnique({
      where: { id },
    });

    if (!log || log.sourceUrl !== '/api/logs') {
      throw new Error('Log not found');
    }

    // Enrich with parsed data
    const logLevel = parseLogLevel(log.body);
    const logMessage = parseLogMessage(log.body);
    const logSource = parseLogSource(log.body, log.provider);
    const logTags = parseLogTags(log.body);

    return {
      ...log,
      logLevel,
      logMessage,
      logSource,
      logTags,
    };
  } catch (error: any) {
    console.error('Error fetching log:', error);
    throw new Error(error.message || 'Failed to fetch log');
  }
}

export async function deleteLog(id: string) {
  try {
    await prisma.message.delete({
      where: { id },
    });
    revalidatePath('/logs');
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting log:', error);
    throw new Error(error.message || 'Failed to delete log');
  }
}

export async function deleteAllLogs() {
  try {
    const result = await prisma.message.deleteMany({
      where: {
        sourceUrl: '/api/logs',
      },
    });
    revalidatePath('/logs');
    return { success: true, deletedCount: result.count };
  } catch (error: any) {
    console.error('Error deleting all logs:', error);
    throw new Error(error.message || 'Failed to delete all logs');
  }
}

export async function getUniqueLogSources() {
  try {
    const logs = await prisma.message.findMany({
      where: {
        sourceUrl: '/api/logs',
        provider: {
          not: null,
        },
      },
      select: {
        provider: true,
        body: true,
      },
      distinct: ['provider'],
    });

    // Also parse sources from body
    const sources = new Set<string>();
    logs.forEach((log) => {
      if (log.provider) {
        sources.add(log.provider);
      }
      if (log.body) {
        try {
          const parsed = JSON.parse(log.body);
          const source = parsed.source || parsed.service || parsed.app;
          if (source) {
            sources.add(source);
          }
        } catch {
          // Not JSON
        }
      }
    });

    return Array.from(sources).sort();
  } catch (error: any) {
    console.error('Error fetching log sources:', error);
    return [];
  }
}

export async function getUniqueLogLevels() {
  try {
    const logs = await prisma.message.findMany({
      where: {
        sourceUrl: '/api/logs',
        body: {
          not: null,
        },
      },
      select: {
        body: true,
      },
      take: 1000, // Sample to get levels
    });

    const levels = new Set<string>();
    logs.forEach((log) => {
      if (log.body) {
        try {
          const parsed = JSON.parse(log.body);
          const level = parsed.level || parsed.severity;
          if (level) {
            levels.add(level.toUpperCase());
          }
        } catch {
          // Not JSON
        }
      }
    });

    // Add common levels if not found
    ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'].forEach((level) => {
      levels.add(level);
    });

    return Array.from(levels).sort();
  } catch (error: any) {
    console.error('Error fetching log levels:', error);
    return ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];
  }
}

