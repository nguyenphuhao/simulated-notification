'use server';

import { prisma } from '@/lib/prisma';
import { MessageCategory } from '@/lib/types';
import { revalidatePath } from 'next/cache';

export interface MessageListParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: MessageCategory;
  provider?: string;
  method?: string;
  ipAddress?: string;
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
      where.category = category;
    }

    if (provider) {
      where.provider = provider;
    }

    if (method) {
      where.method = method;
    }

    if (ipAddress) {
      where.ipAddress = ipAddress;
    }

    if (search) {
      where.OR = [
        { sourceUrl: { contains: search } },
        { body: { contains: search } },
        { headers: { contains: search } },
        { ipAddress: { contains: search } },
      ];
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

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error: any) {
    console.error('Error fetching messages:', error);
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

