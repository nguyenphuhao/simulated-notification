import { NextRequest, NextResponse } from 'next/server';
import { getMessages, getUniqueIpAddresses } from '@/app/messages/actions';
import { MessageCategory } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = Number(searchParams.get('page')) || 1;
    const category = searchParams.get('category') && searchParams.get('category') !== 'all'
      ? (searchParams.get('category') as MessageCategory)
      : undefined;
    const provider = searchParams.get('provider') && searchParams.get('provider') !== 'all'
      ? searchParams.get('provider')
      : undefined;
    const method = searchParams.get('method') && searchParams.get('method') !== 'all'
      ? searchParams.get('method')
      : undefined;
    const ipAddress = searchParams.get('ipAddress') && searchParams.get('ipAddress') !== 'all'
      ? searchParams.get('ipAddress')
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

