'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function getForwardConfigs(filters?: {
  enabled?: boolean;
}) {
  try {
    const configs = await prisma.forwardConfig.findMany({
      where: filters?.enabled !== undefined ? { enabled: filters.enabled } : undefined,
      orderBy: { createdAt: 'desc' },
    });

    return { data: configs };
  } catch (error: any) {
    console.error('Error fetching forward configs:', error);
    throw new Error(error.message || 'Failed to fetch forward configs');
  }
}

export async function getForwardConfigById(id: string) {
  try {
    const config = await prisma.forwardConfig.findUnique({
      where: { id },
    });

    if (!config) {
      throw new Error('Forward config not found');
    }

    return { data: config };
  } catch (error: any) {
    console.error('Error fetching forward config:', error);
    throw new Error(error.message || 'Failed to fetch forward config');
  }
}

export async function toggleForwardConfigEnabled(id: string, enabled: boolean) {
  try {
    const config = await prisma.forwardConfig.update({
      where: { id },
      data: { enabled },
    });

    revalidatePath('/forward-configs');
    return { success: true, data: config };
  } catch (error: any) {
    console.error('Error toggling forward config:', error);
    throw new Error(error.message || 'Failed to toggle forward config');
  }
}

export async function deleteForwardConfig(id: string) {
  try {
    await prisma.forwardConfig.delete({
      where: { id },
    });

    revalidatePath('/forward-configs');
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting forward config:', error);
    throw new Error(error.message || 'Failed to delete forward config');
  }
}

