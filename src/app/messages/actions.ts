'use server';

import { prisma } from '@/lib/prisma';
import { MessageCategory } from '@/lib/types';
import { revalidatePath } from 'next/cache';

export interface MessageListParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: MessageCategory | MessageCategory[];
  provider?: string | string[];
  method?: string | string[];
  ipAddress?: string;
  startDate?: Date;
  endDate?: Date;
  orderBy?: string;
  order?: 'asc' | 'desc';
}

export interface MessageListResult {
  data: any[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export async function getMessages(params: MessageListParams = {}): Promise<MessageListResult> {
  const {
    page = 1,
    limit = 20,
    search,
    category,
    provider,
    method,
    ipAddress,
    orderBy = 'createdAt',
    order = 'desc',
  } = params;

  try {
    const where: any = {};

    if (category) {
      if (Array.isArray(category)) {
        where.category = { in: category };
      } else {
        where.category = category;
      }
    }

    if (provider) {
      if (Array.isArray(provider)) {
        where.provider = { in: provider };
      } else {
        where.provider = provider;
      }
    }

    if (method) {
      if (Array.isArray(method)) {
        where.method = { in: method };
      } else {
        where.method = method;
      }
    }

    if (ipAddress) {
      where.ipAddress = ipAddress;
    }

    // Date range filter
    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) {
        where.createdAt.gte = params.startDate;
      }
      if (params.endDate) {
        // Set to end of day
        const endDate = new Date(params.endDate);
        endDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = endDate;
      }
    }

    // Search in URL
    if (search) {
      where.sourceUrl = { contains: search, mode: 'insensitive' };
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

    // Calculate duplicate counts for each message
    // A duplicate is defined as: same sourceUrl + method + body within the same second
    const dataWithDuplicates = await Promise.all(
      data.map(async (message) => {
        // Round down to the nearest second (remove milliseconds)
        const messageTime = new Date(message.createdAt);
        messageTime.setMilliseconds(0);
        
        // Calculate time range: same second (from start of second to end of second)
        const timeStart = new Date(messageTime);
        const timeEnd = new Date(messageTime);
        timeEnd.setMilliseconds(999); // End of the second (999ms)

        // Find similar messages within the same second
        const duplicateWhere: any = {
          sourceUrl: message.sourceUrl,
          method: message.method,
          createdAt: {
            gte: timeStart,
            lte: timeEnd,
          },
          // Exclude self
          id: {
            not: message.id,
          },
        };

        // If body exists, also match by body
        if (message.body) {
          duplicateWhere.body = message.body;
        }

        const duplicateCount = await prisma.message.count({
          where: duplicateWhere,
        });

        return {
          ...message,
          duplicateCount,
          isDuplicate: duplicateCount > 0,
        };
      })
    );

    return {
      data: dataWithDuplicates,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error: any) {
    console.error('Error fetching messages:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
      stack: error.stack,
    });
    
    // Provide more helpful error messages
    if (error.code === 'P1001') {
      throw new Error('Cannot reach database server. Please check DATABASE_URL.');
    } else if (error.code === 'P1003') {
      throw new Error('Database does not exist. Please run migrations.');
    } else if (error.code === 'P1017') {
      throw new Error('Database server has closed the connection.');
    }
    
    throw new Error(error.message || 'Failed to fetch messages');
  }
}

export async function getMessageById(id: string) {
  try {
    const message = await prisma.message.findUnique({
      where: { id },
    });

    if (!message) {
      throw new Error('Message not found');
    }

    return message;
  } catch (error: any) {
    console.error('Error fetching message:', error);
    throw new Error(error.message || 'Failed to fetch message');
  }
}

export async function deleteMessage(id: string) {
  try {
    await prisma.message.delete({
      where: { id },
    });
    revalidatePath('/messages');
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting message:', error);
    throw new Error(error.message || 'Failed to delete message');
  }
}

export async function deleteAllMessages() {
  try {
    const result = await prisma.message.deleteMany({});
    revalidatePath('/messages');
    return { success: true, deletedCount: result.count };
  } catch (error: any) {
    console.error('Error deleting all messages:', error);
    throw new Error(error.message || 'Failed to delete all messages');
  }
}

export async function getUniqueIpAddresses() {
  try {
    const messages = await prisma.message.findMany({
      select: {
        ipAddress: true,
      },
      distinct: ['ipAddress'],
      where: {
        ipAddress: {
          not: null,
        },
      },
      orderBy: {
        ipAddress: 'asc',
      },
    });

    return messages
      .map((m) => m.ipAddress)
      .filter((ip): ip is string => ip !== null);
  } catch (error: any) {
    console.error('Error fetching IP addresses:', error);
    return [];
  }
}

export async function getUniqueProviders() {
  try {
    const messages = await prisma.message.findMany({
      select: {
        provider: true,
      },
      distinct: ['provider'],
      where: {
        provider: {
          not: null,
        },
      },
      orderBy: {
        provider: 'asc',
      },
    });

    return messages
      .map((m) => m.provider)
      .filter((provider): provider is string => provider !== null);
  } catch (error: any) {
    console.error('Error fetching providers:', error);
    return [];
  }
}

export async function getUniqueMethods() {
  try {
    const messages = await prisma.message.findMany({
      select: {
        method: true,
      },
      distinct: ['method'],
      orderBy: {
        method: 'asc',
      },
    });

    return messages.map((m) => m.method);
  } catch (error: any) {
    console.error('Error fetching methods:', error);
    return [];
  }
}

export async function getMessageStats() {
  try {
    const [total, byCategory, byProvider] = await Promise.all([
      prisma.message.count(),
      prisma.message.groupBy({
        by: ['category'],
        _count: true,
      }),
      prisma.message.groupBy({
        by: ['provider'],
        _count: true,
      }),
    ]);

    return {
      total,
      byCategory: byCategory.map((item) => ({
        category: item.category,
        count: item._count,
      })),
      byProvider: byProvider
        .filter((item) => item.provider)
        .map((item) => ({
          provider: item.provider,
          count: item._count,
        })),
    };
  } catch (error: any) {
    console.error('Error fetching stats:', error);
    return {
      total: 0,
      byCategory: [],
      byProvider: [],
    };
  }
}

