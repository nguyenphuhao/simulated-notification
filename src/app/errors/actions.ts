'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export type ErrorLevel = 'ERROR' | 'WARN' | 'INFO';

export interface ErrorLogListParams {
  page?: number;
  limit?: number;
  search?: string;
  level?: ErrorLevel;
  source?: string;
  orderBy?: string;
  order?: 'asc' | 'desc';
}

export interface ErrorLogListResult {
  data: any[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export async function getErrorLogs(
  params: ErrorLogListParams = {}
): Promise<ErrorLogListResult> {
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
    // Check if errorLog model is available
    if (!prisma.errorLog) {
      throw new Error('Prisma errorLog model is not available. Please restart the dev server.');
    }
    const where: any = {};

    if (level) {
      where.level = level;
    }

    if (source) {
      where.source = {
        contains: source,
      };
    }

    if (search) {
      // SQLite doesn't support case-insensitive mode, so we'll use contains
      // For case-insensitive search, we can use Prisma raw query or handle in application
      where.OR = [
        { message: { contains: search } },
        { source: { contains: search } },
        { stack: { contains: search } },
        { requestUrl: { contains: search } },
        { context: { contains: search } },
      ];
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      prisma.errorLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [orderBy]: order,
        },
      }),
      prisma.errorLog.count({ where }),
    ]);

    return {
      data: data.map((log) => ({
        ...log,
        createdAt: log.createdAt,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error: any) {
    console.error('Error fetching error logs:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      prismaErrorLogAvailable: !!prisma.errorLog,
    });
    throw new Error(`Failed to fetch error logs: ${error.message}`);
  }
}

export async function getErrorLogById(id: string) {
  try {
    const errorLog = await prisma.errorLog.findUnique({
      where: { id },
    });

    if (!errorLog) {
      throw new Error('Error log not found');
    }

    return errorLog;
  } catch (error: any) {
    console.error('Error fetching error log:', error);
    throw new Error('Failed to fetch error log');
  }
}

export async function deleteErrorLog(id: string) {
  try {
    await prisma.errorLog.delete({
      where: { id },
    });
    revalidatePath('/errors');
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting error log:', error);
    throw new Error('Failed to delete error log');
  }
}

export async function deleteAllErrorLogs() {
  try {
    await prisma.errorLog.deleteMany({});
    revalidatePath('/errors');
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting all error logs:', error);
    throw new Error('Failed to delete all error logs');
  }
}

export async function getErrorLogStats() {
  try {
    const [total, byLevel, bySource] = await Promise.all([
      prisma.errorLog.count(),
      prisma.errorLog.groupBy({
        by: ['level'],
        _count: true,
      }),
      prisma.errorLog.groupBy({
        by: ['source'],
        _count: true,
        orderBy: {
          _count: {
            source: 'desc',
          },
        },
        take: 10,
      }),
    ]);

    return {
      total,
      byLevel: byLevel.reduce((acc, item) => {
        acc[item.level] = item._count;
        return acc;
      }, {} as Record<string, number>),
      bySource: bySource.map((item) => ({
        source: item.source,
        count: item._count,
      })),
    };
  } catch (error: any) {
    console.error('Error fetching error log stats:', error);
    return {
      total: 0,
      byLevel: {},
      bySource: [],
    };
  }
}

export async function getUniqueSources() {
  try {
    const sources = await prisma.errorLog.findMany({
      select: { source: true },
      distinct: ['source'],
      orderBy: { source: 'asc' },
    });
    return sources.map((s) => s.source);
  } catch (error: any) {
    console.error('Error fetching unique sources:', error);
    return [];
  }
}

