import { NextRequest, NextResponse } from 'next/server';
import { getMessages, getUniqueIpAddresses } from '@/app/messages/actions';
import { MessageCategory } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = Number(searchParams.get('page')) || 1;
    const categoryParam = searchParams.get('category');
    const category = categoryParam && categoryParam !== 'all'
      ? (categoryParam as MessageCategory)
      : undefined;
    const providerParam = searchParams.get('provider');
    const provider = providerParam && providerParam !== 'all'
      ? providerParam
      : undefined;
    const methodParam = searchParams.get('method');
    const method = methodParam && methodParam !== 'all'
      ? methodParam
      : undefined;
    const ipAddressParam = searchParams.get('ipAddress');
    const ipAddress = ipAddressParam && ipAddressParam !== 'all'
      ? ipAddressParam
      : undefined;
    const search = searchParams.get('search') || undefined;

    const [result, uniqueIps] = await Promise.all([
      getMessages({
        page,
        limit: 20,
        search,
        category,
        provider,
        method,
        ipAddress,
      }),
      getUniqueIpAddresses(),
    ]);

    return NextResponse.json({
      messages: result.data,
      meta: result.meta,
      uniqueIpAddresses: uniqueIps,
    });
  } catch (error: any) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

