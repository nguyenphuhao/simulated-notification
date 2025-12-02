'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export interface MockEndpointListParams {
  page?: number;
  limit?: number;
  search?: string;
  method?: string;
  isActive?: boolean;
  orderBy?: string;
  order?: 'asc' | 'desc';
}

export interface MockEndpointListResult {
  data: any[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export async function getMockEndpoints(
  params: MockEndpointListParams = {}
): Promise<MockEndpointListResult> {
  const {
    page = 1,
    limit = 20,
    search,
    method,
    isActive,
    orderBy = 'createdAt',
    order = 'desc',
  } = params;

  try {
    const where: any = {};

    if (method) {
      where.method = method.toUpperCase();
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (search) {
      where.OR = [
        { path: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.mockEndpoint.findMany({
        where,
        orderBy: { [orderBy]: order },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: {
            select: { requests: true },
          },
        },
      }),
      prisma.mockEndpoint.count({ where }),
    ]);

    return {
      data: data.map((ep) => ({
        ...ep,
        requestCount: ep._count.requests,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error: any) {
    console.error('Error fetching mock endpoints:', error);
    throw new Error(error.message || 'Failed to fetch mock endpoints');
  }
}

export async function getMockEndpointById(id: string) {
  try {
    const endpoint = await prisma.mockEndpoint.findUnique({
      where: { id },
      include: {
        _count: {
          select: { requests: true },
        },
      },
    });

    if (!endpoint) {
      throw new Error('Mock endpoint not found');
    }

    return {
      ...endpoint,
      requestCount: endpoint._count.requests,
    };
  } catch (error: any) {
    console.error('Error fetching mock endpoint:', error);
    throw new Error(error.message || 'Failed to fetch mock endpoint');
  }
}

export async function createMockEndpoint(data: {
  path: string;
  method: string;
  name?: string;
  description?: string;
  responseCode: number;
  responseBody: string;
  responseHeaders?: string;
  isActive?: boolean;
}) {
  try {
    // Validate path and method uniqueness
    const existing = await prisma.mockEndpoint.findFirst({
      where: {
        path: data.path,
        method: data.method.toUpperCase(),
      },
    });

    if (existing) {
      throw new Error(
        `Mock endpoint with path "${data.path}" and method "${data.method}" already exists`
      );
    }

    const endpoint = await prisma.mockEndpoint.create({
      data: {
        path: data.path,
        method: data.method.toUpperCase(),
        name: data.name || null,
        description: data.description || null,
        responseCode: data.responseCode,
        responseBody: data.responseBody,
        responseHeaders: data.responseHeaders || null,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });

    revalidatePath('/mocks');
    return { success: true, data: endpoint };
  } catch (error: any) {
    console.error('Error creating mock endpoint:', error);
    throw new Error(error.message || 'Failed to create mock endpoint');
  }
}

export async function updateMockEndpoint(
  id: string,
  data: {
    path?: string;
    method?: string;
    name?: string;
    description?: string;
    responseCode?: number;
    responseBody?: string;
    responseHeaders?: string;
    isActive?: boolean;
  }
) {
  try {
    // If path or method is being updated, check uniqueness
    if (data.path || data.method) {
      const current = await prisma.mockEndpoint.findUnique({
        where: { id },
      });

      if (!current) {
        throw new Error('Mock endpoint not found');
      }

      const newPath = data.path || current.path;
      const newMethod = (data.method || current.method).toUpperCase();

      // Check if another endpoint with same path+method exists
      const existing = await prisma.mockEndpoint.findFirst({
        where: {
          path: newPath,
          method: newMethod,
        },
      });

      if (existing && existing.id !== id) {
        throw new Error(
          `Mock endpoint with path "${newPath}" and method "${newMethod}" already exists`
        );
      }
    }

    const updateData: any = {};
    if (data.path !== undefined) updateData.path = data.path;
    if (data.method !== undefined)
      updateData.method = data.method.toUpperCase();
    if (data.name !== undefined) updateData.name = data.name || null;
    if (data.description !== undefined)
      updateData.description = data.description || null;
    if (data.responseCode !== undefined)
      updateData.responseCode = data.responseCode;
    if (data.responseBody !== undefined)
      updateData.responseBody = data.responseBody;
    if (data.responseHeaders !== undefined)
      updateData.responseHeaders = data.responseHeaders || null;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const endpoint = await prisma.mockEndpoint.update({
      where: { id },
      data: updateData,
    });

    revalidatePath('/mocks');
    revalidatePath(`/mocks/${id}`);
    return { success: true, data: endpoint };
  } catch (error: any) {
    console.error('Error updating mock endpoint:', error);
    throw new Error(error.message || 'Failed to update mock endpoint');
  }
}

export async function deleteMockEndpoint(id: string) {
  try {
    await prisma.mockEndpoint.delete({
      where: { id },
    });
    revalidatePath('/mocks');
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting mock endpoint:', error);
    throw new Error(error.message || 'Failed to delete mock endpoint');
  }
}

export async function toggleMockEndpointActive(id: string) {
  try {
    const endpoint = await prisma.mockEndpoint.findUnique({
      where: { id },
    });

    if (!endpoint) {
      throw new Error('Mock endpoint not found');
    }

    const updated = await prisma.mockEndpoint.update({
      where: { id },
      data: { isActive: !endpoint.isActive },
    });

    revalidatePath('/mocks');
    revalidatePath(`/mocks/${id}`);
    return { success: true, data: updated };
  } catch (error: any) {
    console.error('Error toggling mock endpoint:', error);
    throw new Error(error.message || 'Failed to toggle mock endpoint');
  }
}

export interface MockRequestListParams {
  mockEndpointId: string;
  page?: number;
  limit?: number;
  orderBy?: string;
  order?: 'asc' | 'desc';
}

export async function getMockRequests(
  params: MockRequestListParams
): Promise<MockEndpointListResult> {
  const {
    mockEndpointId,
    page = 1,
    limit = 20,
    orderBy = 'createdAt',
    order = 'desc',
  } = params;

  try {
    const where: any = {
      mockEndpointId,
    };

    const [data, total] = await Promise.all([
      prisma.mockRequest.findMany({
        where,
        orderBy: { [orderBy]: order },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.mockRequest.count({ where }),
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
    console.error('Error fetching mock requests:', error);
    throw new Error(error.message || 'Failed to fetch mock requests');
  }
}

export async function getMockRequestById(id: string) {
  try {
    const request = await prisma.mockRequest.findUnique({
      where: { id },
      include: {
        mockEndpoint: true,
      },
    });

    if (!request) {
      throw new Error('Mock request not found');
    }

    return request;
  } catch (error: any) {
    console.error('Error fetching mock request:', error);
    throw new Error(error.message || 'Failed to fetch mock request');
  }
}

